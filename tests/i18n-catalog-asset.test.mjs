// Tekstikataloog ei ole enam iga lehe HTML-i sees.
//
// Juurpaigutus andis kogu keelefaili (umbes 800 kB) kliendile atribuudina: see
// kirjutati iga lehe sisse ja laaditi iga lehe avamisega uuesti. Nüüd viitab leht
// eraldi failile `/i18n/<keel>.<räsi>.js`, mis püsib brauseri vahemälus, kuni tekstid
// muutuvad. Siin on lubadused, mida silm ei näe: fail annab täpselt sama kataloogi,
// nimi muutub koos sisuga, vana nimi ei jää vale sisuga vahemällu, fail on pakitud,
// laadija ei jää tõrke järel lõputult ootama ja kataloogi ei saa kogemata lehe sisse
// ega põhikimpu tagasi tuua.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';

import {
  CATALOG_ASSET_PREFIX,
  CATALOG_GLOBAL,
  CATALOG_SERVER_GLOBAL,
  buildCatalogScript,
  catalogAsset,
  catalogScriptPath,
  packedCatalogAsset,
  pickEncoding,
  resolveCatalogAsset
} from '../lib/i18n/catalogAsset.js';
import { CATALOG_LOCALES, createCatalogLoader, hasTexts, normalizeCatalogLocale } from '../lib/i18n/catalogLoader.js';
import { GET } from '../app/i18n/[asset]/route.js';
import { readCatalog, refreshCatalog } from '../components/i18n/catalogs.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const LANGS = ['et', 'en', 'ru'];

/* Käivitab kataloogi skripti tühjas keskkonnas, nagu brauser seda teeks. */
function runScript(body) {
  const sandbox = {};
  sandbox.self = sandbox;
  vm.runInNewContext(body, sandbox);
  return sandbox[CATALOG_GLOBAL];
}

test('fail annab täpselt sama kataloogi, mis on keelefailis, igas keeles', () => {
  assert.deepEqual([...CATALOG_LOCALES].sort(), [...LANGS].sort());
  for (const lang of LANGS) {
    const asset = catalogAsset(lang);
    const loaded = runScript(asset.body);
    assert.deepEqual(Object.keys(loaded), [lang]);
    assert.equal(JSON.stringify(loaded[lang]), JSON.stringify(catalog(lang)), lang);
    assert.equal(asset.path, `${CATALOG_ASSET_PREFIX}${lang}.${asset.hash}.js`);
    assert.match(asset.hash, /^[0-9a-f]{16}$/);
    assert.equal(catalogScriptPath(lang), asset.path);
  }
  /* Kaks keelt samal lehel ei kirjuta teineteist üle (keelevahetuse järel võib mõlemat vaja minna). */
  const both = {};
  both.self = both;
  vm.runInNewContext(catalogAsset('et').body, both);
  vm.runInNewContext(catalogAsset('en').body, both);
  assert.deepEqual(Object.keys(both[CATALOG_GLOBAL]).sort(), ['en', 'et']);
});

test('märgid, mis skripti sees katki läheksid, jõuavad kohale muutmata', () => {
  const tricky = {
    quotes: 'Ta ütles: "tere" ja \'aitäh\'.',
    backslash: 'C:' + String.fromCharCode(92) + 'kaust' + String.fromCharCode(92) + 'fail',
    lines: 'rida 1' + String.fromCharCode(10) + 'rida 2' + String.fromCharCode(13),
    separators: 'a' + String.fromCharCode(0x2028) + 'b' + String.fromCharCode(0x2029) + 'c',
    tag: '</script><script>alert(1)</script>',
    letters: 'õäöü šž ёжик „jutumärgid”',
    nested: { list: ['üks', 'kaks'], empty: '' }
  };
  const body = buildCatalogScript('et', tricky);
  /* Teise keskkonna objektil on oma prototüüp: võrreldakse sisu. */
  assert.equal(JSON.stringify(runScript(body).et), JSON.stringify(tricky));
  /* Lähtefailis endas ei ole reavahe märke, mis lõpetaksid JS-sõne. */
  assert.ok(!body.includes(String.fromCharCode(0x2028)) && !body.includes(String.fromCharCode(0x2029)) && !body.includes(String.fromCharCode(10)));
  /* Tundmatu keel on eesti keel, nagu paigutuses. */
  assert.deepEqual(Object.keys(runScript(buildCatalogScript('xx', { a: 'b' }))), ['et']);
});

