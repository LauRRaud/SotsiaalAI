import { getDoorTag, issueDoorTag, revokeDoorTag } from "@/lib/homeCare/doorTags";

import { homeCareRoute, orgJson, readParam } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kliendi kehtiv uksesilt koos aadressi ja QR-koodiga. Ainult hooldusjuht. */
export async function GET(request, context) {
  return homeCareRoute(request, context, { fallbackKey: "home_care.errors.open_failed" }, async (auth) => {
    const clientId = await readParam(context, "clientId");
    return orgJson({ ok: true, ...(await getDoorTag(auth.context, clientId)) });
  });
}

/** Uus silt; eelmine lakkab töötamast. */
export async function POST(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "door_tag_write", rateLimit: 20, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await issueDoorTag(auth.context, clientId)) }, 201);
    }
  );
}

/** Sildi tühistamine. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "door_tag_write", rateLimit: 20, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const clientId = await readParam(context, "clientId");
      return orgJson({ ok: true, ...(await revokeDoorTag(auth.context, clientId)) });
    }
  );
}
