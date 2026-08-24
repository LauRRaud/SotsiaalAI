import { cookies } from "next/headers";
import KasutusjuhendBody from "@/components/alalehed/KasutusjuhendBody";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.guide || {};

  return buildLocalizedMetadata({
    locale,
    pathname: "/kasutusjuhend",
    title: meta.title || "",
    description: meta.description || ""
  });
}

const GUIDE_ROLES = new Set(["client", "specialist", "provider"]);

export default async function KasutusjuhendPage({ searchParams }) {
  const params = await searchParams;
  const requestedRole = typeof params?.role === "string" ? params.role : "";
  const initialRole = GUIDE_ROLES.has(requestedRole) ? requestedRole : "";

  return <KasutusjuhendBody initialRole={initialRole} />;
}
