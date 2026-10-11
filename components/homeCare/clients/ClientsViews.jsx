"use client";

/**
 * Klientide vaade koduteenuse avalehel.
 *
 * MIKS. Otsing, tulemused ja kogu klientide loend seisid pika keritava lehe
 * lõpus üksteise all (hooldusjuhil 899 px, paneel 522). Nüüd on vaates üks
 * asi korraga: kas loendi esimene lehekülg või otsingu tulemused. Otsing on
 * mõlemal juhul ülal; loendi enda tegevused („Näita veel", lõpetatud kliendid)
 * on loendi all ja uue kliendi tegevused all servas.
 *
 * LINGID KLIENDI LEHELE ON `prefetch={false}`. Kliendi lehe avamine jätab
 * avamislogisse rea; ette laadimine kirjutaks sinna avamisi, mida inimene ei
 * teinud.
 *
 * Siin on ainult kuju. Otsused on failis ./clientRows.js, olek ja päringud lehel
 * (`../HomeCareHome.jsx`). Kujundus: ./clients.module.css ja organisatsioonide
 * lehtede ühised osad (../../org/org.module.css).
 */

import Link from "next/link";

import { SMALL } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./clients.module.css";

/** Üks klient: nimi, selle all aadress või otsingu selgitus, paremal märgid. Avab kliendi lehe. */
function ClientRow({ row }) {
  return (
    <Link className={`${shared.row} ${styles.client}`} href={row.href} prefetch={false} data-client={row.key}>
      <span className={styles.main}>
        <span className={shared.rowTitle}>{row.title}</span>
        {row.line ? <span className={styles.sub}>{row.line}</span> : null}
      </span>
      {row.chips?.length ? (
        <span className={shared.rowMeta}>
          {row.chips.map((chip) => (
            <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
              {chip.text}
            </span>
          ))}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * `search`: { id, label, query, onQuery, onSubmit, busy, error, hints } või null (otsida ei tohi;
 *   selgitused on tulemuste juures, sest seal on neid vaja);
 * `results`: null või { rows, onClear } (rea `onCall` avab kõne märkimise vaate või on null);
 * `list`: { rows, error, empty, expanded, more };
 * `name`: { line, onChange } või null; `foot`: { toggle, importHref, onAdd }.
 */
export function ClientsView({ t, title, search, results, list, name, foot }) {
  const found = Boolean(results);
  return (
    <StepPanel
      title={title}
      note={
        name ? (
          <button type="button" className={styles.nameLine} data-name="change" onClick={name.onChange}>
            {name.line} <span className={styles.link}>{t("home_care.own_name.change")}</span>
          </button>
        ) : null
      }
      actions={
        found ? (
          <Button {...SMALL} data-clients="clear" onClick={results.onClear}>
            {t("home_care.home.clear_search")}
          </Button>
        ) : foot.importHref || foot.onAdd ? (
          <>
            {foot.importHref ? (
              <Button as="a" href={foot.importHref} size="sm" variant="secondary" data-clients="import">
                {t("home_care.home.import_short")}
              </Button>
            ) : null}
            {foot.onAdd ? (
              <Button type="button" size="sm" variant="primary" data-clients="add" onClick={foot.onAdd}>
                {t("home_care.home.add_client")}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack}>
        {search ? (
          <form className={styles.search} onSubmit={search.onSubmit} role="search">
            <label className={shared.line} htmlFor={search.id}>
              <span className={shared.fieldLabel}>{search.label}</span>
              <input
                id={search.id}
                className={shared.input}
                type="search"
                value={search.query}
                onChange={(event) => search.onQuery(event.target.value)}
                minLength={2}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            <Button {...SMALL} type="submit" data-clients="search" disabled={search.busy || search.query.trim().length < 2}>
              {t("home_care.home.search_button")}
            </Button>
          </form>
        ) : null}
        {search && found ? <p className={shared.hint}>{search.hints.join(" ")}</p> : null}
        {search?.error ? (
          <p className={shared.notice} data-tone="risk" role="alert">
            {search.error}
          </p>
        ) : null}

        {found ? (
          results.rows.length === 0 ? (
            <p className={shared.quiet} aria-live="polite">
              {t("home_care.home.search_empty")}
            </p>
          ) : (
            <ul className={shared.rows} aria-live="polite">
              {results.rows.map((row) =>
                row.onCall ? (
                  /* Kõne saab märkida klienti avamata: tegevus on rea kõrval vaikne sõna. */
                  <li key={row.key} className={shared.item}>
                    <ClientRow row={row} />
                    <span className={shared.itemAside}>
                      <Button {...SMALL} className={shared.aside} data-clients-call={row.key} aria-label={`${t("home_care.entry_steps.quick_call")}: ${row.title}`} onClick={row.onCall}>
                        {t("home_care.entry_steps.quick_call")}
                      </Button>
                    </span>
                  </li>
                ) : (
                  <li key={row.key} className={shared.rowItem}>
                    <ClientRow row={row} />
                  </li>
                )
              )}
            </ul>
          )
        ) : (
          <>
            {list.error ? (
              <p className={shared.notice} data-tone="risk" role="alert">
                {list.error}
              </p>
            ) : null}
            {list.rows.length === 0 ? (
              <p className={shared.quiet}>{list.empty}</p>
            ) : (
              <ul className={`${shared.rows} ${styles.list}`} data-expanded={list.expanded ? "1" : undefined}>
                {list.rows.map((row) => (
                  <li key={row.key} className={shared.rowItem}>
                    <ClientRow row={row} />
                  </li>
                ))}
              </ul>
            )}
            {list.more || foot.toggle ? (
              <div className={styles.listActions}>
                {list.more ? (
                  <Button {...SMALL} data-clients="more" onClick={list.more.onMore}>
                    {list.more.label}
                  </Button>
                ) : null}
                {foot.toggle ? (
                  <Button {...SMALL} data-clients="toggle" aria-busy={foot.toggle.busy ? "true" : undefined} onClick={foot.toggle.onToggle}>
                    {foot.toggle.label}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </StepPanel>
  );
}
