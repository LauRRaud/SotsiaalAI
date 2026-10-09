"use client";

/**
 * Koostamisruumi seadistuse vaated: millest koostatakse, mida koostatakse,
 * kuidas ja juhis.
 *
 * MIKS. Ruum oli üks pikk pind: valitud failid, väljundi seaded, heli rada,
 * vestlus ja tulemuse toimeti seisid korraga ees ja iga asja juurde tuli
 * kerida. Nüüd on igal asjal oma vaade sammulaval (`components/stage`):
 *
 *  - `SourcesView`      lähtefailid (spetsialistil teed failide ja heli juurde,
 *                       pöördujal faili lisamine ja eemaldamine)
 *  - `ChoiceView`       üks valik: väljundi tüüp või pöörduja ülesanne
 *  - `TemplateView`     mall (valikuline)
 *  - `StyleView`        kellele, toon, keel ja pikkus
 *  - `InstructionView`  juhis ja nupp, mis koostab teksti
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../AgentModePage.jsx,
 * read ja reeglid failis ./draftingModel.js.
 *
 * Kujundus: drafting.module.css (siin kõrval).
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { Chip, Notices, PromptPanel } from "./DraftingBits";
import styles from "./drafting.module.css";

/**
 * Lähtefailid. Rida on madal: pealkiri, liik, faili nimi ja üks-kaks vaikset
 * tegevust. Spetsialisti failivalik käib lehel Dokumendid; siin on teed sinna
 * ja heli rajale (`cards`). Pöörduja lisab faili siinsamas (`upload`) ja saab
 * selle töö juurest eemaldada (rea `onRemove`).
 */
export function SourcesView({ t, title, lead, notice, loading, problems, rows, emptyText, upload, cards, cardsLabel, note, glow }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        upload ? (
          <Button type="button" size="sm" variant="primary" glow={glow} disabled={upload.disabled} onClick={upload.onPick}>
            {upload.label}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {problems.map((problem) => (
          <p key={problem.key} className={styles.notice} data-tone="risk" role="alert">
            {problem.text}
          </p>
        ))}
        {upload ? (
          /* Failivalija ise on peidus; seda avab jalarea nupp. Väli tühjendatakse
             kohe pärast lugemist, et sama faili saaks uuesti valida. */
          <input
            ref={upload.inputRef}
            className="sr-only"
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            accept={upload.accept}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              event.target.value = "";
              upload.onFile(file);
            }}
          />
        ) : null}
        {loading ? (
          <p className={styles.quiet}>{t("documents.loading")}</p>
        ) : rows.length === 0 ? (
          <p className={styles.quiet}>{emptyText}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.key} className={styles.fileRow}>
                <span className={styles.rowTitle}>{row.title}</span>
                <span className={styles.rowMeta}>
                  {row.chips.map((chip) => (
                    <Chip key={chip} tone="quiet">
                      {chip}
                    </Chip>
                  ))}
                  <span className={styles.time}>{row.meta}</span>
                </span>
                <span className={styles.rowActions}>
                  <a className={styles.textLink} href={row.download}>
                    {t("documents.actions.download")}
                  </a>
                  {row.onRemove ? (
                    <button type="button" className={styles.textButton} onClick={row.onRemove}>
                      {t("documents.drafting.files.remove")}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {cards?.length ? (
          <ActionCardGrid label={cardsLabel}>
            {cards.map((card) => (
              <ActionCard key={card.key} title={card.title} description={card.description} onClick={card.onClick} />
            ))}
          </ActionCardGrid>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Üks valik ühelaiuste lahtritena: väljundi tüüp (spetsialist) või ülesanne (pöörduja). Küsimus on paneeli ülaservas. */
export function ChoiceView({ t, title, question, notice, options, value, onChange, note }) {
  return (
    <StepPanel title={title} question={question} note={note}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <ChoiceRow label={question} labelHidden columns={Math.min(options.length, 3)} options={options} value={value} onChange={onChange} />
      </div>
    </StepPanel>
  );
}

/**
 * Mall. Valik on „ilma mallita” ja valitud väljundile sobivad mallid; kui malle
 * ei ole, ütleb vaade, kuhu need lisatakse. Malle võib olla palju: siis kerib
 * kogu paneel, mitte kast paneeli sees.
 */
export function TemplateView({ t, title, lead, notice, loading, error, options, value, onChange, status, link, note }) {
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={note}
      actions={
        link ? (
          <Button type="button" size="sm" variant="secondary" onClick={link.onClick}>
            {link.label}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {error ? (
          <p className={styles.notice} data-tone="risk" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className={styles.quiet}>{t("documents.drafting.template.loading")}</p>
        ) : (
          <ChoiceRow label={title} labelHidden columns={2} options={options} value={value} onChange={onChange} />
        )}
        {status ? <p className={styles.quiet}>{status}</p> : null}
      </div>
    </StepPanel>
  );
}

/**
 * Kellele ja kuidas: neli lühikest valikut üksteise all (silt vasakul, lahtrid
 * paremal), nii et veerud on kohakuti nagu tabelis.
 */
export function StyleView({ t, title, notice, rows, note }) {
  return (
    <StepPanel title={title} note={note}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <div className={styles.scales}>
          {rows.map((row) => (
            <ChoiceRow key={row.key} layout="scale" label={row.label} options={row.options} value={row.value} onChange={row.onChange} />
          ))}
        </div>
      </div>
    </StepPanel>
  );
}

/** Juhis: mida valitud failide põhjal koostada, ja nupp, mis koostab teksti. */
export function InstructionView({ t, title, lead, notice, prompt, glow }) {
  return <PromptPanel t={t} title={title} lead={lead} notice={notice} prompt={prompt} glow={glow} />;
}
