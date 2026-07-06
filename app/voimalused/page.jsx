import { cookies } from "next/headers";
import VoimalusedBody from "@/components/alalehed/VoimalusedBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.features || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/voimalused",
    title: meta.title || "",
    description: meta.description || ""
  });
}

export default function VoimalusedPage() {
  return <VoimalusedBody />;
}
