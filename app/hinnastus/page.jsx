import { cookies } from "next/headers";
import HinnastusBody from "@/components/alalehed/HinnastusBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.pricing || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/hinnastus",
    title: meta.title || "",
    description: meta.description || ""
  });
}

export default function HinnastusPage() {
  return <HinnastusBody />;
}
