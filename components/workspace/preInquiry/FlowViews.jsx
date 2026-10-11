"use client";

/**
 * Eelpöördumise ülejäänud vaated: abiline, ülevaade, adressaat, tekst, saatmine,
 * saadetud pöördumise lugemisvaated (seis ja tekst) ja „Minu eelpöördumised".
 *
 * Nagu eelinfo vaated (CollectViews.jsx), ei hoia need olekut: väärtused ja
 * tegevused tulevad lehelt. Loendid (adressaadid, salvestatud eelpöördumised) on
 * madalad read lehekülgede kaupa; ühe adressaadi kogu info on tema enda vaates.
 *
 * Kujundus: views.module.css ja lists.module.css.
 */

import ActionCard, { ActionCardGrid } from "@/components/stage/ActionCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import { ASSISTANT_MESSAGE_LIMIT, assistantHasNotes, assistantMessagePlace } from "./assistantAnswer";
import { LineField } from "./CollectViews";
import lists from "./lists.module.css";
import receiver from "./receiver.module.css";
import { excerptOf, pageOf } from "./senderModel";
import styles from "./views.module.css";

const TEXT_LIMIT = 12000;

/**
 * Täpsustamine abilisega. Abilise vastus on osadena (`answer`, reegel: assistantAnswer.js):
 * kiire abi hoiatus, sõnumi algus ja järgmine küsimus on ees, sisestusriba (`children`) nende
 * all; märksõnad, üldised märkused ja pika sõnumi terve tekst avanevad soovi korral.
 *
 * Enne oli vastus vestlusmullis inimese kirjelduse mulli all: 806 px (mahub 445) ja töölaua
 * paneelis, kus kõrgeim vaade määrab lava kõrguse, keris pärast vastust iga samm. Inimese
 * kirjeldust siin enam ei korrata: see on sammus „Olukord".
 */
