#!/usr/bin/env node
/**
 * Võrdleb kahe või enama OpenAI mudeli token-kulu SAMA sisendi peal.
 *
 * Miks eraldi skript ja mitte lihtsalt OPENAI_MODEL-i vahetus:
 * live-env'i vahetus mõjutab kõiki kasutajaid ja kaks järjestikust päris-vestlust
 * ei ole võrreldavad (RAG toob eri konteksti, prompt-cache muudab input_tokens'it).
 * Siin läheb mõlemale mudelile BAIDI-TÄPSELT sama payload, ainult `model` erineb.
 *
 * Payload kordab toodangu kuju: lib/chat/promptBuilder.js -> buildResponsesPayload
 * (stream=false, text.verbosity, reasoning.effort, max_output_tokens).
 *
 * Kasutus (serveris, env allikaks /etc/sotsiaalai/frontend.env):
 *   node compare-model-token-cost.mjs \
 *     --models=gpt-5.4-mini,gpt-5.4 \
 *     --runs=3 \
 *     --question="Kuidas toetada last, kelle pere on kaotanud eluaseme?" \
 *     --context-chars=6000
 *
 * Hinna lisamine (valikuline, USD / 1M tokenit — skript ise hindu ei tea):
 *     --price=gpt-5.4-mini:0.25/2.00 --price=gpt-5.4:1.25/10.00
 *   kuju on <mudel>:<input>/<output>. Cached-input arvestatakse 10% input-hinnast,
 *   kui --cached-discount pole muudetud.
 */

const API_URL = "https://api.openai.com/v1/responses";

function parseArgs(argv) {
  const out = { models: [], runs: 1, prices: new Map() };
  for (const raw of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(raw);
    if (!m) continue;
    const [, key, value = ""] = m;
    switch (key) {
      case "models":
        out.models = value.split(",").map(s => s.trim()).filter(Boolean);
        break;
      case "runs":
        out.runs = Math.max(1, Math.trunc(Number(value) || 1));
        break;
      case "question":
        out.question = value;
        break;
      case "context-chars":
        out.contextChars = Math.max(0, Math.trunc(Number(value) || 0));
        break;
      case "effort":
        out.effort = value;
        break;
      case "verbosity":
        out.verbosity = value;
        break;
      case "max-output-tokens":
        out.maxOutputTokens = Math.trunc(Number(value) || 0) || undefined;
        break;
      case "cached-discount":
        out.cachedDiscount = Number(value);
        break;
      case "price": {
        const pm = /^([^:]+):([\d.]+)\/([\d.]+)$/.exec(value);
        if (!pm) throw new Error(`--price vigane kuju: ${value} (oota <mudel>:<input>/<output>)`);
        out.prices.set(pm[1], { input: Number(pm[2]), output: Number(pm[3]) });
        break;
      }
      case "json":
        out.json = true;
        break;
      default:
        throw new Error(`tundmatu lipp: --${key}`);
    }
  }
  return out;
}

/** Deterministlik täitetekst, et input-tokenite hulk oleks toodangu-lähedane. */
function buildContext(chars) {
  if (!chars) return null;
  const unit =
    "Allikas: sotsiaalhoolekande seadus, § 14 lg 2. Kohalik omavalitsus korraldab " +
    "juhtumipõhist abi, hindab pere toimetulekut ja koostab juhtumiplaani koostöös " +
    "perega. Toetuse liigid: sotsiaaltoetus, eluruumi tagamine, tugiisikuteenus. ";
  let text = "";
  while (text.length < chars) text += unit;
  return text.slice(0, chars);
}

function buildPayload({ model, question, context, effort, verbosity, maxOutputTokens }) {
  const input = [
    {
      role: "system",
      content:
        "Oled SotsiaalAI abiline Eesti sotsiaalvaldkonna töötajale. Vasta eesti keeles, " +
        "täpselt ja allikapõhiselt. Ära leiuta viiteid."
    }
  ];
  if (context) {
    input.push({ role: "system", content: `MATERJAL:\n${context}` });
  }
  input.push({ role: "user", content: question });

  return {
    model,
    input,
    ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
    stream: false,
    metadata: { source: "sotsiaalai-model-benchmark" },
    text: { verbosity },
    reasoning: { effort }
  };
}

function usageOf(response) {
  const u = response?.usage || {};
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    input: num(u.input_tokens),
    cached: num(u.input_tokens_details?.cached_tokens),
    output: num(u.output_tokens),
    reasoning: num(u.output_tokens_details?.reasoning_tokens),
    total: num(u.total_tokens) || num(u.input_tokens) + num(u.output_tokens)
  };
}

async function callOnce(apiKey, payload) {
  const startedAt = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const latencyMs = Date.now() - startedAt;
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.code = body?.error?.code || null;
    throw err;
  }

  const outputText = Array.isArray(body?.output)
    ? body.output
        .flatMap(item => (Array.isArray(item?.content) ? item.content : []))
        .filter(part => part?.type === "output_text")
        .map(part => part.text || "")
        .join("")
    : "";

  return { usage: usageOf(body), latencyMs, outputChars: outputText.length };
}

function avg(list, pick) {
  if (!list.length) return 0;
  return list.reduce((sum, item) => sum + pick(item), 0) / list.length;
}

function cost({ usage, price, cachedDiscount }) {
  if (!price) return null;
  const freshInput = Math.max(0, usage.input - usage.cached);
  return (
    (freshInput * price.input +
      usage.cached * price.input * cachedDiscount +
      usage.output * price.output) /
    1_000_000
  );
}

