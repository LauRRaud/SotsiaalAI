"use client";

/**
 * „Minu juhtumid" loendilehe vaated: juhtumite loend ja uue juhtumi loomine.
 *
 * MIKS. Leht oli üks veerg: suur pealkiri, loomise vorm kolme väljaga ja selle
 * all loend, kus igal real oli oma kandiline „Ava" nupp. Nüüd on kummalgi asjal
 * oma vaade sammulaval (`components/stage`): loend on see, mida töötaja iga
 * kord näeb, ja uue juhtumi loomine on eraldi vaade, kuhu viib nupp loendi
 * kohal või kiirmenüü.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../CaseWorkShell.jsx,
 * ridade sisu failis ../caseViews.js.
 *
 * Kujundus: cases.module.css (siin kõrval).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./cases.module.css";

export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Lehe teade. Viga on `alert`; muu teade on vaikne tekst, mitte status-roll
    (ühine lehekiht joonistab iga status-rolliga elemendi teatekastina). */
export function Notice({ text, tone }) {
  if (!text) return null;
  return tone === "risk" ? (
    <p className={styles.notice} data-tone="risk" role="alert">
      {text}
    </p>
  ) : (
    <p className={styles.notice} aria-live="polite">
      {text}
    </p>
  );
}

/**
 * Juhtumite loend: seisu filter, read ja „näita rohkem".
 *
 * TOOTEPIIR ON LOENDI KOHAL, mitte abitekstis: juhtum ei ole register ega
 * ametlik toimik ja seda peab lugema enne, kui midagi sisestatakse.
 */
export function CaseListView({ t, filter, status, rows, emptyText, errorText, onRetry, more, onCreate }) {
  return (
    <StepPanel title={t("casework.page.views.list.title", "")} lead={t("casework.page.subtitle", "")}>
      <div className={styles.stack}>
        <div className={styles.bar}>
          <div className={styles.filter}>
            <ChoiceRow
              label={t("casework.page.filter_label", "")}
              labelHidden
              columns={filter.options.length}
              options={filter.options}
              value={filter.value}
              onChange={filter.onChange}
            />
          </div>
          <Button type="button" size="sm" variant="primary" onClick={onCreate}>
            {t("casework.page.views.create.title", "")}
          </Button>
        </div>

        <Notice text={errorText} tone="risk" />

        {status === "loading" && !rows.length ? <p className={styles.quiet}>{t("casework.page.loading", "")}</p> : null}

        {/* „Juhtumeid ei ole" öeldakse ainult siis, kui loend päriselt laaditi:
            ebaõnnestunud laadimise järel oleks see väljamõeldud vastus. */}
        {status === "ready" && !rows.length ? <p className={styles.quiet}>{emptyText}</p> : null}

        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li className={styles.rowItem} key={row.id}>
                <button type="button" className={styles.row} onClick={row.onOpen}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>
                    <Chip tone={row.tone}>{row.state}</Chip>
                    {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {t("casework.page.open", "")} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Ebaõnnestunud laadimise järel peab pinnal olema tee uuesti proovida.
            Kui read on juba ees (ebaõnnestus „Näita rohkem"), on uus katse seesama
            nupp: „Proovi uuesti" laeks esimese lehe ja viskaks laaditud read ära. */}
        {status === "error" && !rows.length ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} onClick={onRetry}>
            {t("casework.page.retry", "")}
          </Button>
        ) : null}

        {/* Nupp on laadimise ajal KEELATUD (SOL-CW-10): kiire topeltvajutus
            saatis kaks sama kursoriga päringut ja lisas samad read kaks korda. */}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {t("casework.page.load_more", "")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Uus juhtum: kliendi viide, väline tunnus ja järgmine kontakt. Kõik kolm
 * võivad jääda tühjaks.
 *
 * Nupp on paneeli all servas, aga kuulub vormi juurde (`form`): nii loob ka
 * Enter väljal juhtumi, nagu vanas vormis.
 */
export function CaseCreateView({ t, formId, fields, onSubmit, onCancel, busy, errorText }) {
  return (
    <StepPanel
      title={t("casework.page.views.create.title", "")}
      lead={t("casework.page.create_hint", "")}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {t("casework.page.cancel", "")}
          </Button>
          <Button type="submit" form={formId} size="sm" variant="primary" disabled={busy}>
            {t("casework.page.create_submit", "")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <form id={formId} className={styles.fields} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("casework.page.client_display_name", "")}</span>
            <Input type="text" value={fields.displayName} maxLength={120} onChange={fields.onDisplayName} />
          </label>
          <label className={styles.field} data-size="sm">
            <span className={styles.fieldLabel}>{t("casework.page.client_external_ref", "")}</span>
            <Input type="text" value={fields.externalRef} maxLength={120} onChange={fields.onExternalRef} />
          </label>
          <label className={styles.field} data-size="sm">
            <span className={styles.fieldLabel}>{t("casework.page.next_contact", "")}</span>
            <Input type="datetime-local" value={fields.nextContact} onChange={fields.onNextContact} />
          </label>
        </form>
        <Notice text={errorText} tone="risk" />
      </div>
    </StepPanel>
  );
}
