"use client";

/**
 * Kliendi lehe transpordi vaated.
 *
 * MIKS. Transport oli pika lehe keskel üks lõik: iga sõidu all nupud, vastuse
 * vorm avanes rea sisse ja soovi vorm loendi alla. Nüüd on ees üks asi korraga.
 *  - `TransportView`   järgmine sõit ja eesolevad sõidud ning soovid ridadena
 *                      (esimene lehekülg ja „Näita veel"); rida avab sõidu
 *  - `RideView`        üks sõit: kuhu, mida on vaja ja mis seisus see on;
 *                      hooldusjuhi vastus ja tagasivõtmine (küsib teist vajutust)
 *  - `RideAnswerView`  hooldusjuhi vastus: mis kell auto tuleb või miks ei saa
 *  - `RideRequestView` uus soov („Telli transport")
 *  - `RideCardView`    transpordikaart: mis leht see on ja selle avamine
 *
 * Sõitu ennast platvorm ei telli. Siin on ainult kuju. Otsused on failis
 * ./transportRows.js, olek ja päringud konksus ./useClientTransport.js, kokku
 * paneb need ./ClientTransport.jsx. Kujundus: ./transport.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { Facts, SMALL, footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import styles from "./transport.module.css";

const BackButton = ({ back }) => (
  <Button {...SMALL} data-back="1" onClick={back.onBack}>
    {back.label}
  </Button>
);

const SaveButton = ({ save, form, mark }) => (
  <Button type="submit" form={form} size="sm" variant="primary" data-transport={mark} disabled={save.disabled} aria-busy={save.busy ? "true" : undefined}>
    {save.label}
  </Button>
);

/** Seisu märk. `chip`: { text, tone }. */
const StateChip = ({ chip }) => (
  <span className={shared.chip} data-tone={chip.tone || undefined}>
    {chip.text}
  </span>
);

