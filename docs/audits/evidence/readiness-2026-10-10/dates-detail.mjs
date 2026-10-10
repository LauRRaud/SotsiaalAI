// Reads the graph experiment's reports of several days: per run and arm the questions that did not find every deciding
// phrase, and for the live arm how each deciding phrase stood (in the seeds, added by a pointer, or absent). Ids only.
//   node dates-detail.mjs <dir with c<N>-<date>/graph-experiment.json>
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], runs = fs.readdirSync(dir).filter(name => /^c\d-\d{4}-\d{2}-\d{2}$/u.test(name)).sort();
for (const name of runs) {
  const file = path.join(dir, name, 'graph-experiment.json');
  if (!fs.existsSync(file)) { console.log(`${name}: no report`); continue; }
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = arm => report.rows.filter(row => row.arm === arm && !row.found_all).map(row => row.question);
  console.log(`${name}: eligible ${report.eligible_documents} excluded ${report.excluded_legal_versions}`);
  for (const arm of ['A', 'V', 'L', 'N', 'O', 'C', 'D']) { const own = report.rows.filter(row => row.arm === arm); if (own.length) console.log(`   ${arm} ${own.filter(row => row.found_all).length}/${own.length} not found: ${missing(arm).join(', ') || '-'} | mean sources ${report.summary[arm]?.mean_sources} tokens ${report.summary[arm]?.mean_context_tokens}`); }
  const live = report.rows.filter(row => row.arm === 'O');
  console.log('   O per question:', live.map(row => `${row.question}:${row.found.map(item => (item.in_seeds ? 'seed' : item.in_evidence ? 'added' : 'no')).join('+')}/${row.sources}`).join('  '));
}
