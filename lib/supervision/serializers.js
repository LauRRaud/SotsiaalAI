/**
 * Vaatajapõhised serializer'id (Q2.3 / Q2.4). PÕHIMÕTE: iga vastus EHITATAKSE
 * vaataja rolli järgi, mitte ei kärbita täisobjektist. Nii ei saa uus mudeliväli
 * vaikimisi lekkida — S-kategooria testid võrdlevad TÄPSET võtmehulka (Q2.10).
 *
 * NB: privaatne eeskamber (M6) ja isiklik pakk (M12) EI serialiseerita SIIN —
 * need elavad `serializersPrivate.js`-s, mida jagatud vaated EI impordi
 * (CovisionPrivateState eraldatuse põhjendus). Vt SUP-P3 invariant + CI-grep.
 */

// Vaataja suhe protsessiga. OS_STALE = OS†: ACCEPTED, aga aktiivse
// kontraktiversiooni kinnitus puudu (uus versioon ootab). VÕÕR ei jõua siia —
// teenusekiht viskab 404 enne serialiseerimist.
export const VIEWER_ROLES = Object.freeze({
  SV: "SV",
  OS: "OS",
  OS_STALE: "OS_STALE",
  KUT: "KUT",
  LAHK: "LAHK"
});

const MEMBER_ROLES = new Set([VIEWER_ROLES.SV, VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE, VIEWER_ROLES.LAHK]);

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function time(value) {
  if (!value) return NaN;
  const d = value instanceof Date ? value : new Date(value);
  return d.getTime();
}

/** Nimi profiilist; fallback e-post; kustutatud → null (mentoring partyView muster). */
export function personName(user) {
  if (!user) return null;
  const first = user.profile?.firstName || "";
  const last = user.profile?.lastName || "";
  return `${first} ${last}`.trim() || user.email || null;
}

export function serializeContractVersion(version, { includeBody = true } = {}) {
  if (!version) return null;
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    activatedAt: iso(version.activatedAt),
    createdAt: iso(version.createdAt),
    ...(includeBody ? { body: version.body } : {})
  };
}

function serializeParticipant(participation, user) {
  return {
    id: participation.id,
    userId: participation.userId,
    name: personName(user),
    status: participation.status,
    respondedAt: iso(participation.respondedAt),
    leftAt: iso(participation.leftAt)
  };
}

export function serializeMeeting(meeting) {
  return {
    id: meeting.id,
    seq: meeting.seq,
    status: meeting.status,
    plannedAt: iso(meeting.plannedAt),
    heldAt: iso(meeting.heldAt),
    note: meeting.note ?? null,
    agendaTopicIds: Array.isArray(meeting.agendaTopicIds) ? [...meeting.agendaTopicIds] : [],
    topicCountAtClose: meeting.topicCountAtClose ?? null,
    version: meeting.version
  };
}

export function serializeTopic(topic) {
  return {
    id: topic.id,
    authorParticipationId: topic.authorParticipationId,
    authorType: topic.authorSupervisorUserId ? "SUPERVISOR"
      : topic.authorParticipationId ? "PARTICIPANT" : "DELETED",
    title: topic.title,
    body: topic.body,
    audience: topic.audience,
    sourceKind: topic.sourceKind,
    status: topic.status,
    sharedAt: iso(topic.sharedAt),
    version: topic.version
  };
}

export function serializeSummary(summary, approvals) {
  const rows = (approvals || []).filter((a) => a.summaryId === summary.id);
  return {
    id: summary.id,
    kind: summary.kind,
    meetingId: summary.meetingId ?? null,
    status: summary.status,
    body: summary.body,
    submittedAt: iso(summary.submittedAt),
    approvedAt: iso(summary.approvedAt),
    version: summary.version,
    approvals: rows.map((a) => ({ participationId: a.participationId, approvedAt: iso(a.approvedAt) }))
  };
}

function serializeClosure(closure) {
  if (!closure) return null;
  return {
    closedAt: iso(closure.closedAt),
    facts: closure.factsJson ?? null,
    purgeReport: closure.purgeReport ?? null,
    retentionStatus: closure.retentionStatus || "AWAITING_POLICY"
  };
}

/**
 * KUT (kutsutu, vastamata) piiratud kaart (Q2.3 ¹): AINULT protsessi pealkiri,
 * superviisori nimi, tüüp, aktiivne kontraktitekst, oma osaluse staatus.
 * EI osalejaid, teemasid, kohtumisi, kokkuvõtteid.
 */
function buildInvitedCard(process, { supervisor, activeContract, participation }) {
  return {
    id: process.id,
    viewerRole: VIEWER_ROLES.KUT,
    title: process.title,
    type: process.type,
    supervisorName: personName(supervisor),
    activeContract: activeContract
      ? { id: activeContract.id, versionNumber: activeContract.versionNumber, body: activeContract.body }
      : null,
    myParticipation: { id: participation.id, status: participation.status }
  };
}

