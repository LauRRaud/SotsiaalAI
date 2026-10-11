"use client";

/**
 * Mentorluse haldus: ülevaatust ootavad mentoriprofiilid ja ESTA andmebaasist
 * toodud kirjete nõusolekud. Suhete sisu haldur ei näe, ainult nende arvu.
 *
 * KUJU (09.10). Leht oli üks pikk veerg tumeda kaardi sees: arvud, järjekord
 * ja lai tabel, mille igal real olid rippvalikud ja nupud. Nüüd on see loend,
 * kust rida avab kirje: korraga on ees kas loend või üks avatud kirje.
 *
 * ILMA SAMMULAVATA. Halduse raam (`PanelFrame`, `data-admin`) on terve ekraani
 * laiune ja kindla kõrgusega aken. Sammulava on tehtud kitsa klaaspaneeli
 * jaoks, kus üks vaade on üks asi ja paneel võtab vaate kõrguse; terve ekraani
 * laiuses aknas veniksid selle read ja plaadid akna laiuseks. Loend ja avatud
 * kirje vahetuvad siin kohapeal (nagu „Minu juhtumid”), samade
 * ehitusklotsidega: `StepPanel`, `ChoiceRow`, `ActionCard`, madalad read ja
 * oma kujundusfail. Lehe nimi on all kiirmenüüs, pealkiri jääb ekraanilugejale.
 *
 * Vaated on failis ./admin/AdminViews.jsx, read ja otsused failis
 * ./admin/adminRows.js. Siin on andmed, päringud ja see, mis vaateid olekuga
 * seob.
 *
 * MIS ON TEISITI KUI ENNE (ja miks):
 *  - Haldur näeb ülevaatusel profiili tervikuna (tutvustus, kogemus,
 *    valdkonnad, teemad, keeled, vormid). Varem oli näha nimi ja lühitutvustus,
 *    kuigi otsus lubab kataloogi kõik tekstid.
 *  - Tagasilükkamine ja ESTA kirje kustutamine küsivad teist vajutust.
 *  - ESTA kirjete laadimise viga on viga, mitte lause „kirjeid ei ole”.
 *  - Kui järjekorras või ESTA kirjetes on rohkem ridu, kui server korraga
 *    annab, ütleb leht seda.
 *  - Kirjete toomise järel ütleb leht, mitu kirjet lisati.
 *  - Tühjaks kustutatud tõendi viide jääb tühjaks: varem saadeti selle asemel
 *    vaikides varem salvestatud viide.
 *  - Kui seis on mujal muutunud (vastus 409 või 404), loeb leht värske seisu.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

import {
  ADMIN_GROUPS,
  EVIDENCE_REF_LIMIT,
  capNote,
  consentBody,
  consentFilterOptions,
  consentForm,
  consentOptions,
  counterCells,
  evidenceOptions,
  externalRecordModel,
  externalRows,
  filterExternal,
  groupOptions,
  importSummary,
  queueChip,
  queueProfileModel,
  queueRows,
  reasonOptions,
  rejectReason
} from "./admin/adminRows";
import { AdminFrame, AdminListView, ExternalItemView, QueueItemView } from "./admin/AdminViews";
import { scrollerOf } from "./desk/DeskParts";
import { EntryShell } from "./entry/EntryParts";

const JSON_POST = Object.freeze({ method: "POST", headers: { "Content-Type": "application/json" } });
const NOTHING_OPEN = Object.freeze({ group: "", id: "" });
const profileUrl = (id) => `/api/admin/mentoring/${encodeURIComponent(id)}`;

export default function AdminMentoringPage() {
  const { t, locale } = useI18n();
  const [queue, setQueue] = useState([]);
  const [counters, setCounters] = useState(null);
  const [external, setExternal] = useState([]);
  const [externalFailed, setExternalFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  /* Teade selle kohta, mis viimasest teost sai: `{ text, tone }`. */
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [group, setGroup] = useState(ADMIN_GROUPS[0]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(NOTHING_OPEN);
  const [rejecting, setRejecting] = useState(false);
  /* Rida, kust kirje avati: loendisse naastes läheb fookus sinna tagasi. */
  const [returnRow, setReturnRow] = useState(null);
  /* Pooleli valikud kirje kaupa: teise kirje avamine neid kaasa ei vii. */
  const [reasons, setReasons] = useState({});
  const [consentDrafts, setConsentDrafts] = useState({});

  const shellRef = useRef(null);
  const savedScroll = useRef(0);

  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale || "et", { dateStyle: "medium" });
    return (value) => {
      if (!value) return "";
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? formatter.format(date) : "";
    };
  }, [locale]);

  /** Loeb järjekorra, arvud ja ESTA kirjed. Tagastab, kas järjekord saadi kätte. */
  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const [queueResponse, externalResponse] = await Promise.all([
        fetch("/api/admin/mentoring", { cache: "no-store", signal }),
        fetch("/api/admin/mentoring/external", { cache: "no-store", signal })
      ]);
      const queuePayload = await queueResponse.json().catch(() => ({}));
      const externalPayload = await externalResponse.json().catch(() => ({}));
      if (!queueResponse.ok || queuePayload?.ok === false) {
        throw new Error(resolveApiMessage({ payload: queuePayload, t, fallbackKey: "mentoring.errors.load_failed" }));
      }
      setQueue(Array.isArray(queuePayload?.queue) ? queuePayload.queue : []);
      setCounters(queuePayload?.counters || null);
      /* ESTA kirjete viga ei tee loendit tühjaks: varem laaditud read jäävad
         ette ja leht ütleb, et värskendamine ei õnnestunud. */
      const externalOk = externalResponse.ok && externalPayload?.ok !== false;
      if (externalOk) setExternal(Array.isArray(externalPayload?.records) ? externalPayload.records : []);
      setExternalFailed(!externalOk);
      setLoaded(true);
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
      setLoadError(error?.message || t("mentoring.errors.load_failed"));
      return false;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /**
   * Üks koht, kus tegu õnnestub või annab lausega vea. Tagastab vastuse või
   * `null`; õnnestumise lause paneb kutsuja ise.
   */
  const act = useCallback(async (url, body) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(url, { ...JSON_POST, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const error = new Error(resolveApiMessage({ payload, t, fallbackKey: "mentoring.errors.save_failed" }));
        error.status = response.status;
        error.messageKey = String(payload?.messageKey || "");
        throw error;
      }
      await load();
      return payload;
    } catch (error) {
      let text = error?.message || t("mentoring.errors.save_failed");
      /* Kirje muutus või kadus mujal (teine haldur, mentor ise): loeme värske
         seisu, et järgmine katse ei põrkaks vana versiooni taha. */
      if (error?.status === 409 || error?.status === 404) {
        const fresh = await load();
        if (fresh && error.messageKey === "mentoring.errors.conflict") text = t("mentoring.labels.conflict_reloaded");
      }
      setFeedback({ text, tone: "risk" });
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [load, t]);

  const openedProfile = open.group === "queue" ? queue.find((profile) => String(profile?.id) === open.id) || null : null;
  const openedRecord = open.group === "external" ? external.find((record) => String(record?.id) === open.id) || null : null;
  /* Avatud on ainult kirje, mis on päriselt loendis (mitte see, mis vahepeal kadus). */
  const shownId = openedProfile || openedRecord ? open.id : "";

  /* Loend võib olla pikk (kuni 300 ESTA kirjet) ja kerib halduse aknas. Avatud
     kirje algab ülevalt; loendisse naastes on inimene samas kohas, kust ta rea
     avas. */
  const shownBefore = useRef("");
  useLayoutEffect(() => {
    if (shownBefore.current === shownId) return;
    shownBefore.current = shownId;
    const scroller = scrollerOf(shellRef.current);
    if (scroller) scroller.scrollTop = shownId ? 0 : savedScroll.current;
  }, [shownId]);

  const openItem = (itemGroup, id) => {
    savedScroll.current = scrollerOf(shellRef.current)?.scrollTop || 0;
    setOpen({ group: itemGroup, id });
    /* Rida jäetakse meelde juba avamisel: kui kirje saab otsuse või kustutatakse,
       tuleb loend ette kohe pärast värske seisu laadimist, enne kui see tegu
       siin lõpuni jõuab. */
    setReturnRow(id);
    setRejecting(false);
    setFeedback(null);
  };
  const closeItem = () => {
    setOpen(NOTHING_OPEN);
    setRejecting(false);
  };

  const context = { t, formatDate };

  let view;
  if (openedProfile) {
    const id = String(openedProfile.id);
    const reason = rejectReason(reasons[id]);
    /* Otsuse järel on profiil järjekorrast läinud: ees on jälle loend ja teade. */
    const decide = async (body, doneText) => {
      const done = await act(profileUrl(id), body);
      if (!done) return;
      closeItem();
      setFeedback({ text: doneText, tone: "ok" });
    };
    view = (
      <QueueItemView
        t={t}
        mode={rejecting ? "reject" : "read"}
        model={queueProfileModel(openedProfile)}
        chip={queueChip(openedProfile, t)}
        groupTitles={{
          fields: t("mentoring.profile_public.group.fields"),
          topics: t("mentoring.profile_public.group.topics"),
          languages: t("mentoring.profile_public.group.languages"),
          formats: t("mentoring.profile_public.group.formats")
        }}
        reasons={reasonOptions(t)}
        reason={reason}
        onReason={(value) => setReasons((previous) => ({ ...previous, [id]: value }))}
        busy={busy}
        note={feedback?.text || ""}
        onBack={() => {
          closeItem();
          setFeedback(null);
        }}
        onApprove={() => void decide({ action: "review", decision: "APPROVE" }, t("mentoring.admin.approved_feedback"))}
        onStartReject={() => {
          setRejecting(true);
          setFeedback(null);
        }}
        onCancelReject={() => setRejecting(false)}
        onReject={() => decide({ action: "review", decision: "REJECT", reasonKey: reason }, t("mentoring.admin.rejected_feedback"))}
      />
    );
  } else if (openedRecord) {
    const id = String(openedRecord.id);
    const form = consentForm(openedRecord, consentDrafts[id]);
    const draft = (patch) => {
      setConsentDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
      setFeedback(null);
    };
    view = (
      <ExternalItemView
        t={t}
        model={externalRecordModel(openedRecord, context)}
        form={form}
        statuses={consentOptions(t)}
        evidenceTypes={evidenceOptions(t)}
        maxLength={EVIDENCE_REF_LIMIT}
        busy={busy}
        note={feedback?.text || t("mentoring.admin.save_hint")}
        onBack={() => {
          closeItem();
          setFeedback(null);
        }}
        onStatus={(value) => draft({ status: value })}
        onEvidenceType={(value) => draft({ type: value })}
        onEvidenceRef={(value) => draft({ reference: value })}
        onSave={async () => {
          if (!form.canSave) return;
          const done = await act(profileUrl(id), consentBody(form));
          if (!done) return;
          /* Salvestatud: vorm näitab jälle serveri väärtusi. */
          setConsentDrafts((previous) => {
            const next = { ...previous };
            delete next[id];
            return next;
          });
          setFeedback({ text: t("mentoring.admin.consent_saved_feedback"), tone: "ok" });
        }}
        onDelete={async () => {
          const done = await act(profileUrl(id), { action: "delete_external" });
          if (!done) return;
          closeItem();
          setFeedback({ text: t("mentoring.admin.deleted_feedback"), tone: "ok" });
        }}
      />
    );
  } else {
    const externalGroup = group === "external";
    const filterOptions = consentFilterOptions(external, t);
    const activeFilter = filterOptions.some((option) => option.value === filter) ? filter : "all";
    const allExternal = externalRows(external, context);
    const rows = externalGroup ? filterExternal(allExternal, activeFilter) : queueRows(queue, context);
    view = (
      <AdminListView
        t={t}
        title={externalGroup ? t("mentoring.admin.views.external.title") : t("mentoring.admin.views.queue.title")}
        counters={counterCells(counters, t)}
        groups={groupOptions(t)}
        group={group}
        onGroup={(value) => {
          setGroup(value);
          setFeedback(null);
        }}
        /* Ühe seisuga loendil ei ole midagi filtreerida. */
        filter={externalGroup && filterOptions.length > 2 ? { options: filterOptions, value: activeFilter, onChange: setFilter } : null}
        notice={feedback}
        fault={externalGroup && externalFailed ? { text: t("mentoring.admin.external_failed"), onRetry: () => void load() } : null}
        rows={rows}
        emptyText={
          externalGroup
            ? externalFailed
              ? ""
              : allExternal.length
                ? t("mentoring.admin.filter_empty")
                : t("mentoring.admin.external_empty")
            : t("mentoring.admin.queue_empty")
        }
        capText={capNote(group, externalGroup ? allExternal.length : rows.length, counters, t)}
        help={externalGroup ? t("mentoring.admin.external_help") : t("mentoring.admin.queue_help")}
        importCard={
          externalGroup
            ? {
                title: t("mentoring.admin.import_title"),
                description: t("mentoring.admin.import_hint"),
                disabled: busy,
                onClick: async () => {
                  const done = await act("/api/admin/mentoring", { action: "import_seed" });
                  if (done) setFeedback({ text: importSummary(done, t), tone: "ok" });
                }
              }
            : null
        }
        focusRow={returnRow}
        onOpen={(id) => openItem(group, id)}
      />
    );
  }

  return (
    <AdminFrame frameRef={shellRef}>
      <EntryShell
        title={t("mentoring.admin.title")}
        loadingText={loading ? t("mentoring.labels.loading") : ""}
        error={loadError}
        retryText={t("mentoring.labels.retry")}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      >
        {/* Värskendamise viga ei võta juba laaditud loendit eest ära: viga ja nupp
            „Proovi uuesti” seisavad selle kohal. */}
        {loaded ? view : null}
      </EntryShell>
    </AdminFrame>
  );
}
