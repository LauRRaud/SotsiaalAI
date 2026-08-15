import {
  SUPERVISION_ACTIONS as ACTIONS,
  assertAllowedKeys,
  conflict,
  normalizeText,
  notFound,
  recordSupervisionAudit,
  requireExpectedVersion,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  withSupervisionProcessLock
} from "./shared.js";
import {
  getProcessDetail,
  loadProcessForViewer,
  requireSupervisorContext
} from "./service.js";
import { VIEWER_ROLES } from "./serializers.js";
import { notifyClosed } from "./notifications.js";

/**
 * M11/M12 sulgemine + purge (Q2.5) — KÕRGEIM RISK. Kogu järjestus 1–10 toimub
 * ÜHES advisory-lukustatud tehingus: kas KÕIK õnnestub või täisrollback
 * (pool-suletud olekut ei eksisteeri KUNAGI). Kustub jagatud TOORSISU (M7 teemad,
 * M8.note, M9 DRAFT/DISCARDED); ALLES jäävad kinnitatud väljundid (M9 APPROVED),
 * kontraktiraam (M3+M5), faktijälg (M8 faktid, M11) ja igaühe privaatne pakk (M12).
 * M6 eeskambrit EI puutu. Retention = AWAITING_POLICY (otsus 12, EI scheduler'it).
 */

function isoOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function timeOf(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

export async function closePreview({ processId, session }, options = {}) {
  const db = resolveDb(options);
  const { userId } = requireSupervisionUser(session);
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (![VIEWER_ROLES.SV, VIEWER_ROLES.OS, VIEWER_ROLES.OS_STALE].includes(viewer.role)) throw notFound();

  const [summaries, topics, meetings, closure, participations, contractVersions, auditEvents] = await Promise.all([
    db.supervisionSummary.findMany({ where: { processId: process.id } }),
    db.supervisionSharedTopic.findMany({ where: { processId: process.id } }),
    db.supervisionMeeting.findMany({ where: { processId: process.id } }),
    db.supervisionClosure.findUnique({ where: { processId: process.id } }),
    db.supervisionParticipation.findMany({ where: { processId: process.id } }),
    db.supervisionContractVersion.findMany({ where: { processId: process.id } }),
    db.supervisionAuditEvent.findMany({ where: { processId: process.id } })
  ]);
  const acceptances = contractVersions.length
    ? await db.supervisionContractAcceptance.findMany({
        where: { contractVersionId: { in: contractVersions.map((row) => row.id) } }
      })
    : [];
  const isSupervisor = viewer.role === VIEWER_ROLES.SV;
  const visibleTopics = isSupervisor ? topics : topics.filter((topic) => (
    topic.status === "SHARED" && (
      topic.audience === "PROCESS" || topic.authorParticipationId === viewer.participation?.id
    )
  ));
  const visibleSummaries = isSupervisor
    ? summaries.filter((summary) => summary.status !== "DISCARDED")
    : summaries.filter((summary) => ["PENDING_APPROVAL", "APPROVED"].includes(summary.status));
  const pending = visibleSummaries.filter((s) => s.status === "PENDING_APPROVAL");
  const deletableSummaryCount = isSupervisor
    ? summaries.filter((summary) => ["DRAFT", "DISCARDED"].includes(summary.status)).length
    : visibleSummaries.filter((summary) => ["DRAFT", "DISCARDED"].includes(summary.status)).length;
  const alreadyClosed = Boolean(closure) || process.status === "CLOSED";
  const accepted = participations.filter((row) => row.status === "ACCEPTED");

  return {
    ok: true,
    preview: {
      retentionManifestVersion: 1,
      alreadyClosed,
      canClose: isSupervisor && !alreadyClosed && pending.length === 0,
      pendingSummaryIds: pending.map((s) => s.id),
      willDelete: {
        sharedTopics: visibleTopics.length,
        draftSummaries: deletableSummaryCount,
        meetingNotes: meetings.filter((m) => m.note != null).length
      },
      willKeep: {
        approvedSummaries: visibleSummaries.filter((s) => s.status === "APPROVED").length,
        meetings: meetings.length,
        contractVersions: contractVersions.length,
        contractAcceptances: acceptances.length,
        auditEvents: auditEvents.length + (alreadyClosed ? 0 : 1),
        closureFacts: true,
        privateItems: true,
        personalOutcomes: process.status === "DRAFT" ? 0 : new Set([
          process.supervisorId,
          ...accepted.map((row) => row.userId)
        ].filter(Boolean)).size
      }
    }
  };
}

export async function closeProcess({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["expectedVersion", "generalizedTitle"]);
  // allowClosed: tuvastame juba-suletud oleku luku all ja 409-me puhtalt.
  const { process } = await requireSupervisorContext(db, processId, userId, { allowClosed: true });
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);
  const generalizedTitle = normalizeText(input?.generalizedTitle, { required: true, max: 200, field: "generalized_title" });

  await withSupervisionProcessLock(db, process.id, async (tx) => {
    // 1. Värske seis luku all + CAS
    const fresh = await tx.supervisionProcess.findUnique({ where: { id: process.id } });
    if (!fresh || fresh.supervisorId !== userId) throw notFound();
    // 9. Idempotentsus: closure olemas / juba CLOSED → 409, EI teist purge't/pakki
    const existingClosure = await tx.supervisionClosure.findUnique({ where: { processId: process.id } });
    if (existingClosure || fresh.status === "CLOSED") {
      throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
    }
    if (fresh.version !== expectedVersion) throw staleVersion();

    const isDraft = fresh.status === "DRAFT";

    // 2. Eeltingimused
    const summaries = await tx.supervisionSummary.findMany({ where: { processId: process.id } });
    const pending = summaries.filter((s) => s.status === "PENDING_APPROVAL");
    if (pending.length > 0) throw conflict("supervision.errors.pending_summaries", "PENDING_SUMMARIES");

    const participations = await tx.supervisionParticipation.findMany({ where: { processId: process.id } });
    const accepted = participations.filter((p) => p.status === "ACCEPTED");
    const meetings = await tx.supervisionMeeting.findMany({ where: { processId: process.id } });
    const topics = await tx.supervisionSharedTopic.findMany({ where: { processId: process.id } });
    const contractVersions = await tx.supervisionContractVersion.findMany({
      where: { processId: process.id }, orderBy: [{ versionNumber: "asc" }]
    });
    const activeContract = contractVersions.find((row) => row.id === fresh.activeContractVersionId) || null;

    // 3. Kinnitatud väljundid: kogu; kustuta DRAFT/DISCARDED
    const approvedSummaries = summaries.filter((s) => s.status === "APPROVED");
    const deletable = summaries.filter((s) => s.status === "DRAFT" || s.status === "DISCARDED");
    for (const summary of deletable) {
      await tx.supervisionSummary.delete({ where: { id: summary.id } });
    }

    // 6 (arvutus enne M12 jaoks). Faktijälg — AINULT arvud/kuupäevad.
    const heldTimes = meetings
      .filter((m) => m.status === "HELD")
      .map((m) => timeOf(m.heldAt))
      .filter((t) => t != null);
    const facts = {
      meetingsPlanned: meetings.length,
      meetingsHeld: meetings.filter((m) => m.status === "HELD").length,
      participantCount: accepted.length,
      firstHeldAt: heldTimes.length ? new Date(Math.min(...heldTimes)).toISOString() : null,
      lastHeldAt: heldTimes.length ? new Date(Math.max(...heldTimes)).toISOString() : null,
      approvedSummaryCount: approvedSummaries.length
    };

    // 4. Isiklikud püsiväljundid (M12) — igale ACCEPTED-osalusele + superviisorile.
    // DRAFT-protsessil sammud 3–4 vahele jäävad (kinnitatud väljundeid pole).
    if (!isDraft) {
      const baseContent = {
        approvedSummaries: approvedSummaries.map((s) => ({
          kind: s.kind, meetingId: s.meetingId || null, body: s.body, approvedAt: isoOrNull(s.approvedAt)
        })),
        facts
      };
      const acceptances = accepted.length ? await tx.supervisionContractAcceptance.findMany({
        where: { participationId: { in: accepted.map((row) => row.id) } }
      }) : [];
      const versionById = new Map(contractVersions.map((row) => [row.id, row]));
      const lastAcceptedByParticipation = new Map();
      for (const acceptance of acceptances) {
        const version = versionById.get(acceptance.contractVersionId);
        if (!version) continue;
        const previous = lastAcceptedByParticipation.get(acceptance.participationId);
        if (!previous || version.versionNumber > previous.versionNumber) {
          lastAcceptedByParticipation.set(acceptance.participationId, version);
        }
      }
      const owners = [
        { userId: fresh.supervisorId, contract: activeContract },
        ...accepted.filter((participation) => participation.userId).map((participation) => ({
          userId: participation.userId,
          contract: lastAcceptedByParticipation.get(participation.id) || null
        }))
      ];
      for (const owner of owners) {
        const content = {
          ...baseContent,
          lastAcceptedContractBody: owner.contract?.body || null
        };
        await tx.supervisionPersonalOutcome.create({
          data: {
            ownerUserId: owner.userId,
            processId: process.id,
            processTitleGeneralized: generalizedTitle,
            contentJson: content
          }
        });
      }
    }

    // 5. Jagatud toorsisu kustutus: M7 kõik; M8 note→NULL/agenda→[]/topicCountAtClose;
    //    M2 title←üldistatud, goal→NULL. M6 puutumata; M3/M5 jäävad.
    let meetingNotesCleared = 0;
    for (const topic of topics) {
      await tx.supervisionSharedTopic.delete({ where: { id: topic.id } });
    }
    for (const meeting of meetings) {
      if (meeting.note != null) meetingNotesCleared += 1;
      await tx.supervisionMeeting.update({
        where: { id: meeting.id },
        data: {
          note: null,
          agendaTopicIds: [],
          topicCountAtClose: Array.isArray(meeting.agendaTopicIds) ? meeting.agendaTopicIds.length : 0
        }
      });
    }
    const purgeReport = {
      sharedTopics: topics.length,
      draftSummaries: deletable.length,
      meetingNotes: meetingNotesCleared
    };

    // 7. Protsessi sulgemine
    await tx.supervisionProcess.update({
      where: { id: process.id },
      data: {
        title: generalizedTitle, goal: null, status: "CLOSED",
        closedAt: now, version: { increment: 1 }, lastActivityAt: now
      }
    });
    await tx.supervisionClosure.create({
      data: {
        processId: process.id, closedByUserId: userId, closedAt: now,
        factsJson: facts, purgeReport, retentionStatus: "AWAITING_POLICY"
      }
    });

    // 8. Audit (metadata = purgeReport arvud, MITTE sisu) + U1 teavitused samas tehingus
    await recordSupervisionAudit(tx, {
      action: ACTIONS.PROCESS_CLOSED, actorUserId: userId, processId: process.id,
      targetKind: "process", targetId: process.id, metadata: purgeReport
    });
    const recipients = [...new Set([
      fresh.supervisorId,
      ...participations.filter((p) => ["ACCEPTED", "LEFT"].includes(p.status)).map((p) => p.userId)
    ])];
    for (const recipientId of recipients) {
      await notifyClosed(tx, { processId: process.id, userId: recipientId }, { now });
    }
  });

  return getProcessDetail({ processId: process.id, session }, options);
}
