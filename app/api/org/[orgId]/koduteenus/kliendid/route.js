import { createClient, listClients } from "@/lib/homeCare/clients";

import { homeCareRoute, orgJson, readJsonBody } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Minu kliendid (hooldaja) või skoobi kliendid (hooldusjuht). */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const status = new URL(request.url).searchParams.get("status") || undefined;
    return orgJson({ ok: true, ...(await listClients(auth.context, { status })) });
  });
}

/** Uus klient. Ainult hooldusjuht (kontroll teenuskihis). */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await createClient(auth.context, body)) }, 201);
    }
  );
}
