import { parseDocument } from "htmlparser2";

// Reads the staff list off a municipality's official contact page: every person with the role, department, phone and
// e-mail the page shows next to the name. It does not need to know the people in advance; the contact register is
// compared with the result afterwards.
//
// Three ways a page shows a person, tried in this order:
//   1. a staff card of the site platforms most municipalities share (and of Tartu), with or without an e-mail;
//   2. the largest piece of the page that holds exactly one e-mail address (a table row, a list item, a card of an
//      unknown platform), and pieces with the same markup that show no e-mail;
//   3. plain text where people follow each other line by line: a person runs from the name to the next name.

const SKIPPED_TAGS = new Set(["script", "style", "svg", "noscript", "template", "nav", "footer", "head", "iframe", "select"]);
const BLOCK_TAGS = new Set(["address", "article", "aside", "blockquote", "br", "caption", "dd", "details", "div", "dl", "dt", "figcaption",
  "figure", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "ol", "p", "section", "summary", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "ul"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "caption"]);
// The staff card of the two shared site platforms and of Tartu: a record whether or not it shows an e-mail.
const STAFF_CARD_CLASSES = ["kontaktimuster", "vp-employee", "entry-contact"];
// Where bold or italic text begins and ends inside a line: "<b>role</b> name" has no other separator.
const EMPHASIS_TAGS = new Set(["strong", "b", "em", "i"]);
const EDGE = "␞";
const MAX_RECORD_TEXT = 2500;
const MAX_TRAILING_BLOCKS = 4;
const MAX_TRAILING_TEXT = 700;
const MAX_FLAT_TEXT = 60000;
const MIN_SHARED_MARKUP = 3;
const EMAIL = /^[\p{L}0-9._%+-]+@[\p{L}0-9-]+(?:\.[\p{L}0-9-]+)*\.[\p{L}]{2,}$/u;
const EMAIL_IN_TEXT = /([\p{L}0-9._%+-]+)\s*(?:@|\[at\]|\(at\)|\[ät\]|\(ät\))\s*([\p{L}0-9-]+(?:\.[\p{L}0-9-]+)*\.[\p{L}]{2,})/giu;
const PHONE_IN_TEXT = /(?<![\d.])(?:\+?372[\s()-]*)?\d(?:[\s()-]*\d){6,7}(?![\d.])/gu;
const MARK = /⟦(email|tel|h):?([^⟧]*)⟧/gu;
// A person's name: two to four words that each start with a capital letter (name particles may be lower case).
const NAME = /^\p{Lu}[\p{L}'’-]*\.?(?:\s+(?:(?:von|van|de|der|af)\s+)?\p{Lu}[\p{L}'’-]*\.?){1,3}$/u;
// Words that look like a name by their capitals and are not one.
const NOT_A_NAME = /(?:^|\s)(?:vald|valla|linn|linna|vallavalitsus|linnavalitsus|valitsus|volikogu|osakond|osakonna|keskus|teenistus|amet|kool|lasteaed|raamatukogu|kontakt|kontaktid|kontaktisik|telefon|tel|mob|mobiil|e-post|epost|e-mail|email|aadress|vastuvõtt|vastuvõtuajad|üldinfo|eesti|tallinn|tallinna|linnaosa|sotsiaalabi|päevakeskus|hooldekodu|struktuur|ametnikud|teenistujad|töötajad|teeninduspiirkond|tänav|tn|mnt|pst|maja|kabinet|ruum)(?:$|\s)/iu;
const LABEL_LINE = /^(?:teeninduspiirkon\p{L}*|piirkon\p{L}*|tegevusvaldkon\p{L}*|tööülesan\p{L}*|aadress|asukoht|vastuvõt\p{L}*|tel|telefon|mob|mobiil\p{L}*|e-post|epost|e-mail|email|tööaeg|lahtiolek\p{L}*)\s*[:.]/iu;
// Labelled lines that say what the person deals with; kept in the notes.
const INFO_LINE = /^(?:teeninduspiirkon\p{L}*|piirkon\p{L}*|tegevusvaldkon\p{L}*|tööülesan\p{L}*)\s*:/iu;
// A page that shows one person as a form: "Ametikoht" and the role as its value, on the same line or the next.
const ROLE_LABEL = /^(?:ametikoht|ametinimetus|amet|roll)\s*(?::\s*|$)/iu;
const FIRST_NAME_LABEL = /^eesnimi\s*(?::\s*|$)/iu;
const LAST_NAME_LABEL = /^(?:perekonnanimi|perenimi)\s*(?::\s*|$)/iu;
const FIELD_LABEL = /^(?:eesnimi|perekonnanimi|perenimi|nimi|ametikoht|ametinimetus|amet|roll|asutus|üksus|struktuuriüksus|osakond|telefon|lauatelefon|mobiil|mobiiltelefon|e-post|e-mail|aadress|kabinet|ruum|haridus|eriala|vastuvõtuaeg|vastuvõtuajad|tööülesanded|asendaja|ametijuhend)\s*:?$/iu;
const ROLE_WORD = /(?:spetsialist|juhataja|nõunik|juht|töötaja|ametnik|sekretär|koordinaator|konsultant|direktor|vanem|pidaja|korraldaja|assistent|inspektor|ökonomist|raamatupidaja|registripidaja|jurist|arst|hooldaja|abistaja|tugiisik|psühholoog|pedagoog|juhendaja|haldur|esimees)$/iu;
// The social field as the municipalities write it: in the role itself or in the department heading above the person.
const SOCIAL_FIELD = /sotsiaal|lastekaits|hoolekan|eestkost|puue|puude|erivajadus|eaka|tugiisik|koduteenus|koduhooldus|toimetulek|heaolu|võlanõust|hooldustöötaja|hooldaja|tegevusjuhendaja|isiklik(?:u)? abistaja|päevakeskus|perenõust|peretöötaja|(?<![\p{L}])hooldusjuht|(?<![\p{L}])hoolduskoordinaator/iu;

