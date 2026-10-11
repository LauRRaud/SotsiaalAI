"use client";

/**
 * Kutse (`/org/liitu`) ja tasutud ligipääsu pakkumise (`/org/toetus`) vaated.
 *
 * MIKS. Kutse leht oli 674 px kõrgune veerg 522 px paneelis: kast kasti sees,
 * read suurtähtedes haldaja sõnadega („hinnastatav roll", „rollimall"), üksuseta
 * kutsel kriips, ametinimetus näitamata ja keeldumine ühe vajutusega. Poolikul
 * lingil (ilma võtmeta) jäi leht lihtsalt tühjaks. Nüüd on igal seisul oma
 * väike vaade:
 *  - `InviteView`   kes kutsub ja mis koht, roll ja õigused pakutakse; all
 *                   keeldumine (küsib teist vajutust) ja nõustumine
 *  - `OfferView`    kes ja kui palju maksab; samad kaks tegevust
 *  - `WaitingView`  eelvaadet küsitakse või järgmine leht avaneb
 *  - `MessageView`  poolik link, kehtetu võti või tehtud otsus, vajadusel tee edasi
 *
 * Siin on ainult kuju. Otsused on failis ./joinRules.js; olek ja päringud lehtedel
 * (`../OrgJoinClient.jsx`, `../OrgSponsorshipClient.jsx`).
 * Kujundus: organisatsioonide lehtede ühine ../org.module.css.
 */

import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { ArmedButton, Facts, footNote, ignoreKeyRepeat } from "../OrgBits";
import shared from "../org.module.css";

/** Leht ootab: eelvaadet küsitakse või järgmine leht avaneb. */
export function WaitingView({ title, text }) {
  return (
    <StepPanel title={title}>
      <p className={shared.quiet} aria-live="polite">
        {text}
      </p>
    </StepPanel>
  );
}

/**
 * Üks lause ja vajadusel tee edasi: poolik link, kehtetu võti või tehtud otsus.
 * `action`: { href, label } või null.
 */
export function MessageView({ title, text, tone, action }) {
  return (
    <StepPanel
      title={title}
      actions={
        action ? (
          <Button as="a" href={action.href} size="sm" variant="secondary">
            {action.label}
          </Button>
        ) : null
      }
    >
      {tone === "risk" ? (
        <p className={shared.notice} data-tone="risk" role="alert">
          {text}
        </p>
      ) : (
        <p className={shared.quiet} aria-live="polite">
          {text}
        </p>
      )}
    </StepPanel>
  );
}

/** Kaks tegevust all servas: keeldumine küsib teist vajutust, nõustumine on põhitegevus. */
function Answer({ decline, accept }) {
  return (
    <>
      <ArmedButton armed={decline.armed} busy={decline.busy} label={decline.label} confirm={decline.confirm} onPress={decline.onPress} mark="decline" />
      <Button
        type="button"
        size="sm"
        variant="primary"
        data-accept="1"
        aria-busy={accept.busy ? "true" : undefined}
        onKeyDown={ignoreKeyRepeat}
        onClick={accept.onPress}
      >
        {accept.busy ? accept.busyLabel : accept.label}
      </Button>
    </>
  );
}

/**
 * Kutse eelvaade. `question` ütleb, kes kutsub; read ütlevad, millega inimene
 * nõustub. Kutsuja pandud nimi on omaette lause ridade all.
 *
 * `decline`: { armed, busy, onPress }, `accept`: { busy, onPress }
 */
export function InviteView({ t, question, facts, nameNote, notice, decline, accept }) {
  return (
    <StepPanel
      title={t("org.invites.previewHeading")}
      question={question}
      lead={t("org.invites.previewIntro")}
      note={footNote(decline.armed ? { text: t("org.join.decline_note") } : notice, t("org.home.board.privacy_note"))}
      actions={
        <Answer
          decline={{ ...decline, label: t("org.invites.decline"), confirm: t("org.join.decline_confirm") }}
          accept={{ ...accept, label: t("org.invites.accept"), busyLabel: t("org.join.accepting") }}
        />
      }
    >
      <div className={shared.stack}>
        <Facts rows={facts} busy={accept.busy || decline.busy} />
        {nameNote ? <p className={shared.small}>{nameNote}</p> : null}
      </div>
    </StepPanel>
  );
}

/** Tasutud ligipääsu pakkumise eelvaade: kes maksab ja kui palju kuus. */
export function OfferView({ t, question, facts, notice, decline, accept }) {
  return (
    <StepPanel
      title={t("org.sponsorship.previewHeading")}
      question={question}
      lead={t("org.sponsorship.previewIntro")}
      note={footNote(decline.armed ? { text: t("org.join.offer_decline_note") } : notice, t("org.sponsorship.notice"))}
      actions={
        <Answer
          decline={{ ...decline, label: t("org.sponsorship.decline"), confirm: t("org.join.decline_confirm") }}
          accept={{ ...accept, label: t("org.sponsorship.accept"), busyLabel: t("org.join.offer_accepting") }}
        />
      }
    >
      <Facts rows={facts} busy={accept.busy || decline.busy} />
    </StepPanel>
  );
}
