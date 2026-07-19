"use client";

import { useState } from "react";

/* T20 COLLAB-P2 — kokkuvõtte kinnitusringi kaart ruumivaates.
 *
 * O-CO-2 = (a): ring on valikuline — kaart ilmub ainult siis, kui jagaja on
 * ringi avanud (summaryApprovals tuleb messages GET-ist). O-CO-5 = (c): klient
 * on adressaat — server ei anna talle canRespond'i ja tema näeb ainult fakti.
 * Üksikvastused (kes + paranduse sisu) on nähtavad AINULT jagajale (server
 * tagastab responses ainult talle). Sama esitusmuster mis RoomCallBar:
 * semantiline HTML, tekst i18n-võtmest fallback'iga. */

function text(t, key, fallback, values = undefined) {
  if (typeof t !== "function") return fallback;
  return values ? t(key, values, fallback) : t(key, fallback);
}

function statusLabel(t, status) {
  if (status === "APPROVED") return text(t, "rooms.summary_approval.status_approved", "Kinnitatud");
  if (status === "CORRECTION") return text(t, "rooms.summary_approval.status_correction", "Parandus saadetud");
  return "";
}

function SummaryApprovalRow({ roomId, summary, t, onResponded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  const respond = async (status) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/summaries/${encodeURIComponent(summary.id)}/approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(status === "CORRECTION" ? { status, note } : { status })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(text(t, "rooms.summary_approval.failed", "Vastuse saatmine ebaõnnestus"));
        return;
      }
      setShowNote(false);
      setNote("");
      if (typeof onResponded === "function") onResponded();
    } catch {
      setError(text(t, "rooms.summary_approval.failed", "Vastuse saatmine ebaõnnestus"));
    } finally {
      setBusy(false);
    }
  };

  const isSharer = summary.isSharer === true;
  const counts = summary.counts || { approved: 0, correction: 0, eligible: 0 };

  return (
    <div>
      <div>
        <strong>{text(t, "rooms.summary_approval.title", "Kokkuvõtte kinnitusring")}</strong>
        {summary.title ? <span> · {summary.title}</span> : null}
      </div>
      <div role="status">
        {text(
          t,
          "rooms.summary_approval.counts",
          `Kinnitanud ${counts.approved}/${counts.eligible}, parandusi ${counts.correction}`,
          { approved: counts.approved, eligible: counts.eligible, correction: counts.correction }
        )}
      </div>

      {summary.myStatus ? (
        <div>
          {text(t, "rooms.summary_approval.my_response", "Sinu vastus")}: {statusLabel(t, summary.myStatus)}
        </div>
      ) : null}

      {summary.canRespond ? (
        <div>
          <button type="button" onClick={() => respond("APPROVED")} disabled={busy}>
            <span>{text(t, "rooms.summary_approval.approve", "Kinnitan")}</span>
          </button>
          <button type="button" onClick={() => setShowNote((value) => !value)} disabled={busy} aria-expanded={showNote}>
            <span>{text(t, "rooms.summary_approval.correction", "Mul on parandus")}</span>
          </button>
          {showNote ? (
            <div>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={4000}
                rows={3}
                aria-label={text(t, "rooms.summary_approval.note_label", "Paranduse sisu")}
                placeholder={text(t, "rooms.summary_approval.note_placeholder", "Kirjelda, mida tuleks parandada")}
              />
              <button type="button" onClick={() => respond("CORRECTION")} disabled={busy || !note.trim()}>
                <span>{text(t, "rooms.summary_approval.send_correction", "Saada parandus")}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isSharer && summary.responses.length ? (
        <ul>
          {summary.responses.map((response) => (
            <li key={response.userId}>
              <span>{response.displayName || text(t, "chat.aria.member", "Liige")}</span>
              {": "}
              <span>{statusLabel(t, response.status)}</span>
              {response.status === "CORRECTION" && response.note ? <div>{response.note}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <div role="alert">{error}</div> : null}
    </div>
  );
}

export default function RoomSummaryApprovalCard({ roomId, summaryApprovals, t, onResponded }) {
  const items = Array.isArray(summaryApprovals) ? summaryApprovals : [];
  if (!roomId || !items.length) return null;
  return (
    <section aria-label={text(t, "rooms.summary_approval.section", "Kokkuvõtte kinnitusring")}>
      {items.map((summary) => (
        <SummaryApprovalRow
          key={summary.id}
          roomId={roomId}
          summary={summary}
          t={t}
          onResponded={onResponded}
        />
      ))}
    </section>
  );
}
