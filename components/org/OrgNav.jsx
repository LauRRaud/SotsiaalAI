"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";

import { visibleOrgParts } from "./orgParts";

/**
 * T25 ORG-FOUNDATION-V1 — organisatsiooni navigatsioon.
 *
 * REEGEL (arenduskava §7.3): „Vaated, mille moodul pole aktiivne, ei ilmu
 * navigatsiooni ja route failib serveris suletult." Sama kehtib capability
 * kohta — liige, kellel ei ole `MEMBER_ADMIN`-it, ei näe liikmete vahekaarti.
 *
 * See on MUGAVUS, mitte turvapiir: iga link viib route'i peale, mis kontrollib
 * õigust ise uuesti. Navigatsiooni peitmine üksi ei kaitse midagi.
 *
 * Osade loend (võti, tee, nõutav õigus ja moodul ning põhjendused, miks mõni
 * osa õigust ei nõua) on failis ./orgParts.js: sama loendit kasutab
 * organisatsiooni laud.
 */
export default function OrgNav({ organizationId, capabilities = [], activeModules = [] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = visibleOrgParts(organizationId, { capabilities, activeModules });

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
            {t(`org.nav.${item.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
