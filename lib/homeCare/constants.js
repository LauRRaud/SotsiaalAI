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

/**
 * TOIMINGUTE KATALOOG (kiht 2, K2-a). Ülemine tase: sotsiaalkaitseministri 29.06.2023
 * määruse nr 40 „Nõuded koduteenusele" § 2 toimingurühmad, koduabi lg 2 p 1–6 ja
 * isikuabi lg 3 p 1–10, määruse järjekorras. Asutus neid ei muuda; tema enda toimingud
 * (alumine tase, tabel `CareActivity`) kuuluvad igaüks ühte rühma.
 *
 * Rühmad on andmebaasis CHECK-iga kinni (migratsioon
 * `20261010030000_home_care_activity_catalogue`): määruse muutus vajab uut migratsiooni.
 */
export const CareActivityDomain = Object.freeze({
  HOME_HELP: "HOME_HELP",
  PERSONAL_HELP: "PERSONAL_HELP"
});
export const CARE_ACTIVITY_DOMAINS = Object.freeze(Object.values(CareActivityDomain));

export const CareActivityGroup = Object.freeze({
  SHOPPING: "SHOPPING",
  SERVICES_AND_ERRANDS: "SERVICES_AND_ERRANDS",
  HEATING: "HEATING",
  HOME_SAFETY: "HOME_SAFETY",
  HOUSEKEEPING: "HOUSEKEEPING",
  OTHER_HOME_HELP: "OTHER_HOME_HELP",
  HYGIENE: "HYGIENE",
  NUTRITION: "NUTRITION",
  DRESSING: "DRESSING",
  LAUNDRY: "LAUNDRY",
  MEDICATION: "MEDICATION",
  ABILITY_MONITORING: "ABILITY_MONITORING",
  NETWORK: "NETWORK",
  MENTAL_SUPPORT: "MENTAL_SUPPORT",
  ASSISTIVE_TECH: "ASSISTIVE_TECH",
  OTHER_PERSONAL_HELP: "OTHER_PERSONAL_HELP"
});
export const CARE_ACTIVITY_GROUPS = Object.freeze(Object.values(CareActivityGroup));

const HOME_HELP_GROUPS = Object.freeze([
  CareActivityGroup.SHOPPING,
  CareActivityGroup.SERVICES_AND_ERRANDS,
  CareActivityGroup.HEATING,
  CareActivityGroup.HOME_SAFETY,
  CareActivityGroup.HOUSEKEEPING,
  CareActivityGroup.OTHER_HOME_HELP
]);

/** Kummasse poolde rühm kuulub: koduabi või isikuabi. */
export const CARE_ACTIVITY_GROUP_DOMAIN = Object.freeze(
  Object.fromEntries(
    CARE_ACTIVITY_GROUPS.map((group) => [
      group,
      HOME_HELP_GROUPS.includes(group) ? CareActivityDomain.HOME_HELP : CareActivityDomain.PERSONAL_HELP
    ])
  )
);

/**
 * Rühmade nimed määruse sõnastuses (nimetavas käändes). Kasutatakse algse loendi
 * loomisel: kataloogi kirjutatakse määruse tekst eesti keeles, sest see on õigusakti
 * sõnastus ja asutuse ühine sõnavara ei sõltu sellest, mis keeles hooldusjuhi ekraan on.
 * Ekraani pealkirjad tulevad tõlgetest (`home_care.activities.groups.*`).
 */
export const CARE_ACTIVITY_GROUP_NAMES_ET = Object.freeze({
  SHOPPING: "Sisseostude tegemine ja koju toomine",
  SERVICES_AND_ERRANDS: "Teenuste kasutamine ja asjaajamine",
  HEATING: "Küttematerjali tellimine, ladustamine ja kütmine",
  HOME_SAFETY: "Eluruumi turvalisuse jälgimine ja ohutu elukeskkonna tagamine",
  HOUSEKEEPING: "Eluruumi korrastamine, hooviala hooldamine ja heakorraeeskirjade täitmine",
  OTHER_HOME_HELP: "Muud koduabi toimingud",
  HYGIENE: "Isiklik hügieen, tualeti ja inkontinentsivahendite kasutamine",
  NUTRITION: "Toitumine",
  DRESSING: "Riietumine ja enese korrastamine",
  LAUNDRY: "Voodipesu vahetamine ja pesupesemine",
  MEDICATION: "Ravimite manustamine ja terviseseisundi jälgimine tervishoiutöötaja juhiste järgi",
  ABILITY_MONITORING: "Tegevusvõime jälgimine teenuse osutamise ajal",
  NETWORK: "Lähivõrgustikuga kontakti hoidmine ja kogukonnaelus osalemise soodustamine",
  MENTAL_SUPPORT: "Vaimse tervise ja hingelise toe saamine",
  ASSISTIVE_TECH: "Abitehnoloogiate kasutamine",
  OTHER_PERSONAL_HELP: "Muud isikuabi toimingud"
});

/**
 * HOOLDUSKAVA (kiht 2, K2-b). Seisud, sagedused ja tegemise viisid on andmebaasis
 * CHECK-iga kinni (migratsioon `20261010050000_home_care_care_plan`).
 */
