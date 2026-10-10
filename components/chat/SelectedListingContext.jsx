"use client";

/**
 * Avatud abikuulutus: väikesed vaated, mis vahetuvad kohapeal.
 *
 * KUJU (10.10). Loendi rida avas vana lehe: oma päis tagasinoole ja nähtava
 * pealkirjaga, kast kasti sees, faktid, muutmise vorm ja ühendamise rippvalik
 * korraga ühes veerus ning kustutamise kinnitus eraldi aknas. Nüüd on korraga
 * ees üks vaade: kuulutus ise, ühendamise valik või muutmise vorm. Lehe nime
 * ütleb kiirmenüü; vaate esimene rida on kuulutuse enda pealkiri.
 *
 * SEE KOMPONENT EI LAE EGA SALVESTA MIDAGI. Kuulutus, laadimise seis, muutmise
 * olek ja kõik päringud on kasutajal (`components/alalehed/ChatBody.jsx`). Siin
 * on see, mis vaateid olekuga seob:
 *  - milline vaade on ees (ühendamise valik on selle komponendi oma olek);
 *  - vajutuste reeglid: kustutamise ja loobumise teine vajutus ei tule
 *    topeltklõpsust ega all hoitud klahvist, vaate ilmumise järel kohe tulev
 *    saatmine jäetakse vahele (lugemise vaate „Muuda" ja vormi „Salvesta"
 *    seisavad samas kohas) ja käimasoleva päringu ajal uut ei alustata;
 *  - salvestamata muudatuste hoidmine: kiirmenüü tagasinool, Esc ja akna
 *    sulgemine ei ole selle komponendi nupud, seepärast registreerib ta värava
 *    (`lib/panelLeaveGuard.js`) ja ütleb vaate kohal, miks lahkumine peatus;
 *  - fookus: vaate vahetusel kaob vajutatud nupp, fookus läheb uue vaate
 *    pealkirjale (mitte kunagi nupule).
 *
 * KUSTUTAMINE on kaks vajutust samal nupul. Aste on lehe olekus: esimene
 * vajutus on `onDeleteListing` (leht jätab küsimuse meelde, `deleteArmed`),
 * teine `onConfirmDelete`, tagasivõtmine `onCancelDelete`. Eraldi kinnitusakent
 * enam ei ole.
 *
 * KAKS KASUTUST.
 *  - `inline`: loendi paneeli sees, loendi asemel (tavaline tee).
 *  - ilma `inline`-ita: modaalina vestluse kohal, kui kuulutus on valitud
 *    väljaspool loendit. Kiirmenüü on modaali taga kättesaamatu, seega
 *    vahetuvad vaated ka seal kohapeal.
 *
 * Vaated: ./SelectedListingViews.jsx. Read ja reeglid: ./selectedListingSheet.js.
 * Kujundus: ./selectedListing.module.css.
 */

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Modal from "@/components/ui/Modal";
import { panelLeaveAllowed, setPanelLeaveGuard, twoPressLeaveGuard } from "@/lib/panelLeaveGuard";

import list from "./helpListings.module.css";
import { getHelpUiText } from "./helpUiText";
import styles from "./selectedListing.module.css";
import {
  CONFIRM_MS,
  connectChoice,
  editProblem,
  editSnapshot,
  editValues,
  listingNotice,
  listingSheet,
  listingViewKey,
  pressTooSoon,
  saveEditPayload
} from "./selectedListingSheet";
import { ConnectView, EditView, LoadingView, MissingView, ReadView } from "./SelectedListingViews";

