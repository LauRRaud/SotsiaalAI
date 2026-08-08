import { json } from "@/lib/documents/server";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";
import { getCaseWorkbench } from "@/lib/casework/workbench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* JTA-V1 (E2) — juhtumitöö laua ainus marsruut.
   Leping: docs/platvormi arendus/jta-v1-arendusleping.md (v6), etapp E2.

   MARSRUUT ON AINULT LUGEJA (L1). `POST`, `PATCH` ega `DELETE` ei ole siin
   kogemata puudu — laud ei kirjuta ühtegi rida ja kirjutav operatsioon kuuluks
   omaniku-moodulisse, mitte lauale.

   OMANIK JA ROLL TULEVAD VÄRAVAST, mitte päringust: `guard.userId` on sessiooni
   oma ja `guard.roleState` otsustab, millised sektsioonid üldse avanevad (L14).
   Kui kumbki tuleks päringu kehast või query-stringist, oleks laud täpselt see
   koondvaade, mis 04.08 IDOR-i tekitas. */
export async function GET(request) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:workbench" });
  if (guard.response) return guard.response;

  try {
    /* Koondlugeja EI VISKA sektsiooni vea peale (L2/L13) — ta annab sektsioonile
       oleku. See `try` katab ainult selle, mis on tema ümber: ootamatu erind
       enne sektsioonide jagamist. */
    const result = await getCaseWorkbench({ userId: guard.userId, roleState: guard.roleState });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
