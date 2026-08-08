#!/usr/bin/env node
/**
 * JTA-V1 (E7) — säilituse käivitaja.
 *
 * OTSUS ILMA KÄIVITAJATA EI OLE SÄILITUSREEGEL. L7 ütleb, mis peab juhtuma;
 * see fail on koht, kus see päriselt juhtub. Kogu loogika elab
 * `lib/casework/retention.js`-is ja on testitud — siin on ainult käivitus,
 * väljund ja väljumiskood.
 *
 * KOLM TÖÖD, ÜKS KÄIVITUS:
 *   1. ülekantud mustandi SISU kustub 12 kuud pärast ülekannet
 *   2. arhiveeritud juhtumi omanik saab hoiatuse 30 päeva enne kustutust
 *   3. arhiveeritud juhtum kustub 12 kuud pärast arhiveerimist, kaskaadis
 *
 * VÄRAV: `CASEWORK_V1_ENABLED` väljas → 0 tööd. Väljas funktsioon ei kustuta
 * kellegi andmeid „taustal juba igaks juhuks".
 *
 * Käivitamine:
 *   npm run casework:retention        päriselt
 *   npm run casework:retention:dry    ainult loendab, ei kirjuta
 *
 * Cron (sama `flock`-muster mis A4-l — kaks korraga käivitunud partiid
 * võitleksid samade ridade pärast ja teine kirjutaks esimese tulemuse üle):
 *
 *   15 3 * * * flock -n /var/lock/sotsiaalai-casework-retention.lock \
 *     /bin/bash -lc 'cd /home/ubuntu/apps/sotsiaalai && npm run casework:retention' \
 *     >> /var/log/sotsiaalai/casework-retention.log 2>&1
 */

import { prisma } from "../lib/prisma.js";
import { runRetention } from "../lib/casework/retention.js";

const dryRun = process.argv.includes("--dry-run") || process.env.CASEWORK_RETENTION_DRY_RUN === "1";
const batch = Number(process.env.CASEWORK_RETENTION_BATCH || 50);

const startedAt = new Date();

try {
  const result = await runRetention({ now: startedAt, batch, dryRun, db: prisma });

  const stamp = startedAt.toISOString();
  if (result.disabled) {
    console.log(`[casework:retention] ${stamp} värav väljas (CASEWORK_V1_ENABLED) — 0 tööd`);
  } else {
    console.log(
      [
        `[casework:retention] ${stamp}${result.dryRun ? " (kuiv käivitus)" : ""}`,
        `mustandeid purge'itud: ${result.draftsPurged}`,
        `välju kustutatud: ${result.draftFieldsDeleted}`,
        `hoiatusi saadetud: ${result.warningsSent}`,
        `juhtumeid kustutatud: ${result.casesDeleted}`,
        `tõrkeid: ${result.failed}`
      ].join(" · ")
    );
  }

  /* TÕRGE ON VÄLJUMISKOODIS, mitte ainult logis: cron ei loe logi, aga
     mitte-null kood jõuab järelevalveni. Partii ise EI PEATUNUD — üks kukkunud
     rida ei tohi teisi kinni hoida ja järgmine käivitus proovib uuesti. */
  process.exitCode = result.failed ? 1 : 0;
} catch (error) {
  console.error(`[casework:retention] KUKKUS: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
