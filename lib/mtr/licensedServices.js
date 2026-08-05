/* A4 E2 — vastavustabel: platvormi teenus ↔ loakohustus ↔ MTR tegevusala.

   See fail on A4 äriloogika süda. Vale rida siin annab vale märgise igal
   teenusekaardil korraga, seega iga rida kannab oma õigusviidet ja tabel on
   versioonitud. Parserit (lib/mtr/licences.js) ei pea tabeli muutmiseks puutuma.

   KAKS PIIRANGUT, mida ei tohi ära peita:

   1. MTR on jämedama teralisusega kui seadus. SHS-i viis erihoolekandeteenust
      (§ 151 p 5–9) kannab MTR-is ÜKS tegevusala "Erihoolekandeteenus", ja
      loakirje ei ütle, milline alateenus tegelikult kaetud on. Nende ridade
      märgis tohib öelda ainult "erihoolekandeteenuse tegevusluba", mitte
      konkreetse alateenuse nime. Vt `granularity: "COARSE"`.

   2. Platvormil ei ole täna kontrollitud teenusesõnastikku — `categories` ja
      `services` on vaba tekst. Seepärast on siin AINULT tuvastaja, mis annab
      KANDIDAADI, mitte otsuse: vabatekstist ei sünni kunagi avalikku väidet.
      Vt `licenceRequirementFor` ja O-A4-4. */

export const LICENSED_SERVICE_CATALOGUE_VERSION = "2026-08-05";

/* MTR-i tegevusalad "Sotsiaalhooldus" all koos otsinguvormi ID-dega
   (loetud registrist 05.08.2026). */
export const MTR_SOCIAL_ACTIVITIES = Object.freeze({
  ASENDUSHOOLDUS: { id: "t_3", label: "Asendushooldusteenus" },
  ERIHOOLEKANNE: { id: "t_7", label: "Erihoolekandeteenus" },
  LAPSEHOID: { id: "t_15", label: "Lapsehoiuteenus" },
  REHABILITATSIOON: { id: "t_95", label: "Rehabilitatsiooniteenus" },
  TURVAKODU: { id: "t_195", label: "Turvakoduteenus" },
  YLDHOOLDUS: { id: "t_196", label: "Väljaspool kodu osutatav üldhooldusteenus" }
});

/* Loakohustuslikud teenused. `legalBasis` on rea tõend; `aliases` teenivad
   AINULT vabateksti tuvastajat, mitte otsustamist. */
export const LICENSED_SERVICES = Object.freeze([
  {
    key: "LAPSEHOID_SUURE_VAJADUSEGA",
    label: "Suure hooldus- ja abivajadusega lapse hoiu teenus",
    legalBasis: "SHS § 151 p 1",
    activity: MTR_SOCIAL_ACTIVITIES.LAPSEHOID,
    granularity: "EXACT",
    aliases: ["lapsehoid", "lapsehoiuteenus", "raske ja sügava puudega lapse hoid", "lapsehoiuteenus puudega lapsele"]
  },
  {
    key: "ASENDUSHOOLDUS",
    label: "Asendushooldusteenus (välja arvatud hooldusperes)",
    legalBasis: "SHS § 151 p 2",
    activity: MTR_SOCIAL_ACTIVITIES.ASENDUSHOOLDUS,
    granularity: "EXACT",
    aliases: ["asendushooldus", "asendushooldusteenus", "asenduskodu", "perekodu"]
  },
  {
    key: "TURVAKODU",
    label: "Turvakoduteenus",
    legalBasis: "SHS § 151 p 3",
    activity: MTR_SOCIAL_ACTIVITIES.TURVAKODU,
    granularity: "EXACT",
    aliases: ["turvakodu", "turvakoduteenus", "varjupaik naistele", "naiste tugikeskus"]
  },
  {
    key: "YLDHOOLDUS_VALJASPOOL_KODU",
    label: "Väljaspool kodu osutatav üldhooldusteenus",
    legalBasis: "SHS § 151 p 4",
    activity: MTR_SOCIAL_ACTIVITIES.YLDHOOLDUS,
    granularity: "EXACT",
    aliases: ["üldhooldus", "üldhooldusteenus", "hooldekodu", "hooldushaigla", "väljaspool kodu osutatav üldhooldusteenus"]
  },
  {
    key: "IGAPAEVAELU_TOETAMINE",
    label: "Igapäevaelu toetamise teenus",
    legalBasis: "SHS § 151 p 5",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    aliases: ["igapäevaelu toetamine", "igapäevaelu toetamise teenus", "ieti"]
  },
  {
    key: "TOOTAMISE_TOETAMINE",
    label: "Töötamise toetamise teenus",
    legalBasis: "SHS § 151 p 6",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    aliases: ["töötamise toetamine", "töötamise toetamise teenus"]
  },
  {
    key: "TOETATUD_ELAMINE",
    label: "Toetatud elamise teenus",
    legalBasis: "SHS § 151 p 7",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    aliases: ["toetatud elamine", "toetatud elamise teenus"]
  },
  {
    key: "KOGUKONNAS_ELAMINE",
    label: "Kogukonnas elamise teenus",
    legalBasis: "SHS § 151 p 8",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    aliases: ["kogukonnas elamine", "kogukonnas elamise teenus"]
  },
  {
    key: "PAEVA_JA_NADALAHOID",
    label: "Päeva- ja nädalahoiuteenus",
    legalBasis: "SHS § 151 p 8¹",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    /* KONTROLLIMATA: MTR-i „Sotsiaalhooldus" all on kuus tegevusala ja
       päeva- ja nädalahoid ei ole neist ükski eraldi. Eeldus on, et ta elab
       „Erihoolekandeteenus" all — see rida vajab kinnitust päris loakirje
       pealt enne, kui teda märgise arvutamisel usaldada. */
    needsVerification: true,
    aliases: ["päevahoid", "nädalahoid", "päeva- ja nädalahoiuteenus"]
  },
  {
    key: "OOPAEVARINGNE_ERIHOOLDUS",
    label: "Ööpäevaringne erihooldusteenus",
    legalBasis: "SHS § 151 p 9",
    activity: MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE,
    granularity: "COARSE",
    aliases: ["ööpäevaringne erihooldus", "ööpäevaringne erihooldusteenus", "erihooldekodu"]
  },
  {
    key: "REHABILITATSIOON",
    label: "Rehabilitatsiooniteenus",
    legalBasis: "SHS § 147",
    activity: MTR_SOCIAL_ACTIVITIES.REHABILITATSIOON,
    granularity: "EXACT",
    aliases: ["rehabilitatsioon", "rehabilitatsiooniteenus", "sotsiaalne rehabilitatsioon", "srt"]
  }
]);

