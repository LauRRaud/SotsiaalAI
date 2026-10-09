"use client";

/**
 * Kutsu osaleja: kutse koostööruumi ja selle ruumi saadetud kutsed.
 *
 * KUJU (09.10). Leht oli üks kuue väljaga vorm, mis oli venitatud paneeli
 * laiuseks nähtava pealkirja all, ja selle all kutsete tabel: 674 px sisu
 * 496 px kerivas kastis. Nüüd on kutse väikesed vaated: ruum ja kutsuja nimi
 * (ainult uue ruumi puhul), keda kutsutakse, e-posti aadress, tasumine ja
 * saatmine ning saadetud kutsed. Vaated on failis ./views/InviteViews.jsx,
 * reeglid failis ./views/inviteRows.js; siin on andmed, päringud ja see, mis
 * vaateid olekuga seob.
 *
 * KAKS KASUTUST, SAMAD VAATED.
 *  - Töölaua sees (`embedded`): vaated on sammulaval (`components/stage`); samm
 *    ja nool edasi on all kiirmenüüs ning lehe nime paneelil ei korrata.
 *  - Modaalina (ruumide leht; sponsormakse tagasitulek vestluses): kiirmenüü
 *    jääb modaali taha ja on sel ajal kättesaamatu, seepärast vahetatakse
 *    vaateid modaali enda ülaservas olevast lahtrite reast.
 *
 * KUTSE ON PÄRIS E-KIRI ja „Tasun tema eest" viib makseni. Päringud ja nende
 * kehad on samad mis vanal vormil. Muutunud on see, kust neid käivitatakse:
 * saatmine käib ainult saatmise vaate nupust (Enter väljal viib järgmise vaate
 * juurde, mitte ei saada kutset), valik „Tasun tema eest" küsib teist vajutust
 * ja kutse tühistamine samuti.
 *
 * KUI MIDAGI ON PUUDU, viib saatmise nupp selle vaate juurde, kus puudus on,
 * ja ütleb seal, mis see on (`inviteProblem`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { BackArrowIcon } from "@/components/brand/icons/CardIcons";
import IconButton from "@/components/glass/IconButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChoiceRow from "@/components/stage/ChoiceRow";
import StepFlight from "@/components/stage/StepFlight";
import Button from "@/components/ui/Button";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import Modal from "@/components/ui/Modal";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { inviteRelationshipTypesForInviter, sponsoredRolesForInviteRelationship } from "@/lib/invites/participantTypes";
import { localizePath } from "@/lib/localizePath";
import { getPublicSponsoredInviteAmount } from "@/lib/subscriptionPlans";

import { EmailsView, InviteNotice, RoomView, SendView, SentView, SignedOutView, WhoView } from "./views/InviteViews";
import {
  PAYMENT_HOST,
  PAYMENT_SELF,
  effectiveChoice,
  inviteErrorView,
  inviteProblem,
  inviteRows,
  inviteViewKeys,
  inviteViewStates,
  parseEmails,
  relationshipLabelKey,
  sentenceCase,
  sponsorProblem,
  sponsoredRoleOptions
} from "./views/inviteRows";
import styles from "./views/invite.module.css";

const sponsoredCheckoutDisabled = ["false", "0", "off"].includes(
  String(process.env.NEXT_PUBLIC_SPONSORED_INVITE_CHECKOUT_OPEN || "false")
    .trim()
    .toLowerCase(),
);

export default function InviteModal({ embedded = false, onBack = null, hideHeader = false } = {}) {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(embedded);
  const [openSource, setOpenSource] = useState(embedded ? "workspace" : "");
  const [roomId, setRoomId] = useState(null);
  const [roomTitle, setRoomTitle] = useState("");
  const [hostDisplayName, setHostDisplayName] = useState("");
  const [emails, setEmails] = useState("");
  const [paymentMode, setPaymentMode] = useState(PAYMENT_SELF);
  const [busy, setBusy] = useState(false);
  /* Saatmise tulemus seisab vaadete kohal kuni järgmise saatmiseni; viga
     kuulub ühe vaate juurde ja seisab selle vaate all servas. */
  const [notice, setNotice] = useState(null);
  const [problem, setProblem] = useState(null);
  const [relationshipType, setRelationshipType] = useState("");
  const [targetRole, setTargetRole] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  /* Loendi laadimise viga: vana leht jättis ebaõnnestunud laadimise järel
     lihtsalt tühja loendi, nagu kutseid ei olekski. */
  const [listError, setListError] = useState("");
  const [sponsoredCheckoutAgreed, setSponsoredCheckoutAgreed] = useState(false);
  // Makse-tagasituleku olek (invitePayment URL-parameeter). Kui seatud, näitab
  // modal PUHAST staatuskaarti (mitte kutse-loomise vormi) — vt handleClose.
  const [paymentReturn, setPaymentReturn] = useState(null);
  /* Milline vaade on ees. Tühi tähendab esimest vaadet. */
  const [view, setView] = useState("");
  /* Kutse, mille uuesti saatmine või tühistamine parajasti käib. */
  const [actionId, setActionId] = useState("");
  const sentListRef = useRef(null);
  const rootRef = useRef(null);

  const sponsoredSelected = paymentMode === PAYMENT_HOST;
  const isWorkspaceReturn = embedded || openSource === "workspace";
  const inviteHeaderTitle = t("invite.eyebrow");
  const allowedRelationshipTypes = useMemo(
    () => inviteRelationshipTypesForInviter(session?.user?.role),
    [session?.user?.role],
  );
  const effectiveRelationshipType = effectiveChoice(allowedRelationshipTypes, relationshipType);
  // Hind sõltub sellest, keda kutsud: sponsorkutse = üks kuu KUTSUTU rolli
  // ligipääsu, seega kannab iga valik oma rolli kuutellimuse summat.
  const roleOptions = useMemo(
    () => sponsoredRoleOptions(effectiveRelationshipType, { t, locale, amountOf: getPublicSponsoredInviteAmount }),
    [effectiveRelationshipType, locale, t],
  );
  const effectiveTargetRole = effectiveChoice(roleOptions.map((option) => option.value), targetRole) || null;
  const inviteCheckoutAgreementReplacements = useMemo(
    () => ({
      terms: {
        open: `<a href="${localizePath("/kasutustingimused", locale)}">`,
        close: "</a>",
      },
      privacy: {
        open: `<a href="${localizePath("/privaatsustingimused", locale)}">`,
        close: "</a>",
      },
    }),
    [locale],
  );
  const viewKeys = useMemo(() => inviteViewKeys({ hasRoom: Boolean(roomId) }), [roomId]);
  const activeView = viewKeys.includes(view) ? view : viewKeys[0];

  useEffect(() => {
    if (embedded) return undefined;
    const handler = (e) => {
      setRoomId(e?.detail?.roomId || null);
      setOpenSource(String(e?.detail?.source || "").trim().toLowerCase());
      /* Modaal avaneb esimesel vaatel ja ilma eelmise korra teadeteta. */
      setView("");
      setNotice(null);
      setProblem(null);
      setOpen(true);
    };
    window.addEventListener("sotsiaalai:open-invite", handler);
    return () => window.removeEventListener("sotsiaalai:open-invite", handler);
  }, [embedded]);
  useEffect(() => {
    if (embedded) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const invitePayment = String(params.get("invitePayment") || "")
      .trim()
      .toLowerCase();
    if (!invitePayment) return;
    // URL kirjeldab ainult provideri tagasisuunamist, mitte serveris kinnitatud
    // makseolekut. Tundmatut väärtust ei tohi usaldusväärse staatusena näidata.
    if (!["success", "pending", "canceled", "failed"].includes(invitePayment)) return;
    setOpen(true);
    setOpenSource("");
    setRoomId(params.get("roomId") || null);
    setPaymentReturn({
      state: invitePayment,
      inviteId: String(params.get("inviteId") || "").trim(),
    });
  }, [embedded]);
  useEffect(() => {
    if (open && !roomId) {
      setRoomTitle("");
      setHostDisplayName("");
    }
  }, [open, roomId]);
  useEffect(() => {
    if (paymentMode !== PAYMENT_HOST) {
      setTargetRole(null);
      setSponsoredCheckoutAgreed(false);
    }
  }, [paymentMode]);
  useEffect(() => {
    if (embedded) return undefined;
    const root = document.documentElement;
    document.body.classList.toggle("modal-open", open);
    root.classList.toggle("modal-open", open);
    document.body.classList.toggle("invite-modal-open", open);
    root.classList.toggle("invite-modal-open", open);
    return () => {
      document.body.classList.remove("modal-open");
      root.classList.remove("modal-open");
      document.body.classList.remove("invite-modal-open");
      root.classList.remove("invite-modal-open");
    };
  }, [embedded, open]);
  const handleClose = useCallback(() => {
    if (embedded) {
      onBack?.();
      return;
    }
    setOpen(false);
    setOpenSource("");
    if (isWorkspaceReturn && typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("sotsiaalai:restore-workspace-from-modal", {
          detail: { source: "invite" }
        }));
      } catch {}
    }
  }, [embedded, isWorkspaceReturn, onBack]);
  // "Tagasi vestlusesse": sulge staatuskaart ja koristada URL-ist makse-
  // parameetrid (muidu reload avaks kaardi uuesti). roomId JÄÄB alles, et
  // vestlus püsiks sponsoreeritud ruumis.
  const dismissPaymentReturn = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("invitePayment");
        url.searchParams.delete("inviteId");
        url.searchParams.delete("ref");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      } catch {}
    }
    setPaymentReturn(null);
    setOpen(false);
    setOpenSource("");
  }, []);
  const loadInvites = useCallback(async () => {
    if (!roomId) {
      setInvites([]);
      setLoadingList(false);
      setListError("");
      return;
    }
    setLoadingList(true);
    try {
      const url = new URL("/api/invites", window.location.origin);
      if (roomId) url.searchParams.set("room_id", roomId);
      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.invites) {
        setInvites(data.invites);
        setListError("");
      } else if (!res.ok) {
        setListError(resolveApiMessage({ payload: data, t, fallbackKey: "invite.error_generic" }));
      }
    } catch (err) {
      console.error("invite list", err);
      setListError(t("invite.error_generic"));
    } finally {
      setLoadingList(false);
    }
  }, [roomId, t]);
  useEffect(() => {
    if (open) loadInvites();
  }, [open, roomId, loadInvites]);
  const emailsParsed = useMemo(() => parseEmails(emails), [emails]);

  /* Viga kuulub vaate juurde: leht viib inimese sinna, kus seda parandada saab. */
  const showProblem = useCallback((text, viewKey) => {
    setProblem({ text, view: viewKey });
    setView(viewKey);
  }, []);
  /* Kui inimene hakkab vaates midagi muutma, ei jää selle vaate vana viga ette. */
  const clearProblem = useCallback((viewKey) => {
    setProblem((current) => (current?.view === viewKey ? null : current));
  }, []);

  /* Siia jõuab alles teine vajutus nupul „Tasun tema eest" (vt `SendView`). */
  const startSponsoredFlow = useCallback(() => {
    setProblem(null);
    const blocked = sponsorProblem({ relationshipType: effectiveRelationshipType, emails: emailsParsed });
    if (blocked) {
      showProblem(t(blocked.key), blocked.view);
      return;
    }
    const roles = sponsoredRolesForInviteRelationship(effectiveRelationshipType);
    setTargetRole(roles.length === 1 ? roles[0] : null);
    setSponsoredCheckoutAgreed(false);
    setPaymentMode(PAYMENT_HOST);
  }, [effectiveRelationshipType, emailsParsed, showProblem, t]);

  async function submit() {
    if (busy) return;
    setProblem(null);
    setNotice(null);
    const parsed = emailsParsed;
    const missing = inviteProblem({
      hasRoom: Boolean(roomId),
      relationshipType: effectiveRelationshipType,
      emails: parsed,
      roomTitle,
      hostName: hostDisplayName,
      paymentMode,
      targetRole: effectiveTargetRole,
      checkoutClosed: sponsoredCheckoutDisabled,
      agreed: sponsoredCheckoutAgreed
    });
    if (missing) {
      showProblem(t(missing.key), missing.view);
      return;
    }
    const trimmedRoomTitle = roomTitle.trim();
    const trimmedHostName = hostDisplayName.trim();
    /* Serveri keeldumine läheb selle vaate juurde, mille asi see on. */
    const refusal = (payload) => {
      const error = new Error(resolveApiMessage({ payload, t, fallbackKey: "invite.send_failed" }));
      error.view = inviteErrorView(payload?.messageKey, viewKeys);
      return error;
    };
    setBusy(true);
    try {
      if (paymentMode === PAYMENT_HOST) {
        const res = await fetch("/api/invites/sponsored/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emails: parsed,
            lang: locale,
            payment_mode: paymentMode,
            room_id: roomId || undefined,
            room_title: trimmedRoomTitle || undefined,
            host_display_name: !roomId
              ? trimmedHostName || undefined
              : undefined,
            relationship_type: effectiveRelationshipType,
            targetRole: effectiveTargetRole,
            acceptedTerms: sponsoredCheckoutAgreed,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) throw refusal(data);
        const checkoutUrl =
          typeof data?.checkoutUrl === "string" ? data.checkoutUrl.trim() : "";
        if (!checkoutUrl) {
          throw new Error(t("subscription.error.payment_start"));
        }
        if (!roomId && data?.roomId) {
          setRoomId(data.roomId);
        }
        setNotice({ text: t("subscription.payment.redirect_demo") });
        if (typeof window !== "undefined") {
          window.location.assign(checkoutUrl);
        }
        return;
      }

      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: parsed,
          lang: locale,
          payment_mode: paymentMode || undefined,
          room_id: roomId || undefined,
          room_title: trimmedRoomTitle || undefined,
          host_display_name: !roomId ? trimmedHostName || undefined : undefined,
          relationship_type: effectiveRelationshipType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) throw refusal(data);
      /* SOL-INV-03: „Kutsed saadetud" oli varem tingimusteta. Kui mõni kiri ei
         jõudnud välja, peab saatja seda NÄGEMA — muidu ootab ta vastust
         inimeselt, kes ei saanud kunagi linki. */
      const undelivered = (data?.invites || []).filter(
        (inv) => inv.emailDelivery && inv.emailDelivery !== "sent",
      );
      if (undelivered.length) {
        setNotice({
          tone: "wait",
          text: t("invite.success_delivery_pending", {
            emails: undelivered.map((inv) => inv.inviteeEmail).join(", "),
          }),
        });
      } else {
        setNotice({ tone: "ok", text: t("invite.success") });
      }
      setEmails("");
      if (!roomId && data?.roomId) {
        setRoomId(data.roomId);
      }
      loadInvites();
      /* Saadetud kutse on kohe näha: leht läheb kutsete vaatesse. */
      setView("sent");
    } catch (err) {
      showProblem(err?.message || t("invite.send_failed"), err?.view || "send");
    } finally {
      setBusy(false);
    }
  }
  async function action(id, kind) {
    if (actionId) return;
    setActionId(id);
    setProblem(null);
    setNotice(null);
    try {
      const url =
        kind === "resend"
          ? `/api/invites/${id}/resend`
          : `/api/invites/${id}/revoke`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(
          resolveApiMessage({
            payload: data,
            t,
            fallbackKey: "invite.error_generic",
          }),
        );
      }
      // SOL-INV-03: kordussaatmine ütleb samuti tulemuse, mitte kavatsuse.
      if (kind === "resend") {
        const pending = data?.emailDelivery && data.emailDelivery !== "sent";
        setNotice({
          tone: pending ? "wait" : "ok",
          text: pending ? t("invite.resend_delivery_pending") : t("invite.resend_sent"),
        });
      } else {
        setNotice({ text: t("invite.revoked") });
      }
      await loadInvites();
      /* Tühistatud kutse real nuppe enam ei ole: fookus läheb loendile, mitte
         järgmise rea tühistamise nupule. */
      if (kind !== "resend") sentListRef.current?.focus({ preventScroll: true });
    } catch (err) {
      setProblem({ text: err?.message || t("invite.action_failed"), view: "sent" });
    } finally {
      setActionId("");
    }
  }
  /* Fookus ei tohi kaduda koos nupuga, mida vajutati. Modaalis vahetab vaadet
     ka Enter väljal, puuduv väli ja saatmine: fookus läheb siis uue vaate
     pealkirjale (lüliti enda vajutusel jääb lülitile). Maksja valik vahetab
     saatmise vaate nupud välja: fookus läheb sama vaate pealkirjale. */
  const focusHeading = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const scope = root.querySelector('section[data-active="1"]') || root;
    scope.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, []);
  const shownViewRef = useRef("");
  useEffect(() => {
    const before = shownViewRef.current;
    shownViewRef.current = activeView;
    if (embedded || !before || before === activeView) return;
    if (rootRef.current?.querySelector("[data-view-switch]")?.contains(document.activeElement)) return;
    focusHeading();
  }, [activeView, embedded, focusHeading]);
  const payerRef = useRef(sponsoredSelected);
  useEffect(() => {
    if (payerRef.current === sponsoredSelected) return;
    payerRef.current = sponsoredSelected;
    focusHeading();
  }, [sponsoredSelected, focusHeading]);

  if (!open) return null;
  // Makse-tagasitulek: PUHAS staatuskaart (mitte kutse-loomise vorm), et
  // vältida "vorm üle vestluse" segadust. URL-ist tulev pending tähendab
  // ainult seda, et serveri kinnitus on veel ootel; see ei tõenda makset.
  if (!embedded && paymentReturn) {
    const positive =
      paymentReturn.state === "success" || paymentReturn.state === "pending";
    const paymentInviteEmail = paymentReturn.inviteId
      ? invites.find((inv) => String(inv.id) === paymentReturn.inviteId)?.inviteeEmail || ""
      : "";
    let statusMessage;
    if (paymentReturn.state === "pending") {
      statusMessage = paymentInviteEmail
        ? t("invite.sponsored.payment_pending", { email: paymentInviteEmail })
        : t("invite.sponsored.payment_pending_no_email");
    } else if (paymentReturn.state === "success") {
      statusMessage = t("invite.sponsored.payment_success");
    } else if (paymentReturn.state === "canceled") {
      statusMessage = t("invite.sponsored.payment_canceled");
    } else {
      statusMessage = t("invite.sponsored.payment_failed");
    }
    const statusTitle = t("invite.sponsored.payment_status_title");
    return (
      <Modal
        open={open}
        onClose={dismissPaymentReturn}
        aria-label={statusTitle}
        className="invite-modal-overlay"
        contentClassName="invite-modal-card invite-payment-status"
      >
        <div className="invite-payment-status-body" data-state={paymentReturn.state}>
          <h2 className="invite-payment-status-title">{statusTitle}</h2>
          <p
            role={positive ? undefined : "alert"}
            aria-live={positive ? "polite" : undefined}
            className={`invite-payment-status-msg${positive ? "" : " invite-payment-status-msg--error"}`}
          >
            {statusMessage}
          </p>
          <Button type="button" variant="primary" onClick={dismissPaymentReturn}>
            {t("invite.sponsored.payment_back_to_chat")}
          </Button>
        </div>
      </Modal>
    );
  }

  const signedIn = Boolean(session?.user?.id);
  const relationshipOptions = allowedRelationshipTypes.map((type) => ({ value: type, label: t(relationshipLabelKey(type)) }));
  const goAfter = (key) => {
    const next = viewKeys[viewKeys.indexOf(key) + 1];
    if (next) setView(next);
  };
  const errorOf = (key) => (problem?.view === key ? problem.text : "");
  const missingText = t("invite.views.send.missing");
  const facts = [
    {
      key: "who",
      label: t("invite.views.send.fact_who"),
      value: effectiveRelationshipType ? t(relationshipLabelKey(effectiveRelationshipType)) : missingText,
      missing: !effectiveRelationshipType
    },
    {
      key: "emails",
      label: t("invite.views.send.fact_emails"),
      value: emailsParsed.length ? emailsParsed.join(", ") : missingText,
      missing: !emailsParsed.length
    },
    ...(roomId
      ? []
      : [
          {
            key: "room",
            label: t("invite.views.send.fact_room"),
            value: roomTitle.trim() || missingText,
            missing: !roomTitle.trim()
          }
        ]),
    {
      key: "payer",
      label: t("invite.views.send.fact_payer"),
      value: t(sponsoredSelected ? "invite.payer.host" : "invite.payer.self"),
      missing: false
    }
  ];
  const states = inviteViewStates({
    roomTitle,
    hostName: hostDisplayName,
    relationshipType: effectiveRelationshipType,
    emails: emailsParsed,
    inviteCount: invites.length
  });
  const summaries = {
    room: roomTitle.trim(),
    who: effectiveRelationshipType ? t(relationshipLabelKey(effectiveRelationshipType)) : "",
    emails: emailsParsed.join(", "),
    send: t(sponsoredSelected ? "invite.payer.host" : "invite.payer.self")
  };
  const steps = viewKeys.map((key) => ({
    key,
    label: t(`invite.views.${key}.title`),
    short: t(`invite.views.${key}.short`),
    state: states[key],
    summary: summaries[key] || undefined,
    /* Kutsete loend võib olla pikk: selle järgi teiste vaadete kõrgust ei võeta. */
    free: key === "sent"
  }));

  /* `flight` on olemas ainult sammulaval. Seal on kõik vaated korraga
     monteeritud, seepärast kannab põhinupu läiget ainult ees olev vaade. */
  const renderView = (key, flight = null) => {
    const glow = flight ? flight.isActive !== false : true;
    switch (key) {
      case "room":
        return (
          <RoomView
            t={t}
            roomTitle={roomTitle}
            onRoomTitle={(value) => {
              clearProblem("room");
              setRoomTitle(value);
            }}
            hostName={hostDisplayName}
            onHostName={(value) => {
              clearProblem("room");
              setHostDisplayName(value);
            }}
            error={errorOf("room")}
            onEnter={() => goAfter("room")}
          />
        );
      case "who":
        return (
          <WhoView
            t={t}
            options={relationshipOptions}
            value={effectiveRelationshipType}
            onChange={(value) => {
              clearProblem("who");
              setRelationshipType(value);
              setTargetRole(null);
            }}
            error={errorOf("who")}
          />
        );
      case "emails":
        return (
          <EmailsView
            t={t}
            value={emails}
            onChange={(value) => {
              clearProblem("emails");
              setEmails(value);
            }}
            error={errorOf("emails")}
            onEnter={() => goAfter("emails")}
          />
        );
      case "sent":
        return (
          <SentView
            t={t}
            listRef={sentListRef}
            loading={loadingList}
            emptyText={t(roomId ? "invite.empty" : "invite.views.sent.empty_no_room")}
            error={errorOf("sent") || listError}
            onRefresh={loadInvites}
            rows={inviteRows(invites, { t }).map((row) => ({
              ...row,
              busy: Boolean(actionId),
              onResend: () => action(row.id, "resend"),
              onRevoke: () => action(row.id, "revoke")
            }))}
          />
        );
      default:
        return (
          <SendView
            t={t}
            facts={facts}
            error={errorOf("send")}
            pay={{
              host: sponsoredSelected,
              closed: sponsoredCheckoutDisabled,
              closedText: t("invite.error.checkout_temporarily_disabled"),
              busy,
              onChoose: startSponsoredFlow,
              roles:
                roleOptions.length > 1
                  ? {
                      options: roleOptions,
                      value: effectiveTargetRole,
                      onChange: (value) => {
                        clearProblem("send");
                        setTargetRole(value);
                      }
                    }
                  : null,
              roleLine: roleOptions.length === 1 ? t("invite.views.send.role_single", { role: roleOptions[0].label }) : "",
              agreed: sponsoredCheckoutAgreed,
              onAgree: (next) => {
                clearProblem("send");
                setSponsoredCheckoutAgreed(next);
              },
              agreementLinks: inviteCheckoutAgreementReplacements
            }}
            actions={
              sponsoredSelected ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setProblem(null);
                      setPaymentMode(PAYMENT_SELF);
                    }}
                  >
                    {t("invite.pay.back_to_self")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    glow={glow}
                    disabled={sponsoredCheckoutDisabled || busy || !effectiveTargetRole || !sponsoredCheckoutAgreed}
                    onClick={submit}
                  >
                    {busy ? t("invite.sending") : t("invite.sponsored.confirm_and_pay")}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="primary" glow={glow} disabled={busy} onClick={submit}>
                  {busy ? t("invite.sending") : sentenceCase(t("invite.send"), locale)}
                </Button>
              )
            }
          />
        );
    }
  };

  const header = !hideHeader ? (
    <>
      {/* Modaalis (portaal, väljaspool paneeli) on see ainus tagasitee —
          legacy BackButton asemel klaasikeele ikoonnupp brand-noolega. */}
      <IconButton
        aria-label={t("buttons.back")}
        layoutClassName="invite-modal-back"
        onClick={handleClose}
      >
        <BackArrowIcon />
      </IconButton>
      <SubpageHeader
        showBack={false}
        titleAs="h2"
        /* Töölaua sees on lehe nimi kiirmenüüs: pealkiri jääb ekraanilugejale.
           Modaalis kiirmenüüd ei ole ja pealkiri ütleb, mis aken lahti on. */
        headerClassName={embedded ? "sr-only" : undefined}
        rightSlot={
          <DashboardInfoTrigger
            infoId="invites"
            title={inviteHeaderTitle}
          />
        }
      >
        {inviteHeaderTitle}
      </SubpageHeader>
    </>
  ) : null;

  if (embedded) {
    return (
      <>
        {/* Päis seisab lehe ümbrisest väljas: ümbris on konteiner ja võtaks
            päise ⓘ-nupu paigutuse enda külge. */}
        {header}
        <div className={styles.page} ref={rootRef}>
          {signedIn ? (
            <>
              <InviteNotice notice={notice} />
              {/* Vaadete loend muutub, kui ruum on loodud (ruumi vaadet enam ei
                  ole): siis ehitatakse lava uuesti ja see avaneb vaatel, kuhu
                  inimene läks. */}
              <StepFlight
                key={viewKeys.join("|")}
                label={inviteHeaderTitle}
                steps={steps}
                initialIndex={Math.max(0, viewKeys.indexOf(activeView))}
                activeKey={activeView}
                onStepChange={(index, step) => {
                  if (step) setView(step.key);
                }}
              >
                {(step, index, flight) => renderView(step.key, flight)}
              </StepFlight>
            </>
          ) : (
            <SignedOutView t={t} title={inviteHeaderTitle} />
          )}
        </div>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-label={inviteHeaderTitle}
      className="invite-modal-overlay"
      contentClassName="invite-modal-card"
    >
      {header}
      <div className={styles.dialog} ref={rootRef}>
        {signedIn ? (
          <>
            <InviteNotice notice={notice} />
            {/* Modaali ajal on kiirmenüü kättesaamatu: vaateid vahetab see rida. */}
            <div data-view-switch>
              <ChoiceRow
                label={t("invite.views.switch_label")}
                labelHidden
                columns={viewKeys.length}
                options={viewKeys.map((key) => ({ value: key, label: t(`invite.views.${key}.short`) }))}
                value={activeView}
                onChange={setView}
              />
            </div>
            <div className={styles.dialogView}>{renderView(activeView)}</div>
          </>
        ) : (
          <SignedOutView t={t} title={inviteHeaderTitle} />
        )}
      </div>
    </Modal>
  );
}
