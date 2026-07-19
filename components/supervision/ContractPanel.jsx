"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 3 „Kontrakt ja kutsed" (Q2.6). SV koostab/aktiveerib versioone ja
 * kutsub osalejaid; OS/OS† kinnitab uue versiooni. Iga muutev toiming kannab
 * CAS-i (`expectedVersion`) — 409 ei ole viga, vaid „keegi muutis vahepeal,
 * laadi uuesti" koos värske seisu toomisega.
 */
export default function ContractPanel({ process, onReload, onConflict }) {
  const { t } = useI18n();
  const [versionBody, setVersionBody] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const canManage = Boolean(process.capabilities?.canManageContract);
  const canInvite = Boolean(process.capabilities?.canInvite);
  const needsAcceptance = Boolean(
    process.myParticipation && !process.myParticipation.hasAcceptedActiveContract && process.activeContract
  );

  const run = useCallback(async (key, url, body, { method = "POST", fallbackKey = "supervision.errors.save_failed" } = {}) => {
    setBusy(key);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(url, { method, body });
      if (!ok) {
        if (isConflict(status)) {
          await onConflict?.();
          return false;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey }));
        return false;
      }
      await onReload?.();
      return true;
    } catch {
      setMessage(t(fallbackKey));
      return false;
    } finally {
      setBusy("");
    }
  }, [onConflict, onReload, t]);

  const createVersion = useCallback(async (event) => {
    event?.preventDefault?.();
    const body = versionBody.trim();
    if (!body) return;
    const ok = await run(
      "create-version",
      `/api/supervision/processes/${encodeURIComponent(process.id)}/contract-versions`,
      { body }
    );
    if (ok) setVersionBody("");
  }, [process.id, run, versionBody]);

  const activateVersion = useCallback((versionId) => run(
    `activate:${versionId}`,
    `/api/supervision/processes/${encodeURIComponent(process.id)}/contract-versions/${encodeURIComponent(versionId)}/activate`,
    { expectedVersion: process.version }
  ), [process.id, process.version, run]);

  const invite = useCallback(async (event) => {
    event?.preventDefault?.();
    const userId = inviteUserId.trim();
    if (!userId) return;
    const ok = await run(
      "invite",
      `/api/supervision/processes/${encodeURIComponent(process.id)}/invites`,
      { userId }
    );
    if (ok) setInviteUserId("");
  }, [inviteUserId, process.id, run]);

  const withdrawInvite = useCallback((participationId) => run(
    `withdraw:${participationId}`,
    `/api/supervision/participations/${encodeURIComponent(participationId)}/withdraw-invite`,
    undefined
  ), [run]);

  const acceptActive = useCallback(() => run(
    "accept-contract",
    `/api/supervision/processes/${encodeURIComponent(process.id)}/contract-acceptance`,
    { contractVersionId: process.activeContract?.id || "" }
  ), [process.activeContract, process.id, run]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{t("supervision.contract.title")}</h2>
      </div>

      <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
        {message}
      </p>

      {process.activeContract ? (
        <div className={styles.item}>
          <span className={styles.badge}>
            {t("supervision.contract.versionN", { n: process.activeContract.versionNumber })}
          </span>
          <h3 className={styles.itemTitle}>{t("supervision.contract.activeVersion")}</h3>
          <p className={styles.itemBody}>{process.activeContract.body}</p>
          {needsAcceptance ? (
            <div className={styles.actions}>
              <Button disabled={busy === "accept-contract"} onClick={acceptActive} size="sm">
                {t("supervision.contract.acceptContract")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className={styles.empty}>{t("supervision.contract.noActive")}</p>
      )}

      {canManage && process.contractVersions?.length ? (
        <div className={styles.itemList}>
          {process.contractVersions.map((version) => (
            <div key={version.id} className={styles.item}>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>
                  {t("supervision.contract.versionN", { n: version.versionNumber })}
                </span>
                <span className={styles.badge}>{version.status}</span>
              </div>
              {version.id !== process.activeContract?.id ? (
                <div className={styles.actions}>
                  <Button
                    disabled={busy === `activate:${version.id}`}
                    onClick={() => activateVersion(version.id)}
                    size="sm"
                    variant="secondary"
                  >
                    {t("supervision.contract.activate")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <form className={styles.form} onSubmit={createVersion}>
          <label>
            {t("supervision.contract.bodyLabel")}
            <textarea
              maxLength={50000}
              onChange={(event) => setVersionBody(event.target.value)}
              value={versionBody}
            />
            <span className={styles.fieldHint}>{t("supervision.contract.newVersion")}</span>
          </label>
          <div className={styles.actions}>
            <Button disabled={busy === "create-version" || !versionBody.trim()} type="submit">
              {t("supervision.contract.createVersion")}
            </Button>
          </div>
        </form>
      ) : null}

      <div className={styles.sectionHeading}>
        <h3>{t("supervision.contract.participants")}</h3>
      </div>
      {process.participants?.length ? (
        <div className={styles.itemList}>
          {process.participants.map((participant) => (
            <div key={participant.id} className={styles.item}>
              <div className={styles.badgeRow}>
                <span className={styles.badge}>{participant.status}</span>
              </div>
              <p className={styles.cardMeta}>{participant.name}</p>
              {canInvite && participant.status === "INVITED" ? (
                <div className={styles.actions}>
                  <Button
                    disabled={busy === `withdraw:${participant.id}`}
                    onClick={() => withdrawInvite(participant.id)}
                    size="sm"
                    variant="secondary"
                  >
                    {t("supervision.contract.withdraw")}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canInvite ? (
        <form className={styles.form} onSubmit={invite}>
          <label>
            {t("supervision.contract.inviteLabel")}
            <Input
              onChange={(event) => setInviteUserId(event.target.value)}
              placeholder={t("supervision.contract.invitePlaceholder")}
              value={inviteUserId}
            />
          </label>
          <div className={styles.actions}>
            <Button disabled={busy === "invite" || !inviteUserId.trim()} type="submit">
              {t("supervision.contract.invite")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
