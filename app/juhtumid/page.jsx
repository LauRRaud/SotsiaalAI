/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — pinna marsruut `/juhtumid`.
 *
 * VÄRAV ON SERVERIS JA TA ON AINUS TÕDE (L19). Väljas lipuga vastab leht
 * `notFound()`-iga — mitte tühja pinna ega „funktsioon pole saadaval" teatega:
 * suletud värav ei tohi paljastada, et selline pind üldse olemas on. UI-lipp
 * (`NEXT_PUBLIC_CASEWORK_V1_ENABLED`) tohib ainult PEITA navigatsiooni, avada
 * mitte — tema väärtus küpsetatakse build'i ja serveris muutmine ei mõju.
 */
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import CaseWorkShell from "@/components/casework/CaseWorkShell";
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
     „Minu juhtumid" — pinna nimi lekiks täpselt sellele, kelle eest ta peaks
     olema nähtamatu. Sama õppetund mis Teenuspäevikul. */
  if (!isCaseWorkEnabled()) {
    return buildLocalizedMetadata({
      locale,
      pathname: "/juhtumid",
      /* Sama tiitel, mille annab Next-i enda 404 — mitte uus, teistsugune
         string, mis oleks omaette sõrmejälg. */
      title: "404",
      description: ""
    });
  }

  return buildLocalizedMetadata({
    locale,
    pathname: "/juhtumid",
    title: messages?.casework?.page?.meta?.title || "Minu juhtumid",
    description: messages?.casework?.page?.meta?.description || ""
  });
}

export default function CaseWorkPage() {
  if (!isCaseWorkEnabled()) notFound();
  return <CaseWorkShell />;
}
