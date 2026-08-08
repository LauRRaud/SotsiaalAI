import { json } from "@/lib/documents/server";
import { buildStar2Block } from "@/lib/casework/caseWorkTransfer";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * STAR2 plokk — TEKST, mille inimene lõikelauale viib.
 *
 * SEE MARSRUUT EI KIRJUTA MIDAGI ja see on L16 järjekorra esimene samm: plokk →
 * lõikelaud → `copy-events`. Audit sünnib alles siis, kui lõikelauale kirjutus
 * ÕNNESTUS — tõend, mis tekib enne tegu, ei ole tõend.
 *
 * Ploki esimene rida on hoiatus, et tegemist on ettevalmistava mustandiga.
 * Ta koostatakse SERVERIS, mitte kliendis: tekst, mis läheb lõikelaualt kuhugi
 * mujale, ei tohi sõltuda sellest, kas liides selle rea kaasa pani.
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:transfer", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const block = await buildStar2Block({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      locale: guard.locale
    });
    return json({ ok: true, block });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