function computeCapabilities(role, process, { hasValidAcceptance = false } = {}) {
  const isSv = role === VIEWER_ROLES.SV;
  const isOs = role === VIEWER_ROLES.OS;
  const open = process.status !== "CLOSED";
  return {
    canEditProcess: isSv && open,
    canManageContract: isSv && open,
    canInvite: isSv && open,
    canPlanMeeting: isSv && open,
    canCreateSummary: isSv && open,
    canShareTopic: (isSv || (isOs && hasValidAcceptance)) && open,
    canApproveSummary: isOs && hasValidAcceptance && open,
    canLeave: [VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE].includes(role) && open,
    canManagePrivateItems: MEMBER_ROLES.has(role) && role !== VIEWER_ROLES.LAHK,
    canClose: isSv && open,
    canRespondInvite: false
  };
}

/**
 * Liikmevaade (SV/OS/OS†/LAHK). Stabiilne võtmehulk kõigi liikmerollide üleselt —
 * erinevus on VÄÄRTUSTES (nt DRAFT-kokkuvõtted ainult SV-le; capabilities). LAHK
 * näeb ainult leftAt-i eelset sisu (footnote²): teemad/kohtumised/kokkuvõtted
 * filtreeritakse leftAt järgi.
 */
function buildMemberDetail(process, viewer, data) {
  const {
    supervisor, activeContract, contractVersions = [],
    participants = [], topics = [], meetings = [], summaries = [],
    approvals = [], closure = null
  } = data;
  const { role, participation, hasValidAcceptance = false } = viewer;
  const isSv = role === VIEWER_ROLES.SV;
  const leftCutoff = role === VIEWER_ROLES.LAHK && participation?.leftAt ? time(participation.leftAt) : null;
  const beforeLeft = (row) => leftCutoff == null || time(row.createdAt) <= leftCutoff;
  const unchangedSinceLeft = (row) => leftCutoff == null || time(row.updatedAt ?? row.createdAt) <= leftCutoff;

  // Teemad: ainult SHARED; audience=PROCESS kõigile, SUPERVISOR_ONLY ainult
  // autorile + SV-le. LAHK: ainult leftAt-i eelsed.
  const visibleTopics = topics.filter((topic) => {
    if (topic.status !== "SHARED") return false;
    if (!beforeLeft(topic)) return false;
    if (topic.audience === "PROCESS") return true;
    if (isSv) return true;
    return participation && topic.authorParticipationId === participation.id;
  });

  // Kokkuvõtted: SV näeb ka DRAFT-i; teised ainult PENDING_APPROVAL/APPROVED.
  // LAHK ainult APPROVED ja leftAt-i eelsed.
  const visibleSummaries = summaries.filter((summary) => {
    if (!unchangedSinceLeft(summary)) return false;
    if (isSv) return summary.status !== "DISCARDED";
    if (role === VIEWER_ROLES.LAHK) return summary.status === "APPROVED";
    return summary.status === "PENDING_APPROVAL" || summary.status === "APPROVED";
  });

  const visibleMeetings = meetings.filter(unchangedSinceLeft);

  return {
    id: process.id,
    viewerRole: role,
    title: process.title,
    type: process.type,
    status: process.status,
    goal: process.goal ?? null,
    plannedMeetingCount: process.plannedMeetingCount,
    version: process.version,
    supervisorName: personName(supervisor),
    myParticipation: isSv
      ? null
      : { id: participation.id, status: participation.status, hasAcceptedActiveContract: hasValidAcceptance },
    activeContract: activeContract
      ? serializeContractVersion(activeContract, { includeBody: true })
      : null,
    // Versiooniajaloo näeb ainult SV; teistele piisab aktiivsest.
    contractVersions: isSv ? contractVersions.map((v) => serializeContractVersion(v, { includeBody: false })) : [],
    participants: participants.map(({ participation: p, user }) => serializeParticipant(p, user)),
    topics: visibleTopics.map(serializeTopic),
    meetings: visibleMeetings.map(serializeMeeting),
    summaries: visibleSummaries.map((s) => serializeSummary(s, approvals)),
    closure: serializeClosure(closure),
    capabilities: computeCapabilities(role, process, { hasValidAcceptance })
  };
}

/**
 * Peasissepääs: valib vaataja rolli järgi õige ehitaja. `data` sisaldab
 * teenusekihi laetud seoseid (supervisor, activeContract, participants[],
 * topics[], meetings[], summaries[], approvals[], closure).
 */
export function serializeProcessForViewer(process, viewer, data = {}) {
  if (viewer.role === VIEWER_ROLES.KUT) {
    return buildInvitedCard(process, {
      supervisor: data.supervisor,
      activeContract: data.activeContract,
      participation: viewer.participation
    });
  }
  return buildMemberDetail(process, viewer, data);
}

/** Loendikaart „Minu protsessid" (vaade 1). Kerge; ei kanna sisu. */
export function serializeProcessCard(process, { role, participation, supervisor }) {
  return {
    id: process.id,
    title: process.title,
    type: process.type,
    status: process.status,
    viewerRole: role,
    supervisorName: personName(supervisor),
    myParticipationStatus: participation?.status ?? null,
    updatedAt: iso(process.updatedAt),
    lastActivityAt: iso(process.lastActivityAt)
  };
}
