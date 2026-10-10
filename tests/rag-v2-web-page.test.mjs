import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractPage, emailKind, robotsAllows, subpageLinks, pageMetadata, decidePage, WEB_PAGE_COLLECTOR, MAILBOX_WORDS } from '../lib/rag-v2/web-page.js';
import { fetchPage, collectEntry, subpageId, linkTitle, siteManners, COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';
import { GIVEN_NAMES } from '../lib/rag-v2/web-select-words.js';
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
    // ADR-132 (10.10.2026): a department's mailbox is the institution's own; it was 'other' (kept, and the page held for a person).
    ['jaan_tamm2@amet.example', 'personal'], ['sotsiaal.osakond@vald.example', 'general'], ['mari@amet.example', 'other']]) assert.equal(emailKind(address), kind, address);
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
  // A link that only invites to read on gives the page no title.
  assert.deepEqual(['LOE EDASI', 'Loe lähemalt »', 'Vaata', 'Read more', '', 'Loe lihtsas keeles', 'Taotlemine'].map(linkTitle), [null, null, null, null, null, 'Loe lihtsas keeles', 'Taotlemine']);
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
  // The other way round: every sub-page but the ones a pattern names.
  const others = await collectEntry({ ...entry, subpages: { depth: 1, except: 'kuidas|vana|keelatud' } }, { ...site, site: manners });
  assert.deepEqual(others.pages.map(item => item.id), ['amet_teenus', 'amet_teenus--kes']);
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

test('a contact table whose cells hold paragraphs: a row that names a person beside a channel goes whole', () => {
  // The shape of an official page read on 08.10.2026: the name is a link, the phone number stands in a paragraph of its
  // cell, the address in a plain cell. A row with a block in a cell was no unit, so nothing read it and the whole table
  // went into the collected copy. Invented names.
  const page = extractPage(`<html><head><title>Teenus | Näidisamet</title></head><body><main><h1>Teenus</h1>
    <p>${'Teenust saab taotleda iseteeninduses ja see on tasuta. '.repeat(20)}</p>
    <h2>Kontaktid</h2>
    <table><thead><tr><th>Nimi</th><th>Ametikoht</th><th>Üksus</th><th>Telefon</th><th>E-post</th></tr></thead><tbody>
      <tr><td><a href="/teenus">Mari Maasikas</a></td><td>peaspetsialist (teenus)</td><td>Teenuse tiim</td><td><p>5555 1234</p></td><td>Mari.Maasikas@amet.example</td></tr>
      <tr><td><a href="/teenus">Jaan-Erik Tamm</a></td><td>peaspetsialist (teenus)</td><td>Teenuse tiim</td><td><p>5555 4321</p></td><td>Jaan-Erik.Tamm@amet.example</td></tr>
      <tr><td>Infotelefon</td><td></td><td></td><td><p>612 0000</p></td><td>info@amet.example</td></tr>
    </tbody></table>
    <table><tr><td><p>Tingimus</p></td><td>Kirjuta aadressil mari.maasikas@amet.example, kui vajad selgitust teenuse tingimuste, taotlemise, tähtaegade, otsuse vaidlustamise või muu teenusega seotud küsimuse kohta ning lisa oma kirjale kindlasti taotluse number ja kuupäev, et saaksime sinu pöördumise üles leida ja sulle vastata kümne tööpäeva jooksul alates kirja saamisest või kokkulepitud ajal.</td></tr></table>
  </main></body></html>`, 'https://amet.example/teenus');
  for (const gone of ['Maasikas', 'Tamm', '5555', 'peaspetsialist', '@amet.example</td></tr><tr><td><a']) assert.equal(page.html.includes(gone), false, gone);
  // The general row stays as it is, and the table keeps its head.
  assert.ok(page.html.includes('Infotelefon') && page.html.includes('612 0000') && page.html.includes('info@amet.example') && page.html.includes('<th>Telefon</th>'));
  // A long row is no card: its plain cell is read by itself and the person's address in it removed.
  assert.ok(page.html.includes('Kirjuta aadressil [e-post eemaldatud], kui vajad selgitust'));
  assert.deepEqual(page.contacts, { generalEmails: 1, otherEmails: 0, personLinks: 0, contactCards: 2, personalEmails: 1, phonesBesideThem: 0 });
  assert.deepEqual(page.warnings, ['contact_card_removed', 'personal_contact_removed']);
});

// ADR-132 (10.10.2026): an institution's unit mailbox is not a person's address. Two plain words before the @ were read as a first and a family name, so a court house's mailbox for
// documents went, and the information line beside it. Every name, address and number below is made up.
const UNIT_PAGE = body => extractPage(`<main><h1>Leht</h1><p>${'Teenust saab taotleda elukohajärgsest omavalitsusest ja see on tasuta. '.repeat(12)}</p>${body}</main>`, 'https://vald.example/leht');
// The listed given names in every way an address writes them: a letter with a mark plain, "y" for ü, or two letters for it (review of 10.10.2026). Written out here on its own, as the measure for the rule.
const fold = value => value.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, ''), SPELLINGS = [['ü', ['u', 'y', 'ue']], ['ä', ['a', 'ae']], ['ö', ['o', 'oe']], ['õ', ['o', 'oe']], ['š', ['s', 'sh']], ['ž', ['z', 'zh']]];
const spelled = name => SPELLINGS.reduce((forms, [letter, ways]) => forms.flatMap(form => (form.includes(letter) ? ways.map(way => form.split(letter).join(way)) : [form])), [name.toLowerCase().normalize('NFC')]).map(fold);
const LISTED_GIVEN = new Set([...GIVEN_NAMES].flatMap(spelled));

test('a unit\'s mailbox is told from a person\'s address by its words and by the address\'s own domain', () => {
  for (const [address, kind] of [
    // Every word is a channel's or a unit's.
    ['info@amet.example', 'general'], ['sotsiaal.osakond@vald.example', 'general'], ['sotsiaalosakond@vald.example', 'general'], ['linnavalitsus@naidislinn.example', 'general'], ['lastekaitse@vald.example', 'general'],
    // Beside such a word may stand the address's own domain, or a word for a kind of institution.
    ['info.naidislinn@naidislinn.example', 'general'], ['naidislinn.linnavalitsus@naidislinn.example', 'general'], ['vald.info@naidisvald.example', 'general'],
    // The domain's own name counts from three letters on; two letters read as initials, and a person looks.
    ['nmk.osakond@nmk.example', 'general'], ['mk.osakond@mk.example', 'other'],
    // A unit's word beside a word the rule does not know: kept, and a person looks at the page.
    ['naidismk.menetlus@kohus.example', 'other'], ['naidismk.lastekaitse@kohus.example', 'other'], ['naidismk.info@kohus.example', 'other'], ['info.naidislinn@amet.example', 'other'],
    // A kind of institution after the domain's own name, or nothing but one of the two: kept, and a person looks.
    ['naidis.vald@naidis.example', 'other'], ['vald@naidisvald.example', 'other'], ['naidislinn@naidislinn.example', 'other'],
    // A first and a family name, as before. A word that is also a family name shields no one, nor does the domain; a domain that is a given name proves nothing.
    ['mari.maasikas@amet.example', 'personal'], ['jaan_tamm2@amet.example', 'personal'], ['mari.linn@amet.example', 'personal'], ['mari.kool@kool.example', 'personal'], ['mari.maasikas@maasikas.example', 'personal'],
    ['mari.maasikas@mari.maasikas.example', 'personal'], ['naidis.vald@amet.example', 'personal'], ['tiit.vald@tiit.example', 'personal'],
    // As before.
    ['mari@amet.example', 'other'], ['mari.info@mari.example', 'other'], ['tiit.post@amet.example', 'other']]) assert.equal(emailKind(address), kind, address);
});

