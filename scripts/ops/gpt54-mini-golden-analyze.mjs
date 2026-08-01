#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = { input: null, automatic: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index] || null;
    else if (arg === "--automatic") args.automatic = argv[++index] || null;
    else if (arg === "--output") args.output = argv[++index] || null;
    else throw new Error(`UNKNOWN_OPTION:${arg}`);
  }
  if (!args.input || !args.automatic || !args.output) throw new Error("INPUT_AUTOMATIC_OUTPUT_REQUIRED");
  return args;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentile(values, ratio) {
  const sorted = values.map(finite).filter(value => value !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Number((sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)).toFixed(2));
}

function sum(values) {
  return values.map(finite).filter(value => value !== null).reduce((total, value) => total + value, 0);
}

function counts(values) {
  return Object.fromEntries([...new Set(values)].map(value => [value, values.filter(item => item === value).length]));
}

function fmt(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("et-EE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function yesNo(value) {
  return value === true ? "jah" : value === false ? "ei" : "—";
}

function technicalSummary(runs) {
  const timings = runs.flatMap(run => run.retrieval_timings || []);
  const embeddingSum = sum(timings.map(timing => timing.embedding_duration_ms));
  const retrievalSum = sum(timings.map(timing => timing.retriever_duration_ms));
  const componentSum = embeddingSum + retrievalSum;
  return {
    run_count: runs.length,
    run_type_counts: counts(runs.map(run => run.run_type)),
    status_counts: counts(runs.map(run => run.status)),
    latency_ms: {
      p50: percentile(runs.map(run => run.latency_ms), 0.5),
      max: Math.max(...runs.map(run => finite(run.latency_ms) || 0))
    },
    tokens: {
      input_total: sum(runs.map(run => run.input_tokens)),
      cached_total: sum(runs.map(run => run.cached_tokens)),
      output_total: sum(runs.map(run => run.output_tokens)),
      reasoning_total: sum(runs.map(run => run.reasoning_tokens)),
      non_reasoning_output_total: sum(runs.map(run => run.non_reasoning_output_tokens)),
      total: sum(runs.map(run => run.total_tokens)),
      output_p50: percentile(runs.map(run => run.output_tokens), 0.5),
      output_max: Math.max(...runs.map(run => finite(run.output_tokens) || 0))
    },
    cost_usd: {
      total: Number(sum(runs.map(run => run.estimated_request_cost_usd)).toFixed(8)),
      average: Number((sum(runs.map(run => run.estimated_request_cost_usd)) / Math.max(1, runs.length)).toFixed(8))
    },
    incomplete_count: runs.filter(run => run.status === "incomplete").length,
    technical_failure_count: runs.filter(run => run.status === "technical_failure").length,
    retrieval_failure_count: runs.filter(run => run.status === "retrieval_failure" || run.rag_failed).length,
    stream_failure_count: runs.filter(run => run.status === "stream_failure").length,
    response_present_false_count: runs.filter(run => run.response_present === false).length,
    output_cap_reached_count: runs.filter(run => run.output_cap_reached === true).length,
    zero_source_count: runs.filter(run => run.source_count === 0).length,
    zero_displayed_source_count: runs.filter(run => run.displayed_source_count === 0).length,
    displayed_duplicate_entry_count: runs.reduce((total, run) => total + Math.max(
      0,
      Number(run.displayed_source_count || 0) - Number(run.displayed_unique_source_count || 0)
    ), 0),
    rag_attempted_count: runs.filter(run => run.rag_attempted).length,
    rag_failed_count: runs.filter(run => run.rag_failed).length,
    retrieval: {
      call_count: timings.length,
      native_12000_count: timings.filter(timing => timing.observability_stage === "rag_search" && timing.retrieval_timeout_ms === 12000).length,
      timeout_budget_counts: counts(timings.map(timing => timing.retrieval_timeout_ms)),
      aborted_count: timings.filter(timing => timing.aborted_stage).length,
      non_ok_count: timings.filter(timing => timing.outcome !== "ok").length,
      over_10000_count: timings.filter(timing => finite(timing.retrieval_total_ms) > 10000).length,
      at_or_over_budget_count: timings.filter(timing => finite(timing.retrieval_total_ms) !== null
        && finite(timing.retrieval_timeout_ms) !== null
        && finite(timing.retrieval_total_ms) >= finite(timing.retrieval_timeout_ms)).length,
      exact_three_stage_count: timings.filter(timing => timing.journal_stage_count === 3).length,
      journal_duplicate_count: sum(timings.map(timing => timing.journal_duplicate_count)),
      component_match_count: timings.filter(timing => timing.component_timings_match_journal === true).length,
      strict_match_count: timings.filter(timing => timing.timings_match_journal === true).length,
      journal_total_delta_ms: {
        p50: percentile(timings.map(timing => timing.journal_total_delta_ms), 0.5),
        max: Math.max(...timings.map(timing => finite(timing.journal_total_delta_ms) || 0))
      },
      embedding_share_of_component_time_pct: componentSum
        ? Number((embeddingSum / componentSum * 100).toFixed(2))
        : null,
      retrieval_share_of_component_time_pct: componentSum
        ? Number((retrievalSum / componentSum * 100).toFixed(2))
        : null
    }
  };
}

function runTable(runs) {
  const header = "| # | question_id | status | latency ms | input | cached | output | reasoning | cap | sources | displayed uniq | RAG calls | max RAG ms | auto |";
  const divider = "|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|";
  const rows = runs.map((run, index) => {
    const maxRag = Math.max(0, ...(run.retrieval_timings || []).map(timing => finite(timing.retrieval_total_ms) || 0));
    return `| ${index + 1} | \`${run.question_id}\` | ${run.status} | ${fmt(run.latency_ms)} | ${fmt(run.input_tokens)} | ${fmt(run.cached_tokens)} | ${fmt(run.output_tokens)} | ${fmt(run.reasoning_tokens)} | ${yesNo(run.output_cap_reached)} | ${fmt(run.source_count)} | ${fmt(run.displayed_unique_source_count)} | ${(run.retrieval_timings || []).length} | ${maxRag ? fmt(maxRag) : "—"} | ${run.automatic_golden_pass ? "PASS" : "FAIL"} |`;
  });
  return [header, divider, ...rows].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const technical = JSON.parse(await readFile(args.input, "utf8"));
  const automatic = JSON.parse(await readFile(args.automatic, "utf8"));
  const runs = (technical.runs || []).filter(run => run.run_type === "original");
  const summary = technicalSummary(runs);
  const started = runs.map(run => run.started_at).sort()[0] || null;
  const completed = runs.map(run => run.completed_at).sort().at(-1) || null;
  const lines = [
    "# gpt-5.4-mini Golden-37 tehniline baasraport",
    "",
    `Jooksuaken: ${started} kuni ${completed}. Tootmise kood: \`13cfe8605e5ce705b8b4c973a39c389b09e5ac58\`.`,
    "",
    "Konfiguratsioon: `gpt-5.4-mini`, reasoning `low`, verbosity `medium`, `max_output_tokens=1100`, prompt-tokeni audit väljas. Küsimustik: Golden-37, SHA-256 `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089`.",
    "",
    "## Tehniline tulemus",
    "",
    `- Algsed jooksud: ${summary.run_count}; technical retry: ${summary.run_type_counts.technical_retry || 0}.`,
    `- Olekud: ${Object.entries(summary.status_counts).map(([key, value]) => `${key}=${value}`).join(", ")}.`,
    `- Olemasoleva Golden-runner'i automaattulemus: ${automatic.summary.pass}/${automatic.summary.total} PASS; FAIL ${automatic.summary.fail}.`,
    `- Latentsus: p50 ${fmt(summary.latency_ms.p50)} ms; max ${fmt(summary.latency_ms.max)} ms.`,
    `- Output-tokenid: p50 ${fmt(summary.tokens.output_p50)}; max ${fmt(summary.tokens.output_max)}; API järgi 1100-tokeni lagi tabatud ${summary.output_cap_reached_count} korral.`,
    `- Tokenid kokku: input ${fmt(summary.tokens.input_total)}, cached ${fmt(summary.tokens.cached_total)}, output ${fmt(summary.tokens.output_total)}, reasoning ${fmt(summary.tokens.reasoning_total)}, non-reasoning output ${fmt(summary.tokens.non_reasoning_output_total)}, total ${fmt(summary.tokens.total)}.`,
    `- Hinnasnapshoti järgi hinnanguline kogukulu $${summary.cost_usd.total.toFixed(6)}; keskmine $${summary.cost_usd.average.toFixed(6)} päringu kohta.`,
    `- Vastus puudus ${summary.response_present_false_count}; incomplete ${summary.incomplete_count}; tehniline viga ${summary.technical_failure_count}; retrieval failure ${summary.retrieval_failure_count}; stream failure ${summary.stream_failure_count}.`,
    `- Null toorallikaga vastuseid ${summary.zero_source_count}; null kuvatud allikaga vastuseid ${summary.zero_displayed_source_count}; kuvatud massiivi duplikaatkirjeid ${summary.displayed_duplicate_entry_count}.`,
    `- Null kuvatud allikaga küsimused: ${runs.filter(run => run.displayed_source_count === 0).map(run => `\`${run.question_id}\``).join(", ") || "puuduvad"}.`,
    `- Kuvatava massiivi koguarv erines unikaalsete allikate arvust: ${runs.filter(run => run.displayed_source_count > run.displayed_unique_source_count).map(run => `\`${run.question_id}\``).join(", ") || "puuduvad"}.`,
    "",
    "Automaatsed substring-, mode- ja kuvatud allika kontrollid ei ole subjektiivne sisukvaliteedi otsus. Täielik inimhindamine tehakse mudelinimeta blind-paketiga ja fikseeritud hindamisvormiga.",
    "Olemasolev Golden-runner kasutab `stream:false`; seetõttu on `stream_done_received=null` ja SSE `done` ei ole selle jooksu kohaldatav kontroll. Vastus ning kuvatud allikad salvestati eval-artefakti, mitte püsivasse kasutajavestlusse (`persist:false`).",
    "",
    "## RAG ja observability",
    "",
    `- RAG käivitus ${summary.rag_attempted_count}/${summary.run_count} vastuses; RAG failure ${summary.rag_failed_count}.`,
    `- Retrieval-timinguid kokku ${summary.retrieval.call_count}; abort ${summary.retrieval.aborted_count}; non-ok ${summary.retrieval.non_ok_count}.`,
    `- Üle 10 000 ms retrieval-kutseid ${summary.retrieval.over_10000_count}; oma timingus märgitud laeni või üle selle ${summary.retrieval.at_or_over_budget_count}.`,
    `- Timingute eelarved: ${Object.entries(summary.retrieval.timeout_budget_counts).map(([key, value]) => `${key} ms=${value}`).join(", ")}. Native \`rag_search\` 12 000 ms ridu ${summary.retrieval.native_12000_count}.`,
    `- Journald: täpselt kolm etappi ${summary.retrieval.exact_three_stage_count}/${summary.retrieval.call_count}; duplikaate ${summary.retrieval.journal_duplicate_count}; embedding/retrieval komponendid klapivad ±2 ms ${summary.retrieval.component_match_count}/${summary.retrieval.call_count}.`,
    `- Range search_total range klapib ±2 ms ${summary.retrieval.strict_match_count}/${summary.retrieval.call_count}; journal-total miinus response-total delta p50 ${fmt(summary.retrieval.journal_total_delta_ms.p50)} ms, max ${fmt(summary.retrieval.journal_total_delta_ms.max)} ms.`,
    `- Komponentajast embedding ${fmt(summary.retrieval.embedding_share_of_component_time_pct, 2)}% ja retrieval ${fmt(summary.retrieval.retrieval_share_of_component_time_pct, 2)}%.`,
    "",
    "Overview/multi-query rada kasutab olemasolevas tootmiskoodis 18 000 ms alamotsingu eelarvet, native `rag_search` vaikimisi eelarve on 12 000 ms. Selle jooksuga ei muudetud kumbagi. Mitme alamotsingu korral jagab üks loogiline request-ID mitut `upstream_stage` väärtust; korrektne journald'i korrelatsioon kasutab seetõttu paari `request_id + upstream_stage`. Mõne `search_total` logirea väike positiivne delta tekib pärast response'i timingute koostamist tehtavast endpointi lõpetamistööst; embedding ja retrieval komponendid klapivad eraldi.",
    "",
    "## Individuaalsed tehnilised jooksud",
    "",
    runTable(runs),
    "",
    "## Artefaktid",
    "",
    "- `full-technical-runs.json` — tehnilised väljad ja automaatkontrollid;",
    "- `full-automatic-results.json` — olemasoleva Golden-runner'i kontrollid;",
    "- `full-blind-packet.json` — vastused ja kuvatud allikate kontrollitud metaandmed ilma mudelinimeta;",
    "- `full-blind-key.json` — eraldi run-ID/mudeli konfiguratsioonivõti;",
    "- `preflight.json` — sessiooni, hashide, konfiguratsiooni ja korpuseankrute kontroll.",
    ""
  ];
  await writeFile(args.output, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ event: "golden_37_mini_analysis", summary }));
}

main().catch(error => {
  console.error(JSON.stringify({ event: "golden_37_mini_analysis_failed", error: error?.message || String(error) }));
  process.exitCode = 1;
});
