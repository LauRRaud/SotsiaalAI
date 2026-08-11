import { NextResponse } from "next/server";
import { requireResearchAuth } from "@/lib/research/auth";
import {
  assertResearchAccess,
  cancelResearchJob,
  getResearchJob,
  getResearchJobSnapshot,
} from "@/lib/research/jobStore";

/**
 * SOL-RES-01 — AKTIIVSE TÖÖ PEATAMINE, oma marsruut.
 *
 * Varem tegi seda `DELETE`, mis pidi olema ka kustutus — kaks eri tähendust ühel toimingul, ja
 * kumbki neist ei töötanud lõpuni: terminaltöö „kustutamine" ei kustutanud midagi, aga vastas
 * eduga. Nüüd on peatamine oma tegu ja kustutamine oma.
 *
 * Peatamine on idempotentne: juba lõppenud töö puhul ei muudeta midagi ja vastuses on tema PÄRIS
 * lõppseis, mitte teeseldud „cancelled". Tellimust see ei nõua — oma töö peatamine vähendab kulu
 * ja selle värava taha panemine oleks kasutaja vastu.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function errorJson(messageKey, status = 400) {
  return json({ ok: false, messageKey, message: messageKey }, status);
}

export async function POST(_req, { params }) {
  const auth = await requireResearchAuth({ allowWithoutSubscription: true });
  if (!auth.ok) {
    return json(
      {
        ok: false,
        messageKey: auth.message,
        message: auth.message,
        requireSubscription: auth.requireSubscription,
        redirect: auth.redirect,
      },
      auth.status
    );
  }

  const resolvedParams = await params;
  const jobId = String(resolvedParams?.id || "").trim();
  const job = getResearchJob(jobId) || (await getResearchJobSnapshot(jobId));
  if (!job || !assertResearchAccess(job, auth.userId)) {
    return errorJson("research.error.not_found", 404);
  }

  await cancelResearchJob(job, "research.error.cancelled");

  // Lõppseis loetakse PÄRAST peatamist: juba lõppenud töö annab oma tegeliku seisu tagasi.
  const current = getResearchJob(jobId) || (await getResearchJobSnapshot(jobId));
  return json({ ok: true, status: current?.status || "cancelled" });
}
