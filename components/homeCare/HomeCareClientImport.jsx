"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import Dropdown from "@/components/ui/Dropdown";
import { CLIENT_IMPORT_MAX_CHARS, CLIENT_IMPORT_MAX_ROWS, ClientImportStatus } from "@/lib/homeCare/clientTable";

import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Olekud, mille read näidatakse ette täies mahus; uued read on kokku võetud arvuna ja avatavad. */
const PROBLEM_STATUSES = [
  ClientImportStatus.ERROR,
  ClientImportStatus.SAME_NAME,
  ClientImportStatus.REPEATED,
  ClientImportStatus.EXISTS
];

/**
 * Klientide nimekirja sissetoomine tabelist (hooldusjuht).
 *
 * Kaks sammu. „Kontrolli" näitab, mis igast reast saab, ja midagi ei salvesta.
 * „Too üle" loob kliendid; server loeb sama teksti uuesti, seega eelvaade ja
 * tulemus ei saa lahku minna. Teksti või üksuse muutmine tühistab eelvaate:
 * üle tuuakse ainult see, mida hooldusjuht just kontrollis.
 *
 * Tabel jääb brauserisse, kuni hooldusjuht vajutab nuppu; faili ei laeta üles,
 * vaid loetakse siinsamas tekstiks.
 */