export function AssistantView({ tr, answer, busy, children }) {
  const answered = Boolean(answer?.answered);
  const place = assistantMessagePlace(answer);
  return (
    <StepPanel
      title={tr("views.assistant.title", "Täpsusta abilisega")}
      lead={answered ? undefined : tr("views.assistant.lead", "Abiline küsib täpsustusi ja aitab leida sobiva kontakti. Selle sammu võid vahele jätta.")}
    >
      <div className={styles.assistant}>
        {answered ? (
          <>
            {/* Kiire abi hoiatused ühes kastis: kolm eraldi kasti ei mahtunud töölaua paneeli. */}
            {answer.urgent.length ? (
              <div className={styles.notice} data-tone="risk" role="alert">
                {answer.urgent.map((text) => (
                  <p key={text} className={styles.noticeLine}>
                    {text}
                  </p>
                ))}
              </div>
            ) : null}
            {place.inline !== "none" ? (
              <p className={styles.quiet}>{place.inline === "start" ? excerptOf(answer.message, ASSISTANT_MESSAGE_LIMIT) : answer.message}</p>
            ) : null}
            {answer.question ? <p className={styles.ask}>{answer.question}</p> : null}
          </>
        ) : null}
        {busy ? (
          <p className={styles.quiet} aria-live="polite">
            {tr("actions.assisting", "Otsin...")}
          </p>
        ) : null}
        {children}
        {assistantHasNotes(answer) ? (
          <details className={styles.fold}>
            <summary className={styles.foldTitle}>{tr("views.assistant.notes", "Abilise märkused")}</summary>
            {place.folded ? <p className={styles.quiet}>{answer.message}</p> : null}
            {answer.tags.length ? (
              <p className={styles.quiet}>
                {tr("views.assistant.tags", "Märksõnad")}: {answer.tags.join(", ")}
              </p>
            ) : null}
            {answer.notes.map((text) => (
              <p key={text} className={styles.quiet}>
                {text}
              </p>
            ))}
          </details>
        ) : null}
      </div>
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

/**
 * Üks adressaat loendis: nimi, liik ja üks rida selle kohta, kus ja millega ta tegeleb. Rida
 * avab kontakti vaate; valik tehakse seal. Rida on madal ja kindla kõrgusega (vana kaart oli
 * 205 kuni 352 px ja kolm kaarti ei mahtunud paneeli).
 */
function RecipientRow({ item, glow }) {
  return (
    <article className={`${lists.card} ${lists.line}`} data-selected={item.selected ? "true" : undefined}>
      <div className={lists.lineMain}>
        <h4 className={lists.cardTitle}>{item.title}</h4>
        <p className={lists.lineState}>
          {item.selected ? (
            <span className={lists.chip} data-tone="ok">
              {item.selectedLabel}
            </span>
          ) : null}
          <span className={lists.chip}>{item.typeLabel}</span>
          {item.meta ? <span className={lists.cardMeta}>{item.meta}</span> : null}
        </p>
      </div>
      <div className={lists.lineActions}>
        <Button type="button" size="sm" variant="primary" glow={glow} onClick={item.onOpen}>
          {item.openLabel}
        </Button>
      </div>
    </article>
  );
}

/**
 * Adressaadi loend. Üks filtririda: abilise soovitused (kui neid on) ja kolm adressaadi liiki;
 * soovituste juures on abilise hinnang, liigi või tühja valiku juures otsinguväli. Loend on
 * lehekülgede kaupa (`pager`). `emptyText` ütleb, miks loend on tühi (otsus:
 * `recipientEmptyReason` failis senderModel.js) ja `hint`, kust kontaktid tulevad.
 *
 * Paneeli ülaservas juhist ei ole: koos filtri, välja, kolme rea ja lehitsejaga ei mahtunud
 * see töölaua paneeli. Sammu nimi on kiirmenüüs.
 */
export function RecipientListView({ tr, glow = true, filters, filter, onFilter, searching, query, onQuery, confidence, items, pager, emptyText, hint }) {
  return (
    <StepPanel title={tr("views.recipient.title", "Adressaat")} note={pager && pager.pages > 1 ? <Pager tr={tr} pager={pager} /> : null}>
      <div className={styles.stack}>
        <div className={styles.toggles} data-count={filters.length} role="group" aria-label={tr("views.recipient.filters", "Milliseid kontakte näidata")}>
          {filters.map(({ value, label }) => (
            <button key={value} type="button" className={styles.toggle} aria-pressed={filter === value} onClick={() => onFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        {searching ? (
          <LineField
            label={tr("fields.recipient_search", "Otsi adressaati")}
            value={query}
            placeholder={tr("placeholders.recipient", "Nimi, omavalitsus või teenus")}
            onChange={onQuery}
          />
        ) : confidence ? (
          <p className={styles.quiet}>
            {tr("routing.confidence", "Kontaktisoovituse kindlus")}: {confidence.label || confidence.level}
            {confidence.text ? `. ${confidence.text}` : ""}
          </p>
        ) : null}
        {items.length ? (
          <div className={lists.list}>
            {items.map((item) => (
              <RecipientRow key={item.id} item={item} glow={glow} />
            ))}
          </div>
        ) : (
          <>
            <p className={styles.quiet} aria-live="polite">
              {emptyText}
            </p>
            {hint ? <p className={styles.quiet}>{hint}</p> : null}
          </>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks kontakt: kes ta on, miks ta võib sobida, kus ta asub ja mis teel pöördumine läheb.
 * `choose` on vaate põhitegevus: KOV kontaktil ja vastuvõtulaual „Vali see kontakt",
 * mitme teenusega teenuseosutajal „Vali teenus" (avab teenuse valiku vaate). `missing` on
 * lause, miks seda kontakti valida ei saa. `onBack` viib tagasi loendisse.
 *
 * Teenusekaardid olid algul siin samas vaates: koos andmetega oli vaade töölaua paneelis
 * 491 px (mahub 461). Suunamise vajaduse ja kättesaadavuse hoiatus on saatmise sammus valitud
 * teenuse kohta, mitte siin kõigi kohta.
 */
export function RecipientContactView({ tr, glow = true, contact, onBack }) {
  return (
    <StepPanel
      title={tr("views.recipient.title", "Adressaat")}
      question={contact.title}
      note={
        <button type="button" className={styles.textLink} onClick={onBack}>
          ‹ {tr("views.recipient.back", "Kõik kontaktid")}
        </button>
      }
      actions={
        contact.choose ? (
          <Button type="button" variant={contact.choose.quiet ? "secondary" : "primary"} glow={glow && !contact.choose.quiet} onClick={contact.choose.onClick}>
            {contact.choose.label}
          </Button>
        ) : null
      }
    >
      <div className={styles.stack}>
        <p className={styles.chips}>
          {contact.selected ? (
            <span className={lists.chip} data-tone="ok">
              {tr("views.recipient.chosen", "Valitud")}
            </span>
          ) : null}
          <span className={lists.chip}>{contact.typeLabel}</span>
        </p>
        {contact.description ? <p className={styles.quiet}>{contact.description}</p> : null}
        {contact.reason ? <p className={styles.quiet}>{contact.reason}</p> : null}
        {contact.facts.length ? (
          <dl className={styles.rows}>
            {contact.facts.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt className={styles.rowLabel}>{label}</dt>
                <dd className={styles.rowValue}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {contact.missing ? <p className={styles.quiet}>{contact.missing}</p> : null}
        {contact.links.length ? (
          <p className={styles.linkRow}>
            {contact.links.map((link) => (
              <a key={link.href} className={styles.textLink} href={link.href}>
                {link.label}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Teenuseosutaja teenuse valik: iga teenus on kaart nime ja kättesaadavusega; vajutus valib
 * adressaadi koos teenusega. Teenused on lehekülgede kaupa (`pager`); `onBack` viib tagasi
 * kontakti vaatesse.
 */
export function RecipientServicesView({ tr, provider, services, pager, onBack }) {
  return (
    <StepPanel
      title={tr("views.recipient.title", "Adressaat")}
      question={tr("views.recipient.services", "Mis teenuse kohta pöördud?")}
      lead={provider}
      note={
        <button type="button" className={styles.textLink} onClick={onBack}>
          ‹ {tr("views.recipient.back_contact", "Kontakti andmed")}
        </button>
      }
      actions={pager && pager.pages > 1 ? <Pager tr={tr} pager={pager} /> : null}
    >
      <div className={styles.pairCards}>
        {services.map((service) => (
          <ActionCard key={service.key} title={service.title} description={service.description} pressed={service.pressed} onClick={service.onClick} />
        ))}
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

/**
 * Saatmine: kellele ja mis teel. Kohaletoimetamise tegevused (`choices`: saada platvormis, ava
 * e-kirjana, kinnita e-kirja saatmine) on kaardid koos selgitusega; salvestamine, kopeerimine
 * ja alla laadimine (`actions`) on vaate jaluses nuppudena, selgitus vihjena. `note` on lehe
 * teade selle vaate tegevuse kohta („salvestati"): jaluses ei võta see vaatelt kõrgust.
 *
 * Enne olid kõik tegevused kaardid: viie kaardiga (e-kirja adressaat pärast salvestamist) oli
 * vaade töölaua paneelis 471 px ja koos teenuseosutaja teadetega 561 px (mahub 461). Töölaua
 * paneelis määrab kõrgeim vaade kogu lava kõrguse, nii et siis kerisid kõik sammud.
 * Isikuandmete küsimus (`privacyPrompt`) on ees üksi: enne otsust ei ole midagi saata.
 */
export function SendView({ tr, summary, notices, privacyPrompt, choices, actions, note }) {
  return (
    <StepPanel
      title={tr("views.send.title", "Saatmine")}
      note={note || null}
      actions={actions.map((action) => (
        <Button key={action.key} type="button" size="sm" variant="secondary" disabled={action.disabled} title={action.hint} onClick={action.onClick}>
          {action.label}
        </Button>
      ))}
    >
      <div className={styles.stack}>
        {privacyPrompt ? (
          privacyPrompt
        ) : (
          <>
            {summary ? <p className={styles.quiet}>{summary}</p> : null}
            {notices.map((text) => (
              <p key={text} className={styles.quiet}>
                {text}
              </p>
            ))}
            {choices.length ? (
              <ActionCardGrid label={tr("views.send.title", "Saatmine")}>
                {choices.map((choice) => (
                  <ActionCard key={choice.key} title={choice.title} description={choice.description} disabled={choice.disabled} onClick={choice.onClick} />
                ))}
              </ActionCardGrid>
            ) : null}
          </>
        )}
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
