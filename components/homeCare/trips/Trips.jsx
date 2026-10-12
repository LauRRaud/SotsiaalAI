"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { monthLabel } from "../month/monthRows";
import SubPage from "../page/SubPage";
import { TRIPS_PAGE, canRetract, kmOf, oddReadings, retractReady, tripLine, tripMonthRows, tripReady, tripRows, tripStartReady, tripTitle, vehicleChoices, workerRows } from "./tripRows";
import { useTrips } from "./useTrips";

/**
 * Sõidupäeviku leht: konks hoiab kuud, vormi ja päringuid, siin pannakse vaated
 * kokku. Ees on üks vaade korraga: kuu (oma sõitude kilomeetrid ja hooldusjuhile
 * töötajate kokkuvõte), oma sõidud (sealt lisatakse uus sõit), töötajate kuu
 * kokkuvõte koos tabelifailiga, kõik sõidud, üks sõit (tühistamine) ja vormid.
 *
 * Uue sõidu vorm on kahes vaates: päev ja sõiduk, siis näidud ja eesmärk
 * (kilomeetrid arvutatakse näitude vahest). Tühistamine küsib põhjust ja teist
 * vajutust samal nupul. Leht hoiab kogu vormi, nii et vaate vahetus ei kaota midagi.
 *
 * `initial`: kuu sõidupäevik (`getTripLog`).
 */
