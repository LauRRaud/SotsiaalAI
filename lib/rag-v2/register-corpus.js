// The corpus state in the registers of Andmebaasi (owner, 07.10.2026: "see peab näitama rag seisu ka, ehk siis kõike
// seda, mis sa oled andmebaasi pannud"). REGISTER.json and REGISTER.md listed the files of the repository; they did
// not say which of those files are in the corpus, and they said nothing of the corpus sources that are kept outside
// the repository (contacts, sales point pages, vendors' and organisations' own pages): 1872 of the 8001 documents of
// corpus v64. This module makes the state from the documents of the corpus policy and writes it into both registers.
// A contact's title is a person's name: of contacts only counts by municipality are written, never a title.
export const REGISTER_CORPUS = 'rag-v2/register-corpus-1';

// The kinds of sources kept outside the repository, by source type.
const OUTSIDE = [
  { key: 'contacts', types: ['municipal_contact', 'official_contact', 'municipal_contact_directory'], list: 'municipalities',
    name: 'municipal contacts and contact directories', nimi: 'Omavalitsuste kontaktid ja kontaktikataloogid',
    made_from: 'the contact register of the application database, exported with scripts/rag-v2-contact-export.mjs (ADR-085, ADR-086)',
    tehakse: 'rakenduse kontaktiregistrist skriptiga `scripts/rag-v2-contact-export.mjs` (ADR-085, ADR-086)',
    reason: 'holds persons\' names, phone numbers and e-mail addresses', miks: 'isikute nimed, telefoninumbrid ja e-posti aadressid' },
  // ADR-104: the care homes' price pages are of the same source type as the assistive points' pages; the title tells
  // them apart, and a row with a title is looked at first.
  { key: 'care_prices', types: ['registry'], title: 'Hooldekodude kohamaksumus', list: 'titles',
    name: 'care homes\' monthly prices by municipality', nimi: 'Hooldekodude kohamaksumuse lehed',
    made_from: 'the Social Insurance Board\'s price monitoring table of general care homes, read with scripts/rag-v2-care-prices.mjs: one page for every municipality and an overview (ADR-104)',
    tehakse: 'Sotsiaalkindlustusameti hinnaseire tabelist skriptiga `scripts/rag-v2-care-prices.mjs`, iga omavalitsuse kohta üks leht ja üks ülevaade (ADR-104)',
    reason: 'the pages hold the homes\' phone numbers and are made again from the table', miks: 'hooldekodude telefoninumbrid; leht tehakse tabelist uuesti' },
  { key: 'assistive_points', types: ['registry'], list: 'titles',
    name: 'assistive device sales and rental points', nimi: 'Abivahendite müügi- ja üüripunktide lehed',
    made_from: 'the Social Insurance Board\'s map table, read with scripts/rag-v2-assistive-points.mjs: one page for every municipality (ADR-096)',
    tehakse: 'Sotsiaalkindlustusameti kaarditabelist skriptiga `scripts/rag-v2-assistive-points.mjs`, iga omavalitsuse kohta üks leht (ADR-096)',
    reason: 'the pages hold the points\' phone numbers and are made again from the table', miks: 'punktide telefoninumbrid; leht tehakse tabelist uuesti' },
  { key: 'vendor_pages', types: ['vendor_page'], list: 'pages',
    name: 'assistive device vendors\' own pages', nimi: 'Abivahendite müüjate lehed',
    made_from: 'the list register/web_pages_vendors.json, collected with scripts/rag-v2-web-pages.mjs (ADR-095)',
    tehakse: 'nimekiri `register/web_pages_vendors.json`, korjaja `scripts/rag-v2-web-pages.mjs` (ADR-095)',
    reason: 'the companies\' own texts and phone numbers', miks: 'ettevõtete enda tekstid ja telefoninumbrid' },
  { key: 'organisation_pages', types: ['organization_page'], list: 'pages',
    name: 'disability organisations\' own pages', nimi: 'Puuetega inimeste organisatsioonide lehed',
    made_from: 'the list register/web_pages_organisations.json, collected with scripts/rag-v2-web-pages.mjs and chosen with scripts/rag-v2-web-select.mjs (ADR-095)',
    tehakse: 'nimekiri `register/web_pages_organisations.json`, korjaja `scripts/rag-v2-web-pages.mjs` ja valik `scripts/rag-v2-web-select.mjs` (ADR-095)',
    reason: 'the organisations\' own texts', miks: 'organisatsioonide enda tekstid' },
  // Studies and guides taken by a list from their publishers' official addresses (07.10.2026: the Ministry of Social
  // Affairs' completed studies and the Social Insurance Board's pages for specialists; then the documents the
  // newsletter of the journal Sotsiaaltöö pointed to, of ministries, boards, think tanks, universities and
  // organisations). Hundreds of megabytes of PDF: the official address is the source, and the register lists each by
  // its publisher, title and that address.
  { key: 'official_documents', types: ['research_report', 'official_guideline', 'information_material', 'policy_analysis'], list: 'pages',
    name: 'studies and guides taken from their publishers\' official addresses', nimi: 'Uuringud ja juhendid väljaandja ametlikult aadressilt',
    made_from: 'the lists of studies and guides on the institutions\' own sites and the documents the newsletter of the journal Sotsiaaltöö pointed to (register/newsletter_documents.json), each downloaded from its publisher\'s official address',
    tehakse: 'asutuste veebilehtede uuringute ja juhendite loenditest ning ajakirja Sotsiaaltöö uudiskirjas viidatud dokumentidest (`register/newsletter_documents.json`); iga fail on alla laaditud väljaandja ametlikult aadressilt',
    reason: 'large files; the official address is the source', miks: 'suured failid; allikas on ametlik aadress' },
];
// What the RAG on the server holds, in the words a reader of the register uses (owner, 07.10.2026: "mind ajab see
// segadusse, repo jne. ... Oluline on see, mis on serveris"). `where` says where the register lists the items: among
// the content files, or at the end of the page.
const CONTENT = [
  { key: 'municipal_services', nimi: 'Omavalitsuste teenused ja toetused', name: 'municipal services and benefits', types: ['kov_service_info'], where: 'files' },
  { key: 'forms', nimi: 'Taotlusvormid (vastuses antakse lingina)', name: 'application forms (given by link)', types: ['application_form', 'web_form', 'pdf_form', 'official_form'], where: 'files' },
  { key: 'contacts', nimi: 'Omavalitsuste kontaktid', name: 'municipal contacts', types: ['official_contact', 'municipal_contact', 'municipal_contact_directory'], where: 'counts' },
  { key: 'journal', nimi: 'Ajakirja Sotsiaaltöö artiklid', name: 'articles of the journal Sotsiaaltöö', types: ['file', 'web'], where: 'files' },
  { key: 'acts', nimi: 'Õigusaktid', name: 'legal acts', types: ['legal_act'], where: 'files' },
  { key: 'guides', nimi: 'Juhendid, infomaterjalid ja uuringud', name: 'guides, information materials and studies', types: ['information_material', 'research_report', 'official_guideline', 'policy_analysis'], where: 'files_and_end' },
  { key: 'official_pages', nimi: 'Ametlikud juhislehed (ametite veebilehed)', name: 'official guidance pages', types: ['web_page'], where: 'files' },
  { key: 'organisation_pages', nimi: 'Puuetega inimeste organisatsioonide lehed', name: 'disability organisations\' own pages', types: ['organization_page'], where: 'end' },
  { key: 'care_prices', nimi: 'Hooldekodude kohamaksumus omavalitsuste kaupa', name: 'care homes\' monthly prices by municipality', types: ['registry'], title: 'Hooldekodude kohamaksumus', where: 'end' },
  { key: 'assistive_points', nimi: 'Abivahendite müügi- ja üüripunktid', name: 'assistive device sales and rental points', types: ['registry'], where: 'end' },
  { key: 'vendor_pages', nimi: 'Abivahendite müüjate lehed', name: 'assistive device vendors\' own pages', types: ['vendor_page'], where: 'end' },
];
const CONTACT_TYPES = CONTENT.find(row => row.key === 'contacts').types;
const OTHER = { key: 'other', types: [], list: 'none', name: 'other sources', nimi: 'Muud allikad', made_from: 'not described', tehakse: 'kirjeldamata', reason: 'not described', miks: 'kirjeldamata' };
const tally = (bag, key) => { bag[key] = (bag[key] || 0) + 1; return bag; };
const sorted = bag => Object.fromEntries(Object.entries(bag).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'et')));
const et = (a, b) => a.localeCompare(b, 'et');

