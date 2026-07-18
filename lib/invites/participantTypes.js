export const INVITE_RELATIONSHIP_CLIENT = "CLIENT";
export const INVITE_RELATIONSHIP_PROFESSIONAL = "COLLEAGUE";

const INVITE_RELATIONSHIP_TYPES = new Set([
  INVITE_RELATIONSHIP_CLIENT,
  INVITE_RELATIONSHIP_PROFESSIONAL,
]);

const PROFESSIONAL_SPONSORED_ROLES = Object.freeze([
  "SOCIAL_WORKER",
  "SERVICE_PROVIDER",
]);

export function normalizeInviteRelationshipType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return INVITE_RELATIONSHIP_TYPES.has(normalized) ? normalized : "";
}

export function inviteRelationshipTypesForInviter(role) {
  const inviterRole = String(role || "").trim().toUpperCase();
  if (inviterRole === "CLIENT") {
    return [INVITE_RELATIONSHIP_PROFESSIONAL];
  }
  return [INVITE_RELATIONSHIP_CLIENT, INVITE_RELATIONSHIP_PROFESSIONAL];
}

export function canInviteRelationshipType(inviterRole, relationshipType) {
  const normalizedRelationship = normalizeInviteRelationshipType(relationshipType);
  return (
    normalizedRelationship !== "" &&
    inviteRelationshipTypesForInviter(inviterRole).includes(normalizedRelationship)
  );
}

export function sponsoredRolesForInviteRelationship(relationshipType) {
  return normalizeInviteRelationshipType(relationshipType) === INVITE_RELATIONSHIP_CLIENT
    ? ["CLIENT"]
    : [...PROFESSIONAL_SPONSORED_ROLES];
}

export function inviteRelationshipTypeForSponsoredRole(role) {
  return String(role || "").trim().toUpperCase() === "CLIENT"
    ? INVITE_RELATIONSHIP_CLIENT
    : INVITE_RELATIONSHIP_PROFESSIONAL;
}
