"use client";

/**
 * JTA-V1 (E3) — kohtumise ettevalmistuse sektsioon juhtumi detailvaates.
 *
 * MIKS SIIN, MITTE OMAL MARSRUUDIL. Leping ütles „uus `app/juhtumid/[caseId]/page.jsx`
 * — juhtumi detailvaade (**täna ei ole**)". Koodist mõõdetuna oli see väide vale:
 * detailvaade ON olemas (`CaseWorkDetail.jsx`, `/juhtumid?juhtum=<id>`), ja
 * JUHTUM-V1 E6 valis teadlikult ÜHE marsruudi — „kaks eri marsruuti tähendaks
 * kahte kohta, kust sama asja otsida". Uus tee samale objektile oleks tühistanud
 * juba tehtud otsuse, mitte täitnud lepingut. Leping on parandatud.
 *
 * PÄRITOLU ON SIIN LIIDESE TASEMEL NÄHTAV, mitte peidetud. Iga väli ja iga
 * küsimus kannab oma märgist, ja AI mustandi kõrval seisab kinnitusnupp —
 * see on ainus koht, kust märgis muutub. Teksti parandamine EI muuda teda
 * (server eirab saadetud `provenance`-i) ja seda tõendab teenuskihi test.
 *
 * KUJU (09.10): VÄIKESED VAATED. Sektsioon on juhtumi lava üks osa
 * (`CaseWorkDetail.jsx`) ja oli seal üks pikk veerg: loomise vorm, loend ja
 * selle all avatud ettevalmistus viie tekstikasti ja küsimuste loendiga. Nüüd
 * on korraga ees üks asi: ettevalmistuste loend, uue ettevalmistuse vorm või
 * avatud ettevalmistus, mille vaated (ülevaade, viis välja, küsimused)
 * vahetuvad sakkidest. Ettevalmistus ei saa olla juhtumi lava osa: neid on
 * juhtumil mitu ja need avanevad loendist, seepärast vahetub sisu osa sees.
 *
 * Siin on andmed, päringud ja see, mis vaateid olekuga seob. Vaated on failides
 * ./sections/PrepViews.jsx ja ./sections/SectionBits.jsx, read ja reeglid
 * failis ./sections/sectionRows.js.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import { caseWorkRequest, fromLocalInputValue } from "./caseWorkClient";
import { prepFieldView, prepOverviewView, prepQuestionView, prepQuestionsView } from "./sections/PrepViews";
import { Chip } from "./cases/CaseListViews";
import { ItemListView, MeetingCreateView, OpenView, provenanceView, rowAddView, useSwapFocus } from "./sections/SectionBits";
import {
  PREP_FIELD_KEYS,
  PREP_TABS,
  canAddRow,
  canSavePrepField,
  confirmTargetOptions,
  prepFieldText,
  prepFieldModel,
  prepOverview,
  prepRows,
  prepTabs,
  prepTitle,
  prepUnsaved,
  provenanceOptions,
  questionKindOptions,
  questionRows
} from "./sections/sectionRows";
import { notify, useCaseList, useRowOpening, useSectionRun } from "./sections/useSectionData";

/* Sakid on neljas veerus: ülevaade, viis välja ja küsimused mahuvad kahte ritta
   ja iga nimi ühele reale. */
const PREP_TAB_COLUMNS = 4;

/**
 * `locked`: juhtum ei ole aktiivne (kirjutuskaitse on nähtav, mitte ainult
 * serveri vastuses). `caseBusy`: juhtumi enda kirjutus käib. `active`: see osa
 * on laval ees (ainult siis joonistab põhinupp oma helgi).
 */
