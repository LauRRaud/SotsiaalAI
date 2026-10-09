"use client";

/**
 * Protsessi laua osa „Kohtumised" (Q2.6 vaade 6): olek ja päringud.
 *
 * Kohtumine on faktikirje (võib toimuda ka platvormist väljas). Kirjutab ainult
 * superviisor, loevad liikmed. „Toimunud" on LÕPLIK (faktijälg): server keeldub
 * seda hiljem tagasi pööramast (409), seepärast küsib märkimine teist
 * vajutust. Vana paneel kasutas selleks brauseri küsimusakent.
 *
 * KUJU (09.10). Paneel oli kaardiloend, kus töömärkme vorm avanes kaardi sees
 * ja uue kohtumise vorm seisis lõpus (selle nupp lõi kohtumise ka tühja ajaga).
 * Nüüd on osas üks asi korraga: loend, avatud kohtumine, töömärge või uue
 * kohtumise aeg. Vaade on failis ./process/WorkViews.jsx.
 *
 * AEG JA TÜHISTAMINE. Esimeses versioonis ei saanud plaanitud kohtumise aega
 * muuta ega kohtumist tühistada, kuigi server lubab mõlemat (PATCH `plannedAt`,
 * `status: CANCELLED`): ekslikult plaanitud kohtumine jäi loendisse ja
 * sulgemise faktidesse. Nüüd on avatud kohtumisel vaade „Muuda või tühista".
 */

import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { MeetingsView } from "./process/WorkViews";
import { acceptedCount, meetingRows, meetingsMode, plannedAtValue } from "./process/processRows";
import usePartRequest from "./process/usePartRequest";

export default function MeetingsPanel({ process, onReload, onConflict, glow }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState("list");
  const [openId, setOpenId] = useState("");
  const [plannedAt, setPlannedAt] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const { busy, message, setMessage, run } = usePartRequest({ t, onReload, onConflict });

  const canPlan = Boolean(process.capabilities?.canPlanMeeting);
  const rows = useMemo(() => meetingRows(process, { t, locale }), [locale, process, t]);
  const opened = rows.find((row) => row.id === openId) || null;

  const plan = useCallback(async () => {
    const time = plannedAtValue(plannedAt);
    if (!time.ok) {
      setMessage(t("supervision.process.meetings.timeInvalid"));
      return;
    }
    const ok = await run("plan", `/api/supervision/processes/${encodeURIComponent(process.id)}/meetings`, { body: { plannedAt: time.value } });
    if (!ok) return;
    setPlannedAt("");
    setMode("list");
  }, [plannedAt, process.id, run, setMessage, t]);

  const markHeld = useCallback(
    (meetingId) => {
      const meeting = rows.find((row) => row.id === meetingId);
      if (!meeting) return undefined;
      return run(`held:${meetingId}`, `/api/supervision/meetings/${encodeURIComponent(meetingId)}`, {
        method: "PATCH",
        body: { status: "HELD", expectedVersion: meeting.version }
      });
    },
    [rows, run]
  );

  const saveNote = useCallback(async () => {
    if (!opened) return;
    const ok = await run(`note:${opened.id}`, `/api/supervision/meetings/${encodeURIComponent(opened.id)}`, {
      method: "PATCH",
      body: { note: noteDraft.trim() || null, expectedVersion: opened.version }
    });
    /* Märge on salvestatud: vorm annab koha kohtumisele tagasi. */
    if (ok) setMode("meeting");
  }, [noteDraft, opened, run]);

  const saveTime = useCallback(async () => {
    if (!opened) return;
    const time = plannedAtValue(timeDraft);
    if (!time.ok) {
      setMessage(t("supervision.process.meetings.timeInvalid"));
      return;
    }
    const ok = await run(`time:${opened.id}`, `/api/supervision/meetings/${encodeURIComponent(opened.id)}`, {
      method: "PATCH",
      body: { plannedAt: time.value, expectedVersion: opened.version }
    });
    if (ok) setMode("meeting");
  }, [opened, run, setMessage, t, timeDraft]);

  /* Tühistatud kohtumine jääb loendisse oma märkega; siia jõuab alles teine vajutus. */
  const cancelMeeting = useCallback(async () => {
    if (!opened) return;
    const ok = await run(`cancel:${opened.id}`, `/api/supervision/meetings/${encodeURIComponent(opened.id)}`, {
      method: "PATCH",
      body: { status: "CANCELLED", expectedVersion: opened.version }
    });
    if (ok) setMode("meeting");
  }, [opened, run]);

  const count = Number(process.plannedMeetingCount);

  return (
    <MeetingsView
      t={t}
      glow={glow}
      mode={meetingsMode({ mode, canPlan, hasMeeting: Boolean(opened), canChange: Boolean(opened?.canChange) })}
      rows={rows}
      meeting={opened}
      canPlan={canPlan}
      lead={Number.isInteger(count) && count > 0 ? t("supervision.process.meetings.plannedCount", { count }) : undefined}
      note={message}
      privacyCount={acceptedCount(process)}
      plannedAt={plannedAt}
      onPlannedAt={setPlannedAt}
      noteDraft={noteDraft}
      onNoteDraft={setNoteDraft}
      busy={Boolean(busy)}
      onMode={(next) => {
        setMessage("");
        /* Töömärkme vorm algab alati salvestatud märkmest, mitte eelmise korra pooleli tekstist. */
        if (next === "note" && opened) setNoteDraft(opened.note);
        if (next === "time" && opened) setTimeDraft(opened.plannedAtInput);
        setMode(next);
      }}
      onOpen={(meetingId) => {
        setMessage("");
        setOpenId(meetingId);
        setMode("meeting");
      }}
      onPlan={plan}
      timeDraft={timeDraft}
      onTimeDraft={setTimeDraft}
      onSaveTime={saveTime}
      onCancelMeeting={cancelMeeting}
      onSaveNote={saveNote}
      onMarkHeld={markHeld}
    />
  );
}
