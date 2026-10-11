"use client";

/**
 * Materjalide lehe vaated: minu saadetud materjalid, avatud materjal ja
 * materjali saatmine. Ühised tükid (märk, teade, faktid, loendiread) on samas
 * failis ja neid kasutavad ka ülevaatuse vaated (./ReviewViews.jsx).
 *
 * MIKS. Leht oli üks veerg: nähtav pealkiri, saatmise vorm ja selle all teine
 * pealkiri „Minu saadetud materjalid" kõrgete ridadega, kus igal real seisid
 * kolm säilitamise rida, link ja tagasivõtmise nupp. Nüüd on korraga ees üks
 * asi:
 *  - `MineListView`      loend: madal rida (nimi, seis märgina, päev, „Ava")
 *  - `MaterialItemView`  avatud materjal: faktid, allalaadimine, tagasivõtmine
 *  - `SendView`          saatmine: failide valik ja selgitus
 *
 * Loend ja saatmise vorm ei ole kaks järjestikust sammu, seepärast vahetuvad
 * need kohapeal (nagu juhtumite loend ja uus juhtum), mitte sammulaval.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../MaterialsPage.jsx,
 * read ja reeglid failis ./materialRows.js.
 *
 * Kujundus: materials.module.css (siin kõrval).
 */

import { useEffect, useId, useRef } from "react";

import ConfirmButton from "@/components/casework/ConfirmButton";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";

import { COMMENT_MAX } from "./materialRows";
import styles from "./materials.module.css";

export const SMALL_BUTTON = Object.freeze({ size: "sm", variant: "secondary" });
/* Pöördumatu teo nupp kannab märget, et see ei näeks välja nagu tavaline tegevus. */
export const DANGER_BUTTON = Object.freeze({ ...SMALL_BUTTON, "data-danger": "true" });

export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * Lehe teade vaadete kohal. Viga on `alert`; muu teade on `aria-live`, mitte
 * status-roll: ühine lehekiht joonistab iga status-rolliga elemendi kastina.
 */
export function Notice({ text, tone }) {
  if (!text) return null;
  return tone === "risk" ? (
    <p className={styles.notice} data-tone="risk" role="alert">
      {text}
    </p>
  ) : (
    <p className={styles.notice} data-tone={tone} aria-live="polite">
      {text}
    </p>
  );
}

/** Vaate viga paneeli all servas (`StepPanel note`). */
export function footError(text) {
  return text ? <span className={styles.footError}>{text}</span> : "";
}

/** Faktid: nimetus ja väärtus paarina, paarid reas üksteise järel. */
export function Facts({ facts }) {
  if (!facts.length) return null;
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.key} className={styles.fact}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Loendi read. Terve rida on üks vajutatav lahter: nimi (ja täpsustus), seis
 * märgina, aeg ning tee edasi.
 * `rows`: [{ id, title, sub?, state, tone, date, onOpen }]
 */
