import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import DocumentDetailPage from "@/components/documents/DocumentDetailPage";
import SubscriptionReadOnlyBanner from "@/components/ui/SubscriptionReadOnlyBanner";
import { requireSubscription, roleFromSession } from "@/lib/authz";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";

/* Vahelehe nimi tuleb kataloogist lehe keeles. Aadress on dokumentide lehe oma
   (nagu teistel alamlehtedel): üksiku faili leht ei ole avalik aadress. */
export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);

  return buildLocalizedMetadata({
    locale,
    pathname: "/documents",
    title: messages?.documents?.detail_title || messages?.documents?.page_title || undefined,
    description: ""
  });
}

export default async function Page({ params }) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  const gate = await requireSubscription(session, roleFromSession(session));
  if (!gate.ok && gate.status !== 402) {
    redirect(localizePath(gate.redirect || "/tellimus", locale));
  }
  const resolvedParams = await params;
  return (
    <>
      {!gate.ok ? <SubscriptionReadOnlyBanner /> : null}
      <DocumentDetailPage documentId={resolvedParams?.id} />
    </>
  );
}
