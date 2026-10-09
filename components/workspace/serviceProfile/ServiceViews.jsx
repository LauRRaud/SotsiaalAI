"use client";

/**
 * Avatud teenuse vaated: mida pakud, kellele, kuidas ja kus, hind,
 * kättesaadavus, pöördumise tingimused, kontakt ja tegevusluba.
 *
 * MIKS NII PALJU VAATEID. Ühel teenusel on umbes nelikümmend välja. Vanal lehel
 * olid need kõik iga teenuse all üksteise järel, nii et kolme teenusega profiil
 * oli üle saja välja pikk. Siin on vaates üks kuni kolm küsimust, mis käivad
 * kokku, ja teenus avaneb loendist omaette sammudena. Alumise serva olekurida
 * ütleb, millise teenuse juures inimene on, ja viib tagasi loendisse.
 *
 * Rippvalikute asemel on vastusevariandid kohe näha (`ChoiceRow`), mitme valiku
 * rühmad on ühelaiused märgitavad lahtrid (`ChoiceChips`).
 *
 * Siin on ainult kuju: andmed, päringud ja olek on failis
 * ../WorkspaceFeaturePage.jsx (`ServiceProfileSurface`).
 *
 * Kujundus: profile.module.css (siin kõrval).
 */

import CheckCard from "@/components/stage/CheckCard";
import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";

import { AVAILABILITY_NOTE_LIMIT } from "./profileModel";
import { Chip, ChipsField, LineField, Notice, TextField } from "./ProfileFields";
import styles from "./profile.module.css";

/** Teenus ise: nimi, olek ja nähtavus kaardimarkeri all. Siit saab teenuse ka eemaldada. */
function ServiceView({ tp, service, options, onField, remove, note, save }) {
  return (
    <StepPanel
      title={tp("views.service.title", "Teenus")}
      note={note}
      actions={
        <>
          {/* Eemaldamine küsib teist vajutust (silt vahetub); päriselt kaob teenus alles salvestamisel. */}
          <Button type="button" variant="secondary" onClick={remove.onClick}>
            {remove.label}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        <LineField
          size="lg"
          label={tp("service_items.name", "Teenuse nimi")}
          hint={service.name.trim() ? "" : tp("views.service.name_hint", "Nimeta teenust ei salvestata.")}
          value={service.name}
          onChange={(value) => onField("name", value)}
        />
        <ChoiceRow
          label={tp("service_items.status", "Teenuse olek")}
          columns={options.status.length}
          options={options.status}
          value={service.status}
          onChange={(value) => onField("status", value)}
        />
        <div className={styles.cards}>
          <CheckCard title={tp("service_items.visible_in_profile", "Nähtav kaardimarkeri all")} checked={service.mapVisible} onChange={(value) => onField("mapVisible", value)} />
        </div>
      </div>
    </StepPanel>
  );
}

function DescribeView({ tp, service, onField, note, save }) {
  return (
    <StepPanel title={tp("views.describe.title", "Teenuse kirjeldus")} note={note} actions={save}>
      <div className={styles.stack}>
        <TextField label={tp("service_items.description", "Kirjeldus")} value={service.description} rows={3} onChange={(value) => onField("description", value)} />
        <TextField label={tp("service_items.long_description", "Pikem kirjeldus")} value={service.longDescription} rows={3} onChange={(value) => onField("longDescription", value)} />
      </div>
    </StepPanel>
  );
}

function ScopeView({ tp, service, onField, note, save }) {
  return (
    <StepPanel title={tp("views.scope.title", "Mida teenus sisaldab")} note={note} actions={save}>
      <div className={styles.stack}>
        {/* Kaks vastandlikku välja kõrvuti: mis kuulub teenuse sisse ja mis mitte. */}
        <div className={styles.pair}>
          <TextField label={tp("service_items.includes_text", "Mida teenus sisaldab")} value={service.includesText} rows={4} onChange={(value) => onField("includesText", value)} />
          <TextField label={tp("service_items.excludes_text", "Mida teenus ei sisalda")} value={service.excludesText} rows={4} onChange={(value) => onField("excludesText", value)} />
        </div>
        <TextField label={tp("service_items.additional_info", "Lisainfo")} value={service.additionalInfo} rows={2} onChange={(value) => onField("additionalInfo", value)} />
      </div>
    </StepPanel>
  );
}

function CategoryView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.category.title", "Teenuse kategooriad")} note={note} actions={save}>
      {/* Silt on sama mis vaate nimi kiirmenüüs: see jääb ekraanilugejale. */}
      <ChipsField
        label={tp("service_items.categories", "Teenuse kategooriad")}
        labelHidden
        hint={tp("field_help.categories", "Kategooriad on standardvalikud. Neid kasutatakse teenusekaardi otsingus ja eelpöördumiste sobitamises.")}
        value={service.categories}
        options={options.category}
        onChange={(value) => onField("categories", value)}
      />
    </StepPanel>
  );
}

