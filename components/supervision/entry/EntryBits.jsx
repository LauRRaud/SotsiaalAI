"use client";

/**
 * Supervisiooni avalehtede ühised tükid: märk, takistuse lause, laadimise ja
 * vea seis ning lingiridade loend.
 *
 * Siin on ainult kuju. Read teeb `entryRows.js`, andmed ja päringud on lehtede
 * failides (`../SupervisionHomePage.jsx` jt).
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import Link from "next/link";

import Button from "@/components/ui/Button";

import styles from "./entry.module.css";

/** Märk. `prefix` on ainult ekraanilugejale (nt „Sinu roll"). */
export function Chip({ tone, prefix, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {prefix ? <span className="sr-only">{`${prefix}: `}</span> : null}
      {children}
    </span>
  );
}

/**
 * Viga või puuduv ligipääs lausena. `aria-live`, mitte role="status": ühine
 * lehekiht joonistab iga status-rolliga elemendi teatekastina.
 */
export function Problem({ text }) {
  if (!text) return null;
  return (
    <p className={styles.problem} aria-live="polite">
      {text}
    </p>
  );
}

/**
 * Loendi või kirje laadimise seis: laadimine, viga koos uue katsega, või sisu.
 * `source`: { status: "loading" | "error" | "ready", error, retry }.
 */
export function Loaded({ t, source, children }) {
  if (source.status === "loading") return <p className={styles.quiet}>{t("supervision.common.loading")}</p>;
  if (source.status === "error") {
    return (
      <div className={styles.state}>
        <Problem text={source.error} />
        <div className={styles.actions}>
          <Button type="button" size="sm" variant="secondary" onClick={source.retry}>
            {t("supervision.common.retry")}
          </Button>
          {source.extra || null}
        </div>
      </div>
    );
  }
  return children;
}

/**
 * Lingiread. `Link`, mitte toores ankur: vana leht kasutas igal pool
 * `Button as="a"`, mis laadis iga vajutusega kogu rakenduse uuesti.
 * `rows`: [{ id, href, title, sub, chips: [{ key, text, tone, prefix }], date }]
 */
export function LinkRows({ rows, openText }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link className={styles.row} href={row.href}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{row.title}</span>
              {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
            </span>
            <span className={styles.rowMeta}>
              {row.chips.map((chip) => (
                <Chip key={chip.key} tone={chip.tone} prefix={chip.prefix}>
                  {chip.text}
                </Chip>
              ))}
              {row.date ? <span className={styles.time}>{row.date}</span> : null}
            </span>
            <span className={styles.rowOpen} aria-hidden="true">
              {`${openText} ›`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
