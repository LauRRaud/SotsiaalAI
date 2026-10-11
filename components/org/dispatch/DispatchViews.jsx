"use client";

/**
 * Graafiku osa vaated.
 *
 * MIKS. Leht oli üks kast: kuupäev, kokkuvõte, nelja väljaga määramise vorm ja
 * selle all iga töötaja koos kõigi külastustega; töö teisele andmine küsis nime
 * ja põhjust kahe brauseri hüpikaknaga (nimi tuli valida numbri järgi). Nüüd on
 * korraga ees üks asi:
 *  - `BoardView`     päev: kuupäev, kokkuvõte ja töötajad madalate ridadena
 *  - `WorkerView`    üks töötaja: päeva seis, hoiatused ja külastused
 *  - `AssignForm`    töö määramine: töötaja lahtritena, klient, aadress, algus
 *  - `ReassignForm`  töö teisele andmine: kellele ja miks (põhjus jääb kirja)
 *  - `NoAccessView`  õiguseta liige saab selgituse, mitte vea
 *
 * Siin on ainult kuju. Otsused on failis ./dispatchRules.js; olek ja päringud lehel
 * (`../OrgDispatchBoard.jsx`).
 */

import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import { ADDRESS_LIMIT, CLIENT_LIMIT, REASON_LIMIT } from "./dispatchRules";

/** Õiguseta liige: selgitus. Veakood ütleks, et siin on midagi, mida ta näha ei tohi. */
export function NoAccessView({ t }) {
  return <StepPanel title={t("org.board.title")} lead={t("org.board.no_access")} />;
}

/**
 * Päeva tahvel. `assign`: { onAssign } või null (kui ei ole, kellele määrata).
 */
export function BoardView({ t, date, onDate, totals, rows, onOpen, assign, notice, glow = true }) {
  return (
    <StepPanel title={t("org.board.title")} note={footNote(notice, t("org.board.privacy_note"))}>
      <div className={shared.stack}>
        <div className={shared.headBar}>
          <label className={shared.line} data-size="sm">
            <span className={shared.fieldLabel}>{t("org.board.date")}</span>
            <Input type="date" className={shared.input} value={date} data-date="1" onChange={(event) => onDate(event.target.value)} />
          </label>
          {assign ? (
            <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={assign.onAssign}>
              {t("org.board.assign")}
            </Button>
          ) : null}
        </div>
        <p className={shared.small}>{totals}</p>
        {rows.length ? (
          <ul className={shared.rows} aria-label={t("org.board.title")}>
            {rows.map((row) => (
              <li key={row.id} className={shared.rowItem}>
                <button type="button" className={shared.row} data-worker={row.id} onClick={() => onOpen(row.id)}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    <span className={shared.rowSub}>{row.sub}</span>
                  </span>
                  {row.chips.length ? (
                    <span className={shared.rowMeta}>
                      {row.chips.map((chip) => (
                        <span key={chip} className={shared.chip} data-tone="wait">
                          {chip}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{t("org.board.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks töötaja: päeva seis, hoiatused ja külastused. Plaanis oleva külastuse
 * kõrval on „Anna teisele" (alustatud tööd teisele anda ei saa: nuppu ei ole).
 */
export function WorkerView({ t, title, line, warnings, visits, onReassign, notice, onBack }) {
  return (
    <StepPanel
      title={title}
      note={footNote(notice)}
      actions={
        <Button {...SMALL} data-back="1" onClick={onBack}>
          {t("org.members.back")}
        </Button>
      }
    >
      <div className={shared.stack}>
        <p className={shared.headName}>{title}</p>
        <p className={shared.quiet}>{line}</p>
        {warnings.map((warning) => (
          <p key={warning.id} className={shared.notice}>
            {warning.text}
          </p>
        ))}
        {visits.length ? (
          <ul className={shared.rows} aria-label={t("org.board.visits")}>
            {visits.map((visit) => (
              <li key={visit.id} className={shared.item} data-visit={visit.id}>
                <div className={shared.rowStatic}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{visit.title}</span>
                    {visit.sub ? <span className={shared.rowSub}>{visit.sub}</span> : null}
                  </span>
                </div>
                {visit.canReassign ? (
                  <span className={shared.itemAside}>
                    <Button {...SMALL} className={shared.aside} data-reassign={visit.id} aria-label={`${t("org.board.reassign")}: ${visit.title}`} onClick={() => onReassign(visit)}>
                      {t("org.board.reassign")}
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{t("org.board.no_visits")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/** Töö määramine. `decline`: { onPress }, `save`: { busy, onSave } */
export function AssignForm({ t, form, onField, workers, notice, decline, save, glow = true }) {
  return (
    <StepPanel
      title={t("org.board.assign")}
      note={footNote(notice, t("org.board.assign_note"))}
      actions={
        <>
          <Button {...SMALL} data-decline="1" onClick={decline.onPress}>
            {t("org.home.create.decline.label")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
            {save.busy ? t("org.board.assigning") : t("org.board.assign_send")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined}>
        <PickOne label={t("org.board.assign_worker")} options={workers} value={form.assignTo} onChange={(value) => onField("assignTo", value)} />
        <div className={shared.pair}>
          <label className={shared.line} data-size="sm">
            <span className={shared.fieldLabel}>{t("org.board.assign_client")}</span>
            <Input className={shared.input} value={form.client} maxLength={CLIENT_LIMIT} autoComplete="off" data-field="client" onChange={(event) => onField("client", event.target.value)} />
          </label>
          <label className={shared.line} data-size="sm">
            <span className={shared.fieldLabel}>{t("org.board.assign_time")}</span>
            <Input type="datetime-local" className={shared.input} value={form.startAt} data-field="startAt" onChange={(event) => onField("startAt", event.target.value)} />
          </label>
        </div>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.board.assign_address")}</span>
          <Input className={shared.input} value={form.address} maxLength={ADDRESS_LIMIT} autoComplete="off" data-field="address" onChange={(event) => onField("address", event.target.value)} />
        </label>
      </div>
    </StepPanel>
  );
}

/**
 * Töö teisele andmine: kellele ja miks. Nimi valitakse loendist (vale nimi
 * tähendaks, et töö läheb inimesele, kes sellest ei tea) ja põhjus jääb kirja.
 */
export function ReassignForm({ t, visitTitle, workers, workerUserId, onWorker, reason, onReason, notice, decline, save, glow = true }) {
  return (
    <StepPanel
      title={t("org.board.reassign")}
      question={t("org.board.reassign_subject", { client: visitTitle })}
      note={footNote(notice, t("org.board.reassign_note"))}
      actions={
        <>
          <Button {...SMALL} data-decline="1" onClick={decline.onPress}>
            {t("org.home.create.decline.label")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
            {save.busy ? t("org.board.reassigning") : t("org.board.reassign")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined}>
        <PickOne label={t("org.board.reassign_question")} options={workers} value={workerUserId} onChange={onWorker} />
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.board.reassign_reason")}</span>
          <Input className={shared.input} value={reason} maxLength={REASON_LIMIT} autoComplete="off" data-field="reason" onChange={(event) => onReason(event.target.value)} />
        </label>
      </div>
    </StepPanel>
  );
}
