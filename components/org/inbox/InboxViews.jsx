"use client";

/**
 * Vastuvõtu osa vaated.
 *
 * MIKS. Loend oli viie veeruga tabel (aeg ISO kujul, vastutaja kohal kriips) ja
 * avatud pöördumine neli kasti üksteise all, kus kõik töö tegevused (määramine,
 * vastuvõtmine, üleandmine, sulgemine) olid ühes reas ja sulgemine käis ühe
 * vajutusega. Nüüd on korraga ees üks asi:
 *  - `InboxBoard`  pöördumised madalate ridadena: saabumise aeg, üksus, vastutaja, seis;
 *                  rida avab pöördumise (avamine on pöördujale nähtav)
 *  - `ItemView`    avatud pöördumine kahe väikese vaatega: pöördumine (saatja
 *                  kinnitatud pakett) ja töö (määramine, vastus, üleandmine, töö
 *                  tagasivõtmine, sulgemine, pöördumise tagasilükkamine; töö
 *                  tagasilükkamine, tagasivõtmine, sulgemine ja pöördumise
 *                  tagasilükkamine küsivad teist vajutust)
 *
 * Siin on ainult kuju. Otsused on failis ./inboxRules.js; olek ja päringud
 * lehtedel (`../OrgInboxClient.jsx`, `../OrgInboxItemClient.jsx`).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/**
 * Loend. Privaatsuslause all servas on sisu: siin ei ole midagi, mida pöörduja
 * ise ei saatnud. `more`: { busy, onMore } või null.
 */
export function InboxBoard({ t, rows, hrefOf, onOpen, more, notice }) {
  if (!rows.length) {
    return <StepPanel title={t("org.inbox.heading")} lead={t("org.inbox.empty")} note={footNote(notice, t("org.inbox.privacyNotice"))} />;
  }
  return (
    <StepPanel title={t("org.inbox.heading")} note={footNote(notice, t("org.inbox.privacyNotice"))}>
      <div className={shared.stack}>
        <ul className={shared.rows} aria-label={t("org.inbox.heading")}>
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
 *   onAccept, onReject, rejectArmed, onTakeBack, takeBackArmed, onClose, closeArmed,
 *   onRejectItem, rejectItemArmed, pending
 * }
 * `room`: { busy, onOpen } või null. Töö vastu võtnud töötaja avab vestlusruumi, kus
 *   ta pöördujale vastab; nupp on mõlemas vaates (see on tema järgmine samm).
 * `back`: { href, onBack }
 */
export function ItemView({ t, tabs, tab, onTab, facts, parts, withheld, work, room = null, notice, armedNote, back }) {
  const actions = work.actions;
  const onWork = tab === "work";
  return (
    <StepPanel
      title={t("org.inbox.sourcePackage")}
      note={footNote(armedNote ? { text: armedNote } : notice, !onWork && !withheld ? t("org.inbox.openedNotice") : "")}
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
          {onWork && actions.close ? (
            <ArmedButton armed={work.closeArmed} busy={work.pending === "close"} label={t("org.inbox.close")} confirm={t("org.inbox.close_confirm")} onPress={work.onClose} mark="close" />
          ) : null}
          {onWork && actions.rejectItem ? (
            <ArmedButton armed={work.rejectItemArmed} busy={work.pending === "rejectItem"} label={t("org.inbox.reject_item")} confirm={t("org.inbox.reject_item_confirm")} onPress={work.onRejectItem} mark="rejectItem" />
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
          </>
        )}
      </div>
    </StepPanel>
  );
}
