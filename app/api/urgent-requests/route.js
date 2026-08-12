import {
  handleUrgentRoute,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { authorProjection, createUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Inimene saadab kiireloomulise abipalve.
 *
 * Nupuvajutus ON nõusolek (leping 3.4) — eraldi linnukest ei ole, sest inimene
 * ise palub info edasi saata. Serveripoolne kriisilukk ja laua valmiduskontroll
 * elavad domeenikihis; siin ei tohi kumbagi dubleerida, muidu lähevad nad ühel
 * päeval lahku.
 *
 * `municipalityId` tuleb kehast, aga LAUD tuletatakse serveris — klient ei saa
 * valida, kellele pöördumine läheb.
 */
export async function POST(req, context = {}) {
  /* Süstitavad sõltuvused nagu `app/api/register/route.js`-is: nii saab seda rada
     testida PÄRIS kutsena, mitte lähtekoodi lugedes. Next annab teise argumendina
     `{ params }`, seega puuduvad võtmed langevad vaikeväärtustele. */
  const { db = prisma, requireUser = requireUrgentUser } = context;

  const auth = await requireUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const request = await createUrgentRequest({
      prisma: db,
      authorId: auth.userId,
      municipalityId: body?.municipalityId,
      recipientType: body?.recipientType || undefined,
      situationVerbatim: body?.situationVerbatim,
      contactName: body?.contactName,
      contactPhone: body?.contactPhone,
      /* SOL-URG-03: väärtus antakse edasi TOORELT. Vana `=== true` tegi puuduvast
         ja vigasest vastusest siinsamas eituse ning domeen ei saanud enam vahet
         teha, kas inimene vastas „ei" või ei vastanud üldse.
         SOL-URG-04: `assistantStructured` ei tule enam kehast — vt domeenikihti. */
      safetyAnswer: body?.safetyAnswer
    });
    return urgentJson({ ok: true, request: authorProjection(request) }, 201);
  });
}

/**
 * Nimekiri vaataja rolli järgi. Sama päring annab KAKS ERI KUJU: pöörduja ei
 * näe kunagi laua vaadet ja laud ei näe pöörduja tagasivõtunuppu.
 */
export async function GET(req, context = {}) {
  const { db = prisma, requireUser = requireUrgentUser } = context;

  const auth = await requireUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const url = new URL(req.url);
  const role = String(url.searchParams.get("role") || "author").toLowerCase();

  /* SOL-URG-13: LAUA TÄISLOEND ON SIIT EEMALDATUD.
     See haru tagastas kuni 200 rida `deskProjection` kujul — verbatim-tekst,
     AI-mustand, nimi, telefon ja keeldumise põhjus — ilma et ühegi rea kohta
     tekiks VIEWED sündmust. Üksikvaade käib teadlikult `viewUrgentRequest()`
     kaudu just selleks, et iga vaatamine jätaks jälje (KOV-lepingu p 8); see
     rada käis lepingust mööda ja tegi jäljest valikulise asja.

     Laual on oma endpoint `/api/urgent-requests/desk-queue`, mis tagastab
     SISUTA järjekorraprojektsiooni, ja liides kasutab juba teda. Dubleeriv rada
     ei kandnud seega ühtegi vajadust, ainult riski. 410, mitte vaikne
     ümbersuunamine autori loendile: vana klient peab saama teada, et ta küsib
     asja, mida enam ei ole — mitte saama tühja vastust ja arvama, et järjekord
     on tühi. */
  if (role === "desk") {
    return urgentError("urgent_request.desk_list_removed", 410);
  }

  const rows = await db.urgentRequest.findMany({
    where: { authorId: auth.userId },
    orderBy: { sentAt: "desc" },
    take: 100
  });
  return urgentJson({ ok: true, requests: rows.map(authorProjection) });
}
