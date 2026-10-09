/**
 * StepPanel — ühe sammu sisu kuju: küsimus või lühike juhis, sisu ja vaate enda tegevused.
 *
 * SAMMU PEALKIRJA PANEELIL EI OLE (omanik 09.10): sammu nimi on all kiirmenüüs
 * ja selle kordamine paneeli ülaservas tegi vasaku serva tekstid kahekordseks
 * („Kelle kohta" ja kohe selle all „Kelle kohta pöördumine käib"). Paneel
 * algab küsimuse või alateemaga. `title` jääb ekraanilugejale ja on fookuse
 * siht, kui samm vahetatakse (`data-step-heading`, vt StepFlight).
 *
 * `question`: nähtav küsimus paneeli ülaservas, kui sisu ise seda ei kanna
 * (nt kaartidega valik). `lead`: lühike juhis. `note` ja `actions`: vaate enda
 * teade ja tegevused (nt „Salvesta"); need on alati paneeli all servas. Üldist
 * „Edasi" nuppu siin ei ole: edasi liigutakse kiirmenüüst.
 *
 * Üks samm = üks asi. Kui sisu ei mahu paneeli ära, jaga see kaheks sammuks,
 * mitte ära pane kerima.
 *
 * Kujundus: StepPanel.module.css.
 */

import styles from "./StepPanel.module.css";

export default function StepPanel({ title, question, lead, note, actions, children }) {
  return (
    <div className={styles.panel}>
      <h3 className="sr-only" tabIndex={-1} data-step-heading>
        {title}
      </h3>
      {question || lead ? (
        <header className={styles.head}>
          {question ? <p className={styles.question}>{question}</p> : null}
          {lead ? <p className={styles.lead}>{lead}</p> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
      <div className={styles.spacer} data-step-spacer aria-hidden="true" />
      {note || actions ? (
        <footer className={styles.foot}>
          {note ? (
            /* `aria-live`, mitte role="status": ühine lehekiht joonistab iga
               status-rolliga elemendi teatekastina. */
            <p className={styles.note} aria-live="polite">
              {note}
            </p>
          ) : (
            <span />
          )}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </footer>
      ) : null}
    </div>
  );
}
