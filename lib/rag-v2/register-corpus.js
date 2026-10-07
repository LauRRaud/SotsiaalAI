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
];
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
  const paths = new Set(register.entries.map(entry => entry.path)), perPath = {}, folders = {}, kinds = new Map();
  for (const document of documents) {
    const type = String(document.source_type || 'unknown');
    if (paths.has(document.registry_path)) {
      tally(perPath, document.registry_path);
      const folder = folders[document.registry_path.split('/')[0]] ||= { documents: 0, by_source_type: {} };
      folder.documents++; tally(folder.by_source_type, type);
      continue;
    }
    const kind = OUTSIDE.find(item => item.types.includes(type)) || OTHER;
    const found = kinds.get(kind.key) || { kind, documents: 0, by_source_type: {}, sources: [], municipalities: {} };
    found.documents++; tally(found.by_source_type, type);
    if (kind.list === 'municipalities') tally(found.municipalities, document.municipality || 'määramata');
    else if (kind.list !== 'none') found.sources.push({ title: String(document.title || ''), ...(kind.list === 'pages' ? { url: document.url || null, publisher: document.publisher || null } : {}) });
    kinds.set(kind.key, found);
  }
  const outside = [...OUTSIDE, OTHER].map(item => kinds.get(item.key)).filter(Boolean).map(found => ({ ...found, by_source_type: sorted(found.by_source_type),
    sources: found.sources.sort((a, b) => et(a.publisher || '', b.publisher || '') || et(a.title, b.title)),
    municipalities: Object.entries(found.municipalities).sort((a, b) => et(a[0], b[0])).map(([municipality, count]) => ({ municipality, documents: count })) }));
  return { about, documents: documents.length, perPath,
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
      note: 'Documents of the corpus policy by where the source file is kept and by source type. One file of the repository may give many documents (a municipality package gives its services, forms and contacts). On a source entry, corpus_documents is the number of corpus documents the file gives; 0 means the file is not in the corpus.',
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

/** REGISTER.md with the corpus state: a summary before "## Kasutamine" and, at the end of the file, the lists of the
 *  sources kept outside the repository. Both stand between markers and are written anew each time. */
export function markdownWithCorpus(md, state) {
  const { version, index_generation: index, units, date } = state.about;
  const publishers = found => new Set(found.sources.map(source => source.publisher).filter(Boolean)).size;
  const summary = [`## RAG-i seis: korpus ${version}`, '',
    `Seis ${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}: korpus **${version}** (indeks \`${index}\`), **${number(state.documents)} dokumenti**${units ? `, ${number(units)} lõiku` : ''}. Arvud on loetud korpuse hoidlast ja poliitikast skriptiga \`scripts/rag-v2-register-corpus.mjs\`; pärast iga korpuse täiendust käivitatakse see uuesti. Üks repo fail võib anda mitu dokumenti (omavalitsuse pakett annab teenuste, vormide ja kontaktide dokumendid), seepärast ei võrdu dokumentide arvud ülal olevate failide arvudega. \`REGISTER.json\` näitab iga allikafaili juures, mitu korpuse dokumenti see annab (\`corpus_documents\`).`, '',
    '| Kust | Dokumente | Allikaliigid |', '|---|---:|---|',
    ...Object.entries(state.folders).map(([folder, found]) => `| \`${folder}\` | ${found.documents} | ${types(found.by_source_type)} |`),
    `| väljaspool repot | ${state.outsideDocuments} | ${types(sorted(state.outside.reduce((bag, found) => { for (const [type, count] of Object.entries(found.by_source_type)) bag[type] = (bag[type] || 0) + count; return bag; }, {})))} |`, '',
    '### Korpuses, kuid väljaspool repot', '',
    'Neid allikaid repos ei hoita. Koopiad on korpuse hoidlas (sülearvuti põhikausta `tmp/` all, mida git ei jälgi, ja serveris). Lehtede loend on faili lõpus jaotises „Korpuse allikad väljaspool repot“.', '',
    '| Allikas | Dokumente | Millest tehakse | Miks väljaspool repot |', '|---|---:|---|---|',
    ...state.outside.map(found => `| ${found.kind.nimi} | ${found.documents}${found.kind.list === 'pages' ? ` (${publishers(found)} väljaandjat)` : ''} | ${found.kind.tehakse} | ${found.kind.miks} |`), '',
    `### Repo allikafailid, mida korpuses ei ole (${state.notInCorpus.length})`, '',
    state.notInCorpus.length ? `<details><summary>Failide loend</summary>\n\n${state.notInCorpus.map(name => `- \`${name}\``).join('\n')}\n\n</details>` : 'Kõik repo allikafailid on korpuses.'].join('\n');
  const lists = ['## Korpuse allikad väljaspool repot', '',
    `Korpus ${version}, ${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}. Kontaktide kohta on ainult arvud: kontakti pealkiri on isiku nimi ja seda siia ei kirjutata.`,
    ...state.outside.flatMap(found => ['', `### ${found.kind.nimi} (${found.documents})`, '',
      ...(found.kind.list === 'pages' ? ['| Väljaandja | Leht | Aadress |', '|---|---|---|', ...found.sources.map(source => `| ${cell(source.publisher)} | ${cell(source.publisher && source.title.startsWith(`${source.publisher}: `) ? source.title.slice(source.publisher.length + 2) : source.title)} | ${source.url ? `<${source.url}>` : ''} |`)]
        : found.kind.list === 'titles' ? ['| Leht |', '|---|', ...found.sources.map(source => `| ${cell(source.title)} |`)]
          : found.kind.list === 'municipalities' ? ['| Omavalitsus | Dokumente |', '|---|---:|', ...found.municipalities.map(item => `| ${cell(item.municipality)} | ${item.documents} |`)]
            : [`Allikaliigid: ${types(found.by_source_type)}.`])])].join('\n');
  return block(block(md, START, END, summary, '## Kasutamine'), LIST_START, LIST_END, lists, null);
}
