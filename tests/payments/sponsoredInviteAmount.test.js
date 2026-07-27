import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CLIENT_AMOUNT,
  DEFAULT_SOCIAL_WORKER_AMOUNT,
  DEFAULT_SERVICE_PROVIDER_AMOUNT,
  getPublicSponsoredInviteAmount,
  getSponsoredInviteAmount
} from "../../lib/subscriptionPlans.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const modal = readFileSync(join(root, "components/invite/InviteModal.jsx"), "utf8");

const AMOUNT_ENV_KEYS = [
  "SUBSCRIPTION_MONTHLY_AMOUNT",
  "SUBSCRIPTION_MONTHLY_AMOUNT_CLIENT",
  "SUBSCRIPTION_MONTHLY_AMOUNT_SOCIAL_WORKER",
  "SUBSCRIPTION_MONTHLY_AMOUNT_SERVICE_PROVIDER",
  "INVITE_SPONSORED_AMOUNT",
  "INVITE_SPONSORED_AMOUNT_CLIENT",
  "INVITE_SPONSORED_AMOUNT_SOCIAL_WORKER",
  "INVITE_SPONSORED_AMOUNT_SERVICE_PROVIDER",
  "NEXT_PUBLIC_INVITE_SPONSORED_AMOUNT_CLIENT",
  "NEXT_PUBLIC_INVITE_SPONSORED_AMOUNT_SOCIAL_WORKER",
  "NEXT_PUBLIC_INVITE_SPONSORED_AMOUNT_SERVICE_PROVIDER"
];

function withEnv(overrides, run) {
  const previous = new Map();
  for (const key of AMOUNT_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) process.env[key] = value;
  try {
    run();
  } finally {
    for (const key of AMOUNT_ENV_KEYS) {
      if (previous.get(key) === undefined) delete process.env[key];
      else process.env[key] = previous.get(key);
    }
  }
}

test("sponsorkutse hind sõltub kutsutu rollist = tema kuutellimus", () => {
  withEnv({}, () => {
    assert.equal(getSponsoredInviteAmount("CLIENT"), DEFAULT_CLIENT_AMOUNT);
    assert.equal(getSponsoredInviteAmount("SOCIAL_WORKER"), DEFAULT_SOCIAL_WORKER_AMOUNT);
    assert.equal(getSponsoredInviteAmount("SERVICE_PROVIDER"), DEFAULT_SERVICE_PROVIDER_AMOUNT);
  });
});

test("sponsorhind järgib rolli kuutellimuse ülekirjutust (ei jää koodivaikele kinni)", () => {
  withEnv({ SUBSCRIPTION_MONTHLY_AMOUNT_CLIENT: "9.99" }, () => {
    assert.equal(getSponsoredInviteAmount("CLIENT"), 9.99);
    assert.equal(getSponsoredInviteAmount("SOCIAL_WORKER"), DEFAULT_SOCIAL_WORKER_AMOUNT);
  });
});

test("rollideülene INVITE_SPONSORED_AMOUNT ei lamesta kolme valikut ühte hinda", () => {
  withEnv({ INVITE_SPONSORED_AMOUNT: "4" }, () => {
    const amounts = ["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"].map(getSponsoredInviteAmount);
    assert.deepEqual(amounts, [
      DEFAULT_CLIENT_AMOUNT,
      DEFAULT_SOCIAL_WORKER_AMOUNT,
      DEFAULT_SERVICE_PROVIDER_AMOUNT
    ]);
  });
});

test("rollipõhine sponsori ülekirjutus kehtib ainult oma rollile", () => {
  withEnv({ INVITE_SPONSORED_AMOUNT_SERVICE_PROVIDER: "24.99" }, () => {
    assert.equal(getSponsoredInviteAmount("SERVICE_PROVIDER"), 24.99);
    assert.equal(getSponsoredInviteAmount("CLIENT"), DEFAULT_CLIENT_AMOUNT);
  });
});

test("kutsemodaali näidatav hind = serveri võetav hind (vaikeseisus)", () => {
  withEnv({}, () => {
    for (const role of ["CLIENT", "SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
      assert.equal(
        getPublicSponsoredInviteAmount(role),
        getSponsoredInviteAmount(role),
        `${role}: kliendi ja serveri summa peavad kokku langema`
      );
    }
  });
});

test("kutsemodaal sildistab iga rollivaliku TEMA oma summaga", () => {
  assert.match(modal, /getPublicSponsoredInviteAmount\(value\)/u);
  assert.doesNotMatch(
    modal,
    /NEXT_PUBLIC_INVITE_SPONSORED_AMOUNT\b/u,
    "rollideülene NEXT_PUBLIC summa on maha võetud"
  );
});
