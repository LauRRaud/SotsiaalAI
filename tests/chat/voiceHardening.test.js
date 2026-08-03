import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  MIC_MESSAGE_KEYS,
  RECORDING_LIMIT_MS,
  RECORDING_WARNING_MS,
  VOICE_NOTICE_KEYS,
  classifyMicStartError,
  micBlockReason,
  micMessageKey,
  normalizeTartuNlpSpeaker,
  pickBrowserVoice,
  resolveTtsOutcome,
  tartuNlpSupportsLocale,
  usesServerTts
} from "../../lib/chat/voiceState.js";

// T03 E4/E5 punktid 1–4. Otsused on puhtas moodulis (tõendatakse siin),
// hook ainult marsruudib nendesse (lukustatud lähtekoodi-lepinguga allpool).

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const hook = readFileSync(join(root, "components/chat/hooks/useSpeech.js"), "utf8");
const composer = readFileSync(join(root, "components/alalehed/chat/ChatComposer.jsx"), "utf8");
const notices = readFileSync(join(root, "components/alalehed/chat/view/ChatNotices.jsx"), "utf8");
const ttsRoute = readFileSync(join(root, "app/api/tts/route.js"), "utf8");
const locales = ["et", "en", "ru"].map(code => ({
  code,
  messages: JSON.parse(readFileSync(join(root, `messages/${code}.json`), "utf8"))
}));

function readKey(messages, dottedKey) {
  return dottedKey.split(".").reduce((node, part) => (node == null ? node : node[part]), messages);
}

// --- Punkt 4: kolm keeldu on kolm eri teksti -------------------------------

test("mikrofoni keelud on eristatavad, mitte üks 'ei saanud avada'", () => {
  assert.equal(micBlockReason({ voiceEnabled: false }), "subscription");
  assert.equal(micBlockReason({ voiceEnabled: true, mediaDevicesAvailable: false }), "unsupported");
  assert.equal(micBlockReason({ voiceEnabled: true, mediaDevicesAvailable: true }), null);

  assert.equal(classifyMicStartError({ name: "NotAllowedError" }), "permission");
  assert.equal(classifyMicStartError({ name: "PermissionDeniedError" }), "permission");
  assert.equal(classifyMicStartError({ name: "SecurityError" }), "permission");
  assert.equal(classifyMicStartError({ name: "NotFoundError" }), "no_device");
  assert.equal(classifyMicStartError({ message: "UNSUPPORTED_RECORDING" }), "unsupported");
  assert.equal(classifyMicStartError({ name: "AbortError" }), "technical");
  assert.equal(classifyMicStartError(undefined), "technical");

  // Kõige olulisem väide: brauseri loakeeld ja tehniline viga ei tohi
  // sattuda sama teksti alla — kasutaja parandustee on erinev.
  assert.notEqual(micMessageKey("permission"), micMessageKey("technical"));
  assert.notEqual(micMessageKey("subscription"), micMessageKey("technical"));
  assert.notEqual(micMessageKey("subscription"), micMessageKey("permission"));
  const keys = Object.values(MIC_MESSAGE_KEYS);
  assert.equal(new Set(keys).size, keys.length, "iga seis on oma võti");
});

test("tundmatu põhjus kukub tehnilise vea peale, mitte tühjuse peale", () => {
  assert.equal(micMessageKey("kolmas-asi"), MIC_MESSAGE_KEYS.technical);
  assert.equal(micMessageKey(undefined), MIC_MESSAGE_KEYS.technical);
});

// --- Punkt 3: TTS locale-fallback ei tohi olla vaikne ---------------------

