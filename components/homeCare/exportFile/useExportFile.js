"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { fileNameFrom, sha256Hex } from "./exportRows";

/**
 * Koduteenuse täielik väljavõte: põhjus, päring ja valmis fail. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./ExportFile.jsx.
 *
 * `done`: { url, name, rows, bytes, sha, verified }. Fail jääb brauseri mällu, kuni
 * leht on avatud või tehakse uus väljavõte; lehelt lahkudes antakse see tagasi.
 * Põhjus jääb valituks, kuni vaade selle uue väljavõtte jaoks tühjendab.
 */
export function useExportFile({ organizationId, initial }) {
  const { t, locale } = useI18n();
  const { call } = useHomeCareApi();

  const [data, setData] = useState(initial);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const fileUrlRef = useRef("");
  /* Topeltklõps ei tohi teha kahte väljavõtet: olek uueneb alles järgmisel joonistusel. */
  const runningRef = useRef(false);

  const releaseFile = () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = "";
  };
  /* Lehelt lahkudes ei jää fail brauseri mällu. */
  useEffect(() => releaseFile, []);

  /* Tagastab true, kui fail on valmis ja kontrollitud. */
  const download = async () => {
    if (runningRef.current || !reason) return false;
    runningRef.current = true;
    setWorking(true);
    setError("");
    setDone(null);
    releaseFile();
    try {
      const response = await fetch(`${homeCareBase(organizationId)}/valjavote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        cache: "no-store",
        body: JSON.stringify({ reasonCode: reason })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(resolveApiMessage({ payload, t, fallbackKey: "home_care.errors.export_failed" }));
        return false;
      }
      const blob = await response.blob();
      const expected = response.headers.get("X-Home-Care-Export-Sha256") || "";
      const expectedBytes = Number(response.headers.get("X-Home-Care-Export-Bytes"));
      /* Suurus ja summa peavad klappima. Puuduv päis on sama mis mitteklappiv:
         server saadab need alati, seega on vastus teel muudetud või poolik. */
      const actual = await sha256Hex(blob);
      if (!expected || !Number.isFinite(expectedBytes) || blob.size !== expectedBytes || (actual && actual !== expected)) {
        setError(t("home_care.export.mismatch"));
        return false;
      }
      fileUrlRef.current = URL.createObjectURL(blob);
      setDone({
        url: fileUrlRef.current,
        name: fileNameFrom(response.headers.get("Content-Disposition")) || "koduteenus-valjavote.json",
        rows: Number(response.headers.get("X-Home-Care-Export-Rows")) || 0,
        bytes: blob.size,
        sha: expected,
        verified: Boolean(actual)
      });
      const fresh = await call(`${homeCareBase(organizationId)}/valjavote`, { quiet: true });
      if (fresh.ok) setData(fresh.data);
      return true;
    } catch {
      setError(t("home_care.errors.export_failed"));
      return false;
    } finally {
      runningRef.current = false;
      setWorking(false);
    }
  };

  return { data, reason, setReason, working, error, setError, done, download };
}
