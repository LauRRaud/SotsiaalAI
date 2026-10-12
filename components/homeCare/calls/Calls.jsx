"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { monthLabel } from "../month/monthRows";
import SubPage from "../page/SubPage";
import { callerRows, callsEmpty, topicRows, totalLine } from "./callRows";
import { useCalls } from "./useCalls";

/**
 * Kõnede loenduri leht hooldusjuhile: konks hoiab kuud, siin pannakse vaated
 * kokku. Ees on üks vaade korraga: kuu (kõned kokku, kuu vahetus all) ning
 * kõned teema või helistaja järgi. Üksikuid kõnesid ega nimesid siin ei ole.
 *
 * `initial`: kuu kõned ja võrdlus eelmise kuuga.
 */
export default function Calls({ context, initial }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const state = useCalls({ organizationId, initial });
  const { data } = state;
  /* "" (kuu), "topic" või "caller". */
  const [screen, setScreen] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.calls.title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const back = { label: t("home_care.parts.back"), onBack: () => setScreen("") };

  /* --- Kõned teema või helistaja järgi --- */
  if (screen === "topic" || screen === "caller") {
    return wrap(
      <RowsView
        title={t("home_care.calls.title")}
        question={t(screen === "topic" ? "home_care.calls.by_topic" : "home_care.calls.by_caller")}
        lead={monthLabel(data.month)}
        rows={screen === "topic" ? topicRows(t, data) : callerRows(t, data)}
        hint={t("home_care.calls.how")}
        back={back}
        mark={`calls-${screen}`}
      />
    );
  }

  /* --- Kuu --- */
  const empty = callsEmpty(data);
  return wrap(
    <RowsView
      title={t("home_care.calls.title")}
      question={monthLabel(data.month)}
      lead={totalLine(t, data)}
      rows={empty ? [] : [{ key: "topic", title: t("home_care.calls.by_topic") }, { key: "caller", title: t("home_care.calls.by_caller") }]}
      onOpen={setScreen}
      empty={t("home_care.calls.empty")}
      hint={t("home_care.calls.intro")}
      actions={[
        { key: "previous", label: t("home_care.calls.previous"), disabled: state.busy || !data.previousMonth, onPress: () => once(() => state.load(data.previousMonth)) },
        { key: "next", label: t("home_care.calls.next"), primary: true, disabled: state.busy || !data.nextMonth, onPress: () => once(() => state.load(data.nextMonth)) }
      ]}
      busy={state.busy}
      notice={fault}
      mark="calls"
    />
  );
}
