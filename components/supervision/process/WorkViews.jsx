"use client";

/**
 * Supervisiooni protsessi töö vaated: privaatne eeskamber, jagatud teemad,
 * kohtumised ja kokkuvõtted.
 *
 * MIKS. Vanal lehel oli iga sakk üks pikk veerg: kõik kirjed kõrgete kaartidena,
 * muutmise vorm kaardi sees ja uue kirje vorm lehe lõpus. Nüüd on osas üks asi
 * korraga (`mode`): madalate ridade loend, avatud kirje tervikuna või vorm.
 * Need vahetavad üksteist samas kohas, lava osa ei vahetu.
 *
 *  - `AntechamberView`  minu eeskamber: loend, avatud kirje, muutmine, uus mustand
 *  - `TopicsView`       jagatud teemad: loend ja avatud teema (vanal lehel puudus)
 *  - `MeetingsView`     kohtumised: loend, avatud kohtumine, töömärge, uus kohtumine
 *  - `SummariesView`    kokkuvõtted: loend, avatud kokkuvõte, muutmine, uus kokkuvõte
 *
 * PRIVAATSUSMÄRK ON PÜSIELEMENT (SUP-P10): iga vaade, mis kannab sisu, ütleb
 * nähtavalt, kes seda näeb. Eeskambris on „Ainult sina näed" loendi kohal, IGA
 * rea juures ja avatud kirjes; jagatud teemal on sihtrühma märk; kokkuvõtte
 * mustandil „Näed ainult sina (superviisor)" ja kinnitatud kokkuvõttel püsivuse märk.
 *
 * TAGASIVÕTMATU TEGU KÜSIB TEIST VAJUTUST ja tagajärg seisab nupu kõrval
 * tegevusreal. Vana leht kasutas brauseri küsimusakent (`window.confirm`), mis
 * ei ole tõlgitav ega ütle, mis kaob.
 *
 * Siin on ainult kuju. Olek ja päringud on osade hoidjates
 * (`../EeskamberPanel.jsx`, `../TopicsPanel.jsx`, `../MeetingsPanel.jsx`,
 * `../SummariesPanel.jsx`); read teeb `./processRows.js`.
 *
 * Kujundus: process.module.css (siin kõrval).
 */

import { useId } from "react";

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import PrivacyBadge from "../PrivacyBadge";
import { Chip, Loaded } from "../entry/EntryBits";
import { Facts, Field, OpenRows, TwoPress, describedBy, useSwapFocus, useTwoPress } from "./ProcessBits";
import styles from "./process.module.css";

const ITEM_TITLE_MAX = 200;
const ITEM_BODY_MAX = 50000;
const NOTE_MAX = 20000;
const SUMMARY_MAX = 50000;

/**
 * Privaatne eeskamber (`mode`: `list`, `item`, `edit`, `new`, `write`).
 *
 * `source`: loendi laadimise seis (`{ status, error, retry }`). `item`: avatud
 * kirje (`privateItemView`). `kinds`: mustandi liigid selgitusega
 * (`privateKindOptions`); `new` on liigi valik ja `write` uue mustandi tekst.
 * `editing`: muutmise vormi seis; salvestus on TEADLIK (nupp), mitte
 * autosalvestus, nii et võrgu- või versiooniviga ei kaota kirjutatud teksti.
 */
