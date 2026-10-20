"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";

import OrgPart from "./OrgPart";
import { ContactAddView, ContactListView, ManagerView } from "./support/ContactViews";
import {
  ADDABLE_CONTACT_TYPES,
  CONTACT_STEPS,
  addedContact,
  candidateOptions,
  contactRows,
  currentManager,
  memberOptions,
  reportingSummary,
  withReportingLine,
  withoutReportingLine
} from "./support/contactRules";
import { MeasureDetailsView, MeasureGroupView } from "./support/MeasureViews";
import {
  MEASURE_STEPS,
  measureDraft,
  measureGroupsOf,
  measurePayload,
  measureStepStates,
  measuresDirty,
  toggleMeasure
} from "./support/measureRules";
import { ConfirmView, ReceivedView, SupportBoard, WhatView, WhoView } from "./support/SupportViews";
import {
  EMPTY_SHARE,
  LIST_TABS,
  SEND_STEPS,
  receivedDetail,
  receivedRow,
  recipientOptions,
  sendStepStates,
  sendSummary,
  sentRow,
  shareDirty,
  shareProblem,
  shownList
} from "./support/supportRules";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Töötaja tugivaade. Neli asja ühes kohas:
 *   1. kellele ma saan toeavalduse saata;
 *   2. mida ma olen saatnud;
 *   3. mis mulle on saadetud;
 *   4. mida asutus pakub (tugimeetmed; haldur saab neid muuta). Sama loend
 *      eeltäidab töötaja Tööheaolu „Minu tugivõimalused".
 *
 * Haldur (`SUPPORT_CONTACT_ADMIN`) haldab siin ka tugi- ja turvakontakte.
 * Tööheaolu abipalve jõuab siia kinnitatud tekstiga (`prefill`, TO-6): saatmine
 * avaneb, aga saaja valib ja saatmise kinnitab inimene ise.
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus: kasutaja peab nägema mustvalgel, et
 * organisatsioon ei tea, kas ta vormi täitis. Seda teadet ei tohi eemaldada.
 *
 * KUJU (11.10). Neli kasti üksteise all on nüüd loend (saadud või saadetud),
 * üks avatud saadud avaldus ja saatmine kolme väikese vaatena sammulaval. Vaated
 * on failis ./support/SupportViews.jsx, reeglid failis ./support/supportRules.js;
 * see fail hoiab olekut ja teeb päringud. Sulgemine ja tagasivõtmine küsivad
 * teist vajutust; kinnitamata või saajata avaldus ütleb, mis on puudu.
 */

/* Pärast saatmist laaditakse leht uuesti (loendid tulevad serverist): see märk
   toob inimese tagasi saadetud avalduste juurde. Ainult selle vahekaardi mälus. */
const AFTER_RELOAD = "sotsiaalai:org-support:list";

