"use client";

/**
 * Kutsete osa vaated.
 *
 * MIKS. Leht oli seitsme täislaia väljaga vorm, selle all kutse link ja kuue
 * veeruga tabel (seis toore nimena, kuupäev ISO kujul); tühistamine käis ühe
 * vajutusega ja üksuseta jäänud üksuse-roll hoidis nuppu hallina, põhjust
 * ütlemata. Nüüd on korraga ees üks asi:
 *  - `InvitesBoard`  ootel kutsed madalate ridadena; rea kõrval tühistamine
 *                    (küsib teist vajutust); paremal „Kutsu inimene"
 *  - `WhoView`       1/4 kellele: e-post, nimi ja ametinimetus
 *  - `RoleView`      2/4 koht ja roll ühelaiuste lahtritena
 *  - `UnitView`      3/4 üksus (kohustuslik, kui roll kehtib ühe üksuse piires)
 *  - `SendView`      4/4 kokkuvõte ja kutse loomine; ütleb ise, mis on puudu
 *  - `LinkView`      kutse link, mida näidatakse ainult üks kord, ja kopeerimine
 *
 * Kutse link tuleb kutsutule ISE edastada (platvorm kirja ei saada): nupp ütleb
 * „Loo kutse", mitte „Saada kutse".
 *
 * Siin on ainult kuju. Otsused on failis ./inviteRules.js; olek ja päringud lehel
 * (`../OrgInvitesClient.jsx`). Kujundus: organisatsioonide lehtede ühine
 * ../org.module.css.
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PERSON_NAME_MAX } from "@/lib/org/personName";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";
import { JOB_TITLE_LIMIT } from "./inviteRules";

/* Enter üherealisel väljal viib järgmise vaate juurde (vormi siin ei ole, mida Enter saadaks). */
function onEnter(next) {
  return (event) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    next?.();
  };
}

/**
 * Loend. Kutset ei avata (lugeda ei ole rohkem kui real): rea kõrval on vaikne
 * „Tühista", mis küsib teist vajutust samal nupul ja ütleb rea all, mis juhtub.
 *
 * `create`: { onCreate } või null (kirjutuskaitstud organisatsioon)
 * `revoke`: { armedId, busyId, onPress(row), onCancel() } või null
 * `more`: { busy, onMore } või null
 */