export const CarePlanStatus = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  REPLACED: "REPLACED"
});
export const CARE_PLAN_STATUSES = Object.freeze(Object.values(CarePlanStatus));

/** Kui sageli toimingut tehakse. Arv käib päeva, nädala või kuu kohta; „vajadusel" on ilma arvuta. */
export const CarePlanFrequency = Object.freeze({
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  AS_NEEDED: "AS_NEEDED"
});
export const CARE_PLAN_FREQUENCIES = Object.freeze(Object.values(CarePlanFrequency));

/**
 * Kuidas toimingut tehakse. Määruse nr 40 § 2 lg 1: osutaja „abistab või juhendab",
 * toetades inimese aktiivsust. Järjekord on iseseisvamast vähem iseseisvani.
 */
export const CarePlanMode = Object.freeze({
  /** Inimene teeb ise, hooldaja juhendab või tuletab meelde. */
  GUIDE: "GUIDE",
  TOGETHER: "TOGETHER",
  /** Hooldaja aitab osaliselt. */
  ASSIST: "ASSIST",
  /** Hooldaja teeb inimese eest. */
  FOR: "FOR"
});
export const CARE_PLAN_MODES = Object.freeze(Object.values(CarePlanMode));

/**
 * Kava toimingu tulemus käigul (K2-f, kava II.6.6 „lõpetamine erandite kaudu").
 * Tegemata jäänud toimingul on põhjus; „tehtud" on vaikimisi.
 */
export const CareActivityOutcome = Object.freeze({
  DONE: "DONE",
  /** Inimene ei soovinud. */
  REFUSED: "REFUSED",
  /** Täna ei olnud vaja. */
  NOT_NEEDED: "NOT_NEEDED",
  /** Hooldaja ei saanud teha (aeg, vahend, olukord). */
  COULD_NOT: "COULD_NOT"
});
export const CARE_ACTIVITY_OUTCOMES = Object.freeze(Object.values(CareActivityOutcome));
/** Tegemata jäämise põhjused (tulemused peale „tehtud"). */
export const CARE_ACTIVITY_SKIP_REASONS = Object.freeze(CARE_ACTIVITY_OUTCOMES.filter((value) => value !== CareActivityOutcome.DONE));

/**
 * Käigu tähtsus käigumustri real (K3-c, kava II.6.10): mis peab toimuma ka siis, kui
 * töötajaid on vähem.
 */
export const CareVisitPriority = Object.freeze({
  /** Peab toimuma täna (toit, küte talvel, päeva ainus kontakt). */
  A: "A",
  /** Võib samal päeval nihkuda. */
  B: "B",
  /** Võib nädala sees nihkuda. */
  C: "C"
});
export const CARE_VISIT_PRIORITIES = Object.freeze(Object.values(CareVisitPriority));

/** Puudumise liik: ainult plaaniline või ootamatu. Haigust ega muud põhjust ei hoita. */
export const CareAbsenceKind = Object.freeze({
  PLANNED: "PLANNED",
  SUDDEN: "SUDDEN"
});
export const CARE_ABSENCE_KINDS = Object.freeze(Object.values(CareAbsenceKind));

/** Varu, mida kliendi kodus jälgitakse (K4-e, kava II.6.11). Ravimivaru siin ei ole: see ootab omaniku otsust. */
export const CareSupplyKind = Object.freeze({
  FIREWOOD: "FIREWOOD",
  WATER: "WATER",
  FOOD: "FOOD",
  HYGIENE: "HYGIENE"
});
export const CARE_SUPPLY_KINDS = Object.freeze(Object.values(CareSupplyKind));

/** Varu seis: piisav, hakkab lõppema, otsas. */
export const CareSupplyState = Object.freeze({
  ENOUGH: "ENOUGH",
  LOW: "LOW",
  OUT: "OUT"
});
export const CARE_SUPPLY_STATES = Object.freeze(Object.values(CareSupplyState));

/**
 * „Kas täna oli midagi teisiti?" (K5-a, kava II.6.2). Kuus valdkonda, milles kirjeldatakse
 * kliendi tavalist seisu ja märgitakse muutust. Loend on meie oma (tuntud tööriistu ei tohi
 * kopeerida) ja vajab enne päriskasutust meditsiiniõe ülevaatust.
 */
export const CareChangeArea = Object.freeze({
  MOBILITY: "MOBILITY",
  EATING: "EATING",
  MOOD: "MOOD",
  MEMORY: "MEMORY",
  SKIN_PAIN: "SKIN_PAIN",
  HOME: "HOME"
});
export const CARE_CHANGE_AREAS = Object.freeze(Object.values(CareChangeArea));

export const CareChangeAnswer = Object.freeze({ NO: "NO", YES: "YES" });
export const CARE_CHANGE_ANSWERS = Object.freeze(Object.values(CareChangeAnswer));

/**
 * Ravimitoiming käigu kirjel (K5-d, kava II.3.2): MIDA hooldaja tegi. Need on eri toimingud
 * eri vastutusega; mis on asutuses lubatud, otsustab asutus. Annuseid ega raviskeemi ei hoita.
 */
