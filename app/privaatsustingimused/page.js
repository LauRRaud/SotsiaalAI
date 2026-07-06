import { cookies } from "next/headers";
import PrivaatsusBody from "@/components/alalehed/PrivaatsusBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.privacy || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/privaatsustingimused",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default function Page() {
  return <PrivaatsusBody />;
}
