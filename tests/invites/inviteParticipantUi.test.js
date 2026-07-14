import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const modal = read("components/invite/InviteModal.jsx");
const dashboard = read("lib/workspaceDashboardCards.js");
const roomStage = read("components/room/RoomStage.jsx");
const classicRoute = read("app/api/invites/route.js");
const sponsoredRoute = read("app/api/invites/sponsored/init/route.js");
const catalogs = ["et", "en", "ru"].map((locale) => json(`messages/${locale}.json`));

test("workspace and room navigation use the participant invitation wording", () => {
  assert.equal(catalogs[0].chat.workspace.cards.add_person.title, "Kutsu osaleja");
  assert.equal(catalogs[1].chat.workspace.cards.add_person.title, "Invite participant");
  assert.equal(catalogs[2].chat.workspace.cards.add_person.title, "Пригласить участника");
  assert.doesNotMatch(dashboard, /Lisa inimene/u);
  assert.doesNotMatch(roomStage, /Lisa inimene/u);
});

test("invite form asks for a participant type and explains room-only access", () => {
  assert.match(modal, /<fieldset[\s\S]*invite\.participant\.question/u);
  assert.match(modal, /invite\.participant\.client/u);
  assert.match(modal, /invite\.participant\.professional/u);
  assert.match(modal, /invite\.participant\.scope/u);

  for (const catalog of catalogs) {
    const participant = catalog.invite.participant;
    assert.ok(participant.question);
    assert.ok(participant.client);
    assert.ok(participant.professional);
    assert.ok(participant.scope);
  }
});

test("classic and sponsored invite requests carry relationship metadata", () => {
  const payloadWrites = modal.match(/relationship_type:\s*effectiveRelationshipType/gu) || [];
  assert.equal(payloadWrites.length, 2, "both invite request paths carry the selected relationship");
  assert.match(classicRoute, /normalizeInviteRelationshipType/u);
  assert.match(classicRoute, /canInviteRelationshipType\(auth\.role, relationshipType\)/u);
  assert.match(classicRoute, /relationshipType:\s*relationshipType \|\| undefined/u);
  assert.match(sponsoredRoute, /inviteRelationshipTypeForSponsoredRole\(targetRole\)/u);
  assert.match(sponsoredRoute, /canInviteRelationshipType\(auth\.role, relationshipType\)/u);
  assert.match(sponsoredRoute, /relationshipType,/u);
});

test("service provider is a real sponsored role option, not folded into a client label", () => {
  for (const catalog of catalogs) {
    assert.ok(catalog.invite.sponsored.role.provider);
  }
  assert.match(modal, /SERVICE_PROVIDER/u);
});

test("all invitation email variants state the room-only access boundary", () => {
  for (const catalog of catalogs) {
    for (const variant of ["create", "sponsored", "resend"]) {
      const template = catalog.email.invite[variant];
      assert.ok(template?.subject, `${variant} subject exists`);
      assert.match(template.text, /room|ruumi|комнат/ui);
      assert.match(template.text, /only|ainult|только/ui);
      assert.ok(template.html.includes("{joinLink}"));
    }
  }
});

test("regular invite email template exists instead of falling back to its i18n key", () => {
  for (const catalog of catalogs) {
    assert.notEqual(catalog.email.invite.create.subject, "email.invite.create.subject");
    assert.ok(catalog.email.invite.create.text.includes("{inviterName}"));
    assert.ok(catalog.email.invite.create.text.includes("{roomTitle}"));
  }
});
