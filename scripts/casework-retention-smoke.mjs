#!/usr/bin/env node
/**
 * JTA-V1 / SOL-CW-14 — säilitustöö ajastuse SMOKE.
 *
 * MIDA TA TÕENDAB. Auditi vastuvõtukriteerium nõuab kolme asja ja need kolm on
 * siin väljundis nimeliselt:
 *
 *   1. **viimane edukas jooks** — `lastSuccessAt`
 *   2. **järgmine jooks** — `nextRunAt`
 *   3. **alarm** — `state=ALARM` annab VÄLJUMISKOODI 1
 *
 * MIKS VÄLJUMISKOOD, MITTE ILUS TEKST. Järelevalve ei loe lauseid. Smoke, mis
 * lõpeb alati koodiga 0, ütleb monitooringule „kõik hästi" ka siis, kui töö on
 * kuu aega seisnud — ja täpselt see oli leiu sisu: mehhanism, mille kohta keegi
 * ei tea, kas ta käib.
 *
 * VÄRAV VÄLJAS EI OLE ALARM. Kui `CASEWORK_V1_ENABLED` on väljas, ei ole
 * juhtumitööd olemas ja säilitustööl ei ole midagi teha; alarm siin õpetaks
 * inimest alarmi eirama. Smoke ütleb seda VÄLJA ja lõpeb koodiga 0.
 *
 * Käivitamine:
 *   npm run casework:retention:smoke
 *   CASEWORK_RETENTION_INTERVAL_MINUTES=60 npm run casework:retention:smoke
 */

import { prisma } from "../lib/prisma.js";
import { isCaseWorkEnabled } from "../lib/casework/flags.js";
import {
  RETENTION_ALARM_MISSED_INTERVALS,
  RETENTION_HEALTH,
  RETENTION_INTERVAL_MINUTES,
  getRetentionHealth
} from "../lib/casework/retentionRuns.js";

const interval = Number(process.env.CASEWORK_RETENTION_INTERVAL_MINUTES || RETENTION_INTERVAL_MINUTES);

function stamp(value) {
  return value ? new Date(value).toISOString() : "—";
}

try {
  const health = await getRetentionHealth({ intervalMinutes: interval, db: prisma });

  console.log(
    [
      `[casework:retention:smoke] seis: ${health.state}`,
      `viimane edukas jooks: ${stamp(health.lastSuccessAt)}`,
      `viimane jooks: ${stamp(health.lastRunAt)}${health.lastRunOk === false ? " (TÕRGE)" : ""}`,
      `järgmine jooks: ${stamp(health.nextRunAt)}`,
      `intervall: ${interval} min · alarmi lävi: ${interval * RETENTION_ALARM_MISSED_INTERVALS} min`
    ].join(" · ")
  );

  if (health.lastRun?.failed) {
    console.log(`[casework:retention:smoke] viimases jooksus jäi töötlemata ridu: ${health.lastRun.failed}`);
  }
  if (health.lastRun?.errorName) {
    /* Erindi KLASS ja kood, mitte teade — teade võib kanda kirje sisu. */
    console.log(
      `[casework:retention:smoke] viimane erind: ${health.lastRun.errorName}${
        health.lastRun.errorCode ? ` (${health.lastRun.errorCode})` : ""
      }`
    );
  }

  if (!isCaseWorkEnabled()) {
    console.log("[casework:retention:smoke] värav on väljas (CASEWORK_V1_ENABLED) — ajastus ei pea käima");
    process.exitCode = 0;
  } else if (health.state === RETENTION_HEALTH.OK) {
    process.exitCode = 0;
  } else {
    console.error(`[casework:retention:smoke] ALARM: ${health.reason || health.state}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`[casework:retention:smoke] KUKKUS: ${error?.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
