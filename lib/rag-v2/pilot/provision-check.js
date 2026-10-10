import { provisionMentions, unitSubsections, wordsBefore, designation, actGenitive, sectionKey } from '../search/legal-references.js';
import { provisionLabel } from '../search/legal-place.js';
import { actKey } from '../search/version-comparison.js';
import { boundedDraft } from './contracts.js';
import { SETTLEMENTS } from '../adapters/settlement-data.js';
import ACT_ABBREVIATIONS from '../search/act-abbreviations.json' with { type: 'json' };

// ADR-129 (owner 10.10.2026): an answer names the act and the provision a claim rests on ("sotsiaalhoolekande seaduse
// § 133 lg 5"), and users will test exactly that. validateAnswer sees the answer and the list of references, never the
// evidence, so nothing checked a section number the model wrote. This check runs where the turn's packet is at hand
// (service.js, after the answer is validated and before it is saved for publication) and reads the answer as it will
// be published. No model, no guess, and nothing in the answer is changed: every provision a visible part names gets
// one kind, the first that holds, and the counts are kept with the turn (provisionAudit). The check classifies and
// records; whether a kind also stops publication is REFUSED_KINDS below, which is empty.
//   a  the provision label of a legal passage the block cites (legal_place, ADR-123), under that act's name or none
//   b  written in what a passage the block cites holds: its own heading line and subsection marks, a pointer in its
//      text ("§ 133 lõikes 5", "käesoleva paragrahvi lõikes 5"), or its act's own dates (ADR-062)
//   c  as a or b, but of a passage of the turn's evidence that the block does not cite
//   v  named by the server's comparison of two versions of an act (version_changes, ADR-088)
//   s  written elsewhere in what the model was shown: a record's field, a dependency note, the search's own report
//   p  named in a block of the published answer the dialogue shows. Not checked here: it is whatever kind it was in
//      that answer's own audit, and while nothing is refused that may have been d
//   q  named by the user, and only outside the blocks (a limitation that says its text is not at hand)
//   d  none of them: a number from memory, a guess, or a provision the user named that nothing here gives
// An act is told apart by its title, issuer and municipality (actKey): 60 of the 286 municipal regulation titles in
// the index are shared by two or more municipalities, so a title alone would count one municipality's limit under
// another's name as kind a.
// The answer and the evidence are read differently on purpose. Of an answer only what it certainly names is read (a
// number after a subsection that may be a quantity is left out); of a passage, a message or a record everything it
// may give. Either way a mistake of the reader makes the check milder, never a right answer kind d.
export const PROVISION_CHECK_VERSION = 'rag-v2/provision-check-1';
export const PROVISION_KINDS = Object.freeze(['a', 'b', 'c', 'v', 's', 'p', 'q', 'd']);
// The policy, in this one place: the kinds that stop publication. EMPTY (the maintainer's decision, 10.10.2026): every
// validated answer is published and the audit is kept with its turn. Two rounds of review each found right answers that
// kind d would have withheld: a number after a subsection read as another subsection, a pointer inside the passage's
// own section, the honest limitation the instruction asks for, two acts in one bracket when a title begins with a
// year, a two-word law written as one word, an all-capitals word before a section mark. A paid answer withheld from a
// person for the check's own mistake is worse than what the refusal guards against. Those six are fixed and pinned
// (tests/rag-v2-provision-check.test.mjs), but that the list of such mistakes is finished is not known.
// BEFORE A KIND IS ENTERED HERE, measure: no false kind d (a provision the turn's evidence does give, or a number that
// is no provision at all) among the mentions of the paid check (tests/evaluation/dialogue/scenarios-provisions-1.json)
// and of recorded live turns (the health report's provision counts; scripts/rag-v2-context-replay.mjs --provisions),
// every d of both read by hand. Entering 'd' also needs kind p made strict first (a provision that was d when it was
// first published reads as p in the answers after it), and the last sentence of LEGAL PROVISIONS in contracts.js then
// says what the server does and changes with this list (a new prompt version).
// The refusal path below stays in the code and is exercised by tests that inject a list (checkProvisions' `refuse`,
// the service's refusedProvisionKinds). c would stay published even then: the provision is real and of this turn's
// evidence, and the check cannot tell a missing ref from a claim written under another passage's number, so each c is
// counted and listed for reading (with `collision` where a cited passage of another act carries the same number).
export const REFUSED_KINDS = Object.freeze([]);
const ITEMS = 20, RAISED = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUP = `[${RAISED}]`;
const NUMBER = new RegExp(`^(\\d+)(${SUP}*)$`, 'u');
const keyOf = shown => { const found = NUMBER.exec(shown ?? ''); return found ? sectionKey(found[1], found[2]) : null; };
const raised = digits => [...digits].map(digit => RAISED[digit]).join('');
const shownOf = key => key.replace(/\^(\d+)$/u, (_, digits) => raised(digits));
// The forms the answer instructions prescribe besides the Estonian one, turned into it before the list reader reads:
// "paragrahv 5", "статья 5" and "ст. 5" are "§ 5"; "§ 5(2)" and "§ 5 (2–3)" are "§ 5 lg 2" and "§ 5 lg 2–3" (a number
// of more than three digits in the brackets is a year, not a subsection); directly after a section's number
// "subsection 2", "ч. 2" and "часть 2" are "lg 2" (elsewhere "ч." is an hour); "§ 13^1" is "§ 13¹".
// A bracket closes its list: the word joiner written after it is a character the list reader reads nothing through,
// so "§ 5(2), 10 working days" names subsection 2 and no subsection 10 (first review, 10.10.2026).
const WORD_ET = /(?<![\p{L}\p{N}])paragrahv\p{L}*\s+(?=\d)/giu, WORD_RU = /(?<![\p{L}\p{N}])(?:ст\.|стать\p{L}{1,2})\s*(?=\d)/giu, CLOSED = '⁠';
const BRACKETED = new RegExp(`(§\\s*\\d+${SUP}*)\\s?\\((\\d{1,3}${SUP}*(?:\\s*[–-]\\s*\\d{1,3}${SUP}*)?)\\)`, 'gu');
const SUB_WORD = new RegExp(`(§\\s*\\d+${SUP}*),?\\s+(?:subsections?|ч\\.|част[ьи])\\s*(?=\\d)`, 'giu'), CARET = /(?<=\d)\^(\d{1,2})(?!\d)/gu;
// English "section 5" is not read as a provision (a form has sections too): it is only counted, so a run shows it.
const WORD_EN = /(?<![\p{L}\p{N}])sections?\s+\d/giu;
// A subsection named without its section ("Seda ütleb lõige 5."). In an answer there is nothing to compare it with, so
// it is only counted; in a legal passage it is a pointer inside the passage's own section (inner, below).
const BARE_SUB = /(?<![\p{L}\p{N}])(?:lõi(?:ge|get|gete\p{L}*|ke\p{L}*)|lg\.?)\s+\d/giu;
export const readable = text => String(text ?? '').normalize('NFC').replace(CARET, (_, digits) => raised(digits)).replace(WORD_ET, '§ ').replace(WORD_RU, '§ ').replace(BRACKETED, `$1 lg $2${CLOSED}`).replace(SUB_WORD, '$1 lg ');
const strings = value => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);
const plain = text => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('et');
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const base = key => Number(key.split('^')[0]);
// What a text may give, read whole. A "range" that runs backwards ("§ 13-1", a raised digit written with a hyphen) is
// no range of sections and is not read.
const read = (text, options) => provisionMentions(text, options).filter(item => !(item.to && base(item.to) < base(item.section)));
// What an answer names. The last number of a list of subsections, and the far end of a range of sections, may be a
// quantity, a year or a date that only stands after the provision: "§ 131 lg 1 ja 2026. aasta riigieelarve seaduse
// § 2 lg 7", "§ 133 lg 7 – 10 tööpäeva", "§ 133 lg 7, 10 tööpäeva jooksul", "§ 21 lg 1 ja 2 lapse puhul", "§ 6 kuni 30
// päeva jooksul". Both reviews of 10.10.2026 found right answers read as "lg 2026" and "lg 10" this way. Such a number
// is a subsection only when nothing follows it, a closing mark does, or a word that goes on about the provision
// ("järgi", "alusel", "sätestab"); a number of more than three digits never is. Anything else is left out: the
// answer is then checked for less than it wrote, never for a provision it did not name.
const JOINER = '(?:,\\s*(?:(?:ja/või|ja|ning|või)\\s+)?|(?:ja/või|ja|ning|või)\\s+|[–—-]\\s*)';
const LAST = new RegExp(`\\s*${JOINER}(\\d+)${SUP}*$`, 'u'), LISTED = new RegExp(`(?:lõi\\p{L}*|lg\\.?)\\s*\\d+${SUP}*(?:\\s*(?:,|ja/või|ja|ning|või|[–—-])\\s*\\d+${SUP}*)*$`, 'u');
const GOES_ON = new RegExp(`^(?:\\s*(?:$|[)\\]"”“»,;:!?/${CLOSED}\\n]|\\.(?!\\s*[\\p{Ll}\\d]))|\\s+(?:järgi|alusel|kohaselt|kohase\\p{L}*|kohta|puhul|korral|põhjal|mõttes|tähenduses|nimetatu\\p{L}*|sätesta\\p{L}*|sätte\\p{L}*|toodu\\p{L}*`
  + '|loetle\\p{L}*|kirjelda\\p{L}*|ette|ettenähtu\\p{L}*|kehtesta\\p{L}*|märgitu\\p{L}*|viidatu\\p{L}*|tulene\\p{L}*|ütle\\p{L}*|näe\\p{L}*|anna\\p{L}*|kohusta\\p{L}*|luba\\p{L}*|reguleeri\\p{L}*|kehti\\p{L}*|kohald\\p{L}*'
  + '|rakend\\p{L}*|nõua\\p{L}*|keela\\p{L}*|käsitle\\p{L}*|on|ei|pole|ja|ning|või|ega|aga|kuid|ka|samuti)(?!\\p{L}))', 'u');
