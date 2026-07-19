import { cookies } from "next/headers";
import SupervisionOutcomePage from "@/components/supervision/SupervisionOutcomePage";
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

export default async function Page({ params }) {
  const { outcomeId } = await params;
  return <SupervisionOutcomePage outcomeId={String(outcomeId || "")} />;
}
