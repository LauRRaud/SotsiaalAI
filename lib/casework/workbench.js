/**
 * JTA-V1 (E1) — juhtumitöö assistendi laua koondlugeja.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v4), etapp E1.
 * Kirjeldus: `ideed.md` ptk 4.3.
 *
 * VIIS REEGLIT, MIS ON SIIN ARHITEKTUUR, MITTE STIIL:
 *
 *   L1 — LAUD ON LUGEJA, MITTE TEINE TÕDE. Siin ei salvestata ühtegi rida ega
 *        hoita vahemälu. Laud, mis hoiab oma koopiat loenduritest, hakkab
 *        allikast lahku minema; esimene kord, kui laud ütleb „3 puudu" ja
 *        juhtum ütleb „2 puudu", ei usu töötaja enam kumbagi.
 *
 *   L3 — LAUD EI LOENDA TÖÖTAJAT. Ei mahajäämust, ei keskmist lahendusaega, ei
 *        „X üle tähtaja" märgist, ei võrdlust eelmise perioodiga. Ptk 8.8 keeld
 *        („ei tohi kasutada töötajate hindamiseks") peab olema ARHITEKTUURIS —
 *        ja laud on täpselt see koht, kus koormuse mõõdik tekiks kogemata,
 *        sest ta juba loeb kõik allikad kokku.
 *
 *   L10 — SIIN EI OLE ÜHTEGI `prisma.*` KUTSET. Iga sektsioon kutsub
 *        omaniku-mooduli lugejat, mis kannab skoopi juba täna. 04.08 IDOR
 *        tekkis täpselt vastupidisest: koondvaade tegi oma päringu ja unustas
 *        skoobi. Seda tõendab test, mitte see kommentaar.
 *
 *   L13 — IGAL SEKTSIOONIL ON TÄHTAEG. `Promise.allSettled` üksi lahendab
 *        vea-isolatsiooni, aga MITTE aeglust: 40 sekundit kestev päring paneks
 *        laua 40 sekundiks ootama. Iga lugeja on `Promise.race`-is tähtajaga.
 *
 *   L14 — SEE FUNKTSIOON EI OLE TURVAPIIR. Rollita või tundmatu kutse annab
 *        tühjad sektsioonid, mitte erindi — teeki võib kutsuda mujalt ja erind
 *        sunniks iga kutsuja `try`-sse. Turvapiir on `guardCaseWorkRequest()`.
 *
 *   L1a — VASTUS ON DESKRIPTOR, MITTE ANDMEBAASI RIDA. Lauda toidab kaheksa
 *        allikat ja E2 saadab tema vastuse brauserisse. Kui sektsioon annaks
 *        lugeja rea edasi „nagu on", määraks laua avaliku kuju see, mis
 *        juhtumisi seisab mudelis — ja iga uus veerg ilmuks API-sse ilma, et
 *        keegi oleks seda otsustanud. Iga sektsioon kirjutab oma välja VÄLJA
 *        NIMELISELT (vt `*Descriptor`). See ei ole omanikupiir — see on
 *        andmete minimeerimine ja ründepinna piir.
 */

import prismaClient from "@/lib/prisma";

import { estonianDayBounds } from "@/lib/time/estonianDay";
import { listWorkerActionableShares } from "@/lib/network/share";
import { listTopicSeeds } from "@/lib/topicSeeds";
import { listPracticeReflectionWorkspaces } from "@/lib/workspaces/adapters/practiceReflectionAdapter";
import { listReceivedCaseWork } from "@/lib/workspaces/adapters/preInquiryReceiverAdapter";

import { listCaseWorkAssists, listUpcomingContacts, RETENTION_STATE } from "./caseWorkAssist.js";
import { countOpenMissingInfoByCase, listOpenMissingInfoForOwner } from "./caseWorkMissingInfo.js";
import { isCaseWorkEnabled } from "./flags.js";

/**
 * Sektsiooni olek (leping L2). Viies olek — „funktsiooni ei ole" — EI OLE siin
 * väärtus: sellisel juhul sektsiooni lihtsalt ei ole vastuses. Tühi kast ja
 * „selle jaoks ei ole veel tööriista" näevad ühesugused välja, aga tähendavad
 * vastupidist, ja `EMPTY` väärtus nende jaoks hägustaks just selle vahe.
 */
export const SECTION_STATE = Object.freeze({
  OK: "OK",
  EMPTY: "EMPTY",
  FORBIDDEN: "FORBIDDEN",
  TIMEOUT: "TIMEOUT",
  ERROR: "ERROR"
});

/**
 * L12 kanoonilise tabeli võtmed. Loend on siin selleks, et test saaks kontrollida
 * vastuse KUJU, mitte ainult sisu — puuduv sektsioon on sama viga mis vale sisu.
 *
 * `draftsAwaitingTransfer` (#4) ja `transferHistory` (#10) PUUDUVAD teadlikult:
 * nad sünnivad E5-s ja E6-s. Kuni selleta ei ole nad tühjad — neid ei ole.
 */
