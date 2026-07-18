import fs from "node:fs/promises";
import path from "node:path";
import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringAdminAuth
} from "@/lib/mentoring/api";
import {
  importExternalMentorSeed,
  listMentorModerationQueue
} from "@/lib/mentoring/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringAdminAuth();
    const result = await listMentorModerationQueue(auth);
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring-admin] queue failed", "mentoring.errors.load_failed");
  }
}

/**
 * E9: ESTA seed-i import. AINULT admini käsitsi toiming — ei jookse kunagi
 * automaatselt. Loeb repo seed-faili serveris; kirjed sisenevad
 * EXTERNAL_REFERENCE / PENDING_CONSENT olekus.
 */
export async function POST(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringAdminAuth();
    const body = await request.json().catch(() => ({}));
    if (String(body.action || "") !== "import_seed") {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    const seedPath = path.join(process.cwd(), "data", "mentoring", "esta-mentor-seed.json");
    const raw = await fs.readFile(seedPath, "utf8");
    const seed = JSON.parse(raw);
    const result = await importExternalMentorSeed(auth, seed);
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring-admin] import failed", "mentoring.errors.save_failed");
  }
}
