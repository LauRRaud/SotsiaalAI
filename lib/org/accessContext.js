/**
 * T25 ORG-FOUNDATION-V1 — organisatsioonikonteksti KANOONILINE serveritõde.
 *
 * NIMI (otsus O-E0-2/O-E0-4): funktsioon on `resolveOrgAccessContext`, MITTE
 * `resolveWorkspaceAccessContext`. Sõna „workspace" tähendab selles koodibaasis
 * juba midagi muud — `lib/workspaces/registry.js` `WorkspaceKind` on TÖÖ-OBJEKTI
 * liik (`room`, `journey`, `covision_case`, …) ja seda tähendust kannavad
 * `DomainEvent.workspaceKind` / `NotificationEvent.workspaceKind`. Kaks
 * tähendust ühes nimeruumis oleks turvavigade allikas.
 *
 * MIDA SEE FUNKTSIOON EI TEE (arenduskava §4 kõvad keelud):
 *   - ei anna ligipääsu ühelegi privaatobjektile. Siin ei ole ühtegi päringut
 *     `WellbeingRecord`-i, `Conversation`-i, `Journey` sisu, `UserDocument`-i,
 *     supervisiooni, kovisiooni ega mentorluse pihta;
 *   - ei asenda olemasolevat owner-/participant-kontrolli. Org-kontekst on
 *     LISAtingimus, mitte möödapääs;
 *   - `ORG_OWNER` ei ole superuser;
 *   - platvormi admin EI saa org-route'i kaudu sisudrilldown'i (§11.1).
 *
 * FAIL-CLOSED: iga tundmatu, aegunud või vastuoluline sisend annab isikliku
 * konteksti või vea, mitte osalise organisatsiooniõiguse.
 */

import prisma from "@/lib/prisma";
import { normalizeRole } from "@/lib/authz";

import {
  OrganizationCapabilityScopeType,
  OrganizationMembershipStatus,
  OrganizationModuleStatus,
  OrganizationStatus,
  ORGANIZATION_ONLY_CAPABILITIES,
  requiredModulesForCapability
} from "./constants.js";
import { conflict, forbidden, notFound } from "./errors.js";
import { assertOrgWorkspaceEnabled, isOrgWorkspaceEnabled } from "./flags.js";
import { unitScopeCovers } from "./units.js";

export const WorkspaceContextKind = Object.freeze({
  PERSONAL: "personal",
  ORGANIZATION: "organization"
});

export const PayerSource = Object.freeze({
  SELF: "SELF",
  INDIVIDUAL_SPONSOR: "INDIVIDUAL_SPONSOR",
  ORGANIZATION: "ORGANIZATION"
});

/**
 * Organisatsioon, mis lubab ka KIRJUTAMIST. Muud olekud on parimal juhul loetavad.
 *
 * EKSPORDITUD, sest neid kaht hulka peab lugema ka teenuskiht, mis oma skoobi ise
 * tuletab (`lib/serviceLog/dispatchBoard.js`, SOL-ORG-02). Teine koopia lahkneks
 * esimese olekumuudatusega ja lahknemise suund oleks alati sama: värav jääks
 * lahti seal, kus teda ei uuendatud.
 */
export const WRITABLE_ORG_STATUSES = new Set([OrganizationStatus.ACTIVE]);

/**
 * Olekud, mille korral organisatsioon on liikmele üldse NÄHTAV. `DRAFT` ja
 * `PENDING_VERIFICATION` on nähtavad, sest looja peab saama oma pooleliolevat
 * organisatsiooni avada; `ARCHIVED` mitte, sest arhiveeritu ei ole tööruum.
 */
export const VISIBLE_ORG_STATUSES = new Set([
  OrganizationStatus.DRAFT,
  OrganizationStatus.PENDING_VERIFICATION,
  OrganizationStatus.ACTIVE,
  OrganizationStatus.SUSPENDED
]);

function isLiveGrant(grant, now) {
  if (grant.revokedAt) return false;
  if (grant.validFrom && new Date(grant.validFrom) > now) return false;
  if (grant.validUntil && new Date(grant.validUntil) <= now) return false;
  return true;
}

/**
 * Isiklik kontekst. Ta ei ole „organisatsiooni puudumise veaseis", vaid
 * täisväärtuslik tööruum: arenduskava §D1 „organisatsioonist lahkumine ei kustuta
 * ega lukusta inimese kontot".
 */
