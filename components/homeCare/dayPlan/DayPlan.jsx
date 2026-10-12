"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CareObstacleKind, CarePlannedState, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { clientHref, formatTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import {
  DAY_PAGE,
  cancelChoices,
  continuityNote,
  dayEmpty,
  dayGroups,
  dayTitle,
  findVisit,
  firstVisitChoices,
  groupRows,
  obstacleLine,
  totalsLine,
  visitChips,
  visitLine,
  visitNotices,
  visitRights,
  visitRows,
  weekRows,
  workerChoices
} from "./dayPlanRows";
import { useDayPlan } from "./useDayPlan";

/**
 * Hooldusjuhi päevaplaani leht: konks hoiab päeva andmeid, vormi ja päringuid,
 * siin pannakse vaated kokku. Ees on üks vaade korraga: päeva rühmad (tegija
 * puudub, takistused, määramata, töötajad, klient on ära) ja päeva vahetus,
 * päeva valik (nädala päevad, päevalehed paberil, lingid), rühma käigud, takistus,
 * üks käik (ümbertõstmine, ära jätmine, tagasivõtmine, esmakäigu märkimine) ja
 * ümbertõstmise ning ära jätmise vorm.
 *
 * Käigu muutus kehtib ainult sellel päeval; muster ise ei muutu. Käigu seis tuleb
 * käigu kirjetest, käsitsi seda siin ei märgita. Päevaleht paberil avatakse uues
 * aknas KOHE vajutuse peale (muidu blokeerib brauser selle). Lingid kliendi lehele
 * ei eellaadi: lehe avamine jätab avamislogisse rea.
 *
 * `initial`: päeva andmed (`canEdit` ütleb, kas hooldusjuht tohib muuta).
 */
