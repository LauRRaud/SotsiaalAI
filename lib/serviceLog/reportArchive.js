/**
 * TEENUSPÄEVIK — ESITATUD KUUARUANNE JÄÄB ALLES.
 *
 * MIS OLI KATKI. Eksport oli ainult allalaadimine: bait'id läksid brauserisse
 * ja platvorm ei teadnud pärast seda enam midagi. Kui KOV küsib kolme kuu pärast
 * „see maht ei ole see, mille meie saime", ei olnud millegi peale osutada —
 * kirjed olid küll alles, aga MIS TÄPSELT ESITATI, mitte. Kirjeid tohib RPS §10
 * korras parandada, seega hilisem uus eksport EI OLE tõend selle kohta, mis
 * tookord teele läks.
 *
 * KOLM OTSUST, MIS SIIN ON TEADLIKUD:
 *
 * 1. ARUANNE ON `UserDocument`, MITTE UUS TABEL. /documents leht, säilitus,
 *    kustutamine ja audit on seal juba olemas. Paralleelne dokumendipere
 *    tähendaks, et pooled neist reeglitest kehtiksid ja pooled mitte.
 *
 * 2. SAMAD BAIT'ID = ÜKS DOKUMENT. Kaks vajutust „Laadi alla" ei tee kahte
 *    aruannet; teine vajutus lisab väljastuse loendurisse rea. Sama kuu
 *    PARANDATUD eksport annab teised bait'id ja seega uue dokumendi — just nii
 *    ongi näha, et versioone on kaks.
 *
 * 3. ARHIVEERIMINE EI TOHI ALLALAADIMIST KATKESTADA. Ketas võib olla täis,
 *    kvoot otsas — töötajal on tähtaeg ja fail peab tulema. Seepärast on kutsuja
 *    poolel `{ ok, reason }` ja mitte visatud viga: puudumine on NÄHTAV, mitte
 *    vaikne.
 */

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/constants";
import { getStoredDocumentPath, writeStoredBuffer } from "@/lib/documents/server";
import { logDocumentsAudit } from "@/lib/documents/audit";

import { RETENTION_YEARS } from "./entries.js";

export const SERVICE_LOG_REPORT_KIND = "SERVICE_LOG_REPORT";

export const ARCHIVE_SKIP_REASON = Object.freeze({
  TOO_LARGE: "too_large",
  FAILED: "failed"
});

/**
 * Säilitus arvestatakse VÄLJASTAMISE majandusaasta lõpust (RPS §12), sama ankur
 * mis teenuskirjel. Kalendriaasta = majandusaasta on siin sama õiguslik eeldus,
 * mis `computeRetentionEnd`-is — kui see eeldus muutub, muutub ta mõlemas.
 */
