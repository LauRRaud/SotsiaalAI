"use client";

/**
 * JTA-V1 (E4) — kohtumise märkme sektsioon juhtumi detailvaates.
 *
 * KAHEKSA KIHTI ON PINNAL KAHEKSA ERALDI VAADET, mitte üks loend siltidega.
 * See ei ole kujundusvalik: kui kliendi enda sõnad ja töötaja tõlgendus
 * seisavad ühes voos, loeb inimene neid ühe tekstina ka siis, kui igal real on
 * silt küljes. Eraldi vaade sunnib kirjutamise hetkel valima, KUHU rida käib —
 * ja just see valik ongi kihilise märkme mõte.
 *
 * PRIVAATNE REFLEKSIOON SEISAB LÕPUS ja kannab oma selgitust. Tema kirjeid ei
 * saa teise kihti tõsta (server annab 409) ja liides ei paku selleks nuppu —
 * lubadust ei tohi saada tühistada ümbernimetamisega.
 *
 * KUJU (09.10): VÄIKESED VAATED. Sektsioon on juhtumi lava üks osa
 * (`CaseWorkDetail.jsx`) ja oli seal 592 px kõrge juba enne, kui ükski märge
 * lahti oli: loomise vorm, helisalvesti, loend ja selle all avatud märge kaheksa
 * kihiplokiga. Nüüd on korraga ees üks asi: märkmete loend, uue märkme vorm või
 * avatud märge, mille kihid ja paranduste ajalugu vahetuvad sakkidest. Kihid on
 * sakid, mitte loend, sest kohtumise ajal kirjutatakse vaheldumisi mitmesse
 * kihti ja vahetus peab olema üks vajutus.
 *
 * KOHTUMISE HELI ON JUHTUMI LAVA OMA OSA (`MeetingAudioSection.jsx`), mitte
 * selle sektsiooni tükk: salvestis on dokument, mitte märkme rida, ja salvesti
 * peab töötama edasi ka siis, kui siin vahetub loend avatud märkme vastu.
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failides
 * ./sections/NoteViews.jsx ja ./sections/SectionBits.jsx, read ja reeglid
 * failis ./sections/sectionRows.js.
 */