export default function OrgSupportClient({
  context,
  recipients,
  receivedPage,
  sentPage,
  measures = [],
  canManage = false,
  contacts = [],
  candidates = [],
  reportingLines = [],
  prefill = null
}) {
  const { t } = useI18n();
  /* Tööheaolu abipalve: saatmine avaneb kohe, kui on kellele saata. Lähteviide
     läheb kaasa ainult selle teksti saatmisel. */
  const fromWellbeing = useRef(prefill?.summary ? prefill : null);
  const openWithPrefill = Boolean(fromWellbeing.current) && context?.writable !== false && recipients?.length > 0;
  /* Tugikontaktid halduri vaates. */
  const [contactList, setContactList] = useState(contacts);
  const [contactStep, setContactStep] = useState(CONTACT_STEPS[0]);
  const [contactForm, setContactForm] = useState({ contactType: ADDABLE_CONTACT_TYPES[0], membershipId: "" });
  /* Juhiseosed halduri vaates: üks liige korraga. */
  const [lines, setLines] = useState(reportingLines);
  const [managerForm, setManagerForm] = useState({ memberMembershipId: "", managerMembershipId: "" });
  /* Asutuse meetmed: salvestatud loend ja muutmise mustand. */
  const [savedMeasures, setSavedMeasures] = useState(measures);
  const [draft, setDraft] = useState(() => measureDraft(measures));
  const [measureStep, setMeasureStep] = useState(MEASURE_STEPS[0]);
  const [editingMeasure, setEditingMeasure] = useState("");
  const liveDraft = useRef(draft);
  liveDraft.current = draft;
  const { call, error, setError } = useOrgApi();
  const [form, setForm] = useState(() => (openWithPrefill ? { ...EMPTY_SHARE, summary: fromWellbeing.current.summary } : EMPTY_SHARE));
  const [received, setReceived] = useState(receivedPage?.items || []);
  const [receivedCursor, setReceivedCursor] = useState(receivedPage?.nextCursor || null);
  const [sent, setSent] = useState(sentPage?.items || []);
  const [sentCursor, setSentCursor] = useState(sentPage?.nextCursor || null);
  const [mode, setMode] = useState(openWithPrefill ? "send" : "list");
  const [wantedList, setWantedList] = useState("received");
  const [openId, setOpenId] = useState("");
  const [stepKey, setStepKey] = useState("who");
  /* Mis päring käib: "" | "send" | "more" | "open" | "close" | "measures" | "contact" | "manager" |
     "end-manager" | "recall:<id>" | "end:<id>". */
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState(() => (openWithPrefill ? { view: "who", text: t("org.support.from_wellbeing") } : null));
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);
  const live = useRef(form);
  live.current = form;

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  /* Mustandi viide aadressist ära: uuesti laadimine (nt pärast saatmist) ei
     ava sama abipalvet teist korda. */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("mustand")) return;
    url.searchParams.delete("mustand");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    try {
      const wanted = window.sessionStorage.getItem(AFTER_RELOAD);
      if (!wanted) return;
      window.sessionStorage.removeItem(AFTER_RELOAD);
      setWantedList(wanted);
    } catch {}
  }, []);

  const appendPage = useCallback((setter, items) => {
    setter((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...items.filter((item) => !known.has(item.id))];
    });
  }, []);

  const loadReceived = useCallback(async () => {
    if (!receivedCursor) return;
    const payload = await call(`/api/org/${organizationId}/tugi?cursor=${encodeURIComponent(receivedCursor)}`);
    if (!payload?.receivedPage) return;
    appendPage(setReceived, payload.receivedPage.items || []);
    setReceivedCursor(payload.receivedPage.nextCursor || null);
  }, [appendPage, call, organizationId, receivedCursor]);

  const loadSent = useCallback(async () => {
    if (!sentCursor) return;
    const payload = await call(
      `/api/org/${organizationId}/tugi/avaldused?cursor=${encodeURIComponent(sentCursor)}`
    );
    if (!payload?.sentPage) return;
    appendPage(setSent, payload.sentPage.items || []);
    setSentCursor(payload.sentPage.nextCursor || null);
  }, [appendPage, call, organizationId, sentCursor]);

  const send = useCallback(async () => {
    const { recipientMembershipId, summary, needs, confirmed } = live.current;
    const source = fromWellbeing.current;
    const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
      method: "POST",
      body: {
        action: "send",
        recipientMembershipId,
        userConfirmed: confirmed,
        /* Omaniku ja auditi viide Tööheaolu mustandile; saaja seda ei näe. */
        ...(source ? { sourceDraftId: source.sourceDraftId, sourceRecordId: source.sourceRecordId } : {}),
        snapshot: {
          summary,
          needs: needs
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        }
      },
      fallbackKey: "org.errors.support_share_failed"
    });
    if (payload) {
      /* Vorm tühjendatakse ENNE laadimist: kui laadimine mingil põhjusel ei
         toimu, ei jää saadetud tekst ekraanile nii, nagu oleks saatmata. */
      setForm(EMPTY_SHARE);
      setMode("list");
      try {
        window.sessionStorage.setItem(AFTER_RELOAD, "sent");
      } catch {}
      window.location.reload();
    }
  }, [call, organizationId]);

  const act = useCallback(
    async (action, shareId) => {
      const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
        method: "POST",
        body: { action, shareId },
        fallbackKey: "org.errors.support_share_failed"
      });
      if (payload) {
        try {
          window.sessionStorage.setItem(AFTER_RELOAD, action === "recall" ? "sent" : "received");
        } catch {}
        window.location.reload();
      }
    },
    [call, organizationId]
  );

  const open = useCallback(
    async (shareId) => {
      const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
        method: "POST",
        body: { action: "open", shareId },
        fallbackKey: "org.errors.support_share_failed"
      });
      if (payload?.share) {
        setReceived((current) => current.map((share) => (share.id === shareId ? payload.share : share)));
      }
    },
    [call, organizationId]
  );

  const saveMeasures = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/tugi`, {
      method: "POST",
      body: { action: "setMeasures", measures: measurePayload(liveDraft.current) },
      fallbackKey: "org.errors.support_update_failed"
    });
    if (!payload?.measures) return;
    setSavedMeasures(payload.measures);
    setDraft(measureDraft(payload.measures));
    setWantedList("measures");
    setMode("list");
    setNotice({ view: "board", text: t("org.support.measures.saved") });
  }, [call, organizationId, t]);

  const addContact = useCallback(async () => {
    const { contactType, membershipId } = contactForm;
    if (!membershipId) {
      setNotice({ view: "add", tone: "risk", text: t("org.support.contactAdmin.need_member") });
      return;
    }
    const payload = await call(`/api/org/${organizationId}/tugi`, {
      method: "POST",
      body: { action: "addContact", membershipId, contactType },
      fallbackKey: "org.errors.support_update_failed"
    });
    if (!payload?.contact) return;
    setContactList((current) => [...current, addedContact(payload.contact, candidates)]);
    setContactForm((current) => ({ ...current, membershipId: "" }));
    setContactStep("list");
    setNotice({ view: "list", text: t("org.support.contactAdmin.added") });
  }, [call, candidates, contactForm, organizationId, t]);

  const endContact = useCallback(
    async (contactId) => {
      const payload = await call(`/api/org/${organizationId}/tugi`, {
        method: "POST",
        body: { action: "endContact", contactId },
        fallbackKey: "org.errors.support_update_failed"
      });
      if (!payload?.contact) return;
      setContactList((current) => current.filter((contact) => contact.contactId !== contactId));
      setNotice({ view: "list", text: t("org.support.contactAdmin.ended") });
    },
    [call, organizationId, t]
  );

  const setManager = useCallback(async () => {
    const { memberMembershipId, managerMembershipId } = managerForm;
    if (!memberMembershipId || !managerMembershipId) {
      setNotice({ view: "manager", tone: "risk", text: t("org.support.contactAdmin.manager_need") });
      return;
    }
    const payload = await call(`/api/org/${organizationId}/tugi`, {
      method: "POST",
      body: { action: "setReportingLine", memberMembershipId, managerMembershipId },
      fallbackKey: "org.errors.support_update_failed"
    });
    if (!payload?.line) return;
    setLines((current) => withReportingLine(current, memberMembershipId, managerMembershipId));
    setManagerForm((current) => ({ ...current, managerMembershipId: "" }));
    setNotice({ view: "manager", text: t("org.support.contactAdmin.manager_saved") });
  }, [call, managerForm, organizationId, t]);

  const endManager = useCallback(
    async (memberMembershipId) => {
      const payload = await call(`/api/org/${organizationId}/tugi`, {
        method: "POST",
        body: { action: "endReportingLine", memberMembershipId },
        fallbackKey: "org.errors.support_update_failed"
      });
      if (!payload?.line) return;
      setLines((current) => withoutReportingLine(current, memberMembershipId));
      setNotice({ view: "manager", text: t("org.support.contactAdmin.manager_ended") });
    },
    [call, organizationId, t]
  );

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    setNotice(null);
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const options = useMemo(() => recipientOptions(recipients, { t }), [recipients, t]);
  const receivedRows = useMemo(() => received.map((share) => receivedRow(share, { t })), [received, t]);
  const sentRows = useMemo(() => sent.map((share) => sentRow(share, { t, writable })), [sent, t, writable]);
  const measureGroups = useMemo(() => measureGroupsOf(savedMeasures), [savedMeasures]);
  const list = shownList(wantedList);
  const openShare = received.find((share) => share.id === openId) || null;

  /* Vaate vahetusel kaob vajutatud rida või nupp: fookus läheb vaate pealkirjale.
     Esimesel joonistusel fookust ei võeta. */
  const shown = useRef("");
  const shownKey = `${mode}:${openShare ? openShare.id : ""}`;
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== shownKey;
    shown.current = shownKey;
    if (first || !moved) return undefined;
    const frame = window.requestAnimationFrame(() => rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [shownKey]);

  const fault = error ? { tone: "risk", text: error } : null;

  const leaveSend = useCallback(() => {
    fromWellbeing.current = null;
    setForm(EMPTY_SHARE);
    setMode("list");
    setStepKey("who");
    setNotice(null);
    setError("");
  }, [setError]);

  if (mode === "share" && openShare) {
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="support">
          <ReceivedView
            t={t}
            detail={receivedDetail(openShare, { t, writable })}
            open={{ busy: pending === "open", onOpen: () => once("open", () => open(openShare.id)) }}
            close={{ armed: confirm.armed === "close", busy: pending === "close", onPress: () => confirm.press("close", () => once("close", () => act("close", openShare.id))) }}
            notice={fault}
            onBack={() => {
              clearConfirm();
              setError("");
              setMode("list");
              setOpenId("");
            }}
          />
        </OrgPart>
      </div>
    );
  }

  if (mode === "contacts" && canManage) {
    const summary = reportingSummary(lines, candidates);
    const stateOf = (key) => {
      if (key === "list") return contactList.length ? "done" : "empty";
      if (key === "add") return contactForm.membershipId ? "partial" : "empty";
      return summary.assigned === 0 ? "empty" : summary.missing === 0 ? "done" : "partial";
    };
    const steps = CONTACT_STEPS.map((key) => ({
      key,
      label: t(`org.support.contactAdmin.steps.${key}.title`),
      short: t(`org.support.contactAdmin.steps.${key}.short`),
      state: stateOf(key)
    }));
    const current = managerForm.memberMembershipId ? currentManager(lines, candidates, managerForm.memberMembershipId, { t }) : null;
    const leaveContacts = () => {
      clearConfirm();
      setError("");
      setNotice(null);
      setContactStep(CONTACT_STEPS[0]);
      setWantedList("measures");
      setMode("list");
    };
    const noticeOf = (view) => fault || (notice?.view === view ? notice : null);
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="support" compact>
          <StepFlight
            label={t("org.support.contactAdmin.steps_label")}
            steps={steps}
            activeKey={contactStep}
            onStepChange={(_index, step) => {
              setContactStep(step?.key || CONTACT_STEPS[0]);
              clearConfirm();
            }}
          >
            {(step, _index, flight) =>
              step.key === "manager" ? (
                <ManagerView
                  t={t}
                  form={managerForm}
                  members={memberOptions(candidates, { t })}
                  managers={memberOptions(candidates, { t, except: managerForm.memberMembershipId })}
                  current={current}
                  summary={summary}
                  onField={(key, value) => {
                    setManagerForm((form) => ({ ...form, [key]: value, ...(key === "memberMembershipId" ? { managerMembershipId: "" } : {}) }));
                    clearConfirm();
                    setNotice(null);
                    setError("");
                  }}
                  set={{ busy: pending === "manager", onSet: () => { clearConfirm(); void once("manager", setManager); } }}
                  end={
                    current
                      ? {
                          armed: confirm.armed === "end-manager",
                          busy: pending === "end-manager",
                          onPress: () => confirm.press("end-manager", () => once("end-manager", () => endManager(managerForm.memberMembershipId)))
                        }
                      : null
                  }
                  notice={noticeOf("manager")}
                  onBack={leaveContacts}
                  glow={flight?.isActive !== false}
                />
              ) : step.key === "list" ? (
                <ContactListView
                  t={t}
                  rows={contactRows(contactList, { t })}
                  end={{
                    armedId: confirm.armed.startsWith("end:") ? confirm.armed.slice(4) : "",
                    busyId: pending.startsWith("end:") ? pending.slice(4) : "",
                    onPress: (row) => confirm.press(`end:${row.id}`, () => once(`end:${row.id}`, () => endContact(row.id)))
                  }}
                  notice={noticeOf("list")}
                  onBack={leaveContacts}
                />
              ) : (
                <ContactAddView
                  t={t}
                  form={contactForm}
                  options={candidateOptions(candidates, contactList, contactForm.contactType, { t })}
                  onField={(key, value) => {
                    setContactForm((current) => ({ ...current, [key]: value, ...(key === "contactType" ? { membershipId: "" } : {}) }));
                    setNotice(null);
                    setError("");
                  }}
                  add={{ busy: pending === "contact", onAdd: () => void once("contact", addContact) }}
                  notice={noticeOf("add")}
                  onBack={leaveContacts}
                  glow={flight?.isActive !== false}
                />
              )
            }
          </StepFlight>
        </OrgPart>
      </div>
    );
  }

  if (mode === "measures" && canManage) {
    const states = measureStepStates(draft);
    const steps = MEASURE_STEPS.map((key) => ({
      key,
      label: t(key === "details" ? "org.support.measures.steps.details.title" : `org.support.measures.groups.${key}`),
      short: t(`org.support.measures.steps.${key}.short`),
      state: states[key]
    }));
    const leaveMeasures = () => {
      setDraft(measureDraft(savedMeasures));
      setMode("list");
      setMeasureStep(MEASURE_STEPS[0]);
      setEditingMeasure("");
      setNotice(null);
      setError("");
    };
    const decline = {
      armed: confirm.armed === "decline",
      onPress: () => {
        if (sending.current) return;
        if (!measuresDirty(liveDraft.current, savedMeasures)) leaveMeasures();
        else confirm.press("decline", leaveMeasures);
      }
    };
    const save = { busy: pending === "measures", onSave: () => { clearConfirm(); void once("measures", saveMeasures); } };
    const changeDraft = (next) => {
      setDraft(next);
      clearConfirm();
      setError("");
    };
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="support" compact>
          <StepFlight
            label={t("org.support.measures.steps_label")}
            steps={steps}
            activeKey={measureStep}
            onStepChange={(_index, step) => {
              setMeasureStep(step?.key || MEASURE_STEPS[0]);
              clearConfirm();
            }}
          >
            {(step, _index, flight) => {
              const glow = flight?.isActive !== false;
              if (step.key === "details") {
                return (
                  <MeasureDetailsView
                    t={t}
                    draft={draft}
                    editing={editingMeasure}
                    onEdit={setEditingMeasure}
                    onDetails={(key, value) => changeDraft({ ...liveDraft.current, [key]: value })}
                    notice={fault}
                    decline={decline}
                    save={save}
                    glow={glow}
                  />
                );
              }
              return (
                <MeasureGroupView
                  t={t}
                  group={step.key}
                  draft={draft}
                  onToggle={(key) => changeDraft(toggleMeasure(liveDraft.current, key))}
                  notice={fault}
                  decline={decline}
                  save={save}
                  glow={glow}
                />
              );
            }}
          </StepFlight>
        </OrgPart>
      </div>
    );
  }

  if (mode === "send" && writable && options.length) {
    const states = sendStepStates(form);
    const steps = SEND_STEPS.map((key) => ({
      key,
      label: t(`org.support.steps.${key}.title`),
      short: t(`org.support.steps.${key}.short`),
      state: states[key]
    }));
    const decline = {
      armed: confirm.armed === "decline",
      onPress: () => {
        if (sending.current) return;
        if (!shareDirty(live.current)) leaveSend();
        else confirm.press("decline", leaveSend);
      }
    };
    const changeField = (key, value) => {
      setForm((current) => ({ ...current, [key]: value }));
      clearConfirm();
      setNotice(null);
      setError("");
    };
    const noticeOf = (view) => (notice?.view === view ? notice : null);
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="support" compact>
          <StepFlight
            label={t("org.support.steps_label")}
            steps={steps}
            activeKey={stepKey}
            onStepChange={(_index, step) => {
              setStepKey(step?.key || "who");
              clearConfirm();
            }}
          >
            {(step, _index, flight) => {
              const glow = flight?.isActive !== false;
              if (step.key === "who") {
                return <WhoView t={t} options={options} value={form.recipientMembershipId} onChoose={(value) => changeField("recipientMembershipId", value)} notice={noticeOf("who")} decline={decline} />;
              }
              if (step.key === "what") return <WhatView t={t} form={form} onField={changeField} notice={noticeOf("what")} />;
              return (
                <ConfirmView
                  t={t}
                  summary={sendSummary(form, recipients, { t })}
                  confirmed={form.confirmed}
                  onConfirm={(value) => changeField("confirmed", value)}
                  problem={shareProblem(form)}
                  onFix={(problem) => setStepKey(problem.step)}
                  notice={noticeOf("confirm") || fault}
                  decline={decline}
                  send={{
                    busy: pending === "send",
                    onSend: () => {
                      const problem = shareProblem(live.current);
                      if (problem) {
                        setNotice({ view: problem.step, tone: "risk", text: t(problem.key) });
                        setStepKey(problem.step);
                        return;
                      }
                      clearConfirm();
                      void once("send", send);
                    }
                  }}
                  glow={glow}
                />
              );
            }}
          </StepFlight>
        </OrgPart>
      </div>
    );
  }

  const cursor = list === "sent" ? sentCursor : receivedCursor;
  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="support">
        <SupportBoard
          t={t}
          tabs={[...LIST_TABS]}
          list={list}
          onList={(value) => {
            clearConfirm();
            setError("");
            setNotice(null);
            setWantedList(value);
          }}
          measureGroups={measureGroups}
          editMeasures={
            canManage
              ? {
                  onEdit: () => {
                    clearConfirm();
                    setError("");
                    setNotice(null);
                    setDraft(measureDraft(savedMeasures));
                    setMeasureStep(MEASURE_STEPS[0]);
                    setEditingMeasure("");
                    setMode("measures");
                  },
                  onContacts: () => {
                    clearConfirm();
                    setError("");
                    setNotice(null);
                    setContactStep(CONTACT_STEPS[0]);
                    setMode("contacts");
                  }
                }
              : null
          }
          receivedRows={receivedRows}
          sentRows={sentRows}
          onOpen={(id) => {
            clearConfirm();
            setError("");
            setOpenId(id);
            setMode("share");
          }}
          send={
            writable && options.length
              ? {
                  onSend: () => {
                    clearConfirm();
                    setError("");
                    setNotice(null);
                    setStepKey("who");
                    setMode("send");
                  }
                }
              : null
          }
          noRecipients={options.length === 0}
          recall={{
            armedId: confirm.armed.startsWith("recall:") ? confirm.armed.slice(7) : "",
            busyId: pending.startsWith("recall:") ? pending.slice(7) : "",
            onPress: (row) => confirm.press(`recall:${row.id}`, () => once(`recall:${row.id}`, () => act("recall", row.id))),
            onCancel: clearConfirm
          }}
          more={cursor && list !== "measures" ? { busy: pending === "more", onMore: () => once("more", list === "sent" ? loadSent : loadReceived) } : null}
          notice={fault || (notice?.view === "board" ? notice : null)}
        />
      </OrgPart>
    </div>
  );
}
