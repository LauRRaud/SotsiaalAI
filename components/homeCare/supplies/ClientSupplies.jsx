"use client";

import { useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_SUPPLY_STATES, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import { supplyLines, supplyRights, supplyRows } from "./supplyRows";
import { SuppliesView, SupplyTrackView, SupplyView } from "./SuppliesViews";
import { useClientSupplies } from "./useClientSupplies";

/**
 * Kliendi lehe osa „Varud": konks hoiab olekut ja päringuid, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: jälgitavad varud, üks varu või uus
 * jälgitav varu.
 *
 * Seisu märgib ühe puudutusega igaüks, kes kliendi juures käib. Osa on lehel
 * kogu aja (pooleli märkus ei kao vaate vahetusel) ja joonistatakse siis, kui
 * ta on ees (`active`). Jälgimise lõpetamine kustutab senise seisu ja küsib
 * seepärast teist vajutust.
 *
 * `canWrite`: inimene saab seisu märkida (lõpetatud kliendil ei saa);
 * `canManage`: hooldusjuht paneb paika, mida jälgitakse;
 * `onChanged(supplies)`: leht hoiab sama seisu osade laua plaadi jaoks.
 */
export default function ClientSupplies({ active, organizationId, clientId, title, name, initial, timeZone, canWrite = false, canManage = false, onChanged }) {
  const { t } = useI18n();
  const formId = useId();
  const supplies = useClientSupplies({ organizationId, clientId, initial, onChanged });
  /* "" (varud), "track" (uus jälgitav varu) või "supply:<id>" (üks varu). */
  const [screen, setScreen] = useState("");
  /* Jälgimise lõpetamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut (nuppu välja ei lülitata). */
  const once = useSendOnce();
  /* Seis salvestub ühe puudutusega: teine puudutus päringu ajal ei tohi teist päringut saata. */
  const marking = useRef(false);

  if (!active) return null;

  const who = { canWrite, canManage };
  const moment = (value) => formatDateTime(value, timeZone);
  const fault = supplies.error ? { text: supplies.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const go = (next) => {
    setArmed(false);
    supplies.setError("");
    setScreen(next);
  };
  const kindName = (kind) => t(`home_care.supplies.kinds.${kind}`);

  if (screen === "track" && canManage && canWrite && supplies.free.length) {
    return wrap(
      <SupplyTrackView
        title={t("home_care.supplies.track")}
        form={{
          id: `${formId}-track`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(supplies.track)) go("");
          }
        }}
        kind={{
          label: t("home_care.supplies.kind_label"),
          options: supplies.free.map((value) => ({ value, label: kindName(value) })),
          value: supplies.form.kind,
          onChange: (value) => supplies.setField("kind", value)
        }}
        responsible={{
          label: t("home_care.supplies.responsible_label"),
          hint: t("home_care.supplies.responsible_hint"),
          value: supplies.form.responsible,
          onChange: (value) => supplies.setField("responsible", value),
          max: HOME_CARE_LIMITS.SUPPLY_RESPONSIBLE_MAX
        }}
        save={{ label: t("home_care.supplies.save"), busy: supplies.busy, disabled: !supplies.form.kind || !supplies.form.responsible.trim() }}
        notice={fault}
        back={{ label: t("home_care.supplies.cancel"), onBack: () => go("") }}
      />
    );
  }

  const opened = screen.startsWith("supply:") ? supplies.supplies.find((supply) => supply.id === screen.slice(7)) : null;
  const rights = opened ? supplyRights(opened, who) : null;
  if (opened && canWrite) {
    return wrap(
      <SupplyView
        title={kindName(opened.kind)}
        chip={opened.state && opened.state !== "ENOUGH" ? t(`home_care.supplies.states.${opened.state}`) : ""}
        lines={supplyLines(opened, { t, moment })}
        form={{
          id: `${formId}-note`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (rights.note && (await once(() => supplies.mark(opened, opened.state, supplies.form.note)))) go("");
          }
        }}
        note={rights.note ? { label: t("home_care.supplies.note_label"), value: supplies.form.note, onChange: (value) => supplies.setField("note", value), max: HOME_CARE_LIMITS.SUPPLY_NOTE_MAX } : null}
        save={rights.note ? { label: t("home_care.supplies.note_save"), busy: supplies.busy } : null}
        untrack={
          rights.untrack
            ? {
                label: t("home_care.supplies.untrack"),
                armed,
                /* Jälgimise lõpetamine küsib teist vajutust samal lahtril. */
                onPress: async () => {
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  setArmed(false);
                  if (await once(() => supplies.untrack(opened))) setScreen("");
                }
              }
            : null
        }
        consequence={armed ? t("home_care.supplies.untrack_note") : ""}
        busy={supplies.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  return wrap(
    <SuppliesView
      title={title}
      name={name}
      rows={supplyRows(supplies.supplies, who, { t, moment })}
      states={canWrite ? CARE_SUPPLY_STATES.map((value) => ({ value, label: t(`home_care.supplies.states.${value}`) })) : null}
      stateLabel={(kind) => t("home_care.supplies.state_label", { kind })}
      onMark={async (key, state) => {
        const supply = supplies.supplies.find((item) => item.id === key);
        if (!supply || marking.current) return;
        marking.current = true;
        try {
          await supplies.mark(supply, state);
        } finally {
          marking.current = false;
        }
      }}
      onOpen={(key) => {
        const supply = supplies.supplies.find((item) => item.id === key);
        if (!supply) return;
        supplies.startNote(supply);
        go(`supply:${key}`);
      }}
      empty={t("home_care.supplies.none")}
      hint={canWrite && supplies.supplies.length ? t("home_care.supplies.list_hint") : ""}
      busy={supplies.busy}
      notice={fault}
      track={
        canManage && canWrite && supplies.free.length
          ? {
              label: t("home_care.supplies.track"),
              onTrack: () => {
                supplies.startTrack();
                go("track");
              }
            }
          : null
      }
    />
  );
}
