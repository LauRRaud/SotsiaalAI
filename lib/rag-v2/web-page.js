import { createHash } from 'node:crypto';
import { parseDocument } from 'htmlparser2';

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
//   general channels (info@, a help line) stay: they are what the page tells the reader to use.
// - A changed page never replaces the stored one by itself: the change is a proposal until a second read gives the same
//   content (decidePage), or the owner applies it.
export const WEB_PAGE_COLLECTOR = 'rag-v2/web-page-1';
const sha = value => createHash('sha256').update(value).digest('hex');
const escape = value => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const quote = value => escape(value).replace(/"/gu, '&quot;');

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
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, HIDDEN_EMAIL = '[peidetud e-post]';
const EMAIL_TEST = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u;
const PHONE = /(?:\+372[\s-]?)?\b\d(?:[\s-]?\d){6,7}\b/u;
// A first name and a family name: two capitalised words in a row (also with a hyphen).
const PERSON = /\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?/u;
// A heading that is nothing but a name (seen on a register's contact page: each official a heading, the channels under it).
const BARE_NAME = /^\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?(?:\s+\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?){1,2}$/u;
const BOILERPLATE = /^(?:Täname tagasiside eest!?|Kas (?:sellest lehest|see leht) oli (?:abi|kasulik)\??|Jaga|Prindi|Tagasi üles|Tagasi|Tagasi nimekirja|Back to list|Loe edasi)$/iu;
const DOCUMENT = /\.(pdf|docx?|xlsx?|odt|ods|rtf|pptx?|bdoc|asice|ddoc)(?:[?#]|$)|\/download(?:[?#/]|$)/iu;

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
function region(dom, hint) {
  const nodes = flat(dom).filter(name);
  if (hint) { const found = nodes.filter(node => matches(node, hint)); if (found.length === 1) return { node: found[0], how: 'hint' }; }
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
 * against it); options.region: a hint for the content region. Returns the stored HTML, its text hash, and what the
 * report and the metadata say of the page. Throws nothing for a poor page: the warnings say what to look at.
 */
export function extractPage(html, url, { region: hint = null, title: given = null } = {}) {
  const dom = parseDocument(html), picked = region(dom, hint), fallback = picked.how === 'body', regionChars = squeeze(text(picked.node)).length;
  const dropped = node => isDropped(node, fallback, regionChars);
  const documents = new Map(), removed = { contactCards: 0, personalEmails: 0, phonesBesideThem: 0 }, kept = { generalEmails: 0, otherEmails: 0, personLinks: 0 };
  const base = new URL(url);
  function inline(node) {
    if (node.type === 'text') return escape(node.data.replace(/\s+/gu, ' '));
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
      if (target?.protocol === 'mailto:' && emailKind(decodeURIComponent(target.pathname)) !== 'general') kept.personLinks++;
      if (!target || !['http:', 'https:'].includes(target.protocol)) return inner;
      target.hash = '';
      if (DOCUMENT.test(target.pathname + target.search)) documents.set(target.href, { url: target.href, text: label.slice(0, 200), type: (target.pathname.match(/\.([a-z0-9]{2,5})$/iu)?.[1] || 'download').toLowerCase() });
      return `<a href="${quote(target.href)}">${inner}</a>`;
    }
    return INLINE.has(tag) && squeeze(inner.replace(/<[^>]+>/gu, '')) ? `<${tag}>${inner}</${tag}>` : inner;
  }
  // Blocks of a container: kept block elements as they are, loose text and inline runs as paragraphs.
  function blocks(node) {
    const out = [];
    let run = '';
    const flush = () => { const value = run.replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim(); if (squeeze(value.replace(/<[^>]+>/gu, ''))) out.push(`<p>${value}</p>`); run = ''; };
    for (const child of kids(node)) {
      const tag = name(child);
      if (child.type === 'text') { run += inline(child); continue; }
      if (!tag || dropped(child)) continue;
      if (tag === 'button' || tag === 'summary') { flush(); const label = squeeze(text(child)); if (label) out.push(`<h4>${escape(label)}</h4>`); continue; }
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
      const inner = kids(node).map(inline).join('').replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim();
      return squeeze(inner.replace(/<[^>]+>/gu, '')) ? `<${tag}>${inner}</${tag}>` : '';
    }
    if (['li', 'td', 'th', 'dd', 'blockquote'].includes(tag)) {
      // A cell or an item with blocks of its own keeps them; one with only text keeps the text.
      const nested = kids(node).some(child => KEPT.has(name(child)) || ['div', 'section'].includes(name(child)));
      const inner = nested ? blocks(node).join('') : kids(node).map(inline).join('').replace(/[ \t]*\n[ \t]*/gu, '\n').replace(/[ \t]+/gu, ' ').trim();
      return squeeze(inner.replace(/<[^>]+>/gu, '')) || tag === 'td' || tag === 'th' ? `<${tag}>${inner}</${tag}>` : '';
    }
    const inner = kids(node).filter(child => KEPT.has(name(child)) && !dropped(child)).map(block).filter(Boolean).join('');
    return inner ? `<${tag}>${inner}</${tag}>` : '';
  }
  let body = blocks(picked.node);
  // Only the text between the tags is read: a link's address is not the page's wording.
  const inText = (item, change) => item.split(/(<[^>]+>)/u).map(part => (part.startsWith('<') ? part : change(part))).join('');
  const plain = item => squeeze(item.replace(/<[^>]+>/gu, ' ').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&'));
  // A person's contact is taken out unit by unit (a paragraph, a list item, a table row):
  // - a contact card, a short unit that names a person beside a phone number or an e-mail address, goes whole;
  // - elsewhere a person's e-mail address is removed together with the phone numbers in its unit.
  // An address the site hides behind its e-mail protection cannot be read, so it counts as a person's.
  const scrub = unit => {
    const said = plain(unit), mails = said.match(EMAIL) || [], hidden = said.includes(HIDDEN_EMAIL);
    const personal = hidden || mails.some(address => emailKind(address) === 'personal');
    if (PERSON.test(said) && (PHONE.test(said) || personal || mails.some(address => emailKind(address) === 'other')) && said.split(' ').length <= 40) { removed.contactCards++; return ''; }
    let next = inText(unit, part => part.replace(EMAIL, address => {
      const kind = emailKind(address);
      if (kind === 'personal') { removed.personalEmails++; return '[e-post eemaldatud]'; }
      kept[kind === 'general' ? 'generalEmails' : 'otherEmails']++;
      return address;
    }));
    if (hidden) { removed.personalEmails += said.split(HIDDEN_EMAIL).length - 1; next = next.split(HIDDEN_EMAIL).join('[e-post eemaldatud]'); }
    return personal ? inText(next, part => part.replace(new RegExp(PHONE.source, 'gu'), () => { removed.phonesBesideThem++; return '[telefon eemaldatud]'; })) : next;
  };
  body = body.map(item => (UNIT_TEST.test(item) ? item.replace(UNIT, scrub) : scrub(item))
    // What a removed unit leaves empty goes too.
    .replace(/<(ul|ol|tbody|thead|tfoot|dl)><\/\1>/gu, '').replace(/<table><\/table>/gu, '')).filter(item => plain(item));
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
  for (let index = 0; index < body.length; index++) {
    // The card's first line names the person: a short line, or a heading that is nothing but a name.
    const named = short(body[index]) ? PERSON.test(plain(body[index])) : /^<h[2-6]>/u.test(body[index]) && BARE_NAME.test(plain(body[index]));
    if (!named) continue;
    let end = index;
    while (end + 1 < body.length && end - index < 4 && cardLine(body[end + 1])) end++;
    const lines = body.slice(index, end + 1);
    if (!lines.some(reaches)) continue;
    // The card ends with its last line that gives a channel; a short line after it belongs to the text.
    let last = lines.length - 1;
    while (!reaches(lines[last])) last--;
    // What was already removed inside the card is the card's: it is counted once, as a card.
    const gone = body.splice(index, last + 1).join('');
    removed.personalEmails -= gone.split('[e-post eemaldatud]').length - 1; removed.phonesBesideThem -= gone.split('[telefon eemaldatud]').length - 1;
    removed.contactCards++; index--;
  }
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
export function emailKind(address) {
  const local = address.split('@')[0].toLowerCase(), parts = local.split(/[._-]/u).filter(Boolean);
  if (parts.every(part => GENERAL.has(part))) return 'general';
  if (parts.length >= 2 && parts.every(part => /^[a-zõäöüšž]{2,}\d*$/u.test(part)) && !parts.some(part => GENERAL.has(part))) return 'personal';
  return 'other';
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

/** The metadata file of a collected page, in the keys the corpus metadata adapter reads (metadata-adapter.js). */
export function pageMetadata({ entry, page, fetched, sourcePath, checkedAt = new Date() }) {
  return { document_id: `web-${entry.source_id}`, title: page.title || entry.title, register_title: entry.title, source_id: entry.source_id,
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