test('a word that is also a name, or reads as initials, makes no mailbox; a listed given name beside a unit\'s word is a person\'s', () => {
  for (const [address, kind] of [
    // A channel word that is a given name ("arved"), a family name ("post", "press") or two or three letters long, beside another word: held as before, not a mailbox.
    ['arved.vald@amet.example', 'other'], ['arved.linn@amet.example', 'other'], ['arved.osakond@amet.example', 'other'], ['arved.naidis@naidis.example', 'other'], ['arved.kontor@amet.example', 'other'], ['it.naidis@naidis.example', 'other'],
    ['it.tamm@tamm.example', 'other'], ['ta.vald@amet.example', 'other'], ['sm.kool@kool.example', 'other'], ['vald.post@amet.example', 'other'], ['naidis.press@naidis.example', 'other'],
    // A listed given name beside a unit's word, also with a number after it: a person's, removed as before. "kontor" is a family name and no unit's word.
    ['mari.osakond@amet.example', 'personal'], ['mari2.osakond@amet.example', 'personal'], ['jaan.keskus@amet.example', 'personal'], ['jaan.keskus@keskus.example', 'personal'], ['mari.amet@amet.example', 'personal'],
    ['mari.kontor@amet.example', 'personal'], ['naidis.kontor@amet.example', 'personal'],
    // A listed name with a marked letter is a given name however the address writes it: plain letters, "y" for ü, two letters for the one (review of 10.10.2026).
    ['juri.osakond@amet.example', 'personal'], ['jyri.osakond@amet.example', 'personal'], ['jueri.osakond@amet.example', 'personal'], ['ulle.keskus@amet.example', 'personal'], ['ylle.keskus@amet.example', 'personal'],
    ['uelle.keskus@keskus.example', 'personal'], ['mart.talitus@amet.example', 'personal'], ['maert.talitus@amet.example', 'personal'], ['tonu.osakond@amet.example', 'personal'], ['toenu.osakond@amet.example', 'personal'],
    ['nadezda.keskus@amet.example', 'personal'], ['nadezhda.keskus@amet.example', 'personal'], ['osakond.kylli@amet.example', 'personal'], ['jyri2.osakond@amet.example', 'personal'],
    // "linn" and "maja" are given names and account for nothing (review of 10.10.2026): beside a unit's word, in either order, with a number, and after the domain's own name they are a
    // person's, removed as before; beside a channel word the address is held as before. A family's "tamm.maja@tamm.example" cannot be told from a town's "naidis.linn@naidis.example".
    ['linn.osakond@amet.example', 'personal'], ['maja.keskus@amet.example', 'personal'], ['osakond.linn@amet.example', 'personal'], ['linn2.osakond@amet.example', 'personal'], ['maja.linnavalitsus@naidislinn.example', 'personal'],
    ['tamm.maja@tamm.example', 'personal'], ['naidis.linn@naidis.example', 'personal'], ['linn.info@amet.example', 'other'], ['info.maja@maja.example', 'other'], ['linn@naidis.example', 'other'],
    // Two words for a kind of institution are a first and a family name, on any domain, also one that is itself such a word.
    ['vald.kool@amet.example', 'personal'], ['vald.kool@kool.example', 'personal'], ['linn.kool@amet.example', 'personal'], ['vald.linn@amet.example', 'personal'], ['linn.kool@kool.example', 'personal'], ['kool.kool@kool.example', 'personal'],
    // The kind stands after the domain's own name, as in an institution's name; before it, it may be a given name at a family's domain.
    ['maja.tamm@tamm.example', 'personal'], ['linn.tamm@tamm.example', 'personal'], ['vald.naidis@naidis.example', 'personal'], ['naidis.linn.kool@naidis.example', 'personal'], ['naidis.vald.kool@naidis.example', 'personal'],
    // What was a channel stays one, and a court house's mailbox is kept for a person to look at.
    ['arved@pood.example', 'general'], ['arved.post@amet.example', 'general'], ['info.naidislinn@naidislinn.example', 'general'], ['naidismk.menetlus@kohus.example', 'other']]) assert.equal(emailKind(address), kind, address);
  // Every listed given name, in every way an address writes it, beside a unit's word: before it, after it, with a number, at a domain of its own name. ("arved" is a channel word: held, above.)
  for (const given of LISTED_GIVEN) if (!MAILBOX_WORDS.channel.has(given)) for (const address of [`${given}.osakond@amet.example`, `keskus.${given}@keskus.example`, `${given}2_talitus@${given}.example`]) assert.equal(emailKind(address), 'personal', address);
});

test('the mailbox word lists hold no given name, and the channel words are the ones the card is drawn by', () => {
  const { channel, office, officeOrName, channelOrName, givenToo } = MAILBOX_WORDS;
  for (const word of [...office, ...officeOrName]) assert.equal(LISTED_GIVEN.has(word) || givenToo.has(word), false, word);
  assert.deepEqual([...office].filter(word => officeOrName.has(word) || channel.has(word)), []);
  assert.equal(office.has('kontor'), false, 'a family name');
  // The two words for a kind of institution that are given names are in no list of words that make or fill a mailbox (review of 10.10.2026), and the list of given names does not hold them.
  assert.deepEqual([[...givenToo].sort(), [...givenToo].filter(word => channel.has(word) || office.has(word) || officeOrName.has(word) || LISTED_GIVEN.has(word))], [['linn', 'maja'], []]);
  // The channel words are as ADR-095 left them: one of them is also a given name, and an address of that word alone is a channel.
  assert.deepEqual([[...channel].filter(word => LISTED_GIVEN.has(word)), channel.size, emailKind('arved@pood.example')], [['arved'], 50, 'general']);
  assert.deepEqual([...channelOrName].filter(word => !channel.has(word)), []);
  // A channel word that is a name or reads as initials never makes a mailbox of an address beside a word that is also a family name; any other channel word does.
  for (const word of channel) assert.equal(emailKind(`${word}.vald@amet.example`), LISTED_GIVEN.has(word) || word.length < 4 || channelOrName.has(word) ? 'other' : 'general', word);
  // The written forms the measure is made of: a marked letter plain, "y" for ü, two letters for one. They add forms to the plain ones (18 on 10.10.2026).
  for (const form of ['juri', 'jyri', 'jueri', 'ulle', 'ylle', 'uelle', 'maert', 'toenu', 'oie', 'nadezhda', 'vjatsheslav']) assert(LISTED_GIVEN.has(form), form);
  assert(LISTED_GIVEN.size >= new Set([...GIVEN_NAMES].map(fold)).size + 15);
});

