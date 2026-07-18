import { cookies } from "next/headers";
import MentorProfilePublicPage from "@/components/mentoring/MentorProfilePublicPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.mentoring?.profile_public_meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/mentorlus",
    title: meta.title || "Mentori profiil",
    description: meta.description || ""
  });
}

export default async function Page({ params }) {
  const { profileId } = await params;
  return <MentorProfilePublicPage profileId={String(profileId || "")} />;
}
