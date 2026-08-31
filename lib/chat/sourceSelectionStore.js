import { bindSourceSelection, normalizeSourceSelection, projectSourceSelectionBinding,
  sameSourceSelectionBinding, sourceSelectionBindingMatches, sourceSelectionOperationMatches } from "./sourceSelection.js";

const ownerWhere = (conversationId, userId) => ({ conversationId, conversation: { userId } });
const latestWhere = (conversationId, userId) => ({ where: ownerWhere(conversationId, userId),
  orderBy: [{ createdAt: "desc" }, { id: "desc" }] });

async function readOffer(db, { conversationId, userId, issuingMessageId }) {
  const issuer = await db.conversationMessage.findFirst({ where: {
    ...ownerWhere(conversationId, userId), id: issuingMessageId, role: "ASSISTANT" } });
  const state = issuer?.metadata?.workflow?.ragRecovery;
  const offer = normalizeSourceSelection(state?.sourceSelection);
  if (!offer || !sourceSelectionOperationMatches(offer, state.rootUserMessageId)) return null;
  const [root, completed] = await Promise.all([
    db.conversationMessage.findFirst({ where: { ...ownerWhere(conversationId, userId),
      id: state.rootUserMessageId, role: "USER" } }),
    db.chatTurn.findFirst({ where: { conversationId, userId, status: "COMPLETED", assistantMessageId: issuingMessageId } })
  ]);
  if (!root?.content || !completed) return null;
  return { offer, rootUserMessageId: root.id, rootMessage: root.content, issuingMessageId };
}

// Reads only owned server rows. A retry restores the exact previous attempt's
// binding; neither client history nor a supplied document ID can create one.
export async function readSourceSelectionContext(db, { conversationId, userId, clientTurnKey, message, now = Date.now() }) {
  const [latest, turn] = await Promise.all([
    db.conversationMessage.findFirst(latestWhere(conversationId, userId)),
    db.chatTurn.findUnique({ where: { userId_clientTurnKey: { userId, clientTurnKey } } })
  ]);
  if (turn && turn.conversationId !== conversationId) return { stale: true };
  const previous = turn && turn.status !== "COMPLETED" ? await db.ragAttempt.findFirst({
    where: { chatTurnId: turn.id, attempt: turn.attempt, chatTurn: { conversationId, userId } }
  }) : null;
  const stored = previous?.evidence?.source_selection_binding;
  const previousBinding = projectSourceSelectionBinding(stored);
  if (stored && !previousBinding) return { stale: true };
  if (turn && !previousBinding) return null; // An old intent cannot adopt a later offer.
  if (previousBinding && ![previousBinding.issuingMessageId, previous.userMessageId, previous.assistantMessageId].filter(Boolean).includes(latest?.id)) return { stale: true };
  const issuingMessageId = previousBinding?.issuingMessageId || latest?.id;
  if (!issuingMessageId) return null;
  const context = await readOffer(db, { conversationId, userId, issuingMessageId });
  if (!context) return previousBinding || latest?.metadata?.workflow?.ragRecovery?.target === "source_selection" ? { stale: true } : null;
  const binding = previousBinding || bindSourceSelection(message, context.offer, issuingMessageId, now);
  if (!binding) return null; // A genuinely new question leaves the offer.
  if (!sourceSelectionBindingMatches(binding, context.offer, message, { now, allowExpired: !!previousBinding })) return { stale: true };
  return { ...context, binding, expectedLatestMessageId: latest.id,
    history: [{ role: "user", text: context.rootMessage }] };
}

// Called while holding the conversation advisory lock, before any mutation.
export async function sourceSelectionClaimMatches(db, { conversationId, userId, userMessage,
  sourceSelectionBinding, expectedPreviousAssistantMessageId, existingTurn = null, now = new Date() }) {
  const previous = existingTurn ? await db.ragAttempt.findFirst({
    where: { chatTurnId: existingTurn.id, attempt: existingTurn.attempt, chatTurn: { conversationId, userId } }
  }) : null;
  const stored = previous?.evidence?.source_selection_binding;
  if (existingTurn && sourceSelectionBinding && !stored) return false;
  if (stored && !sameSourceSelectionBinding(stored, sourceSelectionBinding)) return false;
  if (!sourceSelectionBinding) return !stored;
  const binding = projectSourceSelectionBinding(sourceSelectionBinding);
  if (!binding || !expectedPreviousAssistantMessageId) return false;
  if (stored && ![binding.issuingMessageId, previous.userMessageId, previous.assistantMessageId].filter(Boolean).includes(expectedPreviousAssistantMessageId)) return false;
  if (!stored && expectedPreviousAssistantMessageId !== binding.issuingMessageId) return false;
  const offer = await readOffer(db, { conversationId, userId, issuingMessageId: binding.issuingMessageId });
  return !!offer && sourceSelectionBindingMatches(binding, offer.offer, userMessage, { now: now.getTime(), allowExpired: !!stored });
}
