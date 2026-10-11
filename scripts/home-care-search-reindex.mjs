#!/usr/bin/env node
/**
 * KODUTEENUS K1-c — päeviku otsinguabi ülevärskendus.
 *
 * Kirje salvestub ka siis, kui morfoloogia ei vasta; siis on tal ainult sõnad ja
 * tüved (`searchVersion = "sb1"`) ja „võti" ei leia „võtme". See skript teeb
 * sellistele kirjetele otsinguabi uuesti, kui morfoloogia jälle töötab.
 *
 * Kasutus (rakenduse juurkaustas, rakenduse keskkonnaga):
 *   node --import ./scripts/register-node-source-loader.mjs scripts/home-care-search-reindex.mjs [--dry] [--all]
 *
 *   --dry  loeb ja loendab, ei kirjuta;
 *   --all  teeb uuesti kõik tühistamata kirjed, mitte ainult algvormideta.
 *
 * Väljund on AINULT arvud: kirje teksti ega kliendi nime ei trükita.
 */
import prisma from "../lib/prisma.js";
import { isHomeCareEnabled } from "../lib/homeCare/flags.js";
import { entrySearchText, SearchVersion } from "../lib/homeCare/search.js";

/* VÄRAV: väljas lipuga ei tee skript midagi (sama reegel mis teistel hooldustöödel). */
if (!isHomeCareEnabled()) {
  console.log(JSON.stringify({ skipped: "HOME_CARE_ENABLED is off" }));
  process.exit(0);
}

const dry = process.argv.includes("--dry");
const all = process.argv.includes("--all");
const BATCH = 50;

const counts = { read: 0, upgraded: 0, stemsWritten: 0, stillStems: 0, unchanged: 0 };
let cursor = null;

try {
  for (;;) {
    const rows = await prisma.careClientEntry.findMany({
      where: {
        retractedAt: null,
        ...(all ? {} : { OR: [{ searchVersion: null }, { searchVersion: SearchVersion.STEMS }] })
      },
      select: { id: true, text: true, incidentAssessment: true, searchText: true, searchVersion: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      counts.read += 1;
      const next = await entrySearchText([row.text, row.incidentAssessment]);
      const lemmas = next.searchVersion === SearchVersion.LEMMAS;
      /* Morfoloogia ei vastanud: kirje, millel otsinguabi juba on, jääb nii.
         Kirje, millel seda üldse ei ole (salvestatud enne otsingu lisamist),
         saab vähemalt sõnad ja tüved, et ta oleks leitav. */
      if (!lemmas && row.searchText) {
        counts.stillStems += 1;
        continue;
      }
      if (next.searchText === row.searchText && next.searchVersion === row.searchVersion) {
        counts.unchanged += 1;
        continue;
      }
      if (!dry) {
        /* Ainult otsinguabi; kirje sisu, versiooni ega muutmisjälge see ei puuduta. */
        await prisma.careClientEntry.updateMany({
          where: { id: row.id, retractedAt: null },
          data: { searchText: next.searchText, searchVersion: next.searchVersion }
        });
      }
      if (lemmas) counts.upgraded += 1;
      else counts.stemsWritten += 1;
    }
  }
  console.log(JSON.stringify({ dry, all, ...counts }));
  if (counts.stillStems + counts.stemsWritten > 0) {
    console.error("[home-care-search-reindex] morfoloogia ei vastanud osale kirjetest; need jäid tüvedega");
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