export const CareMedicationAction = Object.freeze({
  /** Tuletasin meelde. */
  REMINDED: "REMINDED",
  /** Nägin, et võttis. */
  SAW_TAKEN: "SAW_TAKEN",
  /** Andsin (manustasin juhise järgi). */
  GAVE: "GAVE"
});
export const CARE_MEDICATION_ACTIONS = Object.freeze(Object.values(CareMedicationAction));

/** Miks märkamine tekkis: kaks eri hooldajat märkisid sama valdkonna või üks märkis suure muutuse. */
export const CareChangeReason = Object.freeze({ TWO_WORKERS: "TWO_WORKERS", MAJOR: "MAJOR" });

/** Mida hooldusjuht märkamisega tegi. */
export const CareChangeOutcome = Object.freeze({
  TALKED_CLIENT: "TALKED_CLIENT",
  TOLD_RELATIVE: "TOLD_RELATIVE",
  TOLD_DOCTOR: "TOLD_DOCTOR",
  TOLD_SOCIAL_WORKER: "TOLD_SOCIAL_WORKER",
  WATCHING: "WATCHING",
  NO_ACTION: "NO_ACTION"
});
export const CARE_CHANGE_OUTCOMES = Object.freeze(Object.values(CareChangeOutcome));

/** Kliendi sularaha rida hooldaja käes (K4-c): sai kliendilt, kulutas kliendi heaks, tagastas kliendile. */
export const CareMoneyKind = Object.freeze({
  RECEIVED: "RECEIVED",
  SPENT: "SPENT",
  RETURNED: "RETURNED"
});
export const CARE_MONEY_KINDS = Object.freeze(Object.values(CareMoneyKind));

/** Kuidas kliendi võti asutuse käest lahkus (K4-b): tagastatud kliendile või kadunud. */
export const CareKeyOutcome = Object.freeze({
  RETURNED: "RETURNED",
  LOST: "LOST"
});
export const CARE_KEY_OUTCOMES = Object.freeze(Object.values(CareKeyOutcome));

/**
 * Eeltingimus enne teenuse algust (K4-a, kava II.3.7 punkt 3): koduteenuse juhendi
 * loend ja „muu", mis vajab täpsustust.
 */
export const CarePreconditionKind = Object.freeze({
  CLEANING: "CLEANING",
  PEST_CONTROL: "PEST_CONTROL",
  HEATING: "HEATING",
  ELECTRICITY: "ELECTRICITY",
  OTHER: "OTHER"
});
export const CARE_PRECONDITION_KINDS = Object.freeze(Object.values(CarePreconditionKind));

/** Kuidas eeltingimus lõppes: täidetud või ei ole enam vaja. */
export const CarePreconditionOutcome = Object.freeze({
  DONE: "DONE",
  DROPPED: "DROPPED"
});
export const CARE_PRECONDITION_OUTCOMES = Object.freeze(Object.values(CarePreconditionOutcome));

/**
 * Töö iseloom kliendi juures (K3-g, kava II.6.3). Kirjeldab tööd, mitte inimest. Iga
 * märgiga kliendi käik loetakse raske töö käiguks, kui koormust töötajate vahel võrreldakse.
 */
export const CareWorkNatureKind = Object.freeze({
  /** Füüsiliselt raske: tõstmine, pesemine abivahendita. */
  PHYSICAL: "PHYSICAL",
  /** Vaimselt kurnav. */
  MENTAL: "MENTAL",
  /** Raske kodukeskkond: ahiküte, vee kandmine. */
  ENVIRONMENT: "ENVIRONMENT",
  /** Ainult kahekesi: üksi ei tõsteta ega pesta. */
  PAIR_ONLY: "PAIR_ONLY"
});
export const CARE_WORK_NATURE_KINDS = Object.freeze(Object.values(CareWorkNatureKind));

/**
 * Kriisiaste (K5-b, kava II.6.12): Sotsiaalkindlustusameti juhendi kolm rühma selle järgi,
 * kui palju tuge koduteenuse klient kriisis vajab. Järjekord on kiireloomulisuse järgi.
 */
export const CareCrisisLevel = Object.freeze({
  /** Vajab hooldaja tuge iga päev. */
  DAILY: "DAILY",
  /** Vajab tuge kord või kaks nädalas. */
  WEEKLY: "WEEKLY",
  /** Saab varudega seitse päeva ise hakkama. */
  SELF: "SELF"
});
export const CARE_CRISIS_LEVELS = Object.freeze(Object.values(CareCrisisLevel));

/** Millest klient sõltub: mille katkemine teeb tema olukorra kiiresti halvemaks. */
export const CareCrisisDependency = Object.freeze({
  ELECTRICITY: "ELECTRICITY",
  HEATING: "HEATING",
  WATER: "WATER",
  COMMUNICATION: "COMMUNICATION",
  MOBILITY: "MOBILITY",
  MEDICINE: "MEDICINE"
});
export const CARE_CRISIS_DEPENDENCIES = Object.freeze(Object.values(CareCrisisDependency));

/** Töötaja kaardi rea liik (K5-e): taustakontroll (ainult kuupäev) või koolitus (teemaga). */
export const CareWorkerRecordKind = Object.freeze({
  BACKGROUND_CHECK: "BACKGROUND_CHECK",
  TRAINING: "TRAINING"
});
export const CARE_WORKER_RECORD_KINDS = Object.freeze(Object.values(CareWorkerRecordKind));

