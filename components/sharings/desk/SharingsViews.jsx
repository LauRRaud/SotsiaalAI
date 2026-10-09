"use client";

/**
 * „Minu jagamised" vaated: lehe kest, osa loend, avatud kirje, paranduse vorm
 * ja isikuandmete kontroll.
 *
 * MIKS. Leht oli üks pikk veerg: nähtav pealkiri ja selle all kaksteist
 * sektsiooni üksteise järel (1536 × 640 aknas 2606 px sisu 522 px paneelis),
 * iga kirje omaette kõrge kaart kolme lahtri, märkuse ja nuppudega. Nüüd on
 * leht sammulava (`components/stage/StepFlight.jsx`) laua kujul: see avaneb
 * kõigi osade ülevaates ja osa avaneb omaette vaates madala loendina.
 *
 * VAATED (ühe osa sees vahetuvad need kohapeal, mitte sammudena):
 *  - `PartView`        osa loend: selgitus, madalad read, „Laadi veel"; laadimata
 *                      osa ütleb põhjuse ja pakub uut katset
 *  - `ItemView`        avatud kirje: jagatav tekst, kes näeb, kust tuli ja kui
 *                      kaua kehtib, ning tegevused. Otsus ja tagasivõtt küsivad
 *                      teist vajutust ja tagajärg seisab nupu kõrval.
 *  - `CorrectionView`  eelpöördumise parandus: kolm välja, üks saatmine
 *  - `PrivacyView`     server leidis parandusest isikuandmeid: kolm valikut
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../MySharingsPage.jsx;
 * read ja reeglid failis ./sharingRows.js.
 *
 * Kujundus: sharings.module.css (siin kõrval).
 */

import { useEffect, useRef } from "react";

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";

import OwnershipBar from "../OwnershipBar";
import styles from "./sharings.module.css";

