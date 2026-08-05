#!/usr/bin/env node
/**
 * A4 E6 — ajastatud loakontrolli korje.
 *
 * Käivitatakse cron'ist (soovitus: kord ööpäevas). Korje ei käi kõiki
 * profiile läbi, vaid ainult neid, mille `nextCheckAt` on möödas — nii kulub
 * korduva tõrke korral vähem päringuid kui eduka raja korral.
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
    console.log(`[mtr:refresh] küpseid profiile: ${due.length}`);
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
    if (summary.errors.length) process.exitCode = 1;
  }
} catch (error) {
  console.error("[mtr:refresh] korje kukkus:", error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
