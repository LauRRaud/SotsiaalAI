"use client";

/**
 * Dokumentide lehe vaated: sisenemine, faili lisamine, loend, avatud dokument
 * ja tööalase kasutuse raamistik.
 *
 * MIKS. Leht oli üks pikk veerg: küsimus koos kaartidega, sama pinna sees avanev
 * üleslaadimise vorm ja kohe selle all kogu loend, kus iga rida kandis viit
 * päritolu lahtrit, märkeruutu ja kuni viit nuppu. Kõik see seisis klaaspaneeli
 * sees veel kahes tumedas kastis. Nüüd on igal asjal oma vaade sammulaval
 * (`components/stage`):
 *  - `EntryView`      mida soovid teha: tegevused kaartidena
 *  - `AddFileView`    faili lisamine: faili andmed ühes rühmas, faili valik teises
 *  - `ListView`       loend: otsing ja tüübifilter, madalad read, üks tegevus „Ava”
 *  - `ItemView`       avatud dokument: faktid, ümbernimetamine, töörežiimi luba,
 *                     analüüsi tekst ja kõik tegevused, mis varem tegid rea kõrgeks
 *  - `FrameworkView`  tööalase kasutuse raamistik ja kinnituse kirje
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis ../DocumentsPage.jsx;
 * read ja reeglid failis ./documentRows.js.
 *
 * Kujundus: documents.module.css (siin kõrval).
 */

import { useEffect, useId, useRef } from "react";

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";

import styles from "./documents.module.css";

/** Märk: tüüp või seis ühe sõnaga. Sama märk on detaililehtedel (../detail). */
export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * Lehe teated selle vaate sees, mis on parajasti ees. Õnnestumise teade kaob
 * ise (leht võtab selle mõne sekundi pärast maha) või nupust; viga jääb ette.
 */
function Notices({ t, notice }) {
  if (!notice?.ok && !notice?.error) return null;
  return (
    <div className={styles.notices}>
      {notice.ok ? (
        /* `aria-live`, mitte status-roll: ühine lehekiht joonistab iga
           status-rolliga elemendi omaette teatekastina. */
        <p className={styles.notice} data-tone="ok" aria-live="polite">
          <span>{notice.ok}</span>
          <button type="button" className={styles.textButton} onClick={notice.onClose}>
            {t("common.close")}
          </button>
        </p>
      ) : null}
      {notice.error ? (
        <p className={styles.notice} data-tone="risk" role="alert">
          {notice.error}
        </p>
      ) : null}
    </div>
  );
}

/** Tegevusrea nupud kirjeldusest: `href` teeb lingi (allalaadimine, teine leht), muidu nupp. Sama rida on detaililehtedel (../detail). */
export function ActionButtons({ actions }) {
  return actions.map((action) =>
    action.href ? (
      <Button key={action.key} as="a" href={action.href} size="sm" variant={action.variant || "secondary"} disabled={action.disabled}>
        {action.label}
      </Button>
    ) : (
      <Button key={action.key} type="button" size="sm" variant={action.variant || "secondary"} disabled={action.disabled} onClick={action.onClick}>
        {action.label}
      </Button>
    )
  );
}

/** Sisenemine: mida soovid teha. Iga tegevus on kaart pealkirja ja selgitusega. */
export function EntryView({ t, notice, cards }) {
  return (
    <StepPanel title={t("documents.views.entry.title")} question={t("documents.workspace.entry_title")}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <ActionCardGrid label={t("documents.views.entry.title")}>
          {cards.map((card) => (
            <ActionCard key={card.key} title={card.title} description={card.description} onClick={card.onClick} />
          ))}
        </ActionCardGrid>
      </div>
    </StepPanel>
  );
}

