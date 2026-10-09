/**
 * StepPanel — ühe sammu sisu kuju: pealkiri, lühike juhis, sisu ja tegevusrida.
 *
 * Kõik sammud on ühe kujuga, et inimene leiaks pealkirja ja „Edasi" nupu igal
 * sammul samast kohast. Pealkiri saab fookuse, kui samm vahetatakse nupust
 * (`data-step-heading`, vt StepFlight).
 *
 * Kujundus: StepPanel.module.css.
 */

import styles from "./StepPanel.module.css";

export default function StepPanel({ title, lead, note, actions, children }) {
  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <h3 className={styles.title} tabIndex={-1} data-step-heading>
          {title}
        </h3>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </header>
      <div className={styles.body}>{children}</div>
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
