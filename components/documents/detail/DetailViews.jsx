"use client";

/**
 * Dokumendi ja koostatud teksti detaililehtede vaated.
 *
 * MIKS. Kaks detaililehte olid vanal ühisel kihil: tume kaart klaaspaneeli
 * sees, selle sees lehe pealkiri ja siis kõik korraga ühes veerus (seis,
 * pealkirja ja sisu väljad, viis nuppu reas, jagamine, mall ja allikad). Nüüd
 * on igal asjal oma vaade, samade klotsidega mis dokumentide lehel:
 *  - `ReadView`     kinnitatud tekst või transkript lugemiseks
 *  - `EditView`     mustandi pealkiri ja tekst; vaade mahub paneeli, tekst kerib väljas
 *  - `ApproveView`  mustandi kinnitamine (teine vajutus)
 *  - `ShareView`    kohtumise kokkuvõtte jagamine ruumi (teine vajutus)
 *  - `SourcesView`  mall ja allikfailid, iga rida viib faili oma lehele
 * Andmete ja tegevuste vaade on dokumentide lehe avatud dokumendi vaade ise
 * (`ItemView` failis ../workspace/DocumentsViews.jsx).
 *
 * PIKK TEKST LUGEMISEKS KERIB KOGU PANEELI, mitte kasti paneeli sees: lugemise
 * tekst on tavaline lõik. Toimetamise väli on erand (vt `EditView`).
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on lehtede failides
 * (../DocumentDetailPage.jsx, ../ArtifactDetailPage.jsx,
 * ../MeetingSummaryRoomShare.jsx), reeglid failis ./detailModel.js.
 *
 * Kujundus: ../workspace/documents.module.css (dokumentide lehega ühine) ja
 * detail.module.css (siin kõrval).
 */

import Link from "next/link";
import { useId } from "react";

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

import { ActionButtons, Chip } from "../workspace/DocumentsViews";
import shared from "../workspace/documents.module.css";
import { VISIBLE_ROOM_CHOICES } from "./detailModel";
import styles from "./detail.module.css";

/**
 * Laadimine ja laadimise viga. Viga on lause koos uue katse ja tagasiteega,
 * mitte tühi leht: vanal lehel ei saanud ebaõnnestunud laadimist uuesti proovida.
 */
export function LoadState({ t, error, onRetry, back }) {
  if (!error) return <p className={shared.quiet}>{t("documents.loading")}</p>;
  return (
    <div className={styles.fault}>
      <p className={shared.notice} data-tone="risk" role="alert">
        {error}
      </p>
      <div className={styles.faultActions}>
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {t("errors.retry")}
        </Button>
        <Button type="button" size="sm" variant="linkBrand" onClick={back.onClick}>
          {back.label}
        </Button>
      </div>
    </div>
  );
}

/**
 * Teade lava kohal. Siin on see, mida inimene peab nägema ka pärast vaate
 * vahetumist: tekst sai kinnitatud (lava ehitati uuesti), kokkuvõte läks
 * ruumi, kinnituse küsimine ei õnnestunud. Teade jääb ette, kuni inimene selle
 * sulgeb või teeb järgmise tegevuse.
 */
export function StayNotice({ t, notice, onClose }) {
  if (!notice?.text) return null;
  return (
    <p
      className={`${shared.notice} ${styles.stay}`}
      data-tone={notice.tone}
      /* Õnnestumine on vaikne teade, hoiatus ja viga öeldakse kohe välja. */
      role={notice.tone === "ok" ? undefined : "alert"}
      aria-live={notice.tone === "ok" ? "polite" : undefined}
    >
      <span>{notice.text}</span>
      <button type="button" className={shared.textButton} onClick={onClose}>
        {t("common.close")}
      </button>
    </p>
  );
}

/** Vaate jaluse teade: viga on selgelt eristatud, muu on vaikne rida. */
function footNote(text, tone) {
  if (!text) return null;
  return (
    <span className={styles.footNote} data-tone={tone}>
      {text}
    </span>
  );
}

/**
 * Tegevus, mis küsib teist vajutust: nupp vasakul, selgitus selle kõrval (sama
 * rida mis dokumentide lehe kustutamisel). Nupu liik ei vahetu vajutuste vahel
 * nii, et nupp ehitataks uuesti: fookus peab teiseks vajutuseks nupule jääma.
 */
