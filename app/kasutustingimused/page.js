import { cookies } from "next/headers";
import KasutustingimusedBody from "@/components/alalehed/KasutustingimusedBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.terms || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/kasutustingimused",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default function Page() {
  return <KasutustingimusedBody />;
}
