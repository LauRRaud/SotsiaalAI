import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { logEvent } from "@/lib/chat/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { normalizeTartuNlpSpeaker, tartuNlpSupportsLocale } from "@/lib/chat/voiceState";
import { readAudioDurationSecondsFromBuffer } from "@/lib/audio/duration";
import { convertFloat32WavToPcm16 } from "@/lib/audio/wavPcm";
import { resolveGoogleApplicationCredentialsPath } from "@/lib/googleCredentials";
import { safeError } from "@/lib/privacy/safeError";
import {
  TTS_PROVIDER_TIMEOUT_MS,
  isClientAbort,
  isProviderTimeout,
  providerAbortSignal,
  withAbort
} from "@/lib/net/providerRequest";
import { commitProviderUsage, settleProviderFailure } from "@/lib/usage/providerSettlement";
import { reserveUsageForRequest, usageErrorDescriptor } from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
// Eesti TTS suveräänsuse KATSE (S4.2 nr 10). Vaikimisi VÄLJAS — ilma
// `TARTUNLP_TTS_URL`-ita ei muutu ükski rada.
//
// Katseks sobib avalik `https://api.tartunlp.ai/text-to-speech/v2`, aga
// TOODANGUSSE mitte: siis läheks kasutaja tekst välisesse teenusesse. Päris
// kasutus tähendab ise-hostitud eksemplari (mudelid on MIT) — sealt tuleb ka
// kogu mõte, et eestikeelne ettelugemine ei maksa tähemärgi kaupa.
const TARTUNLP_TTS_URL = process.env.TARTUNLP_TTS_URL || "";
// Omaniku valik 03.08 pärast viie hääle kuulamist: `kylli`.
const TARTUNLP_TTS_SPEAKER = process.env.TARTUNLP_TTS_SPEAKER || "kylli";
const TARTUNLP_TTS_TIMEOUT_MS = Number(process.env.TARTUNLP_TTS_TIMEOUT_MS || 20_000);
const TTS_RATE_LIMIT_WINDOW_MS = Number(process.env.TTS_RATE_LIMIT_WINDOW_MS || 60_000);
const TTS_RATE_LIMIT_MAX = Number(process.env.TTS_RATE_LIMIT_MAX || 30);
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

let cachedGcpTtsClient = null;
let cachedGcpTtsClientKey = null;

function pickGoogleVoice(locale) {
  const base = (locale || "et").toLowerCase().split("-")[0];
  if (base === "ru") return { languageCode: "ru-RU", name: "ru-RU-Standard-D" };
  if (base === "en") return { languageCode: "en-US", name: "en-US-Standard-C" };
  return { languageCode: "et-EE", name: "et-EE-Standard-A" };
}

function localeFromRequest(req, fallback = "en") {
  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || fallback;
}

function errorJson(messageKey, status, locale = "en", extras = {}, extraHeaders = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return NextResponse.json({
    ok: false,
    messageKey,
    message: translated,
    ...extras
  }, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders }
  });
}

function usageErrorJson(error, scope, locale) {
  const descriptor = usageErrorDescriptor(error, scope);
  return errorJson(descriptor.body.messageKey, descriptor.status, locale, descriptor.body, descriptor.headers);
}

function json(payload, status = 200, headers = {}) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...headers
    }
  });
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRequestSize(req) {
  return toNullableNumber(req.headers.get("content-length"));
}

async function synthGoogle({ text, locale }) {
  const credentialsPath = resolveGoogleApplicationCredentialsPath();
  const cacheKey = credentialsPath || "__default__";
  if (!cachedGcpTtsClient || cachedGcpTtsClientKey !== cacheKey) {
    cachedGcpTtsClient = credentialsPath
      ? new textToSpeech.TextToSpeechClient({ keyFilename: credentialsPath })
      : new textToSpeech.TextToSpeechClient();
    cachedGcpTtsClientKey = cacheKey;
  }

  // Google'i Promise ei anna req.signal-it gRPC-kutsesse edasi. Kliendi abordiga race
  // vabastaks seega kvoodi ajal, mil tasuline ülesvoolutöö jätkub. Race'ime ainult oma
  // ajapiiriga; kliendi lahkumisel ootame Google'i tulemust/deadline'i ja settle'ime selle
  // tegeliku tulemuse järgi.
  const timeoutSignal = providerAbortSignal(null, TTS_PROVIDER_TIMEOUT_MS);
  const [resp] = await withAbort(
    cachedGcpTtsClient.synthesizeSpeech(
      {
        input: { text },
        voice: pickGoogleVoice(locale),
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0
        }
      },
      { timeout: TTS_PROVIDER_TIMEOUT_MS }
    ),
    timeoutSignal
  );
  if (!resp?.audioContent) {
    return {
      ok: false,
      messageKey: "api.tts.synthesis_failed"
    };
  }
  const audio = resp.audioContent;
  const buf = typeof audio === "string" ? Buffer.from(audio, "base64") : Buffer.from(audio);
  return {
    ok: true,
    audioBuffer: buf,
    audioContent: buf.toString("base64"),
    contentType: "audio/mpeg",
    provider: "google"
  };
}

