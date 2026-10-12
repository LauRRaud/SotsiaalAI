"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Uksesilt: olek ja päringud. Vaated on failis ./DoorTagViews.jsx ja ühised
 * (../client/PartViews.jsx), kokku paneb need ./DoorTag.jsx.
 */
export function useDoorTag({ organizationId, client, initialTag }) {
  const { call, busy, error, setError } = useHomeCareApi();
  const base = `${homeCareBase(organizationId)}/kliendid/${client.id}/silt`;

  const [tag, setTag] = useState(initialTag || null);
  const [copied, setCopied] = useState(false);

  /* Tagastab true, kui silt on tehtud. */
  const issue = async () => {
    setCopied(false);
    const result = await call(base, { method: "POST", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTag(result.data.tag);
    return result.ok;
  };

  /* Tagastab true, kui silt on tühistatud. */
  const revoke = async () => {
    const result = await call(base, { method: "DELETE", fallbackKey: "home_care.errors.save_failed" });
    if (result.ok) setTag(null);
    return result.ok;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tag.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return { tag, base, copied, issue, revoke, copy, busy, error, setError };
}
