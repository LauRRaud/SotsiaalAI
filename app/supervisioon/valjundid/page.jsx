import { cookies } from "next/headers";
import SupervisionOutcomeListPage from "@/components/supervision/SupervisionOutcomeListPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.supervision?.meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/supervisioon",
    title: meta.title || "Supervisioon",
    description: meta.description || ""
  });
}

export default function Page() {
  return <SupervisionOutcomeListPage />;
}