test('over every pair of listed words the rule fails closed: nothing new is removed, no given name is shielded, and a mailbox needs a word that is no name', () => {
  const { channel, office, officeOrName, channelOrName, givenToo } = MAILBOX_WORDS;
  // The rule before ADR-132, written out: the measure the new one is held to.
  const before = address => { const parts = address.split('@')[0].split('.'); return parts.every(part => channel.has(part)) ? 'general' : parts.every(part => /^[a-z]{2,}\d*$/u.test(part)) && !parts.some(part => channel.has(part)) ? 'personal' : 'other'; };
  const isGiven = word => LISTED_GIVEN.has(word) || givenToo.has(word);
  const anchors = word => (channel.has(word) || office.has(word)) && word.length >= 4 && !isGiven(word) && !channelOrName.has(word);
  const words = [...channel, ...office, ...officeOrName, ...givenToo, 'mari', 'jaan', 'kati', 'jyri', 'uelle', 'naidis', 'naidismk', 'mk', 'tamm', 'kontor'];
  let pairs = 0;
  for (const domain of ['amet.example', 'naidis.example', 'tamm.example', 'kool.example', 'keskus.example', 'mari.example', 'post.example', 'linn.example', 'mk.example']) {
    // The domain's own name counts from three letters on, and not when it is a given name.
    const label = domain.split('.')[0], accounted = word => anchors(word) || officeOrName.has(word) || word === label && label.length >= 3 && !isGiven(word);
    for (const first of words) for (const second of words) {
      const address = `${first}.${second}@${domain}`, was = before(address), is = emailKind(address), given = isGiven(first) || isGiven(second);
      pairs++;
      if (is === 'personal') assert.equal(was, 'personal', `${address} was kept and is removed`);
      if (was === 'general') assert.equal(is, 'general', address);
      if (was === 'personal' && given) assert.equal(is, 'personal', `${address} holds a listed given name`);
      // A mailbox (kept, and no one looks) is made by a word that is no given name, no family name and no initials, with every other word accounted for.
      if (was !== 'general' && is === 'general') assert(accounted(first) && accounted(second) && (anchors(first) || anchors(second)), address);
      // What was a person's and is now kept for a person to look at: a unit's word beside an unknown one, or a kind of institution after the domain's own name.
      if (was === 'personal' && is === 'other') assert(office.has(first) || office.has(second) || officeOrName.has(second) && first === label && !officeOrName.has(first), address);
    }
  }
  assert(pairs > 50000, 'every pair was tried');
});

test('a unit\'s mailbox stays, and the phone numbers beside it stay with it', () => {
  // A court house's block: long, no one named; a mailbox for questions, one for documents, and the information line.
  const house = UNIT_PAGE(`<h2>Näidise kohtumaja</h2><p><strong>Aadress:</strong> Näidise 4, Näidislinn, 10115<br><strong>Infotelefon:</strong> 612 3456<br><strong>E-post info küsimiseks:</strong> naidismk.info@kohus.example<br>
    <strong>E-post menetlusdokumentide saatmiseks:</strong> naidismk.menetlus@kohus.example<br><strong>Kohtumaja kantselei on avatud</strong> igal tööpäeval kella 9–17. Riigipühadele vahetult eelnevatel lühendatud tööpäevadel on kantselei avatud kella 9–14.<br>
    <strong>Parkimine:</strong> auto saab jätta kohtumaja juures olevatele tänavatele, parkimine on tasuta.</p>`);
  for (const stays of ['612 3456', 'naidismk.info@kohus.example', 'naidismk.menetlus@kohus.example']) assert(house.html.includes(stays), stays);
  assert.equal(house.html.includes('eemaldatud'), false);
  assert.deepEqual(house.contacts, { generalEmails: 0, otherEmails: 2, personLinks: 0, contactCards: 0, personalEmails: 0, phonesBesideThem: 0 });
  assert.deepEqual([house.warnings, house.needsReview], [['email_needs_review'], true], 'the address holds a word the rule does not know: a person looks before the page is placed');
  // A department's mailbox in a sentence: kept with its number, and nothing to look at.
  const sentence = UNIT_PAGE('<p>Küsimuste korral kirjuta sotsiaal.osakond@vald.example või helista 612 3456.</p>');
  assert(sentence.html.includes('<p>Küsimuste korral kirjuta sotsiaal.osakond@vald.example või helista 612 3456.</p>'));
  assert.deepEqual([sentence.contacts.generalEmails, sentence.contacts.otherEmails, sentence.warnings, sentence.needsReview], [1, 0, [], false]);
  // A municipality's own address after its domain's name: kept with the number beside it, and a person looks.
  const municipality = UNIT_PAGE('<p>Avalduse võib saata aadressil naidis.vald@naidis.example või küsida nõu telefonil 612 3456.</p>');
  assert(municipality.html.includes('<p>Avalduse võib saata aadressil naidis.vald@naidis.example või küsida nõu telefonil 612 3456.</p>'));
  assert.deepEqual([municipality.contacts.otherEmails, municipality.contacts.phonesBesideThem, municipality.needsReview], [1, 0, true]);
  // A person's address in the same sentence goes, and every number goes with it (whose a number is cannot be told); the unit's mailbox stays.
  const mixed = UNIT_PAGE('<p>Kirjuta sotsiaal.osakond@vald.example või otse mari.maasikas@vald.example, telefonid 612 3456 ja 5555 1234.</p>');
  assert(mixed.html.includes('<p>Kirjuta sotsiaal.osakond@vald.example või otse [e-post eemaldatud], telefonid [telefon eemaldatud] ja [telefon eemaldatud].</p>'));
  assert.deepEqual(mixed.contacts, { generalEmails: 1, otherEmails: 0, personLinks: 0, contactCards: 0, personalEmails: 1, phonesBesideThem: 2 });
  // An address the site hides and that cannot be read is a person's, as before.
  const hidden = UNIT_PAGE('<p>Kirjuta sotsiaal.osakond@vald.example või <a href="/cdn-cgi/l/email-protection#zz">[email&#160;protected]</a>, telefon 612 3456.</p>');
  assert(hidden.html.includes('<p>Kirjuta sotsiaal.osakond@vald.example või [e-post eemaldatud], telefon [telefon eemaldatud].</p>'));
});

test('a contact card is what it was before: a name beside a unit\'s mailbox goes whole', () => {
  const cards = UNIT_PAGE(`<h2>Kontakt</h2><p>Mari Maasikas, sotsiaal.osakond@vald.example</p>
    <table><tr><td>Jaan Tamm</td><td><p>juhataja</p></td><td>sotsiaal.osakond@vald.example</td></tr><tr><td>Sotsiaalosakond</td><td><p>üldkontakt</p></td><td>sotsiaal.osakond@vald.example</td></tr></table>
    <p>Kati Kask</p><p>+372 5555 1234 +372 5555 4321 naidis.vald@naidis.example</p>
    <p>Sotsiaalosakonna üldkontakt on sotsiaal.osakond@vald.example ja infotelefon 612 3456, tööpäeviti kella 9–17.</p>`);
  // The third card is drawn on the page as the rule before read it: its second line is seven words as stored and six with its numbers and address marked.
  for (const gone of ['Maasikas', 'Tamm', 'Kask', 'juhataja', '5555', 'naidis.vald']) assert.equal(cards.html.includes(gone), false, gone);
  assert(cards.html.includes('<tr><td>Sotsiaalosakond</td><td><p>üldkontakt</p></td><td>sotsiaal.osakond@vald.example</td></tr>'));
  assert(cards.html.includes('<p>Sotsiaalosakonna üldkontakt on sotsiaal.osakond@vald.example ja infotelefon 612 3456, tööpäeviti kella 9–17.</p>'));
  // An address that went with a card is not counted as kept.
  assert.deepEqual(cards.contacts, { generalEmails: 2, otherEmails: 0, personLinks: 0, contactCards: 3, personalEmails: 0, phonesBesideThem: 0 });
  assert.deepEqual([cards.warnings, cards.needsReview], [['contact_card_removed'], false]);
  // A card on several lines whose address the rule cannot place: the card goes, and the address stays counted and the page held, as before ADR-132.
  const unplaced = UNIT_PAGE('<p>Mari Maasikas</p><p>juhataja</p><p>mari@amet.example</p>');
  assert.deepEqual([unplaced.html.includes('Maasikas'), unplaced.html.includes('mari@'), unplaced.contacts.otherEmails, unplaced.contacts.contactCards, unplaced.needsReview], [false, false, 1, 1, true]);
  // Two capitalised words beside a unit's mailbox are a card also when they are an institution: as before, and not what ADR-132 changes.
  const institution = UNIT_PAGE('<p>Näidise Vallavalitsus, sotsiaal.osakond@vald.example, tel 612 3456</p>');
  assert.deepEqual([institution.html.includes('sotsiaal.osakond'), institution.contacts.contactCards, institution.needsReview], [false, 1, false]);
  // A card on several lines whose only address is a unit's mailbox (review of 10.10.2026): the card goes whole, and the page stays held as it was before ADR-132. The mailbox stood beside
  // a name, so it counts as an address to look at, not as one the page keeps; the card is drawn by a guess, and a person sees what it left. The same under a heading that is a name.
  for (const card of ['<p>Mari Maasikas</p><p>juhataja</p><p>sotsiaal.osakond@vald.example</p>', '<h3>Mari Maasikas</h3><ul><li>juhataja</li><li>sotsiaal.osakond@vald.example</li></ul>']) {
    const lines = UNIT_PAGE(`${card}<p>Avaldusi võetakse vastu tööpäeviti kella üheksast viieni ja vastus tuleb kümne tööpäeva jooksul.</p>`);
    assert.deepEqual([/Maasikas|juhataja|sotsiaal\.osakond/u.test(lines.html), lines.html.includes('Avaldusi võetakse vastu')], [false, true], card);
    assert.deepEqual([lines.contacts, lines.warnings, lines.needsReview], [{ generalEmails: 0, otherEmails: 1, personLinks: 0, contactCards: 1, personalEmails: 0, phonesBesideThem: 0 }, ['contact_card_removed', 'email_needs_review'], true], card);
  }
  // With nothing but channel words in the address such a card never held the page, and does not now.
  const channelCard = UNIT_PAGE('<p>Mari Maasikas</p><p>juhataja</p><p>info@vald.example</p>');
  assert.deepEqual([/Maasikas|info@/u.test(channelCard.html), channelCard.contacts.generalEmails, channelCard.contacts.otherEmails, channelCard.contacts.contactCards, channelCard.needsReview], [false, 1, 0, 1, false]);
});

