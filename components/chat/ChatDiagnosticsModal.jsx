"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./ChatDiagnosticsModal.module.css";
import { selectDiagnosticReportRow } from "@/lib/chat/ragDiagnostics";
import { diagnosticExplanationRows } from "@/lib/chat/ragDiagnosticExplanation";

export default function ChatDiagnosticsModal({ conversationId, diagnosticRef = null, refreshKey, onClose }) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState(diagnosticRef);
  const endpoint = `/api/chat/conversations/${encodeURIComponent(conversationId)}/diagnostics`;
  const label = key => t(`chat.diagnostics.${key}`);
  const rowKey = row => row.reference;

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError(false);
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("diagnostic_request_failed");
        const data = await response.json();
        if (!data.ok || !Array.isArray(data.report?.rows)) throw new Error("invalid_diagnostic_report");
        if (!controller.signal.aborted) setReport(data.report);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [endpoint, refreshKey, revision]);

  const rows = report?.rows || [];
  const selected = selectDiagnosticReportRow(rows, selection);
  const diagnostic = selected?.diagnostics;
  const decisionRows = diagnosticExplanationRows(diagnostic, label);
  const missingSlots = diagnostic?.evidence.validation.requested_fact_answer_missing_slot_indexes || [];
  const reason = diagnostic?.first_observed_failure?.code;
  const explanationKey = `chat.diagnostics.reasons.${reason}`;
  const explanation = selected?.status_derivation === "lease_expired" ? label("lease_expired") : reason ? t(explanationKey, label("reason_unknown")) : label("no_failure");

  return (
    <Modal open onClose={onClose} className={styles.layer} contentClassName={styles.shell} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{label("eyebrow")}</p><h2 id={titleId}>{label("title")}</h2></div>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className={styles.close}>×</button>
      </header>
      <p className={styles.notice}>{label("boundary")}</p>
      <div className={styles.toolbar}>
        <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>{label("refresh")}</button>
        <a href={`${endpoint}?format=md&lang=${encodeURIComponent(locale || "et")}`} download>{label("download")}</a>
        <span role="status">{busy ? label("loading") : report ? `${rows.length} · ${label("records")}` : ""}</span>
      </div>
      {error ? <p role="alert" className={styles.warning}>{label("error")}</p> : null}
      {report && !report.complete ? <p role="alert" className={styles.warning}>{label("partial_report")}</p> : null}
      {rows.length ? <label className={styles.selectLabel}>
        {label("select_question")}
        <select value={selected ? rowKey(selected) : ""} onChange={event => setSelection(event.target.value)}>
          <option value="">{label("select_question")}</option>
          {rows.map(row => <option key={rowKey(row)} value={rowKey(row)}>{row.number}. {(row.question || label("unpaired")).slice(0, 140)}</option>)}
        </select>
      </label> : !busy && !error ? <p>{label("empty")}</p> : null}
      {selection && !selected && report ? <p className={styles.warning}>{label("missing_reference")}</p> : null}
      {diagnostic ? <article className={styles.record}>
        <div className={styles.summary} data-status={diagnostic.technical_status}>
          <span className={styles.eyebrow}>{label("technical_status")}</span>
          <h3>{t(`chat.diagnostics.status.${diagnostic.technical_status}`)}</h3>
          <p>{explanation}</p>
          {reason ? <code>{reason}</code> : null}
          {missingSlots.length ? <p>{label("missing_slots")}: {missingSlots.join(", ")}. {label("slot_boundary")}</p> : null}
        </div>
        <section><h3>{label("question")}</h3><p className={styles.text}>{selected.question ?? label("unpaired")}</p></section>
        <section aria-label={label("decision_title")}>
          <h3>{label("decision_title")}</h3>
          <p className={styles.text}>{label("decision_boundary")}</p>
          <dl className={styles.sources}>{decisionRows.map(row => <div key={row.key}><dt>{row.label}</dt><dd className={styles.text}>{row.value}</dd></div>)}</dl>
        </section>
        <ol className={styles.stages}>
          {diagnostic.stages.map((stage, index) => <li key={stage.id} data-status={stage.status}>
            <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{t(`chat.diagnostics.stages.${stage.id}`)}</strong><span>{t(`chat.diagnostics.stage_status.${stage.status}`)}</span><code>{stage.code}</code></div>
          </li>)}
        </ol>
        <details><summary>{label("answer")}</summary><p className={styles.text}>{selected.answer ?? label("unpaired")}</p></details>
        <details open><summary>{label("sources")}</summary>
          <dl className={styles.sources}>{Object.entries(diagnostic.evidence.sources).map(([name, ids]) => <div key={name}><dt>{t(`chat.diagnostics.source_layers.${name}`)}</dt><dd>{ids.length ? ids.map(id => <code key={id}>{id}</code>) : "—"}</dd></div>)}</dl>
        </details>
        <details><summary>{label("raw_evidence")}</summary><pre className={styles.json}>{JSON.stringify(diagnostic, null, 2)}</pre></details>
        <footer className={styles.footer}><code>{diagnostic.trace_id || "NOT_PROVEN"}</code><span>{selected.pairing}</span><span>{selected.started_at}</span><p>{label("report_note")}</p></footer>
      </article> : null}
    </Modal>
  );
}