/**
 * The corpus state. register: the parsed REGISTER.json; documents: the documents of the corpus policy as
 * [{ source_type, title, url, publisher, municipality, registry_path }]; about: { version, index_generation, units,
 * date }. A document whose registry_path is a registered file is counted for that file; any other is a source kept
 * outside the repository.
 */
export function corpusState(register, documents, about) {
  const paths = new Set(register.entries.map(entry => entry.path)), perPath = {}, folders = {}, kinds = new Map(), all = {}, contactPlaces = {}, titled = {};
  // A row that names a title takes the documents of its types whose title begins so; the row of the type alone keeps the rest.
  const ownRow = (rows, type, document) => rows.find(row => row.types.includes(type) && row.title && String(document.title || '').startsWith(row.title)) || rows.find(row => row.types.includes(type) && !row.title);
  for (const document of documents) {
    const type = String(document.source_type || 'unknown');
    tally(all, type);
    const row = ownRow(CONTENT, type, document);
    if (row?.title) tally(titled[row.key] ||= {}, type);
    if (CONTACT_TYPES.includes(type)) tally(contactPlaces, document.municipality || 'määramata');
    if (paths.has(document.registry_path)) {
      tally(perPath, document.registry_path);
      const folder = folders[document.registry_path.split('/')[0]] ||= { documents: 0, by_source_type: {} };
      folder.documents++; tally(folder.by_source_type, type);
      continue;
    }
    const kind = ownRow(OUTSIDE, type, document) || OTHER;
    const found = kinds.get(kind.key) || { kind, documents: 0, by_source_type: {}, sources: [], municipalities: {} };
    found.documents++; tally(found.by_source_type, type);
    if (kind.list === 'municipalities') tally(found.municipalities, document.municipality || 'määramata');
    else if (kind.list !== 'none') found.sources.push({ title: String(document.title || ''), ...(kind.list === 'pages' ? { url: document.url || null, publisher: document.publisher || null } : {}) });
    kinds.set(kind.key, found);
  }
  const outside = [...OUTSIDE, OTHER].map(item => kinds.get(item.key)).filter(Boolean).map(found => ({ ...found, by_source_type: sorted(found.by_source_type),
    sources: found.sources.sort((a, b) => et(a.publisher || '', b.publisher || '') || et(a.title, b.title)),
    municipalities: Object.entries(found.municipalities).sort((a, b) => et(a[0], b[0])).map(([municipality, count]) => ({ municipality, documents: count })) }));
  // The whole corpus by what it is; a source type no row names is shown as its own row, so that nothing is left out.
  const named = new Set(CONTENT.flatMap(row => row.types));
  const content = [...CONTENT, ...Object.keys(all).filter(type => !named.has(type)).sort().map(type => ({ key: type, nimi: `Muu (${type})`, name: `other (${type})`, types: [type], where: 'none' }))]
    .map(row => {
      // The documents of a type that a titled row took are not counted again in the type's own row.
      const taken = type => CONTENT.filter(other => other.title && other.types.includes(type)).reduce((sum, other) => sum + (titled[other.key]?.[type] || 0), 0);
      const by = sorted(Object.fromEntries(row.types.map(type => [type, row.title ? titled[row.key]?.[type] || 0 : (all[type] || 0) - taken(type)]).filter(([, count]) => count > 0)));
      return { ...row, by_source_type: by, documents: Object.values(by).reduce((sum, count) => sum + count, 0) };
    })
    .filter(row => row.documents);
  return { about, documents: documents.length, perPath, content,
    contacts: Object.entries(contactPlaces).sort((a, b) => et(a[0], b[0])).map(([municipality, count]) => ({ municipality, documents: count })),
    folders: Object.fromEntries(Object.entries(folders).sort((a, b) => b[1].documents - a[1].documents).map(([name, folder]) => [name, { documents: folder.documents, by_source_type: sorted(folder.by_source_type) }])),
    outside, outsideDocuments: outside.reduce((sum, found) => sum + found.documents, 0),
    notInCorpus: register.entries.filter(entry => entry.role === 'source' && !perPath[entry.path]).map(entry => entry.path) };
}

