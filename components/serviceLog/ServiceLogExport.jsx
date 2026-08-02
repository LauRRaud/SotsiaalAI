"use client";

/**
 * TEENUSPÄEVIK-V1 E6 UI — eksport.
 *
 * DoD punkt 3 on siin nähtav: SAAJA valitakse ESIMESENA. Mitut KOV-i teenindav
 * osutaja sisestab ühe korra ja ekspordib igaühele ainult TEMA read — see on
 * mooduli müügiargument ja ta ei tohi olla peidetud valikusse „kõik".
 *
 * MUSTANDID EI LÄHE VAIKIMISI KAASA. Lüliti on olemas, aga ta on teadlik tegu:
 * kinnitamata töö esitamine tähendaks arvet töö eest, mida osutaja ise ei ole
 * veel kinnitanud.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

const TEMPLATES = [
  { key: "A_TIMESHEET", needsReferral: false },
  { key: "B_CARE_DIARY", needsReferral: false },
  { key: "C_NARRATIVE", needsReferral: true },
  { key: "D_STATISTICS", needsReferral: false }
];

export default function ServiceLogExport({ month, referrals = [] }) {
  const { t } = useI18n();
  const [template, setTemplate] = useState("A_TIMESHEET");
  const [kovName, setKovName] = useState("");
  const [referralId, setReferralId] = useState("");
  const [variant, setVariant] = useState("DAILY");
  const [includeDrafts, setIncludeDrafts] = useState(false);

  /* Saajad tulevad suunamistest — osutaja ei pea nime käsitsi kirjutama ja
     kirjaviga ei saa tekitada tühja eksporti. */
  const recipients = useMemo(
    () => [...new Set(referrals.map((referral) => referral.kovName).filter(Boolean))],
    [referrals]
  );

  const selected = TEMPLATES.find((item) => item.key === template);
  const ready = selected?.needsReferral ? Boolean(referralId) : true;

  const href = useMemo(() => {
    const params = new URLSearchParams({ month, template });
    if (kovName) params.set("kovName", kovName);
    if (referralId) params.set("referralId", referralId);
    if (template === "A_TIMESHEET") params.set("variant", variant);
    if (includeDrafts) params.set("includeDrafts", "1");
    return `/api/service-reports/export?${params}`;
  }, [includeDrafts, kovName, month, referralId, template, variant]);

  return (
    <section className="sl-export">
      <h3 className="sl-list-title">{t("service_log.export.title", "")}</h3>

      {/* SAAJA ON ESIMENE VÄLI — vt komponendi päis. */}
      <label className="sl-field">
        <span className="sl-label">{t("service_log.export.recipient", "")}</span>
        <select className="sl-input" value={kovName} onChange={(event) => setKovName(event.target.value)}>
          <option value="">{t("service_log.export.recipient_all", "")}</option>
          {recipients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {!kovName ? <span className="sl-hint">{t("service_log.export.recipient_hint", "")}</span> : null}
      </label>

      <label className="sl-field">
        <span className="sl-label">{t("service_log.export.template", "")}</span>
        <select className="sl-input" value={template} onChange={(event) => setTemplate(event.target.value)}>
          {TEMPLATES.map((item) => (
            <option key={item.key} value={item.key}>
              {t(`service_log.export.templates.${item.key}`, item.key)}
            </option>
          ))}
        </select>
      </label>

      {template === "A_TIMESHEET" ? (
        <label className="sl-field">
          <span className="sl-label">{t("service_log.export.variant", "")}</span>
          <select className="sl-input" value={variant} onChange={(event) => setVariant(event.target.value)}>
            <option value="DAILY">{t("service_log.export.variant_daily", "")}</option>
            <option value="MONTHLY">{t("service_log.export.variant_monthly", "")}</option>
          </select>
        </label>
      ) : null}

      {selected?.needsReferral ? (
        <label className="sl-field">
          <span className="sl-label">{t("service_log.export.referral", "")}</span>
          <select
            className="sl-input"
            value={referralId}
            onChange={(event) => setReferralId(event.target.value)}
          >
            <option value="">{t("service_log.narrative.choose", "")}</option>
            {referrals.map((referral) => (
              <option key={referral.id} value={referral.id}>
                {referral.clientDisplayName || referral.clientUserId || "—"} · {referral.kovName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="sl-check">
        <input
          type="checkbox"
          checked={includeDrafts}
          onChange={(event) => setIncludeDrafts(event.target.checked)}
        />
        <span>{t("service_log.export.include_drafts", "")}</span>
      </label>
      {includeDrafts ? <p className="sl-warn">{t("service_log.export.drafts_warning", "")}</p> : null}

      {/* P0: „kõik saajad" fail EI OLE KOV-ile esitatav. Hoiatus on nähtav
          ENNE allalaadimist ja läheb ka faili sisse kaasa. */}
      {!kovName ? (
        <p className="sl-warn" role="status">
          {t("service_log.export.warn_all", "")}
        </p>
      ) : null}

      <Button as="a" href={ready ? href : undefined} download disabled={!ready}>
        {t("service_log.export.download", "")}
      </Button>
    </section>
  );
}
