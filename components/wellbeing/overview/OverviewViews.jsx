"use client";

/**
 * Tööheaolu „Ülevaade" vaated: kokkuvõte, mustrid, memo juhile ja järgmised töövood.
 *
 * MIKS. Leht oli üks pikk veerg vanal ühisel kihil: seisu rida, perioodi nupud,
 * viis täpiloendit, memo eelvaade ja selle all sama memo tekstikastis, kaks
 * märkeruutu, nupud ja lõpus soovitatud töövood sisemiste nimedega
 * („hard-case"). Nüüd on igal asjal oma vaade sammulaval (`components/stage`).
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../OverviewWorkflow.jsx.
 *
 * Kujundus: ühised tööheaolu loendi- ja sildistiilid (../records/records.module.css)
 * ning selle lehe oma (overview.module.css).
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";

import shared from "../records/records.module.css";
import styles from "./overview.module.css";

/** Kokkuvõte: periood, perioodi signaal ja mille põhjal see on. */
export function SummaryView({ t, period, loading, failed, signal, counts, truncated, workflows }) {
  return (
    <StepPanel
      title={t("wellbeing.overview.views.summary.title", "Kokkuvõte")}
      lead={t("wellbeing.overview.views.summary.lead", "Sinu enda tööheaolu sisestused ühe pilguga. Seda näed ainult sina.")}
    >
      <div className={shared.stack}>
        <ChoiceRow
          label={t("wellbeing.overview.period_label", "Periood")}
          labelHidden
          columns={period.options.length}
          options={period.options}
          value={period.value}
          onChange={period.onChange}
        />
        {failed ? (
          <p className={shared.notice} data-tone="risk" role="alert">
            {t("wellbeing.overview.load_failed", "Ülevaate laadimine ebaõnnestus.")}
          </p>
        ) : loading ? (
          <p className={shared.quiet}>{t("wellbeing.overview.loading", "Laadin...")}</p>
        ) : (
          <>
            <p className={shared.line}>
              <span className={shared.chip} data-tone={signal.tone}>
                {signal.text}
              </span>
              {counts.map((item) => (
                <span key={item.key} className={styles.count}>
                  {item.label} <strong>{item.value}</strong>
                </span>
              ))}
            </p>
            {truncated ? <p className={shared.notice}>{truncated}</p> : null}
            <section className={shared.group}>
              <h4 className={shared.groupTitle}>{t("wellbeing.overview.workflow_counts", "Töövood")}</h4>
              {workflows.length ? (
                <ul className={shared.tags}>
                  {workflows.map((item) => (
                    <li key={item.key}>
                      {item.label} <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={shared.quiet}>{t("wellbeing.overview.no_workflows", "Töövoo kirjeid ei ole veel.")}</p>
              )}
            </section>
          </>
        )}
      </div>
    </StepPanel>
  );
}

/** Mustrid: signaalide jaotus ja mis kordub (nõudmised, ressursid, riskid). */
export function PatternsView({ t, signals, groups }) {
  return (
    <StepPanel title={t("wellbeing.overview.patterns", "Mustrid")}>
      <div className={shared.groups}>
        <section className={shared.group}>
          <h4 className={shared.groupTitle}>{t("wellbeing.overview.signals", "Signaalid")}</h4>
          <p className={shared.line}>
            {signals.map((item) => (
              <span key={item.key} className={shared.chip} data-tone={item.tone}>
                {item.label} {item.count}
              </span>
            ))}
          </p>
        </section>
        {groups.map((group) => (
          <section key={group.key} className={shared.group}>
            <h4 className={shared.groupTitle}>{group.title}</h4>
            {group.items.length ? (
              <ul className={shared.tags}>
                {group.items.map((item) => (
                  <li key={item.key}>
                    {item.label} <strong>{item.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={shared.quiet}>{group.empty}</p>
            )}
          </section>
        ))}
      </div>
    </StepPanel>
  );
}

/** Memo juhile: koondatud tekst, mida saab muuta, üle vaadata ja kinnitada. Midagi ei saadeta ise. */
export function MemoView({ t, badge, text, onText, empty, reviewed, onReviewed, confirmed, onConfirmed, status, save, confirm }) {
  return (
    <StepPanel
      title={t("wellbeing.overview.manager_memo", "Juhiga jagatav memo")}
      lead={t("wellbeing.overview.views.memo.lead", "Koondatud tekst juhiga aruteluks. Seda ei saadeta automaatselt: sina otsustad, kas ja kuidas seda kasutad.")}
      note={status}
      actions={
        empty ? null : (
          <>
            <Button type="button" variant="secondary" disabled={save.disabled} onClick={save.onClick}>
              {t("wellbeing.overview.save_memo_draft", "Salvesta memo mustand")}
            </Button>
            <Button type="button" variant="primary" disabled={confirm.disabled} onClick={confirm.onClick}>
              {t("wellbeing.overview.confirm_memo_draft", "Kinnita jagatav memo")}
            </Button>
          </>
        )
      }
    >
      {empty ? (
        <p className={shared.quiet}>{t("wellbeing.overview.no_manager_memo", "Memo tekib siis, kui tööheaolu kirjeid on olemas.")}</p>
      ) : (
        <div className={styles.memo}>
          <TextAreaField label={t("wellbeing.overview.memo_preview_label", "Memo mustand")} labelHidden value={text} onChange={onText} rows={9} maxLength={4000} />
          <div className={styles.checks}>
            {badge}
            <Checkbox checked={reviewed} onChange={onReviewed} label={t("wellbeing.overview.reviewed", "Olen memo üle vaadanud ja liigsed detailid eemaldanud.")} />
            <Checkbox checked={confirmed} onChange={onConfirmed} label={t("wellbeing.overview.confirmed", "Kinnitan, et see versioon sobib juhiga arutelu sisendiks.")} />
          </div>
        </div>
      )}
    </StepPanel>
  );
}

/** Järgmised töövood: kuhu ülevaate põhjal edasi minna. */
export function NextWorkflowsView({ t, items }) {
  return (
    <StepPanel title={t("wellbeing.overview.next_steps", "Soovitatud järgmised töövood")}>
      {items.length ? (
        <ActionCardGrid label={t("wellbeing.overview.next_steps", "Soovitatud järgmised töövood")}>
          {items.map((item) => (
            <ActionCard key={item.key} title={item.title} description={item.description} onClick={item.onClick} />
          ))}
        </ActionCardGrid>
      ) : (
        <p className={shared.quiet}>{t("wellbeing.overview.no_actions", "Salvesta mõned kiirkontrollid, et soovitused tekiksid sinu andmete põhjal.")}</p>
      )}
    </StepPanel>
  );
}
