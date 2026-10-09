/**
 * KODUTEENUS K1-i — täieliku väljavõtte kuju ja kontroll.
 *
 * Väljavõte on ÜKS JSON-dokument: päis (mis see on, kes ja millal koostas),
 * manifest (mis on sees, mis on teadlikult väljas ja miks), kogud ridadena ja
 * lõpus koguarvud. Kuju on kirjas siin, mitte koostaja sees, sest sama faili
 * peab saama kontrollida ka väljaspool platvormi: asutus, kes lahkub või
 * varukoopiat hoiab, ei pea meid uskuma.
 *
 * Siin ei ole andmebaasi ega serveri mooduleid: kontroll töötab ka käsurealt
 * (`scripts/home-care-export-check.mjs`) ja testis.
 */

export const HOME_CARE_EXPORT_FORMAT = "sotsiaal.pro/koduteenus-valjavote";
export const HOME_CARE_EXPORT_VERSION = 22;
/**
 * Versioonid, mida kontroll oskab lugeda. Varasema versiooni fail peab jääma
 * kontrollitavaks: asutuse vana varukoopia ei tohi uue kogu lisandumise tõttu
 * „tundmatuks" muutuda. Kogu, millel on `since`, ei oodata sellest vanemas failis.
 */
export const HOME_CARE_EXPORT_READABLE_VERSIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);

/**
 * Kogud selles järjekorras, milles need failis on. `parents` on kõvad viited:
 * iga rea vastav väli peab osutama reale teises kogus (tühi väärtus on lubatud
 * ainult seal, kus on `optional`). `people` on töötaja liikmesuse viited: need on
 * andmebaasis võõrvõtmeta jäljed, seega lahendamata viide on tähelepanek, mitte viga.
 */
