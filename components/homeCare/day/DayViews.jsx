"use client";

/**
 * Hooldaja päeva vaated koduteenuse avalehel.
 *
 * MIKS. „Täna" oli pika keritava lehe algus: käigud, võtmed, raha, takistuse
 * teade ja järgmised päevad üksteise all (proovandmetega 1348 px, paneel 522).
 * Hooldaja avab lehe ukse taga, ühe käega: üks vaade peab mahtuma ekraanile.
 *  - `TodayView`     tänased käigud ridadena, „Minu käes" ja all takistuse teade
 *  - `AllVisitsView` kõik tänased käigud (rea „Tehtud" ja „Hiljem veel" taga)
 *  - `MineView`      minu käes olevad võtmed ja kliendiraha
 *  - `ObstacleView`  „Mis juhtus?": valik ja saatmine eraldi sammuna
 *  - `NextDaysView`  järgmised päevad
 *
 * LINGID KLIENDI LEHELE ON `prefetch={false}`. Kliendi lehe avamine jätab
 * avamislogisse rea; ette laadimine kirjutaks sinna avamisi, mida inimene ei
 * teinud.
 *
 * Siin on ainult kuju. Otsused on failis ./myDay.js, olek lehel
 * (`../HomeCareHome.jsx`). Kujundus: ./day.module.css ja organisatsioonide
 * lehtede ühised osad (../../org/org.module.css).
 */

import Link from "next/link";

import { SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./day.module.css";

/** Üks käik: kellaaeg ja klient, selle all käigu sõnad ja teated, paremal märgid. Avab kliendi lehe. */
function VisitRow({ row }) {
  return (
    <li className={shared.rowItem}>
      <Link className={`${shared.row} ${styles.visit}`} href={row.href} prefetch={false} data-visit={row.key}>
        <span className={styles.main}>
          <span className={shared.rowTitle}>{row.title}</span>
          {row.line ? <span className={styles.sub}>{row.line}</span> : null}
          {row.notes.map((note) => (
            <span key={note} className={styles.note}>
              {note}
            </span>
          ))}
        </span>
        {row.chips.length ? (
          <span className={shared.rowMeta}>
            {row.chips.map((chip) => (
              <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
                {chip.text}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Käik ühe reana: kellaaeg, klient ja märgid. Avab kliendi lehe. */
function ShortRow({ row }) {
  return (
    <li className={shared.rowItem}>
      <Link className={shared.row} href={row.href} prefetch={false} data-visit={row.key}>
        <span className={shared.rowTitle}>{row.title}</span>
        {row.chips.length ? (
          <span className={shared.rowMeta}>
            {row.chips.map((chip) => (
              <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
                {chip.text}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Lahter, mis avab avalehe teise vaate (kõik käigud, järgmised päevad, minu käes). */
function OpenCell({ title, line, mark, area, onOpen }) {
  return (
    <button type="button" className={`${shared.row} ${styles.visit}`} data-open={mark} data-area={area} onClick={onOpen}>
      <span className={styles.main}>
        <span className={shared.rowTitle}>{title}</span>
        {line ? <span className={styles.sub}>{line}</span> : null}
      </span>
    </button>
  );
}

const BackButton = ({ t, onBack }) => (
  <Button {...SMALL} data-back="1" onClick={onBack}>
    {t("home_care.today.back")}
  </Button>
);

/**
 * „Täna". `day`: { date, count }; `rows`: { first, follow, all } (read on valmis
 * kujul; `all` on rida „Kõik tänased käigud" või null); `next`: järgmiste päevade
 * lahter või null; `mine`: { keys, money } või null; `obstacle`: { note, attention,
 * error, button, canReport, canWithdraw, busy } või null; `children`: seadmes ootavad
 * kirjed (vana kihi osa), kui neid on.
 */
export function TodayView({ t, day, absent, rows, next, mine, obstacle, onAll, onNext, onMine, onObstacle, onWithdraw, children }) {
  const empty = !rows.first && rows.follow.length === 0 && !rows.all;
  const note = obstacle ? footNote(obstacle.error ? { text: obstacle.error, tone: "risk" } : null, obstacle.note) : "";
  return (
    <StepPanel
      title={t("home_care.slots.today_title")}
      note={note}
      actions={
        obstacle && (obstacle.canReport || obstacle.canWithdraw) ? (
          <>
            {obstacle.canWithdraw ? (
              <Button {...SMALL} data-obstacle="withdraw" aria-busy={obstacle.busy ? "true" : undefined} onClick={onWithdraw}>
                {t("home_care.obstacle.withdraw")}
              </Button>
            ) : null}
            {obstacle.canReport ? (
              <Button {...SMALL} data-obstacle="open" onClick={onObstacle}>
                {obstacle.button}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack} data-attention={obstacle?.attention ? "1" : undefined}>
        {/* Seadmes ootavad kirjed on veel vanal kihil ja vajavad `hc-shell` muutujaid; tühi ümbris ei võta ruumi. */}
        <section className={`hc-shell ${styles.notes}`}>{children}</section>
        <div className={styles.head}>
          <p className={styles.date}>{day.date}</p>
          {day.count ? <span className={styles.count}>{day.count}</span> : null}
        </div>
        {absent ? <p className={shared.notice}>{absent}</p> : null}
        {empty && !absent ? <p className={shared.quiet}>{t("home_care.today.none")}</p> : null}
        <div className={styles.cols} data-side={mine || next ? "1" : undefined}>
          {empty ? null : (
            <ul className={`${shared.rows} ${styles.list}`}>
              {rows.first ? <VisitRow row={rows.first} /> : null}
              {rows.follow.map((row) => (
                <ShortRow key={row.key} row={row} />
              ))}
              {rows.all ? (
                <li className={shared.rowItem}>
                  <OpenCell mark="all" title={rows.all.title} line={rows.all.line} onOpen={onAll} />
                </li>
              ) : null}
            </ul>
          )}
          {next ? <OpenCell mark="next" area="next" title={next.title} onOpen={onNext} /> : null}
          {mine ? (
            <div className={styles.pair} data-area="mine">
              {mine.keys ? <OpenCell mark="keys" title={mine.keys.title} line={mine.keys.line} onOpen={onMine} /> : null}
              {mine.money ? <OpenCell mark="money" title={mine.money.title} line={mine.money.line} onOpen={onMine} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </StepPanel>
  );
}

/** Kõik tänased käigud kellaaja järjekorras: pikk päev kerib siin tervet paneeli. */
export function AllVisitsView({ t, rows, onBack }) {
  return (
    <StepPanel title={t("home_care.today.all_title")} question={t("home_care.today.all_title")} actions={<BackButton t={t} onBack={onBack} />}>
      <ul className={shared.rows}>
        {rows.map((row) => (
          <VisitRow key={row.key} row={row} />
        ))}
      </ul>
    </StepPanel>
  );
}

/** Minu käes: võtmed (ripatsi number ja kelle võti) ja kliendiraha jääk kliendi kaupa. Rida avab kliendi lehe. */
export function MineView({ t, keys, money, onBack }) {
  return (
    <StepPanel title={t("home_care.today.mine_title")} actions={<BackButton t={t} onBack={onBack} />}>
      <div className={shared.stack}>
        {keys.length ? (
          <div className={shared.group}>
            <p className={shared.groupTitle}>{t("home_care.keys.mine_title")}</p>
            <ul className={shared.rows}>
              {keys.map((key) => (
                <li key={key.id} className={shared.rowItem}>
                  <Link className={shared.row} href={key.href} prefetch={false} data-key={key.id}>
                    <span className={styles.main}>
                      <span className={shared.rowTitle}>{key.name}</span>
                      <span className={styles.sub}>{key.client}</span>
                    </span>
                    {key.badge ? (
                      <span className={shared.rowMeta}>
                        <span className={shared.chip} data-tone="wait">
                          {key.badge}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {money.length ? (
          <div className={shared.group}>
            <p className={shared.groupTitle}>{t("home_care.money.mine_title")}</p>
            <ul className={shared.rows}>
              {money.map((item) => (
                <li key={item.id} className={shared.rowItem}>
                  <Link className={shared.row} href={item.href} prefetch={false} data-money={item.id}>
                    <span className={styles.main}>
                      <span className={shared.rowTitle}>{item.client}</span>
                    </span>
                    <span className={shared.rowMeta}>
                      <span className={shared.time}>{item.amount}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * „Mis juhtus?": viis valikut ja saatmine eraldi nupuga, et juhuslik puudutus
 * teadet ei saadaks. `options`: [{ value, label }].
 */
export function ObstacleView({ t, options, kind, onKind, busy, error, onSend, onCancel }) {
  return (
    <StepPanel
      title={t("home_care.obstacle.choose_title")}
      note={footNote(error ? { text: error, tone: "risk" } : null, t("home_care.obstacle.hint"))}
      actions={
        <>
          <Button {...SMALL} data-obstacle="cancel" onClick={onCancel}>
            {t("home_care.obstacle.cancel")}
          </Button>
          <Button type="button" size="sm" variant="primary" data-obstacle="send" disabled={!kind} aria-busy={busy ? "true" : undefined} onClick={onSend}>
            {t("home_care.obstacle.send")}
          </Button>
        </>
      }
    >
      <ChoiceRow label={t("home_care.obstacle.choose_title")} options={options} value={kind} onChange={onKind} columns={2} disabled={busy} />
    </StepPanel>
  );
}

/** Järgmised päevad: iga päeva nimi (ja puudumise märge) ning selle päeva käigud. `days`: [{ key, title, rows }]. */
export function NextDaysView({ t, days }) {
  return (
    <StepPanel title={t("home_care.slots.next_title")}>
      <div className={styles.days}>
        {days.map((day) => (
          <div key={day.key} className={shared.group}>
            <p className={shared.groupTitle}>{day.title}</p>
            {day.rows.length ? (
              <ul className={shared.rows}>
                {day.rows.map((row) => (
                  <VisitRow key={row.key} row={row} />
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </StepPanel>
  );
}
