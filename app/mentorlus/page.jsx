import { cookies } from "next/headers";
import MentoringHomePage from "@/components/mentoring/MentoringHomePage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.mentoring?.meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/mentorlus",
    title: meta.title || "Mentorlus",
    description: meta.description || ""
  });
}

export default function Page() {
  return <MentoringHomePage />;
}
