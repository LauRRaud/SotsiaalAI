import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authConfig } from "@/auth";
import RegistreeriminePageClient from "@/components/pages/RegistreeriminePageClient";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { isAdmin } from "@/lib/authz";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.meta?.register || {};
  const metadata = buildLocalizedMetadata({
    locale,
    pathname: "/registreerimine",
    title: meta.title || "",
    description: meta.description || ""
  });
  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
      nocache: true
    }
  };
}

export default async function Page() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig);
  if (!isAdmin(session?.user)) redirect(localizePath("/", locale));

  return <Suspense fallback={null}>
      <RegistreeriminePageClient />
    </Suspense>;
}
