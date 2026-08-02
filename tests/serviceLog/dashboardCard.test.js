/**
 * TEENUSPÄEVIK-V1 — töölaua kaart (leping 8.3).
 *
 * MIKS SEE TEST ÜLDSE ON: pind `/teenuspaevik` oli valmis ja töötas, aga
 * töölauale ei jõudnud — sinna sai ainult URL-i käsitsi kirjutades. Ükski
 * olemasolev värav ei püüdnud seda, sest kõik nad kontrollisid marsruuti, mitte
 * seda, kas marsruudini üldse ON teed. Test kontrollib just seda teed.
 *
 * Lipp loetakse `process.env`-ist KUTSE ajal (mitte mooduli laadimisel), seega
 * saab teda siin ümber lülitada. Erandiks on `WORKSPACE_ROUTE_PREFETCH_PATHS`,
 * mis on mooduli tasemel konstant — teda kontrollitakse värske impordiga.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceDashboardRows } from "../../lib/workspaceDashboardCards.js";

const FLAG = "NEXT_PUBLIC_SERVICE_LOG_ENABLED";

function cardsFor(role, { hasPaidAccess = true } = {}) {
  const rows = createWorkspaceDashboardRows({ activeRole: role, hasPaidAccess });
  return rows.flat();
}

function findServiceLogCard(role, options) {
  return cardsFor(role, options).find((card) => card?.key === "service_log") || null;
}

/**
 * OOTAB TULEMUSE ÄRA enne lipu taastamist. `import()` tagastab lubaduse kohe,
 * aga mooduli keha hinnatakse alles hiljem — sünkroonne `finally` taastaks lipu
 * enne seda ja moodul loeks vale väärtuse. Test läheks siis roheliseks põhjusel,
 * millel pole kontrollitava käitumisega mingit pistmist.
 */
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

test("liputa ei ole teenuspäeviku kaarti töölaual", async () => {
  await withFlag(undefined, () => {
    assert.equal(findServiceLogCard("SERVICE_PROVIDER"), null);
  });
  await withFlag("0", () => {
    assert.equal(findServiceLogCard("SERVICE_PROVIDER"), null);
  });
});

test("lipuga ilmub osutaja töölauale kaart, mis viib /teenuspaevik-ile", async () => {
  await withFlag("1", () => {
    const card = findServiceLogCard("SERVICE_PROVIDER");
    assert.ok(card, "osutaja töölaual peab olema teenuspäeviku kaart");
    assert.equal(card.route, "/teenuspaevik");
    assert.equal(typeof card.onClick, "function");
    assert.ok(card.title, "kaardil peab olema pealkiri");
  });
});

/* Sama reegel, mis teistel osutaja tööriistadel: teenuspäevik on tasuline pind,
   seega tasuta kontol on kaart nähtav aga tuhm, mitte peidus. */
test("kaart järgib requiresPaid reeglit", async () => {
  await withFlag("1", () => {
    assert.equal(findServiceLogCard("SERVICE_PROVIDER", { hasPaidAccess: false }).disabled, true);
    assert.equal(findServiceLogCard("SERVICE_PROVIDER", { hasPaidAccess: true }).disabled, false);
  });
});

/* Teenuspäevik on osutaja arvestuspind. Kui ta lekiks kliendi või sotsiaaltöötaja
   töölauale, näeks kasutaja kaarti, mille API vastab talle 403-ga. */
test("kaart ei ilmu teiste rollide töölauale ka lipuga", async () => {
  await withFlag("1", () => {
    for (const role of ["CLIENT", "SOCIAL_WORKER", "ADMIN"]) {
      assert.equal(findServiceLogCard(role), null, `${role} ei tohi kaarti näha`);
    }
  });
});

/* Eelnoudmise nimekiri kehtib KÕIGILE töölaua kasutajatele, seega väljas lipuga
   ei tohi ta sisaldada marsruuti, mis vastab `notFound()`-iga. */
test("eelnoudmise nimekiri sõltub lipust", async () => {
  const off = await withFlag("0", () => import("../../lib/workspaceDashboardCards.js?prefetch-off"));
  assert.equal(off.WORKSPACE_ROUTE_PREFETCH_PATHS.includes("/teenuspaevik"), false);

  const on = await withFlag("1", () => import("../../lib/workspaceDashboardCards.js?prefetch-on"));
  assert.equal(on.WORKSPACE_ROUTE_PREFETCH_PATHS.includes("/teenuspaevik"), true);
});
