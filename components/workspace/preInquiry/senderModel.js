/**
 * Pöörduja eelpöördumise lehe otsused ILMA JSX-ita: mis vaade mis seisus pöördumisele
 * avaneb, mida saadetud pöördumise lugemisvaade näitab ja mida seal teha saab.
 *
 * MIKS OMA FAIL. Leht avas iga pöördumise muutmisvormina, ka saadetud ja vastu võetud oma:
 * inimene nägi teksti välja ja nuppu „Saada platvormis" pöördumisel, mille server muutmisele
 * suletud oli. Kuni otsus elas lehe joonistuse vahel, ei saanud seda testida.
 *
 * SERVERI REEGLID, mida siinne otsus järgib (lib/preInquiries.js):
 *  - muuta saab ainult saatmata pöördumist (`updatePreInquiry`: SENT, ARCHIVED, avatud ja
 *    parandusega asendatud pöördumine annavad 409);
 *  - tagasi võtta saab platvormis saadetud pöördumist, kuni saaja ei ole seda avanud
 *    (`recallPreInquiry`);
 *  - parandust saab saata pärast avamist (`sendPreInquiryCorrection`);
 *  - ühise ruumi saab avada pärast vastuvõtmist (`ensureRoomForPreInquiry`);
 *  - arhiveeritud saatmata pöördumise saab taasavada (`reopenPreInquiry`).
 * Tagasivõtmine ja parandus tehakse lehel „Minu jagamised"; siit viib sinna link.
 *
 * Seisu reegel on üks: lib/preInquirySenderState.js (sama, mida näitab Teekond).
 */

import { organizationOutcomeOf, preInquirySenderState, preInquirySenderTone } from "@/lib/preInquirySenderState";

export const SHARINGS_PATH = "/minu-jagamised";

/* Vaated, millest pöörduja lava koosneb, kui ta loeb saadetud pöördumist või vaatab loendit. */
export const SENT_FLOW_KEYS = Object.freeze(["sent_state", "sent_text", "saved"]);
export const LIST_FLOW_KEYS = Object.freeze(["saved"]);

const upper = (value) => String(value || "").toUpperCase();

/** Kas pöörduja saab pöördumist muuta (sama värav mis serveri `updatePreInquiry`). */
export function senderCanEdit(inquiry) {
  if (!inquiry) return true;
  const status = upper(inquiry.status);
  if (status === "SENT" || status === "ARCHIVED") return false;
  return !inquiry.openedAt && !inquiry.supersededById;
}

/** Mis vaates pöörduja pöördumine avaneb: `edit` (muutmine) või `read` (lugemisvaade). */
export function senderOpenMode(inquiry) {
  return senderCanEdit(inquiry) ? "edit" : "read";
}

/**
 * Lava sammud töövoo järgi. `sent` on lugemisvaade, `list` avaekraanilt avatud loend;
 * muu on koostamise töövoog (`journey` lisab Teekonna sammu, `hasDomains` eluvaldkonnad).
 */
export function senderFlowKeys(workflowMode, { hasDomains = false } = {}) {
  if (workflowMode === "sent") return [...SENT_FLOW_KEYS];
  if (workflowMode === "list") return [...LIST_FLOW_KEYS];
  return [
    ...(workflowMode === "journey" ? ["journey"] : []),
    "path",
    "situation",
    "who",
    "urgency",
    ...(hasDomains ? ["domains"] : []),
    "context",
    "assistant",
    "review",
    "recipient",
    "text",
    "send",
    "saved"
  ];
}

/* Mis lause ütleb, mis edasi saab. Võti kataloogis: `views.sent.next.<võti>`. */
const NEXT_BY_STATE = Object.freeze({
  sent_waiting: "waiting",
  accepted: "accepted",
  answered: "answered",
  sent_external: "external",
  recalled: "recalled",
  replaced: "replaced",
  archived: "archived",
  declined: "declined",
  work_closed: "work_closed"
});

