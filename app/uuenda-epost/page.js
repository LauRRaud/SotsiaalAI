import { cookies } from "next/headers";
import UuendaEpostiBody from "@/components/alalehed/UuendaEpostiBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.email_update || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/uuenda-epost",
    title: meta.title || "",
    description: meta.description || ""
  });
}
export default function UuendaEpostPage() {
  return <UuendaEpostiBody />;
}