test("RU ja EN jäävad tasuta brauserihäälele, ET käib serveriteed", () => {
  // Omaniku otsus 03.08. Server OSKAKS ka RU/EN-i (route'is on hääled
  // olemas), aga serveritee kulutab TTS_CHARS kvooti — ja ettelugemine peab
  // RU/EN kasutajale tasuta jääma.
  assert.equal(usesServerTts("et"), true);
  assert.equal(usesServerTts("et-EE"), true);
  for (const locale of ["en", "ru", "ru-RU", "en-GB"]) {
    assert.equal(usesServerTts(locale), false, `${locale} ei tohi kvooti kulutada`);
  }
  assert.match(ttsRoute, /base === "ru"/, "server oskaks RU-d, kui otsus muutub");
  assert.match(ttsRoute, /base === "en"/, "server oskaks EN-i, kui otsus muutub");
  assert.match(ttsRoute, /et-EE/);
});

test("brauserihääle valik tunnistab ausalt, kui sobivat häält ei ole", () => {
  const voices = [{ lang: "et-EE" }, { lang: "en-US" }];
  assert.equal(pickBrowserVoice(voices, "et")?.lang, "et-EE");
  assert.equal(pickBrowserVoice(voices, "ru")?.lang, "en-US", "RU kukub EN peale, kui RU häält ei ole");
  assert.equal(pickBrowserVoice([], "ru"), null);
  assert.equal(pickBrowserVoice(null, "ru"), null);
  assert.equal(pickBrowserVoice([{ lang: "de-DE" }], "ru"), null, "täiesti võõras hääl ei ole vaste");
});

test("TTS-il on neli ausat lõppu ja vaikus ei ole nende hulgas", () => {
  const server = resolveTtsOutcome({ serverSpoke: true });
  assert.equal(server.ok, true);
  assert.equal(server.noticeKey, null, "õnnestunud serverihääl ei tüüta teatega");

  // ET: brauserihääl ASENDAB platvormi häält → kasutaja peab teadma.
  const fallback = resolveTtsOutcome({ serverSpoke: false, browserSpoke: true });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.provider, "browser");
  assert.equal(fallback.noticeKey, VOICE_NOTICE_KEYS.tts_browser_fallback, "varu on MÄRGISTATUD");

  // RU/EN: brauserihääl ON rada. Märkus igal ettelugemisel oleks müra.
  const primary = resolveTtsOutcome({ serverSpoke: false, browserSpoke: true, browserIsPrimary: true });
  assert.equal(primary.ok, true);
  assert.equal(primary.noticeKey, null, "kavatsetud rada ei ole varu");

  // Aga tõrge on tõrge — kummalgi rajal ei tohi jääda vaikus.
  for (const browserIsPrimary of [false, true]) {
    const silence = resolveTtsOutcome({ serverSpoke: false, browserSpoke: false, browserIsPrimary });
    assert.equal(silence.ok, false);
    assert.equal(silence.noticeKey, VOICE_NOTICE_KEYS.tts_unavailable, "vaikiv ebaõnnestumine on keelatud");
  }
});

