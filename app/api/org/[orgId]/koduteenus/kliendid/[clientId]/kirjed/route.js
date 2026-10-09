import { createEntry, listEntries } from "@/lib/homeCare/entries";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kirjete järgmine leht ja filter (liik, ajavahemik). */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.list_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    const params = new URL(request.url).searchParams;
    const page = await listEntries(auth.context, clientId, {
      cursor: params.get("cursor") || undefined,
      kind: params.get("kind") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined
    });
    return orgJson({ ok: true, entries: page });
  });
}

/**
 * Uus kirje. Seade saadab `clientRequestId`: kordussaatmine tagastab sama
 * kirje (200), esimene salvestus 201.
 */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "entry_write", rateLimit: 120, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      const body = await readJsonBody(request);
      const result = await createEntry(auth.context, clientId, body);
      return orgJson({ ok: true, entry: result.entry }, result.created ? 201 : 200);
    }
  );
}
