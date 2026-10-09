/**
 * Mentorluse halduse read ja otsused ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Halduse leht pani nõusoleku seisu sõna kokku serveri koodist
 * (`mentoring.consent_status.${status}`) ja saatis salvestades välja kolmest
 * kohast kokku korjatud väärtused otse nupu vajutuse seest. Siin on see kõik
 * puhaste funktsioonidena, mida saab testida ilma brauserita
 * (`tests/mentoring-relation-views.test.mjs`). Leht
 * (`../AdminMentoringPage.jsx`) hoiab andmeid ja päringuid, vaated
 * (`./AdminViews.jsx`) ainult joonistavad.
 *
 * LOENDITE LAGI ON SERVERI OMA. Järjekorrast tuleb korraga kuni 100 ja ESTA
 * kirjetest kuni 300 rida (`lib/mentoring/adminService.js`); loendurid ütlevad
 * päris arvu. Kui need lähevad lahku, ütleb leht seda välja.
 */

import { REVIEW_REASON_KEYS, safeExternalUrl, statusWord } from "../entry/entryRows";

/** Lehe kaks loendit. */
export const ADMIN_GROUPS = Object.freeze(["queue", "external"]);

/** Nii palju ridu annab server korraga (`listMentorModerationQueue`, `listExternalMentorRecords`). */
export const QUEUE_CAP = 100;
export const EXTERNAL_CAP = 300;

/** Tõendi viite pikim pikkus (`MENTORING_LIMITS.MAX_SHORT_TEXT`, server lõikab sama koha pealt). */
export const EVIDENCE_REF_LIMIT = 600;

/** Kood → sõna võti ja märgi toon. Katab kõik serveri koodid (`MENTOR_CONSENT_STATUS`). */
export const CONSENT_WORDS = Object.freeze({
  NOT_REQUESTED: { key: "not_requested", tone: "quiet" },
  PENDING_CONSENT: { key: "pending_consent", tone: "wait" },
  CONSENTED: { key: "consented", tone: "ok" },
  DECLINED_CONSENT: { key: "declined_consent", tone: "quiet" },
  STALE: { key: "stale", tone: "wait" }
});

/** Seisud, mille haldur saab kirjele märkida (sama valik mis enne). */
export const CONSENT_CHOICES = Object.freeze(["PENDING_CONSENT", "CONSENTED", "DECLINED_CONSENT", "STALE"]);

/** Nõusoleku tõendi liigid (`MENTOR_CONSENT_EVIDENCE_TYPES`) ja nende sõna võti. */
export const EVIDENCE_WORDS = Object.freeze({ WRITTEN: "written", EMAIL: "email", RECORDED_CALL: "recorded_call", IN_PERSON: "in_person" });
export const EVIDENCE_TYPES = Object.freeze(Object.keys(EVIDENCE_WORDS));

export { REVIEW_REASON_KEYS };

const list = (value) => (Array.isArray(value) ? value : []);
const code = (value) => String(value || "").toUpperCase();
const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Nõusoleku seisu sõna ja toon. Tundmatu kood annab tühja teksti, mitte toore koodi. */
export function consentWord(value, t) {
  const entry = CONSENT_WORDS[code(value)];
  if (!entry) return { text: "", tone: "quiet" };
  return { text: t(`mentoring.consent_status.${entry.key}`), tone: entry.tone };
}

/** Neli arvu lehe ülaservas. Arvud on arvud: suhete sisu halduris ei ole. */
export function counterCells(counters, t) {
  if (!counters) return [];
  return [
    { key: "active", value: String(count(counters.activeProfiles)), label: t("mentoring.admin.counter_active") },
    { key: "pending", value: String(count(counters.pendingReview)), label: t("mentoring.admin.counter_pending") },
    {
      key: "external",
      value: `${count(counters.consentedExternal)}/${count(counters.externalRecords)}`,
      label: t("mentoring.admin.counter_external")
    },
    { key: "relations", value: String(count(counters.openRelations)), label: t("mentoring.admin.counter_relations") }
  ];
}

/** Ülevaatust ootavad profiilid ridadena: kes, kus töötab ja millal profiili viimati muudeti. */
export function queueRows(queue, { t, formatDate }) {
  return list(queue)
    .filter((profile) => profile?.id)
    .map((profile) => {
      const date = formatDate(profile.updatedAt);
      return {
        id: String(profile.id),
        title: profile.displayName || "",
        text: [profile.title, profile.organization].filter(Boolean).join(" · "),
        chip: "",
        tone: "quiet",
        time: date ? t("mentoring.admin.row_updated", { date }) : ""
      };
    });
}

/** ESTA kirjed ridadena: nimi, nõusoleku seis märgina ja viimase kontrolli päev. */
export function externalRows(records, { t, formatDate }) {
  return list(records)
    .filter((record) => record?.id)
    .map((record) => {
      const word = consentWord(record.consentStatus, t);
      const date = formatDate(record.checkedAt);
      return {
        id: String(record.id),
        title: record.displayName || "",
        text: [record.title, record.organization].filter(Boolean).join(" · "),
        chip: word.text,
        tone: word.tone,
        time: date ? t("mentoring.admin.views.record.checked", { date }) : "",
        status: code(record.consentStatus)
      };
    });
}

/**
 * Filtri valikud: „kõik” ja need seisud, mis loendis päriselt on. Ühe seisuga
 * loendil filtrit ei ole (valikuid tuleb alla kolme).
 */
export function consentFilterOptions(records, t) {
  const present = new Set(list(records).map((record) => code(record?.consentStatus)));
  const options = Object.keys(CONSENT_WORDS)
    .filter((status) => present.has(status))
    .map((status) => ({ value: status, label: consentWord(status, t).text }));
  return [{ value: "all", label: t("mentoring.admin.filter_all") }, ...options];
}

