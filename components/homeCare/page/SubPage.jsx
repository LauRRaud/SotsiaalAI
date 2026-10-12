"use client";

/**
 * Koduteenuse alalehe kest: organisatsiooni lehe kest (`OrgPart`) ja seadmes
 * ootavate kirjete lause koos oma vaatega.
 *
 * MIKS. Alalehed näitasid seadmes ootavaid kirjeid vana kihi kastina lehe
 * ülaservas (`../HomeCareOutbox.jsx`). Nüüd on see üks lause lehe kohal, kui
 * midagi ootab, ja loend on omaette vaade (`../outbox/OutboxPanel.jsx`); lehe
 * enda vaated jäävad sel ajal lehele peitu, nii et pooleli vorm ei kao.
 *
 * `label`: alalehe nimi kiirmenüüs; `up`: `{ label, href }`, kui üks tase üles on
 * mõni muu leht (kliendi alaleht viib kliendi lehele); `onDesk`: mida nelja ruuduga
 * nupp teeb, kui leht on oma esimesest vaatest sügavamal; `compact`: nupp ilma
 * nimeta (sammudega töö); `notice`: kas ootavate kirjete lause on praegu näha
 * (lehe esimeses vaates jah, vormis ei).
 */

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgPart from "@/components/org/OrgPart";

import OutboxPanel, { OutboxNotice } from "../outbox/OutboxPanel";
import styles from "./subPage.module.css";

export default function SubPage({ context, label, up = null, onDesk, compact = false, notice = true, children }) {
  const { t } = useI18n();
  const [outbox, setOutbox] = useState(false);
  const timeZone = context.organization?.timezone || "Europe/Tallinn";
  const ownerId = context.membership?.id || "";
  return (
    <OrgPart
      context={context}
      part="home_care"
      partLabel={outbox ? t("home_care.outbox.name") : label}
      up={up}
      onDesk={outbox ? () => setOutbox(false) : onDesk}
      compact={compact && !outbox}
    >
      <div className={styles.above} hidden={outbox || !notice}>
        <OutboxNotice ownerId={ownerId} onOpen={() => setOutbox(true)} />
      </div>
      {outbox ? <OutboxPanel ownerId={ownerId} timeZone={timeZone} back={{ label: t("home_care.outbox.back"), onBack: () => setOutbox(false) }} /> : null}
      <div className={styles.page} hidden={outbox}>
        {children}
      </div>
    </OrgPart>
  );
}
