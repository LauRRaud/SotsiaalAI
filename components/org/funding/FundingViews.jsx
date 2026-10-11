"use client";

/**
 * Rahastuse osa vaated.
 *
 * MIKS. Leht oli kuue veeruga tabel, mille lahtrites olid inimeste sildid ristiga
 * (koha vabastamine ühe vajutusega), rippmenüü ja nupp „Lõpeta plaan" (samuti
 * ühe vajutusega), selle all kaks vormi ja sponsorluste sildid ristiga. Nüüd on
 * korraga ees üks asi, valik kahest lahtrist:
 *  - `PlansBoard`        kohaplaanid madalate ridadena; paremal „Lisa kohaplaan"
 *  - `PlanView`          üks plaan: read, kellel koht on (vabastamine küsib teist
 *                        vajutust), kellele koha anda, plaani lõpetamine (küsib teist vajutust)
 *  - `PlanForm`          uus plaan: roll lahtritena ja kohtade arv
 *  - `SponsorshipsBoard` pöördujate tasutud ligipääsud; tühistamine küsib teist vajutust
 *  - `SponsorshipForm`   uus pakkumine: pöörduja e-post
 *  - `LinkView`          pakkumise link, mida näidatakse ainult üks kord
 *
 * PRIVAATSUSTEADE ON SISU: koha eest maksmine ei anna ligipääsu inimese
 * vestlustele, Tööheaolule ega kasutussagedusele. See seisab loendite all servas.
 *
 * Siin on ainult kuju. Otsused on failis ./fundingRules.js; olek ja päringud lehel
 * (`../OrgFundingClient.jsx`).
 */

import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ArmedButton, Facts, PickOne, SMALL, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/** Vaadete valik ja põhitegevus ühel real. */
function Bar({ t, tabs, tab, onTab, action }) {
  return (
    <div className={shared.headBar}>
      <ChoiceRow
        label={t("org.funding.tabs.label")}
        labelHidden
        options={tabs.map((key) => ({ value: key, label: t(`org.funding.tabs.${key}`) }))}
        value={tab}
        onChange={onTab}
        columns={tabs.length}
        keepColumns
      />
      {action}
    </div>
  );
}

