/* A4 E2 — vastavustabel: platvormi teenus ↔ loakohustus ↔ MTR tegevusala.

   See fail on A4 äriloogika süda. Vale rida siin annab vale märgise igal
   teenusekaardil korraga, seega iga rida kannab oma õigusviidet ja tabel on
   versioonitud. Parserit (lib/mtr/licences.js) ei pea tabeli muutmiseks puutuma.

   PÕHIREEGEL: iga epistemoloogiline piir on siin JÕUSTATUD API-s, mitte
   kirjeldatud kommentaaris. Kutsuja ei pea meeles pidama ühtki riivi:

   - `licenceCoverageForService` ei tagasta kunagi `true`/`false`, vaid seisu —
     nii ei saa MTR-i üldist tegevusalavastet lugeda konkreetse alateenuse
     tõendiks (`ACTIVITY_MATCH_ONLY` ≠ `EXACT_MATCH`);
   - kontrollimata kaardistus (`needsVerification`) nullib tegevusala, seega
     MTR-kontrolli ei saa tema peal üldse käivitada;
   - vabatekst annab ainult KANDIDAADI koos vaste põhjuse ja kindlusastmega;
   - `NO_SHS_LICENCE_REQUIRED` väidab TÄPSELT seda, mida tabel tõendab: et
     teenus ei vaja SHS § 147 / § 151 alusel sotsiaalteenuse tegevusluba. Ta ei
     väida, et muude seaduste alusel ei ole ühtki luba vaja (nt tasu eest
     sõitjateveol võivad kehtida ühistranspordiseaduse nõuded).

   TERALISUS (parandatud 05.08 päris registri vastu): SHS-i kuus
   erihoolekandeteenust (§ 151 p 5–9 ja p 8¹) kannavad ühte tegevusala
   "Erihoolekandeteenus", AGA registril on nende jaoks eraldi väli
   "Tegevusala liik" — kontrollitud filtriga, mis andis päeva- ja
   nädalahoiuteenusele 21 kehtivat kirjet. Kui E1 tellib väljundisse
   `tegevusala_liigid`, on vaste TÄPNE. Varasem järeldus "MTR on jämedam kui
   seadus" tuli vaikimisi väljundtulpade pealt ja oli ekslik.

   `ACTIVITY_MATCH_ONLY` jääb siiski alles — varuseisuna olukorraks, kus liik
   puudub, on tühi või MTR muudab sõnastust. Puuduv liik EI anna `NO_MATCH`. */

export const LICENSED_SERVICE_CATALOGUE_VERSION = "2026-08-05.2";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export const MATCH_CONFIDENCE = Object.freeze({
  HIGH: "HIGH",
  LOW: "LOW"
});

/* MTR-i tegevusalad "Sotsiaalhooldus" all koos otsinguvormi ID-dega
   (loetud registrist 05.08.2026). */
export const MTR_SOCIAL_ACTIVITIES = deepFreeze({
  ASENDUSHOOLDUS: { id: "t_3", label: "Asendushooldusteenus" },
  ERIHOOLEKANNE: { id: "t_7", label: "Erihoolekandeteenus" },
  LAPSEHOID: { id: "t_15", label: "Lapsehoiuteenus" },
  REHABILITATSIOON: { id: "t_95", label: "Rehabilitatsiooniteenus" },
  TURVAKODU: { id: "t_195", label: "Turvakoduteenus" },
  YLDHOOLDUS: { id: "t_196", label: "Väljaspool kodu osutatav üldhooldusteenus" }
});

const HIGH = MATCH_CONFIDENCE.HIGH;
const LOW = MATCH_CONFIDENCE.LOW;

/* Loakohustuslikud teenused. `legalBasis` on rea tõend; `aliases` teenivad
   AINULT vabateksti tuvastajat. Madala kindlusega alias on mitmetähenduslik ja
   tema `note` ütleb, millega teda segi aetakse. */
