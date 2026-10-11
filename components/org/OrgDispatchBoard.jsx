"use client";

/**
 * TEENUSPÄEVIK E10 — juhi staatustahvel.
 *
 * MIDA SIIN EI OLE JA MIKS. Kaarti ei ole. Koordinaate ei ole. Märkuste sisu
 * ei ole. Leping: „Juhi staatustahvel näitab olekut ja hilinemist, mitte elavat
 * GPS-jada." See ei ole tehniline piirang, vaid kogu meie eristus — kui siia
 * tekib kaardil liikuv punkt, oleme lihtsalt üks logistikarakendus juurde.
 *
 * JÄRJESTUS ON TÄHENDUSEGA: kes vajab tähelepanu, on ees. Juht avab tahvli
 * hommikul ja tema esimene küsimus ei ole „kes on tubli", vaid „kus on
 * probleem".
 *
 * KUJU (11.10). Üks kast kuupäeva, määramise vormi ja kõigi töötajate kõigi
 * külastustega on nüüd neli vaadet (`./dispatch/DispatchViews.jsx`): päev, üks
 * töötaja, töö määramine ja töö teisele andmine. Teisele andmine küsis nime ja
 * põhjust kahe brauseri hüpikaknaga; nüüd on see vaade, kus nimi valitakse
 * lahtritest. Read ja puuduvad väljad otsustab `./dispatch/dispatchRules.js`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import OrgPart from "./OrgPart";
import { AssignForm, BoardView, NoAccessView, ReassignForm, WorkerView } from "./dispatch/DispatchViews";
import {
  EMPTY_ASSIGN,
  assignPayload,
  assignProblemKey,
  dayLine,
  reassignProblemKey,
  totalsLine,
  visitRows,
  workerOptions,
  workerRow,
  workerWarnings
} from "./dispatch/dispatchRules";

export default function OrgDispatchBoard({ context, organizationId, initialBoard, initialWorkers = [] }) {
  const { t, locale } = useI18n();
  /* KIIRMENÜÜ INFO IGAL LEHEL (omaniku reegel): lehe nimi ja sektsioonid on
     kirjas `lib/dashboardInfoContent.js`-is, mitte laiali komponentides. */
  usePanelInfoSlot({ infoId: "org_dispatch" });
  const [board, setBoard] = useState(initialBoard || null);
  const [workers, setWorkers] = useState(initialWorkers);
  const [date, setDate] = useState(initialBoard?.date || "");
  const [form, setForm] = useState(EMPTY_ASSIGN);
  /* Vaate teade all servas: { tone: "risk" | "", text } või null. */
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  /* Mis on ees: "board" | "worker" | "assign" | "reassign". */
  const [view, setView] = useState("board");
  const [openId, setOpenId] = useState("");
  /* Külastus, mida teisele antakse: { id, title } või null. */
  const [moving, setMoving] = useState(null);
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState("");
  const sending = useRef(false);
  const rootRef = useRef(null);

  const load = useCallback(
    async (nextDate) => {
      try {
        const params = new URLSearchParams();
        if (nextDate) params.set("date", nextDate);
        const response = await fetch(`/api/org/${organizationId}/graafik?${params}`, {
          headers: { "x-ui-locale": locale || "et" }
        });
        if (!response.ok) return;
        const body = await response.json();
        setBoard(body.board || null);
        if (Array.isArray(body.workers)) setWorkers(body.workers);
      } catch {
        /* Vaikne: tahvel on ülevaade, mitte toiming. Tema laadimise tõrge ei
           tohi juhti takistada mujal tööd tegemast. */
      }
    },
    [locale, organizationId]
  );

  useEffect(() => {
    if (date && date !== board?.date) load(date);
  }, [board?.date, date, load]);

  const post = useCallback(
    async (payload) => {
      /* Üks päring korraga: topeltvajutus ei määra sama tööd kaks korda. */
      if (sending.current) return false;
      sending.current = true;
      setBusy(true);
      setNotice(null);
      try {
        const response = await fetch(`/api/org/${organizationId}/graafik`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ui-locale": locale || "et" },
          body: JSON.stringify(payload)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          /* TÕRGE EI TOHI OLLA VAIKNE: „vajutasin määra, ei juhtunud midagi"
             tähendab juhi jaoks, et töötaja EI TEA tööst — ja ta ei saa seda
             kuidagi teada. Server saadab lause VÕTME: see tõlgitakse siin (enne
             jõudis võti toorelt ekraanile). */
          setNotice({ tone: "risk", text: resolveApiMessage({ payload: body, t, fallbackKey: "org.board.assign_failed" }) });
          return false;
        }
        setNotice({ tone: "", text: t("org.board.assigned") });
        await load(date);
        return true;
      } catch {
        setNotice({ tone: "risk", text: t("org.board.assign_failed") });
        return false;
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [date, load, locale, organizationId, t]
  );

  const assign = useCallback(async () => {
    const problem = assignProblemKey(form);
    if (problem) {
      setNotice({ tone: "risk", text: t(problem) });
      return;
    }
    const ok = await post(assignPayload(form));
    if (ok) {
      /* Töötaja jääb valituks (järgmine töö läheb sageli samale inimesele). */
      setForm((current) => ({ ...EMPTY_ASSIGN, assignTo: current.assignTo }));
      setView("board");
    }
  }, [form, post, t]);

  /* ASENDUS. Nimi valitakse loendist, mitte vabalt: vale nimi tähendaks, et
     töö läheb inimesele, kes sellest ei tea. */
  const reassign = useCallback(async () => {
    if (!moving) return;
    const problem = reassignProblemKey({ workerUserId: moveTo, reason });
    if (problem) {
      setNotice({ tone: "risk", text: t(problem) });
      return;
    }
    const ok = await post({ action: "reassign", visitId: moving.id, workerUserId: moveTo, reason });
    if (ok) {
      setMoving(null);
      setMoveTo("");
      setReason("");
      setView("worker");
    }
  }, [moveTo, moving, post, reason, t]);

  const allowed = Boolean(board?.allowed);
  const boardWorkers = useMemo(() => (allowed && Array.isArray(board.workers) ? board.workers : []), [allowed, board]);
  const rows = useMemo(() => boardWorkers.map((worker) => workerRow(worker, { t, locale })), [boardWorkers, t, locale]);
  const options = useMemo(() => workerOptions(workers, { t }), [workers, t]);
  const opened = boardWorkers.find((worker) => worker.membershipId === openId) || null;
  /* Töötaja, keda uue kuupäeva tahvlil ei ole, ei jää lahti: ees on päev. */
  const shownView = (view === "worker" && !opened) || (view === "reassign" && !moving) || (view === "assign" && !options.length) ? "board" : view;

  /* Vaate vahetusel kaob vajutatud rida või nupp: fookus läheb vaate pealkirjale.
     Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(null);
  useEffect(() => {
    const first = shown.current === null;
    const moved = shown.current !== shownView;
    shown.current = shownView;
    if (first || !moved) return;
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [shownView]);

  const go = (next) => {
    if (busy) return;
    setNotice(null);
    setView(next);
  };

  let content;
  if (!allowed) {
    content = <NoAccessView t={t} />;
  } else if (shownView === "assign") {
    content = (
      <AssignForm
        t={t}
        form={form}
        onField={(name, value) => {
          setNotice(null);
          setForm((current) => ({ ...current, [name]: value }));
        }}
        workers={options}
        notice={notice}
        decline={{ onPress: () => go("board") }}
        save={{ busy, onSave: () => void assign() }}
      />
    );
  } else if (shownView === "reassign") {
    content = (
      <ReassignForm
        t={t}
        visitTitle={moving.title}
        workers={workerOptions(workers, { t, exceptMembershipId: openId })}
        workerUserId={moveTo}
        onWorker={(value) => {
          setNotice(null);
          setMoveTo(value);
        }}
        reason={reason}
        onReason={(value) => {
          setNotice(null);
          setReason(value);
        }}
        notice={notice}
        decline={{ onPress: () => go("worker") }}
        save={{ busy, onSave: () => void reassign() }}
      />
    );
  } else if (shownView === "worker") {
    content = (
      <WorkerView
        t={t}
        title={workerRow(opened, { t, locale }).title}
        line={dayLine(opened, { t, locale })}
        warnings={workerWarnings(opened, { t })}
        visits={visitRows(opened, { t, locale, workerCount: workerOptions(workers, { t, exceptMembershipId: opened.membershipId }).length })}
        onReassign={(visit) => {
          setMoving({ id: visit.id, title: visit.title });
          /* Kui on ainult üks inimene, kellele anda, on ta juba valitud. */
          const others = workerOptions(workers, { t, exceptMembershipId: opened.membershipId });
          setMoveTo(others.length === 1 ? others[0].value : "");
          setReason("");
          go("reassign");
        }}
        notice={notice}
        onBack={() => go("board")}
      />
    );
  } else {
    content = (
      <BoardView
        t={t}
        date={date}
        onDate={(value) => {
          setNotice(null);
          setDate(value);
        }}
        totals={totalsLine(board, { t })}
        rows={rows}
        onOpen={(id) => {
          setOpenId(id);
          go("worker");
        }}
        assign={options.length ? { onAssign: () => go("assign") } : null}
        notice={notice}
      />
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="dispatch">
        {content}
      </OrgPart>
    </div>
  );
}
