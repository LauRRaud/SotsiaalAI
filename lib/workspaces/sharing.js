/* COLLAB-P0 — jagamislepingu ühissõnastik (analüüs ptk 3.1 objektiklassid 1–10).
 *
 * See fail EI tee päringuid — see on leping + puhtad abifunktsioonid. Üldist
 * „jaga kogu juhtum" kuju ei eksisteeri (K1 4.11): jagamine käib objektiklassi
 * kaupa ja iga klass kannab oma nõusoleku-, kestuse- ja tagasivõtulepingut.
 * Külmutatud koopia on vaikimisi jagamiskuju; elav viide on dokumenteeritud
 * erand. */

export const SharingObjectClass = Object.freeze({
  PERSONAL_NOTE: 1,
  SPECIALIST_PRIVATE_NOTE: 2,
  SHARED_FACT: 3,
  PERSON_OWN_INPUT: 4,
  THIRD_PARTY_INFO: 5,
  MEETING_AGENDA: 6,
  DECISION: 7,
  TASK: 8,
  CONFIRMED_SUMMARY: 9,
  EXPORTED_ARTIFACT: 10
});

export const SHARING_OBJECT_CLASSES = Object.freeze(Object.values(SharingObjectClass));

export const SharingValidityKind = Object.freeze({
  WORKSPACE_LIFETIME: "WORKSPACE_LIFETIME",
  UNTIL_REVOKED: "UNTIL_REVOKED",
  UNTIL_DATE: "UNTIL_DATE",
  PERMANENT: "PERMANENT",
  EXTERNAL: "EXTERNAL"
});

export const SHARING_VALIDITY_KINDS = Object.freeze(Object.values(SharingValidityKind));

export const RevocableBeforeOpen = Object.freeze({
  RECALL: "RECALL",
  NONE: "NONE"
});

export const RevocableAfterOpen = Object.freeze({
  CORRECTION: "CORRECTION",
  SUPERSEDE: "SUPERSEDE",
  NONE: "NONE"
});

/* Ptk 3.1 tabeli lepinguline tuum klassi kaupa. Klassid 1–2 EI ole jagatavad —
 * nende „jagamiskuju" on alati eraldi külmutatud väljavõte (klass 4/9), mitte
 * originaal. See tabel on andmed, mitte kood: adapterid ja tulevased UI-d
 * loevad siit, test lukustab täielikkuse. */
export const SHARING_CLASS_CONTRACTS = Object.freeze({
  [SharingObjectClass.PERSONAL_NOTE]: Object.freeze({
    shareable: false,
    frozenCopyIsDefault: true
  }),
  [SharingObjectClass.SPECIALIST_PRIVATE_NOTE]: Object.freeze({
    shareable: false,
    frozenCopyIsDefault: true
  }),
  [SharingObjectClass.SHARED_FACT]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: false,
    validity: SharingValidityKind.WORKSPACE_LIFETIME,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.NONE, afterOpen: RevocableAfterOpen.NONE })
  }),
  [SharingObjectClass.PERSON_OWN_INPUT]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: true,
    validity: SharingValidityKind.UNTIL_REVOKED,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.RECALL, afterOpen: RevocableAfterOpen.CORRECTION })
  }),
  [SharingObjectClass.THIRD_PARTY_INFO]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: true,
    validity: SharingValidityKind.UNTIL_DATE,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.RECALL, afterOpen: RevocableAfterOpen.NONE }),
    /* O-CO-6: mittekasutaja andmete õiguslik alus on lahtine tooteotsus.
     * Leping märgib selle ausalt — adapter ei tohi seda klassi V1-s emiteerida. */
    blockedByDecision: "O-CO-6"
  }),
  [SharingObjectClass.MEETING_AGENDA]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: false,
    validity: SharingValidityKind.WORKSPACE_LIFETIME,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.NONE, afterOpen: RevocableAfterOpen.SUPERSEDE })
  }),
  [SharingObjectClass.DECISION]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: true,
    validity: SharingValidityKind.PERMANENT,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.NONE, afterOpen: RevocableAfterOpen.SUPERSEDE })
  }),
  [SharingObjectClass.TASK]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: false,
    validity: SharingValidityKind.UNTIL_REVOKED,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.NONE, afterOpen: RevocableAfterOpen.NONE })
  }),
  [SharingObjectClass.CONFIRMED_SUMMARY]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: true,
    validity: SharingValidityKind.PERMANENT,
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.RECALL, afterOpen: RevocableAfterOpen.SUPERSEDE })
  }),
  [SharingObjectClass.EXPORTED_ARTIFACT]: Object.freeze({
    shareable: true,
    frozenCopyIsDefault: true,
    validity: SharingValidityKind.EXTERNAL,
    /* Platvormi kontroll lõpeb ekspordiga — tagasivõtt on VÕIMATU ja UI peab
     * seda ausalt ütlema (U12 EXTERNAL_EMAIL pretsedent). */
    revocable: Object.freeze({ beforeOpen: RevocableBeforeOpen.NONE, afterOpen: RevocableAfterOpen.NONE })
  })
});

