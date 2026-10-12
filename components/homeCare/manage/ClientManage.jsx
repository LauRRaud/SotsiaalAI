"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_CHANGE_OUTCOMES, CareClientStatus, CARE_CONTROL_CALL_OUTCOMES, CARE_CONTROL_CALL_PARTIES, CARE_NOTICE_ANSWERS, CARE_NOTICE_CHANNELS, CARE_NOTICE_REASONS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import HomeCareClientForm from "../HomeCareClientForm";
import { formatDateTime } from "../homeCareClient";
import {
  answerSignalReady,
  callLines,
  callReached,
  callNoteRequired,
  callReady,
  callRows,
  callTitle,
  callsLead,
  changeSignalLine,
  changeWaitingText,
  isDeath,
  manageRows,
  managePage,
  noticeAnswerNoteRequired,
  noticeAnswerReady,
  noticeChip,
  noticeReady,
  noticeRights,
  noticeRows,
  noticeStartReady,
  noticeStateLine,
  noticeTitle,
  pickableEntries,
  reasonChoices,
  reviewTitle,
  shortText,
  signalRows,
  statusOptions,
  statusReady,
  toggleEntryId,
  withdrawReady
} from "./manageRows";
import { useChangeSignals, useClientStatus, useControlCalls, useDecisionNotices } from "./useClientManage";

/**
 * Kliendi lehe osa „Hooldusjuhile": konksud hoiavad olekut ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: osa read (ülevaatus,
 * märkamised, kontrollkõne, teated, andmed, seis ja kaks linki), üks märkamine ja
 * selle vastus, kontrollkõned ja uue kõne kaks vaadet, teated, üks teade, selle
 * tekst, vastus ja tagasivõtmine, uue teate kolm vaadet, andmete vorm ja seisu vorm.
 *
 * Osa on lehel kogu aja (pooleli vorm ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). Kontrollkõne tühistamine ja kliendi surma
 * märkimine küsivad teist vajutust; surma korral on allikas kohustuslik. Lingid
 * kronoloogiale ja uksesildile ei eellaadi.
 *
 * `data`: kliendi lehe andmed (kliendi kirje, märkamised, kontrollkõned, teated);
 * `who`: { canWrite, isCoordinator }; `reviewItems`: [{ key, text }] (mis on peatatud või lõpetatud kliendi juures lahti);
 * `entries`: päeviku esimese lehekülje kirjed (teatele lisatavad); `onSignals(signals)`: leht hoiab sama seisu plaadi jaoks;
 * `onClient({ client, statusHistory })`: leht võtab uue kliendi kirje ja seisu ajaloo.
 */