// A support job inside a social department (Narva's social welfare office lists its accountants) is not social work.
const SUPPORT_ROLE = /raamatupida|finants|ökonomist|palgaarvest|infotehnoloog|(?<![\p{L}])it[- ]|koristaja|autojuht|majahoidja|remonditöö|haldusjuht|majandusjuhataja|personalispetsialist|personalijuht/iu;
// The page says the person is not at work now.
const AWAY = /töösuhe\s+(?:on\s+)?peatatud|teenistussuhe\s+(?:on\s+)?peatatud|lapsehoolduspuhkusel|ajutiselt\s+(?:töölt\s+)?eemal/iu;

const squeeze = value => String(value || "").replace(/[\s ​]+/gu, " ").trim();
const classes = node => String(node.attribs?.class || "").split(/\s+/u).filter(Boolean);
const fold = value => String(value || "").normalize("NFD").replace(/\p{M}+/gu, "").toLocaleLowerCase("et");
const isElement = node => node?.type === "tag";

function decodeCloudflare(value) {
  const hex = String(value || "").trim();
  if (!/^[a-f0-9]+$/iu.test(hex) || hex.length < 4 || hex.length % 2) return null;
  const key = Number.parseInt(hex.slice(0, 2), 16);
  let text = "";
  for (let at = 2; at < hex.length; at += 2) text += String.fromCharCode(Number.parseInt(hex.slice(at, at + 2), 16) ^ key);
  return text;
}

function rot13(value) {
  return String(value || "").replace(/[a-z]/giu, letter => {
    const base = letter <= "Z" ? 65 : 97;
    return String.fromCharCode(base + ((letter.charCodeAt(0) - base + 13) % 26));
  });
}

