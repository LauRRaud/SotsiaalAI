/**
 * KODUTEENUS K1 — sõnastikud ja piirid.
 *
 * Liigid ja seisud on andmebaasis String (vt `prisma/schema.prisma` plokk
 * „KODUTEENUS K1"); lubatud väärtused on SIIN. Uus väärtus lisatakse siia ja
 * tõlgetesse (`home_care.*` kolmes keeles), migratsiooni see ei vaja.
 */

import { OrganizationCapability, OrganizationModuleKey } from "../org/constants.js";

export const HOME_CARE_MODULE = OrganizationModuleKey.HOME_CARE;
export const HOME_CARE_COORDINATOR = OrganizationCapability.HOME_CARE_COORDINATOR;

export const CareClientStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  /** Ajutiselt ära (haiglas, lähedase juures). Käike ei tehta, klient jääb alles. */
  AWAY: "AWAY",
  ENDED: "ENDED"
});
export const CARE_CLIENT_STATUSES = Object.freeze(Object.values(CareClientStatus));

/**
 * Miks klient on ajutiselt ära (K1-j). SKA koduteenuse juhendi (18.06.2024) ptk 5
 * järgi võib teenuse peatada samadel alustel, millel see lõpetatakse; päris töös
 * on peatamine enamasti haigla või äraolek.
 */
export const CareAwayReason = Object.freeze({
  /** Haiglas või taastusravil. */
  HOSPITAL: "HOSPITAL",
  /** Lähedase juures või muul põhjusel kodust ära. */
  WITH_FAMILY: "WITH_FAMILY",
  /** Käigud on peatatud, kuni ohutuse või koostöö küsimus on lahendatud. */
  SAFETY: "SAFETY",
  OTHER: "OTHER"
});
export const CARE_AWAY_REASONS = Object.freeze(Object.values(CareAwayReason));

/**
 * Miks teenus lõppes (K1-j). Juhendi neli alust (abivajadus muutus, surm, elukoha
 * muutus, lepingu rikkumine) ja kaks, mida juhend ei nimeta, aga mida päris töös
 * eristatakse: inimene loobus ise, ja abivajadus kasvas üle selle, mida kodus anda
 * saab. Viimane on tähtis mõõta: teenuse eesmärk on hooldekodu edasi lükata.
 */
export const CareEndReason = Object.freeze({
  /** Ei vaja enam teenust: toimetulek paranes või abi tuleb mujalt. */
  NO_LONGER_NEEDED: "NO_LONGER_NEEDED",
  /** Vajab rohkem abi, kui kodus anda saab (hooldekodu või muu teenus). */
  MORE_CARE: "MORE_CARE",
  DIED: "DIED",
  /** Kolis teise omavalitsusse. */
  MOVED: "MOVED",
  OWN_WISH: "OWN_WISH",
  /** Koostöö ei olnud võimalik või teenust ei saanud ohutult osutada. */
  COOPERATION: "COOPERATION",
  OTHER: "OTHER"
});
export const CARE_END_REASONS = Object.freeze(Object.values(CareEndReason));

/**
 * Lubatud alused seisu kaupa. Aktiivsel kliendil alust ei ole.
 *
 * ERAND selle faili üldreeglist: need alused on andmebaasis CHECK-iga kinni
 * (migratsioon `20261010010000_home_care_status_reason`). Uus alus vajab ka uut
 * migratsiooni; `tests/home-care-status-reason.test.mjs` võrdleb loendeid.
 */
export const CARE_STATUS_REASONS = Object.freeze({
  [CareClientStatus.ACTIVE]: Object.freeze([]),
  [CareClientStatus.AWAY]: CARE_AWAY_REASONS,
  [CareClientStatus.ENDED]: CARE_END_REASONS
});

/** Püsikaardi „enne kui lähed" rea liik. */
export const CareCardLineKind = Object.freeze({
  ACCESS: "ACCESS",
  AGREEMENT: "AGREEMENT",
  RISK: "RISK",
  ALARM: "ALARM",
  OTHER: "OTHER"
});
export const CARE_CARD_LINE_KINDS = Object.freeze(Object.values(CareCardLineKind));

export const CareEntryKind = Object.freeze({
  NOTE: "NOTE",
  AGREEMENT: "AGREEMENT",
  /** Teade järgmisele hooldajale; lugemine jätab jälje. */
  HANDOVER: "HANDOVER",
  INCIDENT: "INCIDENT",
  /** Mure, mida näevad ainult autor ja hooldusjuht. */
  CONCERN: "CONCERN"
});
export const CARE_ENTRY_KINDS = Object.freeze(Object.values(CareEntryKind));

