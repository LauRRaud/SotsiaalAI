/**
 * TEENUSPÄEVIK E6 — PDF-väljund.
 *
 * PLATVORMI PDF-KIRJUTAJA ON WinAnsi. Eesti täpitähed mahuvad sinna, kirillitsa
 * ei mahu. See EI OLE siin lahendatav: päris lahendus nõuaks TrueType-fondi
 * manustamist ja alamhulga tegemist, mis on omaette töö ja omaette risk.
 *
 * SEEPÄRAST ON SIIN VÄRAV, MITTE VAIKNE ASENDUS. `createPdfBufferFromText`
 * asendaks tundmatu märgi küsimärgiga — ja „Мария" muutuks arve alusdokumendis
 * kujuks „??????". Vaikselt rikutud nimi arve lisas on halvem kui puuduv fail:
 * esimest ei märka keegi enne, kui KOV küsib, kes see klient oli.
 *
 * Kutsuja saab `{ ok: false, reason: "unsupported_characters" }` ja suunab
 * kasutaja DOCX-ile, mis sama sisu ilma kaota kannab.
 */

import { createPdfBufferFromText, isPdfTextSupported } from "@/lib/chat/exportDocument";
import { buildRenderPlan } from "./render.js";

/**
 * Veerulaiused tulevad sisust, mitte pealt: fikseeritud laius lõikaks pikad
 * kliendinimed poolelt ja tekitaks kaks eri „Mari K…" rida, mida ei saa enam
 * eristada.
 */
function padCell(value, width) {
  const text = String(value ?? "");
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function renderTable({ head, rows }) {
  if (!head.length) return [];
  const widths = head.map((label, index) =>
    Math.min(
      40,
      Math.max(String(label).length, ...rows.map((row) => String(row[index] ?? "").length), 3)
    )
  );
  const line = (cells) => cells.map((cell, index) => padCell(cell, widths[index])).join("  ");
  return [line(head), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)];
}

export function buildPdfText(document, { generatedAt = null } = {}) {
  const plan = buildRenderPlan(document, { generatedAt });
  const lines = [plan.title, ""];
  for (const meta of plan.meta) lines.push(meta);
  if (plan.meta.length) lines.push("");

  if (plan.warnings.length) {
    lines.push("Märkused:");
    for (const warning of plan.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push(...renderTable(plan.table));

  if (plan.totals.length) {
    lines.push("", "Kokku:");
    for (const total of plan.totals) lines.push(total);
  }

  return lines.join("\n");
}

/**
 * @returns `{ ok: true, buffer }` või `{ ok: false, reason }` — mitte visatud
 *   viga. Vorming, mis ei kanna sisu ära, ei ole serveri tõrge, vaid valik,
 *   mille kasutaja saab teisiti teha.
 */
export function exportToPdf(document, { generatedAt = null } = {}) {
  const text = buildPdfText(document, { generatedAt });
  if (!isPdfTextSupported(text)) {
    return { ok: false, reason: "unsupported_characters" };
  }
  return { ok: true, buffer: createPdfBufferFromText(text) };
}
