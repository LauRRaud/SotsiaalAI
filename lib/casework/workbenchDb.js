/**
 * JTA-V1 (E2) / SOL-CW-18 — laua OMA ühendustepesa päris statement-timeout'iga.
 *
 * MIDA SEE FAIL LAHENDAB. Laud käivitas kümme sektsiooni `Promise.race`-is ja
 * 2,5 s peal tagastas `TIMEOUT` — aga **algne päring jooksis edasi**. Aeglase
 * andmebaasi korral jättis üks HTTP vastus kuni kümme tööd ühendusi ja CPU-d
 * kasutama; korduvad värskendused kuhjasid nähtamatu taustakoormuse just tõrke
 * ajal, mil süsteem on juba aeglane. JS-i `Promise.race` EI KATKESTA MIDAGI —
 * ta ainult lõpetab OOTAMISE.
 *
 * MIKS ANDMEBAASI POOLT. Prisma ei võta päringule `AbortSignal`-it; päris
 * katkestus saab tulla ainult PostgreSQL-i enda `statement_timeout`-ist, mis
 * lõpetab backend'i töö serveri pool. Kõik muu on lubadus.
 *
 * MIKS OMA PESA, MITTE `SET LOCAL` ÜHISES PESAS. `SET LOCAL` kehtib ainult
 * tehingus, seega iga sektsioon vajaks interaktiivset tehingut — **kümme
 * tehingut kinnitaks kümme ühendust** ja `pg` vaikepesa on täpselt kümme. Üks
 * laua päring võiks lukustada terve rakenduse pesa: halvem viga kui see, mida
 * parandame. Oma pesa annab tähtaja ILMA tehinguteta ja ühtlasi kõva ülempiiri —
 * ammendunud laua-pesa ei puuduta ühtegi teist rada.
 *
 * `query_timeout` EI KÕLBA siia: node-postgres'i `query_timeout` lükkab
 * lubaduse tagasi KLIENDI pool ja server jätkab päringut edasi — see on täpselt
 * see viga, mida leid kirjeldab, ainult teise nime all.
 */

import { PrismaPg } from "@prisma/adapter-pg";

/* Import on ka SÕLTUVUS: `lib/prisma.js` laeb `.env`-i. Ilma temata võib
   `process.env.DATABASE_URL` olla siin veel lugemata ja pesa jääks ehitamata
   põhjusel, millel ei ole koodiga mingit pistmist. */
import sharedPrisma from "@/lib/prisma";

import { PrismaClient } from "../../generated/prisma/client.ts";
import { WORKBENCH_DB_POOL_MAX, WORKBENCH_SECTION_DEADLINE_MS } from "./workbenchLimits.js";

/**
 * `pg_stat_activity.application_name`. SEE EI OLE KAUNISTUS: ilma temata ei saa
 * tõendada, et laua backend on pärast vastust KADUNUD — ja just seda nõuab
 * SOL-CW-18 vastuvõtukriteerium. Sond otsib täpselt seda nime.
 */
export const WORKBENCH_APPLICATION_NAME = "sotsiaalai-casework-workbench";

const globalForWorkbench = globalThis;

export function workbenchPoolConfig(connectionString) {
  return {
    connectionString,
    application_name: WORKBENCH_APPLICATION_NAME,

    /* PÄRIS TIMEOUT. PostgreSQL katkestab päringu ise ja vabastab backend'i.
       Sama arv mis sektsiooni tähtaeg: päring ei tohi elada üle lubaduse. */
    statement_timeout: WORKBENCH_SECTION_DEADLINE_MS,

    /* Laud on LUGEJA (L1) ega ava tehinguid. See piir on kindlustus selle
       vastu, et keegi kunagi ühe avab ja unustab: rippuv tehing hoiaks lukke. */
    idle_in_transaction_session_timeout: WORKBENCH_SECTION_DEADLINE_MS,

    max: WORKBENCH_DB_POOL_MAX,

    /* AMMENDUNUD PESA EI TOHI OODATA IGAVESTI. `pg` vaikimisi ootab vaba
       ühendust lõputult — see oleks uus rippumise rada täpselt seal, kus me
       rippumist parandame. Ootamine mahub sektsiooni tähtaja sisse. */
    connectionTimeoutMillis: WORKBENCH_SECTION_DEADLINE_MS
  };
}

function createWorkbenchClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    /* AUS DEGRADATSIOON, MITTE KATKESTUS: ilma `DATABASE_URL`-ita ei tööta
       niikuinii mitte miski, ja 500 laual ei ütleks seda paremini. Aga see rada
       kaotab statement-timeout'i, seega ta ÜTLEB END VÄLJA — vaikne tagasilangus
       taastaks SOL-CW-18 nähtamatult. */
    console.error("[casework/workbench] DATABASE_URL puudub — laud kasutab jagatud klienti ILMA statement-timeout'ita");
    return sharedPrisma;
  }

  return new PrismaClient({
    adapter: new PrismaPg(workbenchPoolConfig(connectionString)),
    log: ["error"]
  });
}

/**
 * Laua klient. LAISK ja mälustatud — moodul laaditakse ka siis, kui värav on
 * väljas ja ühtegi päringut ei tule; pesa loomine impordi ajal avaks ühendused
 * funktsiooni jaoks, mida ei ole olemas.
 */
export function workbenchDb() {
  if (!globalForWorkbench.__caseWorkWorkbenchDb) {
    globalForWorkbench.__caseWorkWorkbenchDb = createWorkbenchClient();
  }
  return globalForWorkbench.__caseWorkWorkbenchDb;
}