function decodeUri(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function validEmail(value) {
  const email = squeeze(value).replace(/\s*(?:\[at\]|\(at\)|\[ät\]|\(ät\))\s*/giu, "@").toLocaleLowerCase("et");
  return EMAIL.test(email) ? email : null;
}

function plainText(node) {
  if (node.type === "text") return node.data;
  if (!isElement(node) || SKIPPED_TAGS.has(node.name)) return "";
  return (node.children || []).map(plainText).join("");
}

/** The e-mail an element itself carries, in any of the forms the municipal platforms hide it from robots. */
function emailOfElement(node) {
  const attrs = node.attribs || {};
  const href = attrs.href || "";
  // A protected address may itself be percent-encoded ("vikstr%c3%b6m").
  if (attrs["data-cfemail"]) return validEmail(decodeUri(decodeCloudflare(attrs["data-cfemail"]) || ""));
  const protectedLink = /\/email-protection#([a-f0-9]+)/iu.exec(href);
  if (protectedLink) return validEmail(decodeUri(decodeCloudflare(protectedLink[1]) || ""));
  if (attrs["data-enc-email"]) return validEmail(rot13(attrs["data-enc-email"].replace(/\s*\[at\]\s*/giu, "@")));
  if (/^mailto:/iu.test(href)) {
    // The address the reader sees wins: a card copied from another person can keep the old link under the new text.
    const email = validEmail(plainText(node)) || validEmail(decodeUri(href.slice(7).split("?")[0]));
    if (email) return email;
  }
  // Email Encoder Bundle: the address is written backwards in visible pieces, with hidden filler between them.
  if (classes(node).includes("eeb-rtl")) {
    const pieces = [];
    const collect = child => {
      if (child.type === "text") pieces.push(child.data);
      else if (isElement(child) && !classes(child).includes("eeb-nodis")) (child.children || []).forEach(collect);
    };
    (node.children || []).forEach(collect);
    return validEmail([...pieces.join("")].reverse().join(""));
  }
  return null;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/gu, "");
  const local = digits.startsWith("372") && digits.length >= 10 ? digits.slice(3) : digits;
  return local.length >= 7 && local.length <= 8 ? local : null;
}

/** The element's text as lines, one per block; e-mails, tel: links and headings are kept as marks inside the lines. */
function linesOf(node) {
  const lines = [];
  let buffer = "";
  const flush = () => { const text = squeeze(buffer); if (text) lines.push(text); buffer = ""; };
  const read = child => {
    if (child.type === "text") { buffer += child.data; return; }
    if (!isElement(child) || SKIPPED_TAGS.has(child.name) || classes(child).includes("eeb-nodis")) return;
    const email = emailOfElement(child);
    if (email) { buffer += ` ⟦email:${email}⟧ `; return; }
    const href = child.attribs?.href || "";
    // The number the reader sees wins over the link behind it; the link is used when the text shows no number.
    if (/^tel:/iu.test(href) && !plainText(child).match(PHONE_IN_TEXT)) { const phone = normalizePhone(decodeUri(href.slice(4))); if (phone) buffer += ` ⟦tel:${phone}⟧ `; }
    const block = BLOCK_TAGS.has(child.name);
    if (block) flush();
    if (HEADING_TAGS.has(child.name)) buffer += "⟦h⟧ ";
    const emphasis = EMPHASIS_TAGS.has(child.name);
    if (emphasis) buffer += EDGE;
    (child.children || []).forEach(read);
    if (emphasis) buffer += EDGE;
    if (block) flush();
  };
  read(node);
  flush();
  return lines;
}

const withoutMarks = line => squeeze(line.replace(MARK, " ").replace(EMAIL_IN_TEXT, " ").replace(/\[email\s*protected\]/giu, " "));
const plain = text => squeeze(String(text || "").replaceAll(EDGE, " "));
const looksInstitutional = name => NOT_A_NAME.test(name) || name.split(/\s+/u).some(word => word.length >= 8 && ROLE_WORD.test(word));

/** A person's name in a line: the line itself, or one part of "role - name", "name, role", "contact: name". */
function nameFrom(line) {
  const marked = squeeze(line).replace(/^[\s•·*␞-]+/u, "");
  if (!marked || marked.length > 200) return null;
  // First the line as written; then also split where bold or italic text begins or ends ("<b>role</b> name").
  for (const text of [plain(marked), marked]) {
    const parts = text.split(/\s+[-–—|]\s+|\s*[,;:()␞]\s*/u).map(squeeze).filter(Boolean);
    for (const [at, part] of parts.entries()) {
      if (part.length > 60 || /\d|@/u.test(part) || !NAME.test(part)) continue;
      if (part.split(/\s+/u).filter(word => word.replace(/[^\p{L}]/gu, "").length >= 2).length < 2) continue;
      return { name: part, rest: parts.filter((_, other) => other !== at).join(", ") };
    }
  }
  return null;
}

