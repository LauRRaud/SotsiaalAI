"use client";

/**
 * Teenuseprofiili vaated profiili tasemel: organisatsioon, tutvustus, kontakt,
 * eelpöördumised, piirkond, ligipääsetavus, teenuste ja teeninduskohtade
 * loend, avaldamine ja avaldamise kontroll.
 *
 * MIKS. Leht oli üks väga pikk vorm: organisatsiooni väljad, siis iga teenus
 * oma neljakümne väljaga, siis teeninduskohad ja alles lõpus avaldamine ning
 * ainus salvestamise nupp. Rippvalikud peitsid kuus varianti ühe vajutuse taha,
 * valikurühmad olid eri pikkusega nupud. Nüüd on igal asjal oma väike vaade
 * sammulaval (`components/stage`): valikud on ühelaiused lahtrid, salvestamine
 * on iga vaate all servas ja avaldamise kontroll viib vaatesse, kus puuduv asi
 * parandada.
 *
 * Teenus ja teeninduskoht avanevad loendist omaette vaadetena (ServiceViews.jsx,
 * LocationViews.jsx). Siin on ainult kuju: andmed, päringud ja olek on failis
 * ../WorkspaceFeaturePage.jsx (`ServiceProfileSurface`), reeglid failis
 * profileModel.js.
 *
 * `tp(võti, varutekst)` loeb teksti nimeruumist
 * `workspace_feature_pages.service_profile`.
 *
 * Kujundus: profile.module.css (siin kõrval).
 */

import { useState } from "react";

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { AreaFields, Chip, ItemRow, LineField, Notice, TextField } from "./ProfileFields";
import styles from "./profile.module.css";
import { publishCheckView } from "./profileModel";

/**
 * Asutuse kinnituse seis ühe lausena (`representation`: `{ text, href, warn }`, otsus
 * failis profileModel.js `representationStatus`). Link kinnitamise lehele on lause järel
 * ainult siis, kui sinna saab kohe minna.
 */
function RepresentationLine({ tp, representation }) {
  return (
    <>
      {representation.text}
      {representation.href ? (
        <>
          {" "}
          <a className={styles.textButton} href={representation.href}>
            {tp("representation.open", "Asutuse kinnitamine")}
          </a>
        </>
      ) : null}
    </>
  );
}

/**
 * Nimi ja äriregister: mis on valesti ja kuidas seda parandada. Registri nime saab ühe vajutusega
 * profiilile panna. `register` on `registerNameState` (profileModel.js).
 *
 * Teade on ainult siis, kui midagi on valesti. Kui nimi vastab registrile, ei lisandu vaatesse
 * midagi (seda ütleb avaldamise kontrolli rida): samm „Organisatsioon" on laval üks kõrgemaid ja
 * iga lisarida kasvataks kõigi vaadete ühist kõrgust. Teatega vaade on laval „vaba"
 * (`serviceProfileSteps`, `tallWho`).
 */
function RegisterNameNote({ tp, register, onUse }) {
  if (!register?.problem) return null;
  const text = {
    mismatch: register.registerName
      ? tp("register_name.mismatch", "Äriregistris on selle registrikoodi nimi „{name}”. Profiili saab kinnitada ja avaldada ainult selle nimega.", { name: register.registerName })
      : tp("register_name.mismatch_hidden", "Äriregistris on selle registrikoodi all teine nimi. Kirjuta nimi täpselt nii, nagu see on äriregistris: muu nimega ei saa profiili kinnitada ega avaldada."),
    code_not_listed: tp("register_name.code_not_listed", "Seda registrikoodi ei ole meie äriregistri koopias. Kontrolli koodi: selle koodiga ei saa profiili kinnitada ega avaldada."),
    code_required: tp("register_name.code_required", "Selle nimega asutus on äriregistris. Lisa registrikood: ilma selleta ei saa profiili selle nime all avaldada."),
    unavailable: tp("register_name.unavailable", "Nime ei saa praegu äriregistri vastu kontrollida. Mustandina saab salvestada; avaldada saab siis, kui kontroll jälle töötab.")
  }[register.result];
  if (!text) return null;
  /* Koopia vanus loeb siis, kui register ei tunne koodi või nime: asutus võib olla uus või ümber nimetatud. */
  const dated = register.registerDate && (register.result === "mismatch" || register.result === "code_not_listed");
  return (
    <Notice tone="wait">
      {text}
      {register.result === "mismatch" && register.registerName ? (
        <>
          {" "}
          <button type="button" className={styles.textButton} onClick={onUse}>
            {tp("register_name.use", "Kasuta registri nime")}
          </button>
        </>
      ) : null}
      {/* Samal real, mitte omaette real: teade jääb lühemaks ja vaade madalamaks. */}
      {dated ? (
        <>
          {" "}
          <span className={styles.fieldHint}>
            {tp("register_name.as_of", "Äriregistri seis meie koopias: {date}.", { date: register.registerDate })}
          </span>
        </>
      ) : null}
    </Notice>
  );
}

