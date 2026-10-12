"use client";

/**
 * Uksesildi vaated.
 *
 * MIKS. Uksesildi leht oli üks pikk leht: sissejuhatus, QR-kood, tegemise aeg,
 * nupud, aadress ja kinnitusnupud. Nüüd on ees üks asi korraga.
 *  - `TagView`  QR-kood, millal silt tehti ja nupud: prindi, aadress, haldus
 *  - uksesildi aadress ja haldus (uus silt, tühistamine) on ühised vaated
 *    (../client/PartViews.jsx)
 *
 * Siin on ainult kuju. Otsused on failis ./doorTagRows.js, olek ja päringud
 * konksus ./useDoorTag.js, kokku paneb need ./DoorTag.jsx. Kujundus:
 * ./doorTag.module.css ja organisatsioonide lehtede ühised osad
 * (../../org/org.module.css).
 */

import { footNote } from "@/components/org/OrgBits";
import shared from "@/components/org/org.module.css";
import StepPanel from "@/components/stage/StepPanel";

import { Actions } from "../client/PartViews";
import styles from "./doorTag.module.css";

/**
 * Silt. `qr`: { side, d, label }; `made`: millal silt tehti; `hint`: vaikne rida all servas;
 * `actions`: [{ key, label, onPress, primary, href, blank }]; `back`: { label, onBack } või null.
 */
export function TagView({ title, name, qr, made, hint, actions, busy, notice, back }) {
  return (
    <StepPanel title={title} question={name} note={footNote(notice, hint)} actions={<Actions back={back} actions={actions} />}>
      <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
        <svg className={styles.qr} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${qr.side} ${qr.side}`} shapeRendering="crispEdges" role="img" aria-label={qr.label} data-door-tag="qr">
          <rect width={qr.side} height={qr.side} fill="#fff" />
          <path d={qr.d} fill="#000" />
        </svg>
        <p className={shared.quiet} data-door-tag="made">
          {made}
        </p>
      </div>
    </StepPanel>
  );
}