/**
 * Saadetud (või muul põhjusel muutmisele suletud) pöördumise lugemisvaade.
 *
 *   state      seis nii, nagu pöörduja seda näeb: `{ key, at?, days?, tone }`
 *   recipient  kellele: asutuse nimi või valitud kontakti nimi
 *   channel    `platform`, `email` või `none` (saatmata)
 *   sentAt     millal saadeti (`null`, kui ei saadetud)
 *   situation  inimese kirjeldus
 *   text       pöördumise tekst, kui see erineb kirjeldusest (muidu tühi)
 *   next       võti lausele „mis edasi saab" (`views.sent.next.<võti>`)
 *   outcome    asutuse otsus, kui asutus on tööga lõpetanud: `{ kind, at, note }` (`kind` on
 *              `declined` või `closed`; `note` on asutuse selgitus pöördujale või tühi); muidu `null`
 *   actions    mida siin teha saab:
 *     room     ava ühine vestlusruum (saaja on vastu võtnud)
 *     recall   server lubaks tagasi võtta (tehakse lehel „Minu jagamised")
 *     correct  server lubaks saata paranduse (samal lehel)
 *     reopen   arhiveeritud saatmata pöördumise saab taasavada muutmiseks
 */
export function sentInquiryView(inquiry, { now = Date.now() } = {}) {
  const base = preInquirySenderState(inquiry, { now });
  const state = { ...base, tone: preInquirySenderTone(base.key) };
  const internal = upper(inquiry?.deliveryChannel) === "INTERNAL";
  const sent = Boolean(inquiry?.sentAt);
  const live = sent && !inquiry?.recalledAt;
  const situation = String(inquiry?.situation || "").trim();
  const draft = String(inquiry?.userEditedDraft || inquiry?.generatedDraft || "").trim();
  /* Asutus on tööga lõpetanud: ruumi saab lugeda ainult siis, kui see on olemas (tagasi lükatud
     pöördumisel, mida keegi tööle ei võtnud, ruumi ei ole ja nupp annaks eksitava keeldumise);
     paranduse vihjet enam ei näidata, sest asutus selle pöördumisega ei tegele. */
  const outcome = organizationOutcomeOf(inquiry);
  return {
    state,
    outcome: outcome ? { kind: outcome.kind, at: outcome.at || null, note: String(outcome.note || "").trim() } : null,
    recipient: String(inquiry?.recipientOrganization?.displayName || inquiry?.selectedRecipientName || inquiry?.recipientEntry?.title || "").trim(),
    channel: !sent ? "none" : internal ? "platform" : "email",
    sentAt: inquiry?.sentAt || null,
    situation,
    text: draft && draft !== situation ? draft : "",
    next: NEXT_BY_STATE[state.key] || "",
    actions: {
      room: live && internal && Boolean(inquiry?.openedAt) && (!outcome || Boolean(outcome.hasRoom)),
      recall: live && internal && !inquiry?.openedAt && upper(inquiry?.status) === "SENT",
      correct:
        live &&
        internal &&
        !outcome &&
        Boolean(inquiry?.openedAt) &&
        !inquiry?.supersededById &&
        Boolean(inquiry?.recipientOwnerId || inquiry?.recipientOrganizationId),
      reopen: !sent && !inquiry?.openedAt && upper(inquiry?.status) === "ARCHIVED"
    }
  };
}

/**
 * Loendi vastus (`GET /api/pre-inquiries`) kannab pöörduja ridadel vastuste arvu, aga muutmise,
 * alla laadimise ja taasavamise vastused mitte. Kui selline vastus asendab loendi rea, jääks
 * „vastatud" seis vahele: siin jäetakse varem teada olnud arv alles.
 */
export function keepReplyFacts(previous, next) {
  if (!next || !previous) return next;
  let merged = next;
  if (next.replyCount === undefined && previous.replyCount !== undefined) {
    merged = { ...merged, replyCount: previous.replyCount, lastReplyAt: previous.lastReplyAt ?? null };
  }
  /* Sama lugu asutuse otsusega: seda kannavad ainult loendi ja ühe pöördumise lugemise vastused. */
  if (next.organizationOutcome === undefined && previous.organizationOutcome !== undefined) {
    merged = { ...merged, organizationOutcome: previous.organizationOutcome };
  }
  return merged;
}