/** Kes te olete: nimi, registrikood ja organisatsiooni tüüp. */
function WhoView({ tp, form, options, representation, onField, register, note, save }) {
  return (
    <StepPanel title={tp("views.who.title", "Organisatsioon")} note={note} actions={save}>
      <div className={styles.stack}>
        <div className={styles.fields}>
          <LineField size="lg" label={tp("fields.organization", "Organisatsiooni nimi")} value={form.organizationName} onChange={(value) => onField("organizationName", value)} />
          <LineField size="sm" label={tp("fields.registry_code", "Registrikood")} value={form.registryCode} onChange={(value) => onField("registryCode", value)} />
        </div>
        <RegisterNameNote tp={tp} register={register?.state} onUse={register?.onUse} />
        {/* Registrikoodiga profiili avaldamine nõuab asutuse kinnitust: rida ütleb, mis seisus see on.
            Kuni nimi või kood ei vasta äriregistrile, ei saa asutust kinnitada: siis on ees ainult
            teade nime kohta. */}
        {representation && !register?.state?.problem ? (
          <p className={styles.quiet}>
            <RepresentationLine tp={tp} representation={representation} />
          </p>
        ) : null}
        <ChoiceRow keepColumns
          label={tp("fields.organization_type", "Organisatsiooni tüüp")}
          options={options.organizationType}
          value={form.organizationType}
          onChange={(value) => onField("organizationType", value)}
        />
      </div>
    </StepPanel>
  );
}

/** Tutvustus: lühike ja pikem kirjeldus. */
function AboutView({ tp, form, onField, note, save }) {
  return (
    <StepPanel title={tp("views.about.title", "Tutvustus")} note={note} actions={save}>
      <div className={styles.stack}>
        <TextField label={tp("fields.short_description", "Lühikirjeldus")} value={form.shortDescription} rows={3} onChange={(value) => onField("shortDescription", value)} />
        <TextField label={tp("fields.long_description", "Pikem kirjeldus")} value={form.longDescription} rows={3} onChange={(value) => onField("longDescription", value)} />
      </div>
    </StepPanel>
  );
}

/** Organisatsiooni põhikontakt. */
function ContactView({ tp, form, onField, note, save }) {
  return (
    <StepPanel
      title={tp("views.contact.title", "Kontakt")}
      lead={tp("views.contact.lead", "Organisatsiooni põhikontakt. Teenusele ja teeninduskohale saad lisada oma kontakti.")}
      note={note}
      actions={save}
    >
      <div className={styles.fields}>
        <LineField type="email" label={tp("fields.email", "E-post")} value={form.email} onChange={(value) => onField("email", value)} />
        <LineField label={tp("fields.phone", "Telefon")} value={form.phone} onChange={(value) => onField("phone", value)} />
        <LineField label={tp("fields.website", "Veebileht")} value={form.website} onChange={(value) => onField("website", value)} />
        <LineField label={tp("fields.primary_contact_name", "Põhikontakt")} value={form.primaryContactName} onChange={(value) => onField("primaryContactName", value)} />
      </div>
    </StepPanel>
  );
}

