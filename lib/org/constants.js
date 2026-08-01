/**
 * T25 ORG-FOUNDATION-V1 — organisatsioonikihi rakendustaseme konstandid.
 *
 * Need peegeldavad Prisma enumeid, aga on eraldi objektid, sest UI, testid ja
 * teenusekiht ei tohi sõltuda genereeritud kliendist. Kui lisad siia väärtuse,
 * lisa ta ka skeemi ja migratsiooni — `tests/org/contracts.test.js` võrdleb neid.
 *
 * KÕVA PIIR (arenduskava §D3): siin ei ole ega tule ühtegi globaalset
 * kasutajarolli. `Role` enumis on jätkuvalt ADMIN / SOCIAL_WORKER /
 * SERVICE_PROVIDER / CLIENT ja organisatsioonisisene juhtimine elab
 * capability'des. Juht ei ole neljas hinnaklass.
 */

export const OrganizationLegalKind = Object.freeze({
  MUNICIPALITY: "MUNICIPALITY",
  PUBLIC_AGENCY: "PUBLIC_AGENCY",
  COMPANY: "COMPANY",
  NGO: "NGO",
  FOUNDATION: "FOUNDATION",
  SOLE_PROPRIETOR: "SOLE_PROPRIETOR",
  OTHER: "OTHER"
});

export const ORGANIZATION_LEGAL_KINDS = Object.freeze(Object.values(OrganizationLegalKind));

export const OrganizationStatus = Object.freeze({
  DRAFT: "DRAFT",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED"
});

export const ORGANIZATION_STATUSES = Object.freeze(Object.values(OrganizationStatus));

/**
 * Lubatud olekusiirded. Kõik muu on 409. `ARCHIVED` on terminal: arhiveeritud
 * organisatsiooni ei äratata ellu, vaid luuakse uus (arenduskava §5.1).
 */
export const ORGANIZATION_STATUS_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(["PENDING_VERIFICATION", "ARCHIVED"]),
  PENDING_VERIFICATION: Object.freeze(["ACTIVE", "DRAFT", "ARCHIVED"]),
  ACTIVE: Object.freeze(["SUSPENDED", "ARCHIVED"]),
  SUSPENDED: Object.freeze(["ACTIVE", "ARCHIVED"]),
  ARCHIVED: Object.freeze([])
});

/**
 * CORE-V1 moodulid. `WELLBEING_AGGREGATE` ja `ON_CALL` on arenduskavas nimetatud,
 * kuid TEADLIKULT puuduvad: neid lisab see viil, mis nad kasutusele võtab
 * (§D9 nõuab mehitatud vastuvõtjat, §13 lükkab koondi `ORG-WELLBEING-V1`-le).
 */
export const OrganizationModuleKey = Object.freeze({
  KOV_INTAKE: "KOV_INTAKE",
  SERVICE_DELIVERY: "SERVICE_DELIVERY",
  PROFESSIONAL_SUPPORT: "PROFESSIONAL_SUPPORT",
  ORG_KNOWLEDGE: "ORG_KNOWLEDGE"
});

export const ORGANIZATION_MODULE_KEYS = Object.freeze(Object.values(OrganizationModuleKey));

export const OrganizationModuleStatus = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED"
});

export const OrganizationUnitType = Object.freeze({
  DEPARTMENT: "DEPARTMENT",
  TEAM: "TEAM",
  SERVICE_LOCATION: "SERVICE_LOCATION",
  OTHER: "OTHER"
});

export const ORGANIZATION_UNIT_TYPES = Object.freeze(Object.values(OrganizationUnitType));

export const OrganizationUnitStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
});

/** Arenduskava §5.2: „maksimaalne toetatud sügavus V1-s: 3". Juuretasand = 1. */
export const MAX_UNIT_DEPTH = 3;

export const OrganizationMembershipStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ENDED: "ENDED"
});

/**
 * Hinnastatav koharoll. `CLIENT` ei kuulu siia (otsus O-E0-1): pöördujast ei saa
 * organisatsiooniliiget ja tema sponsoreeritud ligipääs käib eraldi rada, mille
 * viil B ehitab ruumist sõltumatuks.
 */
export const OrganizationSeatRole = Object.freeze({
  SOCIAL_WORKER: "SOCIAL_WORKER",
  SERVICE_PROVIDER: "SERVICE_PROVIDER"
});

export const ORGANIZATION_SEAT_ROLES = Object.freeze(Object.values(OrganizationSeatRole));

export const OrganizationCapability = Object.freeze({
  ORG_OWNER: "ORG_OWNER",
  MEMBER_ADMIN: "MEMBER_ADMIN",
  UNIT_LEAD: "UNIT_LEAD",
  INBOX_COORDINATOR: "INBOX_COORDINATOR",
  WORK_ASSIGNER: "WORK_ASSIGNER",
  SERVICE_PROFILE_EDITOR: "SERVICE_PROFILE_EDITOR",
  SUPPORT_CONTACT_ADMIN: "SUPPORT_CONTACT_ADMIN",
  BILLING_MANAGER: "BILLING_MANAGER",
  AUDIT_VIEWER: "AUDIT_VIEWER"
});

export const ORGANIZATION_CAPABILITIES = Object.freeze(Object.values(OrganizationCapability));

/**
 * Arenduskavas nimetatud, kuid CORE-V1-s VÄLJAS. Hoitakse siin nimeliselt, et
 * keegi ei arvaks neid unustatuks — aga mitte Postgres-enumis, sest enum-väärtust
 * ei saa hiljem lihtsalt eemaldada, lisada aga saab (`ALTER TYPE ... ADD VALUE`).
 */
