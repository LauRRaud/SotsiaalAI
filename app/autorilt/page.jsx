import { cookies } from "next/headers";
import AutoriltBody from "@/components/alalehed/AutoriltBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.author || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/autorilt",
    title: meta.title || "",
    description: meta.description || ""
  });
}

export default function AutoriltPage() {
  return <AutoriltBody />;
}
