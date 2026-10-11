"use client";

/**
 * Liikmete osa vaated.
 *
 * MIKS. Leht oli kuue veeruga tabel, kus iga rea sees olid rippmenüüd (põhiüksus,
 * õiguse andmine), ristiga õiguse äravõtmine ja kolm nuppu; liikmesuse lõpetamine
 * ja õiguse äravõtmine käisid ühe vajutusega. Nüüd on korraga ees üks asi:
 *  - `MembersBoard`  liikmed madalate ridadena; rida avab liikme
 *  - `MemberView`    üks liige kolme väikese vaatega: liige (read, peatamine,
 *                    lõpetamine), üksus (põhiüksus ühelaiuste lahtritena) ja
 *                    õigused (mis tal on ja mida saab juurde anda)
 * Lõpetamine ja õiguse äravõtmine küsivad teist vajutust samal nupul.
 *
 * Siin on ainult kuju. Otsused on failis ./memberRules.js; olek ja päringud lehel
 * (`../OrgMembersClient.jsx`). Kujundus: organisatsioonide lehtede ühine
 * ../org.module.css.
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/** Loend. Rida avab liikme; privaatsuslause all servas on sisu, mitte kaunistus. */
export function MembersBoard({ t, rows, notice, onOpen }) {
  return (
    <StepPanel title={t("org.members.heading")} note={footNote(notice, t("org.members.privacyNotice"))}>
      {rows.length ? (
        <ul className={shared.rows} aria-label={t("org.members.heading")}>
          {rows.map((row) => (
            <li key={row.id} className={shared.rowItem}>
              <button type="button" className={shared.row} data-member={row.id} onClick={() => onOpen(row.id)}>
                <span className={shared.rowMain}>
                  <span className={shared.rowTitle}>{row.title}</span>
                  {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                </span>
                {row.chip ? (
                  <span className={shared.rowMeta}>
                    <span className={shared.chip} data-tone={row.attention ? "wait" : undefined}>
                      {row.chip}
                    </span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.quiet}>{t("org.members.empty")}</p>
      )}
    </StepPanel>
  );
}

/**
 * Avatud liige.
 *
 * `tabs`: vaadete võtmed, `tab`: ees olev vaade
 * `unit`: { options, value, onChange }
 * `rights`: { held: [{ id, label }], grantable: [{ value, label }], canRevoke, armedId, armedGrant, onRevoke(right), onGrant(capability) }
 * `life`: { suspend, reactivate, end, endArmed, onSuspend, onReactivate, onEnd }
 */
export function MemberView({ t, name, tabs, tab, onTab, facts, unit, rights, life, notice, armedNote, busy, onBack }) {
  const back = (
    <Button {...SMALL} data-back="1" onClick={onBack}>
      {t("org.members.back")}
    </Button>
  );
  return (
    <StepPanel
      title={name}
      note={footNote(armedNote ? { text: armedNote } : notice, tab === "rights" && !rights.canRevoke ? t("org.members.rights_owner_only") : "")}
      actions={
        <>
          {back}
          {tab === "member" && life.suspend ? (
            <Button {...SMALL} data-suspend="1" onKeyDown={ignoreKeyRepeat} onClick={life.onSuspend}>
              {t("org.members.suspend")}
            </Button>
          ) : null}
          {tab === "member" && life.reactivate ? (
            <Button {...SMALL} data-reactivate="1" onKeyDown={ignoreKeyRepeat} onClick={life.onReactivate}>
              {t("org.members.reactivate")}
            </Button>
          ) : null}
          {tab === "member" && life.end ? (
            <ArmedButton armed={life.endArmed} label={t("org.members.end")} confirm={t("org.members.end_confirm")} onPress={life.onEnd} mark="end" />
          ) : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {/* Nimi ja vaadete lahtrid ühel real: õiguste vaade (kuni kümme lahtrit)
            mahub nii paneeli. */}
        <div className={shared.headBar}>
          <p className={shared.headName}>{name}</p>
          <ChoiceRow
            label={t("org.members.tabs.label")}
            labelHidden
            options={tabs.map((key) => ({ value: key, label: t(`org.members.tabs.${key}`) }))}
            value={tab}
            onChange={onTab}
            columns={tabs.length}
            keepColumns
          />
        </div>
        {tab === "member" ? <Facts rows={facts} /> : null}
        {tab === "unit" ? (
          <PickOne label={t("org.members.unit_question")} options={unit.options} value={unit.value} onChange={unit.onChange} />
        ) : null}
        {tab === "rights" ? (
          <>
            <div className={shared.group}>
              <p className={shared.groupTitle}>{t("org.members.rights_held")}</p>
              {rights.held.length ? (
                rights.canRevoke ? (
                  <div className={shared.cells}>
                    {rights.held.map((right) => (
                      <button
                        key={right.id}
                        type="button"
                        className={shared.cellButton}
                        data-right={right.capability}
                        data-armed={rights.armedId === right.id ? "1" : undefined}
                        onKeyDown={ignoreKeyRepeat}
                        onClick={() => rights.onRevoke(right)}
                      >
                        {rights.armedId === right.id ? t("org.members.revoke_confirm") : right.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={shared.quiet}>{rights.held.map((right) => right.label).join(", ")}</p>
                )
              ) : (
                <p className={shared.quiet}>{t("org.members.rights_none")}</p>
              )}
            </div>
            {rights.grantable.length ? (
              <div className={shared.group}>
                <p className={shared.groupTitle}>{t("org.members.rights_grant")}</p>
                <div className={shared.cells}>
                  {rights.grantable.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={shared.cellButton}
                      data-grant={option.value}
                      data-armed={rights.armedGrant === option.value ? "1" : undefined}
                      onKeyDown={ignoreKeyRepeat}
                      onClick={() => rights.onGrant(option.value)}
                    >
                      {rights.armedGrant === option.value ? t("org.members.grant_confirm") : option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}
