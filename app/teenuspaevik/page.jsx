/**
 * TEENUSPÄEVIK-V1 — sisestuspinna marsruut.
 *
 * MARSRUUT ON `/teenuspaevik`, mitte lepingu ptk 8.3 varasem `/teenuskirjed`:
 * tootenimi otsustati 29.07 (lepingu päis) ja marsruut järgib nime, nagu
 * ülejäänud pere (Teekond, Töölaud, Tööheaolu, Teenusekaart, Välitöö).
 *
 * VÄRAV ON SERVERIS. Väljas lipuga vastab leht `notFound()`-iga — mitte tühja
 * pinna ega „funktsioon pole saadaval" teatega. Suletud värav ei tohi
 * paljastada, et selline pind üldse olemas on; sama reegel kehtib API-l.
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ServiceLogShell from "@/components/serviceLog/ServiceLogShell";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  const messages = getMessagesSync(locale);
  /* VÄRAV KA SIIN. `generateMetadata` jookseb lehe komponendist SÕLTUMATULT,
     seega väljas väravaga andis leht küll 404-sisu, aga brauseri tiitliks jäi
     „Teenuspäevik" — pinna nimi lekkis täpselt sellele, kelle eest ta peaks
     olema nähtamatu. Mõõdetud brauseris: `document.title` väljas lipuga. */
  if (!isServiceLogEnabled()) {
    return buildLocalizedMetadata({
      locale,
      pathname: "/teenuspaevik",
      /* Sama tiitel, mille annab Next-i enda 404 — mitte uus, teistsugune
         string, mis oleks omaette sõrmejälg. */
      title: "404",
      description: ""
    });
  }
  return buildLocalizedMetadata({
    locale,
    pathname: "/teenuspaevik",
    title: messages?.service_log?.meta?.title || "Teenuspäevik",
    description: messages?.service_log?.meta?.description || ""
  });
}

export default function ServiceLogPage() {
  if (!isServiceLogEnabled()) notFound();
  return <ServiceLogShell />;
}