export function Rows({ rows, openText }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.id} className={styles.rowItem}>
          <button type="button" className={styles.row} onClick={row.onOpen}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{row.title}</span>
              {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
            </span>
            <span className={styles.rowMeta}>
              <Chip tone={row.tone}>{row.state}</Chip>
              {row.date ? <span className={styles.time}>{row.date}</span> : null}
            </span>
            <span className={styles.rowOpen} aria-hidden="true">
              {openText} ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Minu saadetud materjalid. Vaate kohal on tee saatmise juurde; administraator
 * näeb selle kõrval ka teed laekunud materjalide ülevaatuse juurde.
 */
export function MineListView({ t, status, rows, error, more, onSend, onReview, onRetry }) {
  return (
    <StepPanel title={t("materials_page.views.list.title")} note={footError(error)}>
      <div className={styles.stack}>
        <div className={styles.bar}>
          <Button type="button" size="sm" variant="primary" onClick={onSend}>
            {t("materials_page.submit")}
          </Button>
          {onReview ? (
            <Button type="button" size="sm" variant="secondary" onClick={onReview}>
              {t("materials_page.admin.title")}
            </Button>
          ) : null}
        </div>
        {rows.length ? (
          <Rows rows={rows} openText={t("materials_page.views.open")} />
        ) : status === "loading" ? (
          <p className={styles.quiet}>{t("materials_page.mine.loading")}</p>
        ) : status === "error" ? (
          /* „Sa pole veel materjale saatnud" öeldakse ainult siis, kui loend päriselt
             laaditi; ebaõnnestunud laadimise järel on siin tee uuesti proovida. */
          <Button type="button" size="sm" variant="secondary" className={styles.more} onClick={onRetry}>
            {t("materials_page.admin.refresh")}
          </Button>
        ) : (
          <p className={styles.quiet}>{t("materials_page.mine.empty")}</p>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {t("materials_page.mine.load_more")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Avatud materjal. Siin on kõik, mis varem tegi loendi rea kõrgeks: seis,
 * säilitamise read, allalaadimine ja tagasivõtmine.
 *
 * Tagasivõtmine kustutab materjali ja küsib teist vajutust (`ConfirmButton`:
 * topeltklõps ega all hoitud klahv teist astet läbi ei tee). Nupp seisab teistest
 * tegevustest eraldi ja selgitus on selle kõrval.
 */
export function MaterialItemView({ t, sheet, error, busy, onBack, onWithdraw }) {
  return (
    <StepPanel
      title={t("materials_page.views.item.title")}
      question={sheet.title}
      note={footError(error)}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            {t("materials_page.views.back_to_list")}
          </Button>
          <Button as="a" href={sheet.downloadHref} size="sm" variant="primary">
            {t("materials_page.admin.download")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.line}>
          <Chip tone={sheet.tone}>{sheet.state}</Chip>
        </div>
        <Facts facts={sheet.facts} />
        {sheet.comment ? <p className={styles.text}>{sheet.comment}</p> : null}
        {sheet.canWithdraw ? (
          <div className={styles.confirm}>
            <ConfirmButton
              as={Button}
              buttonProps={DANGER_BUTTON}
              className={styles.danger}
              cancelClassName=""
              label={t("materials_page.mine.withdraw")}
              confirmLabel={t("materials_page.views.item.withdraw_confirm")}
              cancelLabel={t("materials_page.views.cancel")}
              disabled={busy}
              onConfirm={onWithdraw}
            />
            <p className={styles.confirmNote}>{t("materials_page.views.item.withdraw_note")}</p>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Materjali saatmine: failide valik ja selgitus. Faili valiku nupp kannab ainult
 * juhist; lubatud failid ja piirid on vaikne abirida selle kõrval ning valitud
 * failid (nimi ja suurus) on omal real.
 *
 * `form`: { files, onFiles, accept, help, comment, onComment, commentHint,
 *           error, busy, blocked, onSubmit, onCancel }
 */
export function SendView({ t, form }) {
  const inputRef = useRef(null);
  const helpId = useId();
  const hasFiles = form.files.length > 0;
  /* Kui valik võetakse ära (eemaldati või saadeti ära), tühjendatakse ka peidetud
     failivalija: muidu ei teataks brauser muutusest, kui inimene valib samad
     failid uuesti. */
  useEffect(() => {
    if (!hasFiles && inputRef.current) inputRef.current.value = "";
  }, [hasFiles]);
  return (
    <Form className={styles.form} onSubmit={form.onSubmit}>
      <StepPanel
        title={t("materials_page.views.send.title")}
        lead={t("materials_page.views.send.lead")}
        note={footError(form.error)}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={form.onCancel}>
              {t("materials_page.views.cancel")}
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={!hasFiles || form.busy || form.blocked}>
              {form.busy ? t("materials_page.submitting") : t("materials_page.submit")}
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <div className={styles.pick}>
            {/* Failivalija ise on peidus; seda avab nupp. */}
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              accept={form.accept}
              onChange={(event) => form.onFiles(Array.from(event.target.files || []))}
            />
            <button type="button" className={styles.picker} aria-describedby={helpId} onClick={() => inputRef.current?.click()}>
              {hasFiles ? t("materials_page.views.send.pick_again") : t("materials_page.choose_file")}
            </button>
            <div className={styles.pickInfo}>
              <p className={styles.help} id={helpId}>
                {form.help}
              </p>
              <div className={styles.fileRow} aria-live="polite">
                {hasFiles ? (
                  <>
                    <ul className={styles.files}>
                      {form.files.map((file) => (
                        <li key={file.key} className={styles.file}>
                          <span className={styles.fileName}>{file.name}</span>
                          <span className={styles.time}>{file.size}</span>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className={styles.textButton} onClick={() => form.onFiles([])}>
                      {t("materials_page.views.send.clear")}
                    </button>
                  </>
                ) : (
                  <span>{t("materials_page.views.send.none_selected")}</span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.comment}>
            <TextAreaField
              label={t("materials_page.views.send.comment_label")}
              hint={form.commentHint}
              value={form.comment}
              onChange={form.onComment}
              rows={3}
              maxLength={COMMENT_MAX}
            />
          </div>
        </div>
      </StepPanel>
    </Form>
  );
}
