"use client";

/**
 * Mentorlussuhte vaated: päis ja suhte seitse osa.
 *
 * MIKS. Leht oli üks pikk veerg klaaspaneeli sees olevas tumedas kaardis:
 * eesmärgid, kokkulepe, kohtumised, kokkuvõtted, ettevalmistus, märkmed ja
 * suhte seis üksteise all, iga loendi all kohe selle vorm ja iga kirje küljes
 * rida nuppe. Nüüd on iga osa lava osa (`components/stage/StepFlight.jsx`,
 * `parts`): suhe avaneb kõigi osade ülevaates ja osa avaneb omaette vaates.
 *
 * ÜKS ASI KORRAGA. Osa näitab kas loendit, avatud kirjet või vormi (`mode`),
 * mitte kõiki korraga:
 *  - `GoalView`         eesmärkide tekst
 *  - `AgreementView`    kehtiv kokkulepe ja kinnitused, või uue versiooni tekst
 *  - `MeetingsView`     kohtumiste loend, avatud kohtumine, uue kohtumise vorm
 *  - `SummariesView`    kokkuvõtete loend, avatud kokkuvõte, mustand, parandus
 *  - `PreparationView`  ettevalmistused, avatud ettevalmistus, Tööheaolust toodav tekst
 *  - `NotesView`        minu märkmed, avatud märge, uus märge
 *  - `StateView`        suhte seis ja tegevused, või lõpetamise ülevaade
 *
 * Tegevus, mida tagasi võtta ei saa (kohtumise tühistamine, mustandi kõrvale
 * jätmine, suhte lõpetamine), küsib teist vajutust.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MentoringRelationPage.jsx; read ja otsused failis ./relationRows.js.
 *
 * Kujundus: relation.module.css (siin kõrval). Avatavad read, lõpliku teo nupp
 * ja fookuse hoidmine on failis ../desk/DeskParts.jsx (ühised halduse lehega),
 * märk ja laused failis ../entry/entry.module.css.
 */

import ActionCard from "@/components/stage/ActionCard";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";

import { FullText, OpenRows, SMALL_BUTTON, TwoStep, useSwapFocus } from "../desk/DeskParts";
import { Chip, TextLink } from "../entry/EntryParts";
import entry from "../entry/entry.module.css";
import styles from "./relation.module.css";

/** Lehe päis lava kohal: kes on teine pool, mis seisus suhe on ja tee tagasi mentorlusse. */
export function RelationHead({ t, who, chip, reason, backHref }) {
  return (
    <header className={styles.head}>
      <p className={styles.who}>{who}</p>
      <Chip tone={chip.tone}>{chip.text}</Chip>
      <Chip tone="quiet">{reason}</Chip>
      <span className={styles.headLink}>
        <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
      </span>
    </header>
  );
}

/**
 * Eesmärgid: üks tekst, mida näevad mõlemad pooled. Väli jääb salvestamise ajal
 * kirjutatavaks (lukus väli kaotaks fookuse); lukus on see ainult siis, kui
 * suhet ei saa enam muuta.
 */
