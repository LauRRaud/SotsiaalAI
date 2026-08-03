#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_SEED = "sotsiaalai-golden37-mini-luna-2026-08-01-v1";

function parseArgs(argv) {
  const args = { seed: DEFAULT_SEED };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
    const key = arg.slice(2).replaceAll("-", "_");
    args[key] = argv[++index] || null;
  }
  for (const required of [
    "questions", "rubric", "mini_technical", "mini_blind", "mini_automatic",
    "luna_technical", "luna_blind", "luna_automatic", "output_dir"
  ]) {
    if (!args[required]) throw new Error(`MISSING_ARGUMENT:${required}`);
  }
  return args;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sum(values) {
  return values.map(finite).filter(value => value !== null).reduce((total, value) => total + value, 0);
}

function percentile(values, ratio) {
  const sorted = values.map(finite).filter(value => value !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return Number((sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)).toFixed(2));
}

function countBy(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] || 0) + 1;
  return result;
}

function unique(values) {
  return [...new Set(values)];
}

function originalRuns(technical) {
  return (technical.runs || []).filter(run => run.run_type === "original");
}

function technicalSummary(technical, automatic) {
  const runs = originalRuns(technical);
  const allRuns = technical.runs || [];
  const timings = runs.flatMap(run => run.retrieval_timings || []);
  const embedding = sum(timings.map(item => item.embedding_duration_ms));
  const retrieval = sum(timings.map(item => item.retriever_duration_ms));
  const component = embedding + retrieval;
  return {
    run_count: runs.length,
    technical_retry_count: allRuns.filter(run => run.run_type === "technical_retry").length,
    status_counts: countBy(runs.map(run => run.status)),
    provider_status_counts: countBy(runs.map(run => run.provider_status ?? "null")),
    response_present_false_count: runs.filter(run => run.response_present === false).length,
    incomplete_count: runs.filter(run => run.status === "incomplete").length,
    technical_failure_count: runs.filter(run => run.status === "technical_failure").length,
    retrieval_failure_count: runs.filter(run => run.status === "retrieval_failure" || run.rag_failed).length,
    stream_failure_count: runs.filter(run => run.status === "stream_failure").length,
    output_cap_reached_count: runs.filter(run => run.output_cap_reached === true).length,
    observed_models: unique(runs.map(run => run.observed_model).filter(Boolean)),
    observed_max_output_tokens: unique(runs.map(run => run.observed_max_output_tokens).filter(value => value !== null && value !== undefined)),
    latency_ms: {
      p50: percentile(runs.map(run => run.latency_ms), 0.5),
      max: Math.max(0, ...runs.map(run => finite(run.latency_ms) || 0)),
      total: sum(runs.map(run => run.latency_ms))
    },
    tokens: {
      input_total: sum(runs.map(run => run.input_tokens)),
      cached_total: sum(runs.map(run => run.cached_tokens)),
      output_total: sum(runs.map(run => run.output_tokens)),
      reasoning_total: sum(runs.map(run => run.reasoning_tokens)),
      non_reasoning_output_total: sum(runs.map(run => run.non_reasoning_output_tokens)),
      total: sum(runs.map(run => run.total_tokens)),
      output_p50: percentile(runs.map(run => run.output_tokens), 0.5),
      output_max: Math.max(0, ...runs.map(run => finite(run.output_tokens) || 0))
    },
    cost_usd: {
      total: Number(sum(runs.map(run => run.estimated_request_cost_usd)).toFixed(8)),
      average: Number((sum(runs.map(run => run.estimated_request_cost_usd)) / Math.max(1, runs.length)).toFixed(8))
    },
    sources: {
      raw_total: sum(runs.map(run => run.source_count)),
      displayed_total: sum(runs.map(run => run.displayed_source_count)),
      displayed_unique_total: sum(runs.map(run => run.displayed_unique_source_count)),
      zero_raw_count: runs.filter(run => run.source_count === 0).length,
      zero_displayed_count: runs.filter(run => run.displayed_source_count === 0).length,
      displayed_duplicate_entry_count: runs.reduce((total, run) => total + Math.max(
        0,
        Number(run.displayed_source_count || 0) - Number(run.displayed_unique_source_count || 0)
      ), 0),
      zero_source_question_ids: runs.filter(run => run.source_count === 0).map(run => run.question_id),
      duplicate_display_question_ids: runs
        .filter(run => run.displayed_source_count > run.displayed_unique_source_count)
        .map(run => run.question_id)
    },
    automatic: automatic.summary,
    retrieval: {
      attempted_run_count: runs.filter(run => run.rag_attempted).length,
      failed_run_count: runs.filter(run => run.rag_failed).length,
      call_count: timings.length,
      timeout_budget_counts: countBy(timings.map(item => item.retrieval_timeout_ms)),
      aborted_count: timings.filter(item => item.aborted_stage).length,
      non_ok_count: timings.filter(item => item.outcome !== "ok").length,
      over_10000_count: timings.filter(item => finite(item.retrieval_total_ms) > 10000).length,
      at_or_over_budget_count: timings.filter(item => finite(item.retrieval_total_ms) !== null
        && finite(item.retrieval_timeout_ms) !== null
        && finite(item.retrieval_total_ms) >= finite(item.retrieval_timeout_ms)).length,
      exact_three_stage_count: timings.filter(item => item.journal_stage_count === 3).length,
      journal_duplicate_count: sum(timings.map(item => item.journal_duplicate_count)),
      component_match_count: timings.filter(item => item.component_timings_match_journal === true).length,
      strict_match_count: timings.filter(item => item.timings_match_journal === true).length,
      embedding_share_pct: component ? Number((embedding / component * 100).toFixed(2)) : null,
      retrieval_share_pct: component ? Number((retrieval / component * 100).toFixed(2)) : null
    }
  };
}

