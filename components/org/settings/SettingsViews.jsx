"use client";

/**
 * Seadete osa ja andmete väljavõtte vaated.
 *
 * MIKS. Seadete leht oli kolm kasti üksteise all: moodulid siltidena, mille sees
 * olid nupud; seisu nupud, kus aktiveerimise nupul seisis sõna „Aktiivne" ja
 * LÕPLIK arhiveerimine käis ühe vajutusega; ning link väljavõtte lehele.
 * Nüüd on korraga ees üks asi, valik lahtritest üleval:
 *  - `ModulesView`  moodulid ridadena: nimi, kas sees või väljas, lülitamine
 *                   (peatamine küsib teist vajutust)
 *  - `StatusView`   organisatsiooni seis ühe lausega ja selle seisu tegevused
 *                   (peatamine ja arhiveerimine küsivad teist vajutust)
 *  - `ExportLinkView` mis väljavõttes on ja tee väljavõtte lehele
 *  - `ExportView`   väljavõtte leht: mis sees on, mis EI OLE, allalaadimine
 *
 * VÄLJAJÄTUD ON KUVATUD, mitte peidetud: kes organisatsiooni andmed alla laadib,
 * peab nägema ka seda, mida failis ei ole.
 *
 * Siin on ainult kuju. Otsused on failis ./settingsRules.js; olek ja päringud
 * lehtedel (`../OrgSettingsClient.jsx`, `../OrgExportClient.jsx`).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { ArmedButton, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/** Vaadete valik: ühelaiused lahtrid paneeli ülaservas. */
function Tabs({ t, tabs, tab, onTab }) {
  return (
    <ChoiceRow
      label={t("org.settings.tabs.label")}
      labelHidden
      options={tabs.map((key) => ({ value: key, label: t(`org.settings.tabs.${key}`) }))}
      value={tab}
      onChange={onTab}
      columns={tabs.length}
      keepColumns
    />
  );
}

/**
 * Moodulid. `toggle`: { armedKey, busyKey, onPress(row), onCancel() }
 */
export function ModulesView({ t, tabs, tab, onTab, rows, toggle, notice }) {
  return (
    <StepPanel title={t("org.settings.modules")} note={footNote(notice, t("org.settings.modulesIntro"))}>
      <div className={shared.stack}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        <ul className={shared.rows} aria-label={t("org.settings.modules")}>
          {rows.map((row) => {
            const armed = toggle.armedKey === row.key;
            const busy = toggle.busyKey === row.key;
            return (
              <li key={row.key} className={shared.item} data-armed={armed ? "1" : undefined} data-module={row.key} aria-busy={busy ? "true" : undefined}>
                <div className={shared.rowStatic}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.name}</span>
                  </span>
                  <span className={shared.rowMeta}>
                    <span className={shared.chip} data-tone={row.active ? "ok" : undefined}>
                      {row.chip}
                    </span>
                  </span>
                </div>
                {row.canToggle ? (
                  <span className={shared.itemAside}>
                    <Button
                      {...SMALL}
                      className={armed ? shared.armed : shared.aside}
                      data-toggle={row.key}
                      aria-label={armed ? undefined : `${row.active ? t("org.settings.suspend") : t("org.settings.activate")}: ${row.name}`}
                      onKeyDown={ignoreKeyRepeat}
                      onClick={() => toggle.onPress(row)}
                    >
                      {armed ? t("org.settings.suspend_confirm") : row.active ? t("org.settings.suspend") : t("org.settings.activate")}
                    </Button>
                    {armed ? (
                      <Button {...SMALL} onClick={toggle.onCancel}>
                        {t("org.invites.keep")}
                      </Button>
                    ) : null}
                  </span>
                ) : null}
                {armed ? <p className={shared.itemNote}>{t("org.settings.suspend_note")}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </StepPanel>
  );
}

/**
 * Seis ja selle tegevused. `actions`: [{ toStatus, label, confirm?, note?, primary? }];
 * `armedStatus`: siire, mis küsib teist vajutust; `busyStatus`: siire, mis on teel.
 */
export function StatusView({ t, tabs, tab, onTab, statusLabel, statusLine, actions, armedStatus, busyStatus, onPress, notice, glow = true }) {
  const armed = actions.find((action) => action.confirm && action.toStatus === armedStatus);
  return (
    <StepPanel
      title={t("org.settings.lifecycle")}
      note={footNote(armed ? { text: t(armed.note) } : notice)}
      actions={
        actions.length ? (
          <>
            {actions.map((action) =>
              action.confirm ? (
                <ArmedButton
                  key={action.toStatus}
                  armed={armedStatus === action.toStatus}
                  busy={busyStatus === action.toStatus}
                  label={t(action.label)}
                  confirm={t(action.confirm)}
                  onPress={() => onPress(action)}
                  mark={action.toStatus}
                />
              ) : (
                <Button
                  key={action.toStatus}
                  type="button"
                  size="sm"
                  variant={action.primary ? "primary" : "secondary"}
                  glow={action.primary ? glow : undefined}
                  data-status={action.toStatus}
                  aria-busy={busyStatus === action.toStatus ? "true" : undefined}
                  onKeyDown={ignoreKeyRepeat}
                  onClick={() => onPress(action)}
                >
                  {t(action.label)}
                </Button>
              )
            )}
          </>
        ) : null
      }
    >
      <div className={shared.stack}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        <div className={shared.group}>
          <p className={shared.groupTitle}>{statusLabel}</p>
          <p className={shared.quiet}>{statusLine}</p>
        </div>
      </div>
    </StepPanel>
  );
}

/** Väljavõte seadete all: mis seal on ja tee väljavõtte lehele (harv toiming, omaette leht). */
export function ExportLinkView({ t, tabs, tab, onTab, href, onOpen }) {
  return (
    <StepPanel
      title={t("org.exportView.heading")}
      actions={
        <Button as="a" href={href} size="sm" variant="secondary" data-export-link="1" onClick={onOpen}>
          {t("org.settings.open_export")}
        </Button>
      }
    >
      <div className={shared.stack}>
        <Tabs t={t} tabs={tabs} tab={tab} onTab={onTab} />
        <p className={shared.quiet}>{t("org.exportView.intro")}</p>
      </div>
    </StepPanel>
  );
}

/**
 * Väljavõtte leht. `generated`: millal fail koostati (inimese ajavööndis) või tühi.
 * `download`: { busy, onDownload }, `back`: { href, onBack }
 */
export function ExportView({ t, generated, notice, download, back, glow = true }) {
  return (
    <StepPanel
      title={t("org.exportView.heading")}
      lead={t("org.exportView.intro")}
      note={footNote(notice, generated ? t("org.settings.export_generated", { time: generated }) : "")}
      actions={
        <>
          <Button as="a" href={back.href} size="sm" variant="secondary" data-back="1" onClick={back.onBack}>
            {t("org.settings.back_to_settings")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-download="1" aria-busy={download.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={download.onDownload}>
            {download.busy ? t("org.settings.export_making") : t("org.exportView.download")}
          </Button>
        </>
      }
    >
      <p className={shared.notice}>{t("org.exportView.excludes")}</p>
    </StepPanel>
  );
}
