import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import SubscriptionReadOnlyBanner from "@/components/ui/SubscriptionReadOnlyBanner";
import WellbeingPage from "@/components/wellbeing/WellbeingPage";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { getLocaleFromCookies } from "@/lib/i18n";
import { localizePath } from "@/lib/localizePath";
import { buildLocalizedMetadata } from "@/lib/metadata";
import { canUseWellbeingRole } from "@/lib/wellbeingTools";

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);

  return buildLocalizedMetadata({
    locale,
    pathname: "/tooheaolu",
    title: "Tööheaolu",
    description: "Sotsiaaltöö spetsialisti tööheaolu tööruum."
  });
}

export default async function TooheaoluPage() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const session = await getServerSession(authConfig).catch(() => null);
  const roleState = resolveSessionRoleState(session, cookieStore);

  /* KÕVA REEGEL: aegunud tellimusega (402) EI suunata enam /tellimus-ele —
     oma kirjete lugemine ja kustutamine jääb lahti, riba selgitab piiri.
     Sisselogimata (401) suunatakse endiselt sisselogimisse. */
  const gate = await requireSubscription(session, roleState.effectiveRole);
  if (!gate.ok && gate.status !== 402) {
    redirect(localizePath(gate.redirect || "/tellimus", locale));
  }
  const subscriptionInactive = !gate.ok;

  if (!canUseWellbeingRole(roleState.effectiveRole, Boolean(roleState.isAdmin))) {
    redirect(localizePath("/vestlus", locale));
  }

  return (
    <>
      {subscriptionInactive ? <SubscriptionReadOnlyBanner /> : null}
      <WellbeingPage locale={locale} />
    </>
  );
}