/** Kas ja mis teed pidi inimene saab eelpöördumise saata. */
function InquiriesView({ tp, form, onField, note, save }) {
  return (
    <StepPanel
      title={tp("views.inquiries.title", "Eelpöördumiste vastuvõtt")}
      lead={tp("views.inquiries.lead", "Eelpöördumine jõuab kontaktile selles järjekorras: teenuse kontakt, teeninduskoha kontakt, organisatsiooni põhikontakt.")}
      note={note}
      actions={save}
    >
      <div className={styles.cards}>
        <CheckCard
          title={tp("pre_inquiries.accepts_platform", "Võtab vastu Sotsiaal.pro siseseid eelpöördumisi")}
          description={tp("pre_inquiries.platform_help", "Inimene saab saata sisemise eelpöördumise selle teenuseosutaja kontole.")}
          checked={form.acceptsPlatformPreInquiries}
          onChange={(value) => onField("acceptsPlatformPreInquiries", value)}
        />
        <CheckCard
          title={tp("pre_inquiries.accepts_email", "Lubab e-kirja koostamist")}
          description={tp("pre_inquiries.email_help", "Kasutaja saab koostada e-kirja eelvaate, mille ta vaatab enne saatmist üle.")}
          checked={form.acceptsEmailPreInquiries}
          onChange={(value) => onField("acceptsEmailPreInquiries", value)}
        />
      </div>
    </StepPanel>
  );
}

/** Üldine tegevuspiirkond: kirjeldus oma sõnadega, maakond ja omavalitsused registrist. */
function AreaView({ tp, form, area, onField, note, save }) {
  return (
    <StepPanel
      title={tp("views.area.title", "Tegevuspiirkond")}
      lead={tp("views.area.lead", "Kirjelda, millises piirkonnas teenust osutatakse. Kaardimarkerite aadressid lisa teeninduskohtade vaates.")}
      note={note}
      actions={save}
    >
      <AreaFields
        tp={tp}
        area={area}
        county={form.county}
        municipalities={form.serviceAreaMunicipalityIds}
        onCounty={(value) => onField("county", value)}
        onMunicipalities={(value) => onField("serviceAreaMunicipalityIds", value)}
      >
        <LineField size="lg" label={tp("fields.service_area", "Teeninduspiirkond")} value={form.serviceArea} onChange={(value) => onField("serviceArea", value)} />
      </AreaFields>
    </StepPanel>
  );
}

/** Ligipääsetavus: üldine info ja täpsustus. */
function AccessView({ tp, form, onField, note, save }) {
  return (
    <StepPanel title={tp("views.access.title", "Ligipääsetavus")} note={note} actions={save}>
      <div className={styles.stack}>
        <TextField label={tp("fields.accessibility_info", "Üldine ligipääsetavuse info")} value={form.accessibilityInfo} rows={3} onChange={(value) => onField("accessibilityInfo", value)} />
        <TextField
          label={tp("fields.general_accessibility_note", "Ligipääsetavuse täpsustus")}
          value={form.generalAccessibilityNote}
          rows={3}
          onChange={(value) => onField("generalAccessibilityNote", value)}
        />
      </div>
    </StepPanel>
  );
}