function personalContext({ userId, effectiveProductRole, payerSource, isPlatformAdmin, orgWorkspaceEnabled }) {
  return Object.freeze({
    kind: WorkspaceContextKind.PERSONAL,
    userId,
    effectiveProductRole,
    payerSource,
    writable: true,
    organization: null,
    membership: null,
    seat: null,
    units: Object.freeze([]),
    primaryUnitId: null,
    activeModules: Object.freeze([]),
    capabilities: Object.freeze([]),
    isPlatformAdmin,
    orgWorkspaceEnabled
  });
}

/**
 * Maksja serveritõde. Viilus A on kaks võimalikku allikat: kasutaja enda tellimus
 * või individuaalne sponsor (`Subscription.billingSource = SPONSORED_BY_HOST`).
 * `PayerSource.ORGANIZATION` muutub võimalikuks alles viilus B koos
 * `OrganizationSeatAssignment`-iga — siin seda TEADLIKULT ei simuleerita.
 */
async function resolvePayerSource(userId, { db, now }) {
  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { billingSource: true, sponsorUserId: true, sponsorOrganizationId: true },
    orderBy: { updatedAt: "desc" }
  });
  if (!subscription) return { payerSource: PayerSource.SELF, payerOrganizationId: null };
  if (subscription.billingSource === "SPONSORED_BY_ORGANIZATION") {
    return {
      payerSource: PayerSource.ORGANIZATION,
      payerOrganizationId: subscription.sponsorOrganizationId || null
    };
  }
  if (subscription.billingSource === "SPONSORED_BY_HOST") {
    return { payerSource: PayerSource.INDIVIDUAL_SPONSOR, payerOrganizationId: null };
  }
  return { payerSource: PayerSource.SELF, payerOrganizationId: null };
}

/**
 * Lahendab kasutaja tööruumikonteksti.
 *
 * @param {Object} input
 * @param {string} input.userId
 * @param {string|null} [input.requestedOrganizationId] URL-ist tulnud siht. See
 *   on AINULT soov — server tõendab liikmesuse iga kord uuesti (arenduskava §6).
 * @param {boolean} [input.isPlatformAdmin]
 * @param {string} [input.productRole] sessiooni roll; normaliseeritakse.
 * @returns {Promise<Object>} külmutatud kontekst
 */