const stands = (digits, after) => digits.length <= 3 && GOES_ON.test(after);
function named(text, options) {
  return read(text, options).map(item => {
    const after = text.slice(item.end), last = item.unit ? LAST.exec(item.unit) : null;
    if (!item.unit) return item.to && !stands(item.to.split('^')[0], after) ? { ...item, to: null } : item;
    if (!last || !LISTED.test(item.unit.slice(0, last.index)) || stands(last[1], after)) return item;
    return { ...item, ...unitSubsections(item.unit.slice(0, last.index)) };
  });
}
/** The provisions an answer's text names, one for each named subsection and for each end of a range: [{ section,
 *  subsections, start }], subsections holding one number or none; start is the place of the list's first mark in the
 *  text as given. One mention a subsection, because "§ 133 lg 5–7" may rest on two cited passages (lg 5–6 and lg 7). */
export function namedProvisions(text, options) {
  return named(text, options).flatMap(({ section, to, subsections, start }) => (to ? [{ section, subsections: [], start }, { section: to, subsections: [], start }]
    : subsections.length > 1 ? subsections.map(subsection => ({ section, subsections: [subsection], start })) : [{ section, subsections, start }]));
}
// What a reading gives, as against what a mention names: a range gives everything between its ends ("§-des 105–107"
// gives § 106, "lõigetes 5–7" gives lõige 6), so no provision a text spans is missed for not being written out.
const between = (key, from, to) => base(from) <= base(key) && base(key) <= base(to);
const holds = (item, { section, subsections }) => (item.section === section || Boolean(item.to) && !subsections.length && between(section, item.section, item.to))
  && subsections.every(subsection => item.subsections.includes(subsection) || item.through.some(([from, to]) => between(subsection, from, to)));
