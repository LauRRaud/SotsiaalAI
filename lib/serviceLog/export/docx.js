/**
 * TEENUSPÄEVIK E6 — DOCX-väljund.
 *
 * MIKS DOCX ON SIIN PÕHIVORMING, kuigi leping ütleb „CSV + PDF": platvormi
 * PDF-kirjutaja kodeerib teksti WinAnsi-sse. Eesti täpitähed mahuvad sinna ära,
 * KIRILLITSA MITTE — ja Eestis on kliendi nimi „Мария" täiesti tavaline.
 * WinAnsi-PDF-is muutuks ta küsimärkideks arve alusdokumendis. DOCX on UTF-8 ja
 * kannab iga nime ära; PDF jääb kõrvale sinna, kuhu ta sobib.
 *
 * TEINE PÕHJUS on praktiline: sisuline aruanne (mall C) on tekst, mida KOV ja
 * osutaja päriselt toimetavad. Redigeeritav fail on seal õigem väljund kui
 * lukus leht.
 */

import { createSimpleDocxBuffer } from "@/lib/documents/docxExport";
import { buildRenderPlan } from "./render.js";

export function exportToDocx(document, { generatedAt = null } = {}) {
  const plan = buildRenderPlan(document, { generatedAt });

  const blocks = [{ kind: "title", text: plan.title }];

  for (const line of plan.meta) blocks.push({ kind: "paragraph", text: line });

  /* HOIATUSED ENNE TABELIT. Kui eksport jättis midagi välja, peab vastuvõtja
     seda nägema enne numbreid, mitte pärast — dokumendi lõppu jõuab lugeja
     alles siis, kui ta on numbrid juba üle võtnud. */
  if (plan.warnings.length) {
    blocks.push({ kind: "heading", text: "Märkused" });
    for (const warning of plan.warnings) blocks.push({ kind: "paragraph", text: `– ${warning}` });
  }

  if (plan.table.head.length) {
    blocks.push({ kind: "table", head: plan.table.head, rows: plan.table.rows });
  }

  if (plan.totals.length) {
    blocks.push({ kind: "heading", text: "Kokku" });
    for (const total of plan.totals) blocks.push({ kind: "paragraph", text: total });
  }

  return createSimpleDocxBuffer({ title: plan.title, blocks });
}