/** The register with the corpus state: `corpus`, `outside_repository`, and on every source entry the number of corpus
 *  documents it gives (0: the file is not in the corpus). */
export function registerWithCorpus(register, state) {
  const { schema_version, created_at, updated_at: _before, path_base, archive, import_rule, counts, corpus: _corpus, outside_repository: _outside, entries, ...rest } = register;
  const publishers = found => new Set(found.sources.map(source => source.publisher).filter(Boolean)).size;
  return { schema_version, created_at, updated_at: state.about.date, path_base, archive, import_rule, counts,
    corpus: { written_by: REGISTER_CORPUS, version: state.about.version, index_generation: state.about.index_generation, read_at: state.about.date, documents: state.documents,
      ...(state.about.units ? { units: state.about.units } : {}),
      note: 'What the RAG on the server holds: the documents of the corpus policy by what they are (by_content), and by where the source file is kept (from_repository, outside_repository). One file of the repository may give many documents (a municipality package gives its services, forms and contacts). On a source entry, corpus_documents is the number of corpus documents the file gives; 0 means the file is not in the corpus.',
      by_content: state.content.map(row => ({ content: row.key, name: row.name, documents: row.documents, by_source_type: row.by_source_type })),
      from_repository: state.folders, source_files_not_in_corpus: state.notInCorpus.length, outside_repository_documents: state.outsideDocuments },
    outside_repository: { documents: state.outsideDocuments,
      note: 'Sources of the corpus that are not files of the repository. Copies are in the corpus store (the main checkout\'s git-ignored tmp/ and the server). Of contacts only counts are given: a contact\'s title is a person\'s name.',
      kinds: state.outside.map(found => ({ kind: found.kind.key, name: found.kind.name, documents: found.documents, by_source_type: found.by_source_type, made_from: found.kind.made_from, reason: found.kind.reason,
        ...(found.kind.list === 'pages' ? { publishers: publishers(found) } : {}),
        ...(found.kind.list === 'municipalities' ? { by_municipality: found.municipalities } : found.kind.list === 'none' ? {} : { sources: found.sources }) })) },
    entries: entries.map(({ corpus_documents: _old, ...entry }) => (entry.role === 'source' ? { ...entry, corpus_documents: state.perPath[entry.path] || 0 } : entry)), ...rest };
}

