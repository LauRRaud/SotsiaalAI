import { cookies } from "next/headers";
import MentoringRelationPage from "@/components/mentoring/MentoringRelationPage";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.mentoring?.relation_meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/mentorlus",
    title: meta.title || "Mentorlussuhe",
    description: meta.description || ""
  });
}

export default async function Page({ params }) {
  const { relationId } = await params;
  return <MentoringRelationPage relationId={String(relationId || "")} />;
}
