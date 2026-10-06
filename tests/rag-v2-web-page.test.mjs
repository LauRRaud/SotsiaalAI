import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractPage, emailKind, robotsAllows, subpageLinks, pageMetadata, decidePage, WEB_PAGE_COLLECTOR } from '../lib/rag-v2/web-page.js';
import { fetchPage, collectEntry, subpageId, siteManners, COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';
import { adaptMetadata } from '../lib/rag-v2/metadata-adapter.js';
import { ingest } from '../lib/rag-v2/ingestion.js';

// A page of the kind an agency's site serves: the site's menus and notices around a content region with headings,
// an accordion, a list, a table, links to documents and contacts. Every name, address and number is made up.
const PAGE = `<!doctype html><html lang="et"><head><title>Abivahendi vajajale | Näidisamet</title><meta charset="utf-8"><script>window.x = 'skript';</script></head><body>
<div class="cookie-banner"><p>See leht kasutab küpsiseid.</p><button>Nõustun</button></div>
<header><a href="/">Näidisamet</a><nav><ul><li><a href="/teenused">Teenused</a></li><li><a href="/kontakt">Kontakt</a></li></ul></nav></header>
<main>
  <nav class="breadcrumb"><a href="/">Avaleht</a> › <a href="/puue">Puue</a></nav>
  <div class="hero-banner"><h1>Abivahendi  vajajale</h1></div>
  <div class="page-title">Abivahendi vajajale</div>
  <aside><h2>Samas jaotises</h2><ul><li><a href="/puue/abivahendid/abivahendi-vajajale/taotlemine">Taotlemine</a></li><li><a href="/puue/abivahendid/abivahendi-vajajale/hinnad">Hinnad</a></li></ul></aside>
  <div class="content">
    <p>Abivahend on toode, mille abil saab <strong>parandada</strong> iseseisvat toimetulekut.<br>Abivahendit saab osta või üürida.</p>
    <p>Riik hüvitab osa abivahendi hinnast, kui inimesel on selleks õigus ja abivahend on kehtivas loetelus.</p>
    <h2>Kes saab abivahendit soodustusega?</h2>
    <ul><li>Laps kuni 18-aastane</li><li>Vanaduspensioniealine inimene<ul><li>ka ilma puudeta</li></ul></li><li class="share">Jaga</li></ul>
    <button aria-expanded="false" aria-controls="p1">Kuidas abivahendit taotleda?</button>
    <div id="p1" aria-hidden="true"><p>Pöördu perearsti poole ja võta kaasa <a href="/media/123/download">abivahendi tõend (pdf)</a>.</p>
      Loe ka <a href="https://www.riigiteataja.ee/akt/123">määrust</a> ja <a href="taotlus.docx">taotluse vormi</a>.</div>
    <table><caption>Piirhinnad</caption><thead><tr><th>Abivahend</th><th>Piirhind</th></tr></thead><tbody><tr><td>Ratastool</td><td>350 €</td></tr><tr><td>Kepp</td><td></td></tr></tbody></table>
    <h2>Küsimustele vastavad</h2>
    <p><strong>Tiit Tamm</strong><br>peaspetsialist<br>5555 0000<br><a href="/cdn-cgi/l/email-protection#a1b2">[email&#160;protected]</a></p>
    <h2>Kontakt</h2>
    <p>Üldinfo: info@naidisamet.example, tel 612 0000.</p>
    <p>Peaspetsialist Mari Maasikas, mari.maasikas@naidisamet.example, tel +372 5555 1234.</p>
    <ul><li>Kati Kask, tel 5555 1111</li><li>Infotelefon 612 1111</li></ul>
    <p>Küsimuste korral kirjuta aadressile mari.maasikas@naidisamet.example või helista 5555 1234.</p>
    <p>Kirjuta <a href="mailto:jaan.tamm@naidisamet.example">Jaan Tammele</a>.</p>
    <form><input name="q"><button>Otsi</button></form>
    <img src="pilt.png" alt="pilt">
    <p><a href="/otsing?filters%5Bkeyword%5D=puue">puue</a> <a href="/otsing?filters%5Bkeyword%5D=abivahend">abivahend</a></p>
    <p>Viimati uuendatud 23.09.2026</p>
    <p>Täname tagasiside eest!</p>
  </div>
</main>
<footer><p>Näidisamet, Näidise 1, Tallinn</p></footer></body></html>`;
const URL_PAGE = 'https://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale';

test('a page keeps what it says: the content region as one article, without the site around it', () => {
  const page = extractPage(PAGE, URL_PAGE);
  assert.equal(page.region, 'main');
  assert.equal(page.title, 'Abivahendi vajajale');
  assert.equal(page.language, 'et');
  assert.match(page.html, /^<!doctype html><html lang="et"><meta charset="utf-8"><title>Abivahendi vajajale<\/title><body><article>\n<h1>Abivahendi vajajale<\/h1>\n/u);
  assert.equal(page.html.match(/<article>/gu).length, 1);
  // The site's own parts are gone: the cookie notice, menus, the trail, the section list, the form, media, the footer.
  for (const gone of ['küpsiseid', 'Nõustun', 'Teenused', 'Avaleht', 'Samas jaotises', 'Otsi', 'pilt', 'Näidise 1', 'skript', 'Jaga', 'Piirhinnad']) assert.equal(page.html.includes(gone), false, gone);
  // The page's own text stays, in its order and structure.
  assert(page.html.includes('<p>Abivahend on toode, mille abil saab <strong>parandada</strong> iseseisvat toimetulekut.\nAbivahendit saab osta või üürida.</p>'));
  assert(page.html.includes('<h2>Kes saab abivahendit soodustusega?</h2>\n<ul><li>Laps kuni 18-aastane</li><li><p>Vanaduspensioniealine inimene</p><ul><li>ka ilma puudeta</li></ul></li></ul>'));
  // An accordion's question is a heading and its panel is read though the page hides it.
  assert(page.html.includes('<h4>Kuidas abivahendit taotleda?</h4>\n<p>Pöördu perearsti poole ja võta kaasa <a href="https://www.naidisamet.example/media/123/download">abivahendi tõend (pdf)</a>.</p>'));
  assert(page.html.includes('<p>Loe ka <a href="https://www.riigiteataja.ee/akt/123">määrust</a> ja <a href="https://www.naidisamet.example/puue/abivahendid/taotlus.docx">taotluse vormi</a>.</p>'));
  assert(page.html.includes('<table><thead><tr><th>Abivahend</th><th>Piirhind</th></tr></thead><tbody><tr><td>Ratastool</td><td>350 €</td></tr><tr><td>Kepp</td><td></td></tr></tbody></table>'));
  // Documents the page links to are listed, to be given by link.
  assert.deepEqual(page.documents, [{ url: 'https://www.naidisamet.example/media/123/download', text: 'abivahendi tõend (pdf)', type: 'download' },
    { url: 'https://www.naidisamet.example/puue/abivahendid/taotlus.docx', text: 'taotluse vormi', type: 'docx' }]);
  // The site's lines inside the content region go too: the title's repeat, the row of tag links, the feedback line.
  for (const gone of ['page-title', 'filters', 'Täname tagasiside', 'Viimati uuendatud']) assert.equal(page.html.includes(gone), false, gone);
  assert.equal(page.html.match(/Abivahendi vajajale/gu).length, 2, 'the title stands in <title> and in the heading, not a third time');
  // The page's own update date is its metadata.
  assert.equal(page.updated, '2026-09-23');
  assert.deepEqual(page.stats, { words: page.stats.words, blocks: 14, headings: 4, tables: 1, links: 3, linksToOtherSites: 1 });
  assert(page.stats.words >= 80 && page.stats.words < 100);
});

test('a person\'s contact does not go into the stored copy; a general channel stays; the page is marked for review', () => {
  const page = extractPage(PAGE, URL_PAGE);
  assert(page.html.includes('<p>Üldinfo: info@naidisamet.example, tel 612 0000.</p>'), 'the institution\'s own channel is what the page tells the reader to use');
  // A contact card (a person named beside a phone number or an address) goes whole: in a paragraph, in a list item,
  // and where the site hides the address behind its e-mail protection. The heading left with nothing under it goes too.
  for (const gone of ['Mari Maasikas', 'Tiit Tamm', 'Kati Kask', 'peaspetsialist', 'Küsimustele vastavad', '5555 0000', '5555 1111', 'protected', 'email-protection']) assert.equal(page.html.includes(gone), false, gone);
  assert(page.html.includes('<h2>Kontakt</h2>\n<p>Üldinfo: info@naidisamet.example, tel 612 0000.</p>\n<ul><li>Infotelefon 612 1111</li></ul>'));
  // In a sentence that names no one, the person's address and the number beside it are removed and the sentence stays.
  assert(page.html.includes('<p>Küsimuste korral kirjuta aadressile [e-post eemaldatud] või helista [telefon eemaldatud].</p>'));
  assert.equal(/mari\.maasikas@|5555 1234|jaan\.tamm@/u.test(page.html), false);
  assert(page.html.includes('<p>Kirjuta Jaan Tammele.</p>'), 'a link that writes to a person keeps its words and loses its address');
  assert.deepEqual(page.contacts, { generalEmails: 1, otherEmails: 0, personLinks: 1, contactCards: 3, personalEmails: 1, phonesBesideThem: 1 });
  assert.deepEqual(page.warnings, ['contact_card_removed', 'personal_contact_removed', 'person_named_by_link']);
  assert.equal(page.needsReview, true, 'the name may still stand in the text');
  for (const [address, kind] of [['info@amet.example', 'general'], ['klienditugi@amet.example', 'general'], ['abivahendid@amet.example', 'general'], ['mari.maasikas@amet.example', 'personal'],
    ['jaan_tamm2@amet.example', 'personal'], ['sotsiaal.osakond@vald.example', 'other'], ['mari@amet.example', 'other']]) assert.equal(emailKind(address), kind, address);
  // A number in a link's address is not the page's wording and is left alone.
  const linked = extractPage('<main><h1>Leht</h1><p>Kirjuta mari.maasikas@amet.example või vaata <a href="/akt/12345678">akti 12345678</a>.</p></main>', 'https://amet.example/x');
  assert(linked.html.includes('<a href="https://amet.example/akt/12345678">akti [telefon eemaldatud]</a>'));
  // A page whose only contacts were cards is not held for review: no name is left in it.
  const cards = extractPage(`<main><h1>Leht</h1><p>${'Sisu on siin pikemalt kirjas. '.repeat(20)}</p><table><tr><td>Mari Maasikas</td><td>5555 1234</td></tr><tr><td>Infotelefon</td><td>612 0000</td></tr></table></main>`, 'https://amet.example/x');
  assert.deepEqual([cards.contacts.contactCards, cards.needsReview, cards.html.includes('Maasikas'), cards.html.includes('<tr><td>Infotelefon</td><td>612 0000</td></tr>')], [1, false, false, true]);
});

test('a page without a content region is read from its body with its menus left out, and says so', () => {
  const page = extractPage(`<html><head><title>Juhis – Näidisleht</title></head><body><header><a href="/">Logo</a></header>
    <ul><li><a href="/a">Esimene</a></li><li><a href="/b">Teine</a></li><li><a href="/c">Kolmas</a></li><li><a href="/d">Neljas</a></li></ul>
    <div><p>Juhise sisu on siin lühidalt kirjas.</p><div>Lahtine tekst <em>rõhuga</em> ilma lõiguta.</div></div><footer>Jalus</footer></body></html>`, 'https://naidis.example/juhis');
  assert.deepEqual([page.region, page.title], ['body', 'Juhis']);
  assert.match(page.html, /<article>\n<h1>Juhis<\/h1>\n<p>Juhise sisu on siin lühidalt kirjas\.<\/p>\n<p>Lahtine tekst <em>rõhuga<\/em> ilma lõiguta\.<\/p>\n<\/article>/u);
  assert.deepEqual(page.warnings, ['content_region_not_marked', 'thin_content']);
  assert.equal(page.needsReview, true);
  // A hint names the region where the markup does not.
  const hinted = extractPage('<body><div id="sisu"><h1>Pealkiri</h1><p>Tekst.</p></div><div class="muu"><p>Kõrval.</p></div></body>', 'https://naidis.example/x', { region: '#sisu' });
  assert.deepEqual([hinted.region, hinted.html.includes('Kõrval')], ['hint', false]);
  // The same content gives the same hash whatever the markup around it; other content another.
  const again = extractPage('<main><section><h1>Pealkiri</h1><div><p>Tekst.</p></div></section></main>', 'https://naidis.example/y');
  assert.equal(again.contentSha256, hinted.contentSha256);
  assert.notEqual(extractPage('<main><h1>Pealkiri</h1><p>Teine tekst.</p></main>', 'https://naidis.example/y').contentSha256, hinted.contentSha256);
});

test('the stored page is a source the corpus reader takes as it is, and its metadata is what the adapter reads', async t => {
  const page = extractPage(PAGE, URL_PAGE), root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-web-page-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const entry = { source_id: 'naidisamet_abivahendi_vajajale', url: URL_PAGE, title: 'Näidisamet: Abivahendi vajajale', publisher: 'Näidisamet', source_type: 'web_page', topic_tags: ['abivahendid'], jurisdiction_level: 'NATIONAL' };
  const fetched = { status: 200, finalUrl: URL_PAGE, contentType: 'text/html; charset=utf-8', lastModified: null, etag: '"e1"', rawSha256: 'a'.repeat(64) };
  const metadata = pageMetadata({ entry, page, fetched, sourcePath: 'naidisamet_abivahendi_vajajale.html', checkedAt: new Date('2026-10-06T12:00:00Z') });
  assert.deepEqual([metadata.document_id, metadata.title, metadata.register_title, metadata.checked_at, metadata.legal_basis, metadata.collection.collector, metadata.collection.needs_review],
    ['web-naidisamet_abivahendi_vajajale', 'Abivahendi vajajale', 'Näidisamet: Abivahendi vajajale', '2026-10-06', false, WEB_PAGE_COLLECTOR, true]);
  assert.deepEqual(metadata.documents.map(item => item.status), ['referenced_only', 'referenced_only']);
  assert.equal('url_final' in metadata, false);
  assert.equal(pageMetadata({ entry, page, fetched: { ...fetched, finalUrl: 'https://naidisamet.example/uus' }, sourcePath: 'x.html' }).url_final, 'https://naidisamet.example/uus');
  const adapted = adaptMetadata(metadata, 'naidisamet_abivahendi_vajajale.json');
  assert.deepEqual([adapted.document_id, adapted.title, adapted.source_type, adapted.language, adapted.source_url, adapted.authority, adapted.last_checked],
    ['web-naidisamet_abivahendi_vajajale', 'Abivahendi vajajale', 'web_page', 'et', URL_PAGE, 'Näidisamet', '2026-10-06']);
  // Through the real ingest: one content region (no fallback warning), the page's own blocks and places.
  await fs.writeFile(path.join(root, 'source.html'), page.html);
  const { bundle } = await ingest({ tenant: 'web-page-test', inputRoot: root, storeRoot: path.join(root, 'store'), rights: { access: 'local_private', usage: 'development_only' },
    profile: { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] },
    metadata: { document_id: metadata.document_id, title: metadata.title, source_type: metadata.source_type, language: 'et', source_path: 'source.html', source_format: 'html', source_urls: [URL_PAGE] } });
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  assert.match(text, /Abivahend on toode/u); assert.match(text, /Kuidas abivahendit taotleda\?/u); assert.match(text, /Ratastool/u);
  assert.equal(/küpsiseid|Samas jaotises|mari\.maasikas/u.test(text), false);
  assert.equal(JSON.stringify(bundle.version).includes('html_content_region_fallback'), false);
  assert(bundle.chunks.every(chunk => chunk.source_locations.every(place => place.kind === 'html' && place.path.includes('/article[1]'))));
});

