"use client";

/**
 * Avatud teeninduskoha vaated: koht ise, aadress ja koha kontakt.
 *
 * AADRESS ON OMAETTE VAADE, sest kirjutamise ajal pakub leht ametlikke
 * aadressivasteid ja need vajavad ruumi. Vanal lehel avanes soovituste loend
 * välja alla ja lükkas ülejäänud vormi allapoole; siin on soovitused ühelaiuste
 * lahtritena välja all ja vaates ei ole muud. Kaardimarker tekib ainult
 * valitud vastest, mitte käsitsi kirjutatud tekstist.
 *
 * Siin on ainult kuju: soovituste päring ja olek on failis
 * ../WorkspaceFeaturePage.jsx (`useServiceProfileAddressSearch`).
 *
 * Kujundus: profile.module.css (siin kõrval).
 */

import CheckCard from "@/components/stage/CheckCard";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { SERVICE_PROFILE_LIMITS } from "@/lib/serviceProviderProfileLimits";

import { LineField, Notice, TextField } from "./ProfileFields";
import styles from "./profile.module.css";

/** Koht ise: nimetus, olek ja nähtavus teenusekaardil. Siit saab koha ka eemaldada. */
function PlaceView({ tp, location, options, onField, remove, note, save }) {
  return (
    <StepPanel
      title={tp("views.place.title", "Teeninduskoht")}
      note={note}
      actions={
        <>
          {/* Eemaldamine küsib teist vajutust (silt vahetub); päriselt kaob koht alles salvestamisel. */}
          <Button type="button" variant="secondary" onClick={remove.onClick}>
            {remove.label}
          </Button>
          {save}
        </>
      }
    >
      <div className={styles.stack}>
        <LineField size="lg" label={tp("locations.label", "Nimetus")} value={location.label} onChange={(value) => onField("label", value)} />
        <ChoiceRow
          label={tp("locations.status", "Teeninduskoha olek")}
          columns={options.status.length}
          options={options.status}
          value={location.status}
          onChange={(value) => onField("status", value)}
        />
        <div className={styles.cards}>
          <CheckCard title={tp("locations.visible_on_map", "Näita teenusekaardil")} checked={location.mapVisible} onChange={(value) => onField("mapVisible", value)} />
        </div>
      </div>
    </StepPanel>
  );
}

/** Aadress: kirjutamisel pakutakse ametlikke vasteid; valitud vaste annab kaardimarkeri. */
function AddressView({ tp, address, note, save }) {
  const showList = address.open && (address.loading || address.error || address.suggestions.length > 0);
  const showSuggestions = showList && !address.loading && !address.error && address.suggestions.length > 0;
  return (
    <StepPanel title={tp("views.address.title", "Aadress")} note={note} actions={save}>
      <div className={styles.stack}>
        <LineField
          size="lg"
          label={tp("locations.address", "Aadress")}
          hint={tp("address_search.hint", "Kirjutamisel pakutakse ametlikke aadressivasteid. Kaardil kuvamiseks vali soovitus.")}
          value={address.query}
          maxLength={SERVICE_PROFILE_LIMITS.addressQuery}
          autoComplete="off"
          placeholder={tp("address_search.placeholder", "Alusta aadressi kirjutamist")}
          onFocus={address.onFocus}
          onChange={address.onTyping}
        />
        {showList && address.loading ? <p className={styles.quiet}>{tp("address_search.loading", "Otsin aadresse...")}</p> : null}
        {showList && address.error ? <Notice tone="risk">{address.error}</Notice> : null}
        {showSuggestions ? (
          <div className={styles.suggestions} role="group" aria-label={tp("views.address.suggestions", "Aadressivasted")}>
            {address.suggestions.map((suggestion) => (
              <button
                key={`${suggestion.adsObjectId || suggestion.normalizedAddress}-${suggestion.latitude}-${suggestion.longitude}`}
                type="button"
                className={styles.suggestion}
                onClick={() => address.onSelect(suggestion)}
              >
                {suggestion.label || suggestion.normalizedAddress}
              </button>
            ))}
          </div>
        ) : null}
        {address.selected ? (
          <p className={styles.selected}>
            {tp("address_search.selected", "Valitud ametlik aadressivaste:")} {address.selected}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

function PlaceContactView({ tp, location, onField, note, save }) {
  return (
    <StepPanel title={tp("views.place_contact.title", "Koha kontakt ja lahtiolek")} note={note} actions={save}>
      <div className={styles.stack}>
        <div className={styles.fields}>
          <LineField label={tp("fields.phone", "Telefon")} value={location.phone} onChange={(value) => onField("phone", value)} />
          <LineField type="email" label={tp("fields.email", "E-post")} value={location.email} onChange={(value) => onField("email", value)} />
          <LineField label={tp("fields.website", "Veebileht")} value={location.website} onChange={(value) => onField("website", value)} />
        </div>
        <TextField label={tp("locations.opening_hours", "Lahtiolekuajad")} value={location.openingHours} rows={2} onChange={(value) => onField("openingHours", value)} />
      </div>
    </StepPanel>
  );
}

/** Avatud teeninduskoha vaade võtme järgi. */
export default function LocationStepView({ view, ...props }) {
  switch (view) {
    case "address":
      return <AddressView {...props} />;
    case "place_contact":
      return <PlaceContactView {...props} />;
    default:
      return <PlaceView {...props} />;
  }
}
