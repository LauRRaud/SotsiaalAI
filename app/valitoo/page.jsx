import { cookies } from "next/headers";
import FieldShell from "@/components/field/FieldShell";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  const messages = getMessagesSync(locale);
  return buildLocalizedMetadata({
    locale,
    pathname: "/valitoo",
    title: messages?.field?.meta?.title || "Välitöö",
    description: messages?.field?.meta?.description || ""
  });
}

export default function FieldPage() {
  return <FieldShell />;
}
