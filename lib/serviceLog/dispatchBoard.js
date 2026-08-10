/**
 * TEENUSPÄEVIK E10 — JUHI STAATUSTAHVEL.
 *
 * MIDA SEE TAHVEL NÄITAB JA MIDA MITTE. Leping on siin ühemõtteline: „Juhi
 * staatustahvel näitab olekut ja hilinemist, MITTE ELAVAT GPS-JADA."
 *
 *   ✓ kelle päev on avatud, mitu külastust tehtud, mitu ees
 *   ✓ mis on käigus ja kui kaua ta on käigus olnud
 *   ✓ mis jäi ära või tegemata ja MIKS
 *   ✗ koordinaate — mitte ühtegi, ka mitte „ainult juhile"
 *   ✗ märkuste sisu — see on kliendi asi, mitte töökorralduse oma
 *
 * See vahe ei ole tehniline detail, vaid kogu meie positsioneering: „koduteenuse
 * töökorraldus ilma pideva töötajajälgimiseta". Kui siia tekib kunagi kaardil
 * liikuv punkt, oleme lihtsalt üks logistikarakendus juurde.
 *
 * KUIDAS SKOOP TEKIB, ILMA ET TEENUSKIRJE PEAKS ORGANISATSIOONI TUNDMA.
 *
 * Teenuspäevik on SOLO-profiili põhine: igal töötajal on oma
 * `ServiceProviderProfile`. Organisatsioon elab eraldi kihis (T25). Neid EI
 * ühendata võõrvõtmega — see oleks sama viga, mille eest `tests/org/contracts`
 * meid juba korra hoiatas.
 *
 * Selle asemel tuletatakse skoop INIMESTE kaudu: juhi üksused → nende üksuste
 * aktiivsed liikmed → nende `workerUserId`. Kui inimene lahkub üksusest,
 * kaob ta tahvlilt järgmisel päringul, ilma et ükski kirje muutuks.
 *
 * INIMENE ÜTLEB, KEDA NÄIDATA — TÖÖ ISE ÜTLEB, MIDA (SOL-SLOG-17, P0).
 *
 * Ülemine lõik kirjeldab poolt asja ja see pool oli lekkiv. Kahes
 * organisatsioonis töötaval inimesel on ÜKS SOLO-profiil ja ÜKS tööpäev, seega
 * „minu üksuse inimeste külastused" tõi ekraanile ka teise maja klientide
 * nimed, hilinemise ja `outcomeReason`-i. Inimese kaudu tuletatud skoop ei
 * tõenda töö organisatsioonilist päritolu — seda tõendab ainult see, mis
 * kirjutati töö sünni hetkel (`ServiceVisit.assignedOrganizationId`).
 *
 * Nüüd on kaks filtrit ja nad vastavad eri küsimustele:
 *   - LIIKMESUS ütleb, kelle read tahvlile ilmuvad;
 *   - KÜLASTUSE PÄRITOLU ütleb, millised tööd nendel ridadel on.
 *
 * MIS JÄÄB NÄHA ka siis, kui ühtegi tööd ei ole: tööpäeva enda seis (avatud,
 * paus, lõpetatud). See on selle inimese päev, kes ON selle juhi liige, ja juht
 * peab teadma, kas ta on alustanud. Kliendi kohta ei ütle see mitte midagi.
 */

import { prisma } from "@/lib/prisma";

import {
  OrganizationCapability,
  OrganizationMembershipStatus,
  OrganizationModuleStatus,
  requiredModulesForCapability
} from "@/lib/org/constants";
import { VISIBLE_ORG_STATUSES, WRITABLE_ORG_STATUSES } from "@/lib/org/accessContext";
import { collectSubtree } from "@/lib/org/units";

import { ROUTE_STATUS, VISIT_STATUS, staleVisits, summarizeRoute } from "./dayRouteMachine.js";
import { organizationVisitScope } from "./visitOrigin.js";