export const LICENSED_SERVICES = deepFreeze([
  {
    key: "LAPSEHOID_SUURE_VAJADUSEGA",
    label: "Suure hooldus- ja abivajadusega lapse hoiu teenus",
    legalBasis: "SHS § 151 p 1",
    activity: MTR_SOCIAL_ACTIVITIES.LAPSEHOID,
    granularity: "EXACT",
    aliases: [
      { value: "raske ja sügava puudega lapse hoid", confidence: HIGH },
      {
        value: "lapsehoid",
        confidence: LOW,
        note: "Alates 01.09.2025 on tavapärane lastehoid haridusvaldkonnas; sotsiaalteenus on ainult suure hooldus- ja abivajadusega lapse hoid."
      },
      {
        value: "lapsehoiuteenus",
        confidence: LOW,
        note: "Vt ülal — võib tähendada alushariduse lastehoidu."
      }
    ]
  },
  {
    key: "ASENDUSHOOLDUS",
    label: "Asendushooldusteenus (välja arvatud hooldusperes)",
    legalBasis: "SHS § 151 p 2",
    activity: MTR_SOCIAL_ACTIVITIES.ASENDUSHOOLDUS,
    granularity: "EXACT",
    aliases: [
      { value: "asendushooldusteenus", confidence: HIGH },
      { value: "asendushooldus", confidence: HIGH },
      { value: "asenduskodu", confidence: HIGH },
      { value: "perekodu", confidence: LOW, note: "Võib tähendada ka hooldusperet, mis on loakohustusest välja arvatud." }
    ]
  },
  {
    key: "TURVAKODU",
    label: "Turvakoduteenus",
    legalBasis: "SHS § 151 p 3",
    activity: MTR_SOCIAL_ACTIVITIES.TURVAKODU,
    granularity: "EXACT",
    aliases: [
      { value: "turvakoduteenus", confidence: HIGH },
      { value: "turvakodu", confidence: HIGH },
      {
        value: "varjupaik naistele",
        confidence: LOW,
        note: "Naiste tugikeskuse teenus on ohvriabi seaduse alusel eraldi tervikteenus, mitte turvakoduteenuse teine nimi."
      }
    ]
  },
  {
    key: "YLDHOOLDUS_VALJASPOOL_KODU",
    label: "Väljaspool kodu osutatav üldhooldusteenus",
    legalBasis: "SHS § 151 p 4",
    activity: MTR_SOCIAL_ACTIVITIES.YLDHOOLDUS,
    granularity: "EXACT",
    aliases: [
      { value: "väljaspool kodu osutatav üldhooldusteenus", confidence: HIGH },
      { value: "üldhooldusteenus", confidence: HIGH },
      { value: "üldhooldus", confidence: HIGH },
      { value: "hooldekodu", confidence: HIGH },
      { value: "hooldushaigla", confidence: LOW, note: "Võib viidata tervishoiuteenusele, mitte üldhooldusteenusele." }
    ]
  },
  {
    key: "IGAPAEVAELU_TOETAMINE",
    label: "Igapäevaelu toetamise teenus",
    legalBasis: "SHS § 151 p 5",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    activityType: "Igapäevaelu toetamise teenus",
    granularity: "EXACT",
    aliases: [
      { value: "igapäevaelu toetamise teenus", confidence: HIGH },
      { value: "igapäevaelu toetamine", confidence: HIGH }
    ]
  },
  {
    key: "TOOTAMISE_TOETAMINE",
    label: "Töötamise toetamise teenus",
    legalBasis: "SHS § 151 p 6",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    activityType: "Töötamise toetamise teenus",
    granularity: "EXACT",
    aliases: [
      { value: "töötamise toetamise teenus", confidence: HIGH },
      { value: "töötamise toetamine", confidence: HIGH }
    ]
  },
  {
    key: "TOETATUD_ELAMINE",
    label: "Toetatud elamise teenus",
    legalBasis: "SHS § 151 p 7",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    activityType: "Toetatud elamise teenus",
    granularity: "EXACT",
    aliases: [
      { value: "toetatud elamise teenus", confidence: HIGH },
      { value: "toetatud elamine", confidence: HIGH }
    ]
  },
  {
    key: "KOGUKONNAS_ELAMINE",
    label: "Kogukonnas elamise teenus",
    legalBasis: "SHS § 151 p 8",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    activityType: "Kogukonnas elamise teenus",
    granularity: "EXACT",
    aliases: [
      { value: "kogukonnas elamise teenus", confidence: HIGH },
      { value: "kogukonnas elamine", confidence: HIGH }
    ]
  },
  {
    key: "PAEVA_JA_NADALAHOID",
    label: "Päeva- ja nädalahoiuteenus",
    legalBasis: "SHS § 151 p 8¹",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    /* KONTROLLITUD 05.08 päris registri vastu: filter tegevusala =
       Erihoolekandeteenus + tegevusala liik = "Päeva- ja nädalahoiuteenus"
       andis 21 kehtivat kirjet. Varasem `needsVerification` on maas. */
    activityType: "Päeva- ja nädalahoiuteenus",
    granularity: "EXACT",
    aliases: [
      { value: "päeva- ja nädalahoiuteenus", confidence: HIGH },
      { value: "päevahoid", confidence: LOW, note: "Võib tähendada ka lastehoidu." },
      { value: "nädalahoid", confidence: HIGH }
    ]
  },
  {
    key: "OOPAEVARINGNE_ERIHOOLDUS",
    label: "Ööpäevaringne erihooldusteenus",
    legalBasis: "SHS § 151 p 9",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    /* Registri sõnastus kannab "kokku" — ta koondab ööpäevaringse
       erihoolduse alavariandid (tavapärane, äärmuslik abivajadus,
       ebastabiilne remissioon, kohtumääruse alusel) ühe liigi alla. */
    activityType: "Ööpäevaringne erihooldusteenus kokku",
    granularity: "EXACT",
    aliases: [
      { value: "ööpäevaringne erihooldusteenus", confidence: HIGH },
      { value: "ööpäevaringne erihooldus", confidence: HIGH },
      { value: "erihooldekodu", confidence: LOW, note: "Kõnekeelne; võib katta mitut erihoolekandeteenust." }
    ]
  },
  {
    key: "REHABILITATSIOON",
    label: "Rehabilitatsiooniteenus",
    legalBasis: "SHS § 147",
    activity: MTR_SOCIAL_ACTIVITIES.REHABILITATSIOON,
    granularity: "EXACT",
    aliases: [
      { value: "sotsiaalse rehabilitatsiooni teenus", confidence: HIGH },
      { value: "sotsiaalne rehabilitatsioon", confidence: HIGH },
      { value: "rehabilitatsiooniteenus", confidence: HIGH },
      {
        value: "rehabilitatsioon",
        confidence: LOW,
        note: "Võib tähendada ka tööalast või meditsiinilist rehabilitatsiooni, mis ei ole SHS § 147 teenus."
      },
      { value: "srt", confidence: LOW, note: "Lühend, esineb ka muudes tähendustes." }
    ]
  }
]);