function pad(value, width, right = true) {
  const s = String(value);
  return right ? s.padStart(width) : s.padEnd(width);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY puudub. Serveris: set -a; . /etc/sotsiaalai/frontend.env; set +a");
    process.exit(2);
  }

  const models = args.models.length ? args.models : [process.env.OPENAI_MODEL || "gpt-5.4-mini"];
  const question =
    args.question ||
    "Klient on 34-aastane kahe lapse ema, kes kaotas eluaseme. Milliseid samme peaks " +
      "sotsiaaltöötaja astuma esimese nädala jooksul ja millistele alustele tuginedes?";
  const contextChars = args.contextChars ?? 6000;
  const effort = args.effort || "low";
  const verbosity = args.verbosity || "medium";
  const maxOutputTokens =
    args.maxOutputTokens ?? (Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || undefined);
  const cachedDiscount = Number.isFinite(args.cachedDiscount) ? args.cachedDiscount : 0.1;

  const context = buildContext(contextChars);

  console.log("=== SotsiaalAI mudelite token-kulu võrdlus ===");
  console.log(`mudelid          : ${models.join(", ")}`);
  console.log(`kordusi mudeli kohta: ${args.runs}`);
  console.log(`reasoning.effort : ${effort}   text.verbosity: ${verbosity}`);
  console.log(`max_output_tokens: ${maxOutputTokens ?? "(määramata)"}`);
  console.log(`konteksti pikkus : ${contextChars} tähemärki`);
  console.log(`küsimus          : ${question.slice(0, 90)}${question.length > 90 ? "…" : ""}`);
  console.log("");

  const results = new Map();

  for (const model of models) {
    const runs = [];
    for (let i = 1; i <= args.runs; i += 1) {
      try {
        const run = await callOnce(
          apiKey,
          buildPayload({ model, question, context, effort, verbosity, maxOutputTokens })
        );
        runs.push(run);
        console.log(
          `[${model}] run ${i}/${args.runs}  in=${run.usage.input} (cached ${run.usage.cached})  ` +
            `out=${run.usage.output} (reasoning ${run.usage.reasoning})  ` +
            `kokku=${run.usage.total}  ${run.latencyMs} ms`
        );
      } catch (error) {
        console.log(`[${model}] run ${i}/${args.runs}  VIGA ${error.status || ""} ${error.message}`);
        if (error.status === 404 || error.code === "model_not_found") {
          console.log(`[${model}] -> mudel pole selle API-võtme projektile kättesaadav, jätan vahele`);
          break;
        }
      }
    }
    if (runs.length) results.set(model, runs);
    console.log("");
  }

  if (!results.size) {
    console.error("Ükski mudel ei andnud tulemust.");
    process.exit(1);
  }

  const rows = [...results.entries()].map(([model, runs]) => {
    const usage = {
      input: avg(runs, r => r.usage.input),
      cached: avg(runs, r => r.usage.cached),
      output: avg(runs, r => r.usage.output),
      reasoning: avg(runs, r => r.usage.reasoning),
      total: avg(runs, r => r.usage.total)
    };
    return {
      model,
      n: runs.length,
      usage,
      latencyMs: avg(runs, r => r.latencyMs),
      outputChars: avg(runs, r => r.outputChars),
      cost: cost({ usage, price: args.prices.get(model), cachedDiscount })
    };
  });

  if (args.json) {
    console.log(JSON.stringify({ question, contextChars, effort, verbosity, rows }, null, 2));
    return;
  }

  const w = { model: 18, n: 3, num: 9 };
  console.log("=== keskmised ===");
  console.log(
    [
      pad("mudel", w.model, false),
      pad("n", w.n),
      pad("input", w.num),
      pad("cached", w.num),
      pad("output", w.num),
      pad("reason", w.num),
      pad("kokku", w.num),
      pad("ms", w.num),
      pad("USD", 10)
    ].join("  ")
  );
  for (const row of rows) {
    console.log(
      [
        pad(row.model, w.model, false),
        pad(row.n, w.n),
        pad(Math.round(row.usage.input), w.num),
        pad(Math.round(row.usage.cached), w.num),
        pad(Math.round(row.usage.output), w.num),
        pad(Math.round(row.usage.reasoning), w.num),
        pad(Math.round(row.usage.total), w.num),
        pad(Math.round(row.latencyMs), w.num),
        pad(row.cost === null ? "-" : row.cost.toFixed(6), 10)
      ].join("  ")
    );
  }

  if (rows.length > 1) {
    const base = rows[0];
    console.log("");
    console.log(`=== vahe baasjoone (${base.model}) suhtes ===`);
    for (const row of rows.slice(1)) {
      const pct = (a, b) => (b === 0 ? "n/a" : `${(((a - b) / b) * 100).toFixed(1)} %`);
      const line = [
        `${row.model}:`,
        `output ${pct(row.usage.output, base.usage.output)}`,
        `input ${pct(row.usage.input, base.usage.input)}`,
        `kokku ${pct(row.usage.total, base.usage.total)}`,
        `latents ${pct(row.latencyMs, base.latencyMs)}`
      ];
      if (row.cost !== null && base.cost !== null && base.cost > 0) {
        line.push(`hind ${pct(row.cost, base.cost)}`);
      }
      console.log("  " + line.join("   "));
    }
  }

  console.log("");
  console.log("NB: input_tokens on mudelist praktiliselt sõltumatu (sama sisend);");
  console.log("    tegelik vahe tuleb output + reasoning tokenitest ja mudeli hinnakirjast.");
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
