"use client";

/**
 * Kliendi lehe vaated.
 *
 * MIKS. Kliendi leht oli üks pikk keritav leht (proovandmetega 13 000 px,
 * paneel 522): püsikaart, uks, ohutus, võtmed, raha, kirje vorm, päevik ja
 * hooldusjuhi haldus üksteise all. Hooldaja avab lehe ukse taga ühe käega:
 * esimene vaade peab mahtuma ekraanile ja kandma seda, mida enne sisenemist
 * teadma peab.
 *  - `DoorView`      „Ukse taga": nimi, aadress, telefon, kaart „Enne kui
 *                    lähed", viimane teade järgmisele; all „Uks ei avane" ja
 *                    „Kirjuta kirje"
 *  - `HandoversView` kõik viimased teated täies pikkuses
 *  - `PartsView`     osade laud: iga osa on plaat, plaadil on osa seis
 *  - `OldPart`       osa, mille sisu on veel vanal `hc-*` kihil
 *
 * Siin on ainult kuju. Otsused on failis ./clientParts.js, olek ja päringud
 * lehel (`../HomeCareClientPage.jsx`). Kujundus: ./client.module.css ja
 * organisatsioonide lehtede ühised osad (../../org/org.module.css).
 */

import { SMALL } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import styles from "./client.module.css";

/** Märgid nime kõrval (seis, kui klient ei ole teenusel). */
function Chips({ chips }) {
  return chips.map((chip) => (
    <span key={chip.key} className={shared.chip} data-tone={chip.wait ? "wait" : undefined}>
      {chip.text}
    </span>
  ));
}

const BackButton = ({ label, onBack }) => (
  <Button {...SMALL} data-back="1" onClick={onBack}>
    {label}
  </Button>
);

/**
 * „Ukse taga".
 * `client`: { name, chips, state, address, phone: { text, href } | null, contact };
 * `notices`: [{ key, text }]; `alerts`: [{ key, text, onOpen }] (rida viib osasse,
 *   kus midagi ootab);
 * `card`: { title, lines: [{ id, kind, risk, text }], empty, edit: { label, onEdit } | null };
 * `handover`: { title, text, meta, more, onOpen } | null;
 * `actions`: { noAnswer: { label, onOpen } | null, entry: { label, onOpen } | null }.
 */
