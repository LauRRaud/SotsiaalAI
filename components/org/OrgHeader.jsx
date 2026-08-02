"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgNav from "./OrgNav";

/**
 * Organisatsiooni päis: nimi, seis, sinu koht ja maksja.
 *
 * MAKSJA KUVATAKSE NEUTRAALSELT (arenduskava §7.2). Kasutaja peab teadma, kes
 * tema ligipääsu rahastab — aga see ei ole staatuse- ega sõltuvusmärk.
 */
export default function OrgHeader({ context }) {
  const { t } = useI18n();
  const organization = context?.organization;
  if (!organization) return null;

  const seatRole = context?.membership?.seatRole;
  const payer = context?.payerSource;

  return (
    <header className="ow-header">
      <div>
        <h1 className="ow-title">{organization.displayName}</h1>
        <p className="ow-subtitle">
          {t(`org.status.${organization.status}`)}
          {" · "}
          {t(`org.legalKind.${organization.legalKind}`)}
          {seatRole ? ` · ${t(`org.seatRole.${seatRole}`)}` : ""}
          {/* Maksja on neutraalne fakt, mitte staatus. Kui organisatsioon
              maksab, ütleme seda otse — inimene peab teadma, kelle arvel ta
              töötab (arenduskava §5.6). */}
          {payer ? ` · ${t("org.payer.label")}: ${t(`org.payer.${payer}`)}` : ""}
        </p>
      </div>
      <OrgNav
        organizationId={organization.id}
        capabilities={context.capabilities || []}
        activeModules={context.activeModules || []}
      />
    </header>
  );
}