/** Jagamisaste lähedase kohta (K5-k): 1 = kas käidi; 2 = ka mida koos tehti; 3 = lisaks kontakt muutuse korral. */
export const CARE_SHARING_LEVELS = Object.freeze([1, 2, 3]);

/**
 * Ohutuskaardi teemad (K5-n, kava II.6.4): kümme asja kodu kui töökoha kohta, mida küsitakse
 * iga kliendi juures üle. „Jah" tähendab, et see asjaolu on olemas ja hooldaja peab seda teadma.
 */
export const CareSafetyTopic = Object.freeze({
  ANIMALS: "ANIMALS",
  SMOKING: "SMOKING",
  FIRE: "FIRE",
  WINTER_ACCESS: "WINTER_ACCESS",
  LIFTING: "LIFTING",
  OTHER_PEOPLE: "OTHER_PEOPLE",
  AGGRESSION: "AGGRESSION",
  PROTECTIVE_GEAR: "PROTECTIVE_GEAR",
  PAIR_ONLY: "PAIR_ONLY",
  NO_SIGNAL: "NO_SIGNAL"
});
export const CARE_SAFETY_TOPICS = Object.freeze(Object.values(CareSafetyTopic));
export const CARE_SAFETY_ANSWERS = Object.freeze(["YES", "NO"]);

/** Teade otsustajale (K5-r): mille pärast teatatakse, mis kanalit pidi ja mida otsustaja vastas. */
export const CareNoticeReason = Object.freeze({
  NEED_GROWN: "NEED_GROWN",
  NEED_REDUCED: "NEED_REDUCED",
  SERVICE_UNFIT: "SERVICE_UNFIT",
  OTHER_SERVICE: "OTHER_SERVICE",
  RELATIVE_CHANGED: "RELATIVE_CHANGED",
  /** Otsustaja küsis ülevaadet enne teenuse ülevaatust (K5-s). */
  REVIEW: "REVIEW"
});
export const CARE_NOTICE_REASONS = Object.freeze(Object.values(CareNoticeReason));
export const CARE_NOTICE_CHANNELS = Object.freeze(["EMAIL", "STAR", "PHONE", "MEETING", "OTHER"]);
export const CareNoticeAnswer = Object.freeze({
  REASSESS: "REASSESS",
  VOLUME_STAYS: "VOLUME_STAYS",
  OTHER_SERVICE: "OTHER_SERVICE",
  OTHER: "OTHER"
});
export const CARE_NOTICE_ANSWERS = Object.freeze(Object.values(CareNoticeAnswer));

/** Esmakäik (K5-v): kuidas kliendile teatati, et tuleb töötaja, keda ta ei tunne. */
export const CARE_FIRST_VISIT_OUTCOMES = Object.freeze(["CALLED", "TOLD_BY_REGULAR", "NOT_REACHED"]);

/** Transpordi soov (K5-w): ootel, korraldatud, ei saa, tagasi võetud. */
export const CareTransportState = Object.freeze({
  REQUESTED: "REQUESTED",
  ARRANGED: "ARRANGED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN"
});
/** Hooldusjuhi vastuse valikud. */
export const CARE_TRANSPORT_ANSWERS = Object.freeze([CareTransportState.ARRANGED, CareTransportState.DECLINED]);

/** Sõidupäevik (K6-a): isiklik või asutuse auto. */
export const CARE_TRIP_VEHICLES = Object.freeze(["OWN", "ORG"]);

/**
 * Hooldaja teade „Mul on takistus" (K3-e, kava II.6.10). Viis valikut; põhjust lähemalt
 * ei küsita ega hoita.
 */
export const CareObstacleKind = Object.freeze({
  LATE_30: "LATE_30",
  LATE_60: "LATE_60",
  CAR_BROKEN: "CAR_BROKEN",
  ROAD_BLOCKED: "ROAD_BLOCKED",
  /** Ainult selle juurest saab hooldusjuht samas märkida päeva puudumise. */
  CANNOT_WORK: "CANNOT_WORK"
});
export const CARE_OBSTACLE_KINDS = Object.freeze(Object.values(CareObstacleKind));

/** Ühe päeva erand käigumustris (K3-b). */
export const CareVisitChangeKind = Object.freeze({
  MOVED: "MOVED",
  CANCELLED: "CANCELLED"
});
export const CARE_VISIT_CHANGE_KINDS = Object.freeze(Object.values(CareVisitChangeKind));

/** Miks plaanitud käik ära jäeti. */
export const CareVisitCancelReason = Object.freeze({
  /** Klient ei ole sel päeval kodus (arst, haigla, külas). */
  CLIENT_AWAY: "CLIENT_AWAY",
  /** Klient või lähedane ütles käigu ära. */
  CLIENT_CANCELLED: "CLIENT_CANCELLED",
  /** Töötaja puudub ja asendajat ei leitud. */
  WORKER_ABSENT: "WORKER_ABSENT",
  OTHER: "OTHER"
});
export const CARE_VISIT_CANCEL_REASONS = Object.freeze(Object.values(CareVisitCancelReason));

