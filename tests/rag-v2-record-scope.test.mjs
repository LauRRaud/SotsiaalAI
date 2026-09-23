import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveRecordScope } from '../lib/rag-v2/pilot/record-scope.js';
import { EstnltkAnalyzer } from '../lib/rag-v2/search/estnltk.js';
import { MUNICIPALITY_DATA_PATH } from '../lib/help/municipalityData.js';

// Real local EstNLTK (RAG_V2_ESTNLTK_PYTHON) and the canonical municipality seed.
// The sentences are fixtures; the runtime has no inflection or place-word lists.
const analyzer = new EstnltkAnalyzer();
after(() => analyzer.close());
const seed = JSON.parse(await fs.readFile(MUNICIPALITY_DATA_PATH, 'utf8'));
const directory = (Array.isArray(seed) ? seed : Object.values(seed).find(Array.isArray))
  .map(row => ({ region: row.slug.replaceAll('-', '_'), names: [...new Set([row.displayName, row.baseName])] }));
const scope = text => resolveRecordScope([{ turnId: 't1', text, mode: 'same' }], directory, analyzer);

test('a municipality is selected by its own canonical name, not by other readings or shared compound parts', async () => {
  for (const [text, region] of [
    ['Elan Lääne-Harju vallas', 'laane_harju_vald'], ['Elan Pärnus', 'parnu_linn'], ['Elan Narvas', 'narva_linn'],
    ['Ta elab Narva-Jõesuus', 'narva_joesuu_linn'], ['Saaremaal on raske abi saada', 'saaremaa_vald'], ['Elan Tallinnas', 'tallinn'],
    ['Kolisin Tapale', 'tapa_vald'], ['elan harkus', 'harku_vald'], ['Elan Tartu vallas', 'tartu_vald'], ['Elame Väike-Maarjas', 'vaike_maarja_vald'],
  ]) assert.equal((await scope(text)).region, region, text);
  for (const text of ['Ema elab Tartus', 'Rakveres elan']) assert.equal((await scope(text)).state, 'ambiguous_region', text);
});

test('ordinary words that share a reading or compound part with a municipality do not select it', async () => {
  for (const text of ['Tahan end tappa', 'Mulk on mu vanaisa', 'Mul on põlve valu', 'Elan üksi, raske on toimetulek'])
    assert.equal((await scope(text)).region, null, text);
  // Known limit: an identical surface form ("kanepi" = genitive of hemp and the
  // municipality name) still matches. The answer model must treat it as tentative.
  assert.equal((await scope('Kas kanepi tarvitamine on ohtlik?')).region, 'kanepi_vald');
});