function matchesEmail(name, emails) {
  const words = fold(name).split(/[^a-z]+/u).filter(word => word.length >= 3);
  return emails.some(email => { const local = fold(email.split("@")[0]); return words.some(word => local.includes(word)); });
}

// A role has no numbers outside brackets ("spetsialist (0,5 kohta)" is a role, "Veriora E 13-16" is reception hours)
// and is not the label of a form field.
function isRoleText(text) {
  return text.length >= 3 && text.length <= 140 && !/@/u.test(text) && !/\d/u.test(text.replace(/\([^)]*\)/gu, " ")) && /\p{Ll}{3}/u.test(text)
    && !LABEL_LINE.test(text) && !FIELD_LABEL.test(text) && !AWAY.test(text);
}

/** One person out of the lines of one record; null when the lines name nobody. */
function personFromLines(lines) {
  const emails = new Set(), phones = new Set();
  for (const line of lines) {
    for (const mark of line.matchAll(MARK)) {
      if (mark[1] === "email") emails.add(mark[2]);
      if (mark[1] === "tel") phones.add(mark[2]);
    }
    for (const match of line.replace(MARK, " ").matchAll(EMAIL_IN_TEXT)) { const email = validEmail(`${match[1]}@${match[2]}`); if (email) emails.add(email); }
  }
  const texts = lines.map(withoutMarks).filter(text => plain(text));
  for (const text of texts) for (const match of plain(text).matchAll(PHONE_IN_TEXT)) { const phone = normalizePhone(match[0]); if (phone) phones.add(phone); }
  const emailList = [...emails];
  const candidates = texts.map((text, at) => ({ at, ...(nameFrom(text) || {}) })).filter(candidate => candidate.name);
  // A form with the first name and the surname in separate fields.
  const field = label => { const at = texts.findIndex(text => label.test(plain(text))); return at < 0 ? null : plain(texts[at]).replace(label, "") || plain(texts[at + 1] || ""); };
  const fullName = [field(FIRST_NAME_LABEL), field(LAST_NAME_LABEL)];
  if (fullName.every(Boolean) && NAME.test(fullName.join(" "))) candidates.unshift({ at: -1, name: fullName.join(" "), rest: "" });
  const chosen = candidates.find(candidate => matchesEmail(candidate.name, emailList)) || candidates.find(candidate => !looksInstitutional(candidate.name));
  if (!chosen) return null;
  const roleTexts = texts.map((text, at) => ({ at, text: plain(text), named: Boolean(nameFrom(text)) })).filter(({ at, text, named }) => at !== chosen.at && isRoleText(text) && !named);
  const after = roleTexts.find(({ at }) => at > chosen.at);
  const before = [...roleTexts].reverse().find(({ at }) => at < chosen.at);
  // A labelled role wins: "Ametikoht: sotsiaaltöö spetsialist", or the label on one line and the role on the next.
  let labelled = null;
  for (const [at, text] of texts.map(plain).entries()) {
    if (!ROLE_LABEL.test(text)) continue;
    const value = text.replace(ROLE_LABEL, "") || plain(texts[at + 1] || "");
    if (isRoleText(value)) { labelled = value; break; }
  }
  const role = labelled || (chosen.rest && isRoleText(chosen.rest) ? chosen.rest : null) || after?.text || before?.text || null;
  const notes = texts.map(plain).filter((text, at) => at !== chosen.at && text !== role && (INFO_LINE.test(text) || roleTexts.some(item => item.at === at)))
    .join("; ").slice(0, 300) || null;
  return { name: chosen.name, role, emails: emailList, phones: [...phones], notes, away: texts.some(text => AWAY.test(plain(text))) };
}

/**
 * @param {string} html the official page as fetched
 * @returns {{ people: Array<{ name: string, role: string|null, section: string|null, emails: string[], phones: string[], notes: string|null, away: boolean }>,
 *   emailsOnPage: number, recordsWithoutName: number }}
 */