function TargetView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.target.title", "Sihtrühmad")} note={note} actions={save}>
      <ChipsField
        label={tp("service_items.target_groups", "Sihtrühmad")}
        labelHidden
        value={service.targetGroups}
        options={options.targetGroup}
        onChange={(value) => onField("targetGroups", value)}
      />
    </StepPanel>
  );
}

function PeopleView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.people.title", "Vanus ja pöörduja")} note={note} actions={save}>
      <ChipsField label={tp("service_items.age_groups", "Vanusegrupid")} value={service.ageGroups} options={options.ageGroup} onChange={(value) => onField("ageGroups", value)} />
      <ChipsField label={tp("service_items.requester_roles", "Kes võib pöörduda")} value={service.requesterRoles} options={options.requesterRole} onChange={(value) => onField("requesterRoles", value)} />
    </StepPanel>
  );
}

function NeedsView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.needs.title", "Vajadused ja eluvaldkonnad")} note={note} actions={save}>
      <ChipsField label={tp("service_items.need_tags", "Vajadused ja olukorrad")} value={service.needTags} options={options.needTag} onChange={(value) => onField("needTags", value)} />
      <ChipsField label={tp("service_items.life_domains", "Eluvaldkonnad")} value={service.lifeDomains} options={options.lifeDomain} onChange={(value) => onField("lifeDomains", value)} />
    </StepPanel>
  );
}

function DeliveryView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.delivery.title", "Osutamise viis")} note={note} actions={save}>
      <ChipsField label={tp("service_items.delivery_modes", "Osutamise viisid")} value={service.deliveryModes} options={options.deliveryMode} onChange={(value) => onField("deliveryModes", value)} />
      <ChipsField
        label={tp("service_items.communication_support", "Suhtlustugi")}
        value={service.communicationSupport}
        options={options.communicationSupport}
        onChange={(value) => onField("communicationSupport", value)}
      />
    </StepPanel>
  );
}

function LanguagesView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.languages.title", "Keeled")} note={note} actions={save}>
      <ChipsField label={tp("service_items.service_languages", "Teenuse osutamise keeled")} value={service.serviceLanguages} options={options.language} onChange={(value) => onField("serviceLanguages", value)} />
      <ChipsField label={tp("service_items.inquiry_languages", "Pöördumise keeled")} value={service.inquiryLanguages} options={options.language} onChange={(value) => onField("inquiryLanguages", value)} />
    </StepPanel>
  );
}

/** Millistes teeninduskohtades seda teenust osutatakse. Kohti endid lisatakse profiili vaates „Teeninduskohad". */
function PlacesView({ tp, places, note, save }) {
  return (
    <StepPanel
      title={tp("views.places.title", "Teenuse teeninduskohad")}
      note={note}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={places.onManage}>
            {tp("views.places.manage", "Halda teeninduskohti")}
          </Button>
          {save}
        </>
      }
    >
      {places.options.length ? (
        <ChoiceChips label={tp("service_items.locations", "Teeninduskohad")} options={places.options} values={places.values} onToggle={places.onToggle} />
      ) : (
        <p className={styles.quiet}>
          {tp(
            "service_items.location_empty_hint",
            "Lisa esmalt teeninduskoht, kui soovid teenust kaardil kuvada. Teenus võib olla ka ilma füüsilise teeninduskohata, kui osutamise viis on veebis, telefoni teel, inimese kodus või piirkondlikult."
          )}
        </p>
      )}
    </StepPanel>
  );
}

