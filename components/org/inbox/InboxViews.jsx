"use client";

/**
 * Vastuvõtu osa vaated.
 *
 * MIKS. Loend oli viie veeruga tabel (aeg ISO kujul, vastutaja kohal kriips) ja
 * avatud pöördumine neli kasti üksteise all, kus kõik töö tegevused (määramine,
 * vastuvõtmine, üleandmine, sulgemine) olid ühes reas ja sulgemine käis ühe
 * vajutusega. Nüüd on korraga ees üks asi:
 *  - `InboxBoard`  pöördumised madalate ridadena: saabumise aeg, üksus, vastutaja, seis;
 *                  rida avab pöördumise (avamine on pöördujale nähtav). Koordinaatoril on
 *                  kaks rühma: töös ja lõpetatud (suletud ja tagasi lükatud pöördumised)
 *  - `ItemView`    avatud pöördumine kahe väikese vaatega: pöördumine (saatja
 *                  kinnitatud pakett) ja töö (määramine, vastus, üleandmine, töö
 *                  tagasivõtmine, sulgemine, pöördumise tagasilükkamine; töö
 *                  tagasilükkamine ja tagasivõtmine küsivad teist vajutust)
 *  - `EndingView`  töö lõpetamine (sulgemine või pöördumise tagasilükkamine): selgitus
 *                  pöördujale ja mis juhtub; avaneb töö vaate asemel
 *
 * Siin on ainult kuju. Otsused on failis ./inboxRules.js; olek ja päringud
 * lehtedel (`../OrgInboxClient.jsx`, `../OrgInboxItemClient.jsx`).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/**
 * Loend. Privaatsuslause all servas on sisu: siin ei ole midagi, mida pöörduja
 * ise ei saatnud. `more`: { busy, onMore } või null.
 * `groups`: { value, options, busy, onChange } või null. Koordinaator valib, kas ees on töös
 * olevad või lõpetatud pöördumised; töötajal, kes näeb ainult oma tööd, rühmi ei ole.
 */
