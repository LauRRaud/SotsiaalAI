"use client";

/**
 * COLLAB-P4 — saaja vaade vastuvõtulaual.
 *
 * Saaja jaoks on saabuv võrgustikujagamine sama kujuga mis saabuv
 * eelpöördumine: midagi tuli, vaja lugeda ja vastata. Seepärast on ta samal
 * laual, mitte omaette postkastis — teine postkast tähendaks, et osutaja peab
 * valvama kahte kohta.
 *
 * Esmane nimekiri kannab ainult ümbrikku. Tundlik `recipientProjection` jõuab
 * brauserisse alles POST /open vastuses, pärast seda, kui server on sama rea
 * avatuks märkinud. Nii ei saa postkasti render ise olla varjatud lugemine.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

function txt(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

export default function NetworkShareInbox() {
  const { t, locale } = useI18n();
  const [shares, setShares] = useState([]);
  const [openedShares, setOpenedShares] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async ({ signal } = {}) => {
    try {
      const res = await fetch("/api/network-shares?role=recipient", { cache: "no-store", signal });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) return;
      setShares(payload.shares || []);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(txt(t, "network_share.errors.action_failed", "Toiming ebaõnnestus."));
      }
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  const markOpened = useCallback(async (share) => {
    if (busyId) return;
    setBusyId(share.id);
    setError("");
    try {
      const res = await fetch(`/api/network-shares/${encodeURIComponent(share.id)}/open`, {
        method: "POST",
        headers: { "x-ui-locale": locale || "et" }
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "network_share.errors.action_failed"
        }));
      }
      if (payload?.share?.id) {
        setOpenedShares((current) => ({ ...current, [payload.share.id]: payload.share }));
        setShares((current) => current.map((item) => (
          item.id === payload.share.id ? { ...item, status: payload.share.status } : item
        )));
      }
    } catch (err) {
      setError(err?.message || txt(t, "network_share.errors.action_failed", "Toiming ebaõnnestus."));
    } finally {
      setBusyId("");
    }
  }, [busyId, locale, t]);

  // Pealkiri elab siin, mitte kutsuja `SectionCard`-is: tühi sektsioon, mille
  // pealkiri on nähtav ja sisu ei ole, on halvem kui sektsiooni puudumine.
  if (!shares.length) return null;

  return (
    <div>
      <h2>{txt(t, "network_share.inbox.title", "Sinuga jagatud võrgustikutöö")}</h2>
      <p>{txt(t, "network_share.inbox.intro", "Sulle on jagatud võrgustikutöö kokkuvõtteid. Näed ainult seda, mis on sinuga jagatud.")}</p>
      {error ? <p role="alert">{error}</p> : null}

      {shares.map((share) => {
        const openedShare = openedShares[share.id] || null;
        return (
        <article key={share.id}>
          <h3>{openedShare?.purpose || txt(t, "network_share.inbox.pending_title", "Sulle saadeti uus jagamine")}</h3>
          {openedShare ? <p>{openedShare.summaryText}</p> : (
            <p>{txt(t, "network_share.inbox.open_to_view", "Sisu kuvatakse pärast teadlikku avamist.")}</p>
          )}

          {openedShare ? <dl>
            <div>
              <dt>{txt(t, "network_share.fields.boundary", "Jagamispiir")}</dt>
              {/* Jagamispiir on saaja jaoks kohustuslik lugemine: ta ütleb,
                  mida temaga EI jagatud ja mida ta seega eeldada ei tohi. */}
              <dd>{openedShare.sharingBoundary}</dd>
            </div>
            <div>
              <dt>{txt(t, "network_share.fields.ends_on", "Kaasamine lõpeb")}</dt>
              <dd>{String(share.participationEndsOn || "").slice(0, 10)}</dd>
            </div>
          </dl> : null}

          <div>
            {!openedShare ? (
              <Button type="button" size="sm" variant="primary" disabled={busyId === share.id}
                onClick={() => void markOpened(share)}>
                {txt(t, "network_share.actions.mark_opened", "Ava jagamine")}
              </Button>
            ) : null}
            {openedShare?.roomId ? (
              <Button as="a" size="sm" href={localizePath(`/ruum/${encodeURIComponent(openedShare.roomId)}`, locale)}>
                {txt(t, "network_share.actions.open_room", "Ava arutelu")}
              </Button>
            ) : null}
          </div>
        </article>
        );
      })}
    </div>
  );
}
