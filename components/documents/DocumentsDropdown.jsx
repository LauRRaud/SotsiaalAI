"use client"

// Lihtne natiivne <select> (mitte kohandatud portal-primitiiv). Sama props-liides
// (value/onChange(value)/options/placeholder/ariaLabel/disabled), et call-saidid
// ei katkeks. Endised dekoratiiv-propsid (align/openDirection/portal) ignoreeritakse
// — natiivne <select> haldab positsioneerimist ise. data-variant annab
// panel.css-i pill-sisendi stiili (select[data-variant]).

export default function DocumentsDropdown({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  disabled = false
}) {
  return (
    <select
      data-variant="default"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {(options || []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