const START = '<!-- corpus-state:start (kirjutab scripts/rag-v2-register-corpus.mjs; käsitsi ei muudeta) -->', END = '<!-- corpus-state:end -->';
const LIST_START = '<!-- corpus-outside:start (kirjutab scripts/rag-v2-register-corpus.mjs; käsitsi ei muudeta) -->', LIST_END = '<!-- corpus-outside:end -->';
const cell = value => String(value ?? '').replace(/\|/gu, '\\|').replace(/\s+/gu, ' ').trim();
const number = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ' ');
const types = bag => Object.entries(bag).map(([type, count]) => `${type} ${count}`).join(', ');
const block = (md, start, end, text, before) => {
  const from = md.indexOf(start), to = md.indexOf(end);
  if (from >= 0 && to > from) return `${md.slice(0, from)}${start}\n${text}\n${end}${md.slice(to + end.length)}`;
  if (before === null) return `${md.replace(/\s*$/u, '')}\n\n${start}\n${text}\n${end}\n`;
  const at = md.indexOf(before);
  if (at < 0) throw Error(`REGISTER.md: no "${before}" to write the corpus state before`);
  return `${md.slice(0, at)}${start}\n${text}\n${end}\n\n${md.slice(at)}`;
};

/** REGISTER.md with the RAG state: before "## Kasutamine" what the RAG on the server holds, by what it is, with the
 *  technical breakdown (where the source files are kept) folded away; and at the end of the file the lists of what
 *  the content files above do not list: the organisations' and vendors' pages, the sales point pages, and the
 *  contacts as counts. Both stand between markers and are written anew each time. */
