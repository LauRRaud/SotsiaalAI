import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProvisions, namedProvisions, provisionRefusal, readable, PROVISION_CHECK_VERSION, PROVISION_KINDS, REFUSED_KINDS } from '../lib/rag-v2/pilot/provision-check.js';
import { PROVISION_FORM, legalProvisionInstructions } from '../lib/rag-v2/pilot/contracts.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { leanPayload } from '../lib/rag-v2/pilot/lean-turn.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';

// ADR-129 (10.10.2026): every provision an answer names, against the evidence of its turn. No model. The acts, their
// texts and their numbers are invented. Two real laws stand in by their titles only, because their abbreviations come
// from the table of indexed laws (act-abbreviations.json): the Social Welfare Act (SHS), with an invented § 900, is in
// the evidence; the Family Law Act (PKS) is a law of the corpus that this evidence does not hold.
// The check refuses nothing since the maintainer's decision of 10.10.2026 (REFUSED_KINDS is empty): the tests below
// that pinned a refusal by default were changed on purpose. They now pin the kind, and reach the refusal path by
// giving the check a list (`refuse`) or the service one (refusedProvisionKinds).
const entry = (id, title, text, place = null, extra = {}) => ({ evidence_id: id, bibliography: { title }, source_text: text, ...(place ? { legal_place: place } : {}), ...extra });
const issued = (municipality, authority) => ({ source_metadata: { source_type: { value: 'legal_act' }, authority: { value: authority },
  ...(municipality ? { municipality_name: { value: municipality }, municipality_id: { value: municipality.toLowerCase().replace(/\s+/gu, '_') } } : {}) } });
const LAW = 'Fiktiivsete toetuste seadus', OTHER_LAW = 'Fiktiivse kaitse seadus', RULE = 'Fiktiivse toetuse andmise kord', GUIDE = 'Fiktiivne juhend', SHS = 'Sotsiaalhoolekande seadus';
const BUDGET = '2031. aasta fiktiivse eelarve seadus', LIMITS = 'Fiktiivsete piirmäärade kehtestamine';
const evidence = [
  // S1: the section's first passage: its heading line and two subsections.
  entry('e1', LAW, '§ 133.\nToetuse arvestamine\n(1)\nToetust arvestatakse kuu kaupa.\n(2)\nKulud arvatakse maha.', { section: '133', subsections: ['1', '2'] }),
  // S2: a later passage of the same section, no "§ 133" in its text; it points at another section of its own act.
  entry('e2', LAW, 'Eluasemekulud loetakse piirmäära ulatuses.\n(6)\nKäesoleva seaduse § 140 lõikes 2 nimetatud kulusid ei arvestata.', { section: '133', subsections: ['5', '6'] }),
  // S3: the section's last subsection, in a passage of its own.
  entry('e3', LAW, '(7)\nOtsus tehakse kümne tööpäeva jooksul.', { section: '133', subsections: ['7'] }),
  // S4 and S5: two municipalities' regulations of one title, both § 3 lg 1. S4 points at a law the evidence does not
  // hold, and its act's dates name its entry-into-force provision.
  entry('e4', RULE, '§ 3.\nPiirmäärad\n(1)\nPiirmäär on 100 eurot. Vt perekonnaseaduse § 25 lõiget 2.', { section: '3', subsections: ['1'] },
    { ...issued('Näidise vald', 'Näidise Vallavolikogu'), legal_dates: { act: { entry_into_force: [{ provision: '§ 9 lg 1', text: 'Määrust rakendatakse 1. maist.' }] } } }),
  entry('e5', RULE, '§ 3.\nPiirmäärad\n(1)\nPiirmäär on 250 eurot.', { section: '3', subsections: ['1'] }, issued('Teise vald', 'Teise Vallavalitsus')),
  // S6: another law, whose text points at its own section 9.
  entry('e6', OTHER_LAW, '§ 5.\nKaitse\n(1)\nKäesoleva seaduse § 9 lõikes 2 nimetatud isik saab kaitset.', { section: '5', subsections: ['1'] }),
  // S7: a guide page that mentions a paragraph in its text: no act, no label.
  entry('e7', GUIDE, 'Juhend selgitab, et toetust saab taotleda vallast (vt seaduse § 200).'),
  // S8: a law of the table (abbreviation SHS), with an invented section.
  entry('e8', SHS, '§ 900.\nNäidissäte\n(1)\nNäidistekst.\n(2)\nTeine näidistekst.', { section: '900', subsections: ['1', '2'] }),
  // S9: an act read from a PDF: no label; its text begins with the section and shows its subsections in running text.
  entry('e9', 'Fiktiivne vana kord', '§ 7. Taotlemine (1) Taotlus esitatakse kirjalikult. (2) Otsus tehakse 30 päeva jooksul.'),
  // S10: a section whose subsections the label could not name (they do not stand side by side in the passage).
  entry('e10', LAW, '§ 20.\nTeavitamine\n(1)\nVald teavitab.\n(4)\nTeade on kirjalik.', { section: '20', subsections: [] }),
  // S11: a section whose number has a raised digit.
  entry('e11', LAW, '§ 13¹.\nErand\nErandit kohaldatakse taotluse alusel.', { section: '13¹', subsections: [] }),
  // S12: a passage whose text names a range of sections and a range of subsections.
  entry('e12', LAW, '§ 160.\nRakendamine\nParagrahvides 105–107 sätestatut ja § 150 lõigetes 2–4 nimetatut kohaldatakse tagasiulatuvalt.', { section: '160', subsections: [] }),
  // S13: a minister's regulation.
  entry('e13', 'Fiktiivse teenuse nõuded', '§ 4.\nNõuded\n(1)\nTeenust osutab koolitatud isik.', { section: '4', subsections: ['1'] }, issued(null, 'Näidisminister')),
];
const references = Object.fromEntries(evidence.map((item, at) => [`S${at + 1}`, { evidence_id: item.evidence_id }]));
const packet = { evidence, reference_map: references,
  version_comparison: { acts: [{ act: LAW, differences: [{ provision: '§ 170 lg 3', state: 'changed' }], same_wording: ['§ 171'], not_in_evidence: { added: ['§ 172 lg 1'] } }] },
  // What the model was shown: the excerpts with their labels, and beside them a record's field and a dependency note.
  model_context: { schema_version: 'rag-v2/model-context-json-5', sources: { D1: { title: LAW } },
    evidence: evidence.map((item, at) => ({ ref: `S${at + 1}`, source: 'D1', ...(item.legal_place ? { provision: `§ ${item.legal_place.section}` } : {}), text: item.source_text })),
    records: { entries: [{ key: 'R1', kind: 'service', fields: { legal_basis: { value: 'Õiguslik alus on § 17 lg 2.', refs: ['S7'] } } }] }, dependencies: { relations: [{ from: '§ 133 lg 5', to: '§ 141 lg 2' }] } } };
// The passages the reviews of 10.10.2026 asked for, in a wider packet, so that the counts above stay what they were.
const more = [
  // S14: a later passage of a section whose text points inside its own section, with "käesoleva paragrahvi" and
  // without, and once at another section ("eelmise paragrahvi").
  entry('x1', LAW, '(4)\nKäesoleva paragrahvi lõikes 2 nimetatud taotluse vaatab läbi vald.\n(5)\nLõigetes 1–3 kehtestatud tähtaegu ei pikendata. Eelmise paragrahvi lõikes 9 sätestatut ei kohaldata.', { section: '134', subsections: ['4', '5'] }),
  // S15: a law whose title begins with a year (the one indexed law without an abbreviation does).
  entry('x2', BUDGET, '(7)\nToimetulekupiir on 220 eurot.', { section: '2', subsections: ['7'] }),
  // S16: a law's passage that points at sections of ANOTHER act by that act's name.
  entry('x3', LAW, '(1)\nMaha arvatakse fiktiivse kaitse seaduse §-de 131 ja 132 kohaselt kinni peetud summad.', { section: '135', subsections: ['1'] }),
  // S17: a guide that mentions a law's paragraph by the law's abbreviation.
  entry('x4', 'Fiktiivne teine juhend', 'Juhend viitab seadusele: vt SHS § 131 lõike 1 selgitust.'),
  // S18: a second act of the municipality of S4, with the same section number.
  entry('x5', LIMITS, '§ 3.\nÜüri piirmäärad\n(1)\nÜhe inimese piirmäär.\n(2)\nKahe inimese piirmäär.\n(3)\nIga järgmise inimese piirmäär.', { section: '3', subsections: ['1', '2', '3'] }, issued('Näidise vald', 'Näidise Vallavolikogu')),
];
const wide = { ...packet, evidence: [...evidence, ...more], reference_map: Object.fromEntries([...evidence, ...more].map((item, at) => [`S${at + 1}`, { evidence_id: item.evidence_id }])) };
const answer = (blocks, limitations = [], clarification = null) => ({ kind: 'grounded', blocks: blocks.map(([text, ...refs]) => ({ text, factual: true, refs })), limitations, clarification });
const check = (blocks, { said = [], published = [], limitations = [], clarification = null, of = packet, refuse } = {}) => checkProvisions(answer(blocks, limitations, clarification), of, said, published, refuse ? { refuse } : undefined);
const kindsOf = (blocks, options) => check(blocks, options).audit.kinds;
const zero = Object.fromEntries(PROVISION_KINDS.map(kind => [kind, 0])), only = (kind, count = 1) => ({ ...zero, [kind]: count });

