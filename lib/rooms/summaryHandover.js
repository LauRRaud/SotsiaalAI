import { prisma } from "@/lib/prisma";
import { ANALYSIS_DISCLAIMER } from "@/lib/documents/savedAnalysis";

/* T12 E7 osa 1 — kohtumise kokkuvõtte üleandmine osalejatele.

   Omaniku otsus 3 (T12 otsustering 18.07): iga osaleja saab kokkuvõttest
   privaatse koopia, mis elab üle ruumi kustutuse/arhiveerimise.

   Kokkuvõte = spetsialisti kinnitatud (FINAL) MEETING_SUMMARY, mille ta U10
   vooga ruumi postitas. Privaatsusdelta on seetõttu 0: kopeeritakse ainult
   teksti, mida kõik ruumis olijad on juba sõnumina näinud. Ruumi vestlust ega
   salvestist EI summeerita ega jaotata.

   Kandja = `SavedAnalysis` (owner-scoped, ilma ruumi-võtmeta) — seepärast koopia
   ruumi kustutusest ei kao. Üleandmine tehakse ENNE kustutust (copy-first) ja
   see viskab tõrke korral, et marsruut saaks kustutuse katkestada: vaikselt
   kaotatud kokkuvõte oleks halvem kui aus 500 + kordus. */

const DEFAULT_COPY_TITLE = "Kohtumise kokkuvõte";

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

function emptyCounters() {
  return { summaries: 0, created: 0, existing: 0, skipped: 0 };
}

/** Salvestab jagamise fakti + sisu-snapshot'i (U10 voog). Ei viska. */
export async function recordSharedRoomSummary({
  db = prisma,
  roomId,
  summary,
  messageId = null,
  sharedByUserId,
  now = new Date()
} = {}) {
  if (!roomId || !summary?.id || !sharedByUserId || !db?.roomSharedSummary?.upsert) {
    return { recorded: false };
  }
  const data = {
    messageId: messageId || null,
    title: summary.title || null,
    content: String(summary.content || ""),
    sharedByUserId,
    sharedAt: now
  };
  try {
    await db.roomSharedSummary.upsert({
      where: { roomId_artifactId: { roomId, artifactId: summary.id } },
      create: { roomId, artifactId: summary.id, ...data },
      update: data
    });
    return { recorded: true };
  } catch (error) {
    /* Jagamine ise on juba õnnestunud (sõnum on ruumis) — lingi kirjutamise
       tõrge ei tohi kasutajale 500-t anda. Kaob ainult hilisem privaatkoopia. */
    console.error("[room summary] share link failed", error);
    return { recorded: false };
  }
}

async function ensureCopyForUser(db, { summary, userId, now }) {
  const existing = await db.roomSummaryCopy.findFirst({
    where: { roomSharedSummaryId: summary.id, userId },
    select: { id: true, savedAnalysisId: true }
  });
  if (existing?.savedAnalysisId) return "existing";

  /* Pearaamatu rida kirjutatakse ENNE sisu: unikaalindeks on siin race-lukk,
     nii et paralleelne üleandmine ei tekita kahte koopiat. Poolik rida
     (savedAnalysisId = null) lõpetatakse järgmisel katsel — muidu kaotaks
     vahepealne tõrge koopia jäädavalt. */
  let ledgerId = existing?.id || null;
  if (!ledgerId) {
    try {
      const created = await db.roomSummaryCopy.create({
        data: { roomSharedSummaryId: summary.id, userId, copiedAt: now },
        select: { id: true }
      });
      ledgerId = created.id;
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const raced = await db.roomSummaryCopy.findFirst({
        where: { roomSharedSummaryId: summary.id, userId },
        select: { id: true, savedAnalysisId: true }
      });
      if (raced?.savedAnalysisId) return "existing";
      ledgerId = raced?.id || null;
      if (!ledgerId) throw error;
    }
  }

  const analysis = await db.savedAnalysis.create({
    data: {
      ownerId: userId,
      title: summary.title || DEFAULT_COPY_TITLE,
      content: summary.content,
      sourceDocumentIds: [],
      /* Sama disclaimer-marker mis käsitsi salvestatud analüüsil (üks sõnastik,
         mitte teine koopia) + päritolu, et koopia ei näeks välja eikusagilt
         tulnuna. Salvestuskvooti siin EI väravata: süsteemne üleandmine ei tohi
         jääda tegemata sellepärast, et osaleja ruum on täis. */
      metadata: {
        disclaimer: ANALYSIS_DISCLAIMER,
        source: "room_meeting_summary",
        roomId: summary.roomId,
        artifactId: summary.artifactId
      }
    },
    select: { id: true }
  });

  await db.roomSummaryCopy.update({
    where: { id: ledgerId },
    data: { savedAnalysisId: analysis.id, copiedAt: now }
  });
  return "created";
}

/**
 * Kopeerib ruumi jagatud kokkuvõtted iga praeguse liikme privaatsesse ruumi.
 * Idempotentne (pearaamatu unikaalindeks). Viskab, kui koopia kirjutamine
 * ebaõnnestub — kutsuja peab siis kustutuse/arhiveerimise katkestama.
 */
export async function copyRoomSummariesToParticipants({
  db = prisma,
  roomId,
  now = new Date()
} = {}) {
  const counters = emptyCounters();
  if (!roomId || !db?.roomSharedSummary?.findMany || !db?.savedAnalysis?.create) {
    counters.skipped += 1;
    return counters;
  }
  const summaries = await db.roomSharedSummary.findMany({
    where: { roomId },
    orderBy: { sharedAt: "asc" }
  });
  if (!summaries.length) return counters;

  const members = await db.roomMember.findMany({
    where: { roomId, leftAt: null },
    select: { userId: true }
  });
  const recipientIds = [...new Set(members.map(row => String(row?.userId || "").trim()).filter(Boolean))];
  if (!recipientIds.length) return counters;

  for (const summary of summaries) {
    /* Kustutatud sõnum = jagamine on tagasi võetud. Ruumist eemaldatud
       kokkuvõtet ei tohi tagantjärele laiali jagada (fail-closed). */
    if (summary.messageId && db.roomMessage?.findFirst) {
      const message = await db.roomMessage.findFirst({
        where: { id: summary.messageId },
        select: { deletedAt: true }
      });
      if (!message || message.deletedAt) {
        counters.skipped += 1;
        continue;
      }
    }
    counters.summaries += 1;
    for (const userId of recipientIds) {
      // Jagajal on originaalartefakt oma dokumentides — koopia oleks duplikaat.
      if (userId === summary.sharedByUserId) continue;
      const outcome = await ensureCopyForUser(db, { summary, userId, now });
      counters[outcome] += 1;
    }
  }
  return counters;
}