import { useCallback, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import { caseWorkRequest, fromLocalInputValue } from "./caseWorkClient";
import { noteEntryView, noteHistoryView, noteLayerView } from "./sections/NoteViews";
import { ItemListView, MeetingCreateView, OpenView, rowAddView, useSwapFocus } from "./sections/SectionBits";
import {
  NOTE_TABS,
  PRIVATE_LAYER,
  canAddRow,
  entryRows,
  noteRows,
  noteTabs,
  noteTitle,
  provenanceOptions,
  revisionRows
} from "./sections/sectionRows";
import { notify, useCaseList, useRowOpening, useSectionRun } from "./sections/useSectionData";

const EMPTY_DRAFT = Object.freeze({ text: "", provenance: "" });
/* Sakid on viies veerus: kaheksa kihti ja ajalugu mahuvad kahte ritta. */
const NOTE_TAB_COLUMNS = 5;

/**
 * `locked`: juhtum ei ole aktiivne. `caseBusy`: juhtumi enda kirjutus käib.
 * `active`: see osa on laval ees (ainult siis joonistab põhinupp oma helgi).
 */
export default function MeetingNoteSection({ caseId, locked, caseBusy, active, onChanged, onListLoaded }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const root = `/cases/${encodeURIComponent(caseId)}/meeting-notes`;

  const { busy, errorKey, setErrorKey, run } = useSectionRun();
  /* PAGINEERIMINE ON KOHUSTUSLIK. Ilma cursor'ita jäid vanemad kui 25 märget
     liidesest KÄTTESAAMATUKS — teenuskiht toetab lehekülgi ja pind viskas selle
     võimaluse ära. Juhtumitöö on pikk: 25 kohtumist ei ole palju. Loend
     teatatakse üles pärast iga täislaadimist (juhtumi ülevaade näitab selle osa
     esimest rida). */
  const { items: notes, cursor: notesCursor, status, load: loadNotes, retry } = useCaseList({
    path: root,
    locale,
    onLoaded: onListLoaded,
    onError: setErrorKey
  });

  const [openNote, setOpenNote] = useState(null);
  /* Paranduste ja tühistuste ajalugu (SOL-CW-15). Ta EI OLE lisainfo: ilma
     temata ei erista pind puutumata märget sellest, mille kõik read on
     tühistatud — ja just see vahe on kogu leiu sisu. */
  const [revisions, setRevisions] = useState([]);
  /* Loend või uue märkme vorm: need vahetuvad kohapeal. */
  const [mode, setMode] = useState("list");
  const [meetingAt, setMeetingAt] = useState("");

  /* AVATUD MÄRKME ID SEISAB `ref`-is, mitte ainult olekus. Kaks `loadNote()`
     päringut võivad lõppeda VALES JÄRJEKORRAS ja aeglasem vastus kirjutaks
     värskema üle — töötaja vaataks siis märget A ja näeks märkme B sisu. Iga
     vastus kontrollib, kas tema päring on ikka veel see, mida oodatakse. */
  const requestedNoteId = useRef(null);

  const loadNote = useCallback(
    async (noteId) => {
      requestedNoteId.current = noteId;
      const base = `${root}/${encodeURIComponent(noteId)}`;
      try {
        /* Märge ja tema ajalugu tulevad KOOS. Eraldi laadimine tähendaks akent,
           kus read on juba tühistatud, aga ajalugu veel tühi — ja siis näeks
           töötaja täpselt seda tühja konteinerit, mille SOL-CW-15 maha võttis. */
        const [body, history] = await Promise.all([
          caseWorkRequest(base, { locale }),
          caseWorkRequest(`${base}/revisions`, { locale })
        ]);
        /* Vahepeal avati juba teine märge — see vastus on aegunud ja teda EI
           panda ekraanile. */
        if (requestedNoteId.current !== noteId) return;
        setOpenNote(body.note || null);
        setRevisions(history.items || []);
      } catch (error) {
        if (requestedNoteId.current !== noteId) return;
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [locale, root, setErrorKey]
  );

  const createNote = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        const created = await caseWorkRequest(root, {
          method: "POST",
          locale,
          body: { meetingAt: fromLocalInputValue(meetingAt) }
        });
        if (!created?.note?.id) return;
        setMeetingAt("");
        await loadNotes();
        await loadNote(created.note.id);
        /* Vorm annab koha tagasi alles siis, kui uus märge on ees (või selle
           avamine ebaõnnestus ja ees on loend koos teatega). */
        setMode("list");
        notify(onChanged);
      });
    },
    [loadNote, loadNotes, locale, meetingAt, onChanged, root, run]
  );

  const { openingId, open: openFromList } = useRowOpening(loadNote);

  const closeNote = useCallback(() => {
    requestedNoteId.current = null;
    setOpenNote(null);
    setRevisions([]);
  }, []);

  /**
   * Kirjutus avatud märkmesse: päring ja kohe selle järel värske seis koos
   * ajalooga. Mõlemad on ühe `run()` sees, et teine vajutus ei jõuaks nende
   * vahele.
   */
  const openNoteId = openNote?.id || null;
  const write = useCallback(
    (path, body) => {
      if (!openNoteId) return Promise.resolve(null);
      return run(async () => {
        const answer = await caseWorkRequest(`${root}/${encodeURIComponent(openNoteId)}${path}`, { method: "POST", locale, body });
        /* Kui märge suleti päringu ajal, ei ava vastus seda uuesti. */
        if (requestedNoteId.current === openNoteId) await loadNote(openNoteId);
        return answer;
      });
    },
    [loadNote, locale, openNoteId, root, run]
  );

  const actions = useMemo(
    () => ({
      addEntry: (layer, text, provenance) => write("/entries", { layer, text, provenance }),
      /**
       * TÜHISTUS, MITTE KUSTUTUS (SOL-CW-15).
       *
       * `POST .../retract` koos põhjusega. Vana rada oli `DELETE` ilma põhjuseta
       * ja ilma jäljeta: kõik read sai ükshaaval ära võtta ning alles jäi tühi
       * konteiner, mis näis endiselt kohtumise tõendina.
       */
      retractEntry: (entryId, reason) => write(`/entries/${encodeURIComponent(entryId)}/retract`, { reason })
    }),
    [write]
  );

  const swapRef = useSwapFocus(openNote ? `open:${openNote.id}` : mode);
  const blocked = locked || caseBusy || busy;
  const errorText = errorKey ? t(errorKey, "") : "";
  const rows = useMemo(
    () =>
      noteRows(notes, { t, locale }).map((row) => ({
        id: row.id,
        title: row.title,
        chips: row.linkedPrep ? [{ key: "prep", text: t("casework.note.linked_prep", "") }] : []
      })),
    [locale, notes, t]
  );

  if (openNote) {
    return (
      /* `key` ON SIIN GARANTII, MITTE OPTIMEERIMINE. Ilma temata jääks
         `NoteEditor` märkme vahetamisel SAMAKS komponendiks ja tema pooleli
         read elaksid üle: märkmes A pooleli jäänud rea saaks salvestada märkme
         B alla. Uus `key` sunnib React'i puu maha võtma. */
      <NoteEditor
        key={openNote.id}
        t={t}
        locale={locale}
        note={openNote}
        revisions={revisions}
        locked={locked}
        busy={caseBusy || busy}
        glow={active}
        errorText={errorText}
        actions={actions}
        onClose={closeNote}
      />
    );
  }

  if (mode === "create") {
    return (
      <MeetingCreateView
        t={t}
        title={t("casework.note.create_title", "")}
        lead={t("casework.note.create_hint", "")}
        swapRef={swapRef}
        formId={formId}
        label={t("casework.note.meeting_at", "")}
        value={meetingAt}
        onChange={setMeetingAt}
        submitLabel={t("casework.note.create", "")}
        glow={active}
        busy={blocked}
        errorText={errorText}
        onSubmit={createNote}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    /* Kustutamist loendis EI OLE ja see ei ole unustus — märge on kohtumise
       jälg. Marsruuti sinna ka ei ole. */
    <ItemListView
      t={t}
      title={t("casework.page.parts.notes.title", "")}
      lead={t("casework.note.section_hint", "")}
      swapRef={swapRef}
      errorText={errorText}
      status={status}
      rows={rows}
      emptyText={t("casework.note.empty", "")}
      openText={t("casework.note.open", "")}
      openingId={openingId}
      more={
        notesCursor
          ? { busy, label: t("casework.note.load_more", ""), onClick: () => run(() => loadNotes({ cursor: notesCursor, append: true })) }
          : null
      }
      onOpen={openFromList}
      onRetry={() => {
        setErrorKey(null);
        retry();
      }}
      actions={
        <Button type="button" size="sm" variant="primary" glow={active} disabled={blocked} onClick={() => setMode("create")}>
          {t("casework.note.create", "")}
        </Button>
      }
    />
  );
}

