"use client";

import { useRef, useState } from "react";

import { newClientActionKey } from "@/components/casework/caseWorkClient";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { createBody, initialChoices, selectedItems } from "./chronologyRows";

/**
 * Kronoloogia koostamine: olek ja päringud. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Chronology.jsx.
 *
 * Koostatud dokument on hetkekoopia ja avaneb eraldi vahelehel prinditava lehena
 * (brauser salvestab selle PDF-ina). Dokumendi andmete muutmine pärast koostamist
 * on uus dokument: nupp avaneb uuesti.
 */
export function useChronology({ organizationId, client }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${client.id}/kronoloogia`;

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState(null);
  /* entryId -> { included, text (null = päeviku tekst), editing } */
  const [choices, setChoices] = useState({});
  const [requester, setRequester] = useState("");
  const [basis, setBasis] = useState("");
  const [registryRef, setRegistryRef] = useState("");
  const [summary, setSummary] = useState("");
  const [release, setRelease] = useState(null);
  /* Üks koostamiskatse = üks võti. Sama sisuga uuesti saatmine (topeltklõps,
     võrgu kordus) kasutab sama võtit ja saab sama väljastuse; muudetud sisu on
     uus katse. Tööloend on muutmatu, kaht rida sinna jääda ei tohi. */
  const attemptRef = useRef(null);
  /* Dokumendi andmete muutmine pärast koostamist on uus dokument: nupp avaneb uuesti. */
  const editDetail = (setter) => (value) => {
    setRelease(null);
    setter(value);
  };

  /* Tagastab true, kui kirjed on laaditud. */
  const loadDraft = async () => {
    setRelease(null);
    const result = await call(`${base}/mustand`, {
      method: "POST",
      body: { from, to },
      fallbackKey: "home_care.errors.list_failed"
    });
    if (!result.ok) return false;
    setChoices(initialChoices(result.data.draft.items));
    setDraft(result.data.draft);
    return true;
  };

  const patchChoice = (entryId, patch) => {
    setRelease(null);
    setChoices((current) => ({ ...current, [entryId]: { ...current[entryId], ...patch } }));
  };

  const items = draft?.items || [];
  const selected = selectedItems(items, choices);

  /* Tagastab true, kui dokument on koostatud. */
  const create = async () => {
    const body = createBody(draft, selected, choices, { requester, basis, registryRef, summary });
    const shape = JSON.stringify(body);
    if (attemptRef.current?.shape !== shape) attemptRef.current = { shape, key: newClientActionKey() };
    const result = await call(base, {
      method: "POST",
      body: { ...body, clientRequestId: attemptRef.current.key },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (result.ok) setRelease(result.data.release);
    return result.ok;
  };

  return {
    from,
    to,
    setFrom: (value) => setFrom(value || ""),
    setTo: (value) => setTo(value || ""),
    draft,
    items,
    choices,
    selected,
    details: { requester, basis, registryRef, summary },
    setRequester: editDetail(setRequester),
    setBasis: editDetail(setBasis),
    setRegistryRef: editDetail(setRegistryRef),
    setSummary: editDetail(setSummary),
    release,
    loadDraft,
    patchChoice,
    create,
    busy,
    error,
    setError
  };
}