/**
 * Asendab loendis ühe rea serveri vastusega (`next`), nii et varem teada olnud vastuste arv
 * jääb alles. `toFront`: rida läheb loendi algusesse (salvestamine, lingist avatud rida);
 * muidu jääb oma kohale. Rida, mida loendis ei olnud, lisatakse ainult `toFront` korral.
 */
export function replaceInquiryRow(list, next, { toFront = false } = {}) {
  const rows = Array.isArray(list) ? list : [];
  if (!next?.id) return rows;
  const previous = rows.find((item) => item.id === next.id) || null;
  const merged = keepReplyFacts(previous, next);
  if (toFront) return [merged, ...rows.filter((item) => item.id !== next.id)];
  return rows.map((item) => (item.id === next.id ? merged : item));
}

/** Mitu pöördumist pöördujal on: avaekraani rida „Minu eelpöördumised". */
export function senderListCounts(inquiries) {
  const list = Array.isArray(inquiries) ? inquiries : [];
  const sent = list.filter((inquiry) => inquiry?.sentAt).length;
  return { total: list.length, sent, unsent: list.length - sent };
}

/* --- Adressaadi tühi loend ----------------------------------------------------------
   Leht näitas iga tühja loendi juures sama vihjet („lisa vähemalt piirkond või KOV ning
   lühike olukorra kirjeldus"), ka siis, kui piirkond ja kirjeldus olid antud ja loend oli tühi
   otsingusõna pärast (otsing täidetakse KOV-i tekstist ette) või kontakte ei olnudki. */

/**
 * Miks adressaadi loend on tühi: `{ key, query? }`. Tekst: `views.recipient.empty.<võti>`.
 *
 *   loading        kontakte alles laaditakse
 *   no_contacts    teenusekaardilt ei tulnud ühtegi kontakti
 *   no_filter      otsing on tühi ja liik valimata: loendit ei ole veel küsitud
 *   none_of_type   valitud liiki kontakte ei ole
 *   no_match_type  otsingule ei vasta ükski valitud liiki kontakt
 *   no_match       otsingule ei vasta ükski kontakt
 *
 * `entryCount`: kõik laaditud kontaktid; `typeCount`: valitud liiki kontaktid (otsingut arvestamata).
 */
export function recipientEmptyReason({ loading = false, query = "", type = "", entryCount = 0, typeCount = 0 } = {}) {
  const text = String(query || "").trim();
  if (loading) return { key: "loading" };
  if (!entryCount) return { key: "no_contacts" };
  if (!text && !type) return { key: "no_filter" };
  if (type && !typeCount) return { key: "none_of_type" };
  if (text) return { key: type ? "no_match_type" : "no_match", query: text };
  return { key: "none_of_type" };
}

/* --- Adressaadi samm: loend, üks kontakt ja saatmise tee -----------------------------
   Kontaktikaart oli 205 kuni 352 px kõrge: kolm kaarti tegid vaate 948 px kõrgeks (paneelis
   on 522) ja „Vaata rohkem kontakte" kuni 1686 px. Nüüd on loendis madalad read lehekülgede
   kaupa ja kogu info ühe kontakti kohta on selle kontakti enda vaates. */

/* Mitu adressaati on loendis korraga ees (mõõdetud 1536 × 640 aknas ja töölaua paneelis). */
export const RECIPIENT_PAGE = 3;

/** Teenuseosutaja teenused, mille kohta pöördumist üldse saata saab (platvormis või e-kirjaga). */
export function recipientServiceActions(entry) {
  if (upper(entry?.type) !== "SERVICE_PROVIDER") return [];
  return (Array.isArray(entry?.serviceActions) ? entry.serviceActions : []).filter(
    (action) => action?.providerServiceId && (action.platformAllowed || (action.emailAllowed && action.email))
  );
}

