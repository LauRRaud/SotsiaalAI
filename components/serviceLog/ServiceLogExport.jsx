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

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";

const TEMPLATES = [
  { key: "A_TIMESHEET", needsReferral: false },
  { key: "B_CARE_DIARY", needsReferral: false },
  { key: "C_NARRATIVE", needsReferral: true },
  { key: "D_STATISTICS", needsReferral: false }
];

export default function ServiceLogExport({ month, referrals = [], onExported }) {
  const { t } = useI18n();
  const [template, setTemplate] = useState("A_TIMESHEET");
  /* CSV on vaikimisi: ta on ainus vorming, mis kannab iga märgi ilma
     kaota ja mille KOV saab otse tabelisse tõmmata. */
  const [format, setFormat] = useState("csv");
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

  /* STAR on saadaval AINULT mallil D. Ilma selleta jääks valik kinni pärast
     malli vahetamist ja kasutaja saaks 400 põhjusel, mida ta ekraanilt ei näe. */
  useEffect(() => {
    if (format === "star" && template !== "D_STATISTICS") setFormat("csv");
  }, [format, template]);
  const ready = selected?.needsReferral ? Boolean(referralId) : true;

  const href = useMemo(() => {
    const params = new URLSearchParams({ month, template, format });
    if (kovName) params.set("kovName", kovName);
    if (referralId) params.set("referralId", referralId);
    if (template === "A_TIMESHEET") params.set("variant", variant);
    if (includeDrafts) params.set("includeDrafts", "1");
    return `/api/service-reports/export?${params}`;
  }, [format, includeDrafts, kovName, month, referralId, template, variant]);

  return (
    <section className="sl-export">
      <h3 className="sl-list-title">{t("service_log.export.title", "")}</h3>

      {/* SAAJA ON ESIMENE VÄLI — vt komponendi päis. */}
      <label className="sl-field">
        <span className="sl-label">{t("service_log.export.recipient", "")}</span>
        <Dropdown
          name="kovName"
          value={kovName}
          onChange={setKovName}
          placeholder={t("service_log.export.recipient_all", "")}
          options={recipients.map((name) => ({ value: name, label: name }))}
        />
        {!kovName ? <span className="sl-hint">{t("service_log.export.recipient_hint", "")}</span> : null}
      </label>

      <label className="sl-field">
        <span className="sl-label">{t("service_log.export.template", "")}</span>
        <Dropdown
          name="template"
          value={template}
          onChange={setTemplate}
          ariaLabel={t("service_log.export.template", "")}
          options={TEMPLATES.map((item) => ({
            value: item.key,
            label: t(`service_log.export.templates.${item.key}`, item.key)
          }))}
        />
      </label>

      {template === "A_TIMESHEET" ? (
        <label className="sl-field">
          <span className="sl-label">{t("service_log.export.variant", "")}</span>
          <Dropdown
            name="variant"
            value={variant}
            onChange={setVariant}
            ariaLabel={t("service_log.export.variant", "")}
            options={[
              { value: "DAILY", label: t("service_log.export.variant_daily", "") },
              { value: "MONTHLY", label: t("service_log.export.variant_monthly", "") }
            ]}
          />
        </label>
      ) : null}

      {selected?.needsReferral ? (
        <label className="sl-field">
          <span className="sl-label">{t("service_log.export.referral", "")}</span>
          <Dropdown
            name="referralId"
            value={referralId}
            onChange={setReferralId}
            placeholder={t("service_log.narrative.choose", "")}
            options={referrals.map((referral) => ({
              value: referral.id,
              label: `${referral.clientDisplayName || referral.clientUserId || "—"} · ${referral.kovName}`
            }))}
          />
        </label>
      ) : null}

      <label className="sl-check">
        <Checkbox
          bare
          name="includeDrafts"
          checked={includeDrafts}
          onChange={setIncludeDrafts}
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

      <label className="sl-field">
        <span className="sl-label">{t("service_log.export.format", "")}</span>
        <Dropdown
          name="format"
          value={format}
          onChange={setFormat}
          ariaLabel={t("service_log.export.format", "")}
          /* STAR ainult statistikamalli juures: teised mallid kannavad
             isikuandmeid, mida riigi statistika ei vaja. */
          options={[
            { value: "csv", label: t("service_log.export.formats.csv", "") },
            { value: "docx", label: t("service_log.export.formats.docx", "") },
            { value: "pdf", label: t("service_log.export.formats.pdf", "") },
            ...(template === "D_STATISTICS"
              ? [{ value: "star", label: t("service_log.export.formats.star", "") }]
              : [])
          ]}
        />
      </label>

      {/* PIIRANG ÖELDAKSE ENNE, mitte pärast allalaadimist. PDF-kirjutaja on
          WinAnsi ja kirillitsa nimi ei mahu sinna — kasutaja peab seda teadma
          ENNE, kui ta faili KOV-ile saadab, mitte pärast. */}
      {format === "pdf" ? (
        <p className="sl-source">{t("service_log.export.pdf_limitation", "")}</p>
      ) : null}

      {format === "star" ? (
        <p className="sl-source">{t("service_log.export.star_note", "")}</p>
      ) : null}

      {/* ALLALAADIMINE JÄÄB PÄRIS LINGIKS. Fetch + blob laseks lugeda serveri
          `X-Service-Report-Archived` päist, aga see rada on mobiilibrauserites
          kõige haprem — ja allalaadimine ise on siin kriitiline tee, mitte
          teadaanne. Selle asemel palume vanemal kuuvaade uuesti laadida:
          arhiveeritud aruanne ilmub „Esitatud aruannete" loendisse ja SEE on
          õige tõend, mitte päisest loetud number. */}
      <Button
        as="a"
        href={ready ? href : undefined}
        download
        disabled={!ready}
        onClick={() => {
          if (!ready || typeof onExported !== "function") return;
          window.setTimeout(onExported, 2000);
        }}
      >
        {t("service_log.export.download", "")}
      </Button>
    </section>
  );
}
