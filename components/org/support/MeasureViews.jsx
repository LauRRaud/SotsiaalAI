"use client";

/**
 * Asutuse tugimeetmete vaated (toe osa lahter „Asutuse tugi").
 *
 *  - `MeasuresList`        mida asutus pakub: kolm rühma kõrvuti, iga meetme
 *                          all asutuse juhis (iga liige näeb)
 *  - `MeasureGroupView`    muutmine 1–3/4: rühma meetmed märkelahtritena
 *  - `MeasureDetailsView`  muutmine 4/4: vali meede ja kirjuta, kuidas seda
 *                          kasutada (üks meede korraga, et vaade mahuks)
 *
 * Siin on ainult kuju. Reeglid: ./measureRules.js; olek ja päringud lehel
 * (`../OrgSupportClient.jsx`).
 */

import ChoiceChips from "@/components/stage/ChoiceChips";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { ArmedButton, PickOne, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import { MEASURE_DETAILS_LIMIT, draftKeys, groupOptions, measureText } from "./measureRules";

/** Mida asutus pakub. `groups`: vt `measureGroupsOf`. */
export function MeasuresList({ t, groups }) {
  if (!groups.length) return <p className={shared.quiet}>{t("org.support.measures.none")}</p>;
  return (
    <div className={shared.measureColumns}>
      {groups.map((entry) => (
        <div key={entry.group} className={shared.group}>
          <p className={shared.groupTitle}>{t(`org.support.measures.groups.${entry.group}`)}</p>
          <ul className={shared.lines}>
            {entry.rows.map((row) => (
              <li key={row.key} className={shared.lineItem} data-measure={row.key}>
                {measureText(t, row.key)}
                {row.sub ? <span className={shared.measureNote}>{row.sub}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Muutmise all serva tegevused: loobumine (kirjutatud mustandil teine vajutus) ja salvestamine. */
function EditActions({ t, decline, save, glow }) {
  return (
    <>
      <ArmedButton armed={decline.armed} label={t("org.home.create.decline.label")} confirm={t("org.home.create.decline.confirm")} onPress={decline.onPress} mark="decline" />
      <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
        {save.busy ? t("org.support.measures.saving") : t("org.support.measures.save")}
      </Button>
    </>
  );
}

const editNote = (t, decline, notice, quiet) => footNote(decline.armed ? { text: t("org.support.measures.decline_note") } : notice, quiet);

/** Muutmine: ühe rühma meetmed. */
export function MeasureGroupView({ t, group, draft, onToggle, notice, decline, save, glow }) {
  return (
    <StepPanel
      title={t(`org.support.measures.groups.${group}`)}
      lead={t("org.support.measures.group_lead")}
      note={editNote(t, decline, notice, t("org.support.measures.edit_note"))}
      actions={<EditActions t={t} decline={decline} save={save} glow={glow} />}
    >
      <ChoiceChips label={t(`org.support.measures.groups.${group}`)} labelHidden options={groupOptions(group).map((option) => ({ ...option, label: measureText(t, option.value) }))} values={draftKeys(draft)} onToggle={onToggle} />
    </StepPanel>
  );
}

/** Muutmine: juhis valitud meetme juurde. */
export function MeasureDetailsView({ t, draft, editing, onEdit, onDetails, notice, decline, save, glow }) {
  const keys = draftKeys(draft);
  const current = keys.includes(editing) ? editing : keys[0] || "";
  return (
    <StepPanel
      title={t("org.support.measures.steps.details.title")}
      lead={keys.length ? t("org.support.measures.details_lead") : undefined}
      note={editNote(t, decline, notice)}
      actions={<EditActions t={t} decline={decline} save={save} glow={glow} />}
    >
      {keys.length ? (
        <div className={shared.stack}>
          <PickOne
            label={t("org.support.measures.details_pick")}
            options={keys.map((key) => ({ value: key, label: measureText(t, key) }))}
            value={current}
            onChange={onEdit}
            columns={2}
          />
          <TextAreaField
            key={current}
            label={t("org.support.measures.details_label", { measure: measureText(t, current) })}
            hint={t("org.support.measures.details_hint", { limit: MEASURE_DETAILS_LIMIT })}
            value={draft[current] || ""}
            onChange={(value) => onDetails(current, value)}
            rows={3}
            maxLength={MEASURE_DETAILS_LIMIT}
          />
        </div>
      ) : (
        <p className={shared.quiet}>{t("org.support.measures.details_empty")}</p>
      )}
    </StepPanel>
  );
}
