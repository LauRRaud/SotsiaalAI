"use client";

/**
 * Organisatsioonide avalehe (`/org`) vaated: loend, kutsed ja loomise kolm
 * väikest vaadet.
 *
 * MIKS. Leht oli üks 1772 px kõrgune veerg 522 px paneelis: pealkiri ja
 * selgitus, iga organisatsioon kõrge kaardina kasti sees, kutsed paljaste
 * siltidena (ilma sõnata, mida nendega teha) ja loomise vorm nelja täislaia
 * väljaga kõige all. Nüüd on korraga ees üks asi:
 *  - `BoardView`    minu organisatsioonid madalate ridadena; kui on ka kutseid,
 *                   on need teise ühelaiuse lahtri taga; paremal „Loo organisatsioon"
 *  - `NameView`     loomine 1/3: nimi, juriidiline nimi ja registrikood (kaks viimast võivad jääda hilisemaks)
 *  - `KindView`     loomine 2/3: asutuse liik ühelaiuste lahtritena (alguses valimata)
 *  - `ConfirmView`  loomine 3/3: mis kirja läheb ja mis edasi saab; loomise nupp
 *
 * Siin on ainult kuju. Otsused on failis ./orgBoard.js; olek ja päring lehel
 * (`app/org/OrgHomeClient.jsx`).
 *
 * Kujundus: home.module.css (siin kõrval) ja organisatsioonide lehtede ühine
 * ../org.module.css.
 */

import { useRef } from "react";

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ArmedButton, Facts, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import styles from "./home.module.css";
import { NAME_LIMIT, REGISTRY_CODE_LIMIT } from "./orgBoard";

/**
 * Loend. Organisatsiooni rida avab tööruumi. Kutse rida on loetav: liitumise
 * link on kutsuja käes ja liikmesus tekib alles lingi lehel antud kinnitusega.
 *
 * `filter`: { shown: "orgs" | "invites", choice, empty } (vt `boardShown`)
 * `create`: { onCreate } või null, kui inimene organisatsiooni luua ei saa
 */
