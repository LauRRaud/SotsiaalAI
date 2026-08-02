import test from "node:test";
import assert from "node:assert/strict";

import {
  assertInviteInput,
  createInviteToken,
  evaluateInvite,
  hashInviteToken,
  inviteExpiryFrom,
  inviteRejectionMessageKey,
  normalizeInviteEmail,
  resolveCapabilityTemplate,
  toInvitePreview
} from "../../lib/org/invites.js";
import { maskEmail } from "../../lib/org/audit.js";

const NOW = new Date("2026-08-01T12:00:00.000Z");

function invite(overrides = {}) {
  return {
    id: "inv_1",
    email: "mari@vald.ee",
    status: "PENDING",
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "MEMBER",
    jobTitle: null,
    expiresAt: new Date("2026-08-10T00:00:00.000Z"),
    organization: { displayName: "X vald", legalKind: "MUNICIPALITY" },
    primaryUnit: null,
    ...overrides
  };
}

test("a token is never stored in the clear — only its hash", () => {
  const token = createInviteToken();
  assert.ok(token.raw.length > 40);
  assert.equal(token.hash, hashInviteToken(token.raw));
  assert.notEqual(token.hash, token.raw);
});

test("two tokens are never the same", () => {
  const seen = new Set();
  for (let index = 0; index < 50; index += 1) seen.add(createInviteToken().raw);
  assert.equal(seen.size, 50);
});

test("email is normalised for comparison but rejected when malformed", () => {
  assert.equal(normalizeInviteEmail("  Mari@Vald.EE "), "mari@vald.ee");
  for (const bad of ["", "   ", "mari", "mari@", "@vald.ee", "mari vald@ee"]) {
    assert.throws(() => normalizeInviteEmail(bad), (error) => {
      assert.equal(error.status, 400);
      return true;
    });
  }
});

/* -------------------------------------------------------------------------
   §11.2: iga vale tee peab failima suletult.
   ------------------------------------------------------------------------- */

test("a valid pending invite for the right person is accepted", () => {
  assert.deepEqual(evaluateInvite(invite(), { acceptingEmail: "mari@vald.ee", now: NOW }), {
    ok: true,
    reason: null
  });
});

test("a wrong email never accepts the invite", () => {
  const verdict = evaluateInvite(invite(), { acceptingEmail: "juhan@vald.ee", now: NOW });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "EMAIL_MISMATCH");
});

test("the email check is case-insensitive but not domain-based", () => {
  assert.equal(evaluateInvite(invite(), { acceptingEmail: "MARI@VALD.EE", now: NOW }).ok, true);
  // Sama domeen, teine inimene → EI. Domeen ei tekita liikmesust.
  assert.equal(evaluateInvite(invite(), { acceptingEmail: "keegi@vald.ee", now: NOW }).ok, false);
});

test("an expired invite is rejected", () => {
  const verdict = evaluateInvite(invite({ expiresAt: new Date("2026-07-01") }), {
    acceptingEmail: "mari@vald.ee",
    now: NOW
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "EXPIRED");
});

test("a revoked invite is rejected", () => {
  assert.equal(
    evaluateInvite(invite({ status: "REVOKED" }), { acceptingEmail: "mari@vald.ee", now: NOW }).reason,
    "REVOKED"
  );
});

test("token reuse is rejected — an accepted invite never works twice", () => {
  assert.equal(
    evaluateInvite(invite({ status: "ACCEPTED" }), { acceptingEmail: "mari@vald.ee", now: NOW }).reason,
    "ALREADY_USED"
  );
});

test("an unknown token is rejected", () => {
  assert.equal(evaluateInvite(null, { acceptingEmail: "mari@vald.ee", now: NOW }).reason, "NOT_FOUND");
});

test("only expiry gets its own message — every other failure looks identical", () => {
  assert.equal(inviteRejectionMessageKey("EXPIRED"), "org.errors.invite_expired");
  for (const reason of ["NOT_FOUND", "REVOKED", "ALREADY_USED", "EMAIL_MISMATCH", "DECLINED"]) {
    assert.equal(
      inviteRejectionMessageKey(reason),
      "org.errors.invite_invalid",
      `${reason} must not be distinguishable`
    );
  }
});

/* -------------------------------------------------------------------------
   Eelvaade: teadlik nõustumine.
   ------------------------------------------------------------------------- */

test("the preview shows organisation, unit, priced role and planned rights", () => {
  const preview = toInvitePreview(
    invite({
      capabilityTemplate: "UNIT_LEAD",
      primaryUnit: { id: "tiim_a", name: "Lastekaitse tiim" },
      jobTitle: "Tiimijuht"
    })
  );
  assert.equal(preview.organization.displayName, "X vald");
  assert.equal(preview.unit.name, "Lastekaitse tiim");
  assert.equal(preview.seatRole, "SOCIAL_WORKER");
  assert.deepEqual(preview.capabilities, ["UNIT_LEAD", "WORK_ASSIGNER"]);
});

test("the preview leaks nothing about the inviter or other members", () => {
  const serialized = JSON.stringify(toInvitePreview(invite()));
  for (const forbidden of ["invitedBy", "memberCount", "tokenHash", "members", "email"]) {
    assert.equal(serialized.includes(forbidden), false, `preview must not expose ${forbidden}`);
  }
});

test("an unknown template is a rejected request, not a silent fallback to member", () => {
  assert.equal(resolveCapabilityTemplate(null).key, "MEMBER");
  assert.throws(() => resolveCapabilityTemplate("SUPERUSER"), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
});

test("invite input rejects a CLIENT seat role outright", () => {
  assert.throws(
    () => assertInviteInput({ email: "mari@vald.ee", seatRole: "CLIENT", capabilityTemplate: "MEMBER" }),
    (error) => {
      assert.equal(error.messageKey, "org.errors.invalid_seat_role");
      return true;
    }
  );
});

test("invites expire in 14 days by default", () => {
  const expiry = inviteExpiryFrom(NOW);
  assert.equal(Math.round((expiry - NOW) / (24 * 60 * 60 * 1000)), 14);
});

/* -------------------------------------------------------------------------
   Audit ei salvesta täisaadressi.
   ------------------------------------------------------------------------- */

test("audit metadata masks the local part of an email but keeps the domain", () => {
  assert.equal(maskEmail("mari.maasikas@vald.ee"), "m***@vald.ee");
  assert.equal(maskEmail("x@y.ee"), "x***@y.ee");
  assert.equal(maskEmail("rubbish"), "***");
  assert.equal(maskEmail(null), "***");
});