/**
 * Mis teel pöördumine adressaadini läheb: `{ platform, email, address }`. ÜKS reegel loendi
 * reale, kontakti vaatele ja saatmise sammule, et need ei saaks eri juttu rääkida.
 *
 * Enne luges leht välju, mida teenusekaardi vastus ei kanna: iga kontakti kaart ütles
 * „Sotsiaal.pro sisene" (ka ainult e-postiga kontakti oma) ja teenuseosutajale ei pakkunud
 * saatmise samm ei platvormi ega e-kirja, sest tema kanal on TEENUSE küljes
 * (`serviceActions`: `platformAllowed`, `emailAllowed`, `email`), mitte kirje küljes.
 *
 *   - asutuse vastuvõtulaud ja kirje, mille server on märkinud platvormisiseseks
 *     (`deliveryChannel: "INTERNAL"`): platvormis;
 *   - teenuseosutaja: valitud teenuse reegel (`serviceId`); kuni teenus on valimata, see, mida
 *     vähemalt üks tema teenus lubab (loendi rea jaoks), ja aadressi veel ei ole;
 *   - muu kontakt (KOV): e-kirjaga, kui kirjel on aadress.
 */
export function recipientChannels(entry, { serviceId = "", locationId = "" } = {}) {
  if (!entry) return { platform: false, email: false, address: "" };
  const marked = upper(entry.deliveryChannel) === "INTERNAL";
  if (upper(entry.type) === "SERVICE_PROVIDER") {
    const actions = recipientServiceActions(entry);
    if (serviceId) {
      const action = actions.find(
        (item) => item.providerServiceId === serviceId && (!locationId || !item.providerLocationId || item.providerLocationId === locationId)
      );
      const address = action?.emailAllowed ? String(action.email || "").trim() : "";
      return { platform: Boolean(action?.platformAllowed), email: Boolean(address), address };
    }
    return {
      platform: actions.some((action) => action.platformAllowed),
      email: actions.some((action) => action.emailAllowed && action.email),
      address: ""
    };
  }
  const address = String(entry.email || "").trim();
  return { platform: marked, email: Boolean(address), address };
}

/**
 * Valitud adressaadi kirje laaditud loendist. Salvestatud pöördumine ja abilise soovitus
 * kannavad kaardikirje tunnust; teenuseosutaja on loendis aga osutamiskoha kaupa
 * (`parentEntryId`, `providerLocationId`). Ainult loendi tunnuse järgi otsides kaotas uuesti
 * avatud mustand oma teenuseosutajast adressaadi ja järgmine salvestus kustutas selle.
 */
export function findRecipientEntry(entries, id, locationId = "") {
  const list = Array.isArray(entries) ? entries : [];
  const wanted = String(id || "");
  if (!wanted) return null;
  return (
    list.find((entry) => entry?.id === wanted) ||
    list.find((entry) => entry?.parentEntryId === wanted && (!locationId || entry.providerLocationId === locationId)) ||
    null
  );
}

/**
 * Teenuseosutaja kirje nii, et tema teenuste hulgas on ainult valitud teenus: saatmise sammu
 * teated (suunamise vajadus, kättesaadavus) käivad siis selle teenuse kohta, mille inimene
 * valis, mitte kõigi kohta. Valimata teenuse või muu adressaadi korral jääb kirje samaks.
 */
export function withChosenService(entry, serviceId = "") {
  const items = entry?.providerProfile?.serviceItems;
  if (!serviceId || !Array.isArray(items)) return entry || null;
  return { ...entry, providerProfile: { ...entry.providerProfile, serviceItems: items.filter((item) => item?.id === serviceId) } };
}

/** Võti lausele, mis teel pöördumine läheb: `platform`, `both`, `email` või `manual` (ainult salvestamine). */
export function recipientChannelKey(channels) {
  if (channels?.platform) return channels.email ? "both" : "platform";
  return channels?.email ? "email" : "manual";
}

/**
 * Abilise soovitused lehe loendi kujul. Soovitus kannab kaardikirje tunnust; lehe laaditud
 * loendis on teenuseosutaja aga iga osutamiskoha kohta eraldi kirjena (teine tunnus) ja ainult
 * see kirje kannab valitavaid teenuseid. Ilma selle sammuta oli soovitatud teenuseosutaja kaart
 * nuputa: teda ei saanud valida. Soovituse põhjendus (`routingReason`) tuleb kaasa.
 * Soovitus, mida laaditud loendis ei ole, jääb alles sellisena, nagu abiline ta andis.
 */
