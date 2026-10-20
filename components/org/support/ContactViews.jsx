"use client";

/**
 * Tugikontaktide halduse vaated (toe osa, haldur):
 *  - `ContactListView`  praegused tugi- ja turvakontaktid; lõpetamine küsib
 *                       teist vajutust
 *  - `ContactAddView`   uus kontakt: liik ja liige
 *
 * Muudatus jõustub kohe (iga tegu on oma päring ja auditirida), seega siin ei
 * ole „Salvesta" nuppu. Reeglid: ./contactRules.js; olek ja päringud lehel
 * (`../OrgSupportClient.jsx`).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { ArmedButton, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import { ADDABLE_CONTACT_TYPES } from "./contactRules";
import { contactTypeKey } from "./supportRules";

function BackButton({ t, onBack }) {
  return (
    <Button {...SMALL} data-back="1" onClick={onBack}>
      {t("org.members.back")}
    </Button>
  );
}

/** Praegused kontaktid. `end`: { armedId, busyId, onPress(row) } */
export function ContactListView({ t, rows, end, notice, onBack }) {
  return (
    <StepPanel
      title={t("org.support.contactAdmin.steps.list.title")}
      lead={t("org.support.contactAdmin.lead")}
      note={footNote(end.armedId ? { text: t("org.support.contactAdmin.end_note") } : notice, t("org.support.contactAdmin.note"))}
      actions={<BackButton t={t} onBack={onBack} />}
    >
      {rows.length ? (
        <ul className={shared.rows} aria-label={t("org.support.contactAdmin.steps.list.title")}>
          {rows.map((row) => (
            <li key={row.id} className={shared.item} data-contact={row.id} data-armed={end.armedId === row.id ? "1" : undefined} aria-busy={end.busyId === row.id ? "true" : undefined}>
              <div className={shared.rowStatic}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{row.title}</span>
                  <span className={shared.rowSub}>{row.sub}</span>
                </span>
              </div>
              <span className={shared.itemAside}>
                <ArmedButton armed={end.armedId === row.id} busy={end.busyId === row.id} label={t("org.support.contactAdmin.end")} confirm={t("org.support.contactAdmin.end_confirm")} onPress={() => end.onPress(row)} mark="end-contact" />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.quiet}>{t("org.support.contactAdmin.none")}</p>
      )}
    </StepPanel>
  );
}

/** Uus kontakt. `add`: { busy, onAdd } */
export function ContactAddView({ t, form, options, onField, add, notice, onBack, glow }) {
  return (
    <StepPanel
      title={t("org.support.contactAdmin.steps.add.title")}
      note={footNote(notice)}
      actions={
        <>
          <BackButton t={t} onBack={onBack} />
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={add.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={add.onAdd}>
            {add.busy ? t("org.support.contactAdmin.adding") : t("org.support.contactAdmin.add")}
          </Button>
        </>
      }
    >
      <div className={shared.stack}>
        <ChoiceRow
          label={t("org.support.contactAdmin.type_label")}
          options={ADDABLE_CONTACT_TYPES.map((type) => ({ value: type, label: t(contactTypeKey(type)) }))}
          value={form.contactType}
          onChange={(value) => onField("contactType", value)}
          columns={2}
          keepColumns
        />
        {options.length ? (
          <PickOne label={t("org.support.contactAdmin.member_label")} options={options} value={form.membershipId} onChange={(value) => onField("membershipId", value)} columns={2} />
        ) : (
          <p className={shared.quiet}>{t("org.support.contactAdmin.no_candidates")}</p>
        )}
        <p className={shared.small}>{t(`org.support.contactAdmin.type_hint.${form.contactType}`)}</p>
      </div>
    </StepPanel>
  );
}