/** Teenuste loend: rida avab teenuse vaated. Nimeta teenus ei salvestu ja rida ütleb seda. */
function ServicesView({ tp, options, services, note, save }) {
  const statusText = (status) => options.status.find((option) => option.value === status)?.label || "";
  return (
    <StepPanel
      title={tp("views.services.title", "Teenused")}
      lead={tp("field_help.services", "Kirjelda siin konkreetseid teenuseid. Kategooriad, sihtrühmad, keeled ja pöördumise tingimused salvestuvad teenuse tasemele.")}
      note={note}
      actions={
        <>
          <Button type="button" variant="secondary" disabled={!services.canAdd} onClick={services.onAdd}>
            {tp("service_items.add", "Lisa teenus")}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        {services.notice ? <Notice>{services.notice}</Notice> : null}
        {services.rows.length ? (
          <ul className={styles.rows}>
            {services.rows.map((row) => (
              <ItemRow
                key={row.index}
                title={row.name || tp("views.services.unnamed", "Nimeta teenus")}
                chips={[
                  row.saves ? null : { key: "unnamed", tone: "wait", text: tp("views.services.not_saved", "nimi puudub, ei salvestu") },
                  statusText(row.status) ? { key: "status", tone: row.published ? "ok" : undefined, text: statusText(row.status) } : null
                ].filter(Boolean)}
                openText={tp("views.open", "Ava")}
                onOpen={() => services.onOpen(row.index)}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{tp("service_items.empty", "Eraldi teenuseid ei ole veel lisatud.")}</p>
        )}
        <p className={styles.count}>{tp("views.services.count", "Teenuseid {count}, kuni {max}", { count: services.rows.length, max: services.max })}</p>
      </div>
    </StepPanel>
  );
}

/** Teeninduskohtade loend: rida avab koha vaated. */
function LocationsView({ tp, options, locations, note, save }) {
  const statusText = (status) => options.status.find((option) => option.value === status)?.label || "";
  return (
    <StepPanel
      title={tp("views.locations.title", "Teeninduskohad")}
      lead={tp("field_help.locations", "Teeninduskoht on kaardimarkeri alus. Lisa siia ainult päris teeninduskohad nime ja aadressiga.")}
      note={note}
      actions={
        <>
          <Button type="button" variant="secondary" disabled={!locations.canAdd} onClick={locations.onAdd}>
            {tp("locations.add", "Lisa teeninduskoht")}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        {locations.rows.length ? (
          <ul className={styles.rows}>
            {locations.rows.map((row) => (
              <ItemRow
                key={row.index}
                title={row.title || tp("locations.new_item_title", "Uus teeninduskoht")}
                meta={row.address}
                chips={[
                  row.saves ? null : { key: "empty", tone: "wait", text: tp("views.locations.not_saved", "tühi, ei salvestu") },
                  row.saves && !row.onMap ? { key: "map", text: tp("views.locations.not_on_map", "kaardil ei ole") } : null,
                  statusText(row.status) ? { key: "status", tone: row.status === "PUBLISHED" ? "ok" : undefined, text: statusText(row.status) } : null
                ].filter(Boolean)}
                openText={tp("views.open", "Ava")}
                onOpen={() => locations.onOpen(row.index)}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>{tp("locations.empty", "Teeninduskohti ei ole veel lisatud.")}</p>
        )}
        <p className={styles.count}>{tp("views.locations.count", "Teeninduskohti {count}, kuni {max}", { count: locations.rows.length, max: locations.max })}</p>
      </div>
    </StepPanel>
  );
}

/**
 * Avaldamine: profiili staatus ja kaks eraldi linnukest: leitav teenusekaardil, leitav vestluses (ADR-144).
 * Kumbki ei eelda teist: vestluses leitav osutaja ei pea olema kaardil ja vastupidi.
 * Kui asutus on kinnitamata, ütleb vaade seda enne salvestamist ja staatust
 * „Avaldatud" ei pakuta (`statusOptions` tuleb lehelt, reegel: `statusChoices`).
 * Üldist juhist vaate ülaservas ei ole: märkekaart „Leitav teenusekaardil" ütleb sama asja
 * (profiil on kaardil ainult avaldatuna ja aadressivastega) ja koos juhisega ei mahtunud vaade
 * vene keeles töölaua paneeli (485 px, mahub 464).
 */
function VisibilityView({ tp, form, statusOptions, representation, onField, note, save }) {
  const blocked = Boolean(representation?.warn);
  return (
    <StepPanel title={tp("views.visibility.title", "Avaldamine")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow keepColumns
          label={tp("fields.status", "Profiili staatus")}
          columns={statusOptions.length}
          options={statusOptions}
          value={form.status}
          onChange={(value) => onField("status", value)}
        />
        {blocked ? (
          <Notice tone="wait">
            <RepresentationLine tp={tp} representation={representation} />
          </Notice>
        ) : null}
        <div className={styles.cards}>
          <CheckCard
            title={tp("visibility.visible", "Leitav teenusekaardil")}
            description={tp("visibility.visible_help", "Teenusekaart kuvab profiili ainult siis, kui staatus on avaldatud ja vähemalt ühel kaardil nähtaval teeninduskohal on ametlik aadressivaste.")}
            checked={form.mapVisible}
            onChange={(value) => onField("mapVisible", value)}
          />
          <CheckCard
            title={tp("pre_inquiries.assistant_recommendation_allowed", "Leitav vestluses")}
            description={tp("pre_inquiries.assistant_recommendation_help", "Vestluse assistent nimetab sinu asutust, teenuseid ja üldkontakti inimesele, kes küsib teenust sinu piirkonnas. Ta ei soovita ega võrdle osutajaid.")}
            checked={form.assistantRecommendationAllowed}
            onChange={(value) => onField("assistantRecommendationAllowed", value)}
          />
        </div>
      </div>
    </StepPanel>
  );
}

/** Üks avaldamise kontrolli rida: seis, lause ja tee vaatesse, kus seda saab parandada. */
function CheckRow({ tp, row }) {
  return (
    <li className={styles.check} data-tone={row.blocking ? "risk" : undefined}>
      <Chip tone={row.blocking ? "risk" : row.ok ? "ok" : row.optional ? undefined : "wait"}>
        {row.blocking
          ? tp("views.check.missing", "Puudu")
          : row.ok
            ? tp("views.check.ok", "Korras")
            : row.optional
              ? tp("views.check.optional", "Sinu valik")
              : tp("views.check.review", "Vaata üle")}
      </Chip>
      <span className={styles.checkText}>
        {row.text}
        {row.detail ? <span className={styles.checkDetail}>{row.detail}</span> : null}
      </span>
      {/* Asutuse kinnitamine on omaette leht: sinna viib link, teistel ridadel nupp vaatesse. */}
      {row.target?.href ? (
        <a className={styles.textButton} href={row.target.href}>
          {row.target.name} ›
        </a>
      ) : row.target ? (
        <button type="button" className={styles.textButton} aria-label={row.target.label} onClick={row.target.onClick}>
          {row.target.name} ›
        </button>
      ) : null}
    </li>
  );
}

/**
 * Avaldamise kontroll. Ees on read, mis ei ole korras (takistavad enne), lehekülgede kaupa; rida
 * viib vaatesse, kus seda saab parandada. Korras read on avatavas plokis. Mis on ees, otsustab
 * `publishCheckView` failis profileModel.js; lehekülg on selle vaate enda asi.
 *
 * Enne olid kõik read ühes loendis ja üheksa reaga ei mahtunud vaade töölaua paneeli.
 */
function CheckView({ tp, check, note, save }) {
  const [page, setPage] = useState(0);
  const view = publishCheckView(check.rows, { page });
  return (
    <StepPanel title={tp("views.check.title", "Avaldamise kontroll")} note={note} actions={save}>
      <div className={styles.stack}>
        {check.blocked ? (
          <Notice tone="risk" alert>
            {tp("views.publish_blocked", "Avaldatud profiili ei saa salvestada, kuni puuduv on lisatud.")}
          </Notice>
        ) : null}
        {view.allOk ? (
          <p className={styles.quiet}>{tp("views.check.all_ok", "Kõik kontrollid on korras.")}</p>
        ) : (
          <ul className={styles.checks}>
            {view.open.items.map((row) => (
              <CheckRow key={row.key} tp={tp} row={row} />
            ))}
          </ul>
        )}
        {view.open.pages > 1 ? (
          <p className={styles.line}>
            <span className={styles.count}>{tp("views.check.range", "{from} kuni {to}, kokku {total}", { from: view.open.from, to: view.open.to, total: view.open.total })}</span>
            <button type="button" className={styles.textButton} disabled={view.open.page <= 0} onClick={() => setPage(view.open.page - 1)}>
              ‹ {tp("views.check.prev", "Eelmised")}
            </button>
            <button type="button" className={styles.textButton} disabled={view.open.page >= view.open.pages - 1} onClick={() => setPage(view.open.page + 1)}>
              {tp("views.check.next", "Järgmised")} ›
            </button>
          </p>
        ) : null}
        {view.ok.length ? (
          <details className={styles.fold}>
            <summary className={styles.foldTitle}>{tp("views.check.ok_fold", "Korras · {count}", { count: view.ok.length })}</summary>
            <ul className={styles.checks}>
              {view.ok.map((row) => (
                <CheckRow key={row.key} tp={tp} row={row} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </StepPanel>
  );
}

/** Profiili taseme vaade võtme järgi. */
export default function ProfileStepView({ view, ...props }) {
  switch (view) {
    case "about":
      return <AboutView {...props} />;
    case "contact":
      return <ContactView {...props} />;
    case "inquiries":
      return <InquiriesView {...props} />;
    case "area":
      return <AreaView {...props} />;
    case "access":
      return <AccessView {...props} />;
    case "services":
      return <ServicesView {...props} />;
    case "locations":
      return <LocationsView {...props} />;
    case "visibility":
      return <VisibilityView {...props} />;
    case "check":
      return <CheckView {...props} />;
    default:
      return <WhoView {...props} />;
  }
}
