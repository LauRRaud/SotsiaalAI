import { helpWorkflowLabel, helpWorkflowT } from "./chatWorkflowText.js";
import { formatHelpTypeLabel, formatTimeTypeLabel } from "./listingViews.js";

export function createHelpWorkflowPreview({ normalizeDraft, collapseWhitespace, formatLabelledLine }) {
  function buildDraftSummaryLines(state, replyLang = "et") {
    const draft = normalizeDraft(state?.draft || {});
    const lines = [];

    if (draft.title) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "title", "Pealkiri"), draft.title));
    if (draft.description) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "description", "Kirjeldus"), draft.description));
    if (draft.category) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "primaryCategory", "Põhikategooria"), draft.category));
    if (state?.municipalityLabel || draft.rawPlace) {
      lines.push(formatLabelledLine(
        helpWorkflowLabel(replyLang, "rawPlace", "Täpsem asukoht"),
        [draft.rawPlace, state?.municipalityLabel].filter(Boolean).join(" / ")
      ));
    }
    if (draft.beneficiaryLabel) {
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "beneficiaryLabel", "Kellele abi vaja on"), draft.beneficiaryLabel));
    }
    if (draft.targetGroups.length) {
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "targetGroups", "Sihtrühm"), draft.targetGroups.join(", ")));
    }
    if (draft.helpType) {
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "helpForm", "Abi vorm"), formatHelpTypeLabel(draft.helpType, replyLang)));
    }
    if (draft.timeType || draft.availabilityOrStart) {
      lines.push(formatLabelledLine(
        helpWorkflowLabel(replyLang, "availabilityOrStart", "Saadavus / algus"),
        [formatTimeTypeLabel(draft.timeType, replyLang), draft.availabilityOrStart].filter(Boolean).join(" / ")
      ));
    }

    return lines.slice(0, 7);
  }

  function buildDraftProgressReply(state, question, replyLang = "et", options = {}) {
    const prompt = String(question?.prompt || "").trim();
    if (!collapseWhitespace(prompt)) return "";

    const draft = normalizeDraft(state?.draft || {});
    const shouldShowDraft = Boolean(
      draft.description
      && question?.key !== "description"
      && (options?.force === true || (Array.isArray(options?.changedFields) && options.changedFields.length))
    );
    if (!shouldShowDraft) return prompt;

    const summaryLines = buildDraftSummaryLines(state, replyLang);
    if (!summaryLines.length) return prompt;

    return [
      helpWorkflowT(replyLang, "draft.progressTitle", undefined, "Panin kuulutuse mustandi kokku."),
      "",
      summaryLines.join("\n"),
      "",
      helpWorkflowT(replyLang, "draft.nextQuestionIntro", undefined, "Järgmine täpsustus, et kuulutus oleks seinal arusaadav ja matchimiseks parem:"),
      prompt
    ].join("\n");
  }

  function buildPreviewSavePrompt(state, replyLang = "et") {
    const key = state?.intent === "create_help_offer"
      ? "preview.offerSavePrompt"
      : "preview.requestSavePrompt";
    return helpWorkflowT(replyLang, key, undefined, helpWorkflowT(replyLang, "preview.savePrompt"));
  }

  function buildPreviewEditPrompt(state, replyLang = "et") {
    const key = state?.intent === "create_help_offer"
      ? "preview.offerEditPrompt"
      : "preview.requestEditPrompt";
    return helpWorkflowT(replyLang, key, undefined, helpWorkflowT(replyLang, "preview.editPrompt"));
  }

  function buildSummarySentence(state, replyLang) {
    const draft = normalizeDraft(state?.draft || {});
    const categoryPart = draft.category ? draft.category.toLowerCase() : "abi";
    const targetPart = draft.targetGroups.length ? ` Sihtrühm: ${draft.targetGroups.join(", ")}.` : "";
    const locationPart = draft.rawPlace ? ` Asukoht: ${draft.rawPlace}.` : "";

    if (state.intent === "create_help_offer") {
      if (replyLang === "et") return `Sain aru, et soovid pakkuda ${categoryPart}.${targetPart}${locationPart}`;
      return helpWorkflowT(replyLang, "reflections.offerSummary", {
        category: categoryPart,
        target: draft.targetGroups.length ? ` ${draft.targetGroups.join(", ").toLowerCase()}` : "",
        place: draft.rawPlace ? ` ${draft.rawPlace}` : ""
      });
    }

    if (replyLang === "et") return `Sain aru, et vajad ${categoryPart}.${targetPart}${locationPart}`;
    return helpWorkflowT(replyLang, "reflections.requestSummary", {
      category: categoryPart,
      target: draft.targetGroups.length ? ` ${draft.targetGroups.join(", ").toLowerCase()}` : "",
      place: draft.rawPlace ? ` ${draft.rawPlace}` : ""
    });
  }

  function buildMapPrivacyLines(state, draft, replyLang = "et") {
    const locationLabel = state?.municipalityLabel || draft.rawPlace || "";
    const visibleRegion = locationLabel
      ? locationLabel
      : helpWorkflowT(replyLang, "preview.mapRegionUnspecified", undefined, "piirkond tĆ¤psustub kuulutuse asukoha pĆµhjal");
    return [
      formatLabelledLine(
        helpWorkflowLabel(replyLang, "mapVisibility", "Kaardil kuvamine"),
        helpWorkflowT(replyLang, "preview.mapVisibleValue", {
          region: visibleRegion
        }, `Kuulutus avaldatakse Teenusekaardil Ć¼ldistatud piirkonnana: ${visibleRegion}.`)
      ),
      formatLabelledLine(
        helpWorkflowLabel(replyLang, "mapPrivacy", "Privaatsus"),
        helpWorkflowT(replyLang, "preview.mapPrivacyValue", undefined, "TĆ¤pset koduaadressi ega avalikke kontaktandmeid ei kuvata; Ć¼hendus toimub platvormis.")
      )
    ];
  }

  function buildChangeReflection(state, changedFields = [], replyLang = "et") {
    const draft = normalizeDraft(state?.draft || {});
    if (!changedFields.length) return "";
    if (changedFields.includes("rawPlace") || changedFields.includes("municipalityLabel")) {
      if (draft.rawPlace && state.municipalityLabel) {
        return helpWorkflowT(replyLang, "reflections.locationWithMunicipality", {
          rawPlace: draft.rawPlace,
          municipality: state.municipalityLabel
        });
      }
      if (draft.rawPlace) {
        return helpWorkflowT(replyLang, "reflections.locationOnly", {
          rawPlace: draft.rawPlace
        });
      }
    }
    if (changedFields.includes("helpType") && draft.helpType) {
      const helpTypeLabel = formatHelpTypeLabel(draft.helpType, replyLang).toLowerCase().replace(/\s+abi$/i, "");
      return helpWorkflowT(replyLang, "reflections.helpType", {
        helpType: helpTypeLabel
      });
    }
    if (changedFields.includes("timeType") && draft.timeType) {
      return helpWorkflowT(replyLang, "reflections.timeType", {
        timeType: formatTimeTypeLabel(draft.timeType, replyLang).toLowerCase()
      });
    }
    if (changedFields.includes("beneficiaryLabel") && draft.beneficiaryLabel) {
      return helpWorkflowT(replyLang, "reflections.beneficiary", {
        beneficiary: draft.beneficiaryLabel
      });
    }
    if (changedFields.includes("urgency") && draft.urgency) {
      return helpWorkflowT(replyLang, "reflections.urgency", {
        urgency: draft.urgency
      });
    }
    if (changedFields.includes("providerScopeOrConditions") && draft.providerScopeOrConditions) {
      return helpWorkflowT(replyLang, "reflections.conditions");
    }
    if (changedFields.includes("description") || changedFields.includes("categoryCode") || changedFields.includes("targetGroupCodes")) {
      return buildSummarySentence(state, replyLang);
    }
    return "";
  }

  function buildPreviewReply(state, replyLang, options = {}) {
    const prefix = collapseWhitespace(options.prefix);
    const draft = normalizeDraft(state?.draft || {});
    const lines = [];
    if (prefix) lines.push(prefix, "");
    if (state.intent === "create_help_offer") {
      lines.push(helpWorkflowT(replyLang, "preview.offerTitle"), "");
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "type", "Tüüp"), helpWorkflowT(replyLang, "preview.offerTypeValue")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "title", "Pealkiri"), draft.title));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "description", "Kirjeldus"), draft.description));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "primaryCategory", "Põhikategooria"), draft.category));
      if (draft.secondaryCategories.length) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "secondaryCategories", "Lisakategooriad"), draft.secondaryCategories.join(", ")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "municipality", "Omavalitsus"), state.municipalityLabel));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "rawPlace", "Täpsem asukoht"), draft.rawPlace));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "targetGroups", "Sihtrühm"), draft.targetGroups.join(", ")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "helpForm", "Abi vorm"), formatHelpTypeLabel(draft.helpType, replyLang)));
      if (draft.compensationDetails) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "compensationInfo", "Tasu info"), draft.compensationDetails));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "timeType", "Ajalisus"), formatTimeTypeLabel(draft.timeType, replyLang)));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "availabilityOrStart", "Saadavus / algus"), draft.availabilityOrStart));
      if (draft.providerScopeOrConditions) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "conditions", "Tingimused"), draft.providerScopeOrConditions));
      if (draft.skillsOrBackground) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "skillsOrBackground", "Oskused või taust"), draft.skillsOrBackground));
    } else {
      lines.push(helpWorkflowT(replyLang, "preview.requestTitle"), "");
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "type", "Tüüp"), helpWorkflowT(replyLang, "preview.requestTypeValue")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "title", "Pealkiri"), draft.title));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "description", "Kirjeldus"), draft.description));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "beneficiaryLabel", "Kellele abi vaja on"), draft.beneficiaryLabel));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "primaryCategory", "Põhikategooria"), draft.category));
      if (draft.secondaryCategories.length) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "secondaryCategories", "Lisakategooriad"), draft.secondaryCategories.join(", ")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "municipality", "Omavalitsus"), state.municipalityLabel));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "rawPlace", "Täpsem asukoht"), draft.rawPlace));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "targetGroups", "Sihtrühm"), draft.targetGroups.join(", ")));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "helpForm", "Abi vorm"), formatHelpTypeLabel(draft.helpType, replyLang)));
      if (draft.compensationDetails) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "compensationPreference", "Tasu eelistus"), draft.compensationDetails));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "urgency", "Kiireloomulisus"), draft.urgency));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "timeType", "Ajalisus"), formatTimeTypeLabel(draft.timeType, replyLang)));
      lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "availabilityForRequest", "Vajalik aeg / algus"), draft.availabilityOrStart));
      if (draft.conditions) lines.push(formatLabelledLine(helpWorkflowLabel(replyLang, "conditions", "Tingimused"), draft.conditions));
    }
    lines.push("", ...buildMapPrivacyLines(state, draft, replyLang), "", buildPreviewSavePrompt(state, replyLang));
    return lines.join("\n");
  }

  return {
    buildChangeReflection,
    buildDraftProgressReply,
    buildPreviewEditPrompt,
    buildPreviewReply,
    buildPreviewSavePrompt,
    buildSummarySentence
  };
}