test('the forms an answer may write a provision in are read as one: Estonian, English, Russian, word forms, lists and ranges', () => {
  const read = text => namedProvisions(readable(text)).map(({ section, subsections }) => [section, subsections]);
  assert.deepEqual(read('(fiktiivsete toetuste seaduse § 133 lg 5)'), [['133', ['5']]]);
  // One mention for each named subsection, each end of a range on its own.
  assert.deepEqual(read('Fiktiivsete toetuste seaduse § 133 lõigete 5 ja 6 järgi'), [['133', ['5']], ['133', ['6']]]);
  assert.deepEqual(read('§ 133 lg 5–7, § 13¹ lg 2¹ ja §-des 105–107'), [['133', ['5']], ['133', ['7']], ['13^1', ['2^1']], ['105', []], ['107', []]]);
  assert.deepEqual(read('paragrahvi 133 lõige 5'), [['133', ['5']]]);
  // The word written again: both subsections are read (the cross-reference readers take the first group only).
  assert.deepEqual(read('§ 3 lg 1 ja lg 2'), [['3', ['1']], ['3', ['2']]]);
  assert.deepEqual(read('§ 133 lõike 5 punkti 1 ja lõike 6'), [['133', ['5']], ['133', ['6']]]);
  assert.deepEqual(read('(Fictional Benefits Act (Fiktiivsete toetuste seadus) § 133(5)), later § 133(5–7) and § 134 subsection 2'), [['133', ['5']], ['133', ['5']], ['133', ['7']], ['134', ['2']]]);
  assert.deepEqual(read('(Закон (Fiktiivsete toetuste seadus) § 133 ч. 5), статья 16 часть 1, ст. 9'), [['133', ['5']], ['16', ['1']], ['9', []]]);
  // A raised digit written with a caret is that digit; a year in brackets is no subsection.
  assert.deepEqual(read('§ 13^1 lg 2^1 ning § 133 (2026)'), [['13^1', ['2^1']], ['133', []]]);
  // A line that begins with a section mark is a mention in an answer; in a passage it is the passage's own heading.
  assert.deepEqual(read('§ 133.\nToetuse arvestamine'), [['133', []]]);
  assert.deepEqual(namedProvisions('§ 133.\nToetuse arvestamine\nvt § 140 lõiget 2', { headings: false }).map(item => item.section), ['140']);
  // Known limits, pinned: each makes the check read less than was written, never more.
  assert.deepEqual(read('The form has section 3 for income.'), []);
  assert.deepEqual(read('aastal 2026 ja 5 §'), []);
  assert.deepEqual(read('see §§ 133 and 999'), [['133', []]]);
  assert.deepEqual(read('§ 13-1 and § 13 1'), [['13', []]]);
  assert.deepEqual(read('Seda ütleb lõige 9 ja sama paragrahvi lõige 3.'), []);
});

// Both reviews of 10.10.2026 (their first blocker): a number that stands after a provision was read as one more
// subsection, or as the far end of a range of sections, and a right answer became kind d.
test('a number after a provision is a subsection only when the answer goes on about the provision: a year, a date, a deadline and a count are left out', () => {
  const read = text => namedProvisions(readable(text)).map(({ section, subsections }) => [section, subsections]);
  // A second act whose title begins with a year, joined by a word or a comma, in brackets and at a sentence's start.
  for (const text of ['Toimetulekupiir on 220 eurot kuus (sotsiaalhoolekande seaduse § 131 lg 1 ja 2026. aasta riigieelarve seaduse § 2 lg 7).', '(sotsiaalhoolekande seaduse § 131 lg 1 ning 2026. aasta riigieelarve seaduse § 2 lg 7)',
    '(SHS § 131 lg 1, 2026. aasta riigieelarve seaduse § 2 lg 7)', 'Sotsiaalhoolekande seaduse § 131 lg 1 ja 2026. aasta riigieelarve seaduse § 2 lg 7 järgi on piir 220 eurot.']) assert.deepEqual(read(text), [['131', ['1']], ['2', ['7']]], text);
  // A year, a date.
  assert.deepEqual(read('(sotsiaalhoolekande seaduse § 133 lg 1, 2026. aasta seisuga)'), [['133', ['1']]]);
  assert.deepEqual(read('§ 21 lg 2 ja 1. jaanuarist 2027'), [['21', ['2']]]);
  assert.deepEqual(read('(§ 133 lg 1, 2026)'), [['133', ['1']]]);
  // A deadline or a count, whatever joins it: a word, a comma, a dash, "kuni".
  for (const text of ['§ 133 lg 7 ja 10 tööpäeva jooksul', 'Otsuse tähtaeg: sotsiaalhoolekande seaduse § 133 lg 7 – 10 tööpäeva.', 'Vastavalt sotsiaalhoolekande seaduse § 133 lg 7, 10 tööpäeva jooksul tehakse otsus.',
    'Under § 133(7), 10 working days are allowed for the decision.', 'Deadline: § 133(7) – 10 working days.', 'Согласно § 133 ч. 7, 10 рабочих дней даётся на решение.', '§ 133 lg 7 ja 10 %', '§ 133 lg 7 ja 200 eurot']) assert.deepEqual(read(text), [['133', ['7']]], text);
  for (const text of ['§ 21 lg 1 ja 2 lapse puhul', '§ 21 lg 1, 14 päeva jooksul', '§ 21 lg 1 – 14 päeva', '§ 21 lg 1 ja 2 inimese leibkonnale']) assert.deepEqual(read(text), [['21', ['1']]], text);
  assert.deepEqual(read('§ 133 lõigete 5 ja 7 ning 30 päeva jooksul'), [['133', ['5']], ['133', ['7']]]);
  // The far end of a range of sections.
  assert.deepEqual(read('Avaldus vaadatakse läbi: § 7 – 30 päeva jooksul.'), [['7', []]]);
  assert.deepEqual(read('Toetus makstakse Näidise valla määruse § 6 kuni 30 päeva jooksul.'), [['6', []]]);
  assert.deepEqual(read('§ 9 ja 16 kuu jooksul'), [['9', []]]);
  // It stays a subsection, or a range's end, when nothing follows, a closing mark does, or the answer goes on about the provision.
  for (const text of ['§ 133 lg 7 ja 10 alusel', '(§ 133 lg 7 ja 10)', 'Vt § 133 lg 7 ja 10. Seejärel tehakse otsus.', '§ 133 lg 7 ja 10 sätestavad tähtaja', '§ 133 lg 7, 10', '§ 133 lõigete 7 ja 10 järgi', '§ 133 lõigetes 7 ja 10 nimetatud']) assert.deepEqual(read(text), [['133', ['7']], ['133', ['10']]], text);
  assert.deepEqual(read('§ 133 lg 1, 2 ja 3.'), [['133', ['1']], ['133', ['2']], ['133', ['3']]]);
  assert.deepEqual([read('§-des 105–107 sätestatut'), read('§ 5–7 kohta')], [[['105', []], ['107', []]], [['5', []], ['7', []]]]);
  // A number of points is not a subsection either way: the subsections before it are read as they were.
  assert.deepEqual(read('§ 133 lõike 1 punktides 2 ja 3 lapse'), [['133', ['1']]]);
  // Pinned: an unknown word after the number leaves it out, so the answer is checked for less than it wrote.
  assert.deepEqual(read('§ 133 lg 5 ja 6 puudutavad kõiki'), [['133', ['5']]]);
  // The kinds: each sentence over the passages it cites names nothing that nothing gives. Before the fix "lg 2031",
  // "lg 10" and "§ 30" were kind d, and "lg 2" a silent kind a.
  const budget = text => kindsOf([[text, 'S8', 'S15']], { of: wide });
  for (const text of ['Piir on 220 eurot (sotsiaalhoolekande seaduse § 900 lg 1 ja 2031. aasta fiktiivse eelarve seaduse § 2 lg 7).', 'Piir on 220 eurot (sotsiaalhoolekande seaduse § 900 lg 1, 2031. aasta fiktiivse eelarve seaduse § 2 lg 7).',
    'Sotsiaalhoolekande seaduse § 900 lg 1 ning 2031. aasta fiktiivse eelarve seaduse § 2 lg 7 järgi on piir 220 eurot.', 'Piir on 220 eurot (sotsiaalhoolekande seaduse § 900 lg 1; 2031. aasta fiktiivse eelarve seaduse § 2 lg 7).']) assert.deepEqual(budget(text), only('a', 2), text);
  assert.deepEqual(kindsOf([['Näidis (sotsiaalhoolekande seaduse § 900 lg 1, 2031. aasta seisuga).', 'S8']]), only('a'));
  for (const text of ['Otsuse tähtaeg: fiktiivsete toetuste seaduse § 133 lg 7 – 10 tööpäeva.', 'Vastavalt fiktiivsete toetuste seaduse § 133 lg 7, 10 tööpäeva jooksul tehakse otsus.', 'Under § 133(7), 10 working days are allowed for the decision.',
    'Deadline: § 133(7) – 10 working days.', 'Согласно § 133 ч. 7, 10 рабочих дней даётся на решение.', 'Otsus tehakse § 133 lg 7 ja 10 tööpäeva jooksul.']) assert.deepEqual(kindsOf([[text, 'S3']]), only('a'), text);
  assert.deepEqual(kindsOf([['Avaldus vaadatakse läbi: § 7 – 30 päeva jooksul.', 'S9']]), only('b'));
  assert.deepEqual(kindsOf([['Näidis (§ 900 lg 1 ja 2 lapse puhul).', 'S8']]), only('a'));
});