function ReachView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.reach.title", "Teenuse piirkond")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow
          label={tp("service_items.service_area_type", "Piirkonna tüüp")}
          options={options.areaType}
          value={service.serviceAreaType}
          onChange={(value) => onField("serviceAreaType", value)}
        />
        <div className={styles.fields}>
          <LineField size="sm" label={tp("fields.county", "Maakond")} value={service.county} onChange={(value) => onField("county", value)} />
          <LineField label={tp("service_items.municipality_ids", "KOV-id või piirkonnad")} value={service.municipalityIds} onChange={(value) => onField("municipalityIds", value)} />
        </div>
      </div>
    </StepPanel>
  );
}

function ReachNoteView({ tp, service, onField, note, save }) {
  return (
    <StepPanel title={tp("views.reach_note.title", "Piirkonna täpsustus")} note={note} actions={save}>
      <div className={styles.stack}>
        <TextField label={tp("service_items.service_area", "Teeninduspiirkond")} value={service.serviceArea} rows={3} onChange={(value) => onField("serviceArea", value)} />
        <TextField label={tp("service_items.area_description", "Piirkonna täpsustus")} value={service.areaDescription} rows={3} onChange={(value) => onField("areaDescription", value)} />
      </div>
    </StepPanel>
  );
}

function PriceView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.price.title", "Hind")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow label={tp("service_items.fee_type", "Hinnastus")} options={options.fee} value={service.feeType} onChange={(value) => onField("feeType", value)} />
        <LineField size="lg" label={tp("service_items.price_description", "Hinna täpsustus")} value={service.priceDescription} onChange={(value) => onField("priceDescription", value)} />
      </div>
    </StepPanel>
  );
}

