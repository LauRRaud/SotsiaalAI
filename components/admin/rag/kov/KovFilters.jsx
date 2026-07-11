"use client";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";

/* Filtririba ühel real: otsing venib, valikud kõrval; tulemuste arv ja
   nullimine sama riba lõpus (mitte eraldi lehepikkune veerg). */
export default function KovFilters({
  et = true,
  query,
  onQueryChange,
  county,
  onCountyChange,
  countyOptions,
  type,
  onTypeChange,
  typeOptions,
  activity,
  onActivityChange,
  activityOptions,
  packageState,
  onPackageStateChange,
  packageStateOptions,
  sort,
  onSortChange,
  sortOptions,
  resultCount,
  searchPlaceholder,
  resultsLabel,
  onReset,
  hasActiveFilters
}) {
  return (
    <div className="ra-card">
      <div className="ra-toolbar">
        <div className="ra-toolbar-search">
          <Input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            size="sm"
          />
        </div>
        <DocumentsDropdown ariaLabel="County" value={county} onChange={onCountyChange} options={countyOptions} />
        <DocumentsDropdown ariaLabel="Type" value={type} onChange={onTypeChange} options={typeOptions} />
        <DocumentsDropdown
          ariaLabel="Activity"
          value={activity}
          onChange={onActivityChange}
          options={activityOptions}
        />
        <DocumentsDropdown
          ariaLabel="Package state"
          value={packageState}
          onChange={onPackageStateChange}
          options={packageStateOptions}
        />
        <DocumentsDropdown ariaLabel="Sort" value={sort} onChange={onSortChange} options={sortOptions} />
      </div>
      <div className="ra-toolbar">
        <span className="ra-chip" data-tone="dim">{resultsLabel(resultCount)}</span>
        <div className="ra-toolbar-meta">
          <span>
            {hasActiveFilters
              ? et
                ? "Filtrid on aktiivsed."
                : "Filters are active."
              : et
                ? "Vaikimisi kuvatakse aktiivsed KOV-id."
                : "Active municipalities are shown by default."}
          </span>
          <Button variant="primary" size="xs" onClick={onReset} disabled={!hasActiveFilters}>
            {et ? "Nulli filtrid" : "Reset"}
          </Button>
        </div>
      </div>
    </div>
  );
}
