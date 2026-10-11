#!/usr/bin/env node
/**
 * A4 E6 — ajastatud loakontrolli korje.
 *
 * Käivitab systemd taimer `sotsiaalai-mtr-refresh.timer` **kord ööpäevas** (kell 3.20;
 * failid kaustas `deploy/systemd`). See EI tähenda, et iga profiili kontrollitakse iga päev:
 * korje võtab ainult need, mille `nextCheckAt` on möödas. Edukas kontroll paneb selle
 * **30 päeva** ettepoole (omanik 10.10.2026: kontroll kord kuus); tõrke järel ja luba
 * esimest korda leidmata proovitakse uuesti järgmisel ööl. Esimene kontroll ei oota
 * korjet: ta käivitub kohe, kui inimene teenuse liigi kinnitab (`bindServiceKey`).
 *
 * ÜKS EKSEMPLAR KORRAGA. Skript ise lukku ei võta; taimeri teenus käivitab ta `flock -n`
 * taga (`/var/lock/sotsiaalai-mtr-refresh.lock`).
 *
 * Profiilid käiakse läbi ÜKSHAAVAL. Paralleelsust ei ole teadlikult: MTR on
 * aeglane avalik register, üks kontroll on kolm päringut, ja mõõdetud 05.08 —
 * kaks samaaegset otsingut ajasid mõlemad ajapiiri üle.
 *
 * Käivitamine:
 *   npm run mtr:refresh            (päris korje)
 *   npm run mtr:refresh -- --dry   (näita ainult, mis oleks küps)
 */

import { prisma } from "../lib/prisma.js";
import { dueProfiles, refreshDueLicenceChecks } from "../lib/mtr/refresh.js";

const dryRun = process.argv.includes("--dry") || process.argv.includes("--dry-run");

try {
  if (dryRun) {
    const due = await dueProfiles({ prisma });
    /* `dueProfiles` tagastab ÜHE partii, mitte kogu küpsete arvu — sõnastus
       peab seda ütlema, muidu loeb inimene siit vale koguarvu. */
    console.log(`[mtr:refresh] järgmises korjepartiis: ${due.length} profiili`);
    due.forEach((profile) => console.log(`  - ${profile.organizationName} (${profile.id})`));
  } else {
    const summary = await refreshDueLicenceChecks({
      prisma,
      onProgress: ({ profile, result }) => {
        const state = result?.succeeded ? "OK" : `UNCONFIRMED${result?.skipped ? ` (${result.skipped})` : ""}`;
        console.log(`  ${state.padEnd(24)} ${profile.organizationName}`);
      }
    });
    console.log(
      `[mtr:refresh] küpseid ${summary.due}, kontrollitud ${summary.checked}, ` +
        `õnnestus ${summary.succeeded}, ebaõnnestus ${summary.failed}`
    );
    for (const error of summary.errors) console.error(`  VIGA ${error.profileId}: ${error.message}`);
    /* `UNCONFIRMED` ei ole skripti viga — register lihtsalt ei vastanud, ja
       see on juba kirjes. Aga vaikida ka ei tohi: kõrge tõrkemäär läheb
       seiresse eraldi reana, et rikkis korje ei näeks välja nagu edukas. */
    if (summary.checked && summary.failed / summary.checked >= 0.5) {
      console.warn(`[mtr:refresh] ALARM: ${summary.failed}/${summary.checked} kontrolli ei kinnitanud midagi`);
    }
    if (summary.errors.length) process.exitCode = 1;
  }
} catch (error) {
  console.error("[mtr:refresh] korje kukkus:", error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