/** Plaanitud käigu seis päevaplaanis. Tuletis, andmebaasis seda veergu ei ole. */
export const CarePlannedState = Object.freeze({
  PLANNED: "PLANNED",
  DONE: "DONE",
  /** Päev on möödas või plaanitud lõpust on üle tunni ja käigu kirjet ei ole. */
  MISSING: "MISSING",
  CANCELLED: "CANCELLED"
});
export const CARE_PLANNED_STATES = Object.freeze(Object.values(CarePlannedState));

/** Otsuse liik (K2-c). SHS § 18 lg 2: koduteenust osutatakse haldusakti või halduslepingu alusel. */
export const CareDecisionKind = Object.freeze({
  ACT: "ACT",
  CONTRACT: "CONTRACT"
});
export const CARE_DECISION_KINDS = Object.freeze(Object.values(CareDecisionKind));

/**
 * Lepingu allkirja märge (K6-h, kava II.6.9). Platvorm allkirja ei kogu: see on märge selle
 * kohta, mis paberil või digitaalselt tehti. Märkimata leping (NULL) ja „ei ole kindel" on
 * hooldusjuhi nimekirjas. Haldusaktil märget ei ole: sinna kliendi allkirja ei käi.
 */
export const CareSignState = Object.freeze({
  /** Klient kirjutas paberil alla. */
  PAPER: "PAPER",
  /** Digiallkiri. */
  DIGITAL: "DIGITAL",
  /** Alla kirjutas esindaja (volitus või eestkoste). */
  REPRESENTATIVE: "REPRESENTATIVE",
  /** Selle lepingu puhul kliendi allkirja ei nõuta. */
  NOT_REQUIRED: "NOT_REQUIRED",
  /** Ei ole kindel, et inimene sai aru: allkirja ei koguta, pöördutakse sotsiaaltöötaja poole. */
  UNSURE: "UNSURE"
});
export const CARE_SIGN_STATES = Object.freeze(Object.values(CareSignState));

/** Mille alusel esindaja kliendi eest otsustab (K6-i, kava II.6.9). */
export const CareRepresentativeBasis = Object.freeze({
  /** Kliendi antud volikiri. */
  POWER_OF_ATTORNEY: "POWER_OF_ATTORNEY",
  /** Kohtu määratud eestkoste. */
  GUARDIANSHIP: "GUARDIANSHIP",
  OTHER: "OTHER"
});
export const CARE_REPRESENTATIVE_BASES = Object.freeze(Object.values(CareRepresentativeBasis));
/** Seisud, millega käib allkirjastamise päev. */
export const CARE_SIGNED_STATES = Object.freeze([CareSignState.PAPER, CareSignState.DIGITAL, CareSignState.REPRESENTATIVE]);

/** Mille kohta otsustatud maht käib. */
export const CareVolumePeriod = Object.freeze({
  WEEK: "WEEK",
  MONTH: "MONTH"
});
export const CARE_VOLUME_PERIODS = Object.freeze(Object.values(CareVolumePeriod));

/** Otsuse seis tänase päeva suhtes. Tuletis, andmebaasis seda veergu ei ole. */
export const CareDecisionState = Object.freeze({
  UPCOMING: "UPCOMING",
  IN_FORCE: "IN_FORCE",
  ENDED: "ENDED",
  RETRACTED: "RETRACTED"
});
export const CARE_DECISION_STATES = Object.freeze(Object.values(CareDecisionState));

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
  /** Peaaegu juhtus (K5-h, kava II.6.4): midagi oleks võinud juhtuda; registrisse, et oht jõuaks püsikaardile. */
  NEAR_MISS: "NEAR_MISS",
  COMPLAINT: "COMPLAINT",
  THANKS: "THANKS",
  /** Suuline tagasiside, mis ei ole kaebus ega tänu (juhendi ptk 5). */
  FEEDBACK: "FEEDBACK",
  OTHER: "OTHER"
});
export const CARE_INCIDENT_TYPES = Object.freeze(Object.values(CareIncidentType));

/** „Peaaegu juhtus" kiirvalikud (K5-h). Ainult kirje teksti jaoks: andmebaasis on tekst, mitte kood. */
export const CARE_NEAR_MISS_KINDS = Object.freeze(["SLIP", "ANIMAL", "FIRE", "BEHAVIOUR", "LIFTING", "OTHER"]);

/**
 * Kirjed, mis loevad kliendi tagasisideks (K4-d, kava II.3.7 punkt 2): kaebus, tänu ja
 * neutraalne suuline tagasiside. Nende järgi arvestatakse, millal tagasisidet viimati küsiti.
 */
export const CARE_FEEDBACK_INCIDENT_TYPES = Object.freeze([CareIncidentType.COMPLAINT, CareIncidentType.THANKS, CareIncidentType.FEEDBACK]);

/**
 * Rasked erijuhtumid, mille järel autor saab öelda „soovin sellest rääkida" (K6-k, kava II.6.3):
 * oht töötajale, õnnetus, inimese leidmine halvas seisus või kahtlus, mida on raske üksi kanda.
 */