export default function HomeCareClientImport({ context, unitOptions }) {
  const { t } = useI18n();
  const check = useHomeCareApi();
  const apply = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const units = unitOptions?.units || [];
  const unitRequired = Boolean(unitOptions?.unitRequired);

  const [text, setText] = useState("");
  const [unitId, setUnitId] = useState(unitRequired && units.length === 1 ? units[0].id : "");
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [fileNote, setFileNote] = useState("");
  const [done, setDone] = useState(null);

  const invalidate = () => {
    setPreview(null);
    setConfirmed([]);
    setShowNew(false);
    setDone(null);
    check.setError("");
    apply.setError("");
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    invalidate();
    /* Hiigelfaili ei loeta mällu: üks märk on kuni neli baiti. */
    if (file.size > CLIENT_IMPORT_MAX_CHARS * 4) {
      setFileNote(t("home_care.errors.import_too_large"));
      return;
    }
    try {
      const content = await file.text();
      /* Fail, mis ei ole UTF-8 (vanem Exceli CSV), annab täpitähtede asemel
         asendusmärgid. Parem öelda kohe, kui tuua üle katkise täpitähega nimi. */
      setFileNote(content.includes("\uFFFD") ? t("home_care.import.file_encoding") : "");
      setText(content);
    } catch {
      setFileNote(t("home_care.import.file_failed"));
    }
  };

  const body = () => ({ text, unitId: unitId || null });

  const runCheck = async (event) => {
    event.preventDefault();
    setDone(null);
    setConfirmed([]);
    const result = await check.call(`${homeCareBase(organizationId)}/kliendid/sissetoomine/eelvaade`, {
      method: "POST",
      body: body(),
      fallbackKey: "home_care.errors.import_failed"
    });
    setPreview(result.ok ? result.data.preview : null);
  };

  const runApply = async () => {
    const result = await apply.call(`${homeCareBase(organizationId)}/kliendid/sissetoomine`, {
      method: "POST",
      body: { ...body(), confirmedLines: confirmed },
      fallbackKey: "home_care.errors.import_failed"
    });
    if (!result.ok) {
      /* Nimekiri muutus vahepeal: eelvaade ei kehti enam. */
      if (result.status === 409) setPreview(null);
      return;
    }
    setDone({ created: result.data.created });
    setPreview(null);
    setConfirmed([]);
    setText("");
    setFileNote("");
  };

  const toggleConfirmed = (line) => {
    setConfirmed((current) => (current.includes(line) ? current.filter((value) => value !== line) : [...current, line]));
  };

  const summary = preview?.summary;
  const willCreate = summary ? summary.new + confirmed.length : 0;
  const problemRows = preview ? preview.rows.filter((row) => PROBLEM_STATUSES.includes(row.status)) : [];
  const newRows = preview ? preview.rows.filter((row) => row.status === ClientImportStatus.NEW) : [];
  const unitMissing = unitRequired && !unitId;
  const busy = check.busy || apply.busy;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />

      <div className="hc-head">
        <Link className="hc-back" href={`/org/${organizationId}/koduteenus`}>
          {t("home_care.client.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.import.title")}</h2>
        <p className="hc-sub">{t("home_care.import.intro")}</p>
        <p className="hc-hint">{t("home_care.import.columns_hint", { limit: CLIENT_IMPORT_MAX_ROWS })}</p>
      </div>

      {done ? (
        <section className="hc-section hc-section--card" role="status">
          <p className="hc-ok">{t("home_care.import.done", { count: done.created })}</p>
          <div className="hc-row">
            <Link className="hc-btn hc-btn--primary hc-btn--link" href={`/org/${organizationId}/koduteenus`}>
              {t("home_care.import.to_clients")}
            </Link>
          </div>
        </section>
      ) : null}

      <form className="hc-section hc-form" onSubmit={runCheck}>
        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-text`}>
            {t("home_care.import.text_label")}
          </label>
          <textarea
            id={`${fieldId}-text`}
            className="hc-textarea"
            value={text}
            onChange={(event) => {
              invalidate();
              setFileNote("");
              setText(event.target.value);
            }}
            rows={8}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={`${fieldId}-text-hint`}
          />
          <p className="hc-hint" id={`${fieldId}-text-hint`}>
            {t("home_care.import.text_hint")}
          </p>
        </div>

        <div className="hc-field">
          <label className="hc-label" htmlFor={`${fieldId}-file`}>
            {t("home_care.import.file_label")}
          </label>
          <input
            id={`${fieldId}-file`}
            className="hc-input"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            onChange={readFile}
          />
          {fileNote ? (
            <p className="hc-notice hc-notice--warn" role="status">
              {fileNote}
            </p>
          ) : null}
        </div>

        {units.length > 0 ? (
          <div className="hc-field">
            <span className="hc-label">{t("home_care.client.unit")}</span>
            <Dropdown
              value={unitId}
              onChange={(value) => {
                invalidate();
                setUnitId(value);
              }}
              ariaLabel={t("home_care.client.unit")}
              options={[
                ...(unitRequired ? [] : [{ value: "", label: t("home_care.client.unit_none") }]),
                ...units.map((unit) => ({ value: unit.id, label: unit.name }))
              ]}
            />
          </div>
        ) : null}

        {check.error ? (
          <p className="hc-error" role="alert">
            {check.error}
          </p>
        ) : null}

        <div className="hc-row">
          <button className="hc-btn" type="submit" disabled={busy || !text.trim() || unitMissing}>
            {t("home_care.import.check")}
          </button>
        </div>
      </form>

      {preview ? (
        <section className="hc-section" aria-live="polite">
          <h3 className="hc-section-title">{t("home_care.import.preview_title", { total: summary.total })}</h3>
          <ul className="hc-list hc-list--plain">
            <li className="hc-entry__meta">{t("home_care.import.count_new", { count: summary.new })}</li>
            {summary.exists > 0 ? (
              <li className="hc-entry__meta">{t("home_care.import.count_exists", { count: summary.exists })}</li>
            ) : null}
            {summary.repeated > 0 ? (
              <li className="hc-entry__meta">{t("home_care.import.count_repeated", { count: summary.repeated })}</li>
            ) : null}
            {summary.sameName > 0 ? (
              <li className="hc-entry__meta">{t("home_care.import.count_same_name", { count: summary.sameName })}</li>
            ) : null}
            {summary.errors > 0 ? (
              <li className="hc-entry__meta">{t("home_care.import.count_errors", { count: summary.errors })}</li>
            ) : null}
          </ul>
          {preview.ignoredHeaders.length > 0 ? (
            <p className="hc-hint">
              {t("home_care.import.ignored_columns", { columns: preview.ignoredHeaders.join(", ") })}
            </p>
          ) : null}

          {problemRows.length > 0 ? (
            <ul className="hc-list hc-list--plain">
              {problemRows.map((row) => (
                <li key={row.line} className="hc-entry">
                  <div className="hc-entry__head">
                    <span className="hc-entry__author">{row.displayName || t("home_care.import.no_name")}</span>
                    <span className={`hc-badge${row.status === ClientImportStatus.ERROR ? " hc-badge--warn" : ""}`}>
                      {t(`home_care.import.status.${row.status}`)}
                    </span>
                  </div>
                  <p className="hc-entry__meta">
                    {t("home_care.import.row_line", { line: row.line })}
                    {row.internalCode ? ` · ${row.internalCode}` : ""}
                  </p>
                  {row.status === ClientImportStatus.ERROR ? (
                    <p className="hc-entry__meta">{t(row.errorKey || "home_care.errors.import_row_invalid")}</p>
                  ) : null}
                  {row.status === ClientImportStatus.SAME_NAME ? (
                    <label className="hc-check">
                      <input
                        type="checkbox"
                        checked={confirmed.includes(row.line)}
                        onChange={() => toggleConfirmed(row.line)}
                      />
                      <span>{t("home_care.import.confirm_same_name")}</span>
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {newRows.length > 0 ? (
            <>
              <div className="hc-row">
                <button
                  className="hc-btn hc-btn--quiet"
                  type="button"
                  onClick={() => setShowNew((current) => !current)}
                  aria-expanded={showNew}
                >
                  {showNew ? t("home_care.import.hide_new") : t("home_care.import.show_new", { count: newRows.length })}
                </button>
              </div>
              {showNew ? (
                <ul className="hc-list hc-list--plain">
                  {newRows.map((row) => (
                    <li key={row.line} className="hc-entry__meta">
                      {row.displayName}
                      {row.internalCode ? ` · ${row.internalCode}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {apply.error ? (
            <p className="hc-error" role="alert">
              {apply.error}
            </p>
          ) : null}
          {context.writable ? null : <p className="hc-hint">{t("home_care.client.read_only")}</p>}

          <div className="hc-row">
            <button
              className="hc-btn hc-btn--primary"
              type="button"
              onClick={runApply}
              disabled={busy || willCreate === 0 || !context.writable}
            >
              {t("home_care.import.apply", { count: willCreate })}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
