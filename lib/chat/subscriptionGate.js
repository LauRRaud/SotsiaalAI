const FREE_HELP_CHAT_INTENTS = new Set([
  "create_help_request",
  "create_help_offer",
  "browse_help_requests",
  "browse_help_offers",
  "connect_to_offer",
  "connect_to_request"
]);

export function shouldAllowChatWithoutSubscription({
  roomId,
  requestedChatMode = null,
  explicitHelpIntent = null,
  detectedHelpIntent = null,
  helpWorkflowState = null,
  helpWorkflowActive = false
} = {}) {
  if (roomId) return false;

  if (requestedChatMode === "help_request" || requestedChatMode === "help_offer") {
    return true;
  }

  if (FREE_HELP_CHAT_INTENTS.has(String(explicitHelpIntent || "").trim())) {
    return true;
  }

  if (FREE_HELP_CHAT_INTENTS.has(String(detectedHelpIntent || "").trim())) {
    return true;
  }

  const stateIntent = String(helpWorkflowState?.intent || "").trim();
  if (helpWorkflowActive && FREE_HELP_CHAT_INTENTS.has(stateIntent)) {
    return true;
  }

  return false;
}
