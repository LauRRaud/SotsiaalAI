import { json } from "@/lib/documents/server";
import { createProcess, listMyProcesses } from "@/lib/supervision/service";
import {
  getSupervisionSession,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const result = await listMyProcesses({ session });
    return json({ ok: true, ...result });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] process list failed", "supervision.errors.load_failed");
  }
}

export async function POST(request) {
  const locale = supervisionLocale(request);
  try {
    const session = await getSupervisionSession();
    const body = await request.json().catch(() => ({}));
    const process = await createProcess({ session, input: body });
    return json({ ok: true, process }, 201);
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] process create failed", "supervision.errors.save_failed");
  }
}
