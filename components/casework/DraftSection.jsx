"use client";

/**
 * JTA-V1 (E5) — STAR2 mustandi ahela sektsioon juhtumi detailvaates.
 *
 * OLEKUTEE ON NÄHTAV, MITTE PEIDETUD. Iga element kannab oma seisu ja liigub
 * ühes suunas; liides pakub AINULT neid siirdeid, mida olekumasin lubab
 * (`ALLOWED_TRANSITIONS` failis ./sections/sectionRows.js). Vaba valik koos
 * serveri veateatega õpetaks kasutajat arvama, et viga on tema tehtud.
 *
 * `ULE_KANTUD` EI OLE SIIN VALIK ja see ei ole väljajätt (L19): sinna viib
 * ainult E6 „Märgi üle kantuks", mis loob samas tehingus auditirea. Seisu vaade
 * ütleb selle välja, et puuduv valik ei näeks välja nagu puudujääk.
 *
 * TERMINAALSE ELEMENDI SISU EI MUUDETA. `ULE_KANTUD` ja `EI_KANTA` on ptk 2.2
 * lõpp-punktid — väljade vormi ei ole ja lause ütleb, miks.
 *
 * KUJU (09.10): VÄIKESED VAATED. Sektsioon on juhtumi lava üks osa
 * (`CaseWorkDetail.jsx`) ja oli seal üks pikk veerg: tüübi rippvalik, loend ja
 * selle all avatud element väljade, siirde vormi ja ülekandepaneeliga. Nüüd on
 * korraga ees üks asi: elementide loend, uue elemendi valik või avatud element,
 * mille kolm vaadet (väljad, seis, STAR2-sse viimine) vahetuvad sakkidest.
 * Element ei saa olla juhtumi lava osa: neid on juhtumil mitu ja need avanevad
 * loendist. Ülekandeajalugu on juhtumi lava OMA osa: siit teatatakse ainult,
 * et ülekandetegu toimus (`onTransferRecorded`).
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failides
 * ./sections/DraftViews.jsx ja ./sections/SectionBits.jsx, read ja reeglid
 * failis ./sections/sectionRows.js, ülekandeteod failis ./TransferPanel.jsx.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import { Chip } from "./cases/CaseListViews";
import { caseWorkRequest } from "./caseWorkClient";
import {
  DraftCreateView,
  draftFieldAddView,
  draftFieldView,
  draftFieldsView,
  draftStateView,
  draftTransferView
} from "./sections/DraftViews";
import { ItemListView, OpenView, useSwapFocus } from "./sections/SectionBits";
import {
  DRAFT_TABS,
  asksReviewKind,
  canAddDraftField,
  draftFieldRows,
  draftHead,
  draftRows,
  draftStateModel,
  draftTabs,
  draftTypeOptions,
  draftUnsaved,
  provenanceOptions,
  reviewKindOptions,
  transitionNeedsConfirm
} from "./sections/sectionRows";
import { notify, useCaseList, useRowOpening, useSectionRun } from "./sections/useSectionData";
import { useTransferActions } from "./TransferPanel";

const EMPTY_FIELD = Object.freeze({ fieldKey: "", text: "", provenance: "" });

/**
 * `locked`: juhtum ei ole aktiivne. `caseBusy`: juhtumi enda kirjutus käib.
 * `active`: see osa on laval ees (ainult siis joonistab põhinupp oma helgi).
 */