test('kind a: the label of a passage the block cites, to the subsection its run holds, under any of that act\'s own names', () => {
  for (const text of ['Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 133 lg 7).', 'Fiktiivsete toetuste seaduse § 133 lg 7 järgi tehakse otsus kümne tööpäeva jooksul.',
    'Otsus tehakse kümne tööpäeva jooksul (§ 133 lg 7).', 'The decision is made in ten working days (Fictional Benefits Act (Fiktiivsete toetuste seadus) § 133(7)).',
    'Решение принимается за десять рабочих дней (Закон (Fiktiivsete toetuste seadus) § 133 ч. 7).']) assert.deepEqual(kindsOf([[text, 'S3']]), only('a'), text);
  // The section alone, a raised digit, and the abbreviation Riigi Teataja gives the law, with a case ending or without.
  assert.deepEqual(kindsOf([['Kulud arvatakse maha (§ 133).', 'S1']]), only('a'));
  assert.deepEqual(kindsOf([['Erand (fiktiivsete toetuste seaduse § 13¹).', 'S11']]), only('a'));
  for (const text of ['Näidis (SHS § 900 lg 2).', 'Näidis (SHSi § 900 lg 2 järgi).', 'Näidis (SHS-i § 900 lg 2).', 'Näidis (sotsiaalhoolekande seaduse (SHS) § 900 lg 1).', 'Sotsiaalhoolekande seaduse § 900 lg 1 ja lg 2 järgi.',
    'Example (Social Welfare Act (Sotsiaalhoolekande seadus, SHS) § 900(2)).', 'Näidis (seaduse § 900 lg 2).', 'Näidis (käesoleva seaduse § 900).', 'Näidis (kehtiva seaduse § 900 lg 1).'])
    assert.equal(check([[text, 'S8']]).audit.kinds.a, check([[text, 'S8']]).audit.mentions, text);
  // A law of the evidence whose last word is joined or split otherwise than in its title is that law (first review:
  // "sotsiaalhoolekandeseaduse" was read as a one-word law the evidence does not hold, kind d).
  assert.deepEqual(kindsOf([['Näidis (sotsiaalhoolekandeseaduse § 900 lg 2).', 'S8']]), only('a'));
  assert.deepEqual(kindsOf([['Fiktiivsete toetusteseaduse § 133 lg 7 järgi tehakse otsus.', 'S3']]), only('a'));
  const child = { evidence: [entry('k1', 'Lastekaitseseadus', '(1)\nNäidistekst.', { section: '901', subsections: ['1'] })], reference_map: { S1: { evidence_id: 'k1' } } };
  for (const text of ['Näidis (lastekaitseseaduse § 901 lg 1).', 'Näidis (lastekaitse seaduse § 901 lg 1).', 'Näidis (LasteKS § 901 lg 1).']) assert.deepEqual(check([[text, 'S1']], { of: child }).audit.items, [], text);
  // A regulation by who gave it: the municipality, its council or government, and the title in quotation marks or in
  // the genitive; a minister's regulation by the minister.
  for (const text of ['Piirmäär on 100 eurot (Näidise valla määruse § 3 lg 1).', 'Piirmäär (Näidise Vallavolikogu määruse § 3 lg 1).', 'Piirmäär (Näidise vallavalitsuse määruse § 3 lg 1).',
    'Piirmäär (Näidise valla määruse „Fiktiivse toetuse andmise kord“ § 3 lg 1).', 'Piirmäär (fiktiivse toetuse andmise korra § 3 lg 1).']) assert.deepEqual(kindsOf([[text, 'S4']]), only('a'), text);
  assert.deepEqual(kindsOf([['Teenust osutab koolitatud isik (näidisministri määruse „Fiktiivse teenuse nõuded“ § 4 lg 1).', 'S13']]), only('a'));
  // A plain digit where the act has a raised one is another section.
  assert.deepEqual(kindsOf([['Erand (§ 131).', 'S11']]), only('d'));
});

test('a list or a range that rests on two cited passages is supported by both', () => {
  // "§ 133 lg 5–7": lg 5–6 stand in S2 and lg 7 in S3.
  assert.deepEqual(kindsOf([['Kulud ja otsus (fiktiivsete toetuste seaduse § 133 lg 5–7).', 'S2', 'S3']]), only('a', 2));
  assert.deepEqual(kindsOf([['Kulud (fiktiivsete toetuste seaduse § 133 lõigete 2 ja 6 järgi).', 'S1', 'S2']]), only('a', 2));
  // With only one of the two cited, the other subsection is of the evidence but not of the block (c).
  assert.deepEqual(kindsOf([['Kulud ja otsus (§ 133 lg 5–7).', 'S2']]), { ...zero, a: 1, c: 1 });
});

test('an act is its title, issuer and municipality: another municipality\'s passage of the same title and number is not that provision', () => {
  // The named municipality's passage is in the evidence but the block cites the other's: counted as a collision.
  const other = check([['Piirmäär on 250 eurot (Näidise valla määruse § 3 lg 1).', 'S5']]);
  assert.deepEqual([other.audit.kinds, other.audit.collisions, other.refused], [only('c'), 1, null]);
  assert.deepEqual(other.audit.items, [{ at: '$.blocks[0].text', provision: '§ 3 lg 1', kind: 'c', act: 'named', collision: true }]);
  // A municipality of which the evidence holds no act at all: not shown, so the cited passage's number is not its provision.
  const absent = { ...packet, evidence: evidence.filter(item => item.evidence_id !== 'e4') };
  for (const text of ['Piirmäär on 250 eurot (Rae valla määruse § 3 lg 1).', 'Piirmäär (Rae Vallavolikogu määruse § 3 lg 1).', 'Piirmäär (Tallinna linna määruse § 3 lg 1).', 'Piirmäär (Tartu Linnavalitsuse määruse § 3 lg 1).'])
    assert.deepEqual(kindsOf([[text, 'S5']], { of: absent }), only('d'), text);
  // Each under its own name is its own label.
  assert.deepEqual(kindsOf([['Näidise valla määruse § 3 lg 1 järgi 100 eurot, Teise valla määruse § 3 lg 1 järgi 250 eurot.', 'S4', 'S5']]), only('a', 2));
  // Words that only look like an issuer name no municipality: the mention is compared with every act.
  for (const text of ['Sinu valla määruse § 3 lg 1 järgi on piirmäär 250 eurot.', 'Selle valla määruse § 3 lg 1 järgi on piirmäär 250 eurot.', 'Piirmäär (Kolmanda valla määruse § 3 lg 1).'])
    assert.deepEqual(kindsOf([[text, 'S5']], { of: absent }), only('a'), text);
  // A city whose name stands without "linn" is named in the genitive.
  const capital = { evidence: [entry('t1', RULE, '§ 3.\nPiirmäärad\n(1)\nPiirmäär on 300 eurot.', { section: '3', subsections: ['1'] }, issued('Tallinn', 'Tallinna Linnavolikogu')), evidence[4]],
    reference_map: { S1: { evidence_id: 't1' }, S2: { evidence_id: 'e5' } } };
  for (const text of ['Piirmäär (Tallinna määruse § 3 lg 1).', 'Piirmäär (Tallinna linna määruse § 3 lg 1).', 'Piirmäär (Tallinna Linnavolikogu määruse § 3 lg 1).', 'Tallinnas kehtiva määruse § 3 lg 1 järgi on piirmäär 300 eurot.']) {
    assert.deepEqual(kindsOf([[text, 'S1']], { of: capital }), only('a'), text);
    assert.deepEqual(kindsOf([[text, 'S2']], { of: capital }), only('c'), text);
  }
  // First review, 10.10.2026: the municipality named otherwise than directly before "määruse" named no act, so the
  // other municipality's passage of the same title and number was kind a. It is the named municipality's uncited
  // passage (c) beside the cited one of the same number (collision).
  for (const text of ['Piirmäär on 250 eurot (Näidise valla fiktiivse toetuse andmise korra § 3 lg 1).', 'Näidise vallas kehtiva määruse § 3 lg 1 järgi on piirmäär 250 eurot.', 'Piirmäär (Näidise Vallavolikogu kehtestatud korra § 3 lg 1).']) {
    const named = check([[text, 'S5']]);
    assert.deepEqual([named.audit.kinds, named.audit.collisions, named.audit.items[0].act], [only('c'), 1, 'named'], text);
    assert.deepEqual(kindsOf([[text, 'S4']]), only('a'), text);
  }
  // A municipality the evidence holds no act of, named so: not shown.
  for (const text of ['Rae vallas kehtiva korra § 3 lg 1 järgi on piirmäär 250 eurot.', 'Piirmäär (Tartu linna sotsiaaltoetuste määruse § 3 lg 1).']) assert.deepEqual(kindsOf([[text, 'S5']], { of: absent }), only('d'), text);
  // Pinned, the milder reading: a finite verb or a mark between says where something holds, not whose act it is.
  for (const text of ['Näidise vallas kehtib määruse § 3 lg 1 järgi piirmäär 250 eurot.', 'Näidise vallas, nagu mujalgi, on korra § 3 lg 1 järgi piirmäär 250 eurot.']) assert.deepEqual(kindsOf([[text, 'S5']]), only('a'), text);
});