/**
 * Faili lisamine. Kaks väikest rühma üksteise all: mis fail see on (pealkiri,
 * liik ja malli puhul selle otstarve) ning faili valik. Kukutusala kannab
 * ainult juhist; lubatud failitüübid on vaikne abirida selle kõrval ja valitud
 * fail (nimi ja suurus) on omal real (kujundusaudit K07).
 *
 * MAHUB PANEELI KA MALLI PUHUL. Liigi „Mall” korral tuleb juurde otstarbe rida
 * (kuus lahtrit kahes reas) ja vaade oli paneelist kõrgem (brauseris mõõdetud
 * 535 px 522 px paneelis). Kolm asja teevad selle madalamaks:
 *  - otstarbe küsimus seisab laial pinnal lahtrite KÕRVAL vasakul, mitte nende
 *    kohal omaette real (`.purpose`; kitsal pinnal läheb küsimus lahtrite kohale);
 *  - kitsas töölaua paneelis (34 kuni 40 rem) hoiavad liik ja otstarve oma
 *    veergude arvu (`keepColumns`): liik on ühel ja otstarve kahel real, mitte
 *    kahel ja kolmel. Telefonis jääb kaks veergu;
 *  - valitud faili rida on madalam (kujundusfailis).
 *
 * MALLI JALARIDA ütleb, mis on tõsi: kinnitatud faili kuju annab ainult Wordi
 * mall, ja kust kohatäitjad teada saab. PDF- ja TXT-faili saab endiselt malliks
 * lisada. Lause on jalareal nupu kõrval: seal ei tee see vaadet kõrgemaks.
 */
