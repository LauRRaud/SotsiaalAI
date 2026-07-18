import test from "node:test";
import assert from "node:assert/strict";

import {
  INVITE_RELATIONSHIP_CLIENT,
  INVITE_RELATIONSHIP_PROFESSIONAL,
  canInviteRelationshipType,
  inviteRelationshipTypeForSponsoredRole,
  inviteRelationshipTypesForInviter,
  normalizeInviteRelationshipType,
  sponsoredRolesForInviteRelationship,
} from "../../lib/invites/participantTypes.js";

test("invite relationship normalization is allowlist-only", () => {
  assert.equal(normalizeInviteRelationshipType(" client "), INVITE_RELATIONSHIP_CLIENT);
  assert.equal(normalizeInviteRelationshipType("COLLEAGUE"), INVITE_RELATIONSHIP_PROFESSIONAL);
  assert.equal(normalizeInviteRelationshipType("support_person"), "");
  assert.equal(normalizeInviteRelationshipType(null), "");
});

test("a client-facing inviter is only offered the professional participant path", () => {
  assert.deepEqual(inviteRelationshipTypesForInviter("CLIENT"), [INVITE_RELATIONSHIP_PROFESSIONAL]);
});

test("professional inviters can choose a client or another professional", () => {
  for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER", "ADMIN", undefined]) {
    assert.deepEqual(inviteRelationshipTypesForInviter(role), [
      INVITE_RELATIONSHIP_CLIENT,
      INVITE_RELATIONSHIP_PROFESSIONAL,
    ]);
  }
});

test("the server-side relationship rule blocks client-to-client invitations", () => {
  assert.equal(canInviteRelationshipType("CLIENT", INVITE_RELATIONSHIP_CLIENT), false);
  assert.equal(canInviteRelationshipType("CLIENT", INVITE_RELATIONSHIP_PROFESSIONAL), true);
  assert.equal(canInviteRelationshipType("SOCIAL_WORKER", INVITE_RELATIONSHIP_CLIENT), true);
  assert.equal(canInviteRelationshipType("SERVICE_PROVIDER", INVITE_RELATIONSHIP_PROFESSIONAL), true);
  assert.equal(canInviteRelationshipType("SOCIAL_WORKER", "SUPPORT_PERSON"), false);
});

test("sponsored plan roles stay consistent with the selected participant type", () => {
  assert.deepEqual(sponsoredRolesForInviteRelationship(INVITE_RELATIONSHIP_CLIENT), ["CLIENT"]);
  assert.deepEqual(sponsoredRolesForInviteRelationship(INVITE_RELATIONSHIP_PROFESSIONAL), [
    "SOCIAL_WORKER",
    "SERVICE_PROVIDER",
  ]);
});

test("sponsored roles persist the matching invite relationship metadata", () => {
  assert.equal(inviteRelationshipTypeForSponsoredRole("CLIENT"), INVITE_RELATIONSHIP_CLIENT);
  assert.equal(inviteRelationshipTypeForSponsoredRole("SOCIAL_WORKER"), INVITE_RELATIONSHIP_PROFESSIONAL);
  assert.equal(inviteRelationshipTypeForSponsoredRole("SERVICE_PROVIDER"), INVITE_RELATIONSHIP_PROFESSIONAL);
});
