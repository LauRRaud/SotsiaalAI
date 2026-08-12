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
  createWellbeingPilotScope,
  listWellbeingPilotScopes,
  updateWellbeingPilotScope
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

/* SOL-WB-13: sessioon tuleb kaasa, sest jälje jaoks on vaja TEGIJAT.
   `assertAdmin` ütleb ainult „tohib" — kes, seda ta ei ütle. */
async function requireAdmin() {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  return { ...authz, actorUserId: String(session?.user?.id || "") };
}

export async function GET(request) {
  void request;
  const authz = await requireAdmin();
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const pilotScopes = await listWellbeingPilotScopes();
  return json({ ok: true, pilotScopes });
}

export async function POST(request) {
  const authz = await requireAdmin();
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const body = await request.json().catch(() => ({}));
  try {
    /* SOL-WB-13: tegija antakse EDASI. Varem teadis marsruut administraatorit,
       aga teenus ei saanud teda kunagi — jälge ei olnud kellegi kohta. */
    const pilotScope = await createWellbeingPilotScope(body, { actorUserId: authz.actorUserId });
    return json({ ok: true, pilotScope }, 201);
  } catch (error) {
    return failureJson(error, "pilot scope create failed");
  }
}

/* SOL-WB-12: skoobi muutmine ja deaktiveerimine. `active: false` võtab
   ligipääsu KOHE — `resolveWellbeingPilotAccess` küsib `active: true` iga
   päringu peale ja vahemälu ei ole. */
export async function PATCH(request) {
  const authz = await requireAdmin();
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const body = await request.json().catch(() => ({}));
  const { pilotScopeId, ...changes } = body || {};
  try {
    const pilotScope = await updateWellbeingPilotScope(pilotScopeId, changes, { actorUserId: authz.actorUserId });
    return json({ ok: true, pilotScope });
  } catch (error) {
    return failureJson(error, "pilot scope update failed");
  }
}
