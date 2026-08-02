/**
 * TEENUSPÄEVIK E9 — STAR / s-veebi valmidus.
 *
 * MIDA SEE ON JA MIDA TA EI OLE. Leping (E9) ütleb: „ekspordi andmekuju, mis
 * vastab STAR-i strateegia lubatud osutaja-liidestusele — „ekspordi" →
 * „edasta" ootab ainult riigi ust, meie pool valmis."
 *
 * MEIE POOL ON SIIN. Riigi poolt EI OLE: lepingu ptk 6a ütleb otse, et
 * „täpsed s-veebi väljad kontrollida ehituse ajal", ja avalikku välja-
 * kirjeldust, mille vastu valideerida, ei ole. Seepärast see moodul EI VÄIDA
 * vastavust ühelegi riiklikule skeemile — ta annab STABIILSE, VERSIONEERITUD
 * ja dokumenteeritud kuju meie enda andmetest, mille väljad on hiljem
 * kaardistatavad ilma andmemudelit puutumata.
 *
 * VALE VASTAVUSVÄIDE OLEKS SIIN TÕSISEM VIGA KUI PUUDUV FUNKTSIOON — sama
 * reegel, mille leping juba kord kirja pani kvaliteedijuhise meeldetuletuse
 * kohta („seda EI TOHI kuvada kui seadusest tulenevat nõuet"). `schemaVersion`
 * ja `mappingStatus` ütlevad selle vastuvõtjale välja.
 *
 * ISIKUANDMEID SIIN EI OLE. Statistika on koond: teenus, ühik, maht, unikaalne
 * kliendiarv. Nimesid, ID-sid ega suunamisnumbreid ei ole — riigi statistika ei
 * vaja neid ja nende kaasa panemine oleks minimeerimise rikkumine.
 */

import { TEMPLATE } from "./templates.js";

/**
 * Muutub AINULT siis, kui väljade tähendus muutub. Vastuvõtja peab saama
 * versiooni järgi otsustada, kas ta oskab faili lugeda.
 */
export const STAR_SCHEMA_VERSION = "sotsiaalai.service-log.statistics/1";

/**
 * `unverified` tähendab: kuju on meie oma ja riigi väljakirjeldusega EI OLE
 * kokku viidud. Kui kaardistus tehakse, muutub see väärtus — ja seni ei saa
 * keegi seda faili ekslikult riiklikuks esituseks pidada.
 */
export const STAR_MAPPING_STATUS = "unverified";

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * @param document `buildStatistics` väljund (mall D)
 * @returns JSON-ile serialiseeritav objekt
 */
export function buildStarPayload(document, { provider = {}, period = {}, generatedAt = null } = {}) {
  if (!document || document.template !== TEMPLATE.D_STATISTICS) {
    throw new TypeError("STAR-kuju ehitatakse mallist D (statistika)");
  }

  const rows = Array.isArray(document.rows) ? document.rows : [];

  return {
    schemaVersion: STAR_SCHEMA_VERSION,
    /* AUSUS ON OSA FAILIST, mitte ainult dokumentatsioonist: kes iganes selle
       faili avab, näeb kohe, et väljakaardistus on tegemata. */
    mappingStatus: STAR_MAPPING_STATUS,
    generatedAt: generatedAt || null,
    provider: {
      name: provider.name || null,
      registryCode: provider.registryCode || null
    },
    period: {
      from: period.from || null,
      to: period.to || null
    },
    totals: {
      /* Unikaalsed kliendid KOKKU, mitte teenuste kliendiarvude summa — sama
         inimene kahe teenusega loeks muidu kaks korda. */
      uniqueClients: Number(document.footer?.totalClients ?? 0),
      entries: Number(document.footer?.entryCount ?? 0),
      byUnit: { ...(document.footer?.totals || {}) }
    },
    services: rows.map((row) => ({
      service: row.service || null,
      unit: row.unit || null,
      quantity: round2(row.quantity),
      uniqueClients: Number(row.clientCount ?? 0)
    })),
    /* Hoiatused tulevad KAASA: kui väljavõttest jäi midagi välja (mustandid,
       tühistatud read), ei tohi see teadmine faili juurest kaduda. */
    warnings: Array.isArray(document.warnings) ? document.warnings : []
  };
}

export function starPayloadToJson(payload) {
  return JSON.stringify(payload, null, 2);
}
