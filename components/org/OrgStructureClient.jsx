"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgPart from "./OrgPart";
import { StructureBoard, UnitForm } from "./structure/StructureViews";
import { EMPTY_UNIT, canEditStructure, parentOptions, unitDirty, unitProblemKey, unitRow, unitTree, unitTypeOptions } from "./structure/structureRules";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Üksuste puu. Sügavus tuleb serverist (`depth`), mitte kliendi arvutusest.
 *
 * KUJU (11.10). Leht oli kast loendiga ja selle all vorm. Nüüd on ees kas puu
 * (alamüksus oma vanema all) või uue üksuse vorm. Vaated on failis
 * ./structure/StructureViews.jsx, reeglid failis ./structure/structureRules.js;
 * see fail hoiab olekut ja teeb päringud. Arhiveerimine küsib teist vajutust.
 */
export default function OrgStructureClient({ context, initialUnits }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useOrgApi();
  const [units, setUnits] = useState(initialUnits || []);
  const [form, setForm] = useState(EMPTY_UNIT);
  const [mode, setMode] = useState("list");
  /* Mis päring käib: "" | "add" | "archive:<id>". */
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState(null);
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);
  const nameRef = useRef(null);
  const live = useRef(form);
  live.current = form;

  const canEdit = canEditStructure(context);

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${context.organization.id}/units`);
    if (payload?.units) setUnits(payload.units);
  }, [call, context.organization.id]);

  const addUnit = useCallback(async () => {
    const { name, type, parentUnitId } = live.current;
    const payload = await call(`/api/org/${context.organization.id}/units`, {
      method: "POST",
      body: { name, type, parentUnitId: parentUnitId || null },
      fallbackKey: "org.errors.unit_create_failed"
    });
    if (payload) {
      setForm(EMPTY_UNIT);
      setMode("list");
      setNotice({ text: t("org.structure.added", { name: name.trim() }) });
      await reload();
    }
  }, [call, context.organization.id, reload, t]);

  const archive = useCallback(
    async (unitId) => {
      const payload = await call(`/api/org/${context.organization.id}/units/${unitId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.unit_archive_failed"
      });
      if (payload) await reload();
    },
    [call, context.organization.id, reload]
  );

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    setNotice(null);
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const rows = useMemo(() => unitTree(units).map((unit) => unitRow(unit, { t })), [units, t]);
  const types = useMemo(() => unitTypeOptions(t), [t]);
  const parents = useMemo(() => parentOptions(units, t), [units, t]);

  /* Vaate vahetusel (puu ↔ vorm) kaob vajutatud nupp: fookus läheb nime väljale
     või vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== mode;
    shown.current = mode;
    if (first || !moved) return;
    if (mode === "add") nameRef.current?.focus?.({ preventScroll: true });
    else rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [mode]);

  const leaveForm = useCallback(() => {
    setForm(EMPTY_UNIT);
    setMode("list");
    setNotice(null);
    setError("");
  }, [setError]);

  const fault = error ? { tone: "risk", text: error } : notice;

  if (mode === "add" && canEdit) {
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="structure">
          <UnitForm
            t={t}
            form={form}
            onField={(key, value) => {
              setForm((current) => ({ ...current, [key]: value }));
              clearConfirm();
              setNotice(null);
              setError("");
            }}
            types={types}
            parents={parents}
            fieldRef={nameRef}
            notice={fault}
            decline={{
              armed: confirm.armed === "decline",
              onPress: () => {
                if (sending.current) return;
                if (!unitDirty(live.current)) leaveForm();
                else confirm.press("decline", leaveForm);
              }
            }}
            save={{
              busy: busy && pending === "add",
              onSave: () => {
                const problem = unitProblemKey(live.current);
                if (problem) {
                  setNotice({ tone: "risk", text: t(problem) });
                  nameRef.current?.focus?.({ preventScroll: true });
                  return;
                }
                clearConfirm();
                void once("add", addUnit);
              }
            }}
          />
        </OrgPart>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="structure">
        <StructureBoard
          t={t}
          rows={rows}
          add={
            canEdit
              ? {
                  onAdd: () => {
                    clearConfirm();
                    setError("");
                    setNotice(null);
                    setMode("add");
                  }
                }
              : null
          }
          archive={
            canEdit
              ? {
                  armedId: confirm.armed.startsWith("archive:") ? confirm.armed.slice(8) : "",
                  busyId: pending.startsWith("archive:") ? pending.slice(8) : "",
                  onPress: (row) => confirm.press(`archive:${row.id}`, () => once(`archive:${row.id}`, () => archive(row.id))),
                  onCancel: clearConfirm
                }
              : null
          }
          notice={fault}
        />
      </OrgPart>
    </div>
  );
}
