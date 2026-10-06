import { createHash } from 'node:crypto';
import { GIVEN_NAMES, NOT_PERSONS, COMMON_WORDS, THING_ENDING } from './web-select-words.js';

// The choice of an organisation's pages for the corpus (ADR-095). The collector (web-page.js) keeps what a page says
// and takes a person's contact card out. An organisation's site says more of people than an office's does: who wrote
// a text, who spoke at an event, who founded the union, whose story this is. Hundreds of such pages cannot be looked
// at one by one, so a rule chooses, and the rule is strict on one side only: what it gets wrong costs text, never a
// person's privacy.
//   - A unit (a paragraph, a list item, a table row, a heading) that names a person is taken out; the page stays.
//     Under a heading that names a person, the whole section goes.
//   - A page is left out whole when it is mostly about persons (a quarter of its words or more went, or many units,
//     or its own heading names a person), when little is left, and by what it is: a forum, stories, news, a plan or a
//     report, a parked domain.
// The first rule (v63, 06.10.2026) left a page out whole for any name-like pair beside a role word and so left 18 of
// 48 organisations without a page (owner: "miks 18 organisatsiooni jäi välja? neil on ju lehed"); the second let
// names in running text through, as a look at the chosen pages showed. This is the third.
export const WEB_SELECTION = 'rag-v2/web-select-1';
const sha = value => createHash('sha256').update(value).digest('hex');
const plain = value => value.replace(/<[^>]+>/gu, ' ').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&quot;/gu, '"').replace(/&amp;/gu, '&').replace(/\s+/gu, ' ').trim();
const count = value => (value ? value.split(' ').length : 0);

