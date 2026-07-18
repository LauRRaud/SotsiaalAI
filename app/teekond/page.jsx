import { cookies } from "next/headers";
import JourneyDashboard from "@/components/journey/JourneyDashboard";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  const messages = getMessagesSync(locale);
  return buildLocalizedMetadata({
    locale,
    pathname: "/teekond",
    title: messages?.journey?.meta?.title || messages?.journey?.title || "Teekond",
    description: messages?.journey?.meta?.description || ""
  });
}

export default function JourneyPage() {
  return <JourneyDashboard hideHeader />;
}
