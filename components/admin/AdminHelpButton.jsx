"use client";

/**
 * AdminHelpButton — ⓘ "mida see paneel näitab, kuidas seda lugeda ja mida
 * leiu korral teha".
 *
 * Analüütika on tihe leht ja iga plokk vajab oma selgitust (omanik 01.08).
 * Abitekst on vaikimisi kinni, et ta tihedust ära ei sööks; nupp elab
 * kasti paremas ülanurgas.
 *
 * Nupp ise EI OLE oma leiutis: `IconButton` + `InfoIcon` on samad, mis
 * annavad doki ja alalehtede ⓘ — üks info-afordanss kogu platvormil.
 * Mõõdud tulevad `.aa-info`-st (admin-analytics.css) ja vastavad
 * `.dashboard-info-trigger`-i omadele.
 */

import { useState } from "react";

import IconButton from "@/components/glass/IconButton";
import { InfoIcon } from "@/components/ui/DashboardInfoOverlay";

export default function AdminHelpButton({ label, text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <IconButton
        layoutClassName="aa-info"
        aria-label={label}
        aria-expanded={open ? "true" : "false"}
        title={label}
        onClick={() => setOpen(value => !value)}
      >
        <InfoIcon />
      </IconButton>
      {open ? (
        <div className="aa-infopanel" role="note">
          {text}
        </div>
      ) : null}
    </>
  );
}