export function computeReportRetentionEnd(issuedAt = new Date()) {
  const year = issuedAt.getUTCFullYear() + RETENTION_YEARS;
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

/**
 * Pealkiri on see, mida inimene /documents lehel loeb. Ta peab ütlema perioodi
 * ja saaja, sest just neid kahte otsitakse: „mis me Tallinnale mais saatsime".
 */
export function buildReportTitle({ month, kovName, template }) {
  const parts = [`Teenuspäevik ${month}`];
  if (kovName) parts.push(kovName);
  if (template) parts.push(`mall ${template}`);
  return parts.join(" · ").slice(0, 200);
}

function sha256Of(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Salvestab väljastatud aruande omaniku dokumendiks.
 *
 * @returns `{ ok: true, documentId, reused }` või `{ ok: false, reason }`.
 *   EI VISKA — vt faili päise punkt 3.
 */
export async function archiveMonthlyReport(
  { userId, month, template, format, kovName, fileName, mime, body, entryCount = null, generatedAt },
  /* SALVESTUSKIHT KÄIB SISSE, sama muster mis `db`. Ilma selleta kirjutaks
     ühiktest päris kettale — ja kirjutamise tõrge (kausta ei ole) näeks välja
     täpselt nagu loogikaviga. */
  { db = prisma, storeBuffer = writeStoredBuffer, makeStoragePath = getStoredDocumentPath } = {}
) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "", "utf8");
  if (!userId || !buffer.byteLength) return { ok: false, reason: ARCHIVE_SKIP_REASON.FAILED };
  if (buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    return { ok: false, reason: ARCHIVE_SKIP_REASON.TOO_LARGE };
  }

  const issuedAt = generatedAt ? new Date(generatedAt) : new Date();
  const sha256 = sha256Of(buffer);

  try {
    /* SAMAD BAIT'ID SAMA OMANIKU JUURES = sama esitis. `sha256` on skeemis
       indekseeritud, seega see otsing on odav ja teda tohib teha iga
       allalaadimise juures. */
    const existing = await db.userDocument.findFirst({
      where: { ownerId: userId, kind: SERVICE_LOG_REPORT_KIND, sha256 },
      select: { id: true, metadata: true }
    });

    if (existing) {
      const meta = existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
      const issuedCount = Number(meta.issuedCount);
      await db.userDocument.update({
        where: { id: existing.id },
        data: {
          metadata: {
            ...meta,
            /* KORDUSVÄLJASTUS ON FAKT, mitte müra: „laadisin uuesti alla, sest
               esimene e-kiri ei läinud läbi" on hiljem täpselt see, mida
               küsitakse. */
            issuedCount: (Number.isFinite(issuedCount) ? issuedCount : 1) + 1,
            lastIssuedAt: issuedAt.toISOString()
          }
        }
      });
      await logDocumentsAudit("document.service_log_reissued", {
        ownerId: userId,
        documentId: existing.id,
        month,
        template,
        format
      }).catch(() => {});
      return { ok: true, documentId: existing.id, reused: true };
    }

    const storagePath = makeStoragePath(fileName);
    const stored = await storeBuffer(buffer, storagePath);

    const document = await db.userDocument.create({
      data: {
        ownerId: userId,
        title: buildReportTitle({ month, kovName, template }),
        originalName: fileName,
        kind: SERVICE_LOG_REPORT_KIND,
        /* AGENDILE MITTE. Aruanne kannab klientide nimesid ja suunamisnumbreid;
           jagatud otsingusse ta ei lähe ka siis, kui omanik teisi dokumente
           sinna lubab. */
        agentAllowed: false,
        mime,
        size: stored.size,
        /* ÜKS SUMMA, MITTE KAKS. Otsing tehti `sha256`-ga ja salvestus võttis
           varem kirjutaja oma — produktsioonis sama arv, aga kaks arvutust
           tähendab võimalust, et nad ükskord lahku lähevad, ja siis lakkaks
           kordusväljastuse tuvastus vaikselt töötamast. */
        sha256,
        storagePath,
        metadata: {
          source: "service_log_export",
          month,
          template,
          format,
          kovName: kovName || null,
          entryCount,
          issuedCount: 1,
          firstIssuedAt: issuedAt.toISOString(),
          lastIssuedAt: issuedAt.toISOString(),
          /* SÄILITUS KÄIB KAASAS. /documents näitab dokumendiperele 90 päeva —
             KOV-ile esitatud aruande puhul oleks see number lihtsalt vale. */
          retentionEndsAt: computeReportRetentionEnd(issuedAt).toISOString(),
          retentionBasis: "RPS_12"
        }
      },
      select: { id: true }
    });

    await logDocumentsAudit("document.service_log_archived", {
      ownerId: userId,
      documentId: document.id,
      month,
      template,
      format,
      mime,
      size: stored.size
    }).catch(() => {});

    return { ok: true, documentId: document.id, reused: false };
  } catch (error) {
    /* Ainult siin neelame: allalaadimine on tähtsam kui tema koopia. Kutsuja
       ütleb kasutajale välja, et arhiveerimine ei õnnestunud. */
    console.error("[service-log archive] failed", { message: error?.message });
    return { ok: false, reason: ARCHIVE_SKIP_REASON.FAILED };
  }
}
