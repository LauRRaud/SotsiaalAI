"use client";

/**
 * Mentorlussuhe: mentori ja mentee ühine tööruum.
 *
 * KUJU (09.10). Leht oli üks pikk veerg klaaspaneeli sees olevas tumedas
 * kaardis. Nüüd on see sammulava (`components/stage/StepFlight.jsx`) laua
 * kujul, nagu avatud juhtum: suhe avaneb kõigi osade ülevaates (igal plaadil
 * esimene rida või tühjuse põhjus) ja osa avaneb omaette vaates. Osad ei ole
 * sammud, seepärast annab leht lavale `parts` ja oma sõnad („Kogu suhe”). Päis
 * lava kohal ütleb igas osas, kellega suhe on ja mis seisus see on.
 *
 * Vaated on failis ./relation/RelationViews.jsx, read ja otsused failis
 * ./relation/relationRows.js. Siin on andmed, päringud ja see, mis vaateid
 * olekuga seob.
 *
 * MIS ON TEISITI KUI ENNE (ja miks):
 *  - Osa näitab korraga üht asja: loendit, avatud kirjet või vormi. Varem
 *    seisis iga loendi all kohe selle vorm ja iga kirje küljes rida nuppe.
 *  - Kohtumise tühistamine, mustandi kõrvale jätmine ja suhte lõpetamine on
 *    lõplikud, seepärast küsib nupp teist vajutust. Lõpetamise ülevaates
 *    asendab see märkeruutu „saan aru”.
 *  - Teade seisab selle osa all, kus tegu tehti. Varem oli see lehe ülaservas,
 *    kuhu lehe lõpus vajutanud inimene ei näinud.
 *  - Pooleli eesmärkide tekst jääb alles, kui mõni teine tegu lehe uuesti
 *    laeb. Varem kirjutas iga laadimine välja üle.
 *  - Kui seis on mujal muutunud (vastus 409), loeb leht värske seisu ise:
 *    veateade palus vaadet värskendada, aga lehel ei olnud selleks nuppu.
 *  - Seisu sõna tuleb loendist (`relationWord`): tundmatu kood ei jõua
 *    ekraanile. Automaatselt lõppenud suhte kohta ei öelda enam, et selle
 *    lõpetas teine pool.
 *  - Uue kokkuleppe versiooni ja kokkuvõtte paranduse väli algab kehtivast
 *    tekstist: parandus on enamasti paar sõna, mitte terve tekst uuesti.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { localizePath } from "@/lib/localizePath";

import { EntryShell, TextLink } from "./entry/EntryParts";
import entry from "./entry/entry.module.css";
import {
  CLOSE_REASON_CHOICES,
  EMPTY_MEETING,
  LIST_CAPS,
  MEETING_MODES,
  TEXT_LIMIT,
  agreementModel,
  candidateRows,
  closeLists,
  closeReasonText,
  closedLine,
  goalDirty,
  isClosed,
  isRunning,
  meetingBody,
  meetingRows,
  meetingsEmptyText,
  noteRows,
  preparationRows,
  progressLine,
  relationHead,
  relationParts,
  relationWord,
  summaryRows
} from "./relation/relationRows";
import {
  AgreementView,
  GoalView,
  MeetingsView,
  NotesView,
  PreparationView,
  RelationHead,
  StateView,
  SummariesView
} from "./relation/RelationViews";

/* Osa, mis näitab loendit (mitte avatud kirjet ega vormi). */
const LIST_VIEW = Object.freeze({ mode: "list", id: "" });
const JSON_POST = Object.freeze({ method: "POST", headers: { "Content-Type": "application/json" } });

function dateFormatter(locale, options) {
  const formatter = new Intl.DateTimeFormat(locale || "et", options);
  return (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
  };
}

