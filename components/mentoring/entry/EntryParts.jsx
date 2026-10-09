"use client";

/**
 * Mentorluse avalehtede ühised tükid: lehe kest, märk, teade ja lingikaart.
 *
 * MIKS. Kolm lehte (avaleht, minu mentoriprofiil, mentori profiil) joonistasid
 * varem klaaspaneeli SISSE veel ühe tumeda kaardi, selle sisse suure pealkirja
 * ja alles siis sisu. Nüüd on lehe pind klaaspaneel ise (`PanelFrame`), lehe
 * nimi on all kiirmenüüs ja pealkiri jääb ekraanilugejale.
 *
 * `EntryShell` kannab ka kaks seisu, kus lava ei ole: laadimine ja laadimise
 * viga. Viga (sh „see tööriist ei ole sinu rollile”) on tavaline lause koos
 * nupuga „Proovi uuesti”, mitte kast kastis.
 *
 * Lingid on `next/link`, mitte toores ankur: ankur laadis terve rakenduse
 * uuesti ja viskas ära lehe oleku. Eellaadimist ei ole (`prefetch={false}`, nagu
 * platvormi `AppLink`-il): kataloogis võib olla kakssada rida.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import Link from "next/link";

import Button from "@/components/ui/Button";

import styles from "./entry.module.css";

/** Lehe kest: pealkiri ekraanilugejale, laadimine, viga ja lapsed. */
export function EntryShell({ title, loadingText, error, retryText, onRetry, children }) {
  return (
    <section className={styles.shell}>
      <h1 className="sr-only">{title}</h1>
      {loadingText ? <p className={styles.quiet}>{loadingText}</p> : null}
      {error ? (
        <div className={styles.fault}>
          {/* Ühine paneelikiht joonistab `role="alert"` elemendi kastina; klass
              `faultText` võtab kasti maha, et viga oleks lause. */}
          <p className={styles.faultText} role="alert">
            {error}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            {retryText}
          </Button>
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Märk: seis ühe sõnaga. Tühja teksti korral märki ei ole. */
export function Chip({ tone, children }) {
  if (!children) return null;
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Teade vaate sees. */
export function Notice({ text, tone, children }) {
  if (!text) return null;
  /* `aria-live`, mitte status-roll: ühine paneelikiht joonistab iga
     status-rolliga elemendi omal moel. */
  return (
    <p className={styles.notice} data-tone={tone} aria-live="polite">
      {text}
      {children}
    </p>
  );
}

/**
 * Tegevus pealkirja ja selgitusega, mis viib teisele lehele (sama kuju mis
 * `ActionCard`, aga link). Väline link avaneb uuel vahelehel ja ütleb seda.
 */
export function LinkCard({ href, title, description, external = false, newTabText = "" }) {
  const body = (
    <>
      <span className={styles.linkTitle}>
        {title}
        {external ? (
          <>
            <span aria-hidden="true"> ↗</span>
            {newTabText ? <span className="sr-only"> ({newTabText})</span> : null}
          </>
        ) : null}
      </span>
      {description ? <span className={styles.linkDescription}>{description}</span> : null}
    </>
  );
  return external ? (
    <a className={styles.linkCard} href={href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <Link className={styles.linkCard} href={href} prefetch={false}>
      {body}
    </Link>
  );
}

/** Vaikne tekstilink (nt „Tagasi mentorlusse”). */
export function TextLink({ href, children }) {
  return (
    <Link className={styles.textLink} href={href} prefetch={false}>
      {children}
    </Link>
  );
}
