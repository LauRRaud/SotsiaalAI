import { cookies } from "next/headers";
import MySharingsPage from "@/components/sharings/MySharingsPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.my_sharings?.meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/minu-jagamised",
    title: meta.title || "Minu jagamised",
    description: meta.description || ""
  });
}

export default function Page() {
  return <MySharingsPage />;
}