/** Read valitud seisuga. Tundmatu filter tähendab „kõik”. */
export function filterExternal(rows, filter) {
  if (!filter || filter === "all" || !CONSENT_WORDS[filter]) return rows;
  return rows.filter((row) => row.status === filter);
}

/**
 * Lause, kui loend on lühem kui päris arv (server annab korraga piiratud hulga).
 * Tühi tekst, kui kõik on näha.
 */
export function capNote(group, shown, counters, t) {
  const total = group === "queue" ? count(counters?.pendingReview) : count(counters?.externalRecords);
  const cap = group === "queue" ? QUEUE_CAP : EXTERNAL_CAP;
  if (shown < cap || total <= shown) return "";
  return group === "queue"
    ? t("mentoring.admin.queue_capped", { count: shown, total })
    : t("mentoring.admin.external_capped", { count: shown, total });
}

/**
 * Ülevaatusel profiil lugemiseks: kõik, mida mentor kirjutas. Haldur otsustab
 * terve profiili, mitte ainult nime ja lühitutvustuse põhjal.
 */
export function queueProfileModel(profile) {
  const groups = ["fields", "topics", "languages", "formats"]
    .map((key) => ({ key, items: list(profile?.[key]).map((item) => String(item || "").trim()).filter(Boolean) }))
    .filter((group) => group.items.length);
  return {
    id: String(profile?.id || ""),
    heading: profile?.displayName || "",
    sub: [profile?.title, profile?.organization].filter(Boolean).join(" · "),
    intro: String(profile?.bioShort || "").trim(),
    story: String(profile?.bioFull || "").trim(),
    experience: String(profile?.experienceSummary || "").trim(),
    groups
  };
}

/** Kahe loendi valik: nimed on samad mis vaadete pealkirjad. */
export function groupOptions(t) {
  return ADMIN_GROUPS.map((value) => ({ value, label: t(`mentoring.admin.views.${value}.title`) }));
}

/** Tagasilükkamise põhjused valikuna. */
export function reasonOptions(t) {
  return REVIEW_REASON_KEYS.map((value) => ({ value, label: t(`mentoring.review_reason.${value}`) }));
}

/** Nõusoleku seisud, mille haldur saab märkida. */
export function consentOptions(t) {
  return CONSENT_CHOICES.map((value) => ({ value, label: consentWord(value, t).text }));
}

/** Tõendi liigid valikuna. Võti tuleb loendist, mitte serveri vastusest. */
export function evidenceOptions(t) {
  return EVIDENCE_TYPES.map((value) => ({ value, label: t(`mentoring.admin.consent_evidence.${EVIDENCE_WORDS[value]}`) }));
}

/** Tagasilükkamise põhjus: tundmatu väärtuse asemel esimene (sama vaikimisi valik mis enne). */
export function rejectReason(value) {
  return REVIEW_REASON_KEYS.includes(value) ? value : REVIEW_REASON_KEYS[0];
}

/**
 * Nõusoleku vorm ühe ESTA kirje kohta: kirje salvestatud väärtused ja nende
 * peal haldurile pooleli jäänud muudatused (`draft`). Nõusolekut ei saa
 * märkida ilma tõendi viiteta: server keeldub sellest.
 */
export function consentForm(record, draft = null) {
  const status = code(draft?.status || record?.consentStatus) || "PENDING_CONSENT";
  const savedType = code(record?.consentEvidenceType);
  const evidenceType = EVIDENCE_TYPES.includes(code(draft?.type)) ? code(draft.type) : EVIDENCE_TYPES.includes(savedType) ? savedType : "WRITTEN";
  const evidenceRef = String(draft?.reference ?? record?.consentEvidenceRef ?? "");
  const needsEvidence = status === "CONSENTED";
  return {
    status,
    evidenceType,
    evidenceRef,
    needsEvidence,
    canSave: !needsEvidence || Boolean(evidenceRef.trim())
  };
}

/** Salvestamise sisu: sama kuju, mida `POST /api/admin/mentoring/[profileId]` ootab. */
export function consentBody(form) {
  return {
    action: "consent",
    consentStatus: form.status,
    consentEvidenceType: form.evidenceType,
    consentEvidenceRef: form.evidenceRef,
    /* Iga salvestamine märgib kirje täna kontrollituks (sama mis enne). */
    refreshCheckedAt: true
  };
}

/** Avatud ESTA kirje: nimi, seis, viimane kontroll ja viide ESTA lehele, kui see on päris veebiaadress. */
export function externalRecordModel(record, { t, formatDate }) {
  const word = consentWord(record?.consentStatus, t);
  const date = formatDate(record?.checkedAt);
  return {
    id: String(record?.id || ""),
    heading: record?.displayName || "",
    sub: [record?.title, record?.organization].filter(Boolean).join(" · "),
    chip: word,
    checked: date ? t("mentoring.admin.views.record.checked", { date }) : t("mentoring.admin.views.record.not_checked"),
    url: safeExternalUrl(record?.externalProfileUrl, "")
  };
}

/** Impordi tulemus lausena: mitu kirjet lisati, mitu oli olemas ja mitu jäi vahele. */
export function importSummary(payload, t) {
  return t("mentoring.admin.import_result", {
    created: count(payload?.created),
    existing: count(payload?.existing),
    skipped: count(payload?.skipped)
  });
}

/** Seisu sõna ülevaatusel profiilile (alati „ülevaatusel”, aga sõna tuleb loendist). */
export function queueChip(profile, t) {
  return statusWord("profile_status", profile?.status, t);
}
