import test from 'node:test';
import assert from 'node:assert/strict';
import { REGISTER_CORPUS, corpusState, registerWithCorpus, markdownWithCorpus } from '../lib/rag-v2/register-corpus.js';

// A small register and the documents of a small corpus. Every name is made up.
const register = { schema_version: 1, created_at: '2026-09-07T00:00:00.000Z', path_base: 'Andmebaasi', archive: '../Arhiiv', import_rule: 'rule', counts: { KOV: { files: 2, sources: 1 } },
  entries: [{ path: 'KOV/naidis/naidis.json', category: 'KOV', role: 'source', sha256: 'a' }, { path: 'KOV/naidis/naidis.meta.json', category: 'KOV', role: 'metadata', sha256: 'b' },
    { path: 'oigusaktid/1.xml', category: 'oigusaktid', role: 'source', sha256: 'c', corpus_documents: 9 }, { path: 'oigusaktid/2.xml', category: 'oigusaktid', role: 'source', sha256: 'd' }],
  original_path_base: '../Arhiiv/x' };
const documents = [
  { source_type: 'kov_service_info', title: 'Koduteenus', registry_path: 'KOV/naidis/naidis.json', municipality: 'Näidise vald' },
  { source_type: 'application_form', title: 'Taotlus', registry_path: 'KOV/naidis/naidis.json', municipality: 'Näidise vald' },
  { source_type: 'official_contact', title: 'Rein Tammsalu', registry_path: 'KOV/naidis/naidis.json', municipality: 'Näidise vald' },
  { source_type: 'legal_act', title: 'Näidisseadus', registry_path: 'oigusaktid/1.xml' },
  { source_type: 'municipal_contact', title: 'Mari Tammsalu', registry_path: 'contacts.json', municipality: 'Näidise vald' },
  { source_type: 'official_contact', title: 'Jaan Tammsalu', registry_path: 'contacts.json', municipality: 'Näidise vald' },
  { source_type: 'municipal_contact_directory', title: 'Sotsiaalosakond', registry_path: 'contacts.json', municipality: 'Teise vald' },
  { source_type: 'registry', title: 'Abivahendite müügi- ja üüripunktid: Näidise vald', registry_path: 'abivahendid/kov/naidise_vald.html', municipality: 'Näidise vald' },
  { source_type: 'vendor_page', title: 'Näidispood: Laenutus', url: 'https://pood.example/laenutus', publisher: 'Näidispood', registry_path: 'veebilehed/naidispood/pood--laenutus.html' },
  { source_type: 'organization_page', title: 'Näidisliit: Mis on | haigus', url: 'https://liit.example/haigus', publisher: 'Näidisliit', registry_path: 'veebilehed/naidisliit/liit--haigus.html' },
  { source_type: 'organization_page', title: 'Näidisliit: Kontakt', url: 'https://liit.example/kontakt', publisher: 'Näidisliit', registry_path: 'veebilehed/naidisliit/liit--kontakt.html' },
  { source_type: 'new_kind', title: 'Midagi muud', registry_path: null }];
const about = { version: 'v64', index_generation: '7d209c63', units: 45596, date: '2026-10-07' };

test('the state says what the RAG holds, counts a registered file\'s documents and groups the sources kept elsewhere', () => {
  const state = corpusState(register, documents, about);
  assert.equal(state.documents, 12);
  // What the RAG holds, in a reader's words; a source type no row names gets a row of its own.
  assert.deepEqual(state.content.map(row => [row.key, row.documents]), [['municipal_services', 1], ['forms', 1], ['contacts', 4], ['acts', 1], ['organisation_pages', 2], ['assistive_points', 1], ['vendor_pages', 1], ['new_kind', 1]]);
  assert.equal(state.content.reduce((sum, row) => sum + row.documents, 0), state.documents);
  // Contacts by municipality, as counts, wherever their file is kept; a contact's title is a person's name.
  assert.deepEqual(state.contacts, [{ municipality: 'Näidise vald', documents: 3 }, { municipality: 'Teise vald', documents: 1 }]);
  assert.deepEqual(state.perPath, { 'KOV/naidis/naidis.json': 3, 'oigusaktid/1.xml': 1 });
  assert.deepEqual(state.folders, { KOV: { documents: 3, by_source_type: { application_form: 1, kov_service_info: 1, official_contact: 1 } }, oigusaktid: { documents: 1, by_source_type: { legal_act: 1 } } });
  assert.deepEqual(state.notInCorpus, ['oigusaktid/2.xml']);
  assert.equal(state.outsideDocuments, 8);
  assert.deepEqual(state.outside.map(found => [found.kind.key, found.documents]), [['contacts', 3], ['assistive_points', 1], ['vendor_pages', 1], ['organisation_pages', 2], ['other', 1]]);
  assert.deepEqual(state.outside[0].sources, []);
  assert.deepEqual(state.outside[3].sources.map(source => source.title), ['Näidisliit: Kontakt', 'Näidisliit: Mis on | haigus']);
});