// First review, 10.10.2026 (a blocker): the title in quotation marks was dropped, so of two acts of one issuer the
// other act's passage with the same number was kind a. 96 of the 128 issuers in the index have two or more acts.
test('two acts of one issuer: the title in quotation marks picks the act', () => {
  const cited = (text, ...refs) => check([[text, ...refs]], { of: wide });
  // Each act under its own quoted title is its own label.
  assert.deepEqual(cited('Piirmäär on 100 eurot (Näidise valla määruse „Fiktiivse toetuse andmise kord“ § 3 lg 1).', 'S4').audit.kinds, only('a'));
  assert.deepEqual(cited('Üüri piirmäär (Näidise valla määruse „Fiktiivsete piirmäärade kehtestamine“ § 3 lg 2).', 'S18').audit.kinds, only('a'));
  assert.deepEqual(cited('Üüri piirmäär (Näidise Vallavolikogu määruse "Fiktiivsete piirmäärade kehtestamine" § 3 lg 2).', 'S18').audit.kinds, only('a'));
  // The other act of the same issuer with the same number: the named act's passage is of the evidence, not of the block.
  const crossed = cited('Üüri piirmäär (Näidise valla määruse „Fiktiivsete piirmäärade kehtestamine“ § 3 lg 1).', 'S4');
  assert.deepEqual([crossed.audit.kinds, crossed.audit.collisions], [only('c'), 1]);
  // A number the named act lacks is nothing's, though the cited act of the same issuer has it.
  assert.deepEqual(cited('Piirmäär (Näidise valla määruse „Fiktiivse toetuse andmise kord“ § 3 lg 3).', 'S18').audit.kinds, only('d'));
  // Without the title the issuer's name is every act of the issuer.
  assert.deepEqual(cited('Piirmäär (Näidise valla määruse § 3 lg 3).', 'S18').audit.kinds, only('a'));
  // A title alone, without the issuer, is the acts of that title.
  assert.deepEqual(cited('Üüri piirmäär (määruse „Fiktiivsete piirmäärade kehtestamine“ § 3 lg 2).', 'S18').audit.kinds, only('a'));
  assert.deepEqual(cited('Üüri piirmäär (määruse „Fiktiivsete piirmäärade kehtestamine“ § 3 lg 1).', 'S5').audit.kinds, only('c'));
  // Pinned, the milder reading: a title that is none of the issuer's acts here changes nothing (it may be shortened).
  assert.deepEqual(cited('Piirmäär (Näidise valla määruse „Toetuste kord“ § 3 lg 1).', 'S4').audit.kinds, only('a'));
});

test('an act the evidence does not hold: a law of the corpus, its abbreviation, a one-word law, an unknown abbreviation; a pointer in a cited text still gives it', () => {
  // Each over the number of the cited regulation's label (§ 3 lg 1): the number is there, the act is not.
  for (const text of ['Piirmäär on 100 eurot (perekonnaseaduse § 3 lg 1).', 'Piirmäär (PKS § 3 lg 1).', 'Piirmäär (PKS-i § 3 lg 1).', 'Piirmäär (liiklusseaduse § 3 lg 1).', 'Piirmäär (XYZS § 3 lg 1).', 'Piirmäär (KOKS § 3 lg 1).', 'Piirmäär (perekonna seaduse § 3 lg 1).',
    'Limit (Family Law Act (Perekonnaseadus) § 3(1)).', 'Piirmäär (perekonnaseaduse (PKS) § 3 lg 1).', 'Piirmäär (fiktiivsete toetuste seaduse § 3 lg 1).']) {
    const result = check([[text, 'S4']]);
    // Kind d, and published: nothing is refused unless a list says so.
    assert.deepEqual([result.audit.kinds, result.refused, check([[text, 'S4']], { refuse: ['d'] }).refused?.provision], [only('d'), null, '§ 3 lg 1'], text);
  }
  assert.deepEqual(check([['Piirmäär (PKS § 3 lg 1).', 'S4']]).audit.items, [{ at: '$.blocks[0].text', provision: '§ 3 lg 1', kind: 'd', act: 'not_shown' }]);
  // The regulation's own text points at that law (ADR-064): the pointer is written in a cited passage.
  assert.deepEqual(kindsOf([['Vt ka perekonnaseaduse § 25 lg 2.', 'S4']]), only('b'));
  assert.deepEqual(kindsOf([['Vt ka PKS § 25 lg 2.', 'S4']]), only('b'));
  // The regulation's name over the law's label is not that provision either.
  assert.deepEqual(kindsOf([['Otsus tehakse kümne tööpäeva jooksul (Näidise valla määruse § 133 lg 7).', 'S3']]), only('d'));
  // An abbreviation that is not shaped as a law's names no act: "KOV" is the municipality, not an act.
  assert.deepEqual(kindsOf([['Piirmäära kehtestab KOV § 3 lg 1 alusel.', 'S4']]), only('a'));
  // First review, 10.10.2026: a company's "AS" and an all-capitals heading were taken for unknown law abbreviations.
  assert.deepEqual(kindsOf([['ÕIGUSLIK ALUS § 133 lg 7.', 'S3']]), only('a'));
  assert.deepEqual(kindsOf([['Teenust osutab Näidis AS § 133 lg 7 alusel.', 'S3']]), only('a'));
  assert.deepEqual(kindsOf([['Otsus (KOKS § 133 lg 7).', 'S3']]), only('d'));
  // The remaining gap, pinned: a law of several words that the corpus does not hold is not recognised as an act.
  assert.deepEqual(kindsOf([['Piirmäär (olematu abi seaduse § 3 lg 1).', 'S4']]), only('a'));
});

test('kind b: written in the cited passage itself: a pointer, its own heading and subsection marks, the act\'s own dates, a range', () => {
  assert.deepEqual(kindsOf([['Neid kulusid, mida nimetab § 140 lg 2, ei arvestata.', 'S2']]), only('b'));
  assert.deepEqual(kindsOf([['Otsus tehakse 30 päeva jooksul (§ 7 lg 2).', 'S9']]), only('b'));
  assert.deepEqual(kindsOf([['Taotlus esitatakse kirjalikult (§ 7).', 'S9']]), only('b'));
  assert.deepEqual(kindsOf([['Teade on kirjalik (fiktiivsete toetuste seaduse § 20 lg 4).', 'S10']]), only('b'));
  assert.deepEqual(kindsOf([['Määrust rakendatakse 1. maist (Näidise valla määruse § 9 lg 1).', 'S4']]), only('b'));
  // A range in the passage's text gives what lies between its ends.
  assert.deepEqual(kindsOf([['Tagasiulatuvalt kohaldatakse § 106 ja § 150 lg 3.', 'S12']]), only('b', 2));
  assert.deepEqual(kindsOf([['Tagasiulatuvalt kohaldatakse § 108.', 'S12']]), only('d'));
  // The mark must stand in the passage: S1 has "(2)", not "(3)"; S10 has no "(2)".
  assert.deepEqual(kindsOf([['Kulud (§ 133 lg 3).', 'S1']]), only('d'));
  assert.deepEqual(kindsOf([['Teade (§ 20 lg 2).', 'S10']]), only('d'));
  // A paragraph that only a cited guide mentions is that guide's reference: kind b, counted apart and marked.
  const borrowed = check([['Toetust saab taotleda vallast (§ 200).', 'S7'], ['Neid kulusid ei arvestata (§ 140 lg 2).', 'S2']]).audit;
  assert.deepEqual([borrowed.kinds.b, borrowed.from_other_sources, borrowed.items], [2, 1, [{ at: '$.blocks[0].text', provision: '§ 200', kind: 'b', act: 'unnamed', source: 'not_an_act' }, { at: '$.blocks[1].text', provision: '§ 140 lg 2', kind: 'b', act: 'unnamed' }]]);
});

// Both reviews of 10.10.2026 (a blocker): a passage labelled "§ 134 lg 4–5" says "käesoleva paragrahvi lõikes 2", the
// instruction has the answer write "§ 134 lg 2", and that was kind d: 44 of 209 such pointers in seven real acts.
test('a pointer inside the passage\'s own section is that section\'s provision, under its own act\'s name or none', () => {
  const cited = text => kindsOf([[text, 'S14']], { of: wide });
  for (const text of ['Taotluse, mida nimetab fiktiivsete toetuste seaduse § 134 lg 2, vaatab läbi vald (fiktiivsete toetuste seaduse § 134 lg 4).', 'Taotluse (§ 134 lg 2) vaatab läbi vald (§ 134 lg 4).']) assert.deepEqual(cited(text), { ...zero, a: 1, b: 1 }, text);
  // A bare "Lõigetes 1–3" at a sentence's start: the range gives its ends and what lies between.
  assert.deepEqual(cited('Tähtaegu ei pikendata (fiktiivsete toetuste seaduse § 134 lg 1–3).'), only('b', 2));
  assert.deepEqual(cited('Tähtaegu ei pikendata (§ 134 lg 2 ja 5).'), { ...zero, a: 1, b: 1 });
  // It is the passage's own act's provision and no other's; a subsection the text does not point at is none.
  assert.deepEqual(cited('Taotluse vaatab läbi vald (fiktiivse kaitse seaduse § 134 lg 2).'), only('d'));
  assert.deepEqual(cited('Taotluse vaatab läbi vald (§ 134 lg 6).'), only('d'));
  // "Eelmise paragrahvi lõikes 9" is another section's subsection: not this one's.
  assert.deepEqual(cited('Seda ei kohaldata (§ 134 lg 9).'), only('d'));
  // A source that is no act has no section of its own: its bare "lõikes" gives nothing.
  const guide = { evidence: [entry('g1', GUIDE, 'Juhendi järgi vaata lõikes 2 nimetatud taotlust.')], reference_map: { S1: { evidence_id: 'g1' } } };
  assert.deepEqual(kindsOf([['Taotlus (§ 134 lg 2).', 'S1']], { of: guide }), only('d'));
});