/** Märk: seis ühe sõnaga. Tühja teksti korral märki ei ole. */
export function Chip({ tone, children }) {
  if (!children) return null;
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * Viga selle vaate sees, kus tegevus tehti. See seisab vaate sisu LÕPUS, kohe
 * tegevuste juures: pika teksti all olevat nuppu vajutanud inimene ei näeks
 * viga, mis ilmub vaate ülaserva. Ühine paneelikiht joonistab hoiatuse rolli
 * oma kastina; klass ütleb kuju ise.
 */
function ViewError({ text }) {
  if (!text) return null;
  return (
    <p className={styles.notice} data-tone="risk" role="alert">
      {text}
    </p>
  );
}

/* All hoitud Enter või tühik (klahvikordus) ei tohi sama nuppu teist korda
   vajutada: esimene ja teine aste on sama nupp. */
function ignoreKeyRepeat(event) {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
}

/**
 * Lehe kest: pealkiri ekraanilugejale, teade laua kohal, laadimine ja laadimise
 * viga. Teade (tegevus õnnestus; tegevus õnnestus, aga ülevaadet ei saanud
 * värskendada) seisab laua KOHAL ja jääb ette järgmise tegevuseni: kirje, mille
 * kohta see käib, võib pärast tegevust loendist kadunud olla.
 */
export function SharingsShell({ title, notice, noticeRef, loadingText, error, retryText, onRetry, children }) {
  return (
    <section className={styles.page}>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{title}</h1>
      {/* `aria-live`, mitte status-roll: ühine paneelikiht joonistab iga
          status-rolliga elemendi omal moel. Ala on alati olemas, et
          ekraanilugeja kuuleks, kui teade sinna ilmub. */}
      <div className={styles.live} aria-live="polite">
        {notice?.text ? (
          <p className={styles.notice} data-tone={notice.tone} data-top="1" tabIndex={-1} ref={noticeRef}>
            {notice.text}
          </p>
        ) : null}
      </div>
      {loadingText ? <p className={styles.quiet}>{loadingText}</p> : null}
      {error ? (
        <div className={styles.fault}>
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

/** Laua kohal: otsust ootav ettepanek (rõhutatud) või lause, et jagamisi ei ole. */
export function DeskLead({ lead }) {
  if (!lead?.text) return null;
  return (
    <p className={styles.lead} data-attention={lead.key === "attention" ? "1" : undefined}>
      {lead.text}
    </p>
  );
}

/** Plaadi kokkuvõte: otsust ootava osa ees on märge sõna ja raamiga. */
export function TileSummary({ flag, text }) {
  if (!flag) return text;
  return (
    <>
      <span className={styles.flag}>{flag}</span> {text}
    </>
  );
}

/* Lähim kerija (klaaspaneeli sisu): sama otsing mis laval. */
function scrollerOf(start) {
  let node = start?.parentElement || null;
  while (node && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Osa sisu vahetub kohapeal (loend, avatud kirje, parandus). Vajutatud nupp
 * kaob koos vana sisuga, seepärast läheb fookus uue sisu juurde: paranduse
 * vormis esimesele väljale, mujal osa pealkirjale. Pealkiri on neutraalne
 * siht: pärast tagasivõttu ei tohi fookus sattuda järgmise kirje nupule.
 *
 * Uus sisu algab ülevalt. Kes avas kirje pika loendi lõpust, näeks muidu
 * avatud kirje LÕPPU (nuppe) ja jagatav tekst jääks ülespoole kerimise taha.
 * Paneeli keritakse ainult tagasi (osa alguseni), mitte kunagi edasi.
 *
 * Lava hoiab kõiki osi korraga elus: fookust ja kerimist puudutab ainult see
 * osa, mis on ees ja nähtav.
 */
export function PartSwap({ mode, children }) {
  const ref = useRef(null);
  const shown = useRef(mode);
  useEffect(() => {
    if (shown.current === mode) return;
    shown.current = mode;
    const node = ref.current;
    if (!node || node.offsetParent === null || node.closest("[data-active]")?.getAttribute("data-active") !== "1") return;
    const target = (mode === "correction" ? node.querySelector("input:not(:disabled), textarea:not(:disabled)") : null) || node.querySelector("[data-step-heading]");
    /* Kui fookus on juba mujal kui kaduval sisul (teade laua kohal pärast
       ruumist lahkumist või kutse tagasivõtmist), jääb see sinna: fookuse
       äraviimine katkestaks teate ettelugemise. */
    const focused = document.activeElement;
    const elsewhere = focused && focused !== document.body && !node.contains(focused);
    if (!elsewhere) target?.focus({ preventScroll: true });
    const scroller = scrollerOf(node);
    if (!scroller) return;
    const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (scroller.scrollTop > top) scroller.scrollTop = Math.max(0, top);
  }, [mode]);
  return (
    <div className={styles.swap} ref={ref}>
      {children}
    </div>
  );
}

/** Rea sisu: pealkiri, selle all üks rida, paremal märgid ja aeg. */
function RowBody({ row }) {
  return (
    <>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{row.title}</span>
        {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
      </span>
      <span className={styles.rowMeta}>
        <Chip>{row.kind}</Chip>
        <Chip tone={row.tone}>{row.chip}</Chip>
        {row.time ? <span className={styles.time}>{row.time}</span> : null}
      </span>
    </>
  );
}

/**
 * Osa loend. Rida on nii madal kui võimalik: pealkiri, seis märgina, aeg ja
 * üks tegevus (ava). Kirje, millega siin midagi teha ei saa, ei avane: selle
 * kolm fakti (kes näeb, kust tuli, kui kaua kehtib) on real endal.
 *
 * `unavailable`: osa jäi laadimata; lause ütleb põhjuse ja nupp proovib ainult
 * seda osa uuesti. `more`: järgmine lehekülg (`onClick`) või märkus, et server
 * rohkem ei anna (`note`).
 */
export function PartView({ t, title, lead, error, unavailable, rows, emptyText, note, more, factLabels }) {
  return (
    <StepPanel title={title} lead={lead}>
      <div className={styles.stack}>
        {unavailable ? (
          <div className={styles.fault}>
            <p className={styles.quiet} aria-live="polite">
              {unavailable.text}
            </p>
            <Button type="button" size="sm" variant="secondary" disabled={unavailable.busy} onClick={unavailable.onRetry}>
              {t("my_sharings.actions.retry_section")}
            </Button>
          </div>
        ) : rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.key} className={styles.rowItem}>
                {row.onOpen ? (
                  <button type="button" className={styles.row} data-attention={row.attention ? "1" : undefined} onClick={row.onOpen}>
                    <RowBody row={row} />
                    <span className={styles.rowOpen} aria-hidden="true">
                      {t("my_sharings.views.open")} ›
                    </span>
                  </button>
                ) : (
                  <div className={styles.item}>
                    <RowBody row={row} />
                    {row.facts ? <OwnershipBar labels={factLabels} {...row.facts} /> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{emptyText}</p>
        )}
        {note ? <p className={styles.small}>{note}</p> : null}
        {more ? (
          <div className={styles.more}>
            {more.onClick ? (
              <Button type="button" size="sm" variant="secondary" disabled={more.busy} onClick={more.onClick}>
                {t("my_sharings.actions.load_more")}
              </Button>
            ) : null}
            {more.note ? <p className={styles.small}>{more.note}</p> : null}
          </div>
        ) : null}
        <ViewError text={error} />
      </div>
    </StepPanel>
  );
}

/**
 * Avatud kirje. Üleval see, mille üle inimene otsustab (jagatav tekst ja
 * sildiga laused), siis kolm fakti ja märkused, all tegevused.
 *
 * `confirm` on tegevus, mis küsib teist vajutust (otsus, tagasivõtt, lahkumine):
 * nupud vasakul ja nende kõrval lause. Enne vajutust ütleb lause, millal
 * tegevus võimalik on (`hint`); pärast esimest vajutust ütleb see tagajärje
 * (`note`) ja nupu sõnad muutuvad. Nupp ei liigu, kui lause vahetub.
 * Nuppe päringu ajaks välja ei lülitata (väljalülitatud nupp kaotaks
 * klaviatuuri fookuse): topeltsaatmist hoiab lehe enda lukk.
 */
export function ItemView({ t, title, error, sheet, factLabels, confirm, actions, busy, glow, onInactive, onBack }) {
  /* Kui osa ei ole enam ees (inimene läks ülevaatesse või teise ossa), ei jää
     pooleli kinnitus ootama: tagasi tulles on nupp jälle esimeses astmes. */
  useEffect(() => {
    if (!glow) onInactive?.();
  }, [glow, onInactive]);
  return (
    <StepPanel
      title={title}
      question={sheet.title}
      lead={sheet.lead || undefined}
      actions={
        <>
          {actions.map((action) => (
            <Button key={action.key} type="button" size="sm" variant="secondary" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="linkBrand" onClick={onBack}>
            {t("my_sharings.views.back")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {sheet.chip || sheet.kind || sheet.time ? (
          <p className={styles.line}>
            <Chip>{sheet.kind}</Chip>
            <Chip tone={sheet.tone}>{sheet.chip}</Chip>
            {sheet.time ? <span className={styles.time}>{sheet.time}</span> : null}
          </p>
        ) : null}
        {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
        {sheet.text ? <p className={styles.shared}>{sheet.text}</p> : null}
        {sheet.details.length ? (
          <dl className={styles.details}>
            {sheet.details.map((detail) => (
              <div key={detail.key} className={styles.detail}>
                <dt className={styles.detailLabel}>{detail.label}</dt>
                <dd className={styles.detailValue}>{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {sheet.facts ? <OwnershipBar labels={factLabels} {...sheet.facts} /> : null}
        {sheet.notes.map((note) => (
          <p key={note} className={styles.small}>
            {note}
          </p>
        ))}
        {confirm ? (
          <div className={styles.confirm} aria-busy={busy ? "true" : undefined}>
            <span className={styles.buttons}>
              {confirm.buttons.map((button) => (
                <Button
                  key={button.key}
                  type="button"
                  size="sm"
                  variant={button.primary ? "primary" : "secondary"}
                  /* Põhinupu helk joonistub oma pinnale ja lava hoiab kõiki
                     osi korraga elus: helk on ainult ees oleval osal. */
                  glow={button.primary ? glow : false}
                  className={button.armed ? styles.armed : styles.confirmButton}
                  onKeyDown={ignoreKeyRepeat}
                  onClick={button.onClick}
                >
                  {button.label}
                </Button>
              ))}
            </span>
            {/* Lause koht on alati olemas: ekraanilugeja kuuleb, kui tagajärg sinna ilmub. */}
            <p className={styles.confirmNote} data-armed={confirm.note ? "1" : undefined} aria-live="polite">
              {confirm.note || confirm.hint}
            </p>
          </div>
        ) : null}
        <ViewError text={error} />
      </div>
    </StepPanel>
  );
}

/**
 * Eelpöördumise parandus. Kolm välja saadetakse koos ühe parandusena: teema ja
 * olukorra kirjeldus vasakul, pöördumise tekst paremal (kitsal pinnal
 * üksteise all). Väljad on mõlemad pikk tekst, seepärast on need veeru laiused.
 * Väljasid saatmise ajaks ei lukustata (lukustamine viiks fookuse ära).
 */
export function CorrectionView({ t, title, error, form, limits, busy, glow, who }) {
  return (
    <Form className={styles.form} validate={false} onSubmit={form.onSubmit}>
      <StepPanel
        title={title}
        question={t("my_sharings.correction.title")}
        lead={t("my_sharings.notice.correction")}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={form.onCancel}>
              {t("my_sharings.actions.cancel")}
            </Button>
            <Button type="submit" size="sm" variant="primary" glow={glow}>
              {t("my_sharings.actions.send_correction")}
            </Button>
          </>
        }
      >
        {/* Saatmise ajal on sisu tuhmim; väljad jäävad kirjutatavaks. */}
        <div className={styles.stack} aria-busy={busy ? "true" : undefined}>
          {who ? <p className={styles.who}>{who}</p> : null}
          <div className={styles.correction}>
            <div className={styles.correctionSide}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("my_sharings.correction.topic")}</span>
                <Input value={form.topic} maxLength={limits.topic} autoComplete="off" onChange={(event) => form.onTopic(event.target.value)} />
              </label>
              <TextAreaField label={t("my_sharings.correction.situation")} value={form.situation} onChange={form.onSituation} rows={4} maxLength={limits.situation} />
            </div>
            <TextAreaField label={t("my_sharings.correction.text")} value={form.text} onChange={form.onText} rows={7} maxLength={limits.text} />
          </div>
          <ViewError text={error} />
        </div>
      </StepPanel>
    </Form>
  );
}

/**
 * Server leidis paranduse tekstist isikuandmeid ja küsib, mida teha. Lause on
 * sama mis enne; valikud on: tagasi teksti muutma, varjatud versioon või
 * teadlik algse teksti saatmine (ainult siis, kui server seda lubab).
 */
export function PrivacyView({ t, title, error, prompt, busy, who, texts = [] }) {
  const shown = texts.filter((entry) => String(entry.value || "").trim());
  return (
    <StepPanel
      title={title}
      question={t("my_sharings.correction.privacy_title")}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={prompt.onEdit}>
            {t("my_sharings.views.edit_text")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={prompt.onRedacted}>
            {t("my_sharings.actions.use_redacted")}
          </Button>
          {prompt.onOriginal ? (
            <Button type="button" size="sm" variant="secondary" onClick={prompt.onOriginal}>
              {t("my_sharings.actions.send_original")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={styles.stack} aria-busy={busy ? "true" : undefined}>
        {/* Hoiatuse roll: ekraanilugeja ütleb lause välja kohe, kui vaade vormi asemele tuleb. */}
        <p className={styles.privacy} role="alert">
          {t("my_sharings.correction.privacy_body")}
        </p>
        {who ? <p className={styles.who}>{who}</p> : null}
        {/* Tekst, mille kohta küsitakse, on valiku juures näha. Tekst on TEKST:
            sisu tuleb React'i lapsena, mitte HTML-ina. */}
        {shown.length ? (
          <dl className={styles.details}>
            {shown.map((entry) => (
              <div key={entry.key} className={styles.detail}>
                <dt className={styles.detailLabel}>{entry.label}</dt>
                <dd className={`${styles.detailValue} ${styles.sentText}`}>{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <ViewError text={error} />
      </div>
    </StepPanel>
  );
}
