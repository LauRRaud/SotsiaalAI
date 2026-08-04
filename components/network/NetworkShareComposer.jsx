"use client";

/**
 * COLLAB-P4 — töötaja koostab võrgustikujagamise SEAL, kus ta eelpöördumist loeb.
 *
 * Eraldi komponent, mitte lisa 5000-realisse `WorkspaceFeaturePage`-i: see hoiab
 * suure faili muudatuse mõne reani ja teeb selle loogika omaette loetavaks.
 *
 * Vorm ei küsi klienti. Klient TULETATAKSE lähte-eelpöördumise autorist
 * serveris — töötaja ei saa teda kogemata valesti siduda. Küsitakse ainult
 * kuvanime siis, kui pöördumisel autorit ei ole (väline klient).
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

function txt(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

const EMPTY_DRAFT = {
  recipientEmail: "",
  summaryText: "",
  purpose: "",
  sharingBoundary: "",
  participationEndsOn: "",
  clientDisplayName: ""
};

export default function NetworkShareComposer({ preInquiryId }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  /* Kas pöördumisel on platvormi kasutajast autor, teab SERVER — vorm ei arva.
     Vaikimisi eeldame, et on (tavaline juhtum). Kui server ütleb
     `client_required`, tähendab see, et autorit ei ole, ja alles siis küsime
     kuvanime. Nii ei näe töötaja tavajuhtumil välja lisavälja, mida ta ei vaja. */
  const [needsClientName, setNeedsClientName] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [shares, setShares] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!preInquiryId) return;
    try {
      const res = await fetch("/api/network-shares?role=worker", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) return;
      setShares((payload.shares || []).filter((s) => s.sourcePreInquiryId === preInquiryId));
    } catch {
      /* nimekirja puudumine ei tohi vormi blokeerida */
    }
  }, [preInquiryId]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  const call = useCallback(async (url, body, successKey) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify(body || {})
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok === false) {
        // Autorita pöördumine avastatakse siin: server ütleb, et klienti ei
        // ole, ja alles siis küsime kuvanime.
        if (payload?.message === "network_share.client_required") setNeedsClientName(true);
        throw new Error(resolveApiMessage({
          payload,
          t,
          fallbackKey: "network_share.errors.action_failed"
        }));
      }
      setNotice(txt(t, successKey, ""));
      await load();
      return true;
    } catch (err) {
      setError(err?.message || txt(t, "network_share.errors.action_failed", "Toiming ebaõnnestus."));
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, load, locale, t]);

  const createDraft = useCallback(async () => {
    const ok = await call("/api/network-shares", {
      sourcePreInquiryId: preInquiryId,
      recipientEmail: draft.recipientEmail,
      summaryText: draft.summaryText,
      purpose: draft.purpose,
      sharingBoundary: draft.sharingBoundary,
      participationEndsOn: draft.participationEndsOn,
      clientDisplayName: needsClientName ? draft.clientDisplayName : ""
    }, "network_share.notice.draft_created");
    if (ok) { setDraft(EMPTY_DRAFT); setNeedsClientName(false); }
  }, [call, draft, needsClientName, preInquiryId]);

  if (!preInquiryId) return null;

  return (
    <div>
      <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
        {txt(t, "network_share.actions.toggle", "Kaasa võrgustikku")}
      </Button>

      {open ? (
        <div>
          <p>{txt(t, "network_share.intro", "Koosta kokkuvõte ühele teenuseosutajale. Klient näeb ja kinnitab selle enne saatmist.")}</p>

          {error ? <p role="alert">{error}</p> : null}
          {notice ? <p role="status">{notice}</p> : null}

          <label>
            <span>{txt(t, "network_share.fields.recipient_email", "Saaja e-post (peab olema platvormi kasutaja)")}</span>
            <Input
              type="email"
              value={draft.recipientEmail}
              onChange={(e) => setDraft((d) => ({ ...d, recipientEmail: e.target.value }))}
            />
          </label>

          {needsClientName ? (
            <label>
              <span>{txt(t, "network_share.fields.client_display_name", "Kliendi kuvanimi (initsiaal või roll)")}</span>
              <Input
                value={draft.clientDisplayName}
                onChange={(e) => setDraft((d) => ({ ...d, clientDisplayName: e.target.value }))}
              />
              <small>{txt(t, "network_share.hints.external_client", "Sellel pöördumisel ei ole platvormi kasutajat. Hoia nimi miinimumis ja kanna kliendi otsus hiljem ise üle.")}</small>
            </label>
          ) : null}

          <label>
            <span>{txt(t, "network_share.fields.summary", "Jagatav kokkuvõte")}</span>
            <textarea
              value={draft.summaryText}
              rows={5}
              onChange={(e) => setDraft((d) => ({ ...d, summaryText: e.target.value }))}
            />
            <small>{txt(t, "network_share.hints.summary", "See tekst on see, mida klient kinnitab ja mida saaja näeb. Muutmine pärast kinnitust tühistab kinnituse.")}</small>
          </label>

          <label>
            <span>{txt(t, "network_share.fields.purpose", "Miks see osapool kaasatakse")}</span>
            <Input
              value={draft.purpose}
              onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))}
            />
          </label>

          <label>
            <span>{txt(t, "network_share.fields.boundary", "Jagamispiir — mida jagatakse ja mida mitte")}</span>
            <Input
              value={draft.sharingBoundary}
              onChange={(e) => setDraft((d) => ({ ...d, sharingBoundary: e.target.value }))}
            />
          </label>

          <label>
            <span>{txt(t, "network_share.fields.ends_on", "Kaasamine lõpeb")}</span>
            <Input
              type="date"
              value={draft.participationEndsOn}
              onChange={(e) => setDraft((d) => ({ ...d, participationEndsOn: e.target.value }))}
            />
            <small>{txt(t, "network_share.hints.ends_on", "Kohustuslik. Kaasamine ei tohi kesta määramata ajani.")}</small>
          </label>

          <div>
            <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void createDraft()}>
              {txt(t, "network_share.actions.create", "Loo mustand")}
            </Button>
          </div>

          {shares.length ? (
            <ul>
              {shares.map((share) => (
                <li key={share.id}>
                  <strong>{txt(t, `network_share.status.${share.status}`, share.status)}</strong>
                  {" — "}
                  {share.purpose}
                  {share.status === "DRAFT" ? (
                    <Button type="button" size="sm" disabled={busy}
                      onClick={() => void call(`/api/network-shares/${encodeURIComponent(share.id)}/submit`, {}, "network_share.notice.submitted")}>
                      {txt(t, "network_share.actions.submit", "Saada kliendile ülevaatamiseks")}
                    </Button>
                  ) : null}
                  {share.status === "AWAITING_CLIENT" && share.clientIsExternal ? (
                    <Button type="button" size="sm" disabled={busy}
                      onClick={() => void call(`/api/network-shares/${encodeURIComponent(share.id)}/attest`,
                        { decision: "CONFIRMED", method: "IN_PERSON" }, "network_share.notice.attested")}>
                      {txt(t, "network_share.actions.attest", "Klient kinnitas suuliselt")}
                    </Button>
                  ) : null}
                  {share.status === "CONFIRMED" ? (
                    <Button type="button" size="sm" variant="primary" disabled={busy}
                      onClick={() => void call(`/api/network-shares/${encodeURIComponent(share.id)}/send`, {}, "network_share.notice.sent")}>
                      {txt(t, "network_share.actions.send", "Saada saajale")}
                    </Button>
                  ) : null}
                  {share.status === "SENT" ? (
                    <Button type="button" size="sm" disabled={busy}
                      onClick={() => void call(`/api/network-shares/${encodeURIComponent(share.id)}/recall`, {}, "network_share.notice.recalled")}>
                      {txt(t, "network_share.actions.recall", "Võta tagasi")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
