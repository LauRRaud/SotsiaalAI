"use client";

import { forwardRef } from "react";
const Checkbox = forwardRef(function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled,
  name,
  className
}, ref) {
  return <label className={["ui-checkbox", className].filter(Boolean).join(" ")}>
      <input ref={ref} id={id} name={name} type="checkbox" checked={!!checked} onChange={e => onChange?.(e.target.checked, e)} onKeyDown={e => {
      if (e.key === "Enter") {
        e.preventDefault();
        onChange?.(!checked, e);
      }
    }} disabled={disabled} aria-checked={!!checked} aria-disabled={!!disabled} />
      {label && <span>{label}</span>}
    </label>;
});
export default Checkbox;
