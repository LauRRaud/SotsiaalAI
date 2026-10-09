"use client";

/**
 * Kutse vaated: ruum ja kutsuja nimi, keda kutsutakse, e-posti aadress,
 * tasumine ja saatmine ning saadetud kutsed.
 *
 * MIKS. Kutse oli üks vorm kuue väljaga, mis olid venitatud paneeli laiuseks,
 * ja kohe selle all kutsete tabel. Nüüd on igal asjal oma väike vaade
 * (`components/stage`):
 *  - `RoomView`    ruumi nimi ja kutsuja nimi vestluses (ainult uue ruumi puhul)
 *  - `WhoView`     keda kutsutakse, ja lause selle kohta, millele kutsutu ligi pääseb
 *  - `EmailsView`  e-posti aadress või mitu aadressi
 *  - `SendView`    ülevaade, kes tasub, ja saatmine või makse alustamine
 *  - `SentView`    selle ruumi kutsed: seis märgina, uuesti saatmine, tühistamine
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../InviteModal.jsx,
 * reeglid failis ./inviteRows.js.
 *
 * Kujundus: invite.module.css (siin kõrval).
 */

import { useId } from "react";

import ConfirmButton from "@/components/casework/ConfirmButton";
import RichText from "@/components/i18n/RichText";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";

import styles from "./invite.module.css";

const SMALL_BUTTON = Object.freeze({ size: "sm", variant: "secondary" });

function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/** Vaate viga paneeli all servas (`StepPanel note`): seal, kus seda parandada saab.
    `role="alert"`: viga ilmub koos oma tekstiga ja peab kohe kõlama. */
function footError(text) {
  return text ? (
    <span className={styles.footError} role="alert">
      {text}
    </span>
  ) : (
    ""
  );
}

/**
 * Enter väljal viib järgmise vaate juurde. Kutset see EI saada: saatmine käib
 * ainult saatmise vaate nupust, sest kutse on päris e-kiri.
 */
function enterMoves(onEnter) {
  return (event) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing || event.target?.tagName !== "INPUT") return;
    event.preventDefault();
    onEnter?.();
  };
}

/**
 * Lehe teade vaadete kohal: saatmise tulemus jääb ette kuni järgmise
 * saatmiseni (osa kirju võis jääda välja minemata). `aria-live`, mitte
 * status-roll: ühine lehekiht joonistab iga status-rolliga elemendi kastina.
 */
export function InviteNotice({ notice }) {
  if (!notice?.text) return null;
  return (
    <p className={styles.notice} data-tone={notice.tone} aria-live="polite">
      {notice.text}
    </p>
  );
}

/** Ruumi nimi ja kutsuja nimi vestluses: kaks lühikest välja kõrvuti. */
export function RoomView({ t, roomTitle, onRoomTitle, hostName, onHostName, error, onEnter }) {
  const id = useId();
  return (
    <StepPanel title={t("invite.views.room.title")} note={footError(error)}>
      <div className={styles.fields} onKeyDown={enterMoves(onEnter)}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}-room`}>
            {t("invite.room_title")}
          </label>
          <Input
            id={`${id}-room`}
            className={styles.input}
            type="text"
            value={roomTitle}
            autoComplete="off"
            onChange={(event) => onRoomTitle(event.target.value)}
          />
        </div>
        <div className={styles.field} data-size="sm">
          <label className={styles.fieldLabel} htmlFor={`${id}-host`}>
            {t("invite.host_name")}
          </label>
          <Input
            id={`${id}-host`}
            className={styles.input}
            type="text"
            value={hostName}
            /* Server lõikab nime 80 märgi peale; väli ütleb sama piiri. */
            maxLength={80}
            placeholder={t("invite.host_name_ph")}
            onChange={(event) => onHostName(event.target.value)}
          />
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Keda kutsutakse. Lause selle kohta, millele kutsutu ligi pääseb, seisab kohe
 * valiku all sõna-sõnalt samana mis vanal vormil.
 */
export function WhoView({ t, options, value, onChange, error }) {
  const scopeId = useId();
  return (
    <StepPanel title={t("invite.views.who.title")} question={t("invite.participant.question")} note={footError(error)}>
      {/* Valik viitab lausele, mis ütleb, millele kutsutu ligi pääseb. */}
      <div className={styles.stack} role="group" aria-describedby={scopeId}>
        <ChoiceRow
          label={t("invite.participant.question")}
          labelHidden
          columns={options.length}
          options={options}
          value={value}
          onChange={onChange}
        />
        <p className={styles.scope} id={scopeId}>
          {t("invite.participant.scope")}
        </p>
      </div>
    </StepPanel>
  );
}

/** E-posti aadress. Väli on nii lai, kui paar aadressi vajab, mitte paneeli laiune. */
export function EmailsView({ t, value, onChange, error, onEnter }) {
  const id = useId();
  return (
    <StepPanel title={t("invite.views.emails.title")} question={t("invite.views.emails.question")} note={footError(error)}>
      <div className={styles.field} data-size="lg" onKeyDown={enterMoves(onEnter)}>
        <Input
          id={id}
          className={styles.input}
          type="text"
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t("invite.classic.emails_ph")}
          aria-label={t("invite.classic.emails")}
          invalid={Boolean(error)}
          describedBy={`${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.fieldHint} id={`${id}-hint`}>
          {t("invite.views.emails.hint")}
        </span>
      </div>
    </StepPanel>
  );
}

