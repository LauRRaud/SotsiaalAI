const HIDDEN_CALL_RECORDING_STATUSES = ["DELETE_PENDING", "QUARANTINED"]

export function visibleRecordingDocumentWhere() {
  return {
    callRecordingFiles: {
      none: { status: { in: HIDDEN_CALL_RECORDING_STATUSES } }
    }
  }
}

/* Välitöö manus, mille fail ei ole kasutusel (alles avaldamisel või kustutamisel),
   peidab oma dokumendi. Tingimus oli dokumendi marsruutides sõna-sõnalt neli korda
   ja otsingus puudu: üks koht hoiab neid koos. */
export function activeFieldAttachmentDocumentWhere() {
  return {
    fieldVisitAttachments: { none: { storageStatus: { not: "ACTIVE" } } }
  }
}

/**
 * Kõik tingimused, millega dokumendi leht (`/documents/[id]`) dokumendi avab.
 * Iga koht, mis viib inimese dokumendi lehele (nt „Minu otsing”), küsib sama
 * tingimusega: muidu näitaks loend pealkirja, mille taga on „ei leitud".
 */
export function openableDocumentWhere() {
  return {
    ...visibleRecordingDocumentWhere(),
    ...activeFieldAttachmentDocumentWhere()
  }
}
