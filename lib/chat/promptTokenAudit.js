import { CHAT_PROMPT_TOKEN_AUDIT } from "./settings.js";

// Prompt-komponentide tokeniaudit.
//
// Lipp CHAT_PROMPT_TOKEN_AUDIT=1 väljas:
//   - tokeniseerijat EI laadita (dünaamiline import käivitub alles mõõtmisel);
//   - komponente ei koguta;
//   - tavapärane request path on puutumata.
//
// Lipp sees:
//   - mõõdetakse ainult mahud ja tokeniarvud;
//   - süsteemiprompti ega SourcePackage'i sisu EI logita;
//   - OpenAI payloadi ei muudeta.
//
// Kõik lokaalsed tokeniarvud on HINNANGULISED (`_estimated`).
// Autoriteetne kogusisendi arv on API `usage.input_tokens`.

const FALLBACK_ENCODING = "o200k_base";

let encoderPromise = null;
let encoderState = null;

export function isPromptTokenAuditEnabled() {
  return CHAT_PROMPT_TOKEN_AUDIT;
}

// Singleton: tokeniseerija laetakse ühe korra protsessi kohta, mitte iga päringu ajal.
async function getEncoder(model) {
  if (encoderPromise) return encoderPromise;
  encoderPromise = (async () => {
    const mod = await import("js-tiktoken");
    let encoding = FALLBACK_ENCODING;
    let source = "fallback";
    try {
      const named = mod.getEncodingNameForModel(model);
      if (named) {
        encoding = named;
        source = "model_name";
      }
    } catch {
      // Mudelit ei tunta nime järgi — see on oodatav uute mudelite puhul.
    }
    encoderState = { encoding, source, model };
    return { encoder: mod.getEncoding(encoding), encoding, source };
  })().catch(error => {
    encoderPromise = null;
    throw error;
  });
  return encoderPromise;
}

export function resetPromptTokenAuditEncoderForTests() {
  encoderPromise = null;
  encoderState = null;
}

export function encoderInfoForTests() {
  return encoderState;
}

function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("\n");
  if (value && typeof value === "object") return textOf(value.content);
  return "";
}

const COMPONENT_ORDER = [
  ["system_prompt", "system"],
  ["user_input", "user"],
  ["conversation_history", "history"],
  ["source_package", "sourcePackage"],
  ["tool_definitions", "tools"],
  ["other_dynamic", "otherDynamic"]
];

/**
 * Mõõdab prompt-komponendid. Ei viska kunagi: kui tokeniseerija kukub,
 * tagastab märgikogused ja `tokenizer_ok: false`, et API-päring saaks jätkuda.
 */
export async function measurePromptComponents({ components, model }) {
  const parts = COMPONENT_ORDER.map(([name, key]) => {
    const text = textOf(components?.[key]);
    return { name, text, chars: text.length };
  });

  const out = {
    tokenizer_ok: false,
    tokenizer_encoding: null,
    tokenizer_source: null,
    tokenizer_error: null
  };

  let encoder = null;
  try {
    const loaded = await getEncoder(model);
    encoder = loaded.encoder;
    out.tokenizer_ok = true;
    out.tokenizer_encoding = loaded.encoding;
    out.tokenizer_source = loaded.source;
  } catch (error) {
    out.tokenizer_error = String(error?.message || error).slice(0, 200);
  }

  // NB: komponendid lähevad pesastatud objekti, MITTE lameda võtmeloendina.
  // `redactObject` (lib/privacy/safeError.js) kärbib iga objekti 30 võtme peale
  // ja lame variant kaotaks sabas olevad väljad vaikselt ära.
  const measured = {};
  let sum = 0;
  for (const part of parts) {
    let tokens = null;
    if (encoder && part.chars) {
      try {
        tokens = encoder.encode(part.text).length;
      } catch {
        tokens = null;
      }
    } else if (encoder) {
      tokens = 0;
    }
    measured[part.name] = {
      chars: part.chars,
      tokens_estimated: tokens
    };
    if (Number.isFinite(tokens)) sum += tokens;
  }

  out.components = measured;
  out.estimated_component_sum = out.tokenizer_ok ? sum : null;
  return out;
}

/**
 * Liidab mõõdetud komponendid API tegeliku kasutusega ja arvutab lõhe.
 *
 * `input_token_gap` EI ole ainult tokeniseerija viga — sinna mahub ka
 * sõnumite struktuur, rollimärgised, API ümbrised ja mõni mõõtmata
 * sisendkomponent. Ära nimeta lokaalseid arve täpseteks enne, kui lõhe
 * on väike ja stabiilne.
 */
export function withInputTokenGap(measurement, apiInputTokens) {
  const api = Number(apiInputTokens);
  const sum = Number(measurement?.estimated_component_sum);
  const hasBoth = Number.isFinite(api) && Number.isFinite(sum);
  return {
    ...measurement,
    api_input_tokens: Number.isFinite(api) ? api : null,
    input_token_gap: hasBoth ? api - sum : null,
    input_token_gap_pct: hasBoth && api > 0 ? Number((((api - sum) / api) * 100).toFixed(2)) : null,
    estimate_note: "lokaalsed arvud on hinnangulised; autoriteetne on api_input_tokens"
  };
}