test('a card on several lines is drawn as before where a link\'s words now stand apart, and where only that shows the number', () => {
  // Second check of 10.10.2026. A line under a name with a linked address directly after a number was one word to the collector before ("6123456first.last@…", an address the rule could
  // not place): six words, a card's line, and the card went. Read apart, the same line is two marks and a word longer, and the name stayed in the page with the number and the address.
  // The loop asks the block as the collector before read it as well, so the card is what it was: after a number, after a dot, with a mailbox the rule keeps for a look.
  for (const line of ['üldtelefon ja faks tööpäeviti 612 3456<a href="mailto:mari.maasikas@amet.example">mari.maasikas@amet.example</a>', 'osakond vastab tööpäeviti numbril 6123456.<a href="mailto:naidismk.menetlus@kohus.example">naidismk.menetlus@kohus.example</a>',
    'tööpäeviti +372 5555 4321 linn.info@amet.example<a href="mailto:mari.maasikas@amet.example">meile</a>@amet.example 55551234']) {
    for (const lines of [`<p>Mari Maasikas</p><p>${line}</p>`, `<h3>Mari Maasikas</h3><ul><li>${line}</li></ul>`]) {
      const card = UNIT_PAGE(`${lines}<p>Avaldusi võetakse vastu tööpäeviti kella üheksast viieni ja vastus tuleb kümne tööpäeva jooksul.</p>`);
      assert.deepEqual([/Maasikas|612|5555|@|eemaldatud/u.test(card.html), card.html.includes('Avaldusi võetakse vastu'), card.contacts.contactCards, card.contacts.personalEmails, card.contacts.phonesBesideThem], [false, true, 1, 0, 0], lines);
      assert.equal(Object.values(card.contacts).some(count => count < 0), false, lines);
    }
  }
  // The other way: a linked number directly after a word was no number to the collector before, so nothing under the name gave a channel and there was no card. It is one now.
  const called = UNIT_PAGE('<p>Mari Maasikas</p><p>juhataja</p><p>tel<a href="tel:+37255551234">5555 1234</a></p><p>Avaldusi võetakse vastu tööpäeviti kella üheksast viieni.</p>');
  assert.deepEqual([/Maasikas|juhataja|5555/u.test(called.html), called.contacts.contactCards, called.needsReview], [false, 1, false]);
  // A web link kept its tag before, so its words stood apart then too: a line of eight words with its marks was the page's sentence, not the card's, and is that now. The address and
  // the number go, the name above stays, and a person looks at the page.
  const sentence = UNIT_PAGE('<p>Mari Maasikas</p><p>üldtelefon ja faks tööpäeviti 6123456<a href="mari.maasikas@amet.example">mari.maasikas@amet.example</a></p>');
  assert(sentence.html.includes('<p>Mari Maasikas</p>\n<p>üldtelefon ja faks tööpäeviti [telefon eemaldatud] [e-post eemaldatud]</p>'));
  assert.deepEqual(sentence.contacts, { generalEmails: 0, otherEmails: 0, personLinks: 1, contactCards: 0, personalEmails: 1, phonesBesideThem: 1 });
  // What a card's line kept is taken off the counts as it was counted (a count went below zero: read again from the gone card, an address stands beside the mark of its number).
  const counted = UNIT_PAGE('<h3>Mari Maasikas</h3><p>ja naidis.linn@naidis.example, +372 5555 4321.<a href="osakond@amet.example">osakond@amet.example</a></p><p>Avaldusi võetakse vastu tööpäeviti kella üheksast viieni.</p>');
  assert.deepEqual([/Maasikas|naidis|5555|osakond@/u.test(counted.html), counted.contacts, counted.needsReview],
    [false, { generalEmails: 0, otherEmails: 1, personLinks: 0, contactCards: 1, personalEmails: 0, phonesBesideThem: 0 }, true]);
});

test('a page that was held for an address stays held, and a person\'s address beside a unit\'s word goes as before', () => {
  // An address of a given name that is also a channel word, beside a word that is also a family name.
  const sentence = UNIT_PAGE('<p>Küsimuste korral kirjuta arved.linn@amet.example või helista 5555 1234.</p>');
  assert.deepEqual([sentence.contacts.generalEmails, sentence.contacts.otherEmails, sentence.warnings, sentence.needsReview], [0, 1, ['email_needs_review'], true]);
  const link = UNIT_PAGE('<p>Kirjuta <a href="mailto:arved.linn@amet.example">meile</a>.</p>');
  assert.deepEqual([link.contacts.personLinks, link.warnings, link.needsReview], [1, ['person_named_by_link'], true]);
  for (const address of ['mari.osakond@amet.example', 'mari2.keskus@amet.example', 'linn.kool@kool.example', 'maja.tamm@tamm.example', 'linn.osakond@amet.example', 'maja.keskus@amet.example', 'osakond.linn@amet.example',
    'tamm.maja@tamm.example', 'jyri.osakond@amet.example', 'uelle.keskus@amet.example']) {
    const person = UNIT_PAGE(`<p>Küsimuste korral kirjuta ${address} või helista 5555 1234.</p>`);
    assert(person.html.includes('<p>Küsimuste korral kirjuta [e-post eemaldatud] või helista [telefon eemaldatud].</p>'), address);
    assert.deepEqual([person.contacts.personalEmails, person.contacts.phonesBesideThem, person.needsReview], [1, 1, true], address);
  }
  // An address read from the middle of a longer one (only plain Latin letters are read, so a marked letter cuts it) is told apart as before ADR-132: the given name is not seen, so the
  // unit's word shields nothing and what is read goes with the number. A channel that is cut so stays a channel, as before.
  const cut = UNIT_PAGE('<p>Küsimuste korral kirjuta jüri.osakond@amet.example või helista 5555 1234.</p><p>Tööinfot saab aadressilt tööinfo@amet.example ja telefonilt 612 3456.</p>');
  assert(cut.html.includes('<p>Küsimuste korral kirjuta jü[e-post eemaldatud] või helista [telefon eemaldatud].</p>\n<p>Tööinfot saab aadressilt tööinfo@amet.example ja telefonilt 612 3456.</p>'));
  assert.deepEqual(cut.contacts, { generalEmails: 1, otherEmails: 0, personLinks: 0, contactCards: 0, personalEmails: 1, phonesBesideThem: 1 });
  // A link that writes to such an address holds the letter with its mark; the given name is read plain, and the link is a person's.
  assert.deepEqual([emailKind('jüri.osakond@amet.example'), UNIT_PAGE('<p>Kirjuta <a href="mailto:jüri.osakond@amet.example">osakonnale</a>.</p>').contacts.personLinks], ['personal', 1]);
});

