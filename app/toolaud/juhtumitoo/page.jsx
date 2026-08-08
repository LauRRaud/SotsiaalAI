/**
 * JTA-V1 (E2) — pinna marsruut `/toolaud/juhtumitoo`.
 *
 * VÄRAV ON SERVERIS JA TA ON AINUS TÕDE (L11). Väljas lipuga vastab leht
 * `notFound()`-iga — mitte tühja laua ega „funktsioon pole saadaval" teatega:
 * suletud värav ei tohi paljastada, et selline pind üldse olemas on. UI-lipp
 * (`NEXT_PUBLIC_CASEWORK_V1_ENABLED`) tohib ainult PEITA navigatsiooni, avada
 * mitte — tema väärtus küpsetatakse build'i ja serveris muutmine ei mõju.
 *
 * SAMA VÄRAV MIS `/juhtumid`-il ja see on tahtlik (leping L11): assistent ilma
 * juhtumi objektita on mõttetu ja juhtumi objekt ilma assistendita poolik. Kaks
 * lippu annaks neli kombinatsiooni, millest kaks on katkised olekud.
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import CaseWorkbenchShell from "@/components/casework/CaseWorkbenchShell";
import { isCaseWorkEnabled } from "@/lib/casework/flags";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  const messages = getMessagesSync(locale);

  /* VÄRAV KA SIIN. `generateMetadata` jookseb lehe komponendist SÕLTUMATULT:
     ilma selle haruta annaks leht küll 404-sisu, aga brauseri tiitliks jääks
     „Juhtumitöö laud" — pinna nimi lekiks täpselt sellele, kelle eest ta peaks
     olema nähtamatu. Sama õppetund mis `/juhtumid`-il ja Teenuspäevikul. */
  if (!isCaseWorkEnabled()) {
    return buildLocalizedMetadata({
      locale,
      pathname: "/toolaud/juhtumitoo",
      /* Sama tiitel, mille annab Next-i enda 404 — mitte uus, teistsugune
         string, mis oleks omaette sõrmejälg. */
      title: "404",
      description: ""
    });
  }

  return buildLocalizedMetadata({
    locale,
    pathname: "/toolaud/juhtumitoo",
    title: messages?.casework?.workbench?.meta?.title || "Juhtumitöö laud",
    description: messages?.casework?.workbench?.meta?.description || ""
  });
}

export default function CaseWorkbenchPage() {
  if (!isCaseWorkEnabled()) notFound();
  return <CaseWorkbenchShell />;
}
