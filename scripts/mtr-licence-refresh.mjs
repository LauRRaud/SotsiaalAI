#!/usr/bin/env node
/**
 * A4 E6 — ajastatud loakontrolli korje.
 *
 * Käivitatakse cron'ist **kord tunnis** (`0 * * * *`). See EI tähenda, et iga
 * profiili kontrollitakse tunnis: korje võtab ainult need, mille `nextCheckAt`
 * on möödas — edukas kontroll paneb selle **14 päeva** ettepoole. Tunnine rütm
 * on vajalik selleks, et tõrkejärgsed 1 h ja 6 h korduskatsed päriselt
 * toimuksid; kord ööpäevas käiv korje ei tuleks neid kunagi õigel ajal vaatama.
 *
 * ÜKS EKSEMPLAR KORRAGA. Skript ise lukku ei võta — pika MTR-i tõrke korral
 * võib tunnine käivitus eelmisele otsa joosta. Ühe Linuxi serveri puhul
 * lahendab selle `flock`:
 *
 *   0 * * * * flock -n /var/lock/sotsiaalai-mtr-refresh.lock \
 *     /bin/bash -lc 'cd /RAKENDUSE/KAUST && MTR_REFRESH_BATCH=10 npm run mtr:refresh'
 *
 * Andmebaasilukk muutub kohustuslikuks alles siis, kui korje võib käivituda
 * mitmes serveris või konteineris, või kui sama täiskorje saab käivitada ka
 * adminiliidesest.
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
