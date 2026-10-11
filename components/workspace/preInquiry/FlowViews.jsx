"use client";

/**
 * Eelpöördumise ülejäänud vaated: abiline, ülevaade, adressaat, tekst, saatmine,
 * saadetud pöördumise lugemisvaated (seis ja tekst) ja „Minu eelpöördumised".
 *
 * Nagu eelinfo vaated (CollectViews.jsx), ei hoia need olekut: väärtused ja
 * tegevused tulevad lehelt. Loendite kaardid (adressaat, salvestatud
 * eelpöördumine) näitavad ühte põhitegevust; ülejäänu avaneb kaardi seest.
 *
 * Kujundus: views.module.css ja lists.module.css.
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { LineField } from "./CollectViews";
import lists from "./lists.module.css";
import receiver from "./receiver.module.css";
import { excerptOf, pageOf } from "./senderModel";
import styles from "./views.module.css";

const TEXT_LIMIT = 12000;

/** Vestlus abilisega: olemasolev vestlusaken ja sisestusriba (`children`). */
export function AssistantView({ tr, children }) {
  return (
    <StepPanel
      title={tr("views.assistant.title", "Täpsusta abilisega")}
      lead={tr("views.assistant.lead", "Abiline küsib täpsustusi ja aitab leida sobiva kontakti. Selle sammu võid vahele jätta.")}
    >
      <div className={styles.assistant}>{children}</div>
    </StepPanel>
  );
}

/**
 * Lehekülgede vahetaja paneeli alumises servas: mis vahemik on ees ja nupud eelmise ja
 * järgmise juurde. Loend, mis paneeli ei mahu, jagatakse lehekülgedeks (reegel: `pageOf`
 * failis senderModel.js); paneeli sees kerivat kasti ei ole.
 */
function Pager({ tr, pager }) {
  return (
    <span className={styles.pager}>
      <span>
        {tr("views.pager.range", "{from} kuni {to}, kokku {total}")
          .replace("{from}", String(pager.from))
          .replace("{to}", String(pager.to))
          .replace("{total}", String(pager.total))}
      </span>
      <button type="button" className={styles.textLink} disabled={pager.page <= 0} onClick={pager.onPrev}>
        ‹ {tr("views.pager.prev", "Eelmised")}
      </button>
      <button type="button" className={styles.textLink} disabled={pager.page >= pager.pages - 1} onClick={pager.onNext}>
        {tr("views.pager.next", "Järgmised")} ›
      </button>
    </span>
  );
}

/* Mitu ülevaate rida on korraga ees ja kui pikk on ühe rea väärtus (pikem tekst lõigatakse;
   täies pikkuses on see oma sammus ja plokis „Kõik vastused"). Mõõdetud nii, et vaade mahub
   paneeli ka töölaual. */
const REVIEW_PAGE = 4;
const REVIEW_VALUE_LIMIT = 120;

/**
 * Ülevaade: mis infot pöördumise koostamiseks kasutatakse ja mis on veel lisamata.
 * Read on lehekülgede kaupa (`page`, `onPage`), sest üksteist rida koos pika kirjeldusega ei
 * mahtunud paneeli (mõõdetud 1461 px 522 vastu).
 */