export default function ClientManage({ active, organizationId, clientId, title, name, data, ended, who, reviewItems, entries, today, timeZone, unitOptions, onSignals, onClient }) {
  const { t } = useI18n();
  const formId = useId();
  const ids = { organizationId, clientId };
  const status = useClientStatus({ ...ids, data, onSaved: onClient });
  const sig = useChangeSignals({ organizationId, initial: data.changeSignals, onChanged: onSignals });
  const calls = useControlCalls({ ...ids, initial: data.controlCalls || null });
  const notices = useDecisionNotices({ ...ids, initial: data.decisionNotices || [] });
  /* "" (osa read), "review", "signals", "signal:<id>", "calls", "call:<id>", "call_new", "call_note", "notices", "notice:<id>",
     "text:<id>", "answer:<id>", "withdraw:<id>", "notice_new", "notice_entries", "notice_who", "details" või "status". */
  const [screen, setScreen] = useState("");
  /* Teist vajutust küsiv tegevus: esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  /* Loendid, kus „Näita veel" on vajutatud. */
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  if (!active) return null;

  const hooks = [status, sig, calls, notices];
  const go = (next) => {
    setArmed(false);
    for (const hook of hooks) hook.setError("");
    setScreen(next);
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const moment = (value) => formatDateTime(value, timeZone);
  const canWrite = Boolean(who.canWrite);
  const pageOf = (key, rows) => {
    const page = managePage(rows, Boolean(expanded[key]));
    return { rows: page.rows, more: page.more ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null };
  };
  const [kind, id] = screen.split(":");

  /* --- Andmed ja seis --- */
  if (screen === "details" && canWrite) {
    return wrap(
      <HomeCareClientForm
        organizationId={organizationId}
        client={data.client}
        unitOptions={unitOptions}
        onCancel={() => go("")}
        onSaved={(next) => {
          onClient({ client: next });
          go("");
        }}
      />
    );
  }

  if (screen === "status" && canWrite) {
    const form = status.form;
    const death = isDeath(form);
    const reasons = reasonChoices(t, form.status);
    return wrap(
      <FormView
        title={t("home_care.client.status_title")}
        form={{
          id: `${formId}-status`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (!statusReady(form)) return;
            if ((await once(status.save)) === "saved") go("");
          }
        }}
        fields={[
          { kind: "pick", key: "status", label: t("home_care.client.status_title"), options: statusOptions(t), value: form.status, onChange: status.chooseStatus },
          reasons.length ? { kind: "pick", key: "reason", label: t("home_care.client.status_reason"), options: reasons, value: form.reason, onChange: status.chooseReason } : null,
          { kind: "text", key: "note", label: t(death ? "home_care.client.status_source" : "home_care.client.status_note"), value: form.note, onChange: status.setNote, max: 300, required: death }
        ].filter(Boolean)}
        /* Surma märkimine küsib teist vajutust samal nupul; tagajärje lause on all servas. */
        hint={death && status.confirmDeath ? t("home_care.client.status_death_confirm") : form.status === CareClientStatus.ENDED ? t("home_care.client.status_ended_hint") : ""}
        save={{
          label: death ? (status.confirmDeath ? t("home_care.client.status_death_save") : t("home_care.client.status_death_next")) : t("home_care.client.status_save"),
          busy: status.busy,
          disabled: !statusReady(form),
          armed: death && status.confirmDeath
        }}
        notice={fault(status.error)}
        back={back("", t("home_care.client.cancel"))}
      />
    );
  }

  /* --- Ülevaatus --- */
  if (screen === "review" && reviewItems.length) {
    return wrap(<RowsView title={title} question={reviewTitle(t, ended)} rows={reviewItems.map((item) => ({ key: item.key, title: item.text, open: false }))} back={back("")} mark="review" />);
  }

  /* --- Märkamised --- */
  if (screen === "signals") {
    const page = pageOf("signals", signalRows(sig.signals, { t, moment }));
    return wrap(
      <RowsView
        title={title}
        question={t("home_care.change.signals_title")}
        lead={sig.signals.open.length ? t("home_care.change.signals_hint") : ""}
        rows={page.rows}
        onOpen={(key) => {
          sig.start(key);
          go(`signal:${key}`);
        }}
        more={page.more}
        busy={sig.busy}
        notice={fault(sig.error)}
        back={back("")}
        mark="signals"
      />
    );
  }

  const signal = kind === "signal" ? sig.signals.open.find((item) => item.id === id) : null;
  if (signal) {
    return wrap(
      <FormView
        title={t("home_care.change.answer")}
        question={changeSignalLine(t, signal)}
        lead={changeWaitingText(t, signal)}
        form={{
          id: `${formId}-signal`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (answerSignalReady(sig.form) && (await once(sig.save))) go("signals");
          }
        }}
        fields={[
          { kind: "pick", key: "outcome", label: t("home_care.change.outcome_label"), options: CARE_CHANGE_OUTCOMES.map((value) => ({ value, label: t(`home_care.change.outcomes.${value}`) })), value: sig.form.outcome, onChange: sig.setOutcome },
          { kind: "text", key: "note", label: t("home_care.change.note_label"), value: sig.form.note, onChange: sig.setNote, max: HOME_CARE_LIMITS.CHANGE_NOTE_MAX }
        ]}
        save={{ label: t("home_care.change.answer_save"), busy: sig.busy, disabled: !answerSignalReady(sig.form) }}
        notice={fault(sig.error)}
        back={back("signals", t("home_care.usual.cancel"))}
      />
    );
  }

  /* --- Kontrollkõne --- */
  if (screen === "calls" && calls.view) {
    const page = pageOf("calls", callRows(calls.view, { t }).map((row) => ({ ...row, open: canWrite })));
    return wrap(
      <RowsView
        title={title}
        question={t("home_care.control_call.title")}
        lead={callsLead(calls.view, { t })}
        rows={page.rows}
        onOpen={(key) => go(`call:${key}`)}
        hint={t("home_care.control_call.hint")}
        more={page.more}
        actions={
          canWrite
            ? [
                {
                  key: "add",
                  label: t("home_care.control_call.add"),
                  primary: true,
                  onPress: () => {
                    calls.start();
                    go("call_new");
                  }
                }
              ]
            : []
        }
        busy={calls.busy}
        notice={fault(calls.error)}
        back={back("")}
        mark="calls"
      />
    );
  }

  const callItem = kind === "call" && calls.view ? calls.view.items.find((item) => item.id === id) : null;
  if (callItem && canWrite) {
    return wrap(
      <DetailView
        title={title}
        question={t("home_care.control_call.title")}
        head={{ name: callTitle(t, callItem) }}
        notices={callLines(t, callItem).map((text) => ({ key: text, text }))}
        cells={[
          {
            key: "retract",
            label: t("home_care.control_call.retract"),
            armed,
            /* Tühistamine küsib teist vajutust samal lahtril; kirje ei kustu, see tühistatakse. */
            onPress: async () => {
              if (!armed) {
                setArmed(true);
                return;
              }
              setArmed(false);
              if (await once(() => calls.retract(callItem))) setScreen("calls");
            }
          }
        ]}
        consequence={armed ? t("home_care.control_call.retract_note") : ""}
        busy={calls.busy}
        notice={fault(calls.error)}
        back={back("calls")}
        mark="call"
      />
    );
  }

  if (screen === "call_new" && canWrite) {
    const form = calls.form;
    const reached = callReached(form);
    return wrap(
      <FormView
        title={t("home_care.control_call.add")}
        form={{
          id: `${formId}-call`,
          onSubmit: (event) => {
            event.preventDefault();
            if (form.outcome && !(reached && !form.spokeWith)) go("call_note");
          }
        }}
        fields={[
          { kind: "day", key: "day", label: t("home_care.control_call.day_label"), value: form.calledOn, onChange: (value) => calls.setField("calledOn", value || "") },
          { kind: "note", key: "day_hint", text: t("home_care.control_call.day_hint") },
          { kind: "pick", key: "outcome", label: t("home_care.control_call.outcome_label"), options: CARE_CONTROL_CALL_OUTCOMES.map((value) => ({ value, label: t(`home_care.control_call.outcomes.${value}`) })), value: form.outcome, onChange: (value) => calls.setField("outcome", value) },
          reached
            ? { kind: "pick", key: "party", label: t("home_care.control_call.party_label"), options: CARE_CONTROL_CALL_PARTIES.map((value) => ({ value, label: t(`home_care.control_call.parties.${value}`) })), value: form.spokeWith, onChange: (value) => calls.setField("spokeWith", value) }
            : null
        ].filter(Boolean)}
        save={{ label: t("home_care.parts.next"), disabled: !form.outcome || (reached && !form.spokeWith) }}
        notice={fault(calls.error)}
        back={back("calls", t("home_care.control_call.cancel"))}
      />
    );
  }

  if (screen === "call_note" && canWrite) {
    const form = calls.form;
    const required = callNoteRequired(form);
    return wrap(
      <FormView
        title={t("home_care.control_call.add")}
        form={{
          id: `${formId}-call-note`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (callReady(form) && (await once(calls.save))) go("calls");
          }
        }}
        fields={[{ kind: "text", key: "note", label: t("home_care.control_call.note_label"), value: form.note, onChange: (value) => calls.setField("note", value), max: HOME_CARE_LIMITS.CONTROL_CALL_NOTE_MAX, required }]}
        hint={required ? t("home_care.control_call.note_hint") : ""}
        save={{ label: t("home_care.control_call.save"), busy: calls.busy, disabled: !callReady(form) }}
        notice={fault(calls.error)}
        /* Tagasi esimesse vaatesse: kirjutatu jääb alles. */
        back={back("call_new")}
      />
    );
  }

  /* --- Teated otsustajale --- */
  const noticeItem = ["notice", "text", "answer", "withdraw"].includes(kind) ? notices.notices.find((item) => item.id === id) : null;

  if (screen === "notices" && (canWrite || notices.notices.length)) {
    const page = pageOf("notices", noticeRows(notices.notices, { t }));
    return wrap(
      <RowsView
        title={title}
        question={t("home_care.notice.title")}
        rows={page.rows}
        onOpen={(key) => go(`notice:${key}`)}
        empty={t("home_care.notice.none")}
        hint={t("home_care.notice.intro")}
        more={page.more}
        actions={
          canWrite
            ? [
                {
                  key: "add",
                  label: t("home_care.notice.add"),
                  primary: true,
                  onPress: () => {
                    notices.start({ reason: "", text: "", recipient: "", channel: "", sentOn: today, entryIds: [], withFigures: false });
                    go("notice_new");
                  }
                }
              ]
            : []
        }
        busy={notices.busy}
        notice={fault(notices.error)}
        back={back("")}
        mark="notices"
      />
    );
  }

  if (kind === "text" && noticeItem) {
    return wrap(
      <FormView
        title={t("home_care.notice.text_title")}
        lead={noticeTitle(t, noticeItem)}
        form={{
          id: `${formId}-text`,
          onSubmit: (event) => {
            event.preventDefault();
            notices.copy(noticeItem.sentText);
          }
        }}
        fields={[{ kind: "area", key: "text", label: t("home_care.notice.text_title"), value: noticeItem.sentText || "", onChange: () => {}, rows: 10, readOnly: true }]}
        hint={notices.copyState === "ok" ? t("home_care.notice.copied") : notices.copyState === "failed" ? t("home_care.notice.copy_failed") : t("home_care.notice.sent_hint")}
        save={{ label: t("home_care.notice.copy") }}
        back={back(`notice:${noticeItem.id}`)}
      />
    );
  }

  if (kind === "answer" && noticeItem && noticeRights(noticeItem, { canEdit: canWrite }).respond) {
    const form = notices.form;
    return wrap(
      <FormView
        title={t("home_care.notice.answer_add")}
        question={noticeTitle(t, noticeItem)}
        form={{
          id: `${formId}-answer`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (noticeAnswerReady(form) && (await once(() => notices.answer(noticeItem)))) go("notices");
          }
        }}
        fields={[
          { kind: "pick", key: "answer", label: t("home_care.notice.answer_label"), options: CARE_NOTICE_ANSWERS.map((value) => ({ value, label: t(`home_care.notice.answers.${value}`) })), value: form.answer || "", onChange: (value) => notices.setField("answer", value) },
          { kind: "day", key: "answered_on", label: t("home_care.notice.answered_on_label"), value: form.answeredOn || "", onChange: (value) => notices.setField("answeredOn", value), min: noticeItem.sentOn, max: today },
          form.answer === "REASSESS"
            ? { kind: "day", key: "reassess_by", label: t("home_care.notice.reassess_by_label"), value: form.reassessBy || "", onChange: (value) => notices.setField("reassessBy", value), min: noticeItem.sentOn, required: true }
            : null,
          {
            kind: "text",
            key: "answer_note",
            label: t(noticeAnswerNoteRequired(form) ? "home_care.notice.answer_note_required" : "home_care.notice.answer_note_label"),
            value: form.answerNote || "",
            onChange: (value) => notices.setField("answerNote", value),
            max: HOME_CARE_LIMITS.NOTICE_ANSWER_NOTE_MAX
          }
        ].filter(Boolean)}
        save={{ label: t("home_care.notice.answer_save"), busy: notices.busy, disabled: !noticeAnswerReady(form) }}
        notice={fault(notices.error)}
        back={back(`notice:${noticeItem.id}`, t("home_care.notice.cancel"))}
      />
    );
  }

  if (kind === "withdraw" && noticeItem && noticeRights(noticeItem, { canEdit: canWrite }).respond) {
    const form = notices.form;
    return wrap(
      <FormView
        title={t("home_care.notice.withdraw")}
        question={noticeTitle(t, noticeItem)}
        form={{
          id: `${formId}-withdraw`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (withdrawReady(form) && (await once(() => notices.withdraw(noticeItem)))) go("notices");
          }
        }}
        fields={[{ kind: "text", key: "reason", label: t("home_care.notice.withdraw_reason"), value: form.reason || "", onChange: (value) => notices.setField("reason", value), max: HOME_CARE_LIMITS.NOTICE_WITHDRAW_REASON_MAX, required: true }]}
        save={{ label: t("home_care.notice.withdraw_save"), busy: notices.busy, disabled: !withdrawReady(form) }}
        notice={fault(notices.error)}
        back={back(`notice:${noticeItem.id}`, t("home_care.notice.cancel"))}
      />
    );
  }

  if (kind === "notice" && noticeItem) {
    const rights = noticeRights(noticeItem, { canEdit: canWrite });
    return wrap(
      <DetailView
        title={title}
        question={t("home_care.notice.title")}
        head={{ name: noticeTitle(t, noticeItem), chip: noticeChip(t, noticeItem) }}
        notices={[noticeItem.recipient, noticeStateLine(t, noticeItem)].filter(Boolean).map((text) => ({ key: text, text }))}
        cells={[
          { key: "text", label: t("home_care.notice.show_text"), onPress: () => go(`text:${noticeItem.id}`) },
          rights.respond
            ? {
                key: "answer",
                label: t("home_care.notice.answer_add"),
                onPress: () => {
                  notices.start({ answer: "", answeredOn: today, reassessBy: "", answerNote: "" });
                  go(`answer:${noticeItem.id}`);
                }
              }
            : null,
          rights.respond
            ? {
                key: "withdraw",
                label: t("home_care.notice.withdraw"),
                onPress: () => {
                  notices.start({ reason: "" });
                  go(`withdraw:${noticeItem.id}`);
                }
              }
            : null
        ].filter(Boolean)}
        busy={notices.busy}
        notice={fault(notices.error)}
        back={back("notices")}
        mark="notice"
      />
    );
  }

  /* Uus teade: kolm vaadet. Esimene: miks ja tekst; teine: millised päeviku kirjed lisada; kolmas: kellele ja kuidas. */
  if (screen === "notice_new" && canWrite) {
    const form = notices.form;
    return wrap(
      <FormView
        title={t("home_care.notice.add")}
        form={{
          id: `${formId}-notice`,
          onSubmit: (event) => {
            event.preventDefault();
            if (noticeStartReady(form)) go("notice_entries");
          }
        }}
        fields={[
          {
            kind: "pick",
            key: "reason",
            label: t("home_care.notice.reason_label"),
            options: CARE_NOTICE_REASONS.map((value) => ({ value, label: t(`home_care.notice.reasons.${value}`) })),
            value: form.reason || "",
            /* Ülevaate juurde käivad arvud: märge pannakse ette, hooldusjuht saab selle maha võtta. */
            onChange: (value) => notices.setForm((previous) => ({ ...previous, reason: value, withFigures: value === "REVIEW" ? true : previous.withFigures }))
          },
          { kind: "area", key: "text", label: t("home_care.notice.text_label"), value: form.text || "", onChange: (value) => notices.setField("text", value), rows: 3, max: HOME_CARE_LIMITS.NOTICE_TEXT_MAX, required: true },
          { kind: "check", key: "figures", label: t("home_care.notice.figures_label"), value: Boolean(form.withFigures), onChange: (value) => notices.setField("withFigures", value) },
          { kind: "note", key: "figures_hint", text: t("home_care.notice.figures_hint") }
        ]}
        hint={t("home_care.notice.text_hint")}
        save={{ label: t("home_care.parts.next"), disabled: !noticeStartReady(form) }}
        notice={fault(notices.error)}
        back={back("notices", t("home_care.notice.cancel"))}
      />
    );
  }

  if (screen === "notice_entries" && canWrite) {
    const picked = notices.form.entryIds || [];
    const all = pickableEntries(entries).map((entry) => ({
      key: entry.id,
      title: moment(entry.occurredAt),
      line: shortText(entry.text),
      chip: picked.includes(entry.id) ? { text: t("home_care.notice.entry_picked"), tone: "ok" } : null
    }));
    const page = pageOf("entries", all);
    return wrap(
      <RowsView
        title={t("home_care.notice.add")}
        question={t("home_care.notice.entries_label", { limit: HOME_CARE_LIMITS.NOTICE_ENTRIES_MAX })}
        rows={page.rows}
        onOpen={(key) => notices.setField("entryIds", toggleEntryId(picked, key))}
        empty={t("home_care.notice.entries_none")}
        hint={t("home_care.notice.entries_hint")}
        more={page.more}
        actions={[{ key: "next", label: t("home_care.parts.next"), primary: true, onPress: () => go("notice_who") }]}
        back={back("notice_new")}
        mark="entries"
      />
    );
  }

  if (screen === "notice_who" && canWrite) {
    const form = notices.form;
    return wrap(
      <FormView
        title={t("home_care.notice.add")}
        form={{
          id: `${formId}-who`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (!noticeReady(form)) return;
            const created = await once(notices.create);
            /* Uue teate tekst kohe ette: järgmine samm on see kopeerida ja saata. */
            if (typeof created === "string") go(created ? `text:${created}` : "notices");
          }
        }}
        fields={[
          { kind: "text", key: "recipient", label: t("home_care.notice.recipient_label"), value: form.recipient || "", onChange: (value) => notices.setField("recipient", value), max: HOME_CARE_LIMITS.NOTICE_RECIPIENT_MAX },
          { kind: "pick", key: "channel", label: t("home_care.notice.channel_label"), options: CARE_NOTICE_CHANNELS.map((value) => ({ value, label: t(`home_care.notice.channels.${value}`) })), value: form.channel || "", onChange: (value) => notices.setField("channel", value) },
          { kind: "day", key: "sent_on", label: t("home_care.notice.sent_on_label"), value: form.sentOn || "", onChange: (value) => notices.setField("sentOn", value), max: today }
        ]}
        save={{ label: t("home_care.notice.save"), busy: notices.busy, disabled: !noticeReady(form) }}
        notice={fault(notices.error)}
        back={back("notice_entries")}
      />
    );
  }

  /* --- Osa read --- */
  const rows = manageRows({ t, ended, reviewItems, signals: sig.signals, calls: calls.view, notices: notices.notices, canWrite, client: data.client });
  const links = [
    { key: "chronology", title: t("home_care.chronology.link"), href: `/org/${organizationId}/koduteenus/kliendid/${clientId}/kronoloogia` },
    { key: "door_tag", title: t("home_care.door_tag.link"), href: `/org/${organizationId}/koduteenus/kliendid/${clientId}/silt` }
  ];
  return wrap(
    <RowsView
      title={title}
      question={name}
      rows={rows}
      onOpen={(key) => {
        if (key === "status") status.open();
        go(key);
      }}
      links={links}
      mark="manage"
    />
  );
}
