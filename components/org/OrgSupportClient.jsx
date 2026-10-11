"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";

import OrgPart from "./OrgPart";
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
 * Töötaja tugivaade. Kolm asja ühes kohas:
 *   1. kellele ma saan toeavalduse saata;
 *   2. mida ma olen saatnud;
 *   3. mis mulle on saadetud.
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

export default function OrgSupportClient({ context, recipients, receivedPage, sentPage }) {
  const { t } = useI18n();
  const { call, error, setError } = useOrgApi();
  const [form, setForm] = useState(EMPTY_SHARE);
  const [received, setReceived] = useState(receivedPage?.items || []);
  const [receivedCursor, setReceivedCursor] = useState(receivedPage?.nextCursor || null);
  const [sent, setSent] = useState(sentPage?.items || []);
  const [sentCursor, setSentCursor] = useState(sentPage?.nextCursor || null);
  const [mode, setMode] = useState("list");
  const [wantedList, setWantedList] = useState("received");
  const [openId, setOpenId] = useState("");
  const [stepKey, setStepKey] = useState("who");
  /* Mis päring käib: "" | "send" | "more" | "open" | "close" | "recall:<id>". */
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState(null);
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);
  const live = useRef(form);
  live.current = form;

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

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
    const payload = await call(`/api/org/${organizationId}/tugi/avaldused`, {
      method: "POST",
      body: {
        action: "send",
        recipientMembershipId,
        userConfirmed: confirmed,
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
            setWantedList(value);
          }}
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
          more={cursor ? { busy: pending === "more", onMore: () => once("more", list === "sent" ? loadSent : loadReceived) } : null}
          notice={fault}
        />
      </OrgPart>
    </div>
  );
}