/** Lause väli sildiga. `field`: { label, value, onChange, max, required }. */
function TextField({ field, mark }) {
  return (
    <label className={`${shared.line} ${styles.wide}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <input className={shared.input} value={field.value} onChange={(event) => field.onChange(event.target.value)} maxLength={field.max} required={field.required} autoComplete="off" data-ride-field={mark} />
    </label>
  );
}

/** Lühike väli (päev, kellaaeg) brauseri enda valijaga. `field`: { label, value, onChange, min, required }. */
function ShortField({ field, type, mark }) {
  return (
    <label className={`${shared.line} ${styles.short}`}>
      <span className={shared.fieldLabel}>{field.label}</span>
      <Input className={shared.input} type={type} value={field.value} min={field.min || undefined} onChange={(event) => field.onChange(event.target.value)} required={field.required} data-ride-field={mark} />
    </label>
  );
}

/**
 * Eesolevad sõidud ja soovid.
 * `name`: kliendi nimi vaate ülaservas; `next`: järgmise korraldatud sõidu lause või tühi;
 * `rows`: [{ key, title, line, chip: { text, tone } }]; `onOpen(key)` avab sõidu;
 * `empty`: lause, kui sõite ega soove ei ole;
 * `more`: { label, onMore } või null; `card`: { label, onOpen } või null (transpordikaart);
 * `request`: { label, onRequest } või null („Telli transport").
 */
export function TransportView({ title, name, next, rows, onOpen, empty, busy, notice, more, card, request }) {
  return (
    <StepPanel
      title={title}
      question={name}
      note={footNote(notice)}
      actions={
        more || card || request ? (
          <>
            {more ? (
              <Button {...SMALL} data-transport="more" onClick={more.onMore}>
                {more.label}
              </Button>
            ) : null}
            {card ? (
              <Button {...SMALL} data-transport="card" onClick={card.onOpen}>
                {card.label}
              </Button>
            ) : null}
            {request ? (
              <Button type="button" size="sm" variant="primary" data-transport="request" onClick={request.onRequest}>
                {request.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        {next ? (
          <p className={shared.notice} data-transport="next">
            {next}
          </p>
        ) : null}
        {rows.length ? (
          <ul className={shared.rows}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <button type="button" className={`${shared.row} ${styles.ride}`} data-ride-row={row.key} onClick={() => onOpen(row.key)}>
                  <span className={styles.main}>
                    <span className={shared.rowTitle}>{row.title}</span>
                    <span className={shared.rowSub}>{row.line}</span>
                  </span>
                  {/* Märk on rea enda teine veerg (mitte märkide rühm): telefonis jääb see päeva kõrvale. */}
                  <StateChip chip={row.chip} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={shared.quiet}>{empty}</p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Üks sõit. `when`: päev ja kellaaeg; `chip`: { text, tone }; `destination`: kuhu ja milleks;
 * `needs`: { label, value } või null (mida on vaja); `state`: seis ühe lausena;
 * `actions`: [{ key, label, armed, onPress }] (lahtrid; tagasivõtmine küsib teist vajutust);
 * `consequence`: lause, mis juhtub (pärast esimest vajutust).
 */
export function RideView({ title, when, chip, destination, needs, state, actions, consequence, busy, notice, back }) {
  return (
    <StepPanel title={title} note={footNote(notice, consequence)} actions={<BackButton back={back} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <header className={shared.headBar}>
          <p className={shared.headName}>{when}</p>
          <StateChip chip={chip} />
        </header>
        <p className={shared.own} data-ride="destination">
          {destination}
        </p>
        {needs ? <Facts rows={[{ key: "needs", label: needs.label, value: needs.value }]} /> : null}
        <p className={`${shared.quiet} ${styles.made}`} data-ride="state">
          {state}
        </p>
        {actions.length ? (
          <div className={shared.cells} role="group" aria-label={title}>
            {actions.map((action) => (
              <button key={action.key} type="button" className={shared.cellButton} data-armed={action.armed ? "1" : undefined} data-ride-action={action.key} onClick={action.onPress}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Hooldusjuhi vastus. `when`, `destination`: mis sõidule vastatakse;
 * `form`: { id, onSubmit }; `pickup`: { label, value, onChange } või null (mis kell auto tuleb; ainult korraldatud sõidul);
 * `note`: { label, value, onChange, max, required } (märkus hooldajale või miks ei saa).
 */
export function RideAnswerView({ title, when, destination, form, pickup, note, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={when}
      lead={destination}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} mark="answer" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        {pickup ? <ShortField field={pickup} type="time" mark="pickup" /> : null}
        <TextField field={note} mark="answer" />
      </form>
    </StepPanel>
  );
}

/**
 * Uus soov. `form`: { id, onSubmit }; `day`: { label, value, onChange, min, required };
 * `time`: { label, value, onChange }; `destination`, `needs`: lause väljad;
 * `hint`: kuhu soov läheb (vaikne rida all servas).
 */
export function RideRequestView({ title, form, day, time, destination, needs, hint, save, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice, hint)}
      actions={
        <>
          <BackButton back={back} />
          <SaveButton save={save} form={form.id} mark="save" />
        </>
      }
    >
      <form id={form.id} className={shared.stack} onSubmit={form.onSubmit} aria-busy={save.busy ? "true" : undefined}>
        <div className={styles.when}>
          <ShortField field={day} type="date" mark="day" />
          <ShortField field={time} type="time" mark="time" />
        </div>
        <TextField field={destination} mark="destination" />
        <TextField field={needs} mark="needs" />
      </form>
    </StepPanel>
  );
}

/**
 * Transpordikaart: leht transpordi korraldajale. `text`: mis sellel lehel on;
 * `open`: { label, onOpen, busy } (leht avaneb uues aknas ja prinditakse brauserist).
 */
export function RideCardView({ title, text, open, notice, back }) {
  return (
    <StepPanel
      title={title}
      question={title}
      note={footNote(notice)}
      actions={
        <>
          <BackButton back={back} />
          <Button type="button" size="sm" variant="primary" data-transport="card-open" aria-busy={open.busy ? "true" : undefined} onClick={open.onOpen}>
            {open.label}
          </Button>
        </>
      }
    >
      <p className={shared.quiet}>{text}</p>
    </StepPanel>
  );
}
