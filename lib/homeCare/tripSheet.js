/**
 * KODUTEENUS K6-a — sõidupäevik failina (kava II.6.15).
 *
 * Raamatupidaja vajab isikliku auto hüvitise aluseks sõidupäevikut: iga sõidu kuupäev,
 * sõiduk, läbisõidumõõdiku alg- ja lõppnäit, kilomeetrid ja eesmärk. Siin tehakse kuu
 * ridadest tabelifail (CSV) ja selle lõppu kokkuvõte töötaja kaupa. Puhas funktsioon:
 * tõlked, päeva vormindaja ja read tulevad sisse, tekst läheb välja. Lahtri reeglid
 * (eraldaja, BOM, valemi kaitse) on failis `crisisSheet.js`.
 */

import { csvCell } from "./crisisSheet.js";

function cell(value) {
  return typeof value === "number" ? String(value) : csvCell(value);
}

/** `t` on tõlkefunktsioon, `log` on `getTripLog` vastuse osa `all` koos kuuga; `day` vormindab päeva. */
export function composeTripSheet(t, { month, trips = [], workers = [] }, { day = (value) => value || "" } = {}) {
  const [year, number] = String(month || "").split("-");
  const lines = [[t("home_care.trip_sheet.title"), `${number}.${year}`], []];
  lines.push(["day", "worker", "vehicle", "plate", "start", "end", "km", "purpose"].map((key) => t(`home_care.trip_sheet.col_${key}`)));
  for (const row of trips) {
    lines.push([day(row.day), row.workerName, t(`home_care.trips.vehicles.${row.vehicle}`), row.plate || "", row.startOdometer, row.endOdometer, row.km, row.purpose]);
  }
  lines.push([]);
  lines.push([t("home_care.trip_sheet.workers_title")]);
  lines.push(["worker", "trips", "km", "own_km"].map((key) => t(`home_care.trip_sheet.col_${key}`)));
  for (const row of workers) lines.push([row.name, row.trips, row.km, row.ownKm]);
  return `﻿${lines.map((line) => line.map(cell).join(";")).join("\r\n")}\r\n`;
}
