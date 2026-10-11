"use client";

/**
 * `/org` klient: minu organisatsioonid, mulle saadetud kutsed ja organisatsiooni
 * loomine (arenduskava §7.1).
 *
 * KUJU (11.10). Leht oli üks pikk veerg vanal ühisel kihil (1772 px sisu 522 px
 * paneelis). Nüüd on korraga ees üks asi ja vaated vahetuvad kohapeal:
 *  - loend: organisatsioonid madalate ridadena; kutsed teise lahtri taga;
 *  - loomine: kolm väikest vaadet sammulaval (`components/stage/StepFlight`:
 *    nimi, liik, loomine), sammud all kiirmenüüs.
 * Loend ja loomine ei ole järjestikused sammud: need vahetuvad lehe sees.
 *
 * SEE FAIL hoiab olekut ja teeb päringu. Vaated on failis
 * `components/org/home/OrgHomeViews.jsx`, lehe reeglid (read, mis loend on ees,
 * mis loomiseks puudu on) failis `components/org/home/orgBoard.js`.
 *
 * ⓘ ja sulgemine on kiirmenüüs (lib/dashboardInfoContent → `org`): lehe nurgas
 * ega pealkirja all neid ei ole.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { BoardView, ConfirmView, KindView, NameView } from "@/components/org/home/OrgHomeViews";
import {
  AUTO_ADVANCE_MS,
  CONFIRM_MS,
  CREATE_STEPS,
  EMPTY_FORM,
  boardShown,
  createDirty,
  createFingerprint,
  createProblem,
  createStepStates,
  createSummary,
  inviteRow,
  kindAdvances,
  legalKindOptions,
  orgRow,
  pressTooSoon
} from "@/components/org/home/orgBoard";
import shared from "@/components/org/org.module.css";
import StepFlight from "@/components/stage/StepFlight";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/* Mitu kaadrit fookust proovitakse (umbes poolteist sekundit). */
const FOCUS_TRIES = 90;