export function InvitesBoard({ t, rows, create, revoke, more, notice, glow = true }) {
  const start = create ? (
    <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={create.onCreate}>
      {t("org.invites.invite_person")}
    </Button>
  ) : null;
  if (!rows.length) {
    return <StepPanel title={t("org.invites.heading")} lead={t("org.invites.empty")} note={footNote(notice, t("org.invites.intro"))} actions={start} />;
  }
  return (
    <StepPanel title={t("org.invites.heading")} note={footNote(notice, t("org.invites.intro"))}>
      <div className={shared.stack}>
        {start ? (
          <div className={shared.headBar}>
            <span />
            {start}
          </div>
        ) : null}
        <ul className={shared.rows} aria-label={t("org.invites.heading")}>
          {rows.map((row) => {
            const armed = revoke?.armedId === row.id;
            const busy = revoke?.busyId === row.id;
            return (
              <li key={row.id} className={shared.item} data-armed={armed ? "1" : undefined} data-invite={row.id} aria-busy={busy ? "true" : undefined}>
                <div className={shared.rowStatic}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                  </span>
                  <span className={shared.rowMeta}>
                    {row.chip ? <span className={shared.chip}>{row.chip}</span> : null}
                    {row.until ? (
                      <time className={shared.time} dateTime={row.expiresAt || undefined}>
                        {row.until}
                      </time>
                    ) : null}
                  </span>
                </div>
                {revoke && row.canRevoke ? (
                  <span className={shared.itemAside}>
                    <Button
                      {...SMALL}
                      className={armed ? shared.armed : shared.aside}
                      data-revoke={row.id}
                      aria-label={armed ? undefined : t("org.invites.revoke_named", { name: row.title })}
                      onKeyDown={ignoreKeyRepeat}
                      onClick={() => revoke.onPress(row)}
                    >
                      {armed ? t("org.invites.revoke_confirm") : t("org.invites.revoke")}
                    </Button>
                    {armed ? (
                      <Button {...SMALL} onClick={revoke.onCancel}>
                        {t("org.invites.keep")}
                      </Button>
                    ) : null}
                  </span>
                ) : null}
                {armed ? <p className={shared.itemNote}>{t("org.invites.revoke_note")}</p> : null}
              </li>
            );
          })}
        </ul>
        {more ? (
          <div>
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} data-more="1" onClick={more.onMore}>
              {t("org.pagination.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Loobumine: kirjutatud vormiga küsib teist vajutust samal nupul. */
function DeclineButton({ t, decline }) {
  return <ArmedButton armed={decline.armed} label={t("org.home.create.decline.label")} confirm={t("org.home.create.decline.confirm")} onPress={decline.onPress} mark="decline" />;
}

/** 1/4 Kellele: e-post (kohustuslik), nimi (tervikuna või üldse mitte) ja ametinimetus. */
export function WhoView({ t, form, onField, fieldRef, notice, decline, onNext }) {
  return (
    <StepPanel
      title={t("org.invites.steps.who.title")}
      note={footNote(decline.armed ? { text: t("org.invites.decline_note") } : notice, t("org.invites.nameHint"))}
      actions={<DeclineButton t={t} decline={decline} />}
    >
      <div className={shared.stack}>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.invites.email")}</span>
          <Input
            ref={fieldRef}
            type="email"
            className={shared.input}
            value={form.email}
            autoComplete="off"
            onChange={(event) => onField("email", event.target.value)}
            onKeyDown={onEnter(onNext)}
          />
        </label>
        <div className={shared.pair}>
          <label className={shared.line} data-size="sm">
            <span className={shared.fieldLabel}>{t("org.invites.first_name")}</span>
            <Input className={shared.input} value={form.firstName} maxLength={PERSON_NAME_MAX} autoComplete="off" onChange={(event) => onField("firstName", event.target.value)} onKeyDown={onEnter(onNext)} />
          </label>
          <label className={shared.line} data-size="sm">
            <span className={shared.fieldLabel}>{t("org.invites.last_name")}</span>
            <Input className={shared.input} value={form.lastName} maxLength={PERSON_NAME_MAX} autoComplete="off" onChange={(event) => onField("lastName", event.target.value)} onKeyDown={onEnter(onNext)} />
          </label>
        </div>
        <label className={shared.line}>
          <span className={shared.fieldLabel}>{t("org.join.job_title")}</span>
          <Input className={shared.input} value={form.jobTitle} maxLength={JOB_TITLE_LIMIT} autoComplete="off" onChange={(event) => onField("jobTitle", event.target.value)} onKeyDown={onEnter(onNext)} />
        </label>
      </div>
    </StepPanel>
  );
}

/** 2/4 Koht ja roll: kaks küsimust ühelaiuste lahtritega; mõlemal on vaikevalik. */
export function RoleView({ t, form, seats, templates, onField }) {
  return (
    <StepPanel title={t("org.invites.steps.role.title")} note={t("org.invites.role_note")}>
      <ChoiceRow label={t("org.invites.seat_question")} options={seats} value={form.seatRole} onChange={(value) => onField("seatRole", value)} columns={2} keepColumns />
      <ChoiceRow label={t("org.invites.role_question")} options={templates} value={form.templateKey} onChange={(value) => onField("templateKey", value)} columns={3} keepColumns />
    </StepPanel>
  );
}

/** 3/4 Üksus. Kui roll kehtib ühe üksuse piires, ütleb vaade, et üksus on vaja valida. */
export function UnitView({ t, value, options, needsUnit, onUnit, notice }) {
  return (
    <StepPanel title={t("org.invites.steps.unit.title")} note={footNote(notice, needsUnit ? t("org.invites.unit_needed") : t("org.invites.unit_optional"))}>
      {options.length > 1 ? (
        <PickOne label={t("org.invites.unit_question")} options={options} value={value} onChange={onUnit} />
      ) : (
        <p className={shared.quiet}>{t("org.invites.units_none")}</p>
      )}
    </StepPanel>
  );
}

/**
 * 4/4 Kokkuvõte ja loomine. Kui midagi on puudu, ütleb vaade seda ise ja viib
 * õige vaate juurde; loomise nuppu siis ei ole.
 *
 * `send`: { busy, onSend }
 */
export function SendView({ t, summary, problem, onFix, notice, decline, send, glow }) {
  if (problem) {
    return (
      <StepPanel
        title={t("org.invites.steps.send.title")}
        note={footNote(decline.armed ? { text: t("org.invites.decline_note") } : null)}
        actions={<DeclineButton t={t} decline={decline} />}
      >
        <div className={shared.stack}>
          <p className={shared.quiet}>{t(problem.key)}</p>
          <div>
            <Button {...SMALL} data-fix="1" onClick={() => onFix(problem)}>
              {t(`org.invites.to_${problem.step}`)}
            </Button>
          </div>
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel
      title={t("org.invites.steps.send.title")}
      lead={t("org.invites.send_lead")}
      note={footNote(decline.armed ? { text: t("org.invites.decline_note") } : notice)}
      actions={
        <>
          <DeclineButton t={t} decline={decline} />
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={send.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={send.onSend}>
            {send.busy ? t("org.invites.making") : t("org.invites.make")}
          </Button>
        </>
      }
    >
      <Facts rows={summary} busy={send.busy} />
    </StepPanel>
  );
}

/** Kutse link: näidatakse ainult üks kord. Kopeerimine ja tee tagasi loendisse. */
export function LinkView({ t, link, copied, onCopy, onDone, glow = true }) {
  return (
    <StepPanel
      title={t("org.invites.linkHeading")}
      question={t("org.invites.link_made")}
      lead={t("org.invites.linkHint")}
      note={copied ? t("org.invites.link_copied") : ""}
      actions={
        <>
          <Button {...SMALL} data-done="1" onClick={onDone}>
            {t("org.members.back")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-copy="1" onClick={onCopy}>
            {t("org.invites.link_copy")}
          </Button>
        </>
      }
    >
      <p className={shared.code} data-link="1">
        {link}
      </p>
    </StepPanel>
  );
}