// The innermost blocks of the stored page, the units a person is named in.
const UNIT = /<(p|li|tr|dd|dt|blockquote|pre|h[1-6])>(?:(?!<\/?(?:p|li|tr|ul|ol|table|dd|dt|blockquote|pre|h[1-6])>)[\s\S])*?<\/\1>/gu;
const CAPITALISED = /^\p{Lu}\p{Ll}{2,}(?:-\p{Lu}\p{Ll}+)?$/u, SHOUTED = /^\p{Lu}{3,}$/u;
const bare = word => word.replace(/^[("„“”«»'[]+|[)"„“”«»'\].,;:!?]+$/gu, '');
const ROLE = /juhataja|juhatuse|esimees|esinaine|aseesimees|tegevjuht|juht\b|president|sekretär|koordinaator|projektijuht|spetsialist|nõustaja|terapeut|psühholoog|logopeed|arst\b|\bdr\b|doktor|õde\b|konsultant|assistent|raamatupidaja|toimetaja|eestvedaja|kontaktisik|vastutav|autor|lektor|koolitaja|juhendaja|modereerib|esineb|asutaja|liige\b|liikmeks/iu;
const REACHED = /\b\d{7,8}\b|\b\d{3,4}\s\d{4}\b|@/u;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;
// The local part of an organisation's general address; an address named after the site itself is general too.
const GENERAL_ADDRESS = /^(?:info|kontakt|contact|post|mail|epost|yldinfo|kontor|buroo|liit|koda|yhing|uhing|selts|keskus|noustamine|registratuur|tugi|abi|sekretar|office|juhatus|toimetus|raamatukogu|teenused|klienditugi|vastuvott)$/u;
// Pages that are not an organisation's account of itself or of its subject, by their address and title.
const LEFT_OUT = /foorum|forum|teated|patsiendilood|lood\b|toetaja|toeta meid|annetus|koostööpartner|sponsor|tegevusplaan|tegevuskava|tegevusprogramm|arengukava|aruan|protokoll|üldkoosolek|aastakoosolek|põhikiri|pohikiri|pressiteade|uudised|older posts|ajaloost|ajalugu|meistriv/iu;
const PARKED = /domeen on registreeritud/iu;

/** The metadata of a chosen page: the collector's, with the hash of the file as chosen and what the choice took out.
 *  content_sha256 stays the collector's: it is what the next reading of the page is compared with. */
export function chosenMetadata(meta, chosen) {
  return { ...meta, source_sha256: chosen.sourceSha256,
    selection: { rule: WEB_SELECTION, words: chosen.words, paragraphs_taken_out: chosen.removed.units, sections_taken_out: chosen.removed.sections, words_taken_out: chosen.removed.words } };
}

/** The words written in lower case anywhere in a reading (three letters and more): a person's name is not among them. */
export function lowerWords(htmls) {
  const seen = new Set();
  for (const html of htmls) for (const word of html.replace(/<[^>]+>/gu, ' ').match(/(?<![\p{L}])\p{Ll}{3,}/gu) || []) seen.add(word);
  return seen;
}

/**
 * The pair by which a text names a person, or null: two capitalised words in a row that are not the name of something else, when
 *   - the first is a given name, or
 *   - neither is written in lower case anywhere in the reading (context.lower), or
 *   - one of them is not, and a role word, a phone number or an address stands beside them.
 * context: { lower: Set, places: Set of lower-case place words, notPersons: Set of pairs looked at and found not to be
 * a person }. Returns { pair, by }: by 'given_name', 'never_lower_case' or 'beside_a_role'.
 */
export function personPair(text, { lower = new Set(), places = new Set(), notPersons = NOT_PERSONS } = {}) {
  // A place also in its case forms ("Tartus", "Viljandist").
  const named = word => places.has(word) || COMMON_WORDS.has(word), inPlace = word => { const ending = word.match(/(?:sse|st|lt|le|ga|ni|s|l)$/u)?.[0]; return Boolean(ending) && word.length - ending.length >= 4 && named(word.slice(0, -ending.length)); };
  const words = text.split(' '), thing = word => named(word) || inPlace(word) || THING_ENDING.test(word);
  for (let at = 0; at + 1 < words.length; at++) {
    // Words a full stop or a comma parts are not one name.
    if (/[.,;:!?)]$/u.test(words[at])) continue;
    const first = bare(words[at]), second = bare(words[at + 1]);
    // A name written in capitals (a heading): known by its given name only, since most capitals are not names.
    if (SHOUTED.test(first) && SHOUTED.test(second) && GIVEN_NAMES.has(`${first[0]}${first.slice(1).toLowerCase()}`) && !thing(second.toLowerCase())) return { pair: `${first} ${second}`, by: 'given_name' };
    if (!CAPITALISED.test(first) || !CAPITALISED.test(second) || first === second || notPersons.has(`${first} ${second}`)) continue;
    const a = first.toLowerCase(), b = second.toLowerCase();
    if (thing(b)) continue;
    const pair = `${first} ${second}`;
    if (GIVEN_NAMES.has(first.split('-')[0])) return { pair, by: 'given_name' };
    if (thing(a)) continue;
    if (!lower.has(a) && !lower.has(b)) return { pair, by: 'never_lower_case' };
    // Both written in lower case elsewhere: the name of a condition or a service ("Sclerosis Multiplex") beside a
    // role word. An inflected common word ("Teenuste", "Lastele") is a heading's, not a name's.
    const inflected = word => word.length > 5 && /(?:te|de|ga|ks|st|le|lt)$/u.test(word);
    if (lower.has(a) && lower.has(b) || inflected(a) || inflected(b)) continue;
    const around = words.slice(Math.max(0, at - 6), at + 8).join(' ');
    if (ROLE.test(around) || REACHED.test(around)) return { pair, by: 'beside_a_role' };
  }
  return null;
}
export const namesPerson = (text, context) => Boolean(personPair(text, context));

/**
 * What goes into the corpus of a collected page. page: { html, meta } as the collector stored them; context as for
 * namesPerson, with leaveOut (a pattern of the list's own for titles and addresses) and year (a page whose title or
 * address names an earlier year is dated). Returns { keep: false, why } or { keep: true, html, words, removed: { units, words,
 * sections } }.
 */
export function selectPage({ html, meta }, context = {}) {
  const start = html.indexOf('<article>'), end = html.lastIndexOf('</article>');
  if (start < 0 || end < 0) return { keep: false, why: 'not a collected page' };
  const article = html.slice(start + 9, end), said = plain(article), all = count(said), title = String(meta.title || ''), warnings = meta.collection?.warnings || [];
  const address = new URL(meta.url), named = `${decodeURIComponent(address.pathname)} ${title}`, year = context.year ?? new Date().getFullYear();
  const out = why => ({ keep: false, why });
  if (warnings.includes('rendered_by_script')) return out('rendered by script');
  if (PARKED.test(said)) return out('a parked domain');
  // A title that is a number is a page of a list of posts.
  if (LEFT_OUT.test(named) || context.leaveOut?.test(named) || /(?:^|: )\d+$/u.test(title)) return out('by what it is: a forum, stories, news, donors, a plan or a report, history, a third party\'s summary');
  // A post is dated by its title or its address. The date a site's template prints on every page is not a sign: one
  // union's page on what the condition is carries the day it was written, years ago, and says what it said then.
  const earlier = value => (value.match(/(?<!\d)20\d\d(?!\d)/gu) || []).some(found => Number(found) < year), route = decodeURIComponent(address.pathname);
  if (earlier(title) || earlier(route) || /(?<!\d)20\d\d[-/]\d\d(?!\d)/u.test(route)) return out('dated: an earlier year in its title or address, or a post\'s month in its address');

  const host = address.host.replace(/^www\./u, '').split('.')[0].replace(/[^a-z0-9]/gu, '');
  const personalAddress = text => (text.match(EMAIL) || []).some(found => { const local = found.split('@')[0].toLowerCase(); return !(GENERAL_ADDRESS.test(local) || local.length >= 4 && (host.includes(local) || local.includes(host))); });
  const personal = text => namesPerson(text, context) || text.includes('[e-post eemaldatud]') || personalAddress(text);
  const removed = { units: 0, words: 0, sections: 0 };
  let section = 0, short = 0, ownHeading = false;
  let kept = article.replace(UNIT, unit => {
    const tag = unit.match(/^<(\w+)>/u)[1], level = /^h[1-6]$/u.test(tag) ? Number(tag[1]) : 0, text = plain(unit), size = count(text);
    // Under a heading that names a person, everything down to the next heading of its level is about that person.
    if (section && (!level || level > section)) { removed.words += size; return ''; }
    section = 0;
    if (!personal(text)) return unit;
    if (level === 1) { ownHeading = true; return unit; }
    removed.units++; removed.words += size;
    if (size <= 4) short++;
    if (level) { section = level; removed.sections++; }
    return '';
  });
  if (ownHeading) return out('its own heading names a person');
  // What a removed unit leaves empty goes too, and a heading with nothing left under it.
  for (let before = null; before !== kept;) { before = kept; kept = kept.replace(/<(ul|ol|tbody|thead|tfoot|dl|blockquote|table)>\s*<\/\1>/gu, ''); }
  for (let changed = true; changed;) {
    changed = false;
    kept = kept.replace(/<h([2-6])>(?:(?!<\/h\1>)[\s\S])*<\/h\1>\s*(?=<h([1-6])>|$)/gu, (whole, level, next) => { if (next !== undefined && Number(next) > Number(level)) return whole; changed = true; return ''; });
  }
  kept = kept.replace(/\n{2,}/gu, '\n');
  // Text that stands in no unit (an item's own line above its nested list) is not looked at above.
  if (personal(plain(kept.replace(UNIT, ' ')))) return out('a person named outside a paragraph');
  const words = count(plain(kept));
  // A page of profiles, a list of members, a news feed: taking the names out would leave what is said of them.
  if (removed.words > 0.25 * all || removed.units > 8 || short > 3) return out('mostly about persons');
  if (words < 30) return out('under 30 words');
  if (warnings.includes('content_region_not_marked') && words < 80) return out('no marked content region and under 80 words');
  const chosen = `${html.slice(0, start + 9)}${kept}${html.slice(end)}`;
  return { keep: true, html: chosen, words, removed, sourceSha256: sha(chosen) };
}
