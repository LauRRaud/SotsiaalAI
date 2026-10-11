"use client";

/**
 * Laekunud materjalide ülevaatuse vaated (administraator): loend, avatud
 * materjal ja õiguste vorm enne importi.
 *
 * MIKS. Ülevaatus oli üks loend, kus iga rida kandis kuut teksti ja viit nuppu;
 * märkust küsis brauseri `prompt`, importi neli `prompt`-i ja `confirm`,
 * kustutamist `confirm`. Brauseri dialoog ei ole tõlgitav ega kanna meie
 * sõnastust. Nüüd:
 *  - `ReviewListView`   loend: seisu filter, madal rida, üks tegevus „Ava"
 *  - `SubmissionView`   avatud materjal: faktid, saatja selgitus, märkuse väli,
 *                       ülevaatuse tegevused; tagasilükkamine ja kustutamine
 *                       küsivad teist vajutust
 *  - `RightsView`       õiguste vorm: autor, õiguste omaja, alus, tõend ja kinnitus
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MaterialsAdminSubmissionsPanel.jsx, read ja reeglid failis ./materialRows.js.
 *
 * Kujundus: materials.module.css (siin kõrval).
 */

import { useId } from "react";

import ConfirmButton from "@/components/casework/ConfirmButton";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { REVIEW_NOTE_MAX } from "./materialRows";
import { Chip, DANGER_BUTTON, Facts, Notice, Rows, footError } from "./MaterialsViews";
import styles from "./materials.module.css";

/**
 * Laekunud materjalid: seisu filter ühelaiuste lahtritena, koguarv ja read.
 * `back`: tee tagasi oma materjalide juurde, kui ülevaatus on avatud materjalide
 * lehe seest.
 */
