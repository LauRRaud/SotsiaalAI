import prisma from "../prisma.js";
import { getHelpRequestById } from "./requests.js";
import { getHelpOfferById } from "./offers.js";
import { toHelpListingDetailView, toPublicHelpListingDetailView } from "./listingViews.js";

// Ainus avalik (võõrale nähtav) help-listing'u staatus. Kõik muu
// (DRAFT, MATCHED, CLOSED, CANCELLED, ARCHIVED) on mitteavalik ja nähtav
// AINULT omanikule tema enda kirje puhul.
export const HELP_LISTING_PUBLIC_STATUSES = Object.freeze(["OPEN"]);

export function isPublicHelpListingStatus(status) {
  return HELP_LISTING_PUBLIC_STATUSES.includes(String(status || "").trim().toUpperCase());
}

export function normalizeHelpListingKind(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "offer") return "offer";
  if (normalized === "request") return "request";
  return "";
}

// Siduv serveripoolne nähtavusleping detail-vaatele. Ainus koht, kus otsustatakse,
// kas ja MILLISE projektsiooniga help-listing'u detail väljastatakse. Route on
// õhuke adapter tulemuse ümber (ok -> 200, muu -> ühetaoline 404), nii et ükski
// route ega kutsuja ei saa filtrit vahele jätta.
//
// Leping:
//  - kirjet ei leidu -> not_found (route -> 404)
//  - vaataja on omanik -> ok + omanikuprojektsioon (iga staatus)
//  - vaataja EI ole omanik (sh anonüümne, sh ADMIN):
//      * kirje ei ole avalik (staatus != OPEN) -> not_found (ühetaoline 404,
//        ei paljasta olemasolu ega staatust; ADMIN ei saa vaikimisi õigust
//        võõra mustandi sisule)
//      * kirje on OPEN -> ok + FAIL-CLOSED avalik projektsioon (ei rawPlace'i,
//        ei täpset asukohta, ei omaniku-/mustandivälju)
export async function loadHelpListingDetailForViewer(
  { kind, id, viewerId = "", locale = "et" } = {},
  prismaClient = prisma
) {
  const normalizedKind = normalizeHelpListingKind(kind);
  const listingId = String(id || "").trim();
  if (!normalizedKind || !listingId) {
    return { outcome: "not_found" };
  }

  const record = normalizedKind === "offer"
    ? await getHelpOfferById(listingId, prismaClient)
    : await getHelpRequestById(listingId, prismaClient);
  if (!record) {
    return { outcome: "not_found" };
  }

  const viewer = String(viewerId || "").trim();
  const isOwner = Boolean(viewer && String(record.userId || "") === viewer);

  if (isOwner) {
    return {
      outcome: "ok",
      isOwner: true,
      kind: normalizedKind,
      listing: toHelpListingDetailView(record, { kind: normalizedKind, locale })
    };
  }

  if (!isPublicHelpListingStatus(record.status)) {
    return { outcome: "not_found" };
  }

  return {
    outcome: "ok",
    isOwner: false,
    kind: normalizedKind,
    listing: toPublicHelpListingDetailView(record, { kind: normalizedKind, locale })
  };
}
