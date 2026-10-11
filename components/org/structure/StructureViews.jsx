"use client";

/**
 * Struktuuri osa vaated.
 *
 * MIKS. Leht oli kast üksuste loendiga (alamüksus seisis teiste osakondade
 * järel, mitte oma osakonna all; arhiveerimine ühe vajutusega) ja selle all
 * kolme täislaia väljaga vorm. Nüüd on korraga ees üks asi:
 *  - `StructureBoard`  üksused puuna madalate ridadena, rea kõrval arhiveerimine
 *                      (küsib teist vajutust); paremal „Lisa üksus"
 *  - `UnitForm`        uus üksus: nimi, liik ühelaiuste lahtritena ja kuhu ta kuulub
 *
 * Siin on ainult kuju. Otsused on failis ./structureRules.js; olek ja päringud
 * lehel (`../OrgStructureClient.jsx`). Kujundus: structure.module.css ja
 * organisatsioonide lehtede ühine ../org.module.css.
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ArmedButton, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import styles from "./structure.module.css";
import { UNIT_NAME_LIMIT } from "./structureRules";

/**
 * Üksuste puu. Üksust ei avata (lugeda ei ole rohkem kui real).
 *
 * `add`: { onAdd } või null (ilma liikmete halduse õiguseta või kirjutuskaitstud)
 * `archive`: { armedId, busyId, onPress(row), onCancel() } või null
 */
export function StructureBoard({ t, rows, add, archive, notice, glow = true }) {
  const start = add ? (
    <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={add.onAdd}>
      {t("org.structure.add")}
    </Button>
  ) : null;
  if (!rows.length) {
    return <StepPanel title={t("org.structure.heading")} lead={t("org.structure.empty")} note={footNote(notice, t("org.structure.intro"))} actions={start} />;
  }
  return (
    <StepPanel title={t("org.structure.heading")} note={footNote(notice, t("org.structure.intro"))}>
      <div className={shared.stack}>
        {start ? (
          <div className={shared.headBar}>
            <span />
            {start}
          </div>
        ) : null}
        <ul className={shared.rows} aria-label={t("org.structure.heading")}>
          {rows.map((row) => {
            const armed = archive?.armedId === row.id;
            const busy = archive?.busyId === row.id;
            return (
              <li key={row.id} className={shared.item} data-armed={armed ? "1" : undefined} data-unit={row.id} aria-busy={busy ? "true" : undefined}>
                <div className={styles.unit} data-depth={row.depth}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                  </span>
                  {row.kind ? (
                    <span className={shared.rowMeta}>
                      <span className={shared.chip}>{row.kind}</span>
                    </span>
                  ) : null}
                </div>
                {archive ? (
                  <span className={shared.itemAside}>
                    <Button
                      {...SMALL}
                      className={armed ? shared.armed : shared.aside}
                      data-archive={row.id}
                      aria-label={armed ? undefined : t("org.structure.archive_named", { name: row.title })}
                      onKeyDown={ignoreKeyRepeat}
                      onClick={() => archive.onPress(row)}
                    >
                      {armed ? t("org.structure.archive_confirm") : t("org.structure.archive")}
                    </Button>
                    {armed ? (
                      <Button {...SMALL} onClick={archive.onCancel}>
                        {t("org.invites.keep")}
                      </Button>
                    ) : null}
                  </span>
                ) : null}
                {armed ? <p className={shared.itemNote}>{t("org.structure.archive_note")}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </StepPanel>
  );
}

/**
 * Uus üksus. Nimi on kohustuslik; liik ja kuuluvus on vaikevalikuga.
 *
 * `decline`: { armed, onPress }, `save`: { busy, onSave }
 */
export function UnitForm({ t, form, onField, types, parents, fieldRef, notice, decline, save, glow = true }) {
  return (
    <StepPanel
      title={t("org.structure.add")}
      note={footNote(decline.armed ? { text: t("org.structure.decline_note") } : notice, t("org.structure.maxDepthHint"))}
      actions={
        <>
          <ArmedButton armed={decline.armed} label={t("org.home.create.decline.label")} confirm={t("org.home.create.decline.confirm")} onPress={decline.onPress} mark="decline" />
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
            {save.busy ? t("org.structure.adding") : t("org.structure.add")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined}>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.structure.name")}</span>
          <Input
            ref={fieldRef}
            className={shared.input}
            value={form.name}
            maxLength={UNIT_NAME_LIMIT}
            autoComplete="off"
            onChange={(event) => onField("name", event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
              event.preventDefault();
              save.onSave();
            }}
          />
        </label>
        <ChoiceRow label={t("org.structure.type")} options={types} value={form.type} onChange={(value) => onField("type", value)} columns={4} keepColumns />
        <PickOne label={t("org.structure.parent")} options={parents} value={form.parentUnitId} onChange={(value) => onField("parentUnitId", value)} />
      </div>
    </StepPanel>
  );
}
