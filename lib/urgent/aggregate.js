// SK-V1 E6 — koond. Mitu ISE-DEKLAREERITUD kiireloomulist pöördumist, mis
// kellaajal, mis piirkonnas — ilma sisuta.
//
// Kaks asja, mis eristavad seda koondit admini kriisiloendurist ja mida ei tohi
// segi ajada (`SotsiaalAI.md` osa II ptk 1 õppetund):
//
//   1. **Valim on ERISTUVAD INIMESED, mitte sündmused.** Ühe inimese viis
//      pöördumist ei ole viis inimest ja ei tohi näidata „5"-na. Sündmusepõhine
//      summutus EI ole k-anonüümsus ja seda vahet on siin failis juba korra
//      valesti kirjeldatud — teist korda mitte.
//   2. **Lävi on 5 ja teda ei saa päringuga langetada.** `k` tuleb
//      konstandist; kutsuja võib teda ainult TÕSTA.
//
// Number, mille see koond annab, on platvormi kõige tugevam argument: „189
// inimest vajutas ise nuppu" on vaieldamatu, „algoritm liigitas 189 juhtumit"
// on vaieldav (leping 3.3). Seepärast peab ta olema puhas.
//
// Mida siin EI OLE ega tohi kunagi tekkida: sisu, verbatim-tekst, kontaktid,
// üksikute inimeste identiteet, ega ükski väli, mis lubaks rühma tagasi
// üksikuteks lahutada.

import { prisma as defaultPrisma } from "@/lib/prisma";
import { ESTONIA_TIME_ZONE, zonedParts } from "@/lib/time/estonianDay";

/** Ämbrid on EESTI seinakella järgi ja see käib vastuses kaasas. */
export const AGGREGATE_TIME_ZONE = ESTONIA_TIME_ZONE;

/**
 * SOL-URG-11 — lehekülje suurus ja ülempiir.
 *
 * `MAX_PAGES` on OHUTUSVENTIIL, mitte lehekülg: ta kaitseb lõputu skaneeringu
 * eest, aga tema täitumine ei tohi näha välja nagu „rohkem ei olegi". Selle
 * jaoks on vastuses `truncated`.
 */
export const AGGREGATE_PAGE_SIZE = 5000;
export const AGGREGATE_MAX_PAGES = 200;

/** k≥5. Konstant, mitte parameeter — päringuga seda langetada ei saa. */
export const URGENT_MIN_GROUP_SIZE = 5;

/** Kellaaja ämbrid. Öö on siin see, mille pärast funktsioon olemas on. */
export const HOUR_BUCKETS = Object.freeze([
  { key: "night", fromHour: 22, toHour: 6 },
  { key: "morning", fromHour: 6, toHour: 10 },
  { key: "day", fromHour: 10, toHour: 17 },
  { key: "evening", fromHour: 17, toHour: 22 }
]);

function bucketForHour(hour) {
  if (hour >= 22 || hour < 6) return "night";
  if (hour < 10) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

function resolveMinimum(options = {}) {
  const requested = Number(options.minimumGroupSize);
  // Ainult TÕSTA saab. Väiksem number ei jõua siit kunagi läbi.
  if (Number.isInteger(requested) && requested > URGENT_MIN_GROUP_SIZE) return requested;
  return URGENT_MIN_GROUP_SIZE;
}

function addPerson(map, key, personKey) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(personKey);
}

/**
 * Koond, mis ei väljasta ühtegi rühma alla läve.
 *
 * `suppressedGroups` on tahtlikult vastuses: vaikiv kärpimine loeks nagu
 * „katsime kõik", kuigi tegelikult jäi osa välja. Summutatud rühmade ARV ei
 * ütle kellegi kohta midagi, aga ütleb lugejale, et ta ei näe kõike.
 */
