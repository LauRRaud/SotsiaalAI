"use client";

/**
 * Külastuse vaated: ainult joonistavad. Andmed, päringud ja olek on
 * `FieldVisitRoom.jsx`-is; jaotus ja väikesed reeglid `visitViews.js`-is.
 *
 * MIKS vaadeteks. Külastuse leht oli üks pikk veerg: faasi sees olid pakett,
 * turvasignaali vorm, märge, foto ja heli, nõusolek, kontroll, üleandmine,
 * sulgemine ja seadme puhastamine üksteise all. Telefonis tähendas see pikka
 * kerimist ja nuppe ekraani keskel. Nüüd on korraga ees üks vaade ja selle
 * tegevus on all servas, pöidla ulatuses (välitöö leping, FIELD-A0 ptk 7.2).
 * Leht on lame: liikumisefekte ei ole, seepärast ei ole siin sammulava.
 *
 * TELEFONIS ON KA FAASI JA VAATE VALIK ALL (visit.module.css pöörab järjekorra):
 * leping nimetab faasivahetust ja kinnitusi tegevustena, mis peavad olema
 * ekraani alumises kolmandikus. Sisu, näiteks märkme tekstikast, jääb üles, kus
 * see on näha ka siis, kui klaviatuur on lahti.
 *
 * Kustutamine, tagasivõtmine, sulgemine, ärajätmine ja teise versiooni
 * ülekirjutamine küsivad teist vajutust (`confirmLabel` tuleb lehelt): varem
 * piisas ühest puudutusest.
 *
 * Kujundus: visit.module.css.
 */

import { useEffect, useRef, useState } from "react";

import StepPanel from "@/components/stage/StepPanel";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { FIELD_ITEM_STATE, FIELD_NOTE_KIND } from "@/lib/field/constants";

import styles from "./visit.module.css";
import { deviceItemActions, deviceItemTypeKey, itemStateTone, recordingClock } from "./visitViews";

/* Eesmärk, mis on pikem kui see, mis päisesse kindlasti ära mahub, näidatakse
   paketi vaates täies pikkuses. Lühikest ei korrata. */
const GOAL_FITS_HEAD = 60;

/**
 * Külastuse nimi (eesmärk), seis ja koht: mis külastus see on. Laual on eesmärk
 * ühel real ja telefonis kuni kahel, et vaade mahuks ekraanile; pikk eesmärk on
 * täies pikkuses paketi vaates.
 */
export function VisitHead({ t, view, stale, armed }) {
  return (
    <header className={styles.head}>
      <h1 className={styles.goal} title={view.goal || undefined}>
        {view.goal || t("field.visit.untitled")}
      </h1>
      <p className={styles.meta}>
        <span className={styles.chip}>{t(`field.status.${view.status || "DRAFT"}`)}</span>
        {armed ? (
          <span className={styles.chip} data-tone="wait">
            {t("field.safety.armedBadge")}
          </span>
        ) : null}
        {view.locationText ? <span className={styles.place}>{view.locationText}</span> : null}
      </p>
      {stale ? <p className={styles.warn}>{t("field.pack.stale")}</p> : null}
    </header>
  );
}

/**
 * Faasid ja faasi vaated: kaks rida ühtlasi lahtreid, mõlemad kohe näha.
 * Faaside rida on lehe navigatsioon (`nav`); vaadete rida on sama lehe sisu
 * vahetamine, seepärast rühm, mitte teine navigatsioon.
 */
