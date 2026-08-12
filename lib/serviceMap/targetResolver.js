import { prisma as defaultPrisma } from "../prisma.js";
import { parseServiceMapEntryId } from "./entryIdentity.js";

async function defaultServiceLoader(options, db) {
  const { listPublishedServiceMapEntries } = await import("../serviceProviderProfiles.js");
  return listPublishedServiceMapEntries(options, db);
}

async function defaultHelpLoader(options, db) {
  const { listPublishedHelpMapEntries } = await import("../help/mapEntries.js");
  return listPublishedHelpMapEntries(options, db);
}

export async function resolveServiceMapTarget({
  db = defaultPrisma,
  userId = "",
  entryId = "",
  listing = "",
  match = "",
  locale = "et",
  loadServiceEntries = defaultServiceLoader,
  loadHelpEntries = defaultHelpLoader
}) {
  const targets = [entryId, listing, match].map((value) => String(value || "").trim()).filter(Boolean);
  if (targets.length !== 1) return null;

  if (entryId) {
    const identity = parseServiceMapEntryId(entryId);
    if (!identity.baseEntryId) return null;
    const entries = await loadServiceEntries({ entryId: identity.baseEntryId, limit: 1 }, db);
    const target = identity.providerLocationId
      ? entries.find((item) => item.providerLocationId === identity.providerLocationId)
      : entries[0];
    return target ? { entry: target, entryType: target.type, canonicalEntryId: target.id } : null;
  }

  if (!userId) return null;
  let listingId = String(listing || "").trim();
  if (match) {
    const row = await db.helpMatch.findFirst({
      where: {
        id: String(match).trim(),
        OR: [{ requesterId: userId }, { offererId: userId }]
      },
      select: { requestId: true, offerId: true, requesterId: true, offererId: true }
    });
    if (!row) return null;
    listingId = row.requesterId === userId ? row.offerId : row.requestId;
  }
  const entries = await loadHelpEntries({ listingId, limit: 1, locale, currentUserId: userId }, db);
  const target = entries[0];
  return target ? { entry: target, entryType: target.type, canonicalEntryId: target.id } : null;
}
