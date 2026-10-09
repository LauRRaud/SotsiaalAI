/**
 * KODUTEENUS K5-b — kriisinimekiri failina (kava II.6.12).
 *
 * Kriisis ei pruugi rakendus, side ega elekter töötada, seepärast peab nimekiri olema ka
 * paberil. Siin tehakse nimekirjast tabelifail (CSV), mille saab tabelarvutuses avada ja
 * välja printida. Puhas funktsioon: tõlked ja read tulevad sisse, tekst läheb välja.
 *
 * Eraldaja on semikoolon ja faili alguses on BOM, et Eesti seadetega tabelarvutus loeks
 * täpitähed ja veerud õigesti. Lahter, mis algab märgiga `=`, `+`, `-` või `@`, saab ette
 * ülakoma: muidu võiks tabelarvutus aadressi või märkuse valemina käivitada.
 */

const RISKY_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  const safe = RISKY_START.test(text) ? `'${text}` : text;
  return /[";]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Minutid kujul „2 t 30 min" ilma tõlketa ei tehta: tabelis on tunnid kümnendmurruna. */
export function hoursCell(minutes) {
  return (Math.round(((minutes || 0) / 60) * 10) / 10).toString().replace(".", ",");
}

/** `t` on tõlkefunktsioon, `list` on `getCrisisList` vastus. */
export function composeCrisisSheet(t, list) {
  const header = ["level", "name", "address", "phone", "dependencies", "helper", "note", "weekly_hours"].map((key) => t(`home_care.crisis.sheet.${key}`));
  const lines = [header];
  const add = (levelText, item) =>
    lines.push([
      levelText,
      item.client.displayName,
      item.address || "",
      item.phone || "",
      (item.crisis?.dependencies || []).map((code) => t(`home_care.crisis.dependencies.${code}`)).join(", "),
      item.crisis?.helper || "",
      item.crisis?.note || "",
      hoursCell(item.weeklyMinutes)
    ]);
  for (const group of list.groups || []) {
    for (const item of group.clients) add(t(`home_care.crisis.levels.${group.level}`), item);
  }
  for (const item of list.unset || []) add(t("home_care.crisis.sheet.unset"), item);
  return `﻿${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