export function DoorView({ title, client, notices, alerts, card, handover, actions }) {
  return (
    <StepPanel
      title={title}
      actions={
        actions.noAnswer || actions.entry ? (
          <>
            {actions.noAnswer ? (
              <Button {...SMALL} data-door="no-answer" onClick={actions.noAnswer.onOpen}>
                {actions.noAnswer.label}
              </Button>
            ) : null}
            {actions.entry ? (
              <Button type="button" size="sm" variant="primary" data-door="entry" onClick={actions.entry.onOpen}>
                {actions.entry.label}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {/* Järjekord on see, mida enne sisenemist teadma peab: kes ja kus, hoiatused, kaart, teade.
          Laiemal pinnal on teade nime kõrval ja kaart kogu laiuses (read jäävad lühemaks). */}
      <div className={styles.door} data-side={handover ? "1" : undefined}>
        <div className={styles.lead}>
          <ClientHead client={client} />
          {notices.map((notice) => (
            <p key={notice.key} className={shared.notice} data-notice={notice.key}>
              {notice.text}
            </p>
          ))}
          {alerts.length ? (
            <ul className={shared.rows}>
              {alerts.map((alert) => (
                <li key={alert.key} className={shared.rowItem}>
                  <button type="button" className={`${shared.row} ${styles.alert}`} data-alert={alert.key} onClick={alert.onOpen}>
                    <span className={shared.rowTitle}>{alert.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <section className={styles.block} data-area="card" aria-label={card.title}>
          <div className={styles.captionRow}>
            <p className={styles.caption}>{card.title}</p>
            {card.edit ? (
              <button type="button" className={styles.textButton} data-door="card" onClick={card.edit.onEdit}>
                {card.edit.label}
              </button>
            ) : null}
          </div>
          {card.lines.length ? (
            <ul className={styles.card}>
              {card.lines.map((line) => (
                <li key={line.id} className={styles.cardLine} data-card-line={line.id}>
                  <span className={shared.chip} data-tone={line.risk ? "wait" : undefined}>
                    {line.kind}
                  </span>
                  <span className={styles.cardText}>{line.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={shared.quiet}>{card.empty}</p>
          )}
        </section>
        {handover ? (
          <section className={styles.block} data-area="side" aria-label={handover.title}>
            <p className={styles.caption}>{handover.title}</p>
            <button type="button" className={styles.handover} data-door="handovers" onClick={handover.onOpen}>
              <span className={styles.handoverText}>{handover.text}</span>
              <span className={styles.meta}>{handover.meta}</span>
              {handover.more ? <span className={styles.more}>{handover.more}</span> : null}
            </button>
          </section>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Kliendi nimi, seis, aadress ja telefon. Osade laual on ülaserv lühike
 * (`short`: nimi, seis ja aadress): telefon ja kontaktide märkus on vaates
 * „Ukse taga" ja 14 plaati peavad mahtuma paneeli.
 */
function ClientHead({ client, short = false }) {
  return (
    <header className={styles.head}>
      <div className={styles.nameRow}>
        <p className={styles.name} data-client-name="1">
          {client.name}
        </p>
        <Chips chips={client.chips} />
      </div>
      {client.state ? <p className={shared.small}>{client.state}</p> : null}
      {client.address || (client.phone && !short) ? (
        <p className={styles.where}>
          {client.address ? <span>{client.address}</span> : null}
          {client.phone && !short ? (
            <a className={styles.tel} href={client.phone.href} data-client-tel="1">
              {client.phone.text}
            </a>
          ) : null}
        </p>
      ) : null}
      {client.contact && !short ? <p className={`${shared.small} ${styles.contact}`}>{client.contact}</p> : null}
    </header>
  );
}

/** Kõik viimased teated järgmisele täies pikkuses. `items`: [{ id, text, meta }]. */
export function HandoversView({ title, items, back }) {
  return (
    <StepPanel title={title} question={title} actions={<BackButton label={back.label} onBack={back.onBack} />}>
      <ul className={shared.lines}>
        {items.map((item) => (
          <li key={item.id} className={`${shared.lineItem} ${styles.handoverItem}`}>
            <span className={shared.own}>{item.text}</span>
            <span className={styles.meta}>{item.meta}</span>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}

/**
 * Osade laud: kliendi nimi ja iga osa plaadina. `tiles`: [{ key, name, line, wait }].
 * Plaat, kus midagi ootab, on tugevama raamiga.
 */
export function PartsView({ title, client, tiles, onOpen }) {
  return (
    <StepPanel title={title}>
      <div className={shared.stack}>
        <ClientHead client={client} short />
        <ul className={styles.tiles}>
          {tiles.map((tile) => (
            <li key={tile.key}>
              <button type="button" className={styles.tile} data-part={tile.key} data-wait={tile.wait ? "1" : undefined} onClick={() => onOpen(tile.key)}>
                <span className={styles.tileTitle}>{tile.name}</span>
                <span className={styles.tileSummary}>{tile.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </StepPanel>
  );
}

/**
 * Osa, mille sisu on veel vanal `hc-*` kihil: vana komponent `hc-shell`
 * ümbrises (see annab vana kihi muutujad). `back`: alavaatel nupp, mis viib
 * tagasi oma osasse.
 */
export function OldPart({ title, back = null, children }) {
  return (
    <StepPanel title={title} actions={back ? <BackButton label={back.label} onBack={back.onBack} /> : null}>
      <section className={`hc-shell ${styles.old}`}>{children}</section>
    </StepPanel>
  );
}