test('robots.txt is respected: the collector\'s own group, else the group for all; the longest rule decides', () => {
  const robots = 'User-agent: *\nDisallow: /admin/\nDisallow: /otsing\nAllow: /admin/avalik/\n\nUser-agent: halbrobot\nDisallow: /\n# märkus\nUser-agent: sotsiaalai\nDisallow: /mustand/*.html$\n';
  for (const [pathname, agent, allowed] of [['/puue/abivahendid', 'muu', true], ['/admin/x', 'muu', false], ['/admin/avalik/leht', 'muu', true], ['/otsing', 'muu', false],
    ['/admin/x', 'sotsiaalai source collector', true], ['/mustand/a.html', 'sotsiaalai source collector', false], ['/mustand/a.html?x', 'sotsiaalai source collector', true], ['/x', 'halbrobot', false]]) {
    assert.equal(robotsAllows(robots, pathname, agent), allowed, `${agent} ${pathname}`);
  }
  assert.equal(robotsAllows('', '/x'), true); assert.equal(robotsAllows('User-agent: *\nDisallow:\n', '/x'), true);
  assert.match(COLLECTOR_AGENT, /^SotsiaalAI source collector\/1\.0 \(\+https:\/\/sotsiaal\.pro\)$/u);
});

test('a page\'s sub-pages are the pages of the same site below its path, also those its section menu lists', () => {
  const links = subpageLinks(PAGE.replace('</main>', `<a href="https://naidisamet.example/puue/abivahendid/abivahendi-vajajale/taotlemine/">Taotlemine uuesti</a>
    <a href="/puue/abivahendid/abivahendi-vajajale/hinnad?print=1">Trükivaade</a><a href="/puue/abivahendid/abivahendi-vajajale/juhend.pdf">Juhend</a>
    <a href="/puue/abivahendid/abivahendi-vajajale">Sama leht</a><a href="/puue/abivahendid/muu">Naaber</a><a href="https://teine.example/puue/abivahendid/abivahendi-vajajale/x">Teine sait</a>
    <a href="http://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale/turvamata">http</a><a href="/puue/abivahendid/abivahendi-vajajale/kkk#vastus">KKK</a></main>`), URL_PAGE);
  assert.deepEqual(links, [{ url: 'https://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale/taotlemine', text: 'Taotlemine' },
    { url: 'https://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale/hinnad', text: 'Hinnad' },
    { url: 'https://naidisamet.example/puue/abivahendid/abivahendi-vajajale/taotlemine', text: 'Taotlemine uuesti' },
    { url: 'https://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale/kkk', text: 'KKK' }]);
  // Seen from a sub-page, the limit is still the listed page's path.
  assert.deepEqual(subpageLinks('<a href="/puue/abivahendid/abivahendi-vajajale/hinnad/tabel">Tabel</a><a href="/puue/muu">Muu</a>', `${URL_PAGE}/hinnad`, { within: URL_PAGE }).map(link => link.url),
    ['https://www.naidisamet.example/puue/abivahendid/abivahendi-vajajale/hinnad/tabel']);
  assert.equal(subpageId('amet_leht', URL_PAGE, `${URL_PAGE}/Taotlemine/Õigus%20abile/`), 'amet_leht--taotlemine--oigus-abile');
  assert(subpageId('amet_leht', URL_PAGE, `${URL_PAGE}/${'a'.repeat(200)}`).length <= 150);
});

