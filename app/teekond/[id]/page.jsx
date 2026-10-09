import { cookies } from "next/headers";
import JourneyDetail from "@/components/journey/JourneyDetail";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.journey?.meta || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/teekond",
    title: meta.title || messages?.journey?.title || "Teekond",
    description: meta.description || ""
  });
}

export default async function JourneyDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const query = await searchParams;
  /* Ülevaate sammu „Salvesta ja …" toob siia märke, millise sammu juures leht avada. */
  const startWith = typeof query?.alusta === "string" ? query.alusta : "";
  return <JourneyDetail journeyId={resolvedParams?.id || ""} startWith={startWith} />;
}
