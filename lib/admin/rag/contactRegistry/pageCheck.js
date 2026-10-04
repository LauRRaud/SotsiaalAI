import { extractStaffFromHtml, isSocialFieldStaff } from "../../../serviceMap/kovStaffExtract.js";

const SOCIAL_CONTACT_TYPE = "KOV_SOCIAL_CONTACT";

// What the weekly contact check reads off one official page: for every register contact that points to the page,
// whether the page confirms it. Pure functions; the database work is in databaseService.js.

function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLocaleLowerCase("et")
    .replace(/[^\p{Letter}\p{Number}@.+'’-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;|&#38;/giu, "&")
    .replace(/&quot;|&#34;/giu, "\"")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;|&#60;/giu, "<")
    .replace(/&gt;|&#62;/giu, ">");
}

function decodeCloudflareEmail(value) {
  const encoded = String(value || "").trim();
  if (!/^[a-f0-9]+$/iu.test(encoded) || encoded.length < 4) return null;
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let email = "";
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }
  return email.includes("@") ? email.toLocaleLowerCase("et") : null;
}

function cloudflareEmails(html) {
  const encoded = [
    ...String(html || "").matchAll(/data-cfemail=["']([a-f0-9]+)["']/giu),
    ...String(html || "").matchAll(/\/email-protection#([a-f0-9]+)/giu)
  ];
  return Array.from(new Set(encoded.map(match => decodeCloudflareEmail(match[1])).filter(Boolean)));
}

function rot13(value) {
  return String(value || "").replace(/[a-z]/giu, letter => {
    const code = letter.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(base + ((code - base + 13) % 26));
  });
}

function encodedAttributeEmails(html) {
  return Array.from(String(html || "").matchAll(/data-enc-email=["']([^"']+)["']/giu))
    .map(match => rot13(decodeHtml(match[1]).replace(/\s*\[at\]\s*/giu, "@")))
    .filter(email => email.includes("@"))
    .map(email => email.toLocaleLowerCase("et"));
}

function injectDecodedEmailText(html) {
  return String(html || "")
    .replace(/(<a\b[^>]*href=["']mailto:([^"'?#]+)(?:\?[^"']*)?["'][^>]*>)/giu, (tag, _whole, encoded) => {
      try {
        const email = decodeHtml(decodeURIComponent(encoded)).trim().toLocaleLowerCase("et");
        return email.includes("@") ? `${tag}${email} ` : tag;
      } catch {
        return tag;
      }
    })
    .replace(/(<a\b[^>]*href=["']tel:([^"'?]+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      try {
        const phone = decodeHtml(decodeURIComponent(encoded)).trim();
        return phone ? `${tag}${phone} ` : tag;
      } catch {
        return tag;
      }
    })
    .replace(/(<[^>]*data-cfemail=["']([a-f0-9]+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = decodeCloudflareEmail(encoded);
      return email ? `${tag}${email} ` : tag;
    })
    .replace(/(<[^>]*href=["'][^"']*\/email-protection#([a-f0-9]+)[^"']*["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = decodeCloudflareEmail(encoded);
      return email ? `${tag}${email} ` : tag;
    })
    .replace(/(<[^>]*data-enc-email=["']([^"']+)["'][^>]*>)/giu, (tag, _whole, encoded) => {
      const email = rot13(decodeHtml(encoded).replace(/\s*\[at\]\s*/giu, "@")).toLocaleLowerCase("et");
      return email.includes("@") ? `${tag}${email} ` : tag;
    });
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function contactTitleOccurrences(normalizedPage = "", contacts = []) {
  const occurrences = [];
  for (const entry of contacts) {
    const title = normalizeText(entry?.title);
    if (!entry?.id || !title) continue;
    const pattern = new RegExp(`(?<![\\p{Letter}\\p{Number}'’\\-])${escapeRegex(title)}(?![\\p{Letter}\\p{Number}'’\\-])`, "gu");
    for (const match of normalizedPage.matchAll(pattern)) {
      occurrences.push({
        id: entry.id,
        index: match.index || 0,
        end: (match.index || 0) + String(match[0] || "").length
      });
    }
  }
  return occurrences.sort((left, right) => left.index - right.index || left.end - right.end);
}

function pageSignals(buffer, contacts = []) {
  const html = buffer.toString("utf8");
  const htmlWithDecodedEmails = injectDecodedEmailText(html);
  const decodedEmails = Array.from(new Set([
    ...cloudflareEmails(html),
    ...encodedAttributeEmails(html)
  ]));
  const text = decodeHtml(htmlWithDecodedEmails)
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<svg[\s\S]*?<\/svg>/giu, " ")
    .replace(/<(?:br|hr)\b[^>]*>/giu, "\n")
    .replace(/<\/(?:address|article|aside|dd|div|dl|dt|figcaption|footer|h[1-6]|header|li|main|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul)>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[\t\f\v ]+/gu, " ")
    .replace(/\s*\r?\n\s*/gu, "\n")
    .replace(/\n{2,}/gu, "\n")
    .trim();
  const normalized = normalizeText(text);
  return {
    normalized,
    lowercase: `${html}\n${text}\n${decodedEmails.join("\n")}`.toLocaleLowerCase("et"),
    phones: new Set(pagePhoneNumbers(`${html}\n${text}`)),
    contactOccurrences: contactTitleOccurrences(normalized, contacts)
  };
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("372") && (digits.length === 10 || digits.length === 11)) {
    return digits.slice(3);
  }
  return digits;
}

function phoneNumbers(value) {
  return String(value || "")
    .split(/\s*(?:\/|,|;|\||\bor\b|\band\b|\bja\b|\bvoi\b|\bvõi\b|(?:^|\s)и(?:\s|$))\s*/giu)
    .map(normalizePhoneDigits)
    .filter(digits => digits.length >= 7 && digits.length <= 8);
}

function pagePhoneNumbers(value) {
  return Array.from(String(value || "").matchAll(/(?<!\d)(?:\+?372[\s()-]*)?\d(?:[\s()-]*\d){6,7}(?!\d)/gu))
    .map(match => normalizePhoneDigits(match[0]))
    .filter(digits => digits.length >= 7 && digits.length <= 8);
}

function contactRoleFromDescription(value = "") {
  const description = String(value || "");
  const role = description.match(/^\s*Roll:\s*(.+)$/imu);
  if (role) return clean(role[1]);
  const department = description.match(/^\s*Osakond:\s*(.+)$/imu);
  return clean(department?.[1]);
}

function contactWindows(entry, page) {
  const occurrences = page.contactOccurrences.filter(occurrence => occurrence.id === entry.id);
  return occurrences.map(occurrence => {
    const nextOther = page.contactOccurrences
      .find(candidate => candidate.id !== entry.id && candidate.index >= occurrence.end);
    // In unstructured HTML only the name-to-next-name range is relation-safe.
    // Fields before the name may still belong to the previous person; if a site
    // renders role/contact data first, keep the row in review instead of guessing.
    const start = occurrence.index;
    const end = Math.min(nextOther?.index || page.normalized.length, occurrence.end + 640);
    return page.normalized.slice(start, end);
  });
}

function entrySignals(entry, page, staff = []) {
  const title = normalizeText(entry.title);
  const email = clean(entry.email)?.toLocaleLowerCase("et") || null;
  const rawPhone = clean(entry.phone);
  const phones = phoneNumbers(rawPhone);
  const phoneUnparseable = Boolean(rawPhone && !phones.length);
  const role = normalizeText(contactRoleFromDescription(entry.description));
  const titleSeen = Boolean(title && page.normalized.includes(title));
  const pageEmailSeen = !email || page.lowercase.includes(email);
  const pagePhoneSeen = !phoneUnparseable && (!phones.length || phones.every(phone => page.phones.has(phone)));
  const windows = contactWindows(entry, page);
  const tupleWindow = windows.find(window => {
    const windowPhones = new Set(pagePhoneNumbers(window));
    return !phoneUnparseable &&
      window.includes(title) &&
      (!email || window.includes(normalizeText(email))) &&
      (!phones.length || phones.every(phone => windowPhones.has(phone))) &&
      (!role || window.includes(role));
  });
  const identityWindows = role
    ? windows.filter(window => window.includes(title) && window.includes(role))
    : [];
  const emailSeen = !email || identityWindows.some(window => window.includes(normalizeText(email)));
  const phoneSeen = !phoneUnparseable && (!phones.length || identityWindows.some(window => {
    const windowPhones = new Set(pagePhoneNumbers(window));
    return phones.every(phone => windowPhones.has(phone));
  }));
  const roleSeen = !role || windows.some(window => window.includes(role));
  const identityWindow = identityWindows[0];
  const stronglyMissing = !titleSeen && (!email || !pageEmailSeen) && (!phones.length || !pagePhoneSeen);
  const reasons = [];
  if (!titleSeen) reasons.push("contact_name_not_found");
  if (!emailSeen) reasons.push("email_not_found");
  if (phoneUnparseable) reasons.push("phone_unparseable");
  else if (!phoneSeen) reasons.push("phone_not_found");
  if (!roleSeen) reasons.push("contact_role_not_found");
  if (titleSeen && !tupleWindow) reasons.push("contact_tuple_not_confirmed");
  const staffed = staffSignals(entry, staff);
  if (staffed) {
    // The page names this person in the staff list: the person's own record decides the phone, the e-mail and the
    // role. The text window above can take a neighbour's number or role for the person's own; the record cannot.
    // Only when the record shows no role at all does the window confirm the role, as before.
    const roleSame = staffed.role || (!staffed.roleShown && Boolean(identityWindow));
    // A social contact whose title is worded differently now ("lastekaitse vanemspetsialist" in the register,
    // "lastekaitse peaspetsialist" on the page) is still the same reachable person in the social field. The row is
    // confirmed and counted in roleDiffers, so the register's role can be brought up to date; a person the page no
    // longer shows in the social field is not confirmed as a social contact.
    const roleDiffers = !roleSame && entry.type === SOCIAL_CONTACT_TYPE && staffed.social;
    const roleConfirmed = roleSame || roleDiffers;
    const staffReasons = [];
    if (!staffed.email) staffReasons.push("email_not_found");
    if (phoneUnparseable) staffReasons.push("phone_unparseable");
    else if (!staffed.phone) staffReasons.push("phone_not_found");
    if (!roleConfirmed) staffReasons.push("contact_role_not_found");
    if (staffed.away) staffReasons.push("contact_away");
    const confirmed = staffed.phone && staffed.email && roleConfirmed && !staffed.away;
    if (!confirmed) staffReasons.push("contact_tuple_not_confirmed");
    return {
      verified: confirmed,
      identityVerified: roleConfirmed,
      phoneVerified: staffed.phone,
      emailVerified: staffed.email,
      stronglyMissing: false,
      reasons: staffReasons,
      decidedBy: "staff_record",
      roleDiffers: confirmed && roleDiffers
    };
  }
  return {
    verified: Boolean(tupleWindow),
    identityVerified: Boolean(identityWindow),
    phoneVerified: phoneSeen,
    emailVerified: emailSeen,
    stronglyMissing,
    reasons,
    decidedBy: "text_window"
  };
}

// The same person as the register row: the same name without diacritics, in either word order.
function staffNameKey(value) {
  return normalizeText(value).split(" ").filter(Boolean).sort().join(" ");
}

// The register's role against the person's record: the same text, or one inside the other as whole words
// ("sotsiaaltöö peaspetsialist" and "sotsiaaltöö peaspetsialist, asenduskoht"; not "linnapea" inside "abilinnapea").
// A register row that holds what the heading above the person says ("Koduhooldustöötajad") is confirmed by it.
// The page may write a compound apart ("eestkoste spetsialist") or leave its first part to the heading: under
// "Sotsiaalosakond" the page says "Osakonna juhataja" and the register "sotsiaalosakonna juhataja".
function staffRoleMatches(role, person) {
  if (!role) return true;
  const holds = (whole, part) => Boolean(part) && ` ${whole} `.includes(` ${part} `);
  const joined = value => value.replaceAll(" ", "");
  const shown = normalizeText(person.role);
  const heading = normalizeText(person.section);
  if (shown) {
    if (holds(shown, role) || (shown.length >= 6 && holds(role, shown)) || joined(shown) === joined(role)) return true;
    const lead = shown.length >= 6 && role.endsWith(shown) ? role.slice(0, -shown.length).trim() : "";
    if (lead.length >= 4 && joined(heading).includes(joined(lead))) return true;
  }
  return holds(heading, role) || heading.split(" ").some(word => word.length > role.length && word.startsWith(role) && word.length - role.length <= 3);
}

/**
 * The register row against the staff list read off its page (lib/serviceMap/kovStaffExtract.js). Returns null when
 * the page names no person of that name; the text window then decides alone, as it did before.
 */
function staffSignals(entry, staff = []) {
  const key = staffNameKey(entry.title);
  const people = key ? staff.filter(person => staffNameKey(person.name) === key) : [];
  if (!people.length) return null;
  const rawPhone = clean(entry.phone);
  const phones = phoneNumbers(rawPhone);
  const phoneUnparseable = Boolean(rawPhone && !phones.length);
  // The register may hold several addresses in one field; diacritics are folded on both sides.
  const emails = String(entry.email || "").split(/[\s,;]+/u).map(normalizeText).filter(email => email.includes("@"));
  const role = normalizeText(contactRoleFromDescription(entry.description));
  const judged = people.map(person => {
    const shownEmails = (person.emails || []).map(normalizeText);
    return {
      phone: !phoneUnparseable && phones.every(phone => (person.phones || []).includes(phone)),
      email: emails.every(email => shownEmails.includes(email)),
      role: staffRoleMatches(role, person),
      roleShown: Boolean(normalizeText(person.role)),
      social: isSocialFieldStaff(person),
      away: person.away === true
    };
  });
  return judged.find(item => item.phone && item.email && item.role && !item.away)
    || judged.find(item => item.phone && item.email)
    || judged.find(item => item.role)
    || judged[0];
}

/**
 * Every register contact of one page against that page.
 * @param {Buffer} body the page as fetched
 * @param {Array<object>} contacts the register rows whose official page this is
 */
export function contactPageChecks(body, contacts = []) {
  const page = pageSignals(body, contacts);
  // A page the staff extractor cannot read leaves the text-window check as it was.
  let staff = [];
  try {
    staff = extractStaffFromHtml(body.toString("utf8")).people;
  } catch {
    staff = [];
  }
  return {
    staffPeople: staff.length,
    checks: contacts.map(entry => ({ entry, ...entrySignals(entry, page, staff) }))
  };
}