/** Kas teenus võtab praegu uusi pöördumisi vastu; ooteaja korral küsib väli ooteaega. */
function AvailabilityView({ tp, service, availability, onField, note, save }) {
  return (
    <StepPanel title={tp("views.availability.title", "Kättesaadavus")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow
          label={tp("service_items.availability_status", "Kättesaadavus")}
          labelHidden
          columns={2}
          options={availability.options}
          value={service.availabilityStatus}
          onChange={(value) => onField("availabilityStatus", value)}
        />
        <TextField
          label={
            service.availabilityStatus === "waitlist"
              ? tp("availability.wait_description", "Ligikaudne ooteaeg")
              : tp("service_items.availability_description", "Kättesaadavuse täpsustus")
          }
          value={service.availabilityDescription}
          rows={2}
          maxLength={AVAILABILITY_NOTE_LIMIT}
          onChange={(value) => onField("availabilityDescription", value)}
        />
      </div>
    </StepPanel>
  );
}

/**
 * Kinnitus, et kättesaadavuse info kehtib. Kinnitada saab salvestatud seisu:
 * kui vormil on salvestamata muudatusi, ütleb vaade seda ja nupp ootab.
 */
function ConfirmView({ tp, confirm, note, save }) {
  return (
    <StepPanel
      title={tp("views.confirm.title", "Kättesaadavuse kinnitus")}
      lead={tp("views.confirm.lead", "Kinnita, kui kättesaadavuse info kehtib. Inimene näeb teenusekaardil, millal infot viimati kinnitati.")}
      note={note}
      actions={
        <>
          <Button type="button" variant="secondary" disabled={confirm.disabled} onClick={confirm.onConfirm}>
            {confirm.busy ? tp("availability.confirming", "Kinnitan...") : tp("availability.confirm", "Kinnitan, et info kehtib")}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        <p className={styles.line}>
          <Chip tone={confirm.tone}>
            <span aria-hidden="true">{confirm.icon}</span> {confirm.label}
          </Chip>
          <span className={styles.quiet}>{confirm.ageText}</span>
        </p>
        {confirm.warning ? <p className={styles.quiet}>{confirm.warning}</p> : null}
        {confirm.hint ? <Notice>{confirm.hint}</Notice> : null}
      </div>
    </StepPanel>
  );
}

function DirectView({ tp, service, options, onField, note, save }) {
  const columns = options.requirement.length;
  return (
    <StepPanel title={tp("views.direct.title", "Otsepöördumine ja suunamine")} note={note} actions={save}>
      <ChoiceRow
        label={tp("service_items.direct_contact_allowed", "Otsekontakt lubatud")}
        columns={columns}
        options={options.requirement}
        value={service.directContactAllowed}
        onChange={(value) => onField("directContactAllowed", value)}
      />
      <ChoiceRow
        label={tp("service_items.requires_ska_referral", "Vajab SKA suunamist")}
        columns={columns}
        options={options.requirement}
        value={service.requiresSkaReferral}
        onChange={(value) => onField("requiresSkaReferral", value)}
      />
      <ChoiceRow
        label={tp("service_items.requires_specialist_referral", "Vajab spetsialisti suunamist")}
        columns={columns}
        options={options.requirement}
        value={service.requiresSpecialistReferral}
        onChange={(value) => onField("requiresSpecialistReferral", value)}
      />
    </StepPanel>
  );
}

function KovView({ tp, service, options, onField, note, save }) {
  const columns = options.requirement.length;
  return (
    <StepPanel title={tp("views.kov.title", "KOV hindamine ja otsus")} note={note} actions={save}>
      <ChoiceRow
        label={tp("service_items.requires_kov_assessment", "Vajab KOV hindamist")}
        columns={columns}
        options={options.requirement}
        value={service.requiresKovAssessment}
        onChange={(value) => onField("requiresKovAssessment", value)}
      />
      <ChoiceRow
        label={tp("service_items.requires_kov_decision", "Vajab KOV otsust")}
        columns={columns}
        options={options.requirement}
        value={service.requiresKovDecision}
        onChange={(value) => onField("requiresKovDecision", value)}
      />
    </StepPanel>
  );
}

function TermsView({ tp, service, onField, note, save }) {
  return (
    <StepPanel title={tp("views.terms.title", "Tingimused ja dokumendid")} note={note} actions={save}>
      <div className={styles.stack}>
        <TextField label={tp("service_items.referral_notes", "Pöördumise tingimused")} value={service.referralNotes} rows={3} onChange={(value) => onField("referralNotes", value)} />
        <TextField
          label={tp("service_items.required_documents_note", "Vajalikud dokumendid")}
          value={service.requiredDocumentsNote}
          rows={3}
          onChange={(value) => onField("requiredDocumentsNote", value)}
        />
      </div>
    </StepPanel>
  );
}

function ChannelsView({ tp, service, options, onField, note, save }) {
  return (
    <StepPanel title={tp("views.channels.title", "Pöördumise viisid")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow label={tp("service_items.contact_mode", "Kontaktiviis")} options={options.contactMode} value={service.contactMode} onChange={(value) => onField("contactMode", value)} />
        <div className={styles.cards}>
          <CheckCard
            title={tp("pre_inquiries.accepts_platform", "Võtab vastu Sotsiaal.pro siseseid eelpöördumisi")}
            checked={service.acceptsPlatformPreInquiries}
            onChange={(value) => onField("acceptsPlatformPreInquiries", value)}
          />
          <CheckCard title={tp("pre_inquiries.accepts_email", "Lubab e-kirja koostamist")} checked={service.acceptsEmailPreInquiries} onChange={(value) => onField("acceptsEmailPreInquiries", value)} />
        </div>
      </div>
    </StepPanel>
  );
}

/** Kas teenus kasutab organisatsiooni põhikontakti või oma kontakti. */
function ServiceContactView({ tp, service, options, onField, onContactStrategy, note, save }) {
  return (
    <StepPanel title={tp("views.service_contact.title", "Teenuse kontakt")} note={note} actions={save}>
      <div className={styles.stack}>
        <ChoiceRow
          label={tp("contact_strategy.label", "Teenuse kontakt")}
          labelHidden
          columns={options.contactStrategy.length}
          options={options.contactStrategy}
          value={service.contactStrategy}
          onChange={onContactStrategy}
        />
        {service.contactStrategy === "CUSTOM" ? (
          <div className={styles.fields}>
            <LineField label={tp("service_items.contact_name", "Kontaktisik")} value={service.contactName} onChange={(value) => onField("contactName", value)} />
            <LineField label={tp("fields.phone", "Telefon")} value={service.phone} onChange={(value) => onField("phone", value)} />
            <LineField type="email" label={tp("fields.email", "E-post")} value={service.email} onChange={(value) => onField("email", value)} />
          </div>
        ) : (
          <p className={styles.quiet}>
            {tp(
              "contact_strategy.inherited_help",
              "Eelpöördumise kontaktivalik kasutab järjekorda: teenuse kontakt, teeninduskoha kontakt, organisatsiooni põhikontakt. Selle teenuse puhul kasutatakse praegu organisatsiooni põhikontakti."
            )}
          </p>
        )}
      </div>
    </StepPanel>
  );
}

/**
 * Tegevusloa seis. Seisu teksti ja tooni annab server ning joonistab
 * `ServiceLicenceStatus` (`children`); siin on selle raam ja uue kontrolli nupp.
 * Kontroll käib kõigi teenuste kohta korraga.
 */
function LicenceView({ tp, service, licence, note, save }) {
  return (
    <StepPanel
      title={tp("views.licence.title", "Tegevusluba")}
      lead={tp("views.licence.lead", "Kontroll käib kõigi teenuste kohta korraga.")}
      note={note}
      actions={
        <>
          <Button type="button" variant="secondary" disabled={licence.checking} onClick={licence.onRecheck}>
            {licence.recheckLabel}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        {licence.notice ? <Notice>{licence.notice}</Notice> : null}
        {/* „Ilmub pärast salvestamist" on tõsi ainult salvestamata teenuse kohta;
            salvestatud teenusel ilma reata (laadimine ebaõnnestus või käib) seda ei öelda. */}
        {licence.hasRow ? (
          <div className={styles.licence}>{licence.children}</div>
        ) : service.id ? null : (
          <p className={styles.quiet}>{tp("views.licence.empty", "Tegevusloa seis ilmub siia pärast teenuse salvestamist.")}</p>
        )}
      </div>
    </StepPanel>
  );
}

/** Avatud teenuse vaade võtme järgi. */
export default function ServiceStepView({ view, ...props }) {
  switch (view) {
    case "describe":
      return <DescribeView {...props} />;
    case "scope":
      return <ScopeView {...props} />;
    case "category":
      return <CategoryView {...props} />;
    case "target":
      return <TargetView {...props} />;
    case "people":
      return <PeopleView {...props} />;
    case "needs":
      return <NeedsView {...props} />;
    case "delivery":
      return <DeliveryView {...props} />;
    case "languages":
      return <LanguagesView {...props} />;
    case "places":
      return <PlacesView {...props} />;
    case "reach":
      return <ReachView {...props} />;
    case "reach_note":
      return <ReachNoteView {...props} />;
    case "price":
      return <PriceView {...props} />;
    case "availability":
      return <AvailabilityView {...props} />;
    case "confirm":
      return <ConfirmView {...props} />;
    case "direct":
      return <DirectView {...props} />;
    case "kov":
      return <KovView {...props} />;
    case "terms":
      return <TermsView {...props} />;
    case "channels":
      return <ChannelsView {...props} />;
    case "service_contact":
      return <ServiceContactView {...props} />;
    case "licence":
      return <LicenceView {...props} />;
    default:
      return <ServiceView {...props} />;
  }
}
