"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { minutesLabel } from "../decision/decisionRows";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { MONTH_PAGE, afterRows, clientRows, isLocked, lockHistory, lockNotices, missedRows, monthLabel, monthLead, monthNotes, openItemRows, openItemsMore, reopenReady, workerRows } from "./monthRows";
import { useMonth, useMonthLock, useMonthStatements } from "./useMonth";

/**
 * Kuu kokkuvõtte leht hooldusjuhile: konksud hoiavad kuud, lukku ja kuulehti, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: kuu (kuu vahetus all), kuu
 * lahtised asjad, kliendid kuu kaupa, töötajad kuu kaupa, ära jäänud käigud, kuu
 * lukk (lukustamise kinnitus ja uuesti avamine omaette vaates) või kuulehed ja
 * tabel failina.
 *
 * Lukustatud kuu (K5-p) arvud tulevad hetktõmmisest; kliendil, keda enam
 * nimekirjas ei ole, on nime asemel selgitus ja linki ei ole. Lukustamine on
 * kahe sammuga ja uuesti avamine küsib põhjust. Kuuleht avatakse uues aknas KOHE
 * vajutuse peale. Lingid kliendi lehele ei eellaadi.
 *
 * `initial`: kuu andmed.
 */
export default function Month({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const month = useMonth({ organizationId, timeZone, initial });
  const { data } = month;
  const lock = useMonthLock({ organizationId, data, onChange: month.setData, onReload: () => month.load(data.month) });
  const statements = useMonthStatements({ organizationId, month: data.month });
  /* "" (kuu), "open", "clients", "workers", "missed", "lock", "lock_confirm", "reopen" või "sheets". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut (lukustamine, uuesti avamine, kuuleht). */
  const once = useSendOnce();

  const go = (next) => {
    lock.setError("");
    statements.setError("");
    setScreen(next);
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);
  const moment = (value) => formatDateTime(value, timeZone);
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const locked = isLocked(data);
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.month.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, MONTH_PAGE);
    const more = !expanded[key] && rows.length > MONTH_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  /* Kuu vahetus: laeb kuu ja viib kuu vaatesse. */
  const goMonth = async (target) => {
    if (await once(() => month.load(target))) {
      setExpanded({});
      go("");
    }
  };

  /* --- Kuu lahtised asjad (K5-j) --- */
  if (screen === "open" && data.openItems) {
    const rows = openItemRows(data.openItems, { t, organizationId });
    const page = pageOf("open", rows);
    return wrap(
      <RowsView
        title={t("home_care.month.title")}
        question={t("home_care.month_open.title")}
        lead={data.openItems.clear ? t("home_care.month_open.clear") : ""}
        rows={[]}
        links={page.rows}
        hint={openItemsMore(data.openItems, { t })}
        more={page.more}
        back={back("")}
        mark="month-open"
      />
    );
  }

  /* --- Kliendid, töötajad, ära jäänud käigud --- */
  if (screen === "clients") {
    const page = pageOf("clients", clientRows(data, { t, organizationId }));
    return wrap(<RowsView title={t("home_care.month.title")} question={`${t("home_care.month.clients_title")} (${data.clients.length})`} rows={[]} links={page.rows} empty={data.clients.length ? "" : t("home_care.month.clients_empty")} more={page.more} back={back("")} mark="month-clients" />);
  }
  if (screen === "workers") {
    const page = pageOf("workers", workerRows(data, { t }).map((row) => ({ ...row, open: false })));
    return wrap(<RowsView title={t("home_care.month.title")} question={`${t("home_care.month.workers_title")} (${data.workers.length})`} rows={page.rows} empty={t("home_care.month.workers_empty")} more={page.more} back={back("")} mark="month-workers" />);
  }
  if (screen === "missed") {
    const page = pageOf("missed", missedRows(data, { t, organizationId, moment }));
    return wrap(<RowsView title={t("home_care.month.title")} question={`${t("home_care.month.missed_title")} (${data.missed.length})`} rows={[]} links={page.rows} empty={data.missed.length ? "" : t("home_care.month.missed_empty")} hint={t("home_care.month.how")} more={page.more} back={back("")} mark="month-missed" />);
  }

  /* --- Kuu lukk (K5-p) --- */
  if (screen === "lock_confirm" && data.lock?.canLock && data.lock.state === "OPEN") {
    return wrap(
      <DetailView
        title={t("home_care.month.title")}
        question={t("home_care.month_lock.title")}
        head={{ name: monthLabel(data.month) }}
        notices={[{ key: "confirm", text: t("home_care.month_lock.confirm_hint", { visits: data.totals.visits, amount: minutesLabel(t, data.totals.minutes) }) }]}
        actions={[{ key: "confirm", label: t("home_care.month_lock.confirm"), primary: true, busy: lock.busy, onPress: async () => ((await once(lock.doLock)) ? go("lock") : null) }]}
        busy={lock.busy}
        notice={fault(lock.error)}
        back={back("lock", t("home_care.month_lock.cancel"))}
        mark="lock-confirm"
      />
    );
  }

  if (screen === "reopen" && data.lock?.canReopen && data.lock.state === "LOCKED") {
    return wrap(
      <FormView
        title={t("home_care.month_lock.title")}
        form={{
          id: `${formId}-reopen`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (reopenReady(lock.reason) && (await once(lock.doReopen))) go("lock");
          }
        }}
        fields={[{ kind: "text", key: "reason", label: t("home_care.month_lock.reopen_reason"), value: lock.reason, onChange: lock.setReason, max: HOME_CARE_LIMITS.MONTH_REOPEN_REASON_MAX, required: true }]}
        hint={t("home_care.month_lock.reopen_hint")}
        save={{ label: t("home_care.month_lock.reopen_confirm"), busy: lock.busy, disabled: !reopenReady(lock.reason) }}
        notice={fault(lock.error)}
        back={back("lock", t("home_care.month_lock.cancel"))}
      />
    );
  }

  if (screen === "lock" && data.lock) {
    const history = lockHistory(t, data.lock, { moment });
    const notices = [...lockNotices(t, data.lock, { moment }), ...(history.length ? [{ key: "history_title", text: t("home_care.month_lock.history_title") }, ...history.map((row) => ({ key: row.key, text: row.text }))] : [])];
    return wrap(
      <DetailView
        title={t("home_care.month.title")}
        question={monthLabel(data.month)}
        head={{ name: t("home_care.month_lock.title"), chip: locked ? { text: t("home_care.month_lock.badge"), tone: "" } : null }}
        notices={notices}
        links={afterRows(data.lock, { t, organizationId, moment })}
        cells={[
          data.lock.state === "OPEN" && data.lock.canLock ? { key: "lock", label: t("home_care.month_lock.lock"), onPress: () => go("lock_confirm") } : null,
          data.lock.state === "LOCKED" && data.lock.canReopen ? { key: "reopen", label: t("home_care.month_lock.reopen"), onPress: () => go("reopen") } : null
        ].filter(Boolean)}
        busy={lock.busy}
        notice={fault(lock.error)}
        back={back("")}
        mark="lock"
      />
    );
  }

  /* --- Kuulehed ja tabel --- */
  if (screen === "sheets" && data.untilDay) {
    const open = (part) => () => once(() => statements.open(part));
    return wrap(
      <FormView
        title={t("home_care.month.title")}
        question={t("home_care.month.sheets_title")}
        form={{
          id: `${formId}-sheets`,
          onSubmit: (event) => event.preventDefault()
        }}
        fields={[
          { kind: "text", key: "phone", label: t("home_care.statement.phone_label"), value: statements.phone, onChange: statements.setPhone, max: HOME_CARE_LIMITS.REFERRAL_PHONE_MAX, type: "tel", size: "name" },
          { kind: "note", key: "sheet_hint", text: t(month.sheetState === "LOCKED" ? "home_care.month_sheet.hint_locked" : "home_care.month_sheet.hint_running") }
        ]}
        hint={[t("home_care.statement.hint"), statements.parts > 1 ? t("home_care.statement.parts_hint", { parts: statements.parts }) : ""].filter(Boolean).join(" ")}
        save={null}
        extra={[
          { key: "download", label: t("home_care.month_sheet.download"), onPress: month.download },
          { key: "part-1", label: t(statements.parts > 1 ? "home_care.statement.open_part" : "home_care.statement.open", { part: 1, parts: statements.parts }), onPress: open(1) },
          ...Array.from({ length: Math.max(0, statements.parts - 1) }, (_, index) => index + 2).map((part) => ({ key: `part-${part}`, label: t("home_care.statement.open_part", { part, parts: statements.parts }), onPress: open(part) }))
        ]}
        notice={fault(statements.error)}
        back={back("")}
      />
    );
  }

  /* --- Kuu --- */
  const rows = [
    data.openItems ? { key: "open", title: t("home_care.month_open.title"), line: data.openItems.clear ? t("home_care.month_open.clear") : "", tone: data.openItems.clear ? "" : "risk" } : null,
    { key: "clients", title: `${t("home_care.month.clients_title")} (${data.clients.length})` },
    { key: "workers", title: `${t("home_care.month.workers_title")} (${data.workers.length})` },
    { key: "missed", title: `${t("home_care.month.missed_title")} (${data.missed.length})`, tone: data.missed.length ? "risk" : "" },
    data.lock ? { key: "lock", title: t("home_care.month_lock.title"), chip: locked ? { text: t("home_care.month_lock.badge"), tone: "" } : null } : null,
    data.untilDay ? { key: "sheets", title: t("home_care.month.sheets_title") } : null
  ].filter(Boolean);
  return wrap(
    <RowsView
      title={t("home_care.month.title")}
      question={monthLabel(data.month)}
      lead={monthLead(t, data)}
      rows={rows}
      onOpen={go}
      hint={monthNotes(t, data) || t("home_care.month.intro")}
      actions={[
        { key: "previous", label: t("home_care.month.previous"), disabled: month.busy || !data.previousMonth, onPress: () => goMonth(data.previousMonth) },
        { key: "next", label: t("home_care.month.next"), primary: true, disabled: month.busy || !data.nextMonth, onPress: () => goMonth(data.nextMonth) }
      ]}
      busy={month.busy}
      notice={fault(month.error)}
      mark="month"
    />
  );
}
