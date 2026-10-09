/**
 * Teekonnaga seotud eelpöördumise seis NII, NAGU SAATJA SEDA NÄEB.
 *
 * Miks see ei ole lihtsalt `status`: pärast saatmist on eelpöördumise `status`
 * VASTUVÕTJA töövoo seis. Kui saaja pöördumise avab, läheb `status` väärtuselt
 * SENT väärtusele READY (saaja jaoks „valmis tööks"). Teekond näitas seda saatjale
 * sõnadega „valmis saatmiseks", justkui poleks pöördumist veel saadetud.
 *
 * Saatja seis tuletatakse faktidest, mis ei sõltu saaja töövoost: kas saadeti,
 * kas avati, kas võeti tagasi, kas asendati parandusega.
 */
export const LinkedPreInquiryState = Object.freeze({
  DRAFT: "DRAFT",
  READY: "READY",
  DOWNLOADED: "DOWNLOADED",
  SENT: "SENT",
  SENT_OUTSIDE: "SENT_OUTSIDE",
  OPENED: "OPENED",
  RECALLED: "RECALLED",
  REPLACED: "REPLACED",
  ARCHIVED: "ARCHIVED"
});

export const LINKED_PRE_INQUIRY_STATES = Object.freeze(Object.values(LinkedPreInquiryState));

export function linkedPreInquiryState(row) {
  const status = String(row?.status || "").toUpperCase();
  /* Tagasi võetud ja parandusega asendatud pöördumine ei ole enam see, mida saaja loeb. */
  if (row?.recalledAt) return LinkedPreInquiryState.RECALLED;
  if (row?.supersededById) return LinkedPreInquiryState.REPLACED;
  if (row?.openedAt) return LinkedPreInquiryState.OPENED;
  if (row?.sentAt) {
    /* Väljaspool platvormi saadetud pöördumise avamist platvorm ei näe. */
    return row?.externalSendConfirmedAt ? LinkedPreInquiryState.SENT_OUTSIDE : LinkedPreInquiryState.SENT;
  }
  /* Saatmata pöördumise `status` on saatja enda oma. */
  if (status === "SENT") return LinkedPreInquiryState.SENT;
  if (status === "ARCHIVED") return LinkedPreInquiryState.ARCHIVED;
  if (status === "DOWNLOADED") return LinkedPreInquiryState.DOWNLOADED;
  if (status === "READY") return LinkedPreInquiryState.READY;
  return LinkedPreInquiryState.DRAFT;
}
