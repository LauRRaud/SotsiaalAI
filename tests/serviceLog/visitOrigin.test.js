/**
 * TEENUSPÄEVIK — külastuse organisatsiooniline päritolu (SOL-SLOG-17, -18, P0).
 *
 * Mõlemad leiud on sama juure kaks otsa: külastus ei kandnud organisatsiooni ja
 * skoop tuletati INIMESE kaudu. Kahes majas töötav inimene ühendas need majad.
 *
 * Iga test siin on NEGATIIVNE — ta küsib, mida teine maja EI näe ja EI saa
 * liigutada. Positiivne rada („oma töö on nähtav") on kõrval, et oleks tõendatud,
 * et filter üldse midagi läbi laseb.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  belongsToOrganization,
  organizationVisitScope,
  resolveSelfAssignedOrganizationId
} from "../../lib/serviceLog/visitOrigin.js";
import { getDispatchBoard } from "../../lib/serviceLog/dispatchBoard.js";
import { reassignVisit } from "../../lib/serviceLog/dispatchAssign.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const ENV = { SERVICE_LOG_ENABLED: "1" };

const orgGrant = { capability: "ORG_OWNER", scopeType: "ORGANIZATION", scopeUnitId: null };

/**
 * Üks töötaja, kaks organisatsiooni, üks tööpäev — täpselt see seis, mis leidu
 * kandis. Külastused kannavad päritolu ja fake filtreerib neid nii, nagu
 * Postgres teeks.
 */
function makeDb({ visits = [], grants = [orgGrant] } = {}) {
  const queries = [];
  return {
    queries,
    organizationMembership: {
      findFirst: async ({ select }) =>
        select?.capabilityGrants
          ? { id: "m-juht", capabilityGrants: grants }
          : { id: "m-tootaja", userId: "worker-1" },
      findMany: async () => [
        {
          id: "m-tootaja",
          jobTitle: "koduhooldaja",
          userId: "worker-1",
          user: { id: "worker-1", email: "worker@example.test", profile: null }
        }
      ]
    },
    serviceWorkRoute: {
      findMany: async () => [
        { id: "route-1", workerUserId: "worker-1", status: "OPEN", startedAt: null, endedAt: null, breakStartedAt: null, breakMinutes: 0 }
      ]
    },
    serviceVisit: {
      findMany: async ({ where }) => {
        queries.push(where);
        return visits.filter(
          (visit) =>
            (where.assignedOrganizationId === undefined ||
              visit.assignedOrganizationId === where.assignedOrganizationId) &&
            (!where.routeId?.in || where.routeId.in.includes(visit.routeId))
        );
      }
    }
  };
}

const visitA = {
  id: "visit-a",
  routeId: "route-1",
  assignedOrganizationId: "org-a",
  status: "PLANNED",
  clientDisplayName: "A maja klient",
  plannedStartAt: null,
  sortOrder: 0,
  enRouteAt: null,
  arrivedAt: null,
  completedAt: null,
  cancelledAt: null,
  outcomeReason: null
};
const visitB = { ...visitA, id: "visit-b", assignedOrganizationId: "org-b", clientDisplayName: "B maja klient" };
/* Töötaja enda lisatud töö, mille päritolu ei ole tõendatav. */
const visitOrphan = { ...visitA, id: "visit-orphan", assignedOrganizationId: null, clientDisplayName: "Sidumata klient" };

test("juhi tahvel näitab oma maja tööd", async () => {
  const db = makeDb({ visits: [visitA, visitB] });
  const board = await getDispatchBoard("manager-a", { organizationId: "org-a" }, { db, now: NOW });
  assert.deepEqual(
    board.workers[0].visits.map((visit) => visit.client),
    ["A maja klient"]
  );
});

/* SEE ON LEID ISE. Sama töötaja, sama tööpäev, teine maja — ja tema kliendi
   nimi ei tohi org A juhi ekraanile jõuda. */
test("teise organisatsiooni klient ei jõua juhi tahvlile", async () => {
  const db = makeDb({ visits: [visitA, visitB] });
  const board = await getDispatchBoard("manager-a", { organizationId: "org-a" }, { db, now: NOW });
  const kogutekst = JSON.stringify(board);
  assert.ok(!kogutekst.includes("B maja klient"), "teise maja kliendi nimi on tahvlil");
  assert.equal(board.workers[0].summary.total ?? board.workers[0].visits.length, 1);
});

