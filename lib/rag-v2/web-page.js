import { createHash } from 'node:crypto';
import { parseDocument } from 'htmlparser2';
import { GIVEN_NAMES } from './web-select-words.js';

// A web page as a corpus source (owner 06.10.2026: "teeks mingi hea info korjanduse skripti lehtedele").
// The collector keeps what the page says and lets the site around it go: of the fetched HTML it takes the content
// region (main, article), drops navigation, cookie notices, forms and media, and writes a small standalone HTML file
// with one <article> of headings, paragraphs, lists and tables. That is the form the corpus reader takes as it is
// (text-source.js reads an HTML source's single article). Beside it goes the page's metadata: where and when it was
// read, hashes for the next check, the documents it links to (forms and guides are given by link, not copied), and
// what was left out.
// Rules it keeps:
// - A person's contact never goes into the stored copy: a personal e-mail address is removed together with the phone
//   numbers beside it, and such a page is marked for review (the name may still stand in the text). An institution's
//   general channels (info@, a help line) stay, and so does a unit's mailbox (a department's, a court house's) with the
//   numbers beside it (ADR-132, 10.10.2026): they are what the page tells the reader to use. What a contact card is
//   did not change with that.
// - A changed page never replaces the stored one by itself: the change is a proposal until a second read gives the same
//   content (decidePage), or the owner applies it.
// web-page-2 (ADR-132): a unit's mailbox is told from a person's address (emailKind); a link whose target is an e-mail
// address, or holds a person's, loses its target; and the words of a link that lost its tag no longer run into the
// number or the address beside them. The content hash holds neither this name nor a link's target, so the new name
// alone proposes no page: a page is proposed only where its text reads differently.
export const WEB_PAGE_COLLECTOR = 'rag-v2/web-page-2';
const sha = value => createHash('sha256').update(value).digest('hex');
const escape = value => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const quote = value => escape(value).replace(/"/gu, '&quot;');
// A link's target as it is written out (a poor page throws nothing). It is decoded run by run: a run that cannot be decoded is read as it stands, but for its plain signs ("%40",
// "%2E"), so that one bad sequence anywhere in a target does not hide the @ of an address beside it (ADR-132, second check of 10.10.2026: decoded whole, a target like
// "/x%ZZ/first.last%40host/form" was read as holding no address and stayed stored).
const decoded = value => value.replace(/(?:%[0-9A-Fa-f]{2})+/gu, run => { try { return decodeURIComponent(run); } catch { return run.replace(/%([0-7][0-9A-Fa-f])/gu, (code, hex) => String.fromCharCode(parseInt(hex, 16))); } });

const name = node => (node.name ? node.name.toLowerCase() : null);
const kids = node => node.children || [];
const text = node => (node.type === 'text' ? node.data : kids(node).map(text).join(''));
const squeeze = value => value.replace(/\s+/gu, ' ').trim();
const flat = node => [node, ...kids(node).flatMap(flat)];
const has = (node, tag) => flat(node).some(child => name(child) === tag);

// Never text of the page: code, media, controls, the site's own navigation and footer.
const DROPPED = new Set(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'nav', 'form', 'input', 'select', 'textarea', 'footer', 'aside',
  'img', 'picture', 'video', 'audio', 'canvas', 'object', 'embed', 'map', 'head', 'link', 'meta', 'dialog']);