/* Teenused, mis EI ole § 151 loetelus ega § 147 all. Tabel tõendab ainult SHS-i
   loakohustuse puudumist — mitte seda, et muu seaduse alusel luba vaja ei oleks. */
export const NON_LICENSED_SERVICES = deepFreeze([
  {
    key: "KODUTEENUS",
    label: "Koduteenus",
    legalBasis: "SHS § 17–18",
    aliases: [
      { value: "koduteenus", confidence: HIGH },
      { value: "koduhooldus", confidence: HIGH }
    ]
  },
  {
    key: "TUGIISIK",
    label: "Tugiisikuteenus",
    legalBasis: "SHS § 23–24",
    aliases: [
      { value: "tugiisikuteenus", confidence: HIGH },
      { value: "tugiisik", confidence: HIGH }
    ]
  },
  {
    key: "ISIKLIK_ABISTAJA",
    label: "Isikliku abistaja teenus",
    legalBasis: "SHS § 27–28",
    aliases: [
      { value: "isikliku abistaja teenus", confidence: HIGH },
      { value: "isiklik abistaja", confidence: HIGH }
    ]
  },
  {
    key: "VOLANOUSTAMINE",
    label: "Võlanõustamisteenus",
    legalBasis: "SHS § 44–45",
    aliases: [
      { value: "võlanõustamisteenus", confidence: HIGH },
      { value: "võlanõustamine", confidence: HIGH }
    ]
  },
  {
    key: "SOTSIAALTRANSPORT",
    label: "Sotsiaaltransporditeenus",
    legalBasis: "SHS § 38–40",
    aliases: [
      { value: "sotsiaaltransporditeenus", confidence: HIGH },
      {
        value: "sotsiaaltransport",
        confidence: LOW,
        note: "SHS-i luba ei ole nõutav, aga tasu eest sõitjateveole võivad kehtida ühistranspordiseaduse nõuded."
      }
    ]
  },
  {
    key: "VARJUPAIGATEENUS",
    label: "Varjupaigateenus",
    legalBasis: "SHS § 30–31",
    aliases: [
      { value: "varjupaigateenus", confidence: HIGH },
      { value: "öömaja", confidence: LOW, note: "Kõnekeelne." }
    ]
  },
  {
    key: "TAISEALISE_ISIKU_HOOLDUS",
    label: "Täisealise isiku hooldus",
    legalBasis: "SHS § 26",
    aliases: [
      { value: "täisealise isiku hooldus", confidence: HIGH },
      { value: "hooldaja määramine", confidence: HIGH }
    ]
  },
  {
    key: "ELURUUMI_TAGAMINE",
    label: "Eluruumi tagamise teenus",
    legalBasis: "SHS § 41–43",
    aliases: [
      { value: "eluruumi tagamise teenus", confidence: HIGH },
      { value: "eluruumi tagamine", confidence: HIGH },
      { value: "sotsiaaleluruum", confidence: LOW, note: "Kõnekeelne; võib tähendada ka munitsipaalkorterit üldiselt." }
    ]
  },
  {
    key: "ASENDUSHOOLDUS_HOOLDUSPERES",
    label: "Asendushooldusteenus hooldusperes",
    legalBasis: "SHS § 45¹⁰ lg 2",
    /* Tegevusluba ei ole nõutud, AGA kontrollimatust siit järeldada ei tohi:
       hoolduspere sobivust hindab SKA ja kanne tehakse STAR-i, mis ei ole
       avalik register — A4 ei saa seda MTR-i moodi automaatselt kontrollida. */
    otherVerification: "SKA_SUITABILITY_AND_STAR",
    publicNote:
      "Tegevusluba ei ole nõutud. Hoolduspere sobivust hindab Sotsiaalkindlustusamet ja sobivaks hinnatud pere kohta tehakse märge STAR-is.",
    aliases: [
      { value: "asendushooldusteenus hooldusperes", confidence: HIGH },
      { value: "hoolduspere", confidence: HIGH }
    ]
  },
  {
    key: "SOTSIAALNOUSTAMINE",
    label: "Sotsiaalnõustamine",
    /* Kehtivas SHS-is ei ole sotsiaalnõustamine eraldi nummerdatud
       sotsiaalteenus (§ 16 on hoopis tasu sotsiaalteenuse eest). Aus `null`
       on parem kui näiliselt täpne, aga aegunud viide vanale seadusele. */
    legalBasis: null,
    legalNote: "Kehtivas SHS-is ei ole sotsiaalnõustamine eraldi nummerdatud sotsiaalteenusena sätestatud.",
    aliases: [
      { value: "sotsiaalnõustamine", confidence: HIGH },
      { value: "sotsiaalnõustamisteenus", confidence: HIGH }
    ]
  }
]);

