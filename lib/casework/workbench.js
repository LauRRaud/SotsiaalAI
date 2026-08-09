/**
 * JTA-V1 (E1) — juhtumitöö assistendi laua koondlugeja.
 *
 * Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v5), etapp E1.
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
 *   L20 — VASTUS ON DESKRIPTOR, MITTE ANDMEBAASI RIDA. Lauda toidab kaheksa
 *        allikat ja E2 saadab tema vastuse brauserisse. Kui sektsioon annaks
 *        lugeja rea edasi „nagu on", määraks laua avaliku kuju see, mis
 *        juhtumisi seisab mudelis — ja iga uus veerg ilmuks API-sse ilma, et
 *        keegi oleks seda otsustanud. Iga sektsioon kirjutab oma välja VÄLJA
 *        NIMELISELT (vt `*Descriptor`). See ei ole omanikupiir — see on
 *        andmete minimeerimine ja ründepinna piir.
 */

import { estonianDayBounds } from "@/lib/time/estonianDay";
import { listWorkerActionableShares } from "@/lib/network/share";
import { listTopicSeeds } from "@/lib/topicSeeds";
import { listPracticeReflectionWorkspaces } from "@/lib/workspaces/adapters/practiceReflectionAdapter";
import { listReceivedCaseWork } from "@/lib/workspaces/adapters/preInquiryReceiverAdapter";

