import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SUBSCRIPTION_ORIGIN_FIELDS,
  applySubscriptionOrigin,
  describeSubscriptionOrigin,
  hostSponsorOrigin,
  organizationSponsorOrigin,
  originChanged,
  selfOrigin
} from "../../lib/payments/subscriptionOrigin.js";

/* SOL-PAY-04 — KES MAKSAB, ON ÜKS OTSUS, MITTE VIIS VÄLJA.

   Päritolu elab viies väljas ja iga rada kirjutas neist ainult need, mida ta ise
   vajas. Omamakse jättis `billingSource` sponsoreerituks ja sponsori seosed rea
   külge — tühistamine nõuab `SELF`, seega maksja ei saanud oma tellimust
   lõpetada. Nende testide kandev väide: iga ehitaja tagastab KÕIK viis välja. */

function fakeTx() {
  const calls = { updates: [], audits: [] };
  return {
    calls,
    subscription: {
      async update(args) {
        calls.updates.push(args);
        return { id: args.where.id, ...args.data };
      }
    },
    dataAuditLog: {
      async create(args) {
        calls.audits.push(args.data);
        return { id: "audit_1", ...args.data };
      }
    }
  };
}

const HOST_SPONSORED = {
  id: "sub_1",
  userId: "user_1",
  billingSource: "SPONSORED_BY_HOST",
  sponsorUserId: "host_1",
  inviteId: "invite_1",
  sponsorOrganizationId: null,
  orgClientSponsorshipId: null
};

const ORG_SPONSORED = {
  id: "sub_2",
  userId: "user_2",
  billingSource: "SPONSORED_BY_ORGANIZATION",
  sponsorUserId: null,
  inviteId: null,
  sponsorOrganizationId: "org_1",
  orgClientSponsorshipId: "sponsorship_1"
};

test("iga ehitaja tagastab KÕIK päritoluväljad, ka need, mis tuleb nullida", () => {
  for (const origin of [
    selfOrigin(),
    hostSponsorOrigin({ sponsorUserId: "u", inviteId: "i" }),
    organizationSponsorOrigin({ organizationId: "o", sponsorshipId: "s" })
  ]) {
    assert.deepEqual(
      Object.keys(origin).sort(),
      [...SUBSCRIPTION_ORIGIN_FIELDS].sort(),
      "poolik päritolu on täpselt see viga, mille pärast see moodul on olemas"
    );
  }
});

test("omamakse päritolu ei jäta ühtki sponsoriseost rippuma", () => {
  const origin = selfOrigin();
  assert.equal(origin.billingSource, "SELF");
  assert.equal(origin.sponsorUserId, null);
  assert.equal(origin.inviteId, null);
  assert.equal(origin.sponsorOrganizationId, null);
  assert.equal(origin.orgClientSponsorshipId, null);
});

test("hosti sponsorlus nullib organisatsiooni väljad ja vastupidi", () => {
  const host = hostSponsorOrigin({ sponsorUserId: "host_1", inviteId: "invite_1" });
  assert.equal(host.sponsorOrganizationId, null);
  assert.equal(host.orgClientSponsorshipId, null);

  const org = organizationSponsorOrigin({ organizationId: "org_1", sponsorshipId: "sp_1" });
  assert.equal(org.sponsorUserId, null, "vana hosti-sponsorlus ei tohi rea külge jääda");
  assert.equal(org.inviteId, null);
});

test("originChanged näeb iga välja eraldi", () => {
  assert.equal(originChanged(HOST_SPONSORED, selfOrigin()), true);
  assert.equal(originChanged(HOST_SPONSORED, hostSponsorOrigin({ sponsorUserId: "host_1", inviteId: "invite_1" })), false);
  assert.equal(
    originChanged(HOST_SPONSORED, hostSponsorOrigin({ sponsorUserId: "host_2", inviteId: "invite_1" })),
    true
  );
});

