import { Suspense } from "react";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import ReflectionPage from "@/components/reflection/ReflectionPage";
import SubscriptionReadOnlyBanner from "@/components/ui/SubscriptionReadOnlyBanner";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const meta = messages?.reflection?.meta || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/refleksioon",
    title: meta.title || "Meetodipeegel",
    description: meta.description || ""
  });
}

export default async function Page() {
  /* Leht ise ei ole kunagi tellimusega suunanud (API vastas 402-ga ja vaade jäi
     tühjaks). KÕVA REEGLI järgi on lugemine/kustutamine nüüd API-s lahti; siin
     arvutame ainult riba jaoks, kas tellimus on aktiivne. Sisselogimata olekut
     ei muuda — vaade käitub nagu seni. */
  const cookieStore = await cookies();
  const session = await getServerSession(authConfig).catch(() => null);
  let subscriptionInactive = false;
  if (session?.user) {
    const roleState = resolveSessionRoleState(session, cookieStore);
    const gate = await requireSubscription(session, roleState.effectiveRole);
    subscriptionInactive = !gate.ok && gate.status === 402;
  }

  // Suspense: vaade loeb ?sourceKind/?sourceId sisenemispunkti useSearchParams'iga.
  return (
    <Suspense>
      {subscriptionInactive ? <SubscriptionReadOnlyBanner /> : null}
      <ReflectionPage />
    </Suspense>
  );
}