test('a link to a unit\'s mailbox is no person\'s link unless its words name someone; a link whose target is a bare address loses the target', () => {
  const plainLink = UNIT_PAGE('<p>Kirjuta <a href="mailto:sotsiaal.osakond@vald.example">sotsiaalosakonnale</a> või <a href="mailto:info@vald.example">vallavalitsusele</a>.</p>');
  assert.deepEqual([plainLink.contacts.personLinks, plainLink.needsReview], [0, false]);
  const named = UNIT_PAGE('<p>Kirjuta <a href="mailto:sotsiaal.osakond@vald.example">Mari Maasikale</a>.</p>');
  assert.deepEqual([named.contacts.personLinks, named.warnings, named.needsReview], [1, ['person_named_by_link'], true]);
  assert.equal(UNIT_PAGE('<p>Kirjuta <a href="mailto:info@vald.example">Mari Maasikale</a>.</p>').contacts.personLinks, 0, 'as before');
  // A long paragraph is no card. With a name-like pair in it, a unit's mailbox is kept with its number and counts as one to look at.
  const long = UNIT_PAGE(`<p>Näidise Linnavalitsus võtab avaldusi vastu tööpäeviti, kirjuta sotsiaal.osakond@vald.example või helista 612 3456. ${'Avalduse võib tuua ka kohale ja ametnik aitab selle täita. '.repeat(5)}</p>`);
  assert(long.html.includes('sotsiaal.osakond@vald.example või helista 612 3456'));
  assert.deepEqual([long.contacts.generalEmails, long.contacts.otherEmails, long.warnings, long.needsReview], [0, 1, ['email_needs_review'], true]);
  // A target written without "mailto:" resolved into a web address ending in the e-mail address and stayed in the stored copy. The words stay, the target goes, and a person's is counted.
  const bare = UNIT_PAGE('<p><a href="mari.maasikas@amet.example">Kirjuta spetsialistile</a>, kes vastab tööpäeviti.</p><p><a href=" info@amet.example?subject=Tere">Kirjuta meile</a> oma küsimus.</p>');
  assert(bare.html.includes('<p>Kirjuta spetsialistile, kes vastab tööpäeviti.</p>\n<p>Kirjuta meile oma küsimus.</p>'));
  assert.deepEqual([/mari\.maasikas|info@amet|<a /u.test(bare.html), bare.contacts.personLinks, bare.stats.links, bare.warnings, bare.needsReview], [false, 1, 0, ['person_named_by_link'], true]);
  const channel = UNIT_PAGE('<p><a href="info@amet.example">Kirjuta meile</a> oma küsimus või vaata <a href="/juhend">juhendit</a>.</p>');
  assert.deepEqual([channel.html.includes('info@amet'), channel.html.includes('<a href="https://vald.example/juhend">juhendit</a>'), channel.contacts.personLinks, channel.needsReview], [false, true, 0, false]);
  // However the page wrote such a target (from the site's root, whole, with the @ encoded): what is stored is the resolved address, and that is what is read. A target with a scheme
  // before the address reads as a web address with a name before the host; an address may also stand in the query or in the middle of the path, with a dot encoded (review of
  // 10.10.2026). Each is a person's link: the words stay, the target is not stored, the page is held.
  for (const href of ['/kontakt/mari.maasikas@amet.example', 'https://vald.example/kontakt/mari.maasikas%40amet.example/', 'naidismk.menetlus@kohus.example', 'http://mari.maasikas@amet.example',
    '//mari.maasikas@amet.example', 'https://mari.maasikas:x@amet.example/kontakt', '/kontakt?to=mari.maasikas%40amet.example', '/saada/mari%2Emaasikas@amet.example/vorm', 'http://naidis.vald@naidis.example',
    // In a target an address is read with its marked letters: cut at one, what is left of these would pass for a channel.
    'tööinfo@amet.example', '/kontakt?to=jüri.info@amet.example', '/saada/t%C3%B6%C3%B6info%40amet.example/vorm',
    // One sequence that cannot be decoded does not hide the @ of an address beside it, nor in its own run (second check of 10.10.2026): the target is decoded run by run.
    '/x%ZZ/mari.maasikas%40amet.example/vorm', '/x%ZZ/mari.maasikas%40amet.example', '/saada/mari.maasikas%E0%40amet.example/vorm',
    // Another scheme where "mailto:" belongs, or a target that cannot be parsed at all: never stored, and read for its addresses as a mailto target is.
    'sip:mari.maasikas@amet.example', 'mail:mari.maasikas@amet.example', 'ftp://mari.maasikas@amet.example/failid', 'http://mari.maasikas@amet.example:port/']) {
    const written = UNIT_PAGE(`<p><a href="${href}">Kirjuta siia</a> oma küsimus.</p>`);
    assert.deepEqual([/<a |maasikas|menetlus|naidis\.vald/u.test(written.html), written.html.includes('<p>Kirjuta siia oma küsimus.</p>'), written.contacts.personLinks, written.stats.links, written.warnings, written.needsReview],
      [false, true, 1, 0, ['person_named_by_link'], true], href);
  }
  // Such a target to a channel, and a link that calls a number, are no person's link.
  const calls = UNIT_PAGE('<p>Helista <a href="sip:info@amet.example">meile</a> või numbril <a href="tel:+3726123456">612 3456</a>.</p>');
  assert.deepEqual([calls.html.includes('<p>Helista meile või numbril 612 3456.</p>'), calls.contacts.personLinks, calls.needsReview], [true, 0, false]);
  // A channel or a unit's mailbox before the host is no person's link, and no page either: the target goes. In the query of a real page it stays, as the channel stays in the text.
  const channels = UNIT_PAGE('<p><a href="//info@amet.example/">Kirjuta meile</a>, <a href="http://sotsiaal.osakond@vald.example">osakonnale</a> või <a href="/kontakt?to=info@amet.example">vormi kaudu</a>.</p>');
  assert(channels.html.includes('<p>Kirjuta meile, osakonnale või <a href="https://vald.example/kontakt?to=info@amet.example">vormi kaudu</a>.</p>'));
  assert.deepEqual([channels.contacts.personLinks, channels.stats.links, channels.needsReview], [0, 1, false]);
  // A web address with an @ that is no e-mail address stays a link.
  const handles = UNIT_PAGE('<p>Vaata <a href="https://sotsiaalmeedia.example/@naidisamet">meie kanalit</a> ja <a href="https://kaart.example/@58.37,26.72,17z">kaarti</a>.</p>');
  assert(handles.html.includes('<a href="https://sotsiaalmeedia.example/@naidisamet">meie kanalit</a> ja <a href="https://kaart.example/@58.37,26.72,17z">kaarti</a>'));
  assert.deepEqual([handles.contacts.personLinks, handles.needsReview], [0, false]);
  // A link that writes to several: one person's address among them makes it a person's link, in the list or as a copy. A target that cannot be decoded is read as it stands, and held.
  for (const [href, links] of [['mailto:info@amet.example,klienditugi@amet.example?subject=Tere', 0], ['mailto:info@amet.example,mari.maasikas@amet.example', 1], ['mailto:info@amet.example;%20mari.maasikas@amet.example', 1],
    ['mailto:info@amet.example?cc=mari.maasikas@amet.example', 1], ['mailto:?to=mari.maasikas%40amet.example', 1], ['mailto:%E0%A4%A', 1]]) {
    const several = UNIT_PAGE(`<p>Kirjuta <a href="${href}">meile</a> oma küsimus.</p>`);
    assert.deepEqual([several.html.includes('<p>Kirjuta meile oma küsimus.</p>'), several.contacts.personLinks, several.needsReview], [true, links, links > 0], href);
  }
});

