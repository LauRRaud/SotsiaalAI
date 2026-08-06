/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — pinna ja API vaheline ainus kiht.
 *
 * MIKS ÜHES KOHAS: pind teeb üksteist eri päringut ja igaüks neist võib saada
 * väravalt 404, sessioonilt 401 või teenuskihilt tõlkevõtmega vea. Kui iga
 * komponent tõlgendaks vastust ise, jääks üks neist paratamatult maha — ja just
 * see üks näitaks kasutajale toorest veakoodi või vaikiks hoopis.
 *
 * VEATEKST TULEB TÕLKEVÕTMEST, MITTE SERVERI STRINGIST. Server saadab mõlemad
 * (`messageKey` + juba tõlgitud `message`), aga kliendi sõnastik on see, mis
 * teab kasutaja parasjagu valitud keelt — serveri tõlge on ainult varuvariant.
 */

const API_ROOT = "/api/casework";

export class CaseWorkRequestError extends Error {
  constructor(status, messageKey) {
    super(messageKey);
    this.name = "CaseWorkRequestError";
    this.status = status;
    this.messageKey = messageKey;
  }
}

export async function caseWorkRequest(path, { method = "GET", body = null, locale = "et" } = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      "x-ui-locale": locale || "et",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new CaseWorkRequestError(response.status, payload?.messageKey || "casework.errors.unexpected");
  }
  return payload || {};
}

/**
 * Kuvanimi (L10). Teenuskiht annab KIRJELDUSE, mitte teksti: `text` on inimese
 * enda sisestatud või lugemise ajal lahendatud väärtus, `labelKey` on tõlkevõti
 * nendeks juhtudeks, kus teksti EI OLE (kustutatud viide, nimetu juhtum).
 * Andmebaasist ei tule kunagi renderdatavat stringi.
 */
export function caseLabelText(label, t) {
  if (label?.text) return label.text;
  return t(label?.labelKey || "casework.label.untitled", "");
}

/** `retentionState` → tõlkevõti. Tundmatu seis ei kuva toorest enum'i nime. */
export function retentionLabelKey(state) {
  if (state === "READ_ONLY") return "casework.page.retention_read_only";
  if (state === "ARCHIVED") return "casework.page.retention_archived";
  return "casework.page.retention_active";
}

/** Puuduva info staatus → tõlkevõti. */
export function missingInfoStatusKey(status) {
  if (status === "RESOLVED") return "casework.page.status_resolved";
  if (status === "NOT_APPLICABLE") return "casework.page.status_not_applicable";
  return "casework.page.status_open";
}

/** Seose sihttüüp → tõlkevõti. */
export function targetTypeKey(targetType) {
  if (targetType === "AGENT_ARTIFACT") return "casework.page.target_agent_artifact";
  if (targetType === "FIELD_VISIT") return "casework.page.target_field_visit";
  return "casework.page.target_user_document";
}

/**
 * ISO → `datetime-local` väljale sobiv kuju KOHALIKUS ajas.
 *
 * `toISOString().slice(0,16)` oleks UTC ja nihutaks järgmise kontakti kuupäeva
 * suvel kolm tundi tahapoole — töötaja näeks kella 9 asemel kella 6 ja ei saaks
 * aru, miks. Nihe arvutatakse siin välja, mitte ei loodeta vaikimisi kujule.
 */
export function toLocalInputValue(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** `datetime-local` väärtus → ISO. Tühi väli tähendab „eemalda", mitte „jäta". */
export function fromLocalInputValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
