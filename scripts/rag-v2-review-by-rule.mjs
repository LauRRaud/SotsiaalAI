// The review of a corpus increment made of collected sources, by rule (ADR-095, ADR-096, ADR-098). Every item must be
// one of the kinds below; each is included with a note that says what it is. Refuses to write when an item has a
// blocker, a failed state, is of another kind, or carries a warning the kind does not expect. Prints the aggregate only.
//   points  a page generated from the Social Insurance Board's table of assistive device sales points
//   page    an official web page the collector read
//   vendor  a page of an assistive device vendor's own website; its title begins with the company's name, so the title
//           as a whole does not stand in the page text (the one warning expected)
//   node scripts/rag-v2-review-by-rule.mjs <review-draft.json> <review.json> "<reviewer>"
import fs from 'node:fs';

const [draftPath, outPath, reviewer] = process.argv.slice(2);
if (!draftPath || !outPath || !reviewer) throw Error('usage: <review-draft.json> <review.json> "<reviewer>"');
const KINDS = {
  points: { note: 'Abivahendite müügipunktid (ADR-096): leht on koostatud Sotsiaalkindlustusameti kaardirakenduse tabelist loetud andmetest (punkt, omavalitsus, kategooria, müük või üür, üldtelefon, koduleht); sõnastus on koostaja oma, andmed tabeli omad.', expected: [] },
  page: { note: 'Ametlik veebileht (ADR-095): korjaja loetud sisuosa ilma saidi menüüde ja isikute kontaktideta; lehe tekst on võrdlemata hilisema seisuga, kontrolli kuupäev on metaandmetes. Leht on juhis, mitte õiguslik alus.', expected: [] },
  vendor: { note: 'Abivahendi müüja või teenuseosutaja enda veebileht (ADR-095, allika liik vendor_page): ettevõtte kirjeldus oma teenustest. Ei ole ametlik juhis; tingimused ja summad võivad olla muutunud, õiguse ja piirmäärade alus on määrus ja Sotsiaalkindlustusameti leht. Korjaja loetud sisuosa ilma isikute kontaktideta; kontrolli kuupäev on metaandmetes. Pealkiri on lehe enda pealkiri, mille ette on lisatud ettevõtte nimi.',
    expected: ['title_not_matched_in_pdf'] },
};
const value = field => (field && typeof field === 'object' && 'value' in field ? field.value : field);
const kindOf = item => {
  const type = value(item.fields?.source_type), title = String(value(item.fields?.title) ?? '');
  return type === 'registry' && title.startsWith('Abivahendite müügi- ja üüripunktid: ') ? 'points' : type === 'vendor_page' ? 'vendor' : type === 'web_page' ? 'page' : null;
};
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8')), tally = {}, problems = [];
for (const item of draft.items) {
  const kind = kindOf(item), warnings = (item.warnings || []).map(warning => warning.code).sort();
  const key = `${kind ?? `unknown:${value(item.fields?.source_type)}`} | ${item.state} | warnings ${warnings.join('+') || '-'} | blockers ${(item.blockers || []).length}`;
  tally[key] = (tally[key] || 0) + 1;
  if (!kind || item.state !== 'prepared' || (item.blockers || []).length || warnings.some(code => !KINDS[kind].expected.includes(code))) { problems.push(key); continue; }
  item.decision = 'include'; item.note = KINDS[kind].note;
}
console.log(JSON.stringify({ items: draft.items.length, tally, problems: problems.length }, null, 1));
if (problems.length) { console.log('NOT WRITTEN: an item is not what the rule covers'); process.exit(2); }
draft.reviewed_by = reviewer;
fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, { flag: 'wx' });
console.log('review written');
