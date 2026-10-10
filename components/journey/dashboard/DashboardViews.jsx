"use client";

/**
 * Teekonna avalehe vaated: loend, alustamise viis väikest vaadet ning lehe
 * seisud (laadimine, sisselogimata, teine roll).
 *
 * MIKS. Avaleht oli üks 1839 px kõrgune veerg 496 px paneelis: kast kasti sees
 * oma pealkirjaga „Töölaud", nupurida, privaatsuse lõik, iga Teekond kõrge
 * kaardina (arhiveerimine ühe vajutusega) ja alustamise vorm, mille kohal seisis
 * sissejuhatust kattev riba „Kiire abi". Nüüd on korraga ees üks asi:
 *  - `BoardView`     inimese Teekonnad madalate ridadena (käimas ees, varasemad
 *                    kahe ühelaiuse lahtri taga) ja „Alusta Teekonda"
 *  - `DescribeView`  olukord oma sõnadega; kiire abi numbrid nimedega välja all
 *  - `WishView`      mida inimene ise soovib (seda teksti platvorm ei muuda)
 *  - `OverviewView`  mis platvorm kirjeldusest kokku pani: pealkiri ja teemad
 *  - `AheadView`     mis võib veel puudu olla, võimalikud järgmised sammud ja
 *                    ettevaatlikud tähelepanekud koos kiire abi numbritega
 *  - `SaveView`      salvestamine (ja kaks teed kohe edasi)
 *
 * Siin on ainult kuju. Otsused on failis ./journeyBoard.js; olek ja päringud
 * lehel (`../JourneyDashboard.jsx`).
 *
 * Kujundus: dashboard.module.css (siin kõrval) ja Teekonna lehtede ühine
 * ../journey.module.css.
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

import shared from "../journey.module.css";
import styles from "./dashboard.module.css";
import { QUICK_HELP, SITUATION_LIMIT, TITLE_LIMIT, counterNear } from "./journeyBoard";

const SMALL = Object.freeze({ type: "button", size: "sm", variant: "secondary" });

/* All hoitud Enter või tühik (klahvikordus) ei tohi sama nuppu teist korda
   vajutada: esimene ja teine aste on sama nupp. */
function ignoreKeyRepeat(event) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
}

/** Vaate teade all servas: tõrge hoiatava tooniga, muu rahulikult. */
function footNote(notice, quiet = "") {
  if (!notice?.text) return quiet;
  return notice.tone === "risk" ? <span className={shared.footError}>{notice.text}</span> : notice.text;
}

function Counter({ t, value, limit }) {
  const near = counterNear(value, limit);
  return near ? <span className={shared.counter}>{t("journey.labels.character_count", near)}</span> : null;
}

/**
 * Kiire abi numbrid: nimi ja helistatav number. Vaikne rida sisu sees, mis ei
 * kata midagi; alustamise esimeses vaates alati näha.
 */
export function QuickHelp({ t }) {
  return (
    <p className={styles.help}>
      <span className={styles.helpLabel}>{t("journey.quick_help.label")}</span>
      {QUICK_HELP.map((item) => {
        const number = t(`journey.quick_help.${item.key}`);
        return (
          <a key={item.key} className={styles.helpLink} href={`tel:${item.tel}`}>
            {t(`journey.quick_help.names.${item.key}`)} {number}
          </a>
        );
      })}
    </p>
  );
}

/** Leht ootab (sessioon, roll või esimene loend). */
export function WaitingView({ t }) {
  return (
    <StepPanel title={t("journey.title")}>
      <p className={shared.quiet} aria-live="polite">
        {t("journey.messages.loading")}
      </p>
    </StepPanel>
  );
}

/** Sisselogimata: üks lause ja tee sisselogimisse, mis toob siia tagasi. */
export function SignedOutView({ t, loginHref }) {
  return (
    <StepPanel
      title={t("journey.title")}
      lead={t("journey.messages.auth_required")}
      actions={
        <Button as="a" href={loginHref} size="sm" variant="primary">
          {t("journey.actions.login")}
        </Button>
      }
    />
  );
}

