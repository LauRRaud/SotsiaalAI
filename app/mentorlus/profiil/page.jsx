import { cookies } from "next/headers";
import MyMentorProfilePage from "@/components/mentoring/MyMentorProfilePage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.mentoring?.my_profile_meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/mentorlus/profiil",
    title: meta.title || "Minu mentoriprofiil",
    description: meta.description || ""
  });
}

export default function Page() {
  return <MyMentorProfilePage />;
}
