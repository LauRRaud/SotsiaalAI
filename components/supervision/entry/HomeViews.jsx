"use client";

/**
 * Supervisiooni laua vaated: minu protsessid, kutsed ja isiklikud paketid.
 *
 * MIKS. Avaleht oli kaartide võrk, kus iga protsess oli kõrge kaart kolme
 * märgi, privaatsussildi, kahe reaga ja oma nupuga, ning kutse seisis teiste
 * protsesside vahel. Pakkide loend oli eraldi leht sama kujuga. Nüüd on need
 * ühe laua kolm osa sammulaval (`components/stage`): igas osas üks loend, rida
 * on madal ja terve rida viib edasi.
 *
 *  - `ProcessesView`  protsessid, kus olen superviisor või osaleja
 *  - `InvitesView`    kutsed, millele ma ei ole vastanud
 *  - `OutcomesView`   isiklikud paketid (jäävad alles pärast sulgemist)
 *  - `DeskLead`       kõigi osade vaate sissejuhatus
 *
 * Siin on ainult kuju. Andmed ja päringud on failis ../SupervisionHomePage.jsx,
 * read teeb ./entryRows.js.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import StepPanel from "@/components/stage/StepPanel";

import PrivacyBadge from "../PrivacyBadge";
import { LinkRows, Loaded } from "./EntryBits";
import styles from "./entry.module.css";

function List({ t, source, rows, emptyText }) {
  return (
    <Loaded t={t} source={source}>
      {rows.length ? <LinkRows rows={rows} openText={t("supervision.home.open")} /> : <p className={styles.quiet}>{emptyText}</p>}
    </Loaded>
  );
}

/** Kõigi osade vaate kohal: mis siin laual on, ja uue protsessi alustamine. */
export function DeskLead({ t, action }) {
  return (
    <div className={styles.head}>
      <p className={styles.lead}>{t("supervision.home.wideLead")}</p>
      {action}
    </div>
  );
}

/** Minu protsessid. `action`: „Uus protsess" (loendi enda tegevus, üleval paremal). */
export function ProcessesView({ t, source, rows, action }) {
  return (
    <StepPanel title={t("supervision.home.views.processes.title")}>
      <div className={styles.stack}>
        <div className={styles.head}>
          <p className={styles.lead}>{t("supervision.home.subtitle")}</p>
          {action}
        </div>
        <List t={t} source={source} rows={rows} emptyText={t("supervision.home.views.processes.empty")} />
      </div>
    </StepPanel>
  );
}

/** Kutsed, millele ma ei ole vastanud. Rida avab kutse (kontrakt ja vastus). */
export function InvitesView({ t, source, rows }) {
  return (
    <StepPanel title={t("supervision.home.views.invites.title")} lead={t("supervision.home.views.invites.lead")}>
      <List t={t} source={source} rows={rows} emptyText={t("supervision.home.views.invites.empty")} />
    </StepPanel>
  );
}

/** Isiklikud paketid. Privaatsusmärk on püsielement: pakk kuulub ainult omanikule. */
export function OutcomesView({ t, source, rows }) {
  return (
    <StepPanel title={t("supervision.home.views.outcomes.title")} lead={t("supervision.home.views.outcomes.lead")}>
      <div className={styles.stack}>
        <p className={styles.line}>
          <PrivacyBadge scope="private" />
        </p>
        <List t={t} source={source} rows={rows} emptyText={t("supervision.outcome.empty")} />
      </div>
    </StepPanel>
  );
}