export async function buildUrgentRequestAggregate({
  db = defaultPrisma,
  from = null,
  to = null,
  ...options
} = {}) {
  const minimumGroupSize = resolveMinimum(options);
  /* Lehekülje suurus ja ülempiir on ülekirjutatavad AINULT selleks, et kärpeseis
     oleks mõõdetav ilma miljonit rida kirjutamata. Vaikeväärtused on tootmise
     omad ja lävi (`minimumGroupSize`) EI ole siin — teda saab ainult tõsta. */
  const pageSize = Number.isInteger(options.pageSize) && options.pageSize > 0
    ? options.pageSize
    : AGGREGATE_PAGE_SIZE;
  const maxPages = Number.isInteger(options.maxPages) && options.maxPages > 0
    ? options.maxPages
    : AGGREGATE_MAX_PAGES;

  const where = {};
  if (from || to) {
    where.sentAt = {};
    if (from) where.sentAt.gte = new Date(from);
    if (to) where.sentAt.lte = new Date(to);
  }

  const byRegion = new Map();
  const byHourBucket = new Map();
  const overall = new Set();

  /* SOL-URG-11: kogu valim, lehekülgede kaupa.
     Vana kuju oli `take: 20000` ilma `orderBy`-ta ja ilma kärpeindikaatorita:
     otsustajale tagastati TÄIELIKU koondi kujuline vastus, millest oli teadmata
     osa välja jäänud, ja isegi see, MILLINE osa sisse jäi, oli määramata.

     Kursor on `id` ja järjestus ASC — koond on hetkepilt ja uued read tulevad
     ainult lõppu, seega juba loetud lehekülgi nad ei nihuta. */
  let cursor = null;
  let pages = 0;
  let truncated = false;
  let scannedRows = 0;

  for (;;) {
    if (pages >= maxPages) {
      truncated = true;
      break;
    }
    const page = await db.urgentRequest.findMany({
      where: cursor ? { ...where, id: { gt: cursor } } : where,
      orderBy: { id: "asc" },
      take: pageSize,
      // Valge nimekiri: koond ei tohi sisu isegi mällu lugeda. Kui keegi lisab
      // siia `situationVerbatim`-i, on leke tehtud enne, kui teda kuvatakse.
      // `id` ei ole sisu — ta on kursor.
      select: { id: true, authorId: true, municipalityId: true, sentAt: true }
    });
    pages += 1;
    if (!page.length) break;
    scannedRows += page.length;

    for (const row of page) {
      // Autorita kirje (kustutatud konto) ei saa kanda „eristuva inimese"
      // tähendust — teda ei saa teistest eristada ega temaga kokku lugeda.
      if (!row.authorId) continue;
      const sentAt = row.sentAt ? new Date(row.sentAt) : null;
      if (!sentAt || Number.isNaN(sentAt.getTime())) continue;

      overall.add(row.authorId);
      addPerson(byRegion, row.municipalityId, row.authorId);
      /* SOL-URG-11: kellaaeg on EESTI seinakell, mitte UTC. Raport räägib
         sellest, mis kell inimesed pöörduvad, ja „öö" on kogu funktsiooni mõte
         — suvel oleks UTC nihutanud iga öise pöördumise ämbri võrra valesti.
         Arvutus tuleb jagatud moodulist, mitte kohalikust `getHours()`-ist,
         mis loeks masina vööndit. */
      addPerson(byHourBucket, bucketForHour(zonedParts(sentAt).hour), row.authorId);
    }

    if (page.length < pageSize) break;
    cursor = page[page.length - 1].id;
  }

  let suppressedGroups = 0;
  const publish = (map) => {
    const out = [];
    for (const [key, people] of map.entries()) {
      if (people.size < minimumGroupSize) {
        suppressedGroups += 1;
        continue;
      }
      out.push({ key, people: people.size });
    }
    return out.sort((a, b) => b.people - a.people);
  };

  const regions = publish(byRegion);
  const hourBuckets = publish(byHourBucket);

  return {
    minimumGroupSize,
    // Kogusumma allub samale lävele: väike koguvalim on samamoodi tuvastatav.
    totalPeople: overall.size >= minimumGroupSize ? overall.size : null,
    totalSuppressed: overall.size < minimumGroupSize,
    regions,
    hourBuckets,
    suppressedGroups,
    /* SOL-URG-11: kärpimine on NÄHTAV. Sama põhimõte nagu `suppressedGroups`-il
       ja SOL-URG-01 `activeTruncated`-il: vaikne lõikamine loeb otsustaja jaoks
       nagu „katsime kõik", ja just see peitis siin inimesi ja piirkondi. */
    truncated,
    scannedRows,
    timeZone: AGGREGATE_TIME_ZONE
  };
}