function ConfirmRow({ action, primary = false, glow = true, disabled = false }) {
  const variant = primary ? "primary" : action.armed ? "danger" : "secondary";
  return (
    <div className={shared.confirm}>
      <Button type="button" size="sm" variant={variant} glow={primary ? glow : false} className={shared.confirmButton} disabled={disabled} onClick={action.onClick}>
        {action.label}
      </Button>
      {/* Selgituse koht on alati olemas: ekraanilugeja kuuleb, kui see täitub. */}
      <p className={shared.confirmNote} aria-live="polite">
        {action.note}
      </p>
    </div>
  );
}

/**
 * Tekst lugemiseks: kinnitatud tekst või faili transkript. Paneel algab teksti
 * pealkirjaga; pikk tekst kerib kogu paneeli.
 */
export function ReadView({ t, title, text, note, tone, actions = [] }) {
  return (
    <StepPanel
      title={t("documents.detail.views.text.title")}
      question={title}
      note={footNote(note, tone)}
      actions={actions.length ? <ActionButtons actions={actions} /> : null}
    >
      {text ? <p className={shared.text}>{text}</p> : <p className={shared.quiet}>{t("documents.detail.summary.empty_text")}</p>}
    </StepPanel>
  );
}

/**
 * Mustandi pealkiri ja tekst. Üks vaade, üks salvestus: mõlemad väljad lähevad
 * ühe päringuga. Välju päringu ajaks ei lukustata (fookus kaoks); topelt
 * salvestamise peab kinni leht.
 *
 * VAADE MAHUB PANEELI, tekst kerib oma väljas. Esimene versioon kasvatas välja
 * teksti kõrguseks ja lasi kogu paneelil kerida: siis oli salvestusnupp koos
 * seisureaga („salvestatud", viga, „salvestamata muudatused") mitme lehekülje
 * kaugusel teksti lõpus ja kleepuvat riba lava sees teha ei saa (lava lõikab
 * selle ära; mõõdetud brauseris). Toimetamisel peab salvestamine olema kogu aeg
 * näha, seepärast on väli paneeli kõrgune ja jalus paigal. Välja saab nurgast
 * kõrgemaks venitada. Ctrl+S (Macis Cmd+S) salvestab samuti.
 * `hint`: seisurea vaikimisi tekst, kui muud öelda ei ole.
 * `back.armed`: lahkumise teine vajutus ootab ja jalus ütleb, mis kaotsi läheks.
 */
export function EditView({ t, title, onTitle, content, onContent, note, tone, hint, saving, glow = true, onSave, onCopy, back }) {
  const formId = useId();
  const areaId = useId();
  const noteId = useId();
  const shownNote = back.armed ? footNote(back.note, "risk") : footNote(note || hint, note ? tone : "ok");
  return (
    <StepPanel
      title={t("documents.detail.views.text.title")}
      note={<span id={noteId}>{shownNote}</span>}
      actions={
        <>
          <Button type="button" size="sm" variant="linkBrand" onClick={back.onClick}>
            {back.label}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onCopy}>
            {t("documents.actions.copy")}
          </Button>
          <Button type="submit" form={formId} size="sm" variant="primary" glow={glow}>
            {saving ? t("documents.actions.saving") : t("documents.actions.save_draft")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.editor}
        noValidate
        onSubmit={onSave}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (!event.repeat) onSave(event);
          }
        }}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("documents.form.title_label")}</span>
          <Input
            name="artifactTitle"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            placeholder={t("documents.form.artifact_title_placeholder")}
            autoComplete="off"
          />
        </label>
        {/* Vaate nimi on „Tekst": välja silt on ainult ekraanilugejale. */}
        <label className="sr-only" htmlFor={areaId}>
          {t("documents.form.content_label")}
        </label>
        <Textarea
          id={areaId}
          name="artifactContent"
          className={styles.area}
          rows={8}
          value={content}
          aria-describedby={noteId}
          onChange={(event) => onContent(event.target.value)}
        />
      </form>
    </StepPanel>
  );
}

/**
 * Mustandi kinnitamine. Kinnitatud teksti ei saa enam muuta, seepärast küsib
 * nupp teist vajutust. Kinnitus võtab kaasa selle, mis parajasti väljadel on:
 * vaade ütleb, kui seal on salvestamata muudatusi.
 */
