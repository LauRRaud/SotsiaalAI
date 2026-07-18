import { cookies } from "next/headers";
import FieldVisitRoom from "@/components/field/FieldVisitRoom";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  const messages = getMessagesSync(locale);
  return buildLocalizedMetadata({
    locale,
    pathname: "/valitoo",
    title: messages?.field?.meta?.visitTitle || messages?.field?.meta?.title || "Välitöö külastus",
    description: messages?.field?.meta?.description || ""
  });
}

export default async function FieldVisitPage({ params }) {
  const { visitId } = await params;
  return <FieldVisitRoom visitId={String(visitId || "")} />;
}