/** Kes tohib tahvlit näha. `WORK_ASSIGNER` planeerib, `UNIT_LEAD` juhib. */
const BOARD_CAPABILITIES = [
  OrganizationCapability.UNIT_LEAD,
  OrganizationCapability.WORK_ASSIGNER,
  OrganizationCapability.ORG_OWNER
];

function toCalendarDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function personName(user) {
  const full = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ").trim();
  return full || user?.email || "";
}

const DENIED_SCOPE = Object.freeze({ allowed: false, unitIds: [], wholeOrg: false, writable: false });

/**
 * Millised üksused kuuluvad juhi vaatevälja.
 *
 * ORGANISATSIOONI-SKOOBIGA luba (`ORG_OWNER`, org-skoobis `UNIT_LEAD`) annab
 * KÕIK üksused; üksuse-skoobiga luba annab täpselt selle üksuse. Vahepealset
 * „natuke rohkem" ei ole.
 *
 * KOLM TINGIMUST, MITTE ÜKS (SOL-ORG-02). Varem luges see funktsioon ainult
 * kehtivaid grante ja jättis kaks organisatsioonilepingu tingimust vahele:
 *
 *   1. ORGANISATSIOON ISE peab olema nähtav. Arhiveeritud maja ei ole tööruum.
 *   2. MOODUL peab olema aktiivne. `WORK_ASSIGNER` on seotud `KOV_INTAKE`-iga
 *      (`CAPABILITY_REQUIRED_MODULES`) — mooduli väljalülitamine peab võtma ka
 *      graafikuõiguse, muidu on toote väljalülitamine ainult UI-otsus.
 *   3. KIRJUTAMINE nõuab lisaks AKTIIVSET organisatsiooni. Peatatud maja on
 *      loetav (juht peab nägema, mis pooleli jäi), aga tema liige ei tohi enam
 *      uut tööd määrata ega ümber jagada.
 *
 * VÄRAV ON SIIN, MITTE MARSRUUDIS. Graafiku POST oli ainus tavapärane
 * org-konteksti kirjutusrada ilma `assertWritable()`-ita; sama kontrolli
 * kordamine route'is oleks parandanud ühe kutsuja ja jätnud järgmise lahti.
 * Teenuskiht tuletab skoobi ise, seega peab ta ka reeglid ise kandma.
 */
