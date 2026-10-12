"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareKeyOutcome, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { keyHolderText, keyMine, keyName, keyRights, keyRows, receiverOptions } from "./keyRows";
import { KeyAddView, KeyHandOverView, KeyView, KeysView } from "./KeysViews";
import { useClientKeys } from "./useClientKeys";

/**
 * Kliendi lehe osa „Võtmed": konks hoiab olekut ja päringuid, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: võtmed, üks võti, üleandmine või uus võti.
 *
 * Osa on lehel kogu aja (pooleli vorm ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). See on arvestus, kelle käes võti on: võtme
 * lõpetamine (tagastatud kliendile, kadunud) võtab selle asutuse arvestusest
 * välja ja küsib seepärast teist vajutust.
 *
 * `who`: { canManage, canWrite, myMembershipId }; `receivers`: kellele võtit saab anda;
 * `onChanged(keys)`: leht hoiab sama seisu osade laua plaadi jaoks.
 */
export default function ClientKeys({ active, organizationId, clientId, title, name, initial, receivers, who, onChanged }) {
  const { t } = useI18n();
  const formId = useId();
  const keys = useClientKeys({ organizationId, clientId, initial, onChanged });
  /* "" (võtmed), "add", "key:<id>" või "hand:<id>". */
  const [screen, setScreen] = useState("");
  /* Lõpetamine, mille esimene vajutus on tehtud. */
  const [armed, setArmed] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut (nuppu välja ei lülitata). */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    setArmed("");
    keys.setError("");
    setScreen(next);
  };
  const fault = keys.error ? { text: keys.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const [kind, id] = screen.split(":");
  const opened = id ? keys.keys.find((key) => key.id === id) : null;
  const rights = opened ? keyRights(opened, who) : null;

  if (kind === "add" && who.canManage && who.canWrite) {
    return wrap(
      <KeyAddView
        title={t("home_care.keys.add")}
        form={{
          id: `${formId}-key`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(keys.add)) go("");
          }
        }}
        tag={{ label: t("home_care.keys.tag_label"), value: keys.form.tag, onChange: (value) => keys.setField("tag", value), max: HOME_CARE_LIMITS.KEY_TAG_MAX }}
        label={{ label: t("home_care.keys.label_label"), value: keys.form.label, onChange: (value) => keys.setField("label", value), max: HOME_CARE_LIMITS.KEY_LABEL_MAX }}
        holder={{ label: t("home_care.keys.holder_label"), options: receiverOptions(receivers, null, { t }), value: keys.form.holder, onChange: (value) => keys.setField("holder", value) }}
        hint={t("home_care.keys.tag_hint")}
        save={{ label: t("home_care.keys.save"), busy: keys.busy, disabled: !keys.form.tag.trim() }}
        notice={fault}
        back={{ label: t("home_care.keys.cancel"), onBack: () => go("") }}
      />
    );
  }

  if (kind === "hand" && opened && rights.handOver) {
    const holderId = opened.holder?.membershipId || null;
    return wrap(
      <KeyHandOverView
        title={keyName(t, opened)}
        pick={{ label: t("home_care.keys.to_label"), options: receiverOptions(receivers, holderId, { t }), value: keys.form.holder, onChange: (value) => keys.setField("holder", value) }}
        save={{
          label: t("home_care.keys.hand_over_save"),
          busy: keys.busy,
          /* Võti on juba selle käes, kellele seda antakse. */
          disabled: (keys.form.holder || null) === holderId,
          onSave: async () => {
            if (await once(() => keys.patch(opened, { toMembershipId: keys.form.holder || null }))) go("");
          }
        }}
        notice={fault}
        back={{ label: t("home_care.keys.cancel"), onBack: () => go(`key:${opened.id}`) }}
      />
    );
  }

  if ((kind === "key" || kind === "hand") && opened && rights.handOver) {
    /* Lõpetamine küsib teist vajutust samal lahtril. */
    const end = (key, outcome) => async () => {
      if (armed !== key) {
        setArmed(key);
        return;
      }
      setArmed("");
      if (await once(() => keys.patch(opened, { outcome }))) setScreen("");
    };
    return wrap(
      <KeyView
        title={keyName(t, opened)}
        line={keyMine(opened, who.myMembershipId) ? t("home_care.keys.held_by_me") : keyHolderText(t, opened)}
        actions={[
          {
            key: "hand",
            label: t("home_care.keys.hand_over"),
            onPress: () => {
              keys.start();
              go(`hand:${opened.id}`);
            }
          },
          rights.end ? { key: "returned", label: t("home_care.keys.returned"), armed: armed === "returned", onPress: end("returned", CareKeyOutcome.RETURNED) } : null,
          rights.end ? { key: "lost", label: t("home_care.keys.lost"), armed: armed === "lost", onPress: end("lost", CareKeyOutcome.LOST) } : null
        ].filter(Boolean)}
        consequence={armed === "returned" ? t("home_care.keys.returned_note") : armed === "lost" ? t("home_care.keys.lost_note") : ""}
        busy={keys.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  return wrap(
    <KeysView
      title={title}
      name={name}
      rows={keyRows(keys.keys, who, { t })}
      onOpen={(key) => go(`key:${key}`)}
      empty={t("home_care.keys.none")}
      hint={keys.keys.length ? t("home_care.keys.list_hint") : ""}
      add={
        who.canManage && who.canWrite
          ? {
              label: t("home_care.keys.add"),
              onAdd: () => {
                keys.start();
                go("add");
              }
            }
          : null
      }
    />
  );
}