test('a pointer a text marks as its own act\'s is that act\'s provision only; one it gives another act is never the passage\'s own act\'s', () => {
  // S6 (another law) says "käesoleva seaduse § 9 lõikes 2".
  assert.deepEqual(kindsOf([['Kaitset saab isik (fiktiivse kaitse seaduse § 9 lg 2).', 'S6']]), only('b'));
  assert.deepEqual(kindsOf([['Kaitset saab isik (§ 9 lg 2).', 'S6']]), only('b'));
  assert.deepEqual(kindsOf([['Kaitset saab isik (fiktiivsete toetuste seaduse § 9 lg 2).', 'S6']]), only('d'));
  assert.deepEqual(kindsOf([['Kaitset saab isik (PKS § 9 lg 2).', 'S6']]), only('d'));
  // The provision an act's own dates name is that act's too.
  assert.deepEqual(kindsOf([['Rakendatakse 1. maist (fiktiivsete toetuste seaduse § 9 lg 1).', 'S4']]), only('d'));
  // First review, 10.10.2026: S16, a passage of one law, says "fiktiivse kaitse seaduse §-de 131 ja 132 kohaselt". Under
  // its own law's name that was kind b, though the law may have a § 132 of its own. It is the other law's, or no name's.
  const cited = (text, ref) => kindsOf([[text, ref]], { of: wide });
  assert.deepEqual(cited('Maha arvatakse fiktiivsete toetuste seaduse § 132 alusel kinni peetud summad.', 'S16'), only('d'));
  assert.deepEqual(cited('Maha arvatakse fiktiivse kaitse seaduse § 132 alusel kinni peetud summad.', 'S16'), only('b'));
  assert.deepEqual(cited('Maha arvatakse kinni peetud summad (§ 131 ja § 132).', 'S16'), only('b', 2));
  // A guide says "vt SHS § 131 lõike 1": the pointer is the Social Welfare Act's, under either of its names, and not
  // another law's. The regulation of S4 points at the Family Law Act, by its name and by its abbreviation one act.
  const guide = check([['Vt selgitust (sotsiaalhoolekande seaduse § 131 lg 1).', 'S17']], { of: wide }).audit;
  assert.deepEqual([guide.kinds, guide.from_other_sources], [only('b'), 1]);
  assert.deepEqual(cited('Vt selgitust (SHS § 131 lg 1).', 'S17'), only('b'));
  assert.deepEqual(cited('Vt selgitust (perekonnaseaduse § 131 lg 1).', 'S17'), only('d'));
  assert.deepEqual(cited('Vt selgitust (fiktiivse kaitse seaduse § 131 lg 1).', 'S17'), only('d'));
  assert.deepEqual(cited('Vt ka sotsiaalhoolekande seaduse § 25 lg 2.', 'S4'), only('d'));
  assert.deepEqual(cited('Vt ka Näidise valla määruse § 25 lg 2.', 'S4'), only('d'));
});

test('kinds c, v, s and p: another passage of the evidence, the version comparison, elsewhere in what the model was shown, the published answer', () => {
  assert.deepEqual(kindsOf([['Kulud arvatakse maha (§ 133 lg 6).', 'S1']]), only('c'));
  assert.deepEqual(kindsOf([['Piirmäär on 100 eurot (§ 3 lg 1).', 'S1']]), only('c'));
  assert.deepEqual(kindsOf([['Muutub ka § 170 lg 3 ja lisandub § 172 lg 1.', 'S1']]), only('v', 2));
  // The comparison names provisions, it does not point at more: a subsection it does not list is none of its.
  assert.deepEqual(kindsOf([['Muutub ka § 170 lg 4.', 'S1']]), only('d'));
  // A record's field and a dependency note: written in what the model was shown, outside the excerpts.
  assert.deepEqual(kindsOf([['Teenuse alus on § 17 lg 2, vt ka § 141 lg 2.', 'S7']]), only('s', 2));
  // The excerpts' own labels are not read a second time without their act: the label "§ 3" of S4 in the model's
  // context does not make another act's § 3 lg 1 supported (see the test above), and without the context nothing changes.
  const { model_context: _context, ...bare } = packet;
  assert.deepEqual(kindsOf([['Teenuse alus on § 17 lg 2.', 'S7']], { of: bare }), only('d'));
  assert.deepEqual(kindsOf([['Piirmäär (PKS § 3 lg 1).', 'S4']], { of: bare }), only('d'));
  // The published answer the dialogue shows named it in a block: kind p, also inside a block. Not checked again here.
  assert.deepEqual(kindsOf([['Seda ütleb fiktiivsete toetuste seaduse § 145 lg 2.', 'S1']], { said: ['Mis lõige seda täpselt ütleb?'], published: ['Kulusid ei arvestata (fiktiivsete toetuste seaduse § 145 lg 2).'] }), only('p'));
});

test('a provision the user named and nothing gives: kind d inside a block, kind q in a limitation or the clarification', () => {
  const said = ['Mida ütleb fiktiivsete toetuste seaduse § 999 lg 1?'], stating = [['Fiktiivsete toetuste seaduse § 999 lg 1 järgi makstakse toetust 500 eurot.', 'S1']];
  // Stated inside a block it is kind d: published and recorded, and refused only where a list says so.
  const stated = check(stating, { said });
  assert.deepEqual([stated.audit.kinds, stated.refused], [only('d'), null]);
  assert.deepEqual(check(stating, { said, refuse: ['d'] }).refused, { path: '$.blocks[0].text', text: 'Fiktiivsete toetuste seaduse § 999 lg 1 järgi makstakse toetust 500 eurot.', provision: '§ 999 lg 1' });
  // In a limitation or the clarification it says only that its text is not at hand.
  const limited = check([['Kulud arvatakse maha.', 'S1']], { said, limitations: ['Mul ei ole siin § 999 lg 1 teksti.'], clarification: 'Kas pead silmas § 999 lg 1?', refuse: ['d'] });
  assert.deepEqual([limited.audit.kinds, limited.audit.outside_blocks, limited.refused], [only('q', 2), 2, null]);
  // A block that only repeats the asked provision beside a supported one is kind d too.
  assert.deepEqual(kindsOf([['Sa küsisid § 999 lg 1 kohta. Kulud arvatakse maha (§ 133 lg 2).', 'S1']], { said }), { ...zero, a: 1, d: 1 });
  // The earlier answer's limitation repeated the user's provision; that makes it no provision of a later block.
  assert.deepEqual(kindsOf([['Selle kohta käib § 999 lg 1.', 'S1']], { said: [...said, 'Aga mida see siis ütleb?'], published: ['Kulud arvatakse maha (§ 133 lg 2).'] }), only('d'));
  // Outside a block nothing is cited: a provision there is of the evidence at most (c), the user's (q), or none (d).
  assert.deepEqual(kindsOf([['Kulud arvatakse maha.', 'S1']], { clarification: 'Kas küsid § 133 lõike 6 kohta?' }), only('c'));
  assert.deepEqual(kindsOf([['Kulud arvatakse maha.', 'S1']], { limitations: ['Täpsemalt reguleerib seda § 500.'] }), only('d'));
  // Both reviews of 10.10.2026 (a blocker): the instruction asks for exactly this limitation, and it was kind d for
  // every user who did not write the provision with "§". The section's number as a number of its own is enough.
  const honest = [['Mida ütleb SHS 950 lg 9?', 'Sotsiaalhoolekande seaduse § 950 lg 9 teksti mul siin ei ole.'], ['mida ütleb shs par 950 lõige 9', 'Sotsiaalhoolekande seaduse § 950 lg 9 teksti mul siin ei ole.'],
    ['What does section 950(9) of the Social Welfare Act say?', 'I do not have the text of § 950(9) of the Social Welfare Act (Sotsiaalhoolekande seadus).'], ['What does sec. 950(9) say?', 'I do not have the text of § 950(9).'],
    ['What does section 950 subsection 9 say?', 'I do not have the text of § 950(9).'], ['Что говорит часть 9 статьи 950 Закона о социальном обеспечении?', 'У меня нет текста § 950 ч. 9.'], ['Что говорит параграф 950 часть 9?', 'У меня нет текста § 950 ч. 9.'],
    ['Mida ütleb sotsiaalhoolekande seaduse 950. paragrahvi 9. lõige?', 'Mul ei ole siin sotsiaalhoolekande seaduse § 950 lg 9 teksti.'], ['Mida ütleb SHS § 950 lõige üheksa?', 'Mul ei ole siin sotsiaalhoolekande seaduse § 950 lg 9 teksti.'],
    ['Mida ütleb § 13^1 lõige 2?', 'Mul ei ole siin § 13¹ lg 2 teksti.']];
  for (const [question, limitation] of honest) assert.deepEqual(kindsOf([['Näidistekst.', 'S8']], { said: [question], limitations: [limitation] }), only('q'), question);
  assert.deepEqual(kindsOf([['Näidistekst.', 'S8']], { said: ['mida ütleb shs 950?'], clarification: 'Kas pead silmas sotsiaalhoolekande seaduse § 950?' }), only('q'));
  // Not the user's: the digits as part of a longer number, of a sum with a fraction, or of another raised number.
  for (const question of ['Mul on 9500 eurot võlga ja 1950 eurot sissetulekut.', 'Sain 950,50 eurot.', 'Mida ütleb § 950¹?']) assert.deepEqual(kindsOf([['Näidistekst.', 'S8']], { said: [question], limitations: ['Mul ei ole siin § 950 lg 9 teksti.'] }), only('d'), question);
  // And never inside a block, however the user wrote it.
  assert.deepEqual(kindsOf([['Sotsiaalhoolekande seaduse § 950 lg 9 järgi makstakse toetust.', 'S8']], { said: ['Mida ütleb SHS 950 lg 9?'] }), only('d'));
});