const among = (list, mention) => list.some(item => holds(item, mention));

// The laws of the corpus by the names an answer may give them (the table holds every indexed law's title, with the
// abbreviation Riigi Teataja gives it or null). A law is also named when its last word is joined or split otherwise
// than in its title: "sotsiaalhoolekandeseaduse" for "sotsiaalhoolekande seaduse" and "lastekaitse seaduse" for
// "lastekaitseseaduse" are common spellings, and the first read as a one-word law the evidence does not hold.
const LAW_END = '(?:seaduse|seadustiku|koodeksi)';
const lawNames = title => { const genitive = actGenitive(title); return genitive ? [...new Set([genitive, genitive.replace(new RegExp(`\\s+(?=${LAW_END}$)`, 'u'), ''), genitive.replace(new RegExp(`(?<=\\p{L})(?=${LAW_END}$)`, 'u'), ' ')])] : []; };
const TABLE = new Map(Object.entries(ACT_ABBREVIATIONS.abbreviations));
// One of them that is no act of this turn's evidence is an act the model was not shown; so is a one-word law name of
// no act here ("liiklusseaduse"), an abbreviation shaped as a law's ("VÕS", "KOKS-i"; "KOV" and "SKA" are not), and a
// municipality's regulation when the evidence holds no act of that municipality. Each keeps a name, so two namings of
// one such act can be told from namings of two ("perekonnaseaduse § 25" in a cited text and "PKS § 25" in the answer).
const CORPUS_LAWS = new Map([...TABLE.keys()].flatMap(title => [plain(title), ...lawNames(title)].map(name => [name, title]))), CORPUS_ABBREVIATIONS = new Map([...TABLE].filter(([, short]) => short).map(([title, short]) => [short, title]));
const LAW_WORD = new RegExp(`(?:^|[^\\p{L}\\p{N}])(\\p{L}{2,}${LAW_END})$`, 'u');
// An unknown abbreviation: Latin letters, at least three, a capital among them and a capital S last, with a case
// ending or without. "AS" (a company) is too short, and a word that follows another all-capitals word is a heading
// ("ÕIGUSLIK ALUS § 5"), not an act (first review, 10.10.2026: both were counted as acts the evidence does not hold).
const SHORT = /(?:^|[^\p{L}\p{N}])(\p{Script=Latin}*\p{Lu}\p{Script=Latin}+S)(?:-?\p{Ll}{1,4})?$/u, HEADING = /(?:^|[^\p{L}\p{N}])\p{Lu}{2,}\s+\S+$/u;
const suffixed = key => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped(key)}(?:-?\\p{Ll}{1,4})?$`, 'u');
const folded = name => name.toLocaleLowerCase('et').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/gu, '_');
const NONE = Object.freeze(new Set());
const word = (text, key) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped(key)}(?:$|[^\\p{L}\\p{N}])`, 'u').test(text);
// A regulation by who gave it, as an answer may write it before "määruse": the municipality in the genitive ("Kuusalu
// valla"), its council or government ("Kuusalu Vallavolikogu", "Kuusalu Vallavalitsuse"), or the issuer itself
// ("sotsiaalkaitseministri"). Tallinn's name stands without "linn". Every body of one municipality names all its acts
// here: which body gave an act is not what the reader is misled by.
function issuerNames(municipality, authority) {
  const kind = /^(.+)\s+(vald|linn)$/u.exec(municipality ?? ''), council = /^(.+)\s+(vall|linn)a(?:volikogu|valitsus)$/u.exec(authority ?? '');
  const stems = [...(kind ? [`${kind[1]} ${kind[2] === 'vald' ? 'vall' : 'linn'}`] : municipality ? [`${municipality}a linn`] : []), ...(council ? [`${council[1]} ${council[2]}`] : [])];
  return { stems: [...stems, ...(municipality && !kind ? [municipality] : [])], bare: kind ? kind[1] : municipality || null,
    names: [...stems.flatMap(stem => ['a', 'avolikogu', 'avalitsuse'].map(body => stem + body)), ...(municipality && !kind ? [`${municipality}a`] : []),
      ...(authority ? [authority.replace(/valitsus$/u, 'valitsuse').replace(/minister$/u, 'ministri')] : [])] };
}
// The acts of the turn's evidence by the names an answer may give them: the title as it stands, a law's title in the
// genitive ("sotsiaalhoolekande seaduse"), the abbreviation Riigi Teataja gives the law, and a regulation by its
// issuer. A name maps to acts (actKey): the versions of one act are one act, two municipalities' acts of one title two.
// places: the municipalities whose acts the evidence holds, by the stem an Estonian phrase names them with ("harku
// vall", "tallinn"); bare: by the name as the card writes it without its kind ("harku"), for an English or Russian answer.
function actNames(passages) {
  const names = new Map(), abbreviations = new Map(), places = new Map(), bare = new Map(), add = (map, name, act) => { if (name) map.set(name, (map.get(name) || new Set()).add(act)); };
  for (const { title, act, legal, municipality, authority } of passages) {
    if (!title) continue;
    for (const name of [plain(title), ...lawNames(title)]) add(names, name, act);
    add(abbreviations, TABLE.get(title), act);
    if (!legal) continue;
    const issuer = issuerNames(municipality, authority);
    for (const name of issuer.names) add(names, `${name} määruse`, act);
    for (const stem of issuer.stems) add(places, stem, act);
    add(bare, issuer.bare, act);
  }
  return { names, abbreviations, places, bare };
}
// The municipality whose act an Estonian phrase names when the name does not stand directly before "määruse": "Harku
// valla sotsiaalhoolekandelise abi andmise korra", "Harku vallas kehtiva määruse", "Tallinnas kehtiva korra" (first
// review, 10.10.2026: each was read as naming no act, so another municipality's passage of the same title and number
// was kind a). The phrase ends with the act's word, holds at most nine words after the municipality's, no mark between
// them and no finite verb ("Harku vallas kehtib määruse ..." names where, not whose). Returns { stem, ids } (the stem
// as actNames keys it; the keys of the settlement table, ADR-103, that would be this municipality), or null.
const ACT_WORD = /^(?:määruse|korra|eeskirja)$/u, BODY = /^(vall|linn)a(?:s|volikogu|valitsuse)?$/iu, FINITE = /(?:b|vad|[td]akse)$/u;
function placeOf(words, places) {
  const tokens = words.split(' ');
  if (!ACT_WORD.test(tokens.at(-1) ?? '')) return null;
  for (let at = tokens.length - 2; at >= 0 && tokens.length - at <= 12; at--) {
    // A bracket or a quotation mark opens the phrase: the word after it is still read, nothing before it.
    const token = tokens[at].replace(/^[([„"“«]+/u, ''), body = BODY.exec(tokens[at + 1] ?? ''), name = token.toLocaleLowerCase('et');
    if (!/^[\p{L}-]+$/u.test(token) || /^\p{Ll}/u.test(token) && FINITE.test(token)) return null;
    if (/^\p{Lu}/u.test(token)) {
      if (body) return { stem: `${name} ${body[1].toLowerCase()}`, ids: [`${folded(token)}_${/^v/iu.test(body[1]) ? 'vald' : 'linn'}`, folded(token).replace(/a$/u, '')] };
      // A city whose name stands without "linn": "Tallinna määruse", "Tallinnas kehtiva korra". Only a name that is one.
      const city = /^(.+?)as?$/u.exec(name)?.[1];
      if (city && (places.has(city) || Object.hasOwn(SETTLEMENTS, folded(city)))) return { stem: city, ids: [folded(city)] };
    }
    if (token !== tokens[at]) return null;
  }
  return null;
}
// The act a mention names: { acts, name }, or null when no act is named there, and the mention is then compared with
// the passages of every act. acts: the acts of the evidence that go by the name, EMPTY when the name is of an act this
// turn's evidence does not hold: then no passage's own section is that provision, and only a pointer written in a
// cited text can give it (ADR-064: a regulation that points at the law); name tells such acts apart.
// The name ends the words directly before the list's first mark, or stands in the brackets directly before it
// ("<English name> (<Estonian title>) § 5(2)"). A title in quotation marks between an issuer and the mark picks the
// act among that issuer's: it is the only thing that tells two acts of one municipality apart, and 96 of the 128
// issuers in the index have two or more (first review: the other act's passage with the same number was kind a). A
// title that is none of the issuer's acts here changes nothing: the model may have shortened it.
// Left unnamed, and so compared with every act: a bare "seaduse", "käesoleva seaduse", a law of several words that
// the corpus does not hold, a regulation named by its title in the genitive alone, an act's name in English or
// Russian without the Estonian title.
function namedAct(text, start, { names, abbreviations, places, bare }) {
  const before = text.slice(0, start).trimEnd(), words = wordsBefore(text, start).replace(/\s+/gu, ' '), lower = words.toLocaleLowerCase('et');
  const ends = key => lower.endsWith(key) && !/[\p{L}\p{N}]/u.test(lower.at(-key.length - 1) ?? ' '), longest = keys => [...keys].filter(ends).sort((a, b) => b.length - a.length)[0];
  const all = (map, keys) => (keys.length ? new Set(keys.flatMap(key => [...map.get(key)])) : null), shown = acts => ({ acts, name: null }), absent = name => ({ acts: NONE, name });
  const quoted = /[„"“«]([^„"“”«»]{2,300})[“”"»]$/u.exec(before)?.[1], bracket = /\(([^()]{2,200})\)$/u.exec(before)?.[1] ?? '', inside = plain(bracket);
  const titled = quoted ? names.get(plain(quoted)) ?? null : null, picked = acts => { const both = titled ? [...acts].filter(act => titled.has(act)) : []; return shown(both.length ? new Set(both) : acts); };
  const name = longest(names.keys());
  if (name) return picked(names.get(name));
  // An abbreviation with a case ending, with a hyphen or without one: "SHS-i", "SHSi" (20 times in the corpus, audit 02.10).
  const short = [...abbreviations.keys()].find(key => suffixed(key).test(words));
  if (short) return shown(abbreviations.get(short));
  const bracketed = all(names, [...names.keys()].filter(key => word(inside, key))) ?? all(abbreviations, [...abbreviations.keys()].filter(key => word(bracket, key)));
  if (bracketed) {
    // "<municipality_name> regulation (<Estonian title>) § 5(2)": the municipality named last before the brackets.
    const tail = lower.slice(-80), local = [...bare.keys()].filter(key => word(tail, key)).sort((a, b) => tail.lastIndexOf(b) - tail.lastIndexOf(a))[0];
    const both = local ? [...bracketed].filter(act => bare.get(local).has(act)) : [];
    return shown(both.length ? new Set(both) : bracketed);
  }
  const place = placeOf(words, places);
  if (place && places.has(place.stem)) return picked(places.get(place.stem));
  if (titled) return shown(titled);
  const law = longest(CORPUS_LAWS.keys()), unknown = [...CORPUS_ABBREVIATIONS.keys()].find(key => suffixed(key).test(words));
  if (law) return absent(CORPUS_LAWS.get(law));
  if (unknown) return absent(CORPUS_ABBREVIATIONS.get(unknown));
  if (LAW_WORD.test(lower)) return absent(LAW_WORD.exec(lower)[1]);
  if (SHORT.test(words) && !HEADING.test(words)) return absent(SHORT.exec(words)[1]);
  if (place?.ids.some(id => Object.hasOwn(SETTLEMENTS, id))) return absent(place.stem);
  const other = [...CORPUS_LAWS.keys()].find(key => word(inside, key)), abbreviated = [...CORPUS_ABBREVIATIONS.keys()].find(key => word(bracket, key));
  return other ? absent(CORPUS_LAWS.get(other)) : abbreviated ? absent(CORPUS_ABBREVIATIONS.get(abbreviated)) : null;
}
// Whether two namings may be of one act; a naming that is missing or cannot be told agrees with any.
const agrees = (one, other) => !one || !other || (one.acts.size || other.acts.size ? [...one.acts].some(act => other.acts.has(act)) : !one.name || !other.name || one.name === other.name);

// What a passage gives: its label's place; for a passage without one (an act read from a PDF, an older reader) the
// section its own text begins with; and the provisions its text and its act's own dates point at. A section's own
// heading line is not among the pointers: it is the passage's own section, which only its own act's name may claim.
// A pointer is one of three:
//   own    the text marks it as its own act's ("käesoleva seaduse § 9 lõikes 2"), its act's dates name it, or it
//          points inside the passage's own section ("käesoleva paragrahvi lõikes 7", a bare "lõigetes 1–3"): that
//          act's provision and no other's;
//   other  the text names another act before it ("täitemenetluse seadustiku §-de 131 ja 132 kohaselt"): never the
//          passage's own act's provision, and when the act it names can be told, only that act's (first review: such
//          a pointer made "sotsiaalhoolekande seaduse § 132" kind b over a passage of that very law);
//   else   a bare "§ 140 lõikes 2", "sama seaduse § 9": written there whatever the act.
// legal: a passage of an act (a label, a heading of its own, the act's dates or the card's source type say so); a
// pointer in any other source (a guide's "vt SHS § 15") is that source's reference, counted apart.
const OWN_HEADING = new RegExp(`^\\s*§\\s*(\\d+)(${SUP}*)\\.`, 'u');
// A pointer inside the passage's own section. Riigi Teataja writes "käesoleva paragrahvi lõikes 5" (95 times in the
// Social Welfare Act against 157 pointers with a section mark) and municipal acts also a bare "lõigetes 7 ja 9"; the
// instruction has the answer write the passage's own section with it, and both reviews of 10.10.2026 found that
// answer kind d. Read: a subsection word with its number that no list at a section mark holds, unless the word before
// it is another section's ("eelmise paragrahvi lõikes 2"). The list is read as at a mark, from the section's number
// written before it; the word in small letters, as the list reader knows it ("Lõigetes 1–3" begins a sentence).
const OTHER_SECTION = /paragrahvi\s*$/iu, OWN_SECTION = /(?:^|[^\p{L}])(?:käesoleva|sama|selle|nimetatud|eelnimetatud)\s+paragrahvi\s*$/iu;
function inner(text, section) {
  const lists = provisionMentions(text), free = ({ index }) => !lists.some(item => item.start <= index && index < item.end) && (!OTHER_SECTION.test(text.slice(0, index)) || OWN_SECTION.test(text.slice(0, index)));
  return [...text.matchAll(BARE_SUB)].filter(free).flatMap(({ index }) => read(`§ ${shownOf(section)} ${text[index].toLocaleLowerCase('et')}${text.slice(index + 1, index + 200)}`).slice(0, 1)).map(item => ({ ...item, own: true, other: false }));
}
function passageOf(entry) {
  const label = provisionLabel(entry.legal_place), text = typeof entry.source_text === 'string' ? entry.source_text : '', heading = label ? null : OWN_HEADING.exec(text);
  const place = label ? { section: keyOf(entry.legal_place.section), to: null, subsections: entry.legal_place.subsections.map(keyOf), through: [] } : null, section = place?.section ?? (heading ? sectionKey(heading[1], heading[2]) : null);
  const pointers = (value, labels = false) => { const shown = readable(value), whose = item => (labels ? 'own' : designation(shown, item.start)); return read(shown, { headings: labels }).map(item => ({ ...item, own: whose(item) === 'own', other: whose(item) === 'other', shown })); };
  const field = name => (typeof entry.source_metadata?.[name]?.value === 'string' ? plain(entry.source_metadata[name].value) : null);
  return { id: entry.evidence_id, title: typeof entry.bibliography?.title === 'string' && entry.bibliography.title.trim() ? entry.bibliography.title : null, act: actKey(entry),
    place, text, section, municipality: field('municipality_name'), authority: field('authority'),
    legal: Boolean(place || heading || entry.legal_dates || entry.source_metadata?.source_type?.value === 'legal_act'),
    pointers: [...pointers(text), ...(section ? inner(readable(text), section) : []), ...strings(entry.legal_dates).flatMap(value => pointers(value, /^§\s*\d/u.test(value)))] };
}
// A subsection's own number in a passage's text: "(2)" or "(2¹)" at the start of a line, or, in text that runs on
// (a PDF's), before a word that begins with a capital.
const marked = (text, subsection) => new RegExp(`(?:^|\\n)[ \\t]*\\(${shownOf(subsection)}\\)|\\(${shownOf(subsection)}\\)\\s+\\p{Lu}`, 'u').test(text);
/** 'label', 'text' or null: how a passage gives the provision a mention names. act: the act the mention names
 *  (namedAct; null when it names none). A passage's own section is that provision only under its own act's name, and
 *  so is a pointer of its own; a pointer the text gives another act never is the passage's own act's. */
function gives(passage, mention, act) {
  const mine = Boolean(act?.acts.has(passage.act)), same = !act || mine, own = same && passage.section === mention.section;
  if (own && passage.place && holds(passage.place, mention)) return 'label';
  if (own && (mention.subsections.length ? mention.subsections.every(subsection => marked(passage.text, subsection)) : !passage.place)) return 'text';
  return passage.pointers.some(item => (item.own ? same : !(item.other && mine) && agrees(item.of, act)) && holds(item, mention)) ? 'text' : null;
}
const shown = ({ section, subsections }) => `§ ${shownOf(section)}${subsections.length ? ` lg ${subsections.map(shownOf).join(', ')}` : ''}`;
// A provision counts as the user's also when a message holds its section's number as a number of its own, with a mark
// or without one: "SHS 133 lg 9", "section 133(9)", "133. paragrahvi 9. lõige", "часть 9 статьи 133". Both reviews of
// 10.10.2026: the honest limitation the instruction asks for ("I do not have the text of § 133(9)") was kind d for
// every user who did not write "§". Only outside the blocks (kind q), where it costs nothing: a block that repeats the
// user's provision stays d.
const numbered = (texts, section) => { const number = new RegExp(`(?<![\\p{N}^]|\\d[.,])${escaped(shownOf(section))}(?![\\p{N}^]|[.,]\\d)`, 'u'); return texts.some(text => number.test(text)); };

/**
 * Every provision the answer names, against the turn's packet. answer: the validated answer (blocks, limitations,
 * clarification); packet: the turn's packet (evidence, reference_map, version_comparison, model_context; a lean one
 * reads the same for what it still holds); said: the topic's user messages; published: the texts of the blocks of the
 * published answer the dialogue shows (its limitations may repeat a provision the user named, which nothing checked).
 * refuse: the kinds that stop publication (REFUSED_KINDS, which is empty; a test injects a list).
 * Returns { audit, refused }: audit is what the turn keeps, numbers and at most 20 of the mentions worth reading by
 * hand (those not of kind a, and those that name no act after another act was named), each as its place, its number
 * and its kind (no text of the answer); refused is null, or the first part that names a provision of a refused kind
 * ({ path, text, provision }).
 */
export function checkProvisions(answer, packet, said = [], published = [], { refuse = REFUSED_KINDS } = {}) {
  const evidence = Array.isArray(packet?.evidence) ? packet.evidence.filter(entry => entry && typeof entry === 'object') : [], passages = evidence.map(passageOf), byId = new Map(passages.map(passage => [passage.id, passage]));
  const names = actNames(passages), texts = list => [list].flat().filter(text => typeof text === 'string').map(readable);
  // The act a pointer's own words name, read as an answer's are: only now, when the names of the evidence are known.
  for (const passage of passages) for (const pointer of passage.pointers) if (pointer.other) pointer.of = namedAct(pointer.shown, pointer.start, names);
  const compared = strings(packet?.version_comparison).filter(value => /^§\s*\d/u.test(value)).flatMap(value => read(value));
  // The rest of what the model was shown. The excerpts and the acts' dates are read above, each with its act; read
  // again here without one, a cited passage's own number would vouch for any act's name.
  const { evidence: _excerpts, version_changes: _changes, sources = {}, ...rest } = packet?.model_context ?? {};
  const elsewhere = strings([rest, Object.values(sources ?? {}).map(card => ({ ...card, act_dates: null }))]).flatMap(value => read(readable(value), { headings: false }));
  const asked = texts(said), earlier = asked.flatMap(text => read(text)), before = texts(published).flatMap(text => read(text)), kinds = Object.fromEntries(PROVISION_KINDS.map(kind => [kind, 0])), items = [];
  const parts = [...(answer?.blocks || []).map((block, at) => ({ path: `$.blocks[${at}].text`, text: block.text, refs: block.refs || [] })),
    ...(answer?.limitations || []).map((text, at) => ({ path: `$.limitations[${at}]`, text, refs: [] })), ...(answer?.clarification ? [{ path: '$.clarification', text: answer.clarification, refs: [] }] : [])];
  let mentions = 0, naming = 0, outside = 0, words = 0, known = 0, unshown = 0, borrowed = 0, collisions = 0, bare = 0, drifted = 0, last = null, refused = null;
  for (const part of parts) {
    const text = readable(part.text), found = namedProvisions(text), block = part.path.startsWith('$.blocks'), lists = provisionMentions(text);
    const cited = part.refs.map(ref => byId.get(packet?.reference_map?.[ref]?.evidence_id)).filter(Boolean);
    words += (String(part.text).match(WORD_EN) || []).length;
    bare += [...text.matchAll(BARE_SUB)].filter(match => !lists.some(item => item.start <= match.index && match.index < item.end)).length;
    if (found.length && block) naming++;
    for (const mention of found) {
      const act = namedAct(text, mention.start, names), how = passage => gives(passage, mention, act);
      const kind = cited.some(passage => how(passage) === 'label') ? 'a' : cited.some(how) ? 'b' : passages.some(passage => !cited.includes(passage) && how(passage)) ? 'c'
        : among(compared, mention) ? 'v' : among(elsewhere, mention) ? 's' : among(before, mention) ? 'p' : !block && (among(earlier, mention) || numbered(asked, mention.section)) ? 'q' : 'd';
      // A provision that only a cited guide, article, page or record mentions: that source's reference, not an act's text.
      const other = kind === 'b' && !cited.some(passage => passage.legal && how(passage));
      // The named act's passage is in the evidence but not cited, and a cited passage of another act has the same number.
      const collision = kind === 'c' && Boolean(act?.acts.size) && cited.some(passage => passage.place && !act.acts.has(passage.act) && holds(passage.place, mention));
      // The instruction lets the provision stand alone after its act was named, "until another act has been named in
      // between": a reader takes a bare provision as the act named last. One that only a passage of another act gives
      // is counted and listed, whatever its kind. Its kind is not changed: carrying the act forward would make every
      // answer that changes act without saying so kind d (first review's note, 10.10.2026).
      const adrift = !act && Boolean(last) && 'abc'.includes(kind) && !(kind === 'c' ? passages : cited).some(passage => last.acts.has(passage.act) && how(passage));
      if (act) last = act;
      mentions++; kinds[kind]++; if (!block) outside++; if (act?.acts.size) known++; if (act && !act.acts.size) unshown++; if (other) borrowed++; if (collision) collisions++; if (adrift) drifted++;
      if ((kind !== 'a' || adrift) && items.length < ITEMS) items.push({ at: part.path, provision: shown(mention), kind, act: act?.acts.size ? 'named' : act ? 'not_shown' : 'unnamed',
        ...(other ? { source: 'not_an_act' } : {}), ...(collision ? { collision: true } : {}), ...(adrift ? { after_other_act: true } : {}) });
      if (refuse.includes(kind)) refused ??= { path: part.path, text: part.text, provision: shown(mention) };
    }
  }
  // labelled: the evidence passages that have a provision label; blocks_naming: the blocks that name a provision;
  // act_named: the mentions whose act is one of the evidence; act_not_shown: those that name an act it does not hold;
  // from_other_sources: kind b mentions no cited act gives; collisions: kind c beside a cited passage of another act
  // with the same number; after_other_act: mentions without an act that the act named last does not give;
  // word_forms: English "section N"; bare_subsections: a subsection without its section.
  const audit = { version: PROVISION_CHECK_VERSION, labelled: passages.filter(passage => passage.place).length, mentions, blocks_naming: naming, kinds,
    outside_blocks: outside, act_named: known, act_not_shown: unshown, from_other_sources: borrowed, collisions, after_other_act: drifted, word_forms: words, bare_subsections: bare, items };
  return { audit, refused };
}

/** The error a refused answer stops the turn with: the turn ends answer_rejected, as after an invalid reference. Not
 *  reached while REFUSED_KINDS is empty. */
export function provisionRefusal({ audit, refused }) {
  return Object.assign(new Error('unsupported_provision'), { code: 'unsupported_provision', status: 422,
    validation: { valid: false, code: 'unsupported_provision', path: refused.path, received: boundedDraft(refused.text), provision: refused.provision, provisions: audit } });
}