export function VisitTabs({ t, phases, phase, onPhase, views, current, onView }) {
  return (
    <div className={styles.tabs}>
      <nav className={styles.tabRow} aria-label={t("field.phases.label")} style={{ "--cells": phases.length }}>
        {phases.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.tab}
            aria-current={phase === key ? "step" : undefined}
            onClick={() => onPhase(key)}
          >
            {t(`field.phase.${key}`)}
          </button>
        ))}
      </nav>
      {views.length > 1 ? (
        <div className={styles.tabRow} data-level="view" role="group" aria-label={t("field.view.label")} style={{ "--cells": views.length }}>
          {views.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.tab}
              aria-current={current === key ? "true" : undefined}
              onClick={() => onView(key)}
            >
              {t(`field.view.${key}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ id, label, hint, children, wide = false }) {
  return (
    <label className={styles.field} data-wide={wide ? "true" : undefined} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      {children}
    </label>
  );
}

/** Ettevalmistus: pakett (võtmeküsimused, kokkuvõte) ja selle võtmine seadmesse. */
export function PackView({ t, view, canTake, hasPack, offline, onTake }) {
  const questions = view.packKeyQuestions || [];
  const hint = hasPack ? t("field.pack.onDevice") : offline ? t("field.pack.needsOnline") : "";
  const longGoal = String(view.goal || "").length > GOAL_FITS_HEAD;
  return (
    <StepPanel
      title={t("field.view.pack")}
      note={hint}
      actions={
        canTake ? (
          <Button onClick={onTake} disabled={offline}>
            {hasPack ? t("field.pack.refresh") : t("field.pack.take")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        {longGoal ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.prepare.goal")}</h4>
            <p className={styles.text}>{view.goal}</p>
          </section>
        ) : null}
        {questions.length ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.pack.questions")}</h4>
            <ul className={styles.plainList}>
              {questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {view.packSummaryText ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.pack.summary")}</h4>
            <p className={styles.text}>{view.packSummaryText}</p>
          </section>
        ) : null}
        {!questions.length && !view.packSummaryText ? <p className={styles.quiet}>{t("field.pack.empty")}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Ettevalmistus: turvasignaal on kas sees (tähtaeg, hoiatused, väljalülitamine)
 * või seadmata (vorm). Vormis on ees kaks kohustuslikku välja; kontakti nimi ja
 * juhis on valikulised ja avanevad omal soovil, et vorm mahuks telefoni ekraanile.
 */
export function SafetyView({ t, armed, deadlineText, warnings, form, onForm, offline, onArm, onCancel, cancelLabel }) {
  const [moreOpen, setMoreOpen] = useState(Boolean(form.name || form.instructions));
  /* Nupp, mis valikulised väljad avas, kaob koos vajutusega: fookus läheb
     esimesele avanenud väljale, mitte lehe algusse. */
  const focusMore = useRef(false);
  useEffect(() => {
    if (!moreOpen || !focusMore.current) return;
    focusMore.current = false;
    document.getElementById("fld-safety-name")?.focus();
  }, [moreOpen]);

  if (armed) {
    return (
      <StepPanel
        title={t("field.view.safety")}
        actions={
          <Button variant="secondary" onClick={onCancel} disabled={offline}>
            {cancelLabel}
          </Button>
        }
      >
        <div className={styles.stack}>
          <p className={styles.text}>{t("field.safety.armedUntil").replace("{time}", deadlineText)}</p>
          {warnings.map((key) => (
            <p key={key} className={styles.warn}>
              {t(key)}
            </p>
          ))}
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel
      title={t("field.view.safety")}
      note={offline ? t("field.safety.needsOnline") : ""}
      actions={
        <Button onClick={onArm} disabled={offline}>
          {t("field.safety.arm")}
        </Button>
      }
    >
      {/* Laual on selgitus vasakul ja väljad paremal, et vorm mahuks paneeli;
          telefonis on need üksteise all. Kui valikulised väljad on avatud,
          võtavad need selgituse koha: pikk selgitus on selleks ajaks loetud ja
          alles jääb hoiatus, et see ei ole hädaabiteenus. */}
      <div className={styles.stack}>
        {moreOpen ? <p className={styles.strong}>{t("field.safety.notEmergency")}</p> : null}
        <div className={styles.split}>
          {!moreOpen ? (
            <div className={styles.stack}>
              <p className={styles.quiet}>{t("field.safety.explain")}</p>
              <p className={styles.strong}>{t("field.safety.notEmergency")}</p>
            </div>
          ) : null}
          <div className={styles.stack}>
            <Field id="fld-safety-deadline" label={t("field.safety.deadline")} wide>
              <Input
                id="fld-safety-deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(event) => onForm({ deadline: event.target.value })}
              />
            </Field>
            <Field id="fld-safety-email" label={t("field.safety.contactEmail")} wide>
              <Input
                id="fld-safety-email"
                type="email"
                value={form.email}
                onChange={(event) => onForm({ email: event.target.value })}
                autoComplete="off"
              />
            </Field>
            {!moreOpen ? (
              <Button
                variant="secondary"
                size="sm"
                className={styles.inline}
                onClick={() => {
                  focusMore.current = true;
                  setMoreOpen(true);
                }}
              >
                {t("field.safety.more")}
              </Button>
            ) : null}
          </div>
          {moreOpen ? (
            <div className={styles.stack}>
              <Field id="fld-safety-name" label={t("field.safety.contactName")} wide>
                <Input
                  id="fld-safety-name"
                  value={form.name}
                  onChange={(event) => onForm({ name: event.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="fld-safety-note" label={t("field.safety.instructions")} wide>
                <Input
                  id="fld-safety-note"
                  value={form.instructions}
                  onChange={(event) => onForm({ instructions: event.target.value })}
                  autoComplete="off"
                />
              </Field>
            </div>
          ) : null}
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Kohapeal: kiire märge ning saabumise ja lahkumise kinnitus.
 *
 * Kinnitused on tegevusreas (all servas, pöidla ulatuses) seni, kuni need on
 * tegemata; tehtud kinnitus on vaate alguses märgina. Suletud külastusel
 * kinnitada ei saa.
 */
export function NoteView({
  t,
  readOnly,
  offline,
  arrived,
  departed,
  onMarker,
  failedReason,
  markersPending,
  onRetryMarkers,
  body,
  onBody,
  provenance,
  onProvenance,
  provenanceOptions,
  onSave
}) {
  return (
    <StepPanel
      title={t("field.view.note")}
      actions={
        <>
          {!readOnly && !arrived ? (
            <Button variant="secondary" onClick={() => onMarker("arrival")}>
              {t("field.markers.confirmArrival")}
            </Button>
          ) : null}
          {!readOnly && !departed ? (
            <Button variant="secondary" onClick={() => onMarker("departure")}>
              {t("field.markers.confirmDeparture")}
            </Button>
          ) : null}
          <Button onClick={onSave} disabled={readOnly || !body.trim()}>
            {t("field.note.save")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        {arrived || departed ? (
          <p className={styles.meta}>
            {arrived ? <span className={styles.chip}>{t("field.markers.arrived")}</span> : null}
            {departed ? <span className={styles.chip}>{t("field.markers.departed")}</span> : null}
          </p>
        ) : null}
        {/* SOL-FIELD-04: ootel marker on hoiatus, LÄBIKUKKUNUD marker on tõrge
            koos põhjuse ja korduskatsega. Vaikselt kadumine on keelatud, sest
            see on edust eristamatu. */}
        {failedReason ? (
          <div className={styles.alert} role="alert">
            <p>{t("field.markers.failedTitle")}</p>
            <p>{t(`field.markers.reason.${failedReason}`)}</p>
            <Button variant="secondary" size="sm" className={styles.inline} onClick={onRetryMarkers} disabled={offline}>
              {t("field.markers.retry")}
            </Button>
          </div>
        ) : markersPending ? (
          <p className={styles.warn}>{t("field.markers.pendingSync")}</p>
        ) : null}
        <div className={styles.noteGrid}>
          <TextAreaField label={t("field.note.body")} value={body} onChange={onBody} rows={3} disabled={readOnly} />
          <Field id="fld-provenance" label={t("field.note.provenance")}>
            <Dropdown
              id="fld-provenance"
              value={provenance}
              onChange={onProvenance}
              ariaLabel={t("field.note.provenance")}
              options={provenanceOptions}
              disabled={readOnly}
            />
          </Field>
        </div>
      </div>
    </StepPanel>
  );
}

/** Kohapeal: foto ja heli. Mõlemad on valikulised ja vajavad alust. */
export function CaptureView({
  t,
  readOnly,
  photoEnabled,
  onPhoto,
  recording,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  needsBasis,
  documentRequested,
  onDocumentRequested,
  reason,
  onReason
}) {
  return (
    <StepPanel
      title={t("field.view.capture")}
      note={t("field.inputs.alternative")}
      actions={
        <>
          <Button variant="secondary" onClick={onPhoto} disabled={!photoEnabled}>
            {t("field.photo.take")}
          </Button>
          {recording ? (
            <Button variant="secondary" onClick={onStopRecording}>
              {t("field.audio.stop")} · {recordingClock(recordingSeconds)}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onStartRecording} disabled={readOnly}>
              {t("field.audio.start")}
            </Button>
          )}
        </>
      }
    >
      <div className={styles.stack}>
        <p className={styles.quiet}>{t("field.photo.policy")}</p>
        {needsBasis ? (
          <>
            <CheckCard
              title={t("field.photo.clientDocumentRequested")}
              checked={documentRequested}
              onChange={onDocumentRequested}
              disabled={readOnly}
            />
            {documentRequested ? (
              <Field id="fld-document-request-reason" label={t("field.photo.requestReason")} wide>
                <Input
                  id="fld-document-request-reason"
                  value={reason}
                  onChange={(event) => onReason(event.target.value)}
                  maxLength={500}
                  disabled={readOnly}
                />
              </Field>
            ) : null}
          </>
        ) : null}
        <p className={styles.quiet}>{t("field.audio.limit")}</p>
      </div>
    </StepPanel>
  );
}

/** Kohapeal: suulise nõusoleku talletamine (mille jaoks ja kellelt). */
export function ConsentView({ t, readOnly, kind, onKind, subject, onSubject, onSave }) {
  return (
    <StepPanel
      title={t("field.view.consent")}
      actions={
        <Button onClick={onSave} disabled={readOnly || !subject.trim()}>
          {t("field.consent.save")}
        </Button>
      }
    >
      <div className={styles.stack}>
        <div className={styles.choice}>
          <ChoiceRow
            label={t("field.consent.kindLabel")}
            value={kind}
            onChange={onKind}
            columns={2}
            disabled={readOnly}
            options={[
              { value: "audio", label: t("field.consent.kind.audio") },
              { value: "photo", label: t("field.consent.kind.photo") }
            ]}
          />
        </div>
        <Field id="fld-consent-subject" label={t("field.consent.subject")} wide>
          <Input
            id="fld-consent-subject"
            value={subject}
            onChange={(event) => onSubject(event.target.value)}
            autoComplete="off"
            disabled={readOnly}
          />
        </Field>
      </div>
    </StepPanel>
  );
}

function ReviewRow({ type, text, state, tone, error, children }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowBody}>
        <span className={styles.rowType}>{type}</span>
        {text ? <span className={styles.rowText}>{text}</span> : null}
        {state ? (
          <span className={styles.rowState} data-tone={tone || undefined}>
            {state}
          </span>
        ) : null}
        {error ? <span className={styles.rowError}>{error}</span> : null}
      </div>
      {children ? <div className={styles.rowActions}>{children}</div> : null}
    </li>
  );
}

/**
 * Järeltöö: kontrolli enne saatmist. Kolm rühma: selle seadme üksused (need
 * ootavad inimest), serverisse jõudnud märkmed ja saadetud failid.
 * `confirmLabel(key, label)` annab nupu teksti, kui tegevus ootab teist vajutust.
 */
export function ReviewView({
  t,
  readOnly,
  offline,
  serverNotes,
  deviceItems,
  attachments,
  confirmLabel,
  onRemoveServerNote,
  onItemAction,
  onOcr,
  onTranscribe,
  onRemoveAttachment
}) {
  const empty = !serverNotes.length && !deviceItems.length && !attachments.length;
  const itemActionLabel = (item, action) => {
    const id = item.clientItemId;
    if (action === "approve") return t("field.review.approve");
    if (action === "retry") return t("field.retry");
    if (action === "recovery") return t("field.review.recoveryImport");
    if (action === "cancel") return t("field.cancel");
    if (action === "keepDevice") return confirmLabel(`conflict:${id}:device`, t("field.conflict.keepDevice"));
    if (action === "keepServer") return confirmLabel(`conflict:${id}:server`, t("field.conflict.keepServer"));
    return confirmLabel(`item:${id}`, t("field.review.remove"));
  };
  return (
    <StepPanel title={t("field.review.title")}>
      <div className={styles.stack}>
        {empty ? <p className={styles.quiet}>{t("field.review.empty")}</p> : null}

        {deviceItems.length ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.review.deviceItems")}</h4>
            <ul className={styles.rows}>
              {deviceItems.map((item) => (
                <ReviewRow
                  key={item.clientItemId}
                  type={t(deviceItemTypeKey(item))}
                  text={item.itemType === "note" ? item.payload?.body || "" : ""}
                  state={t(`field.itemState.${item.state}`)}
                  tone={itemStateTone(item.state)}
                  error={item.lastError && item.state === FIELD_ITEM_STATE.FAILED ? t(item.lastError) || item.lastError : ""}
                >
                  {deviceItemActions(item).map((action) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={
                        action === "remove"
                          ? "ghost"
                          : action === "approve" || action === "recovery"
                            ? "primary"
                            : "secondary"
                      }
                      onClick={() => onItemAction(item, action)}
                    >
                      {itemActionLabel(item, action)}
                    </Button>
                  ))}
                </ReviewRow>
              ))}
            </ul>
          </section>
        ) : null}

        {serverNotes.length ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.review.serverNotes")}</h4>
            <ul className={styles.rows}>
              {serverNotes.map((note) => (
                <ReviewRow
                  key={`server-${note.clientItemId}`}
                  type={t(`field.item.${note.kind}`)}
                  text={note.body}
                  state={[
                    t("field.review.serverCopy"),
                    t(`field.provenance.${note.provenance}`),
                    t("field.review.revision").replace("{revision}", String(note.revision)),
                    note.conflict ? t("field.itemState.CONFLICT") : ""
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  tone={note.conflict ? "alert" : ""}
                >
                  {!readOnly && (!note.consentWithdrawnAt || note.kind !== FIELD_NOTE_KIND.CONSENT) ? (
                    <Button size="sm" variant="ghost" onClick={() => onRemoveServerNote(note)}>
                      {confirmLabel(
                        `note:${note.clientItemId}`,
                        note.kind === FIELD_NOTE_KIND.CONSENT ? t("field.review.withdrawConsent") : t("field.review.deleteServer")
                      )}
                    </Button>
                  ) : null}
                </ReviewRow>
              ))}
            </ul>
          </section>
        ) : null}

        {attachments.length ? (
          <section className={styles.block}>
            <h4 className={styles.blockTitle}>{t("field.attachments.title")}</h4>
            <ul className={styles.rows}>
              {attachments.map((attachment) => (
                <ReviewRow
                  key={attachment.clientItemId}
                  type={t(`field.item.${attachment.role}`)}
                  text={attachment.documentGone ? t("field.attachments.gone") : attachment.document?.title || ""}
                >
                  {attachment.role === "photo" && attachment.documentId ? (
                    <Button size="sm" variant="secondary" onClick={() => onOcr(attachment)} disabled={offline}>
                      {t("field.ocr.run")}
                    </Button>
                  ) : null}
                  {attachment.role === "audio" && attachment.documentId ? (
                    <Button size="sm" variant="secondary" onClick={() => onTranscribe(attachment)} disabled={offline}>
                      {t("field.transcribe.run")}
                    </Button>
                  ) : null}
                  {!readOnly ? (
                    <Button size="sm" variant="ghost" onClick={() => onRemoveAttachment(attachment)} disabled={offline}>
                      {confirmLabel(`att:${attachment.clientItemId}`, t("field.review.remove"))}
                    </Button>
                  ) : null}
                </ReviewRow>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Järeltöö: pildilt loetud või transkribeeritud tekst, mida inimene enne
 * kinnitamist parandab. Vaade avaneb siis, kui vastus serverist saabub, ja
 * nupp, mida vajutati, on selleks ajaks kadunud: fookus läheb tekstikasti.
 */
export function AiDraftView({ t, text, onText, onConfirm, onDiscard, discardLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector("textarea")?.focus();
  }, []);
  return (
    <StepPanel
      title={t("field.ai.title")}
      lead={t("field.ai.disclaimer")}
      actions={
        <>
          <Button variant="secondary" onClick={onDiscard}>
            {discardLabel}
          </Button>
          <Button onClick={onConfirm}>{t("field.ai.confirm")}</Button>
        </>
      }
    >
      <div ref={ref}>
        <TextAreaField label={t("field.ai.draft")} labelHidden value={text} onChange={onText} rows={5} />
      </div>
    </StepPanel>
  );
}

/** Järeltöö: üleandmine tööruumi (kokkuvõtte mustand ja täiendus eelpöördumise tööplaani). */
export function HandoverView({
  t,
  offline,
  toArtifact,
  onToArtifact,
  hasPreInquiry,
  note,
  onNote,
  nextContactOn,
  onNextContactOn,
  alreadyDone,
  onSend
}) {
  return (
    <StepPanel
      title={t("field.view.handover")}
      note={alreadyDone ? t("field.handover.alreadyDone") : ""}
      actions={
        <Button onClick={onSend} disabled={offline}>
          {t("field.handover.send")}
        </Button>
      }
    >
      <div className={styles.stack}>
        <div className={styles.pairs}>
          <CheckCard title={t("field.handover.toArtifact")} checked={toArtifact} onChange={onToArtifact} />
          {hasPreInquiry ? (
            <Field id="fld-next-contact" label={t("field.handover.nextContact")}>
              <Input
                id="fld-next-contact"
                type="date"
                value={nextContactOn}
                onChange={(event) => onNextContactOn(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {hasPreInquiry ? (
          <TextAreaField
            label={t("field.handover.toPreInquiry")}
            hint={t("field.handover.notePlaceholder")}
            value={note}
            onChange={onNote}
            rows={3}
          />
        ) : (
          <p className={styles.quiet}>{t("field.handover.noPreInquiry")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Järeltöö: külastuse lõpetamine ja seadme puhastamine.
 *
 * SILD TEENUSPÄEVIKUSSE (leping 8.4) ilmub alles SULETUD külastuse juures: enne
 * seda ei ole kestus lõplik ja eeltäide annaks vale koguse. See on LINK, MITTE
 * AUTOMAATNE LOOMINE: külastus ei ole alati arveldatav teenus ja arve
 * alusdokument ei tohi tekkida ilma inimese kinnituseta.
 */
export function FinishView({
  t,
  canChange,
  closeEnabled,
  closeBlocked,
  offline,
  closeLabel,
  cancelLabel,
  purgeLabel,
  onClose,
  onCancelVisit,
  onPurge,
  serviceEntryHref
}) {
  return (
    <StepPanel
      title={t("field.view.finish")}
      note={closeBlocked ? t("field.visit.closeBlocked") : ""}
      actions={
        canChange || serviceEntryHref ? (
          <>
            {canChange ? (
              <Button variant="ghost" onClick={onCancelVisit} disabled={offline}>
                {cancelLabel}
              </Button>
            ) : null}
            {serviceEntryHref ? (
              <Button as="a" variant="secondary" href={serviceEntryHref}>
                {t("field.visit.createServiceEntry")}
              </Button>
            ) : null}
            {canChange ? (
              <Button onClick={onClose} disabled={!closeEnabled}>
                {closeLabel}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <section className={styles.block}>
        <h4 className={styles.blockTitle}>{t("field.purge.title")}</h4>
        <p className={styles.quiet}>{t("field.purge.explain")}</p>
        <Button variant="secondary" size="sm" className={styles.inline} onClick={onPurge}>
          {purgeLabel}
        </Button>
      </section>
    </StepPanel>
  );
}