export function suggestedRecipients(suggestions, entries) {
  const loaded = Array.isArray(entries) ? entries : [];
  const out = [];
  const seen = new Set();
  for (const suggestion of Array.isArray(suggestions) ? suggestions : []) {
    if (!suggestion?.id) continue;
    const matches = loaded.filter((entry) => entry?.id === suggestion.id || entry?.parentEntryId === suggestion.id);
    const rows = matches.length
      ? matches.map((entry) => ({ ...entry, routingReason: suggestion.routingReason || entry.routingReason || "" }))
      : [suggestion];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

/**
 * Kust adressaadi loend tuleb: `suggested` (abilise soovitused) või `search` (inimese otsing
 * ja liigi valik kõigi kontaktide seast). Enne näitas loend soovituste olemasolul AINULT
 * soovitusi: otsing ja liigi valik ei teinud siis enam midagi.
 * `source` on inimese valik; tühjana on ees soovitused, kui neid on.
 */
export function recipientListView({ suggestions = [], entries = [], source = "", page = 0, pageSize = RECIPIENT_PAGE } = {}) {
  const suggested = Array.isArray(suggestions) ? suggestions : [];
  const active = source === "search" || !suggested.length ? "search" : "suggested";
  const rows = [];
  const seen = new Set();
  for (const entry of active === "suggested" ? suggested : Array.isArray(entries) ? entries : []) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    rows.push(entry);
  }
  return { source: active, hasSuggestions: suggested.length > 0, suggestedCount: suggested.length, ...pageOf(rows, page, pageSize) };
}

/* Filtrirea esimene lahter, kui abilisel on soovitusi; ülejäänud lahtrid on adressaadi liigid. */
export const RECIPIENT_SUGGESTED = "SUGGESTED";

/**
 * Mida filtrirea vajutus teeb: `{ source, type }`. Soovituste lahter näitab soovitusi; teine
 * vajutus samale lahtrile viib tühja otsingusse. Liigi lahter näitab seda liiki kontakte kõigi
 * seast; teine vajutus võtab liigi maha. Filter ainult näitab: valitud adressaati see ei muuda.
 */
export function recipientFilterChange({ source = "search", type = "" } = {}, value = "") {
  if (value === RECIPIENT_SUGGESTED) return { source: source === "suggested" ? "search" : "suggested", type };
  return { source: "search", type: source === "search" && type === value ? "" : value };
}

/**
 * Adressaadi liik nii, nagu server seda salvestamisel ootab (`recipientType`): tuleb valitud
 * adressaadist, mitte lehe filtrist. Enne saadeti filtri väärtus, mistõttu liigi vahetamine pidi
 * valiku tühjendama (server keeldub, kui liik ja kirje ei klapi).
 */
export function recipientTypeOf(entry) {
  if (!entry) return "";
  const type = upper(entry.type);
  if (type === "ORGANIZATION_INBOX") return "ORGANIZATION_INBOX";
  return type === "SERVICE_PROVIDER" ? "SERVICE_PROVIDER" : "KOV_CONTACT";
}

/**
 * Kas saatmise samm ütleb, kes asutuses pöördumist ja vestlust loeb: ainult asutuse
 * vastuvõtulaua kohta, kuhu pöördumine läheb platvormis. Seal ei loe vestlust kogu asutus, vaid
 * töötaja, kelle käes töö on, ja üleandmise järel järgmine (omaniku otsus 11.10.2026); inimene
 * peab seda teadma enne saatmist. Nimelise kontakti ja teenuseosutaja korral loeb saaja ise.
 */
export function sendTellsOrganizationReaders(entry) {
  return recipientTypeOf(entry) === "ORGANIZATION_INBOX" && recipientChannels(entry).platform;
}

/* Mitu teenust on teenuse valiku vaates korraga ees (kaks rida kaarte). */
export const RECIPIENT_SERVICE_PAGE = 4;

/**
 * Mida kontakti vaate põhinupp teeb:
 *   `{ kind: "direct" }`             vali see kontakt (KOV kontakt, asutuse vastuvõtulaud);
 *   `{ kind: "service", action }`    teenuseosutajal on üks teenus, mille kohta saab pöörduda: valik on kohe tehtud;
 *   `{ kind: "services", count }`    mitu teenust: enne tuleb valida teenus (oma vaade);
 *   `{ kind: "none" }`               teenuseosutaja, kellel ei ole ühtegi sellist teenust.
 * Server nõuab teenuseosutaja puhul teenuse valikut (`service_selection_required`).
 */
export function recipientChoice(entry) {
  if (upper(entry?.type) !== "SERVICE_PROVIDER") return { kind: "direct" };
  const actions = recipientServiceActions(entry);
  if (!actions.length) return { kind: "none" };
  if (actions.length === 1) return { kind: "service", action: actions[0] };
  return { kind: "services", count: actions.length };
}

/**
 * Mis on adressaadi sammus ees: `{ mode, id }`, kus `mode` on `list` (loend), `contact` (ühe
 * kontakti vaade) või `services` (teenuseosutaja teenuse valik).
 * Avatud kontakt (`peekId`) on ees; muidu näitab samm juba valitud adressaati, kuni inimene
 * läheb loendisse teist valima (`browsing`). `services`: avatud kontakti teenuse valik.
 */
export function recipientStepView({ peekId = "", browsing = false, selectedId = "", services = false } = {}) {
  const id = String(peekId || (!browsing ? selectedId : "") || "");
  if (!id) return { mode: "list", id: "" };
  return { mode: services ? "services" : "contact", id };
}

/* --- Leheküljed -----------------------------------------------------------------------
   Loend, mis paneeli ei mahu, jagatakse lehekülgedeks: paneeli sees kerivat kasti ei ole. */

/** Üks lehekülg loendist: `{ items, page, pages, from, to, total }` (`from` ja `to` algavad ühest). */
export function pageOf(items, page = 0, size = 5) {
  const list = Array.isArray(items) ? items : [];
  const perPage = Math.max(1, Math.floor(Number(size)) || 1);
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.max(0, Math.min(pages - 1, Math.floor(Number(page)) || 0));
  const start = current * perPage;
  const slice = list.slice(start, start + perPage);
  return { items: slice, page: current, pages, from: slice.length ? start + 1 : 0, to: start + slice.length, total: list.length };
}

/* --- Minu eelpöördumised: rühmad ---------------------------------------------------- */

export const SENDER_LIST_GROUPS = Object.freeze(["sent", "drafts", "archive"]);
/* Mitu rida mahub loendi vaatesse koos rühmavaliku, tegevusrea ja lehe teatega („Eelpöördumine
   arhiveeriti" seisab loendi kohal). Mõõdetud 1536 × 640 aknas ja töölaua paneelis: neli rida
   mahtus ilma teateta, koos teatega läks 49 px üle. */
export const SENDER_LIST_PAGE = 3;

/** Mis rühma pöörduja rida kuulub: saadetud, mustand (saatmata) või arhiiv (saatmata ja arhiveeritud). */
export function senderListGroupOf(inquiry) {
  if (inquiry?.sentAt) return "sent";
  return upper(inquiry?.status) === "ARCHIVED" ? "archive" : "drafts";
}

/**
 * Loendi vaade: rühmade arvud, ees olev rühm ja selle üks lehekülg.
 * `group` tühi: esimene rühm, kus midagi on (saadetud, siis mustandid, siis arhiiv).
 */
export function senderListView(inquiries, { group = "", page = 0, pageSize = SENDER_LIST_PAGE } = {}) {
  const byGroup = { sent: [], drafts: [], archive: [] };
  for (const inquiry of Array.isArray(inquiries) ? inquiries : []) byGroup[senderListGroupOf(inquiry)].push(inquiry);
  const active = SENDER_LIST_GROUPS.includes(group) ? group : SENDER_LIST_GROUPS.find((key) => byGroup[key].length) || "drafts";
  return {
    group: active,
    counts: { sent: byGroup.sent.length, drafts: byGroup.drafts.length, archive: byGroup.archive.length },
    ...pageOf(byGroup[active], page, pageSize)
  };
}

/** Mida loendireal teha saab peale avamise: saatmata mustandi saab arhiveerida. */
export function senderRowCanArchive(inquiry) {
  return senderListGroupOf(inquiry) === "drafts";
}

/* --- Pikk tekst kokkuvõttes ------------------------------------------------------------- */

/** Teksti algus kuni `limit` märki, sõna pealt lõigatud; pikemale lisandub „…". */
export function excerptOf(value, limit = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}