test('nimi muutub koos sisuga ja vana nimi ei jää vale sisuga vahemällu', () => {
  const asset = catalogAsset('et');
  const name = asset.path.slice(CATALOG_ASSET_PREFIX.length);
  assert.deepEqual(resolveCatalogAsset(name), { ...asset, current: true });
  /* Vana räsi (leht avati enne tekstide muutumist): praegune kataloog, aga märgitud vananenuks. */
  const stale = resolveCatalogAsset('et.0123456789abcdef.js');
  assert.equal(stale.current, false);
  assert.equal(stale.body, asset.body);
  for (const bad of ['xx.0123456789abcdef.js', 'et.js', 'et.0123.js', 'et.0123456789ABCDEF.js', '../et.0123456789abcdef.js', 'et.0123456789abcdef.json', '', null]) {
    assert.equal(resolveCatalogAsset(bad), null, String(bad));
  }
  /* Räsi tuleb skripti sisust: üks muudetud täht annab teise nime. */
  const one = buildCatalogScript('et', { a: 'tekst' });
  const two = buildCatalogScript('et', { a: 'tekst.' });
  assert.notEqual(one, two);
});

test('marsruut: õige nimi püsib vahemälus, vana nimi mitte, tundmatu nimi on 404', async () => {
  const asset = catalogAsset('et');
  const call = (name, accept) => GET(new Request(`http://localhost/i18n/${name}`, accept === undefined ? {} : { headers: { 'accept-encoding': accept } }), { params: Promise.resolve({ asset: name }) });

  const fresh = await call(asset.path.slice(CATALOG_ASSET_PREFIX.length), 'gzip, deflate, br');
  assert.equal(fresh.status, 200);
  assert.equal(fresh.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(fresh.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(fresh.headers.get('content-encoding'), 'br');
  assert.equal(fresh.headers.get('vary'), 'Accept-Encoding');
  const brBytes = Buffer.from(await fresh.arrayBuffer());
  assert.equal(Number(fresh.headers.get('content-length')), brBytes.length);
  assert.equal(zlib.brotliDecompressSync(brBytes).toString('utf8'), asset.body);
  /* Pakitud fail on vähemalt kolm korda väiksem kui pakkimata. */
  assert.ok(brBytes.length * 3 < Buffer.byteLength(asset.body), `${brBytes.length} / ${Buffer.byteLength(asset.body)}`);

  const gz = await call(asset.path.slice(CATALOG_ASSET_PREFIX.length), 'gzip');
  assert.equal(gz.headers.get('content-encoding'), 'gzip');
  assert.equal(zlib.gunzipSync(Buffer.from(await gz.arrayBuffer())).toString('utf8'), asset.body);

  const plain = await call(asset.path.slice(CATALOG_ASSET_PREFIX.length));
  assert.equal(plain.headers.get('content-encoding'), null);
  assert.equal(await plain.text(), asset.body);

  const stale = await call('et.0123456789abcdef.js', 'gzip');
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('cache-control'), 'no-store');

  const missing = await call('xx.0123456789abcdef.js', 'gzip');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
});

test('pakkimise valik: brotli enne gzipi, keeld (q=0) loeb, tundmatu päis jätab pakkimata', async () => {
  assert.equal(pickEncoding('gzip, deflate, br, zstd'), 'br');
  assert.equal(pickEncoding('GZIP, deflate'), 'gzip');
  assert.equal(pickEncoding('br;q=0, gzip'), 'gzip');
  assert.equal(pickEncoding('br;q=0.0, gzip;q=0'), '');
  assert.equal(pickEncoding('br;q=0.5'), 'br');
  assert.equal(pickEncoding('identity'), '');
  assert.equal(pickEncoding(''), '');
  assert.equal(pickEncoding(null), '');
  /* Sama keele ja pakkimisviisi tulemus arvutatakse üks kord. */
  const asset = catalogAsset('en');
  const first = await packedCatalogAsset(asset, 'gzip');
  const second = await packedCatalogAsset(asset, 'gzip');
  assert.equal(first.bytes, second.bytes);
  assert.equal(first.encoding, 'gzip');
  /* Lehe paigutus ja faili marsruut saavad serveris kumbki oma koopia sellest moodulist. Paigutus paneb
     pakkimise käima (aadressi küsides), marsruut peab saama sama tulemuse, mitte pakkima uuesti. */
  const copy = await import('../lib/i18n/catalogAsset.js?teine-koopia');
  assert.notEqual(copy.packedCatalogAsset, packedCatalogAsset, 'see on tõesti teine koopia');
  copy.catalogScriptPath('ru');
  const warmed = await packedCatalogAsset(catalogAsset('ru'), 'br');
  const again = await copy.packedCatalogAsset(copy.catalogAsset('ru'), 'gzip, br');
  assert.equal(warmed.bytes, again.bytes, 'mõlemad koopiad jagavad pakitud baite');
  assert.equal(zlib.brotliDecompressSync(warmed.bytes).toString('utf8'), catalogAsset('ru').body);
});

test('laadija: üks lubadus keele kohta, üks kordus, ja tõrke järel ei jää keegi ootama', async () => {
  assert.equal(normalizeCatalogLocale('RU'), 'ru');
  assert.equal(normalizeCatalogLocale('de'), 'et');
  assert.equal(normalizeCatalogLocale(null), 'et');
  assert.equal(hasTexts({ a: 1 }), true);
  for (const empty of [{}, null, undefined, 'tekst', 0]) assert.equal(hasTexts(empty), false);

  const calls = { et: 0, en: 0, ru: 0 };
  let ruWorks = false;
  const loader = createCatalogLoader({
    et: async () => { calls.et += 1; return { default: { hello: 'tere' } }; },
    /* Esimene katse kukub, teine õnnestub: kordus on laadija sees. */
    en: async () => { calls.en += 1; if (calls.en === 1) throw new Error('võrk'); return { hello: 'hello' }; },
    ru: async () => { calls.ru += 1; if (!ruWorks) throw new Error('võrk'); return { default: { hello: 'привет' } }; }
  });

  assert.equal(loader.peek('et'), null);
  const first = loader.load('et');
  assert.equal(loader.load('et'), first, 'sama lubadus igale küsijale (React’i use vajab püsivat lubadust)');
  assert.deepEqual(await first, { hello: 'tere' });
  assert.deepEqual(loader.peek('et'), { hello: 'tere' });
  assert.equal(calls.et, 1);
  assert.equal(loader.load('xx'), first, 'tundmatu keel on eesti keel');

  assert.deepEqual(await loader.load('en'), { hello: 'hello' });
  assert.equal(calls.en, 2);

  /* Kaks ebaõnnestunud katset: tühi kataloog, mitte viga. `load` annab edasi SAMA lubaduse (muidu
     jääks ootav leht iga joonistusega uut lubadust ootama); uue katse teeb `refresh`. */
  const failed = loader.load('ru');
  assert.deepEqual(await failed, {});
  assert.equal(calls.ru, 2);
  assert.equal(loader.load('ru'), failed);
  assert.equal(calls.ru, 2);
  assert.equal(loader.peek('ru'), null);
  ruWorks = true;
  const again = loader.refresh('ru');
  assert.notEqual(again, failed);
  assert.deepEqual(await again, { hello: 'привет' });
  assert.equal(loader.refresh('ru'), again, 'õnnestunud kataloogi uuesti ei laadita');
  assert.deepEqual(loader.peek('ru'), { hello: 'привет' });
  /* Tühi vastus loeb tõrkeks: tühja kataloogi ei peeta õnnestumiseks. */
  const blank = createCatalogLoader({ et: async () => ({ default: {} }), en: async () => ({}), ru: async () => null });
  assert.deepEqual(await blank.load('et'), {});
  assert.equal(blank.peek('et'), null);
});

test('kataloog ei lähe lehe HTML-i sisse ega lehe põhikimpu', () => {
  const layout = read('../app/layout.js');
  /* Paigutus ei laadi keelefaili ega anna kataloogi kliendile atribuudina. */
  assert.ok(!/messages\/(et|en|ru)\.json/.test(layout), 'paigutus ei impordi keelefaili');
  assert.ok(!/<Providers[^>]*\bmessages=/.test(layout), 'kataloogi ei anta atribuudina');
  const providers = read('../app/providers.jsx');
  assert.ok(!/\bmessages\b/.test(providers), 'vahekiht ei kanna kataloogi edasi');
  /* Skript on keha lõpus, tavaline (mitte async ega defer): käivitub enne, kui React lehe elustab. */
  const tag = /<script id="i18n-catalog"[^>]*\/>/.exec(layout)?.[0] || '';
  assert.equal(tag, '<script id="i18n-catalog" src={catalogSrc} />');
  assert.ok(layout.includes('const catalogSrc = catalogScriptPath(locale);'));
  assert.ok(layout.indexOf(tag) > layout.indexOf('</Providers>') && layout.indexOf(tag) < layout.indexOf('</body>'), 'skript on keha lõpus pärast lehe sisu');

  /* Pakkuja loeb kataloogi ootamata ja ootab (`use`) ainult siis, kui seda ei ole. */
  const provider = read('../components/i18n/I18nProvider.jsx');
  assert.ok(provider.includes('const [ready] = useState(() => readCatalog(initialLocale));'));
  assert.ok(provider.includes('const loaded = ready || use(pending);'));
  assert.ok(!/\bmessages\s*=\s*\{\}/.test(provider), 'pakkuja ei võta kataloogi atribuudina');

  /* Kliendi kood ei impordi keelefaili tavalise impordiga: ainus koht on laadija kolm `import()` rida. */
  const catalogs = read('../components/i18n/catalogs.js');
  assert.equal([...catalogs.matchAll(/import\("@\/messages\/(et|ru|en)\.json"\)/g)].length, 3);
  assert.ok(!/^import [^\n]*messages\/[a-z]{2}\.json/m.test(catalogs));
  assert.ok(catalogs.includes(`"${CATALOG_GLOBAL}"`) && catalogs.includes(`"${CATALOG_SERVER_GLOBAL}"`), 'kliendi ja serveri pool kasutavad sama kohta');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(path); continue; }
      if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
      if (/messages\/(et|en|ru)\.json/.test(read(path)) && path !== '../components/i18n/catalogs.js') offenders.push(path);
    }
  };
  walk('../components');
  walk('../app');
  assert.deepEqual(offenders, [], 'keelefaili impordib ainult components/i18n/catalogs.js');
});