function assertSameSet(label, expectedIds, actualIds) {
  if (expectedIds.length !== actualIds.length || expectedIds.some((id, index) => id !== actualIds[index])) {
    throw new Error(`${label}_QUESTION_ORDER_MISMATCH`);
  }
}

function modelConfig(run) {
  return {
    model: run.model,
    observed_model: run.observed_model ?? null,
    reasoning_effort: run.reasoning_effort,
    verbosity: run.verbosity,
    max_output_tokens: run.max_output_tokens,
    observed_max_output_tokens: run.observed_max_output_tokens ?? null,
    run_type: run.run_type
  };
}

function randomizedOrder(seed, questionId) {
  return createHash("sha256").update(`${seed}\0${questionId}`).digest()[0] % 2 === 0
    ? ["mini", "luna"]
    : ["luna", "mini"];
}

function fmt(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("et-EE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(value, digits = 0) {
  if (value === null || value === undefined) return "—";
  const formatted = fmt(Math.abs(value), digits);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

function comparisonTable(cases, miniRuns, lunaRuns) {
  const miniById = new Map(miniRuns.map(run => [run.question_id, run]));
  const lunaById = new Map(lunaRuns.map(run => [run.question_id, run]));
  return [
    "| # | question_id | mini ms | Luna ms | Δ ms | mini output | Luna output | mini uniq src | Luna uniq src | mini auto | Luna auto |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---:|---|---|",
    ...cases.map((testCase, index) => {
      const mini = miniById.get(testCase.id);
      const luna = lunaById.get(testCase.id);
      return `| ${index + 1} | \`${testCase.id}\` | ${fmt(mini.latency_ms)} | ${fmt(luna.latency_ms)} | ${signed(luna.latency_ms - mini.latency_ms)} | ${fmt(mini.output_tokens)} | ${fmt(luna.output_tokens)} | ${fmt(mini.displayed_unique_source_count)} | ${fmt(luna.displayed_unique_source_count)} | ${mini.automatic_golden_pass ? "PASS" : "FAIL"} | ${luna.automatic_golden_pass ? "PASS" : "FAIL"} |`;
    })
  ].join("\n");
}

function blindMarkdown(packet) {
  const lines = [
    "# Golden-37 pimehindamispakett",
    "",
    "Mudelid ja konfiguratsioonid on siit failist teadlikult eemaldatud. Hinda mõlemad vastused enne eraldi võtmefaili avamist. Küsimuse täistekst, fikseeritud vestlusajalugu ja olemasolevad Golden-ootused on lisatud, et ülesandespetsiifiline hindamine oleks võimalik.",
    "",
    "## Hindamine",
    "",
    "Anna kummalegi vastusele kuus hinnet skaalal 0–3: (1) faktiline ja õiguslik täpsus; (2) katvus ja küsimusele vastamine; (3) fakti, hinnangu, praktika, uuringu ja ettepaneku eristus; (4) ebakindluse ja allikapiiride ausus; (5) praktiline kasutatavus; (6) selgus, struktuur, terviklikkus ja proportsionaalne pikkus. Kriitiline viga piirab faktitäpsuse maksimaalselt ühele punktile.",
    "",
    "Kontrolli eraldi allikate asjakohasust, väidete ja allikate vastavust, inimese õigusi/autonoomiat, põhjendamata oletusi, riskide seost maandamisega ja allikate jälgitavust. `task_expectations` on fikseeritud automaatkontrolli alus, mitte täielik sisuhinne.",
    ""
  ];
  for (const item of packet.items) {
    lines.push(`## ${item.index}. ${item.question_id}`, "", `**Küsimus:** ${item.question}`, "");
    if (item.history?.length) {
      lines.push("**Fikseeritud vestlusajalugu:**", "");
      for (const message of item.history) {
        lines.push(`- ${message.role}: ${message.content}`);
        if (message.sources?.length) lines.push(`  - allikad: ${message.sources.map(source => source.title).join("; ")}`);
      }
      lines.push("");
    }
    lines.push("**Ülesandespetsiifilised ootused:**", "", "```json", JSON.stringify(item.task_expectations, null, 2), "```", "");
    for (const answer of item.answers) {
      lines.push(`### Vastus ${answer.label} — ${answer.run_id}`, "", answer.response_text || "*(vastus puudub)*", "", "Kuvatud allikad:", "");
      if (answer.displayed_sources.length) {
        answer.displayed_sources.forEach(source => lines.push(`- ${source.title}${source.url ? ` — ${source.url}` : ""}${source.page_range ? `, lk ${source.page_range}` : ""}`));
      } else {
        lines.push("- puuduvad");
      }
      lines.push("", "Hinded: täpsus __ / katvus __ / eristus __ / piiride ausus __ / kasutatavus __ / selgus __", "", "Kriitiline viga: jah / ei. Kommentaar: ____________________", "");
    }
    lines.push("Paarieelistus: A / B / võrdne. Põhjendus: ____________________", "", "---", "");
  }
  return lines.join("\n");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const questionBytes = await readFile(args.questions);
  const rubricBytes = await readFile(args.rubric);
  const questions = JSON.parse(questionBytes);
  const [miniTechnical, miniBlind, miniAutomatic, lunaTechnical, lunaBlind, lunaAutomatic] = await Promise.all([
    readJson(args.mini_technical), readJson(args.mini_blind), readJson(args.mini_automatic),
    readJson(args.luna_technical), readJson(args.luna_blind), readJson(args.luna_automatic)
  ]);
  const cases = questions.cases || [];
  const expectedIds = cases.map(item => item.id);
  const miniRuns = originalRuns(miniTechnical);
  const lunaRuns = originalRuns(lunaTechnical);
  assertSameSet("MINI_TECHNICAL", expectedIds, miniRuns.map(run => run.question_id));
  assertSameSet("LUNA_TECHNICAL", expectedIds, lunaRuns.map(run => run.question_id));
  assertSameSet("MINI_BLIND", expectedIds, miniBlind.responses.map(run => run.question_id));
  assertSameSet("LUNA_BLIND", expectedIds, lunaBlind.responses.map(run => run.question_id));
  const questionSetHash = sha256(questionBytes);
  if (miniTechnical.question_set_hash !== questionSetHash || lunaTechnical.question_set_hash !== questionSetHash) {
    throw new Error("QUESTION_SET_HASH_MISMATCH");
  }

  const miniResponseById = new Map(miniBlind.responses.map(response => [response.question_id, response]));
  const lunaResponseById = new Map(lunaBlind.responses.map(response => [response.question_id, response]));
  const miniRunById = new Map(miniRuns.map(run => [run.question_id, run]));
  const lunaRunById = new Map(lunaRuns.map(run => [run.question_id, run]));
  const source = { mini: miniResponseById, luna: lunaResponseById };
  const technicalSource = { mini: miniRunById, luna: lunaRunById };
  const labels = ["A", "B"];
  const keyEntries = [];
  const items = cases.map((testCase, index) => {
    const order = randomizedOrder(args.seed, testCase.id);
    const answers = order.map((candidate, candidateIndex) => {
      const response = source[candidate].get(testCase.id);
      const run = technicalSource[candidate].get(testCase.id);
      const label = labels[candidateIndex];
      keyEntries.push({
        question_id: testCase.id,
        answer_label: label,
        anonymous_run_id: response.run_id,
        source_run_id: run.run_id,
        ...modelConfig(run)
      });
      return {
        label,
        run_id: response.run_id,
        response_text: response.response_text,
        displayed_sources: response.displayed_sources || []
      };
    });
    return {
      index: index + 1,
      question_id: testCase.id,
      family: testCase.family,
      question: testCase.question,
      history: testCase.history || [],
      task_expectations: testCase.expect || {},
      answers
    };
  });
  const generatedAt = new Date().toISOString();
  const blindPacket = {
    schema: "golden-37-blind-paired-comparison-v1",
    generated_at: generatedAt,
    question_set_hash: questionSetHash,
    rubric_hash: sha256(rubricBytes),
    evaluator_instructions: {
      model_identity_hidden: true,
      score_scale: "0-3",
      categories: ["accuracy", "coverage", "distinctions", "uncertainty_and_limits", "practical_usability", "clarity_structure_completeness"],
      critical_error_rule: "A critical error caps accuracy at 1.",
      key_release: "Open the separate key only after all human scores are locked."
    },
    items
  };
  const humanScoresTemplate = {
    schema: "golden-37-blind-human-scores-v1",
    question_set_hash: questionSetHash,
    rubric_hash: sha256(rubricBytes),
    evaluator: "",
    scoring_started_at: "",
    scoring_locked_at: "",
    key_opened_at: "",
    key_must_remain_closed_until_scoring_locked: true,
    scores: items.flatMap(item => item.answers.map(answer => ({
      question_id: item.question_id,
      answer_label: answer.label,
      run_id: answer.run_id,
      accuracy_0_3: null,
      coverage_0_3: null,
      distinctions_0_3: null,
      uncertainty_and_limits_0_3: null,
      practical_usability_0_3: null,
      clarity_structure_completeness_0_3: null,
      verbosity_points: "",
      critical_error: null,
      checklist: {
        factual_and_legal_accuracy: "",
        answers_question: "",
        source_relevance: "",
        claim_source_alignment: "",
        practice_research_proposal_distinguished: "",
        rights_and_autonomy: "",
        avoids_unsupported_assumptions: "",
        risks_linked_to_mitigation: "",
        practical_usability: "",
        completeness_within_assigned_limit: "",
        clarity_and_structure: "",
        source_traceability: ""
      },
      comment: ""
    }))),
    pair_preferences: items.map(item => ({
      question_id: item.question_id,
      preference: "",
      rationale: ""
    }))
  };
  const blindKey = {
    schema: "golden-37-mini-luna-blind-key-v1",
    generated_at: generatedAt,
    reveal_only_after_human_scores_locked: true,
    randomization_seed: args.seed,
    question_set_hash: questionSetHash,
    rubric_hash: sha256(rubricBytes),
    entries: keyEntries
  };
  const miniSummary = technicalSummary(miniTechnical, miniAutomatic);
  const lunaSummary = technicalSummary(lunaTechnical, lunaAutomatic);
  const comparison = {
    schema: "golden-37-mini-luna-technical-comparison-v1",
    generated_at: generatedAt,
    question_set_hash: questionSetHash,
    rubric_hash: sha256(rubricBytes),
    mini: miniSummary,
    luna: lunaSummary,
    delta_luna_minus_mini: {
      latency_p50_ms: lunaSummary.latency_ms.p50 - miniSummary.latency_ms.p50,
      latency_max_ms: lunaSummary.latency_ms.max - miniSummary.latency_ms.max,
      output_tokens_total: lunaSummary.tokens.output_total - miniSummary.tokens.output_total,
      reasoning_tokens_total: lunaSummary.tokens.reasoning_total - miniSummary.tokens.reasoning_total,
      estimated_cost_usd: Number((lunaSummary.cost_usd.total - miniSummary.cost_usd.total).toFixed(8)),
      displayed_unique_sources_total: lunaSummary.sources.displayed_unique_total - miniSummary.sources.displayed_unique_total,
      output_cap_reached_count: lunaSummary.output_cap_reached_count - miniSummary.output_cap_reached_count,
      automatic_fail_count: lunaSummary.automatic.fail - miniSummary.automatic.fail
    },
    human_evaluation_status: "pending_blind_scores"
  };
  const lines = [
    "# gpt-5.4-mini vs gpt-5.6-luna Golden-37 tehniline võrdlus",
    "",
    `Küsimustik: Golden-37, SHA-256 \`${questionSetHash}\`. Rubriigi SHA-256 \`${comparison.rubric_hash}\`. Mõlemal poolel 37 fikseeritud küsimust samas järjestuses.`,
    "",
    "Luna jooks tehti eraldatud loopback-only protsessis tootmise HEAD-il `13cfe8605e5ce705b8b4c973a39c389b09e5ac58`. Tootmise frontend-, RAG-, env-, prompt-, korpuse- ega retrieval-seadeid ei muudetud. Kandidaatkomplekt erineb mini baasist mudeli, reasoning effort'i ja output-lae poolest; see ei ole ainult mudelinime isoleeritud A/B.",
    "",
    "## Tulemus",
    "",
    "| Näitaja | mini baas | Luna kandidaat | Luna − mini |",
    "|---|---:|---:|---:|",
    `| completed | ${miniSummary.status_counts.completed || 0}/37 | ${lunaSummary.status_counts.completed || 0}/37 | ${signed((lunaSummary.status_counts.completed || 0) - (miniSummary.status_counts.completed || 0))} |`,
    `| technical retry | ${miniSummary.technical_retry_count} | ${lunaSummary.technical_retry_count} | ${signed(lunaSummary.technical_retry_count - miniSummary.technical_retry_count)} |`,
    `| automaat-PASS | ${miniSummary.automatic.pass}/37 | ${lunaSummary.automatic.pass}/37 | ${signed(lunaSummary.automatic.pass - miniSummary.automatic.pass)} |`,
    `| latentsus p50 ms | ${fmt(miniSummary.latency_ms.p50)} | ${fmt(lunaSummary.latency_ms.p50)} | ${signed(comparison.delta_luna_minus_mini.latency_p50_ms)} |`,
    `| latentsus max ms | ${fmt(miniSummary.latency_ms.max)} | ${fmt(lunaSummary.latency_ms.max)} | ${signed(comparison.delta_luna_minus_mini.latency_max_ms)} |`,
    `| output-tokenid kokku | ${fmt(miniSummary.tokens.output_total)} | ${fmt(lunaSummary.tokens.output_total)} | ${signed(comparison.delta_luna_minus_mini.output_tokens_total)} |`,
    `| reasoning-tokenid kokku | ${fmt(miniSummary.tokens.reasoning_total)} | ${fmt(lunaSummary.tokens.reasoning_total)} | ${signed(comparison.delta_luna_minus_mini.reasoning_tokens_total)} |`,
    `| output-cap tabamused | ${miniSummary.output_cap_reached_count} | ${lunaSummary.output_cap_reached_count} | ${signed(comparison.delta_luna_minus_mini.output_cap_reached_count)} |`,
    `| hinnanguline kulu USD | ${miniSummary.cost_usd.total.toFixed(6)} | ${lunaSummary.cost_usd.total.toFixed(6)} | ${signed(comparison.delta_luna_minus_mini.estimated_cost_usd, 6)} |`,
    `| kuvatud unikaalsed allikad kokku | ${miniSummary.sources.displayed_unique_total} | ${lunaSummary.sources.displayed_unique_total} | ${signed(comparison.delta_luna_minus_mini.displayed_unique_sources_total)} |`,
    `| RAG failure | ${miniSummary.retrieval.failed_run_count} | ${lunaSummary.retrieval.failed_run_count} | ${signed(lunaSummary.retrieval.failed_run_count - miniSummary.retrieval.failed_run_count)} |`,
    "",
    `Mini konfiguratsioon: \`${miniSummary.observed_models.join(", ") || "historical harness did not persist observed model"}\`, low/medium/1100. Luna tegelikult vaadeldud konfiguratsioon: \`${lunaSummary.observed_models.join(", ")}\`, medium/medium/${lunaSummary.observed_max_output_tokens.join(", ")}.`,
    `Luna: incomplete ${lunaSummary.incomplete_count}, response puudus ${lunaSummary.response_present_false_count}, technical failure ${lunaSummary.technical_failure_count}, retrieval failure ${lunaSummary.retrieval_failure_count}, stream failure ${lunaSummary.stream_failure_count}.`,
    `Luna RAG timinguid ${lunaSummary.retrieval.call_count}; abort ${lunaSummary.retrieval.aborted_count}; non-ok ${lunaSummary.retrieval.non_ok_count}; journald kolm etappi ${lunaSummary.retrieval.exact_three_stage_count}/${lunaSummary.retrieval.call_count}; duplikaate ${lunaSummary.retrieval.journal_duplicate_count}; komponentide vaste ${lunaSummary.retrieval.component_match_count}/${lunaSummary.retrieval.call_count}.`,
    `Luna retrieval-komponentajast embedding ${fmt(lunaSummary.retrieval.embedding_share_pct, 2)}% ja retrieval ${fmt(lunaSummary.retrieval.retrieval_share_pct, 2)}%. Eelarved: ${Object.entries(lunaSummary.retrieval.timeout_budget_counts).map(([budget, count]) => `${budget} ms=${count}`).join(", ")}.`,
    `Luna nullallikaga juhud: ${lunaSummary.sources.zero_source_question_ids.map(id => `\`${id}\``).join(", ") || "puuduvad"}. Kuvatavate allikate duplikaadiga juhud: ${lunaSummary.sources.duplicate_display_question_ids.map(id => `\`${id}\``).join(", ") || "puuduvad"}.`,
    "",
    "## Otsustusvärav",
    "",
    "Tehniline värav on läbitud, kuid deploy-soovitus on **ootel**. Automaat-PASS ei tõenda faktilist, õiguslikku ega allikapõhist sisukvaliteeti. Esmalt tuleb lukustada inimese pimehinded; alles seejärel avada võti ja hinnata kriitilisi vigu, kvaliteediregressiooni, allikatäpsust, latentsust ning kulu koos.",
    "",
    "## Kõik individuaalsed jooksud",
    "",
    comparisonTable(cases, miniRuns, lunaRuns),
    ""
  ];

  await mkdir(args.output_dir, { recursive: true });
  await Promise.all([
    writeFile(join(args.output_dir, "golden-37-blind-evaluator.json"), `${JSON.stringify(blindPacket, null, 2)}\n`, "utf8"),
    writeFile(join(args.output_dir, "golden-37-blind-evaluator.md"), blindMarkdown(blindPacket), "utf8"),
    writeFile(join(args.output_dir, "golden-37-human-scores-template.json"), `${JSON.stringify(humanScoresTemplate, null, 2)}\n`, "utf8"),
    writeFile(join(args.output_dir, "mini-luna-blind-key.json"), `${JSON.stringify(blindKey, null, 2)}\n`, "utf8"),
    writeFile(join(args.output_dir, "mini-luna-technical-comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`, "utf8"),
    writeFile(join(args.output_dir, "mini-luna-technical-comparison.md"), lines.join("\n"), "utf8")
  ]);
  console.log(JSON.stringify({
    event: "golden_37_comparison_created",
    question_count: cases.length,
    question_set_hash: questionSetHash,
    rubric_hash: sha256(rubricBytes),
    mini: miniSummary,
    luna: lunaSummary,
    output_dir: args.output_dir
  }));
}

main().catch(error => {
  console.error(JSON.stringify({ event: "golden_37_comparison_failed", error: error?.message || String(error) }));
  process.exitCode = 1;
});
