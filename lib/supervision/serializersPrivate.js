/**
 * PRIVAATNE serializer-perekond — eeskamber (M6) ja isiklik püsiväljund (M12).
 *
 * KRIITILINE INVARIANT (Q2.2 M6/M12, Q2.3): seda faili EI TOHI importida ükski
 * JAGATUD vaate kood (service.js, serializers.js, topics.js, meetings.js,
 * summaries.js). Ainsad lubatud importijad: privateItems.js, outcomes/closure
 * (M12) ja nende route'id. Nii ei saa privaatsisu KUNAGI sattuda protsessi
 * jagatud vastusesse (CovisionPrivateState eraldatuse põhjendus, schema:2155).
 * CI-grep jõustab piirangu (test SUP-P3 invariant).
 */

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** M6 eeskambri kirje — nähtav AINULT omanikule. */
export function serializePrivateItem(item) {
  return {
    id: item.id,
    processId: item.processId,
    kind: item.kind,
    title: item.title ?? null,
    body: item.body,
    sharedTopicId: item.sharedTopicId ?? null,
    sourceKind: item.sourceKind,
    sourceWellbeingDraftId: item.sourceWellbeingDraftId ?? null,
    version: item.version,
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt)
  };
}

/** M12 isiklik püsiväljund — nähtav AINULT omanikule; elab protsessi üle. */
export function serializePersonalOutcome(outcome) {
  return {
    id: outcome.id,
    processId: outcome.processId ?? null,
    processTitleGeneralized: outcome.processTitleGeneralized,
    content: outcome.contentJson ?? null,
    createdAt: iso(outcome.createdAt)
  };
}
