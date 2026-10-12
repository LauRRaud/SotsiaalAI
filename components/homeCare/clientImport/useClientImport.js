"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CLIENT_IMPORT_MAX_CHARS } from "@/lib/homeCare/clientTable";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Klientide sissetoomine tabelist: tekst, kontroll ja sissetoomine. Vaated on
 * ühised (../client/PartViews.jsx), kokku paneb need ./ClientImport.jsx.
 *
 * Tabel jääb brauserisse, kuni hooldusjuht vajutab nuppu; faili ei laeta üles, vaid
 * loetakse siinsamas tekstiks. Kontrollil ja sissetoomisel on oma viga (`check`,
 * `apply`), et ühe viga ei kataks teist.
 */
export function useClientImport({ organizationId, units, unitRequired }) {
  const { t } = useI18n();
  const check = useHomeCareApi();
  const apply = useHomeCareApi();

  const [text, setText] = useState("");
  const [unitId, setUnitId] = useState(unitRequired && units.length === 1 ? units[0].id : "");
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState([]);
  const [fileNote, setFileNote] = useState("");
  const [done, setDone] = useState(null);

  const invalidate = () => {
    setPreview(null);
    setConfirmed([]);
    setDone(null);
    check.setError("");
    apply.setError("");
  };

  /* Teksti või üksuse muutmine tühistab eelvaate. */
  const changeText = (value) => {
    invalidate();
    setFileNote("");
    setText(value);
  };
  const changeUnit = (value) => {
    invalidate();
    setUnitId(value);
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
      setFileNote(content.includes("�") ? t("home_care.import.file_encoding") : "");
      setText(content);
    } catch {
      setFileNote(t("home_care.import.file_failed"));
    }
  };

  const body = () => ({ text, unitId: unitId || null });

  /* Tagastab true, kui eelvaade on olemas. */
  const runCheck = async () => {
    setDone(null);
    setConfirmed([]);
    const result = await check.call(`${homeCareBase(organizationId)}/kliendid/sissetoomine/eelvaade`, {
      method: "POST",
      body: body(),
      fallbackKey: "home_care.errors.import_failed"
    });
    setPreview(result.ok ? result.data.preview : null);
    return result.ok;
  };

  /* Tagastab "done" (kliendid on üle toodud), "conflict" (nimekiri muutus vahepeal, eelvaade ei kehti) või "failed". */
  const runApply = async () => {
    const result = await apply.call(`${homeCareBase(organizationId)}/kliendid/sissetoomine`, {
      method: "POST",
      body: { ...body(), confirmedLines: confirmed },
      fallbackKey: "home_care.errors.import_failed"
    });
    if (!result.ok) {
      /* Nimekiri muutus vahepeal: eelvaade ei kehti enam. */
      if (result.status === 409) {
        setPreview(null);
        return "conflict";
      }
      return "failed";
    }
    setDone({ created: result.data.created });
    setPreview(null);
    setConfirmed([]);
    setText("");
    setFileNote("");
    return "done";
  };

  const toggleConfirmed = (line) => {
    setConfirmed((current) => (current.includes(line) ? current.filter((value) => value !== line) : [...current, line]));
  };

  return {
    text, changeText, unitId, changeUnit, preview, confirmed, toggleConfirmed, fileNote, done, readFile, runCheck, runApply,
    busy: check.busy || apply.busy,
    error: check.error || apply.error,
    clearError: () => {
      check.setError("");
      apply.setError("");
    }
  };
}
