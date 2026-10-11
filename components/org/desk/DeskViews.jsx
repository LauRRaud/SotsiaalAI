"use client";

/**
 * Organisatsiooni laua (`/org/<id>`) vaated.
 *
 * MIKS. Avatud organisatsioon algas ülevaatega, mille kohal seisid nimi, seisu
 * rida ja kuni 13 lingiga rida; ülevaade ise oli viis kasti üksteise all.
 * Nüüd on esimene vaade LAUD: organisatsiooni nimi, üks rida inimese koha kohta
 * ja ühelaiused plaadid kõigi osadega, mida ta näeb. Plaat ütleb nime ja ühe
 * reaga, mis seal on.
 *  - `DeskView`   laud: nimi, seis (kui ei ole aktiivne), koht, plaadid
 *  - `PlaceView`  „Minu koht": seis, roll, üksused, õigused ja moodulid ridadena
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus (arenduskava §4, §7.4): mõlema vaate
 * all servas seisab mustvalgel, mida organisatsioon inimese kohta EI näe.
 *
 * Siin on ainult kuju. Otsused on failis ./orgDesk.js, olek lehel
 * (`../OrgOverviewClient.jsx`). Kujundus: desk.module.css ja ../org.module.css.
 */

import StepPanel from "@/components/stage/StepPanel";

import { Facts } from "../OrgBits";
import shared from "../org.module.css";
import styles from "./desk.module.css";

/**
 * Laud. Plaat, millel on `href`, avab osa marsruudi (tavaline link: uue
 * vahekaardi vajutus töötab); `href`-ita plaat avab laua enda teise vaate.
 *
 * `chip`: { text, attention } või null; `notice`: lause, miks muuta ei saa, või tühi.
 */
export function DeskView({ t, name, chip, seat, notice, tiles, onOpen, onView }) {
  return (
    <StepPanel title={name} note={t("org.overview.privacyNotice")}>
      <div className={shared.stack}>
        <div className={styles.head}>
          <p className={styles.name}>{name}</p>
          {chip ? (
            <span className={shared.chip} data-tone={chip.attention ? "wait" : undefined}>
              {chip.text}
            </span>
          ) : null}
          {seat ? <span className={styles.seat}>{seat}</span> : null}
        </div>
        {notice ? <p className={shared.notice}>{notice}</p> : null}
        <ul className={styles.tiles} aria-label={t("org.desk.rail_label")}>
          {tiles.map((tile) => (
            <li key={tile.key}>
              {tile.href ? (
                <a className={styles.tile} href={tile.href} data-tile={tile.key} onClick={(event) => onOpen(event, tile)}>
                  <span className={styles.tileTitle}>{tile.name}</span>
                  <span className={styles.tileSummary}>{tile.line}</span>
                </a>
              ) : (
                <button type="button" className={styles.tile} data-tile={tile.key} onClick={() => onView(tile.key)}>
                  <span className={styles.tileTitle}>{tile.name}</span>
                  <span className={styles.tileSummary}>{tile.line}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </StepPanel>
  );
}

/** „Minu koht": mis rollis ja üksustes inimene siin on ja mis õigused tal on. Ainult lugemiseks. */
export function PlaceView({ t, facts }) {
  return (
    <StepPanel title={t("org.desk.place.name")} note={t("org.overview.privacyNotice")}>
      <Facts rows={facts} />
    </StepPanel>
  );
}
