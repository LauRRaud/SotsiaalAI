"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { cardFull, cardRights, cardRows, kindOptions, lineReady } from "./cardRows";
import { CardFormView, CardLineView, CardView } from "./CardViews";
import { useClientCard } from "./useClientCard";

/**
 * Kliendi püsikaart „Enne kui lähed": konks hoiab vormi ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: kaardi read, üks rida või
 * rea vorm.
 *
 * Osa on lehel kogu aja (pooleli vorm ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). Rea eemaldamine võtab rea kaardilt: see küsib
 * teist vajutust.
 *
 * `lines`: kaardi read (hoiab leht, sest sama seisu näitab ka „Ukse taga");
 * `canEdit`: muudab see, kellel on kaardi muutmise õigus; `onChange(lines)`: leht võtab uue seisu;
 * `back`: { label, onBack } (tagasi ukse taha).
 */
export default function ClientCard({ active, organizationId, clientId, title, lines, canEdit, onChange, back }) {
  const { t } = useI18n();
  const formId = useId();
  const card = useClientCard({ organizationId, clientId, onChange });
  /* "" (read), "line:<id>" või "form". */
  const [screen, setScreen] = useState("");
  /* Eemaldamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    setArmed(false);
    card.setError("");
    setScreen(next);
  };
  const fault = card.error ? { text: card.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const rights = cardRights({ canEdit });
  const rows = cardRows(lines, { t });

  if (screen === "form" && rights.edit) {
    const { form } = card;
    return wrap(
      <CardFormView
        title={t(form.lineId ? "home_care.card.edit" : "home_care.card.add")}
        form={{
          id: `${formId}-line`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (lineReady(form) && (await once(card.save))) go("");
          }
        }}
        kind={{ label: t("home_care.card.kind_label"), options: kindOptions(t), value: form.kind, onChange: (value) => card.setField("kind", value) }}
        text={{ label: t("home_care.card.text_label"), value: form.text, onChange: (value) => card.setField("text", value), max: HOME_CARE_LIMITS.CARD_LINE_TEXT_MAX }}
        driver={{ label: t("home_care.card.for_driver_label"), checked: form.forDriver, onChange: (value) => card.setField("forDriver", value) }}
        save={{ label: t("home_care.card.save"), busy: card.busy, disabled: !lineReady(form) }}
        notice={fault}
        /* Muutmisel tagasi rea juurde, uue rea juures kaardi ridade juurde. */
        back={{ label: t("home_care.card.cancel"), onBack: () => go(form.lineId ? `line:${form.lineId}` : "") }}
      />
    );
  }

  const [kind, id] = screen.split(":");
  const line = kind === "line" ? (lines || []).find((item) => item.id === id) : null;
  if (line && rights.edit) {
    return wrap(
      <CardLineView
        title={title}
        row={rows.find((row) => row.key === line.id)}
        actions={[
          {
            key: "edit",
            label: t("home_care.card.edit"),
            onPress: () => {
              card.start(line);
              go("form");
            }
          },
          {
            key: "remove",
            label: t("home_care.card.remove"),
            armed,
            /* Eemaldamine küsib teist vajutust samal lahtril. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => card.remove(line.id))) setScreen("");
            }
          }
        ]}
        consequence={armed ? t("home_care.card.remove_note") : ""}
        busy={card.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  const full = cardFull(lines);
  return wrap(
    <CardView
      title={title}
      rows={rows}
      open={rights.edit}
      onOpen={(key) => go(`line:${key}`)}
      empty={t(rights.edit ? "home_care.card.empty" : "home_care.card.empty_readonly")}
      limit={rights.edit && full ? t("home_care.card.limit", { limit: HOME_CARE_LIMITS.CARD_LINES_MAX }) : ""}
      busy={card.busy}
      notice={fault}
      add={
        rights.edit && !full
          ? {
              label: t("home_care.card.add"),
              onAdd: () => {
                card.start();
                go("form");
              }
            }
          : null
      }
      back={back}
    />
  );
}