export function extractStaffFromHtml(html) {
  const root = parseDocument(String(html || ""), { decodeEntities: true });
  const emailNodes = [];   // { node, email } in document order
  const headings = [];     // { order, text, node }
  const anchors = [];      // name paragraphs of the WordPress platform
  const order = new Map();
  let counter = 0;
  const visit = (node, insideEmail) => {
    if (node.type === "text") {
      if (insideEmail || !isElement(node.parent)) return;
      for (const match of node.data.matchAll(EMAIL_IN_TEXT)) {
        const email = validEmail(`${match[1]}@${match[2]}`);
        if (email) emailNodes.push({ node: node.parent, email });
      }
      return;
    }
    if (!isElement(node) && node.type !== "root") return;
    if (isElement(node)) {
      if (SKIPPED_TAGS.has(node.name)) return;
      order.set(node, counter++);
      if (HEADING_TAGS.has(node.name)) headings.push({ order: order.get(node), text: squeeze(plainText(node)), node });
      if (node.name === "p" && classes(node).includes("ankur")) anchors.push(node);
      if (!insideEmail) {
        const email = emailOfElement(node);
        if (email) { emailNodes.push({ node, email }); insideEmail = true; }
      }
    }
    for (const child of node.children || []) visit(child, insideEmail);
  };
  visit(root, false);

  // Which e-mail addresses each element holds, to climb from an address to its record.
  const held = new Map();
  for (const { node, email } of emailNodes) {
    for (let at = node; isElement(at); at = at.parent) {
      if (!held.has(at)) held.set(at, new Set());
      held.get(at).add(email);
    }
  }
  const records = new Set();
  const recordOf = node => { for (let at = node; at; at = at.parent) if (records.has(at)) return at; return null; };
  const holdsRecord = node => [...records].some(record => { for (let at = record.parent; at; at = at.parent) if (at === node) return true; return false; });

  // 1. Staff cards of the shared platforms.
  const findCards = node => {
    if (!isElement(node) && node.type !== "root") return;
    if (isElement(node)) {
      if (SKIPPED_TAGS.has(node.name)) return;
      if (STAFF_CARD_CLASSES.some(name => classes(node).includes(name))) { records.add(node); return; }
    }
    for (const child of node.children || []) findCards(child);
  };
  findCards(root);
  for (const anchor of anchors) {
    if (recordOf(anchor) || !nameFrom(squeeze(plainText(anchor)))) continue;
    let card = anchor.parent;
    while (isElement(card) && !classes(card).includes("wp-block-columns")) card = card.parent;
    if (isElement(card) && !holdsRecord(card)) records.add(card);
  }

  // 2. The largest piece with exactly one e-mail address, and pieces of the same markup without one.
  const byEmail = new Set();
  for (const { node } of emailNodes) {
    if (recordOf(node)) continue;
    let record = node;
    // A table row or list item that names a person is that person's record, also when no other row shows an e-mail.
    const namesPerson = element => ["tr", "li"].includes(element.name) && linesOf(element).some(line => nameFrom(withoutMarks(line)));
    while (!namesPerson(record) && isElement(record.parent) && !["html", "body", "main"].includes(record.parent.name) && !holdsRecord(record.parent)
      && held.get(record.parent).size === 1 && squeeze(plainText(record.parent)).length <= MAX_RECORD_TEXT) record = record.parent;
    records.add(record);
    byEmail.add(record);
  }
  const markup = node => `${node.name}|${classes(node).filter(name => !/\d/u.test(name)).sort().join(" ")}`;
  const shared = new Map();
  for (const record of byEmail) shared.set(markup(record), (shared.get(markup(record)) || 0) + 1);
  const staffTables = new Set();
  for (const record of byEmail) if (record.name === "tr") for (let at = record.parent; at; at = at.parent) if (at.name === "table") { staffTables.add(at); break; }
  const more = [];
  const seek = node => {
    if (!isElement(node) && node.type !== "root") return;
    if (isElement(node)) {
      if (SKIPPED_TAGS.has(node.name) || records.has(node)) return;
      if (!held.has(node)) {
        const key = markup(node);
        const sameRow = node.name === "tr" && [...staffTables].some(table => { for (let at = node.parent; at; at = at.parent) if (at === table) return true; return false; });
        const sameShape = node.name !== "tr" && key.length > node.name.length + 1 && (shared.get(key) || 0) >= MIN_SHARED_MARKUP;
        if (sameRow || sameShape) { more.push(node); return; }
      }
    }
    for (const child of node.children || []) seek(child);
  };
  seek(root);
  for (const node of more) if (!holdsRecord(node)) records.add(node);

  const sectionAt = (start, skipInside) => {
    let section = null;
    for (const heading of headings) {
      if (heading.order >= start) break;
      if (heading.text && !(skipInside && recordOf(heading.node))) section = heading.text;
    }
    return section;
  };
  // Plain paragraphs right after a person's record belong to that person ("Mobiiltelefon: ...", "Kabinet ..." on
  // Tallinn's district pages), up to the next record, heading, e-mail or name.
  const trailingLines = record => {
    const lines = [];
    let taken = 0, length = 0;
    for (let next = record.next; next && taken < MAX_TRAILING_BLOCKS; next = next.next) {
      if (next.type === "text") { if (squeeze(next.data)) break; continue; }
      if (!isElement(next) || SKIPPED_TAGS.has(next.name)) continue;
      if (records.has(next) || holdsRecord(next) || held.has(next) || HEADING_TAGS.has(next.name)) break;
      const own = linesOf(next);
      if (own.some(line => { const named = LABEL_LINE.test(plain(withoutMarks(line))) ? null : nameFrom(withoutMarks(line)); return named && !looksInstitutional(named.name); })) break;
      length += own.join(" ").length;
      if (length > MAX_TRAILING_TEXT) break;
      lines.push(...own);
      taken += 1;
    }
    return lines;
  };
  const people = [];
  const nameless = [];
  for (const record of [...records].sort((left, right) => order.get(left) - order.get(right))) {
    const own = linesOf(record);
    const person = personFromLines(byEmail.has(record) && !["tr", "li"].includes(record.name) && personFromLines(own) ? [...own, ...trailingLines(record)] : own);
    if (person) people.push({ ...person, section: sectionAt(order.get(record), true), at: order.get(record) });
    else nameless.push(record);
  }

  // 3. Plain text: the smallest block around a nameless e-mail that holds several addresses is read line by line.
  const flatBlocks = new Set();
  for (const record of nameless) {
    if (!held.has(record)) continue;
    let block = record.parent;
    while (isElement(block) && !(BLOCK_TAGS.has(block.name) && block.name !== "br" && held.get(block)?.size >= 2)) block = block.parent;
    if (isElement(block) && !["html", "body"].includes(block.name) && squeeze(plainText(block)).length <= MAX_FLAT_TEXT) flatBlocks.add(block);
  }
  const known = new Set(people.flatMap(person => person.emails));
  let recordsWithoutName = nameless.length;
  for (const block of [...flatBlocks].filter(block => ![...flatBlocks].some(other => other !== block && (() => { for (let at = block.parent; at; at = at.parent) if (at === other) return true; return false; })()))) {
    let section = sectionAt(order.get(block), false);
    let current = null;
    const groups = [];
    for (const line of linesOf(block)) {
      if (line.includes("⟦h⟧")) { section = plain(withoutMarks(line)) || section; current = null; continue; }
      // A line that begins with a label ("Teeninduspiirkond: Uus Maailm, ...") lists places or hours, not a person.
      const named = LABEL_LINE.test(plain(withoutMarks(line))) ? null : nameFrom(withoutMarks(line));
      if (named && !looksInstitutional(named.name)) { current = { lines: [line], section }; groups.push(current); } else if (current) current.lines.push(line);
    }
    for (const group of groups) {
      const person = personFromLines(group.lines);
      if (!person || (!person.emails.length && !person.phones.length) || person.emails.some(email => known.has(email))) continue;
      person.emails.forEach(email => known.add(email));
      people.push({ ...person, section: group.section, at: order.get(block) });
      recordsWithoutName = Math.max(0, recordsWithoutName - 1);
    }
  }
  people.sort((left, right) => left.at - right.at);
  return { people: people.map(({ at: _at, ...person }) => person), emailsOnPage: new Set(emailNodes.map(item => item.email)).size, recordsWithoutName };
}

/** A person works in the social field when the role says so or the department heading above the person does,
 * unless the role is a support job (an accountant of the social department is not a social worker). */
export function isSocialFieldStaff(person) {
  if (SUPPORT_ROLE.test(person?.role || "")) return false;
  return SOCIAL_FIELD.test(person?.role || "") || SOCIAL_FIELD.test(person?.section || "");
}
