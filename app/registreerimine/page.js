import { Suspense } from "react";
import { cookies } from "next/headers";
import RegistreeriminePageClient from "@/components/pages/RegistreeriminePageClient";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.register || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/registreerimine",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default function Page() {
  return <Suspense fallback={null}>
      <RegistreeriminePageClient />
    </Suspense>;
}

