import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  describeProviderFailure,
  isClientAbort,
  isProviderTimeout,
  providerAbortSignal,
  withAbort
} from "../../lib/net/providerRequest.js";
import { createLatestRequestGate, withRequestTimeout } from "../../lib/client/latestRequestGate.js";
import {
  resolveSttCommittedSeconds,
  resolveSttReservationSeconds
} from "../../lib/usage/sttDuration.js";
import { commitProviderUsage, settleProviderFailure } from "../../lib/usage/providerSettlement.js";

const sttRoute = await readFile(new URL("../../app/api/stt/route.js", import.meta.url), "utf8");
const ttsRoute = await readFile(new URL("../../app/api/tts/route.js", import.meta.url), "utf8");
const speechHook = await readFile(
  new URL("../../components/chat/hooks/useSpeech.js", import.meta.url),
  "utf8"
);

const never = () => new Promise(() => {});

// --- SOL-VOICE-02: ajapiir ja katkestus on eristatavad ---------------------

test("mitte kunagi lahenev provider lõpeb MEIE ajapiiriga, mitte ummikuga", async () => {
  const signal = providerAbortSignal(null, 25);
  const startedAt = Date.now();

  const error = await withAbort(never(), signal).catch((err) => err);

  assert.ok(Date.now() - startedAt < 2000, "kutse jäi ootama kauem kui ajapiir lubab");
  assert.equal(isProviderTimeout(error), true, `põhjus oli ${error?.name}`);
  assert.equal(isClientAbort(error), false, "timeout ei tohi paista kasutaja katkestusena");
  assert.deepEqual(describeProviderFailure(error), {
    aborted: true,
    reason: "provider_timeout",
    status: 504,
    log: true
  });
});

test("kasutaja katkestus on eraldi sündmus ja teda ei logita veana", async () => {
  const controller = new AbortController();
  const signal = providerAbortSignal(controller.signal, 60_000);

  const pending = withAbort(never(), signal).catch((err) => err);
  controller.abort();
  const error = await pending;

  assert.equal(isClientAbort(error), true, `põhjus oli ${error?.name}`);
  assert.equal(isProviderTimeout(error), false);
  const failure = describeProviderFailure(error);
  assert.equal(failure.status, 499);
  assert.equal(failure.log, false, "Stop ei ole tõrge, mida logisse veaks kirjutada");
  assert.equal(failure.aborted, true, "vastust ei tule, seega reservatsioon peab vabanema");
});

test("provideri päris viga jääb 502-ks ja teda EI loeta katkestuseks", () => {
  const failure = describeProviderFailure(new Error("boom"));
  assert.deepEqual(failure, { aborted: false, reason: "provider_failed", status: 502, log: true });
});

test("õnnestunud kutse ei jää signaali küljes rippuma", async () => {
  const controller = new AbortController();
  const value = await withAbort(Promise.resolve("valmis"), controller.signal);
  assert.equal(value, "valmis");
  // Kuulaja peab olema maha võetud: hilisem abort ei tohi enam midagi teha.
  controller.abort();
});

// --- SOL-VOICE-01: reservatsioon ja arvestus ------------------------------

test("tundmatu formaat ei anna enam 60-sekundilist hinda", () => {
  // 12 MB ehk marsruudi ülempiir. Vana `|| 60` luges seda minutiks.
  const twelveMb = 12 * 1024 * 1024;
  const reserved = resolveSttReservationSeconds({ measuredSeconds: null, sizeBytes: twelveMb });
  assert.ok(reserved > 60, `ülempiir oli ${reserved}s — sama viga, mis leius`);

  // Mõõdetud kestus on tugevam kui baitidest tuletatud ülempiir.
  assert.equal(resolveSttReservationSeconds({ measuredSeconds: 12, sizeBytes: twelveMb }), 12);
});

test("arvestus võtab PROVIDERI kestuse, aga ei ületa reservatsiooni", () => {
  assert.equal(
    resolveSttCommittedSeconds({
      providerUsage: { type: "duration", seconds: 42 },
      measuredSeconds: 5,
      reservedSeconds: 100
    }),
    42
  );
  // Vale hinnang ei tohi muutuda 500-ks kasutajale, kelle transkript on juba olemas.
  assert.equal(
    resolveSttCommittedSeconds({
      providerUsage: { type: "duration", seconds: 400 },
      reservedSeconds: 100
    }),
    100
  );
});

// --- Arvelduse kaks lõppu -------------------------------------------------

test("commit'i viga ei vabasta reservatsiooni ega viska tulemust ära", async () => {
  const calls = [];
  const handle = {
    userId: "u1",
    idempotencyKey: "k1",
    amount: 10n,
    service: {
      async commit() {
        calls.push("commit");
        throw new Error("db down");
      },
      async release() {
        calls.push("release");
      }
    }
  };

  let reported = null;
  const committed = await commitProviderUsage({
    handle,
    actualAmount: 7,
    onError: (error) => {
      reported = error;
    }
  });

  assert.equal(committed, null, "commit kukkus, seega kogust ei kinnitatud");
  assert.equal(reported?.message, "db down", "viga ei tohi vaikselt kaduda");
  assert.deepEqual(calls, ["commit"], "commit'i viga EI tohi vabastada — tulemus on kasutaja oma");
});