export function GoalView({ t, value, onChange, locked, dirty, stale, busy, note, glow, maxLength, onSave, onTakeFresh }) {
  return (
    <StepPanel
      title={t("mentoring.relation.views.goal.title")}
      lead={t("mentoring.relation.goal_help")}
      note={note}
      actions={
        locked ? null : (
          <>
            {stale && dirty ? (
              <Button type="button" {...SMALL_BUTTON} onClick={onTakeFresh}>
                {t("mentoring.relation.views.goal.take_fresh")}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !dirty} onClick={onSave}>
              {t("mentoring.relation.goal_save")}
            </Button>
          </>
        )
      }
    >
      <TextAreaField
        label={t("mentoring.relation.goal_label")}
        labelHidden
        hint={t("mentoring.relation.no_client_data")}
        value={value}
        rows={6}
        maxLength={maxLength}
        disabled={locked}
        onChange={onChange}
      />
    </StepPanel>
  );
}

/**
 * Kokkulepe. `mode`: `read` (kehtiv tekst ja kummagi poole kinnitus) või
 * `propose` (uue versiooni tekst). Kui kokkulepet veel ei ole, avaneb osa kohe
 * tekstiväljaga.
 */
export function AgreementView({ t, mode, model, closed, draft, onDraft, canSubmit, busy, note, glow, maxLength, onStart, onCancel, onPropose, onAccept }) {
  const swapRef = useSwapFocus(mode);
  const title = t("mentoring.relation.views.agreement.title");

  if (mode === "propose") {
    return (
      <StepPanel
        title={title}
        lead={model.hasText ? t("mentoring.relation.agreement_help") : t("mentoring.relation.views.agreement.first_lead")}
        note={note}
        actions={
          <>
            {model.hasText ? (
              <Button type="button" {...SMALL_BUTTON} onClick={onCancel}>
                {t("mentoring.labels.cancel")}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !canSubmit} onClick={onPropose}>
              {t("mentoring.relation.agreement_propose")}
            </Button>
          </>
        }
      >
        <div ref={swapRef}>
          <TextAreaField
            label={t("mentoring.relation.agreement_new")}
            labelHidden
            hint={t("mentoring.relation.agreement_hint")}
            value={draft}
            rows={6}
            maxLength={maxLength}
            onChange={onDraft}
          />
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={closed ? undefined : t("mentoring.relation.agreement_help")}
      note={note}
      actions={
        model.canPropose || model.canAccept ? (
          <>
            {model.canPropose ? (
              <Button type="button" {...SMALL_BUTTON} disabled={busy} onClick={onStart}>
                {t("mentoring.relation.views.agreement.new_version")}
              </Button>
            ) : null}
            {model.canAccept ? (
              <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={onAccept}>
                {t("mentoring.relation.agreement_accept")}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={entry.stack} ref={swapRef}>
        <p className={entry.line}>
          <Chip tone="quiet">{model.version}</Chip>
          <Chip tone={model.mine.tone}>{model.mine.text}</Chip>
          <Chip tone={model.other.tone}>{model.other.text}</Chip>
        </p>
        <FullText>{model.text}</FullText>
      </div>
    </StepPanel>
  );
}

/**
 * Kohtumised. `mode`: `list`, `meeting` (avatud kohtumine) või `add` (uus
 * kohtumine). Plaanitud kohtumise saab märkida toimunuks või tühistada;
 * tühistamine on lõplik ja küsib teist vajutust. Uue kohtumise vormi selgitus
 * (mida platvormi ruumi valik teeb) tuleb lehelt tegevusrea teatena, et vorm
 * mahuks paneeli ära.
 */
export function MeetingsView({ t, mode, lead, rows, opened, emptyText, capText, canAdd, form, roomHref, busy, note, glow, onAdd, onCancel, onOpen, onBack, onHeld, onCancelMeeting }) {
  const swapRef = useSwapFocus(mode === "meeting" ? `meeting:${opened?.id}:${opened?.status}` : mode);
  const title = t("mentoring.relation.views.meetings.title");

  if (mode === "add") {
    return (
      <StepPanel
        title={title}
        question={t("mentoring.relation.views.meetings.new")}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onCancel}>
              {t("mentoring.labels.cancel")}
            </Button>
            <Button type="submit" form={form.id} size="sm" variant="primary" glow={glow} disabled={busy || !form.ready}>
              {t("mentoring.relation.meeting_create")}
            </Button>
          </>
        }
      >
        <form id={form.id} className={entry.stack} onSubmit={form.onSubmit} ref={swapRef}>
          <div className={styles.fields}>
            <label className={styles.field} data-size="sm">
              <span className={styles.fieldLabel}>{t("mentoring.relation.meeting_time")}</span>
              <Input type="datetime-local" required value={form.values.occurredAt} onChange={(event) => form.onField("occurredAt", event.target.value)} />
            </label>
            <label className={styles.field} data-size="lg">
              <span className={styles.fieldLabel}>{t("mentoring.relation.meeting_topic")}</span>
              <Input type="text" value={form.values.topicSummary} maxLength={form.maxLength} onChange={(event) => form.onField("topicSummary", event.target.value)} />
            </label>
          </div>
          <ChoiceRow
            label={t("mentoring.relation.meeting_mode")}
            columns={form.modes.length}
            options={form.modes}
            value={form.values.mode}
            onChange={(value) => form.onField("mode", value)}
          />
          {form.values.mode === "PLATFORM_ROOM" ? (
            form.rooms.length ? (
              <div
                className={styles.field}
                /* Rippvaliku loend on Reacti portaal: selle klahvivajutused jõuavad
                   lavani, mis vahetaks PageUp ja PageDown peale suhte osa ja
                   jätaks loendi teise osa peale lahti. */
                onKeyDown={(event) => {
                  if (event.key === "PageDown" || event.key === "PageUp") event.stopPropagation();
                }}
              >
                <span className={styles.fieldLabel}>{t("mentoring.relation.meeting_room")}</span>
                <Dropdown
                  ariaLabel={t("mentoring.relation.meeting_room")}
                  placeholder={t("mentoring.relation.views.meetings.room_pick")}
                  value={form.values.roomId}
                  options={form.rooms}
                  onChange={(value) => form.onField("roomId", value)}
                />
              </div>
            ) : (
              <p className={entry.quiet}>{t("mentoring.relation.meeting_room_empty")}</p>
            )
          ) : null}
        </form>
      </StepPanel>
    );
  }

  if (mode === "meeting" && opened) {
    return (
      <StepPanel
        title={title}
        question={opened.title}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
              {t("mentoring.relation.views.back")}
            </Button>
            {opened.canAct ? (
              <>
                <TwoStep
                  cancelLabel={t("mentoring.labels.cancel")}
                  label={t("mentoring.relation.views.meetings.cancel")}
                  confirmLabel={t("mentoring.relation.views.meetings.confirm_cancel")}
                  disabled={busy}
                  onConfirm={() => onCancelMeeting(opened)}
                />
                <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={() => onHeld(opened)}>
                  {t("mentoring.relation.meeting_mark_held")}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          <p className={entry.line}>
            <Chip tone={opened.tone}>{opened.chip}</Chip>
            {opened.time ? <span className={entry.lineText}>{opened.time}</span> : null}
          </p>
          <FullText>{opened.topic}</FullText>
          {roomHref ? <TextLink href={roomHref}>{t("mentoring.relation.open_room")}</TextLink> : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        canAdd ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={onAdd}>
            {t("mentoring.relation.meeting_create")}
          </Button>
        ) : null
      }
    >
      <div className={entry.stack} ref={swapRef}>
        {rows.length ? <OpenRows rows={rows} openText={t("mentoring.labels.open")} onOpen={onOpen} /> : <p className={entry.quiet}>{emptyText}</p>}
        {capText ? <p className={entry.small}>{capText}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Kokkuvõtted. `mode`: `list`, `summary` (avatud kokkuvõte), `add` (uus mustand)
 * või `correct` (kinnitatud kokkuvõtte parandus). Mustandi kõrvale jätmine on
 * lõplik ja küsib teist vajutust.
 */
export function SummariesView({ t, mode, lead, rows, opened, capText, canAdd, draft, onDraft, correction, onCorrection, correctionReady, busy, note, glow, maxLength, onAdd, onCancel, onOpen, onBack, onCreate, onSubmit, onConfirm, onDiscard, onStartCorrect, onCorrect }) {
  const swapRef = useSwapFocus(mode === "summary" ? `summary:${opened?.id}:${opened?.status}:${opened?.chip}` : mode);
  const title = t("mentoring.relation.views.summaries.title");

  if (mode === "add") {
    return (
      <StepPanel
        title={title}
        question={t("mentoring.relation.views.summaries.new")}
        lead={t("mentoring.relation.views.summaries.draft_lead")}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onCancel}>
              {t("mentoring.labels.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !draft.trim()} onClick={onCreate}>
              {t("mentoring.relation.summary_create")}
            </Button>
          </>
        }
      >
        <div ref={swapRef}>
          <TextAreaField
            label={t("mentoring.relation.summary_new")}
            labelHidden
            hint={t("mentoring.relation.no_client_data")}
            value={draft}
            rows={5}
            maxLength={maxLength}
            onChange={onDraft}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "correct" && opened) {
    return (
      <StepPanel
        title={title}
        question={t("mentoring.relation.views.summaries.correct")}
        lead={t("mentoring.relation.views.summaries.correct_lead")}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onCancel}>
              {t("mentoring.labels.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !correctionReady} onClick={() => onCorrect(opened)}>
              {t("mentoring.relation.summary_correction_create")}
            </Button>
          </>
        }
      >
        <div ref={swapRef}>
          <TextAreaField
            label={t("mentoring.relation.summary_correction")}
            labelHidden
            hint={t("mentoring.relation.no_client_data")}
            value={correction}
            rows={5}
            maxLength={maxLength}
            onChange={onCorrection}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "summary" && opened) {
    return (
      <StepPanel
        title={title}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
              {t("mentoring.relation.views.back")}
            </Button>
            {opened.canDiscard ? (
              <TwoStep
                cancelLabel={t("mentoring.labels.cancel")}
                label={t("mentoring.relation.summary_discard")}
                confirmLabel={t("mentoring.relation.views.summaries.confirm_discard")}
                disabled={busy}
                onConfirm={() => onDiscard(opened)}
              />
            ) : null}
            {opened.canCorrect ? (
              <Button type="button" {...SMALL_BUTTON} disabled={busy} onClick={() => onStartCorrect(opened)}>
                {t("mentoring.relation.views.summaries.correct")}
              </Button>
            ) : null}
            {opened.canSubmit ? (
              <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={() => onSubmit(opened)}>
                {t("mentoring.relation.summary_submit")}
              </Button>
            ) : null}
            {opened.canConfirm ? (
              <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={() => onConfirm(opened)}>
                {t("mentoring.relation.summary_confirm")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          <p className={entry.line}>
            <Chip tone={opened.tone}>{opened.chip}</Chip>
            <Chip tone="quiet">{opened.extra}</Chip>
            {opened.time ? <span className={entry.time}>{opened.time}</span> : null}
          </p>
          <FullText>{opened.text}</FullText>
          {opened.othersDraft ? <p className={entry.small}>{t("mentoring.relation.views.summaries.others_draft")}</p> : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        canAdd ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={onAdd}>
            {t("mentoring.relation.views.summaries.new")}
          </Button>
        ) : null
      }
    >
      <div className={entry.stack} ref={swapRef}>
        {rows.length ? (
          <OpenRows rows={rows} openText={t("mentoring.labels.open")} onOpen={onOpen} />
        ) : (
          <p className={entry.quiet}>{t("mentoring.relation.summaries_empty")}</p>
        )}
        {capText ? <p className={entry.small}>{capText}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Ettevalmistus (sild Tööheaolust). `mode`: `list`, `item` (avatud
 * ettevalmistus) või `candidate` (Tööheaolus kinnitatud tekst, mille mentee
 * saab suhtesse tuua).
 *
 * Mentee jagab oma teksti mentorile ise ja kinnitab enne, et selles ei ole
 * kliendiandmeid. Mentor näeb teksti alles siis, kui ta ettevalmistuse avab;
 * pärast avamist ei saa mentee jagamist enam tagasi võtta.
 */
export function PreparationView({ t, mode, lead, rows, opened, candidates, openedCandidate, candidatesFailed, emptyText, capText, confirmed, onConfirmed, busy, note, glow, onOpen, onOpenCandidate, onBack, onShare, onRecall, onMarkOpened, onHandoff, onRetryCandidates }) {
  const swapRef = useSwapFocus(
    mode === "item" ? `item:${opened?.id}:${opened?.chip}` : mode === "candidate" ? `candidate:${openedCandidate?.id}` : mode
  );
  const title = t("mentoring.relation.views.preparation.title");
  const back = (
    <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
      {t("mentoring.relation.views.back")}
    </Button>
  );

  if (mode === "candidate" && openedCandidate) {
    return (
      <StepPanel
        title={title}
        lead={t("mentoring.relation.handoff_help")}
        note={note}
        actions={
          <>
            {back}
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={() => onHandoff(openedCandidate)}>
              {t("mentoring.relation.handoff_action")}
            </Button>
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          <FullText>{openedCandidate.text}</FullText>
          {openedCandidate.cut ? <p className={entry.small}>{t("mentoring.relation.views.preparation.candidate_cut")}</p> : null}
        </div>
      </StepPanel>
    );
  }

  if (mode === "item" && opened) {
    return (
      <StepPanel
        title={title}
        note={note}
        actions={
          <>
            {back}
            {opened.canRecall ? (
              <Button type="button" {...SMALL_BUTTON} disabled={busy} onClick={() => onRecall(opened)}>
                {t("mentoring.relation.preparation_recall")}
              </Button>
            ) : null}
            {opened.canShare ? (
              <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !confirmed} onClick={() => onShare(opened)}>
                {t("mentoring.relation.preparation_share")}
              </Button>
            ) : null}
            {opened.canOpen ? (
              <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={() => onMarkOpened(opened)}>
                {t("mentoring.relation.preparation_mark_opened")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          <p className={entry.line}>
            <Chip tone={opened.tone}>{opened.chip}</Chip>
            <span className={entry.lineText}>{opened.statusLine}</span>
          </p>
          {opened.sealed ? null : <FullText>{opened.text}</FullText>}
          {opened.canShare ? (
            <div className={styles.check}>
              <CheckCard title={t("mentoring.relation.preparation_confirm_no_clients")} checked={confirmed} onChange={onConfirmed} />
            </div>
          ) : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel title={title} lead={lead} note={note}>
      <div className={entry.stack} ref={swapRef}>
        {rows.length ? <OpenRows rows={rows} openText={t("mentoring.labels.open")} onOpen={onOpen} /> : null}
        {capText ? <p className={entry.small}>{capText}</p> : null}
        {candidates.length ? (
          <section className={entry.section}>
            <h4 className={entry.groupTitle}>{t("mentoring.relation.views.preparation.candidates_title")}</h4>
            <OpenRows rows={candidates} openText={t("mentoring.labels.open")} onOpen={onOpenCandidate} />
          </section>
        ) : null}
        {candidatesFailed ? (
          <div className={entry.fault}>
            <p className={entry.quiet}>{t("mentoring.relation.views.preparation.candidates_failed")}</p>
            <Button type="button" {...SMALL_BUTTON} onClick={onRetryCandidates}>
              {t("mentoring.labels.retry")}
            </Button>
          </div>
        ) : null}
        {emptyText ? <p className={entry.quiet}>{emptyText}</p> : null}
      </div>
    </StepPanel>
  );
}

/** Minu märkmed: ainult mina näen. `mode`: `list`, `note` (avatud märge) või `add`. */
export function NotesView({ t, mode, rows, opened, capText, canAdd, draft, onDraft, busy, note, glow, maxLength, onAdd, onCancel, onOpen, onBack, onCreate }) {
  const swapRef = useSwapFocus(mode === "note" ? `note:${opened?.id}` : mode);
  const title = t("mentoring.relation.views.notes.title");
  const lead = t("mentoring.relation.views.notes.lead");

  if (mode === "add") {
    return (
      <StepPanel
        title={title}
        lead={lead}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onCancel}>
              {t("mentoring.labels.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !draft.trim()} onClick={onCreate}>
              {t("mentoring.relation.note_add")}
            </Button>
          </>
        }
      >
        <div ref={swapRef}>
          <TextAreaField label={t("mentoring.relation.note_new")} labelHidden value={draft} rows={6} maxLength={maxLength} onChange={onDraft} />
        </div>
      </StepPanel>
    );
  }

  if (mode === "note" && opened) {
    return (
      <StepPanel
        title={title}
        note={note}
        actions={
          <Button type="button" {...SMALL_BUTTON} onClick={onBack}>
            {t("mentoring.relation.views.back")}
          </Button>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          {opened.time ? (
            <p className={entry.line}>
              <span className={entry.time}>{opened.time}</span>
            </p>
          ) : null}
          <FullText>{opened.text}</FullText>
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        canAdd ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={onAdd}>
            {t("mentoring.relation.note_add")}
          </Button>
        ) : null
      }
    >
      <div className={entry.stack} ref={swapRef}>
        {rows.length ? (
          <OpenRows rows={rows} openText={t("mentoring.labels.open")} onOpen={onOpen} />
        ) : (
          <p className={entry.quiet}>{t("mentoring.relation.views.notes.summary_empty")}</p>
        )}
        {capText ? <p className={entry.small}>{capText}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Suhte seis. `mode`: `read` (kuhu suhe on jõudnud ja tegevused kaartidena;
 * lõppenud suhtel lause selle kohta, kes ja millal lõpetas) või `close`
 * (lõpetamise ülevaade: mis säilib, mis kustub, põhjus ja teist vajutust küsiv
 * nupp). Seisu märk ja tee tagasi mentorlusse on päises lava kohal, siin neid
 * ei korrata.
 */
export function StateView({ t, mode, lines, cards, hint, gate, busy, note, onLeaveGate, onClose }) {
  const swapRef = useSwapFocus(mode);
  const title = t("mentoring.relation.views.state.title");

  if (mode === "close") {
    return (
      <StepPanel
        title={title}
        question={t("mentoring.relation.close_gate_title")}
        lead={t("mentoring.relation.views.state.gate_lead")}
        note={note}
        actions={
          <>
            <Button type="button" {...SMALL_BUTTON} onClick={onLeaveGate}>
              {t("mentoring.relation.views.state.leave")}
            </Button>
            <TwoStep
              cancelLabel={t("mentoring.labels.cancel")}
              label={t("mentoring.relation.close_confirm_action")}
              confirmLabel={t("mentoring.relation.views.state.confirm_close")}
              disabled={busy || !gate.ready}
              onConfirm={onClose}
            />
          </>
        }
      >
        <div className={entry.stack} ref={swapRef}>
          {gate.loading ? <p className={entry.quiet}>{t("mentoring.labels.loading")}</p> : null}
          {gate.failed ? (
            <div className={entry.fault}>
              <p className={entry.quiet}>{t("mentoring.relation.views.state.preview_failed")}</p>
              <Button type="button" {...SMALL_BUTTON} onClick={gate.onRetry}>
                {t("mentoring.labels.retry")}
              </Button>
            </div>
          ) : null}
          {gate.ready ? (
            <>
              <div className={entry.pair}>
                {[
                  { key: "keeps", title: t("mentoring.relation.close_keeps"), items: gate.keeps },
                  { key: "purges", title: t("mentoring.relation.close_purges"), items: gate.purges }
                ].map((group) => (
                  <section key={group.key} className={entry.section}>
                    <h4 className={entry.groupTitle}>{group.title}</h4>
                    <ul className={styles.plainList}>
                      {group.items.map((item) => (
                        <li key={item} className={styles.plainItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <ChoiceRow
                label={t("mentoring.relation.close_reason")}
                columns={gate.reasons.length}
                options={gate.reasons}
                value={gate.reason}
                onChange={gate.onReason}
              />
            </>
          ) : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel title={title} note={note}>
      <div className={entry.stack} ref={swapRef}>
        {lines.map((line) => (
          <p key={line} className={entry.quiet}>
            {line}
          </p>
        ))}
        {cards.length ? (
          <div className={entry.actionCards} role="group" aria-label={t("mentoring.relation.views.state.actions")}>
            {cards.map((card) => (
              <ActionCard key={card.key} title={card.title} description={card.description} disabled={card.disabled} onClick={card.onClick} />
            ))}
          </div>
        ) : null}
        {hint ? <p className={entry.small}>{hint}</p> : null}
      </div>
    </StepPanel>
  );
}
