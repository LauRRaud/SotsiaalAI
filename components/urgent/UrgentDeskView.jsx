"use client";

/**
 * SK-V1 E4 — vastuvõtu laud ja koondvaade.
 *
 * Kolm asja, mis on siin arhitektuur, mitte kujundus:
 *
 *   1. **Üks järjekord, kaks allikat, ajaline järjestus.** Kiireloomuline
 *      abipalve ja eelpöördumine seisavad koos, sest eraldi objekt tähendaks
 *      muidu, et lühike ärev teade maandub postkasti, mida keegi ei ava.
 *      Järjestus on ainult ajaline — skoori ega prioriteeti siin ei ole.
 *   2. **Verbatim ja mustand seisavad KÕRVUTI ja märgistatult.** „Ma ei tea,
 *      mis ma teen" ja „isik väljendas ebakindlust" ei ole sama teade, ja
 *      kokkuvõte ei tohi kunagi seista inimese sõnade ASEMEL.
 *   3. **„Loetud" on teadlik toiming, mitte kuvamise kõrvalmõju.** Automaatne
 *      märkimine tähendaks, et lugemisaja lubadus täitub ilma, et keegi teksti
 *      loeks.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function txt(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function dateTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
}

function RequestDetail({ t, locale, request, trail, onAction, busy }) {
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  if (!request) return null;

  return (
    <section aria-labelledby="urgent-detail-title">
      <h3 id="urgent-detail-title">{txt(t, "urgent.desk_queue.request.verbatim_label", "Inimese enda sõnad")}</h3>
      {/* Ainus koht, kust vastuvõtja sisu loeb. */}
      <blockquote>{request.situationVerbatim}</blockquote>
      <p><small>{txt(t, "urgent.desk_queue.request.verbatim_note", "See tekst on muutmata.")}</small></p>

      {request.assistantStructured ? (
        <>
          <h4>{txt(t, "urgent.desk_queue.request.assistant_label", "AI koostatud mustand")}</h4>
          <p><small>{txt(t, "urgent.desk_queue.request.assistant_note", "Masina mustand. Ei ole inimese ütlus.")}</small></p>
          <blockquote>{request.assistantStructured}</blockquote>
        </>
      ) : null}

      <dl>
        <div>
          <dt>{txt(t, "urgent.desk_queue.request.contact", "Kontakt")}</dt>
          <dd>{request.contactName} · {request.contactPhone}</dd>
        </div>
        <div>
          <dt>{txt(t, "urgent.desk_queue.request.promise", "Lubatud lugemisaeg")}</dt>
          <dd>{request.readingTimePromise}</dd>
        </div>
      </dl>

      <div>
        <Button type="button" disabled={busy} onClick={() => onAction(request.id, "read")}>
          {txt(t, "urgent.desk_queue.actions.mark_read", "Märgi loetuks")}
        </Button>
        <Button type="button" disabled={busy} onClick={() => onAction(request.id, "take")}>
          {txt(t, "urgent.desk_queue.actions.take", "Võtan")}
        </Button>
        <Button type="button" disabled={busy} onClick={() => onAction(request.id, "resolve")}>
          {txt(t, "urgent.desk_queue.actions.resolve", "Lõpeta")}
        </Button>
      </div>

      {/* Keeldumine on kohustuslik rada ja põhjus on kohustuslik väli.
          Inimene näeb seda teksti — see ongi tema vastus. */}
      <label>
        <span>{txt(t, "urgent.desk_queue.decline.reason_label", "Miks ei jõua? Inimene näeb seda.")}</span>
        <Input value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <Button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={() => onAction(request.id, "decline", { reason })}
      >
        {txt(t, "urgent.desk_queue.actions.decline", "Ei jõua")}
      </Button>

      <label>
        <span>{txt(t, "urgent.desk_queue.handover.target_label", "Kellele annad üle?")}</span>
        <Input value={target} onChange={(event) => setTarget(event.target.value)} />
      </label>
      <label>
        <span>{txt(t, "urgent.desk_queue.handover.note_label", "Mida vastuvõtja peab teadma?")}</span>
        <Input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <Button
        type="button"
        disabled={busy || !target.trim()}
        onClick={() => onAction(request.id, "handover", { targetDeskId: target, note })}
      >
        {txt(t, "urgent.desk_queue.actions.handover", "Anna üle")}
      </Button>

      <h4>{txt(t, "urgent.desk_queue.trail.title", "Vastutusjälg")}</h4>
      <ol>
        {trail.map((event) => (
          <li key={event.id}>
            {txt(t, `urgent.desk_queue.trail.kinds.${event.kind}`, event.kind)} · {dateTime(event.at, locale)}
            {event.note ? ` · ${event.note}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function UrgentDeskView() {
  const { t, locale } = useI18n();
  const [desks, setDesks] = useState([]);
  const [deskId, setDeskId] = useState("");
  const [queue, setQueue] = useState(null);
  const [openRequest, setOpenRequest] = useState(null);
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDesks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/urgent-requests/desk-queue", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload?.desks) ? payload.desks : [];
      setDesks(rows);
      if (rows.length && !deskId) setDeskId(rows[0].id);
    } catch {
      setDesks([]);
    } finally {
      setLoading(false);
    }
  }, [deskId]);

  const loadQueue = useCallback(async (id) => {
    if (!id) return;
    setError("");
    try {
      const response = await fetch(`/api/urgent-requests/desk-queue?deskId=${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(txt(t, "urgent.desk_queue.errors.load_failed", "Laadimine ebaõnnestus."));
      setQueue(payload?.queue || null);
    } catch (loadError) {
      setQueue(null);
      setError(loadError?.message || txt(t, "urgent.desk_queue.errors.load_failed", "Laadimine ebaõnnestus."));
    }
  }, [t]);

  useEffect(() => {
    void loadDesks();
  }, [loadDesks]);

  useEffect(() => {
    void loadQueue(deskId);
  }, [deskId, loadQueue]);

  async function openDetail(requestId) {
    setError("");
    try {
      // Avamine käib marsruuti mööda, mis JÄTAB JÄLJE. „Ma ainult vaatasin" ei
      // ole erand — KOV-lepingu p 8 seob iga vaatamise inimese ja kellaajaga.
      const [detailResponse, trailResponse] = await Promise.all([
        fetch(`/api/urgent-requests/${encodeURIComponent(requestId)}`, { cache: "no-store" }),
        fetch(`/api/urgent-requests/${encodeURIComponent(requestId)}/trail`, { cache: "no-store" })
      ]);
      const detail = await detailResponse.json().catch(() => ({}));
      const trailPayload = await trailResponse.json().catch(() => ({}));
      if (!detailResponse.ok) throw new Error(txt(t, "urgent.desk_queue.errors.load_failed", "Laadimine ebaõnnestus."));
      setOpenRequest(detail?.request || null);
      setTrail(Array.isArray(trailPayload?.trail) ? trailPayload.trail : []);
    } catch (detailError) {
      setError(detailError?.message || txt(t, "urgent.desk_queue.errors.load_failed", "Laadimine ebaõnnestus."));
    }
  }

  async function act(requestId, action, body) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/urgent-requests/${encodeURIComponent(requestId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || txt(t, "urgent.desk_queue.errors.action_failed", "Toiming ebaõnnestus."));
      if (payload?.request) setOpenRequest(payload.request);
      await loadQueue(deskId);
      await openDetail(requestId);
    } catch (actError) {
      setError(actError?.message || txt(t, "urgent.desk_queue.errors.action_failed", "Toiming ebaõnnestus."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">{txt(t, "admin.common.loading_data", "Laen andmeid...")}</p>;

  if (!desks.length) {
    return (
      <section>
        <h2>{txt(t, "urgent.desk_queue.title", "Kiireloomuline vastuvõtt")}</h2>
        <p>{txt(t, "urgent.desk_queue.no_desks", "Sa ei istu ühegi kiireloomulise vastuvõtu laua taga.")}</p>
      </section>
    );
  }

  const desk = desks.find((row) => row.id === deskId) || null;

  return (
    <section aria-labelledby="urgent-desk-title">
      <h2 id="urgent-desk-title">{txt(t, "urgent.desk_queue.title", "Kiireloomuline vastuvõtt")}</h2>
      <p>{txt(t, "urgent.desk_queue.lead", "Kaua oodanud on ees.")}</p>
      <p><small>{txt(t, "urgent.desk_queue.promise_note", "Lugemisaja lubadust kannab ainult kiireloomuline abipalve.")}</small></p>

      {desks.length > 1 ? (
        <label>
          <span>{txt(t, "urgent.desk_queue.columns.kind", "Allikas")}</span>
          <select value={deskId} onChange={(event) => setDeskId(event.target.value)}>
            {desks.map((row) => (
              <option key={row.id} value={row.id}>{row.publicName}</option>
            ))}
          </select>
        </label>
      ) : null}

      {desk && !desk.isActive ? (
        <p role="status">{txt(t, "urgent.desk_queue.desk_closed", "See laud on praegu suletud.")}</p>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      {queue?.incomingHandovers?.length ? (
        <section aria-labelledby="urgent-handovers-title">
          <h3 id="urgent-handovers-title">{txt(t, "urgent.desk_queue.handover.title", "Saabunud üleandmised")}</h3>
          <ul>
            {queue.incomingHandovers.map((row) => (
              <li key={row.id}>
                <span>{dateTime(row.handedOverAt, locale)}</span>
                {row.handoverNote ? <span> · {row.handoverNote}</span> : null}
                <Button type="button" disabled={busy} onClick={() => void act(row.id, "handover-accept")}>
                  {txt(t, "urgent.desk_queue.actions.accept_handover", "Võta üleandmine vastu")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {queue?.items?.length ? (
        <table>
          <caption>{txt(t, "urgent.desk_queue.table_caption", "Vastuvõtu järjekord")}</caption>
          <thead>
            <tr>
              <th scope="col">{txt(t, "urgent.desk_queue.columns.kind", "Allikas")}</th>
              <th scope="col">{txt(t, "urgent.desk_queue.columns.received", "Saabus")}</th>
              <th scope="col">{txt(t, "urgent.desk_queue.columns.status", "Seis")}</th>
              <th scope="col">{txt(t, "urgent.desk_queue.columns.promise", "Lugemisaeg")}</th>
              <th scope="col">{txt(t, "urgent.desk_queue.columns.actions", "Toimingud")}</th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((item) => (
              <tr key={`${item.kind}-${item.id}`}>
                <td>{txt(t, `urgent.desk_queue.kinds.${item.kind}`, item.kind)}</td>
                <td>{dateTime(item.receivedAt, locale)}</td>
                <td>
                  {txt(t, `urgent.status.${item.status}`, item.status)}
                  {item.overdue ? ` · ${txt(t, "urgent.desk_queue.overdue_badge", "Üle lubatud aja")}` : ""}
                </td>
                {/* Tühi lahter EI ole puuduv andmeväli: eelpöördumine ei kanna
                    lugemisaja lubadust ja seda ei tohi teise rea omaga täita. */}
                <td>{item.readingTimePromise || ""}</td>
                <td>
                  {item.kind === "URGENT_REQUEST" ? (
                    <Button type="button" onClick={() => void openDetail(item.id)}>
                      {txt(t, "urgent.desk_queue.open", "Ava")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p role="status">{txt(t, "urgent.desk_queue.empty", "Järjekord on tühi.")}</p>
      )}

      <RequestDetail
        t={t}
        locale={locale}
        request={openRequest}
        trail={trail}
        busy={busy}
        onAction={(id, action, body) => void act(id, action, body)}
      />
    </section>
  );
}
