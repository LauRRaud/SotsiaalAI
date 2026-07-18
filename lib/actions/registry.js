import { assertWorkspaceKind, WorkspaceKind } from "@/lib/workspaces/registry";

const SAFE_TARGET_ID = /^[A-Za-z0-9._:-]+$/u;

export const ActionKind = Object.freeze({
  OPEN_PRE_INQUIRY_RECEIVED: "open_pre_inquiry_received",
  OPEN_PRE_INQUIRY_SENT: "open_pre_inquiry_sent",
  OPEN_ROOM: "open_room",
  OPEN_PRACTICE: "open_practice",
  OPEN_SERVICE_PROFILE: "open_service_profile",
  OPEN_WORKSPACE: "open_workspace",
  OPEN_MY_SHARINGS: "open_my_sharings",
  OPEN_WELLBEING: "open_wellbeing",
  OPEN_LISTING: "open_listing",
  OPEN_INVITE: "open_invite",
  OPEN_PROFILE: "open_profile",
  OPEN_LIST: "open_list"
});

function targetId(target, expectedPrefix = null) {
  const raw = String(target || "").trim();
  const prefix = expectedPrefix ? `${expectedPrefix}:` : "";
  const value = prefix && raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!value || value.length > 240 || !SAFE_TARGET_ID.test(value)) {
    const error = new Error("Invalid action target");
    error.code = "INVALID_ACTION_TARGET";
    throw error;
  }
  return value;
}

const entry = (route, options = {}) => Object.freeze({ route, ...options });

export const ACTION_REGISTRY = Object.freeze({
  [ActionKind.OPEN_PRE_INQUIRY_RECEIVED]: entry((target) => `/eelpoordumised?openInquiry=${encodeURIComponent(targetId(target, "pre_inquiry"))}`),
  [ActionKind.OPEN_PRE_INQUIRY_SENT]: entry((target) => `/eelpoordumised?openInquiry=${encodeURIComponent(targetId(target, "pre_inquiry"))}`),
  [ActionKind.OPEN_ROOM]: entry((target) => `/vestlus?roomId=${encodeURIComponent(targetId(target, "room"))}`),
  [ActionKind.OPEN_PRACTICE]: entry((target) => `/parimad-praktikad?practice=${encodeURIComponent(targetId(target, "practice"))}`),
  [ActionKind.OPEN_SERVICE_PROFILE]: entry(() => "/teenuseprofiil"),
  [ActionKind.OPEN_MY_SHARINGS]: entry(() => "/minu-jagamised"),
  [ActionKind.OPEN_WELLBEING]: entry(() => "/tooheaolu"),
  [ActionKind.OPEN_LISTING]: entry((target) => `/teenusekaart?listing=${encodeURIComponent(targetId(target, "listing"))}`),
  [ActionKind.OPEN_INVITE]: entry((target) => `/join?invite=${encodeURIComponent(targetId(target, "invite"))}`),
  [ActionKind.OPEN_PROFILE]: entry(() => "/profiil"),
  [ActionKind.OPEN_LIST]: entry(() => "/vestlus"),
  [ActionKind.OPEN_WORKSPACE]: entry((target) => {
    const raw = String(target || "").trim();
    const separator = raw.indexOf(":");
    if (separator < 1) throw Object.assign(new Error("Invalid workspace target"), { code: "INVALID_ACTION_TARGET" });
    const kind = raw.slice(0, separator);
    const id = targetId(raw.slice(separator + 1));
    assertWorkspaceKind(kind);
    if (kind === WorkspaceKind.ROOM) return `/vestlus?roomId=${encodeURIComponent(id)}`;
    if (kind === WorkspaceKind.COVISION_CASE) return `/kovisioon?caseId=${encodeURIComponent(id)}`;
    if (kind === WorkspaceKind.JOURNEY) return `/teekond/${encodeURIComponent(id)}`;
    if (kind === WorkspaceKind.PRE_INQUIRY) return `/eelpoordumised?openInquiry=${encodeURIComponent(id)}`;
    throw Object.assign(new Error("Workspace action is not supported"), { code: "UNSUPPORTED_WORKSPACE_ACTION" });
  })
});

export function isActionKind(value) {
  return typeof value === "string" && Object.hasOwn(ACTION_REGISTRY, value);
}

export function assertActionKind(value) {
  if (!isActionKind(value)) {
    const error = new Error("Unknown action kind");
    error.code = "UNKNOWN_ACTION_KIND";
    throw error;
  }
  return value;
}

export function buildActionHref(kind, target = "") {
  assertActionKind(kind);
  return ACTION_REGISTRY[kind].route(target);
}
