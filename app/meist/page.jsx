import { cookies } from "next/headers";
import MeistBody from "@/components/alalehed/MeistBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meist = messages?.meist || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/meist",
    title: meist.title || "Meist",
    description: meist.meta_description || ""
  });
}

export default function MeistPage() {
  return <MeistBody />;
}
