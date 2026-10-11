import { cookies } from "next/headers";
import RepresentationPage from "@/components/workspace/serviceProfile/RepresentationPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const title = messages?.service_provider_profile?.representation?.title || "Asutuse kinnitamine";
  return {
    ...buildLocalizedMetadata({ locale, pathname: "/teenuseprofiil/kinnitus", title, description: "" }),
    /* Lingis on ühekordne võti: lehte ei indekseerita ega jäeta vahemällu. */
    robots: { index: false, follow: false, nocache: true }
  };
}

export default function ServiceProfileRepresentationPage() {
  return <RepresentationPage />;
}