test('välitöö võrguta kest hoiab kataloogi faili', () => {
  const worker = read('../public/sw.js');
  assert.ok(worker.includes('url.pathname.startsWith("/i18n/")'), 'kataloogi fail on kesta staatiline osa');
  /* API vastuseid ei hoita endiselt kunagi ja vahemälu nimed ei muutunud (vana kest jääb alles). */
  assert.ok(worker.includes('if (isApiRequest(url)) return;'));
  assert.ok(worker.includes('const SW_VERSION = "field-v1-1";'));
  /* Vana nimega (vahemäluta märgitud) vastust ei hoita. */
  assert.ok(worker.includes('!/no-store/i.test(response.headers.get("Cache-Control") || "")'));
  /* Hoiule panekut ei oodata vastuse teel: täis seade ei tohi faili päringut nurjata. */
  assert.ok(!/await cache\.put\(/.test(worker), 'hoiule panekut ei oodata');
});

/* Käivitab teenusetöötaja faili võltsitud keskkonnas ja laseb sellel päringuid teenindada. */
function runWorker({ putFails = () => false } = {}) {
  const store = new Map();
  const cache = {
    match: async (request) => store.get(request.url) || undefined,
    put: async (request, response) => {
      if (putFails()) throw new Error('QuotaExceededError');
      store.set(request.url, response);
    },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (request) => store.delete(request.url)
  };
  const handlers = {};
  const served = [];
  const sandbox = {
    URL, Response, Headers, Promise,
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (request) => {
      served.push(request.url);
      const stale = request.url.includes('0000000000000000');
      return new Response('body of ' + request.url, { status: 200, headers: { 'Cache-Control': stale ? 'no-store' : 'public, max-age=31536000, immutable' } });
    },
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim: async () => {} }, skipWaiting: () => {} }
  };
  sandbox.self.caches = sandbox.caches;
  vm.runInContext(read('../public/sw.js'), vm.createContext(sandbox));
  const ask = async (path) => {
    let answer = null;
    handlers.fetch({ request: { method: 'GET', url: 'https://example.test' + path, mode: 'no-cors' }, respondWith: (promise) => { answer = promise; } });
    return answer ? (await answer).text() : null;
  };
  return { ask, served, stored: () => [...store.keys()].map((url) => url.replace('https://example.test', '')).sort() };
}

