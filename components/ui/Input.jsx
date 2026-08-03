"use client";

/**
 * Input — platvormi tekstiväli (üks komponent kogu rakendusele).
 *
 * MIDA TA EI TEE. Ta EI ANNA servahelki. Helk tuleb väljadele dokumendiülese
 * lõuendi kaudu (components/glass/SpecularHighlight.jsx), sest `<input>`-il ei
 * saa olla pseudoelementi, kuhu teda joonistada. Nupp saab oma helgi
 * SpecularButtonist Button.jsx sees; väli saab ta lõuendist. Kes seda ei tea,
 * hakkab siia efekti otsima ja ei leia.
 *
 * MIS SIIS ON VÕIT, kui efekt tuleb mujalt:
 *   1. MATERJAL. `data-size`/`data-variant` on üks koht, kust lehed välja
 *      mõõtu ja ilmet küsivad — mitte 65 faili oma klassidega.
 *   2. VEA SEISUND. `invalid` → `aria-invalid`, mille peal joonistab glass.css
 *      ühe reeglina kogu platvormi vea-ääre. Sama atribuut, mida loeb
 *      ekraanilugeja, joonistab ka ääre: nähtav ja kuuldav seis ei saa lahku
 *      minna. Sama sõnavara mis Dropdownil ja DateFieldil.
 *   3. `disabled` annab ka `aria-disabled` — mõni abitehnika ei loe üht ilma
 *      teiseta.
 *
 * `ref` läheb LÄBI päris `<input>`-ini: fookuse viimine (Form.jsx saadab
 * fookuse esimesele vigasele väljale), valiku hoidmine ja failivalija
 * avamine käivad kõik elemendi enda pealt.
 */

import { forwardRef } from "react";

import { cn } from "@/components/ui/cn";

const Input = forwardRef(function Input(
  {
    size = "md",
    variant = "default",
    className,
    disabled = false,
    invalid = false,
    describedBy,
    ...props
  },
  ref
) {
  return (
    <input
      ref={ref}
      data-size={size}
      data-variant={variant}
      className={cn(className)}
      disabled={disabled}
      aria-disabled={disabled ? "true" : undefined}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
});

export default Input;
