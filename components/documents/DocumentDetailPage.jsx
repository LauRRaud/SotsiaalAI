"use client";

/**
 * Faili oma leht (/documents/<id>): üles laaditud fail, transkript või muu
 * lähtedokument. Siia tullakse isiklikust otsingust ja koostatud teksti
 * allikate loendist.
 *
 * KUJU (09.10, omaniku reeglid). Leht oli vanal ühisel kihil: tume kaart
 * klaaspaneeli sees, nähtav lehe pealkiri, faktide loend ja üks nupp. Nüüd on
 * see sama vaade, mis dokumentide lehe avatud dokument (`ItemView` failis
 * ./workspace/DocumentsViews.jsx), samade reeglitega (`itemActions` ja
 * `itemSheet` failis ./workspace/documentRows.js): faili saab alla laadida,
 * ümber nimetada, lubada töörežiimi ja kustutada (teise vajutusega) täpselt
 * siis, kui seda saab teha loendis. Pöörduja näeb oma faili lihtsal kujul.
 *
 * Kui failil on tekst (transkript ja selle kokkuvõte), on tekst omaette osa ja
 * leht on sammulaval (`parts`). Muidu on lehel üks vaade ja lava ei ole.
 *
 * Siin on andmed, päringud ja see, mis vaadet olekuga seob.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { pushWithTransition } from "@/lib/routeTransition";

import { LoadState, ReadView } from "./detail/DetailViews";
import { blockHeldPress, useHeadingFocus, useTwoPress } from "./detail/detailHooks";
import {
  RequestFailure,
  documentItem,
  documentPartKeys,
  documentSheet,
  documentText,
  documentsHref,
  failureText,
  serverMessage,
  wordCount
} from "./detail/detailModel";
import { ItemView } from "./workspace/DocumentsViews";
import { REMOVAL_NOTE_KEYS, itemActions } from "./workspace/documentRows";
import styles from "./workspace/documents.module.css";

/* Õnnestumise teade kaob ise (nagu dokumentide lehel); viga jääb ette. */
const OK_NOTICE_MS = 6000;
const NO_NOTICE = Object.freeze({ ok: "", error: "" });