import { listUpcomingContacts } from "./caseWorkAssist.js";
import { listDraftsAwaitingTransfer } from "./caseWorkDraft.js";
import { listActiveMeetingPrepsForOwner } from "./caseWorkMeetingPrep.js";
import { countOpenMissingInfoByCase, listOpenMissingInfoForOwner } from "./caseWorkMissingInfo.js";
import { listTransferEventsForOwner } from "./caseWorkTransfer.js";
import { isCaseWorkEnabled } from "./flags.js";
import { workbenchDb } from "./workbenchDb.js";
import { WORKBENCH_SECTION_DEADLINE_MS } from "./workbenchLimits.js";

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
 * JÄRJEKORD ON L12 TABELI OMA (1–10), mitte tekkimise oma: `draftsAwaitingTransfer`
 * (#4) ja `transferHistory` (#10) lisandusid E6-s ja seisavad seal, kus tabel
 * neid nõuab. Enne seda ei olnud nad tühjad — neid EI OLNUD (L2 viimane rida).
 */
export const WORKBENCH_SECTIONS = Object.freeze([
  "receivedPreInquiries",
  "todaysContacts",
  "activePreparations",
  "draftsAwaitingTransfer",
  "openMissingInfo",
  "upcomingContacts",
  "networkPreparation",
  "practiceReflection",
  "covisionPreparation",
  "transferHistory"
]);

/**
 * L13. Konstant, mitte maagiline number — test kirjutab ta üle.
 *
 * Ta ELAB `workbenchLimits.js`-is, sest sama arv peab kehtima ka andmebaasi
 * `statement_timeout`-ina (SOL-CW-18) ja kaks kirjapanekut läheksid vaikselt
 * lahku. Siit ta on edasi antud, et lepingu lugeja leiaks ta sealt, kus ta
 * alati oli.
 */
export { WORKBENCH_SECTION_DEADLINE_MS };

/** Rollid, kellel laud üldse olla saab. Sama loend mis `routes.js`-is. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

const LIST_LIMIT = 25;

/* ────────────────────────────────────────────────────────────────────────────
   DESKRIPTORID (L20)

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

/**
 * #3 — KOHTUMISE ETTEVALMISTUS, mitte juhtum (SOL-CW-13).
 *
 * `meetingAt`, mitte `nextContactAt`: sektsiooni ajaline prioriteet on
 * kohtumise oma. `nextContactAt` on juhtumi järgmine kontakt ja teda kuvavad
 * juba #2 ja #6 — siin tähendaks ta, et kaks eri kella näitavad ühel real ühte
 * aega. Lahtiste punktide arv on SELLE juhtumi oma, mitte skoor (L3).
 *
 * Ettevalmistuse SISU (eesmärk, päevakord, küsimused) laual EI OLE: seal on
 * kliendi tekst ja laud ütleb ainult „see ootab sinu tegu".
 */
function preparationDescriptor(row, openMissingInfoCount) {
  return {
    prepId: row.id,
    caseId: row.caseWorkAssistId,
    label: row.label,
    meetingAt: row.meetingAt || null,
    openMissingInfoCount
  };
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

/**
 * #4 — mustand, mis on STAR2 teel. SISU EI OLE LAUAL: `CaseWorkDraftField` read
 * kannavad kliendi teksti ja laud ütleb ainult „see ootab sinu tegu". Tüüp ja
 * seis on i18n-võtmed, mitte renderdatav andmebaasitekst.
 */
function draftDescriptor(row) {
  return {
    draftId: row.id,
    caseId: row.caseWorkAssistId,
    draftType: row.draftType,
    transferState: row.transferState,
    reviewKind: row.reviewKind || null,
    updatedAt: row.updatedAt || null
  };
}

/**
 * #10 — ülekandeauditi rida. `fieldKeys` EI KÄI KAASA: laual ei ole nendega
 * midagi teha ja väljade loend on ülekande enda vaate asi (L20 valge nimekiri
 * on kitsam kui allika oma, mitte sama).
 */
function transferEventDescriptor(row) {
  return {
    eventId: row.id,
    caseId: row.caseWorkAssistId,
    draftId: row.draftId,
    kind: row.kind,
    draftType: row.draftType,
    createdAt: row.createdAt || null
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
 * PostgreSQL `57014 query_canceled` — `statement_timeout` lõpetas päringu.
 *
 * MÕÕDETUD, MITTE OLETATUD (Prisma 7 + `@prisma/adapter-pg`): erind on
 * `PrismaClientKnownRequestError` koodiga `P2010` ja päris põhjus seisab
 * `meta.driverAdapterError.cause`-is. Teate TEKSTI järgi siin ei otsustata —
 * tekst on lokaliseeritav, versiooniti muutuv ja võib kanda päringu argumente.
 */
function isStatementTimeout(error) {
  const driver = error?.meta?.driverAdapterError?.cause;
  return driver?.code === "57014" || driver?.originalCode === "57014";
}

/**
 * L13 — üks sektsioon, üks tähtaeg.
 *
 * TÄHTAEG ON NÜÜD PÄRIS (SOL-CW-18). Varem katkestas `Promise.race` ainult
 * OOTAMISE ja algne päring jooksis edasi — üks HTTP vastus võis jätta kuni
 * kümme tööd ühendusi ja CPU-d kasutama. Päris katkestuse annab andmebaas ise:
 * laua pesa kannab `statement_timeout`-i (`workbenchDb.js`) ja PostgreSQL
 * lõpetab backend'i töö serveri pool.
 *
 * KAKS TEED, ÜKS OLEK. Andmebaasi katkestus (`57014`) ja JS-tähtaeg annavad
 * MÕLEMAD `TIMEOUT`-i. Kui katkestus annaks `ERROR`-i, sõltuks kasutaja nähtav
 * olek sellest, kumb millisekund võitis — sama aeglus näeks kord ühtemoodi,
 * kord teistmoodi välja.
 *
 * JS-RATSA JÄÄB ALLES BACKSTOP'IKS: ta katab selle, mida `statement_timeout` ei
 * kata — rippumise, mis EI OLE päring (adapter, mis ei vasta, või lugeja, mis
 * ootab midagi muud). `source` logis eristab neid kaht, sest pärast seda
 * parandust tähendab `deadline` hoopis teist viga kui `database`.
 *
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
    if (result === SECTION_STATE.TIMEOUT) {
      /* MITTE-PÄRINGU rippumine. Pärast SOL-CW-18 on see haruldane ja tähendab
         midagi muud kui aeglane andmebaas — seepärast on ta logis eraldi. */
      console.warn("[casework/workbench] section deadline", { section: key, source: "deadline" });
      return section(SECTION_STATE.TIMEOUT);
    }
    if (result.ok) return result.value;

    if (isStatementTimeout(result.error)) {
      /* Ootuspärane, aga MITTE vaikimist väärt: „laud on aeglane" on seis, mille
         kohta peab saama küsida. Ainult konstandid, nagu allpool. */
      console.warn("[casework/workbench] section deadline", { section: key, source: "database" });
      return section(SECTION_STATE.TIMEOUT);
    }

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
 * `deadlineMs` on JS-backstop'i tähtaeg ja testi õmblus. ANDMEBAASI tähtaeg
 * seda EI JÄRGI — `statement_timeout` seatakse pesa loomisel ja tema väärtus on
 * lepingu konstant. See asümmeetria on teadlik: pesa ümberseadmine päringu kohta
 * tähendaks ühendust päringu kohta ja oleks omaette koormus.
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
  db: injectedDb = null
} = {}) {
  const owner = typeof userId === "string" && userId.trim() ? userId.trim() : "";
  const role = roleState?.effectiveRole || "";

  /* L14: tühi tulemus, MITTE erind. Ja see ei ole turvakontroll — värav on
     `guardCaseWorkRequest()`. Siin on ta ainult selleks, et teek ei plahvataks. */
  if (!owner || !isCaseWorkEnabled() || !WORKER_ROLES.has(role)) {
    return emptyWorkbench(now);
  }

  /* KLIENT LAHENDATAKSE ALLES SIIN, mitte vaikeväärtusena: vaikeväärtus
     hinnatakse iga kutse peale ja avaks ühendustepesa ka väljas värava ning
     rollita kutse jaoks — pesa funktsiooni jaoks, mida ei ole olemas.

     NIMI JÄÄB `db`-ks meelega: iga sektsioon annab kliendi lugejale edasi ja
     üksainus ümber nimetamata kutsekoht tähendaks vaikselt JAGATUD klienti —
     ilma statement-timeout'ita, ehk täpselt seda viga tagasi. */
  const db = injectedDb || workbenchDb();

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

    /* #3 AKTIIVSED ETTEVALMISTUSTÖÖD (leping L12) — nüüd PÄRISELT
       `CaseWorkMeetingPrep`, mitte aktiivsete juhtumite loend (SOL-CW-13).

       E1-s ei olnud ettevalmistuse mudelit veel olemas ja sektsioon kuvas
       aktiivseid juhtumeid koos `preparations_not_yet` hoiatusega. E3 tõi mudeli
       ja API, aga sektsioon jäi vana kuju peale: laud nimetas iga aktiivse
       juhtumi ettevalmistustööks. Hoiatus kadus koos põhjusega — ta ütles
       „need on juhtumid", mis ei ole enam tõsi.

       PIIR ON PÄEVA ALGUS, mitte `now`: täna kell 09:00 algav kohtumine peab
       jääma laual seisma terveks päevaks. `day` on sama Eesti kalendripäev,
       mille peal seisab #2. */
    activePreparations: async () => {
      const [{ items }, counts] = await Promise.all([
        listActiveMeetingPrepsForOwner({ ownerUserId: owner, from: day.start, limit: LIST_LIMIT, db }),
        countOpenMissingInfoByCase({ ownerUserId: owner, db })
      ]);
      const rows = items.map((row) => preparationDescriptor(row, counts.get(row.caseWorkAssistId) || 0));
      return settled(rows);
    },

    /* #4 STAR2-sse KANDMIST OOTAVAD MUSTANDID (E5 mudel, E6 laud). */
    draftsAwaitingTransfer: async () => {
      const { items } = await listDraftsAwaitingTransfer({ ownerUserId: owner, limit: LIST_LIMIT, db });
      return settled(items.map(draftDescriptor));
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

    covisionPreparation: async () => settled((await listTopicSeeds(owner, { db })).map(topicSeedDescriptor)),

    /* #10 STAR2 ÜLEKANDMISE AJALUGU. SEE EI OLE LOENDUR (L3): sektsioon kannab
       viimaseid tegusid, mitte nende arvu, keskmist ega võrdlust eelmise
       perioodiga. „Sina kandsid sel kuul üle 14" oleks koormuse mõõdik ja just
       siin tekiks ta kogemata kõige lihtsamini. */
    transferHistory: async () => {
      const { items } = await listTransferEventsForOwner({ ownerUserId: owner, limit: LIST_LIMIT, db });
      return settled(items.map(transferEventDescriptor));
    }
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
