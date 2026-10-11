"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HISTORY_MAX_CHARS, HISTORY_TITLE_MAX } from "@/lib/homeCare/historyLimits";

import { formatDateTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Kliendi varasem ajalugu teisest kohast (näiteks senine Drive'i päevik).
 *
 * Tekst on üle toodud ühe dokumendina ja on siin lugemiseks ja otsimiseks.
 * Märge „autorid ja ajad kontrollimata" on iga ajaloo juures: need ei ole
 * päeviku kirjed ega lähe kronoloogiasse.
 *
 * Tekst laaditakse alles siis, kui inimene selle avab, lehekülgede kaupa.
 * Üle toob ja eemaldab hooldusjuht; eemaldamine on kahe sammuga.
 */
export default function HomeCareHistory({
  organizationId,
  clientId,
  histories,
  timeZone,
  isCoordinator,
  canWrite,
  onChange
}) {
  const { t } = useI18n();
  const reader = useHomeCareApi();
  const writer = useHomeCareApi();
  const fieldId = useId();
  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/ajalugu`;

  /* historyId -> { blocks, hasMore, nextAfter } */
  const [open, setOpen] = useState({});
  const [confirming, setConfirming] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [fileNote, setFileNote] = useState("");

  const load = async (historyId, after = 0) => {
    const result = await reader.call(`${base}/${historyId}?after=${after}`, { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return;
    setOpen((current) => ({
      ...current,
      [historyId]: {
        blocks: [...(after ? current[historyId]?.blocks || [] : []), ...result.data.blocks],
        hasMore: result.data.hasMore,
        nextAfter: result.data.nextAfter
      }
    }));
  };

  const toggle = (historyId) => {
    if (open[historyId]) {
      setOpen((current) => {
        const next = { ...current };
        delete next[historyId];
        return next;
      });
      return;
    }
    load(historyId);
  };

  const remove = async (historyId) => {
    setConfirming("");
    const result = await writer.call(`${base}/${historyId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) onChange?.(histories.filter((history) => history.id !== historyId));
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    /* Hiigelfaili ei loeta mällu: üks märk on kuni neli baiti. */
    if (file.size > HISTORY_MAX_CHARS * 4) {
      setFileNote(t("home_care.errors.history_too_large"));
      return;
    }
    try {
      const content = await file.text();
      setFileNote(content.includes("\uFFFD") ? t("home_care.import.file_encoding") : "");
      setText(content);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, HISTORY_TITLE_MAX));
    } catch {
      setFileNote(t("home_care.import.file_failed"));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const result = await writer.call(base, {
      method: "POST",
      body: { title, text },
      fallbackKey: "home_care.errors.import_failed"
    });
    if (!result.ok) return;
    onChange?.([...histories, result.data.history]);
    setAdding(false);
    setTitle("");
    setText("");
    setFileNote("");
  };

  if (histories.length === 0 && !(isCoordinator && canWrite)) return null;
  const tooLong = text.length > HISTORY_MAX_CHARS;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.history.title")}
      </h2>

      {histories.length === 0 ? <p className="hc-sub">{t("home_care.history.empty")}</p> : null}

      {histories.length > 0 ? (
        <ul className="hc-list hc-list--plain">
          {histories.map((history) => {
            const state = open[history.id];
            return (
              <li key={history.id} className="hc-entry">
                <div className="hc-entry__head">
                  <span className="hc-entry__author">{history.title}</span>
                  <span className="hc-badge hc-badge--warn">{t("home_care.history.mark")}</span>
                </div>
                <p className="hc-entry__meta">
                  {t("home_care.history.meta", {
                    time: formatDateTime(history.createdAt, timeZone),
                    name: history.importedByName,
                    count: history.charCount
                  })}
                </p>
                <div className="hc-row">
                  <button
                    className="hc-btn hc-btn--quiet"
                    type="button"
                    onClick={() => toggle(history.id)}
                    aria-expanded={Boolean(state)}
                    disabled={reader.busy}
                  >
                    {state ? t("home_care.history.hide") : t("home_care.history.show")}
                  </button>
                  {isCoordinator && canWrite ? (
                    confirming === history.id ? (
                      <>
                        <button className="hc-btn hc-btn--danger" type="button" onClick={() => remove(history.id)} disabled={writer.busy}>
                          {t("home_care.history.remove_confirm")}
                        </button>
                        <button className="hc-btn" type="button" onClick={() => setConfirming("")}>
                          {t("home_care.outbox.keep")}
                        </button>
                      </>
                    ) : (
                      <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirming(history.id)}>
                        {t("home_care.history.remove")}
                      </button>
                    )
                  ) : null}
                </div>
                {state ? (
                  <>
                    {state.blocks.map((block) => (
                      <p key={block.position} className="hc-entry__text">
                        {block.text}
                      </p>
                    ))}
                    {state.hasMore ? (
                      <div className="hc-row">
                        <button className="hc-btn" type="button" onClick={() => load(history.id, state.nextAfter)} disabled={reader.busy}>
                          {t("home_care.filter.more")}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {reader.error ? (
        <p className="hc-error" role="alert">
          {reader.error}
        </p>
      ) : null}

      {isCoordinator && canWrite && !adding ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setAdding(true)}>
            {t("home_care.history.add")}
          </button>
        </div>
      ) : null}

      {adding ? (
        <form className="hc-form" onSubmit={submit}>
          <p className="hc-hint">{t("home_care.history.add_hint")}</p>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-name`}>
              {t("home_care.history.name_label")}
            </label>
            <input
              id={`${fieldId}-name`}
              className="hc-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={HISTORY_TITLE_MAX}
              required
              autoComplete="off"
              aria-describedby={`${fieldId}-name-hint`}
            />
            <p className="hc-hint" id={`${fieldId}-name-hint`}>
              {t("home_care.history.name_hint")}
            </p>
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-text`}>
              {t("home_care.history.text_label")}
            </label>
            <textarea
              id={`${fieldId}-text`}
              className="hc-textarea"
              value={text}
              onChange={(event) => {
                setFileNote("");
                setText(event.target.value);
              }}
              rows={8}
              required
            />
          </div>
          <div className="hc-field">
            <label className="hc-label" htmlFor={`${fieldId}-file`}>
              {t("home_care.history.file_label")}
            </label>
            <input id={`${fieldId}-file`} className="hc-input" type="file" accept=".txt,.md,text/plain" onChange={readFile} />
            {fileNote ? (
              <p className="hc-notice hc-notice--warn" role="status">
                {fileNote}
              </p>
            ) : null}
          </div>
          {tooLong ? <p className="hc-notice hc-notice--warn">{t("home_care.errors.history_too_large")}</p> : null}
          {writer.error ? (
            <p className="hc-error" role="alert">
              {writer.error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={writer.busy || tooLong || !text.trim() || !title.trim()}>
              {t("home_care.history.save")}
            </button>
            <button className="hc-btn" type="button" onClick={() => setAdding(false)} disabled={writer.busy}>
              {t("home_care.entry.cancel")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