export default function DayPlan({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const day = useDayPlan({ organizationId, initial });
  const { data, form } = day;
  const canEdit = Boolean(data.canEdit);
  /* "" (päeva rühmad), "days", "group:<key>", "obstacle:<id>", "visit:<slotId>", "move:<slotId>" või "cancel:<slotId>". */
  const [screen, setScreen] = useState("");
  /* Vaade, kust käik avati (rühm või takistus): sinna viib „Tagasi". */
  const [from, setFrom] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    day.setError("");
    setScreen(next);
  };
  const fault = day.error ? { text: day.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const time = (value) => formatTime(value, timeZone);
  const [kind, id] = screen.split(":");
  const groups = dayGroups(data, { t, time });
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.day.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, DAY_PAGE);
    const more = !expanded[key] && rows.length > DAY_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  const openVisit = (slotId) => {
    setFrom(screen);
    go(`visit:${slotId}`);
  };
  /* Päeva vahetus: laeb päeva ja viib päeva rühmade juurde. */
  const goDay = async (target) => {
    if (await once(() => day.load(target))) {
      setExpanded({});
      go("");
    }
  };

  /* --- Ümbertõstmine ja ära jätmine --- */
  const formVisit = kind === "move" || kind === "cancel" ? findVisit(data, id) : null;
  if (formVisit && kind === "move" && canEdit) {
    const impact = continuityNote(formVisit, data, form.workerMembershipId, { t });
    return wrap(
      <FormView
        title={t("home_care.day.move_title", { client: formVisit.client.displayName })}
        form={{
          id: `${formId}-move`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(() => day.move(formVisit))) go(`visit:${formVisit.slotId}`);
          }
        }}
        fields={[
          { kind: "pick", key: "worker", label: t("home_care.day.worker_label"), options: workerChoices(formVisit, data, { t }), value: form.workerMembershipId, onChange: (value) => day.setField("workerMembershipId", value) },
          impact ? { kind: "note", key: "continuity", text: impact } : null,
          { kind: "time", key: "time", label: t("home_care.day.time_label"), value: form.startTime, onChange: (value) => day.setField("startTime", value), required: true },
          { kind: "text", key: "note", label: t("home_care.day.note_label"), value: form.note, onChange: (value) => day.setField("note", value), max: HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX }
        ].filter(Boolean)}
        save={{ label: t("home_care.day.move_save"), busy: day.busy }}
        notice={fault}
        back={back(`visit:${formVisit.slotId}`, t("home_care.day.close_form"))}
      />
    );
  }

  if (formVisit && kind === "cancel" && canEdit) {
    return wrap(
      <FormView
        title={t("home_care.day.cancel_title", { client: formVisit.client.displayName })}
        form={{
          id: `${formId}-cancel`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (form.reason && (await once(() => day.cancel(formVisit)))) go(`visit:${formVisit.slotId}`);
          }
        }}
        fields={[
          { kind: "pick", key: "reason", label: t("home_care.day.reason_label"), options: cancelChoices(t), value: form.reason, onChange: (value) => day.setField("reason", value) },
          { kind: "text", key: "note", label: t("home_care.day.note_label"), value: form.note, onChange: (value) => day.setField("note", value), max: HOME_CARE_LIMITS.VISIT_CHANGE_NOTE_MAX }
        ]}
        save={{ label: t("home_care.day.cancel_save"), busy: day.busy, disabled: !form.reason }}
        notice={fault}
        back={back(`visit:${formVisit.slotId}`, t("home_care.day.close_form"))}
      />
    );
  }

  /* --- Üks käik --- */
  const visit = kind === "visit" ? findVisit(data, id) : null;
  if (visit) {
    const rights = visitRights(visit, data, { canEdit });
    const current = visit.firstVisit?.outcome || "";
    return wrap(
      <DetailView
        title={t("home_care.day.title")}
        question={dayTitle(t, data)}
        head={{ name: `${visit.startTime} ${visit.client.displayName}`, chips: visitChips(visit, { t }) }}
        notices={[visitLine(visit, { t }), ...visitNotices(visit, { t })].filter(Boolean).map((text) => ({ key: text, text }))}
        cells={[
          rights.move
            ? {
                key: "move",
                label: t("home_care.day.move"),
                onPress: () => {
                  day.openForm(visit);
                  go(`move:${visit.slotId}`);
                }
              }
            : null,
          rights.cancel
            ? {
                key: "cancel",
                label: t("home_care.day.cancel"),
                onPress: () => {
                  day.openForm(visit);
                  go(`cancel:${visit.slotId}`);
                }
              }
            : null,
          rights.restore ? { key: "restore", label: t("home_care.day.restore"), onPress: () => once(() => day.restore(visit)) } : null,
          ...(rights.mark ? firstVisitChoices(t).map((choice) => ({ key: `mark-${choice.value}`, label: choice.label, armed: current === choice.value, onPress: () => once(() => day.markFirstVisit(visit, choice.value)) })) : [])
        ].filter(Boolean)}
        links={[{ key: "client", title: t("home_care.client.page_name"), href: clientHref(organizationId, visit.client.id) }]}
        busy={day.busy}
        notice={fault || (day.notice ? { text: day.notice, tone: "" } : null)}
        back={back(from)}
        mark="visit"
      />
    );
  }

  /* --- Takistus --- */
  const obstacle = kind === "obstacle" ? (data.obstacles || []).find((item) => item.id === id) : null;
  if (obstacle) {
    const page = pageOf(screen, visitRows(obstacle.visits || [], { t }));
    return wrap(
      <RowsView
        title={t("home_care.day.title")}
        question={obstacleLine(t, obstacle, obstacle.name, time)}
        rows={page.rows}
        onOpen={openVisit}
        empty={t("home_care.day.obstacle_none")}
        more={page.more}
        actions={
          canEdit
            ? [
                { key: "handle", label: t("home_care.day.obstacle_handle"), primary: true, onPress: () => once(() => day.handleObstacle(obstacle, false)) },
                obstacle.kind === CareObstacleKind.CANNOT_WORK ? { key: "absent", label: t("home_care.day.obstacle_absent"), onPress: () => once(() => day.handleObstacle(obstacle, true)) } : null
              ].filter(Boolean)
            : []
        }
        busy={day.busy}
        notice={fault}
        back={back("group:obstacles")}
        mark="obstacle"
      />
    );
  }

  /* --- Rühm --- */
  const group = kind === "group" ? groups.find((item) => item.key === id) : null;
  if (group) {
    if (group.obstacles) {
      const rows = group.obstacles.map((item) => ({ key: item.id, title: obstacleLine(t, item, item.name, time), tone: "risk" }));
      return wrap(<RowsView title={t("home_care.day.title")} question={group.title} lead={group.hint} rows={rows} onOpen={(key) => go(`obstacle:${key}`)} back={back("")} mark="obstacles" />);
    }
    const page = pageOf(screen, visitRows(group.visits, { t }));
    const printable = group.sheetOf && group.visits.some((item) => item.state !== CarePlannedState.CANCELLED);
    return wrap(
      <RowsView
        title={t("home_care.day.title")}
        question={`${group.title}${group.visits.length ? ` · ${group.visits.length}` : ""}`}
        lead={group.hint}
        rows={page.rows}
        onOpen={openVisit}
        more={page.more}
        actions={printable ? [{ key: "print-one", label: t("home_care.day_sheet.print_one"), onPress: () => once(() => day.printSheet(group.sheetOf)) }] : []}
        busy={day.busy}
        notice={fault}
        back={back("")}
        mark="group"
      />
    );
  }

  /* --- Päeva valik --- */
  if (screen === "days") {
    return wrap(
      <RowsView
        title={t("home_care.day.title")}
        question={t("home_care.day.week_label")}
        rows={weekRows(data, { t })}
        onOpen={goDay}
        hint={data.totals.planned > 0 ? t("home_care.day_sheet.hint") : ""}
        links={[
          { key: "week", title: t("home_care.week.link"), href: `/org/${organizationId}/koduteenus/nadal` },
          { key: "absences", title: t("home_care.absences.link"), href: `/org/${organizationId}/koduteenus/puudumised` }
        ]}
        actions={[
          data.day !== data.today ? { key: "today", label: t("home_care.day.today_button"), onPress: () => goDay(data.today) } : null,
          data.totals.planned > 0 ? { key: "print-all", label: t("home_care.day_sheet.print_all"), onPress: () => once(() => day.printSheet(null)) } : null
        ].filter(Boolean)}
        busy={day.busy}
        notice={fault}
        back={back("")}
        mark="days"
      />
    );
  }

  /* --- Päeva rühmad --- */
  const page = pageOf("groups", groupRows(groups));
  return wrap(
    <RowsView
      title={t("home_care.day.title")}
      question={dayTitle(t, data)}
      lead={[totalsLine(t, data), data.medicationOpen ? t("home_care.medication.open_count", { count: data.medicationOpen }) : ""].filter(Boolean).join(" ")}
      rows={page.rows}
      onOpen={(key) => go(`group:${key}`)}
      empty={dayEmpty(data) ? t("home_care.day.empty") : ""}
      hint={day.notice || t("home_care.day.intro")}
      more={page.more}
      actions={[
        { key: "previous", label: t("home_care.day.previous"), onPress: () => goDay(data.previousDay) },
        { key: "next", label: t("home_care.day.next"), onPress: () => goDay(data.nextDay) },
        { key: "days", label: t("home_care.day.week_label"), primary: true, onPress: () => go("days") }
      ]}
      busy={day.busy}
      notice={fault}
      mark="day"
    />
  );
}
