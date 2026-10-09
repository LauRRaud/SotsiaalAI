"use client";

/**
 * Supervisiooni protsessi raami vaated: protsess, kontrakt, osalejad, kapp ning
 * sulgemine, lahkumine ja suletud protsess.
 *
 * MIKS. Protsessi leht oli klaaskast klaaspaneeli sees: korratud pealkiri,
 * sakiriba ja iga saki all pikk veerg tumedaid kaarte, kus loend, kõik vormid ja
 * lõpus „ohutsoon" seisid korraga üksteise all. Nüüd on igal asjal oma osa
 * sammulaval (`components/stage`, `parts`) ja osa sees üks asi korraga: loend,
 * avatud tekst või vorm vahetavad üksteist samas kohas.
 *
 *  - `ProcessView`       protsessi faktid ja eesmärk
 *  - `ContractView`      kehtiv kontrakt; superviisoril ka versioonid ja uus versioon
 *  - `ParticipantsView`  osalejad ja kutsed; superviisoril kutsumine
 *  - `CabinetView`       kinnitatud väljundite kapp: loend ja üks tekst
 *  - `CloseEntryView`    tee sulgemise eelvaatesse (superviisor)
 *  - `LeaveView`         protsessist lahkumine (osaleja)
 *  - `ClosedView`        suletud protsess: mis kustus, koondarvud, minu pakk
 *
 * TAGASIVÕTMATU TEGU KÜSIB TEIST VAJUTUST ja tagajärg seisab nupu kõrval
 * tegevusreal: versiooni aktiveerimine, kutse tagasivõtmine, lahkumine. Vanal
 * lehel tegid kaks esimest oma töö ühe vajutusega.
 *
 * Siin on ainult kuju. Olek ja päringud on osade hoidjates (`../ContractPanel.jsx`,
 * `../ParticipantsPanel.jsx`, `../KappPanel.jsx`) ja lehel
 * (`../SupervisionProcessPage.jsx`); read teeb `./processRows.js`.
 *
 * Kujundus: process.module.css (siin kõrval).
 */

import { useId } from "react";

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import PrivacyBadge from "../PrivacyBadge";
import { Chip } from "../entry/EntryBits";
import { Facts, Field, OpenRows, TwoPress, describedBy, useSwapFocus, useTwoPress } from "./ProcessBits";
import styles from "./process.module.css";

const CONTRACT_MAX = 50000;

/** Protsessi faktid: tüüp, superviisor, seis, minu roll, kavandatud kohtumised ja eesmärk. */
export function ProcessView({ t, facts }) {
  return (
    <StepPanel title={t("supervision.process.views.protsess.title")}>
      <Facts facts={facts} />
    </StepPanel>
  );
}

/**
 * Kontrakt (`mode`: `read`, `versions`, `new`).
 *
 * Kõik liikmed näevad kehtivat kontrakti. Osaleja, kelle kinnitus kehtival
 * versioonil puudub, kinnitab selle siin. Superviisor näeb lisaks versioonide
 * loendit ja saab kirjutada uue versiooni; aktiveerimine küsib teist vajutust,
 * sest senist versiooni tagasi tuua ei saa.
 */
