"use client";

/**
 * Kutsutu vaated: kutse, kontrakt ja vastus.
 *
 * MIKS. Kutse oli üks kaart teise klaaskasti sees: märgid, kontrakti tekst
 * kastis ja kaks nuppu kõrvuti, kus „Keeldun" lõpetas kutse ühe vajutusega.
 * Nüüd on see kolm väikest vaadet sammulaval (`components/stage`):
 *
 *  - `InviteView`    kuhu ja kes kutsub; mida kutsutu praegu näeb
 *  - `ContractView`  kehtiv kontrakt (üks tekst; võib olla pikk)
 *  - `AnswerView`    kaks tegevust selgitusega: liitun või keeldun
 *  - `DeclinedNote`  lause pärast keeldumist
 *
 * Kutsutu näeb AINULT pealkirja, superviisori nime, tüüpi ja kehtivat
 * kontraktiteksti: see piir tuleb serverist ja siin seda ei laiendata.
 *
 * Siin on ainult kuju. Vastamise päring ja kahe vajutusega keeldumine on
 * failis ../SupervisionInvitedCard.jsx.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import StepPanel from "@/components/stage/StepPanel";

import PrivacyBadge from "../PrivacyBadge";
import { Chip } from "./EntryBits";
import styles from "./entry.module.css";

/** Kutse: protsessi nimi on paneeli ülaservas, selle all tüüp ja privaatsusmärk. */
export function InviteView({ t, title, typeText, supervisor, actions }) {
  return (
    <StepPanel
      title={t("supervision.invited.views.invite.title")}
      question={title}
      lead={t("supervision.invited.views.invite.lead")}
      actions={actions}
    >
      <div className={styles.stack}>
        <p className={styles.line}>
          {typeText ? <Chip>{typeText}</Chip> : null}
          <PrivacyBadge scope="invited" />
        </p>
        {supervisor ? <p className={styles.quiet}>{supervisor}</p> : null}
      </div>
    </StepPanel>
  );
}

/** Kehtiv kontrakt. `note`: teade, kui versioon vahetus enne kinnitamist. */
export function ContractView({ t, contract, note }) {
  return (
    <StepPanel title={t("supervision.invited.views.contract.title")} lead={t("supervision.invited.readContract")} note={note}>
      {contract ? (
        <div className={styles.stack}>
          <p className={styles.line}>
            <Chip>{t("supervision.contract.versionN", { n: contract.versionNumber })}</Chip>
          </p>
          <p className={styles.text}>{contract.body}</p>
        </div>
      ) : (
        <p className={styles.quiet}>{t("supervision.contract.noActive")}</p>
      )}
    </StepPanel>
  );
}

/** Vastus. `accept` ja `decline`: { title, description, disabled, onClick }. */
export function AnswerView({ t, accept, decline, note }) {
  return (
    <StepPanel
      title={t("supervision.invited.views.answer.title")}
      question={t("supervision.invited.views.answer.question")}
      note={note}
    >
      <ActionCardGrid label={t("supervision.invited.views.answer.question")}>
        <ActionCard title={accept.title} description={accept.description} disabled={accept.disabled} onClick={accept.onClick} />
        <ActionCard title={decline.title} description={decline.description} disabled={decline.disabled} onClick={decline.onClick} />
      </ActionCardGrid>
    </StepPanel>
  );
}

/** Pärast keeldumist: lause ja tee tagasi. */
export function DeclinedNote({ t, action }) {
  return (
    <div className={styles.state}>
      <p className={styles.quiet} aria-live="polite">
        {t("supervision.invited.declined")}
      </p>
      {action}
    </div>
  );
}