// What a passage gives is found here by patterns of this test's own, not by the reader under test (first review's
// note, 10.10.2026: read by the same reader, a form the reader does not read could never fail this test).
test('no kind d comes from a provision that a cited passage\'s label or text gives, under no name or any of the names of the act it is', () => {
  const names = { [LAW]: ['fiktiivsete toetuste seaduse ', 'Fiktiivsete toetuste seaduse ', '(Fiktiivsete toetuste seadus) '], [SHS]: ['sotsiaalhoolekande seaduse ', 'sotsiaalhoolekandeseaduse ', 'SHS ', 'SHSi ', 'SHS-i ', 'sotsiaalhoolekande seaduse (SHS) '],
    [OTHER_LAW]: ['fiktiivse kaitse seaduse '], [RULE]: [], [GUIDE]: [], 'Fiktiivne teine juhend': [], 'Fiktiivne vana kord': [], 'Fiktiivse teenuse nõuded': ['näidisministri määruse ', 'Näidisministri määruse „Fiktiivse teenuse nõuded“ '],
    [BUDGET]: ['2031. aasta fiktiivse eelarve seaduse '], [LIMITS]: [] };
  const issuers = { e4: ['Näidise valla määruse ', 'Näidise Vallavolikogu määruse ', 'Näidise vallavalitsuse määruse ', 'Näidise valla määruse „Fiktiivse toetuse andmise kord“ ', 'Näidise vallas kehtiva määruse '], e5: ['Teise valla määruse ', 'Teise Vallavalitsuse määruse '],
    x5: ['Näidise valla määruse ', 'Näidise valla määruse „Fiktiivsete piirmäärade kehtestamine“ '] };
  // The names of the other acts the texts point at.
  const pointed = { perekonnaseaduse: ['perekonnaseaduse ', 'PKS '], 'fiktiivse kaitse seaduse': names[OTHER_LAW], SHS: ['SHS ', 'sotsiaalhoolekande seaduse '] };
  const span = (from, to) => Array.from({ length: (to ? Number(to) : Number(from)) - Number(from) + 1 }, (_, at) => String(Number(from) + at));
  let checked = 0;
  for (const [at, item] of wide.evidence.entries()) {
    const text = item.source_text, own = [...names[item.bibliography.title], ...(issuers[item.evidence_id] ?? [])], given = [];
    const give = (provisions, under) => { for (const provision of provisions) given.push([provision, ['', ...under]]); };
    // Its own section: the label, or the heading its text begins with; each subsection of the label and each "(n)" mark.
    const section = item.legal_place?.section ?? /^§\s*(\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*)\./u.exec(text)?.[1];
    if (section) give([`§ ${section}`, ...[...new Set([...(item.legal_place?.subsections ?? []), ...[...text.matchAll(/(?:^|\n|\s)\((\d+)\)/gu)].map(mark => mark[1])])].map(subsection => `§ ${section} lg ${subsection}`)], own);
    // The provisions its act's dates name are its own act's.
    give((item.legal_dates?.act?.entry_into_force ?? []).map(rule => rule.provision), own);
    // A pointer at a section mark or at the word, with what it lists: "§ 140 lõikes 2", "§-de 131 ja 132",
    // "Paragrahvides 105–107", "§ 150 lõigetes 2–4". Whose it is, by the words before it.
    // A number with a raised digit ("§ 13¹") is another section than the number without it: this plain pattern leaves
    // such a mark alone rather than read "§ 13" out of it (fit review, 10.10.2026).
    for (const pointer of text.matchAll(/(?:§(?:-\p{L}+)?|[Pp]aragrahvides)\s*(\d+)(?![\d⁰¹²³⁴⁵⁶⁷⁸⁹])(?:\s*(ja|–)\s*(\d+)(?![\d⁰¹²³⁴⁵⁶⁷⁸⁹]))?(?!\.\n)(?:\s+lõi\p{L}+\s+(\d+)(?:–(\d+))?)?/gu)) {
      const [, first, joined, second, lower, upper] = pointer, before = text.slice(0, pointer.index).trimEnd();
      if (pointer.index === 0 && /^§\s*\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*\./u.test(text)) continue;
      const sections = joined === '–' ? span(first, second) : [first, ...(second ? [second] : [])];
      const provisions = sections.flatMap(number => (lower ? span(lower, upper).map(subsection => `§ ${number} lg ${subsection}`) : [`§ ${number}`]));
      const other = Object.keys(pointed).find(name => before.endsWith(name));
      give(provisions, /[Kk]äesoleva (?:seaduse|määruse|korra)$/u.test(before) ? own : other ? pointed[other] : /(?:seaduse|seadustiku|määruse)$/u.test(before) ? [] : own);
    }
    // A pointer inside its own section: "käesoleva paragrahvi lõikes 2", a bare "Lõigetes 1–3".
    if (section) for (const pointer of text.matchAll(/(?<!\d\s)(?<![Ee]elmise paragrahvi\s)[Ll]õi(?:kes|getes)\s+(\d+)(?:–(\d+))?/gu)) give(span(pointer[1], pointer[2]).map(subsection => `§ ${section} lg ${subsection}`), own);
    for (const [provision, under] of given) for (const name of under) {
      const result = check([[`Väide (${name}${provision}).`, `S${at + 1}`]], { of: wide });
      assert.deepEqual([result.audit.kinds.d, result.audit.kinds.a + result.audit.kinds.b], [0, 1], `S${at + 1} ${name}${provision}`);
      checked++;
    }
  }
  assert(checked > 150, String(checked));
});

// The maintainer's fourth decision (10.10.2026): what the instruction text and the check end up saying must agree.
// Every form the instruction writes out is filled with an act and a number of the evidence and given to the check; a
// form added to the instruction with a placeholder this test does not know fails here until it is shown to be read.
test('every form the answer instructions allow is read by the check and gets a kind other than d', () => {
  const law = { '<akti nimi omastavas>': 'sotsiaalhoolekande seaduse', '<Akti nimi omastavas>': 'Sotsiaalhoolekande seaduse', '<lühend>': 'SHS', '<abbreviation>': 'SHS', '<English name>': 'Social Welfare Act', '<Estonian title>': SHS,
    '<название акта>': 'Закон о социальном обеспечении', '<N>': '900', '<M>': '2', '<A>': '1', '<B>': '2' }, lawRef = 'S8';
  const local = { '<valla või linna nimi omastavas>': 'Näidise valla', '<andja nimi omastavas>': 'Näidise valla', '<pealkiri>': RULE, '<municipality_name>': 'Näidise vald', '<Estonian title>': RULE, '<N>': '3', '<M>': '1' }, localRef = 'S4';
  const fill = (form, values) => form.replace(/<[^<>]+>/gu, mark => values[mark] ?? mark).replace(/\s*\.\.\.$/u, ' on see nii.');
  let forms = 0;
  for (const language of ['et', 'en', 'ru']) {
    // The forms of the language, and those the section itself writes out for a label ("§ <N> lg <A>–<B>", "§ <N>").
    const written = [...`${PROVISION_FORM[language]} ${legalProvisionInstructions(language).replace(PROVISION_FORM[language], '')}`.matchAll(/"([^"]*§[^"]*)"/gu)].map(found => found[1]);
    assert.ok(written.length >= (language === 'et' ? 9 : 8), `${language} ${written.length}`);
    for (const form of written) {
      const municipal = /<valla|<andja|<municipality_name>/u.test(form), text = fill(form, municipal ? local : law);
      assert.doesNotMatch(text, /<[^<>]+>/u, `${language}: a placeholder this test does not fill: ${form}`);
      const result = check([[`Väide ${text}`, municipal ? localRef : lawRef]], { of: wide });
      // A form names one provision, or the two ends of a run: each is the cited passage's label, and nothing is unread.
      assert.deepEqual([result.audit.mentions >= 1, result.audit.kinds.a, result.audit.word_forms, result.audit.bare_subsections, result.audit.items], [true, result.audit.mentions, 0, 0, []], `${language}: ${form} -> ${text}`);
      // In English and Russian the municipality tells two municipalities' acts of one title apart, as in Estonian.
      if (municipal) assert.deepEqual(check([[`Väide ${text}`, 'S5']], { of: wide }).audit.kinds, only('c'), `${language}: ${form} over the other municipality's passage`);
      forms++;
    }
  }
  assert.ok(forms >= 25, String(forms));
  // What the section allows in words, each as an answer would write it.
  const allowed = [
    // The provision field of an excerpt in the block's refs; a raised digit; the section alone; a run's two ends.
    ['a', 'Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 133 lg 7).', ['S3']], ['a', 'Erandit kohaldatakse taotluse alusel (fiktiivsete toetuste seaduse § 13¹).', ['S11']], ['a', 'Vald teavitab (fiktiivsete toetuste seaduse § 20).', ['S10']],
    ['a', 'Näidis (sotsiaalhoolekande seaduse § 900 lg 1–2).', ['S8']],
    // What a legal excerpt's own text writes out: its heading line, a subsection's number in brackets, a pointer
    // under the act the text names for it, a pointer of its own act.
    ['b', 'Taotlus esitatakse kirjalikult (§ 7).', ['S9']], ['b', 'Otsus tehakse 30 päeva jooksul (§ 7 lg 2).', ['S9']], ['b', 'Teade on kirjalik (fiktiivsete toetuste seaduse § 20 lg 4).', ['S10']],
    ['b', 'Vaata ka perekonnaseaduse § 25 lg 2.', ['S4']], ['b', 'Neid kulusid, mida nimetab fiktiivsete toetuste seaduse § 140 lg 2, ei arvestata.', ['S2']], ['b', 'Maha arvatakse fiktiivse kaitse seaduse § 132 alusel kinni peetud summad.', ['S16']],
    // A pointer inside the excerpt's own section, written with that section's number before the subsection's.
    ['b', 'Vald vaatab läbi taotluse, mida nimetab fiktiivsete toetuste seaduse § 134 lg 2.', ['S14']],
    // The provision the act_dates or amendments of an excerpt in the refs give for a date.
    ['b', 'Määrust rakendatakse 1. maist (Näidise valla määruse § 9 lg 1).', ['S4']],
    // A provision that version_changes lists: changed, the same, or under not_in_evidence.
    ['v', 'Muutub fiktiivsete toetuste seaduse § 170 lg 3.', ['S1']], ['v', 'Samaks jääb § 171, lisandub § 172 lg 1.', ['S1']],
    // The act's name: a municipality's regulation with its title to tell two acts apart, a minister's by issuer and title.
    ['a', 'Üüri piirmäär (Näidise valla määruse „Fiktiivsete piirmäärade kehtestamine“ § 3 lg 2).', ['S18']], ['a', 'Teenust osutab koolitatud isik (näidisministri määruse „Fiktiivse teenuse nõuded“ § 4 lg 1).', ['S13']],
    // The act with the first provision, then the provision alone; two acts in one sentence with a semicolon between.
    ['a', 'Toetust arvestatakse kuu kaupa (fiktiivsete toetuste seaduse § 133 lg 1). Kulud arvatakse maha (§ 133 lg 2).', ['S1']],
    ['a', 'Piir on 220 eurot (sotsiaalhoolekande seaduse § 900 lg 1; 2031. aasta fiktiivse eelarve seaduse § 2 lg 7).', ['S8', 'S15']], ['a', 'Piirmäär on 100 eurot (Näidise valla määruse § 3 lg 1; sotsiaalhoolekande seaduse § 900 lg 2).', ['S4', 'S8']],
    // An abbreviation after one full naming with it in brackets (a specialist's and a service provider's answer).
    ['a', 'Näidis (sotsiaalhoolekande seaduse (SHS) § 900 lg 1). Teine näidis (SHS § 900 lg 2).', ['S8']],
    // The provision in the sentence, and at its start when the user asks which provision says something.
    ['a', 'Otsus tehakse fiktiivsete toetuste seaduse § 133 lg 7 alusel kümne tööpäeva jooksul.', ['S3']], ['a', 'Fiktiivsete toetuste seaduse § 133 lg 7 järgi tehakse otsus kümne tööpäeva jooksul.', ['S3']],
  ];
  for (const [kind, text, refs] of allowed) { const result = check([[text, ...refs]], { of: wide }); assert.deepEqual([result.audit.kinds[kind], result.audit.kinds.d, result.audit.bare_subsections], [result.audit.mentions, 0, 0], text); }
  // In limitations and the clarification: the provision the user named, to say that its text is not at hand or to ask
  // which one is meant, and one that version_changes lists under not_in_evidence.
  const outside = [['q', { said: ['Mida ütleb sotsiaalhoolekande seaduse § 950 lg 9?'], limitations: ['Sotsiaalhoolekande seaduse § 950 lg 9 teksti mul siin ei ole.'] }],
    ['q', { said: ['What does section 950(9) of the Social Welfare Act say?'], limitations: ['I do not have the text of § 950(9) of the Social Welfare Act (Sotsiaalhoolekande seadus).'] }],
    ['q', { said: ['Что говорит часть 9 статьи 950?'], limitations: ['У меня нет текста § 950 ч. 9.'] }], ['q', { said: ['mida ütleb shs 950?'], clarification: 'Kas pead silmas sotsiaalhoolekande seaduse § 950?' }],
    ['v', { limitations: ['Muutub ka fiktiivsete toetuste seaduse § 172 lg 1, kuid selle sõnastust mul siin ei ole.'] }]];
  for (const [kind, options] of outside) assert.deepEqual(kindsOf([['Näidistekst.', 'S8']], { ...options, of: wide }), only(kind), JSON.stringify(options));
});