test("brauserihääle tõrge öeldakse välja ka RU/EN rajal", () => {
  // Vaikiva ebaõnnestumise keeld elab utterance.onerror'is — see on ainus
  // koht, kust RU/EN kasutaja tõrkest üldse teada saab.
  const browserFn = hook.slice(hook.indexOf("const speakWithBrowser"), hook.indexOf("const speakText"));
  assert.match(browserFn, /utterance\.onerror = \(\) => \{[\s\S]{0,160}tts_unavailable/);
  assert.match(browserFn, /return false;/, "kõnelemata jäämine tagastab FALSE, mitte vaikselt undefined");
  assert.match(hook, /browserIsPrimary: !serverRoute/);
});

// --- Eesti TTS suveräänsuse katse (S4.2 nr 10) ---------------------------

test("TartuNLP katse on vaikimisi VÄLJAS ega muuda ühtki rada", () => {
  // Ilma URL-ita ei tohi olemasolev käitumine muutuda — see on kogu
  // "lipu taga" mõte.
  assert.match(ttsRoute, /const TARTUNLP_TTS_URL = process\.env\.TARTUNLP_TTS_URL \|\| "";/);
  assert.match(ttsRoute, /const tartuConfigured = Boolean\(TARTUNLP_TTS_URL\);/);
  assert.match(ttsRoute, /const tartuEnabled = tartuConfigured && tartuNlpSupportsLocale\(locale\);/);
});

test("TartuNLP on eesti keele oma — RU/EN sinna ei lähe", () => {
  assert.equal(tartuNlpSupportsLocale("et"), true);
  assert.equal(tartuNlpSupportsLocale("et-EE"), true);
  assert.equal(tartuNlpSupportsLocale("ru"), false);
  assert.equal(tartuNlpSupportsLocale("en"), false);
  assert.equal(tartuNlpSupportsLocale(""), false);
});

test("kõneleja nimi on piiratud tähestikuga ja vigane kukub vaikimisi peale", () => {
  assert.equal(normalizeTartuNlpSpeaker("Mari"), "mari");
  assert.equal(normalizeTartuNlpSpeaker("  KYLLI "), "kylli");
  for (const bad of ["", null, undefined, "mari mari", "../etc", "a", "x".repeat(21), "mari?speed=9", "mari\nX-Injected: 1"]) {
    assert.equal(normalizeTartuNlpSpeaker(bad), "mari", `${JSON.stringify(bad)} ei tohi läbi minna`);
  }
  assert.equal(normalizeTartuNlpSpeaker("kalev", "vesta"), "kalev");
  assert.equal(normalizeTartuNlpSpeaker("!!", "vesta"), "vesta");
});

test("kõneleja valik päringus on AINULT admini oma", () => {
  assert.match(ttsRoute, /roleState\.isAdmin \? payload\?\.speaker : null/);
});

test("katse ei saa ettelugemist katki teha", () => {
  // TartuNLP tõrge → sama päring läheb edasi senist teed pidi.
  assert.match(ttsRoute, /synthTartuNlp\(\{ text, speaker: tartuSpeaker \}\)\.catch/);
  assert.match(ttsRoute, /if \(result && !result\.ok\) result = null;/);
  assert.match(ttsRoute, /if \(!result\) \{\s*\n\s*result = googleEnabled/);
  // Ja ta ei tohi rippuma jääda.
  assert.match(ttsRoute, /new AbortController\(\)/);
  assert.match(ttsRoute, /TARTUNLP_TTS_TIMEOUT_MS/);
  assert.match(ttsRoute, /clearTimeout\(timer\)/);
});

test("katse jätab võrdlusandmed maha", () => {
  // Ilma pakkuja ja hääle logimiseta ei ole katsel tulemust.
  assert.match(ttsRoute, /provider: result\.provider \|\| plannedProvider/);
  assert.match(ttsRoute, /voice: result\.voice \|\| null/);
  assert.match(ttsRoute, /latencyMs: toNullableNumber\(result\.latencyMs\)/);
});

// --- Punkt 2: 2,5 minuti pehme piir ---------------------------------------

test("hoiatus tuleb enne piiri ja piir on 2,5 minutit", () => {
  assert.equal(RECORDING_LIMIT_MS, 150_000);
  assert.ok(RECORDING_WARNING_MS < RECORDING_LIMIT_MS, "hoiatus peab jõudma enne piiri");
  assert.ok(RECORDING_LIMIT_MS - RECORDING_WARNING_MS >= 20_000, "hoiatuseks peab jääma aega");
});

// --- Punkt 1: katkestus ei jõua kunagi providerini ------------------------

test("katkestuslipp on ainus värav providerini ja seda kontrollitakse ENNE kutset", () => {
  const gate = hook.indexOf("if (recordingDiscardRef.current)");
  const transcribeCall = hook.indexOf("onTranscribeAudio(");
  const sttCall = hook.indexOf('fetch("/api/stt"');
  assert.ok(gate > -1, "väljaviskamise värav on olemas");
  assert.ok(transcribeCall > -1 && sttCall > -1);
  assert.ok(gate < transcribeCall, "värav on enne onTranscribeAudio kutset");
  assert.ok(gate < sttCall, "värav on enne /api/stt kutset");

  // Katkestus tõstab lipu ja alles siis peatab — vastupidises järjekorras
  // jõuaks MediaRecorder onstop enne lippu ja heli läheks ära.
  const cancel = hook.slice(hook.indexOf("const cancelRecording"), hook.indexOf("const startAudioMeter"));
  const raise = cancel.indexOf("recordingDiscardRef.current = true");
  const stop = cancel.indexOf("stopRecording()");
  assert.ok(raise > -1 && stop > -1 && raise < stop, "lipp tõuseb enne stop'i");

  // Uus salvestus algab alati puhta lipuga.
  assert.match(hook, /recordingDiscardRef\.current = false;\s*\n\s*clearRecordingTimers\(\);/);
  // Lahkuv ekraan = katkestus.
  assert.match(hook, /Lahkivõtmine|Lahtivõtmine on ALATI katkestus/);
});

test("taimerid ja helirajad puhastuvad abort-, error- ja success-rajal", () => {
  assert.match(hook, /const clearRecordingTimers = useCallback\(/);
  // success: processRecordingBlob; abort: stopRecording (kutsutakse ka
  // cancelRecording'ust ja piiritaimerist); unmount: efekt.
  for (const marker of [
    /const processRecordingBlob = useCallback\(async[\s\S]{0,320}clearRecordingTimers\(\)/,
    /const stopRecording = useCallback\(\(\) => \{[\s\S]{0,300}clearRecordingTimers\(\)/,
    /return \(\) => \{[\s\S]{0,200}clearRecordingTimers\(\);[\s\S]{0,120}stopAudioMeter\(\);/
  ]) {
    assert.match(hook, marker);
  }
  // Error-rada: handleMic catch peatab salvestuse ja mõõdiku.
  assert.match(hook, /setRecordingError\(tr\(micMessageKey\(classifyMicStartError\(error\)\)\)\);\s*\n\s*stopRecording\(\);\s*\n\s*stopAudioMeter\(\);/);
});

// --- Liidese leping --------------------------------------------------------

test("hook marsruudib otsused puhtasse moodulisse, ei tee neid uuesti", () => {
  assert.match(hook, /from "@\/lib\/chat\/voiceState"/);
  assert.doesNotMatch(hook, /base === "ru" \|\| base === "en"/, "keelevalik tuleb usesServerTts'ist, mitte inline'ist");
  assert.doesNotMatch(hook, /tr\("chat\.mic\.cannot_start"\)/, "veatekst tuleb klassifikaatorist");
});

test("katkestusnupp on olemas ja ilmub ainult salvestamise ajal", () => {
  assert.match(composer, /data-recording-cancel="true"/);
  assert.match(composer, /recording && cancelRecording \? <button/);
  assert.match(composer, /e\.key === "Escape" && recording && cancelRecording/, "Escape katkestab ka klaviatuuril");
});

test("tellimuseta mikrofon ütleb põhjuse, mitte ei ole tumm", () => {
  assert.match(composer, /const micBlockedLabel = !voiceEnabled \? t\("chat\.mic\.requires_subscription"\)/);
  assert.doesNotMatch(composer, /disabled=\{!voiceEnabled \|\|/, "tellimusnõue ei tohi nuppu tummaks teha");
});

test("kinnitus ja viga on eri kanalites", () => {
  assert.match(notices, /voiceNotice/);
  assert.match(notices, /role="status"/, "kinnitus ei ole alert");
  assert.match(notices, /role="alert"/, "viga jääb alert'iks");
});

test("kõik uued hääletekstid on ET/EN/RU-s olemas ja eristuvad", () => {
  const required = [...Object.values(MIC_MESSAGE_KEYS), ...Object.values(VOICE_NOTICE_KEYS), "chat.mic.cancel"];
  for (const { code, messages } of locales) {
    const seen = new Map();
    for (const key of required) {
      const value = readKey(messages, key);
      assert.equal(typeof value, "string", `${code}: ${key} puudub`);
      assert.ok(value.trim().length > 0, `${code}: ${key} on tühi`);
      assert.ok(!seen.has(value), `${code}: ${key} ja ${seen.get(value)} on sama tekst`);
      seen.set(value, key);
    }
  }
});