/* Lähim kerija (klaaspaneeli sisu): uus vaade algab ülevalt. */
function scrollerOf(start) {
  let node = start?.parentElement || null;
  while (node && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export default function SelectedListingContext({
  locale: _locale = "et",
  inline = false,
  loading = false,
  error = "",
  listing = null,
  isOwn = false,
  canDelete = false,
  editState = null,
  connectOptions = [],
  connectOptionsFailed = false,
  selectedConnectListingId = "",
  busyAction = "",
  deleteArmed = false,
  onSelectConnectListing,
  onConnect,
  onStartEdit,
  onChangeEditField,
  onCancelEdit,
  onSaveEdit,
  onDeleteListing,
  onConfirmDelete,
  onCancelDelete,
  onDismiss
}) {
  const { t } = useI18n();
  const ui = getHelpUiText(t);
  const rootRef = useRef(null);
  /* Ühendamise valik on ees ainult siis, kui inimene selle avas. */
  const [connectOpen, setConnectOpen] = useState(false);
  const [editPart, setEditPart] = useState("text");
  /* Vormi sisu sel hetkel, kui muutmine algas: selle järgi on teada, kas midagi on muudetud. */
  const [baseline, setBaseline] = useState("");
  const [discardArmed, setDiscardArmed] = useState(false);
  const [problemKey, setProblemKey] = useState("");
  const [leaveAsked, setLeaveAsked] = useState(false);

  const view = listingViewKey({ loading, listing, error, editState, isOwn, connectOpen });
  const editing = Boolean(editState);
  const values = editValues(listing, editState);
  const snapshot = editing ? editSnapshot(values) : "";
  const dirty = editing && baseline !== "" && snapshot !== baseline;
  const listingKey = listing ? `${listing.kind}:${listing.id}` : "";

  const viewRef = useRef(view);
  viewRef.current = view;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  /* Millal ees olev vaade ilmus ja millal kustutamine või loobumine teist vajutust küsima hakkas. */
  const shownAt = useRef(0);
  const deleteAskedAt = useRef(0);
  const discardAskedAt = useRef(0);
  /* Teade kuulub selle vaate juurde, kus tegevus tehti: kustutamise tõrge ei
     käi kaasa muutmise vormi ja salvestamise tõrge ei jää lugemise vaatesse. */
  const [errorView, setErrorView] = useState(view);
  useEffect(() => {
    setErrorView(viewRef.current);
  }, [error]);

  /* Teine kuulutus: ühendamise valik ei jää eelmisest lahti. */
  useEffect(() => {
    setConnectOpen(false);
  }, [listingKey]);

  /* Muutmine algas või lõppes: vorm algab esimesest osast ja võrdlus algseisuga algab uuesti. */
  useEffect(() => {
    setEditPart("text");
    setDiscardArmed(false);
    setProblemKey("");
    setBaseline(editing ? snapshotRef.current : "");
  }, [editing]);

  /* Vaate vahetusel kaob nupp, mida vajutati (loendi rida, „Muuda", „Loobu"),
     ja klaviatuuri fookus koos sellega: fookus läheb uue vaate pealkirjale.
     Nupule fookust ei viida: all hoitud Enter vajutaks seda kohe. Uus vaade
     algab ülevalt; paneeli keritakse ainult tagasi, mitte kunagi edasi. */
  const shownView = useRef("");
  useEffect(() => {
    if (!view || shownView.current === view) return;
    shownView.current = view;
    shownAt.current = Date.now();
    const node = rootRef.current;
    if (!node) return;
    node.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
    const scroller = scrollerOf(node);
    if (!scroller) return;
    const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (scroller.scrollTop > top) scroller.scrollTop = Math.max(0, top);
  }, [view]);

  /* Kustutamise küsimus aegub ja kaob, kui lugemise vaade ei ole enam ees:
     hiljem tagasi tulles ei tohi üks vajutus kuulutust kustutada. */
  useEffect(() => {
    if (!deleteArmed) return undefined;
    if (view !== "read") {
      onCancelDelete?.();
      return undefined;
    }
    const timer = window.setTimeout(() => onCancelDelete?.(), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [deleteArmed, onCancelDelete, view]);

  useEffect(() => {
    if (!discardArmed) return undefined;
    const timer = window.setTimeout(() => setDiscardArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [discardArmed]);

  /* Salvestamata muudatused. Kiirmenüü tagasinool, Esc ja paneeli sulgemine ei
     ole selle komponendi nupud: esimene lahkumine jääb kinni ja vaate kohal
     seisab põhjus, teine lahkub. Akna sulgemise ja uuesti laadimise peab kinni
     brauseri enda küsimus. */
  useEffect(() => {
    if (!dirty) return undefined;
    const leave = twoPressLeaveGuard({
      onAsk: () => setLeaveAsked(true),
      onClear: () => setLeaveAsked(false)
    });
    const release = setPanelLeaveGuard(leave);
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      release();
      leave.clear();
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  /* Modaalina: teised lehed loevad märki `modal-open` (nt koostamisruumi Esc). */
  const modalShown = !inline && Boolean(view);
  useEffect(() => {
    if (!modalShown) return undefined;
    const root = document.documentElement;
    document.body.classList.add("modal-open");
    root.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
      root.classList.remove("modal-open");
    };
  }, [modalShown]);

  if (!view) return null;

  const notice = listingNotice(errorView === view || error === ui.connectPending ? error : "", ui);

  /* Modaali sulgevad ka Esc ja vajutus kihile: need küsivad sama väravat. */
  const closeModal = () => {
    if (!panelLeaveAllowed("close")) return;
    onDismiss?.();
  };
  /* Loendi rea topeltklõpsu teine vajutus võib maanduda äsja ilmunud vaate
     tagasiteele: kohe pärast vaate ilmumist tulev vajutus jäetakse vahele. */
  const leaveView = () => {
    if (pressTooSoon(shownAt.current)) return;
    if (inline) onDismiss?.();
    else closeModal();
  };
  const back = { label: inline ? t("chat.help.opened.backToList") : ui.close, onClick: leaveView };

  const pressDelete = () => {
    if (busyAction) return;
    if (!deleteArmed) {
      deleteAskedAt.current = Date.now();
      onDeleteListing?.();
      return;
    }
    /* Topeltklõpsu teine vajutus ei kustuta. */
    if (pressTooSoon(deleteAskedAt.current)) return;
    onConfirmDelete?.();
  };

  const submitConnect = () => {
    /* Lugemise vaate nupp ja see nupp kannavad sama nime ja seisavad samas
       kohas: topeltklõps ei saada päringut teisele inimesele. */
    if (busyAction || pressTooSoon(shownAt.current)) return;
    onConnect?.();
  };

  const changeField = (field, value) => {
    if (problemKey) setProblemKey("");
    if (discardArmed) setDiscardArmed(false);
    onChangeEditField?.(field, value);
  };

  const submitEdit = (event) => {
    event?.preventDefault?.();
    if (busyAction || pressTooSoon(shownAt.current)) return;
    const problem = editProblem(values);
    setProblemKey(problem);
    if (problem) {
      /* Puudu on kirjeldus: see väli on esimeses osas, lause üksi teises osas ei aitaks. */
      setEditPart("text");
      return;
    }
    setDiscardArmed(false);
    onSaveEdit?.(saveEditPayload(editState, values));
  };

  /* Loobumine viskab muudatused ära: muudetud vormil küsib see teist vajutust. */
  const cancelEdit = () => {
    if (dirty && !discardArmed) {
      discardAskedAt.current = Date.now();
      setDiscardArmed(true);
      return;
    }
    if (dirty && pressTooSoon(discardAskedAt.current)) return;
    setDiscardArmed(false);
    onCancelEdit?.();
  };

  let body;
  if (view === "loading") {
    body = <LoadingView t={t} ui={ui} back={back} />;
  } else if (view === "missing") {
    body = <MissingView t={t} error={error} back={back} />;
  } else {
    const sheet = listingSheet(listing, { t, ui, isOwn });
    if (view === "edit") {
      body = (
        <EditView
          t={t}
          ui={ui}
          form={{
            part: editPart,
            onPart: setEditPart,
            values,
            onField: changeField,
            notice: problemKey ? { text: t(problemKey), tone: "risk" } : notice,
            busy: busyAction === "save",
            discardArmed,
            onCancel: cancelEdit,
            onSubmit: submitEdit
          }}
        />
      );
    } else if (view === "connect") {
      body = (
        <ConnectView
          t={t}
          ui={ui}
          sheet={sheet}
          choice={connectChoice({ listing, options: connectOptions, selectedId: selectedConnectListingId, failed: connectOptionsFailed, t })}
          notice={notice}
          busy={busyAction === "connect"}
          back={{ label: t("chat.help.opened.backToListing"), onClick: () => setConnectOpen(false) }}
          onSelect={(value) => onSelectConnectListing?.(value)}
          onSubmit={submitConnect}
        />
      );
    } else {
      body = (
        <ReadView
          t={t}
          ui={ui}
          sheet={sheet}
          notice={notice}
          back={back}
          onEdit={isOwn ? () => onStartEdit?.() : null}
          onConnect={isOwn ? null : () => setConnectOpen(true)}
          /* Kustutada saab oma kuulutust; administraator ka võõrast (`canDelete`). */
          remove={
            isOwn || canDelete
              ? { armed: deleteArmed, busy: busyAction === "delete", onPress: pressDelete, onCancel: () => onCancelDelete?.() }
              : null
          }
        />
      );
    }
  }

  const content = (
    <div className={styles.swap} ref={rootRef}>
      {leaveAsked ? (
        <p className={list.notice} role="alert">
          {t("chat.help.opened.leaveAsked")}
        </p>
      ) : null}
      {body}
    </div>
  );

  if (inline) return content;

  return (
    <Modal
      open
      onClose={closeModal}
      closeOnOverlayClick
      aria-label={listing?.title || t("chat.help.opened.views.read.title")}
      className={styles.overlay}
      contentClassName={styles.card}
    >
      {content}
    </Modal>
  );
}
