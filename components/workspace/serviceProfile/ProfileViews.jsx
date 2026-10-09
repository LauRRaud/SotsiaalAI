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

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { Chip, ItemRow, LineField, Notice, TextField } from "./ProfileFields";
import styles from "./profile.module.css";

/** Kes te olete: nimi, registrikood ja organisatsiooni tüüp. */
function WhoView({ tp, form, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.who.title", "Organisatsioon")} note={note} actions={save}>
      <div className={styles.stack}>
        <div className={styles.fields}>
          <LineField size="lg" label={tp("fields.organization", "Organisatsiooni nimi")} value={form.organizationName} onChange={(value) => onField("organizationName", value)} />
          <LineField size="sm" label={tp("fields.registry_code", "Registrikood")} value={form.registryCode} onChange={(value) => onField("registryCode", value)} />
        </div>
        <ChoiceRow
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

/** Üldine tegevuspiirkond. */
function AreaView({ tp, form, onField, note, save }) {
  return (
    <StepPanel
      title={tp("views.area.title", "Tegevuspiirkond")}
      lead={tp("views.area.lead", "Kirjelda, millises piirkonnas teenust osutatakse. Kaardimarkerite aadressid lisa teeninduskohtade vaates.")}
      note={note}
      actions={save}
    >
      <div className={styles.fields}>
        <LineField size="lg" label={tp("fields.service_area", "Teeninduspiirkond")} value={form.serviceArea} onChange={(value) => onField("serviceArea", value)} />
        <LineField label={tp("fields.municipalities", "KOV-id või piirkonnad")} value={form.serviceAreaMunicipalityIds} onChange={(value) => onField("serviceAreaMunicipalityIds", value)} />
        <LineField size="sm" label={tp("fields.county", "Maakond")} value={form.county} onChange={(value) => onField("county", value)} />
      </div>
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

/** Avaldamine: profiili staatus, teenusekaardi nähtavus ja assistendi luba. */
function VisibilityView({ tp, form, options, onField, note, save }) {
  return (
    <StepPanel
      title={tp("views.visibility.title", "Avaldamine")}
      lead={tp("publish_help", "Avaldamata ja ülevaatusel profiil ei ilmu teenusekaardile. Avaldatud profiil vajab markeriks ka usaldusväärset aadressivastet.")}
      note={note}
      actions={save}
    >
      <div className={styles.stack}>
        <ChoiceRow
          label={tp("fields.status", "Profiili staatus")}
          columns={options.status.length}
          options={options.status}
          value={form.status}
          onChange={(value) => onField("status", value)}
        />
        <div className={styles.cards}>
          <CheckCard
            title={tp("visibility.visible", "Avalda teenusekaardil")}
            description={tp("visibility.visible_help", "Teenusekaart kuvab profiili ainult siis, kui staatus on avaldatud ja vähemalt ühel kaardil nähtaval teeninduskohal on ametlik aadressivaste.")}
            checked={form.mapVisible}
            onChange={(value) => onField("mapVisible", value)}
          />
          <CheckCard
            title={tp("pre_inquiries.assistant_recommendation_allowed", "Luba assistendil avaldatud teenuseid soovitada")}
            description={tp("pre_inquiries.assistant_recommendation_help", "Avaldatud teenusekirjed lisatakse AI teadmuskihile ainult selle valiku korral.")}
            checked={form.assistantRecommendationAllowed}
            onChange={(value) => onField("assistantRecommendationAllowed", value)}
          />
        </div>
      </div>
    </StepPanel>
  );
}

/**
 * Avaldamise kontroll: mis on korras ja mis mitte. Rida, mis ei ole korras,
 * viib vaatesse, kus seda saab parandada. Rida, mis takistab salvestamist, on
 * eraldi märgitud.
 */
function CheckView({ tp, check, note, save }) {
  return (
    <StepPanel title={tp("views.check.title", "Avaldamise kontroll")} note={note} actions={save}>
      <div className={styles.stack}>
        {check.blocked ? (
          <Notice tone="risk" alert>
            {tp("views.publish_blocked", "Avaldatud profiili ei saa salvestada, kuni puuduv on lisatud.")}
          </Notice>
        ) : null}
        <ul className={styles.checks}>
          {check.rows.map((row) => (
            <li key={row.key} className={styles.check} data-tone={row.blocking ? "risk" : undefined}>
              <Chip tone={row.blocking ? "risk" : row.ok ? "ok" : "wait"}>
                {row.blocking ? tp("views.check.missing", "Puudu") : row.ok ? tp("views.check.ok", "Korras") : tp("views.check.review", "Vaata üle")}
              </Chip>
              <span className={styles.checkText}>
                {row.text}
                {row.detail ? <span className={styles.checkDetail}>{row.detail}</span> : null}
              </span>
              {row.target ? (
                <button type="button" className={styles.textButton} aria-label={row.target.label} onClick={row.target.onClick}>
                  {row.target.name} ›
                </button>
              ) : null}
            </li>
          ))}
        </ul>
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