export async function resolveBoardScope(userId, organizationId, { db = prisma, now = new Date() } = {}) {
  if (!organizationId) return DENIED_SCOPE;

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true }
  });
  if (!organization || !VISIBLE_ORG_STATUSES.has(organization.status)) return DENIED_SCOPE;

  const membership = await db.organizationMembership.findFirst({
    where: {
      userId,
      organizationId,
      status: OrganizationMembershipStatus.ACTIVE
    },
    select: {
      id: true,
      capabilityGrants: {
        where: {
          revokedAt: null,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          capability: { in: BOARD_CAPABILITIES }
        },
        select: { capability: true, scopeType: true, scopeUnitId: true }
      }
    }
  });
  if (!membership?.capabilityGrants?.length) return DENIED_SCOPE;

  const moduleRows = await db.organizationModule.findMany({
    where: {
      organizationId,
      status: OrganizationModuleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { moduleKey: true }
  });
  const activeModules = new Set(moduleRows.map((row) => row.moduleKey));

  /* POSITIIVNE kontroll, sama kuju mis `resolveOrgAccessContext`-is: moodulinõudeta
     capability jaoks on loend tühi ja `every` annab `true` — see on „nõuet ei ole",
     mitte „kontroll jäi vahele". */
  const grants = membership.capabilityGrants.filter((grant) =>
    requiredModulesForCapability(grant.capability).every((moduleKey) => activeModules.has(moduleKey))
  );
  if (!grants.length) return DENIED_SCOPE;

  const wholeOrg = grants.some((grant) => grant.scopeType === "ORGANIZATION");
  const scopeUnitIds = [
    ...new Set(
      grants
        .filter((grant) => grant.scopeType === "UNIT" && grant.scopeUnitId)
        .map((grant) => grant.scopeUnitId)
    )
  ];

  /**
   * ÜKSUSE SKOOP KATAB ALAMPUU (SOL-ORG-04).
   *
   * Leping on igal pool sama: „org-skoop katab kõik üksused; üksuse skoop katab
   * valitud üksuse JA selle alampuu" — õeüksusesse ei leki. See resolver luges
   * varem ainult grantis otseselt nimetatud üksust, seega osakonnajuht ei
   * näinud oma allüksuste töötajaid ega saanud neile tööd määrata. Viga oli
   * KITSENDAV, mitte lekkiv, aga lahknemine ise on siin oht: kaks skoobi-
   * mõistet ühes tootes tähendab, et keegi peab meeles pidama, kumb kehtib.
   *
   * Puu loetakse ainult siis, kui üksuse-skoobiga grant üldse olemas on.
   * Org-skoobiga juht ei vaja puud — tema katab niikuinii kõik.
   */
  let unitIds = scopeUnitIds;
  if (!wholeOrg && scopeUnitIds.length) {
    const unitRows = await db.organizationUnit.findMany({
      where: { organizationId },
      select: { id: true, parentUnitId: true }
    });
    unitIds = [...new Set(scopeUnitIds.flatMap((unitId) => collectSubtree(unitId, unitRows)))];
  }

  return {
    allowed: wholeOrg || unitIds.length > 0,
    unitIds,
    wholeOrg,
    writable: WRITABLE_ORG_STATUSES.has(organization.status)
  };
}

/**
 * Juhi tahvel ühe päeva kohta.
 *
 * ÕIGUSETA LIIGE SAAB TÜHJA TAHVLI, mitte 403. Veakood ütleks, et siin on
 * midagi, mida ta näha ei tohi — ja seegi on info. Sama muster mis
 * vastuvõtulaual.
 */