test('võrguta kest: varasema ehituse leht leiab oma kataloogi, vana nimega vastust ei hoita', async () => {
  const worker = runWorker();
  await worker.ask('/i18n/et.aaaaaaaaaaaaaaaa.js');
  await worker.ask('/i18n/ru.cccccccccccccccc.js');
  assert.deepEqual(worker.stored(), ['/i18n/et.aaaaaaaaaaaaaaaa.js', '/i18n/ru.cccccccccccccccc.js']);
  /* Tekstid muutusid ja teine leht tõi uue faili. Varem hoitud välitöö leht viitab endiselt vanale
     failile: see peab alles jääma, muidu näitaks leht võrguta võtmeid. */
  await worker.ask('/i18n/et.bbbbbbbbbbbbbbbb.js');
  assert.deepEqual(worker.stored(), ['/i18n/et.aaaaaaaaaaaaaaaa.js', '/i18n/et.bbbbbbbbbbbbbbbb.js', '/i18n/ru.cccccccccccccccc.js']);
  /* Juba hoitud fail tuleb vahemälust: serverit teist korda ei küsita. */
  const before = worker.served.length;
  assert.equal(await worker.ask('/i18n/et.aaaaaaaaaaaaaaaa.js'), 'body of https://example.test/i18n/et.aaaaaaaaaaaaaaaa.js');
  assert.equal(worker.served.length, before);
  /* Vana nimega vastust (vahemäluta) ei hoita. */
  assert.equal(await worker.ask('/i18n/et.0000000000000000.js'), 'body of https://example.test/i18n/et.0000000000000000.js');
  assert.equal(worker.stored().length, 3);
  /* API päringut töötaja ei puuduta (ei vasta ise ega hoia). */
  assert.equal(await worker.ask('/api/health'), null);
});