test("päringus on päritolu, mitte ainult teekond", async () => {
  const db = makeDb({ visits: [visitA] });
  await getDispatchBoard("manager-a", { organizationId: "org-a" }, { db, now: NOW });
  assert.equal(db.queries[0].assignedOrganizationId, "org-a", "filter puudub päringust");
});

/* Tõendamata päritoluga töö EI ilmu kummalegi juhile: vaikimisi kinni. */
test("sidumata töö ei ilmu ühelegi juhi tahvlile", async () => {
  for (const org of ["org-a", "org-b"]) {
    const db = makeDb({ visits: [visitOrphan] });
    const board = await getDispatchBoard("manager", { organizationId: org }, { db, now: NOW });
    assert.deepEqual(board.workers[0].visits, [], `sidumata töö ilmus ${org} tahvlile`);
  }
});

/* SOL-SLOG-18. Vastus peab olema 404, mitte 403 ega konflikt: teise maja töö
   OLEMASOLU on ise info. */
test("teise organisatsiooni külastust ei saa ümber määrata ja vastus on 404", async () => {
  const db = {
    serviceVisit: {
      findFirst: async () => ({ ...visitB, ownerUserId: "worker-1" })
    }
  };
  await assert.rejects(
    () =>
      reassignVisit(
        "manager-a",
        { organizationId: "org-a", visitId: "visit-b", toWorkerUserId: "worker-2" },
        { db, env: ENV, now: NOW }
      ),
    (error) => error.status === 404
  );
});

test("sidumata päritoluga külastust ei saa ümber määrata", async () => {
  const db = { serviceVisit: { findFirst: async () => ({ ...visitOrphan, ownerUserId: "worker-1" }) } };
  await assert.rejects(
    () =>
      reassignVisit(
        "manager-a",
        { organizationId: "org-a", visitId: "visit-orphan", toWorkerUserId: "worker-2" },
        { db, env: ENV, now: NOW }
      ),
    (error) => error.status === 404
  );
});

/* Päritolukontroll on ENNE olekukontrolli: alustatud võõra töö ei tohi anda
   vastust „see töö on juba alustatud" — seegi kinnitaks tema olemasolu. */
test("võõra maja alustatud töö annab 404, mitte konflikti", async () => {
  const db = {
    serviceVisit: {
      findFirst: async () => ({ ...visitB, status: "ARRIVED", ownerUserId: "worker-1" })
    }
  };
  await assert.rejects(
    () =>
      reassignVisit(
        "manager-a",
        { organizationId: "org-a", visitId: "visit-b", toWorkerUserId: "worker-2" },
        { db, env: ENV, now: NOW }
      ),
    (error) => error.status === 404
  );
});

test("ühemõtteline liikmesus annab enda lisatud tööle päritolu", async () => {
  const db = { organizationMembership: { findMany: async () => [{ organizationId: "org-a" }] } };
  assert.equal(await resolveSelfAssignedOrganizationId("worker-1", { db }), "org-a");
});

/* KAKS MAJA = EI TEA. Esimese valimine tähendaks kliendi nime vale juhi
   ekraanil ja seda ei paranda hiljem miski. */
test("kaks aktiivset liikmesust ei anna päritolu", async () => {
  const db = {
    organizationMembership: {
      findMany: async () => [{ organizationId: "org-a" }, { organizationId: "org-b" }]
    }
  };
  assert.equal(await resolveSelfAssignedOrganizationId("worker-1", { db }), null);
  const otsitud = [];
  await resolveSelfAssignedOrganizationId("worker-1", {
    db: {
      organizationMembership: {
        findMany: async (args) => {
          otsitud.push(args);
          return [];
        }
      }
    }
  });
  assert.equal(otsitud[0].where.status, "ACTIVE", "lõppenud liikmesus ei tohi päritolu anda");
});

test("päritolu võrdlus ei võta tühja väärtust vasteks", () => {
  assert.equal(belongsToOrganization({ assignedOrganizationId: "org-a" }, "org-a"), true);
  assert.equal(belongsToOrganization({ assignedOrganizationId: null }, null), false);
  assert.equal(belongsToOrganization({ assignedOrganizationId: undefined }, undefined), false);
  assert.equal(belongsToOrganization(null, "org-a"), false);
  assert.deepEqual(organizationVisitScope("org-a"), { assignedOrganizationId: "org-a" });
});
