import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createInvite } from "../lib/org/inviteService.js";

/* Võltsandmebaas: vastab ainult neile päringutele, mida kutse loomine teeb; ülejäänud
   (auditirida jms) saavad tühja vastuse. */
function fakeDb() {
  const state = { created: null };
  const handlers = {
    organization: { findUnique: async () => ({ id: "org-1", status: "ACTIVE" }) },
    organizationMembership: { findFirst: async () => null },
    organizationInvite: {
      findFirst: async () => null,
      create: async ({ data }) => {
        state.created = data;
        return { id: "inv-1", ...data };
      }
    }
  };
  const tx = new Proxy(
    {},
    {
      get: (_, model) =>
        new Proxy(
          {},
          { get: (__, method) => async (args) => (handlers[model]?.[method] ? handlers[model][method](args) : { id: "x" }) }
        )
    }
  );
  return { state, $transaction: async (fn) => fn(tx) };
}

const INPUT = { actorUserId: "u-1", email: "uus.tootaja@example.test", seatRole: "SOCIAL_WORKER", capabilityTemplate: "MEMBER" };

test("kutsega antud ametinimetus läheb kirja ilma servatühikuteta", async () => {
  const db = fakeDb();
  await createInvite("org-1", { ...INPUT, jobTitle: "  hooldaja  " }, { db });
  assert.equal(db.state.created.jobTitle, "hooldaja");
});

test("tühi või ainult tühikutest ametinimetus on puuduv, mitte tühi tekst", async () => {
  /* Liikme nime asemel näidatakse ametinimetust: tühikutest tekst jätaks sinna tühja koha
     ja „—” varu ei rakenduks. */
  for (const jobTitle of ["", "   ", null, undefined]) {
    const db = fakeDb();
    await createInvite("org-1", { ...INPUT, jobTitle }, { db });
    assert.equal(db.state.created.jobTitle, null, JSON.stringify(jobTitle));
  }
});

test("ametinimetus lõigatakse 200 märgini", async () => {
  const db = fakeDb();
  await createInvite("org-1", { ...INPUT, jobTitle: "a".repeat(250) }, { db });
  assert.equal(db.state.created.jobTitle.length, 200);
});

test("kutsevorm saadab ametinimetuse ja selle silt on kolmes keeles olemas", () => {
  const source = fs.readFileSync(new URL("../components/org/OrgInvitesClient.jsx", import.meta.url), "utf8");
  assert.match(source, /jobTitle: jobTitle\.trim\(\) \|\| null/, "vorm peab ametinimetuse päringuga kaasa saatma");
  /* Vormi väljad on vaadete failis (leht hoiab olekut ja päringuid). */
  const views = fs.readFileSync(new URL("../components/org/invites/InvitesViews.jsx", import.meta.url), "utf8");
  assert.match(views, /t\("org\.invites\.jobTitle"\)/);
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(fs.readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    assert.equal(typeof messages.org.invites.jobTitle, "string", `${locale}: puudub org.invites.jobTitle`);
  }
});
