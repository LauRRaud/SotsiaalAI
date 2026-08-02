"use client";

/**
 * TEENUSPÄEVIK — kuuaruande jagamine juhile (E10a, saatja pool).
 *
 * MIKS SEE PLOKK ON OLEMAS. Kodukülastusel käiv koduhooldaja või sotsiaaltöötaja
 * ei tööta üksi: tema tulemus läheb osakonna juhatajale või vastutavale isikule.
 * Kuni siiani lõppes teenuspäevik allalaadimisega ja see samm oli inimese enda
 * mure — e-kiri, mälupulk, „ma saatsin vist".
 *
 * KOLM REEGLIT UI-s:
 *
 * 1. SAADETAKSE ARUANNET, MITTE LIGIPÄÄSU. Juht saab konkreetse faili, mitte
 *    õiguse teenuspäevikusse vaadata.
 *
 * 2. SAAJATE LOEND TULEB SERVERIST. Ta ei ole vaba tekst ega kogu
 *    organisatsiooni nimekiri: server ütleb, kes on selle inimese juht või
 *    üksuse juht. Kliendinimedega aruanne ei liigu „lihtsalt kellelegi".
 *
 * 3. SEIS ON NÄHTAV. „Saadetud" ja „juht avas" on kaks eri asja ja töötaja
 *    peab neid eristama — muidu ei tea ta, kas tema töö jõudis kohale.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

export default function ServiceLogShare({ month, reports = [], onShared }) {
  const { t, locale } = useI18n();
  const [recipients, setRecipients] = useState([]);
  const [shares, setShares] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const response = await fetch(`/api/service-log/report-share?${params}`, {
        headers: { "x-ui-locale": locale || "et" }
      });
      if (!response.ok) return;
      const body = await response.json();
      setRecipients(Array.isArray(body.recipients) ? body.recipients : []);
      setShares(Array.isArray(body.shares) ? body.shares : []);
    } catch {
      /* Vaikne: jagamine on lisavõimalus, mitte kuuvaate eeldus. Tema laadimise
         tõrge ei tohi kuu numbreid ekraanilt ära võtta. */
    }
  }, [locale, month]);

  useEffect(() => {
    load();
  }, [load]);

  /* Kui aruandeid on täpselt üks, on valik mõttetu klikk. */
  useEffect(() => {
    if (reports.length === 1) setDocumentId(reports[0].id);
  }, [reports]);

  const send = useCallback(async () => {
    if (!documentId || !recipientId) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/service-log/report-share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
        body: JSON.stringify({ documentId, recipientMembershipId: recipientId, note })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        /* TÕRGE EI TOHI OLLA VAIKNE. Vajutus „Saada", mille peale ei juhtu
           midagi, jätab töötaja arvama, et aruanne läks teele. */
        setError(body?.message || t("service_log.share.failed", ""));
        return;
      }
      setNote("");
      setNotice(t("service_log.share.sent", ""));
      await load();
      if (typeof onShared === "function") onShared();
    } catch {
      setError(t("service_log.share.failed", ""));
    } finally {
      setSending(false);
    }
  }, [documentId, load, locale, note, onShared, recipientId, t]);

  const recall = useCallback(
    async (shareId) => {
      try {
        const response = await fetch(`/api/service-log/report-share/${shareId}`, {
          method: "DELETE",
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body?.message || t("service_log.share.failed", ""));
          return;
        }
        await load();
      } catch {
        setError(t("service_log.share.failed", ""));
      }
    },
    [load, locale, t]
  );

  /* PLOKKI EI OLE, KUI SAATA EI OLE MIDAGI VÕI KELLELEGI. Tühi vorm, mille
     mõlemad valikud on tühjad, õpetaks kasutajale, et funktsioon on katki. */
  if (!reports.length || !recipients.length) return null;

  return (
    <section className="sl-share">
      <h3 className="sl-list-title">{t("service_log.share.title", "")}</h3>
      <p className="sl-source">{t("service_log.share.intro", "")}</p>

      {reports.length > 1 ? (
        <label className="sl-field">
          <span className="sl-label">{t("service_log.share.report", "")}</span>
          <Dropdown
            name="shareDocument"
            value={documentId}
            onChange={setDocumentId}
            placeholder={t("service_log.share.report_choose", "")}
            options={reports.map((report) => ({
              value: report.id,
              label: `${report.kovName || report.fileName} · ${String(report.format || "").toUpperCase()}`
            }))}
          />
        </label>
      ) : null}

      <label className="sl-field">
        <span className="sl-label">{t("service_log.share.recipient", "")}</span>
        <Dropdown
          name="shareRecipient"
          value={recipientId}
          onChange={setRecipientId}
          placeholder={t("service_log.share.recipient_choose", "")}
          options={recipients.map((person) => ({
            value: person.membershipId,
            /* ROLL ON NIME KÕRVAL. „Kes see Mari on" on täpselt see küsimus,
               mille vale vastus saadab kliendinimed valele inimesele. */
            label: `${person.name} · ${t(`service_log.share.relation.${person.relation}`, person.relation)}`
          }))}
        />
      </label>

      <label className="sl-field">
        <span className="sl-label">{t("service_log.share.note", "")}</span>
        <textarea
          className="sl-input"
          name="shareNote"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {error ? <p className="sl-error">{error}</p> : null}
      {notice ? <p className="sl-source">{notice}</p> : null}

      <Button type="button" onClick={send} disabled={sending || !documentId || !recipientId}>
        {t("service_log.share.send", "")}
      </Button>

      {shares.length ? (
        <ul className="sl-entries">
          {shares.map((share) => (
            <li key={share.id} className="sl-entry">
              <span className="sl-entry-client">{share.recipientName}</span>
              <span className="sl-entry-meta">
                {share.recalledAt
                  ? t("service_log.share.status_recalled", "")
                  : share.openedAt
                    ? t("service_log.share.status_opened", "")
                    : t("service_log.share.status_sent", "")}
              </span>
              {!share.recalledAt ? (
                <button type="button" className="sl-flow-undo" onClick={() => recall(share.id)}>
                  {t("service_log.share.recall", "")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