/* Teenused, mis EI ole § 151 loetelus ega § 147 all. Neid tohib märkida
   „ei vaja tegevusluba" ainult SIIS, kui teenus on siia rea külge SELGELT
   seotud — vabatekstist seda järeldust ei tehta. */
export const NON_LICENSED_SERVICES = Object.freeze([
  { key: "KODUTEENUS", label: "Koduteenus", legalBasis: "SHS § 17–18", aliases: ["koduteenus", "koduhooldus"] },
  { key: "TUGIISIK", label: "Tugiisikuteenus", legalBasis: "SHS § 23–24", aliases: ["tugiisik", "tugiisikuteenus"] },
  {
    key: "ISIKLIK_ABISTAJA",
    label: "Isikliku abistaja teenus",
    legalBasis: "SHS § 27–28",
    aliases: ["isiklik abistaja", "isikliku abistaja teenus"]
  },
  {
    key: "VOLANOUSTAMINE",
    label: "Võlanõustamisteenus",
    legalBasis: "SHS § 44–45",
    aliases: ["võlanõustamine", "võlanõustamisteenus"]
  },
  {
    key: "SOTSIAALTRANSPORT",
    label: "Sotsiaaltransporditeenus",
    legalBasis: "SHS § 38–40",
    aliases: ["sotsiaaltransport", "sotsiaaltransporditeenus"]
  },
  {
    key: "VARJUPAIGATEENUS",
    label: "Varjupaigateenus",
    legalBasis: "SHS § 30–31",
    aliases: ["varjupaigateenus", "öömaja"]
  }
]);

export const LICENCE_REQUIREMENT = Object.freeze({
  REQUIRED: "REQUIRED",
  NOT_REQUIRED: "NOT_REQUIRED",
  UNKNOWN: "UNKNOWN"
});

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("et")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ALL_ROWS = [
  ...LICENSED_SERVICES.map((row) => ({ ...row, requirement: LICENCE_REQUIREMENT.REQUIRED })),
  ...NON_LICENSED_SERVICES.map((row) => ({ ...row, requirement: LICENCE_REQUIREMENT.NOT_REQUIRED }))
];

export function findServiceByKey(key) {
  return ALL_ROWS.find((row) => row.key === key) || null;
}

/**
 * Vabatekstist KANDIDAADID, mitte otsus.
 * Tagastab kõik read, mille nimi või alias tekstis sisaldub, pikima vaste
 * järgi — nii et „ööpäevaringne erihooldusteenus" ei jää „erihooldekodu" taha.
 */
export function detectServiceCandidates(freeText) {
  const haystack = normalize(freeText);
  if (!haystack) return [];
  const matches = [];
  for (const row of ALL_ROWS) {
    const needles = [row.label, ...(row.aliases || [])].map(normalize).filter(Boolean);
    let best = 0;
    for (const needle of needles) {
      if (needle && haystack.includes(needle) && needle.length > best) best = needle.length;
    }
    if (best) matches.push({ ...row, matchLength: best });
  }
  return matches.sort((a, b) => b.matchLength - a.matchLength);
}

/**
 * Kas teenus vajab tegevusluba.
 *
 * `serviceKey` on SELGE seos (osutaja või admin on teenuse tabeli reaga sidunud)
 * ja ainult see annab otsuse. Vabatekst annab ALATI `UNKNOWN` koos kandidaatidega:
 * „ei vaja luba" on avalik rahustus ja seda ei tohi tuletada oletusest, ning
 * „vajab luba" käivitaks avaliku kontrolli vale teenuse peal.
 */
export function licenceRequirementFor({ serviceKey = null, freeText = "" } = {}) {
  const mapped = serviceKey ? findServiceByKey(serviceKey) : null;
  if (mapped) {
    return {
      requirement: mapped.requirement,
      service: mapped,
      activity: mapped.activity || null,
      granularity: mapped.granularity || null,
      needsVerification: Boolean(mapped.needsVerification),
      candidates: [],
      catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
    };
  }
  const candidates = detectServiceCandidates(freeText);
  return {
    requirement: LICENCE_REQUIREMENT.UNKNOWN,
    service: null,
    activity: null,
    granularity: null,
    needsVerification: false,
    candidates,
    catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION
  };
}

/**
 * Kas MTR-i loakirje katab selle teenuse.
 * Jämeda teralisusega ridade puhul (erihoolekanne) tähendab vaste ainult seda,
 * et osutajal on ERIHOOLEKANDETEENUSE luba — mitte et just see alateenus on
 * kaetud. Kutsuja peab seda märgise tekstis arvestama.
 */
export function licenceCoversService(licence, serviceKey) {
  const service = findServiceByKey(serviceKey);
  if (!service?.activity) return false;
  return normalize(licence?.activity) === normalize(service.activity.label);
}
