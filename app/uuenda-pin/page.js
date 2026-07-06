import { cookies } from "next/headers";
import UuendaPinBody from "@/components/alalehed/UuendaPinBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.pin_update || messages?.meta?.reset || {};
  const fallbackTitle = messages?.profile?.change_password_cta
    ? `${messages.profile.change_password_cta} - SotsiaalAI`
    : "";
  const fallbackDescription = messages?.profile?.pin_help || "";
  return buildLocalizedMetadata({
    locale,
    pathname: "/uuenda-pin",
    title: meta.title || fallbackTitle,
    description: meta.description || fallbackDescription
  });
}
export default function UuendaPinPage() {
  return <UuendaPinBody />;
}