export const HOME_CARE_EXPORT_COLLECTIONS = Object.freeze([
  { key: "units", parents: [], people: [] },
  {
    key: "clients",
    parents: [{ field: "unitId", collection: "units", optional: true }],
    people: ["createdByMembershipId"]
  },
  {
    key: "teamMembers",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["membershipId", "addedByMembershipId", "endedByMembershipId"]
  },
  {
    key: "cardLines",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["addedByMembershipId", "endedByMembershipId"]
  },
  {
    key: "entries",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["authorMembershipId", "companionMembershipId", "incidentAssigneeMembershipId", "incidentResolvedByMembershipId"]
  },
  {
    key: "entryRevisions",
    parents: [
      { field: "entryId", collection: "entries" },
      { field: "clientId", collection: "clients" }
    ],
    people: ["actorMembershipId"]
  },
  { key: "entryReads", parents: [{ field: "entryId", collection: "entries" }], people: ["membershipId"] },
  {
    key: "incidentUpdates",
    parents: [
      { field: "entryId", collection: "entries" },
      { field: "clientId", collection: "clients" }
    ],
    people: ["actorMembershipId", "assigneeMembershipId"]
  },
  { key: "accessLog", parents: [{ field: "clientId", collection: "clients" }], people: ["membershipId"] },
  {
    key: "chronologyReleases",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId"]
  },
  { key: "chronologyReleaseItems", parents: [{ field: "releaseId", collection: "chronologyReleases" }], people: [] },
  {
    key: "importedHistories",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["importedByMembershipId"]
  },
  {
    key: "importedHistoryBlocks",
    parents: [
      { field: "historyId", collection: "importedHistories" },
      { field: "clientId", collection: "clients" }
    ],
    people: []
  },
  {
    key: "doorTags",
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "revokedByMembershipId"]
  },
  /* Lisandus versioonis 2 (K1-j): seisu muutuste ajalugu ja kliendi `statusReason`. */
  {
    key: "clientStatusChanges",
    since: 2,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["actorMembershipId"]
  },
  /* Lisandus versioonis 3 (K2-a): asutuse toimingute kataloog. */
  { key: "activities", since: 3, parents: [], people: ["createdByMembershipId"] },
  /* Lisandus versioonis 4 (K2-b): hoolduskavad ja nende read. */
  {
    key: "carePlans",
    since: 4,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "activatedByMembershipId"]
  },
  {
    key: "carePlanLines",
    since: 4,
    parents: [
      { field: "planId", collection: "carePlans" },
      { field: "clientId", collection: "clients" },
      { field: "activityId", collection: "activities", optional: true }
    ],
    people: []
  },
  /* Lisandus versioonis 5 (K2-c): otsused ja otsustatud maht. */
  {
    key: "decisions",
    since: 5,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "retractedByMembershipId"]
  },
  /* Lisandus versioonis 6 (K2-d): käigul tehtud toimingud (kirje `visitMinutes` on kirje real). */
  {
    key: "entryActivities",
    since: 6,
    parents: [
      { field: "entryId", collection: "entries" },
      { field: "clientId", collection: "clients" },
      { field: "planLineId", collection: "carePlanLines", optional: true },
      { field: "activityId", collection: "activities", optional: true }
    ],
    people: []
  },
  /* Lisandus versioonis 7 (K3-a): käigumuster ehk kliendi korduvad käigud. */
  {
    key: "visitSlots",
    since: 7,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["workerMembershipId", "createdByMembershipId"]
  },
  /* Lisandus versioonis 8 (K3-b): ühe päeva erandid käigumustris. */
  {
    key: "visitChanges",
    since: 8,
    parents: [
      { field: "slotId", collection: "visitSlots" },
      { field: "clientId", collection: "clients" }
    ],
    people: ["workerMembershipId", "createdByMembershipId"]
  },
  /* Lisandus versioonis 9 (K3-c): töötajate puudumised. */
  { key: "absences", since: 9, parents: [], people: ["membershipId", "createdByMembershipId"] },
  /* Lisandus versioonis 10 (K3-e): hooldaja takistuse teated. */
  { key: "obstacles", since: 10, parents: [], people: ["membershipId", "handledByMembershipId"] },
  /* Lisandus versioonis 11 (K3-g): töö iseloomu märked kliendi juures, ka lõppenud. */
  {
    key: "workNatures",
    since: 11,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  /* Lisandus versioonis 12 (K4-a): eeltingimused enne teenuse algust, ka lõpetatud. */
  {
    key: "preconditions",
    since: 12,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "closedByMembershipId"]
  },
  /* Lisandus versioonis 13 (K4-b): võtmeraamat ja üleandmiste jälg, ka lõpetatud võtmed. */
  {
    key: "keys",
    since: 13,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["holderMembershipId", "createdByMembershipId", "closedByMembershipId"]
  },
  {
    key: "keyHandovers",
    since: 13,
    parents: [{ field: "keyId", collection: "keys" }],
    people: ["fromMembershipId", "toMembershipId", "recordedByMembershipId"]
  },
  /* Lisandus versioonis 14 (K4-c): kliendi sularaha arvestus, ka tühistatud read. */
  {
    key: "moneyEntries",
    since: 14,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["holderMembershipId", "retractedByMembershipId"]
  },
  /* Lisandus versioonis 15 (K4-e): jälgitavad varud ja seisude märkimise jälg, ka lõpetatud jälgimised. */
  {
    key: "supplies",
    since: 15,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["checkedByMembershipId", "createdByMembershipId", "endedByMembershipId"]
  },
  {
    key: "supplyChecks",
    since: 15,
    parents: [
      { field: "supplyId", collection: "supplies" },
      { field: "clientId", collection: "clients" }
    ],
    people: ["checkedByMembershipId"]
  },
  /* Lisandus versioonis 16 (K4-f): kliendiga kokku lepitud sammud, kui uks ei avane; ka varasemad loendid. */
  {
    key: "doorSteps",
    since: 16,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  /* Lisandusid versioonis 17 (K5-a): kliendi tavaline seis valdkonniti (ka varasemad tekstid) ja märkamised koos vastusega. */
  {
    key: "usualStates",
    since: 17,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  {
    key: "changeSignals",
    since: 17,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["handledByMembershipId"]
  },
  /* Lisandus versioonis 18 (K5-b): kriisivalmiduse hinnangud, ka varasemad. */
  {
    key: "crisisProfiles",
    since: 18,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  /* Lisandus versioonis 19 (K5-c): asutuse loend „kuhu suunata", ka varasemad read. */
  { key: "referralContacts", since: 19, parents: [], people: ["createdByMembershipId", "endedByMembershipId"] },
  /* Lisandus versioonis 20 (K5-e): töötajate kaartide read (taustakontroll, koolitused), ka eemaldatud. */
  { key: "workerRecords", since: 20, parents: [], people: ["membershipId", "createdByMembershipId", "endedByMembershipId"] },
  /* Lisandus versioonis 21 (K5-k): kliendi lähedased ja jagamisaste, ka lõpetatud read. */
  {
    key: "clientRelatives",
    since: 21,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  /* Lisandus versioonis 22 (K5-n): ohutuskaardi vastused, ka varasemad. */
  {
    key: "safetyItems",
    since: 22,
    parents: [{ field: "clientId", collection: "clients" }],
    people: ["createdByMembershipId", "endedByMembershipId"]
  },
  { key: "auditEvents", parents: [], people: ["actorMembershipId"] },
  /* Viimasena, sest siin on ainult need töötajad, kellele eelnevad read viitavad. */
  { key: "people", parents: [], people: [] }
]);

export const HOME_CARE_EXPORT_KEYS = Object.freeze(HOME_CARE_EXPORT_COLLECTIONS.map((collection) => collection.key));

/**
 * Mis on teadlikult väljas ja miks. Osa manifestist: ilma selleta ei saa faili
 * saaja teada, kas midagi on puudu või välja jäetud.
 */
export const HOME_CARE_EXPORT_EXCLUSIONS = Object.freeze([
  {
    key: "entry_search_helpers",
    why: "Otsinguabi (sõnade tüved ja algvormid) on tuletatud kirje tekstist; tekst ise on väljavõttes."
  },
  {
    key: "request_keys",
    why: "Kordussaatmise võtmed ja räsid on tehniline kaitse topeltsalvestuse vastu, mitte asutuse andmed."
  },
  {
    key: "door_tag_marks",
    why: "Uksesildi tunnus on töötav aadress. Väljavõttes on sildi tegemise ja tühistamise jälg; uue sildi saab alati teha."
  },
  {
    key: "device_queue",
    why: "Kirjed, mis ootavad veel töötaja seadmes võrku, ei ole serverisse jõudnud ja siin neid ei ole."
  },
  {
    key: "user_accounts",
    why: "Failis on ainult nende töötajate nimed, kellele koduteenuse read viitavad. E-posti aadressid, sisselogimise andmed ja asutuse ülejäänud töötajad on asutuse üldises väljavõttes."
  },
  {
    key: "service_diary",
    why: "Teenuspäeviku arvestuskirjed on eraldi funktsioon oma väljavõttega."
  }
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Kontrollib väljavõtte sisemist kooskõla: kuju, koguarvud, kordumatud ID-d ja
 * viited. Tagastab leiud inimesele loetaval kujul; `ok` on tõene, kui vigu ei ole.
 *
 * Kontroll EI tõenda, et sisu vastab tegelikkusele ega et fail on see, mis
 * platvormilt väljus: selleks on kontrollsumma, mida võrreldakse asutuse
 * tööloendis oleva summaga.
 */
export function checkHomeCareExport(document) {
  const problems = [];
  const notes = [];
  if (!isPlainObject(document)) return { ok: false, problems: ["Fail ei ole JSON-objekt."], notes, totals: {} };

  if (document.format !== HOME_CARE_EXPORT_FORMAT) problems.push(`Tundmatu vorming: ${String(document.format)}.`);
  if (!HOME_CARE_EXPORT_READABLE_VERSIONS.includes(document.version)) problems.push(`Tundmatu versioon: ${String(document.version)}.`);
  /* Vanemas failis ei ole kogusid, mis lisandusid hiljem. */
  const collections = HOME_CARE_EXPORT_COLLECTIONS.filter(
    (collection) => !collection.since || !Number.isInteger(document.version) || collection.since <= document.version
  );
  for (const field of ["exportId", "generatedAt"]) {
    if (typeof document[field] !== "string" || !document[field]) problems.push(`Päises puudub väli „${field}".`);
  }
  if (!isPlainObject(document.organization) || !document.organization.id) problems.push("Päises puudub asutus.");
  if (!isPlainObject(document.manifest)) problems.push("Manifest puudub.");
  if (!isPlainObject(document.totals)) problems.push("Koguarvud puuduvad: fail võib olla poolik.");

  const ids = new Map();
  const totals = {};
  for (const { key } of collections) {
    const rows = document[key];
    if (!Array.isArray(rows)) {
      problems.push(`Kogu „${key}" puudub.`);
      ids.set(key, new Set());
      continue;
    }
    totals[key] = rows.length;
    const seen = new Set();
    let repeated = 0;
    let missing = 0;
    for (const row of rows) {
      const id = isPlainObject(row) ? row.id : null;
      if (typeof id !== "string" || !id) missing += 1;
      else if (seen.has(id)) repeated += 1;
      else seen.add(id);
    }
    if (missing) problems.push(`Kogus „${key}" on ${missing} rida ilma ID-ta.`);
    if (repeated) problems.push(`Kogus „${key}" kordub ${repeated} ID-d.`);
    ids.set(key, seen);
    const declared = isPlainObject(document.totals) ? document.totals[key] : undefined;
    if (declared !== rows.length) {
      problems.push(`Kogu „${key}": failis on ${rows.length} rida, koguarv ütleb ${String(declared)}.`);
    }
  }

  const people = ids.get("people") || new Set();
  for (const collection of collections) {
    const rows = Array.isArray(document[collection.key]) ? document[collection.key] : [];
    for (const parent of collection.parents) {
      const known = ids.get(parent.collection) || new Set();
      let broken = 0;
      for (const row of rows) {
        const value = row?.[parent.field];
        if (value === null || value === undefined) {
          if (!parent.optional) broken += 1;
        } else if (!known.has(value)) broken += 1;
      }
      if (broken) {
        problems.push(`Kogus „${collection.key}" ei leia ${broken} rea väli „${parent.field}" oma rida kogust „${parent.collection}".`);
      }
    }
    let unresolved = 0;
    for (const field of collection.people) {
      for (const row of rows) {
        const value = row?.[field];
        if (value !== null && value !== undefined && !people.has(value)) unresolved += 1;
      }
    }
    if (unresolved) notes.push(`Kogus „${collection.key}" on ${unresolved} viidet töötajale, keda loendis „people" ei ole.`);
  }

  /* Kaks arvu, mida rida ise enda kohta väidab. */
  const countBy = (rows, field) => {
    const counts = new Map();
    for (const row of Array.isArray(rows) ? rows : []) counts.set(row?.[field], (counts.get(row?.[field]) || 0) + 1);
    return counts;
  };
  const blocks = countBy(document.importedHistoryBlocks, "historyId");
  for (const history of Array.isArray(document.importedHistories) ? document.importedHistories : []) {
    if ((blocks.get(history?.id) || 0) !== history?.blockCount) {
      problems.push(`Varasema ajaloo „${String(history?.id)}" lõikude arv ei klapi (${blocks.get(history?.id) || 0}, peab olema ${String(history?.blockCount)}).`);
    }
  }
  const items = countBy(document.chronologyReleaseItems, "releaseId");
  for (const release of Array.isArray(document.chronologyReleases) ? document.chronologyReleases : []) {
    if ((items.get(release?.id) || 0) !== release?.entryCount) {
      problems.push(`Väljastuse „${String(release?.id)}" ridade arv ei klapi (${items.get(release?.id) || 0}, peab olema ${String(release?.entryCount)}).`);
    }
  }

  return { ok: problems.length === 0, problems, notes, totals };
}