export function markdownWithCorpus(md, state) {
  const { version, index_generation: index, units, date } = state.about, day = `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
  const publishers = found => new Set(found.sources.map(source => source.publisher).filter(Boolean)).size;
  const where = { files: 'jaotis „Sisufailid“', end: 'faili lõpus: „RAG-is olevad lehed ja kontaktid“', counts: 'faili lõpus arvudena omavalitsuste kaupa (nimesid siia ei kirjutata)', files_and_end: 'jaotis „Sisufailid“; väljaandja ametlikult aadressilt lisatud on faili lõpus', none: '' };
  const summary = [`## RAG-i seis: mis on serveris (korpus ${version})`, '',
    `Seis ${day}: serveris töötav RAG (korpus **${version}**, indeks \`${index}\`) sisaldab **${number(state.documents)} dokumenti**${units ? ` (${number(units)} lõiku)` : ''}. Arvud on loetud korpusest skriptiga \`scripts/rag-v2-register-corpus.mjs\`; pärast iga korpuse täiendust käivitatakse see uuesti.`, '',
    '| Mis on RAG-is | Dokumente | Kus on loend |', '|---|---:|---|',
    ...state.content.map(row => `| ${row.nimi} | ${row.documents} | ${where[row.where]} |`),
    `| **Kokku** | **${state.documents}** | |`, '',
    '<details><summary>Tehniline jaotus arendajale: kus allikafailid asuvad</summary>', '',
    `Dokumentide arvud ei võrdu ülal olevate failide arvudega: üks fail võib anda mitu dokumenti (omavalitsuse pakett annab teenuste, vormide ja kontaktide dokumendid). \`REGISTER.json\` näitab iga allikafaili juures, mitu dokumenti see annab (\`corpus_documents\`).`, '',
    '| Kaust | Dokumente | Allikaliigid |', '|---|---:|---|',
    ...Object.entries(state.folders).map(([folder, found]) => `| \`${folder}\` | ${found.documents} | ${types(found.by_source_type)} |`), '',
    `Koodihoidlas (GitHub) ei ole ${state.outsideDocuments} dokumendi allikafaile; need on korpuse hoidlas (arvuti \`tmp/\` kaust ja server):`, '',
    '| Allikas | Dokumente | Millest tehakse | Miks ei ole koodihoidlas |', '|---|---:|---|---|',
    ...state.outside.map(found => `| ${found.kind.nimi} | ${found.documents}${found.kind.list === 'pages' ? ` (${publishers(found)} väljaandjat)` : ''} | ${found.kind.tehakse} | ${found.kind.miks} |`), '',
    state.notInCorpus.length ? `Koodihoidla allikafailid, mida RAG-is ei ole (${state.notInCorpus.length}):\n\n${state.notInCorpus.map(name => `- \`${name}\``).join('\n')}` : 'Kõik koodihoidla allikafailid on RAG-is.', '',
    '</details>'].join('\n');
  const pages = found => ['| Väljaandja | Pealkiri | Aadress |', '|---|---|---|', ...found.sources.map(source => `| ${cell(source.publisher)} | ${cell(source.publisher && source.title.startsWith(`${source.publisher}: `) ? source.title.slice(source.publisher.length + 2) : source.title)} | ${source.url ? `<${source.url}>` : ''} |`)];
  const contacts = state.contacts.reduce((sum, item) => sum + item.documents, 0);
  const lists = ['## RAG-is olevad lehed ja kontaktid', '',
    `Serveris töötav RAG, korpus ${version}, ${day}. Siin on loend sellest, mida jaotis „Sisufailid“ ei loetle.`,
    ...state.outside.filter(found => found.kind.list !== 'municipalities').flatMap(found => ['', `### ${found.kind.nimi} (${found.documents})`, '',
      ...(found.kind.list === 'pages' ? pages(found) : found.kind.list === 'titles' ? ['| Leht |', '|---|', ...found.sources.map(source => `| ${cell(source.title)} |`)] : [`Allikaliigid: ${types(found.by_source_type)}.`])]),
    ...(contacts ? ['', `### Omavalitsuste kontaktid (${contacts})`, '', 'Ainult arvud: kontakti pealkiri on isiku nimi ja seda siia ei kirjutata.', '',
      '| Omavalitsus | Dokumente |', '|---|---:|', ...state.contacts.map(item => `| ${cell(item.municipality)} | ${item.documents} |`)] : [])].join('\n');
  return block(block(md, START, END, summary, '## Kasutamine'), LIST_START, LIST_END, lists, null);
}