// A made-up site: address → [status, headers, body].
function fakeSite(routes) {
  const calls = [];
  const fetchImpl = async (address, options) => {
    calls.push(address);
    const route = routes[address];
    if (route === 'timeout') throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    if (!route) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers['User-Agent'], COLLECTOR_AGENT);
    return new Response(route[2] ?? null, { status: route[0], headers: route[1] });
  };
  return { fetchImpl, calls };
}
const html = body => [200, { 'content-type': 'text/html; charset=utf-8' }, body];

test('a page is fetched over https only, redirects are followed by hand, and what is not a page is said', async () => {
  const site = fakeSite({ 'https://amet.example/a': [301, { location: '/b' }], 'https://amet.example/b': [302, { location: 'https://www.amet.example/c' }],
    'https://www.amet.example/c': [200, { 'content-type': 'text/html; charset=utf-8', etag: '"v1"', 'last-modified': 'Mon, 05 Oct 2026 10:00:00 GMT' }, '<main><h1>Leht</h1></main>'],
    'https://amet.example/pdf': [200, { 'content-type': 'application/pdf' }, '%PDF-1.4'], 'https://amet.example/http': [301, { location: 'http://amet.example/x' }],
    'https://amet.example/ring': [301, { location: '/ring' }], 'https://amet.example/aeg': 'timeout',
    'https://amet.example/latin': [200, { 'content-type': 'text/html' }, Buffer.from('<meta charset="iso-8859-1"><main><h1>T\xf5end</h1></main>', 'latin1')] });
  const page = await fetchPage('https://amet.example/a', site);
  assert.deepEqual([page.ok, page.status, page.finalUrl, page.etag, page.lastModified, page.body], [true, 200, 'https://www.amet.example/c', '"v1"', 'Mon, 05 Oct 2026 10:00:00 GMT', '<main><h1>Leht</h1></main>']);
  assert.match(page.rawSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(site.calls, ['https://amet.example/a', 'https://amet.example/b', 'https://www.amet.example/c']);
  for (const [address, error] of [['https://amet.example/pdf', 'not_html'], ['https://amet.example/puudub', 'http_404'], ['https://amet.example/http', 'address_not_allowed'], ['https://amet.example/ring', 'too_many_redirects'],
    ['https://amet.example/aeg', 'timeout'], ['http://amet.example/a', 'address_not_allowed'], ['https://127.0.0.1/a', 'address_not_allowed'], ['https://localhost/a', 'address_not_allowed'],
    ['https://amet.example:8443/a', 'address_not_allowed'], ['mis iganes', 'address_not_allowed']]) assert.equal((await fetchPage(address, site)).error, error, address);
  assert.equal((await fetchPage('https://amet.example/latin', site)).body.includes('Tõend'), true, 'the page\'s own character set is read');
  assert.equal((await fetchPage('https://www.amet.example/c', { ...site, maxBytes: 10 })).error, 'too_large');
});

test('a listed page is collected with its sub-pages, breadth first, within the limits and the site\'s rules', async () => {
  const root = 'https://amet.example/teenus', page = (title, links = '') => html(`<main><h1>${title}</h1><p>${title} sisu on siin pikemalt kirjas.</p>${links}</main>`);
  const site = fakeSite({ [root]: page('Teenus', '<a href="/teenus/kes">Kes</a><a href="/teenus/kuidas">Kuidas</a><a href="/teenus/vana">Vana</a><a href="/teenus/keelatud">Keelatud</a><a href="/muu">Muu</a>'),
    [`${root}/kes`]: page('Kes saab', '<a href="/teenus/kes/erandid">Erandid</a><a href="/teenus">Tagasi</a>'), [`${root}/kuidas`]: page('Kuidas taotleda', '<a href="/teenus/kuidas/sammud">Sammud</a>'),
    [`${root}/vana`]: [301, { location: '/teenus/kes' }], [`${root}/kes/erandid`]: page('Erandid', '<a href="/teenus/kes/erandid/sygav">Sügav</a>'), [`${root}/kuidas/sammud`]: page('Kes saab', '<a href="/teenus/kes/erandid">Erandid</a><a href="/teenus">Tagasi</a>'),
    [`${root}/kes/erandid/sygav`]: page('Liiga sügaval') });
  const waits = [], manners = { robots: async () => 'User-agent: *\nDisallow: /teenus/keelatud\n', wait: async host => { waits.push(host); } };
  const entry = { source_id: 'amet_teenus', url: root, title: 'Teenus', publisher: 'Amet', source_type: 'web_page' };
  const { pages, skipped } = await collectEntry(entry, { ...site, site: manners });
  assert.deepEqual(pages.map(item => [item.id, item.depth, item.status, item.parent]), [['amet_teenus', 0, 'read', null], ['amet_teenus--kes', 1, 'read', 'amet_teenus'], ['amet_teenus--kuidas', 1, 'read', 'amet_teenus'],
    // An address that leads to a page already read is that page; a disallowed one is not asked for.
    ['amet_teenus--vana', 1, 'duplicate', 'amet_teenus'], ['amet_teenus--keelatud', 1, 'robots_disallowed', 'amet_teenus'],
    // The second level; a page with the content of one already read is the same source; the third level is not read.
    ['amet_teenus--kes--erandid', 2, 'read', 'amet_teenus--kes'], ['amet_teenus--kuidas--sammud', 2, 'duplicate', 'amet_teenus--kuidas']]);
  assert.deepEqual(skipped, []);
  assert.equal(site.calls.includes(`${root}/keelatud`), false); assert.equal(site.calls.includes(`${root}/kes/erandid/sygav`), false); assert.equal(site.calls.includes('https://amet.example/muu'), false);
  assert.equal(waits.length, 6, 'one pause before each page asked for: the disallowed one is not asked, a redirect\'s second hop is the same page');
  const sub = pages[1];
  assert.deepEqual([sub.entry.source_id, sub.entry.parent, sub.entry.publisher, sub.entry.title, sub.page.title, sub.fetched.status, 'body' in sub.fetched], ['amet_teenus--kes', 'amet_teenus', 'Amet', 'Kes', 'Kes saab', 200, false]);
  // The limits: no sub-pages at all, one level, and a cap on their number (what is left out is named).
  assert.deepEqual((await collectEntry({ ...entry, subpages: false }, { ...site, site: manners })).pages.map(item => item.id), ['amet_teenus']);
  assert.deepEqual((await collectEntry({ ...entry, subpages: { depth: 1 } }, { ...site, site: manners })).pages.filter(item => item.status === 'read').map(item => item.depth), [0, 1, 1]);
  const capped = await collectEntry({ ...entry, subpages: { max: 2 } }, { ...site, site: manners });
  assert.deepEqual([capped.pages.filter(item => item.depth > 0).length, capped.skipped.length > 0], [2, true]);
  // A company's own page carries the company's name in its title, unless the title has it already.
  const { pageTitle, pageMetadata } = await import('../lib/rag-v2/web-page.js');
  const shop = { source_id: 'pood_laenutus', url: 'https://pood.example/laenutus', title: 'Laenutus', publisher: 'Näidispood', source_type: 'vendor_page' };
  assert.deepEqual([pageTitle(shop, { title: 'LAENUTUS' }), pageTitle(shop, { title: 'Näidispood aitab' }), pageTitle({ ...shop, source_type: 'web_page' }, { title: 'Laenutus' }), pageTitle(shop, { title: '' })],
    ['Näidispood: LAENUTUS', 'Näidispood aitab', 'Laenutus', 'Näidispood: Laenutus']);
  assert.equal(pageTitle({ ...shop, publisher: 'Näidisühing', source_type: 'organization_page' }, { title: 'Kontakt' }), 'Näidisühing: Kontakt');
  assert.deepEqual((({ title, source_type, publisher }) => [title, source_type, publisher])(pageMetadata({ entry: shop, page: { ...sub.page, title: 'Laenutus' }, fetched: sub.fetched, sourcePath: 'pood_laenutus.html' })),
    ['Näidispood: Laenutus', 'vendor_page', 'Näidispood']);
  // A pattern names the sub-pages worth reading (a company's front page links to its whole shop): by the address or
  // by the link's text. The others are not asked for, and are not what the cap leaves out.
  const calls = site.calls.length, chosen = await collectEntry({ ...entry, subpages: { depth: 1, only: 'kuidas|^.* Kes$' } }, { ...site, site: manners });
  assert.deepEqual([chosen.pages.map(item => item.id), chosen.skipped, site.calls.slice(calls)], [['amet_teenus', 'amet_teenus--kes', 'amet_teenus--kuidas'], [], [root, `${root}/kes`, `${root}/kuidas`]]);
  // A listed page that cannot be read is reported, with nothing guessed.
  assert.deepEqual((await collectEntry({ ...entry, url: 'https://amet.example/puudub' }, { ...site, site: manners })).pages.map(item => [item.status, item.error, item.http]), [['failed', 'http_404', 404]]);
});

test('each site\'s robots.txt is read once and two requests to one site are a pause apart', async () => {
  const asked = [], slept = [];
  const manners = siteManners({ delayMs: 1500, sleep: async ms => { slept.push(ms); }, fetchImpl: async address => { asked.push(address); return new Response('User-agent: *\nDisallow: /x\n', { status: 200, headers: { 'content-type': 'text/plain' } }); } });
  assert.equal(await manners.robots(new URL('https://www.amet.example/a')), 'User-agent: *\nDisallow: /x\n');
  await manners.robots(new URL('https://amet.example/b')); await manners.robots(new URL('https://teine.example/b'));
  assert.deepEqual(asked, ['https://www.amet.example/robots.txt', 'https://teine.example/robots.txt']);
  await manners.wait('amet.example'); await manners.wait('www.amet.example'); await manners.wait('teine.example');
  assert.equal(slept.length, 1); assert(slept[0] > 1000 && slept[0] <= 1500);
  // A site without a readable robots.txt restricts nothing.
  const none = siteManners({ fetchImpl: async () => new Response('<html>404</html>', { status: 404, headers: { 'content-type': 'text/html' } }) });
  assert.equal(await none.robots(new URL('https://amet.example/a')), '');
});

test('a changed page is a proposal until a second read gives the same content', () => {
  const page = { contentSha256: 'new' };
  assert.equal(decidePage(page, null, null), 'new');
  assert.equal(decidePage(page, { content_sha256: 'new' }, { content_sha256: 'old-proposal' }), 'unchanged');
  assert.equal(decidePage(page, { content_sha256: 'stored' }, null), 'proposed');
  assert.equal(decidePage(page, { content_sha256: 'stored' }, { content_sha256: 'another' }), 'proposed', 'a third content is a new proposal');
  assert.equal(decidePage(page, { content_sha256: 'stored' }, { content_sha256: 'new' }), 'confirmed');
});

// Found on the first full run (06.10.2026): a class name is only a hint. An agency's accordion panels carry a print
// utility class, and another site's content wrapper is named after the sidebar beside it.
test('a block named like the site\'s chrome is kept when the markup calls it content or it holds much of the page', () => {
  const answer = 'Teenuse saamiseks pöördu elukohajärgse omavalitsuse poole, kes hindab abivajadust ja teeb otsuse kümne tööpäeva jooksul. ';
  const page = extractPage(`<main><h1>Üldhooldusteenus</h1>
    <div class="dark-menu-vp"><ul><li><a href="/a">Nõustamine</a></li><li><a href="/b">Järelevalve</a></li></ul></div>
    <button aria-expanded="false" aria-controls="a1">Kuidas teenusele suunatakse?</button>
    <div id="a1" class="collapse d-print-block paragraph paragraph--type--accordion-item"><p>${answer.repeat(6)}</p></div>
    <button aria-expanded="false" aria-controls="a2">Kes maksab?</button>
    <div id="a2" class="collapse d-print-block paragraph paragraph--type--accordion-item"><p>${answer.repeat(3)}</p></div>
    <div class="tab-pane fade d-print-block"><p>Juhendid on siin loetletud.</p></div></main>`, 'https://amet.example/uldhooldus');
  assert.equal(page.html.includes('Nõustamine'), false, 'the section menu is still left out');
  for (const kept of ['<h4>Kuidas teenusele suunatakse?</h4>', '<h4>Kes maksab?</h4>', 'Juhendid on siin loetletud.']) assert(page.html.includes(kept), kept);
  assert.equal(page.html.split('Teenuse saamiseks').length - 1, 9);
  assert.deepEqual(page.warnings, []);
  const wrapped = extractPage(`<main><div class="region-breadcrumb"><a href="/">Avaleht</a></div><div class="content-and-sidebar with-sidebar">
    <div class="sidebar"><ul><li><a href="/x">Kuidas avaldust esitada?</a></li></ul></div><div class="text"><h1>Avaldus</h1><p>${answer.repeat(8)}</p></div></div></main>`, 'https://amet.example/avaldus');
  assert.deepEqual([wrapped.title, wrapped.html.split('Teenuse saamiseks').length - 1, wrapped.html.includes('Kuidas avaldust esitada?'), wrapped.html.includes('Avaleht')], ['Avaldus', 8, false, false]);
  // A page whose text a script writes after loading has nothing to read, and says so.
  const scripted = extractPage('<html><head><title>Juhis</title><script src="a.js"></script><script src="b.js"></script><script>start()</script></head><body><app-root></app-root></body></html>', 'https://portaal.example/juhis');
  assert.deepEqual(scripted.warnings, ['content_region_not_marked', 'thin_content', 'rendered_by_script']);
});

// Found on real pages (06.10.2026): a contact card on several lines, and addresses behind a site's e-mail protection.
test('a card on several lines goes whole; a hidden address is read and told apart like any other', () => {
  // As the protection writes an address: a key byte, then each byte of the address combined with the key.
  const hide = (address, key = 0x5a) => [key, ...Buffer.from(address).map(byte => byte ^ key)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const link = address => `<a href="/cdn-cgi/l/email-protection#${hide(address)}"><span class="__cf_email__" data-cfemail="${hide(address)}">[email&#160;protected]</span></a>`;
  const page = extractPage(`<main><h1>Abivahendi ettevõttele</h1><p>${'Lepingu sõlmimiseks tuleb esitada taotlus ja nõutud dokumendid. '.repeat(12)}</p>
    <p>Lepingu sõlmimiseks saada aadressil ${link('info@amet.example')} digiallkirjastatud taotlus.</p>
    <h2>Küsimuste korral aitavad</h2>
    <div class="contact"><div><strong>Mari Maasikas</strong></div><div>Ekspert (teenuse korraldus)</div><div>+372 5555 1234</div><div>${link('mari.maasikas@amet.example')}</div></div>
    <div class="contact"><div><strong>Jaan Tamm</strong></div><div>Peaspetsialist</div><div>5555 4321</div></div>
    <p><strong>Kati Kask</strong><br>Peaspetsialist (tehingute kontroll)</p><ul><li>+372 5555 7777</li><li>${link('kati.kask@amet.example')}</li></ul>
    <p>Toe kontaktid: telefon 612 0000 (E–N 9.00–17.00), e-post ${link('klienditugi@amet.example')}.</p>
    <p>Kirjuta otse aadressil ${link('kati.kask@amet.example')} või helista 5555 9999.</p></main>`, 'https://amet.example/ettevottele');
  for (const gone of ['Mari Maasikas', 'Jaan Tamm', 'Kati Kask', '5555 7777', 'Ekspert', 'Peaspetsialist', '5555 1234', '5555 4321', 'mari.maasikas', 'kati.kask', '5555 9999', 'protected', 'cdn-cgi']) assert.equal(page.html.includes(gone), false, gone);
  // The general addresses the site hides are in the text as the page shows them to a visitor.
  assert(page.html.includes('<p>Lepingu sõlmimiseks saada aadressil info@amet.example digiallkirjastatud taotlus.</p>'));
  // The heading stays: the general help line is still under it.
  assert(page.html.includes(['<h2>Küsimuste korral aitavad</h2>', '<p>Toe kontaktid: telefon 612 0000 (E–N 9.00–17.00), e-post klienditugi@amet.example.</p>'].join('\n')));
  assert(page.html.includes('<p>Kirjuta otse aadressil [e-post eemaldatud] või helista [telefon eemaldatud].</p>'));
  // Three cards (lines, lines, a name with a list of channels), counted as cards; the one address removed from a sentence keeps the page for review.
  assert.deepEqual(page.contacts, { generalEmails: 2, otherEmails: 0, personLinks: 0, contactCards: 3, personalEmails: 1, phonesBesideThem: 1 });
  assert.deepEqual([page.warnings, page.needsReview], [['contact_card_removed', 'personal_contact_removed'], true]);
  // A value that is not a hidden address stays hidden, and counts as a person's.
  const odd = extractPage(`<main><h1>Leht</h1><p>${'Sisu on siin pikemalt kirjas. '.repeat(20)}</p><p>Küsi lisa aadressilt <a href="/cdn-cgi/l/email-protection#zz">[email&#160;protected]</a>.</p></main>`, 'https://amet.example/x');
  assert(odd.html.includes('<p>Küsi lisa aadressilt [e-post eemaldatud].</p>'));
  assert.deepEqual([odd.contacts.personalEmails, odd.needsReview], [1, true]);
});

// Found on a register's contact page (06.10.2026): each official is a heading, the channels stand under it.
test('a heading that is nothing but a name, with channels under it, is a contact card; the site\'s own line goes', () => {
  const page = extractPage(`<html><head><title>Kontaktid | Näidisandmekogu</title></head><body><main><div>Näidisandmekogu</div><h1>Kontaktid</h1><p>Back to list</p>
    <p>${'Andmekogu kasutamise kohta saab abi tööpäeviti. '.repeat(20)}</p>
    <h4>Mari Maasikas</h4><p>peaspetsialist</p><p>5555 1234</p>
    <h4>Jaan-Erik Tamm</h4><ul><li>5555 4321</li></ul>
    <h3>Üldine abi</h3><p>Infotelefon 612 0000</p><h4>Lahtiolekuajad</h4><p>E–R 9–17</p></main></body></html>`, 'https://andmekogu.example/kontaktid');
  for (const gone of ['Maasikas', 'Tamm', 'peaspetsialist', '5555', 'Back to list']) assert.equal(page.html.includes(gone), false, gone);
  assert.equal(page.html.split('Näidisandmekogu').length - 1, 0, 'the site\'s name beside the heading is the site\'s line');
  assert(page.html.includes(['<h3>Üldine abi</h3>', '<p>Infotelefon 612 0000</p>', '<h4>Lahtiolekuajad</h4>', '<p>E–R 9–17</p>'].join('\n')), 'a heading of two words that is not a name stays with its text');
  assert.deepEqual([page.contacts.contactCards, page.needsReview, page.warnings], [2, false, ['contact_card_removed']]);
});
