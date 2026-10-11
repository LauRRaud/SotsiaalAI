"use client";

/**
 * Koduteenuse laua (`/org/<id>/koduteenus`) vaade.
 *
 * MIKS. Koduteenuse avalehel seisis 16 lingiga nupurida pika keritava lehe
 * keskel ja igal alalehel tagasilink paneeli ülaservas. Liikumine kuulub
 * kiirmenüüsse (omanik 10.10) ja koduteenus on laud nagu organisatsioon (omanik
 * 11.10, kavandi variant A): plaadid kõigi lehtedega, mida inimene näeb. Plaat
 * ütleb nime ja ühe reaga, mis seal on.
 *
 * Hooldusjuhil on plaadid kolmes rühmas (arvutis kolm veergu, telefonis rühmad
 * üksteise all ja plaadil ainult nimi), hooldajal üks rühm ilma pealkirjata.
 *
 * Siin on ainult kuju. Otsused on failis ./homeCareDesk.js, olek lehel
 * (`../HomeCareHome.jsx`). Kujundus: ./desk.module.css.
 */

import StepPanel from "@/components/stage/StepPanel";

import styles from "./desk.module.css";

/**
 * Laud. Plaat, millel on `href`, avab alalehe marsruudi (tavaline link: uue
 * vahekaardi vajutus töötab); `href`-ita plaat avab avalehe enda vaate.
 * `children`: teated laua kohal (seadmes ootavad kirjed, puuduv hooldusjuht), kui
 * neid on. Need on veel vanal `hc-*` kihil ja vajavad `hc-shell` muutujaid; tühi
 * ümbris ei võta ruumi.
 */
export function HomeDeskView({ t, groups, onOpen, onView, children }) {
  const single = groups.length === 1 && !groups[0].title;
  return (
    <StepPanel title={t("org.nav.home_care")}>
      <div className={styles.desk}>
        <section className={`hc-shell ${styles.notes}`}>{children}</section>
        <div className={styles.groups} data-single={single ? "1" : undefined}>
          {groups.map((group) => (
            <section key={group.key} className={styles.group} aria-label={group.title || t("org.nav.home_care")}>
              {group.title ? <p className={styles.caption}>{group.title}</p> : null}
              <ul className={styles.tiles}>
                {group.tiles.map((tile) => (
                  <li key={tile.key}>
                    {tile.href ? (
                      <a className={styles.tile} href={tile.href} data-tile={tile.key} onClick={(event) => onOpen(event, tile)}>
                        <span className={styles.tileTitle}>{tile.name}</span>
                        <span className={styles.tileSummary}>{tile.line}</span>
                      </a>
                    ) : (
                      <button type="button" className={styles.tile} data-tile={tile.key} onClick={() => onView(tile.view)}>
                        <span className={styles.tileTitle}>{tile.name}</span>
                        <span className={styles.tileSummary}>{tile.line}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </StepPanel>
  );
}