export function BoardView({ t, filter, onFilter, orgRows, inviteRows, create, hrefOf, onOpen, glow = true }) {
  const start = create ? (
    <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={create.onCreate}>
      {t("org.create.submit")}
    </Button>
  ) : null;
  /* Tühi leht: üks lause, kuidas organisatsiooni saab, ja selle all loomine. */
  if (filter.empty) {
    return <StepPanel title={t("org.home.heading")} lead={t("org.home.empty")} note={t("org.home.board.join_note")} actions={start} />;
  }
  const invites = filter.shown === "invites";
  return (
    <StepPanel title={t("org.home.heading")} note={t("org.home.board.privacy_note")}>
      <div className={shared.stack}>
        {filter.choice || start || !orgRows.length ? (
          <div className={styles.bar}>
            {/* Kes ei kuulu veel kuhugi, aga on kutsutud: lahtrite kohal seisab see lause. */}
            {filter.choice ? null : orgRows.length ? <span /> : <p className={shared.quiet}>{t("org.home.empty")}</p>}
            <div className={styles.filter} hidden={!filter.choice}>
              {filter.choice ? (
                <ChoiceRow
                  label={t("org.home.board.filter.label")}
                  labelHidden
                  options={[
                    { value: "orgs", label: t("org.switcher.organizations") },
                    { value: "invites", label: t("org.home.board.filter.invites", { count: inviteRows.length }) }
                  ]}
                  value={filter.shown}
                  onChange={onFilter}
                  columns={2}
                  keepColumns
                />
              ) : null}
            </div>
            {start}
          </div>
        ) : null}
        {invites ? (
          <>
            <p className={shared.quiet}>{t("org.home.invites.lead")}</p>
            <ul className={shared.rows} aria-label={t("org.home.pendingInvites")}>
              {inviteRows.map((row) => (
                <li key={row.id} className={shared.rowItem}>
                  <div className={shared.rowStatic}>
                    <span className={shared.rowMain}>
                      <span className={shared.rowTitle}>{row.title}</span>
                      {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                    </span>
                    {row.until ? (
                      <span className={shared.rowMeta}>
                        <time className={shared.time} dateTime={row.expiresAt || undefined}>
                          {row.until}
                        </time>
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className={shared.rows} aria-label={t("org.switcher.organizations")}>
            {orgRows.map((row) => (
              <li key={row.id} className={shared.rowItem}>
                <a className={shared.row} href={hrefOf(row)} title={t("org.home.openWorkspace")} onClick={(event) => onOpen(event, row)}>
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
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepPanel>
  );
}

/** Loobumine: kirjutatud vormiga küsib teist vajutust samal nupul. */
function DeclineButton({ t, decline }) {
  return (
    <ArmedButton
      armed={decline.armed}
      label={t("org.home.create.decline.label")}
      confirm={t("org.home.create.decline.confirm")}
      onPress={decline.onPress}
      mark="decline"
    />
  );
}

/* Enter üherealisel väljal viib järgmise vaate juurde (vormi siin ei ole,
   mida Enter saadaks). */
function onEnter(next) {
  return (event) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    next?.();
  };
}

/**
 * Loomine 1/3: nimi ja registriandmed. Nimi on see, mida liikmed iga päev näevad;
 * juriidiline nimi ja registrikood võivad jääda hilisemaks (need saab lisada
 * organisatsiooni seadetes). Väli on nii lai, kui sinna kirjutatav sisu vajab.
 */
export function NameView({ t, form, onField, fieldRef, notice, decline, onNext }) {
  return (
    <StepPanel
      title={t("org.home.create.steps.name.title")}
      note={footNote(decline.armed ? { text: t("org.home.create.decline.note") } : notice, t("org.home.create.legal_note"))}
      actions={<DeclineButton t={t} decline={decline} />}
    >
      <div className={shared.stack}>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.create.displayName")}</span>
          <Input
            ref={fieldRef}
            className={shared.input}
            value={form.displayName}
            maxLength={NAME_LIMIT}
            autoComplete="organization"
            onChange={(event) => onField("displayName", event.target.value)}
            onKeyDown={onEnter(onNext)}
          />
          <span className={shared.hint}>{t("org.home.create.name_hint")}</span>
        </label>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.create.legalName")}</span>
          <Input
            className={shared.input}
            value={form.legalName}
            maxLength={NAME_LIMIT}
            autoComplete="off"
            onChange={(event) => onField("legalName", event.target.value)}
            onKeyDown={onEnter(onNext)}
          />
        </label>
        <label className={shared.line} data-size="sm">
          <span className={shared.fieldLabel}>{t("org.create.registryCode")}</span>
          <Input
            className={shared.input}
            value={form.registryCode}
            maxLength={REGISTRY_CODE_LIMIT}
            autoComplete="off"
            onChange={(event) => onField("registryCode", event.target.value)}
            onKeyDown={onEnter(onNext)}
          />
        </label>
      </div>
    </StepPanel>
  );
}

/**
 * Loomine 2/3: asutuse liik. Ühelaiused lahtrid; liik on alguses valimata ja
 * esimene valik viib vaate ise edasi.
 *
 * NOOLEKLAHV EI VII EDASI. Raadionuppudel valib nooleklahv järgmise variandi;
 * kui see viiks vaate ära, ei jõuaks klaviatuuriga kunagi kolmanda variandini.
 * `onKind(value, { byArrow })` ütleb lehele, kas valik tuli noolega.
 */
export function KindView({ t, value, options, onKind, notice }) {
  const byArrow = useRef(false);
  return (
    <StepPanel title={t("org.home.create.steps.kind.title")} note={footNote(notice)}>
      <div
        onKeyDownCapture={(event) => {
          byArrow.current = event.key.startsWith("Arrow");
        }}
        onPointerDownCapture={() => {
          byArrow.current = false;
        }}
      >
        <ChoiceRow
          label={t("org.home.create.kind_question")}
          options={options}
          value={value}
          onChange={(next) => onKind(next, { byArrow: byArrow.current })}
          columns={3}
          keepColumns
        />
      </div>
    </StepPanel>
  );
}

/**
 * Loomine 3/3: mis kirja läheb ja mis edasi saab. Kui nimi või liik on puudu,
 * ütleb vaade seda ise ja viib selle vaate juurde; loomise nuppu siis ei ole.
 *
 * `create`: { busy, onCreate }
 */
export function ConfirmView({ t, summary, problem, onFix, notice, decline, create, glow }) {
  if (problem) {
    return (
      <StepPanel
        title={t("org.home.create.steps.confirm.title")}
        note={footNote(decline.armed ? { text: t("org.home.create.decline.note") } : null)}
        actions={<DeclineButton t={t} decline={decline} />}
      >
        <div className={shared.stack}>
          <p className={shared.quiet}>{t(problem.key)}</p>
          <div>
            <Button {...SMALL} data-fix="1" onClick={() => onFix(problem)}>
              {t(`org.home.create.to_${problem.step}`)}
            </Button>
          </div>
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel
      title={t("org.home.create.steps.confirm.title")}
      lead={t("org.create.hint")}
      note={footNote(decline.armed ? { text: t("org.home.create.decline.note") } : notice, t("org.home.create.founder_note"))}
      actions={
        <>
          <DeclineButton t={t} decline={decline} />
          <Button
            type="button"
            size="sm"
            variant="primary"
            glow={glow}
            data-submit="1"
            aria-busy={create.busy ? "true" : undefined}
            onKeyDown={ignoreKeyRepeat}
            onClick={create.onCreate}
          >
            {create.busy ? t("org.home.create.creating") : t("org.create.submit")}
          </Button>
        </>
      }
    >
      <Facts rows={summary} busy={create.busy} />
    </StepPanel>
  );
}