test("KANDEV: päritolu vahetus ja tema jälg kirjutatakse SAMAS tehingus", async () => {
  const tx = fakeTx();
  const changed = await applySubscriptionOrigin(tx, {
    subscription: HOST_SPONSORED,
    origin: selfOrigin(),
    actorUserId: "user_1",
    paymentId: "pay_1"
  });

  assert.equal(changed, true);
  assert.equal(tx.calls.updates.length, 1);
  assert.equal(tx.calls.updates[0].data.billingSource, "SELF");
  assert.equal(tx.calls.updates[0].data.sponsorUserId, null);
  assert.equal(tx.calls.updates[0].data.inviteId, null);

  assert.equal(tx.calls.audits.length, 1, "ilma ledgerita kaoks eelmise perioodi maksja");
  const audit = tx.calls.audits[0];
  assert.equal(audit.action, "subscription.billing_source_changed");
  assert.equal(audit.resourceType, "Subscription");
  assert.equal(audit.resourceId, "sub_1");
  assert.equal(audit.meta.paymentId, "pay_1");
  assert.equal(audit.meta.from.billingSource, "SPONSORED_BY_HOST");
  assert.equal(audit.meta.from.sponsorUserId, "host_1");
  assert.equal(audit.meta.to.billingSource, "SELF");
});

test("organisatsioonisponsorlus → omamakse kirjutab mõlemad org-väljad ledgerisse", async () => {
  const tx = fakeTx();
  await applySubscriptionOrigin(tx, { subscription: ORG_SPONSORED, origin: selfOrigin() });
  const audit = tx.calls.audits[0];
  assert.equal(audit.meta.from.sponsorOrganizationId, "org_1");
  assert.equal(audit.meta.from.orgClientSponsorshipId, "sponsorship_1");
  assert.equal(audit.meta.to.sponsorOrganizationId, null);
});

test("muutumatu päritolu ei kirjuta ei rida ega ledgerit", async () => {
  const tx = fakeTx();
  const selfPaid = { id: "sub_3", userId: "u3", billingSource: "SELF" };
  const changed = await applySubscriptionOrigin(tx, { subscription: selfPaid, origin: selfOrigin() });

  assert.equal(changed, false);
  assert.equal(tx.calls.updates.length, 0);
  assert.equal(tx.calls.audits.length, 0, "iga uuendusmakse ei tohi ledgerit müraga täita");
});

test("describeSubscriptionOrigin normaliseerib puuduva allika SELF-iks", () => {
  assert.deepEqual(describeSubscriptionOrigin({}), {
    billingSource: "SELF",
    sponsorUserId: null,
    inviteId: null,
    sponsorOrganizationId: null,
    orgClientSponsorshipId: null
  });
});

/* LEPING: kõik kolm rada peavad päritolu TERVIKUNA kirjutama. Ilma nende
   väideteta tõendaks fail ainult iseennast. */

test("aktiveerimine seab omamakse päritolu ja loeb selleks vajalikud väljad", () => {
  const source = readFileSync(
    new URL("../../lib/payments/subscriptionActivation.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /applySubscriptionOrigin\(/);
  assert.match(source, /selfOrigin\(\)/);
  assert.match(source, /billingSource: true/, "ilma praeguse päritolu lugemiseta ei saa teda võrrelda");
  assert.match(source, /payment\.userId.*existing\.userId/s, "ainult maksja enda tellimus");
});

test("mõlemad sponsorlusrajad kasutavad jagatud ehitajaid", () => {
  const invite = readFileSync(new URL("../../lib/invites/acceptInviteCore.js", import.meta.url), "utf8");
  assert.match(invite, /hostSponsorOrigin\(/);
  assert.ok(
    !/billingSource: "SPONSORED_BY_HOST",\s*\n\s*sponsorUserId,\s*\n\s*inviteId: invite\.id,/.test(invite),
    "vana poolik kuju on tagasi"
  );

  const org = readFileSync(new URL("../../lib/org/sponsorship.js", import.meta.url), "utf8");
  assert.match(org, /organizationSponsorOrigin\(/);
});

test("tühistus ütleb sponsoreeritud tellimuse kohta tõtt", () => {
  const source = readFileSync(new URL("../../app/api/subscription/route.js", import.meta.url), "utf8");
  assert.match(source, /isSponsoredBillingSource\(/);
  assert.match(source, /api\.subscription\.cancel_not_self_paid/);
});