const DESCRIPTOR_KEYS = Object.freeze(["objectClass", "frozen", "purpose", "validity", "revocable"]);
const VALIDITY_KEYS = Object.freeze(["kind", "until"]);
const REVOCABLE_KEYS = Object.freeze(["beforeOpen", "afterOpen"]);

/**
 * @typedef {Object} SharingDescriptor
 * @property {1|2|3|4|5|6|7|8|9|10} objectClass
 * @property {boolean} frozen Kas jagatud kuju on külmutatud snapshot.
 * @property {string | null} purpose Adressaadile nähtav eesmärk (kasutaja tekst
 *   või i18n-võti); null, kui moodul eesmärki ei kanna.
 * @property {{ kind: string, until: string | null }} validity
 * @property {{ beforeOpen: string, afterOpen: string }} revocable
 */

export class SharingDescriptorValidationError extends Error {
  constructor(path, reason) {
    super(`Invalid sharing descriptor at ${path}: ${reason}`);
    this.name = "SharingDescriptorValidationError";
    this.code = "INVALID_SHARING_DESCRIPTOR";
  }
}

function fail(path, reason) {
  throw new SharingDescriptorValidationError(path, reason);
}

function isRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, path) {
  if (!isRecord(value)) fail(path, "must be an object");
  const received = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (received.length !== allowed.length || received.some((key, index) => key !== allowed[index])) {
    fail(path, "contains missing or unsupported fields");
  }
}

function assertNullableIsoTimestamp(value, path) {
  if (value === null) return;
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a string or null");
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    fail(path, "must be a canonical ISO 8601 timestamp or null");
  }
}

/**
 * @param {SharingDescriptor} descriptor
 * @returns {SharingDescriptor}
 */
export function assertSharingDescriptor(descriptor) {
  assertExactKeys(descriptor, DESCRIPTOR_KEYS, "descriptor");
  if (!SHARING_OBJECT_CLASSES.includes(descriptor.objectClass)) {
    fail("objectClass", "is not a canonical sharing object class");
  }
  const contract = SHARING_CLASS_CONTRACTS[descriptor.objectClass];
  if (!contract.shareable) {
    fail("objectClass", "is never shared directly (classes 1-2 share only as a frozen excerpt)");
  }
  if (typeof descriptor.frozen !== "boolean") fail("frozen", "must be a boolean");
  if (descriptor.purpose !== null && (typeof descriptor.purpose !== "string" || !descriptor.purpose.trim())) {
    fail("purpose", "must be a non-empty string or null");
  }
  assertExactKeys(descriptor.validity, VALIDITY_KEYS, "validity");
  if (!SHARING_VALIDITY_KINDS.includes(descriptor.validity.kind)) {
    fail("validity.kind", "is not a canonical validity kind");
  }
  assertNullableIsoTimestamp(descriptor.validity.until, "validity.until");
  if (descriptor.validity.kind === SharingValidityKind.UNTIL_DATE && descriptor.validity.until === null) {
    fail("validity.until", "is required when validity.kind is UNTIL_DATE");
  }
  assertExactKeys(descriptor.revocable, REVOCABLE_KEYS, "revocable");
  if (!Object.values(RevocableBeforeOpen).includes(descriptor.revocable.beforeOpen)) {
    fail("revocable.beforeOpen", "is not a canonical value");
  }
  if (!Object.values(RevocableAfterOpen).includes(descriptor.revocable.afterOpen)) {
    fail("revocable.afterOpen", "is not a canonical value");
  }
  return descriptor;
}

export const validateSharingDescriptor = assertSharingDescriptor;

/**
 * Kaardistab U12 „Minu jagamised" saadetud eelpöördumise rea (lib/mySharings.js
 * serialiseeritud kuju) jagamis-descriptor'iks ILMA mySharings.js-i muutmata.
 * Eelpöördumine on klass 4 — inimese enda sisend külmutatud väljavõttena:
 * enne avamist recall (U3), pärast avamist parandus (supersededBy-ahel).
 *
 * @param {{ topic?: string }} row lib/mySharings.js serializeSentPreInquiry väljund
 * @returns {SharingDescriptor}
 */
export function mapSentPreInquiryToSharingDescriptor(row = {}) {
  const topic = typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : null;
  return assertSharingDescriptor({
    objectClass: SharingObjectClass.PERSON_OWN_INPUT,
    frozen: true,
    purpose: topic,
    validity: { kind: SharingValidityKind.UNTIL_REVOKED, until: null },
    revocable: {
      beforeOpen: RevocableBeforeOpen.RECALL,
      afterOpen: RevocableAfterOpen.CORRECTION
    }
  });
}