export default function MeetingPrepSection({ caseId, locked, caseBusy, active, onChanged, onListLoaded, onUnsaved, leaveGate }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const root = `/cases/${encodeURIComponent(caseId)}/meeting-preps`;

  const { busy, errorKey, setErrorKey, run } = useSectionRun();
  /* Pagineerimine on kohustuslik: vanemad ettevalmistused ei tohi kaduda.
     Loend teatatakse üles pärast iga täislaadimist (juhtumi ülevaade näitab
     selle osa esimest rida). */
  const { items: preps, cursor: prepsCursor, status, load: loadPreps, retry } = useCaseList({
    path: root,
    locale,
    onLoaded: onListLoaded,
    onError: setErrorKey
  });

  const [openPrep, setOpenPrep] = useState(null);
  /* Kaks `loadPrep()` päringut võivad lõppeda VALES JÄRJEKORRAS ja aeglasem
     vastus kirjutaks värskema üle. Vt sama selgitust märkme sektsioonis. */
  const requestedPrepId = useRef(null);
  /* Loend või uue ettevalmistuse vorm: need vahetuvad kohapeal. */
  const [mode, setMode] = useState("list");
  const [meetingAt, setMeetingAt] = useState("");
  /* Äsja alustatud ettevalmistus avaneb esimese välja juures (eesmärk),
     loendist avatud ettevalmistus ülevaates. */
  const [landOn, setLandOn] = useState(PREP_TABS[0]);

  const loadPrep = useCallback(
    async (prepId) => {
      requestedPrepId.current = prepId;
      try {
        const body = await caseWorkRequest(`${root}/${encodeURIComponent(prepId)}`, { locale });
        if (requestedPrepId.current !== prepId) return;
        setOpenPrep(body.prep || null);
      } catch (error) {
        if (requestedPrepId.current !== prepId) return;
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      }
    },
    [locale, root, setErrorKey]
  );

  const createPrep = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        const created = await caseWorkRequest(root, {
          method: "POST",
          locale,
          body: { meetingAt: fromLocalInputValue(meetingAt) }
        });
        if (!created?.prep?.id) return;
        setMeetingAt("");
        setLandOn(PREP_FIELD_KEYS[0]);
        await loadPreps();
        await loadPrep(created.prep.id);
        /* Vorm annab koha tagasi alles siis, kui uus ettevalmistus on ees (või
           selle avamine ebaõnnestus ja ees on loend koos teatega). */
        setMode("list");
        notify(onChanged);
      });
    },
    [loadPrep, loadPreps, locale, meetingAt, onChanged, root, run]
  );

  const { openingId, open: openFromList } = useRowOpening(
    useCallback(
      (prepId) => {
        setLandOn(PREP_TABS[0]);
        return loadPrep(prepId);
      },
      [loadPrep]
    )
  );

  const closePrep = useCallback(() => {
    requestedPrepId.current = null;
    setOpenPrep(null);
  }, []);

  /**
   * Kirjutus avatud ettevalmistusse: päring ja kohe selle järel värske seis.
   * Mõlemad on ühe `run()` sees, et teine vajutus ei jõuaks nende vahele.
   */
  const openPrepId = openPrep?.id || null;
  const write = useCallback(
    (path, options) => {
      if (!openPrepId) return Promise.resolve(null);
      return run(async () => {
        const body = await caseWorkRequest(`${root}/${encodeURIComponent(openPrepId)}${path}`, { locale, ...options });
        /* Kui ettevalmistus suleti päringu ajal, ei ava vastus seda uuesti. */
        if (requestedPrepId.current === openPrepId) await loadPrep(openPrepId);
        return body;
      });
    },
    [loadPrep, locale, openPrepId, root, run]
  );

  const deletePrep = useCallback(
    () =>
      run(async () => {
        await caseWorkRequest(`${root}/${encodeURIComponent(openPrepId)}`, { method: "DELETE", locale });
        closePrep();
        await loadPreps();
        notify(onChanged);
      }),
    [closePrep, loadPreps, locale, onChanged, openPrepId, root, run]
  );

  const actions = useMemo(
    () => ({
      saveField: (fieldKey, text, provenance) => write("/fields", { method: "PUT", body: { fieldKey, text, provenance } }),
      confirmField: (fieldKey, from, to) =>
        write(`/fields/${encodeURIComponent(fieldKey)}/confirm-provenance`, { method: "POST", body: { from, to } }),
      addQuestion: (kind, text, provenance) => write("/questions", { method: "POST", body: { kind, text, provenance } }),
      removeQuestion: (questionId) => write(`/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" }),
      confirmQuestion: (questionId, from, to) =>
        write(`/questions/${encodeURIComponent(questionId)}/confirm-provenance`, { method: "POST", body: { from, to } })
    }),
    [write]
  );

  const swapRef = useSwapFocus(openPrep ? `open:${openPrep.id}` : mode);
  const blocked = locked || caseBusy || busy;
  const errorText = errorKey ? t(errorKey, "") : "";
  const rows = useMemo(
    () =>
      prepRows(preps, { t, locale }).map((row) => ({
        id: row.id,
        title: row.title,
        chips: row.purged ? [{ key: "purged", text: t("casework.prep.purged_chip", "") }] : []
      })),
    [locale, preps, t]
  );

  if (openPrep) {
    return (
      /* `key` sunnib React'i puu maha võtma, kui avatakse teine ettevalmistus.
         Ilma temata elab väljade ja küsimusevormi kohalik olek üle ning
         ettevalmistuses A pooleli jäänud teksti saaks salvestada B alla. */
      <PrepEditor
        key={openPrep.id}
        t={t}
        locale={locale}
        prep={openPrep}
        landOn={landOn}
        locked={locked}
        busy={caseBusy || busy}
        glow={active}
        errorText={errorText}
        actions={actions}
        onDelete={deletePrep}
        onClose={closePrep}
        onUnsaved={onUnsaved}
        leaveGate={leaveGate}
      />
    );
  }

  if (mode === "create") {
    return (
      <MeetingCreateView
        t={t}
        title={t("casework.prep.create_title", "")}
        lead={t("casework.prep.create_hint", "")}
        swapRef={swapRef}
        formId={formId}
        label={t("casework.prep.meeting_at", "")}
        value={meetingAt}
        onChange={setMeetingAt}
        submitLabel={t("casework.prep.create", "")}
        glow={active}
        busy={blocked}
        errorText={errorText}
        onSubmit={createPrep}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <ItemListView
      t={t}
      title={t("casework.page.parts.prep.title", "")}
      lead={t("casework.prep.section_hint", "")}
      swapRef={swapRef}
      errorText={errorText}
      status={status}
      rows={rows}
      emptyText={t("casework.prep.empty", "")}
      openText={t("casework.prep.open", "")}
      openingId={openingId}
      /* „Näita rohkem" käib `run()` sees ja `busy` taga: nii ei saa sama
         kursor kaks korda lisanduda. */
      more={
        prepsCursor
          ? { busy, label: t("casework.prep.load_more", ""), onClick: () => run(() => loadPreps({ cursor: prepsCursor, append: true })) }
          : null
      }
      onOpen={openFromList}
      onRetry={() => {
        setErrorKey(null);
        retry();
      }}
      actions={
        <Button type="button" size="sm" variant="primary" glow={active} disabled={blocked} onClick={() => setMode("create")}>
          {t("casework.prep.create", "")}
        </Button>
      }
    />
  );
}

/** Avatud ettevalmistuse välja salvestatud tekstid võtmete kaupa. */
function savedTexts(prep) {
  return Object.fromEntries(PREP_FIELD_KEYS.map((key) => [key, prepFieldText(prep, key)]));
}

/**
 * Avatud ettevalmistus: hoiab, milline sakk ja alamvaade on ees, ning pooleli
 * tekste. Joonistavad vaated failis ./sections/PrepViews.jsx.
 */
function PrepEditor({ t, locale, prep, landOn, locked, busy, glow, errorText, actions, onDelete, onClose, onUnsaved, leaveGate }) {
  const formId = useId();
  /* O-JTA-6: purge'itud ettevalmistus on TÜHJAST ERISTATAV ja kirjutuskaitstud.
     Ilma selleta näeks „töötaja arhiveeris töömaterjali" välja täpselt nagu
     „ettevalmistust ei ole veel alustatud" — ja iga uus väli oleks vaikne
     vastuolu markeriga, mis ütleb, et sisu on kustutatud. */
  const purged = Boolean(prep.contentPurgedAt);
  const writeLocked = locked || purged;

  const [tab, setTab] = useState(landOn);
  /* Alamvaade saki asemel: uue välja päritolu (`origin`), uus küsimus (`add`),
     avatud küsimus (`question`) või päritolu kinnitamine (`confirm`).
     `null` = ees on sakk ise. */
  const [sub, setSub] = useState(null);

  /* VÄLJADE POOLELI TEKSTID ELAVAD SIIN, mitte välja vaates. Vaade vahetub
     saki vahetusega, aga pooleli kirjutatud eesmärk ei tohi kaduda, kui töötaja
     vahepeal päevakorda vaatab. */
  const [texts, setTexts] = useState(() => savedTexts(prep));
  /* Uuel real EI OLE vaikimisi päritolu (L4): esimene salvestus küsib seda
     omaette vaates. Olemasoleval real seda ei küsita: märgist muudab ainult
     kinnitamine. */
  const [origins, setOrigins] = useState({});
  const [question, setQuestion] = useState({ text: "", provenance: "" });
  /* Kinnitamise siht. Vaikimisi valikut ei ole: märgis, mille inimene ei
     valinud, ei ole märgis. */
  const [confirmTo, setConfirmTo] = useState("");

  /* Kui serveris muutus välja tekst (oma salvestus, mille server kärpis, või
     muudatus teisest aknast), võtab väli selle üle. AINULT see väli: teiste
     väljade pooleli tekst jääb puutumata, sest iga väli salvestab ainult
     ennast. */
  const syncedRef = useRef(null);
  useEffect(() => {
    const server = savedTexts(prep);
    const previous = syncedRef.current;
    syncedRef.current = server;
    if (!previous) return;
    const changed = PREP_FIELD_KEYS.filter((key) => server[key] !== previous[key]);
    if (changed.length) {
      setTexts((current) => ({ ...current, ...Object.fromEntries(changed.map((key) => [key, server[key]])) }));
    }
  }, [prep]);

  /* Salvestamata tekst teatatakse juhtumi vaatele (lahkumise värav) ja avatud
     ettevalmistuse sulgemine küsib enne üle. Kirjutuskaitstud ettevalmistusse
     ei saa midagi kirjutada. */
  const dirty = !writeLocked && prepUnsaved(prep, texts, question);
  useEffect(() => {
    onUnsaved?.(dirty);
  }, [dirty, onUnsaved]);
  useEffect(() => () => onUnsaved?.(false), [onUnsaved]);
  const close = () => {
    if (dirty && leaveGate && !leaveGate("close")) return;
    onClose();
  };

  const swapRef = useSwapFocus(sub ? `${sub.view}:${sub.id || sub.kind || ""}:${sub.target || ""}` : "tab", { onMount: true });
  const context = { t, locale };
  const questions = questionRows(prep, context);
  const openQuestion = sub?.id ? questions.find((row) => row.id === sub.id) || null : null;

  /* Avatud ettevalmistuse identiteet on nähtav igas vaates: juhtumil on neid
     mitu. Tee tagasi loendisse on sakkidega vaadetes; alamvaatel on oma
     „Loobu" või „Tagasi" all servas. */
  /* O-JTA-6: arhiveeritud sisu märk on päises, mida joonistab IGA vaade. Ainult
     ülevaate sakil olles näeks väljade ja küsimuste sakid välja täpselt nagu
     alustamata ettevalmistus (tühi lukus väli, nuppe ei ole) ilma põhjuseta. */
  const purgedNote = purged ? t("casework.errors.prep_content_purged", "") : "";
  const identity = {
    label: t("casework.prep.open_prep", ""),
    name: prepTitle(prep, context),
    chips: purged ? <Chip tone="wait">{t("casework.prep.purged_chip", "")}</Chip> : null
  };
  const tabbed = {
    swapRef,
    head: { ...identity, back: { label: t("casework.prep.back_to_list", ""), onClick: close } },
    errorText,
    tabs: {
      label: t("casework.prep.tabs_label", ""),
      tabs: prepTabs(prep, context),
      current: tab,
      columns: PREP_TAB_COLUMNS,
      pendingText: t("casework.prep.tab_ai_pending", ""),
      onSelect: setTab
    }
  };
  /* Alamvaates sakke ei ole: vorm ja avatud rida vajavad kogu ruumi. */
  const focused = { swapRef, head: identity, errorText, tabs: null };

  /* Milline vaade on ees: alamvaade, kui see on avatud, muidu sakk. Vaade on
     kirjeldus ja selle joonistab alati sama `OpenView` (vt selle selgitust). */
  const screen = () => {
    /* Uue välja esimene salvestus: päritolu küsitakse enne, kui tekst serverisse läheb. */
    if (sub?.view === "origin") {
      const text = texts[sub.id] ?? "";
      const origin = origins[sub.id] || "";
      return {
        frame: focused,
        view: provenanceView({
          t,
          title: t(`casework.prep.field_${sub.id}`, ""),
          text,
          options: provenanceOptions(t),
          value: origin,
          onChange: (value) => setOrigins((current) => ({ ...current, [sub.id]: value })),
          locked: writeLocked,
          busy,
          glow,
          submitLabel: t("casework.prep.save_field", ""),
          onSubmit: async () => {
            if (!canSavePrepField({ text, saved: false, provenance: origin })) return;
            const saved = await actions.saveField(sub.id, text, origin);
            /* Salvestatud: ees on jälle väli, nüüd oma päritolu märgiga.
               Tõrke korral jääb valik ette ja tekst alles. */
            if (saved) setSub(null);
          },
          onCancel: () => setSub(null)
        })
      };
    }

    if (sub?.view === "confirm") {
      const field = sub.target === "field" ? prepFieldModel(prep, sub.id, context) : null;
      const from = field ? field.provenance : openQuestion?.provenance;
      const back = sub.target === "question" ? { view: "question", id: sub.id } : null;
      if (field || openQuestion) {
        return {
          frame: focused,
          view: provenanceView({
            t,
            title: t("casework.prep.confirm_provenance", ""),
            /* Kinnitatakse SALVESTATUD teksti, mitte kastis pooleli olevat. */
            text: field ? field.savedText : openQuestion.text,
            current: field ? field.provenanceText : openQuestion.provenanceText,
            options: confirmTargetOptions(t),
            value: confirmTo,
            onChange: setConfirmTo,
            locked,
            busy,
            glow,
            submitLabel: t("casework.prep.confirm_provenance", ""),
            onSubmit: async () => {
              if (!confirmTo) return;
              const done =
                sub.target === "field"
                  ? await actions.confirmField(sub.id, from, confirmTo)
                  : await actions.confirmQuestion(sub.id, from, confirmTo);
              if (!done) return;
              setConfirmTo("");
              setSub(back);
            },
            onCancel: () => {
              setConfirmTo("");
              setSub(back);
            }
          })
        };
      }
    }

    if (sub?.view === "add") {
      const kind = questionKindOptions(t).find((option) => option.value === sub.kind);
      return {
        frame: focused,
        view: rowAddView({
          t,
          formId,
          /* Liik valiti juba nupuga, millega vorm avati, ja on tekstikasti sildiks. */
          label: kind?.label || t("casework.prep.question_text", ""),
          provenanceLabel: t("casework.prep.provenance_required", ""),
          submitLabel: t("casework.prep.add_question", ""),
          text: question.text,
          onText: (text) => setQuestion((current) => ({ ...current, text })),
          provenance: {
            options: provenanceOptions(t),
            value: question.provenance,
            onChange: (provenance) => setQuestion((current) => ({ ...current, provenance }))
          },
          locked: writeLocked,
          busy,
          glow,
          canSubmit: canAddRow(question),
          onSubmit: async (event) => {
            event.preventDefault();
            if (!canAddRow(question)) return;
            const saved = await actions.addQuestion(sub.kind, question.text, question.provenance);
            /* Väli tühjendatakse AINULT õnnestumisel — ebaõnnestunud salvestus ei
               tohi kasutaja teksti ära kustutada. */
            if (!saved) return;
            setQuestion({ text: "", provenance: "" });
            setSub(null);
          },
          /* Loobumine jätab pooleli teksti alles: vorm avaneb sellega uuesti. */
          onCancel: () => setSub(null)
        })
      };
    }

    if (sub?.view === "question" && openQuestion) {
      return {
        frame: focused,
        view: prepQuestionView({
          t,
          row: openQuestion,
          busy,
          locked,
          glow,
          remove: {
            disabled: locked || busy,
            onConfirm: async () => {
              const done = await actions.removeQuestion(openQuestion.id);
              /* Küsimus on eemaldatud: ees on jälle loend ja fookus selle pealkirjal. */
              if (done) setSub(null);
            }
          },
          onConfirmOpen: () => {
            setConfirmTo("");
            setSub({ view: "confirm", target: "question", id: openQuestion.id });
          },
          onBack: () => setSub(null)
        })
      };
    }

    if (tab === "overview") {
      return {
        frame: tabbed,
        view: prepOverviewView({
          t,
          overview: prepOverview(prep, context),
          /* Kustutus on pöördumatu ja teda ei auditeerita — küsitakse üle.
             Arhiveeritud sisuga ettevalmistust ei kustutata (O-JTA-6). */
          remove: purged ? null : { disabled: locked || busy, onConfirm: onDelete }
        })
      };
    }

    if (tab === "questions") {
      return {
        frame: tabbed,
        view: prepQuestionsView({
          t,
          rows: questions,
          glow,
          purgedNote,
          /* Purge'itud ettevalmistusse ei kirjutata uut sisu — server keeldub
             409-ga ja vorm, mis seda ei tea, annaks kasutajale vea tema enda teo
             eest. */
          add: purged
            ? null
            : {
                disabled: locked || busy,
                kinds: questionKindOptions(t)
                  .map((option, index) => ({
                    value: option.value,
                    label: t(`casework.prep.add_kind_${option.value}`, ""),
                    primary: index === 0
                  }))
                  /* Põhinupp (küsimus) on jalareas viimane, nagu teistes vaadetes. */
                  .reverse(),
                onAdd: (kind) => setSub({ view: "add", kind })
              },
          onOpen: (id) => setSub({ view: "question", id })
        })
      };
    }

    const field = prepFieldModel(prep, tab, context);
    const text = texts[tab] ?? "";
    return {
      frame: tabbed,
      view: prepFieldView({
        t,
        field,
        text,
        purgedNote,
        onText: (value) => setTexts((current) => ({ ...current, [tab]: value })),
        locked: writeLocked,
        busy,
        glow,
        /* Salvestatud välja sama tekst ei ole muudatus: nuppu ei pakuta. */
        canSave: Boolean(text.trim()) && (!field.saved || text.trim() !== String(field.savedText || "").trim()),
        /* Märgis EI muutu teksti salvestamisega — server eirab saadetud
           väärtust. Olemasoleva rea juures läheb kaasa tema enda märgis; uue
           rea salvestus küsib enne päritolu. */
        onSave: () => (field.saved ? actions.saveField(tab, text, field.provenance) : setSub({ view: "origin", id: tab })),
        onConfirmOpen: () => {
          setConfirmTo("");
          setSub({ view: "confirm", target: "field", id: tab });
        }
      })
    };
  };

  return <OpenView {...screen()} />;
}
