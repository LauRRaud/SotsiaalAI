"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { LinkView, PlanForm, PlanView, PlansBoard, SponsorshipForm, SponsorshipsBoard } from "./funding/FundingViews";
import {
  EMPTY_PLAN,
  FUNDING_TABS,
  assignableMembers,
  emailLooksRight,
  planActions,
  planFacts,
  planProblemKey,
  planRow,
  seatReferencePrice,
  seatRoleOptions,
  seatedPeople,
  shownFundingTab,
  sponsorshipLink,
  sponsorshipReferencePrice,
  sponsorshipRow
} from "./funding/fundingRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Rahastuse vaade.
 *
 * MIDA SIIN EI OLE JA EI TULE: ühegi inimese kasutussagedust, vestluste arvu,
 * aktiivsusaega ega tootlikkust. Organisatsioon näeb, KELLE eest ta maksab —
 * mitte seda, mida see inimene teeb (arenduskava §5.6, §7.4).
 *
 * KUJU (11.10). Tabel ja kaks vormi üksteise all on nüüd kaks loendit (kohaplaanid
 * ja pöördujate tasutud ligipääs), üks avatud plaan, kaks väikest vormi ja ühe
 * korra näidatav link. Vaated on failis ./funding/FundingViews.jsx, reeglid failis
 * ./funding/fundingRules.js; see fail hoiab olekut ja teeb päringud. Koha
 * vabastamine, plaani lõpetamine ja pakkumise tühistamine küsivad teist vajutust.
 */
