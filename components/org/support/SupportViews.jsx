"use client";

/**
 * Toe osa vaated.
 *
 * MIKS. Leht oli neli kasti üksteise all: saatmise vorm (hall nupp ilma
 * põhjuseta, kui kinnitus või saaja puudus), saadud avaldused kastidena ja
 * saadetud avaldused tabelina; sulgemine ja tagasivõtmine käisid ühe vajutusega.
 * Nüüd on korraga ees üks asi:
 *  - `SupportBoard`   saadud või saadetud avaldused madalate ridadena (valik
 *                     kahest lahtrist); paremal „Saada toeavaldus"
 *  - `ReceivedView`   üks saadud avaldus: avamine on eraldi teadlik samm, siis sisu
 *  - `WhoView`        saatmine 1/3: kellele (tugiteed ühelaiuste lahtritena)
 *  - `WhatView`       saatmine 2/3: lühikokkuvõte ja mida vajan
 *  - `ConfirmView`    saatmine 3/3: mis läheb, kinnitus ja saatmine
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus: kasutaja peab nägema mustvalgel, et
 * organisatsioon ei tea, kas ta vormi täitis. See seisab loendi all servas.
 *
 * Siin on ainult kuju. Otsused on failis ./supportRules.js; olek ja päringud lehel
 * (`../OrgSupportClient.jsx`).
 */

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import { MeasuresList } from "./MeasureViews";
import shared from "../org.module.css";

/**
 * Loend. `list`: "received" | "sent" | "measures".
 * `send`: { onSend } või null; `recall`: { armedId, busyId, onPress(row), onCancel() };
 * `more`: { busy, onMore } või null; `measureGroups`: mida asutus pakub
 * (`measureGroupsOf`); `editMeasures`: { onEdit, onContacts } haldurile, muidu null.
 */
