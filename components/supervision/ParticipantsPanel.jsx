"use client";

/**
 * Protsessi laua osa „Osalejad" (Q2.6 vaade 3, kutsete pool): olek ja päringud.
 *
 * Vanal lehel seisid osalejad ja kutse vorm kontrakti paneeli lõpus. Nüüd on
 * need omaette osa: loend ja (superviisoril) kutsumise vorm vahetavad üksteist
 * samas kohas. Vaade on failis ./process/ProcessViews.jsx.
 *
 * KUTSE TAGASIVÕTMINE KÜSIB TEIST VAJUTUST. Server hoiab ühe inimese kohta
 * protsessis ühte osalust: tagasi võetud kutse järel ei saa sama inimest
 * sellesse protsessi uuesti kutsuda (lib/supervision/service.js,
 * `PARTICIPATION_EXISTS`). Vanal lehel piisas ühest vajutusest.
 */

import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { ParticipantsView } from "./process/ProcessViews";
import { participantRows, participantsLead } from "./process/processRows";
import usePartRequest from "./process/usePartRequest";

export default function ParticipantsPanel({ process, onReload, onConflict, glow }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("list");
  const [inviteUserId, setInviteUserId] = useState("");
  /* Kutse 409 ei tähenda, et keegi vahepeal midagi muutis: sellel inimesel on
     selles protsessis juba kutse või osalus (ka tagasi võetud või tagasi lükatud
     kutse loeb). See on lause vormi juures, mitte lehe konfliktiteade. Suletud
     protsessi 409 läheb endiselt lehele. */
  const [inviteTaken, setInviteTaken] = useState(false);
  const handleInviteConflict = useCallback(
    async (payload) => {
      if (payload?.messageKey === "supervision.errors.conflict") {
        setInviteTaken(true);
        return;
      }
      await onConflict?.(payload);
    },
    [onConflict]
  );
  const { busy, message, setMessage, run } = usePartRequest({ t, onReload, onConflict });
  const inviting = usePartRequest({ t, onReload, onConflict: handleInviteConflict });
  const runInvite = inviting.run;

  const canInvite = Boolean(process.capabilities?.canInvite);

  const invite = useCallback(async () => {
    const userId = inviteUserId.trim();
    if (!userId) return;
    setInviteTaken(false);
    const ok = await runInvite("invite", `/api/supervision/processes/${encodeURIComponent(process.id)}/invites`, { body: { userId } });
    if (!ok) return;
    setInviteUserId("");
    /* Kutse on saadetud: vorm annab koha loendile tagasi. Keeldumise korral
       jääb vorm ette ja sisestatud tunnus alles. */
    setMode("list");
  }, [inviteUserId, process.id, runInvite]);

  const withdrawInvite = useCallback(
    (participationId) => run(`withdraw:${participationId}`, `/api/supervision/participations/${encodeURIComponent(participationId)}/withdraw-invite`),
    [run]
  );

  const rows = useMemo(() => participantRows(process, { t }), [process, t]);

  return (
    <ParticipantsView
      t={t}
      glow={glow}
      mode={canInvite && mode === "invite" ? "invite" : "list"}
      rows={rows}
      canInvite={canInvite}
      lead={participantsLead(process, t)}
      note={inviteTaken ? t("supervision.process.participants.alreadyInvited") : inviting.message || message}
      userId={inviteUserId}
      onUserId={(value) => {
        setInviteTaken(false);
        setInviteUserId(value);
      }}
      busy={Boolean(busy || inviting.busy)}
      onMode={(next) => {
        setMessage("");
        inviting.setMessage("");
        setInviteTaken(false);
        setMode(next);
      }}
      onInvite={invite}
      onWithdraw={withdrawInvite}
    />
  );
}
