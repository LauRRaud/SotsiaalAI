"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import EntryOpen from "../diary/EntryOpen";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { EMPTY_FILTER, INCIDENTS_PAGE, EMPTY_PAGE, filterActive, filterSummary, incidentListRows, incidentMainRows, statusTabs, typeChoices } from "./incidentRows";
import { useIncidents } from "./useIncidents";

/**
 * Erijuhtumite registri leht hooldusjuhile: konks hoiab loendit, filtrit ja avatud
 * juhtumit, siin pannakse vaated kokku. Ees on üks vaade korraga: register (seisu
 * vaated lahtised, suletud ja kõik, filter ning teavitusest avatud juhtum), üks
 * loend ridadena (neli rida korraga, „Näita veel" näitab veel neli või laeb järgmise
 * lehekülje), filtri vorm (liik ja ajavahemik) ja üks avatud juhtum (seis, vastutaja,
 * käik ja tühistamine on olemasolevas kirje vaates; parandamine käib kliendi lehel).
 *
 * `?juhtum=<id>` tuleb teavituse suunajast: see juhtum on registri esimeses vaates
 * eraldi real ka siis, kui ta on suletud või ei mahu esimesele lehele.
 *
 * `initial`: erijuhtumite lehekülg; `focused`: teavitusest avatud juhtum või null.
 */
export default function Incidents({ context, initial, focused: initialFocused }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const state = useIncidents({ organizationId, initial, focused: initialFocused });
  const { page, focused, opened, applied, draft } = state;
  /* "" (register), "list", "filter" või "entry". */
  const [screen, setScreen] = useState("");
  /* Kuhu filtri ja avatud juhtumi vaatest tagasi minnakse. */
  const [origin, setOrigin] = useState("");
  const [shown, setShown] = useState(INCIDENTS_PAGE);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const moment = (value) => formatDateTime(value, timeZone);
  const counts = page.counts || EMPTY_PAGE.counts;
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.incidents.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const openEntry = (entry, from) => {
    state.setOpened(entry);
    setOrigin(from);
    go("entry");
  };

  /* --- Avatud juhtum --- */
  if (screen === "entry" && opened) {
    return wrap(
      <EntryOpen
        organizationId={organizationId}
        entry={opened}
        timeZone={timeZone}
        canWrite={Boolean(context.writable)}
        isCoordinator
        showClient
        back={{ label: t("home_care.parts.back"), onBack: () => go(origin) }}
        onChange={state.onChange}
      />
    );
  }

  /* --- Filter --- */
  if (screen === "filter") {
    const apply = (query) => async () => {
      if (await once(() => state.load(state.status, query))) go("list");
    };
    return wrap(
      <FormView
        title={t("home_care.incidents.title")}
        question={t("home_care.incidents.filter_title")}
        form={{
          id: `${formId}-filter`,
          onSubmit: (event) => {
            event.preventDefault();
            apply(draft)();
          }
        }}
        fields={[
          { kind: "select", key: "type", label: t("home_care.incident.type_label"), options: typeChoices(t), value: draft.type, onChange: (value) => state.setDraft((current) => ({ ...current, type: value })) },
          { kind: "day", key: "from", label: t("home_care.filter.from"), value: draft.from, onChange: (value) => state.setDraft((current) => ({ ...current, from: value || "" })) },
          { kind: "day", key: "to", label: t("home_care.filter.to"), value: draft.to, onChange: (value) => state.setDraft((current) => ({ ...current, to: value || "" })) }
        ]}
        save={{ label: t("home_care.filter.apply"), busy: state.busy }}
        extra={filterActive(applied) || filterActive(draft) ? [{ key: "clear", label: t("home_care.filter.clear"), onPress: apply(EMPTY_FILTER) }] : []}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go(origin) }}
      />
    );
  }

  /* --- Loend --- */
  if (screen === "list") {
    const rows = incidentListRows(page.items, focused, { t, moment });
    const hasMoreLoaded = shown < rows.length;
    const tab = statusTabs(t, counts).find((item) => item.key === state.status);
    return wrap(
      <RowsView
        title={t("home_care.incidents.title")}
        question={tab ? tab.label : t("home_care.incidents.title")}
        lead={filterSummary(t, applied)}
        rows={rows.slice(0, shown)}
        onOpen={(key) => openEntry(page.items.find((item) => item.id === key), "list")}
        empty={focused ? t("home_care.incidents.empty_other") : t("home_care.incidents.empty")}
        more={
          hasMoreLoaded || page.hasMore
            ? {
                label: t("home_care.home.more"),
                onMore: async () => {
                  if (hasMoreLoaded) {
                    setShown((now) => now + INCIDENTS_PAGE);
                    return;
                  }
                  if (await once(state.loadMore)) setShown((now) => now + INCIDENTS_PAGE);
                }
              }
            : null
        }
        actions={[
          {
            key: "filter",
            label: t("home_care.incidents.filter_title"),
            onPress: () => {
              setOrigin("list");
              go("filter");
            }
          }
        ]}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
        busy={state.busy}
        notice={fault}
        mark="incidents-list"
      />
    );
  }

  /* --- Register --- */
  return wrap(
    <RowsView
      title={t("home_care.incidents.title")}
      question={t("home_care.incidents.title")}
      lead={t("home_care.incidents.intro")}
      rows={incidentMainRows(t, { counts, focused, applied })}
      onOpen={async (key) => {
        if (key === "focused") {
          openEntry(focused, "");
          return;
        }
        if (key === "filter") {
          setOrigin("");
          go("filter");
          return;
        }
        /* Seisu vaade: loend laaditakse uuesti, kui seis vahetub. */
        if (key !== state.status && !(await once(() => state.load(key, applied)))) return;
        setShown(INCIDENTS_PAGE);
        go("list");
      }}
      busy={state.busy}
      notice={fault}
      mark="incidents"
    />
  );
}