export const RESERVED_ORGANIZATION_CAPABILITIES = Object.freeze([
  "AGGREGATE_VIEWER",
  "REPORT_APPROVER",
  "SCHEDULER",
  "ON_CALL_COORDINATOR"
]);

export const OrganizationCapabilityScopeType = Object.freeze({
  ORGANIZATION: "ORGANIZATION",
  UNIT: "UNIT"
});

/**
 * Capability, mis on mõtestatud AINULT organisatsiooni skoobis. Üksuse-skoobiga
 * `ORG_OWNER` või `BILLING_MANAGER` oleks õiguste vaikne laiendamine.
 */
export const ORGANIZATION_ONLY_CAPABILITIES = Object.freeze([
  OrganizationCapability.ORG_OWNER,
  OrganizationCapability.BILLING_MANAGER,
  OrganizationCapability.SUPPORT_CONTACT_ADMIN,
  OrganizationCapability.SERVICE_PROFILE_EDITOR,
  OrganizationCapability.AUDIT_VIEWER
]);

/**
 * Capability, mis nõuab aktiivset moodulit. Moodulita capability ei ava route'i
 * (arenduskava §6). Tühi loend = moodulist sõltumatu haldusõigus.
 */
export const CAPABILITY_REQUIRED_MODULES = Object.freeze({
  [OrganizationCapability.INBOX_COORDINATOR]: Object.freeze([OrganizationModuleKey.KOV_INTAKE]),
  [OrganizationCapability.WORK_ASSIGNER]: Object.freeze([OrganizationModuleKey.KOV_INTAKE]),
  [OrganizationCapability.SERVICE_PROFILE_EDITOR]: Object.freeze([OrganizationModuleKey.SERVICE_DELIVERY]),
  [OrganizationCapability.SUPPORT_CONTACT_ADMIN]: Object.freeze([OrganizationModuleKey.PROFESSIONAL_SUPPORT])
});

/**
 * UI rollimallid. Arenduskava §5.4: „Rollinimetused UI-s on capability-mallid,
 * mitte uus kõva rollitabel." Mall on kiirvalik, mille tulemuse saab pärast
 * ükshaaval muuta — mitte uus õigusklass.
 *
 * `scope: "UNIT"` tähendab, et mall vajab konkreetset üksust; ilma selleta on
 * malli rakendamine viga, mitte vaikne org-skoobi andmine.
 */
export const CAPABILITY_TEMPLATES = Object.freeze({
  ORG_OWNER: Object.freeze({
    key: "ORG_OWNER",
    labelKey: "org.capabilityTemplate.orgOwner",
    scope: "ORGANIZATION",
    capabilities: Object.freeze([
      OrganizationCapability.ORG_OWNER,
      OrganizationCapability.MEMBER_ADMIN,
      OrganizationCapability.AUDIT_VIEWER
    ])
  }),
  MEMBER_ADMIN: Object.freeze({
    key: "MEMBER_ADMIN",
    labelKey: "org.capabilityTemplate.memberAdmin",
    scope: "ORGANIZATION",
    capabilities: Object.freeze([OrganizationCapability.MEMBER_ADMIN])
  }),
  /* „Osakonnajuht" annab valitud üksuse juhtimise ja töö määramise. Ta EI anna
     heaolukoondit ega ühtegi privaatse sisu õigust (arenduskava §5.4). */
  UNIT_LEAD: Object.freeze({
    key: "UNIT_LEAD",
    labelKey: "org.capabilityTemplate.unitLead",
    scope: "UNIT",
    capabilities: Object.freeze([
      OrganizationCapability.UNIT_LEAD,
      OrganizationCapability.WORK_ASSIGNER
    ])
  }),
  INBOX_COORDINATOR: Object.freeze({
    key: "INBOX_COORDINATOR",
    labelKey: "org.capabilityTemplate.inboxCoordinator",
    scope: "UNIT",
    capabilities: Object.freeze([OrganizationCapability.INBOX_COORDINATOR])
  }),
  /* Tavaline liige: liikmesus ilma ühegi capability'ta. See ei ole „tühi mall",
     vaid vaikeseis — liikmesus üksi ei ava haldust (arenduskava §6). */
  MEMBER: Object.freeze({
    key: "MEMBER",
    labelKey: "org.capabilityTemplate.member",
    scope: "ORGANIZATION",
    capabilities: Object.freeze([])
  })
});

export const CAPABILITY_TEMPLATE_KEYS = Object.freeze(Object.keys(CAPABILITY_TEMPLATES));

export const OrganizationInviteStatus = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED"
});

/** Kutse kehtivus päevades. */
export const INVITE_TTL_DAYS = 14;

export function isOrganizationCapability(value) {
  return ORGANIZATION_CAPABILITIES.includes(value);
}

export function isOrganizationSeatRole(value) {
  return ORGANIZATION_SEAT_ROLES.includes(value);
}

export function isOrganizationModuleKey(value) {
  return ORGANIZATION_MODULE_KEYS.includes(value);
}

export function isOrganizationLegalKind(value) {
  return ORGANIZATION_LEGAL_KINDS.includes(value);
}

export function isOrganizationUnitType(value) {
  return ORGANIZATION_UNIT_TYPES.includes(value);
}

export function canTransitionOrganizationStatus(from, to) {
  return (ORGANIZATION_STATUS_TRANSITIONS[from] || []).includes(to);
}

/** Moodulid, milleta see capability ei kehti. Tundmatu capability → tühi loend. */
export function requiredModulesForCapability(capability) {
  return CAPABILITY_REQUIRED_MODULES[capability] || [];
}
