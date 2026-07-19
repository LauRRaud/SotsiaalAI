import { Suspense } from "react";
import { cookies } from "next/headers";
import ReflectionPage from "@/components/reflection/ReflectionPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.reflection?.meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/refleksioon",
    title: meta.title || "Meetodipeegel",
    description: meta.description || ""
  });
}

export default function Page() {
  // Suspense: vaade loeb ?sourceKind/?sourceId sisenemispunkti useSearchParams'iga.
  return (
    <Suspense>
      <ReflectionPage />
    </Suspense>
  );
}
