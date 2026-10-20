export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import {
  readWellbeingAggregatePreference,
  saveWellbeingAggregatePreference
} from "@/lib/wellbeing/aggregatePreference";

import { wellbeingJson } from "../_shared";

/**
 * Tööheaolu anonüümses koondis osalemise valik (TO-3).
 *
 * Ainult sisselogimine, mitte Tööheaolu roll ega tellimus: see on inimese
 * otsus OMA andmete kohta. Roll või tellimus võib lõppeda, aga varem tehtud
 * kirjed on koondis alles — nendest loobumine ei tohi nende taga olla.
 * Konto tuleb sessioonist, mitte päringu kehast.
 */

async function sessionUserId() {
  const session = await getServerSession(authConfig).catch(() => null);
  return String(session?.user?.id || "").trim();
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return wellbeingJson({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const preference = await readWellbeingAggregatePreference(userId, { db: prisma });
    if (!preference) return wellbeingJson({ ok: false, message: "profile.errors.user_not_found" }, 404);
    return wellbeingJson({ ok: true, ...preference });
  } catch (error) {
    console.error("wellbeing aggregate preference GET error", safeError(error));
    return wellbeingJson({ ok: false, message: "wellbeing.aggregate.preference_failed" }, 500);
  }
}

export async function PUT(request) {
  const userId = await sessionUserId();
  if (!userId) return wellbeingJson({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.enabled !== "boolean") return wellbeingJson({ ok: false, message: "api.common.invalid_request" }, 400);
    const saved = await saveWellbeingAggregatePreference(userId, body.enabled, { db: prisma });
    if (!saved) return wellbeingJson({ ok: false, message: "profile.errors.user_not_found" }, 404);
    return wellbeingJson({ ok: true, ...saved });
  } catch (error) {
    console.error("wellbeing aggregate preference PUT error", safeError(error));
    return wellbeingJson({ ok: false, message: "wellbeing.aggregate.preference_failed" }, 500);
  }
}