export function AntechamberView({
  t,
  glow,
  mode,
  source,
  rows,
  item,
  canWrite,
  note,
  kinds,
  draft,
  onDraft,
  onKind,
  editing,
  onEditing,
  busy,
  onMode,
  onOpen,
  onCreate,
  onSave,
  onDelete,
  onShare
}) {
  const swapRef = useSwapFocus(mode === "item" ? `item:${item?.id}` : mode);
  const press = useTwoPress(`${mode}:${item?.id || ""}`);
  const id = useId();
  const title = t("supervision.process.views.eeskamber.title");
  const badge = (
    <p className={styles.line}>
      <PrivacyBadge scope="private" />
    </p>
  );

  /* Uus mustand kahes väikeses vaates: enne liik (kolm kaarti selgitusega), siis
     tekst. Ühes vaates koos ei mahtunud need paneeli ära ja sisu väli jäi
     kolme rea kõrguseks. */
  if (mode === "new") {
    const question = t("supervision.process.antechamber.kindQuestion");
    return (
      <StepPanel
        title={title}
        question={question}
        actions={
          <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
            {t("supervision.common.cancel")}
          </Button>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          {badge}
          <ActionCardGrid label={question}>
            {kinds.map((kind) => (
              <ActionCard key={kind.value} title={kind.label} description={kind.description} onClick={() => onKind(kind.value)} />
            ))}
          </ActionCardGrid>
        </div>
      </StepPanel>
    );
  }

  if (mode === "write") {
    const kind = kinds.find((option) => option.value === draft.kind);
    return (
      <StepPanel
        title={title}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("new")}>
              {t("supervision.process.antechamber.changeKind")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !draft.body.trim()} onClick={onCreate}>
              {t("supervision.common.save")}
            </Button>
          </>
        }
      >
        <div className={styles.fields} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="private" />
            {kind ? <Chip>{kind.label}</Chip> : null}
          </p>
          <Field id={`${id}-new-title`} label={t("supervision.eeskamber.titleLabel")}>
            <Input
              id={`${id}-new-title`}
              className={styles.input}
              type="text"
              value={draft.title}
              maxLength={ITEM_TITLE_MAX}
              onChange={(event) => onDraft({ ...draft, title: event.target.value })}
            />
          </Field>
          <TextAreaField
            label={t("supervision.eeskamber.bodyLabel")}
            value={draft.body}
            onChange={(body) => onDraft({ ...draft, body })}
            rows={6}
            maxLength={ITEM_BODY_MAX}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "edit" && item && editing) {
    return (
      <StepPanel
        title={title}
        lead={item.shared ? t("supervision.process.antechamber.editSharedLead") : undefined}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("item")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !editing.body.trim()} onClick={onSave}>
              {t("supervision.common.save")}
            </Button>
          </>
        }
      >
        <div className={styles.fields} ref={swapRef}>
          {badge}
          <Field id={`${id}-edit-title`} label={t("supervision.eeskamber.titleLabel")}>
            <Input
              id={`${id}-edit-title`}
              className={styles.input}
              type="text"
              value={editing.title}
              maxLength={ITEM_TITLE_MAX}
              onChange={(event) => onEditing({ ...editing, title: event.target.value })}
            />
          </Field>
          <TextAreaField
            label={t("supervision.eeskamber.bodyLabel")}
            value={editing.body}
            onChange={(body) => onEditing({ ...editing, body })}
            rows={6}
            maxLength={ITEM_BODY_MAX}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "item" && item) {
    return (
      <StepPanel
        title={title}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.process.back")}
            </Button>
            {item.canWrite ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onMode("edit")}>
                {t("supervision.common.edit")}
              </Button>
            ) : null}
            {item.canWrite ? (
              <TwoPress
                press={press}
                name="delete"
                label={t("supervision.eeskamber.delete")}
                confirmLabel={t("supervision.process.antechamber.deleteConfirm")}
                cancelLabel={t("supervision.common.cancel")}
                consequence={t(item.shared === "shared" ? "supervision.process.antechamber.deleteConsequenceShared" : "supervision.process.antechamber.deleteConsequence")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onDelete(item.id)}
              />
            ) : null}
            {item.canShare ? (
              <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onShare(item.id)}>
                {t("supervision.eeskamber.share")}
              </Button>
            ) : null}
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="private" />
            {item.kindText ? <Chip>{item.kindText}</Chip> : null}
            {item.sharedText ? <Chip tone={item.shared === "shared" ? "ok" : "quiet"}>{item.sharedText}</Chip> : null}
            {item.fromWellbeing ? <Chip>{item.fromWellbeing}</Chip> : null}
          </p>
          {item.heading ? <p className={styles.name}>{item.heading}</p> : null}
          <p className={styles.text}>{item.body}</p>
          {item.withdrawnNote ? <p className={styles.quiet}>{item.withdrawnNote}</p> : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={t("supervision.eeskamber.hint")}
      note={note}
      actions={
        canWrite ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("new")}>
            {t("supervision.eeskamber.new")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {badge}
        <Loaded t={t} source={source}>
          {rows.length ? (
            <OpenRows
              rows={rows}
              openText={t("supervision.home.open")}
              onOpen={onOpen}
              meta={(row) => (
                <>
                  {row.kindText ? <Chip>{row.kindText}</Chip> : null}
                  {row.sharedText ? <Chip tone={row.shared === "shared" ? "ok" : "quiet"}>{row.sharedText}</Chip> : null}
                  <PrivacyBadge scope="private" />
                </>
              )}
            />
          ) : (
            <p className={styles.quiet}>{t(canWrite ? "supervision.eeskamber.empty" : "supervision.process.antechamber.emptyReadOnly")}</p>
          )}
        </Loaded>
      </div>
    </StepPanel>
  );
}