export const WORKBENCH_SECTIONS = Object.freeze([
  "receivedPreInquiries",
  "todaysContacts",
  "activePreparations",
  "openMissingInfo",
  "upcomingContacts",
  "networkPreparation",
  "practiceReflection",
  "covisionPreparation"
]);

/** L13. Konstant, mitte maagiline number — test kirjutab ta üle. */
export const WORKBENCH_SECTION_DEADLINE_MS = 2500;

/** Rollid, kellel laud üldse olla saab. Sama loend mis `routes.js`-is. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

const LIST_LIMIT = 25;

/* ────────────────────────────────────────────────────────────────────────────
   DESKRIPTORID (L1a)

   VALGE NIMEKIRI, MITTE KUSTUTAMINE. Iga kuju on kirjutatud väljade kaupa,
   sest „võta rida ja eemalda tundlikud väljad" on nimekiri, mis vananeb —
   uus veerg mudelis ei lisa end kustutusnimekirja, aga lisab end vastusesse.
   Sama põhjendus kannab `recipientProjection()`-it `lib/network/share.js`-is.

   Mida siit VÄLJA jäetakse ja miks: kliendi identiteet (`clientUserId`,
   `clientDisplayName`, `clientExternalRef`) on juba `label`-i sees lahendatud
   ja LEPITUD kujul (L10) — toorväli annaks sama info teist korda ja mööda
   kuvanime reeglist. `preInquiryId` \ `urgentRequestId` \ `externalReference`
   on juhtumi SISEMISED viited; laual ei ole nendega midagi teha ja nad
   seovad juhtumi menetlusega, mille tunnus ise on isikuandmetega seotud.
   ──────────────────────────────────────────────────────────────────────────── */

/** #2 ja #6 — kontaktikaart: kes ja millal. */
function contactDescriptor(row) {
  return {
    caseId: row.id,
    label: row.label,
    nextContactAt: row.nextContactAt || null
  };
}

/** #3 — sama kuju + lahtiste punktide arv (L3: SELLE juhtumi oma, mitte skoor). */
function preparationDescriptor(row, openMissingInfoCount) {
  return { ...contactDescriptor(row), openMissingInfoCount };
}

/** #5 — punkt ise on sektsiooni mõte, seega tekst jääb; staatus on alati OPEN. */
function missingInfoDescriptor(row) {
  return {
    itemId: row.id,
    caseId: row.caseWorkAssistId,
    text: row.text,
    provenance: row.provenance,
    createdAt: row.createdAt || null
  };
}

/**
 * #7 — jagamise kaart. `summaryText`, `purpose` ja `sharingBoundary` on
 * KLIENDI SISU ja neid ei ole laual vaja: laud ütleb „see ootab sinu tegu",
 * sisu avaneb jagamise enda vaates.
 */
function shareDescriptor(row) {
  return {
    shareId: row.id,
    status: row.status,
    updatedAt: row.updatedAt || null
  };
}

/** #9 — teemaseeme: pealkiri identifitseerib, `whyNow` ja jagatud kaart ei käi kaasa. */
function topicSeedDescriptor(row) {
  return {
    seedId: row.id,
    title: row.title ?? null,
    status: row.status,
    updatedAt: row.updatedAt || null
  };
}

function section(state, items = [], notice = null) {
  return { state, items, notice };
}

function settled(items, notice = null) {
  const rows = Array.isArray(items) ? items : [];
  return rows.length ? section(SECTION_STATE.OK, rows, notice) : section(SECTION_STATE.EMPTY, [], notice);
}

/**
 * L13 — üks sektsioon, üks tähtaeg.
 *
 * AEGUNUD PÄRINGUT EI KATKESTATA andmebaasi tasemel ja see on teadlik: V1-s ei
 * ole päringu tühistamise taristut ja selle ehitamine on omaette töö. Tagajärg
 * on aus — aegunud sektsioon ei blokeeri kasutajat, aga koormus jääb.
 * `unhandledRejection` väldib eraldi `.catch()`.
 */