export function ReviewListView({ t, filter, total, status, rows, error, emptyText, more, onRefresh, back }) {
  return (
    <StepPanel
      title={t("materials_page.views.review.title")}
      lead={t("materials_page.admin.subtitle")}
      actions={
        <>
          {back ? (
            <Button type="button" size="sm" variant="secondary" onClick={back.onClick}>
              {back.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" disabled={status === "loading"} onClick={onRefresh}>
            {t("materials_page.admin.refresh")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.tools}>
          <div className={styles.filter}>
            <ChoiceRow
              label={t("materials_page.admin.status_filter")}
              labelHidden
              columns={filter.options.length}
              options={filter.options}
              value={filter.value}
              onChange={filter.onChange}
            />
          </div>
          <span className={styles.time}>{total}</span>
        </div>
        <Notice text={error} tone="risk" />
        {rows.length ? (
          <Rows rows={rows} openText={t("materials_page.views.open")} />
        ) : status === "loading" ? (
          <p className={styles.quiet}>{t("materials_page.admin.loading")}</p>
        ) : status === "error" ? null : (
          <p className={styles.quiet}>{emptyText}</p>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={more.busy} onClick={more.onClick}>
            {t("materials_page.admin.load_more")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Avatud laekunud materjal.
 *
 * MÄRKUS ON VÄLI, mitte brauseri küsimus: see läheb kaasa nii ülevaadatuks
 * märkimise kui tagasilükkamisega. Tagasilükkamine ja kustutamine küsivad teist
 * vajutust (vanal lehel oli tagasilükkamise ainus kinnitus märkuse dialoogi
 * „OK" ja kustutamisel brauseri `confirm`).
 */
export function SubmissionView({ t, sheet, note, error, busy, onBack, onReview, onReject, onImport, onDelete }) {
  const id = useId();
  return (
    <StepPanel
      title={t("materials_page.views.submission.title")}
      question={sheet.title}
      note={footError(error)}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            {t("materials_page.views.back_to_list")}
          </Button>
          <Button as="a" href={sheet.previewHref} size="sm" variant="secondary">
            {t("materials_page.admin.sanitized_preview")}
          </Button>
          {sheet.importOffered ? (
            <Button type="button" size="sm" variant="secondary" disabled={busy || !sheet.canImport} onClick={onImport}>
              {t("materials_page.admin.mark_imported")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.line}>
          <Chip tone={sheet.tone}>{sheet.state}</Chip>
        </div>
        <Facts facts={sheet.facts} />
        <p className={styles.text} data-missing={sheet.comment ? undefined : "true"}>
          {sheet.comment || t("materials_page.admin.comment_missing")}
        </p>
        {sheet.reviewNote ? <p className={styles.reviewNote}>{sheet.reviewNote}</p> : null}
        <div className={styles.review}>
          <div className={styles.field} data-size="lg">
            <label className={styles.fieldLabel} htmlFor={`${id}-note`}>
              {t("materials_page.admin.note_label")}
            </label>
            <Input
              id={`${id}-note`}
              className={styles.input}
              type="text"
              value={note.value}
              maxLength={REVIEW_NOTE_MAX}
              autoComplete="off"
              onChange={(event) => note.onChange(event.target.value)}
            />
          </div>
          <div className={styles.buttons}>
            <Button type="button" size="sm" variant="primary" disabled={busy || !sheet.canReview} onClick={onReview}>
              {t("materials_page.admin.mark_reviewed")}
            </Button>
            <ConfirmButton
              as={Button}
              buttonProps={DANGER_BUTTON}
              className={styles.danger}
              cancelClassName=""
              label={t("materials_page.admin.reject")}
              confirmLabel={t("materials_page.admin.reject_confirm")}
              cancelLabel={t("materials_page.views.cancel")}
              disabled={busy || !sheet.canReject}
              onConfirm={onReject}
            />
          </div>
        </div>
        <div className={styles.confirm}>
          <ConfirmButton
            as={Button}
            buttonProps={DANGER_BUTTON}
            className={styles.danger}
            cancelClassName=""
            label={t("materials_page.admin.delete")}
            confirmLabel={t("materials_page.admin.delete_again")}
            cancelLabel={t("materials_page.views.cancel")}
            disabled={busy}
            onConfirm={onDelete}
          />
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Õigused enne importi. Vana leht küsis need neli asja järjest brauseri
 * dialoogidega ja katkestas esimese tühja vastuse peale; siin on need ühes
 * väikeses vormis ja nupp avaneb, kui kõik on täidetud ja kinnitus antud.
 *
 * `form`: { value, onChange(field, value), bases, ready }
 */
export function RightsView({ t, form, error, busy, onCancel, onSubmit }) {
  const id = useId();
  const field = (name, label) => (
    <div className={styles.field} data-size="sm">
      <label className={styles.fieldLabel} htmlFor={`${id}-${name}`}>
        {label}
      </label>
      <Input
        id={`${id}-${name}`}
        className={styles.input}
        type="text"
        value={form.value[name]}
        autoComplete="off"
        onChange={(event) => form.onChange(name, event.target.value)}
      />
    </div>
  );
  return (
    <StepPanel
      title={t("materials_page.views.rights.title")}
      lead={t("materials_page.admin.rights.lead")}
      note={footError(error)}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {t("materials_page.views.cancel")}
          </Button>
          <Button type="button" size="sm" variant="primary" disabled={busy || !form.ready} onClick={onSubmit}>
            {t("materials_page.admin.rights.submit")}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <div className={styles.fields}>
          {field("authorName", t("materials_page.admin.rag_author_prompt"))}
          {field("rightsHolder", t("materials_page.admin.rag_rights_holder_prompt"))}
          {field("rightsEvidence", t("materials_page.admin.rag_rights_evidence_prompt"))}
        </div>
        <ChoiceRow
          label={t("materials_page.admin.rights.basis_label")}
          columns={form.bases.length}
          options={form.bases}
          value={form.value.rightsBasis}
          onChange={(value) => form.onChange("rightsBasis", value)}
        />
        <div className={styles.check}>
          <CheckCard
            title={t("materials_page.admin.rag_classification_confirm")}
            checked={form.value.confirmed}
            onChange={(checked) => form.onChange("confirmed", checked)}
          />
        </div>
      </div>
    </StepPanel>
  );
}