export async function resolveOrgAccessContext(
  { userId, requestedOrganizationId = null, isPlatformAdmin = false, productRole = null },
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId) throw notFound();

  const orgWorkspaceEnabled = isOrgWorkspaceEnabled(env);
  const effectiveProductRole = normalizeRole(productRole);
  const payer = await resolvePayerSource(trimmedUserId, { db, now });
  const payerSource = payer.payerSource;
  const orgId = String(requestedOrganizationId || "").trim();

  if (!orgId) {
    return personalContext({
      userId: trimmedUserId,
      effectiveProductRole,
      payerSource,
      isPlatformAdmin,
      orgWorkspaceEnabled
    });
  }

  // Globaalne värav ENNE ühtegi org-päringut: väljas olles ei tohi tekkida ka
  // seda infot, kas selline organisatsioon eksisteerib (arenduskava §10).
  assertOrgWorkspaceEnabled(env);

  /* Liikmesus JA organisatsioon ühes päringus. Liikmesus on filtri OSA, mitte
     järelkontroll — nii ei saa võõra organisatsiooni rida kunagi mällu, mille
     peale keegi hiljem kogemata projektsiooni ehitaks. */
  const membership = await db.organizationMembership.findFirst({
    where: {
      organizationId: orgId,
      userId: trimmedUserId,
      status: OrganizationMembershipStatus.ACTIVE
    },
    select: {
      id: true,
      status: true,
      seatRole: true,
      jobTitle: true,
      startedAt: true,
      organization: {
        select: {
          id: true,
          displayName: true,
          legalName: true,
          legalKind: true,
          status: true,
          municipalityId: true,
          defaultLocale: true,
          timezone: true
        }
      },
      units: {
        where: { endedAt: null },
        select: {
          unitId: true,
          isPrimary: true,
          unit: { select: { id: true, name: true, type: true, parentUnitId: true, depth: true, status: true } }
        }
      },
      capabilityGrants: {
        select: {
          id: true,
          capability: true,
          scopeType: true,
          scopeUnitId: true,
          validFrom: true,
          validUntil: true,
          revokedAt: true
        }
      }
    }
  });

  /* 404, mitte 403 — võõras organisatsioon ja olematu organisatsioon peavad
     olema eristamatud (arenduskava §6, §11.1). Sama vastus saab ka platvormi
     admin: adminiroll ei ole organisatsiooniliikmesus. */
  if (!membership || !membership.organization) throw notFound("org.errors.organization_not_found");

  const organization = membership.organization;
  if (!VISIBLE_ORG_STATUSES.has(organization.status)) {
    throw notFound("org.errors.organization_not_found");
  }

  const writable = WRITABLE_ORG_STATUSES.has(organization.status);

  const moduleRows = await db.organizationModule.findMany({
    where: {
      organizationId: organization.id,
      status: OrganizationModuleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { moduleKey: true }
  });
  const activeModules = moduleRows.map((row) => row.moduleKey);
  const activeModuleSet = new Set(activeModules);

  /* Organisatsiooni üksused on vaja skoobi pärilikkuse arvutamiseks: üksuse
     capability katab valitud üksuse JA selle alampuu, aga mitte õdeüksust. */
  const unitRows = await db.organizationUnit.findMany({
    where: { organizationId: organization.id },
    select: { id: true, organizationId: true, parentUnitId: true, depth: true, status: true }
  });

  /* T25 viil B: kas organisatsioon maksab SELLE inimese töötajakoha eest?
     Koht on `payerSource` allikas, MITTE õiguse allikas — koht ei anna ühtegi
     capability't ja capability ei anna kohta (arenduskava §D5). */
  const seatAssignment = await db.organizationSeatAssignment.findFirst({
    where: { membershipId: membership.id, status: "ACTIVE" },
    select: {
      id: true,
      seatPlanId: true,
      seatPlan: { select: { seatRole: true, organizationId: true } }
    }
  });

  const capabilities = membership.capabilityGrants
    .filter((grant) => isLiveGrant(grant, now))
    .filter((grant) => {
      /* Moodulita capability ei kehti (arenduskava §6). See on POSITIIVNE
         kontroll: tundmatu capability jaoks tagastab `requiredModulesForCapability`
         tühja loendi ja `every` annab true — see on õige, sest moodulinõue
         puudub, mitte ei ole „kontroll vahele jäetud". */
      const required = requiredModulesForCapability(grant.capability);
      return required.every((moduleKey) => activeModuleSet.has(moduleKey));
    })
    .filter((grant) => {
      /* Kaitse vigase andmerea vastu: kui ORGANIZATION-skoobiga capability on
         kuidagi saanud üksuse (või vastupidi), on grant KEHTETU, mitte
         „umbes õige". DB CHECK peaks selle ära hoidma; see on teine lukk. */
      if (grant.scopeType === OrganizationCapabilityScopeType.UNIT) return Boolean(grant.scopeUnitId);
      if (ORGANIZATION_ONLY_CAPABILITIES.includes(grant.capability)) return !grant.scopeUnitId;
      return !grant.scopeUnitId;
    })
    .map((grant) =>
      Object.freeze({
        capability: grant.capability,
        scopeType: grant.scopeType,
        scopeUnitId: grant.scopeUnitId || null
      })
    );

  const units = membership.units
    .filter((row) => row.unit)
    .map((row) =>
      Object.freeze({
        id: row.unit.id,
        name: row.unit.name,
        type: row.unit.type,
        parentUnitId: row.unit.parentUnitId,
        depth: row.unit.depth,
        status: row.unit.status,
        isPrimary: Boolean(row.isPrimary)
      })
    );

  return Object.freeze({
    kind: WorkspaceContextKind.ORGANIZATION,
    userId: trimmedUserId,
    effectiveProductRole,
    /* Maksja on SERVERITÕDE ja ta ei tulene org-kontekstis viibimisest.
       `ORGANIZATION` kehtib ainult siis, kui inimesel on selle organisatsiooni
       aktiivne KOHT (töötaja) või selle organisatsiooni sponsoreeritud tellimus
       (pöörduja). Teise organisatsiooni makstud ligipääs ei muutu selles
       kontekstis org-rahastuseks — seepärast võrdleme `payerOrganizationId`-d. */
    payerSource:
      payerSource === PayerSource.ORGANIZATION && payer.payerOrganizationId !== organization.id
        ? PayerSource.SELF
        : seatAssignment
          ? PayerSource.ORGANIZATION
          : payerSource,
    seat: seatAssignment
      ? Object.freeze({
          id: seatAssignment.id,
          seatPlanId: seatAssignment.seatPlanId,
          seatRole: seatAssignment.seatPlan?.seatRole || null
        })
      : null,
    writable,
    organization: Object.freeze({
      id: organization.id,
      displayName: organization.displayName,
      legalName: organization.legalName,
      legalKind: organization.legalKind,
      status: organization.status,
      municipalityId: organization.municipalityId,
      defaultLocale: organization.defaultLocale,
      timezone: organization.timezone
    }),
    membership: Object.freeze({
      id: membership.id,
      status: membership.status,
      seatRole: membership.seatRole,
      jobTitle: membership.jobTitle,
      startedAt: membership.startedAt
    }),
    units: Object.freeze(units),
    primaryUnitId: units.find((unit) => unit.isPrimary)?.id || null,
    activeModules: Object.freeze(activeModules),
    capabilities: Object.freeze(capabilities),
    /* Platvormi admin nähakse ära, aga see EI anna org-õigusi. Väli on olemas
       ainult selleks, et ops-vaated saaksid end eristada — mitte drill-down'iks. */
    isPlatformAdmin,
    orgWorkspaceEnabled,
    /* Sisemine: üksuste puu skoobiarvutuseks. Ei kuulu ühtegi API-vastusesse. */
    _unitTree: Object.freeze(unitRows)
  });
}

