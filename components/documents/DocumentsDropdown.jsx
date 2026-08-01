"use client"

// Ajalooline nimi, uus sisu: see on nüüd õhuke ümbris platvormi ühise
// valikmenüü ümber (components/ui/Dropdown.jsx). Varem oli siin natiivne
// <select>, mille AVATUD loendi joonistas operatsioonisüsteem — hämariku
// keskel avanes valge Windowsi kast (omanik 01.08).
//
// Ümbris jääb alles, sest teda impordib ~40 kohta; API on täpselt sama.
// Uutes kohtades impordi otse `@/components/ui/Dropdown`.

import Dropdown from "@/components/ui/Dropdown"

export default function DocumentsDropdown({
  id,
  className,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  name,
  disabled = false
}) {
  return (
    <Dropdown
      id={id}
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      name={name}
      disabled={disabled}
    />
  )
}
