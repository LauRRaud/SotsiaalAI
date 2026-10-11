import { removeAbsence, updateAbsence } from "@/lib/homeCare/absences";

import { homeCareRoute, orgJson, readJsonBody, readParam } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Puudumise päevade või liigi muutmine. Ainult hooldusjuht; nõuab nähtud versiooni. */
export async function PATCH(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const absenceId = await readParam(context, "absenceId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await updateAbsence(auth.context, absenceId, body)) });
    }
  );
}

/** Ekslikult märgitud puudumise kustutamine. */
export async function DELETE(request, context) {
  return homeCareRoute(
    request,
    context,
    { write: true, rateScope: "client_write", rateLimit: 60, fallbackKey: "home_care.errors.save_failed" },
    async (auth) => {
      const absenceId = await readParam(context, "absenceId");
      const body = await readJsonBody(request);
      return orgJson({ ok: true, ...(await removeAbsence(auth.context, absenceId, body)) });
    }
  );
}
