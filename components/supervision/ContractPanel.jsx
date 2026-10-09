"use client";

/**
 * Protsessi laua osa „Kontrakt" (Q2.6 vaade 3): olek ja päringud.
 *
 * Superviisor koostab ja aktiveerib versioone; osaleja, kellel kehtiva versiooni
 * kinnitus puudub, kinnitab selle. Iga muutev toiming kannab CAS-i
 * (`expectedVersion`): 409 ei ole viga, vaid „keegi muutis vahepeal" koos
 * värske seisu toomisega (seda ütleb leht lava kohal).
 *
 * KUJU (09.10). Paneel oli üks veerg: kehtiv tekst, versioonide kaardid, uue
 * versiooni vorm, osalejate kaardid ja kutse vorm üksteise all. Nüüd on siin
 * ainult kontrakt ja selle kolm seisu vahetavad üksteist samas kohas (kehtiv
 * tekst, versioonid, uus versioon); osalejad ja kutsed on omaette osa
 * (`./ParticipantsPanel.jsx`). Vaade on failis ./process/ProcessViews.jsx.
 *
 * AKTIVEERIMINE KÜSIB TEIST VAJUTUST. Senist versiooni ei saa tagasi tuua ja
 * iga liitunud osaleja peab uue versiooni kinnitama, enne kui ta saab jälle
 * teemasid jagada ja kokkuvõtteid kinnitada. Vanal lehel piisas ühest vajutusest.
 */

import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { ContractView } from "./process/ProcessViews";
import { contractView, versionRows } from "./process/processRows";
import usePartRequest from "./process/usePartRequest";

export default function ContractPanel({ process, onReload, onConflict, glow }) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState("read");
  const [versionBody, setVersionBody] = useState("");
  const { busy, message, setMessage, run } = usePartRequest({ t, onReload, onConflict });

  const base = `/api/supervision/processes/${encodeURIComponent(process.id)}`;

  const createVersion = useCallback(async () => {
    const body = versionBody.trim();
    if (!body) return;
    const ok = await run("create-version", `${base}/contract-versions`, { body: { body } });
    if (!ok) return;
    setVersionBody("");
    /* Salvestatud mustand on versioonide loendis: sealt saab selle aktiveerida. */
    setMode("versions");
  }, [base, run, versionBody]);

  const activateVersion = useCallback(
    async (versionId) => {
      const ok = await run(`activate:${versionId}`, `${base}/contract-versions/${encodeURIComponent(versionId)}/activate`, {
        body: { expectedVersion: process.version }
      });
      /* Aktiveeritud versioon on nüüd kehtiv tekst: näita seda. */
      if (ok) setMode("read");
    },
    [base, process.version, run]
  );

  const acceptActive = useCallback(
    () => run("accept-contract", `${base}/contract-acceptance`, { body: { contractVersionId: process.activeContract?.id || "" } }),
    [base, process.activeContract, run]
  );

  const view = useMemo(() => contractView(process, { t, locale }), [locale, process, t]);
  const versions = useMemo(() => versionRows(process, { t, locale }), [locale, process, t]);
  /* Versioonid ja uus versioon on ainult superviisori omad; kui õigus kaob
     (protsess suleti), jääb ette kehtiv tekst. */
  const shown = view.canManage && (mode === "new" || (mode === "versions" && versions.length)) ? mode : "read";

  return (
    <ContractView
      t={t}
      glow={glow}
      mode={shown}
      view={view}
      versions={versions}
      note={message}
      draft={versionBody}
      onDraft={setVersionBody}
      busy={Boolean(busy)}
      onMode={(next) => {
        setMessage("");
        setMode(next);
      }}
      onAccept={acceptActive}
      onActivate={activateVersion}
      onCreate={createVersion}
    />
  );
}