/** Kohaplaanid. `add`: { onAdd } või null. */
export function PlansBoard({ t, tabs, tab, onTab, rows, onOpen, add, notice, glow = true }) {
  return (
    <StepPanel title={t("org.funding.plans")} note={footNote(notice, t("org.funding.privacyNotice"))}>
      <div className={shared.stack}>
        <Bar
          t={t}
          tabs={tabs}
          tab={tab}
          onTab={onTab}
          action={
            add ? (
              <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={add.onAdd}>
                {t("org.funding.addPlan")}
              </Button>
            ) : null
          }
        />
        {rows.length ? (
          <ul className={shared.rows} aria-label={t("org.funding.plans")}>
            {rows.map((row) => (
              <li key={row.id} className={shared.rowItem}>
                <button type="button" className={shared.row} data-plan={row.id} onClick={() => onOpen(row.id)}>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                  </span>
                  {row.chip ? (
                    <span className={shared.rowMeta}>
                      <span className={shared.chip}>{row.chip}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{t("org.funding.empty")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks kohaplaan.
 *
 * `people`: [{ id, label }], `release`: { armedId, onPress(person) }
 * `assign`: { options, value, onChoose, onAssign, busy } või null
 * `end`: { armed, busy, onPress } või null
 */
export function PlanView({ t, title, facts, people, canRelease, release, assign, end, notice, armedNote, busy, onBack }) {
  return (
    <StepPanel
      title={title}
      note={footNote(armedNote ? { text: armedNote } : notice)}
      actions={
        <>
          <Button {...SMALL} data-back="1" onClick={onBack}>
            {t("org.members.back")}
          </Button>
          {end ? <ArmedButton armed={end.armed} busy={end.busy} label={t("org.funding.endPlan")} confirm={t("org.funding.end_confirm")} onPress={end.onPress} mark="end" /> : null}
        </>
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <p className={shared.headName}>{title}</p>
        <Facts rows={facts} />
        <div className={shared.group}>
          <p className={shared.groupTitle}>{t("org.funding.seated")}</p>
          {people.length ? (
            canRelease ? (
              <div className={shared.cells}>
                {people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={shared.cellButton}
                    data-seat={person.id}
                    data-armed={release.armedId === person.id ? "1" : undefined}
                    onKeyDown={ignoreKeyRepeat}
                    onClick={() => release.onPress(person)}
                  >
                    {release.armedId === person.id ? t("org.funding.release_confirm") : person.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className={shared.quiet}>{people.map((person) => person.label).join(", ")}</p>
            )
          ) : (
            <p className={shared.quiet}>{t("org.funding.nobody_seated")}</p>
          )}
        </div>
        {assign ? (
          assign.options.length ? (
            <div className={shared.group}>
              <PickOne label={t("org.funding.assign_question")} options={assign.options} value={assign.value} onChange={assign.onChoose} />
              <div>
                <Button {...SMALL} data-assign="1" aria-busy={assign.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={assign.onAssign}>
                  {t("org.funding.assign")}
                </Button>
              </div>
            </div>
          ) : (
            <p className={shared.small}>{t("org.funding.nobody_to_seat")}</p>
          )
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Uus kohaplaan. `decline`: { onPress }, `save`: { busy, onSave } */
export function PlanForm({ t, form, onField, roles, reference, fieldRef, notice, decline, save, glow = true }) {
  return (
    <StepPanel
      title={t("org.funding.addPlan")}
      note={footNote(notice, reference ? t("org.funding.reference_note", { price: reference }) : "")}
      actions={
        <>
          <Button {...SMALL} data-decline="1" onClick={decline.onPress}>
            {t("org.home.create.decline.label")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
            {save.busy ? t("org.funding.adding") : t("org.funding.addPlan")}
          </Button>
        </>
      }
    >
      <div className={shared.stack} aria-busy={save.busy ? "true" : undefined}>
        <ChoiceRow label={t("org.funding.role_question")} options={roles} value={form.seatRole} onChange={(value) => onField("seatRole", value)} columns={2} keepColumns />
        <label className={shared.line} data-size="sm">
          <span className={shared.fieldLabel}>{t("org.funding.limit_question")}</span>
          <Input ref={fieldRef} type="number" min="0" inputMode="numeric" className={shared.input} value={form.seatLimit} onChange={(event) => onField("seatLimit", event.target.value)} />
        </label>
      </div>
    </StepPanel>
  );
}

/**
 * Pöördujate tasutud ligipääsud. `offer`: { onOffer } või null;
 * `revoke`: { armedId, busyId, onPress(row), onCancel() }; `more`: { busy, onMore } või null.
 */
export function SponsorshipsBoard({ t, tabs, tab, onTab, rows, offer, revoke, more, notice, glow = true }) {
  return (
    <StepPanel title={t("org.funding.sponsorships")} note={footNote(notice, t("org.funding.sponsorshipIntro"))}>
      <div className={shared.stack}>
        <Bar
          t={t}
          tabs={tabs}
          tab={tab}
          onTab={onTab}
          action={
            offer ? (
              <Button type="button" size="sm" variant="primary" glow={glow} data-create="1" onClick={offer.onOffer}>
                {t("org.funding.offer")}
              </Button>
            ) : null
          }
        />
        {rows.length ? (
          <ul className={shared.rows} aria-label={t("org.funding.sponsorships")}>
            {rows.map((row) => {
              const armed = revoke.armedId === row.id;
              const busy = revoke.busyId === row.id;
              return (
                <li key={row.id} className={shared.item} data-armed={armed ? "1" : undefined} data-sponsorship={row.id} aria-busy={busy ? "true" : undefined}>
                  <div className={shared.rowStatic}>
                    <span className={shared.rowMain}>
                      <span className={shared.rowTitle}>{row.title}</span>
                      {row.sub ? <span className={shared.rowSub}>{row.sub}</span> : null}
                    </span>
                    {row.chip ? (
                      <span className={shared.rowMeta}>
                        <span className={shared.chip}>{row.chip}</span>
                      </span>
                    ) : null}
                  </div>
                  {row.canRevoke ? (
                    <span className={shared.itemAside}>
                      <Button
                        {...SMALL}
                        className={armed ? shared.armed : shared.aside}
                        data-revoke={row.id}
                        aria-label={armed ? undefined : `${t("org.funding.revokeSponsorship")}: ${row.title}`}
                        onKeyDown={ignoreKeyRepeat}
                        onClick={() => revoke.onPress(row)}
                      >
                        {armed ? t("org.invites.revoke_confirm") : t("org.funding.revokeSponsorship")}
                      </Button>
                      {armed ? (
                        <Button {...SMALL} onClick={revoke.onCancel}>
                          {t("org.invites.keep")}
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
                  {armed ? <p className={shared.itemNote}>{t("org.funding.revoke_note")}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={shared.quiet}>{t("org.funding.noSponsorships")}</p>
        )}
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

/** Uus tasutud ligipääsu pakkumine. `decline`: { onPress }, `save`: { busy, onSave } */
export function SponsorshipForm({ t, email, onEmail, reference, fieldRef, notice, decline, save, glow = true }) {
  return (
    <StepPanel
      title={t("org.funding.offer")}
      lead={t("org.funding.offer_lead")}
      note={footNote(notice, reference ? t("org.funding.reference_note", { price: reference }) : "")}
      actions={
        <>
          <Button {...SMALL} data-decline="1" onClick={decline.onPress}>
            {t("org.home.create.decline.label")}
          </Button>
          <Button type="button" size="sm" variant="primary" glow={glow} data-submit="1" aria-busy={save.busy ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={save.onSave}>
            {save.busy ? t("org.funding.offering") : t("org.funding.make_offer")}
          </Button>
        </>
      }
    >
      <label className={shared.line}>
        <span className={shared.fieldLabel}>{t("org.funding.sponsorEmail")}</span>
        <Input
          ref={fieldRef}
          type="email"
          className={shared.input}
          value={email}
          autoComplete="off"
          onChange={(event) => onEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
            event.preventDefault();
            save.onSave();
          }}
        />
      </label>
    </StepPanel>
  );
}

/** Pakkumise link: näidatakse ainult üks kord. Kopeerimine ja tee tagasi loendisse. */
export function LinkView({ t, link, copied, onCopy, onDone, glow = true }) {
  return (
    <StepPanel
      title={t("org.funding.linkHeading")}
      question={t("org.funding.link_made")}
      lead={t("org.funding.linkHint")}
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
