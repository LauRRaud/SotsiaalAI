"use client";

/**
 * Eelpöördumise ülejäänud vaated: abiline, ülevaade, adressaat, tekst, saatmine
 * ja „Minu eelpöördumised".
 *
 * Nagu eelinfo vaated (CollectViews.jsx), ei hoia need olekut: väärtused ja
 * tegevused tulevad lehelt. Loendite kaardid (adressaat, salvestatud
 * eelpöördumine) näitavad ühte põhitegevust; ülejäänu avaneb kaardi seest.
 *
 * Kujundus: views.module.css ja lists.module.css.
 */

import { useState } from "react";

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { LineField } from "./CollectViews";
import lists from "./lists.module.css";
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

/** Ülevaade: mis infot pöördumise koostamiseks kasutatakse ja mis on veel lisamata. */
export function ReviewView({ tr, rows, missing, children }) {
  return (
    <StepPanel
      title={tr("overview.title", "Eelinfo ülevaade")}
      lead={tr("overview.lead", "Siin näed infot, mida kasutatakse pöördumise koostamiseks. Enne saatmist saad kõike muuta.")}
    >
      <div className={styles.stack}>
        {rows.length ? (
          <dl className={styles.rows}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt className={styles.rowLabel}>{label}</dt>
                <dd className={styles.rowValue}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.quiet}>{tr("overview.empty", "Eelinfo täitub töövoo käigus.")}</p>
        )}
        {missing.length ? (
          <>
            <p className={styles.subheading}>{tr("views.review.missing", "Lisamata")}</p>
            <ul className={styles.missing}>
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className={styles.quiet}>{tr("overview.missing_hint", "Need andmed võivad aidata sobivamat kontakti leida, kuid sa ei pea kõike lisama.")}</p>
          </>
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

/** Adressaat: liigi filter, otsing ja soovitatud kontaktid. */
export function RecipientView({ tr, types, type, onType, query, onQuery, confidence, recipients, describe, selectedId, onSelect, hasMore, showMore, onToggleMore }) {
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
          <p className={styles.quiet}>{tr("recipients_hint", "Kontaktide soovitamiseks lisa vähemalt piirkond või KOV ning lühike olukorra kirjeldus.")}</p>
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
        {children}
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

/** Üks salvestatud eelpöördumine: seis sõnadega, üks põhitegevus, ülejäänu avaneb. */
function SavedRow({ tr, item }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={lists.card}>
      <header className={lists.cardHead}>
        <h4 className={lists.cardTitle}>{item.title}</h4>
        <span className={lists.chip} data-tone={item.tone}>
          {item.state}
        </span>
      </header>
      {item.meta ? <p className={lists.cardMeta}>{item.meta}</p> : null}
      <div className={lists.cardActions}>
        <Button type="button" size="sm" variant="primary" onClick={item.onOpen}>
          {item.openLabel}
        </Button>
        <Button type="button" size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? tr("views.saved.less", "Vähem") : tr("views.saved.more", "Veel")}
        </Button>
      </div>
      {open ? (
        <div className={lists.more}>
          {item.actions.map((action) => (
            <Button key={action.key} type="button" size="sm" variant="secondary" disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Minu eelpöördumised: mis on saadetud, mis vastu võetud, mis pooleli. */
export function SavedView({ tr, items, onNew }) {
  return (
    <StepPanel
      title={tr("sections.saved", "Minu eelpöördumised")}
      actions={
        <Button type="button" variant="secondary" onClick={onNew}>
          {tr("actions.new_inquiry", "Uus eelpöördumine")}
        </Button>
      }
    >
      {items.length ? (
        <div className={lists.list}>
          {items.map((item) => (
            <SavedRow key={item.id} tr={tr} item={item} />
          ))}
        </div>
      ) : (
        <p className={styles.quiet}>{tr("empty_saved", "Sul ei ole veel salvestatud eelpöördumisi.")}</p>
      )}
    </StepPanel>
  );
}
