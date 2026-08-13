import prisma from "../prisma.js";
import { writeDataAudit } from "../privacy/audit.js";

const CONSENTED_MATCH_STATUSES = Object.freeze(["ACCEPTED", "CONTACTED", "CLOSED"]);
const PRESERVED_ROOM_POLICY = "PRESERVE_ROOM_AND_MEMBERSHIP_HISTORY";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function listingConfig(kind) {
  if (kind === "request") {
    return {
      model: "helpRequest",
      table: "HelpRequest",
      matchField: "requestId",
      mapField: "requestId",
      resourceType: "HelpRequest",
      auditAction: "HELP_REQUEST_CLOSE_ACCEPTED_MATCH"
    };
  }
  if (kind === "offer") {
    return {
      model: "helpOffer",
      table: "HelpOffer",
      matchField: "offerId",
      mapField: "offerId",
      resourceType: "HelpOffer",
      auditAction: "HELP_OFFER_CLOSE_ACCEPTED_MATCH"
    };
  }
  throw fail("HELP_LISTING_KIND_INVALID");
}

async function lockListing(tx, table, id) {
  if (typeof tx?.$queryRawUnsafe !== "function") return;
  await tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
}

async function lockListingMatches(tx, matchField, id) {
  if (typeof tx?.$queryRawUnsafe !== "function") return;
  await tx.$queryRawUnsafe(
    `SELECT "id" FROM "HelpMatch" WHERE "${matchField}" = $1 ORDER BY "id" FOR UPDATE`,
    id
  );
}

function isSerializableConflict(error) {
  return error?.code === "P2034"
    || error?.code === "40001"
    || error?.meta?.code === "40001"
    || error?.meta?.driverAdapterError?.cause?.originalCode === "40001"
    || String(error?.message || "").toLowerCase().includes("could not serialize access")
    || String(error?.message || "").toLowerCase().includes("deadlock detected");
}

async function runSerializable(prismaClient, callback, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prismaClient.$transaction(callback, { isolationLevel: "Serializable" });
    } catch (error) {
      lastError = error;
      if (!isSerializableConflict(error) || attempt === maxAttempts) throw error;
    }
  }
  throw lastError;
}

function assertAcceptedMatchCoherence(matches, rooms, memberships) {
  const roomIds = new Set(rooms.map((room) => room.id));
  for (const match of matches) {
    if (!match.roomId || !roomIds.has(match.roomId)) {
      throw fail("HELP_LISTING_ACCEPTED_MATCH_INCONSISTENT");
    }
    const participantIds = new Set(
      memberships
        .filter((member) => member.roomId === match.roomId)
        .map((member) => member.userId)
    );
    if (!participantIds.has(match.requesterId) || !participantIds.has(match.offererId)) {
      throw fail("HELP_LISTING_ACCEPTED_MATCH_INCONSISTENT");
    }
  }
}

export async function deleteHelpListingWithAcceptedMatchGuard(input = {}, prismaClient = prisma) {
  const kind = String(input?.kind || "").trim().toLowerCase();
  const id = String(input?.id || "").trim();
  const actorUserId = String(input?.actorUserId || "").trim();
  const isAdmin = input?.isAdmin === true;
  const ipAddress = String(input?.ipAddress || "").trim() || null;
  if (!id) throw fail("HELP_LISTING_ID_REQUIRED");
  const config = listingConfig(kind);

  return runSerializable(prismaClient, async (tx) => {
    await lockListingMatches(tx, config.matchField, id);
    await lockListing(tx, config.table, id);
    const listing = await tx[config.model].findUnique({
      where: { id },
      select: { id: true, userId: true, status: true }
    });
    if (!listing) throw fail("HELP_LISTING_NOT_FOUND");
    if (actorUserId && actorUserId !== listing.userId && !isAdmin) {
      throw fail("HELP_LISTING_FORBIDDEN");
    }

    const acceptedMatches = await tx.helpMatch.findMany({
      where: {
        [config.matchField]: id,
        roomId: { not: null },
        status: { in: [...CONSENTED_MATCH_STATUSES] }
      },
      select: {
        id: true,
        requesterId: true,
        offererId: true,
        roomId: true
      }
    });

    if (!acceptedMatches.length) {
      await tx.helpMatch.deleteMany({
        where: { [config.matchField]: id, roomId: null }
      });
      await tx[config.model].delete({ where: { id }, select: { id: true } });
      return { id, disposition: "HARD_DELETED" };
    }

    const roomIds = [...new Set(acceptedMatches.map((match) => match.roomId).filter(Boolean))];
    const rooms = await tx.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, archivedAt: true }
    });
    const memberships = await tx.roomMember.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true, roomId: true, userId: true, leftAt: true }
    });
    assertAcceptedMatchCoherence(acceptedMatches, rooms, memberships);

    await tx[config.model].update({
      where: { id },
      data: { status: "CLOSED" },
      select: { id: true }
    });
    await tx.helpMapEntry.updateMany({
      where: { [config.mapField]: id },
      data: { mapVisible: false, status: "HIDDEN" }
    });

    const existingAudit = await tx.dataAuditLog.findFirst({
      where: {
        action: config.auditAction,
        resourceType: config.resourceType,
        resourceId: id
      },
      select: { id: true }
    });
    if (!existingAudit) {
      await writeDataAudit({
        db: tx,
        actorUserId: actorUserId || listing.userId,
        targetUserId: listing.userId,
        action: config.auditAction,
        resourceType: config.resourceType,
        resourceId: id,
        ipAddress,
        meta: {
          fromStatus: listing.status,
          toStatus: "CLOSED",
          acceptedMatchCount: acceptedMatches.length,
          preservedRoomCount: rooms.length,
          preservedMembershipCount: memberships.length,
          roomPolicy: PRESERVED_ROOM_POLICY
        }
      });
    }

    return {
      id,
      status: "CLOSED",
      disposition: "CLOSED_ACCEPTED_MATCH",
      acceptedMatchCount: acceptedMatches.length,
      preservedRoomCount: rooms.length,
      preservedMembershipCount: memberships.length,
      roomPolicy: PRESERVED_ROOM_POLICY,
      auditCreated: !existingAudit
    };
  });
}