async function withDeadline(key, load, deadlineMs) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(SECTION_STATE.TIMEOUT), deadlineMs);
  });

  try {
    const task = Promise.resolve()
      .then(load)
      .then((value) => ({ ok: true, value }))
      .catch((error) => ({ ok: false, error }));

    const result = await Promise.race([task, timeout]);
    if (result === SECTION_STATE.TIMEOUT) return section(SECTION_STATE.TIMEOUT);
    if (result.ok) return result.value;

    /* Veateadet EI panda vastusesse EGA LOGISSE.
       `error.message` võib kanda päringu või kirje sisu — Prisma paneb
       ebaõnnestunud päringu argumendid teatesse ja mõni teenuskiht kirjutab
       sinna kirje teksti. Vastusesse mittepanek hoiab ta HTTP-st eemal, aga
       logimine tõstaks sama isikuandme serverilogisse, mille säilitus ja
       ligipääs on hoopis teine režiim. Logi kannab seepärast ainult neid
       välju, mis on sisu poolest KONSTANDID: sektsiooni võti, erindi klass ja
       masinloetav kood (`P2002`, `casework.errors.*`). */
    console.error("[casework/workbench] section failed", {
      section: key,
      error: result.error?.name || "Error",
      code: result.error?.code || result.error?.messageKey || null
    });
    return section(SECTION_STATE.ERROR);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Laua koond.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {{ effectiveRole?: string }} [input.roleState]
 * @returns {Promise<{ sections: object, generatedAt: string }>}
 */
export async function getCaseWorkbench({
  userId,
  roleState = null,
  now = new Date(),
  deadlineMs = WORKBENCH_SECTION_DEADLINE_MS,
  db = prismaClient
} = {}) {
  const owner = typeof userId === "string" && userId.trim() ? userId.trim() : "";
  const role = roleState?.effectiveRole || "";

  /* L14: tühi tulemus, MITTE erind. Ja see ei ole turvakontroll — värav on
     `guardCaseWorkRequest()`. Siin on ta ainult selleks, et teek ei plahvataks. */
  if (!owner || !isCaseWorkEnabled() || !WORKER_ROLES.has(role)) {
    return emptyWorkbench(now);
  }

  const day = estonianDayBounds(now);

  const loaders = {
    /* K1 adapter tagastab JUBA deskriptori (`assertWorkspaceDescriptor`) ja
       tema kuju on kontrollitud oma lepinguga — teine kaardistus siin tekitaks
       kaks tõde selle kohta, mis on tööruumi kirje. */
    receivedPreInquiries: async () => settled(await listReceivedCaseWork(owner, { db })),

    /* #2 TÄNASED: kontaktid tänase Eesti kalendripäeva sees. */
    todaysContacts: async () => {
      const { items } = await listUpcomingContacts({
        ownerUserId: owner,
        from: day.start,
        until: day.end,
        limit: LIST_LIMIT,
        db
      });
      return settled(items.map(contactDescriptor));
    },

    /* #3 AKTIIVSED ETTEVALMISTUSTÖÖD — E1-s KITSENDATUD KUJUL (leping L12).
       Ettevalmistustöö on `CaseWorkMeetingPrep`, mis sünnib E3-s. Kuni selleta
       kuvab sektsioon aktiivseid juhtumeid ja ÜTLEB SEDA VÄLJA. `notice` käib
       kaasa ka siis, kui ridu on — muidu näeks töötaja täit loendit ja arvaks,
       et ettevalmistused ongi need. */
    activePreparations: async () => {
      const [{ items }, counts] = await Promise.all([
        listCaseWorkAssists({
          ownerUserId: owner,
          retentionState: RETENTION_STATE.ACTIVE,
          limit: LIST_LIMIT,
          db
        }),
        countOpenMissingInfoByCase({ ownerUserId: owner, db })
      ]);
      const rows = items.map((row) => preparationDescriptor(row, counts.get(row.id) || 0));
      return settled(rows, "casework.workbench.preparations_not_yet");
    },

    openMissingInfo: async () => {
      const { items } = await listOpenMissingInfoForOwner({ ownerUserId: owner, limit: LIST_LIMIT, db });
      return settled(items.map(missingInfoDescriptor));
    },

    /* #6 EESOOTAVAD: homsest edasi. Piir on `day.end`, seega #2-ga ei kattu. */
    upcomingContacts: async () => {
      const { items } = await listUpcomingContacts({
        ownerUserId: owner,
        from: day.end,
        limit: LIST_LIMIT,
        db
      });
      return settled(items.map(contactDescriptor));
    },

    /* Võrgustikutöö on töötaja tegevus. Teenuseosutaja rollis lauda ei ole —
       `FORBIDDEN`, mitte `EMPTY`: tühi loend väidaks, et tal ei ole midagi
       ootel, kuigi tegelikult ei ole tal seda tööriista. */
    networkPreparation: async () => {
      if (role !== "SOCIAL_WORKER") return section(SECTION_STATE.FORBIDDEN, [], "casework.workbench.network_worker_only");
      const rows = await listWorkerActionableShares({ prisma: db, workerId: owner, limit: LIST_LIMIT });
      return settled(rows.map(shareDescriptor));
    },

    /* Ka see on juba K1 deskriptor — vt `receivedPreInquiries`. */
    practiceReflection: async () => settled(await listPracticeReflectionWorkspaces(owner, { db })),

    covisionPreparation: async () => settled((await listTopicSeeds(owner, { db })).map(topicSeedDescriptor))
  };

  const keys = WORKBENCH_SECTIONS;
  const results = await Promise.all(keys.map((key) => withDeadline(key, loaders[key], deadlineMs)));

  const sections = {};
  keys.forEach((key, index) => {
    sections[key] = results[index];
  });

  return { sections, generatedAt: new Date(now).toISOString() };
}

/** Kõik sektsioonid `EMPTY`. Kuju on sama — kutsuja ei pea kaht juhtu eristama. */
function emptyWorkbench(now) {
  const sections = {};
  for (const key of WORKBENCH_SECTIONS) sections[key] = section(SECTION_STATE.EMPTY);
  return { sections, generatedAt: new Date(now).toISOString() };
}