export const LICENCE_REQUIREMENT = Object.freeze({
  REQUIRED: "REQUIRED",
  /* Tahtlikult pikk nimi: väide piirdub SHS-iga ega laiene muudele seadustele. */
  NO_SHS_LICENCE_REQUIRED: "NO_SHS_LICENCE_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

export const MAPPING_STATUS = Object.freeze({
  MAPPED: "MAPPED",
  NEEDS_VERIFICATION: "NEEDS_VERIFICATION",
  UNMAPPED: "UNMAPPED"
});

export const LICENCE_COVERAGE = Object.freeze({
  EXACT_MATCH: "EXACT_MATCH",
  ACTIVITY_MATCH_ONLY: "ACTIVITY_MATCH_ONLY",
  NO_MATCH: "NO_MATCH",
  UNCONFIRMED: "UNCONFIRMED"
});

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ALL_ROWS = deepFreeze([
  ...LICENSED_SERVICES.map((row) => ({ ...row, requirement: LICENCE_REQUIREMENT.REQUIRED })),
  ...NON_LICENSED_SERVICES.map((row) => ({ ...row, requirement: LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED }))
]);

export function findServiceByKey(key) {
  return ALL_ROWS.find((row) => row.key === key) || null;
}

export function allCatalogueRows() {
  return ALL_ROWS;
}

/**
 * Vabatekstist KANDIDAADID, mitte otsus.
 * Iga kandidaat kannab vaste põhjust: mis tekst sobitus, kas ametlik nimi või
 * alias, ja kui kindel see alias on. Ilma põhjuseta ei saa admin aru, miks
 * süsteem talle midagi pakub.
 */
export function detectServiceCandidates(freeText) {
  const haystack = normalize(freeText);
  if (!haystack) return [];
  const matches = [];
  for (const row of ALL_ROWS) {
    const needles = [
      { value: row.label, confidence: MATCH_CONFIDENCE.HIGH, matchedBy: "LABEL", note: null },
      ...(row.aliases || []).map((alias) => ({ ...alias, matchedBy: "ALIAS" }))
    ];
    let best = null;
    for (const needle of needles) {
      const normalized = normalize(needle.value);
      if (!normalized || !haystack.includes(normalized)) continue;
      if (!best || normalized.length > best.matchLength) {
        best = {
          matchedText: needle.value,
          matchedBy: needle.matchedBy,
          confidence: needle.confidence,
          note: needle.note || null,
          matchLength: normalized.length
        };
      }
    }
    if (best) {
      matches.push({
        key: row.key,
        label: row.label,
        requirement: row.requirement,
        legalBasis: row.legalBasis,
        ...best
      });
    }
  }
  return matches.sort((a, b) => b.matchLength - a.matchLength);
}

/**
 * Kas teenus vajab SHS-i alusel tegevusluba.
 *
 * `serviceKey` on SELGE seos (osutaja või admin on teenuse tabeli reaga sidunud)
 * ja ainult see annab otsuse. Vabatekst annab ALATI `UNKNOWN` koos kandidaatidega:
 * „ei vaja luba" on avalik rahustus ja seda ei tohi tuletada oletusest, ning
 * „vajab luba" käivitaks avaliku kontrolli vale teenuse peal.
 *
 * Kontrollimata kaardistuse korral jääb loakohustus alles (seadus on selge), aga
 * `activity` on `null` — MTR-kontrolli ei saa käivitada ja märgist ei saa anda.
 */
export function licenceRequirementFor({ serviceKey = null, freeText = "" } = {}) {
  const mapped = serviceKey ? findServiceByKey(serviceKey) : null;

  if (mapped?.needsVerification) {
    return {
      requirement: mapped.requirement,
      service: mapped,
      activity: null,
      granularity: null,
      mappingStatus: MAPPING_STATUS.NEEDS_VERIFICATION,
      candidates: [],
      catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
    };
  }

  if (mapped) {
    return {
      requirement: mapped.requirement,
      service: mapped,
      activity: mapped.activity || null,
      activityType: mapped.activityType || null,
      granularity: mapped.granularity || null,
      otherVerification: mapped.otherVerification || null,
      mappingStatus: MAPPING_STATUS.MAPPED,
      candidates: [],
      catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
    };
  }

  return {
    requirement: LICENCE_REQUIREMENT.UNKNOWN,
    service: null,
    activity: null,
    granularity: null,
    mappingStatus: MAPPING_STATUS.UNMAPPED,
    candidates: detectServiceCandidates(freeText),
    catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
  };
}

/**
 * Mida MTR-i loakirje selle teenuse kohta TÕENDAB.
 *
 * Tahtlikult EI OLE boolean. `ACTIVITY_MATCH_ONLY` tähendab: osutajal on selle
 * tegevusala luba, aga register ei ütle, kas just see alateenus on kaetud —
 * ja seda ei tohi kuvada kui „kontrollitud" konkreetse teenuse juures.
 */
export function licenceCoverageForService(licence, serviceKey) {
  const service = findServiceByKey(serviceKey);
  if (!service) return LICENCE_COVERAGE.UNCONFIRMED;
  if (service.needsVerification || !service.activity) return LICENCE_COVERAGE.UNCONFIRMED;
  if (normalize(licence?.activity) !== normalize(service.activity.label)) return LICENCE_COVERAGE.NO_MATCH;

  /* Erihoolekande read kannavad täpset liiki. Kui loal on liik olemas, peab ta
     kattuma; kui liiki EI OLE (vana kirje, tellimata tulp, MTR-i muutus), ei ole
     see vastuolu — jääb jämedam seis, mitte `NO_MATCH`. */
  if (service.activityType) {
    const licenceType = normalize(licence?.activityType);
    if (!licenceType) return LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY;
    return licenceType === normalize(service.activityType)
      ? LICENCE_COVERAGE.EXACT_MATCH
      : LICENCE_COVERAGE.NO_MATCH;
  }

  return service.granularity === "EXACT" ? LICENCE_COVERAGE.EXACT_MATCH : LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY;
}
