/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — töölaua kaart ja tee pinnale.
 *
 * SAMA VIGA, MIS TEENUSPÄEVIKUL: pind võib olla valmis ja töötada, aga
 * töölauale mitte jõuda — sinna saab siis ainult URL-i käsitsi kirjutades.
 * Ükski marsruuditest ei püüa seda, sest nad kõik kontrollivad marsruuti, mitte
 * seda, kas marsruudini ON teed.
 *
 * UI-lipp tohib ainult PEITA (L19): serverilipp on eraldi ja tema on ainus tõde,
 * seega see test ei tõenda ligipääsu, vaid nähtavust.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceDashboardRows } from "../../lib/workspaceDashboardCards.js";

const FLAG = "NEXT_PUBLIC_CASEWORK_V1_ENABLED";

function findCard(role, { hasPaidAccess = true } = {}) {
  const rows = createWorkspaceDashboardRows({ activeRole: role, hasPaidAccess });
  return rows.flat().find((card) => card?.key === "casework") || null;
}

/** Ootab tulemuse ära ENNE lipu taastamist (dünaamiline import on lubadus). */
async function withFlag(value, run) {
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

test("liputa ei ole juhtumite kaarti üheski vaates", async () => {
  for (const value of [undefined, "0"]) {
    await withFlag(value, () => {
      for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER", "CLIENT", "ADMIN"]) {
        assert.equal(findCard(role), null, `${role}: kaart ei tohi liputa ilmuda`);
      }
    });
  }
});

test("lipuga ilmub kaart mõlemale töötaja rollile ja viib /juhtumid-ile", async () => {
  await withFlag("1", () => {
    for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
      const card = findCard(role);
      assert.ok(card, `${role}: kaart puudub`);
      assert.equal(card.route, "/juhtumid");
      assert.equal(typeof card.onClick, "function");
      assert.ok(card.title, "kaardil peab olema pealkiri");
    }
  });
});

test("kaart ei leki kliendi ega admini töölauale ka lipuga", async () => {
  /* API värav lubab ainult `SOCIAL_WORKER` ja `SERVICE_PROVIDER` rolli. Kliendi
     või admini töölauale sattunud kaart viiks pinnale, mis vastab talle 403-ga —
     ja klient näeks lisaks tööriista, mis ei ole tema oma. */
  await withFlag("1", () => {
    for (const role of ["CLIENT", "ADMIN"]) {
      assert.equal(findCard(role), null, `${role} ei tohi kaarti näha`);
    }
  });
});

test("kaart järgib requiresPaid reeglit", async () => {
  await withFlag("1", () => {
    assert.equal(findCard("SOCIAL_WORKER", { hasPaidAccess: false }).disabled, true);
    assert.equal(findCard("SOCIAL_WORKER", { hasPaidAccess: true }).disabled, false);
  });
});

test("eelnoudmise nimekiri sõltub lipust", async () => {
  /* Nimekiri kehtib KÕIGILE töölaua kasutajatele, seega väljas lipuga ei tohi
     ta sisaldada marsruuti, mis vastab `notFound()`-iga. */
  const off = await withFlag("0", () => import("../../lib/workspaceDashboardCards.js?casework-prefetch-off"));
  assert.equal(off.WORKSPACE_ROUTE_PREFETCH_PATHS.includes("/juhtumid"), false);

  const on = await withFlag("1", () => import("../../lib/workspaceDashboardCards.js?casework-prefetch-on"));
  assert.equal(on.WORKSPACE_ROUTE_PREFETCH_PATHS.includes("/juhtumid"), true);
});