test('a document whose file name has the form of an address keeps its link, unless the address is a person\'s', () => {
  // A form is given by its link (review of 10.10.2026): a file named after a channel or a unit's mailbox is a document like any other, and its target is not read as a bare address.
  const forms = UNIT_PAGE('<p>Täida <a href="/failid/info@amet.example.pdf">avalduse vorm</a> ja <a href="/failid/sotsiaal.osakond@vald.example.docx?v=2">selle lisa</a> ning saada need meile.</p>');
  assert(forms.html.includes('<p>Täida <a href="https://vald.example/failid/info@amet.example.pdf">avalduse vorm</a> ja <a href="https://vald.example/failid/sotsiaal.osakond@vald.example.docx?v=2">selle lisa</a> ning saada need meile.</p>'));
  assert.deepEqual(forms.documents, [{ url: 'https://vald.example/failid/info@amet.example.pdf', text: 'avalduse vorm', type: 'pdf' }, { url: 'https://vald.example/failid/sotsiaal.osakond@vald.example.docx?v=2', text: 'selle lisa', type: 'docx' }]);
  assert.deepEqual([forms.contacts.personLinks, forms.stats.links, forms.warnings, forms.needsReview], [0, 2, [], false]);
  // Where the form's link and a person's address pull apart, the address goes: a file named after a person's address (or one the rule cannot place) is not stored as a target nor
  // listed as a document. Not silently: the link's words stay and the page is held for a person, who gives the form another way.
  for (const file of ['mari.maasikas@amet.example.pdf', 'naidismk.menetlus@kohus.example.docx', 'mari.maasikas@amet.example/download', 'tööinfo@amet.example.pdf']) {
    const named = UNIT_PAGE(`<p>Täida <a href="/failid/${file}">volituse vorm</a> ja <a href="/failid/juhend.pdf">loe juhendit</a>.</p>`);
    assert(named.html.includes('<p>Täida volituse vorm ja <a href="https://vald.example/failid/juhend.pdf">loe juhendit</a>.</p>'), file);
    assert.deepEqual([named.documents.map(item => item.url), named.contacts.personLinks, named.warnings, named.needsReview], [['https://vald.example/failid/juhend.pdf'], 1, ['person_named_by_link'], true], file);
  }
  // The file's ending is not the last label of the address's domain: read with it, "example" would count as the domain's own name and make a mailbox of this one.
  const ending = UNIT_PAGE('<p>Täida <a href="/failid/example.osakond@amet.example.pdf">vorm</a> ja saada see meile.</p>');
  assert.deepEqual([emailKind('example.osakond@amet.example'), ending.documents.length, ending.contacts.personLinks, ending.needsReview], ['other', 0, 1, true]);
});

