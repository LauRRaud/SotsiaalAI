"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_MONEY_KINDS, CareMoneyKind, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { balanceLine, euroText, holderRows, moneyPage, moneyReady, moneyRows } from "./moneyRows";
import { MoneyAddView, MoneyEntryView, MoneyView } from "./MoneyViews";
import { useClientMoney } from "./useClientMoney";

/**
 * Kliendi lehe osa „Raha": konks hoiab olekut ja päringuid, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: jääk ja arvestuse read, üks rida või uus rida.
 *
 * See on arvestus, mitte makse. Osa on lehel kogu aja (pooleli rida ei kao
 * vaate vahetusel) ja joonistatakse siis, kui ta on ees (`active`). Rea
 * tühistamine võtab selle arvestusest välja ja küsib seepärast teist vajutust.
 *
 * `canWrite`: inimene saab rea lisada (lõpetatud kliendil ei saa);
 * `onChanged(money)`: leht hoiab sama seisu osade laua plaadi jaoks.
 */
export default function ClientMoney({ active, organizationId, clientId, title, initial, canWrite = false, isCoordinator = false, onChanged }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const money = useClientMoney({ organizationId, clientId, initial, onChanged });
  /* "" (jääk ja read), "add" (uus rida) või "entry:<id>" (üks rida). */
  const [screen, setScreen] = useState("");
  /* Tühistamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useScreenFocus(screen);

  if (!active) return null;

  const euro = (cents) => euroText(cents, locale);
  const fault = money.error ? { text: money.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;

  if (screen === "add" && canWrite) {
    const { form } = money;
    const noteRequired = form.kind === CareMoneyKind.SPENT;
    return wrap(
      <MoneyAddView
        title={t("home_care.money.add")}
        form={{
          id: `${formId}-money`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await money.save()) setScreen("");
          }
        }}
        kind={{
          label: t("home_care.money.kind_label"),
          options: CARE_MONEY_KINDS.map((value) => ({ value, label: t(`home_care.money.kinds.${value}`) })),
          value: form.kind,
          onChange: (value) => money.setField("kind", value)
        }}
        amount={{ label: t("home_care.money.amount_label"), value: form.amount, onChange: (value) => money.setField("amount", value) }}
        note={{
          label: t("home_care.money.note_label"),
          hint: noteRequired ? t("home_care.money.note_hint") : "",
          value: form.note,
          onChange: (value) => money.setField("note", value),
          max: HOME_CARE_LIMITS.MONEY_NOTE_MAX,
          required: noteRequired
        }}
        intro={t("home_care.money.intro")}
        save={{ label: t("home_care.money.save"), busy: money.busy, disabled: !moneyReady(form) }}
        notice={fault}
        back={{
          label: t("home_care.money.cancel"),
          onBack: () => {
            money.setError("");
            setScreen("");
          }
        }}
      />
    );
  }

  const allRows = moneyRows(money.money, { t, euro, isCoordinator, canWrite });
  const openedRow = screen.startsWith("entry:") ? allRows.find((row) => row.key === screen.slice(6) && row.retract) : null;
  if (openedRow) {
    return wrap(
      <MoneyEntryView
        title={title}
        row={openedRow}
        retract={{
          label: t("home_care.money.retract"),
          armed,
          /* Tühistamine küsib teist vajutust samal lahtril. */
          onPress: async () => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            const entry = money.money.entries.find((item) => item.id === openedRow.key);
            if (entry && (await money.retract(entry))) setScreen("");
          }
        }}
        consequence={armed ? t("home_care.money.retract_note") : ""}
        busy={money.busy}
        notice={fault}
        back={{
          label: t("home_care.parts.back"),
          onBack: () => {
            setArmed(false);
            money.setError("");
            setScreen("");
          }
        }}
      />
    );
  }

  const holders = isCoordinator ? holderRows(money.money, { t, euro }) : [];
  const page = moneyPage(allRows, expanded);
  return wrap(
    <MoneyView
      title={title}
      balance={balanceLine(money.money, { t, euro })}
      holders={holders.length ? { title: t("home_care.money.holders_title"), rows: holders } : null}
      rows={page.rows}
      onOpen={(key) => {
        setArmed(false);
        money.setError("");
        setScreen(`entry:${key}`);
      }}
      empty={t("home_care.money.none")}
      busy={money.busy}
      notice={fault}
      hint={t("home_care.money.list_hint")}
      more={page.more ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
      add={
        canWrite
          ? {
              label: t("home_care.money.add"),
              onAdd: () => {
                money.start();
                setScreen("add");
              }
            }
          : null
      }
    />
  );
}
