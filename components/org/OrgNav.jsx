"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * T25 ORG-FOUNDATION-V1 — organisatsiooni navigatsioon.
 *
 * REEGEL (arenduskava §7.3): „Vaated, mille moodul pole aktiivne, ei ilmu
 * navigatsiooni ja route failib serveris suletult." Sama kehtib capability
 * kohta — liige, kellel ei ole `MEMBER_ADMIN`-it, ei näe liikmete vahekaarti.
 *
 * See on MUGAVUS, mitte turvapiir: iga link viib route'i peale, mis kontrollib
 * õigust ise uuesti. Navigatsiooni peitmine üksi ei kaitse midagi.
 */
export default function OrgNav({ organizationId, capabilities = [], activeModules = [] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const granted = new Set(capabilities.map((grant) => grant.capability));
  const modules = new Set(activeModules);

  const items = [
    { key: "overview", href: `/org/${organizationId}`, label: t("org.nav.overview") },
    { key: "structure", href: `/org/${organizationId}/struktuur`, label: t("org.nav.structure") },
    /* Vastuvõtt sõltub MOODULIST, mitte capability'st. Teadlik erand
       capability-põhisest peitmisest: määratud töötajal EI OLE
       `INBOX_COORDINATOR`-it, aga ta peab oma tööd nägema. Loend on serveris
       skoobitud — õiguseta liige näeb tühja lauda, mitte võõrast tööd. */
    {
      key: "inbox",
      href: `/org/${organizationId}/vastuvott`,
      label: t("org.nav.inbox"),
      requiresModule: "KOV_INTAKE"
    },
    {
      key: "funding",
      href: `/org/${organizationId}/arveldus`,
      label: t("org.nav.funding"),
      requires: "BILLING_MANAGER"
    },
    /* Tugi on IGA liikme oma — ei capability't ega moodulit. Toeavaldus on
       töötaja õigus, mitte funktsioon, mida organisatsioon lubab. */
    { key: "support", href: `/org/${organizationId}/tugi`, label: t("org.nav.support") },
    {
      key: "profile",
      href: `/org/${organizationId}/teenusprofiil`,
      label: t("org.nav.profile"),
      requires: "SERVICE_PROFILE_EDITOR",
      requiresModule: "SERVICE_DELIVERY"
    },
    {
      key: "members",
      href: `/org/${organizationId}/liikmed`,
      label: t("org.nav.members"),
      requires: "MEMBER_ADMIN"
    },
    {
      key: "invites",
      href: `/org/${organizationId}/kutsed`,
      label: t("org.nav.invites"),
      requires: "MEMBER_ADMIN"
    },
    {
      key: "audit",
      href: `/org/${organizationId}/audit`,
      label: t("org.nav.audit"),
      requires: "AUDIT_VIEWER"
    },
    {
      key: "settings",
      href: `/org/${organizationId}/seaded`,
      label: t("org.nav.settings"),
      requires: "ORG_OWNER"
    }
  ].filter(
    (item) =>
      (!item.requires || granted.has(item.requires)) &&
      (!item.requiresModule || modules.has(item.requiresModule))
  );

  return (
    <nav className="ow-nav" aria-label={t("org.title")}>
      {items.map((item) => {
        const isCurrent = item.href === pathname;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="ow-nav__link"
            aria-current={isCurrent ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
