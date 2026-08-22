#!/usr/bin/env node
/**
 * JTA-V1 (E7) — säilituse käivitaja.
 *
 * OTSUS ILMA KÄIVITAJATA EI OLE SÄILITUSREEGEL. L7 ütleb, mis peab juhtuma;
 * see fail on koht, kus see päriselt juhtub. Kogu loogika elab
 * `lib/casework/retention.js`-is — siin on ainult käivitus, väljund ja
 * väljumiskood.
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
 * AJASTUS ON NÜÜD REPOSITOORIUMI OMA (SOL-CW-14), mitte näide selles päises.
 * Vt `deploy/systemd/` — lukustatud (`flock`), jälgitav `CaseWorkRetentionRun`
 * ridade ja systemd journal'i kaudu ning
 * vahelejäänud jooksu järelt käivituv (`Persistent=true`).
 *
 * IGA JOOKS JÄTAB RIDA, ka see, mis kukub. Rida tekib ENNE tööd: töö, mis suri
 * keset partiid, näeks lõpus kirjutatud reaga välja täpselt nagu töö, mis ei
 * käivitunudki.
 */

import { prisma } from "../lib/prisma.js";
import { runRetention } from "../lib/casework/retention.js";
import { finishRetentionRun, startRetentionRun } from "../lib/casework/retentionRuns.js";

const dryRun = process.argv.includes("--dry-run") || process.env.CASEWORK_RETENTION_DRY_RUN === "1";
const batch = Number(process.env.CASEWORK_RETENTION_BATCH || 50);

const startedAt = new Date();
const run = await startRetentionRun({ startedAt, dryRun, db: prisma });

try {
  const result = await runRetention({ now: startedAt, batch, dryRun, db: prisma });
  await finishRetentionRun({ runId: run.id, result, db: prisma });

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
  /* Rida suletakse ka kukkumisel — muidu jääb ta igaveseks „algas ja ei
     lõpetanud" seisu ja tervis ei erista surnud protsessi vigasest jooksust. */
  await finishRetentionRun({ runId: run.id, error, db: prisma }).catch(() => {});
  console.error(`[casework:retention] KUKKUS: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
