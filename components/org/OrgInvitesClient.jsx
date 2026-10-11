"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";

import { InvitesBoard, LinkView, RoleView, SendView, UnitView, WhoView } from "./invites/InvitesViews";
import {
  EMPTY_INVITE,
  INVITE_STEPS,
  inviteDirty,
  inviteLink,
  inviteListRow,
  inviteProblem,
  inviteStepStates,
  inviteSummary,
  seatOptions,
  templateNeedsUnit,
  templateOptions,
  unitOptions
} from "./invites/inviteRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Kutsete haldus.
 *
 * TOORE LINK kuvatakse ainult üks kord ja seda ei salvestata kuhugi. Andmebaasis
 * on ainult räsi — kui link kaob, tuleb saata uus kutse. See on teadlik piir,
 * mitte puudujääk.
 *
 * KUJU (11.10). Leht oli vorm, lingi kast ja tabel üksteise all. Nüüd on ees kas
 * loend, kutse loomine nelja väikese vaatena sammulaval või äsja loodud kutse
 * link. Vaated on failis ./invites/InvitesViews.jsx, reeglid failis
 * ./invites/inviteRules.js; see fail hoiab olekut ja teeb päringud.
 */
export default function OrgInvitesClient({ context, initialPage, units }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useOrgApi();
  const [invites, setInvites] = useState(initialPage?.items || []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor || null);
  /* Ametinimetus (nt „hooldaja") läheb liikmesusele kaasa: liikmete loend ja töölauad
     näitavad seda nime kõrval ja nimeta liikme puhul nime asemel. Nimi kutsega täidab
     liitumisel inimese profiili ainult siis, kui tal endal nime ei ole. */
  const [form, setForm] = useState(EMPTY_INVITE);
  const [mode, setMode] = useState("list");
  const [stepKey, setStepKey] = useState("who");
  const [issuedLink, setIssuedLink] = useState("");
  const [copied, setCopied] = useState(false);
  /* Mis päring käib: "" | "create" | "more" | "revoke:<id>". */
  const [pending, setPending] = useState("");
  /* Vaate enda teade: { view, text, tone }. */
  const [notice, setNotice] = useState(null);
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);
  const emailRef = useRef(null);
  const live = useRef(form);
  live.current = form;

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/invites`);
    if (payload?.items) {
      setInvites(payload.items);
      setNextCursor(payload.nextCursor || null);
    }
  }, [call, organizationId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const payload = await call(`/api/org/${organizationId}/invites?cursor=${encodeURIComponent(nextCursor)}`);
    if (!payload?.items) return;
    setInvites((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...payload.items.filter((item) => !known.has(item.id))];
    });
    setNextCursor(payload.nextCursor || null);
  }, [call, nextCursor, organizationId]);

  const create = useCallback(async () => {
    const { email, seatRole, templateKey, primaryUnitId, jobTitle, firstName, lastName } = live.current;
    setIssuedLink("");
    const payload = await call(`/api/org/${organizationId}/invites`, {
      method: "POST",
      body: {
        email,
        seatRole,
        capabilityTemplate: templateKey,
        primaryUnitId: primaryUnitId || null,
        jobTitle: jobTitle.trim() || null,
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null
      },
      fallbackKey: "org.errors.invite_create_failed"
    });
    if (payload?.inviteToken) {
      setIssuedLink(inviteLink(window.location.origin, payload.inviteToken));
      setCopied(false);
      /* Koht, roll ja üksus jäävad järgmise kutse jaoks alles (sama rolli kutsutakse
         sageli mitu inimest); inimese enda andmed tühjendatakse. */
      setForm((current) => ({ ...current, email: "", jobTitle: "", firstName: "", lastName: "" }));
      setMode("link");
      setStepKey("who");
      await reload();
    }
  }, [call, organizationId, reload]);

  const revoke = useCallback(
    async (inviteId) => {
      const payload = await call(`/api/org/${organizationId}/invites/${inviteId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.invite_revoke_failed"
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
    setNotice(null);
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const rows = useMemo(() => invites.map((invite) => inviteListRow(invite, { t })), [invites, t]);
  const seats = useMemo(() => seatOptions(t), [t]);
  const templates = useMemo(() => templateOptions(context, t), [context, t]);
  const unitChoices = useMemo(() => unitOptions(units, t), [units, t]);

  /* Vaate vahetusel (loend ↔ loomine ↔ link) kaob vajutatud nupp: fookus läheb
     e-posti väljale või vaate pealkirjale. Lava toob vaate nähtavale mõne kaadri
     pärast ja peidetud väli fookust ei võta, seepärast proovitakse mitu kaadrit. */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== mode;
    shown.current = mode;
    if (first || !moved) return undefined;
    let frame = 0;
    let tries = 0;
    const settle = () => {
      const target = mode === "create" ? emailRef.current : rootRef.current?.querySelector("[data-step-heading]");
      /* Kui inimene on vahepeal ise mõne välja või nupu peale läinud, jääb fookus sinna. */
      const held = document.activeElement;
      if (held && held !== target && held.matches?.("input, textarea, select, button, a[href]")) return;
      target?.focus?.({ preventScroll: true });
      tries += 1;
      if (document.activeElement !== target && tries < 90) frame = window.requestAnimationFrame(settle);
    };
    frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const changeField = useCallback(
    (key, value) => {
      setForm((current) => ({ ...current, [key]: value }));
      clearConfirm();
      setNotice(null);
      setError("");
    },
    [clearConfirm, setError]
  );

  const leaveCreate = useCallback(() => {
    setMode("list");
    setStepKey("who");
    setForm(EMPTY_INVITE);
    setNotice(null);
    setError("");
  }, [setError]);

  /* Loobumine viskab kirjutatu ära: kui midagi on kirjas, küsib see teist vajutust. */
  const pressDecline = useCallback(() => {
    if (sending.current) return;
    if (!inviteDirty(live.current)) {
      leaveCreate();
      return;
    }
    confirm.press("decline", leaveCreate);
  }, [confirm, leaveCreate]);

  const pressSend = useCallback(() => {
    const problem = inviteProblem(live.current);
    if (problem) {
      setNotice({ view: problem.step, tone: "risk", text: t(problem.key) });
      setStepKey(problem.step);
      return;
    }
    clearConfirm();
    void once("create", create);
  }, [clearConfirm, create, once, t]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(issuedLink);
      setCopied(true);
    } catch {
      /* Lõikelaud ei ole lubatud: valime lingi teksti, et inimene saaks selle ise kopeerida. */
      const node = rootRef.current?.querySelector("[data-link]");
      if (node) window.getSelection()?.selectAllChildren(node);
    }
  }, [issuedLink]);

  const fault = error ? { tone: "risk", text: error } : null;

  if (mode === "link" && issuedLink) {
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="invites">
          <LinkView
            t={t}
            link={issuedLink}
            copied={copied}
            onCopy={copyLink}
            onDone={() => {
              /* Link kaob koos selle vaatega: seda ei hoita kusagil. */
              setIssuedLink("");
              setMode("list");
            }}
          />
        </OrgPart>
      </div>
    );
  }

  if (mode === "list" || !writable) {
    const armedId = confirm.armed.startsWith("revoke:") ? confirm.armed.slice(7) : "";
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="invites">
          <InvitesBoard
            t={t}
            rows={rows}
            create={
              writable
                ? {
                    onCreate: () => {
                      confirm.clear();
                      setError("");
                      setNotice(null);
                      setMode("create");
                      setStepKey("who");
                    }
                  }
                : null
            }
            revoke={
              writable
                ? {
                    armedId,
                    busyId: pending.startsWith("revoke:") ? pending.slice(7) : "",
                    onPress: (row) => confirm.press(`revoke:${row.id}`, () => once(`revoke:${row.id}`, () => revoke(row.id))),
                    onCancel: confirm.clear
                  }
                : null
            }
            more={nextCursor ? { busy: pending === "more", onMore: () => once("more", loadMore) } : null}
            notice={fault}
          />
        </OrgPart>
      </div>
    );
  }

  const states = inviteStepStates(form);
  const steps = INVITE_STEPS.map((key) => ({
    key,
    label: t(`org.invites.steps.${key}.title`),
    short: t(`org.invites.steps.${key}.short`),
    state: states[key]
  }));
  const decline = { armed: confirm.armed === "decline", onPress: pressDecline };
  const noticeOf = (view) => (notice?.view === view ? notice : null);

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="invites" compact>
        <StepFlight
          label={t("org.invites.steps_label")}
          steps={steps}
          activeKey={stepKey}
          onStepChange={(_index, step) => {
            setStepKey(step?.key || "who");
            confirm.clear();
          }}
        >
          {(step, _index, flight) => {
            const glow = flight?.isActive !== false;
            if (step.key === "who") {
              return <WhoView t={t} form={form} onField={changeField} fieldRef={emailRef} notice={noticeOf("who")} decline={decline} onNext={() => setStepKey("role")} />;
            }
            if (step.key === "role") return <RoleView t={t} form={form} seats={seats} templates={templates} onField={changeField} />;
            if (step.key === "unit") {
              return (
                <UnitView
                  t={t}
                  value={form.primaryUnitId}
                  options={unitChoices}
                  needsUnit={templateNeedsUnit(form.templateKey)}
                  onUnit={(value) => changeField("primaryUnitId", value)}
                  notice={noticeOf("unit")}
                />
              );
            }
            return (
              <SendView
                t={t}
                summary={inviteSummary(form, units, { t })}
                problem={inviteProblem(form)}
                onFix={(problem) => setStepKey(problem.step)}
                notice={fault}
                decline={decline}
                send={{ busy: busy && pending === "create", onSend: pressSend }}
                glow={glow}
              />
            );
          }}
        </StepFlight>
      </OrgPart>
    </div>
  );
}
