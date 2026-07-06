const HELP_LISTINGS_RETURN_TARGETS = Object.freeze({
  chat: "chat",
  profile: "profile",
  workspace: "workspace"
});

export function getHelpListingsReturnTarget(source = "chat") {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === HELP_LISTINGS_RETURN_TARGETS.profile) {
    return HELP_LISTINGS_RETURN_TARGETS.profile;
  }
  if (normalized === HELP_LISTINGS_RETURN_TARGETS.workspace) {
    return HELP_LISTINGS_RETURN_TARGETS.workspace;
  }
  return HELP_LISTINGS_RETURN_TARGETS.chat;
}
