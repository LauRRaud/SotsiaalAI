import { cn } from "@/components/ui/cn";
import { useRef, useState } from "react";
export const optionEdgeGlowStyle = {};
const visuallyHiddenInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  WebkitClipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
  opacity: 0,
  pointerEvents: "none"
};
export default function OptionCard({
  type = "radio",
  name,
  value,
  checked,
  onChange,
  inputRef,
  disabled = false,
  className,
  children,
  showIndicator = true,
  glow = true,
  fitTextLines,
  fitTextMinPx = 16,
  fitTextMaxPx,
  style,
  ...props
}) {
  const internalRef = useRef(null);
  const resolvedRef = inputRef || internalRef;
  const textRef = useRef(null);
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const indicator = type === "checkbox" && showIndicator ? <span aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 12.5l4 4 8-8" />
        </svg>
      </span> : null;
  const handleKeyDown = e => {
    if (disabled) return;
    if (type === "radio" && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") && name) {
      e.preventDefault();
      const selector = `input[type="radio"][name="${CSS.escape(name)}"]`;
      const radios = Array.from(document.querySelectorAll(selector));
      if (!radios.length) return;
      const currentIndex = radios.indexOf(resolvedRef.current);
      const dir = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = (currentIndex + dir + radios.length) % radios.length;
      radios[nextIndex]?.click();
      return;
    }
    if (e.key !== " " && e.key !== "Enter") return;
  };
  return (
    <label data-checked={checked ? "true" : "false"} data-control-type={type} data-focus-visible={isFocusVisible ? "true" : "false"} data-glow={glow ? "true" : undefined} data-fit-text-lines={fitTextLines ?? undefined} data-fit-text-min={fitTextMinPx ?? undefined} data-fit-text-max={fitTextMaxPx ?? undefined} className={cn(className)} style={style} {...props}>
      <input ref={resolvedRef} type={type} name={name} value={value} checked={!!checked} onChange={onChange} onKeyDown={handleKeyDown} onFocus={e => setIsFocusVisible(e.target.matches(":focus-visible"))} onBlur={() => setIsFocusVisible(false)} disabled={disabled} className="peer sr-only" style={visuallyHiddenInputStyle} tabIndex={0} />
      {indicator}
      <span ref={textRef}>
        {children}
      </span>
    </label>
  );
}