export default function DraftSection({ caseId, locked, caseBusy, active, onChanged, onListLoaded, onTransferRecorded, onUnsaved, leaveGate }) {
  const { t, locale } = useI18n();
  const root = `/cases/${encodeURIComponent(caseId)}/drafts`;

  const { busy, errorKey, setErrorKey, run } = useSectionRun();
  /* Pagineerimine on kohustuslik: vanemad elemendid ei tohi kaduda. Loend
     teatatakse üles pärast iga täislaadimist (juhtumi ülevaade näitab selle osa
     esimest rida). */
  const { items: drafts, cursor: draftsCursor, status, load: loadDrafts, retry } = useCaseList({
    path: root,
    locale,
    onLoaded: onListLoaded,
    onError: setErrorKey
  });

  const [openDraft, setOpenDraft] = useState(null);
  /* Loend või uue elemendi valik: need vahetuvad kohapeal. */
  const [mode, setMode] = useState("list");
  const [draftType, setDraftType] = useState("");
  /* Kopeerimiste salvestamata jäljed elemendi kaupa (SOL-CW-05, L22). Need
     elavad SIIN, mitte avatud elemendi juures: elemendi sulgemine ei tohi
     kirjutamata tõendit ega selle hoiatust ära visata. */
  const [pendingAudits, setPendingAudits] = useState({});

  const requestedDraftId = useRef(null);

  const loadDraft = useCallback(
    async (draftId) => {
      requestedDraftId.current = draftId;
      try {
        const body = await caseWorkRequest(`${root}/${encodeURIComponent(draftId)}`, { locale });
        /* Aegunud vastus ei kirjuta värskemat üle — vt sama valvurit märkme ja
           ettevalmistuse sektsioonis. */
        if (requestedDraftId.current !== draftId) return;
        setOpenDraft(body.draft || null);
      } catch (error) {
        if (requestedDraftId.current !== draftId) return;
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [locale, root, setErrorKey]
  );

  const createDraft = useCallback(
    () =>
      run(async () => {
        const created = await caseWorkRequest(root, { method: "POST", locale, body: { draftType } });
        if (!created?.draft?.id) return;
        setDraftType("");
        await loadDrafts();
        await loadDraft(created.draft.id);
        /* Valik annab koha tagasi alles siis, kui uus element on ees (või selle
           avamine ebaõnnestus ja ees on loend koos teatega). */
        setMode("list");
        notify(onChanged);
      }),
    [draftType, loadDraft, loadDrafts, locale, onChanged, root, run]
  );

  const { openingId, open: openFromList } = useRowOpening(loadDraft);

  const closeDraft = useCallback(() => {
    requestedDraftId.current = null;
    setOpenDraft(null);
  }, []);

  const openDraftId = openDraft?.id || null;

  /**
   * Kirjutus avatud elementi: päring ja kohe selle järel värske seis. Mõlemad
   * on ühe `run()` sees, et teine vajutus ei jõuaks nende vahele. `list`: seis
   * muutus, seega laaditakse uuesti ka loend ja teatatakse juhtumile.
   */
  const write = useCallback(
    (path, options, { list = false } = {}) => {
      if (!openDraftId) return Promise.resolve(null);
      return run(async () => {
        const body = await caseWorkRequest(`${root}/${encodeURIComponent(openDraftId)}${path}`, { locale, ...options });
        /* Kui element suleti päringu ajal, ei ava vastus seda uuesti. */
        await Promise.all([requestedDraftId.current === openDraftId ? loadDraft(openDraftId) : null, list ? loadDrafts() : null]);
        if (list) notify(onChanged);
        return body;
      });
    },
    [loadDraft, loadDrafts, locale, onChanged, openDraftId, root, run]
  );

  const actions = useMemo(
    () => ({
      saveField: (fieldKey, text, provenance) => write("/fields", { method: "PUT", body: { fieldKey, text, provenance } }),
      removeField: (fieldKey) => write(`/fields?${new URLSearchParams({ fieldKey }).toString()}`, { method: "DELETE" }),
      transition: (expectedFrom, to, reviewKind) =>
        write(
          "/transition",
          {
            method: "POST",
            /* `expectedFrom` tuleb AVATUD ELEMENDI seisust, mitte vormist: nii
               kannab ta seda, mida kasutaja ekraanil nägi, ja vahepealne muutus
               annab ausa 409. */
            body: { expectedFrom, to, reviewKind: reviewKind || undefined }
          },
          { list: true }
        )
    }),
    [write]
  );

  /**
   * Ülekandetegu muutis midagi: mustandi seis, ajalugu ja laud käivad kõik
   * kaasa. Ajalugu värskendatakse ka siis, kui seis EI MUUTUNUD (kopeerimine ei
   * liiguta olekumasinat, L9) — just seepärast on tal oma märk.
   */
  const onTransferChanged = useCallback(async () => {
    /* Ülekandeajalugu laetakse uuesti iga teo järel — ta on TÕEND ja vananenud
       ajalugu ütleks, et jälge ei tekkinud. Ajalugu ise on juhtumi lava oma
       osa, seega märk läheb üles juhtumile. */
    onTransferRecorded?.();
    if (openDraftId) {
      await Promise.all([requestedDraftId.current === openDraftId ? loadDraft(openDraftId) : null, loadDrafts()]);
    }
    notify(onChanged);
  }, [loadDraft, loadDrafts, onChanged, onTransferRecorded, openDraftId]);

  /** Avatud elemendi ootel jälgede järjekord: lisamine ja asendamine käivad funktsiooniga. */
  const setOpenPending = useCallback(
    (update) => {
      if (!openDraftId) return;
      setPendingAudits((current) => ({ ...current, [openDraftId]: update(current[openDraftId] || []) }));
    },
    [openDraftId]
  );

  const swapRef = useSwapFocus(openDraft ? `open:${openDraft.id}` : mode);
  const blocked = locked || caseBusy || busy;
  const errorText = errorKey ? t(errorKey, "") : "";
  const rows = useMemo(
    () =>
      draftRows(drafts, { t, pendingAudits }).map((row) => ({
        id: row.id,
        title: row.title,
        chips: [
          { key: "state", text: row.state, tone: row.tone },
          ...(row.review ? [{ key: "review", text: row.review }] : []),
          ...(row.pending ? [{ key: "pending", text: t("casework.transfer.audit_pending_chip", ""), tone: "wait" }] : [])
        ]
      })),
    [drafts, pendingAudits, t]
  );

  if (openDraft) {
    return (
      <DraftEditor
        key={openDraft.id}
        t={t}
        locale={locale}
        caseId={caseId}
        draft={openDraft}
        locked={locked}
        busy={caseBusy || busy}
        glow={active}
        errorText={errorText}
        actions={actions}
        pendingAudits={pendingAudits[openDraft.id] || null}
        setPendingAudits={setOpenPending}
        onTransferChanged={onTransferChanged}
        onClose={closeDraft}
        onUnsaved={onUnsaved}
        leaveGate={leaveGate}
      />
    );
  }

  if (mode === "create") {
    return (
      <DraftCreateView
        t={t}
        swapRef={swapRef}
        options={draftTypeOptions(t)}
        value={draftType}
        onChange={setDraftType}
        busy={blocked}
        glow={active}
        errorText={errorText}
        onSubmit={createDraft}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    /* Kustutamist loendis EI OLE: mustand on ahela lüli ja tema jälg on tõend.
       Lõpetamise tee on „Ei kanta" — teadlik lõpp. */
    <ItemListView
      t={t}
      title={t("casework.page.parts.drafts.title", "")}
      lead={t("casework.draft.section_hint", "")}
      swapRef={swapRef}
      errorText={errorText}
      status={status}
      rows={rows}
      emptyText={t("casework.draft.empty", "")}
      openText={t("casework.draft.open", "")}
      openingId={openingId}
      more={
        draftsCursor
          ? { busy, label: t("casework.draft.load_more", ""), onClick: () => run(() => loadDrafts({ cursor: draftsCursor, append: true })) }
          : null
      }
      onOpen={openFromList}
      onRetry={() => {
        setErrorKey(null);
        retry();
      }}
      actions={
        <Button type="button" size="sm" variant="primary" glow={active} disabled={blocked} onClick={() => setMode("create")}>
          {t("casework.draft.create", "")}
        </Button>
      }
    />
  );
}

/**
 * Avatud element: hoiab, milline sakk ja alamvaade on ees, pooleli välju ja
 * valitud siiret. Joonistavad vaated failis ./sections/DraftViews.jsx.
 */
function DraftEditor({
  t,
  locale,
  caseId,
  draft,
  locked,
  busy,
  glow,
  errorText,
  actions,
  pendingAudits,
  setPendingAudits,
  onTransferChanged,
  onClose,
  onUnsaved,
  leaveGate
}) {
  const formId = useId();
  const [tab, setTab] = useState(DRAFT_TABS[0]);
  /* Alamvaade saki asemel: uus väli (`add`) või avatud väli (`field`). */
  const [sub, setSub] = useState(null);
  const [newField, setNewField] = useState(EMPTY_FIELD);
  /* Avatud välja pooleli parandus võtme kaupa. */
  const [edits, setEdits] = useState({});
  const [to, setTo] = useState("");
  const [reviewKind, setReviewKind] = useState("");

  /* Kopeerimine on lubatud KA terminaalses seisus: `ULE_KANTUD` mustandi sisu
     võib olla vaja teist korda STAR-i viia ja kopeerimine ei muuda midagi (L9).
     Ülekantuks märkimise nupu näitab vaade ainult sealt, kust olekumasin edasi
     lubab. */
  const transfer = useTransferActions({
    caseId,
    draft,
    locale,
    disabled: locked || busy,
    pendingAudits,
    setPendingAudits,
    onChanged: onTransferChanged,
    t
  });

  /* Seisu muutus (siire, ülekantuks märkimine) võtab vajutatud nupu ära: fookus
     läheb siis vaate pealkirjale, mitte ei jää õhku. */
  const swapRef = useSwapFocus(`${sub ? `${sub.view}:${sub.key || ""}` : "tab"}:${draft.transferState}`, { onMount: true });
  const context = { t, locale };
  const view = draftStateModel(draft, context);
  const fields = draftFieldRows(draft, context);
  const openField = sub?.view === "field" ? fields.find((row) => row.key === sub.key) || null : null;
  /* Valitud siht kehtib ainult seni, kuni olekumasin seda SELLEST seisust
     lubab: kui element liikus vahepeal edasi (teine aken, 409), ei tohi vana
     valik jääda nupu taha ootama. */
  const chosen = view.targets.some((option) => option.value === to) ? to : "";
  const headModel = draftHead(draft, context);

  /* Pooleli uus väli või parandus teatatakse juhtumi vaatele (lahkumise värav)
     ja avatud mustandi sulgemine küsib enne üle. */
  const dirty = !(locked || view.terminal) && draftUnsaved(draft, newField, edits);
  useEffect(() => {
    onUnsaved?.(dirty);
  }, [dirty, onUnsaved]);
  useEffect(() => () => onUnsaved?.(false), [onUnsaved]);
  const close = () => {
    if (dirty && leaveGate && !leaveGate("close")) return;
    onClose();
  };

  /* Avatud elemendi identiteet on nähtav igas vaates; seis ja tee tagasi
     loendisse on sakkidega vaadetes. Alamvaatel on oma „Loobu" või „Tagasi" all
     servas. */
  const identity = { label: t("casework.draft.open_draft", ""), name: headModel.title };
  const tabbed = {
    swapRef,
    head: {
      ...identity,
      chips: (
        <>
          <Chip tone={headModel.tone}>{headModel.state}</Chip>
          {headModel.review ? <Chip>{headModel.review}</Chip> : null}
          {/* Salvestamata jälg on näha elemendi igal sakil, mitte ainult
              seal, kus kopeeriti (L8: tõendi vaikne kadu on halvem kui nähtav). */}
          {transfer.pendingCount ? <Chip tone="wait">{t("casework.transfer.audit_pending_chip", "")}</Chip> : null}
          {/* Kustutatud sisu on näha elemendi igal sakil: väljade sakk näeks
              muidu välja nagu tühi mustand, kuhu saab välju lisada. */}
          {draft.contentPurgedAt ? <Chip tone="wait">{t("casework.prep.purged_chip", "")}</Chip> : null}
        </>
      ),
      back: { label: t("casework.draft.back_to_list", ""), onClick: close }
    },
    errorText,
    tabs: {
      label: t("casework.draft.tabs_label", ""),
      tabs: draftTabs(draft, { t, pendingAudits: transfer.pendingCount }),
      current: tab,
      columns: DRAFT_TABS.length,
      pendingText: t("casework.transfer.audit_pending_chip", ""),
      onSelect: setTab
    }
  };
  /* Alamvaates sakke ei ole: vorm ja avatud väli vajavad kogu ruumi. */
  const focused = { swapRef, head: identity, errorText, tabs: null };
  const writeLocked = locked || view.terminal;

  /* Milline vaade on ees: alamvaade, kui see on avatud, muidu sakk. Vaade on
     kirjeldus ja selle joonistab alati sama `OpenView` (vt selle selgitust). */
  const screen = () => {
    if (sub?.view === "add" && !view.terminal) {
      return {
        frame: focused,
        view: draftFieldAddView({
          t,
          formId,
          draft: newField,
          onChange: (patch) => setNewField((current) => ({ ...current, ...patch })),
          provenanceOptions: provenanceOptions(t),
          locked,
          busy,
          glow,
          canSubmit: canAddDraftField(newField),
          onSubmit: async (event) => {
            event.preventDefault();
            if (!canAddDraftField(newField)) return;
            const saved = await actions.saveField(newField.fieldKey, newField.text, newField.provenance);
            /* Väli tühjendatakse AINULT õnnestumisel — tõrge ei tohi kasutaja
               teksti ära kustutada. */
            if (!saved) return;
            setNewField(EMPTY_FIELD);
            setSub(null);
          },
          /* Loobumine jätab pooleli välja alles: vorm avaneb sellega uuesti. */
          onCancel: () => setSub(null)
        })
      };
    }

    if (openField) {
      const text = edits[openField.key] ?? openField.text;
      const forget = () =>
        setEdits((current) => {
          const rest = { ...current };
          delete rest[openField.key];
          return rest;
        });
      return {
        frame: focused,
        view: draftFieldView({
          t,
          row: openField,
          text,
          onText: (value) => setEdits((current) => ({ ...current, [openField.key]: value })),
          locked: writeLocked,
          terminal: view.terminal,
          busy,
          glow,
          canSave: Boolean(text.trim()) && text !== openField.text,
          remove: {
            disabled: locked || busy,
            onConfirm: async () => {
              const done = await actions.removeField(openField.key);
              /* Väli on eemaldatud: ees on jälle väljade loend ja fookus selle pealkirjal. */
              if (!done) return;
              forget();
              setSub(null);
            }
          },
          /* Päritolu teksti salvestamisega ei muutu (L4): server jätab
             olemasoleva rea märgise alles, kaasa läheb rea enda märgis. */
          onSave: async () => {
            const saved = await actions.saveField(openField.key, text, openField.provenance);
            if (saved) forget();
          },
          onBack: () => setSub(null)
        })
      };
    }

    if (tab === "state") {
      return {
        frame: tabbed,
        view: draftStateView({
          t,
          view,
          to: chosen,
          onTo: setTo,
          review: asksReviewKind(chosen) ? { options: reviewKindOptions(t), value: reviewKind, onChange: setReviewKind } : null,
          locked,
          busy,
          glow,
          needsConfirm: transitionNeedsConfirm(chosen),
          onTransition: async () => {
            if (!chosen) return;
            const moved = await actions.transition(draft.transferState, chosen, asksReviewKind(chosen) ? reviewKind : "");
            if (!moved) return;
            setTo("");
            setReviewKind("");
          }
        })
      };
    }

    if (tab === "transfer") return { frame: tabbed, view: draftTransferView({ t, model: transfer, glow }) };

    return {
      frame: tabbed,
      view: draftFieldsView({
        t,
        rows: fields,
        terminal: view.terminal,
        purgedNote: draft.contentPurgedAt ? t("casework.transfer.content_purged", "") : "",
        add: view.terminal ? null : { disabled: locked || busy, onClick: () => setSub({ view: "add" }) },
        glow,
        onOpen: (key) => setSub({ view: "field", key })
      })
    };
  };

  return <OpenView {...screen()} />;
}
