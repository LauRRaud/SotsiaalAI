/**
 * KODUTEENUS K5-q — kuu tabel failina (kava II.6.10, kuu sulgemise neljas samm).
 *
 * Kuu kokkuvõttest tehakse tabelifail (CSV), mille hooldusjuht saadab linnale või
 * raamatupidamisele: kliendi kaupa, töötaja kaupa ja ära jäänud käigud, üksteise all. Fail
 * tehakse sellest, mida leht näitab: lukustatud kuu puhul lukustatud arvudest, lukustamata
 * kuu puhul jooksvatest, ja faili teisel real on kirjas, kumb see on.
 *
 * Puhas funktsioon: tõlked, kuupäeva vormindajad ja lehe andmed tulevad sisse, tekst läheb
 * välja. Lahtri reeglid (eraldaja, BOM, valemi kaitse) on failis `crisisSheet.js`.
 */

import { csvCell, hoursCell } from "./crisisSheet.js";

/** Koodi enda arvutatud arv: valemi kaitset ei vaja (miinusmärgiga vahe peab jääma arvuks). */
function number(value) {
  return { raw: String(value) };
}

function hours(minutes) {
  return number(hoursCell(minutes));
}

function cell(value) {
  return value && typeof value === "object" && "raw" in value ? value.raw : csvCell(value);
}

/** Kumba seisu fail kannab: lukustatud arvud, lukustatud kuu üksuse jooksvad arvud või lukustamata kuu. */
export function monthSheetState(data) {
  if (data?.lock?.state !== "LOCKED") return "RUNNING";
  return data.lock.snapshotShown ? "LOCKED" : "UNIT";
}

/**
 * `t` on tõlkefunktsioon, `data` on kuu lehe andmed (`getMonthPage`); `dateTime` ja `day`
 * vormindavad aja ja päeva nii, nagu leht neid näitab.
 */
export function composeMonthSheet(t, data, { dateTime = (value) => value || "", day = (value) => value || "" } = {}) {
  const state = monthSheetState(data);
  const [year, month] = String(data.month || "").split("-");
  const name = (client) => (client.displayName === null || client.displayName === undefined ? t("home_care.month_lock.client_gone") : client.displayName);
  const lines = [
    [t("home_care.month_sheet.title"), `${month}.${year}`],
    [
      t("home_care.month_sheet.state"),
      state === "LOCKED"
        ? t("home_care.month_sheet.state_locked", { name: data.lock.lockedByName || "", date: dateTime(data.lock.lockedAt) })
        : t(state === "UNIT" ? "home_care.month_sheet.state_unit" : "home_care.month_sheet.state_running", { date: day(data.today) })
    ],
    []
  ];

  lines.push([t("home_care.month_sheet.clients_title")]);
  lines.push(
    [
      "client",
      "status",
      "visits",
      "hours",
      "expected",
      "difference",
      "without_length",
      "missed",
      "cancelled",
      "away_days",
      "refused",
      "not_needed",
      "could_not"
    ].map((key) => t(`home_care.month_sheet.col_${key}`))
  );
  const sum = { visits: 0, minutes: 0, expected: 0, hasExpected: false, withoutLength: 0, missed: 0, cancelled: 0, awayDays: 0, refused: 0, notNeeded: 0, couldNot: 0 };
  for (const row of data.clients || []) {
    const hasExpected = row.expectedMinutes !== null && row.expectedMinutes !== undefined;
    const notDone = row.notDone || {};
    lines.push([
      name(row.client),
      row.client.status ? t(`home_care.status.${row.client.status}`) : "",
      number(row.visits || 0),
      hours(row.minutes),
      hasExpected ? hours(row.expectedMinutes) : "",
      hasExpected ? hours((row.minutes || 0) - row.expectedMinutes) : "",
      number(row.withoutLength || 0),
      number(row.missed || 0),
      number(row.cancelled || 0),
      number(row.awayDays || 0),
      number(notDone.REFUSED || 0),
      number(notDone.NOT_NEEDED || 0),
      number(notDone.COULD_NOT || 0)
    ]);
    sum.visits += row.visits || 0;
    sum.minutes += row.minutes || 0;
    if (hasExpected) {
      sum.expected += row.expectedMinutes;
      sum.hasExpected = true;
    }
    sum.withoutLength += row.withoutLength || 0;
    sum.missed += row.missed || 0;
    sum.cancelled += row.cancelled || 0;
    sum.awayDays += row.awayDays || 0;
    sum.refused += notDone.REFUSED || 0;
    sum.notNeeded += notDone.NOT_NEEDED || 0;
    sum.couldNot += notDone.COULD_NOT || 0;
  }
  lines.push([
    t("home_care.month_sheet.total"),
    "",
    number(sum.visits),
    hours(sum.minutes),
    sum.hasExpected ? hours(sum.expected) : "",
    /* Koguvahet ei arvutata: otsustatud mahuta klientide aeg teeks selle eksitavaks. */
    "",
    number(sum.withoutLength),
    number(sum.missed),
    number(sum.cancelled),
    number(sum.awayDays),
    number(sum.refused),
    number(sum.notNeeded),
    number(sum.couldNot)
  ]);

  lines.push([]);
  lines.push([t("home_care.month_sheet.workers_title")]);
  lines.push(
    ["worker", "visits", "worker_hours", "heavy", "companion_visits", "companion_hours", "worker_km", "worker_own_km"].map((key) => t(`home_care.month_sheet.col_${key}`))
  );
  for (const row of data.workers || []) {
    /* Kilomeetrid (K6-b) sõidupäevikust; lahter on tühi, kui töötajal sel kuul sõite kirjas ei ole
       (ka varasemas lukus, mis kilomeetreid veel ei kandnud). */
    const hasKm = row.km !== undefined && row.km !== null;
    lines.push([
      row.name || "",
      number(row.visits || 0),
      hours(row.minutes),
      number(row.heavy || 0),
      number(row.companionVisits || 0),
      hours(row.companionMinutes),
      hasKm ? number(row.km) : "",
      hasKm ? number(row.ownKm || 0) : ""
    ]);
  }

  lines.push([]);
  lines.push([t("home_care.month_sheet.missed_title")]);
  lines.push(["client", "time", "reason"].map((key) => t(`home_care.month_sheet.col_${key}`)));
  for (const row of data.missed || []) {
    lines.push([name(row.client), dateTime(row.occurredAt), t(`home_care.incident.types.${row.type}`)]);
  }

  return `﻿${lines.map((line) => line.map(cell).join(";")).join("\r\n")}\r\n`;
}