export function ApproveView({ t, title, unsaved, empty, note, tone, approving, glow = true, confirm }) {
  return (
    <StepPanel
      title={t("documents.detail.views.approve.title")}
      question={t("documents.detail.approve.question", { title })}
      lead={t("documents.detail.approve.lead")}
      note={footNote(note, tone)}
    >
      <div className={shared.stack}>
        {unsaved ? <p className={shared.quiet}>{t("documents.detail.approve.unsaved")}</p> : null}
        {empty ? (
          <p className={shared.quiet}>{t("documents.detail.approve.empty")}</p>
        ) : (
          <ConfirmRow primary glow={glow} action={approving ? { ...confirm, label: t("documents.actions.approving") } : confirm} />
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Kohtumise kokkuvõtte jagamine ruumi. Ruum valitakse alati ise (vaikimisi
 * valikut ei ole: kliendi kokkuvõte ei tohi minna ruumi, mida keegi ei
 * valinud) ja jagamine küsib teist vajutust.
 *
 * `rooms`: { status: "loading" | "error" | "ready", options, value, onChange, onRetry }
 */
export function ShareView({ t, title, rooms, approval, note, tone, sharing, glow = true, confirm }) {
  const ready = rooms.status === "ready" && rooms.options.length > 0;
  const roomLabel = t("documents.meeting_summary_share.room_label");
  return (
    <StepPanel
      title={t("documents.detail.views.share.title")}
      question={ready ? t("documents.meeting_summary_share.question") : undefined}
      lead={t("documents.meeting_summary_share.lead", { title })}
      note={footNote(note, tone)}
    >
      <div className={shared.stack}>
        {rooms.status === "loading" ? <p className={shared.quiet}>{t("documents.meeting_summary_share.loading")}</p> : null}
        {rooms.status === "error" ? (
          <div className={styles.fault}>
            <p className={shared.quiet}>{t("documents.meeting_summary_share.rooms_failed")}</p>
            <Button type="button" size="sm" variant="secondary" onClick={rooms.onRetry}>
              {t("errors.retry")}
            </Button>
          </div>
        ) : null}
        {rooms.status === "ready" && !ready ? <p className={shared.quiet}>{t("documents.meeting_summary_share.no_rooms")}</p> : null}
        {ready ? (
          <>
            {rooms.options.length <= VISIBLE_ROOM_CHOICES ? (
              <ChoiceRow label={roomLabel} labelHidden options={rooms.options} value={rooms.value} onChange={rooms.onChange} />
            ) : (
              <div
                className={styles.select}
                /* Rippvaliku loend on Reacti portaal: selle klahvivajutused
                   jõuavad lavani, mis vahetaks PageUp ja PageDown peale osa. */
                onKeyDown={(event) => {
                  if (event.key === "PageDown" || event.key === "PageUp") event.stopPropagation();
                }}
              >
                <Dropdown
                  value={rooms.value}
                  onChange={rooms.onChange}
                  ariaLabel={roomLabel}
                  placeholder={t("documents.meeting_summary_share.select_room")}
                  options={rooms.options}
                />
              </div>
            )}
            <div className={shared.share}>
              <CheckCard
                title={t("documents.meeting_summary_share.request_approval")}
                description={t("documents.meeting_summary_share.request_approval_desc")}
                checked={approval.checked}
                onChange={approval.onChange}
              />
            </div>
            <ConfirmRow
              primary
              glow={glow}
              disabled={!rooms.value}
              action={sharing ? { ...confirm, label: t("documents.meeting_summary_share.sharing") } : confirm}
            />
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Millest tekst koostati: valitud mall ja allikfailid. Rida viib faili oma
 * lehele. `unsaved`: mustandis on salvestamata muudatusi; siis avaneb fail
 * uues vahelehes, et pooleli tekst jääks siia alles (lehe sees liikudes
 * brauser lahkumise eel ei küsi ja tekst läheks kaotsi).
 */
export function SourcesView({ t, template, sources, unsaved }) {
  const rows = [...(template ? [template] : []), ...sources];
  return (
    <StepPanel title={t("documents.detail.views.sources.title")} lead={t("documents.detail.sources.lead")}>
      <div className={shared.stack}>
        {unsaved ? <p className={shared.quiet}>{t("documents.detail.sources.opens_new_tab")}</p> : null}
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                {/* Eellaadimist ei ole: allikaid võib olla kümme ja iga leht teeb oma päringu. */}
                <Link
                  className={`${shared.row} ${styles.linkRow}`}
                  href={row.href}
                  prefetch={false}
                  target={unsaved ? "_blank" : undefined}
                  rel={unsaved ? "noopener" : undefined}
                >
                  <span className={styles.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    {row.sub ? <span className={styles.rowSub}>{row.sub}</span> : null}
                  </span>
                  <span className={shared.rowMeta}>
                    <Chip tone="quiet">{row.chip}</Chip>
                  </span>
                  <span className={shared.rowOpen} aria-hidden="true">
                    {t("documents.actions.open")} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {sources.length ? null : <p className={shared.quiet}>{t("documents.empty_sources")}</p>}
      </div>
    </StepPanel>
  );
}
