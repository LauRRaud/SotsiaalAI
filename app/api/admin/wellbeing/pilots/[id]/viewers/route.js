import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { safeError } from "@/lib/privacy/safeError";
import {
  isWellbeingDomainError,
  newWellbeingCorrelationId,
  WELLBEING_UNEXPECTED_ERROR
} from "@/lib/wellbeing/apiErrors";
import {
  addWellbeingPilotViewer,
  removeWellbeingPilotViewer
} from "@/lib/wellbeing/pilotScopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function errorJson(message, status = 400) {
  return json({ ok: false, message }, status);
}

/* SOL-WB-11: tuntud domeeniviga tohib oma võtme välja anda, kõik muu (Prisma,
   skeem, infrastruktuur) annab fikseeritud võtme ja korrelatsiooni-ID. */
function failureJson(error, label) {
  if (isWellbeingDomainError(error)) {
    return errorJson(error.message, Number(error.status));
  }
  const correlationId = newWellbeingCorrelationId();
  console.error(`[wellbeing] ${label}`, safeError(error, { correlationId }));
  return json({ ok: false, message: WELLBEING_UNEXPECTED_ERROR, correlationId }, 500);
}

export async function POST(request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const viewer = await addWellbeingPilotViewer(params.id, body, { actorUserId: String(session?.user?.id || "") });
    return json({ ok: true, viewer }, 201);
  } catch (error) {
    return failureJson(error, "pilot viewer add failed");
  }
}

/* SOL-WB-12: ligipääsu äravõtmine. Ligipääs on luba, mitte ajalugu — rida
   kustub ja jälg jääb auditisse. E-post tuleb kehast, mitte URL-ist: aadress ei
   kuulu logitavasse päringureale. */
export async function DELETE(request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await removeWellbeingPilotViewer(params.id, body, { actorUserId: String(session?.user?.id || "") });
    return json({ ok: true, ...result });
  } catch (error) {
    return failureJson(error, "pilot viewer revoke failed");
  }
}