test('the audit keeps counts and the mentions to read by hand, without the answer\'s text; nothing is refused unless a list of kinds says so', () => {
  // The policy: no kind stops publication (the maintainer's decision, 10.10.2026). Changed on purpose from ['d'].
  assert.deepEqual([REFUSED_KINDS, PROVISION_KINDS, PROVISION_CHECK_VERSION], [[], ['a', 'b', 'c', 'v', 's', 'p', 'q', 'd'], 'rag-v2/provision-check-1']);
  const fine = check([['Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 133 lg 7).', 'S3'], ['Piirmäär on 100 eurot (§ 3 lg 1).', 'S1'], ['Üldine selgitus.', 'S7']]);
  assert.equal(fine.refused, null);
  assert.deepEqual(fine.audit, { version: PROVISION_CHECK_VERSION, labelled: 11, mentions: 2, blocks_naming: 2, kinds: { ...zero, a: 1, c: 1 }, outside_blocks: 0, act_named: 1, act_not_shown: 0, from_other_sources: 0, collisions: 0,
    after_other_act: 1, word_forms: 0, bare_subsections: 0, items: [{ at: '$.blocks[1].text', provision: '§ 3 lg 1', kind: 'c', act: 'unnamed', after_other_act: true }] });
  // What the reader does not read is counted: a subsection without its section, and English "section N".
  const unread = check([['Kulud arvatakse maha (§ 133 lg 2). Sama paragrahvi lõike 9 järgi tehakse otsus kohe. Seda ütleb lõige 4.', 'S1'], ['See on kirjas vormi section 3 all.', 'S7']]).audit;
  assert.deepEqual([unread.mentions, unread.kinds.a, unread.bare_subsections, unread.word_forms], [1, 1, 2, 1]);
  assert.equal(check([['Kulud (§ 133 lg 1 ja lg 2; § 133(2)).', 'S1']]).audit.bare_subsections, 0);
  const none = check([['Üldine selgitus ilma sätteta.', 'S7']]);
  assert.deepEqual([none.refused, none.audit.mentions, none.audit.blocks_naming, none.audit.items], [null, 0, 0, []]);
  // An answer with 26 provisions that nothing gives is classified and not refused; the audit counts every mention and lists at most 20.
  const blocks = [['Kulud arvatakse maha (§ 133 lg 2).', 'S1'], ['Vald peab aitama (fiktiivsete toetuste seaduse § 16 lg 1).', 'S2'], [Array.from({ length: 25 }, (_, at) => `§ ${700 + at}`).join('; '), 'S1']];
  const published = check(blocks);
  assert.deepEqual([published.refused, published.audit.kinds.d, published.audit.items.length, JSON.stringify(published.audit).includes('Vald peab')], [null, 26, 20, false]);
  // THE REFUSAL PATH, kept behind the list: with kind d in it, the first part that names such a provision is named,
  // and the audit is the same.
  const bad = check(blocks, { refuse: ['d'] });
  assert.deepEqual(bad.refused, { path: '$.blocks[1].text', text: 'Vald peab aitama (fiktiivsete toetuste seaduse § 16 lg 1).', provision: '§ 16 lg 1' });
  assert.deepEqual(bad.audit, published.audit);
  assert.deepEqual([check(blocks, { refuse: ['c'] }).refused, check([['Piirmäär on 100 eurot (§ 3 lg 1).', 'S1']], { refuse: ['c'] }).refused?.provision], [null, '§ 3 lg 1']);
  const error = provisionRefusal(bad);
  assert.deepEqual([error.message, error.code, error.status, error.validation.valid, error.validation.code, error.validation.path, error.validation.provision, error.validation.provisions.kinds.d, error.validation.received.text],
    ['unsupported_provision', 'unsupported_provision', 422, false, 'unsupported_provision', '$.blocks[1].text', '§ 16 lg 1', 26, 'Vald peab aitama (fiktiivsete toetuste seaduse § 16 lg 1).']);
  // A packet without evidence (a greeting, a thank-you), an answer without blocks, a packet of odd entries: nothing
  // to read, nothing refused, nothing thrown.
  assert.deepEqual(checkProvisions({ kind: 'clarification', blocks: [], limitations: [], clarification: 'Võta heaks!' }, { evidence: [], reference_map: {} }).audit.mentions, 0);
  for (const odd of [null, {}, { evidence: [null, 'x', {}, { evidence_id: 'x', source_text: null, bibliography: null, legal_place: { section: 5 }, legal_dates: { act: null } }], reference_map: { S1: {} }, model_context: null, version_comparison: [] },
    { evidence: [], model_context: { sources: { D1: null, D2: 'x' }, evidence: null, records: 7 } }])
    assert.deepEqual(checkProvisions(answer([['Väide (§ 5).', 'S1']]), odd).audit.kinds, only('d'));
  // A lean packet (only the cited evidence; no context, no comparison) reads the same for the kinds a and b.
  const lean = { evidence: [evidence[2], evidence[1]], reference_map: { S3: references.S3, S2: references.S2 } };
  assert.deepEqual(kindsOf([['Otsus (fiktiivsete toetuste seaduse § 133 lg 7).', 'S3'], ['Vt § 140 lg 2.', 'S2']], { of: lean }), { ...zero, a: 1, b: 1 });
});

// First review's note, 10.10.2026: the instruction lets a provision stand alone after its act was named, so a reader
// takes it as the act named last. The check compares it with every act and keeps its kind; it counts the case.
test('a provision without an act that the act named last does not give is counted and listed, whatever its kind', () => {
  const drift = check([['Teise valla määruse § 3 lg 1 järgi on piirmäär 250 eurot. Toetus makstakse kohe (§ 9 lg 1).', 'S5', 'S4'], ['Fiktiivse kaitse seaduse § 5 lg 1 järgi saab isik kaitset.', 'S6'], ['Otsus tehakse kümne tööpäeva jooksul (§ 133 lg 7).', 'S3']]).audit;
  assert.deepEqual([drift.kinds, drift.after_other_act], [{ ...zero, a: 3, b: 1 }, 2]);
  assert.deepEqual(drift.items, [{ at: '$.blocks[0].text', provision: '§ 9 lg 1', kind: 'b', act: 'unnamed', after_other_act: true }, { at: '$.blocks[2].text', provision: '§ 133 lg 7', kind: 'a', act: 'unnamed', after_other_act: true }]);
  // The same act named last, or none named yet: nothing to count.
  assert.equal(check([['Fiktiivsete toetuste seaduse § 133 lg 7 järgi tehakse otsus. Kulud arvatakse maha (§ 133 lg 2).', 'S3', 'S1']]).audit.after_other_act, 0);
  assert.equal(check([['Kulud arvatakse maha (§ 133 lg 2).', 'S1'], ['Fiktiivse kaitse seaduse § 5 lg 1 järgi saab isik kaitset.', 'S6']]).audit.after_other_act, 0);
  // After an act the evidence does not hold, a bare provision of a cited passage is adrift too.
  assert.equal(check([['Vt ka perekonnaseaduse § 25 lg 2. Piirmäär on 100 eurot (§ 3 lg 1).', 'S4']]).audit.after_other_act, 1);
});