export function AddFileView({ t, notice, form }) {
  const inputRef = useRef(null);
  const helpId = useId();
  const hasFile = Boolean(form.file);
  /* Kui fail võetakse ära (eemaldati või laaditi üles), tühjendatakse ka
     peidetud failivalija: muidu ei teataks brauser muutusest, kui inimene
     valib sama faili uuesti. */
  useEffect(() => {
    if (!hasFile && inputRef.current) inputRef.current.value = "";
  }, [hasFile]);
  /* Lohistatud fail ei käi failivalija kaudu: valija jääb tühjaks. */
  const pick = (file) => {
    if (inputRef.current) inputRef.current.value = "";
    form.onFile(file);
  };
  return (
    <Form className={styles.form} onSubmit={form.onSubmit}>
      <StepPanel
        title={t("documents.views.add.title")}
        note={form.templateFor ? t("documents.form.template_help") : undefined}
        actions={
          <Button type="submit" disabled={!form.file || form.busy}>
            {form.busy ? t("documents.form.uploading") : t("documents.actions.upload")}
          </Button>
        }
      >
        <div className={styles.stack}>
          <Notices t={t} notice={notice} />
          <div className={styles.about} role="group" aria-label={t("documents.views.add.about")}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("documents.form.title_placeholder")}</span>
              <Input value={form.title} onChange={(event) => form.onTitle(event.target.value)} autoComplete="off" />
            </label>
            <div className={styles.choice}>
              <ChoiceRow
                label={t("documents.form.kind_label")}
                columns={form.kinds.length}
                keepColumns
                options={form.kinds}
                value={form.kind}
                onChange={form.onKind}
              />
            </div>
            {form.templateFor ? (
              <div className={styles.purpose}>
                {/* Nähtav küsimus on lahtrite kõrval; valikurühma enda silt on
                    sama tekst ekraanilugejale, seepärast ei loeta nähtavat teist korda. */}
                <span className={styles.purposeLabel} aria-hidden="true">
                  {t("documents.form.template_for_placeholder")}
                </span>
                <div className={styles.choice}>
                  <ChoiceRow
                    label={t("documents.form.template_for_placeholder")}
                    labelHidden
                    columns={3}
                    keepColumns
                    options={form.templateFor.options}
                    value={form.templateFor.value}
                    onChange={form.templateFor.onChange}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div
            className={styles.pick}
            role="group"
            aria-label={t("documents.views.add.choice")}
            onDragOver={(event) => {
              event.preventDefault();
              form.onDrag(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              form.onDrag(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains?.(event.relatedTarget)) form.onDrag(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              pick(event.dataTransfer?.files?.[0] || null);
            }}
          >
            {/* Failivalija ise on peidus; seda avab kukutusala nupp. */}
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              accept={form.accept}
              onChange={(event) => {
                form.onFile(event.target.files?.[0] || null);
                /* Väli tühjendatakse pärast lugemist: muidu jääks keeldutud
                   (liiga suur) fail peidetud välja sisse ja sama faili uuesti
                   valimine ei annaks muutuse sündmust. */
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.dropzone}
              data-drag-active={form.dragActive ? "true" : undefined}
              aria-describedby={helpId}
              onClick={() => inputRef.current?.click()}
            >
              {form.dragActive ? t("documents.form.dropzone_active") : t("documents.form.dropzone_idle")}
            </button>
            <div className={styles.pickInfo}>
              <p className={styles.help} id={helpId}>
                {t("documents.form.file_help")}
              </p>
              <div className={styles.fileRow} aria-live="polite">
                {form.file ? (
                  <>
                    <span className={styles.fileName}>{form.file.name}</span>
                    <span className={styles.time}>{form.file.size}</span>
                    <button type="button" className={styles.textButton} onClick={() => pick(null)}>
                      {t("documents.views.add.remove_file")}
                    </button>
                  </>
                ) : (
                  <span>{t("documents.form.no_file_selected")}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </StepPanel>
    </Form>
  );
}

/**
 * Loend: otsing ja tüübifilter ühelaiuste lahtritena, selle all read. Rida on
 * nii madal kui võimalik: pealkiri, märgid ja aeg ning üks tegevus (ava). Kõik
 * muu on avatud dokumendi vaates. Loend võib olla pikk: siis kerib kogu paneel,
 * mitte kast paneeli sees.
 */
export function ListView({ t, title, lead, notice, search, filter, error, loading, rows, emptyText, more }) {
  return (
    <StepPanel title={title} lead={lead}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {search || filter ? (
          <div className={styles.tools}>
            {search ? (
              /* Otsing ei ole andmete esitamine: vormi oma kontrolli siin ei ole. */
              <Form className={styles.search} role="search" validate={false} onSubmit={search.onSubmit}>
                <Input
                  type="search"
                  className={styles.searchInput}
                  value={search.value}
                  onChange={(event) => search.onChange(event.target.value)}
                  placeholder={t("documents.views.list.search_placeholder")}
                  aria-label={t("documents.views.list.search_placeholder")}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {t("documents.workspace.search")}
                </Button>
              </Form>
            ) : null}
            {filter ? (
              <div className={styles.filter}>
                <ChoiceRow
                  label={t("documents.workspace.filter_label")}
                  labelHidden
                  columns={3}
                  options={filter.options}
                  value={filter.value}
                  onChange={filter.onChange}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className={styles.notice} data-tone="risk" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className={styles.quiet}>{t("documents.loading")}</p>
        ) : rows.length === 0 ? (
          <p className={styles.quiet}>{emptyText}</p>
        ) : (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.key} className={styles.rowItem}>
                <button type="button" className={styles.row} onClick={row.onOpen}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>
                    {row.type ? <Chip tone={row.tone}>{row.type}</Chip> : null}
                    {row.chips.map((chip) => (
                      <Chip key={chip.key} tone={chip.tone}>
                        {chip.text}
                      </Chip>
                    ))}
                    <span className={styles.time}>{row.date}</span>
                  </span>
                  <span className={styles.rowOpen} aria-hidden="true">
                    {t("documents.actions.open")} ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <div className={styles.more}>
            {more.note ? <p className={styles.quiet}>{more.note}</p> : null}
            <Button type="button" size="sm" variant="secondary" disabled={more.busy} onClick={more.onClick}>
              {more.busy ? t("documents.loading") : t("documents.workspace.load_more")}
            </Button>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Ümbernimetamine avatud dokumendi vaates: väli saab fookuse kohe, kui see avaneb. */
function RenameForm({ t, rename }) {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <Form
      className={styles.rename}
      validate={false}
      onSubmit={(event) => {
        event.preventDefault();
        rename.onSave();
      }}
    >
      {/* Pealkiri seisab kohe välja kohal (vaate küsimusena): silt on ainult ekraanilugejale. */}
      <Input
        ref={inputRef}
        className={styles.renameInput}
        value={rename.value}
        onChange={(event) => rename.onChange(event.target.value)}
        aria-label={t("documents.views.item.rename_label")}
        autoComplete="off"
      />
      {/* Laval hoitakse kõik vaated lehel: läige ainult ees oleval (`rename.glow`). */}
      <Button type="submit" size="sm" variant="primary" glow={rename.glow !== false}>
        {t("buttons.save")}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={rename.onCancel}>
        {t("buttons.cancel")}
      </Button>
    </Form>
  );
}

/**
 * Avatud dokument: mis see on ja mida sellega teha saab. Siin on kõik, mis
 * varem tegi loendi rea kõrgeks: päritolu faktid, ümbernimetamine, töörežiimi
 * luba, analüüsi tekst ja tegevused.
 *
 * `danger` on tegevus, mis küsib teist vajutust (kustutamine, uuringu
 * peatamine). See seisab teistest tegevustest eraldi, vasakul servas: nupp
 * kasvab teise vajutuse sõnadega paremale ja selgitus tuleb selle kõrvale,
 * nii et nupp jääb kursori alla ja miski muu selle kohale ei nihku.
 */
export function ItemView({ t, title = "", notice, sheet, rename, share, analysis, actions, danger }) {
  return (
    /* `title`: detaililehel kannab see osa teist nime („Andmed ja tegevused");
       ekraanilugeja peab kuulma sama nime, mis on kiirmenüüs. */
    <StepPanel title={title || t("documents.views.item.title")} question={sheet.title} actions={<ActionButtons actions={actions} />}>
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <div className={styles.line}>
          {sheet.type ? <Chip tone={sheet.tone}>{sheet.type}</Chip> : null}
          {sheet.chips.map((chip) => (
            <Chip key={chip.key} tone={chip.tone}>
              {chip.text}
            </Chip>
          ))}
          <span className={styles.time}>
            {t("documents.updated_at")} {sheet.date}
          </span>
        </div>
        {sheet.file ? <p className={styles.meta}>{sheet.file}</p> : null}
        {sheet.note ? <p className={styles.quiet}>{sheet.note}</p> : null}
        {rename ? <RenameForm t={t} rename={rename} /> : null}
        {analysis ? (
          <div className={styles.stack} aria-live="polite">
            {analysis.loading ? <p className={styles.quiet}>{t("documents.loading")}</p> : null}
            {analysis.error ? (
              <p className={styles.notice} data-tone="risk" role="alert">
                {analysis.error}
              </p>
            ) : null}
            {analysis.content ? <p className={styles.text}>{analysis.content}</p> : null}
          </div>
        ) : null}
        {sheet.facts.length ? (
          <dl className={styles.facts}>
            {sheet.facts.map((fact) => (
              <div key={fact.key} className={styles.fact}>
                <dt className={styles.factLabel}>{fact.label}</dt>
                <dd className={styles.factValue}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {share ? (
          <div className={styles.share}>
            <CheckCard title={share.title} description={share.description} checked={share.checked} disabled={share.disabled} onChange={share.onChange} />
          </div>
        ) : null}
        {danger ? (
          <div className={styles.confirm}>
            <Button type="button" size="sm" variant={danger.armed ? "danger" : "secondary"} className={styles.confirmButton} onClick={danger.onClick}>
              {danger.label}
            </Button>
            {/* Selgituse koht on alati olemas: ekraanilugeja kuuleb, kui see täitub. */}
            <p className={styles.confirmNote} aria-live="polite">
              {danger.note}
            </p>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Tööalase kasutuse raamistik: kas kinnitus on olemas, ja lingid raamistiku,
 * varasema allkirjastatud faili ja süsteemi loodud kinnituse kirje juurde.
 */
export function FrameworkView({ t, notice, text, confirmed, links }) {
  return (
    <StepPanel
      /* Vaate nime paneelil ei korrata (see on kiirmenüüs): paneel algab
         lausega, mis ütleb, kas kinnitus on olemas. */
      title={t("documents.views.framework.title")}
      lead={text}
      actions={<ActionButtons actions={links} />}
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        {confirmed ? (
          <div className={styles.line}>
            <Chip tone="ok">{t("documents.framework_acceptance.status_confirmed")}</Chip>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}
