"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getHelpUiText } from "./helpUiText";

const HELP_CATEGORY_OPTIONS = [
  { value: "TRANSPORT", label: "Transport" },
  { value: "DAILY_TASKS", label: "Igapäevaabi" },
  { value: "HOME_HELP", label: "Koduabi" },
  { value: "DIGITAL_HELP", label: "Digiabi" },
  { value: "CARE_SUPPORT", label: "Tugi ja hooldus" },
  { value: "CHILD_YOUTH_SUPPORT", label: "Laste ja noorte tugi" },
  { value: "LEARNING_GUIDANCE", label: "Õppimise ja juhendamise abi" },
  { value: "SOCIAL_SUPPORT", label: "Seltskond ja sotsiaalne tugi" },
  { value: "ADMIN_FORM_HELP", label: "Asjaajamise ja vormide abi" },
  { value: "OTHER", label: "Muu abi" }
];

const TARGET_GROUP_OPTIONS = [
  { value: "CHILD", label: "Laps" },
  { value: "YOUTH", label: "Noor" },
  { value: "ADULT", label: "Täiskasvanu" },
  { value: "ELDER", label: "Eakas" }
];

const TARGET_GROUP_OPTION_VALUES = new Set(TARGET_GROUP_OPTIONS.map((option) => option.value));

function normalizeComparableText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|·•]+/g, " ")
    .trim();
}

function includesComparable(haystack = "", needle = "") {
  const left = normalizeComparableText(haystack);
  const right = normalizeComparableText(needle);
  if (!left || !right) return false;
  return left.includes(right);
}

function buildCleanDescription(listing = {}) {
  const text = String(listing?.description || "").trim();
  if (!text) return "";
  const match = text.match(/\b(?:Põhikategooria|Omavalitsus|Täpsem asukoht|Sihtrühm|Abi vorm|Tasu info|Ajalisus|Saadavus\s*\/\s*algus|Lisatingimused|Tingimused|Oskused või taust):/iu);
  const cleaned = match?.index > 0 ? text.slice(0, match.index) : text;
  return cleaned.trim();
}

function buildInfoItems(listing = {}, ui = {}) {
  const summary = String(listing.summary || "").trim();
  const items = [];

  if (listing.categoryLabel) {
    items.push({ label: ui.category || "Category", value: listing.categoryLabel });
  }

  if (listing.municipalityLabel && !includesComparable(summary, listing.municipalityLabel)) {
    items.push({ label: ui.municipality || "Municipality", value: listing.municipalityLabel });
  }

  if (listing.helpTypeLabel && !includesComparable(summary, listing.helpTypeLabel)) {
    items.push({ label: ui.helpType, value: listing.helpTypeLabel });
  }

  if (listing.timeTypeLabel && !includesComparable(summary, listing.timeTypeLabel)) {
    items.push({ label: ui.timeType, value: listing.timeTypeLabel });
  }

  if (Array.isArray(listing.targetGroupLabels) && listing.targetGroupLabels.length) {
    items.push({ label: ui.targetGroups, value: listing.targetGroupLabels.join(", ") });
  }

  if (
    listing.rawPlace &&
    !includesComparable(summary, listing.rawPlace) &&
    !includesComparable(listing.municipalityLabel, listing.rawPlace)
  ) {
    items.push({ label: ui.location || "Location", value: listing.rawPlace });
  }

  if (listing.availabilityOrStart) {
    items.push({ label: ui.availabilityOrStart || "Availability", value: listing.availabilityOrStart });
  }

  if (listing.compensationDetails) {
    items.push({ label: ui.compensationDetails || "Compensation", value: listing.compensationDetails });
  }

  if (listing.conditions) {
    items.push({ label: ui.conditions || "Conditions", value: listing.conditions });
  }

  return items;
}

function FieldLabel({ children }) {
  return <span>{children}</span>;
}

function DropdownField({ label, value, onChange, options = [] }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <DocumentsDropdown
        value={value}
        onChange={onChange}
        options={options}
        placeholder="-"
        ariaLabel={label}
      />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder = "" }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 3 }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        rows={rows}
      />
    </label>
  );
}