test('the register and its page carry the state, without a contact\'s name, and writing twice changes nothing', () => {
  const state = corpusState(register, documents, about), next = registerWithCorpus(register, state);
  assert.deepEqual(Object.keys(next), ['schema_version', 'created_at', 'updated_at', 'path_base', 'archive', 'import_rule', 'counts', 'corpus', 'outside_repository', 'entries', 'original_path_base']);
  assert.deepEqual([next.updated_at, next.corpus.written_by, next.corpus.version, next.corpus.documents, next.corpus.units, next.corpus.source_files_not_in_corpus, next.outside_repository.documents],
    ['2026-10-07', REGISTER_CORPUS, 'v64', 12, 45596, 1, 8]);
  assert.deepEqual(next.corpus.by_content[2], { content: 'contacts', name: 'municipal contacts', documents: 4, by_source_type: { official_contact: 2, municipal_contact: 1, municipal_contact_directory: 1 } });
  // Every source entry says how many documents it gives; an old number is replaced, other entries get none.
  assert.deepEqual(next.entries.map(entry => entry.corpus_documents), [3, undefined, 1, 0]);
  assert.deepEqual(next.outside_repository.kinds[0].by_municipality, [{ municipality: 'Näidise vald', documents: 2 }, { municipality: 'Teise vald', documents: 1 }]);
  assert.equal(next.outside_repository.kinds[0].sources, undefined);
  assert.deepEqual(next.outside_repository.kinds[3].sources[1], { title: 'Näidisliit: Mis on | haigus', url: 'https://liit.example/haigus', publisher: 'Näidisliit' });
  assert.deepEqual(registerWithCorpus(next, state), next);

  const page = '# Register\n\n| Kaust | Allikafaile | Faile kokku | Kasutus |\n|---|---:|---:|---|\n| oigusaktid | 2 | 2 | Aktid. |\n\n## Kasutamine\n\nTekst.\n\n## Sisufailid\n\n| Allikas | Fail |\n|---|---|\n| Näidisseadus | [oigusaktid/1.xml](<oigusaktid/1.xml>) |\n';
  const written = markdownWithCorpus(page, state);
  // What is on the server, in a reader's words, right after the folder table.
  assert.match(written, /\| oigusaktid \| 2 \| 2 \| Aktid\. \|\n\n<!-- corpus-state:start[^\n]*-->\n## RAG-i seis: mis on serveris \(korpus v64\)\n/u);
  assert.match(written, /Seis 07\.10\.2026: serveris töötav RAG \(korpus \*\*v64\*\*, indeks `7d209c63`\) sisaldab \*\*12 dokumenti\*\* \(45 596 lõiku\)\./u);
  assert.match(written, /\| Omavalitsuste teenused ja toetused \| 1 \| jaotis „Sisufailid“ \|\n\| Taotlusvormid \(vastuses antakse lingina\) \| 1 \| jaotis „Sisufailid“ \|\n\| Omavalitsuste kontaktid \| 4 \| faili lõpus arvudena/u);
  assert.match(written, /\| Muu \(new_kind\) \| 1 \|  \|\n\| \*\*Kokku\*\* \| \*\*12\*\* \| \|/u);
  // Where the source files are kept is a developer's matter, folded away.
  assert.match(written, /<details><summary>Tehniline jaotus arendajale: kus allikafailid asuvad<\/summary>/u);
  assert.match(written, /\| `KOV` \| 3 \| application_form 1, kov_service_info 1, official_contact 1 \|/u);
  assert.match(written, /Koodihoidla allikafailid, mida RAG-is ei ole \(1\):\n\n- `oigusaktid\/2\.xml`\n\n<\/details>/u);
  // The lists stand at the end; a bar in a title does not break the table; the publisher's name is not repeated.
  assert.match(written, /\n## RAG-is olevad lehed ja kontaktid\n/u);
  assert.match(written, /\| Näidisliit \| Mis on \\\| haigus \| <https:\/\/liit\.example\/haigus> \|/u);
  assert.match(written, /### Omavalitsuste kontaktid \(4\)\n\nAinult arvud: [^\n]+\n\n\| Omavalitsus \| Dokumente \|\n\|---\|---:\|\n\| Näidise vald \| 3 \|\n\| Teise vald \| 1 \|/u);
  assert.match(written, /<!-- corpus-outside:end -->\n$/u);
  for (const name of ['Mari Tammsalu', 'Jaan Tammsalu', 'Rein Tammsalu', 'Sotsiaalosakond']) { assert.equal(written.includes(name), false, name); assert.equal(JSON.stringify(next).includes(name), false, name); }
  // The page's own parts stay, and a second writing gives the same page.
  assert.match(written, /## Kasutamine\n\nTekst\.\n\n## Sisufailid\n/u);
  assert.equal(markdownWithCorpus(written, state), written);
  assert.throws(() => markdownWithCorpus('# Register\n', state), /no "## Kasutamine"/u);
});
