#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

function args(argv) {
  const parsed = { input: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--input") parsed.input = argv[++index] || null;
    else if (argv[index] === "--output") parsed.output = argv[++index] || null;
    else throw new Error(`UNKNOWN_OPTION:${argv[index]}`);
  }
  if (!parsed.input || !parsed.output) throw new Error("INPUT_OUTPUT_REQUIRED");
  return parsed;
}

function quote(text) {
  return String(text || "").split(/\r?\n/u)
    .map(line => line.replace(/[ \t]+$/u, ""))
    .map(line => line ? `> ${line}` : ">")
    .join("\n");
}

async function main() {
  const options = args(process.argv.slice(2));
  const packet = JSON.parse(await readFile(options.input, "utf8"));
  const lines = [
    "# Golden-37 pimehindamispakett",
    "",
    "Mudel ja konfiguratsioon ei ole selles failis avaldatud. Kasuta `golden-37-mini-evaluation-form.md` fikseeritud rubriiki. Ära ava eraldi võtmefaili enne hinnete lukustamist.",
    "",
    "Iga vastuse järel täida kuus 0–3 hinnet, kontrollnimekiri, verbosity-tundlike punktide katvus ja kriitilise vea märge.",
    ""
  ];
  for (const response of packet.responses || []) {
    lines.push(`## ${response.question_id} — ${response.run_id}`, "", "### Vastus", "", quote(response.response_text), "", "### Kuvatud allikad", "");
    if (!response.displayed_sources?.length) {
      lines.push("Kuvatud allikaid ei olnud.", "");
    } else {
      response.displayed_sources.forEach((source, index) => {
        const meta = [source.title, source.page_range, source.url].filter(Boolean).join(" — ");
        lines.push(`${index + 1}. ${meta}`);
      });
      lines.push("");
    }
    lines.push(
      "### Hinnang",
      "",
      "| täpsus | katvus | eristus | piiride ausus | kasutatavus | selgus | verbosity-punktid | kriitiline viga |",
      "|---:|---:|---:|---:|---:|---:|---|---|",
      "| | | | | | | | |",
      "",
      "Kommentaar:",
      "",
      "---",
      ""
    );
  }
  await writeFile(options.output, lines.join("\n"), "utf8");
  console.log(JSON.stringify({ event: "golden_37_blind_markdown", responses: packet.responses?.length || 0 }));
}

main().catch(error => {
  console.error(JSON.stringify({ event: "golden_37_blind_markdown_failed", error: error?.message || String(error) }));
  process.exitCode = 1;
});
