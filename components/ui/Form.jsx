"use client";

/**
 * Form — platvormi vorm (üks komponent kogu rakendusele).
 *
 * MIKS ta olemas on. Brauseri natiivne valideerimine jookseb ENNE `onSubmit`-i
 * ja näitab teadet BRAUSERI liidesekeeles. Eestikeelsel lehel ilmus
 * ingliskeelses Chrome'is „Please fill out this field" ja lehe enda eestikeelne
 * kontroll ei jõudnud kunagi ekraanile — teda ei kutsutud välja. Ravi on
 * `noValidate`, aga seda EI TOHI 69 kohta käsitsi kirjutada: üks unustatud
 * vorm tähendab, et sellel lehel on jälle brauseri keel.
 *
 * Seetõttu on `noValidate` siin VAIKIMISI SEES ja tuleb kaasa iga vormiga,
 * mis selle komponendi kaudu käib.
 *
 * TEINE POOL, ja see on tähtsam: `noValidate` üksi VÕTAKS kontrolli ära nendelt
 * vormidelt, millel oma kontrolli ei ole. Seepärast teeb Form ise sama
 * kontrolli, mille brauser teeks — `field.validity` töötab `noValidate` all
 * edasi —, ainult teksti keel on meie oma (lib/forms/validationMessage.js).
 * Nii ei kaota ükski `required` oma mõju ja ükski vorm ei vaja oma kontrolli
 * juurde kirjutamist, et migratsioon oleks ohutu.
 *
 * Vea juures: teade ilmub vormi algusse `role="alert"`-i (ekraanilugeja ütleb
 * ta ise välja) ja fookus hüppab esimese vigase välja peale. Lehe enda
 * kontroll jookseb pärast seda tavalises `onSubmit`-is — Form ei võta kelleltki
 * midagi ära, ta lisab põranda alla.
 *
 * `validate={false}` jätab kontrolli ära seal, kus vorm ei ole andmete
 * esitamine (nt otsinguriba), aga `noValidate` jääb ikka.
 */

import { forwardRef, useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import { firstInvalidField, validationMessage } from "@/lib/forms/validationMessage";

const Form = forwardRef(function Form(
  {
    noValidate = true,
    validate = true,
    onSubmit,
    className,
    children,
    ...props
  },
  ref
) {
  const { t } = useI18n();
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    event => {
      if (validate) {
        const invalid = firstInvalidField(event.currentTarget);
        if (invalid) {
          event.preventDefault();
          setError(validationMessage(invalid, t));
          /* Fookus läheb VÄLJALE, mitte teatele: inimene peab saama kohe
             parandada, mitte enne teate juurest tagasi kerima. */
          invalid.focus?.();
          invalid.scrollIntoView?.({ block: "center", behavior: "smooth" });
          return;
        }
      }
      setError("");
      onSubmit?.(event);
    },
    [onSubmit, t, validate]
  );

  return (
    <form
      ref={ref}
      noValidate={noValidate}
      onSubmit={handleSubmit}
      className={cn(className)}
      {...props}
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {children}
    </form>
  );
});

export default Form;