export async function getDispatchBoard(
  userId,
  { organizationId, date = null } = {},
  { db = prisma, now = new Date() } = {}
) {
  const scope = await resolveBoardScope(userId, organizationId, { db, now });
  if (!scope.allowed) return { allowed: false, date: null, workers: [] };

  const day = toCalendarDate(date || now);
  if (!day) return { allowed: true, date: null, workers: [] };

  /* AKTIIVSED LIIKMED juhi üksustes. `endedAt: null` on oluline: eelmisel kuul
     lahkunud inimese päev ei kuulu enam sellele juhile. */
  const memberships = await db.organizationMembership.findMany({
    where: {
      organizationId,
      status: OrganizationMembershipStatus.ACTIVE,
      ...(scope.wholeOrg ? {} : { units: { some: { unitId: { in: scope.unitIds }, endedAt: null } } })
    },
    select: {
      id: true,
      jobTitle: true,
      userId: true,
      user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } }
    },
    take: 200
  });
  if (!memberships.length) return { allowed: true, date: day.toISOString().slice(0, 10), workers: [] };

  const workerIds = memberships.map((row) => row.userId).filter(Boolean);

  const routes = await db.serviceWorkRoute.findMany({
    where: { workerUserId: { in: workerIds }, date: day },
    select: {
      id: true,
      workerUserId: true,
      status: true,
      startedAt: true,
      endedAt: true,
      breakStartedAt: true,
      breakMinutes: true
    },
    take: 500
  });

  const visits = routes.length
    ? await db.serviceVisit.findMany({
        /* KAKS TINGIMUST. Teekond ütleb, kelle päev; päritolu ütleb, kelle töö.
           Ilma teiseta ulatub kahes majas töötava inimese päev mõlemasse. */
        where: {
          routeId: { in: routes.map((row) => row.id) },
          ...organizationVisitScope(organizationId)
        },
        /* VALGE NIMEKIRI. `note`, `noteProvenance` ja `locationStamps` EI OLE
           siin ja see on lepingu nõue, mitte optimeerimine: tahvel näitab
           olekut ja hilinemist, mitte sisu ega asukohta. */
        select: {
          id: true,
          routeId: true,
          status: true,
          clientDisplayName: true,
          plannedStartAt: true,
          sortOrder: true,
          enRouteAt: true,
          arrivedAt: true,
          completedAt: true,
          cancelledAt: true,
          outcomeReason: true
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 2000
      })
    : [];

  const byRoute = new Map();
  for (const visit of visits) {
    if (!byRoute.has(visit.routeId)) byRoute.set(visit.routeId, []);
    byRoute.get(visit.routeId).push(visit);
  }

  const workers = memberships.map((membership) => {
    const route = routes.find((row) => row.workerUserId === membership.userId) || null;
    const own = route ? byRoute.get(route.id) || [] : [];
    const summary = summarizeRoute(own, { breakMinutes: route?.breakMinutes || 0 });
    const stale = staleVisits(own, { now });

    return {
      membershipId: membership.id,
      name: personName(membership.user),
      jobTitle: membership.jobTitle || null,
      /* PÄEVA SEIS kolmes sõnas: kas alustatud, kas käib, kas lõpetatud. */
      routeStatus: route ? route.status : null,
      startedAt: route?.startedAt?.toISOString?.() || null,
      endedAt: route?.endedAt?.toISOString?.() || null,
      onBreak: Boolean(route?.breakStartedAt),
      summary,
      /* HILINEMINE, mitte asukoht: plaanitud algus on möödas ja külastus on
         ikka `PLANNED`. See on ainus „kus ta on" küsimus, millele me vastame —
         ja vastus on „ta ei ole veel alustanud", mitte koordinaat. */
      late: own
        .filter(
          (visit) =>
            visit.status === VISIT_STATUS.PLANNED &&
            visit.plannedStartAt &&
            new Date(visit.plannedStartAt).getTime() < now.getTime()
        )
        .map((visit) => ({
          id: visit.id,
          client: visit.clientDisplayName || null,
          plannedStartAt: visit.plannedStartAt.toISOString(),
          minutesLate: Math.round((now.getTime() - new Date(visit.plannedStartAt).getTime()) / 60000)
        })),
      needsCheck: stale.map((visit) => ({
        id: visit.id,
        client: visit.clientDisplayName || null,
        since: (visit.arrivedAt || visit.enRouteAt)?.toISOString?.() || null
      })),
      visits: own.map((visit) => ({
        id: visit.id,
        status: visit.status,
        client: visit.clientDisplayName || null,
        plannedStartAt: visit.plannedStartAt?.toISOString?.() || null,
        arrivedAt: visit.arrivedAt?.toISOString?.() || null,
        completedAt: visit.completedAt?.toISOString?.() || null,
        outcomeReason: visit.outcomeReason || null
      }))
    };
  });

  /* JÄRJESTUS: kes vajab tähelepanu, on ees. Juht avab tahvli hommikul ja
     tema esimene küsimus ei ole „kes on tubli", vaid „kus on probleem". */
  workers.sort((a, b) => {
    const weight = (worker) =>
      (worker.needsCheck.length ? 2 : 0) + (worker.late.length ? 1 : 0);
    return weight(b) - weight(a) || a.name.localeCompare(b.name);
  });

  return {
    allowed: true,
    date: day.toISOString().slice(0, 10),
    workers,
    totals: {
      workers: workers.length,
      open: workers.filter((worker) => worker.routeStatus === ROUTE_STATUS.OPEN).length,
      late: workers.reduce((sum, worker) => sum + worker.late.length, 0),
      needsCheck: workers.reduce((sum, worker) => sum + worker.needsCheck.length, 0)
    }
  };
}