/**
 * Jagatud teemad (`topic` on avatud teema või `null`).
 *
 * Jagatud teema on külmutatud koopia jagamise hetkest. Iga rea ja avatud teema
 * juures on märk, kes seda näeb. Jagamise saab tagasi võtta ainult autor; see
 * küsib teist vajutust, sest sama eeskambri kirjet ei saa uuesti jagada.
 */
export function TopicsView({ t, rows, topic, canShare, note, busy, onOpen, onBack, onWithdraw, onAntechamber }) {
  const swapRef = useSwapFocus(topic ? `topic:${topic.id}` : "list");
  const press = useTwoPress(topic?.id || "");
  const title = t("supervision.process.views.teemad.title");

  if (topic) {
    return (
      <StepPanel
        title={title}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={onBack}>
              {t("supervision.process.back")}
            </Button>
            {topic.canWithdraw ? (
              <TwoPress
                press={press}
                name="withdraw"
                label={t("supervision.process.topics.withdraw")}
                confirmLabel={t("supervision.process.topics.withdrawConfirm")}
                cancelLabel={t("supervision.common.cancel")}
                consequence={t("supervision.process.topics.withdrawConsequence")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onWithdraw(topic.id)}
              />
            ) : null}
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope={topic.privacy.scope} count={topic.privacy.count} />
            {topic.fromWellbeing ? <Chip>{topic.fromWellbeing}</Chip> : null}
            {topic.sub ? <span className={styles.time}>{topic.sub}</span> : null}
          </p>
          <p className={styles.name}>{topic.title}</p>
          <p className={styles.text}>{topic.body}</p>
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={t("supervision.process.topics.lead")}
      note={note}
      actions={
        canShare ? (
          <Button type="button" size="sm" variant="secondary" onClick={onAntechamber}>
            {t("supervision.process.topics.toAntechamber")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <OpenRows
            rows={rows}
            openText={t("supervision.home.open")}
            onOpen={onOpen}
            meta={(row) => <PrivacyBadge scope={row.privacy.scope} count={row.privacy.count} />}
          />
        ) : (
          <p className={styles.quiet}>{t("supervision.process.topics.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Kohtumised (`mode`: `list`, `meeting`, `note`, `plan`, `time`).
 *
 * Kohtumine on faktikirje; kirjutab ainult superviisor, loevad liikmed.
 * „Toimunud" on lõplik (server keeldub seda tagasi pööramast), seepärast küsib
 * märkimine teist vajutust. Töömärge on liikmetele ühine ja kustub sulgemisel:
 * selle juures on märk, kes seda näeb.
 */
export function MeetingsView({
  t,
  glow,
  mode,
  rows,
  meeting,
  canPlan,
  lead,
  note,
  privacyCount,
  plannedAt,
  onPlannedAt,
  noteDraft,
  onNoteDraft,
  busy,
  onMode,
  onOpen,
  onPlan,
  timeDraft,
  onTimeDraft,
  onSaveTime,
  onCancelMeeting,
  onSaveNote,
  onMarkHeld
}) {
  /* Võtmes on ka kohtumise seis: pärast „märgi toimunuks" kaob vajutatud nupp
     ja fookus peab minema osa pealkirjale, mitte kaduma. */
  const swapRef = useSwapFocus(mode === "meeting" ? `meeting:${meeting?.id}:${meeting?.statusText || ""}` : mode);
  const press = useTwoPress(`${mode}:${meeting?.id || ""}`);
  const id = useId();
  const title = t("supervision.process.views.kohtumised.title");

  if (mode === "plan") {
    const hint = t("supervision.process.meetings.planHint");
    return (
      <StepPanel
        title={title}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="submit" form={`${id}-plan`} size="sm" variant="primary" glow={glow} disabled={busy}>
              {t("supervision.meetings.plan")}
            </Button>
          </>
        }
      >
        <form
          id={`${id}-plan`}
          className={styles.fields}
          noValidate
          ref={swapRef}
          onSubmit={(event) => {
            event.preventDefault();
            onPlan();
          }}
        >
          <Field id={`${id}-time`} label={t("supervision.process.meetings.plannedAtLabel")} hint={hint} size="sm">
            <Input
              id={`${id}-time`}
              className={styles.input}
              type="datetime-local"
              value={plannedAt}
              describedBy={describedBy(`${id}-time`, { hint })}
              onChange={(event) => onPlannedAt(event.target.value)}
            />
          </Field>
        </form>
      </StepPanel>
    );
  }

  if (mode === "time" && meeting) {
    const hint = t("supervision.process.meetings.timeHint");
    return (
      <StepPanel
        title={title}
        question={t("supervision.process.meetings.timeQuestion", { n: meeting.seq })}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("meeting")}>
              {t("supervision.process.meetings.backToMeeting")}
            </Button>
            <TwoPress
              press={press}
              name="cancel"
              label={t("supervision.process.meetings.cancelMeeting")}
              confirmLabel={t("supervision.process.meetings.cancelConfirm")}
              cancelLabel={t("supervision.common.cancel")}
              consequence={t("supervision.process.meetings.cancelConsequence")}
              busyLabel={t("supervision.common.saving")}
              disabled={busy}
              onConfirm={onCancelMeeting}
            />
            <Button type="submit" form={`${id}-newtime`} size="sm" variant="primary" glow={glow} disabled={busy}>
              {t("supervision.process.meetings.saveTime")}
            </Button>
          </>
        }
      >
        <form
          id={`${id}-newtime`}
          className={styles.fields}
          noValidate
          ref={swapRef}
          onSubmit={(event) => {
            event.preventDefault();
            onSaveTime();
          }}
        >
          <Field id={`${id}-retime`} label={t("supervision.process.meetings.plannedAtLabel")} labelHidden hint={hint} size="sm">
            <Input
              id={`${id}-retime`}
              className={styles.input}
              type="datetime-local"
              value={timeDraft}
              describedBy={describedBy(`${id}-retime`, { hint })}
              onChange={(event) => onTimeDraft(event.target.value)}
            />
          </Field>
        </form>
      </StepPanel>
    );
  }

  if (mode === "note" && meeting) {
    return (
      <StepPanel
        title={title}
        question={t("supervision.process.meetings.noteQuestion", { n: meeting.seq })}
        lead={t("supervision.process.meetings.noteLead")}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("meeting")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={onSaveNote}>
              {t("supervision.common.save")}
            </Button>
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="process" count={privacyCount} />
          </p>
          <TextAreaField label={t("supervision.meetings.note")} labelHidden value={noteDraft} onChange={onNoteDraft} rows={7} maxLength={NOTE_MAX} />
        </div>
      </StepPanel>
    );
  }

  if (mode === "meeting" && meeting) {
    return (
      <StepPanel
        title={title}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.process.back")}
            </Button>
            {meeting.canEditNote ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onMode("note")}>
                {t(meeting.hasNote ? "supervision.process.meetings.editNote" : "supervision.process.meetings.addNote")}
              </Button>
            ) : null}
            {meeting.canChange ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onMode("time")}>
                {t("supervision.process.meetings.changeOrCancel")}
              </Button>
            ) : null}
            {meeting.canMarkHeld ? (
              <TwoPress
                press={press}
                name="held"
                label={t("supervision.meetings.markHeld")}
                confirmLabel={t("supervision.process.meetings.heldConfirm")}
                cancelLabel={t("supervision.common.cancel")}
                consequence={t("supervision.process.meetings.heldConsequence")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onMarkHeld(meeting.id)}
              />
            ) : null}
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <span className={styles.name}>{meeting.title}</span>
            {meeting.statusText ? <Chip tone={meeting.tone}>{meeting.statusText}</Chip> : null}
          </p>
          <Facts
            facts={[
              {
                key: "planned",
                label: t("supervision.meetings.plannedAt"),
                value: meeting.planned || t("supervision.process.meetings.noTimeShort"),
                missing: !meeting.planned
              },
              meeting.held ? { key: "held", label: t("supervision.meetings.held"), value: meeting.held } : null
            ].filter(Boolean)}
          />
          {meeting.hasNote ? (
            <>
              <p className={styles.line}>
                <span className={styles.name}>{t("supervision.meetings.note")}</span>
                <PrivacyBadge scope="process" count={privacyCount} />
              </p>
              <p className={styles.text}>{meeting.note}</p>
              <p className={styles.quiet}>{t("supervision.process.meetings.noteLead")}</p>
            </>
          ) : (
            <p className={styles.quiet}>{t("supervision.process.meetings.noNote")}</p>
          )}
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
        canPlan ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("plan")}>
            {t("supervision.meetings.plan")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <OpenRows
            rows={rows}
            openText={t("supervision.home.open")}
            onOpen={onOpen}
            meta={(row) => (
              <>
                {row.hasNote ? <Chip>{t("supervision.meetings.note")}</Chip> : null}
                {row.statusText ? <Chip tone={row.tone}>{row.statusText}</Chip> : null}
              </>
            )}
          />
        ) : (
          <p className={styles.quiet}>{t("supervision.meetings.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Kokkuvõtted (`mode`: `list`, `summary`, `edit`, `new`, `write`).
 *
 * Lugemisvaade ees, kinnitus lõpus. Mustandit näeb ainult superviisor (server
 * seda teistele ei anna) ja märk ütleb seda ka nähtavalt. Kinnitamist ootav
 * kokkuvõte kannab „ootab N/M kinnitust". Kinnitamisele saatmine, kinnitamine
 * ja kõrvale jätmine küsivad teist vajutust: ühtegi neist ei saa tagasi võtta.
 *
 * `choices`: mille kohta saab uue kokkuvõtte teha (`newSummaryChoices`).
 * `draftTitle`: uue kokkuvõtte nimi, kui valik on tehtud (muidu tühi); `new` on
 * valik ja `write` uue kokkuvõtte tekst.
 */
export function SummariesView({
  t,
  glow,
  mode,
  rows,
  summary,
  canCreate,
  lead,
  note,
  choices,
  draft,
  onDraft,
  draftTitle,
  canSaveDraft,
  editing,
  onEditing,
  busy,
  onMode,
  onOpen,
  onCreate,
  onSave,
  onSubmit,
  onApprove,
  onDiscard
}) {
  const swapRef = useSwapFocus(mode === "summary" ? `summary:${summary?.id}:${summary?.statusText || ""}` : mode);
  const press = useTwoPress(`${mode}:${summary?.id || ""}:${summary?.statusText || ""}`);
  const title = t("supervision.process.views.kokkuvotted.title");
  const cancel = t("supervision.common.cancel");

  /* Uus kokkuvõte kahes väikeses vaates: enne see, mille kohta kokkuvõte on
     (üks või kaks valikut), siis tekst. Ühes vaates koos ei mahtunud need
     paneeli ära. */
  if (mode === "new") {
    return (
      <StepPanel
        title={title}
        lead={t("supervision.process.summaries.newLead")}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {cancel}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={!draftTitle} onClick={() => onMode("write")}>
              {t("supervision.process.summaries.toWrite")}
            </Button>
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <ChoiceRow
            label={t("supervision.process.summaries.kindQuestion")}
            columns={choices.kinds.length}
            options={choices.kinds}
            value={draft.kind}
            onChange={(kind) => onDraft({ ...draft, kind })}
          />
          {draft.kind === "MEETING" ? (
            <ChoiceRow
              label={t("supervision.process.summaries.meetingQuestion")}
              options={choices.meetings}
              value={draft.meetingId}
              onChange={(meetingId) => onDraft({ ...draft, meetingId })}
            />
          ) : null}
        </div>
      </StepPanel>
    );
  }

  if (mode === "write") {
    return (
      <StepPanel
        title={title}
        question={draftTitle}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {cancel}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("new")}>
              {t("supervision.process.summaries.changeTarget")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !canSaveDraft} onClick={onCreate}>
              {t("supervision.common.save")}
            </Button>
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="draft" />
          </p>
          <TextAreaField
            label={t("supervision.summaries.bodyLabel")}
            labelHidden
            value={draft.body}
            onChange={(body) => onDraft({ ...draft, body })}
            rows={8}
            maxLength={SUMMARY_MAX}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "edit" && summary && editing) {
    return (
      <StepPanel
        title={title}
        question={summary.title}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("summary")}>
              {cancel}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !editing.body.trim()} onClick={onSave}>
              {t("supervision.common.save")}
            </Button>
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="draft" />
          </p>
          <TextAreaField
            label={t("supervision.summaries.bodyLabel")}
            labelHidden
            value={editing.body}
            onChange={(body) => onEditing({ ...editing, body })}
            rows={9}
            maxLength={SUMMARY_MAX}
          />
        </div>
      </StepPanel>
    );
  }

  if (mode === "summary" && summary) {
    const draftKind = summary.discardKind === "draft";
    return (
      <StepPanel
        title={title}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.process.back")}
            </Button>
            {summary.canEdit ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onMode("edit")}>
                {t("supervision.common.edit")}
              </Button>
            ) : null}
            {summary.canDiscard ? (
              <TwoPress
                press={press}
                name="discard"
                label={t(draftKind ? "supervision.process.summaries.discardDraft" : "supervision.summaries.discard")}
                confirmLabel={t("supervision.process.summaries.discardConfirm")}
                cancelLabel={cancel}
                consequence={t(draftKind ? "supervision.process.summaries.discardConsequenceDraft" : "supervision.process.summaries.discardConsequencePending")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onDiscard(summary.id)}
              />
            ) : null}
            {summary.canSubmit ? (
              <TwoPress
                press={press}
                name="submit"
                variant="primary"
                glow={glow}
                label={t("supervision.summaries.submit")}
                confirmLabel={t("supervision.process.summaries.submitConfirm")}
                cancelLabel={cancel}
                consequence={t("supervision.process.summaries.submitConsequence")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onSubmit(summary.id)}
              />
            ) : null}
            {summary.canApprove ? (
              <TwoPress
                press={press}
                name="approve"
                variant="primary"
                glow={glow}
                label={t("supervision.summaries.approve")}
                confirmLabel={t("supervision.process.summaries.approveConfirm")}
                cancelLabel={cancel}
                consequence={t("supervision.process.summaries.approveConsequence")}
                disabled={busy}
                busyLabel={t("supervision.common.saving")}
                onConfirm={() => onApprove(summary.id)}
              />
            ) : null}
          </>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            {summary.statusText ? <Chip tone={summary.tone}>{summary.statusText}</Chip> : null}
            {summary.privacy ? <PrivacyBadge scope={summary.privacy} /> : null}
            {summary.meta ? <span className={styles.time}>{summary.meta}</span> : null}
          </p>
          <p className={styles.name}>{summary.title}</p>
          <p className={styles.text}>{summary.body}</p>
          {summary.approvedByMe ? <p className={styles.quiet}>{t("supervision.process.summaries.youApproved")}</p> : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={lead || undefined}
      note={note}
      actions={
        canCreate && choices.any ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("new")}>
            {t("supervision.process.summaries.new")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <OpenRows
            rows={rows}
            openText={t("supervision.home.open")}
            onOpen={onOpen}
            meta={(row) => (
              <>
                {row.statusText ? <Chip tone={row.tone}>{row.statusText}</Chip> : null}
                {row.privacy ? <PrivacyBadge scope={row.privacy} /> : null}
              </>
            )}
          />
        ) : (
          <p className={styles.quiet}>{t("supervision.summaries.empty")}</p>
        )}
        {canCreate && !choices.any ? <p className={styles.quiet}>{t("supervision.process.summaries.noneLeft")}</p> : null}
      </div>
    </StepPanel>
  );
}