/** Spetsialist või teenuseosutaja: kellegi Teekonda siin ei näe, kolm teed kinnitatud info juurde. */
export function RoleView({ t, sheet, hrefOf }) {
  return (
    <StepPanel title={t("journey.title")} question={t(sheet.title)}>
      <div className={shared.stack}>
        {sheet.lead.map((key) => (
          <p key={key} className={shared.quiet}>
            {t(key)}
          </p>
        ))}
        <ul className={shared.rows}>
          {sheet.actions.map((action) => (
            <li key={action.key} className={shared.rowItem}>
              <a className={shared.row} href={hrefOf(action.href)}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{t(action.title)}</span>
                  <span className={shared.rowSub}>{t(action.description)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </StepPanel>
  );
}

/** Laadimise viga: lause ja uus katse, mitte kast. */
function LoadFault({ t, text, onRetry }) {
  if (!text) return null;
  return (
    <div className={shared.fault}>
      <p className={shared.faultText} role="alert">
        {text}
      </p>
      {onRetry ? (
        <Button {...SMALL} onClick={onRetry}>
          {t("journey.board.retry")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Loend. Rida avab Teekonna; käimasoleva rea kõrval on arhiveerimine, mis küsib
 * teist vajutust SAMAL nupul ja ütleb rea all, mis juhtub.
 *
 * `archive`: { armedId, busyId, onPress(row), onCancel() }
 * `more`: { loaded, total, busy, onMore } või null
 */
export function BoardView({ t, rows, filter, onFilter, empty, fault, onRetry, notice, archive, more, hrefOf, onOpen, onStart, glow = true }) {
  const start = (
    <Button type="button" size="sm" variant="primary" glow={glow} data-start="1" onClick={onStart}>
      {t("journey.workspace.client.start")}
    </Button>
  );
  /* Tühi leht: üks lause ja selle all algus. Kui Teekondi on, seisab algus
     loendi kohal paremal, et see ei jääks pika loendi taha. */
  if (empty) {
    return <StepPanel title={t("journey.board.title")} lead={t("journey.board.empty")} note={t("journey.review.privacy_note")} actions={start} />;
  }
  return (
    <StepPanel title={t("journey.board.title")} note={footNote(notice, t("journey.review.privacy_note"))}>
      <div className={shared.stack}>
        <div className={styles.bar}>
          <div className={styles.filter}>
            {filter.choice ? (
              <ChoiceRow
                label={t("journey.board.filter.label")}
                labelHidden
                options={[
                  { value: "active", label: t("journey.board.filter.active") },
                  { value: "earlier", label: t("journey.board.filter.earlier") }
                ]}
                value={filter.shown}
                onChange={onFilter}
                columns={2}
                keepColumns
              />
            ) : null}
          </div>
          {start}
        </div>
        <LoadFault t={t} text={fault} onRetry={onRetry} />
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => {
              const armed = archive.armedId === row.id;
              const busy = archive.busyId === row.id;
              return (
                <li key={row.id} className={styles.item} data-armed={armed ? "1" : undefined} aria-busy={busy ? "true" : undefined}>
                  <a
                    className={shared.row}
                    href={hrefOf(row)}
                    aria-label={t("journey.board.open_named", { title: row.title })}
                    onClick={(event) => onOpen(event, row)}
                  >
                    <span className={shared.rowMain}>
                      <span className={shared.rowTitle}>{row.title}</span>
                      {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                    </span>
                    <span className={shared.rowMeta}>
                      {row.chip ? (
                        <span className={shared.chip} data-tone={row.attention ? "wait" : undefined}>
                          {row.chip}
                        </span>
                      ) : null}
                      {row.day ? (
                        <time className={shared.time} dateTime={row.updatedAt || undefined} title={t("journey.labels.updated_at", { date: row.day })}>
                          {row.day}
                        </time>
                      ) : null}
                    </span>
                  </a>
                  {row.canArchive ? (
                    <span className={styles.itemAside}>
                      <Button
                        {...SMALL}
                        className={armed ? shared.armed : styles.aside}
                        data-archive={row.id}
                        aria-label={armed ? undefined : t("journey.actions.archive_named", { title: row.title })}
                        aria-describedby={armed ? `journey-archive-note-${row.id}` : undefined}
                        onKeyDown={ignoreKeyRepeat}
                        onClick={() => archive.onPress(row)}
                      >
                        {busy ? t("journey.board.archive.busy") : armed ? t("journey.board.archive.confirm") : t("journey.actions.archive")}
                      </Button>
                      {armed ? (
                        <Button {...SMALL} onClick={archive.onCancel}>
                          {t("journey.actions.decline")}
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
                  {armed ? (
                    <p className={styles.itemNote} id={`journey-archive-note-${row.id}`}>
                      {t("journey.board.archive.note")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {more ? (
          <div className={styles.more}>
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} onClick={more.onMore}>
              {t("journey.actions.load_more")}
            </Button>
            <span className={shared.small}>{t("journey.board.more", { loaded: more.loaded, total: more.total })}</span>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Loobumine: muudetud tekstiga küsib teist vajutust samal nupul. */
function DeclineButton({ t, decline }) {
  return (
    <Button {...SMALL} className={decline.armed ? shared.armed : undefined} data-decline="1" onKeyDown={ignoreKeyRepeat} onClick={decline.onPress}>
      {decline.armed ? t("journey.start.decline.confirm") : t("journey.actions.decline")}
    </Button>
  );
}

/**
 * Esimene vaade: olukord oma sõnadega. Üks pikk tekstiväli (täislai, sest see
 * on pikk tekst), näide kohatäitena. Välja all on kiire abi numbrid nimedega.
 */
export function DescribeView({ t, value, onChange, fieldRef, notice, busy, decline, onBuild, glow }) {
  return (
    <StepPanel
      title={t("journey.start.steps.describe.title")}
      lead={t("journey.sections.start_description")}
      note={footNote(decline.armed ? { text: t("journey.start.decline.note") } : notice)}
      actions={
        <>
          <DeclineButton t={t} decline={decline} />
          <Button type="button" size="sm" variant="primary" glow={glow} aria-busy={busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={onBuild}>
            {busy ? t("journey.start.building") : t("journey.start.build")}
          </Button>
        </>
      }
    >
      <div className={styles.field}>
        <label className="sr-only" htmlFor="journey-situation">
          {t("journey.labels.situation")}
        </label>
        <Textarea
          id="journey-situation"
          ref={fieldRef}
          className={styles.area}
          rows={7}
          value={value}
          maxLength={SITUATION_LIMIT}
          placeholder={t("journey.placeholders.situation")}
          onChange={(event) => onChange(event.target.value)}
        />
        <Counter t={t} value={value} limit={SITUATION_LIMIT} />
        <QuickHelp t={t} />
      </div>
    </StepPanel>
  );
}

/** Neljas vaade: inimese soov tema enda sõnadega. Vabatahtlik. */
export function WishView({ t, value, limit, onChange }) {
  return (
    <StepPanel title={t("journey.start.steps.wish.title")} note={t("journey.start.wish_later")}>
      <TextAreaField
        label={t("journey.wish.label")}
        hint={t("journey.wish.hint")}
        value={value}
        onChange={onChange}
        rows={5}
        maxLength={limit}
      />
      <Counter t={t} value={value} limit={limit} />
    </StepPanel>
  );
}

/**
 * Ülevaadet ei ole: kirjeldus on tühi, ülevaadet alles koostatakse või selle
 * koostamine ei õnnestunud. Vaade ütleb seda ise ja pakub teed edasi. Sammude
 * loend jääb samaks, et kirjutamise ajal miski ei hüppaks.
 *
 * `pending`: { state: "empty" | "building" | "waiting" | "failed", text? }
 */
function PendingBody({ t, pending, onDescribe, onBuild }) {
  if (pending.state === "building") {
    return (
      <p className={shared.quiet} aria-live="polite">
        {t("journey.start.building")}
      </p>
    );
  }
  const failed = pending.state === "failed";
  return (
    <div className={shared.stack}>
      {failed ? (
        <p className={shared.faultText} role="alert">
          {pending.text}
        </p>
      ) : (
        <p className={shared.quiet}>{pending.state === "empty" ? t("journey.start.pending") : t("journey.start.waiting")}</p>
      )}
      <div className={styles.more}>
        {pending.state === "empty" ? null : (
          <Button {...SMALL} onClick={onBuild}>
            {failed ? t("journey.board.retry") : t("journey.start.build")}
          </Button>
        )}
        <Button {...SMALL} onClick={onDescribe}>
          {t("journey.start.to_describe")}
        </Button>
      </div>
    </div>
  );
}

/** Sõnade rida sildiga: teemad ja eluvaldkonnad on loetavad sõnad, mitte nupud. */
function Words({ label, items }) {
  if (!items.length) return null;
  return (
    <p className={shared.fact}>
      <span className={shared.factLabel}>{label}</span>
      <span className={shared.factValue}>{items.join(", ")}</span>
    </p>
  );
}

/**
 * Teine vaade: mis platvorm kirjeldusest kokku pani. Pealkirja saab muuta;
 * teemad ja eluvaldkonnad on abikiht, mitte hinnang.
 */
export function OverviewView({ t, pending, onDescribe, onBuild, title, onTitle, noticed, notice }) {
  if (pending) {
    return (
      <StepPanel title={t("journey.start.steps.overview.title")}>
        <PendingBody t={t} pending={pending} onDescribe={onDescribe} onBuild={onBuild} />
      </StepPanel>
    );
  }
  return (
    <StepPanel title={t("journey.start.steps.overview.title")} lead={t("journey.start.overview_lead")} note={footNote(notice)}>
      <div className={shared.stack}>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("journey.labels.title")}</span>
          <Input className={shared.input} value={title} maxLength={TITLE_LIMIT} autoComplete="off" onChange={(event) => onTitle(event.target.value)} />
          <Counter t={t} value={title} limit={TITLE_LIMIT} />
        </label>
        <div className={shared.facts}>
          <Words label={t("journey.labels.domains")} items={noticed.domains} />
          <Words label={t("journey.review.life_domains")} items={noticed.lifeDomains} />
        </div>
        <p className={shared.small}>{t("journey.review.life_domains_note")}</p>
      </div>
    </StepPanel>
  );
}

/** Loetav loend pealkirjaga: read üksteise all, ilma kastita. */
function Lines({ title, items, emptyText }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      {items.length ? (
        <ul className={styles.lines}>
          {items.map((item) => (
            <li key={item} className={styles.lineItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.quiet}>{emptyText}</p>
      )}
    </div>
  );
}

/**
 * Kolmas vaade: mis võib veel puudu olla ja mida saab edasi teha. Ainult
 * lugemiseks. Ettevaatlikud tähelepanekud on näha ainult inimesele endale ja
 * nende juures on kiire abi numbrid.
 */
export function AheadView({ t, pending, onDescribe, onBuild, noticed }) {
  if (pending) {
    return (
      <StepPanel title={t("journey.start.steps.ahead.title")}>
        <PendingBody t={t} pending={pending} onDescribe={onDescribe} onBuild={onBuild} />
      </StepPanel>
    );
  }
  return (
    <StepPanel title={t("journey.start.steps.ahead.title")}>
      <div className={shared.stack}>
        <div className={styles.pair}>
          <Lines title={t("journey.review.missing_title")} items={noticed.missing} emptyText={t("journey.messages.empty_missing_info")} />
          <Lines title={t("journey.review.actions_title")} items={noticed.actions} emptyText={t("journey.messages.empty_suggested_actions")} />
        </div>
        {noticed.risks.length ? (
          <div className={styles.risk}>
            <p className={styles.riskTitle}>{t("journey.risk_card.title")}</p>
            {noticed.risks.map((risk) => (
              <p key={risk} className={styles.riskText}>
                {risk}
              </p>
            ))}
            <QuickHelp t={t} />
            <p className={shared.small}>{t("journey.risk_card.body")}</p>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Viies vaade: salvestamine. Põhitegevus on all servas; kaks kaarti salvestavad
 * Teekonna ja avavad selle kohe valitud osa juures.
 *
 * `save`: { busy, onSave(startWith) }
 */
export function SaveView({ t, pending, onDescribe, onBuild, notice, decline, save, glow }) {
  if (pending) {
    return (
      <StepPanel title={t("journey.start.steps.save.title")}>
        <PendingBody t={t} pending={pending} onDescribe={onDescribe} onBuild={onBuild} />
      </StepPanel>
    );
  }
  return (
    <StepPanel
      title={t("journey.start.steps.save.title")}
      lead={t("journey.review.privacy_note")}
      note={footNote(decline.armed ? { text: t("journey.start.decline.note") } : notice)}
      actions={
        <>
          <DeclineButton t={t} decline={decline} />
          <Button
            type="button"
            size="sm"
            variant="primary"
            glow={glow}
            data-save="1"
            aria-busy={save.busy ? "true" : undefined}
            onKeyDown={ignoreKeyRepeat}
            onClick={() => save.onSave("")}
          >
            {save.busy ? t("journey.start.saving") : t("journey.actions.save_private")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined}>
        <p className={shared.quiet}>{t("journey.review.start_hint")}</p>
        <ActionCardGrid label={t("journey.review.start_hint")}>
          <ActionCard
            title={t("journey.review.save_and_open_service_map")}
            description={t("journey.start.save_service_map_note")}
            onClick={() => save.onSave("SERVICE_MAP")}
          />
          <ActionCard
            title={t("journey.review.save_and_start_pre_inquiry")}
            description={t("journey.start.save_pre_inquiry_note")}
            onClick={() => save.onSave("PRE_INQUIRY")}
          />
        </ActionCardGrid>
        <p className={shared.small}>{t("journey.review.later_steps")}</p>
      </div>
    </StepPanel>
  );
}