// The service: the check runs after the answer is validated and before it is saved for publication. A stand-in for
// the store keeps one turn in memory, with the states and events the real store writes (tests/rag-v2-pilot-store.test.mjs
// runs the same cases on the database).
function service({ mode = 'real', reply, of = packet, refusedProvisionKinds } = {}) {
  const config = { id: 'plan', tenant: 't', users: ['u'], mode, configHash: 'c', documents: {}, embedding: embeddingConfig(), model: 'm', maxInputTokens: 600000, maxOutputTokens: 1000, reasoning: 'low',
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 }, expiresAt: new Date(Date.now() + 3600000).toISOString() };
  let row = null;
  const write = (state, payload) => { row = { ...row, ...(state ? { state } : {}), payload: { ...row.payload, ...payload } }; return row; };
  const stage = (name, change) => write(null, { events: row.payload.events.map(event => (event.stage === name ? { ...event, ...change } : event)) });
  const store = { purgeDue: async () => {}, existing: async () => null, pendingRecovery: async () => [], cache: async () => undefined, mutate: async (_config, _row, fn) => fn(null, row),
    claim: async (_config, userId, input) => { row = { id: 'turn-1', state: 'claimed', configHash: 'c', expiresAt: new Date(Date.now() + 3600000), payload: { question: input.question, contextMode: input.contextMode, previous: '', events: [] } }; return { fresh: true, row }; },
    save: async (_config, _row, state, values) => write(state, values),
    reserve: async (_config, _row, name, reservation) => write(`${name}_reserved`, { events: [...row.payload.events, { stage: name, state: 'reserved_not_sent', reservation }] }),
    sent: async (_config, _row, name) => { stage(name, { state: 'sent_unknown' }); return write(`${name}_sent`, {}); },
    usage: async (_config, _row, name, result) => { stage(name, { state: 'response_received', usage: result.usage }); return write(null, result.audit ? { responseAudit: result.audit } : {}); },
    publish: async (_config, _row, published) => write('completed', { answer: published, messageId: 'message-1' }) };
  const adapters = { preflight: async () => {}, search: async () => ({ tenant: 't', query_id: 'q', ...of }), canonical: async () => {} };
  const call = async ({ stage: name }) => ({ value: name === 'embedding' ? Array.from({ length: config.embedding.dimensions }, (_, at) => (at ? 0 : 1)) : reply, usage: { input: 50, output: name === 'embedding' ? 0 : 100 }, requestId: `fake-${name}` });
  const made = () => new PilotService({ store, readConfig: async () => config, adapters, call, ...(refusedProvisionKinds ? { refusedProvisionKinds } : {}) });
  return { run: () => made().run('u', { convId: 'conversation-1', clientTurnKey: 'turn-key-0001', question: 'Mis tähtaja jooksul otsus tehakse?', contextMode: 'new' }), row: () => row, restore: () => made().restore(row), made };
}
const cited = { evidence: [evidence[2], evidence[6]], reference_map: { S1: { ...references.S3, pdf_pages: [], document_version_id: 'v1' }, S2: { ...references.S7, pdf_pages: [], document_version_id: 'v2' } } };
const reply = text => ({ kind: 'grounded', blocks: [{ text, factual: true, refs: ['S1'] }], limitations: [], clarification: null });

test('the service: an answer is published with its audit whatever the kinds are, and its provision is shown beside the act\'s title', async () => {
  assert.deepEqual(service({ reply: null }).made().refusedProvisionKinds, []);
  const fine = service({ of: cited, reply: reply('Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 133 lg 7).') }), turn = await fine.run();
  assert.equal(turn.state, 'completed');
  assert.deepEqual([fine.row().payload.provisionAudit.kinds, fine.row().payload.provisionAudit.labelled, fine.row().payload.responseAudit.validation], [only('a'), 1, { valid: true, code: 'validated' }]);
  // The sources panel: the provision beside the title of the legal source, nothing for the guide.
  assert.deepEqual(turn.sources.map(source => [source.ref, source.title, source.provision ?? null, source.used]), [['S1', LAW, '§ 133 lg 7', true], ['S2', GUIDE, null, false]]);
  assert.equal(pilotChatResult(turn, 'conversation-1').sources[0].label, `S1 · ${LAW}, § 133 lg 7 · Vastuses kasutatud`);
  // The lean form of the turn keeps the audit and the passage's place, so the panel shows the same after the audit is let go.
  const lean = leanPayload({ ...fine.row().payload, packet: { tenant: 't', query_id: 'q', ...cited } });
  assert.deepEqual([lean.provisionAudit.kinds.a, lean.packet.evidence.map(item => item.legal_place)], [1, [{ section: '133', subsections: ['7'] }]]);
  // CHANGED ON PURPOSE (the maintainer's decision, 10.10.2026; this case pinned a refused turn): a provision nothing
  // gives is kind d, and the answer is published all the same, with the audit that says so.
  const bad = service({ of: cited, reply: reply('Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 999 lg 1).') }), wrong = await bad.run();
  assert.deepEqual([wrong.state, wrong.answer.blocks[0].text, bad.row().state, bad.row().payload.responseAudit.validation], ['completed', 'Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 999 lg 1).', 'completed', { valid: true, code: 'validated' }]);
  assert.deepEqual([bad.row().payload.provisionAudit.kinds, bad.row().payload.provisionAudit.items, 'error' in bad.row().payload], [only('d'), [{ at: '$.blocks[0].text', provision: '§ 999 lg 1', kind: 'd', act: 'named' }], false]);
  // An answer that names nothing over evidence without a label keeps no audit.
  const plain = service({ of: { evidence: [evidence[6]], reference_map: { S1: { ...references.S7, pdf_pages: [], document_version_id: 'v2' } } }, reply: reply('Toetust saab taotleda vallast.') });
  await plain.run();
  assert.equal('provisionAudit' in plain.row().payload, false);
});

test('the refusal path stays behind the list: a service given kind d stops the turn of an answer that names such a provision', async () => {
  // No release passes a list: this is the path a later decision would turn on, after the kinds have been measured.
  const fine = service({ of: cited, refusedProvisionKinds: ['d'], reply: reply('Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 133 lg 7).') });
  assert.equal((await fine.run()).state, 'completed');
  const bad = service({ of: cited, refusedProvisionKinds: ['d'], reply: reply('Otsus tehakse kümne tööpäeva jooksul (fiktiivsete toetuste seaduse § 999 lg 1).') });
  await assert.rejects(bad.run(), { code: 'unsupported_provision', status: 422, pilotTurnId: 'turn-1' });
  // Nothing is published; the turn ends answer_rejected with the audit in its validation record.
  const refused = bad.row();
  assert.deepEqual([refused.state, refused.payload.error, 'answer' in refused.payload, 'provisionAudit' in refused.payload], ['answer_rejected', 'unsupported_provision', false, false]);
  assert.deepEqual([refused.payload.responseAudit.validation.code, refused.payload.responseAudit.validation.provision, refused.payload.responseAudit.validation.provisions.kinds], ['unsupported_provision', '§ 999 lg 1', only('d')]);
  const restored = await bad.restore();
  assert.deepEqual([restored.state, restored.failureKind], ['answer_rejected', 'provision']);
  assert.deepEqual([pilotChatResult(restored, 'conversation-1').messageKey, pilotChatResult(restored, 'conversation-1').completionStatus], ['m4Pilot.provisionFailed', 'FAILED']);
});

test('test mode records and never refuses, also when a list is given: the fixed transport echoes a passage and may cut a section number in two', async () => {
  // The test transport's own answer is 700 characters of the first passage. Here the cut falls inside "§ 133", and
  // what is left, "§ 13", is a provision nothing gives: in real mode with kind d in the list the turn would be refused.
  const long = { ...evidence[0], source_text: `${'Sissejuhatav tekst. '.repeat(34)}${' '.repeat(16)}§ 133 lõige 2 täpsustab.` };
  assert.equal(long.source_text.slice(0, 700).endsWith('§ 13'), true);
  const echo = service({ mode: 'test', refusedProvisionKinds: ['d'], of: { evidence: [long], reference_map: { S1: { ...references.S1, pdf_pages: [], document_version_id: 'v1' } } } }), turn = await echo.run();
  assert.equal(turn.state, 'completed');
  assert.deepEqual([echo.row().payload.provisionAudit.kinds, echo.row().payload.provisionAudit.mentions], [only('d'), 1]);
  assert.match(turn.answer.blocks[0].text, /§ 13$/u);
});

test('a check that fails by itself does not take the validated answer with it: the turn is published and says it was not checked', async () => {
  // A part of the packet that only the check reads, and that cannot be read, stands for a fault of the check's own.
  const unreadable = new Proxy({}, { ownKeys() { throw new TypeError('unreadable'); } });
  const logged = [], log = console.error;
  console.error = (...parts) => logged.push(parts);
  let run, turn;
  try {
    run = service({ of: { ...cited, version_comparison: unreadable }, refusedProvisionKinds: ['d'], reply: reply('Otsus tehakse kümne tööpäeva jooksul (§ 999).') });
    turn = await run.run();
  } finally { console.error = log; }
  // The answer names a provision nothing gives, and is published all the same, even where kind d is refused: unchecked, and marked so.
  assert.deepEqual([turn.state, run.row().payload.provisionAudit], ['completed', { version: PROVISION_CHECK_VERSION, failed: true }]);
  assert.deepEqual(logged, [['[rag-v2] provision check failed', 'TypeError']]);
});
