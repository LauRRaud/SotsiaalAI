"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import SubPage from "../page/SubPage";
import { dayHref, daysCells, unassignedCells, weekEmpty, weekHeading, weekRows, weekTotals, workerCells, workerTotals } from "./weekPlanRows";
import { WeekView, WorkerView } from "./WeekViews";
import { useWeekPlan } from "./useWeekPlan";

/**
 * Hooldusjuhi nädalaplaani leht: konks hoiab nädala andmeid ja päringut, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: nädala päevad ja töötajad
 * (nädalate vahetus all) või ühe töötaja (või määramata käikude) nädal.
 *
 * Siin midagi ei muudeta: iga päeva lahter viib selle päeva plaani, kus käigu saab
 * ümber tõsta või ära jätta. Lingid päevaplaani ei eellaadi.
 *
 * `initial`: nädala andmed.
 */
export default function WeekPlan({ context, initial }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const week = useWeekPlan({ organizationId, initial });
  const { data } = week;
  /* "" (nädal), "unassigned" või töötaja ID. */
  const [screen, setScreen] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();
  const hrefOf = (day) => dayHref(organizationId, day);
  const fault = week.error ? { text: week.error, tone: "risk" } : null;
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.week.title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  /* Nädala vahetus: laeb nädala ja jääb nädala vaatesse. */
  const goWeek = async (target) => {
    if (await once(() => week.load(target))) setScreen("");
  };

  const worker = screen && screen !== "unassigned" ? data.workers.find((item) => item.membershipId === screen) : null;
  if (worker) {
    return wrap(
      <WorkerView
        title={t("home_care.week.title")}
        name={worker.name || "—"}
        chip={worker.active ? null : { text: t("home_care.slots.worker_inactive"), tone: "wait" }}
        totals={workerTotals(t, worker)}
        days={workerCells(worker, data, { t })}
        hrefOf={hrefOf}
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen("") }}
      />
    );
  }
  if (screen === "unassigned" && data.unassigned.visits) {
    return wrap(
      <WorkerView
        title={t("home_care.week.title")}
        name={t("home_care.day.unassigned_title")}
        totals={weekRows(data, { t }).find((row) => row.key === "unassigned")?.line || ""}
        days={unassignedCells(data, { t })}
        hrefOf={hrefOf}
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen("") }}
      />
    );
  }

  const empty = weekEmpty(data);
  return wrap(
    <WeekView
      title={t("home_care.week.title")}
      heading={weekHeading(t, data)}
      totals={weekTotals(t, data)}
      days={daysCells(data, { t })}
      hrefOf={hrefOf}
      daysLabel={t("home_care.week.days_label")}
      rows={weekRows(data, { t })}
      onOpen={setScreen}
      empty={empty ? t("home_care.week.empty") : ""}
      legend={empty ? "" : t("home_care.week.legend")}
      hint={t("home_care.week.intro")}
      busy={week.busy}
      notice={fault}
      actions={[
        { key: "previous", label: t("home_care.week.previous"), disabled: week.busy || !data.previousWeek, onPress: () => goWeek(data.previousWeek) },
        data.monday !== data.thisWeek ? { key: "this", label: t("home_care.week.this_week"), disabled: week.busy, onPress: () => goWeek(data.thisWeek) } : null,
        { key: "next", label: t("home_care.week.next"), primary: true, disabled: week.busy || !data.nextWeek, onPress: () => goWeek(data.nextWeek) }
      ].filter(Boolean)}
    />
  );
}