export function SupportBoard({ t, tabs, list, onList, receivedRows, sentRows, onOpen, send, noRecipients, recall, more, notice, measureGroups = [], editMeasures = null, glow = true }) {
  const rows = list === "sent" ? sentRows : receivedRows;
  const measures = list === "measures";
  return (
    <StepPanel title={t("org.support.heading")} note={footNote(notice, t(measures ? "org.support.measures.note" : "org.support.privacyNotice"))}>
      <div className={shared.stack}>
        <div className={shared.headBar}>
          <ChoiceRow
            label={t("org.support.tabs.label")}
            labelHidden
            options={tabs.map((key) => ({ value: key, label: t(`org.support.tabs.${key}`) }))}
            value={list}
            onChange={onList}
            columns={tabs.length}
            keepColumns
          />
          <span className={shared.headButtons}>
            {measures && editMeasures ? (
              <>
                <Button type="button" size="sm" variant="secondary" data-edit-contacts="1" onClick={editMeasures.onContacts}>
                  {t("org.support.contactAdmin.open")}
                </Button>
                <Button type="button" size="sm" variant="secondary" data-edit-measures="1" onClick={editMeasures.onEdit}>
                  {t("org.support.measures.edit")}
                </Button>
              </>
            ) : null}
            {send ? (
              <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={send.onSend}>
                {t("org.support.send")}
              </Button>
            ) : null}
          </span>
        </div>
        {measures ? (
          <MeasuresList t={t} groups={measureGroups} />
        ) : (
          <>
            {noRecipients ? <p className={shared.small}>{t("org.support.noRecipients")}</p> : null}
            {rows.length === 0 ? (
              <p className={shared.quiet}>{t(list === "sent" ? "org.support.noSent" : "org.support.noReceived")}</p>
            ) : list === "sent" ? (
              <ul className={shared.rows} aria-label={t("org.support.sent")}>
                {sentRows.map((row) => {
                  const armed = recall.armedId === row.id;
                  const busy = recall.busyId === row.id;
                  return (
                    <li key={row.id} className={shared.item} data-armed={armed ? "1" : undefined} data-sent={row.id} aria-busy={busy ? "true" : undefined}>
                      <div className={shared.rowStatic}>
                        <span className={shared.rowMain}>
                          <span className={shared.rowTitle}>{row.title}</span>
                          {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                        </span>
                        {row.chip ? (
                          <span className={shared.rowMeta}>
                            <span className={shared.chip}>{row.chip}</span>
                          </span>
                        ) : null}
                      </div>
                      {row.canRecall ? (
                        <span className={shared.itemAside}>
                          <Button
                            {...SMALL}
                            className={armed ? shared.armed : shared.aside}
                            data-recall={row.id}
                            aria-label={armed ? undefined : `${t("org.support.recall")}: ${row.title}`}
                            onKeyDown={ignoreKeyRepeat}
                            onClick={() => recall.onPress(row)}
                          >
                            {armed ? t("org.support.recall_confirm") : t("org.support.recall")}
                          </Button>
                          {armed ? (
                            <Button {...SMALL} onClick={recall.onCancel}>
                              {t("org.invites.keep")}
                            </Button>
                          ) : null}
                        </span>
                      ) : null}
                      {armed ? <p className={shared.itemNote}>{t("org.support.recall_note")}</p> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className={shared.rows} aria-label={t("org.support.received")}>
                {receivedRows.map((row) => (
                  <li key={row.id} className={shared.rowItem}>
                    <button type="button" className={shared.row} data-received={row.id} onClick={() => onOpen(row.id)}>
                      <span className={shared.rowMain}>
                        <span className={shared.rowTitle}>{row.title}</span>
                        {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                      </span>
                      {row.chip ? (
                        <span className={shared.rowMeta}>
                          <span className={shared.chip} data-tone={row.attention ? "wait" : undefined}>
                            {row.chip}
                          </span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list === "sent" && sentRows.length ? <p className={shared.small}>{t("org.support.recallHint")}</p> : null}
            {more ? (
              <div>
                <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} data-more="1" onClick={more.onMore}>
                  {t("org.pagination.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks saadud avaldus. Avamine on eraldi tegu: enne seda sisu ei ole.
 * `detail`: vt `receivedDetail`; `open`: { busy, onOpen }; `close`: { armed, busy, onPress }
 */
export function ReceivedView({ t, detail, open, close, notice, onBack, glow = true }) {
  return (
    <StepPanel
      title={t("org.support.received")}
      question={t("org.support.from", { name: detail.from })}
      note={footNote(close.armed ? { text: t("org.support.close_note") } : notice, detail.canOpen ? t("org.support.open_note") : "")}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={onBack}>
            {t("org.members.back")}
          </Button>
          {detail.canClose ? <ArmedButton armed={close.armed} busy={close.busy} label={t("org.support.close")} confirm={t("org.support.close_confirm")} onPress={close.onPress} mark="close" /> : null}
          {detail.canOpen ? (
            <Button type="button" size="sm" variant="primary" glow={glow} data-open="1" aria-busy={open.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={open.onOpen}>
              {t("org.support.open_share")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={shared.stack}>
        <Facts rows={detail.facts} />
        {detail.opened ? (
          <>
            {detail.summary ? <p className={shared.own}>{detail.summary}</p> : <p className={shared.quiet}>{t("org.support.no_summary")}</p>}
            {detail.requested ? (
              <div className={shared.group}>
                <p className={shared.groupTitle}>{t("org.support.needs")}</p>
                <p className={shared.own}>{detail.requested}</p>
              </div>
            ) : null}
            {detail.needs.length ? (
              <div className={shared.group}>
                {detail.requested ? null : <p className={shared.groupTitle}>{t("org.support.needs")}</p>}
                <ul className={shared.lines}>
                  {detail.needs.map((need) => (
                    <li key={need} className={shared.lineItem}>
                      {need}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Loobumine: kirjutatud vormiga küsib teist vajutust samal nupul. */
function DeclineButton({ t, decline }) {
  return <ArmedButton armed={decline.armed} label={t("org.home.create.decline.label")} confirm={t("org.home.create.decline.confirm")} onPress={decline.onPress} mark="decline" />;
}

/** Saatmine 1/3: kellele. Iga tugitee ütleb, kes see on ja mis liiki tee see on. */
export function WhoView({ t, options, value, onChoose, notice, decline }) {
  return (
    <StepPanel
      title={t("org.support.steps.who.title")}
      note={footNote(decline.armed ? { text: t("org.support.decline_note") } : notice, t("org.support.who_note"))}
      actions={<DeclineButton t={t} decline={decline} />}
    >
      <PickOne label={t("org.support.who_question")} options={options} value={value} onChange={onChoose} columns={2} />
    </StepPanel>
  );
}

/** Saatmine 2/3: lühikokkuvõte (kohustuslik) ja mida vajan (üks vajadus real). */
export function WhatView({ t, form, onField, notice }) {
  return (
    <StepPanel title={t("org.support.steps.what.title")} note={footNote(notice)}>
      <div className={shared.stack}>
        <TextAreaField label={t("org.support.summary")} value={form.summary} onChange={(value) => onField("summary", value)} rows={3} />
        <TextAreaField label={t("org.support.needs")} hint={t("org.support.needs_hint")} value={form.needs} onChange={(value) => onField("needs", value)} rows={3} />
      </div>
    </StepPanel>
  );
}

/**
 * Saatmine 3/3: mis läheb, kinnitus ja saatmine. Kinnitus on eraldi TEGU. Kui
 * midagi on puudu, ütleb vaade seda all servas ja nupp viib õige vaate juurde.
 *
 * `send`: { busy, onSend }
 */
export function ConfirmView({ t, summary, confirmed, onConfirm, problem, onFix, notice, decline, send, glow }) {
  const missing = problem && problem.step !== "confirm" ? problem : null;
  return (
    <StepPanel
      title={t("org.support.steps.confirm.title")}
      note={footNote(decline.armed ? { text: t("org.support.decline_note") } : notice)}
      actions={
        <>
          <DeclineButton t={t} decline={decline} />
          {missing ? (
            <Button {...SMALL} data-fix="1" onClick={() => onFix(missing)}>
              {t(`org.support.to_${missing.step}`)}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={send.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={send.onSend}>
              {send.busy ? t("org.support.sending") : t("org.support.send")}
            </Button>
          )}
        </>
      }
    >
      <div className={shared.stack} aria-busy={send.busy ? "true" : undefined}>
        {missing ? <p className={shared.quiet}>{t(missing.key)}</p> : <Facts rows={summary} />}
        <CheckCard title={t("org.support.confirm_title")} description={t("org.support.confirm_terms")} checked={confirmed} onChange={onConfirm} />
      </div>
    </StepPanel>
  );
}