/**
 * Tasumine ja saatmine: mis on kokku pandud, kes tasub, ja vaate nupp.
 *
 * VALIK „TASUN TEMA EEST" KÜSIB TEIST VAJUTUST. Vanal vormil oli see lai
 * märkeruut keset vormi ja üks eksinud vajutus vahetas saatmise nupu makse
 * nupu vastu. Nüüd on see eraldi nupp, mille esimene vajutus ainult küsib
 * kinnitust (`ConfirmButton`: topeltklõps ega all hoitud klahv teist astet läbi
 * ei tee). Tagasi („Kutsutu tasub ise") saab ühe vajutusega.
 *
 * `pay`: { host, closed, closedText, busy, onChoose, roles, roleLine, agreed, onAgree, agreementLinks }
 */
export function SendView({ t, facts, pay, error, actions }) {
  const id = useId();
  return (
    <StepPanel title={t("invite.views.send.title")} note={footError(error)} actions={actions}>
      <div className={styles.stack}>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.key} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue} data-missing={fact.missing ? "true" : undefined}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        {pay.host ? (
          <div className={styles.sponsor}>
            {pay.roles ? (
              <ChoiceRow
                label={t("invite.views.send.role_question")}
                columns={pay.roles.options.length}
                options={pay.roles.options}
                value={pay.roles.value}
                onChange={pay.roles.onChange}
              />
            ) : pay.roleLine ? (
              <p className={styles.line}>{pay.roleLine}</p>
            ) : null}
            <div className={styles.consent}>
              <p className={styles.consentTitle}>{t("invite.sponsored.checkout.title")}</p>
              <Checkbox
                id={`${id}-consent`}
                name="inviteSponsoredConsent"
                className={styles.consentCheck}
                checked={pay.agreed}
                onChange={(next) => pay.onAgree(next)}
                label={<RichText as="span" value={t("invite.sponsored.checkout.agreement")} replacements={pay.agreementLinks} />}
              />
            </div>
          </div>
        ) : (
          <div className={styles.payChoice}>
            <ConfirmButton
              as={Button}
              buttonProps={SMALL_BUTTON}
              className={styles.payButton}
              cancelClassName=""
              label={t("invite.pay.host")}
              confirmLabel={t("invite.pay.confirm")}
              cancelLabel={t("invite.confirm_cancel")}
              /* Kui maksmine on keskkonnas suletud, ei saa valikut teha: nupp on
                 keelatud ja põhjus on selle kõrval. */
              disabled={pay.closed || pay.busy}
              onConfirm={pay.onChoose}
            />
            <p className={styles.payNote}>{pay.closed ? pay.closedText : t("invite.pay.note")}</p>
          </div>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Saadetud kutsed. Rida on madal: aadress ja kes tasub, seis märgina ning üks
 * põhitegevus (saada uuesti). Tühistamine teeb kutse lingi kehtetuks, seepärast
 * on see vaikne tekstinupp, mis küsib teist vajutust.
 *
 * `listRef`: pärast tühistamist läheb fookus loendile (rea nupud kaovad).
 */
export function SentView({ t, rows, loading, emptyText, error, onRefresh, listRef }) {
  return (
    <StepPanel
      title={t("invite.views.sent.title")}
      note={footError(error)}
      actions={
        <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={onRefresh}>
          {loading ? t("invite.loading") : t("invite.refresh")}
        </Button>
      }
    >
      <div className={styles.list} ref={listRef} tabIndex={-1}>
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.rowTitle}>{row.email}</span>
                  <span className={styles.rowSub}>{row.payer}</span>
                </span>
                <span className={styles.rowMeta}>
                  <Chip tone={row.tone}>{row.state}</Chip>
                </span>
                {row.canResend || row.canRevoke ? (
                  <span className={styles.buttons}>
                    {row.canResend ? (
                      <Button type="button" size="sm" variant="secondary" disabled={row.busy} onClick={row.onResend}>
                        {t("invite.resend")}
                      </Button>
                    ) : null}
                    {row.canRevoke ? (
                      <ConfirmButton
                        className={styles.textDanger}
                        cancelClassName={styles.textButton}
                        label={t("invite.revoke")}
                        confirmLabel={t("invite.revoke_confirm")}
                        cancelLabel={t("invite.confirm_cancel")}
                        disabled={row.busy}
                        onConfirm={row.onRevoke}
                      />
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{loading ? t("invite.loading") : emptyText}</p>
        )}
      </div>
    </StepPanel>
  );
}

/** Sisse logimata külastaja: kutsuda ei saa, öeldakse miks. */
export function SignedOutView({ t, title }) {
  return (
    <StepPanel title={title}>
      <p className={styles.quiet}>{t("invite.login_required")}</p>
    </StepPanel>
  );
}
