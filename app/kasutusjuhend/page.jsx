import { cookies } from "next/headers";
import KasutusjuhendBody from "@/components/alalehed/KasutusjuhendBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.guide || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/kasutusjuhend",
    title: meta.title || "",
    description: meta.description || ""
  });
}

export default function KasutusjuhendPage() {
  return <KasutusjuhendBody />;
}