export default function DocumentDetailPage({ documentId }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { effectiveRole } = useEffectiveRole();
  const isClientRole = effectiveRole === "CLIENT";
  usePanelInfoSlot({ infoId: "documents", title: t("documents.detail_title") });

  const [load, setLoad] = useState({ status: "loading", error: "" });
  const [record, setRecord] = useState(null);
  const [notice, setNotice] = useState(NO_NOTICE);
  /* Ümbernimetamine: `null`, kui väli ei ole lahti. */
  const [renameTitle, setRenameTitle] = useState(null);

  /* Päring on teel: sama tegevust ei saadeta kaks korda. Nuppe selleks välja ei
     lülitata: väljalülitatud nupp kaotaks klaviatuuri fookuse. */
  const busyRef = useRef(false);
  const pageRef = useRef(null);
  const focusHeading = useHeadingFocus(pageRef);
  const confirm = useTwoPress();

  /* Keele vahetus annab uue `t`: faili ei ole selle pärast vaja uuesti laadida. */
  const tRef = useRef(t);
  tRef.current = t;

  const loadDocument = useCallback(async () => {
    const say = tRef.current;
    setLoad({ status: "loading", error: "" });
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.document?.id) {
        throw new RequestFailure(serverMessage(payload, say, say("documents.errors.not_found")));
      }
      setRecord(payload.document);
      setLoad({ status: "ready", error: "" });
    } catch (error) {
      setRecord(null);
      setLoad({ status: "error", error: failureText(error, tRef.current("documents.errors.read_failed")) });
    }
  }, [documentId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    if (!notice.ok) return undefined;
    const timer = window.setTimeout(() => setNotice((current) => (current.ok ? NO_NOTICE : current)), OK_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice.ok]);

  const item = useMemo(() => documentItem(record), [record]);
  const toDocuments = () => pushWithTransition(router, documentsHref(locale));
  const back = { label: t("documents.back_to_documents"), onClick: toDocuments };

  /* Üks muutev päring korraga: vajutus, mis tuleb enne eelmise vastust, jääb ära. */
  async function exclusive(run) {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    try {
      return await run();
    } finally {
      busyRef.current = false;
    }
  }

  /* Muudatus kannab kaasa versiooni, mida see leht nägi: kui faili muudeti
     vahepeal mujal, annab server 409 ja värske seisu, mitte ei kirjuta üle. */
  async function patchDocument(data) {
    return exclusive(async () => {
      setNotice(NO_NOTICE);
      try {
        if (!record?.updatedAt) throw new RequestFailure(t("documents.errors.save_failed"));
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, expectedUpdatedAt: record.updatedAt })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 409 && payload?.document?.id) setRecord(payload.document);
          throw new RequestFailure(serverMessage(payload, t, t("documents.errors.save_failed")));
        }
        /* Vastus kannab muudetud faili: loendit ega faili ei ole vaja uuesti küsida. */
        if (payload?.document?.id) setRecord(payload.document);
        else await loadDocument();
        setNotice({ ok: t("documents.feedback.saved"), error: "" });
        return true;
      } catch (error) {
        setNotice({ ok: "", error: failureText(error, t("documents.errors.save_failed")) });
        return false;
      }
    });
  }

  /* Ümbernimetamise väli kaob koos fookusega: see läheb tagasi vaate pealkirjale. */
  function closeRename() {
    setRenameTitle(null);
    focusHeading();
  }

  async function saveRename() {
    const ok = await patchDocument({ title: renameTitle });
    if (ok) closeRename();
  }

  /* Kustutamine on jäädav. Siia jõuab alles teine vajutus (vt `confirm.action`). */
  async function removeDocument() {
    return exclusive(async () => {
      setNotice(NO_NOTICE);
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new RequestFailure(serverMessage(payload, t, t("documents.errors.delete_failed")));
        /* Faili enam ei ole: tagasi dokumentide lehele. */
        toDocuments();
      } catch (error) {
        setNotice({ ok: "", error: failureText(error, t("documents.errors.delete_failed")) });
      }
    });
  }

  function renderSheet(glow = true) {
    const can = itemActions(item, { locale, client: isClientRole });
    const actions = [];
    if (can.download) actions.push({ key: "download", label: t("documents.actions.download"), variant: "primary", href: can.download });
    if (can.compose) actions.push({ key: "compose", label: t("documents.workspace.compose_from"), href: can.compose });
    if (can.rename) {
      actions.push({
        key: "rename",
        label: t("documents.actions.rename"),
        onClick: () => setRenameTitle(item.title || "")
      });
    }
    actions.push({ key: "back", label: back.label, variant: "linkBrand", onClick: back.onClick });
    return (
      <ItemView
        t={t}
        title={t("documents.detail.views.sheet.title")}
        notice={{ ok: notice.ok, error: notice.error, onClose: () => setNotice(NO_NOTICE) }}
        sheet={documentSheet(item, { t, locale, plain: isClientRole })}
        rename={
          can.rename && renameTitle !== null
            ? { value: renameTitle, glow, onChange: setRenameTitle, onSave: () => void saveRename(), onCancel: closeRename }
            : null
        }
        share={
          can.share
            ? {
                title: t("documents.views.item.share_title"),
                description: can.share.removal ? t(REMOVAL_NOTE_KEYS[can.share.removal]) : t("documents.provenance.rag.in_search_when_shared"),
                checked: can.share.checked,
                disabled: Boolean(can.share.removal),
                onChange: (checked) => void patchDocument({ agentAllowed: checked })
              }
            : null
        }
        analysis={null}
        actions={actions}
        danger={
          can.remove
            ? confirm.action("remove", {
                label: t("documents.actions.delete"),
                armedLabel: t("documents.views.confirm_delete"),
                note: t("documents.confirm.delete_document"),
                run: () => void removeDocument()
              })
            : null
        }
      />
    );
  }

  function renderContent() {
    const text = documentText(record);
    const partKeys = documentPartKeys({ hasText: Boolean(text) });
    /* Üks vaade: lava ei ole, nagu pöörduja lähtefailide loendis. */
    if (partKeys.length === 1) return <div className={styles.flat}>{renderSheet()}</div>;

    const sheet = documentSheet(item, { t, locale, plain: isClientRole });
    const stepSummary = {
      sheet: [sheet.type, sheet.file].filter(Boolean).join(" · ") || sheet.title,
      text: t("documents.detail.summary.words", { count: wordCount(text) })
    };
    const steps = partKeys.map((key) => ({
      key,
      label: t(`documents.detail.views.${key}.title`),
      short: t(`documents.detail.views.${key}.short`),
      state: "done",
      summary: stepSummary[key],
      /* Tekst võib olla pikk: selle järgi ühist kõrgust ei võeta ja siis kerib kogu paneel. */
      free: key === "text"
    }));
    return (
      <StepFlight
        key={partKeys.join("|")}
        label={t("documents.detail_title")}
        steps={steps}
        parts
        texts={{
          all: t("documents.views.all"),
          position: (current, total, label) => t("documents.views.position", { current, total, label })
        }}
      >
        {(step, _index, flight) => (step.key === "text" ? <ReadView t={t} title={sheet.title} text={text} /> : renderSheet(flight?.isActive !== false))}
      </StepFlight>
    );
  }

  return (
    <section>
      <div className={styles.page} data-dock-scroll-behavior="recede" ref={pageRef} onKeyDownCapture={blockHeldPress}>
        {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
        <SubpageHeader showBack={false} headerClassName="sr-only">
          {t("documents.detail_title")}
        </SubpageHeader>
        {item ? (
          renderContent()
        ) : (
          <LoadState t={t} error={load.status === "error" ? load.error : ""} onRetry={() => void loadDocument()} back={back} />
        )}
      </div>
    </section>
  );
}
