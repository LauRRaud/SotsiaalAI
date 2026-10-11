"use client";

/**
 * Protsessi laua osa „Jagatud teemad" (M7): olek ja päring.
 *
 * MIKS SEE OSA TEKKIS. Vana leht jagatud teemasid ei näidanud. Inimene jagas
 * eeskambrist teema, aga ei tema ega superviisor näinud seda pärast kusagil,
 * ja jagamise eelvaate lubadus „seda saab tagasi võtta" oli ilma nuputa. Server
 * annab jagatud teemad protsessi vastusega kaasa juba vaataja järgi sõelutult
 * (kõigile jagatud teemad liikmetele; ainult superviisorile jagatud teemad
 * autorile ja superviisorile) ja tagasivõtmise tee on olemas
 * (`/api/supervision/topics/[id]/withdraw`). Siin on need nähtavaks tehtud;
 * nähtavuse reeglid on endiselt serveris.
 *
 * TAGASIVÕTMINE KÜSIB TEIST VAJUTUST: teema kaob kõigi vaatest ja sama
 * eeskambri kirjet ei saa uuesti jagada. Tagasi võtta saab ainult autor.
 *
 * Vaade on failis ./process/WorkViews.jsx, read teeb ./process/processRows.js.
 */

import { useCallback, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { TopicsView } from "./process/WorkViews";
import { topicRows } from "./process/processRows";
import usePartRequest from "./process/usePartRequest";

export default function TopicsPanel({ process, onReload, onConflict, onAntechamber }) {
  const { t, locale } = useI18n();
  const [openId, setOpenId] = useState("");
  const { busy, message, setMessage, run } = usePartRequest({ t, onReload, onConflict });

  const rows = useMemo(() => topicRows(process, { t, locale }), [locale, process, t]);
  /* Teema, mida enam ei ole (võeti tagasi), ei jää tühja vaatena ette. */
  const opened = rows.find((row) => row.id === openId) || null;

  const withdraw = useCallback(
    async (topicId) => {
      const topic = rows.find((row) => row.id === topicId);
      if (!topic) return;
      const ok = await run(`withdraw:${topicId}`, `/api/supervision/topics/${encodeURIComponent(topicId)}/withdraw`, {
        body: { expectedVersion: topic.version }
      });
      if (ok) setOpenId("");
    },
    [rows, run]
  );

  return (
    <TopicsView
      t={t}
      rows={rows}
      topic={opened}
      canShare={Boolean(process.capabilities?.canShareTopic)}
      note={message}
      busy={Boolean(busy)}
      onOpen={(topicId) => {
        setMessage("");
        setOpenId(topicId);
      }}
      onBack={() => {
        setMessage("");
        setOpenId("");
      }}
      onWithdraw={withdraw}
      onAntechamber={onAntechamber}
    />
  );
}
