"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Tugivaade.
 *
 * KOLM ASJA ÜHEL LEHEL, sest need kuuluvad inimese jaoks kokku:
 *   1. kellele ma saata saan (ja et valik on MINU, mitte etteantud);
 *   2. mida ma saadan (ja et kinnitus on eraldi tegu);
 *   3. mis mulle on saadetud.
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus: kasutaja peab nägema mustvalgel, et
 * organisatsioon ei tea, kas ta vormi täitis. Seda teadet ei tohi eemaldada.
 */

/**
 * Saaja silt EI TOHI KUNAGI olla ainult „—".
 *
 * Kui inimene ei saa aru, KELLELE ta oma tööheaolu kokkuvõtte saadab, ei ole
 * tema nõusolek teadlik — ja §9 järgi on teadlikkus kogu selle voo eeldus.
 * Server saadab `email`-i ainult siis, kui nimi puudub, seega see rida ei
 * lekita kontaktandmeid nimega liikmete kohta.
 */
function recipientLabel(entry) {
  const name = [entry.firstName, entry.lastName].filter(Boolean).join(" ");
  return name || entry.jobTitle || entry.email || "—";
}
export default function OrgSupportClient({ context, recipients, received, sent }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [recipientMembershipId, setRecipientMembershipId] = useState("");
  const [summary, setSummary] = useState("");
  const [needs, setNeeds] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState("");

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const send = useCallback(
    async (event) => {
      event.preventDefault();
      setDone("");
      const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
        method: "POST",
        body: {
          action: "send",
          recipientMembershipId,
          userConfirmed: confirmed,
          snapshot: {
            summary,
            needs: needs
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          }
        },
        fallbackKey: "org.errors.support_share_failed"
      });
      if (payload) {
        /* Vorm tühjendatakse ENNE laadimist: kui laadimine mingil põhjusel ei
           toimu, ei jää saadetud tekst ekraanile nii, nagu oleks saatmata. */
        setSummary("");
        setNeeds("");
        setConfirmed(false);
        window.location.reload();
      }
    },
    [call, confirmed, needs, organizationId, recipientMembershipId, summary]
  );

  const act = useCallback(
    async (action, shareId) => {
      const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
        method: "POST",
        body: { action, shareId },
        fallbackKey: "org.errors.support_share_failed"
      });
      if (payload) window.location.reload();
    },
    [call, organizationId]
  );

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.support.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.support.intro")}</p>
        <p className="ow-notice ow-notice--privacy">{t("org.support.privacyNotice")}</p>
      </div>

      <section className="ow-card" aria-labelledby="ow-send-support">
        <h3 id="ow-send-support" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.support.recipients")}
        </h3>
        {recipients.length === 0 ? (
          <p className="ow-empty">{t("org.support.noRecipients")}</p>
        ) : writable ? (
          <form onSubmit={send}>
            <div className="ow-grid">
              <label>
                <span className="ow-meta__term">{t("org.support.recipients")}</span>
                <Dropdown
                  required
                  value={recipientMembershipId}
                  onChange={setRecipientMembershipId}
                  ariaLabel={t("org.support.recipients")}
                  placeholder="—"
                  options={recipients.map((entry) => ({
                    value: entry.membershipId,
                    label: `${recipientLabel(entry)} · ${t(
                      entry.contactType === "DIRECT_MANAGER"
                        ? "org.support.directManager"
                        : entry.contactType === "SAFETY_CONTACT"
                          ? "org.support.safety"
                          : "org.support.alternate"
                    )}`
                  }))}
                />
              </label>
              <label>
                <span className="ow-meta__term">{t("org.support.summary")}</span>
                <textarea
                  required
                  rows={3}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
              <label>
                <span className="ow-meta__term">{t("org.support.needs")}</span>
                <textarea
                  rows={3}
                  value={needs}
                  onChange={(event) => setNeeds(event.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            {/* Kinnitus on eraldi TEGU, mitte vaikimisi eeldus (§5.8). */}
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>{t("org.support.confirm")}</span>
            </label>
            <div className="ow-actions">
              {/* Saaja VÄRAV. Varem hoidis seda kinni natiivne `required`
                  valikuväljal; oma valikmenüü juures tuleb värav siia. */}
              <Button type="submit" disabled={busy || !confirmed || !recipientMembershipId}>
                {t("org.support.send")}
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="ow-card" aria-labelledby="ow-received-support">
        <h3 id="ow-received-support" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.support.received")}
        </h3>
        {received.length === 0 ? (
          <p className="ow-empty">{t("org.support.noReceived")}</p>
        ) : (
          <ul className="ow-tree">
            {received.map((share) => (
              <li key={share.id} className="ow-card">
                <p className="ow-meta__term">
                  {t(`org.supportShareStatus.${share.status}`)} ·{" "}
                  {new Date(share.sentAt).toISOString().slice(0, 10)}
                  {share.snapshot?.periodLabel ? ` · ${share.snapshot.periodLabel}` : ""}
                </p>
                {/* Kellelt — ilma selleta ei saa saaja avaldusele vastata. */}
                <p className="ow-meta__value">
                  <span className="ow-meta__term">{t("org.support.sentBy")}</span>{" "}
                  {recipientLabel(share.sender || {})}
                </p>
                <p className="ow-meta__value" style={{ whiteSpace: "pre-wrap" }}>
                  {share.snapshot?.summary || "—"}
                </p>
                {share.snapshot?.supportRequested ? (
                  <p className="ow-meta__value" style={{ whiteSpace: "pre-wrap" }}>
                    <span className="ow-meta__term">{t("org.support.needs")}</span>{" "}
                    {share.snapshot.supportRequested}
                  </p>
                ) : null}
                {Array.isArray(share.snapshot?.needs) && share.snapshot.needs.length ? (
                  <ul className="ow-chips">
                    {share.snapshot.needs.map((need) => (
                      <li key={need} className="ow-chip">
                        {need}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {writable && share.status !== "CLOSED" ? (
                  <div className="ow-actions">
                    <Button type="button" onClick={() => act("close", share.id)} disabled={busy}>
                      {t("org.support.close")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ow-card" aria-labelledby="ow-sent-support">
        <h3 id="ow-sent-support" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.support.sent")}
        </h3>
        <p className="ow-empty">{t("org.support.recallHint")}</p>
        {sent.length === 0 ? (
          <p className="ow-empty">{t("org.support.noSent")}</p>
        ) : (
          <div className="ow-tablewrap">
            <table className="ow-table">
              <caption>{t("org.support.sent")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("org.support.sentAt")}</th>
                  <th scope="col">{t("org.support.sentTo")}</th>
                  <th scope="col">{t("org.support.status")}</th>
                  <th scope="col">{t("org.members.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((share) => (
                  <tr key={share.id}>
                    <td data-label={t("org.support.sentAt")}>
                      {new Date(share.sentAt).toISOString().slice(0, 10)}
                    </td>
                    <td data-label={t("org.support.sentTo")}>{recipientLabel(share.recipient || {})}</td>
                    <td data-label={t("org.support.status")}>
                      {t(`org.supportShareStatus.${share.status}`)}
                    </td>
                    <td data-label={t("org.members.actions")}>
                      {writable && share.status === "SENT" && !share.openedAt ? (
                        <Button type="button" onClick={() => act("recall", share.id)} disabled={busy}>
                          {t("org.support.recall")}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {done ? <p className="ow-notice ow-notice--privacy">{done}</p> : null}
      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