/**
 * Avatud märge: hoiab, milline kiht ja alamvaade on ees, ning pooleli ridu.
 * Joonistavad vaated failis ./sections/NoteViews.jsx.
 */
function NoteEditor({ t, locale, note, revisions, locked, busy, glow, errorText, actions, onClose }) {
  const formId = useId();
  const [tab, setTab] = useState(NOTE_TABS[0]);
  /* Alamvaade saki asemel: uus kirje (`add`) või avatud kirje (`entry`). */
  const [sub, setSub] = useState(null);
  /* IGA KIHI POOLELI RIDA ELAB SIIN, kihi kaupa. Vaade vahetub saki vahetusega,
     aga kliendi vaate alla pooleli jäänud lause ei tohi kaduda, kui töötaja
     vahepeal kokkuleppe kirja paneb.

     PÄRITOLUL EI OLE VAIKEVÄÄRTUST ja see on L4 otsene nõue. Eelvalitud
     `TOOTAJA_TAHELEPANEK` tähendas, et rea sai lisada päritolu TEADLIKULT
     valimata — ja märgis, mille inimene ei valinud, ei ole märgis. */
  const [drafts, setDrafts] = useState({});
  /* Tagasivõtmise põhjus kirje kaupa: teise kirje avamine ei kustuta pooleli
     põhjust ega kanna seda teise kirje alla. */
  const [reasons, setReasons] = useState({});

  const swapRef = useSwapFocus(sub ? `${sub.view}:${sub.id || ""}` : "tab", { onMount: true });
  const context = { t, locale };
  const isLayer = tab !== "history";
  const entries = isLayer ? entryRows(note, tab, context) : [];
  const openEntry = sub?.view === "entry" ? entries.find((row) => row.id === sub.id && !row.retracted) || null : null;
  const layerTitle = isLayer ? t(`casework.note.layer_${tab}`, "") : "";

  /* AVATUD MÄRKME IDENTITEET ON NÄHTAV igas vaates. Ilma selleta ei ütle ükski
     asi ekraanil, MILLISE kohtumise alla parasjagu kirjutatakse — ja märkmeid
     on juhtumil mitu. Tee tagasi loendisse on sakkidega vaadetes; alamvaatel
     on oma „Loobu" või „Tagasi" all servas. */
  const identity = { label: t("casework.note.open_note", ""), name: noteTitle(note, context) };
  const tabbed = {
    swapRef,
    head: { ...identity, back: { label: t("casework.note.back_to_list", ""), onClick: onClose } },
    errorText,
    tabs: {
      label: t("casework.note.tabs_label", ""),
      tabs: noteTabs(note, revisions, context),
      current: tab,
      columns: NOTE_TAB_COLUMNS,
      onSelect: setTab
    }
  };
  /* Alamvaates sakke ei ole: vorm ja avatud rida vajavad kogu ruumi. */
  const focused = { swapRef, head: identity, errorText, tabs: null };

  /* Milline vaade on ees: alamvaade, kui see on avatud, muidu sakk. Vaade on
     kirjeldus ja selle joonistab alati sama `OpenView` (vt selle selgitust). */
  const screen = () => {
    if (sub?.view === "add" && isLayer) {
      const draft = drafts[tab] || EMPTY_DRAFT;
      const change = (patch) => setDrafts((current) => ({ ...current, [tab]: { ...(current[tab] || EMPTY_DRAFT), ...patch } }));
      return {
        frame: focused,
        view: rowAddView({
          t,
          formId,
          /* Sildiks on kiht: vorm ütleb ise, KUHU rida läheb. */
          label: layerTitle,
          provenanceLabel: t("casework.note.provenance_required", ""),
          submitLabel: t("casework.note.add_entry", ""),
          text: draft.text,
          onText: (text) => change({ text }),
          provenance: { options: provenanceOptions(t), value: draft.provenance, onChange: (provenance) => change({ provenance }) },
          locked,
          busy,
          glow,
          canSubmit: canAddRow(draft),
          onSubmit: async (event) => {
            event.preventDefault();
            if (!canAddRow(draft)) return;
            const saved = await actions.addEntry(tab, draft.text, draft.provenance);
            /* VÄLI TÜHJENDATAKSE AINULT ÕNNESTUMISEL. Varem käis tühjendamine
               tingimusteta ja ebaõnnestunud salvestus KUSTUTAS kasutaja teksti —
               kõige halvem tulemus, mis vormil olla saab: töö kadus ja põhjust
               ei olnud näha. */
            if (!saved) return;
            change(EMPTY_DRAFT);
            setSub(null);
          },
          /* Loobumine jätab pooleli rea alles: vorm avaneb sellega uuesti. */
          onCancel: () => setSub(null)
        })
      };
    }

    if (openEntry) {
      const reason = reasons[openEntry.id] || "";
      return {
        frame: focused,
        view: noteEntryView({
          t,
          title: layerTitle,
          row: openEntry,
          reason: { value: reason, onChange: (value) => setReasons((current) => ({ ...current, [openEntry.id]: value })) },
          locked,
          retract: {
            disabled: locked || busy || !reason.trim(),
            onConfirm: async () => {
              const done = await actions.retractEntry(openEntry.id, reason.trim());
              /* Põhjus tühjendatakse AINULT õnnestumisel — sama reegel mis kirje
                 lisamisel. Tagasi võetud kirje järel on ees jälle kiht ja fookus
                 selle pealkirjal. */
              if (!done) return;
              setReasons((current) => ({ ...current, [openEntry.id]: "" }));
              setSub(null);
            }
          },
          onBack: () => setSub(null)
        })
      };
    }

    if (!isLayer) return { frame: tabbed, view: noteHistoryView({ t, rows: revisionRows(revisions, context) }) };

    return {
      frame: tabbed,
      view: noteLayerView({
        t,
        title: layerTitle,
        isPrivate: tab === PRIVATE_LAYER,
        rows: entries,
        add: { disabled: locked || busy, onClick: () => setSub({ view: "add" }) },
        glow,
        onOpen: (id) => setSub({ view: "entry", id })
      })
    };
  };

  return <OpenView {...screen()} />;
}