export const CARE_TALK_INCIDENT_TYPES = Object.freeze([
  CareIncidentType.AGGRESSION,
  CareIncidentType.ABUSE_SUSPICION,
  CareIncidentType.WORK_ACCIDENT,
  CareIncidentType.NEAR_MISS,
  CareIncidentType.FALL,
  CareIncidentType.MISSING,
  CareIncidentType.HEALTH_DECLINE
]);

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
  PLAN_GOALS_MAX: 2000,
  PLAN_NOTE_MAX: 1000,
  PLAN_LINE_NOTE_MAX: 300,
  PLAN_FREQUENCY_NOTE_MAX: 120,
  /** Kordi päevas, nädalas või kuus. */
  PLAN_FREQUENCY_MAX: 60,
  PLAN_LINES_MAX: 60,
  PLAN_HISTORY_MAX: 20,
  /** Hooldaja näeb oma käike nii mitu päeva ette. */
  MY_DAYS_AHEAD: 7,
  /** Sammud „kui uks ei avane": sammude arv ja ühe sammu pikkus. */
  DOOR_STEPS_MAX: 8,
  DOOR_STEP_TEXT_MAX: 200,
  /** Tavaline seis: ühe valdkonna kirjelduse pikkus. */
  USUAL_STATE_TEXT_MAX: 300,
  /** Märkamine tekib, kui teine hooldaja märkis sama valdkonna nii mitme päeva sees. */
  CHANGE_WINDOW_DAYS: 14,
  CHANGE_NOTE_MAX: 300,
  /** Mitu viimast vastatud märkamist kliendi lehel näidatakse. */
  CHANGE_HANDLED_SHOWN: 5,
  /** Varud: täiendaja ja märkuse pikkus, tähtaegade lehe loendi ülempiir. */
  SUPPLY_RESPONSIBLE_MAX: 200,
  SUPPLY_NOTE_MAX: 200,
  SUPPLIES_LIST_MAX: 2000,
  /** Kliendi raha: ühe rea ülempiir sentides (10 000 eurot), märkuse pikkus, kui kaugele tagasi saab
      päeva panna, mitu viimast rida kliendi lehel, mitu päeva võib jääk lahti olla enne hooldusjuhi
      nimekirja jõudmist ja loetavate ridade ülempiir. */
  MONEY_AMOUNT_MAX_CENTS: 1000000,
  MONEY_NOTE_MAX: 200,
  MONEY_BACK_DAYS: 31,
  MONEY_RECENT_MAX: 10,
  MONEY_OPEN_DAYS: 7,
  MONEY_ROWS_MAX: 20000,
  /** Võtmeraamat: ripatsi numbri ja kirjelduse pikkus, võtmeid kliendi kohta, loendi pikkus. */
  KEY_TAG_MAX: 20,
  KEY_LABEL_MAX: 100,
  KEYS_PER_CLIENT_MAX: 10,
  KEYS_LIST_MAX: 2000,
  /** Eeltingimus: täpsustuse ja korraldaja pikkus, korraga lahti olevate arv kliendi kohta. */
  PRECONDITION_NOTE_MAX: 300,
  PRECONDITION_RESPONSIBLE_MAX: 200,
  PRECONDITIONS_OPEN_MAX: 10,
  /** Töö iseloomu märge: põhjuse pikkus ja loetavate märgiga klientide ülempiir. */
  WORK_NATURE_REASON_MAX: 500,
  WORK_NATURE_CLIENTS_MAX: 5000,
  /** Kriisivalmidus: kes saab aidata ja märkus. */
  CRISIS_HELPER_MAX: 200,
  CRISIS_NOTE_MAX: 300,
  /** Kriisiarvud (K6-j): täistööaja nädal minutites väikseima koosseisu arvutuseks ja sõidupäeviku vaateaken päevades. */
  CRISIS_FULL_TIME_WEEK_MINUTES: 2400,
  CRISIS_VEHICLE_DAYS: 90,
  /** „Kuhu suunata": asutuse loendi ridade arv ja väljade pikkused. */
  REFERRALS_MAX: 20,
  REFERRAL_NAME_MAX: 120,
  REFERRAL_PHONE_MAX: 40,
  REFERRAL_NOTE_MAX: 300,
  /** Töötaja kaart: koolituse teema pikkus, ridade arv töötaja kohta ja mitu päeva ette aegumisest teatatakse. */
  WORKER_RECORD_TITLE_MAX: 120,
  WORKER_RECORDS_MAX: 40,
  WORKER_RECORD_SOON_DAYS: 60,
  /** Lähedased ja jagamisaste (K5-k): ridade arv kliendi kohta, väljade pikkused ja mitme päeva järel kokkulepe üle küsitakse. */
  RELATIVES_MAX: 10,
  RELATIVE_NAME_MAX: 120,
  RELATIVE_RELATION_MAX: 60,
  RELATIVE_NO_TELL_MAX: 300,
  RELATIVE_REVIEW_DAYS: 183,
  /** Ohutuskaart (K5-n): märkuse pikkus ja mitme päeva järel kaart üle vaadatakse. */
  SAFETY_NOTE_MAX: 200,
  SAFETY_REVIEW_DAYS: 365,
  /** Nädalaplaan: kui mitu nädalat ette ja tagasi saab vaadata (ette umbes kolm kuud, kava II.6.10). */
  WEEK_PLAN_AHEAD_WEEKS: 13,
  WEEK_PLAN_BACK_WEEKS: 8,
  /** Ühe päeva takistuse teateid loetakse päevaplaani kõige rohkem nii palju. */
  OBSTACLES_DAY_MAX: 500,
  /** Puudumine: pikim kestus päevades, kui kaugele tagasi saab alguse märkida, loendi pikkus. */
  ABSENCE_MAX_DAYS: 366,
  ABSENCE_BACK_DAYS: 7,
  ABSENCES_LIST_MAX: 500,
  /** Päevaplaan: kui kaua pärast plaanitud lõppu loetakse tänane käik kirjeta käiguks (minutites). */
  VISIT_MISSING_GRACE_MIN: 60,
  /** Päevaplaanis loetakse korraga kuni nii mitut mustri rida. */
  DAY_PLAN_SLOTS_MAX: 5000,
  VISIT_CHANGE_NOTE_MAX: 200,
  /** Ära jätta ja erandit tagasi võtta saab nii mitu päeva tagasi; ümber tõsta ja ära jätta nii mitu päeva ette. */
  VISIT_CHANGE_BACK_DAYS: 7,
  VISIT_CHANGE_AHEAD_DAYS: 60,
  /** Käigumuster: plaanitud kestus minutites, märkuse pikkus, ridu ühe kliendi kohta. */
  SLOT_MINUTES_MIN: 5,
  SLOT_MINUTES_MAX: 720,
  SLOT_NOTE_MAX: 200,
  SLOTS_MAX: 80,
  /** Määramise juures näidatakse töötaja käike selle kliendi juures nii mitme viimase päeva kohta. */
  SLOT_LOAD_DAYS: 28,
  /** Käigu kestus minutites (kuni üks ööpäev) ja tehtud toiminguid ühel kirjel. */
  VISIT_MINUTES_MAX: 1440,
  VISIT_ACTIVITIES_MAX: 40,
  DECISION_ISSUER_MAX: 160,
  DECISION_NUMBER_MAX: 80,
  DECISION_FEE_NOTE_MAX: 300,
  DECISION_ORIGINAL_MAX: 120,
  /** Esindusõigus (K6-i): ulatuse pikkus, kehtivaid kirjeid kliendi kohta ja mitu päeva ette lõppemisest teada antakse. */
  REPRESENTATIVE_SCOPE_MAX: 300,
  REPRESENTATIVES_MAX: 3,
  REPRESENTATIVE_SOON_DAYS: 30,
  DECISION_NOTE_MAX: 1000,
  /** Maht minutites: nädalas kuni 168 tundi, kuus kuni 744 tundi (31 päeva). */
  DECISION_WEEK_MINUTES_MAX: 168 * 60,
  DECISION_MONTH_MINUTES_MAX: 744 * 60,
  /** Otsuseid ühe kliendi juures. */
  DECISIONS_MAX: 100,
  /** Tähtaegade vaade: „varsti" ja „tulemas" päevades. */
  DEADLINE_SOON_DAYS: 30,
  /** Püsivuse näit (K5-f): mitme päeva käike loetakse ja mis osa käikudest „põhitegijad" katavad. */
  CONTINUITY_DAYS: 28,
  CONTINUITY_SHARE: 0.8,
  /** Abi rohkem kui kavas (K6-d): vaadatakse nii mitme päeva tehtud kava toiminguid. */
  HELP_DRIFT_DAYS: 28,
  /** Märguanne tekib, kui suurema abiga toiminguid on vähemalt nii mitu ja vähemalt see osa kõigist. */
  HELP_DRIFT_MIN: 4,
  HELP_DRIFT_SHARE: 0.3,
  HELP_DRIFT_ROWS_MAX: 20000,
  /** Kliendi kuulehed (K6-e): nii mitu klienti ühes dokumendis; suurem hulk jaguneb osadeks. */
  MONTH_STATEMENT_CLIENTS: 100,
  MONTH_STATEMENT_ROWS_MAX: 20000,
  /** Kojutulek (K6-f): märk aegub nii mitu päeva pärast naasmist, ka siis, kui käiku ei ole kirjas. */
  HOMECOMING_DAYS: 30,
  /** Lühem äraolek (peale haigla) ei ole kojutulek: nädalavahetus lähedase juures ei vaja kontrollkäiku. */
  HOMECOMING_MIN_AWAY_DAYS: 3,
  /** Käigud ilma ühegi erandita (K6-g): nii mitme järjestikuse käigu järel saab hooldusjuht kliendi lehel märke. */
  EXCEPTION_STREAK_VISITS: 30,
  /** Kuu lahtised asjad (K5-j): mitu tegemata käiku nimekirjas näidatakse (arv on alati täpne). */
  MONTH_MISSING_SHOWN: 50,
  /** „Peaaegu juhtus" lisarea pikkus. */
  NEAR_MISS_NOTE_MAX: 200,
  /** Püsikaardi ohurida vaadatakse üle, kui see on nii mitu päeva vana (kava II.6.4: kord aastas). */
  RISK_LINE_REVIEW_DAYS: 365,
  /** Ajutiselt ära: mitme päeva järel tuletatakse hooldusjuhile meelde teenuse peatamise avaldust. */
  AWAY_REMINDER_DAYS: 30,
  /** Tagasiside (K4-d): küsida vähemalt kord aastas; uuelt kliendilt esimest korda pärast kolme kuud;
      lõppenud teenuse puhul vaadatakse viimase kolme kuu lõppemisi ja tagasiside loeb, kui see on
      kirjas alates kuu enne lõppu. */
  FEEDBACK_EVERY_DAYS: 365,
  FEEDBACK_FIRST_DAYS: 90,
  FEEDBACK_END_WINDOW_DAYS: 90,
  FEEDBACK_END_LOOKBACK_DAYS: 30,
  DEADLINE_LATER_DAYS: 60,
  /** Tähtaegade vaates loetakse kuni nii mitut klienti. */
  DEADLINE_CLIENTS_MAX: 2000,
  /** Kuu kokkuvõttes näidatakse kuni nii mitut ära jäänud käiku. */
  MONTH_MISSED_MAX: 500,
  /** Kuu lukk (K5-p): hetktõmmisesse mahub nii mitu klienti; rohkemaga kuud ei lukustata. */
  MONTH_LOCK_CLIENTS_MAX: 10000,
  MONTH_REOPEN_REASON_MAX: 300,
  /** Lukustatud kuu juures näidatakse nii mitut viimast hilisemat kirjet ja parandust. */
  MONTH_AFTER_LOCK_SHOWN: 30,
  /** Kuu lehel näidatakse nii mitut varasemat lukustamist. */
  MONTH_LOCK_HISTORY_MAX: 10,
  /** Tähtaegade vaade jälgib nii mitme viimase kuu lukke. */
  MONTH_LOCK_WATCH_MONTHS: 3,
  /** Nii mitu lukustatud kuud järjest üle otsustatud mahu toob kliendi tähtaegade vaatesse (K5-q). */
  OVER_VOLUME_MONTHS: 3,
  /** Teade otsustajale (K5-r). */
  NOTICE_TEXT_MAX: 600,
  NOTICE_RECIPIENT_MAX: 160,
  NOTICE_ENTRIES_MAX: 5,
  /** Teate koostamisel pakutakse valikuks nii mitut viimast päeviku kirjet. */
  NOTICE_ENTRIES_PICK: 15,
  /** Ühe lisatud kirje tekst teates on kuni nii pikk. */
  NOTICE_ENTRY_TEXT_MAX: 600,
  NOTICE_ANSWER_NOTE_MAX: 300,
  NOTICE_WITHDRAW_REASON_MAX: 300,
  /** Kliendi lehel näidatakse nii mitut viimast teadet. */
  NOTICES_SHOWN: 20,
  /** Teate arvudes on nii mitu viimast täiskuud ja lisaks jooksev kuu (K5-s). */
  NOTICE_FIGURE_MONTHS: 3,
  /** Esmakäigu teadet saab märkida kuni nii mitu päeva ette (K5-v). */
  FIRST_VISIT_AHEAD_DAYS: 31,
  /** Tähtaegade vaade näitab teatamata esmakäike tänasest nii mitu päeva ette (K6-c). */
  FIRST_VISIT_WATCH_DAYS: 3,
  /** Transpordi soov (K5-w). */
  TRANSPORT_TEXT_MAX: 200,
  TRANSPORT_AHEAD_DAYS: 183,
  /** Ühel kliendil korraga nii mitu ootel soovi. */
  TRANSPORT_OPEN_MAX: 5,
  /** Kliendi lehel näidatakse nii mitut eesolevat sõitu ja soovi. */
  TRANSPORT_SHOWN: 10,
  /** Sõidupäevik (K6-a): sõidu saab kirja panna kuni nii mitu päeva tagantjärele. */
  TRIP_BACK_DAYS: 62,
  /** Üks sõit ei saa olla pikem (näidu trükivea kaitse). */
  TRIP_KM_MAX: 2000,
  TRIP_PLATE_MAX: 12,
  TRIP_PURPOSE_MAX: 200,
  /** Töötaja kuu loendis näidatakse kuni nii mitut sõitu. */
  TRIPS_SHOWN: 200,
  /** Hooldusjuhi kuu vaates ja tabelifailis kuni nii mitu rida. */
  TRIPS_MONTH_MAX: 3000,
  /** „Soovin sellest rääkida" (K6-k): nii mitu lahtist soovi näitab tähtaegade leht. */
  TALK_REQUESTS_OPEN_MAX: 200,
  ACTIVITY_NAME_MAX: 160,
  ACTIVITY_NOTE_MAX: 300,
  /** Kehtivaid toiminguid asutuse kataloogis. */
  ACTIVITIES_MAX: 200,
  /** Kliendi lehel näidatakse nii mitut viimast seisu muutust. */
  STATUS_HISTORY_MAX: 30,
  CARD_LINES_MAX: 5,
  /** Autojuhile nähtavaid püsikaardi ridu kuni nii mitu (K5-y). */
  CARD_DRIVER_LINES_MAX: 3,
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