export default function MentoringRelationPage({ relationId }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const relationUrl = `/api/mentoring/relations/${encodeURIComponent(relationId)}`;

  const [relation, setRelation] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /* Teade selle osa kohta, kus tegu tehti: `{ part, text }`. */
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  /* Osa, kus viimati midagi tehti: kui osade loend muutub (suhe lõppes) ja lava
     ehitatakse uuesti, jääb inimene sinna, mitte ei kuku ülevaatesse. */
  const landRef = useRef(null);

  const [goalDraft, setGoalDraft] = useState("");
  /* Eesmärke muudeti mujal ajal, mil siin oli muudatus pooleli. */
  const [goalStale, setGoalStale] = useState(false);
  const goalDraftRef = useRef("");
  const goalSavedRef = useRef("");

  const [agreementDraft, setAgreementDraft] = useState("");
  const [proposing, setProposing] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ ...EMPTY_MEETING });
  const [meetingView, setMeetingView] = useState(LIST_VIEW);
  const [summaryDraft, setSummaryDraft] = useState("");
  /* Paranduse tekst kokkuvõtte kaupa: teise kokkuvõtte avamine ei vii pooleli teksti kaasa. */
  const [corrections, setCorrections] = useState({});
  const [summaryView, setSummaryView] = useState(LIST_VIEW);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteView, setNoteView] = useState(LIST_VIEW);
  /* Kinnitus „tekstis ei ole kliendiandmeid” ettevalmistuse kaupa. */
  const [shareConfirmed, setShareConfirmed] = useState({});
  const [prepView, setPrepView] = useState(LIST_VIEW);
  const [candidates, setCandidates] = useState([]);
  const [candidatesFailed, setCandidatesFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closePreview, setClosePreview] = useState(null);
  const [previewState, setPreviewState] = useState("idle");
  const [closeReason, setCloseReason] = useState(CLOSE_REASON_CHOICES[0]);

  const formatDate = useMemo(() => dateFormatter(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);
  const formatDay = useMemo(() => dateFormatter(locale, { dateStyle: "medium" }), [locale]);

  /** Loeb suhte. Tagastab, kas värske seis saadi kätte. */
  const load = useCallback(async (signal, { resetGoal = false } = {}) => {
    setLoadError("");
    try {
      const response = await fetch(relationUrl, { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      /* Vastus ilma suhteta jättis lehe varem tühjaks: see on sama seis mis
         „suhet ei leitud”. */
      if (response.status === 404 || (response.ok && payload?.ok !== false && !payload?.relation)) {
        setNotFound(true);
        return false;
      }
      if (!response.ok || payload?.ok === false) {
        throw new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      const next = payload.relation;
      const fresh = next.goalSummary || "";
      setRelation(next);
      /* Eesmärkide väli saab serveri teksti ainult siis, kui seal ei ole
         salvestamata muudatust (või kui just see salvestati). Muidu kirjutaks
         näiteks kohtumise lisamine pooleli teksti üle. */
      if (resetGoal || !goalDirty(goalDraftRef.current, goalSavedRef.current)) {
        goalDraftRef.current = fresh;
        setGoalDraft(fresh);
        setGoalStale(false);
      } else if (goalDirty(fresh, goalSavedRef.current)) {
        setGoalStale(true);
      }
      goalSavedRef.current = fresh;
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [relationUrl, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* Tööheaolus kinnitatud tekstid, mida mentee saab suhtesse tuua. Laadimise
     viga ei blokeeri suhet, aga ei tohi ka paista väitena „sul ei ole
     väljundeid”: osa ütleb, et laadimine ei õnnestunud. */
  const canHandoff = relation?.position === "mentee" && relation?.can?.handoffPreparation === true;
  const loadCandidates = useCallback(async (signal) => {
    setCandidatesFailed(false);
    try {
      const response = await fetch(`${relationUrl}/preparation`, { cache: "no-store", signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error("candidates");
      setCandidates(Array.isArray(payload?.candidates) ? payload.candidates : []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setCandidatesFailed(true);
    }
  }, [relationUrl]);

  useEffect(() => {
    if (!canHandoff) return undefined;
    const controller = new AbortController();
    void loadCandidates(controller.signal);
    return () => controller.abort();
  }, [canHandoff, loadCandidates]);

  /**
   * Üks koht, kus tegu õnnestub või annab lausega vea. `part` on osa, kus tegu
   * tehti: teade läheb selle osa alla. `done` on õnnestumise lause või
   * funktsioon, mis teeb selle vastusest. Tagastab vastuse või `null`.
   *
   * Väljad jäävad päringu ajal kirjutatavaks (lukus väli kaotaks fookuse),
   * seepärast hoiab topeltsaatmise ära see kontroll, mitte välja lukustamine.
   */
  const run = useCallback(async (part, url, body, done = "") => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    landRef.current = part;
    try {
      const response = await fetch(url, { ...JSON_POST, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const error = new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
        error.status = response.status;
        error.messageKey = String(payload?.messageKey || "");
        throw error;
      }
      await load(undefined, { resetGoal: part === "goal" });
      const text = typeof done === "function" ? done(payload) : done;
      if (text) setFeedback({ part, text });
      return payload;
    } catch (error) {
      let text = error?.message || t("mentoring.errors.save_failed");
      /* Seis muutus mujal (teine pool tegi midagi või sama suhe on lahti teises
         aknas): loeme värske seisu, et järgmine katse ei põrkaks vana versiooni
         taha. Üldine lause „värskenda vaadet” asendub siis lausega, mis ütleb,
         et värske seis on juba ees. */
      if (error?.status === 409 || error?.status === 404) {
        const fresh = await load();
        if (fresh && error.messageKey === "mentoring.errors.conflict") text = t("mentoring.labels.conflict_reloaded");
      }
      setFeedback({ part, text });
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [load, t]);

  /* Lõpetamise ülevaade: arvud tulevad serverist. Ilma ülevaateta lõpetada ei saa. */
  const loadClosePreview = useCallback(async () => {
    setClosePreview(null);
    setPreviewState("loading");
    try {
      const response = await fetch(relationUrl, { ...JSON_POST, body: JSON.stringify({ action: "close_preview" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        /* Suhe on vahepeal mujal lõpetatud: loeme värske seisu. */
        if (response.status === 409 || response.status === 404) await load();
        throw new Error("preview");
      }
      setClosePreview(payload);
      setPreviewState("ready");
    } catch {
      setPreviewState("failed");
    }
  }, [load, relationUrl]);

  const backHref = localizePath("/mentorlus");
  const shellProps = {
    title: t("mentoring.relation.title"),
    loadingText: loading ? t("mentoring.labels.loading") : "",
    error: loadError,
    retryText: t("mentoring.labels.retry"),
    onRetry: () => {
      setLoading(true);
      void load();
    }
  };

  if (notFound || !relation) {
    return (
      <EntryShell {...shellProps}>
        {notFound ? (
          <div className={entry.fault}>
            <p className={entry.quiet}>{t("mentoring.relation.not_found")}</p>
            <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
          </div>
        ) : null}
      </EntryShell>
    );
  }

  const closed = isClosed(relation);
  const draftRelation = String(relation.status || "").toUpperCase() === "DRAFT";
  const context = { t, formatDate, formatDay };
  const head = relationHead(relation, t);
  const shownCandidates = canHandoff ? candidates : [];
  const parts = relationParts({ relation, candidates: shownCandidates, ...context });
  const landIndex = parts.findIndex((part) => part.key === landRef.current);
  const progress = progressLine(relation, context);
  const capText = (key, rows) => (Array.isArray(rows) && rows.length >= LIST_CAPS[key] ? t("mentoring.relation.capped", { count: LIST_CAPS[key] }) : "");
  const noteFor = (part, fallback = "") => (feedback?.part === part ? feedback.text : fallback);
  /* Osa, kus tegu tehti, võib pärast värskendust kaduda (teine pool lõpetas
     suhte, mentee võttis ettevalmistuse tagasi). Teade ei tohi siis vaikselt
     kaduda: see seisab lava kohal. */
  const orphanNote = feedback?.text && !parts.some((part) => part.key === feedback.part) ? feedback.text : "";
  const clearNote = () => setFeedback(null);

  const renderPart = (step, index, flight) => {
    /* Peamise nupu helk on oma joonistuspind ja lava hoiab kõik osad
       monteerituna: helk on ainult sellel osal, mis on ees. */
    const glow = flight?.isActive !== false;

    switch (step.key) {
      case "goal": {
        const dirty = goalDirty(goalDraft, relation.goalSummary);
        return (
          <GoalView
            t={t}
            value={goalDraft}
            onChange={(value) => {
              goalDraftRef.current = value;
              setGoalDraft(value);
              clearNote();
            }}
            locked={relation.can?.editShared !== true}
            dirty={dirty}
            stale={goalStale}
            busy={busy}
            glow={glow}
            maxLength={TEXT_LIMIT}
            note={noteFor(
              "goal",
              dirty ? (goalStale ? t("mentoring.relation.views.goal.stale") : t("mentoring.relation.views.goal.unsaved")) : ""
            )}
            onSave={() =>
              void run(
                "goal",
                relationUrl,
                { action: "goal", goalSummary: goalDraft, expectedVersion: relation.version },
                t("mentoring.relation.goal_saved")
              )
            }
            onTakeFresh={() => {
              goalDraftRef.current = goalSavedRef.current;
              setGoalDraft(goalSavedRef.current);
              setGoalStale(false);
            }}
          />
        );
      }

      case "agreement": {
        const model = agreementModel(relation, t);
        /* Kui kokkulepet veel ei ole, on osa sisu kohe tekstiväli. */
        const mode = model.canPropose && (proposing || !model.hasText) ? "propose" : "read";
        const text = agreementDraft.trim();
        const same = model.hasText && text === model.text.trim();
        return (
          <AgreementView
            t={t}
            mode={mode}
            model={model}
            closed={closed}
            draft={agreementDraft}
            onDraft={(value) => {
              setAgreementDraft(value);
              clearNote();
            }}
            canSubmit={Boolean(text) && !same}
            busy={busy}
            glow={glow}
            maxLength={TEXT_LIMIT}
            note={noteFor("agreement", mode === "propose" && text && same ? t("mentoring.relation.views.agreement.unchanged") : "")}
            onStart={() => {
              /* Uus versioon algab kehtivast tekstist. */
              setAgreementDraft((current) => current || model.text);
              setProposing(true);
              clearNote();
            }}
            onCancel={() => setProposing(false)}
            onPropose={async () => {
              const done = await run(
                "agreement",
                `${relationUrl}/agreement`,
                { action: "propose", agreementText: agreementDraft, expectedVersion: relation.version },
                t("mentoring.relation.agreement_proposed_feedback")
              );
              if (done) {
                setAgreementDraft("");
                setProposing(false);
              }
            }}
            onAccept={() =>
              void run(
                "agreement",
                `${relationUrl}/agreement`,
                { action: "accept", agreementVersion: relation.agreementVersion },
                t("mentoring.relation.agreement_accepted_feedback")
              )
            }
          />
        );
      }

      case "meetings": {
        const rows = meetingRows(relation.meetings, { ...context, closed });
        const opened = meetingView.mode === "meeting" ? rows.find((row) => row.id === meetingView.id) || null : null;
        const canAdd = relation.can?.createMeeting === true;
        const rooms = (relation.commonRooms || []).map((room) => ({
          value: String(room.id),
          label: room.title || t("mentoring.relation.meeting_room_untitled")
        }));
        const roomKnown = meetingForm.mode !== "PLATFORM_ROOM" || rooms.some((room) => room.value === meetingForm.roomId);
        const meetingUrl = (row) => `${relationUrl}/meetings/${encodeURIComponent(row.id)}`;
        return (
          <MeetingsView
            t={t}
            mode={meetingView.mode === "add" && canAdd ? "add" : opened ? "meeting" : "list"}
            lead={closed ? undefined : t("mentoring.relation.meetings_help")}
            rows={rows}
            opened={opened}
            emptyText={meetingsEmptyText(relation, t)}
            capText={capText("meetings", relation.meetings)}
            canAdd={canAdd}
            roomHref={opened?.roomId ? localizePath(`/vestlus?roomId=${encodeURIComponent(opened.roomId)}`) : ""}
            busy={busy}
            glow={glow}
            note={noteFor("meetings", meetingView.mode === "add" && canAdd ? t("mentoring.relation.meeting_mode_hint") : "")}
            form={{
              id: `${formId}-meeting`,
              values: meetingForm,
              maxLength: TEXT_LIMIT,
              modes: MEETING_MODES.map((value) => ({ value, label: relationWord("meeting_mode", value, t).text })),
              rooms,
              ready: Boolean(meetingBody(meetingForm)) && roomKnown,
              onField: (key, value) => {
                setMeetingForm((previous) => {
                  const next = { ...previous, [key]: value };
                  /* Ainus ühine ruum on ainus valik: see on kohe valitud. */
                  if (key === "mode" && value === "PLATFORM_ROOM" && !previous.roomId && rooms.length === 1) next.roomId = rooms[0].value;
                  return next;
                });
                clearNote();
              },
              onSubmit: async (event) => {
                event.preventDefault();
                const body = meetingBody(meetingForm);
                if (!body || !roomKnown) return;
                const done = await run("meetings", `${relationUrl}/meetings`, body, t("mentoring.relation.meeting_created_feedback"));
                if (done) {
                  setMeetingForm({ ...EMPTY_MEETING });
                  setMeetingView(LIST_VIEW);
                }
              }
            }}
            onAdd={() => {
              setMeetingView({ mode: "add", id: "" });
              clearNote();
            }}
            onCancel={() => setMeetingView(LIST_VIEW)}
            onOpen={(id) => {
              setMeetingView({ mode: "meeting", id });
              clearNote();
            }}
            onBack={() => setMeetingView(LIST_VIEW)}
            onHeld={(row) =>
              void run("meetings", meetingUrl(row), { action: "held", expectedVersion: row.version }, t("mentoring.relation.meeting_held_feedback"))
            }
            onCancelMeeting={(row) =>
              run("meetings", meetingUrl(row), { action: "cancel", expectedVersion: row.version }, t("mentoring.relation.meeting_cancelled_feedback"))
            }
          />
        );
      }

      case "summaries": {
        const rows = summaryRows(relation.summaries, { ...context, closed });
        const opened = summaryView.id ? rows.find((row) => row.id === summaryView.id) || null : null;
        const canAdd = relation.can?.createSummary === true;
        const mode =
          summaryView.mode === "add" && canAdd
            ? "add"
            : summaryView.mode === "correct" && opened?.canCorrect
              ? "correct"
              : opened
                ? "summary"
                : "list";
        const correction = opened ? (corrections[opened.id] ?? opened.text) : "";
        const correctionSame = Boolean(opened) && correction.trim() === opened.text.trim();
        const summaryUrl = (row) => `${relationUrl}/summaries/${encodeURIComponent(row.id)}`;
        /* Uus mustand või parandus avaneb kohe: järgmine tegu on see kinnitamisele saata. */
        const openCreated = (payload) => setSummaryView(payload?.summary?.id ? { mode: "summary", id: String(payload.summary.id) } : LIST_VIEW);
        return (
          <SummariesView
            t={t}
            mode={mode}
            lead={closed ? t("mentoring.relation.summaries_closed_help") : t("mentoring.relation.summaries_help")}
            rows={rows}
            opened={opened}
            capText={capText("summaries", relation.summaries)}
            canAdd={canAdd}
            draft={summaryDraft}
            onDraft={(value) => {
              setSummaryDraft(value);
              clearNote();
            }}
            correction={correction}
            onCorrection={(value) => {
              if (opened) setCorrections((previous) => ({ ...previous, [opened.id]: value }));
              clearNote();
            }}
            correctionReady={Boolean(correction.trim()) && !correctionSame}
            busy={busy}
            glow={glow}
            maxLength={TEXT_LIMIT}
            note={noteFor(
              "summaries",
              mode === "correct" && correction.trim() && correctionSame ? t("mentoring.relation.views.summaries.correct_unchanged") : ""
            )}
            onAdd={() => {
              setSummaryView({ mode: "add", id: "" });
              clearNote();
            }}
            onCancel={() => setSummaryView((current) => (current.mode === "correct" ? { mode: "summary", id: current.id } : LIST_VIEW))}
            onOpen={(id) => {
              setSummaryView({ mode: "summary", id });
              clearNote();
            }}
            onBack={() => setSummaryView(LIST_VIEW)}
            onCreate={async () => {
              const done = await run(
                "summaries",
                `${relationUrl}/summaries`,
                { content: summaryDraft },
                t("mentoring.relation.summary_created_feedback")
              );
              if (done) {
                setSummaryDraft("");
                openCreated(done);
              }
            }}
            onSubmit={(row) =>
              void run(
                "summaries",
                summaryUrl(row),
                { action: "submit", expectedVersion: row.version },
                t("mentoring.relation.summary_submitted_feedback")
              )
            }
            onConfirm={(row) =>
              void run("summaries", summaryUrl(row), { action: "confirm" }, t("mentoring.relation.summary_confirmed_feedback"))
            }
            onDiscard={async (row) => {
              const done = await run("summaries", summaryUrl(row), { action: "discard" }, t("mentoring.relation.summary_discarded_feedback"));
              if (done) setSummaryView(LIST_VIEW);
            }}
            onStartCorrect={(row) => {
              setSummaryView({ mode: "correct", id: row.id });
              clearNote();
            }}
            onCorrect={async (row) => {
              const done = await run(
                "summaries",
                summaryUrl(row),
                { action: "supersede", content: correction },
                t("mentoring.relation.summary_correction_created_feedback")
              );
              if (done) {
                setCorrections((previous) => {
                  const next = { ...previous };
                  delete next[row.id];
                  return next;
                });
                openCreated(done);
              }
            }}
          />
        );
      }

      case "preparation": {
        const rows = preparationRows(relation.preparations, {
          ...context,
          position: relation.position,
          running: isRunning(relation)
        });
        const candidateList = candidateRows(shownCandidates);
        const opened = prepView.mode === "item" ? rows.find((row) => row.id === prepView.id) || null : null;
        const openedCandidate = prepView.mode === "candidate" ? candidateList.find((row) => row.id === prepView.id) || null : null;
        const preparationUrl = `${relationUrl}/preparation`;
        const nothing = !rows.length && !candidateList.length && !(canHandoff && candidatesFailed);
        return (
          <PreparationView
            t={t}
            mode={opened ? "item" : openedCandidate ? "candidate" : "list"}
            lead={relation.position === "mentee" ? t("mentoring.relation.preparation_help_mentee") : t("mentoring.relation.preparation_help_mentor")}
            rows={rows}
            opened={opened}
            candidates={candidateList}
            openedCandidate={openedCandidate}
            candidatesFailed={canHandoff && candidatesFailed}
            emptyText={
              nothing
                ? canHandoff
                  ? t("mentoring.relation.handoff_empty")
                  : t("mentoring.relation.views.preparation.summary_empty")
                : ""
            }
            capText={capText("preparations", relation.preparations)}
            confirmed={opened ? shareConfirmed[opened.id] === true : false}
            onConfirmed={(value) => {
              if (opened) setShareConfirmed((previous) => ({ ...previous, [opened.id]: value === true }));
              clearNote();
            }}
            busy={busy}
            glow={glow}
            note={noteFor("preparation")}
            onOpen={(id) => {
              setPrepView({ mode: "item", id });
              clearNote();
            }}
            onOpenCandidate={(id) => {
              setPrepView({ mode: "candidate", id });
              clearNote();
            }}
            onBack={() => setPrepView(LIST_VIEW)}
            onRetryCandidates={() => void loadCandidates()}
            onShare={async (row) => {
              const done = await run(
                "preparation",
                preparationUrl,
                { action: "share", noteId: row.id, confirmedNoClientData: shareConfirmed[row.id] === true },
                t("mentoring.relation.preparation_shared_feedback")
              );
              /* Kinnitus käis selle jagamise kohta: uus jagamine küsib seda uuesti. */
              if (done) setShareConfirmed((previous) => ({ ...previous, [row.id]: false }));
            }}
            onRecall={(row) =>
              void run("preparation", preparationUrl, { action: "recall", noteId: row.id }, t("mentoring.relation.preparation_recalled_feedback"))
            }
            onMarkOpened={(row) =>
              void run("preparation", preparationUrl, { action: "open", noteId: row.id }, t("mentoring.relation.preparation_open_feedback"))
            }
            onHandoff={async (candidate) => {
              const done = await run(
                "preparation",
                preparationUrl,
                { action: "handoff", draftId: candidate.id, expectedUpdatedAt: candidate.updatedAt },
                t("mentoring.relation.handoff_done_feedback")
              );
              if (done) {
                /* Toodud tekst kaob valikust ainult siis, kui toomine õnnestus,
                   ja avaneb kohe: järgmine tegu on see mentorile jagada. */
                setCandidates((previous) => previous.filter((item) => String(item?.id) !== candidate.id));
                setPrepView(done.preparation?.id ? { mode: "item", id: String(done.preparation.id) } : LIST_VIEW);
              } else {
                /* Tekst võis vahepeal Tööheaolus muutuda või olla juba toodud. */
                void loadCandidates();
              }
            }}
          />
        );
      }

      case "notes": {
        const rows = noteRows(relation.notes, context);
        const opened = noteView.mode === "note" ? rows.find((row) => row.id === noteView.id) || null : null;
        const canAdd = relation.can?.addNote === true;
        return (
          <NotesView
            t={t}
            mode={noteView.mode === "add" && canAdd ? "add" : opened ? "note" : "list"}
            rows={rows}
            opened={opened}
            capText={capText("notes", relation.notes)}
            canAdd={canAdd}
            draft={noteDraft}
            onDraft={(value) => {
              setNoteDraft(value);
              clearNote();
            }}
            busy={busy}
            glow={glow}
            maxLength={TEXT_LIMIT}
            note={noteFor("notes")}
            onAdd={() => {
              setNoteView({ mode: "add", id: "" });
              clearNote();
            }}
            onCancel={() => setNoteView(LIST_VIEW)}
            onOpen={(id) => {
              setNoteView({ mode: "note", id });
              clearNote();
            }}
            onBack={() => setNoteView(LIST_VIEW)}
            onCreate={async () => {
              const done = await run("notes", `${relationUrl}/notes`, { content: noteDraft }, t("mentoring.relation.note_added_feedback"));
              if (done) {
                setNoteDraft("");
                setNoteView(LIST_VIEW);
              }
            }}
          />
        );
      }

      default: {
        const lists = closeLists(closePreview, t);
        const cards = closed
          ? []
          : [
              relation.can?.pause
                ? {
                    key: "pause",
                    title: t("mentoring.relation.pause"),
                    description: t("mentoring.relation.views.state.pause_hint"),
                    disabled: busy,
                    onClick: () => void run("state", relationUrl, { action: "pause" }, t("mentoring.relation.paused_feedback"))
                  }
                : null,
              relation.can?.resume
                ? {
                    key: "resume",
                    title: t("mentoring.relation.resume"),
                    description: t("mentoring.relation.views.state.resume_hint"),
                    disabled: busy,
                    onClick: () => void run("state", relationUrl, { action: "resume" }, t("mentoring.relation.resumed_feedback"))
                  }
                : null,
              {
                key: "alive",
                title: t("mentoring.relation.views.state.alive"),
                description: t("mentoring.relation.views.state.alive_hint"),
                disabled: busy,
                /* Server ütleb, kas küsimus oli ootel: lause ei luba rohkem, kui juhtus. */
                onClick: () =>
                  void run("state", relationUrl, { action: "alive" }, (payload) =>
                    payload?.cleared ? t("mentoring.relation.views.state.alive_cleared") : t("mentoring.relation.views.state.alive_none")
                  )
              },
              relation.can?.close
                ? {
                    key: "close",
                    title: t("mentoring.relation.close_confirm_action"),
                    description: t("mentoring.relation.views.state.close_hint"),
                    disabled: busy,
                    onClick: () => {
                      setClosing(true);
                      clearNote();
                      void loadClosePreview();
                    }
                  }
                : null
            ].filter(Boolean);
        return (
          <StateView
            t={t}
            mode={closing && !closed ? "close" : "read"}
            lines={
              closed
                ? [closedLine(relation, context), progress, t("mentoring.relation.views.state.after_keeps")].filter(Boolean)
                : [progress, draftRelation ? t("mentoring.relation.draft_hint") : ""].filter(Boolean)
            }
            cards={cards}
            hint={!closed && relation.position === "mentee" ? t("mentoring.relation.change_mentor_hint") : ""}
            busy={busy}
            note={noteFor("state")}
            gate={{
              loading: previewState === "loading",
              failed: previewState === "failed",
              ready: previewState === "ready" && Boolean(closePreview),
              keeps: lists.keeps,
              purges: lists.purges,
              reasons: CLOSE_REASON_CHOICES.map((value) => ({ value, label: closeReasonText(value, t) })),
              reason: closeReason,
              onReason: setCloseReason,
              onRetry: () => void loadClosePreview()
            }}
            onLeaveGate={() => setClosing(false)}
            /* Teine vajutus on kinnitus, mida server lõpetamiseks nõuab. */
            onClose={async () => {
              const done = await run(
                "state",
                relationUrl,
                { action: "close", reasonKey: closeReason, confirmed: true },
                t("mentoring.relation.closed_feedback")
              );
              if (done) {
                setClosing(false);
                setClosePreview(null);
                setPreviewState("idle");
              }
            }}
          />
        );
      }
    }
  };

  return (
    <EntryShell {...shellProps}>
      <RelationHead t={t} who={head.who} chip={head.chip} reason={head.reason} backHref={backHref} />
      {orphanNote ? (
        <p className={entry.notice} role="alert">
          {orphanNote}
        </p>
      ) : null}
      <StepFlight
        /* Osade loend muutub, kui suhe lõpeb (eesmärkide osa kaob) või kui
           mentorile jõuab esimene ettevalmistus: siis ehitatakse lava uuesti. */
        key={parts.map((part) => part.key).join("|")}
        label={t("mentoring.relation.title")}
        steps={parts}
        parts
        /* Suhe avaneb ülevaates: kõik osad korraga, igaühel oma seis. */
        startWide={landIndex < 0}
        initialIndex={Math.max(0, landIndex)}
        texts={{
          all: t("mentoring.relation.all_parts"),
          position: (current, total, label) => t("mentoring.labels.part_position", { current, total, label })
        }}
        wideLead={
          <p className={entry.lead}>{closed ? closedLine(relation, context) : draftRelation ? t("mentoring.relation.draft_hint") : progress}</p>
        }
        /* Teade käib selle osa kohta, kus tegu tehti: teises osas see enam ei kehti. */
        onStepChange={() => setFeedback(null)}
      >
        {renderPart}
      </StepFlight>
    </EntryShell>
  );
}
