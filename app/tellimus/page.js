import { Suspense } from "react";
import { cookies } from "next/headers";
import TellimusBody from "@/components/alalehed/TellimusBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.subscription || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/tellimus",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default function Page() {
  return <Suspense fallback={null}>
      <TellimusBody />
    </Suspense>;
}