/**
 * Kas kontekstil on capability? `unitId` andmisel peab skoop katma ka selle
 * üksuse — org-skoop katab kõik, üksuse skoop katab alampuu.
 */
export function hasCapability(context, capability, { unitId = null } = {}) {
  if (!context || context.kind !== WorkspaceContextKind.ORGANIZATION) return false;
  const grants = context.capabilities.filter((grant) => grant.capability === capability);
  if (!grants.length) return false;

  for (const grant of grants) {
    if (grant.scopeType === OrganizationCapabilityScopeType.ORGANIZATION) return true;
    if (!unitId) continue;
    if (unitScopeCovers(grant.scopeUnitId, unitId, context._unitTree || [])) return true;
  }
  return false;
}

/** Kas mõni loendi capability'dest kehtib? */
export function hasAnyCapability(context, capabilities, options) {
  return capabilities.some((capability) => hasCapability(context, capability, options));
}

/**
 * Väravafunktsioon route'idele. 403, sest kasutaja ON liige ja teab
 * organisatsiooni olemasolu — 404 oleks siin eksitav, mitte kaitsev.
 */
export function assertCapability(context, capability, options) {
  if (!hasCapability(context, capability, options)) {
    throw forbidden("org.errors.missing_capability", { capability });
  }
  return true;
}

/** Kirjutustoiming peatatud või arhiveeritud organisatsioonis on 409. */
export function assertWritable(context) {
  if (!context?.writable) throw conflict("org.errors.organization_not_writable");
  return true;
}

/** Kas moodul on aktiivne? Mooduliväline route peab failima suletult. */
export function hasActiveModule(context, moduleKey) {
  return Boolean(context?.activeModules?.includes(moduleKey));
}

/**
 * Kliendile saadetav projektsioon. TEADLIKULT ei sisalda `_unitTree`-d ega ühtegi
 * välja, mille pealt saaks järeldada teiste liikmete olemasolu või tegevust.
 */
export function toClientContext(context) {
  if (!context) return null;
  if (context.kind === WorkspaceContextKind.PERSONAL) {
    return {
      kind: context.kind,
      effectiveProductRole: context.effectiveProductRole,
      payerSource: context.payerSource,
      organization: null,
      capabilities: [],
      activeModules: []
    };
  }
  return {
    kind: context.kind,
    effectiveProductRole: context.effectiveProductRole,
    payerSource: context.payerSource,
    writable: context.writable,
    organization: context.organization,
    membership: {
      id: context.membership.id,
      seatRole: context.membership.seatRole,
      jobTitle: context.membership.jobTitle
    },
    /* Kasutaja NÄEB, kes tema ligipääsu rahastab (arenduskava §5.6 „UI näitab
       kasutajale, kes tema ligipääsu rahastab"). Koha ID jääb serverisse —
       kliendile piisab faktist, et koht on olemas. */
    seat: context.seat ? { seatRole: context.seat.seatRole } : null,
    units: context.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      isPrimary: unit.isPrimary
    })),
    capabilities: context.capabilities.map((grant) => ({
      capability: grant.capability,
      scopeType: grant.scopeType,
      scopeUnitId: grant.scopeUnitId
    })),
    activeModules: context.activeModules
  };
}
