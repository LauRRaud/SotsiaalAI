import { helpWorkflowLabel, helpWorkflowT } from "./chatWorkflowText.js";
import { buildServiceRecommendationSummary } from "./taxonomyBridge.js";
import { redactPersonalData } from "../privacy/piiFilter.js";

export function createHelpWorkflowActions({
  buildHelpListingMetaLine,
  buildIntentTitle,
  createHelpMatch,
  createHelpOffer,
  createHelpRequest,
  createHelpWorkflowDraftState,
  formatHelpTypeLabel,
  formatTimeTypeLabel,
  formatLabelledLine,
  generateStructuredSummary,
  isAffirmative,
  isNegative,
  listAlternativeOffersForRequest,
  listAlternativeRequestsForOffer,
  listMatchingOffersForRequest,
  listMatchingRequestsForOffer,
  normalizeDraft,
  parseOrdinalSelection,
  toHelpListingView
}) {
  function buildSavedReply(state, record, replyLang, options = {}) {
    const includeNextStep = options?.includeNextStep !== false;
    const serviceSuggestion = buildServiceRecommendationSummary(
      state?.draft?.categoryCode || record?.primaryCategory?.code || record?.primaryCategoryCode || ""
    );
    const matchingTitle = state.intent === "create_help_offer"
      ? "Sobivad abisoovid"
      : "Sobivad abipakkumised";
    const matchingBody = state.intent === "create_help_offer"
      ? "Süsteem otsib esmalt sobivaid abisoove, millega sinu abipakkumine võiks kattuda."
      : "Süsteem otsib esmalt sobivaid abipakkumisi sinu piirkonnas.";
    const serviceCategories = serviceSuggestion.relatedServiceCategories?.length
      ? `Seotud suunad: ${serviceSuggestion.relatedServiceCategories.join(", ")}.`
      : "";

    return [
      helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "saved.offer" : "saved.request"),
      helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "saved.offerPublished" : "saved.requestPublished"),
      helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "saved.checkingRequests" : "saved.checkingOffers"),
      "",
      matchingTitle,
      matchingBody,
      "",
      serviceSuggestion.title,
      serviceSuggestion.description,
      serviceCategories,
      ...(includeNextStep
        ? [
            "",
            helpWorkflowT(replyLang, state.intent === "create_help_offer" ? "browse.nextRequests" : "browse.nextOffers")
          ]
        : [])
    ].filter(Boolean).join("\n");
  }

  function browseIntentFromState(state) {
    return state.intent === "create_help_offer" || state.intent === "browse_help_requests" || state.intent === "connect_to_request"
      ? "browse_help_requests"
      : "browse_help_offers";
  }

  function connectIntentFromBrowseIntent(intent = "") {
    return intent === "browse_help_requests" ? "connect_to_request" : "connect_to_offer";
  }

  function normalizeSelectionText(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase()
      .trim();
  }

  function uniqueIndexes(indexes = [], max = 0) {
    const seen = new Set();
    const result = [];
    for (const rawValue of Array.isArray(indexes) ? indexes : []) {
      const index = Number(rawValue);
      if (!Number.isInteger(index) || index < 0 || index >= max || seen.has(index)) continue;
      seen.add(index);
      result.push(index);
    }
    return result;
  }

  function normalizeCompatibilityWarnings(warnings = []) {
    return (Array.isArray(warnings) ? warnings : [])
      .map((value) => {
        const normalized = String(value || "").trim();
        if (normalized === "help_type_mismatch") return "help_type_incompatible";
        if (normalized === "time_type_mismatch") return "time_type_incompatible";
        return normalized;
      })
      .filter(Boolean);
  }

  function buildCompatibilitySummary(source = {}, candidate = {}, warningCodes = [], replyLang = "et") {
    const normalizedWarnings = normalizeCompatibilityWarnings(warningCodes);
    const lines = [];
    if (normalizedWarnings.includes("help_type_incompatible")) {
      const sourceLabel = formatHelpTypeLabel(source?.helpType || "", replyLang).toLowerCase();
      const candidateLabel = formatHelpTypeLabel(candidate?.helpType || "", replyLang).toLowerCase();
      if (sourceLabel && candidateLabel && sourceLabel !== candidateLabel) {
        lines.push(helpWorkflowT(replyLang, "browse.compatibilityHelpType", {
          sourceHelpType: sourceLabel,
          candidateHelpType: candidateLabel
        }));
      }
    }
    if (normalizedWarnings.includes("time_type_incompatible")) {
      const sourceLabel = formatTimeTypeLabel(source?.timeType || "", replyLang).toLowerCase();
      const candidateLabel = formatTimeTypeLabel(candidate?.timeType || "", replyLang).toLowerCase();
      if (sourceLabel && candidateLabel && sourceLabel !== candidateLabel) {
        lines.push(helpWorkflowT(replyLang, "browse.compatibilityTimeType", {
          sourceTimeType: sourceLabel,
          candidateTimeType: candidateLabel
        }));
      }
    }
    return lines.filter(Boolean).join("\n");
  }

  function decorateBrowseResults(results = [], sourceDraft = {}, replyLang = "et") {
    return results.map((item) => ({
      ...item,
      compatibilityWarnings: normalizeCompatibilityWarnings(item?.compatibilityWarnings),
      listingView: item?.listingView || toHelpListingView(item, { kind: item.kind, locale: replyLang }),
      compatibilitySummary: item?.compatibilitySummary
        || (Array.isArray(item?.compatibilityWarnings) && item.compatibilityWarnings.length
          ? buildCompatibilitySummary(sourceDraft, item, item.compatibilityWarnings, replyLang)
          : "")
    }));
  }

  function resolveCompatibilitySummary(state, item, replyLang = "et") {
    if (!item) return "";
    if (item?.compatibilitySummary) return item.compatibilitySummary;
    const warnings = Array.isArray(item?.compatibilityWarnings) ? item.compatibilityWarnings : [];
    if (!warnings.length) return "";
    return buildCompatibilitySummary(state?.draft || {}, item, warnings, replyLang);
  }

  function buildPendingMatchSelection(state, item, replyLang = "et") {
    if (!item) return null;
    const requestId = item.kind === "offer"
      ? state.linkedRequestId || state.sourceRecordId
      : item.id;
    const offerId = item.kind === "offer"
      ? item.id
      : state.linkedOfferId || state.sourceRecordId;
    if (!requestId || !offerId) return null;
    return {
      requestId,
      offerId,
      requiresConfirmation: item.requiresConfirmation === true,
      compatibilitySummary: resolveCompatibilitySummary(state, item, replyLang),
      title: item?.listingView?.title || item?.title || ""
    };
  }

  function buildPendingMatchSelections(state, selections = [], replyLang = "et") {
    const seen = new Set();
    return selections
      .map((item) => buildPendingMatchSelection(state, item, replyLang))
      .filter((item) => {
        if (!item) return false;
        const key = `${item.requestId}:${item.offerId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function readPendingMatchSelections(state, replyLang = "et") {
    const candidateMatches = Array.isArray(state?.candidateMatches) ? state.candidateMatches : [];
    if (candidateMatches.length) {
      return candidateMatches
        .map((selection) => {
          const item = findSelectedBrowseResult(state, selection.requestId, selection.offerId);
          return {
            requestId: selection.requestId,
            offerId: selection.offerId,
            requiresConfirmation: item?.requiresConfirmation === true,
            compatibilitySummary: resolveCompatibilitySummary(state, item, replyLang),
            title: item?.listingView?.title || item?.title || ""
          };
        })
        .filter((item) => item.requestId && item.offerId);
    }

    if (state?.candidateRequestId && state?.candidateOfferId) {
      const item = findSelectedBrowseResult(state, state.candidateRequestId, state.candidateOfferId);
      return [{
        requestId: state.candidateRequestId,
        offerId: state.candidateOfferId,
        requiresConfirmation: item?.requiresConfirmation === true,
        compatibilitySummary: resolveCompatibilitySummary(state, item, replyLang),
        title: item?.listingView?.title || item?.title || ""
      }];
    }

    return [];
  }

  function buildSoftMatchConfirmationReply(replyLang, selections = [], options = {}) {
    const prefix = String(options?.prefix || "").trim();
    const uniqueSelections = selections.filter((item) => item?.requestId && item?.offerId);
    const summaries = uniqueSelections
      .map((item, index) => {
        const lines = [];
        if (uniqueSelections.length > 1) {
          lines.push(`${index + 1}. ${item.title || helpWorkflowT(replyLang, "connect.selectionFallbackTitle")}`);
        }
        if (item.compatibilitySummary) {
          lines.push(item.compatibilitySummary);
        }
        return lines.filter(Boolean).join("\n");
      })
      .filter(Boolean);

    return [
      prefix,
      helpWorkflowT(
        replyLang,
        uniqueSelections.length > 1 ? "connect.confirmSoftMatches" : "connect.confirmHelpTypeMismatch",
        { count: uniqueSelections.length || 1 }
      ),
      summaries.join("\n\n"),
      helpWorkflowT(replyLang, "connect.confirmHelpTypeMismatchRetry")
    ].filter(Boolean).join("\n\n");
  }

  async function createMatchesForSelections(selections = [], prismaClient, options = {}) {
    const allowSoftFailures = options?.allowSoftFailures === true;
    const matches = [];
    let failureCount = 0;

    for (const selection of selections) {
      try {
        const match = await createHelpMatch({
          requestId: selection.requestId,
          offerId: selection.offerId,
          ...(allowSoftFailures ? { allowSoftFailures: true } : {})
        }, prismaClient);
        matches.push(match);
      } catch {
        failureCount += 1;
      }
    }

    return { matches, failureCount };
  }

  function buildCreatedReply(replyLang, successCount = 0, failureCount = 0) {
    if (successCount <= 0) {
      return helpWorkflowT(replyLang, "connect.failed");
    }
    if (failureCount <= 0) {
      return successCount === 1
        ? helpWorkflowT(replyLang, "connect.created")
        : helpWorkflowT(replyLang, "connect.createdMultiple", { count: successCount });
    }
    return helpWorkflowT(replyLang, "connect.createdPartial", {
      createdCount: successCount,
      failedCount: failureCount
    });
  }

  function buildBrowseReply(intent, results, replyLang) {
    if (!results.length) {
      return helpWorkflowT(replyLang, intent === "browse_help_offers" ? "browse.emptyOffers" : "browse.emptyRequests");
    }

    const hasCompatibilityAlternatives = results.some((item) => Array.isArray(item?.compatibilityWarnings) && item.compatibilityWarnings.length);

    const lines = results.map((item, index) => {
      const listingView = item?.listingView || toHelpListingView(item, { kind: item.kind, locale: replyLang });
      const meta = buildHelpListingMetaLine(listingView, replyLang);
      return [
        `${index + 1}. ${listingView.title}`,
        listingView.summary || "",
        meta || "",
        item?.compatibilitySummary || "",
        listingView.municipalityLabel
          ? formatLabelledLine(helpWorkflowLabel(replyLang, "municipality", "Omavalitsus"), listingView.municipalityLabel)
          : ""
      ].filter(Boolean).join("\n");
    });

    return [
      hasCompatibilityAlternatives
        ? helpWorkflowT(
            replyLang,
            intent === "browse_help_offers" ? "browse.foundAlternativeOffersHelpType" : "browse.foundAlternativeRequestsHelpType",
            { count: results.length }
          )
        : helpWorkflowT(replyLang, intent === "browse_help_offers" ? "browse.foundOffers" : "browse.foundRequests", {
            count: results.length
          }),
      "",
      lines.join("\n\n"),
      "",
      helpWorkflowT(
        replyLang,
        hasCompatibilityAlternatives
          ? (intent === "browse_help_offers" ? "browse.connectHintAlternativeOffers" : "browse.connectHintAlternativeRequests")
          : (intent === "browse_help_offers" ? "browse.connectHintOffers" : "browse.connectHintRequests")
      )
    ].join("\n");
  }

  async function saveStructuredRecord(state, userId, prismaClient) {
    const draft = normalizeDraft(state?.draft || {});
    const descriptionLines = [
      draft.description,
      state.intent === "create_help_request" && draft.beneficiaryLabel ? `Kellele abi vaja on: ${draft.beneficiaryLabel}` : "",
      state.intent === "create_help_request" && draft.urgency ? `Kiireloomulisus: ${draft.urgency}` : "",
      state.intent === "create_help_offer" && draft.providerScopeOrConditions ? `Tingimused: ${draft.providerScopeOrConditions}` : "",
      draft.category ? `Põhikategooria: ${draft.category}` : "",
      state.municipalityLabel ? `Omavalitsus: ${state.municipalityLabel}` : "",
      draft.rawPlace ? `Täpsem asukoht: ${draft.rawPlace}` : "",
      draft.targetGroups.length ? `Sihtrühm: ${draft.targetGroups.join(", ")}` : "",
      draft.helpType ? `Abi vorm: ${formatHelpTypeLabel(draft.helpType, "et")}` : "",
      draft.compensationDetails ? `Tasu info: ${draft.compensationDetails}` : "",
      draft.timeType ? `Ajalisus: ${formatTimeTypeLabel(draft.timeType, "et")}` : "",
      draft.availabilityOrStart ? `Saadavus / algus: ${draft.availabilityOrStart}` : "",
      draft.conditions ? `Lisatingimused: ${draft.conditions}` : "",
      draft.skillsOrBackground ? `Oskused või taust: ${draft.skillsOrBackground}` : ""
    ].filter(Boolean);

    const redactPublicText = (value) => redactPersonalData(value).redactedText;
    const sharedPayload = {
      userId,
      municipalityId: state.municipalityId,
      primaryCategoryCode: draft.categoryCode || undefined,
      category: draft.category,
      serviceLabel: draft.category || redactPublicText(draft.title),
      title: redactPublicText(draft.title || buildIntentTitle(state.intent)),
      description: redactPublicText(descriptionLines.join("\n")),
      structuredSummary: redactPublicText(draft.structuredSummary || generateStructuredSummary(draft, state.municipalityLabel, state.intent)),
      roleLabel: redactPublicText(state.intent === "create_help_request"
        ? draft.beneficiaryLabel || draft.category
        : draft.providerScopeOrConditions || draft.category),
      beneficiaryLabel: state.intent === "create_help_request" ? redactPublicText(draft.beneficiaryLabel || "") || undefined : undefined,
      urgency: state.intent === "create_help_request" ? draft.urgency || undefined : undefined,
      providerScopeOrConditions: state.intent === "create_help_offer" ? redactPublicText(draft.providerScopeOrConditions || "") || undefined : undefined,
      availabilityOrStart: redactPublicText(draft.availabilityOrStart || "") || undefined,
      compensationDetails: redactPublicText(draft.compensationDetails || "") || undefined,
      conditions: redactPublicText(draft.conditions || "") || undefined,
      skillsOrBackground: redactPublicText(draft.skillsOrBackground || "") || undefined,
      helpType: draft.helpType || undefined,
      timeType: draft.timeType,
      targetGroupCodes: draft.targetGroupCodes,
      rawPlace: redactPublicText(draft.rawPlace || "") || undefined,
      classificationSource: "USER",
      userConfirmedAt: new Date().toISOString()
    };

    if (state.intent === "create_help_offer") {
      return createHelpOffer(sharedPayload, prismaClient);
    }

    return createHelpRequest(sharedPayload, prismaClient);
  }

  function resolveBrowseSelections(message, browseResults = []) {
    if (!browseResults.length) return [];

    const normalized = normalizeSelectionText(message);
    const max = browseResults.length;
    if (/\b(koigiga|all|koik|every(?:thing|one)?|all of them)\b/.test(normalized)) {
      return browseResults.slice();
    }

    const indexes = [];
    for (const match of normalized.matchAll(/\b([1-9]|10)\b/g)) {
      indexes.push(Number(match[1]) - 1);
    }
    if (/\b(esimene|first)\b/.test(normalized)) indexes.push(0);
    if (/\b(teine|second)\b/.test(normalized)) indexes.push(1);
    if (/\b(kolmas|third)\b/.test(normalized)) indexes.push(2);

    if (!indexes.length) {
      const selectionIndex = parseOrdinalSelection(message, browseResults.length);
      if (selectionIndex != null) {
        indexes.push(selectionIndex);
      }
    }

    if (!indexes.length && max === 1 && /\b(uhenda|yhenda|connect|match|contact)\b/.test(normalized)) {
      indexes.push(0);
    }

    return uniqueIndexes(indexes, max)
      .map((index) => browseResults[index] || null)
      .filter(Boolean);
  }

  function isCreateHelpIntent(intent = "") {
    return intent === "create_help_request" || intent === "create_help_offer";
  }

  function isBrowseHelpIntent(intent = "") {
    return intent === "browse_help_offers" || intent === "browse_help_requests";
  }

  function isConnectHelpIntent(intent = "") {
    return intent === "connect_to_offer" || intent === "connect_to_request";
  }

  async function handleBrowseTurn({ state, replyLang, prismaClient }) {
    const intent = browseIntentFromState(state);
    const sourceId = intent === "browse_help_offers" ? state.linkedRequestId || state.sourceRecordId : state.linkedOfferId || state.sourceRecordId;

    if (!sourceId) {
      return {
        handled: true,
        workflowState: state,
        reply: helpWorkflowT(replyLang, intent === "browse_help_offers" ? "browse.sourceMissingOffers" : "browse.sourceMissingRequests"),
        cards: [],
        attachments: []
      };
    }

    const rawResults = intent === "browse_help_offers"
      ? await listMatchingOffersForRequest(sourceId, { limit: 5 }, prismaClient)
      : await listMatchingRequestsForOffer(sourceId, { limit: 5 }, prismaClient);
    const alternativeResults = !rawResults.length
      ? (intent === "browse_help_offers"
          ? await listAlternativeOffersForRequest(sourceId, { limit: 5 }, prismaClient)
          : await listAlternativeRequestsForOffer(sourceId, { limit: 5 }, prismaClient))
      : [];
    const results = decorateBrowseResults(
      rawResults.length ? rawResults : alternativeResults,
      state?.draft || {},
      replyLang
    );

    const nextState = createHelpWorkflowDraftState({
      ...state,
      mode: "browse",
      step: "browse",
      intent,
      sourceRecordId: sourceId,
      browseResults: results,
      confirmationPending: false,
      candidateRequestId: null,
      candidateOfferId: null,
      candidateMatches: []
    });

    return {
      handled: true,
      workflowState: nextState,
      reply: buildBrowseReply(intent, results, replyLang),
      cards: [],
      attachments: []
    };
  }

  function findSelectedBrowseResult(state, requestId = "", offerId = "") {
    return (state?.browseResults || []).find((item) => (
      (item.kind === "offer" && item.id === offerId)
      || (item.kind === "request" && item.id === requestId)
    )) || null;
  }

  async function handleConnectTurn({ state, message, replyLang, prismaClient }) {
    const pendingSelections = readPendingMatchSelections(state, replyLang);
    if (state.confirmationPending && pendingSelections.length) {
      if (isAffirmative(message)) {
        const { matches, failureCount } = await createMatchesForSelections(pendingSelections, prismaClient, {
          allowSoftFailures: true
        });
        const nextState = createHelpWorkflowDraftState({
          ...state,
          mode: matches.length ? "done" : "browse",
          step: "connect",
          matchId: matches[0]?.id || null,
          roomId: matches[0]?.roomId || null,
          confirmationPending: false,
          candidateRequestId: null,
          candidateOfferId: null,
          candidateMatches: []
        });

        return {
          handled: true,
          workflowState: nextState,
          reply: buildCreatedReply(replyLang, matches.length, failureCount),
          cards: [],
          attachments: []
        };
      }

      if (isNegative(message)) {
        const nextState = createHelpWorkflowDraftState({
          ...state,
          mode: "browse",
          step: "browse",
          intent: browseIntentFromState(state),
          confirmationPending: false,
          candidateRequestId: null,
          candidateOfferId: null,
          candidateMatches: []
        });
        return {
          handled: true,
          workflowState: nextState,
          reply: helpWorkflowT(replyLang, "connect.cancelledSoftMatch"),
          cards: [],
          attachments: []
        };
      }

      return {
        handled: true,
        workflowState: state,
        reply: buildSoftMatchConfirmationReply(replyLang, pendingSelections),
        cards: [],
        attachments: []
      };
    }

    if (!state.browseResults?.length) {
      return {
        handled: true,
        workflowState: state,
        reply: helpWorkflowT(replyLang, "connect.needBrowse"),
        cards: [],
        attachments: []
      };
    }

    const selectedItems = resolveBrowseSelections(message, state.browseResults);
    if (!selectedItems.length) {
      return {
        handled: true,
        workflowState: state,
        reply: helpWorkflowT(replyLang, "connect.askWhich"),
        cards: [],
        attachments: []
      };
    }

    const selections = buildPendingMatchSelections(state, selectedItems, replyLang);
    const hardSelections = selections.filter((item) => !item.requiresConfirmation);
    const softSelections = selections.filter((item) => item.requiresConfirmation);
    const { matches, failureCount } = await createMatchesForSelections(hardSelections, prismaClient);
    const createdReply = buildCreatedReply(replyLang, matches.length, failureCount);

    if (softSelections.length) {
      const nextState = createHelpWorkflowDraftState({
        ...state,
        mode: "browse",
        step: "connect",
        intent: connectIntentFromBrowseIntent(browseIntentFromState(state)),
        candidateRequestId: softSelections[0]?.requestId || null,
        candidateOfferId: softSelections[0]?.offerId || null,
        candidateMatches: softSelections.map((item) => ({
          requestId: item.requestId,
          offerId: item.offerId
        })),
        matchId: matches[0]?.id || state.matchId || null,
        roomId: matches[0]?.roomId || state.roomId || null,
        confirmationPending: true
      });
      return {
        handled: true,
        workflowState: nextState,
        reply: buildSoftMatchConfirmationReply(
          replyLang,
          softSelections,
          { prefix: hardSelections.length ? createdReply : "" }
        ),
        cards: [],
        attachments: []
      };
    }

    return {
      handled: true,
      workflowState: createHelpWorkflowDraftState({
        ...state,
        mode: matches.length ? "done" : state.mode,
        step: "connect",
        matchId: matches[0]?.id || state.matchId || null,
        roomId: matches[0]?.roomId || state.roomId || null,
        candidateRequestId: null,
        candidateOfferId: null,
        candidateMatches: [],
        confirmationPending: false
      }),
      reply: createdReply,
      cards: [],
      attachments: []
    };
  }

  return {
    buildBrowseReply,
    buildSavedReply,
    handleBrowseTurn,
    handleConnectTurn,
    isBrowseHelpIntent,
    isConnectHelpIntent,
    isCreateHelpIntent,
    saveStructuredRecord
  };
}