const DROPPED_ROLES = new Set(['navigation', 'banner', 'contentinfo', 'search', 'complementary', 'dialog', 'alertdialog', 'menu', 'menubar', 'toolbar']);
// A block of the site, not of the page, by the name its markup gives it. A name is only a hint (a utility class says
// "print", a layout wrapper says "sidebar"), so two things overrule it: a block the markup names as content (an
// accordion or tab panel, the body field), and any block that holds a large share of the region's text.
const NOISE = /(?:^|[\s_-])(?:cookies?|consent|gdpr|breadcrumbs?|share|sharing|social|navbar|menu|sidebar|search|newsletter|skip|pager|pagination|toolbar|lang(?:uage)?-?switch(?:er)?|modal|popup|overlay|advert|feedback|toc|tabs-nav)(?:[\s_-]|$)/iu;
const CONTENT = /(?:^|[\s_-])(?:accordion|collapse|tab-pane|tabpanel|panel|paragraph|field--name-body|node__content|article-body|content-body)(?:[\s_-]|$)/iu;
const NOISE_SHARE = 0.3;
const KEPT = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'blockquote', 'dl', 'dt', 'dd', 'pre']);
const INLINE = new Set(['strong', 'b', 'em', 'i', 'sub', 'sup']);
// Inline elements whose text runs on in the sentence around them.
const RUNS_ON = new Set(['a', 'br', 'span', 'label', 'small', 'abbr', 'time', 'u', 'mark', 'code', 'cite', 'q', 'font', 'del', 'ins', 's', 'kbd', 'var', 'samp', 'bdi', 'bdo', 'data', 'dfn', 'nobr', 'wbr', ...INLINE]);
// A unit a contact stands in: the innermost paragraph, list item, table row or definition.
const UNIT = /<(p|li|tr|dd)>(?:(?!<\/?(?:p|li|tr|ul|ol|table|dd)>)[\s\S])*?<\/\1>/gu, UNIT_TEST = /<(?:p|li|tr|dd)>/u;
// A table row whole, a cell without a block of its own, and whether a row holds a block (a paragraph, a list) in a cell.
const ROW = /<tr>(?:(?!<\/?tr>)[\s\S])*?<\/tr>/gu, CELL = /<(td|th)>(?:(?!<\/?(?:p|li|tr|ul|ol|table|dd|td|th)>)[\s\S])*?<\/\1>/gu, NESTED_BLOCK = /<(?:p|li|ul|ol|dd|table)>/u;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, HIDDEN_EMAIL = '[peidetud e-post]';
const EMAIL_TEST = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u;
// In a link's target an address is read with every letter before the @, a marked one too (a target holds "jüri.osakond@" whole, written in %-codes): read by EMAIL it would be cut
// at the marked letter, and what is left ("…info@") could pass for a channel.
const TARGET_EMAIL = /[\p{L}\p{M}\p{N}._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, TARGET_ADDRESS = /^[\p{L}\p{M}\p{N}._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u;
// ADR-132 (10.10.2026): a link that loses its tag (a link that writes or calls, a target that is or holds an address) left its words standing directly against the text before and after
// it, where a kept link's tag keeps them apart: "Tel 612 3456<a href="mailto:…">first.last@…</a>" was stored as one word with the digits, read as an address the rule cannot place, and
// stayed with the number; "5555 1234<a href="mailto:…">First Last</a>" was no number any more, so no card (review of 10.10.2026; every mailto link behaved so). A mark stands where the tag
// stood until the block is whole; `settle` then puts a space only where an address or a phone number on one side of it would run into a letter or a digit on the other, and takes the
// marks out. Nothing else moves: an ending written after a linked address or a short number stays on it, a plus sign stays on its number, and a label that is half an address
// ("first.last" before a written "@amet.example") still joins the other half, so the whole address is read.
// Before a linked address a dot or a hyphen counts as a letter does (second check of 10.10.2026): "Tel 612 3456.<a>first.last@…</a>" and "612 3456-<a>…" were still one word with the
// digits and stayed with the number. Every sign an address may hold before its @ is so covered. A link that begins in the middle of an address ("first.la" before a linked
// "st@amet.example") is cut from its first half by the same space; `scrub` reads such an address both ways and takes the first half with it (RAN_INTO).
// The space is a no-break space while the page is read and a plain one when it is written. The readers take it for a space (an address and a number end at it); the count of a
// unit's words does not (plain keeps it), so a unit is as long as it was read before and what is a card by its length did not change. Both characters are the collector's own: a
// page's U+FDD0 is dropped and its no-break spaces are plain spaces from the moment its text is read.
const LINK_EDGE = '\uFDD0', LINK_EDGES = /\uFDD0+/gu, LINK_SPACE = '\u00A0', LINK_SPACES = /\u00A0/gu, RAN_INTO = /[A-Za-z0-9._%+-]+\u00A0\uFDD0/gu;
const settle = value => value.replace(LINK_EDGES, LINK_EDGE).replace(/([\p{L}\p{N}._%+-])\uFDD0(?=[A-Za-z0-9][A-Za-z0-9._%+\uFDD0-]*@)/gu, `$1${LINK_SPACE}`).replace(/([\p{L}\p{N}_])\uFDD0(?=\+?\d(?:[\s-]?\d){6})/gu, `$1${LINK_SPACE}`)
  .replace(/(\d(?:[\s-]?\d){6})\uFDD0(?=[\p{L}\p{N}_])/gu, `$1${LINK_SPACE}`).replace(/(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\uFDD0(?=[\p{N}\p{Lu}])/gu, `$1${LINK_SPACE}`).replace(LINK_EDGES, '');
const PHONE = /(?:\+372[\s-]?)?\b\d(?:[\s-]?\d){6,7}\b/u;
// A first name and a family name: two capitalised words in a row (also with a hyphen).
const PERSON = /\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?/u;
// A heading that is nothing but a name (seen on a register's contact page: each official a heading, the channels under it).
const BARE_NAME = /^\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?(?:\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?){1,2}$/u;
const BOILERPLATE = /^(?:Täname tagasiside eest!?|Kas (?:sellest lehest|see leht) oli (?:abi|kasulik)\??|Jaga|Prindi|Tagasi üles|Tagasi|Tagasi nimekirja|Back to list|Loe edasi)$/iu;
const DOCUMENT = /\.(pdf|docx?|xlsx?|odt|ods|rtf|pptx?|bdoc|asice|ddoc)(?:[?#]|$)|\/download(?:[?#/]|$)/iu, DOCUMENT_END = /\.(?:pdf|docx?|xlsx?|odt|ods|rtf|pptx?|bdoc|asice|ddoc)$/iu;

function isDropped(node, fallback, regionChars = Infinity) {
  const tag = name(node);
  if (!tag) return node.type !== 'text';
  if (DROPPED.has(tag) || DROPPED_ROLES.has((node.attribs?.role || '').toLowerCase())) return true;
  // The page's own heading is kept wherever it stands: a hero block, a header.
  if (has(node, 'h1')) return false;
  if (tag === 'header' && fallback) return true;
  const named = `${node.attribs?.class || ''} ${node.attribs?.id || ''}`;
  if (NOISE.test(named) && !CONTENT.test(named) && squeeze(text(node)).length <= NOISE_SHARE * regionChars) return true;
  // A plain button is a control; one that opens a panel is that panel's title (an accordion's question).
  if (tag === 'button' && node.attribs?.['aria-expanded'] === undefined && node.attribs?.['aria-controls'] === undefined) return true;
  // Without a content region the page's link lists are its menus.
  if (fallback && ['ul', 'ol', 'div', 'section'].includes(tag)) {
    const links = flat(node).filter(child => name(child) === 'a'), all = squeeze(text(node)).length;
    if (links.length >= 4 && all && links.reduce((sum, link) => sum + squeeze(text(link)).length, 0) / all > 0.75) return true;
  }
  return false;
}

// hint: "#id", ".class", "tag" or "tag.class", for a page whose content the markup does not single out.
function matches(node, hint) {
  const [, tag = '', mark = '', value = ''] = hint.match(/^([a-z0-9]*)([#.]?)([\w-]*)$/iu) || [];
  if (tag && name(node) !== tag.toLowerCase()) return false;
  if (mark === '#') return node.attribs?.id === value;
  if (mark === '.') return (node.attribs?.class || '').split(/\s+/u).includes(value);
  return Boolean(tag);
}
// Two hints with a space between ("main .field--name-body") name the second inside the first (ADR-143): a site gives one class to an article's body and to its own description
// block in the header, so the class alone names two blocks and no region. A hint of one part is read as before.
const inside = (node, hint) => { for (let up = node.parent; up; up = up.parent) if (name(up) && matches(up, hint)) return true; return false; };
function hinted(nodes, hint) {
  const parts = hint.trim().split(/\s+/u);
  return parts.length === 2 ? nodes.filter(node => matches(node, parts[1]) && inside(node, parts[0])) : nodes.filter(node => matches(node, hint));
}
// The day a page says of itself, in the element a list entry names (updated_region): the date as the page writes it ("Kontrollitud: 26.06.2026"), or the day of its <time> mark.
// null unless one element is named and its date is a day of the calendar.
function statedDay(dom, hint) {
  const found = hinted(flat(dom).filter(name), hint);
  if (found.length !== 1) return null;
  const written = squeeze(text(found[0])).match(/(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/u), marked = flat(found[0]).find(node => name(node) === 'time')?.attribs?.datetime?.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  const [year, month, day] = written ? [written[3], written[2], written[1]].map(Number) : marked ? marked.slice(1).map(Number) : [];
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1990 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}
function region(dom, hint) {
  const nodes = flat(dom).filter(name);
  if (hint) { const found = hinted(nodes, hint); if (found.length === 1) return { node: found[0], how: 'hint' }; }
  const outer = list => list.filter(node => !list.some(parent => parent !== node && flat(parent).includes(node)));
  const mains = outer(nodes.filter(node => name(node) === 'main' || node.attribs?.role === 'main'));
  if (mains.length === 1) return { node: mains[0], how: 'main' };
  const articles = outer(nodes.filter(node => name(node) === 'article'));
  if (articles.length === 1) return { node: articles[0], how: 'article' };
  const named = nodes.filter(node => ['content', 'main-content', 'main', 'page-content'].includes(node.attribs?.id));
  if (named.length === 1) return { node: named[0], how: 'content_id' };
  return { node: nodes.find(node => name(node) === 'body') || dom, how: 'body' };
}

/**
 * The content of a fetched page. html: the response body as text; url: the address it came from (links are resolved
 * against it); options.region: a hint for the content region; options.updatedRegion: a hint for the element outside
 * it where the page says when it was last changed or checked. Returns the stored HTML, its text hash, and what the
 * report and the metadata say of the page. Throws nothing for a poor page: the warnings say what to look at.
 */
export function extractPage(html, url, { region: hint = null, title: given = null, updatedRegion = null } = {}) {
  const dom = parseDocument(html), picked = region(dom, hint), fallback = picked.how === 'body', regionChars = squeeze(text(picked.node)).length;
  const dropped = node => isDropped(node, fallback, regionChars);
  const documents = new Map(), removed = { contactCards: 0, personalEmails: 0, phonesBesideThem: 0 }, kept = { generalEmails: 0, otherEmails: 0, personLinks: 0 };
  const base = new URL(url);
  // Whether the page is being put together as the collector before ADR-132 put it (see `former` below): then nothing is counted.
  let asBefore = false;
  function inline(node) {
    if (node.type === 'text') return escape(node.data.replace(LINK_EDGES, '').replace(/\s+/gu, ' '));
    const tag = name(node);
    if (!tag || dropped(node)) return '';
    if (tag === 'br') return '\n';
    if (node.attribs?.['data-cfemail'] !== undefined || /\/cdn-cgi\/l\/email-protection/u.test(node.attribs?.href || '')) {
      const shown = shownEmail(node.attribs?.['data-cfemail'] ?? flat(node).find(child => child.attribs?.['data-cfemail'] !== undefined)?.attribs['data-cfemail'] ?? (node.attribs?.href || '').split('#')[1]);
      return shown ? escape(shown) : HIDDEN_EMAIL;
    }
    const inner = kids(node).map(inline).join('');
    if (tag === 'a') {
      let target = null;
      try { target = new URL(node.attribs?.href || '', base); } catch { target = null; }
      const label = squeeze(text(node));
      if (!label) return '';
      // ADR-132 (10.10.2026): a link whose target is a bare address (<a href="info@amet.example">) resolved against the page into a web address ending in the e-mail address,
      // and that stayed in the stored copy when the visible address was removed (45 such targets on the courts' contact page). A web target is read for the addresses it holds, as
      // a mailto target is: before the host (href="http://first.last@amet.example", the scheme written where "mailto:" belongs), as a part of the path, in the query, with the @ or
      // a dot written as %40 or %2E. Two kinds of target are no page and are never stored: one whose last part is nothing but an address, and one with a name before the host.
      const web = ['http:', 'https:'].includes(target?.protocol), path = web ? target.pathname + target.search : '', file = DOCUMENT.test(path);
      // A document is asked first (review of 10.10.2026): "/failid/info@amet.example.pdf" is a form with an address for a file name, not a bare address, and a form is given by its
      // link. Its address is read without the file's ending, so that the ending is not taken for the last label of a domain.
      const bare = web && !file && TARGET_ADDRESS.test(decoded(target.pathname.replace(/\/+$/u, '').split('/').pop())), user = web ? decoded(target.username || target.password) : '';
      // A target of any other kind (another scheme written where "mailto:" belongs: "sip:", "mail:", "ftp://" with a name before the host; or one that cannot be parsed at all) is
      // never stored, but it writes to or calls someone as a mailto link does, so it is read whole for the addresses in it (second check of 10.10.2026: fail closed, a person looks).
      const to = (target?.protocol === 'mailto:' ? [decoded(target.pathname), ...decoded(target.pathname).split(/[\s,;]+/u), ...(decoded(target.search).match(TARGET_EMAIL) || [])]
        : [user && `${user}@${target.hostname}`, ...(decoded(web ? path : target?.href ?? node.attribs?.href ?? '').match(TARGET_EMAIL) || []).map(address => (file && TARGET_ADDRESS.test(address.replace(DOCUMENT_END, '')) ? address.replace(DOCUMENT_END, '') : address))]).filter(Boolean);
      // A link to an institution's channel or a unit's mailbox is no person's link, unless it is a mailbox and the link's words name someone: then a person looks, as before ADR-132.
      // Any other address in a target makes the link a person's and holds the page, and the target is not stored, a document's neither: where the form's link and a person's
      // address pull apart, the address goes (the link's words stay, and the held page says person_named_by_link).
      const person = to.some(address => emailKind(address) !== 'general' || !plainChannel(address) && PERSON.test(label));
      if (person && !asBefore) kept.personLinks++;
      // The words of a link without its tag stand between two marks until the block is whole (settle). Before ADR-132 the words of a link that writes or calls ran on in the text, and
      // every web link kept its tag: a tag stands here for the one that stood there.
      if (!web || bare || user || person) return asBefore ? (web ? `<a>${inner}</a>` : inner) : squeeze(inner.replace(/<[^>]+>/gu, '')) ? `${LINK_EDGE}${inner}${LINK_EDGE}` : inner;
      target.hash = '';
      if (file) documents.set(target.href, { url: target.href, text: label.slice(0, 200), type: (target.pathname.match(/\.([a-z0-9]{2,5})$/iu)?.[1] || 'download').toLowerCase() });
      return `<a href="${quote(target.href)}">${inner}</a>`;
    }
    return INLINE.has(tag) && squeeze(inner.replace(/<[^>]+>/gu, '')) ? `<${tag}>${inner}</${tag}>` : inner;
  }
  // Blocks of a container: kept block elements as they are, loose text and inline runs as paragraphs.
  function blocks(node) {
    const out = [];
    let run = '';
    const flush = () => { const value = settle(run).replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim(); if (squeeze(value.replace(/<[^>]+>/gu, ''))) out.push(`<p>${value}</p>`); run = ''; };
    for (const child of kids(node)) {
      const tag = name(child);
      if (child.type === 'text') { run += inline(child); continue; }
      if (!tag || dropped(child)) continue;
      if (tag === 'button' || tag === 'summary') { flush(); const label = squeeze(text(child).replace(LINK_EDGES, '')); if (label) out.push(`<h4>${escape(label)}</h4>`); continue; }
      if (KEPT.has(tag)) { flush(); const made = block(child); if (made) out.push(made); continue; }
      if (RUNS_ON.has(tag)) { run += inline(child); continue; }
      flush(); out.push(...blocks(child));
    }
    flush();
    return out;
  }
  function block(node) {
    const tag = name(node);
    if (/^h[1-6]$/u.test(tag) || tag === 'p' || tag === 'pre' || tag === 'dt') {
      const inner = settle(kids(node).map(inline).join('')).replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim();
      return squeeze(inner.replace(/<[^>]+>/gu, '')) ? `<${tag}>${inner}</${tag}>` : '';
    }
    if (['li', 'td', 'th', 'dd', 'blockquote'].includes(tag)) {
      // A cell or an item with blocks of its own keeps them; one with only text keeps the text.
      const nested = kids(node).some(child => KEPT.has(name(child)) || ['div', 'section'].includes(name(child)));
      const inner = nested ? blocks(node).join('') : settle(kids(node).map(inline).join('')).replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim();
      return squeeze(inner.replace(/<[^>]+>/gu, '')) || tag === 'td' || tag === 'th' ? `<${tag}>${inner}</${tag}>` : '';
    }
    const inner = kids(node).filter(child => KEPT.has(name(child)) && !dropped(child)).map(block).filter(Boolean).join('');
    return inner ? `<${tag}>${inner}</${tag}>` : '';
  }
  let body = blocks(picked.node);
  // ADR-132: the same blocks as the collector before put them together, block for block (a link's words are the same in both, so a block has text in both or in neither): the
  // measure for a card on several lines, below.
  asBefore = true;
  const former = blocks(picked.node);
  asBefore = false;
  // Only the text between the tags is read: a link's address is not the page's wording.
  const inText = (item, change) => item.split(/(<[^>]+>)/u).map(part => (part.startsWith('<') ? part : change(part))).join('');
  // The space `settle` put between a dropped link's words and the text is kept as it is (LINK_SPACE): a reader's \s sees it, the count of words does not.
  const plain = item => item.replace(/<[^>]+>/gu, ' ').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&').replace(/[^\S\u00A0]+/gu, ' ').trim();
  // A person's contact is taken out unit by unit (a paragraph, a list item, a table row):
  // - a contact card, a short unit that names a person beside a phone number or an e-mail address, goes whole;
  // - elsewhere a person's e-mail address is removed together with the phone numbers in its unit.
  // An address the site hides behind its e-mail protection cannot be read, so it counts as a person's.
  // ADR-132 (10.10.2026): a block is read by a rule for telling addresses apart (kindOf) and counted or not (tally 1 or 0), because it is read twice: see `both` below.
  // An address is told apart in its place (kindAt), fail closed both ways:
  // - read from the middle of a longer one, by the rule before ADR-132, as it was: EMAIL reads plain Latin letters, so "jüri.osakond@" is read from "ri", its given name is not seen,
  //   and the unit's word would keep it. The wider reading is for an address read whole;
  // - where it stood directly against the text before it, until `settle` put a space there, by both readings, and the stricter holds: apart, as it is written, and as one word with
  //   what stood before it, as every reading before 10.10.2026 took it. Such an address is no plain channel to the card either. So the space takes a person's address out of the
  //   word it ran into and lets nothing go that was removed, drawn as a card or held without it;
  // - and where that one word is itself read from the middle of a longer one (a link on "ri.osakond@…" directly after "jü", a linked mailbox after "tänaval"), the one word is told
  //   apart by the rule before ADR-132, as every cut reading is (second check of 10.10.2026: with the space between them only the reading apart was asked, and the end of
  //   "jüri.osakond@" stayed in the page with the number beside it);
  // - and an address that is a person's as that one word goes as that one word, the word it ran into with it (`whole`): a link that begins in the middle of an address ("mari.maa"
  //   before a linked "sikas@amet.example", "jaan-" before "erik.tamm@…") left the first half of the address in the text beside the mark. So what every reading before 10.10.2026
  //   took for one person's address is still removed whole, whatever the link writes to. Not where the word it ran into is the end of another address ("info@amet.example"
  //   directly before a linked one): that one is read and counted by itself, and taking its end would cut it in two.
  const STRICTER = ['personal', 'other', 'general'];
  const ranInto = (at, around) => (around[at - 1] === LINK_SPACE ? around.slice(0, at - 1).match(/[A-Za-z0-9._%+-]+$/u)?.[0] ?? '' : '');
  const readAt = (kindOf, address, at, around) => {
    const spaced = around[at - 1] === LINK_SPACE, before = ranInto(at, around), start = at - before.length - Number(spaced);
    const asOneWord = start > 0 && /[\p{L}\p{M}]/u.test(around[start - 1]) ? formerKind(before + address) : kindOf(before + address);
    return [spaced ? STRICTER[Math.min(STRICTER.indexOf(kindOf(address)), STRICTER.indexOf(asOneWord))] : asOneWord, Boolean(before) && asOneWord === 'personal' && around[start - 1] !== '@'];
  };
  const kindAt = (...place) => readAt(...place)[0];
  const channelAt = (address, at, around) => plainChannel(address) && !ranInto(at, around);
  // The addresses the counted reading of a block kept, as the card loop needs them should the block go with a card: how each was counted, whether the rule before ADR-132 would
  // have marked it, whether it is a unit's mailbox. Written down where the address is read: read again from the block afterwards, an address stands beside the mark of a removed
  // number, not beside the number, and may be told apart differently than it was counted (second check of 10.10.2026: a count went below zero).
  let keptHere = [];
  const scrub = (unit, kindOf, tally) => {
    const said = plain(unit), mails = [...said.matchAll(EMAIL)].map(match => [kindAt(kindOf, match[0], match.index, said), channelAt(match[0], match.index, said)]), hidden = said.includes(HIDDEN_EMAIL), named = PERSON.test(said);
    const personal = hidden || mails.some(([kind]) => kind === 'personal');
    // What makes a card is as it was before ADR-132: a name beside a number, or beside any address that is more than channel words (a unit's mailbox too).
    if (named && (PHONE.test(said) || hidden || mails.some(([, channel]) => !channel)) && said.split(' ').length <= 40) { removed.contactCards += tally; return ''; }
    let next = inText(unit, part => part.replace(EMAIL, (address, at, around) => {
      const [kind, whole] = readAt(kindOf, address, at, around);
      // A person's address as one word with what it ran into: the mark of a dropped tag (free again once `settle` is done) says that the word before the space goes with it.
      if (kind === 'personal') { removed.personalEmails += tally; return `${whole ? LINK_EDGE : ''}[e-post eemaldatud]`; }
      // A unit's mailbox in a paragraph that has a name-like pair is one a person looks at, as it was before ADR-132.
      const mailbox = kind === 'general' && !channelAt(address, at, around), counted = kind === 'general' && !(mailbox && named) ? 'generalEmails' : 'otherEmails';
      kept[counted] += tally;
      if (tally) keptHere.push([counted, kindAt(formerKind, address, at, around) === 'personal', mailbox]);
      return address;
    }).replace(RAN_INTO, ''));
    if (hidden) { removed.personalEmails += tally * (said.split(HIDDEN_EMAIL).length - 1); next = next.split(HIDDEN_EMAIL).join('[e-post eemaldatud]'); }
    // A number goes only beside a person's address: a kept mailbox takes no number with it (the court houses' information lines went with their mailboxes, ADR-112).
    return personal ? inText(next, part => part.replace(new RegExp(PHONE.source, 'gu'), () => { removed.phonesBesideThem += tally; return '[telefon eemaldatud]'; })) : next;
  };
  // A table row is one unit also when a cell of it holds a block. UNIT stops at a nested block, so such a row was never
  // read as a row, and its plain cells were read by nothing: on 08.10.2026 a page's contact table (a name as a link, a
  // post, a team, a phone number in a paragraph, an address) went into the collected copy whole. A row that names a
  // person beside a channel goes like any card; in any other such row the plain cells are read cell by cell.
  const rowCard = row => {
    const said = plain(row);
    return PERSON.test(said) && (PHONE.test(said) || said.includes(HIDDEN_EMAIL) || [...said.matchAll(EMAIL)].some(match => !channelAt(match[0], match.index, said))) && said.split(' ').length <= 40;
  };
  const rows = (item, kindOf, tally) => item.replace(ROW, row => {
    if (rowCard(row)) { removed.contactCards += tally; return ''; }
    return NESTED_BLOCK.test(row) ? row.replace(CELL, cell => scrub(cell, kindOf, tally)) : row;
  });
  const read = (item, kindOf, tally) => (UNIT_TEST.test(item) ? rows(item, kindOf, tally).replace(UNIT, unit => scrub(unit, kindOf, tally)) : scrub(item, kindOf, tally))
    // What a removed unit leaves empty goes too.
    .replace(/<(ul|ol|tbody|thead|tfoot|dl)><\/\1>/gu, '').replace(/<table><\/table>/gu, '');
  // ADR-132: every block is read twice. `body` is what is stored: its addresses told apart by emailKind, and counted. `drawn` is the same block as the rule before ADR-132 marks it
  // (nothing counted): the card loop below asks its questions of that text, so a card on several lines is exactly what it was. Asked of the stored text, a line that keeps its numbers
  // is longer than its marks were, and a name with two numbers and a unit's mailbox under it would stay in the page. A unit goes whole in both readings or in neither (what makes a
  // card does not ask kindOf), so the two lists stay block for block beside each other. `formerly` is a third reading, of the block as the collector before put it together
  // (`former`), marked by the rule before: what the card loop saw before ADR-132, to the letter.
  const both = body.map((item, index) => { keptHere = []; return [read(item, emailKind, 1), read(item, formerKind, 0), read(former[index], formerKind, 0), keptHere]; }).filter(([stored]) => plain(stored));
  body = both.map(([stored]) => stored);
  const drawn = both.map(([, marked]) => marked), formerly = both.map(([, , marked]) => marked), keptIn = both.map(([, , , addresses]) => addresses);
  // A contact card may stand on several lines, each a block of its own: a name, a post, a phone number, an address.
  // Short blocks in a row that name a person and give a phone number or an address (kept, removed or hidden) are one
  // card and go together.
  // The card's first line names the person; its other lines are a post, a number, an address: a few words each. A
  // longer line after a card is the page's own sentence (a general help line), not the card's.
  const short = (item, words = 12) => !/^<(?:h[1-6]|table|ul|ol|dl)>/u.test(item) && plain(item).split(' ').length <= words;
  // A line of a card: a few words that name no one else, or a list of such lines (a number and an address as items).
  const few = value => plain(value).split(' ').length <= 6 && !PERSON.test(plain(value));
  const cardLine = item => (/^<(?:ul|ol)>/u.test(item) ? [...item.matchAll(/<li>([\s\S]*?)<\/li>/gu)].every(match => few(match[1])) : short(item, 6) && few(item));
  const reaches = item => PHONE.test(plain(item)) || /\[e-post eemaldatud\]|\[telefon eemaldatud\]/u.test(item) || EMAIL_TEST.test(plain(item));
  // The card's first line names the person: a short line, or a heading that is nothing but a name.
  const nameLine = item => (short(item) ? PERSON.test(plain(item)) : /^<h[2-6]>/u.test(item) && BARE_NAME.test(plain(item)));
  // ADR-132 (second check of 10.10.2026): each question of the loop is asked of both marked readings of a block, and a yes of either holds. `formerly` is the block exactly as the
  // collector before read it, so every card it drew on several lines is still drawn: asked of `drawn` alone, a line where a link's words now stand apart from the number before them
  // is longer by its marks ("6123456.first.last@…" was one word, two marks are three), and a name with such a line under it stayed in the page with the number and the address.
  // `drawn` adds the cards that only the words standing apart show (a linked number directly after a word is a number now).
  const either = (test, index) => test(drawn[index]) || test(formerly[index]);
  for (let index = 0; index < body.length; index++) {
    if (!either(nameLine, index)) continue;
    let end = index;
    while (end + 1 < body.length && end - index < 4 && either(cardLine, end + 1)) end++;
    const lines = Array.from({ length: end - index + 1 }, (line, at) => either(reaches, index + at));
    if (!lines.includes(true)) continue;
    // The card ends with its last line that gives a channel; a short line after it belongs to the text.
    const last = lines.lastIndexOf(true);
    // What was already removed inside the card is the card's: it is counted once, as a card.
    const gone = body.splice(index, last + 1).join('');
    for (const list of [drawn, formerly]) list.splice(index, last + 1);
    removed.personalEmails -= gone.split('[e-post eemaldatud]').length - 1; removed.phonesBesideThem -= gone.split('[telefon eemaldatud]').length - 1;
    // ADR-132: an address the rule before would have marked, and that this reading kept and counted, went with the card: it is not one the page keeps. Any other address in a card
    // stays counted, as before: a card with an address the rule cannot place ("mari@") still holds the page for a person.
    // A unit's mailbox on a line of such a card stands beside a name, as in a paragraph (scrub): it counts as an address to look at, and the page stays held as it was before ADR-132
    // (review of 10.10.2026). The card is drawn by a guess (at most four lines after the name, up to the last one that gives a channel), and holding is the safer reading of the two.
    for (const [counted, marked, mailbox] of keptIn.splice(index, last + 1).flat()) {
      if (marked) kept[counted]--;
      else if (mailbox && counted === 'generalEmails') { kept.generalEmails--; kept.otherEmails++; }
    }
    removed.contactCards++; index--;
  }
  // The page is read; what is written has plain spaces.
  body = body.map(item => item.replace(LINK_SPACES, ' '));
  // The site's own lines inside the content region: the row of tag links, the feedback line; and the page's update
  // date, which is the page's metadata, not its wording.
  let updated = null;
  body = body.filter(item => {
    const said = plain(item), date = said.match(/^Viimati (?:uuendatud|muudetud):?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/iu);
    if (date) { updated = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`; return false; }
    if (BOILERPLATE.test(said)) return false;
    const targets = [...item.matchAll(/<a href="([^"]+)">/gu)].map(match => match[1]);
    return !(targets.length && targets.every(target => /[?&](?:filters|keyword|keys|tag|s|q)(?:%5B|\[|=)|\/(?:otsing|search|tags?|marksona)(?:[/?]|$)/iu.test(target)) && !squeeze(item.replace(/<a [^>]*>[^<]*<\/a>/gu, '').replace(/<[^>]+>/gu, '')));
  });
  // A page whose date stands outside its content region (beside the article, under a label of its own) gives it where the list entry says.
  if (updatedRegion) updated = statedDay(dom, updatedRegion) ?? updated;
  const heading = body.find(item => item.startsWith('<h1>'));
  const title = squeeze(heading ? plain(heading) : given || text(flat(dom).find(node => name(node) === 'title') || { children: [] }).split(/\s[|–—-]\s/u)[0] || '');
  // The title once: a site often repeats it beside the heading.
  body = body.filter(item => item === heading || !(item.startsWith('<p>') && plain(item) === title));
  // The site's name, which its pages carry after the title ("Page | Site"), is the site's line, not the page's.
  const parts = squeeze(text(flat(dom).find(node => name(node) === 'title') || { children: [] })).split(/\s[|–—]\s/u), siteName = parts.length > 1 ? parts.at(-1) : null;
  if (siteName && siteName !== title) body = body.filter(item => !(item.startsWith('<p>') && plain(item) === siteName));
  if (!heading && title) body.unshift(`<h1>${escape(title)}</h1>`);
  // A heading with nothing under it (its contact cards were removed) says nothing.
  const level = item => Number(item.match(/^<h([1-6])>/u)?.[1] || 0);
  for (let changed = true; changed;) {
    changed = false;
    body = body.filter((item, index) => { const drop = level(item) > 1 && (index === body.length - 1 || (level(body[index + 1]) && level(body[index + 1]) <= level(item))); changed ||= drop; return !drop; });
  }
  const content = body.map(plain).filter(Boolean), words = content.join(' ').split(' ').filter(Boolean).length;
  const warnings = [];
  if (fallback) warnings.push('content_region_not_marked');
  if (words < 80) warnings.push('thin_content');
  // Almost no text and no content region, on a page made of scripts: its text is written after loading.
  if (fallback && words < 20 && flat(dom).filter(node => name(node) === 'script').length >= 3) warnings.push('rendered_by_script');
  if (!title) warnings.push('no_title');
  if (removed.contactCards) warnings.push('contact_card_removed');
  if (removed.personalEmails) warnings.push('personal_contact_removed');
  if (kept.otherEmails) warnings.push('email_needs_review');
  if (kept.personLinks) warnings.push('person_named_by_link');
  const language = (flat(dom).find(node => name(node) === 'html')?.attribs?.lang || '').slice(0, 2).toLowerCase() || null;
  const stored = `<!doctype html><html lang="${quote(language || 'et')}"><meta charset="utf-8"><title>${escape(title)}</title><body><article>\n${body.join('\n')}\n</article></body></html>\n`;
  // The links counted are the ones the stored page still has.
  const remaining = [...new Set([...stored.matchAll(/<a href="([^"]+)">/gu)].map(match => match[1].replace(/&amp;/gu, '&')))];
  return { html: stored, title, language, updated, contentSha256: sha(content.join('\n')), region: picked.how, warnings,
    stats: { words, blocks: body.length, headings: body.filter(item => /^<h[1-6]>/u.test(item)).length, tables: body.filter(item => item.startsWith('<table>')).length,
      links: remaining.length, linksToOtherSites: remaining.filter(link => new URL(link).host !== base.host).length },
    documents: [...documents.values()].filter(item => stored.includes(quote(item.url))), contacts: { ...kept, ...removed },
    // Review is needed where a person may still be named in the text (an address was removed from a sentence, a link
    // wrote to a person, an address could not be told apart), or where the page gave no content region or little text.
    // A contact card that went whole leaves no name behind.
    needsReview: removed.personalEmails > 0 || kept.otherEmails > 0 || kept.personLinks > 0 || fallback || words < 80 };
}

// The address a site's e-mail protection hides (a key byte, then the address's bytes each combined with the key):
// what the site's own script shows every visitor. null when it is not such a value.
function shownEmail(hex) {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2}){6,}$/iu.test(hex)) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let address = '';
  for (let at = 2; at < hex.length; at += 2) address += String.fromCharCode(parseInt(hex.slice(at, at + 2), 16) ^ key);
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(address) ? address : null;
}

// An address of an institution's channel (info@, klienditugi@) is kept; a first.last@ address is a person's.
const GENERAL = new Set(['info', 'abi', 'klienditugi', 'kliendiinfo', 'abivahendid', 'press', 'pressiteated', 'meedia', 'kantselei', 'sekretar', 'post', 'kontakt', 'teenindus', 'noustamine',
  'jarelevalve', 'andmekaitse', 'ohvriabi', 'lasteabi', 'epost', 'mail', 'office', 'yldinfo', 'uldinfo', 'registratuur', 'vastuvott', 'tugi', 'help', 'support', 'kaebus', 'kaebused', 'avaldus',
  'dokumendid', 'arved', 'personal', 'varbamine', 'koolitus', 'tagasiside', 'ligipaasetavus', 'sotsiaal', 'tervis', 'haldus', 'it', 'webmaster', 'veeb', 'toetused', 'teenused', 'ska', 'aki', 'ta', 'sm']);
// ADR-132 (10.10.2026): a unit's mailbox is not a person's address. Two plain words before the @ were read as a first and a family name, so a court house's "<house>.menetlus@" went, and
// with it the information line of every court house (ADR-112). The rule fails closed: an address it cannot place is a person's (removed) or is kept for a person to look at; it is a
// mailbox only where every word before the @ is accounted for. Nothing is removed that was kept before.
// OFFICE: words for a unit or a function of an institution that are no one's given or family name ("kontor" is a family name and is not here). The repository holds no family names to
// test that against, so whoever adds a word checks it by hand against the public name statistics: beside a word the rule does not know, such a word keeps the address in the page.
const OFFICE = new Set(['osakond', 'sotsiaalosakond', 'talitus', 'teenistus', 'linnavalitsus', 'vallavalitsus', 'valitsus', 'volikogu', 'linnakantselei', 'vallakantselei', 'sekretariaat', 'juhatus',
  'menetlus', 'lastekaitse', 'hoolekanne', 'sotsiaalhoolekanne', 'sotsiaaltoo', 'sotsiaalabi', 'eestkoste', 'tervishoid', 'haridus', 'kultuur', 'majandus', 'rahandus', 'raamatupidamine', 'arhiiv', 'register', 'infopunkt',
  'infotelefon', 'infolaud', 'teabenoue', 'paringud', 'amet', 'keskus', 'haigla', 'kliinik', 'apteek', 'lasteaed', 'raamatukogu', 'maakond', 'buroo', 'esindus', 'keskasutus', 'authority', 'central', 'contact',
  'reception', 'admin']);
// Words for a kind of institution that are also family names. Weak: they count only where every word of the address is accounted for, and never keep a first.last@ address from being a
// person's ("mari.kool@", "vald.kool@").
const OFFICE_OR_NAME = new Set(['vald', 'kool', 'koda', 'liit', 'selts', 'yhing', 'uhing', 'kodu', 'pood', 'kohus']);
// Two words for a kind of institution are given names too, and are read as given names only (review of 10.10.2026): as kind words they made a mailbox of "linn.osakond@" and
// "maja.keskus@", addresses that were removed before and came back with the number beside them and nobody looking. They account for no word of an address and shield none, in either
// order and also after the domain's own name: a town's "naidis.linn@naidis.example" is removed as it was before ADR-132, because "tamm.maja@tamm.example" cannot be told from it.
const GIVEN_TOO = new Set(['linn', 'maja']);
// Channel words that are also a family name: beside another word they prove nothing.
const NAME_TOO = new Set(['post', 'press']);
export const MAILBOX_WORDS = Object.freeze({ channel: GENERAL, office: OFFICE, officeOrName: OFFICE_OR_NAME, channelOrName: NAME_TOO, givenToo: GIVEN_TOO });
// The listed given names as an address writes them. EMAIL reads plain Latin letters only, so a letter with a mark is written plain ("juri") or by a spelling that stands in for it:
// "y" for ü ("jyri", as the channel words have "yldinfo" beside "uldinfo"), or two letters ("jueri", "maert", "nadezhda"). Every such form is a given name to the rule.
const SPELLED = Object.entries({ ä: ['ae'], ö: ['oe'], õ: ['oe'], ü: ['y', 'ue'], š: ['sh'], ž: ['zh'] });
const plainLetters = value => value.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '');
const written = value => SPELLED.reduce((forms, [letter, ways]) => forms.flatMap(form => (form.includes(letter) ? [form, ...ways.map(way => form.replaceAll(letter, way))] : [form])), [value.toLowerCase().normalize('NFC')]).map(plainLetters);
const GIVEN = new Set([...GIVEN_NAMES, ...GIVEN_TOO].flatMap(written));
const localParts = address => address.split('@')[0].toLowerCase().split(/[._-]/u).filter(Boolean);
const nameShaped = parts => parts.length >= 2 && parts.every(part => /^[a-zõäöüšž]{2,}\d*$/u.test(part));
// The rule before ADR-132, kept as it was: the contact card is drawn by it (plainChannel is its 'general').
const plainChannel = address => localParts(address).every(part => GENERAL.has(part));
const formerKind = address => (plainChannel(address) ? 'general' : nameShaped(localParts(address)) && !localParts(address).some(part => GENERAL.has(part)) ? 'personal' : 'other');
/** 'general': an institution's channel or a unit's mailbox, kept. 'personal': a person's, removed with the numbers beside it. 'other': the rule cannot place it; kept, and a person looks at the page. */
export function emailKind(address) {
  const parts = localParts(address);
  // Nothing but channel words: the rule before ADR-132, as it was.
  if (plainChannel(address)) return 'general';
  // A word that makes a mailbox of an address beside other words: a channel's or a unit's word that cannot be a given name ("arved"), a family name ("post") or initials ("it", "ta", "sm").
  const anchor = part => (GENERAL.has(part) || OFFICE.has(part)) && part.length >= 4 && !GIVEN.has(part) && !NAME_TOO.has(part);
  // The address's own domain without its last label ("naidislinn" of info.naidislinn@naidislinn.example); a domain that is a given name proves nothing, and a label of two letters
  // reads as initials ("ab.osakond@ab.example" is kept for a person to look at).
  const own = new Set((address.split('@')[1] || '').toLowerCase().split('.').slice(0, -1).filter(label => label.length >= 3 && !GIVEN.has(label)));
  if (parts.every(part => anchor(part) || OFFICE_OR_NAME.has(part) || own.has(part))) {
    if (parts.some(anchor)) return 'general';
    // A kind of institution after the domain's own name ("naidis.vald@naidis.example"): kept, and a person looks. The kind stands last, as in an institution's name, and the words before
    // it are the domain's and no kind themselves: "vald.naidis@naidis.example", "vald.kool@kool.example" and two such words on another domain are a first and a family name, as before.
    // What this cannot tell from a municipality's address: a given name that is not listed, at a domain of that name, with a kind word for a family name.
    if (OFFICE_OR_NAME.has(parts.at(-1)) && parts.slice(0, -1).every(part => own.has(part) && !OFFICE_OR_NAME.has(part))) return 'other';
  }
  // A first and a family name, as before. A unit's word keeps the address (for a person to look at) only where no given name stands beside it, in any of its written forms and also
  // with a number after it: "mari.osakond@", "mari2.osakond@", "jyri.osakond@" and "linn.osakond@" are a person's. A mailto target may hold the letter with its mark; it is read plain.
  const given = parts.some(part => GIVEN.has(plainLetters(part.replace(/\d+$/u, ''))));
  return nameShaped(parts) && !parts.some(part => GENERAL.has(part)) && (given || !parts.some(part => OFFICE.has(part))) ? 'personal' : 'other';
}

/** Whether a site's robots.txt lets this collector read a path: the group for the collector's own name, else for all;
 *  the longest matching rule decides, and without a rule the path is allowed. */
export function robotsAllows(robots, pathname, agent = 'sotsiaalai') {
  const groups = [];
  let current = null, lastWasAgent = false;
  for (const raw of String(robots || '').split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim(), at = line.indexOf(':');
    if (at < 0) continue;
    const field = line.slice(0, at).trim().toLowerCase(), value = line.slice(at + 1).trim();
    if (field === 'user-agent') { if (!lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); } current.agents.push(value.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (current && (field === 'allow' || field === 'disallow') && value) current.rules.push({ allow: field === 'allow', path: value });
  }
  const group = groups.find(item => item.agents.some(value => value !== '*' && agent.includes(value))) || groups.find(item => item.agents.includes('*'));
  if (!group) return true;
  const pattern = rule => new RegExp(`^${rule.path.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '.*').replace(/\\\$$/u, '$')}`, 'u');
  const hit = group.rules.filter(rule => pattern(rule).test(pathname)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))[0];
  return hit ? hit.allow : true;
}

/** The pause a site's robots.txt asks between two requests (Crawl-delay), in seconds: of the group for the collector's
 *  own name, else of the group for all; null when the group names none. The police's site asks for ten seconds. */
export function robotsCrawlDelay(robots, agent = 'sotsiaalai') {
  const groups = [];
  let current = null, lastWasAgent = false;
  for (const raw of String(robots || '').split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim(), at = line.indexOf(':');
    if (at < 0) continue;
    const field = line.slice(0, at).trim().toLowerCase(), value = line.slice(at + 1).trim();
    if (field === 'user-agent') { if (!lastWasAgent) { current = { agents: [], delay: null }; groups.push(current); } current.agents.push(value.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (current && field === 'crawl-delay' && /^\d+(?:\.\d+)?$/u.test(value)) current.delay = Number(value);
  }
  const group = groups.find(item => item.agents.some(value => value !== '*' && agent.includes(value))) || groups.find(item => item.agents.includes('*'));
  return group?.delay ?? null;
}

/** The metadata file of a collected page, in the keys the corpus metadata adapter reads (metadata-adapter.js). */
/** A company's or an organisation's own page (source types "vendor_page" and "organization_page") is titled with
 *  its name: a page called "Laenutus" or "Kontakt" says nothing in a list of sources, and an answer must show whose
 *  words it cites. */
export const VENDOR_PAGE = 'vendor_page', ORGANIZATION_PAGE = 'organization_page';
export const TITLED_BY_PUBLISHER = Object.freeze([VENDOR_PAGE, ORGANIZATION_PAGE]);
export function pageTitle(entry, page) {
  const title = page.title || entry.title;
  return TITLED_BY_PUBLISHER.includes(entry.source_type) && entry.publisher && !title.toLowerCase().includes(entry.publisher.toLowerCase()) ? `${entry.publisher}: ${title}` : title;
}
export function pageMetadata({ entry, page, fetched, sourcePath, checkedAt = new Date() }) {
  return { document_id: `web-${entry.source_id}`, title: pageTitle(entry, page), register_title: entry.title, source_id: entry.source_id,
    source_type: entry.source_type || 'web_page', publisher: entry.publisher, language: page.language || entry.language || 'et',
    url: entry.url, ...(fetched.finalUrl !== entry.url ? { url_final: fetched.finalUrl } : {}),
    source_path: sourcePath, source_format: 'html', source_sha256: sha(page.html), content_sha256: page.contentSha256,
    checked_at: checkedAt.toISOString().slice(0, 10), retrieved_at: checkedAt.toISOString(), source_status: 'active', country: 'EE', ...(page.updated ? { page_updated: page.updated } : {}),
    ...(entry.jurisdiction_level ? { jurisdiction_level: entry.jurisdiction_level } : {}), ...(entry.topic_tags?.length ? { tags: entry.topic_tags } : {}),
    // A page is guidance and background: what a person is entitled to, amounts and deadlines come from the acts.
    legal_basis: false, disallowed_claim_types: ['legal_entitlement', 'benefit_amount', 'municipal_service_availability', 'application_deadline', 'medical_diagnosis_or_treatment'],
    collection: { collector: WEB_PAGE_COLLECTOR, region: page.region, http: { status: fetched.status, content_type: fetched.contentType, last_modified: fetched.lastModified ?? null, etag: fetched.etag ?? null },
      raw_sha256: fetched.rawSha256, stats: page.stats, contacts: page.contacts, warnings: page.warnings, needs_review: page.needsReview },
    // Forms and guides the page links to: given by link, read as sources of their own only when chosen.
    documents: page.documents.map(item => ({ ...item, status: 'referenced_only' })) };
}

/**
 * What to do with a page just read, given the stored copy and an earlier proposal (both metadata, or null):
 *   new        no stored copy: the page is written
 *   unchanged  the content is the stored one
 *   proposed   the content differs from the stored one: kept as a proposal, the stored copy stays
 *   confirmed  the content differs and equals the earlier proposal: a second equal read; it may replace the stored copy
 */
export function decidePage(page, stored, proposal) {
  if (!stored) return 'new';
  if (stored.content_sha256 === page.contentSha256) return 'unchanged';
  return proposal?.content_sha256 === page.contentSha256 ? 'confirmed' : 'proposed';
}

/**
 * What a run does with a page it has read, by the rule for collected data (a change is a proposal first, the stored
 * copy is replaced on the second equal reading, a page marked for review waits for a person, nothing is deleted):
 *   keepRunCopy   the reading is kept among the run's pages (every page that is not the stored one)
 *   propose       the reading becomes the proposal a later run is compared with
 *   place         the reading becomes the stored copy: only with `apply`, only a new or a confirmed page, and a page
 *                 that needs review only when a person has approved it by name
 *   keepPrevious  the stored copy that is replaced is kept aside first
 *   dropProposal  the proposal is no longer needed: the page reads as stored again, or the reading was placed
 * No decision removes a stored copy.
 */
export function pageActions(decision, { apply = false, needsReview = false, approved = false } = {}) {
  const place = Boolean(apply) && (!needsReview || approved) && (decision === 'new' || decision === 'confirmed');
  return { keepRunCopy: decision !== 'unchanged', propose: decision === 'proposed', place, keepPrevious: place && decision === 'confirmed',
    dropProposal: decision === 'unchanged' || place };
}

const site = host => host.toLowerCase().replace(/^www\./u, '');
/**
 * The sub-pages a page leads to (owner 06.10.2026: "lisaks on lehtedel veel alalehed"): every link on the fetched page,
 * its section menu too (the stored content leaves menus out, but that is where a site lists a page's sub-pages), to
 * the same site and below the path of `within` (the page the collection started from; by default this page).
 * A link with a query is a view of a page, not a page; documents and media are not pages.
 */
export function subpageLinks(html, url, { within = null } = {}) {
  const base = new URL(url), root = new URL(within || url), prefix = `${root.pathname.replace(/\/+$/u, '')}/`, found = new Map();
  for (const node of flat(parseDocument(html))) {
    if (name(node) !== 'a' || !node.attribs?.href) continue;
    let target;
    try { target = new URL(node.attribs.href, base); } catch { continue; }
    if (target.protocol !== 'https:' || site(target.host) !== site(root.host) || target.search) continue;
    const pathname = target.pathname.replace(/\/+$/u, '');
    if (!`${pathname}/`.startsWith(prefix) || `${pathname}/` === prefix) continue;
    if (DOCUMENT.test(pathname) || /\.(?:jpe?g|png|gif|svg|webp|zip|ics|xml|json|css|js|mp[34])$/iu.test(pathname)) continue;
    const address = `${target.origin}${pathname}`;
    if (!found.has(address)) found.set(address, { url: address, text: squeeze(text(node)).slice(0, 200) });
  }
  return [...found.values()];
}
