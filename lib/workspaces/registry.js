/**
 * K1 workspace kinds are application-level constants. They deliberately do
 * not mirror a Prisma or PostgreSQL enum: an adapter owns the mapping from an
 * existing module model to this registry.
 */
export const WorkspaceKind = Object.freeze({
  ROOM: "room",
  COVISION_CASE: "covision_case",
  JOURNEY: "journey",
  PRE_INQUIRY: "pre_inquiry",
  WELLBEING_SPACE: "wellbeing_space",
  SUPERVISION_PROCESS: "supervision_process",
  MENTORING_PROCESS: "mentoring_process",
  TOPIC_SEED: "topic_seed",
  MEETING: "meeting",
  NETWORK_CASE: "network_case",
  FIELD_VISIT: "field_visit",
  ORG_SPACE: "org_space",
  CASE_WORK: "case_work",
  PRACTICE_REFLECTION: "practice_reflection"
});

export const WorkspaceKindStatus = Object.freeze({
  SUPPORTED: "SUPPORTED",
  RESERVED: "RESERVED"
});

function entry(kind, status, adapter = null) {
  return Object.freeze({ kind, status, adapter });
}

/**
 * The two K1-P0 adapters are supported now. Every other approved V1 kind is
 * reserved here so a caller cannot mistake the absence of an adapter for an
 * unregistered kind.
 */
export const WORKSPACE_KIND_REGISTRY = Object.freeze({
  [WorkspaceKind.ROOM]: entry(WorkspaceKind.ROOM, WorkspaceKindStatus.SUPPORTED, "room"),
  [WorkspaceKind.COVISION_CASE]: entry(
    WorkspaceKind.COVISION_CASE,
    WorkspaceKindStatus.SUPPORTED,
    "covision"
  ),
  [WorkspaceKind.JOURNEY]: entry(WorkspaceKind.JOURNEY, WorkspaceKindStatus.SUPPORTED, "journey"),
  [WorkspaceKind.PRE_INQUIRY]: entry(WorkspaceKind.PRE_INQUIRY, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.WELLBEING_SPACE]: entry(
    WorkspaceKind.WELLBEING_SPACE,
    WorkspaceKindStatus.SUPPORTED,
    "wellbeing"
  ),
  [WorkspaceKind.SUPERVISION_PROCESS]: entry(
    WorkspaceKind.SUPERVISION_PROCESS,
    WorkspaceKindStatus.RESERVED
  ),
  [WorkspaceKind.MENTORING_PROCESS]: entry(
    WorkspaceKind.MENTORING_PROCESS,
    WorkspaceKindStatus.SUPPORTED,
    "mentoring"
  ),
  [WorkspaceKind.TOPIC_SEED]: entry(WorkspaceKind.TOPIC_SEED, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.MEETING]: entry(WorkspaceKind.MEETING, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.NETWORK_CASE]: entry(WorkspaceKind.NETWORK_CASE, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.FIELD_VISIT]: entry(
    WorkspaceKind.FIELD_VISIT,
    WorkspaceKindStatus.SUPPORTED,
    "fieldVisit"
  ),
  [WorkspaceKind.ORG_SPACE]: entry(WorkspaceKind.ORG_SPACE, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.CASE_WORK]: entry(WorkspaceKind.CASE_WORK, WorkspaceKindStatus.RESERVED),
  [WorkspaceKind.PRACTICE_REFLECTION]: entry(
    WorkspaceKind.PRACTICE_REFLECTION,
    WorkspaceKindStatus.RESERVED
  )
});

export const WORKSPACE_KINDS = Object.freeze(Object.keys(WORKSPACE_KIND_REGISTRY));
export const SUPPORTED_WORKSPACE_KINDS = Object.freeze(
  WORKSPACE_KINDS.filter(
    (kind) => WORKSPACE_KIND_REGISTRY[kind].status === WorkspaceKindStatus.SUPPORTED
  )
);
export const RESERVED_WORKSPACE_KINDS = Object.freeze(
  WORKSPACE_KINDS.filter(
    (kind) => WORKSPACE_KIND_REGISTRY[kind].status === WorkspaceKindStatus.RESERVED
  )
);

export function isWorkspaceKind(value) {
  return typeof value === "string" && Object.hasOwn(WORKSPACE_KIND_REGISTRY, value);
}

export function getWorkspaceKind(value) {
  return isWorkspaceKind(value) ? WORKSPACE_KIND_REGISTRY[value] : null;
}

export function assertWorkspaceKind(value) {
  if (!isWorkspaceKind(value)) {
    const error = new Error("Unknown workspace kind");
    error.code = "UNKNOWN_WORKSPACE_KIND";
    throw error;
  }
  return value;
}