test('the words of a link that lost its tag do not run into the number or the address beside them', () => {
  // Found in review (10.10.2026): a kept link's tag keeps its words apart from the text, a dropped one did not. A person's address directly after a number was stored as one word with the
  // digits, read as an address the rule cannot place, and stayed with the number. So for a bare address as for every mailto link.
  for (const href of ['mari.maasikas@amet.example', 'mailto:mari.maasikas@amet.example']) {
    const joined = UNIT_PAGE(`<p>Tel 612 3456<a href="${href}">mari.maasikas@amet.example</a>5555 1234</p>`);
    assert(joined.html.includes('<p>Tel [telefon eemaldatud] [e-post eemaldatud] [telefon eemaldatud]</p>'), href);
    assert.deepEqual(joined.contacts, { generalEmails: 0, otherEmails: 0, personLinks: 1, contactCards: 0, personalEmails: 1, phonesBesideThem: 2 }, href);
    // A dot or a hyphen between the digits and the link is no part of the address either (second check of 10.10.2026): the address was still one word with the number, and stayed.
    for (const sign of ['.', '-']) {
      const signed = UNIT_PAGE(`<p>Tel 612 3456${sign}<a href="${href}">mari.maasikas@amet.example</a></p>`);
      assert.deepEqual([signed.html.includes(`<p>Tel [telefon eemaldatud]${sign} [e-post eemaldatud]</p>`), signed.contacts.otherEmails, signed.contacts.personalEmails, signed.contacts.phonesBesideThem], [true, 0, 1, 1], `${sign} ${href}`);
    }
    // Nor is the number, where the link stands on the first half of the address only and the rest is written after it: directly after the digits, or after a sign.
    for (const sign of ['', '-']) assert(UNIT_PAGE(`<p>Tel 612 3456${sign}<a href="${href}">mari.maasikas</a>@amet.example</p>`).html.includes(`<p>Tel [telefon eemaldatud]${sign} [e-post eemaldatud]</p>`), `${sign} ${href}`);
  }
  // A channel after such a sign was one word with the number, an address to look at, and holds the page as it did; the two now read apart.
  const signedChannel = UNIT_PAGE('<p>Tel 612 3456.<a href="mailto:info@amet.example">info@amet.example</a></p>');
  assert.deepEqual([signedChannel.html.includes('<p>Tel 612 3456. info@amet.example</p>'), signedChannel.contacts.generalEmails, signedChannel.contacts.otherEmails, signedChannel.needsReview], [true, 0, 1, true]);
  // Wherever a block's words are put together: in a list item, in a table's cell, in loose text.
  const places = UNIT_PAGE(`<ul><li>tel 612 3456<a href="mailto:mari.maasikas@amet.example">mari.maasikas@amet.example</a></li></ul><table><tr><td>abi</td><td>tel 612 0000<a href="mailto:kati.kask@amet.example">kati.kask@amet.example</a></td></tr></table>
    <div>tel 612 1111<a href="mailto:jaan.tamm@amet.example">jaan.tamm@amet.example</a></div>`);
  assert.deepEqual([places.html.split('tel [telefon eemaldatud] [e-post eemaldatud]').length - 1, /\d@|\d[a-z]+\.[a-z]+@/u.test(places.html), places.contacts.otherEmails, places.contacts.personalEmails, places.contacts.phonesBesideThem], [3, false, 0, 3, 3]);
  // A number that is a link is read as a number also directly after a word and before one: a name beside it is a card, and a help line reads as the page shows it.
  const called = UNIT_PAGE('<p>Mari Maasikas, tel<a href="tel:+37255551234">5555 1234</a></p><p>Infotelefon<a href="tel:6123456">612 3456</a>vastab tööpäeviti, riigi number on +372<a href="tel:+3726120000">612 0000</a>.</p>');
  assert.deepEqual([/Maasikas|5555/u.test(called.html), called.html.includes('<p>Infotelefon 612 3456 vastab tööpäeviti, riigi number on +372 612 0000.</p>'), called.contacts.contactCards, called.needsReview], [false, true, 1, false]);
  // The other way round, the link's words are a name or a post and the number or the address stands outside it, directly against them: read apart, a name beside a number is a card.
  for (const body of ['<p>5555 1234<a href="mailto:mari.maasikas@amet.example">Mari Maasikale</a></p>', '<p><a href="mailto:mari.maasikas@amet.example">Mari Maasikas</a>5555 1234</p>', '<p>+372 5555 1234<a href="tel:+37255554321">Mari Maasikas</a></p>']) {
    const card = UNIT_PAGE(body);
    assert.deepEqual([/Maasika|5555/u.test(card.html), card.contacts.contactCards], [false, 1], body);
  }
  // A link on half an address still joins the half written after it: the whole address is read and goes. So does the first half before a link that begins in the middle of an
  // address, after a letter, a dot or a hyphen, whatever the link writes to (second check of 10.10.2026: read apart, "mari.maa" was left in the text beside the mark): an address
  // that is a person's as one word with what it ran into goes as that one word, as every reading before took it. A post the address ran into ("juhataja") goes the same way: whether
  // a word before an address is a part of it cannot be told, so nothing that may be half a name is left.
  for (const written of ['<a href="mailto:mari.maasikas@amet.example">mari.maasikas</a>@amet.example', 'mari<a href="mailto:mari.maasikas@amet.example">.maasikas@amet.example</a>', 'mari.maasikas@<a href="mailto:mari.maasikas@amet.example">amet.example</a>',
    'mari.maa<a href="mailto:mari.maasikas@amet.example">sikas@amet.example</a>', 'mari.<a href="mailto:mari.maasikas@amet.example">maasikas@amet.example</a>', 'mari.maa<a href="mari.maasikas@amet.example">sikas@amet.example</a>',
    'mari.maa<a href="mailto:info@amet.example">sikas@amet.example</a>', 'mari.<a href="mailto:info@amet.example">maasikas@amet.example</a>', 'jaan-<a href="mailto:erik.tamm@amet.example">erik.tamm@amet.example</a>',
    'mari<a href="mailto:info@amet.example">.maasikas@amet.example</a>', '<a href="mailto:mari.maasikas@amet.example">juhataja</a>mari.maasikas@amet.example']) {
    const half = UNIT_PAGE(`<p>Kirjuta ${written} või helista 5555 1234.</p>`);
    assert(half.html.includes('<p>Kirjuta [e-post eemaldatud] või helista [telefon eemaldatud].</p>'), written);
    assert.deepEqual([half.contacts.personalEmails, half.contacts.otherEmails, half.contacts.phonesBesideThem, half.html.includes(String.fromCharCode(0xFDD0))], [1, 0, 1, false], written);
  }
  // What an address ran into goes with it only where the two are a person's address as one word. Digits, a channel word before a dot, a word of one letter are no half of a name:
  // they stay, and the address goes by the reading apart. A link whose words are a whole address stands apart from the digits before it whatever it writes to: a list, or a longer
  // address that ends so.
  for (const [written, left] of [['Tel 612 3456<a href="mailto:info@amet.example,mari.maasikas@amet.example">mari.maasikas@amet.example</a>', 'Tel [telefon eemaldatud] [e-post eemaldatud]'],
    ['Tel 612 3456<a href="mailto:anna.mari.maasikas@amet.example">mari.maasikas@amet.example</a>', 'Tel [telefon eemaldatud] [e-post eemaldatud]'], ['Kontakt.<a href="mailto:mari.maasikas@amet.example">mari.maasikas@amet.example</a>', 'Kontakt. [e-post eemaldatud]'],
    ['E-post<a href="mailto:mari.maasikas@amet.example">mari.maasikas@amet.example</a>', 'E-post [e-post eemaldatud]']]) assert(UNIT_PAGE(`<p>${written}</p>`).html.includes(`<p>${left}</p>`), written);
  // The end of another address is no half of the one linked directly after it: a person's address goes, and the one before it is not cut, kept or removed. Before, two such were read
  // as one channel's address with the person's name in its domain, and stayed. A channel that ran into another address is one to look at, as any address that ran into a word.
  const twice = UNIT_PAGE(`<p>Kirjuta info@tamm.example<a href="mailto:mari.maasikas@amet.example">mari.maasikas@amet.example</a> või kati.kask@tamm.example<a href="mailto:jaan.tamm@amet.example">jaan.tamm@amet.example</a>.</p>
    <p>Abi saab aadressilt info@amet.example<a href="mailto:klienditugi@amet.example">klienditugi@amet.example</a> iga päev.</p>`);
  assert(twice.html.includes('<p>Kirjuta info@tamm.example [e-post eemaldatud] või [e-post eemaldatud] [e-post eemaldatud].</p>\n<p>Abi saab aadressilt info@amet.example klienditugi@amet.example iga päev.</p>'));
  assert.deepEqual([twice.contacts.generalEmails, twice.contacts.otherEmails, twice.contacts.personalEmails, twice.needsReview, twice.html.includes(String.fromCharCode(0xFDD0))], [2, 1, 3, true, false]);
  // Elsewhere the words stand as the page wrote them: an ending after a linked address or a short number, a plus sign before a linked number, a link between spaces or signs.
  const asWritten = UNIT_PAGE('<p>Kirjuta <a href="mailto:info@amet.example">info@amet.example</a>ile, helista <a href="tel:112">112</a>le või +<a href="tel:+3726123456">372 612 3456</a> (<a href="mailto:info@amet.example">e-post</a>).</p>');
  assert(asWritten.html.includes('<p>Kirjuta info@amet.exampleile, helista 112le või +372 612 3456 (e-post).</p>'));
  // The space lets nothing go. An address that ran into the word before it was read as one word with it, and so was more than a channel: beside a name a card, in a sentence an
  // address to look at, and with a given name in it a person's. It is read both ways and the stricter reading holds, so each of these is what it was.
  const answers = 'Küsimustele vastab igal tööpäeval kella üheksast kuni kaheteistkümneni meie osakonna juhataja Kati Kask';
  const ranInto = UNIT_PAGE(`<p>${answers}<a href="mailto:klienditugi@amet.example">klienditugi@amet.example</a></p><ul><li>abi saab tasuta<a href="mailto:klienditugi@amet.example">klienditugi@amet.example</a></li></ul>
    <p>Avalduse saab esitada ka aadressil<a href="mailto:arved.linn@amet.example">arved.linn@amet.example</a> või telefonil 5555 1234.</p>`);
  assert(ranInto.html.includes('<ul><li>abi saab tasuta klienditugi@amet.example</li></ul>\n<p>Avalduse saab esitada ka [e-post eemaldatud] või telefonil [telefon eemaldatud].</p>'), 'a person\'s only as one word with "aadressil": it goes as that word, as before');
  assert.deepEqual([ranInto.html.includes('Kati Kask'), ranInto.contacts, ranInto.warnings, ranInto.needsReview],
    [false, { generalEmails: 0, otherEmails: 1, personLinks: 1, contactCards: 1, personalEmails: 1, phonesBesideThem: 1 }, ['contact_card_removed', 'personal_contact_removed', 'email_needs_review', 'person_named_by_link'], true]);
  // Written with a space, the same channel beside a name is no card and holds no page, as before.
  const spaced = UNIT_PAGE(`<p>${answers} <a href="mailto:klienditugi@amet.example">klienditugi@amet.example</a></p><ul><li>abi saab tasuta <a href="mailto:klienditugi@amet.example">klienditugi@amet.example</a></li></ul>`);
  assert.deepEqual([spaced.html.includes('Kati Kask klienditugi@amet.example'), spaced.contacts.generalEmails, spaced.contacts.otherEmails, spaced.contacts.contactCards, spaced.needsReview], [true, 2, 0, 0, false]);
  // Where the word an address ran into is itself read from the middle of a longer one (a marked letter cuts it), that one word is told apart by the rule before ADR-132, like every cut
  // reading (second check of 10.10.2026): a link on the end of "jüri.osakond@" goes with its number, and so does a mailbox after "tänaval", as before (the one word is read from
  // "naval" on, and goes as it was read); a channel stays a channel.
  const cutWord = UNIT_PAGE(`<p>Küsimuste korral kirjuta jü<a href="mailto:ri.osakond@amet.example">ri.osakond@amet.example</a> või helista 5555 1234.</p>
    <p>Avalduse võib tuua ka tänaval<a href="mailto:sotsiaal.osakond@vald.example">sotsiaal.osakond@vald.example</a> või helista 5555 4321.</p><p>Tööinfot saab aadressilt töö<a href="mailto:info@amet.example">info@amet.example</a> ja telefonilt 612 3456.</p>`);
  assert(cutWord.html.includes('<p>Küsimuste korral kirjuta jü [e-post eemaldatud] või helista [telefon eemaldatud].</p>\n<p>Avalduse võib tuua ka tä[e-post eemaldatud] või helista [telefon eemaldatud].</p>\n<p>Tööinfot saab aadressilt töö info@amet.example ja telefonilt 612 3456.</p>'));
  assert.deepEqual(cutWord.contacts, { generalEmails: 1, otherEmails: 0, personLinks: 1, contactCards: 0, personalEmails: 2, phonesBesideThem: 2 });
  // After a word that is read whole the mailbox is read by the rule as it is now, both ways: one word with "aadressil" it is an address the rule cannot place, so it stays with its
  // number and a person looks at the page.
  const wholeWord = UNIT_PAGE('<p>Avalduse võib saata aadressil<a href="mailto:sotsiaal.osakond@vald.example">sotsiaal.osakond@vald.example</a> või helista 612 3456.</p>');
  assert.deepEqual([wholeWord.html.includes('<p>Avalduse võib saata aadressil sotsiaal.osakond@vald.example või helista 612 3456.</p>'), wholeWord.contacts.generalEmails, wholeWord.contacts.otherEmails, wholeWord.needsReview], [true, 0, 1, true]);
  // A new word after a linked address (a capital letter, not an ending) is read apart from it.
  assert(UNIT_PAGE('<p>Kirjuta <a href="mailto:info@amet.example">info@amet.example</a>Avatud oleme tööpäeviti.</p>').html.includes('<p>Kirjuta info@amet.example Avatud oleme tööpäeviti.</p>'));
  // The space that keeps a link's words apart adds no word to its unit: what is a card by its length is what it was. Forty words as the page runs them together, with a name and a
  // linked number among them, are a card; with one word more they are a sentence that keeps its number. What is written has plain spaces only.
  const forty = filler => UNIT_PAGE(`<p>${'sõna '.repeat(filler)}Mari Maasikas, tel<a href="tel:+37255551234">5555 1234</a></p><p>Abi saab ka numbrilt<a href="tel:6123456">612 3456</a>.</p>`);
  assert.deepEqual([forty(36).contacts.contactCards, forty(36).html.includes('Maasikas'), forty(37).contacts.contactCards, forty(37).html.includes('Mari Maasikas, tel 5555 1234</p>\n<p>Abi saab ka numbrilt 612 3456.</p>')], [1, false, 0, true]);
  for (const page of [forty(36), forty(37), places, called, asWritten]) assert.equal([0xA0, 0xFDD0].some(code => page.html.includes(String.fromCharCode(code))), false);
  // A kept link reads as it did: its tag stands between its words and the text.
  assert(UNIT_PAGE('<p>Vaata akti nr<a href="/akt/12345678">12345678</a>ja juhendit.</p>').html.includes('<p>Vaata akti nr<a href="https://vald.example/akt/12345678">12345678</a>ja juhendit.</p>'));
  // The mark that stands for a dropped tag while a block is read (U+FDD0) is a character of no text; a page that holds it cannot ask for a space with it.
  assert(UNIT_PAGE(`<p>Number${String.fromCharCode(0xFDD0)}612 3456${String.fromCharCode(0xFDD0)}on siin kirjas.</p>`).html.includes('<p>Number612 3456on siin kirjas.</p>'));
  assert(UNIT_PAGE(`<button aria-expanded="false" aria-controls="p1">Kuidas${String.fromCharCode(0xFDD0)}taotleda?</button><div id="p1"><p>Avaldusega.</p></div>`).html.includes('<h4>Kuidastaotleda?</h4>\n<p>Avaldusega.</p>'));
});