export default function OrgFundingClient({ context, initialSeatPlans, initialSponsorshipPage, members }) {
  const { t, locale } = useI18n();
  const { call, error, setError } = useOrgApi();
  const [seatPlans, setSeatPlans] = useState(initialSeatPlans || []);
  const [sponsorships, setSponsorships] = useState(initialSponsorshipPage?.items || []);
  const [sponsorshipCursor, setSponsorshipCursor] = useState(initialSponsorshipPage?.nextCursor || null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [issuedLink, setIssuedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [wantedTab, setWantedTab] = useState("plans");
  /* Mis on ees: "list" | "plan" | "newPlan" | "offer" | "link". */
  const [mode, setMode] = useState("list");
  const [openPlanId, setOpenPlanId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  /* Mis päring käib: "" | "addPlan" | "assign" | "release:<id>" | "end" | "offer" | "revoke:<id>" | "more". */
  const [pending, setPending] = useState("");
  const [hint, setHint] = useState("");
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const live = useRef({ planForm, sponsorEmail });
  live.current = { planForm, sponsorEmail };

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const reload = useCallback(async () => {
    const [plans, sponsors] = await Promise.all([
      call(`/api/org/${organizationId}/seats`),
      call(`/api/org/${organizationId}/sponsorships`)
    ]);
    if (plans?.seatPlans) setSeatPlans(plans.seatPlans);
    if (sponsors?.items) {
      setSponsorships(sponsors.items);
      setSponsorshipCursor(sponsors.nextCursor || null);
    }
  }, [call, organizationId]);

  const loadSponsorships = useCallback(async () => {
    if (!sponsorshipCursor) return;
    const payload = await call(
      `/api/org/${organizationId}/sponsorships?cursor=${encodeURIComponent(sponsorshipCursor)}`
    );
    if (!payload?.items) return;
    setSponsorships((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...payload.items.filter((item) => !known.has(item.id))];
    });
    setSponsorshipCursor(payload.nextCursor || null);
  }, [call, organizationId, sponsorshipCursor]);

  const addPlan = useCallback(async () => {
    const { seatRole, seatLimit } = live.current.planForm;
    const payload = await call(`/api/org/${organizationId}/seats`, {
      method: "POST",
      body: { seatRole, seatLimit: Number(seatLimit) },
      fallbackKey: "org.errors.seat_plan_create_failed"
    });
    if (payload) {
      setPlanForm(EMPTY_PLAN);
      setMode("list");
      await reload();
    }
  }, [call, organizationId, reload]);

  const assign = useCallback(
    async (seatPlanId, membershipId) => {
      if (!membershipId) return;
      const payload = await call(`/api/org/${organizationId}/seats/${seatPlanId}/assignments`, {
        method: "POST",
        body: { membershipId },
        fallbackKey: "org.errors.seat_assign_failed"
      });
      if (payload) {
        setAssigneeId("");
        await reload();
      }
    },
    [call, organizationId, reload]
  );

  const release = useCallback(
    async (assignmentId) => {
      const payload = await call(`/api/org/${organizationId}/seat-assignments/${assignmentId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.seat_release_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const endPlan = useCallback(
    async (seatPlanId) => {
      const payload = await call(`/api/org/${organizationId}/seats/${seatPlanId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.seat_plan_end_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const sponsor = useCallback(async () => {
    const { sponsorEmail } = live.current;
    setIssuedLink("");
    const payload = await call(`/api/org/${organizationId}/sponsorships`, {
      method: "POST",
      body: { email: sponsorEmail },
      fallbackKey: "org.errors.sponsorship_create_failed"
    });
    if (payload?.sponsorshipToken) {
      setIssuedLink(sponsorshipLink(window.location.origin, payload.sponsorshipToken));
      setCopied(false);
      setSponsorEmail("");
      setMode("link");
      await reload();
    }
  }, [call, organizationId, reload]);

  const revokeSponsorship = useCallback(
    async (sponsorshipId) => {
      const payload = await call(`/api/org/${organizationId}/sponsorships/${sponsorshipId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.sponsorship_revoke_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    setHint("");
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const tabs = [...FUNDING_TABS];
  const tab = shownFundingTab(wantedTab);
  const planRows = useMemo(() => seatPlans.map((plan) => planRow(plan, { t, locale })), [seatPlans, t, locale]);
  const sponsorshipRows = useMemo(() => sponsorships.map((row) => sponsorshipRow(row, { t, locale, writable })), [sponsorships, t, locale, writable]);
  const roles = useMemo(() => seatRoleOptions(t), [t]);
  const openPlan = seatPlans.find((plan) => plan.id === openPlanId) || null;

  /* Vaate vahetusel kaob vajutatud rida või nupp: fookus läheb vormi väljale või
     vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef("");
  const shownKey = `${mode}:${openPlan ? openPlan.id : ""}`;
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== shownKey;
    shown.current = shownKey;
    if (first || !moved) return;
    if (mode === "newPlan" || mode === "offer") fieldRef.current?.focus?.({ preventScroll: true });
    else rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [mode, shownKey]);

  const toList = useCallback(() => {
    clearConfirm();
    setError("");
    setHint("");
    setMode("list");
  }, [clearConfirm, setError]);

  const changeTab = (value) => {
    clearConfirm();
    setError("");
    setWantedTab(value);
  };
  const notice = error ? { tone: "risk", text: error } : hint ? { tone: "risk", text: hint } : null;
  const wrap = (view) => (
    <div ref={rootRef}>
      <OrgPart context={context} part="funding">
        {view}
      </OrgPart>
    </div>
  );

  if (mode === "link" && issuedLink) {
    return wrap(
      <LinkView
        t={t}
        link={issuedLink}
        copied={copied}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(issuedLink);
            setCopied(true);
          } catch {
            /* Lõikelaud ei ole lubatud: valime lingi teksti, et inimene saaks selle ise kopeerida. */
            const node = rootRef.current?.querySelector("[data-link]");
            if (node) window.getSelection()?.selectAllChildren(node);
          }
        }}
        onDone={() => {
          /* Link kaob koos selle vaatega: seda ei hoita kusagil. */
          setIssuedLink("");
          setWantedTab("sponsorships");
          toList();
        }}
      />
    );
  }

  if (mode === "newPlan" && writable) {
    return wrap(
      <PlanForm
        t={t}
        form={planForm}
        onField={(key, value) => {
          setPlanForm((current) => ({ ...current, [key]: value }));
          setHint("");
          setError("");
        }}
        roles={roles}
        reference={seatReferencePrice(planForm.seatRole, locale)}
        fieldRef={fieldRef}
        notice={notice}
        decline={{
          onPress: () => {
            setPlanForm(EMPTY_PLAN);
            toList();
          }
        }}
        save={{
          busy: pending === "addPlan",
          onSave: () => {
            const problem = planProblemKey(live.current.planForm);
            if (problem) {
              setHint(t(problem));
              return;
            }
            void once("addPlan", addPlan);
          }
        }}
      />
    );
  }

  if (mode === "offer" && writable) {
    return wrap(
      <SponsorshipForm
        t={t}
        email={sponsorEmail}
        onEmail={(value) => {
          setSponsorEmail(value);
          setHint("");
          setError("");
        }}
        reference={sponsorshipReferencePrice(locale)}
        fieldRef={fieldRef}
        notice={notice}
        decline={{
          onPress: () => {
            setSponsorEmail("");
            toList();
          }
        }}
        save={{
          busy: pending === "offer",
          onSave: () => {
            if (!emailLooksRight(live.current.sponsorEmail)) {
              setHint(t("org.funding.need_email"));
              return;
            }
            void once("offer", sponsor);
          }
        }}
      />
    );
  }

  if (mode === "plan" && openPlan) {
    const actions = planActions(openPlan, { writable });
    const people = seatedPeople(openPlan, { t });
    const armedSeat = people.find((person) => confirm.armed === `release:${person.id}`);
    const armedNote = confirm.armed === "end" ? t("org.funding.end_note") : armedSeat ? t("org.funding.release_note", { name: armedSeat.label }) : "";
    return wrap(
      <PlanView
        t={t}
        title={t(`org.seatRole.${openPlan.seatRole}`)}
        facts={planFacts(openPlan, { t, locale })}
        people={people}
        canRelease={actions.release}
        release={{
          armedId: armedSeat?.id || "",
          onPress: (person) => confirm.press(`release:${person.id}`, () => once(`release:${person.id}`, () => release(person.id)))
        }}
        assign={
          actions.assign
            ? {
                options: assignableMembers(openPlan, seatPlans, members, { t }),
                value: assigneeId,
                onChoose: (value) => {
                  setAssigneeId(value);
                  setHint("");
                },
                busy: pending === "assign",
                onAssign: () => {
                  if (!assigneeId) {
                    setHint(t("org.funding.pick_first"));
                    return;
                  }
                  clearConfirm();
                  void once("assign", () => assign(openPlan.id, assigneeId));
                }
              }
            : null
        }
        end={actions.end ? { armed: confirm.armed === "end", busy: pending === "end", onPress: () => confirm.press("end", () => once("end", () => endPlan(openPlan.id))) } : null}
        notice={notice}
        armedNote={armedNote}
        busy={Boolean(pending)}
        onBack={() => {
          setAssigneeId("");
          toList();
        }}
      />
    );
  }

  if (tab === "sponsorships") {
    return wrap(
      <SponsorshipsBoard
        t={t}
        tabs={tabs}
        tab={tab}
        onTab={changeTab}
        rows={sponsorshipRows}
        offer={
          writable
            ? {
                onOffer: () => {
                  clearConfirm();
                  setError("");
                  setHint("");
                  setMode("offer");
                }
              }
            : null
        }
        revoke={{
          armedId: confirm.armed.startsWith("revoke:") ? confirm.armed.slice(7) : "",
          busyId: pending.startsWith("revoke:") ? pending.slice(7) : "",
          onPress: (row) => confirm.press(`revoke:${row.id}`, () => once(`revoke:${row.id}`, () => revokeSponsorship(row.id))),
          onCancel: clearConfirm
        }}
        more={sponsorshipCursor ? { busy: pending === "more", onMore: () => once("more", loadSponsorships) } : null}
        notice={notice}
      />
    );
  }

  return wrap(
    <PlansBoard
      t={t}
      tabs={tabs}
      tab={tab}
      onTab={changeTab}
      rows={planRows}
      onOpen={(id) => {
        clearConfirm();
        setError("");
        setHint("");
        setAssigneeId("");
        setOpenPlanId(id);
        setMode("plan");
      }}
      add={
        writable
          ? {
              onAdd: () => {
                clearConfirm();
                setError("");
                setHint("");
                setMode("newPlan");
              }
            }
          : null
      }
      notice={notice}
    />
  );
}