export default function Trips({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const state = useTrips({ organizationId, initial });
  const { data, form } = state;
  /* "" (kuu), "mine", "workers", "all", "trip:<loend>:<id>", "new", "new2" või "retract:<loend>". */
  const [screen, setScreen] = useState("");
  /* Tühistamise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    setArmed(false);
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.trips.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, TRIPS_PAGE);
    const more = !expanded[key] && rows.length > TRIPS_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  const [kind, scope, id] = screen.split(":");

  /* --- Uus sõit, esimene samm: päev ja sõiduk --- */
  if (screen === "new" && state.mode === "new" && data.canAdd) {
    return wrap(
      <FormView
        title={t("home_care.trips.title")}
        question={t("home_care.trips.add")}
        form={{
          id: `${formId}-new`,
          onSubmit: (event) => {
            event.preventDefault();
            if (tripStartReady(form)) go("new2");
          }
        }}
        fields={[
          { kind: "day", key: "day", label: t("home_care.trips.day_label"), value: form.day || "", max: data.today, onChange: (value) => state.setField("day", value || ""), required: true },
          { kind: "pick", key: "vehicle", label: t("home_care.trips.vehicle_label"), options: vehicleChoices(t), value: form.vehicle, onChange: (value) => state.setField("vehicle", value), columns: 2 },
          { kind: "text", key: "plate", label: t("home_care.trips.plate_label"), value: form.plate || "", onChange: (value) => state.setField("plate", value), max: HOME_CARE_LIMITS.TRIP_PLATE_MAX, size: "short" }
        ]}
        save={{ label: t("home_care.parts.next"), disabled: !tripStartReady(form) }}
        notice={fault}
        back={{
          label: t("home_care.trips.cancel"),
          onBack: () => {
            state.close();
            go("mine");
          }
        }}
      />
    );
  }

  /* --- Uus sõit, teine samm: näidud ja eesmärk --- */
  if (screen === "new2" && state.mode === "new" && data.canAdd) {
    const { km, shown } = kmOf(form);
    return wrap(
      <FormView
        title={t("home_care.trips.title")}
        question={t("home_care.trips.add")}
        form={{
          id: `${formId}-new2`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (tripReady(form) && (await once(state.add))) go("mine");
          }
        }}
        fields={[
          { kind: "text", key: "start", label: t("home_care.trips.start_label"), value: form.startOdometer || "", onChange: (value) => state.setField("startOdometer", value), inputMode: "numeric", max: 7, required: true, size: "short" },
          { kind: "text", key: "end", label: t("home_care.trips.end_label"), value: form.endOdometer || "", onChange: (value) => state.setField("endOdometer", value), inputMode: "numeric", max: 7, required: true, size: "short" },
          shown ? { kind: "note", key: "km", text: t("home_care.trips.km", { km }) } : null,
          { kind: "text", key: "purpose", label: t("home_care.trips.purpose_label"), value: form.purpose || "", onChange: (value) => state.setField("purpose", value), max: HOME_CARE_LIMITS.TRIP_PURPOSE_MAX, required: true }
        ].filter(Boolean)}
        hint={t("home_care.trips.purpose_hint")}
        save={{ label: t("home_care.trips.save"), busy: state.busy, disabled: !tripReady(form) }}
        notice={fault || (oddReadings(form) ? { text: t("home_care.errors.trip_odometer", { limit: HOME_CARE_LIMITS.TRIP_KM_MAX }), tone: "risk" } : null)}
        back={back("new")}
      />
    );
  }

  /* --- Tühistamise põhjus --- */
  if (kind === "retract" && state.mode?.retract) {
    return wrap(
      <FormView
        title={t("home_care.trips.title")}
        question={t("home_care.trips.retract")}
        form={{
          id: `${formId}-retract`,
          /* Tühistamine küsib teist vajutust samal nupul; sõit kaob loendist ja kuu kilomeetritest, põhjus jääb kirja. */
          onSubmit: async (event) => {
            event.preventDefault();
            if (!retractReady(form)) return;
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            if (await once(state.retract)) go(scope === "all" ? "all" : "mine");
          }
        }}
        fields={[{ kind: "text", key: "reason", label: t("home_care.trips.retract_reason"), value: form.reason || "", onChange: (value) => state.setField("reason", value), max: HOME_CARE_LIMITS.TRIP_PURPOSE_MAX, required: true }]}
        hint={armed ? t("home_care.trips.retract_note") : ""}
        save={{ label: t("home_care.trips.retract_save"), busy: state.busy, disabled: !retractReady(form), armed }}
        notice={fault}
        back={{
          label: t("home_care.trips.cancel"),
          onBack: () => {
            const target = `trip:${scope}:${state.mode.retract}`;
            state.close();
            go(target);
          }
        }}
      />
    );
  }

  /* --- Üks sõit --- */
  const withWorker = scope === "all";
  const trips = kind === "trip" ? (withWorker ? data.all?.trips : data.mine.trips) || [] : [];
  const trip = kind === "trip" ? trips.find((row) => row.id === id) : null;
  if (trip && canRetract(data, trip, withWorker)) {
    return wrap(
      <DetailView
        title={t("home_care.trips.title")}
        head={{ name: tripTitle(t, trip) }}
        notices={[{ key: "line", text: tripLine(t, trip, withWorker) }]}
        cells={[
          {
            key: "retract",
            label: t("home_care.trips.retract"),
            onPress: () => {
              state.startRetract(trip);
              go(`retract:${scope}`);
            }
          }
        ]}
        busy={state.busy}
        notice={fault}
        back={back(withWorker ? "all" : "mine")}
        mark="trip"
      />
    );
  }

  /* --- Oma sõidud --- */
  if (screen === "mine") {
    const page = pageOf("mine", tripRows(t, data, data.mine.trips));
    return wrap(
      <RowsView
        title={t("home_care.trips.title")}
        question={`${t("home_care.trips.mine_title")}${data.mine.trips.length ? ` · ${t("home_care.trips.km", { km: data.mine.km })}` : ""}`}
        lead={monthLabel(data.month)}
        rows={page.rows}
        onOpen={(key) => go(`trip:mine:${key}`)}
        empty={t("home_care.trips.mine_empty")}
        more={page.more}
        actions={
          data.canAdd
            ? [
                {
                  key: "add",
                  label: t("home_care.trips.add"),
                  primary: true,
                  onPress: () => {
                    state.startNew();
                    go("new");
                  }
                }
              ]
            : []
        }
        back={back("")}
        busy={state.busy}
        notice={fault}
        mark="trips-mine"
      />
    );
  }

  /* --- Töötajate kuu kokkuvõte ja tabelifail --- */
  if (screen === "workers" && data.all) {
    const page = pageOf("workers", workerRows(t, data.all.workers));
    return wrap(
      <RowsView
        title={t("home_care.trips.title")}
        question={t("home_care.trips.all_title")}
        lead={monthLabel(data.month)}
        rows={page.rows}
        empty={t("home_care.trips.all_empty")}
        hint={data.all.workers.length ? t("home_care.trips.download_hint") : ""}
        more={page.more}
        actions={data.all.workers.length ? [{ key: "download", label: t("home_care.trips.download"), onPress: state.download }] : []}
        back={back("")}
        mark="trips-workers"
      />
    );
  }

  /* --- Kõik sõidud --- */
  if (screen === "all" && data.all) {
    const page = pageOf("all", tripRows(t, data, data.all.trips, { withWorker: true }));
    return wrap(
      <RowsView
        title={t("home_care.trips.title")}
        question={t("home_care.trips.all_trips")}
        lead={monthLabel(data.month)}
        rows={page.rows}
        onOpen={(key) => go(`trip:all:${key}`)}
        empty={t("home_care.trips.all_empty")}
        hint={data.all.truncated ? t("home_care.trips.truncated", { count: data.all.trips.length }) : ""}
        more={page.more}
        back={back("")}
        busy={state.busy}
        notice={fault}
        mark="trips-all"
      />
    );
  }

  /* --- Kuu --- */
  return wrap(
    <RowsView
      title={t("home_care.trips.title")}
      question={monthLabel(data.month)}
      rows={tripMonthRows(t, data)}
      onOpen={go}
      hint={t("home_care.trips.intro")}
      actions={[
        { key: "previous", label: t("home_care.month.previous"), disabled: state.busy || !data.previousMonth, onPress: () => once(() => state.load(data.previousMonth)) },
        { key: "next", label: t("home_care.month.next"), primary: true, disabled: state.busy || !data.nextMonth, onPress: () => once(() => state.load(data.nextMonth)) }
      ]}
      busy={state.busy}
      notice={fault}
      mark="trips"
    />
  );
}
