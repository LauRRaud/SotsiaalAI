"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Erijuhtumi KÄIK: täiendused, seisumuutused ja vastutaja ajajärjestuses.
 *
 * Kirje teksti täiendus ei muuda. Hooldusjuht näeb kogu käiku ja määrab
 * vastutaja; autor näeb ja lisab oma täiendusi (hooldusjuhi märkmeid talle ei
 * näidata, sest seal võib olla info, mis ei ole kogu meeskonna jaoks).
 *
 * Käik laaditakse alles avamisel: päevikus võib olla kümneid erijuhtumeid ja
 * enamikku neist parajasti ei vaadata.
 *
 * Konks hoiab olekut ja päringuid; vaated on avatud kirjes kliendi lehel
 * (`./EntryOpen.jsx`) ja kirje real mitme kliendi loendis
 * (`../HomeCareIncidentTrail.jsx`).
 */
export function useIncidentTrail({ organizationId, entry, canWrite, isCoordinator, onEntryChange }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState(null);
  const [text, setText] = useState("");
  const [assignees, setAssignees] = useState(null);
  /* Sama täienduse korduskatsel läheb teele sama võti; teksti muutmine teeb uue. */
  const attemptRef = useRef(null);

  const base = `${homeCareBase(organizationId)}/kliendid/${entry.clientId}/kirjed/${entry.id}`;
  const retracted = Boolean(entry.retractedAt);
  const assigneeId = entry.incident?.assignee?.membershipId || "";

  const load = useCallback(async () => {
    const result = await call(`${base}/kaik`, { fallbackKey: "home_care.errors.list_failed" });
    setUpdates(result.ok ? result.data.updates || [] : null);
  }, [base, call]);

  /* Seisu või vastutaja muutus (ka kirje enda tegevustest) lisab käiku rea. Lahtine
     käik laaditakse siis uuesti, muidu jääks uus rida ja sulgemise selgitus
     nägemata, kuni käik suletakse ja avatakse. */
  const trailKey = `${entry.incident?.status || ""}|${assigneeId}`;
  const seenKey = useRef(trailKey);
  useEffect(() => {
    if (seenKey.current === trailKey) return;
    seenKey.current = trailKey;
    if (open) load();
  }, [trailKey, open, load]);

  const show = async () => {
    setOpen(true);
    await load();
    if (isCoordinator && canWrite && !assignees) {
      const result = await call(`${base}/vastutaja`, { fallbackKey: "home_care.errors.list_failed" });
      if (result.ok) setAssignees(result.data.assignees || []);
    }
  };

  const hide = () => setOpen(false);

  const add = async (event) => {
    event?.preventDefault();
    if (attemptRef.current?.text !== text) attemptRef.current = { text, key: newClientActionKey() };
    const result = await call(`${base}/kaik`, {
      method: "POST",
      body: { text, clientRequestId: attemptRef.current.key },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      const saved = result.data.update;
      setUpdates((current) => [...(current || []).filter((item) => item.id !== saved.id), saved]);
      setText("");
      attemptRef.current = null;
    }
    return result.ok;
  };

  const assign = async (membershipId) => {
    if ((membershipId || "") === assigneeId) return true;
    const result = await call(`${base}/vastutaja`, {
      method: "POST",
      body: { membershipId: membershipId || null },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      /* Käik laaditakse uuesti siis, kui kirje uus vastutaja siia jõuab (vt efekt ülal). */
      onEntryChange?.(result.data.entry);
    }
    return result.ok;
  };

  return { busy, error, setError, open, updates, text, setText, assignees, retracted, assigneeId, show, hide, add, assign };
}