test('võrguta kest: täis seade ei nurja faili päringut', async () => {
  let full = true;
  const worker = runWorker({ putFails: () => full });
  /* Hoiule panek ebaõnnestub, vastus jõuab ikka kohale (nii kataloog kui ehitaja fail). */
  assert.equal(await worker.ask('/i18n/et.aaaaaaaaaaaaaaaa.js'), 'body of https://example.test/i18n/et.aaaaaaaaaaaaaaaa.js');
  assert.equal(await worker.ask('/_next/static/chunks/a.js'), 'body of https://example.test/_next/static/chunks/a.js');
  assert.deepEqual(worker.stored(), []);
  /* Kui ruumi on jälle, pannakse järgmine vastus hoiule. */
  full = false;
  await worker.ask('/i18n/et.aaaaaaaaaaaaaaaa.js');
  assert.deepEqual(worker.stored(), ['/i18n/et.aaaaaaaaaaaaaaaa.js']);
});

test('serveri joonistus ja brauser loevad kataloogi kumbki oma kohast', async () => {
  /* Server: faili lib/i18n/catalogAsset.js laadimine paneb kataloogid serveri mällu ja pakkuja loeb
     sealt. Kui see rida kaoks, joonistaks server lehe võtmetega. */
  for (const lang of LANGS) {
    assert.equal(JSON.stringify(globalThis[CATALOG_SERVER_GLOBAL][lang]), JSON.stringify(catalog(lang)), lang);
    assert.equal(readCatalog(lang), globalThis[CATALOG_SERVER_GLOBAL][lang], lang);
    /* Käesolevat kataloogi uuesti ei laadita. */
    assert.equal(await refreshCatalog(lang), globalThis[CATALOG_SERVER_GLOBAL][lang], lang);
  }
  assert.equal(readCatalog('xx'), globalThis[CATALOG_SERVER_GLOBAL].et, 'tundmatu keel on eesti keel');

  /* Brauser: loetakse lehe skripti pandud kohta, mitte serveri oma. */
  globalThis.window = { [CATALOG_GLOBAL]: { en: { hello: 'hello' } } };
  try {
    assert.deepEqual(readCatalog('en'), { hello: 'hello' });
    assert.deepEqual(await refreshCatalog('en'), { hello: 'hello' });
    /* Keelt, mida lehe skript ei toonud, serveri mälust ei võeta: vastus on „ei ole käes". */
    assert.equal(readCatalog('ru'), null);
    /* Tühi kataloog ei loe käesolevaks. */
    globalThis.window = { [CATALOG_GLOBAL]: { en: {} } };
    assert.equal(readCatalog('en'), null);
  } finally {
    delete globalThis.window;
  }

  /* Pakkuja näitab hiljem vahetatud kataloogi (keelevahetus), muidu seda, millega leht avati. */
  const provider = read('../components/i18n/I18nProvider.jsx');
  assert.ok(provider.includes('const dict = replaced || loaded;'));
  assert.ok(provider.includes('const val = get(dict, key, undefined);'));
  /* Salvestatud keel jääb: akna sulgemine ei pane tagasi keelt, millega aken avati. */
  const modal = read('../components/accessibility/AccessibilityModal.jsx');
  const save = modal.slice(modal.indexOf('const save = async () => {'));
  const cleared = save.indexOf('previewedLangRef.current = null;');
  assert.ok(cleared > 0 && cleared < save.indexOf('onClose?.();'), 'eelvaate märk võetakse maha enne akna sulgemist');
});