async function synthTartuNlp({ text, speaker, signal }) {
  // Katse oli ainus koht, kus ajapiir juba oli. Nüüd kannab sama signaal ka kasutaja Stop'i.
  const timeoutSignal = providerAbortSignal(signal, TARTUNLP_TTS_TIMEOUT_MS);
  const startedAt = Date.now();
  {
    const res = await fetch(TARTUNLP_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/wav"
      },
      body: JSON.stringify({
        text,
        speaker,
        speed: 1
      }),
      signal: timeoutSignal
    });
    if (!res.ok) {
      return { ok: false, messageKey: "api.tts.synthesis_failed" };
    }
    const raw = Buffer.from(await res.arrayBuffer());
    if (!raw.length) {
      return { ok: false, messageKey: "api.tts.synthesis_failed" };
    }
    // Float32 → PCM16: pool mahtu ja formaadikood, mida iga brauser tunneb.
    const buf = convertFloat32WavToPcm16(raw);
    return {
      ok: true,
      audioBuffer: buf,
      audioContent: buf.toString("base64"),
      contentType: "audio/wav",
      provider: "tartunlp",
      voice: speaker,
      latencyMs: Date.now() - startedAt,
      audioBytes: buf.length
    };
  }
}

async function synthOpenAI({ text, signal }) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: OPENAI_API_KEY
  });
  const startedAt = Date.now();
  const speech = await withAbort(
    client.audio.speech.create(
      {
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: "mp3",
        speed: 1.0
      },
      { signal }
    ),
    signal
  );
  const buf = Buffer.from(await speech.arrayBuffer());
  return {
    ok: true,
    audioBuffer: buf,
    audioContent: buf.toString("base64"),
    contentType: "audio/mpeg",
    provider: "openai",
    latencyMs: Date.now() - startedAt,
    audioBytes: buf.length
  };
}