export default function OrgHomeClient({ organizations, pendingInvites, canCreate, canCreateRole }) {
  const { t } = useI18n();
  usePanelInfoSlot({ infoId: "org" });
  const router = useRouter();
  const [wanted, setWanted] = useState("orgs");
  const [mode, setMode] = useState("list");
  const [stepKey, setStepKey] = useState("name");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  /* Teade kuulub vaate juurde, kus tegevus tehti: { view, text, tone }. */
  const [notice, setNotice] = useState(null);
  const [declineArmed, setDeclineArmed] = useState(false);

  const rootRef = useRef(null);
  const nameRef = useRef(null);
  const creationActionRef = useRef(null);
  const busyRef = useRef(false);
  const armedAt = useRef(0);
  /* Värskeim vorm päringu jaoks: nupp loeb seda, mis on ekraanil praegu. */
  const live = useRef(form);
  live.current = form;

  const mayCreate = Boolean(canCreate && canCreateRole);
  const orgRows = useMemo(() => (organizations || []).map((organization) => orgRow(organization, { t })), [organizations, t]);
  const inviteRows = useMemo(() => (pendingInvites || []).map((invite) => inviteRow(invite, { t })), [pendingInvites, t]);
  const filter = boardShown({ organizations: orgRows.length, invites: inviteRows.length }, wanted);
  const kindOptions = useMemo(() => legalKindOptions(t), [t]);

  const submit = useCallback(async () => {
    if (busyRef.current) return;
    const problem = createProblem(live.current);
    if (problem) {
      setNotice({ view: problem.step, tone: "risk", text: t(problem.key) });
      setStepKey(problem.step);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    setDeclineArmed(false);
    /* Pärast edukat loomist avaneb uus tööruum. Lukk jääb seniks peale: teine
       vajutus lehe vahetumise ajal looks muidu teise organisatsiooni. */
    let leaving = false;
    try {
      const { displayName, legalKind, legalName, registryCode } = live.current;
      const fingerprint = createFingerprint(live.current);
      if (creationActionRef.current?.fingerprint !== fingerprint) {
        creationActionRef.current = { fingerprint, id: crypto.randomUUID() };
      }
      const clientActionId = creationActionRef.current.id;
      const response = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, legalKind, legalName, registryCode, clientActionId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setNotice({ view: "confirm", tone: "risk", text: resolveApiMessage({ payload, t, fallbackKey: "org.errors.create_failed" }) });
        return;
      }
      creationActionRef.current = null;
      leaving = true;
      router.push(`/org/${payload.organization.id}`);
    } catch {
      setNotice({ view: "confirm", tone: "risk", text: t("org.errors.create_failed") });
    } finally {
      if (!leaving) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [router, t]);

  /* Vaate vahetusel (loend ↔ loomine) kaob vajutatud nupp: fookus läheb nime
     väljale või loendi pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shownMode = useRef("");
  useEffect(() => {
    const first = shownMode.current === "";
    if (shownMode.current === mode) return undefined;
    shownMode.current = mode;
    if (first) return undefined;
    /* Lava toob vaate nähtavale mõne kaadri pärast ja peidetud väli fookust ei
       võta: proovime, kuni fookus on kohal. Kui inimene on vahepeal ise kuhugi
       vajutanud, jääb fookus sinna. */
    let frame = 0;
    let tries = 0;
    const settle = () => {
      const target = mode === "create" ? nameRef.current : rootRef.current?.querySelector("[data-step-heading]");
      const held = document.activeElement;
      if (held && held !== document.body && held !== target) return;
      target?.focus?.({ preventScroll: true });
      tries += 1;
      if (document.activeElement !== target && tries < FOCUS_TRIES) frame = window.requestAnimationFrame(settle);
    };
    frame = window.requestAnimationFrame(settle);
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  /* Teist vajutust küsiv nupp ei jää ootama: küsimus aegub. */
  useEffect(() => {
    if (!declineArmed) return undefined;
    const timer = window.setTimeout(() => setDeclineArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [declineArmed]);

  const startCreate = useCallback(() => {
    setMode("create");
    setStepKey("name");
    setNotice(null);
    setDeclineArmed(false);
  }, []);

  const leaveCreate = useCallback(() => {
    setMode("list");
    setStepKey("name");
    setForm(EMPTY_FORM);
    creationActionRef.current = null;
    setNotice(null);
    setDeclineArmed(false);
  }, []);

  /* Loobumine viskab kirjutatu ära: kui midagi on kirjas, küsib see teist
     vajutust samal nupul ja tagajärg seisab vaate all servas. */
  const pressDecline = useCallback(() => {
    if (busyRef.current) return;
    if (!createDirty(live.current)) {
      leaveCreate();
      return;
    }
    if (!declineArmed) {
      armedAt.current = Date.now();
      setDeclineArmed(true);
      return;
    }
    if (pressTooSoon(armedAt.current)) return;
    leaveCreate();
  }, [declineArmed, leaveCreate]);

  const changeField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDeclineArmed(false);
    setNotice((current) => (current?.view === "name" && key === "displayName" ? null : current));
  }, []);

  /* Liigi vaates on ainult valik: esimene vastus viib vaate ise edasi (paneelis
     „Edasi" nuppu ei ole). Juba valitud liigi muutmine ja nooleklahviga
     valimine jätavad vaate ette. */
  const advanceRef = useRef(0);
  useEffect(() => () => window.clearTimeout(advanceRef.current), []);
  const chooseKind = useCallback((value, { byArrow = false } = {}) => {
    const advances = kindAdvances(live.current.legalKind, value, { byArrow });
    setForm((current) => ({ ...current, legalKind: value }));
    setDeclineArmed(false);
    setNotice((current) => (current?.view === "kind" ? null : current));
    window.clearTimeout(advanceRef.current);
    if (advances) advanceRef.current = window.setTimeout(() => setStepKey("confirm"), AUTO_ADVANCE_MS);
  }, []);

  const handleStepChange = useCallback((_index, step) => {
    setStepKey(step?.key || "name");
    setDeclineArmed(false);
  }, []);

  const hrefOf = useCallback((row) => `/org/${row.id}`, []);
  /* Tavaline vajutus avab tööruumi lehe sees; uue vahekaardi vajutus jääb brauserile. */
  const openOrg = useCallback(
    (event, row) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      router.push(hrefOf(row));
    },
    [hrefOf, router]
  );

  /* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */
  const frame = (children) => (
    <>
      <h1 className="sr-only">{t("org.home.heading")}</h1>
      <div className={shared.page} ref={rootRef}>
        {children}
      </div>
    </>
  );

  if (mode === "list" || !mayCreate) {
    return frame(
      <BoardView
        t={t}
        filter={filter}
        onFilter={setWanted}
        orgRows={orgRows}
        inviteRows={inviteRows}
        create={mayCreate ? { onCreate: startCreate } : null}
        hrefOf={hrefOf}
        onOpen={openOrg}
      />
    );
  }

  const states = createStepStates(form);
  const steps = CREATE_STEPS.map((key) => ({
    key,
    label: t(`org.home.create.steps.${key}.title`),
    short: t(`org.home.create.steps.${key}.short`),
    state: states[key]
  }));
  const decline = { armed: declineArmed, onPress: pressDecline };
  const noticeOf = (view) => (notice?.view === view ? notice : null);

  return frame(
    <StepFlight label={t("org.home.create.label")} steps={steps} activeKey={stepKey} onStepChange={handleStepChange}>
      {(step, _index, flight) => {
        const glow = flight?.isActive !== false;
        if (step.key === "name") {
          return (
            <NameView
              t={t}
              form={form}
              onField={changeField}
              fieldRef={nameRef}
              notice={noticeOf("name")}
              decline={decline}
              onNext={() => setStepKey("kind")}
            />
          );
        }
        if (step.key === "kind") {
          return <KindView t={t} value={form.legalKind} options={kindOptions} onKind={chooseKind} notice={noticeOf("kind")} />;
        }
        return (
          <ConfirmView
            t={t}
            summary={createSummary(form, { t })}
            problem={createProblem(form)}
            onFix={(problem) => setStepKey(problem.step)}
            notice={noticeOf("confirm")}
            decline={decline}
            create={{ busy, onCreate: submit }}
            glow={glow}
          />
        );
      }}
    </StepFlight>
  );
}