export function InboxBoard({ t, rows, hrefOf, onOpen, more, notice, groups = null }) {
  const finished = groups?.value === "finished";
  if (!rows.length && !groups) {
    return <StepPanel title={t("org.inbox.heading")} lead={t("org.inbox.empty")} note={footNote(notice, t("org.inbox.privacyNotice"))} />;
  }
  const picker = groups ? (
    <ChoiceRow label={t("org.inbox.groups.label")} labelHidden options={groups.options} value={groups.value} onChange={groups.onChange} columns={groups.options.length} keepColumns />
  ) : null;
  if (!rows.length) {
    return (
      <StepPanel title={t("org.inbox.heading")} note={footNote(notice, t("org.inbox.privacyNotice"))}>
        <div className={shared.stack} aria-busy={groups.busy ? "true" : undefined}>
          {picker}
          {groups.busy ? null : <p className={shared.quiet}>{finished ? t("org.inbox.empty_finished") : t("org.inbox.empty")}</p>}
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel title={t("org.inbox.heading")} note={footNote(notice, t("org.inbox.privacyNotice"))}>
      <div className={shared.stack} aria-busy={groups?.busy ? "true" : undefined}>
        {picker}
        <ul className={shared.rows} aria-label={finished ? t("org.inbox.groups.finished") : t("org.inbox.heading")}>
          {rows.map((row) => (
            <li key={row.id} className={shared.rowItem}>
              <a className={shared.row} href={hrefOf(row)} title={t("org.inbox.open")} data-item={row.id} onClick={(event) => onOpen(event, row)}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{row.title}</span>
                  {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                </span>
                <span className={shared.rowMeta}>
                  {row.urgency ? (
                    <span className={shared.chip} data-tone="wait">
                      {row.urgency}
                    </span>
                  ) : null}
                  {row.chip ? <span className={shared.chip}>{row.chip}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {more ? (
          <div>
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} data-more="1" onClick={more.onMore}>
              {t("org.pagination.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Avatud pöördumine.
 *
 * `work`: {
 *   actions: { assign, respond, handOver, takeBack, close, rejectItem },
 *   workers, assigneeId, onAssignee, onAssign,
 *   others, handoverId, onHandover, onHandOver,
 *   onAccept, onReject, rejectArmed, onTakeBack, takeBackArmed, onClose, onRejectItem, pending
 * }
 * `ending`: töö lõpetamise vorm (vt `EndingView`) või null; kui see on ees, ei ole muud näha.
 * `closingNote`: selgitus, mille asutus lõpetatud töö kohta pöördujale kirjutas (või tühi).
 * `openedNotice`: kas all on lause „Sinu avamine on pöördujale nähtav…".
 * `room`: { busy, onOpen } või null. Töö vastu võtnud töötaja avab vestlusruumi, kus
 *   ta pöördujale vastab; nupp on mõlemas vaates (see on tema järgmine samm).
 * `back`: { href, onBack }
 */
export function ItemView({ t, tabs, tab, onTab, facts, parts, closingNote = "", openedNotice = true, withheld, work, ending = null, room = null, notice, armedNote, back }) {
  const actions = work.actions;
  const onWork = tab === "work";
  if (ending) return <EndingView t={t} ending={ending} notice={notice} />;
  return (
    <StepPanel
      title={t("org.inbox.sourcePackage")}
      note={footNote(armedNote ? { text: armedNote } : notice, !onWork && openedNotice ? t("org.inbox.openedNotice") : "")}
      actions={
        <>
          <Button as="a" href={back.href} size="sm" variant="secondary" data-back="1" onClick={back.onBack}>
            {t("org.inbox.backToList")}
          </Button>
          {room ? (
            <Button type="button" size="sm" variant="primary" data-room="1" aria-busy={room.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={room.onOpen}>
              {t("org.inbox.openRoom")}
            </Button>
          ) : null}
          {onWork && actions.takeBack ? (
            <ArmedButton armed={work.takeBackArmed} busy={work.pending === "takeBack"} label={t("org.inbox.take_back")} confirm={t("org.inbox.take_back_confirm")} onPress={work.onTakeBack} mark="takeBack" />
          ) : null}
          {/* Töö lõpetamine avab vormi (selgitus pöördujale); vorm ise on teine samm. */}
          {onWork && actions.close ? (
            <Button {...SMALL} data-end="close" onClick={work.onClose}>
              {t("org.inbox.close")}
            </Button>
          ) : null}
          {onWork && actions.rejectItem ? (
            <Button {...SMALL} data-end="rejectItem" onClick={work.onRejectItem}>
              {t("org.inbox.reject_item")}
            </Button>
          ) : null}
          {onWork && actions.respond ? (
            <>
              <ArmedButton armed={work.rejectArmed} busy={work.pending === "reject"} label={t("org.inbox.reject")} confirm={t("org.inbox.reject_confirm")} onPress={work.onReject} mark="reject" />
              <Button type="button" size="sm" variant="primary" data-accept="1" aria-busy={work.pending === "accept" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={work.onAccept}>
                {t("org.inbox.accept")}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={work.pending ? "true" : undefined}>
        {tabs.length > 1 ? (
          <ChoiceRow
            label={t("org.inbox.tabs.label")}
            labelHidden
            options={tabs.map((key) => ({ value: key, label: t(`org.inbox.tabs.${key}`) }))}
            value={tab}
            onChange={onTab}
            columns={tabs.length}
            keepColumns
          />
        ) : null}
        {onWork ? (
          <>
            {actions.respond ? <p className={shared.quiet}>{t("org.inbox.response_lead")}</p> : null}
            {actions.assign ? (
              work.workers.length ? (
                <div className={shared.group}>
                  <PickOne label={t("org.inbox.assign_question")} options={work.workers} value={work.assigneeId} onChange={work.onAssignee} />
                  <div>
                    <Button {...SMALL} data-assign="1" aria-busy={work.pending === "assign" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={work.onAssign}>
                      {t("org.inbox.assign")}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={shared.quiet}>{t("org.inbox.no_workers")}</p>
              )
            ) : null}
            {actions.handOver ? (
              work.others.length ? (
                <div className={shared.group}>
                  <PickOne label={t("org.inbox.handover_question")} options={work.others} value={work.handoverId} onChange={work.onHandover} />
                  <div>
                    <Button {...SMALL} data-handover="1" aria-busy={work.pending === "handover" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={work.onHandOver}>
                      {t("org.inbox.handOver")}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={shared.quiet}>{t("org.inbox.no_workers")}</p>
              )
            ) : null}
            {actions.setDue ? (
              <div className={shared.group} data-due-form="1">
                <p className={shared.groupTitle}>{t("org.inbox.due_question")}</p>
                <p className={shared.quiet}>{t("org.inbox.due_hint")}</p>
                <DateField name="dueOn" value={work.dueOn} onChange={work.onDueOn} ariaLabel={t("org.inbox.due_question")} />
                <div>
                  <Button {...SMALL} data-due="1" aria-busy={work.pending === "due" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={work.onSaveDue}>
                    {t("org.inbox.due_save")}
                  </Button>
                  {work.dueSaved ? (
                    <Button {...SMALL} data-due-clear="1" aria-busy={work.pending === "dueClear" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={work.onClearDue}>
                      {t("org.inbox.due_clear")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Facts rows={facts} inline />
            {withheld ? (
              <p className={shared.notice}>{t("org.inbox.recalledNotice")}</p>
            ) : (
              parts.map((part) =>
                part.long ? (
                  <div key={part.key} className={shared.group}>
                    <p className={shared.groupTitle}>{part.label}</p>
                    <p className={shared.own}>{part.value}</p>
                  </div>
                ) : (
                  <Facts key={part.key} rows={[part]} />
                )
              )
            )}
            {closingNote ? (
              <div className={shared.group} data-closing-note="1">
                <p className={shared.groupTitle}>{t("org.inbox.outcome_note")}</p>
                <p className={shared.own}>{closingNote}</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Töö lõpetamine: selgitus pöördujale ja mis juhtub. Tagasilükkamisel on selgitus kohustuslik,
 * sulgemisel soovi korral; kumb, otsustab ./inboxRules.js (`ENDINGS`).
 *
 * `ending`: { kind, question, hint, note, submit, value, limit, busy, onChange, onBack, onSubmit }
 */
export function EndingView({ t, ending, notice }) {
  return (
    <StepPanel
      title={ending.submit}
      note={footNote(notice, ending.note)}
      actions={
        <>
          <Button {...SMALL} data-ending-back="1" onClick={ending.onBack}>
            {t("org.inbox.ending_back")}
          </Button>
          <Button type="button" size="sm" variant="primary" data-ending-submit={ending.kind} aria-busy={ending.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={ending.onSubmit}>
            {ending.submit}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={ending.busy ? "true" : undefined}>
        <TextAreaField label={ending.question} hint={ending.hint} value={ending.value} onChange={ending.onChange} rows={3} maxLength={ending.limit} />
      </div>
    </StepPanel>
  );
}
