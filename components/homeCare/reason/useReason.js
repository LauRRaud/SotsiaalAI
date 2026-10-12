"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { DEFAULT_REASON_CODE } from "./reasonRows";

/**
 * Põhjuse küsimine meeskonda mittekuuluvalt hooldajalt: olek ja päring. Vaade on
 * ühine (../client/PartViews.jsx), kokku paneb need ./ClientReason.jsx.
 *
 * `onGranted`: põhjus on antud, leht laeb sisu (või jätkab lahti olevat lehte).
 */
export function useReason({ organizationId, clientId, onGranted }) {
  const { call, busy, error } = useHomeCareApi();
  const [reasonCode, setReasonCode] = useState(DEFAULT_REASON_CODE);
  const [reasonText, setReasonText] = useState("");

  const submit = async () => {
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${clientId}/ava`, {
      method: "POST",
      body: { reasonCode, reason: reasonText },
      fallbackKey: "home_care.errors.open_failed"
    });
    if (result.ok) await onGranted?.();
    return result.ok;
  };

  return { reasonCode, setReasonCode, reasonText, setReasonText, submit, busy, error };
}
