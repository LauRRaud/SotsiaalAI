"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HISTORY_MAX_CHARS, HISTORY_TITLE_MAX } from "@/lib/homeCare/historyLimits";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Kliendi VARASEM AJALUGU teisest kohast (näiteks senine Drive'i päevik): olek
 * ja päringud. Vaated on failis ./HistoryViews.jsx, kokku paneb need
 * ./ImportedHistory.jsx.
 *
 * Tekst on üle toodud ühe dokumendina ja on siin lugemiseks ja otsimiseks.
 * Märge „autorid ja ajad kontrollimata" käib iga ajaloo juurde: need ei ole
 * päeviku kirjed ega lähe kronoloogiasse.
 *
 * Tekst laaditakse alles siis, kui inimene selle avab, lehekülgede kaupa.
 * Üle toob ja eemaldab hooldusjuht.
 */
export function useImportedHistory({ organizationId, clientId, histories, onChange }) {
  const { t } = useI18n();
  const reader = useHomeCareApi();
  const writer = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/ajalugu`;

  /* historyId -> { blocks, hasMore, nextAfter } */
  const [open, setOpen] = useState({});
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

  const remove = async (historyId) => {
    const result = await writer.call(`${base}/${historyId}`, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) onChange?.(histories.filter((history) => history.id !== historyId));
    return result.ok;
  };

  const readFile = async (file) => {
    if (!file) return;
    /* Hiigelfaili ei loeta mällu: üks märk on kuni neli baiti. */
    if (file.size > HISTORY_MAX_CHARS * 4) {
      setFileNote(t("home_care.errors.history_too_large"));
      return;
    }
    try {
      const content = await file.text();
      setFileNote(content.includes("�") ? t("home_care.import.file_encoding") : "");
      setText(content);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, HISTORY_TITLE_MAX));
    } catch {
      setFileNote(t("home_care.import.file_failed"));
    }
  };

  const submit = async (event) => {
    event?.preventDefault();
    const result = await writer.call(base, {
      method: "POST",
      body: { title, text },
      fallbackKey: "home_care.errors.import_failed"
    });
    if (!result.ok) return false;
    onChange?.([...histories, result.data.history]);
    setTitle("");
    setText("");
    setFileNote("");
    return true;
  };

  /* Käsitsi muudetud tekst ei ole enam see fail, mille kohta märkus käis. */
  const typeText = (value) => {
    setFileNote("");
    setText(value);
  };

  return { reader, writer, open, title, setTitle, text, typeText, fileNote, tooLong: text.length > HISTORY_MAX_CHARS, load, remove, readFile, submit };
}
