import { createWellbeingRecordCorrectionForUser } from "@/lib/wellbeing/records";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "");
}

/* TO-1 „paranda uue kirjena". Teadlikult POST uue ressursi peale, MITTE PATCH
   kirje enda peale: parandus loob uue kirje, ei muuda olemasolevat. Marsruudi
   kuju peegeldab seda — PATCH /records/[id] annaks vale lubaduse.

   Veakoodid tulevad lib-kihist: 404 võõras/olematu (olemasolu ei leki),
   409 juba parandatud, 400 vigased väljad või parandamatu töövoog. */
export async function POST(request, context) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = await readId(context);
    const body = await request.json().catch(() => ({}));
    const { record, correctedRecordId } = await createWellbeingRecordCorrectionForUser(
      auth.userId,
      id,
      body
    );
    return wellbeingJson({ ok: true, record, correctedRecordId }, 201);
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "record correction failed" });
  }
}
