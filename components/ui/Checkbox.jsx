"use client";

/**
 * Checkbox — platvormi märkeruut (üks komponent kogu rakendusele).
 *
 * Kaks renderdusviisi, sest päris kasutuskohti on kahte sorti:
 *
 * [1] VAIKIMISI — komponent joonistab ise `<label class="ui-checkbox">`-i,
 *     kasti ja sildi. Kasuta seal, kus lehel ei ole märkeruudule oma
 *     paigutus-CSS-i.
 *
 * [2] `bare` — komponent joonistab AINULT `<input>`-i. Kasuta kahel juhul:
 *     (a) lehel on juba oma sildikest, mille klass kannab paigutust
 *         (`.sl-check`, `.epp-confirm`, `.ts-toggle`, …). Ilma selleta
 *         tekiks pesastatud `<label>` — ligipääsetavuse viga, sest sildi ja
 *         kasti seos muutub mitmemõtteliseks.
 *     (b) kast seisab sildita, näiteks tabelilahtris "vali kõik". Siis tuleb
 *         tekstiline nimi `aria-label`-iga.
 *
 *     MIKS ME EI PANE `ui-checkbox`-i lihtsalt lehe klassi kõrvale: mõlemad
 *     on ühe klassi kaaluga (0,1,0), nii et võitja otsustaks failide
 *     laadimisjärjekord, mitte meie. Sama lõks, mis varem CSS-i prefiksitega
 *     — `display`/`gap`/`align-items` triiviks lehtede kaupa laiali.
 *
 * `onChange` annab `(checked, event)`, mitte paljast sündmust: kutsumiskoht
 * tahab peaaegu alati just uut olekut ja `event.target.checked` kordus oli
 * igal real. Sündmus ise on teise argumendina alles (nt `stopPropagation`
 * klikitava tabelirea sees).
 *
 * Klaviatuur: tühik lülitab natiivselt, Enter on meie lisa. `aria-checked`
 * käib alati oleku järel ja `indeterminate` puhul on ta "mixed".
 */

import { forwardRef, useCallback } from "react";

import { cn } from "@/components/ui/cn";

const Checkbox = forwardRef(function Checkbox({
  id,
  label,
  labelPosition = "after",
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  required = false,
  name,
  className,
  bare = false,
  ...rest
}, ref) {
  /* `indeterminate` ei ole atribuut, vaid DOM-i omadus — teda saab panna
     ainult elemendi peal. Sama callback annab elemendi ka väljapoole edasi,
     et kutsuja `ref` ei läheks kaduma. */
  const setNode = useCallback((node) => {
    if (node) node.indeterminate = Boolean(indeterminate);
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref, indeterminate]);

  const input = (
    <input
      {...rest}
      ref={setNode}
      id={id}
      name={name}
      type="checkbox"
      className={bare ? className : undefined}
      checked={Boolean(checked)}
      onChange={(event) => onChange?.(event.target.checked, event)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        onChange?.(!checked, event);
      }}
      disabled={disabled}
      required={required}
      aria-checked={indeterminate ? "mixed" : Boolean(checked)}
      aria-disabled={Boolean(disabled)}
    />
  );

  if (bare) return input;

  const text = label ? <span>{label}</span> : null;

  return (
    <label className={cn("ui-checkbox", className)}>
      {labelPosition === "before" ? text : null}
      {input}
      {labelPosition === "before" ? null : text}
    </label>
  );
});

export default Checkbox;