export const CareContactMode = Object.freeze({
  VISIT: "VISIT",
  PHONE: "PHONE",
  OTHER: "OTHER"
});
export const CARE_CONTACT_MODES = Object.freeze(Object.values(CareContactMode));

/**
 * Kõnemärge (kava II.6.8): kes helistas ja mille pärast. Ainult telefonikontakti
 * kirjel. Valikuid on vähe meelega: märge tehakse ühe-kahe puudutusega ja
 * loendur peab vastama küsimusele „millest tegelikult helistatakse".
 */
export const CareCallCaller = Object.freeze({
  RELATIVE: "RELATIVE",
  CLIENT: "CLIENT",
  OTHER: "OTHER"
});
export const CARE_CALL_CALLERS = Object.freeze(Object.values(CareCallCaller));

export const CareCallTopic = Object.freeze({
  /** Küsis, kuidas läheb või kas käik toimus. */
  STATUS: "STATUS",
  /** Soovib muudatust: aeg, päev, lisakäik, ära jätmine. */
  CHANGE: "CHANGE",
  /** Helistaja mure kliendi pärast. */
  CONCERN: "CONCERN",
  OTHER: "OTHER"
});
export const CARE_CALL_TOPICS = Object.freeze(Object.values(CareCallTopic));

/**
 * TÄIELIK VÄLJAVÕTE (K1-i): milleks see koostati. Kood läheb asutuse tööloendisse;
 * vabateksti siin ei ole, sest audit ei kanna sisu.
 */
export const CareExportReason = Object.freeze({
  /** Asutuse oma varukoopia. */
  BACKUP: "BACKUP",
  /** Lahkumine platvormilt või andmete viimine teise süsteemi. */
  LEAVING: "LEAVING",
  /** Järelevalve või ametiasutuse nõue. */
  AUTHORITY: "AUTHORITY",
  OTHER: "OTHER"
});
export const CARE_EXPORT_REASONS = Object.freeze(Object.values(CareExportReason));

/**
 * Erijuhtumi liigid (kava II.6.1). Järjekord on vormi järjekord: sagedasemad
 * ja kiiremat tegutsemist nõudvad eespool.
 */
export const CareIncidentType = Object.freeze({
  FALL: "FALL",
  DOOR_NOT_OPENED: "DOOR_NOT_OPENED",
  MISSING: "MISSING",
  HEALTH_DECLINE: "HEALTH_DECLINE",
  REFUSED_HELP: "REFUSED_HELP",
  AGGRESSION: "AGGRESSION",
  ABUSE_SUSPICION: "ABUSE_SUSPICION",
  MONEY_DISCREPANCY: "MONEY_DISCREPANCY",
  /** Kliendilt või lähedaselt pakuti kingitust või raha (juhendi ptk 3: märge kaitseb hooldajat). */
  GIFT_OFFERED: "GIFT_OFFERED",
  UNSAFE_HOME: "UNSAFE_HOME",
  ACCESS_PROBLEM: "ACCESS_PROBLEM",
  WORK_ACCIDENT: "WORK_ACCIDENT",
  COMPLAINT: "COMPLAINT",
  THANKS: "THANKS",
  /** Suuline tagasiside, mis ei ole kaebus ega tänu (juhendi ptk 5). */
  FEEDBACK: "FEEDBACK",
  OTHER: "OTHER"
});
export const CARE_INCIDENT_TYPES = Object.freeze(Object.values(CareIncidentType));

/**
 * Liigid, mida näevad vaikimisi ainult autor ja hooldusjuht: kahtlus võib
 * puudutada lähedast või kolleegi, kes muidu kirjet loeks.
 */
export const COORDINATOR_ONLY_INCIDENT_TYPES = Object.freeze([
  CareIncidentType.ABUSE_SUSPICION,
  CareIncidentType.MONEY_DISCREPANCY
]);

export const CareIncidentStatus = Object.freeze({
  OPEN: "OPEN",
  IN_REVIEW: "IN_REVIEW",
  CLOSED: "CLOSED"
});
export const CARE_INCIDENT_STATUSES = Object.freeze(Object.values(CareIncidentStatus));