export async function POST(req) {
  const uiLocale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, uiLocale);
  }

  const roleState = resolveSessionRoleState(session, req.cookies);
  const role = roleState.effectiveRole;
  const gate = await requireSubscription(session, role);
  if (!gate.ok) {
    return json({
      ok: false,
      messageKey: gate.message,
      message: serverT(uiLocale, gate.message, undefined, gate.message),
      redirect: gate.redirect,
      requireSubscription: gate.requireSubscription
    }, gate.status);
  }

  const ip = getRequestIpFromRequest(req);
  const limit = consumeRateLimit(`tts:${session.user.id}:${ip}`, TTS_RATE_LIMIT_MAX, TTS_RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return json({
      ok: false,
      messageKey: "api.tts.rate_limited",
      message: serverT(uiLocale, "api.tts.rate_limited", undefined, "api.tts.rate_limited")
    }, 429, {
      "Retry-After": String(limit.retryAfterSec)
    });
  }

  const googleEnabled = Boolean(resolveGoogleApplicationCredentialsPath());
  const openaiEnabled = !!OPENAI_API_KEY;
  const tartuConfigured = Boolean(TARTUNLP_TTS_URL);
  if (!googleEnabled && !openaiEnabled && !tartuConfigured) {
    return errorJson("api.tts.not_configured", 503, uiLocale);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return errorJson("api.common.invalid_request", 400, uiLocale);
  }

  const text = String(payload?.text || "").trim();
  const locale = String(payload?.locale || "et");
  if (!text) return errorJson("api.tts.text_missing", 400, localeFromRequest(req, locale));

  const maxLen = googleEnabled ? 4500 : 4096;
  if (text.length > maxLen) {
    return errorJson("api.tts.text_too_long", 413, localeFromRequest(req, locale), {
      maxLen,
      length: text.length
    });
  }

  // Katse on eesti keele oma ja ainult siis, kui URL on seatud. Admin võib
  // kõneleja päringus valida — 12 häält üksteise järel kuulata on kogu
  // katse mõte ja env-i vahetamine iga hääle jaoks tähendaks restarti.
  const tartuEnabled = tartuConfigured && tartuNlpSupportsLocale(locale);
  const tartuSpeaker = normalizeTartuNlpSpeaker(
    roleState.isAdmin ? payload?.speaker : null,
    normalizeTartuNlpSpeaker(TARTUNLP_TTS_SPEAKER, "mari")
  );
  const plannedProvider = tartuEnabled ? "tartunlp" : googleEnabled ? "google" : "openai";

  let usageHandle = null;
  try {
    usageHandle = await reserveUsageForRequest({
      request: req,
      userId: session.user.id,
      metric: "TTS_CHARS",
      amount: text.length,
      scope: "tts.synthesize",
      idempotencyKey: payload?.idempotencyKey,
      metadata: { locale, provider: plannedProvider }
    });
  } catch (error) {
    return usageErrorJson(error, "tts.synthesize", localeFromRequest(req, locale));
  }

  // Üks signaal kahe sündmuse jaoks: meie ajapiir ja kasutaja „Peata ettelugemine"
  // (SOL-VOICE-02, -03). Ilma temata jätkas süntees pärast Stop'i lõpuni ja kvoot kulus.
  const synthesisSignal = providerAbortSignal(req.signal, TTS_PROVIDER_TIMEOUT_MS);

  try {
    // Katse ei tohi ettelugemist katki teha: kui TartuNLP ei vasta, läheb
    // sama päring edasi senist teed pidi. Kasutaja katkestust see varurada EI neela —
    // muidu tähendaks Stop lihtsalt teise pakkuja poole pöördumist.
    let result = null;
    if (tartuEnabled) {
      result = await synthTartuNlp({ text, speaker: tartuSpeaker, signal: req.signal }).catch(error => {
        if (isClientAbort(error) || isProviderTimeout(error)) throw error;
        console.error("tts tartunlp", safeError(error));
        return null;
      });
      if (result && !result.ok) result = null;
    }
    if (!result) {
      result = googleEnabled
        ? await synthGoogle({ text, locale })
        : openaiEnabled
          ? await synthOpenAI({ text, signal: synthesisSignal })
          : { ok: false, messageKey: "api.tts.synthesis_failed" };
    }
    if (!result.ok) {
      throw new Error(result.messageKey || "api.tts.synthesis_failed");
    }
    // Commit'i viga ei vabasta reservatsiooni ega viska valmis heli ära — sama piir, mis
    // `lib/usage/paidResult.js`-is ja `/api/stt`-s.
    await commitProviderUsage({
      handle: usageHandle,
      onError: (commitError) => console.error("[tts] usage commit failed", safeError(commitError))
    });
    const durationSeconds = await readAudioDurationSecondsFromBuffer(result.audioBuffer, result.contentType);
    if (result.provider === "openai") {
      await logEvent("tts_cost_usage", {
        userId: session.user.id,
        role,
        provider: "openai",
        model: OPENAI_TTS_MODEL,
        route: "api/tts",
        stage: "tts_synthesize",
        latency_ms: toNullableNumber(result.latencyMs),
        request_size_bytes: readRequestSize(req),
        file_size_bytes: null,
        duration_seconds: toNullableNumber(durationSeconds),
        text_chars: text.length,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        audio_tokens: null,
        text_tokens: null,
        audio_bytes: toNullableNumber(result.audioBytes),
        voice: OPENAI_TTS_VOICE,
        cost_read_directly: false,
        cost_estimation_basis: null
      });
    }
    await logEvent("tts_request", {
      userId: session.user.id,
      role,
      provider: result.provider || plannedProvider,
      // Katse võrdlusandmed: kumb pakkuja ja milline hääl päriselt kõneles.
      voice: result.voice || null,
      latencyMs: toNullableNumber(result.latencyMs),
      locale,
      textLength: text.length,
      durationSeconds: toNullableNumber(durationSeconds)
    });
    return json({
      ok: true,
      audioContent: result.audioContent,
      contentType: result.contentType || "audio/mpeg",
      provider: result.provider
    });
  } catch (err) {
    // Kolm eri asja said varem sama 500 ja sama logirea: meie ajapiir, kasutaja Stop ja
    // provideri päris viga. Katkestatavates providerites on neil sama tagajärg
    // reservatsioonile; Google'i mittekattestatava gRPC-kutse puhul ei jõua pelk kliendi
    // abort siia enne ülesvoolutöö tegelikku lõppu (SOL-VOICE-02).
    const failure = await settleProviderFailure({
      handle: usageHandle,
      error: err,
      onError: (releaseError) => console.error("[tts] usage release failed", safeError(releaseError))
    });
    if (failure.log) {
      console.error("tts", safeError(err));
    }
    return errorJson("api.tts.service_error", failure.status, localeFromRequest(req, locale), {
      reason: failure.reason
    });
  }
}