test("iga katkestus vabastab reservatsiooni ja kannab oma põhjuse edasi", async () => {
  const released = [];
  const handle = {
    userId: "u1",
    idempotencyKey: "k1",
    amount: 10n,
    service: {
      async commit() {
        throw new Error("commit ei tohi siin joosta");
      },
      async release({ reason }) {
        released.push(reason);
      }
    }
  };

  const timeout = await settleProviderFailure({
    handle,
    error: Object.assign(new Error("timeout"), { name: "TimeoutError" })
  });
  assert.equal(timeout.status, 504);
  assert.equal(timeout.released, true);

  const abort = await settleProviderFailure({
    handle,
    error: Object.assign(new Error("stop"), { name: "AbortError" })
  });
  assert.equal(abort.status, 499);

  assert.deepEqual(released, ["provider_timeout", "client_aborted"]);
});

test("vabastuse enda viga ei kao vaikselt", async () => {
  let reported = null;
  const failure = await settleProviderFailure({
    handle: {
      userId: "u1",
      idempotencyKey: "k1",
      amount: 1n,
      service: {
        async release() {
          throw new Error("release down");
        }
      }
    },
    error: new Error("boom"),
    onError: (error) => {
      reported = error;
    }
  });

  assert.equal(failure.released, false, "aus seis: vabastus EI õnnestunud");
  assert.equal(reported?.message, "release down");
});

// --- SOL-VOICE-03: Stop katkestab pooleliolevat sünteesi -------------------

test("hiline vastus ei kuulu enam ühelegi aktiivsele kutsele", () => {
  const gate = createLatestRequestGate();

  const first = gate.begin("et");
  assert.equal(first.isCurrent(), true);

  // Stop.
  gate.invalidate();
  assert.equal(first.isCurrent(), false, "peatatud kutse ei tohi enam heli luua");
  assert.equal(first.signal.aborted, true, "serverikutse peab päriselt katkema");

  // Uus ettelugemine katkestab eelmise.
  const second = gate.begin("et");
  const third = gate.begin("et");
  assert.equal(second.isCurrent(), false);
  assert.equal(third.isCurrent(), true);
  assert.equal(second.signal.aborted, true);
});

test("kliendi ajapiir ei tohi puuduva platvormitoe korral rada katki teha", () => {
  const controller = new AbortController();
  const composed = withRequestTimeout(controller.signal, 10_000);
  assert.equal(typeof composed?.addEventListener, "function");
  // Nulli või vigase piiri korral jääb algne signaal alles, mitte ei kao.
  assert.equal(withRequestTimeout(controller.signal, 0), controller.signal);
});

// --- Marsruudi ja hooki leping --------------------------------------------

test("STT marsruut reserveerib ülempiiri ja commit'ib provideri kestuse", () => {
  assert.match(sttRoute, /resolveSttReservationSeconds\(\{/);
  assert.match(sttRoute, /resolveSttCommittedSeconds\(\{/);
  assert.match(sttRoute, /commitProviderUsage\(\{/);
  assert.match(sttRoute, /settleProviderFailure\(\{/);
  // Lipp, mis pani commit'i vea kasutaja arvele, on kadunud — mitte ümber tõstetud.
  assert.doesNotMatch(sttRoute, /transcriptionCompleted/);
  // Mõlemal providerikutsel on signaal.
  assert.match(sttRoute, /signal: providerSignal/);
  assert.match(sttRoute, /\{ signal: providerSignal \}\s*\n\s*\);/);
});

test("TTS marsruut ei vabasta Google'i kvooti pelga kliendi abordi peale", () => {
  assert.match(ttsRoute, /providerAbortSignal\(req\.signal, TTS_PROVIDER_TIMEOUT_MS\)/);
  // Google'i gRPC-kutse ei saa req.signal-it, seega `withAbort` katkestaks ainult ootaja,
  // mitte tasulise ülesvoolutöö. Marsruut peab ootama selle töö lõppu või gRPC deadline'i,
  // et reservatsioon commit'ida või tegeliku providerivea järel vabastada.
  assert.match(ttsRoute, /synthGoogle\(\{ text, locale \}\)/);
  assert.doesNotMatch(ttsRoute, /synthGoogle\(\{ text, locale, signal:/);
  assert.match(ttsRoute, /synthOpenAI\(\{ text, signal: synthesisSignal \}\)/);
  assert.doesNotMatch(ttsRoute, /synthesisCompleted/);
});

test("hook saadab salvestuse kavatsusevõtme ja peatab serverisünteesi", () => {
  assert.match(speechHook, /fd\.append\("idempotencyKey", recordingIntentKeyRef\.current\)/);
  assert.match(speechHook, /ttsGateRef\.current\.begin\(locale\)/);
  assert.match(speechHook, /ttsGateRef\.current\?\.invalidate\(\)/);
  // Otsus tehakse VASTUSE saabudes, mitte kutse alustamisel.
  assert.match(speechHook, /if \(!attempt\.isCurrent\(\)\) return;/);
  assert.match(speechHook, /signal: withRequestTimeout\(attempt\.signal, TTS_CLIENT_TIMEOUT_MS\)/);
  assert.match(speechHook, /signal: withRequestTimeout\(null, STT_CLIENT_TIMEOUT_MS\)/);
});