export function ReviewView({ tr, rows, missing, page = 0, onPage, children }) {
  const paged = pageOf(rows, page, REVIEW_PAGE);
  return (
    <StepPanel
      title={tr("overview.title", "Eelinfo ülevaade")}
      note={
        paged.pages > 1 ? (
          <Pager tr={tr} pager={{ ...paged, onPrev: () => onPage?.(paged.page - 1), onNext: () => onPage?.(paged.page + 1) }} />
        ) : null
      }
    >
      <div className={styles.stack}>
        {paged.items.length ? (
          <dl className={styles.rows}>
            {paged.items.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt className={styles.rowLabel}>{label}</dt>
                <dd className={styles.rowValue}>{excerptOf(value, REVIEW_VALUE_LIMIT)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.quiet}>{tr("overview.empty", "Eelinfo täitub töövoo käigus.")}</p>
        )}
        {missing.length ? (
          <p className={styles.quiet}>{tr("views.review.missing_line", "Lisamata: {items}.").replace("{items}", missing.join(", "))}</p>
        ) : null}
        {/* Kõik vastused küsimuste kaupa avanevad soovi korral: vaade näitab algul kokkuvõtet. */}
        {children ? (
          <details className={styles.fold}>
            <summary className={styles.foldTitle}>{tr("views.review.all_answers", "Kõik vastused")}</summary>
            {children}
          </details>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Üks soovitatud kontakt: kes, miks just tema, ja üks põhitegevus. */
function RecipientCard({ tr, entry, selected, typeLabel, subtitle, reason, region, meta, referral, availability, serviceActions, onSelect, mapHref, profileHref }) {
  return (
    <article className={lists.card} data-selected={selected ? "true" : undefined}>
      <header className={lists.cardHead}>
        <h4 className={lists.cardTitle}>{entry.title}</h4>
        <span className={lists.chip}>{typeLabel}</span>
      </header>
      {subtitle ? <p className={lists.cardLine}>{subtitle}</p> : null}
      {reason ? <p className={lists.cardReason}>{reason}</p> : null}
      {entry.routingReason ? <p className={lists.cardReason}>{entry.routingReason}</p> : null}
      {[region, meta].filter(Boolean).length ? <p className={lists.cardMeta}>{[region, meta].filter(Boolean).join(" · ")}</p> : null}
      {referral ? <p className={lists.cardMeta}>{referral}</p> : null}
      {availability.map(({ service, presentation }) => (
        <p key={`${service.id || service.name}-availability`} className={styles.notice} data-tone={presentation.tone === "positive" ? "ok" : undefined}>
          {presentation.icon} {service.name}: {presentation.label}. {presentation.ageText}. {presentation.warning}
        </p>
      ))}
      <div className={lists.cardActions}>
        {serviceActions
          ? serviceActions.map((action) => (
              <Button key={action.providerServiceId} type="button" size="sm" variant={selected ? "secondary" : "primary"} onClick={() => onSelect(entry, action)}>
                {tr("actions.choose_contact", "Vali see kontakt")}: {action.name}
              </Button>
            ))
          : (
              <Button type="button" size="sm" variant={selected ? "secondary" : "primary"} onClick={() => onSelect(entry)}>
                {selected ? tr("recipient.selected", "Valitud kontakt") : tr("actions.choose_contact", "Vali see kontakt")}
              </Button>
            )}
        <span className={styles.links}>
          {mapHref ? (
            <Button as="a" href={mapHref} size="sm" variant="linkBrand">
              {tr("actions.view_service_map", "Vaata teenusekaardil")}
            </Button>
          ) : null}
          {profileHref ? (
            <Button as="a" href={profileHref} size="sm" variant="linkBrand">
              {tr("actions.view_profile", "Vaata profiili")}
            </Button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

/**
 * Adressaat: liigi filter, otsing ja soovitatud kontaktid. `emptyText` ütleb, miks loend on
 * tühi (otsus: `recipientEmptyReason` failis senderModel.js); varem oli iga tühja loendi all
 * sama vihje.
 */
export function RecipientView({ tr, types, type, onType, query, onQuery, confidence, recipients, describe, selectedId, onSelect, hasMore, showMore, onToggleMore, emptyText }) {
  return (
    <StepPanel
      title={tr("views.recipient.title", "Adressaat")}
      lead={tr("views.recipient.lead", "Kontaktid tulevad teenusekaardilt. Vali, kellele pöördumine läheb; Sotsiaal.pro ise ei ole adressaat.")}
    >
      <div className={styles.stack}>
        <div className={styles.toggles} role="group" aria-label={tr("fields.recipient_type", "Adressaadi tüüp")}>
          {types.map(([value, label]) => (
            <button key={value} type="button" className={styles.toggle} aria-pressed={type === value} onClick={() => onType(type === value ? "" : value)}>
              {label}
            </button>
          ))}
        </div>
        <LineField
          label={tr("fields.recipient_search", "Otsi adressaati")}
          value={query}
          placeholder={tr("placeholders.recipient", "KOV kontakt, organisatsiooni vastuvõtutiim, teenuseosutaja või piirkond")}
          onChange={onQuery}
        />
        {confidence ? (
          <p className={styles.notice}>
            <strong>{tr("routing.confidence", "Kontaktisoovituse kindlus")}:</strong> {confidence.label || confidence.level}
            {confidence.text ? `. ${confidence.text}` : ""}
          </p>
        ) : null}
        {recipients.length ? (
          <div className={lists.list}>
            {recipients.map((entry) => (
              <RecipientCard key={entry.id} tr={tr} entry={entry} selected={selectedId === entry.id} onSelect={onSelect} {...describe(entry)} />
            ))}
          </div>
        ) : (
          <p className={styles.quiet} aria-live="polite">
            {emptyText}
          </p>
        )}
        {hasMore ? (
          <Button type="button" size="sm" variant="secondary" onClick={onToggleMore}>
            {showMore ? tr("actions.show_less_contacts", "Näita vähem") : tr("actions.show_more_contacts", "Vaata rohkem kontakte")}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Pöördumise tekst: teema ja tekst, mida inimene saab muuta. */
export function TextView({ tr, topic, onTopic, draft, onDraft, remaining, children }) {
  return (
    <StepPanel
      title={tr("views.text.title", "Pöördumise tekst")}
      lead={tr("views.text.lead", "Loe üle ja muuda. Seda teksti näeb vastuvõtja.")}
    >
      <div className={styles.stack}>
        <label className={styles.field} data-size="lg">
          <span className={styles.fieldLabel}>{tr("fields.topic", "Teema")}</span>
          <Input maxLength={1000} value={topic} placeholder={tr("placeholders.topic", "Lühike pealkiri")} onChange={(event) => onTopic(event.target.value)} />
        </label>
        <TextAreaField label={tr("views.text.draft", "Tekst")} value={draft} rows={5} maxLength={TEXT_LIMIT} onChange={onDraft} />
        {/* Loendur ilmub alles piiri lähedal: muidu on see lihtsalt müra. */}
        {TEXT_LIMIT - draft.length < 1000 ? <span className={styles.counter}>{remaining(TEXT_LIMIT - draft.length)}</span> : null}
        {/* Teekonnast kaasa minev info on pikk plokk: see avaneb soovi korral, et tekstivaade
            mahuks paneeli (mõõdetud 1051 px 522 vastu, kui plokk oli alati lahti). */}
        {children ? (
          <details className={styles.fold}>
            <summary className={styles.foldTitle}>{tr("views.text.journey_fold", "Teekonnast kaasa minev info")}</summary>
            {children}
          </details>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Saatmine: kellele ja mis viisil, ning iga tegevus eraldi kaardina koos selgitusega. */
export function SendView({ tr, summary, notices, privacyPrompt, choices }) {
  return (
    <StepPanel title={tr("views.send.title", "Saatmine")} lead={tr("preview.no_auto_send", "Midagi ei saadeta automaatselt.")}>
      <div className={styles.stack}>
        {summary ? <p className={styles.notice}>{summary}</p> : null}
        {notices.map((text) => (
          <p key={text} className={styles.quiet}>
            {text}
          </p>
        ))}
        {privacyPrompt}
        <ActionCardGrid label={tr("views.send.title", "Saatmine")}>
          {choices.map((choice) => (
            <ActionCard key={choice.key} title={choice.title} description={choice.description} disabled={choice.disabled} onClick={choice.onClick} />
          ))}
        </ActionCardGrid>
      </div>
    </StepPanel>
  );
}

/**
 * Saadetud pöördumise seis: mis seisus see on, kellele ja millal läks ning mis edasi saab.
 * Muutmist ega uuesti saatmist siin ei ole (server saadetud pöördumist muuta ei luba);
 * otsus, mida näidata, on failis senderModel.js (`sentInquiryView`).
 *
 * `facts`: `[[silt, väärtus]]`; `hint`: lause koos lingiga lehele, kus saab tagasi võtta või
 * parandust saata; `actions`: vaate tegevused (vestlusruum, kopeerimine, alla laadimine).
 */
export function SentStateView({ tr, topic, state, tone, facts, next, hint, actions }) {
  return (
    <StepPanel title={tr("steps.sent_state.title", "Pöördumise seis")} question={topic} actions={actions}>
      <div className={styles.stack}>
        <p className={receiver.state}>
          <span className={lists.chip} data-tone={tone}>
            {state}
          </span>
        </p>
        {facts.length ? (
          <dl className={styles.rows}>
            {facts.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt className={styles.rowLabel}>{label}</dt>
                <dd className={styles.rowValue}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {next ? <p className={styles.quiet}>{next}</p> : null}
        {hint ? (
          <p className={styles.quiet}>
            {hint.text}{" "}
            <a className={styles.textLink} href={hint.href}>
              {hint.label}
            </a>
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Saadetud pöördumise tekst lugemiseks: inimese kirjeldus ja pöördumise tekst, nagu saaja neid näeb. */
export function SentTextView({ tr, lead, situation, text }) {
  return (
    <StepPanel title={tr("steps.sent_text.title", "Pöördumise tekst")} lead={lead}>
      <div className={styles.stack}>
        {situation ? <p className={receiver.situation}>{situation}</p> : null}
        {text ? (
          <>
            <p className={styles.subheading}>{tr("views.sent.text_heading", "Pöördumise tekst")}</p>
            <p className={receiver.text}>{text}</p>
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Üks eelpöördumine pöörduja loendis: teema, seis sõnadega ja üks põhitegevus. Mustandi saab
 * siit ka arhiveerida; saadetud pöördumise muud tegevused on selle lugemisvaates. Rida on
 * madal ja kindla kõrgusega, et lehekülg mahuks paneeli (vana kaart avas rea all lisanuppude
 * ploki ja seitse kaarti olid 1071 px).
 */
function SavedRow({ item }) {
  return (
    <article className={`${lists.card} ${lists.line}`}>
      <div className={lists.lineMain}>
        <h4 className={lists.cardTitle}>{item.title}</h4>
        <p className={lists.lineState}>
          <span className={lists.chip} data-tone={item.tone}>
            {item.state}
          </span>
          {item.meta ? <span className={lists.cardMeta}>{item.meta}</span> : null}
        </p>
      </div>
      <div className={lists.lineActions}>
        {item.archive ? (
          <Button type="button" size="sm" variant="secondary" disabled={item.archive.disabled} onClick={item.archive.onClick}>
            {item.archive.label}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="primary" onClick={item.onOpen}>
          {item.openLabel}
        </Button>
      </div>
    </article>
  );
}

/**
 * Minu eelpöördumised: rühmad (saadetud, mustandid, arhiiv) ja ees oleva rühma üks lehekülg.
 * `groups`: `[{ value, label }]` koos arvudega; `pager`: lehekülje seis (`pageOf`) ja vahetajad.
 */
export function SavedView({ tr, groups, group, onGroup, items, pager, emptyText, onNew }) {
  return (
    <StepPanel
      title={tr("sections.saved", "Minu eelpöördumised")}
      note={pager && pager.pages > 1 ? <Pager tr={tr} pager={pager} /> : null}
      actions={
        <Button type="button" variant="secondary" onClick={onNew}>
          {tr("actions.new_inquiry", "Uus eelpöördumine")}
        </Button>
      }
    >
      <div className={styles.stack}>
        <ChoiceRow
          label={tr("views.saved.groups", "Milliseid eelpöördumisi näidata")}
          labelHidden
          columns={groups.length}
          keepColumns
          options={groups}
          value={group}
          onChange={onGroup}
        />
        {items.length ? (
          <div className={lists.list}>
            {items.map((item) => (
              <SavedRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className={styles.quiet}>{emptyText}</p>
        )}
      </div>
    </StepPanel>
  );
}
