"use client";

/**
 * „Minu kirjed" vaated: kirjete loend, avatud kirje, järgmine samm, kirje
 * mustandid ja pooleli jäänud tekstid.
 *
 * MIKS. Leht oli üks pikk veerg: mustandid, filtrid, kirjete loend ja loendi
 * rea SEES avanev detail (tegurid, soovitused, kontrollpunkti vorm, mustandid,
 * kustutamine) täislaiuses lahtrite ja täpiloenditega. Nüüd on igal asjal oma
 * vaade sammulaval (`components/stage`), nagu töövormidel.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MyRecordsWorkflow.jsx; vaade saab valmis read ja tegevused.
 *
 * Kujundus: records.module.css (siin kõrval).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./records.module.css";

function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

function Notice({ text, tone }) {
  if (!text) return null;
  /* `aria-live`, mitte role="status": ühine lehekiht joonistab iga
     status-rolliga elemendi teatekastina. */
  return (
    <p className={styles.notice} data-tone={tone} aria-live="polite">
      {text}
    </p>
  );
}

/** Kirjete loend: kaks filtrit ja read. Rida avab kirje. */
export function RecordsListView({ t, workflow, period, status, rows, more, notice }) {
  return (
    <StepPanel
      title={t("wellbeing.my_records.views.list.title", "Kirjed")}
      lead={t("wellbeing.my_records.views.list.lead", "Ainult sina näed neid kirjeid. Kustutamine eemaldab kirje ka anonüümsest koondist.")}
    >
      <div className={styles.stack}>
        <div className={styles.filters}>
          {workflow.options.length > 2 ? (
            <ChoiceRow
              label={t("wellbeing.my_records.filter_workflow_label", "Töövoog")}
              labelHidden
              columns={Math.min(workflow.options.length, 4)}
              options={workflow.options}
              value={workflow.value}
              onChange={workflow.onChange}
            />
          ) : null}
          <ChoiceRow
            label={t("wellbeing.my_records.filter_period_label", "Periood")}
            labelHidden
            columns={period.options.length}
            options={period.options}
            value={period.value}
            onChange={period.onChange}
          />
        </div>
        <Notice text={notice?.text} tone={notice?.tone} />
        {status === "loading" ? (
          <p className={styles.quiet}>{t("wellbeing.my_records.loading", "Laadin…")}</p>
        ) : status === "error" ? (
          <Notice text={t("wellbeing.my_records.load_failed", "Kirjete laadimine ebaõnnestus.")} tone="risk" />
        ) : rows.length === 0 ? (
          <p className={styles.quiet}>{t("wellbeing.my_records.records_empty", "Selle filtriga kirjeid ei ole veel.")}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className={styles.row} data-selected={row.selected ? "true" : undefined} onClick={row.onOpen}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>
                    <Chip tone={row.tone}>{row.signal}</Chip>
                    {row.badge ? <Chip tone="wait">{row.badge}</Chip> : null}
                    <span className={styles.time}>{row.date}</span>
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {t("wellbeing.my_records.views.open", "Ava")} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} onClick={more.onClick} disabled={more.busy}>
            {t("wellbeing.my_records.load_more", "Laadi veel")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Avatud kirje: mis see on, mis signaali andis ja mis tegurid sellest välja tulid. */
export function RecordView({ t, loading, failed, heading, signal, links, groups, actions, note }) {
  if (loading || failed) {
    return (
      <StepPanel title={t("wellbeing.my_records.views.record.title", "Kirje")}>
        {loading ? <p className={styles.quiet}>{t("wellbeing.my_records.loading", "Laadin…")}</p> : <Notice text={t("wellbeing.my_records.detail_failed", "Kirje avamine ebaõnnestus.")} tone="risk" />}
      </StepPanel>
    );
  }
  return (
    <StepPanel title={t("wellbeing.my_records.views.record.title", "Kirje")} question={heading} note={note} actions={actions}>
      <div className={styles.stack}>
        <p className={styles.line}>
          <Chip tone={signal.tone}>{signal.text}</Chip>
          {links.map((link) => (
            <span key={link.key} className={styles.linkLine}>
              {link.text}
              <button type="button" className={styles.textButton} onClick={link.onClick}>
                {link.action}
              </button>
            </span>
          ))}
        </p>
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <h4 className={styles.groupTitle}>{group.title}</h4>
              {group.items.length ? (
                <ul className={styles.tags}>
                  {group.items.map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.quiet}>{group.empty}</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </StepPanel>
  );
}

/** Järgmine samm: soovitused sellest kirjest ja minu enda kokkulepe kontrollkuupäevaga. */
export function NextStepView({ t, recommended, recBusy, plan, form, failed }) {
  const formFields = (
    <form
      className={styles.planForm}
      onSubmit={(event) => {
        event.preventDefault();
        form.onSave();
      }}
    >
      <label className={styles.field} data-size="lg">
        <span className={styles.fieldLabel}>{t("wellbeing.checkpoint.next_step_label", "Järgmine samm")}</span>
        <Input type="text" value={form.step} maxLength={500} onChange={(event) => form.onStep(event.target.value)} />
      </label>
      <label className={styles.field} data-size="sm">
        <span className={styles.fieldLabel}>{t("wellbeing.checkpoint.due_label", "Kontrollkuupäev")}</span>
        <Input type="date" value={form.due} onChange={(event) => form.onDue(event.target.value)} />
      </label>
      <Button type="submit" size="sm" variant="primary" className={styles.planSave} disabled={form.disabled}>
        {t("wellbeing.checkpoint.save", "Salvesta kontrollpunkt")}
      </Button>
    </form>
  );
  return (
    <StepPanel
      title={t("wellbeing.checkpoint.title", "Järgmine samm ja kontrollkuupäev")}
      lead={t("wellbeing.checkpoint.description", "Pane kirja, mida kavatsed teha, ja millal tahad seda üle vaadata. See jääb ainult sinule.")}
    >
      <div className={styles.stack}>
        {failed ? <Notice text={t("wellbeing.errors.checkpoint_failed", "Kontrollpunkti salvestamine ebaõnnestus.")} tone="risk" /> : null}
        {plan ? (
          <section className={styles.plan}>
            <p className={styles.planStep}>{plan.step}</p>
            <p className={styles.line}>
              <Chip tone={plan.needsFollowUp ? "wait" : "quiet"}>{plan.due}</Chip>
              {plan.answer ? <Chip tone="ok">{plan.answer}</Chip> : null}
            </p>
            {plan.needsFollowUp ? (
              <div className={styles.ask} role="group" aria-label={t("wellbeing.checkpoint.ask", "Kas said selle sammu tehtud?")}>
                <span className={styles.fieldLabel}>{t("wellbeing.checkpoint.ask", "Kas said selle sammu tehtud?")}</span>
                <span className={styles.buttons}>
                  {plan.answers.map((answer) => (
                    <Button key={answer.key} type="button" size="sm" variant="secondary" disabled={plan.busy} onClick={answer.onClick}>
                      {answer.label}
                    </Button>
                  ))}
                </span>
              </div>
            ) : null}
            <details className={styles.fold}>
              <summary className={styles.foldTitle}>{t("wellbeing.my_records.views.next.change", "Muuda kokkulepet")}</summary>
              <div className={styles.foldBody}>
                {formFields}
                <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={plan.busy} onClick={plan.onClear}>
                  {t("wellbeing.checkpoint.clear", "Eemalda kontrollpunkt")}
                </Button>
              </div>
            </details>
          </section>
        ) : (
          formFields
        )}
        <section className={styles.section}>
          <h4 className={styles.groupTitle}>{t("wellbeing.my_records.recommended", "Soovitatud järgmised sammud")}</h4>
          {recommended.length ? (
            <ul className={styles.rows}>
              {recommended.map((item) => (
                <li key={item.key} className={styles.advice} data-done={item.done ? "true" : undefined}>
                  <span className={styles.adviceText}>
                    <span className={styles.rowTitle}>{item.label}</span>
                    {item.reason ? <span className={styles.adviceReason}>{item.reason}</span> : null}
                  </span>
                  {item.onToggle ? (
                    <Button type="button" size="sm" variant="secondary" aria-pressed={item.done} disabled={recBusy} onClick={item.onToggle}>
                      {item.done ? t("wellbeing.correction.recommendation_undo", "Võta märge tagasi") : t("wellbeing.correction.recommendation_done", "Tehtud")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.quiet}>{t("wellbeing.my_records.no_recommended", "Eraldi soovitusi ei tekkinud.")}</p>
          )}
        </section>
      </div>
    </StepPanel>
  );
}

/** Selle kirjega seotud mustandid ja nende üleandmine kovisiooni. */
export function RecordDraftsView({ t, drafts, handoffs }) {
  return (
    <StepPanel title={t("wellbeing.my_records.related_drafts", "Seotud mustandid")}>
      <div className={styles.stack}>
        {drafts.length ? (
          <ul className={styles.rows}>
            {drafts.map((draft) => (
              <li key={draft.id} className={styles.advice}>
                <span className={styles.rowTitle}>{draft.title}</span>
                <span className={styles.rowMeta}>
                  <Chip tone="quiet">{draft.status}</Chip>
                  <span className={styles.time}>{draft.date}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{t("wellbeing.my_records.no_related_drafts", "Selle kirjega ei ole seotud mustandeid.")}</p>
        )}
        {handoffs.length ? (
          <section className={styles.section}>
            <h4 className={styles.groupTitle}>{t("wellbeing.my_records.handoff_history", "Üleandmise ajalugu")}</h4>
            <ul className={styles.rows}>
              {handoffs.map((item) => (
                <li key={item.id}>
                  {item.onOpen ? (
                    <button type="button" className={styles.row} onClick={item.onOpen}>
                      <span className={styles.rowTitle}>{item.text}</span>
                      <span className={styles.rowMeta}>
                        <span className={styles.time}>{item.date}</span>
                      </span>
                      <span className={styles.rowOpen} aria-hidden="true">
                        {t("wellbeing.my_records.views.open", "Ava")} ›
                      </span>
                    </button>
                  ) : (
                    <span className={styles.advice}>
                      <span className={styles.rowTitle}>{item.text}</span>
                      <span className={styles.time}>{item.date}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Pooleli jäänud tekstid: kinnitamata mustandid, mida saab avada või kustutada. */
export function UnfinishedView({ t, loading, rows, more, notice }) {
  return (
    <StepPanel title={t("wellbeing.my_records.drafts_heading", "Pooleli jäänud mustandid")}>
      <div className={styles.stack}>
        <Notice text={notice?.text} tone={notice?.tone} />
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.id} className={styles.draft} data-selected={row.current ? "true" : undefined}>
                <div className={styles.draftHead}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.time}>{row.date}</span>
                </div>
                {row.text ? <p className={styles.draftText}>{row.text}</p> : null}
                <div className={styles.buttons}>
                  <Button type="button" size="sm" variant="primary" disabled={row.busy} onClick={row.onOpen}>
                    {t("wellbeing.my_records.open_draft", "Ava mustand")}
                  </Button>
                  {row.onOpenRecord ? (
                    <Button type="button" size="sm" variant="secondary" onClick={row.onOpenRecord}>
                      {t("wellbeing.my_records.open_related_record", "Ava seotud kirje")}
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="secondary" disabled={row.busy} onClick={row.onDelete}>
                    {row.deleteLabel}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{loading ? t("wellbeing.my_records.loading", "Laadin…") : t("wellbeing.my_records.drafts_empty", "Pooleli jäänud mustandeid ei ole.")}</p>
        )}
        {more ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} onClick={more.onClick} disabled={more.busy}>
            {t("wellbeing.my_records.load_more", "Laadi veel")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}