test('the one hold ADR-132 lets go: a unit\'s mailbox with no name in its own paragraph', () => {
  // The page was held for the address the rule could not place, not for the name in the paragraph before it; the mailbox is the institution's now, and nothing else on the page asks for a look.
  const page = UNIT_PAGE('<p>Osakonda juhib Mari Maasikas, kes vastab küsimustele tööpäeviti kella üheksast viieni ja reedeti kella üheksast kuni kolmeni.</p><p>sotsiaal.osakond@vald.example</p>');
  assert(page.html.includes('Mari Maasikas') && page.html.includes('<p>sotsiaal.osakond@vald.example</p>'));
  assert.deepEqual([page.contacts.generalEmails, page.contacts.otherEmails, page.warnings, page.needsReview], [1, 0, [], false]);
});

test('the collector\'s name changed with the rule; a link\'s target is not in the content hash, so a dropped address target alone proposes no page', () => {
  assert.equal(WEB_PAGE_COLLECTOR, 'rag-v2/web-page-2');
  const hash = body => UNIT_PAGE(body).contentSha256;
  assert.equal(hash('<p>Kirjuta <a href="/kontakt">meile</a> oma küsimus.</p>'), hash('<p>Kirjuta <a href="/teine">meile</a> oma küsimus.</p>'));
  // A link that stands between spaces reads the same with its target and without: the 46 address targets in the stored pages all stand so (counted 10.10.2026).
  assert.equal(hash('<p>Kirjuta <a href="info@amet.example">meile</a> oma küsimus.</p>'), hash('<p>Kirjuta <a href="/kontakt">meile</a> oma küsimus.</p>'));
  // Other text is another page.
  assert.notEqual(hash('<p>Kirjuta <a href="info@amet.example">meile</a> oma küsimus.</p>'), hash('<p>Kirjuta <a href="info@amet.example">neile</a> oma küsimus.</p>'));
  // A page reads differently, and is proposed, only where a link without its tag stood directly against a letter or a digit with an address or a phone number for its words: the space
  // that keeps them apart is the one a visitor's eye puts there. Such a link after a sign or a space reads as it did.
  assert.equal(hash('<p>Infotelefon<a href="tel:6123456">612 3456</a> vastab.</p>'), hash('<p>Infotelefon 612 3456 vastab.</p>'));
  assert.equal(hash('<p>E-post:<a href="mailto:info@amet.example">info@amet.example</a>, tel.<a href="tel:6123456">612 3456</a></p>'), hash('<p>E-post:info@amet.example, tel.612 3456</p>'));
});
