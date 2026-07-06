export function shouldUseHelpWorkflowMode({
  userId,
  roomId,
  forcedMode = null,
  explicitHelpModeActive = false,
  helpWorkflowActive = false,
  inactiveHelpStateCanResume = false
} = {}) {
  return Boolean(
    userId &&
    !roomId &&
    forcedMode !== "document" &&
    (
      helpWorkflowActive ||
      explicitHelpModeActive ||
      (!forcedMode && inactiveHelpStateCanResume)
    )
  );
}