/** „Mida tegin": linnukesed kellaajaga. */
export const CareIncidentAction = Object.freeze({
  CALLED_112: "CALLED_112",
  INFORMED_COORDINATOR: "INFORMED_COORDINATOR",
  INFORMED_RELATIVE: "INFORMED_RELATIVE",
  WAITED_FOR_HELP: "WAITED_FOR_HELP",
  LEFT_FOR_SAFETY: "LEFT_FOR_SAFETY"
});
export const CARE_INCIDENT_ACTIONS = Object.freeze(Object.values(CareIncidentAction));

/** Erijuhtumi käigu rea liik (`CareIncidentUpdate.kind`). */
export const CareIncidentUpdateKind = Object.freeze({
  /** Täiendus: autori või hooldusjuhi lisatud tekst. */
  NOTE: "NOTE",
  STATUS: "STATUS",
  ASSIGNED: "ASSIGNED"
});

/** Registri seisufilter: lahtised on OPEN ja IN_REVIEW koos. */
export const CareIncidentFilter = Object.freeze({
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
  ALL: "ALL"
});
export const CARE_INCIDENT_FILTERS = Object.freeze(Object.values(CareIncidentFilter));

export const CareRevisionKind = Object.freeze({
  CORRECTION: "CORRECTION",
  RETRACTION: "RETRACTION"
});

/** Mille alusel kliendi leht avati. */
export const CareAccessBasis = Object.freeze({
  TEAM: "TEAM",
  COORDINATOR: "COORDINATOR",
  REASON: "REASON"
});

/** Põhjus, miks meeskonda mittekuuluv hooldaja kliendi lehe avab. */
export const CareAccessReason = Object.freeze({
  COVERING: "COVERING",
  PAIRED_VISIT: "PAIRED_VISIT",
  URGENT: "URGENT",
  OTHER: "OTHER"
});
export const CARE_ACCESS_REASONS = Object.freeze(Object.values(CareAccessReason));

export const HOME_CARE_LIMITS = Object.freeze({
  DISPLAY_NAME_MAX: 200,
  INTERNAL_CODE_MAX: 100,
  ADDRESS_MAX: 300,
  PHONE_MAX: 60,
  CONTACT_NOTE_MAX: 1000,
  STATUS_NOTE_MAX: 300,
  /** Kliendi lehel näidatakse nii mitut viimast seisu muutust. */
  STATUS_HISTORY_MAX: 30,
  CARD_LINES_MAX: 5,
  CARD_LINE_TEXT_MAX: 240,
  ENTRY_TEXT_MAX: 4000,
  ASSESSMENT_MAX: 2000,
  REASON_MAX: 500,
  ACCESS_REASON_MAX: 300,
  SEARCH_MIN: 2,
  SEARCH_MAX: 80,
  /** Päeviku otsingus arvestatakse kuni nii mitut otsisõna. */
  SEARCH_WORDS_MAX: 6,
  /** Kui kaua oodatakse morfoloogiat; pärast seda salvestub kirje tüvedega. */
  SEARCH_ANALYZE_MS: 2500,
  SEARCH_SOURCE_MAX: 8000,
  SEARCH_RESULTS: 20,
  ENTRIES_PAGE: 30,
  INCIDENTS_PAGE: 30,
  /** Ühes kronoloogias kuni nii palju kirjeid; pikem ajavahemik tuleb jagada. */
  CHRONOLOGY_MAX: 500,
  CHRONOLOGY_LINE_MAX: 300,
  CHRONOLOGY_REF_MAX: 120,
  INCIDENT_UPDATE_MAX: 2000,
  ENTRIES_PAGE_MAX: 100,
  RECENT_OPENERS: 8,
  /** Kui kaua sama töötaja sama alusega avamist uuesti ei logita. */
  ACCESS_LOG_QUIET_MS: 10 * 60 * 1000,
  /** Seadme kirjutamisaega usutakse ainult selle akna sees (võrguta järjekorra pikim iga). */
  DEVICE_CREATED_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  /** Sündmuse aeg ei tohi olla tulevikus rohkem kui kellade erinevuse jagu. */
  OCCURRED_AT_FUTURE_SKEW_MS: 5 * 60 * 1000,
  /** Kirje on „hiljem kirjutatud", kui sündmusest on möödas üle selle aja. */
  WRITTEN_LATER_MS: 2 * 60 * 60 * 1000,
  /** Kui kaua tohib kirje seadme järjekorras võrku oodata, et server selle aja veel arvesse võtaks. */
  QUEUE_WAIT_MAX_MS: 30 * 24 * 60 * 60 * 1000,
  /** Alates sellest ooteajast näidatakse kirjel märki „saadetud hiljem". */
  SENT_LATER_MS: 10 * 60 * 1000
});
