"use client";

import { useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { recentRows, slotDays } from "./slotRows";
import { SheetsView, SlotsView } from "./SlotsViews";
import { useClientSheets } from "./useClientSheets";

/**
 * Kliendi lehe osa „Käigud": konks hoiab prinditavate lehtede olekut ja
 * päringuid, siin pannakse vaated kokku. Ees on üks vaade korraga: käigud või
 * lehed kliendi koju.
 *
 * Osa on lehel kogu aja (sisestatud telefoninumber ei kao vaate vahetusel) ja
 * joonistatakse siis, kui ta on ees (`active`).
 *
 * `rights`: { fridge, statement } (mis lehti inimene avada tohib);
 * `editHref`: käikude muutmise leht või tühi (muudab hooldusjuht).
 */
export default function ClientSlots({ active, organizationId, clientId, title, name, slots, recentVisits, today, rights, editHref = "" }) {
  const { t } = useI18n();
  const sheets = useClientSheets({ organizationId, clientId });
  /* "" (käigud) või "sheets" (lehed kliendi koju). */
  const [screen, setScreen] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Leht avaneb uues aknas kohe vajutuse peale: teine vajutus päringu ajal ei tohi teist akent avada. */
  const opening = useRef(false);

  if (!active) return null;

  const canSheets = rights.fridge || rights.statement;
  const press = (open) => async () => {
    if (opening.current) return;
    opening.current = true;
    try {
      await open();
    } finally {
      opening.current = false;
    }
  };

  if (screen === "sheets" && canSheets) {
    return (
      <div ref={rootRef}>
        <SheetsView
          title={t("home_care.sheets.name")}
          phone={{ label: t("home_care.fridge.phone_label"), value: sheets.phone, onChange: sheets.setPhone, max: HOME_CARE_LIMITS.REFERRAL_PHONE_MAX }}
          choices={[
            rights.fridge ? { key: "fridge", label: t("home_care.fridge.open"), onPress: press(sheets.open) } : null,
            rights.statement ? { key: "previous", label: t("home_care.statement.open_previous"), onPress: press(() => sheets.openStatement("previous")) } : null,
            rights.statement ? { key: "current", label: t("home_care.statement.open_current"), onPress: press(() => sheets.openStatement("current")) } : null
          ].filter(Boolean)}
          hints={[rights.fridge ? t("home_care.fridge.hint") : null, rights.statement ? t("home_care.statement.hint_client") : null].filter(Boolean)}
          busy={sheets.busy}
          notice={sheets.error ? { text: sheets.error, tone: "risk" } : null}
          back={{
            label: t("home_care.parts.back"),
            onBack: () => {
              sheets.setError("");
              setScreen("");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <SlotsView
        title={title}
        name={name}
        recent={recentRows(recentVisits, { t })}
        caption={t("home_care.slots.title")}
        days={slotDays(slots, today, { t })}
        empty={t("home_care.slots.none")}
        inactive={t("home_care.slots.worker_inactive")}
        sheets={canSheets ? { label: t("home_care.sheets.name"), onOpen: () => setScreen("sheets") } : null}
        edit={editHref ? { label: t("home_care.slots.edit_link"), href: editHref } : null}
      />
    </div>
  );
}