export function ContractView({ t, glow, mode, view, versions, note, draft, onDraft, busy, onMode, onAccept, onActivate, onCreate }) {
  const swapRef = useSwapFocus(mode);
  const press = useTwoPress(mode);
  const title = t("supervision.process.views.kontrakt.title");

  if (mode === "new") {
    return (
      <StepPanel
        title={title}
        question={t("supervision.contract.newVersion")}
        lead={t("supervision.process.contract.newLead")}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("read")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy || !draft.trim()} onClick={onCreate}>
              {t("supervision.contract.createVersion")}
            </Button>
          </>
        }
      >
        <div ref={swapRef}>
          <TextAreaField label={t("supervision.contract.bodyLabel")} labelHidden value={draft} onChange={onDraft} rows={9} maxLength={CONTRACT_MAX} />
        </div>
      </StepPanel>
    );
  }

  if (mode === "versions") {
    return (
      <StepPanel
        title={title}
        lead={t("supervision.process.contract.versionsLead")}
        note={press.note || note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("read")}>
              {t("supervision.process.contract.backToContract")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("new")}>
              {t("supervision.process.contract.newVersion")}
            </Button>
          </>
        }
      >
        <ul className={styles.rows} ref={swapRef}>
          {versions.map((row) => (
            <li key={row.id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>{row.title}</span>
                {row.statusText ? <Chip tone={row.tone}>{row.statusText}</Chip> : null}
                {row.date ? <span className={styles.time}>{row.date}</span> : null}
              </span>
              {row.canActivate ? (
                <span className={styles.buttons}>
                  <TwoPress
                    press={press}
                    name={`activate:${row.id}`}
                    label={t("supervision.contract.activate")}
                    confirmLabel={t("supervision.process.contract.activateConfirm")}
                    cancelLabel={t("supervision.common.cancel")}
                    consequence={t("supervision.process.contract.activateConsequence")}
                    disabled={busy}
                    onConfirm={() => onActivate(row.id)}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </StepPanel>
    );
  }

  const actions = [
    view.canManage && view.hasVersions ? (
      <Button key="versions" type="button" size="sm" variant="secondary" onClick={() => onMode("versions")}>
        {t("supervision.process.contract.versions")}
      </Button>
    ) : null,
    view.canManage ? (
      <Button key="new" type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("new")}>
        {t("supervision.process.contract.newVersion")}
      </Button>
    ) : null,
    view.needsAcceptance ? (
      <Button key="accept" type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={onAccept}>
        {t("supervision.contract.acceptContract")}
      </Button>
    ) : null
  ].filter(Boolean);

  return (
    <StepPanel
      title={title}
      lead={view.canManage ? t("supervision.process.contract.svLead") : undefined}
      note={note || (view.needsAcceptance ? t("supervision.process.contract.acceptHint") : "")}
      actions={actions.length ? actions : null}
    >
      <div className={styles.stack} ref={swapRef}>
        {view.active ? (
          <>
            <p className={styles.line}>
              <Chip tone="ok">{view.active.version}</Chip>
              {view.active.since ? <span className={styles.time}>{view.active.since}</span> : null}
            </p>
            <p className={styles.text}>{view.active.body}</p>
          </>
        ) : (
          <p className={styles.quiet}>{t(view.canManage ? "supervision.process.contract.noneSv" : "supervision.contract.noActive")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Osalejad (`mode`: `list`, `invite`).
 *
 * Superviisor näeb kõiki osalusi ja saab kutsuda; teised liikmed näevad neid,
 * kes on liitunud või lahkunud (selle piiri seab server). Kutse tagasivõtmine
 * küsib teist vajutust: sama inimest ei saa samasse protsessi uuesti kutsuda.
 */
export function ParticipantsView({ t, glow, mode, rows, canInvite, lead, note, userId, onUserId, busy, onMode, onInvite, onWithdraw }) {
  const swapRef = useSwapFocus(mode);
  const press = useTwoPress(mode);
  const id = useId();
  const title = t("supervision.process.views.osalejad.title");

  if (mode === "invite") {
    const hint = t("supervision.process.participants.inviteHint");
    return (
      <StepPanel
        title={title}
        lead={t("supervision.process.participants.inviteLead")}
        note={note}
        actions={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => onMode("list")}>
              {t("supervision.common.cancel")}
            </Button>
            <Button type="submit" form={`${id}-form`} size="sm" variant="primary" glow={glow} disabled={busy || !userId.trim()}>
              {t("supervision.contract.invite")}
            </Button>
          </>
        }
      >
        <form
          id={`${id}-form`}
          className={styles.fields}
          noValidate
          ref={swapRef}
          onSubmit={(event) => {
            event.preventDefault();
            onInvite();
          }}
        >
          <Field id={`${id}-user`} label={t("supervision.process.participants.inviteField")} hint={hint}>
            <Input
              id={`${id}-user`}
              className={styles.input}
              type="text"
              value={userId}
              autoComplete="off"
              describedBy={describedBy(`${id}-user`, { hint })}
              onChange={(event) => onUserId(event.target.value)}
            />
          </Field>
        </form>
      </StepPanel>
    );
  }

  return (
    <StepPanel
      title={title}
      lead={lead}
      note={press.note || note}
      actions={
        canInvite ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={() => onMode("invite")}>
            {t("supervision.contract.inviteLabel")}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack} ref={swapRef}>
        {rows.length ? (
          <ul className={styles.rows}>
            {rows.map((row) => (
              <li key={row.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemName}>{row.name}</span>
                  {row.statusText ? <Chip tone={row.tone}>{row.statusText}</Chip> : null}
                </span>
                {row.canWithdraw ? (
                  <span className={styles.buttons}>
                    <TwoPress
                      press={press}
                      name={`withdraw:${row.id}`}
                      label={t("supervision.contract.withdraw")}
                      confirmLabel={t("supervision.process.participants.withdrawConfirm")}
                      cancelLabel={t("supervision.common.cancel")}
                      consequence={t("supervision.process.participants.withdrawConsequence")}
                      disabled={busy}
                      onConfirm={() => onWithdraw(row.id)}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{t("supervision.process.participants.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Kinnitatud väljundite kapp (`row` on avatud tekst või `null`).
 *
 * Puhas lugemisvaade: kehtiv kontrakt ja kinnitatud kokkuvõtted. Märk ütleb,
 * MIKS need siin on: need jäävad alles ka pärast sulgemist (erinevalt jagatud
 * toorsisust, mis kustub). Märk on nii loendi kui ka iga avatud teksti juures.
 */
export function CabinetView({ t, rows, row, onOpen, onBack }) {
  const swapRef = useSwapFocus(row ? `text:${row.id}` : "list");
  const title = t("supervision.process.views.kapp.title");

  if (row) {
    return (
      <StepPanel
        title={title}
        actions={
          <Button type="button" size="sm" variant="secondary" onClick={onBack}>
            {t("supervision.process.back")}
          </Button>
        }
      >
        <div className={styles.stack} ref={swapRef}>
          <p className={styles.line}>
            <PrivacyBadge scope="persistent" />
            {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
          </p>
          <p className={styles.name}>{row.title}</p>
          <p className={styles.text}>{row.body}</p>
        </div>
      </StepPanel>
    );
  }

  return (
    <StepPanel title={title} lead={t("supervision.kapp.intro")}>
      <div className={styles.stack} ref={swapRef}>
        <p className={styles.line}>
          <PrivacyBadge scope="persistent" />
        </p>
        {rows.length ? (
          <OpenRows
            rows={rows}
            openText={t("supervision.home.open")}
            onOpen={onOpen}
            meta={(item) => (item.meta ? <span className={styles.time}>{item.meta}</span> : null)}
          />
        ) : (
          <p className={styles.quiet}>{t("supervision.kapp.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Sulgemine (superviisor). Siin ei suleta midagi: nupp viib eelvaatesse, mis
 * näitab, mis kustub ja mis jääb, ja sulgemine kinnitatakse seal.
 */
export function CloseEntryView({ t, glow, onPreview }) {
  return (
    <StepPanel
      title={t("supervision.process.views.sulgemine.title")}
      lead={t("supervision.close.intro")}
      actions={
        <Button type="button" size="sm" variant="primary" glow={glow} onClick={onPreview}>
          {t("supervision.process.end.toPreview")}
        </Button>
      }
    >
      <div className={styles.stack}>
        <p className={styles.line}>
          <PrivacyBadge scope="persistent" />
        </p>
        <p className={styles.quiet}>{t("supervision.process.end.closeHint")}</p>
      </div>
    </StepPanel>
  );
}

/** Lahkumine (osaleja): lõpetab osalemise, tagasi võtta ei saa. Küsib teist vajutust. */
export function LeaveView({ t, note, busy, onLeave }) {
  const press = useTwoPress();
  return (
    <StepPanel
      title={t("supervision.process.views.lahkumine.title")}
      lead={t("supervision.leave.hint")}
      note={press.note || note}
      actions={
        <TwoPress
          press={press}
          name="leave"
          label={t("supervision.leave.action")}
          confirmLabel={t("supervision.leave.confirm")}
          cancelLabel={t("supervision.common.cancel")}
          consequence={t("supervision.leave.confirmHint")}
          disabled={busy}
          onConfirm={onLeave}
        />
      }
    />
  );
}

/**
 * Suletud protsess: millal suleti, mis kustus ja koondarvud. `onPack` on olemas,
 * kui vaatajal on selle protsessi isiklik pakk.
 */
export function ClosedView({ t, glow, lines, onPack }) {
  return (
    <StepPanel
      title={t("supervision.process.views.suletud.title")}
      lead={t("supervision.closed.banner")}
      actions={
        onPack ? (
          <Button type="button" size="sm" variant="primary" glow={glow} onClick={onPack}>
            {t("supervision.closed.openPack")}
          </Button>
        ) : null
      }
    >
      {lines.length ? (
        <ul className={styles.lines}>
          {lines.map((line) => (
            <li key={line.key} className={styles.lineItem}>
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </StepPanel>
  );
}
