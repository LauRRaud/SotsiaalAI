import { buildPreInquiryAssessmentReview } from "./preInquiriesQuestionnaire.js";

/**
 * Each item carries a translation key alongside the Estonian text. The label
 * stays as a fallback for legacy rows and non-UI consumers, but the rendered
 * string comes from the key — no translatable copy is served from the DB.
 * labelKey is always taken from this server-side table, never from client
 * input, so a caller cannot point an item at an arbitrary translation.
 */
const CHECKLIST_KEY_PREFIX = "workspace_feature_pages.pre_inquiries.receiver_checklist";

const RECEIVER_CHECKLIST_DEFINITIONS = Object.freeze([
  {
    id: "review_preinfo",
    labelKey: `${CHECKLIST_KEY_PREFIX}.review_preinfo`,
    label: "Vaatasin olukorra kirjelduse, eelkaardistuse ja pöördumise mustandi läbi."
  },
  {
    id: "check_consent",
    labelKey: `${CHECKLIST_KEY_PREFIX}.check_consent`,
    label: "Kontrollisin nõusoleku või pöördumise aluse ja vajadusel täpsustan seda."
  },
  {
    id: "check_urgency",
    labelKey: `${CHECKLIST_KEY_PREFIX}.check_urgency`,
    label: "Hindasin, kas olukord vajab kiiremat ühendust või kriisisuunamist."
  },
  {
    id: "clarify_missing",
    labelKey: `${CHECKLIST_KEY_PREFIX}.clarify_missing`,
    label: "Märkisin küsimused või info, mida tuleb enne järgmist sammu täpsustada."
  },
  {
    id: "choose_next_step",
    labelKey: `${CHECKLIST_KEY_PREFIX}.choose_next_step`,
    label: "Valisin järgmise tegevuse: kontakt, vestlusruum, kohtumine, teenusesuund või muu jätk."
  }
]);

function normalizeString(value, maxLength = 4_000) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

export function normalizePreInquiryReceiverNote(value) {
  return normalizeString(value, 8_000);
}

function buildPreInquiryReceiverChecklist(inquiry = {}) {
  const review = inquiry?.assessmentState
    ? buildPreInquiryAssessmentReview(inquiry.assessmentState, {
        topic: inquiry.topic || ""
      })
    : null;
  const unknownCount = review?.unknownQuestions?.length || 0;
  const unansweredCount = review?.progress?.unansweredPrimaryCount || 0;
  const riskMessage = review?.riskMessage || "";

  return RECEIVER_CHECKLIST_DEFINITIONS.map((item) => {
    if (item.id === "check_urgency" && riskMessage) {
      return {
        ...item,
        labelKey: `${CHECKLIST_KEY_PREFIX}.check_urgency_risk`,
        label: "Kontrollisin kiireloomulisuse või ohusignaali ja otsustasin, kas on vaja kiiremat ühendust."
      };
    }
    if (item.id === "clarify_missing" && (unknownCount || unansweredCount)) {
      // Three explicit variants instead of one interpolated fragment: a
      // translation cannot express "omit this clause when the count is 0".
      const variant = unknownCount && unansweredCount
        ? "both"
        : unknownCount
          ? "unknown"
          : "unanswered";
      const details = [
        unknownCount ? `${unknownCount} ebaselget vastust` : "",
        unansweredCount ? `${unansweredCount} vastamata põhiküsimust` : ""
      ].filter(Boolean).join(", ");
      return {
        ...item,
        labelKey: `${CHECKLIST_KEY_PREFIX}.clarify_missing_${variant}`,
        labelVars: { unknown: unknownCount, unanswered: unansweredCount },
        label: `Märkisin täpsustamist vajava info (${details}).`
      };
    }
    return item;
  });
}

export function normalizePreInquiryReceiverChecklist(value, inquiry = {}) {
  const defaults = buildPreInquiryReceiverChecklist(inquiry);
  const incomingItems = Array.isArray(value) ? value : [];
  const incomingById = new Map(incomingItems.map((item) => [String(item?.id || ""), item]));

  return defaults.map((item) => {
    const incoming = incomingById.get(item.id);
    return {
      id: item.id,
      // labelKey/labelVars come from the server-side table only — never from
      // `incoming` — so a stored or posted item cannot redirect the lookup.
      labelKey: item.labelKey,
      ...(item.labelVars ? { labelVars: item.labelVars } : {}),
      label: normalizeString(incoming?.label, 500) || item.label,
      checked: Boolean(incoming?.checked)
    };
  });
}