function TargetGroupsField({ label, value = [], onChange }) {
  const selectedValues = Array.isArray(value) ? value : [];
  const toggleValue = (nextValue) => {
    const exists = selectedValues.includes(nextValue);
    const nextValues = exists
      ? selectedValues.filter((item) => item !== nextValue)
      : [...selectedValues, nextValue];
    onChange?.(nextValues);
  };

  return (
    <fieldset>
      <legend>{label}</legend>
      <div>
        {TARGET_GROUP_OPTIONS.map((option) => {
          const selected = selectedValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleValue(option.value)}
              aria-pressed={selected ? "true" : "false"}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function SelectedListingContext({
  locale: _locale = "et",
  inline = false,
  loading = false,
  error = "",
  listing = null,
  isOwn = false,
  canDelete = false,
  editState = null,
  connectOptions = [],
  selectedConnectListingId = "",
  busyAction = "",
  onSelectConnectListing,
  onConnect,
  onStartEdit,
  onChangeEditField,
  onCancelEdit,
  onSaveEdit,
  onDeleteListing,
  onDismiss
}) {
  const { t } = useI18n();
  const ui = getHelpUiText(t);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (inline || !isMounted || (!listing && !loading && !error)) return undefined;
    const root = document.documentElement;
    document.body.classList.toggle("modal-open", true);
    root.classList.toggle("modal-open", true);
    document.body.classList.toggle("selected-listing-modal-open", true);
    root.classList.toggle("selected-listing-modal-open", true);
    return () => {
      document.body.classList.remove("modal-open");
      root.classList.remove("modal-open");
      document.body.classList.remove("selected-listing-modal-open");
      root.classList.remove("selected-listing-modal-open");
    };
  }, [error, inline, isMounted, listing, loading]);

  if (!inline && (!isMounted || typeof document === "undefined")) {
    return null;
  }

  if (!listing && !loading && !error) {
    return null;
  }

  const kindActionLabel = listing?.kind === "request" ? ui.offerHelp : ui.contact;
  const connectDisabled = !selectedConnectListingId || busyAction === "connect";
  const descriptionValue = editState?.description ?? listing?.editableDescription ?? listing?.description ?? "";
  const categoryCodeValue = editState?.primaryCategoryCode ?? listing?.primaryCategoryCode ?? "";
  const helpTypeValue = editState?.helpType ?? listing?.helpType ?? "";
  const timeTypeValue = editState?.timeType ?? listing?.timeType ?? "";
  const targetGroupCodesValue = (Array.isArray(editState?.targetGroupCodes)
    ? editState.targetGroupCodes
    : (Array.isArray(listing?.targetGroupCodes) ? listing.targetGroupCodes : []))
    .filter((code) => TARGET_GROUP_OPTION_VALUES.has(code));
  const rawPlaceValue = editState?.rawPlace ?? listing?.editableRawPlace ?? listing?.rawPlace ?? "";
  const availabilityOrStartValue = editState?.availabilityOrStart ?? listing?.editableAvailabilityOrStart ?? listing?.availabilityOrStart ?? "";
  const compensationDetailsValue = editState?.compensationDetails ?? listing?.editableCompensationDetails ?? listing?.compensationDetails ?? "";
  const conditionsValue = editState?.conditions ?? listing?.editableConditions ?? listing?.conditions ?? "";
  const infoItems = listing ? buildInfoItems(listing, ui) : [];
  const cleanDescription = listing ? buildCleanDescription(listing) : "";
  const selectedListingContentClassName = "selected-listing-modal-content";
  const selectedListingBodyClassName = inline
    ? "selected-listing-body selected-listing-body--inline"
    : "selected-listing-body";
  const selectedListingPanelClassName = inline
    ? "selected-listing-panel--inline"
    : undefined;
  const statusRowVisible = Boolean(listing?.statusLabel || (isOwn && listing));

  const selectedListingContent = (
    <>
      <SubpageHeader
        onBack={onDismiss}
        backAriaLabel={ui.close}
        titleAs="h2"
      >
        {loading ? ui.loading : listing?.title || ui.selectedListing}
      </SubpageHeader>

      {statusRowVisible ? (
        <div>
          <p>
            {listing?.statusLabel ? <span>{listing.statusLabel}</span> : null}
            {listing?.statusLabel && isOwn ? (
              <span aria-hidden="true">|</span>
            ) : null}
            {isOwn ? <span>{ui.ownListing}</span> : null}
          </p>
        </div>
      ) : null}

      <div className={selectedListingBodyClassName}>
        <Panel
          variant="subpage"
          padding="sm"
          className={selectedListingPanelClassName}
        >
          {loading ? <div>{ui.loading}</div> : null}
          {!loading && error ? <div>{error}</div> : null}
          {!loading && listing ? (
            <div className="selected-listing-detail-grid">
              {listing.summary ? (
                <p>
                  {listing.summary}
                </p>
              ) : null}
              {cleanDescription ? <div>{cleanDescription}</div> : null}
              {infoItems.length ? (
                <dl className="selected-listing-info-list">
                  {infoItems.map((item) => (
                    <div key={`${item.label}-${item.value}`}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {editState ? (
                <div className="documents-workspace">
                  <TextField
                    label={ui.title}
                    value={editState.title}
                    onChange={(value) => onChangeEditField?.("title", value)}
                    placeholder={ui.title}
                  />
                  <TextAreaField
                    label={ui.description}
                    value={descriptionValue}
                    onChange={(value) => onChangeEditField?.("description", value)}
                    rows={5}
                  />
                  <div>
                    <DropdownField
                      label={ui.category}
                      value={categoryCodeValue}
                      onChange={(value) => onChangeEditField?.("primaryCategoryCode", value)}
                      options={HELP_CATEGORY_OPTIONS}
                    />
                    <TextField
                      label={ui.location}
                      value={rawPlaceValue}
                      onChange={(value) => onChangeEditField?.("rawPlace", value)}
                      placeholder={ui.location}
                    />
                    <DropdownField
                      label={ui.helpType}
                      value={helpTypeValue}
                      onChange={(value) => onChangeEditField?.("helpType", value)}
                      options={[
                        { value: "", label: ui.emptyOption },
                        { value: "VOLUNTARY", label: ui.voluntaryLabel },
                        { value: "PAID", label: ui.paidLabel },
                        { value: "MIXED", label: ui.mixedLabel }
                      ]}
                    />
                    <DropdownField
                      label={ui.timeType}
                      value={timeTypeValue}
                      onChange={(value) => onChangeEditField?.("timeType", value)}
                      options={[
                        { value: "", label: ui.emptyOption },
                        { value: "ONE_TIME", label: ui.oneTimeLabel },
                        { value: "RECURRING", label: ui.recurringLabel },
                        { value: "FLEXIBLE", label: ui.flexibleLabel }
                      ]}
                    />
                  </div>
                  <TargetGroupsField
                    label={ui.targetGroups}
                    value={targetGroupCodesValue}
                    onChange={(value) => onChangeEditField?.("targetGroupCodes", value)}
                  />
                  <TextAreaField
                    label={ui.availabilityOrStart}
                    value={availabilityOrStartValue}
                    onChange={(value) => onChangeEditField?.("availabilityOrStart", value)}
                    rows={2}
                  />
                  <div>
                    <TextField
                      label={ui.compensationDetails}
                      value={compensationDetailsValue}
                      onChange={(value) => onChangeEditField?.("compensationDetails", value)}
                      placeholder={ui.compensationDetails}
                    />
                    <TextField
                      label={ui.conditions}
                      value={conditionsValue}
                      onChange={(value) => onChangeEditField?.("conditions", value)}
                      placeholder={ui.conditions}
                    />
                  </div>
                  <div>
                    <Button type="button" variant="primary" size="md" onClick={() => onSaveEdit?.({ ...editState, targetGroupCodes: targetGroupCodesValue })}>
                      {ui.save}
                    </Button>
                    <Button type="button" variant="primary" size="md" onClick={onCancelEdit}>
                      {ui.cancel}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!editState && isOwn ? (
                <div>
                  <Button type="button" variant="primary" size="md" onClick={onStartEdit}>
                    {ui.edit}
                  </Button>
                  <Button type="button" variant="danger" size="md" onClick={onDeleteListing} disabled={busyAction === "delete"}>
                    {ui.delete}
                  </Button>
                </div>
              ) : null}

              {!editState && !isOwn ? (
                <div className="documents-workspace">
                  {listing.status === "CLOSED" ? <div>{ui.statusClosed}</div> : null}
                  <DropdownField
                    label={ui.selectOwnListing}
                    value={selectedConnectListingId}
                    onChange={(value) => onSelectConnectListing?.(value)}
                    options={connectOptions.length
                      ? connectOptions.map((item) => ({
                          value: item.id,
                          label: item.title
                        }))
                      : [{
                          value: "",
                          label: ui.noOwnOptions
                        }]}
                  />
                  <div>
                    <Button type="button" variant="primary" size="md" onClick={onConnect} disabled={connectDisabled}>
                      {busyAction === "connect" ? `${kindActionLabel}...` : kindActionLabel}
                    </Button>
                    {canDelete ? (
                      <Button type="button" variant="danger" size="md" onClick={onDeleteListing} disabled={busyAction === "delete"}>
                        {ui.delete}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="selected-listing-inline">
        {selectedListingContent}
      </div>
    );
  }

  return createPortal(
    <Modal
      open
      variant="glass"
      onClose={onDismiss}
      closeOnOverlayClick
      aria-label={listing?.title || ui.selectedListing}
      className="selected-listing-modal-overlay"
      contentClassName={selectedListingContentClassName}
    >
      {selectedListingContent}
    </Modal>,
    document.body
  );
}
