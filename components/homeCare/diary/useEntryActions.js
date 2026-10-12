"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { entryRights } from "./entryOpen";

/**
 * Ühe päevikukirje TEGEVUSED: tühistamine, erijuhtumi seis ja varasem sisu.
 *
 * Konks hoiab seda, mis ei ole joonistamine: avatud vormi, põhjuse ja selgituse
 * teksti, laaditud ajaloo ja päringud. Vaated on eraldi: avatud kirje kliendi
 * lehel (`./EntryOpen.jsx`), samuti erijuhtumite registris ja hooldusjuhi
 * ülevaates (`showClient`: kirje on mitme kliendi loendis).
 *
 * KIRJET EI KUSTUTATA. Tühistatud kirje jääb oma kohale ilma tekstita ja
 * parandatud kirjel on märge; varasemat sisu näevad autor ja hooldusjuht.
 * Kes mida teha tohib, ütleb `entryRights` (./entryOpen.js); server keelab sama.
 *
 * `mode`: null | "retract" | "close" | "history" (mis vorm või loend on lahti).
 */
export function useEntryActions({ organizationId, entry, canWrite = false, isCoordinator = false, showClient = false, onChange }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [revisions, setRevisions] = useState(null);

  const clientId = entry.clientId;
  const base = `${homeCareBase(organizationId)}/kliendid/${clientId}/kirjed/${entry.id}`;
  const rights = entryRights(entry, { canWrite, isCoordinator, showClient });

  const close = () => {
    setMode(null);
    setReason("");
    setNote("");
    setError("");
  };

  const retract = async (event) => {
    event?.preventDefault();
    const result = await call(`${base}/tuhista`, {
      method: "POST",
      body: { reason, revision: entry.revision },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange?.(result.data.entry);
      close();
    }
    return result.ok;
  };

  const setIncidentStatus = async (status, withNote = "") => {
    const result = await call(`${base}/juhtum`, {
      method: "POST",
      body: { status, note: withNote },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) {
      onChange?.(result.data.entry);
      close();
    }
    return result.ok;
  };

  /* Varasem sisu laaditakse alles avamisel. */
  const openHistory = async () => {
    setMode("history");
    const result = await call(`${base}/ajalugu`, { fallbackKey: "home_care.errors.list_failed" });
    setRevisions(result.ok ? result.data.revisions || [] : null);
  };

  return { busy, error, setError, mode, setMode, reason, setReason, note, setNote, revisions, clientId, rights, close, retract, setIncidentStatus, openHistory };
}
