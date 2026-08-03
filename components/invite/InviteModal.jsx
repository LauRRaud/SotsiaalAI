"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import RichText from "@/components/i18n/RichText";
import { BackArrowIcon } from "@/components/brand/icons/CardIcons";
import IconButton from "@/components/glass/IconButton";
import Button from "@/components/ui/Button";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import Checkbox from "@/components/ui/Checkbox";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import OptionCard from "@/components/ui/OptionCard";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import {
  INVITE_RELATIONSHIP_CLIENT,
  inviteRelationshipTypesForInviter,
  sponsoredRolesForInviteRelationship,
} from "@/lib/invites/participantTypes";
import { getPublicSponsoredInviteAmount } from "@/lib/subscriptionPlans";
import { localizePath } from "@/lib/localizePath";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

function parseEmails(raw) {
  if (!raw) return [];
  const list = String(raw)
    .split(/[,;\n\r]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}
function formatEuroAmount(amount, locale = "et") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} EUR`;
  }
}

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
  const [paymentMode, setPaymentMode] = useState("SELF_PAID");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [targetRole, setTargetRole] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [sponsoredCheckoutAgreed, setSponsoredCheckoutAgreed] = useState(false);
  // Makse-tagasituleku olek (invitePayment URL-parameeter). Kui seatud, näitab
  // modal PUHAST staatuskaarti (mitte kutse-loomise vormi) — vt handleClose.
  const [paymentReturn, setPaymentReturn] = useState(null);
  const formatSentenceCase = (text) => {
    const raw = typeof text === "string" ? text.trim() : "";
    if (!raw) return text;
    if (raw !== raw.toUpperCase()) return text;
    const lower = raw.toLocaleLowerCase(locale || "et");
    return `${lower.charAt(0).toLocaleUpperCase(locale || "et")}${lower.slice(1)}`;
  };
  const sendLabel = formatSentenceCase(t("invite.send"));
  const sponsoredSelected = paymentMode === "SPONSORED_BY_HOST";
  const isWorkspaceReturn = embedded || openSource === "workspace";
  const inviteHeaderTitle = t("invite.eyebrow");
  const allowedRelationshipTypes = useMemo(
    () => inviteRelationshipTypesForInviter(session?.user?.role),
    [session?.user?.role],
  );
  const effectiveRelationshipType = allowedRelationshipTypes.includes(relationshipType)
    ? relationshipType
    : allowedRelationshipTypes.length === 1
      ? allowedRelationshipTypes[0]
      : "";
  const sponsoredRoleOptions = useMemo(() => {
    const roleKey = {
      CLIENT: "client",
      SOCIAL_WORKER: "worker",
      SERVICE_PROVIDER: "provider",
    };
    // Hind sõltub sellest, keda kutsud: sponsorkutse = üks kuu KUTSUTU rolli
    // ligipääsu, seega kannab iga valik oma rolli kuutellimuse summat.
    return sponsoredRolesForInviteRelationship(effectiveRelationshipType).map((value) => ({
      value,
      label: `${t(`invite.sponsored.role.${roleKey[value]}`)} - ${formatEuroAmount(
        getPublicSponsoredInviteAmount(value),
        locale,
      )}`,
    }));
  }, [effectiveRelationshipType, locale, t]);
  const allowedSponsoredRoles = sponsoredRoleOptions.map((option) => option.value);
  const effectiveTargetRole = allowedSponsoredRoles.includes(targetRole)
    ? targetRole
    : allowedSponsoredRoles.length === 1
      ? allowedSponsoredRoles[0]
      : null;
  const inviteEmailsRequiredError = error === t("invite.error.emails_required");
  const inviteRelationshipRequiredError = error === t("invite.error.relationship_required");
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
  useEffect(() => {
    if (embedded) return undefined;
    const handler = (e) => {
      setRoomId(e?.detail?.roomId || null);
      setOpenSource(String(e?.detail?.source || "").trim().toLowerCase());
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
    // Brauseri-GET tuleb tagasi peaaegu alati "pending" olekus (kinnitus
    // laekub asünkroonselt webhookiga) — see EI ole viga, kutse on juba
    // saadetud. Tundmatu väärtus taandub samuti pendingiks.
    const state = ["success", "pending", "canceled", "failed"].includes(invitePayment)
      ? invitePayment
      : "pending";
    setOpen(true);
    setOpenSource("");
    setRoomId(params.get("roomId") || null);
    setPaymentReturn({
      state,
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
    if (paymentMode !== "SPONSORED_BY_HOST") {
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
      }
    } catch (err) {
      console.error("invite list", err);
    } finally {
      setLoadingList(false);
    }
  }, [roomId]);
  useEffect(() => {
    if (open) loadInvites();
  }, [open, roomId, loadInvites]);
  const emailsParsed = useMemo(() => parseEmails(emails), [emails]);
  const multipleEmailsForSponsored = emailsParsed.length > 1;
  const startSponsoredFlow = useCallback(() => {
    setError("");
    setMessage("");
    if (!effectiveRelationshipType) {
      setError(t("invite.error.relationship_required"));
      return;
    }
    if (multipleEmailsForSponsored) {
      setError(t("invite.error.sponsored_single_email_required"));
      return;
    }
    const roles = sponsoredRolesForInviteRelationship(effectiveRelationshipType);
    setTargetRole(roles.length === 1 ? roles[0] : null);
    setSponsoredCheckoutAgreed(false);
    setPaymentMode("SPONSORED_BY_HOST");
  }, [effectiveRelationshipType, multipleEmailsForSponsored, t]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    const parsed = emailsParsed;
    if (!effectiveRelationshipType) {
      setError(t("invite.error.relationship_required"));
      return;
    }
    if (!parsed.length) {
      setError(t("invite.error.emails_required"));
      return;
    }
    const trimmedRoomTitle = roomTitle.trim();
    const trimmedHostName = hostDisplayName.trim();
    if (!roomId && !trimmedRoomTitle) {
      setError(t("invite.room_title_required"));
      return;
    }
    if (!roomId && !trimmedHostName) {
      setError(t("invite.host_name_required"));
      return;
    }
    if (paymentMode === "SPONSORED_BY_HOST" && parsed.length !== 1) {
      setError(t("invite.error.sponsored_single_email_required"));
      return;
    }
    if (paymentMode === "SPONSORED_BY_HOST" && !effectiveTargetRole) {
      setError(t("invite.error.sponsor_plan_required"));
      return;
    }
    if (paymentMode === "SPONSORED_BY_HOST" && sponsoredCheckoutDisabled) {
      setError(t("invite.error.checkout_temporarily_disabled"));
      return;
    }
    if (paymentMode === "SPONSORED_BY_HOST" && !sponsoredCheckoutAgreed) {
      setError(t("invite.error.checkout_terms_required"));
      return;
    }
    setBusy(true);
    try {
      if (paymentMode === "SPONSORED_BY_HOST") {
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
        if (!res.ok || data?.ok === false) {
          throw new Error(
            resolveApiMessage({
              payload: data,
              t,
              fallbackKey: "invite.send_failed",
            }),
          );
        }
        const checkoutUrl =
          typeof data?.checkoutUrl === "string" ? data.checkoutUrl.trim() : "";
        if (!checkoutUrl) {
          throw new Error(t("subscription.error.payment_start"));
        }
        if (!roomId && data?.roomId) {
          setRoomId(data.roomId);
        }
        setMessage(t("subscription.payment.redirect_demo"));
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
      if (!res.ok || data?.ok === false) {
        throw new Error(
          resolveApiMessage({
            payload: data,
            t,
            fallbackKey: "invite.send_failed",
          }),
        );
      }
      setMessage(t("invite.success"));
      setEmails("");
      if (!roomId && data?.roomId) {
        setRoomId(data.roomId);
      }
      loadInvites();
    } catch (err) {
      setError(err?.message || t("invite.send_failed"));
    } finally {
      setBusy(false);
    }
  }
  async function action(id, kind) {
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
      await loadInvites();
    } catch (err) {
      setError(err?.message || t("invite.action_failed"));
    }
  }
  function formatStatus(inv) {
    if (inv.status === "ACCEPTED" && inv.acceptedBillingSource) {
      return inv.acceptedBillingSource === "SELF"
        ? t("invite.status.accepted_self")
        : t("invite.status.accepted_sponsored");
    }
    return inv.status;
  }
  if (!open) return null;
  // Makse-tagasitulek: PUHAS staatuskaart (mitte kutse-loomise vorm), et
  // vältida "vorm üle vestluse" segadust. Katab kõik 4 makse-olekut; e-post
  // ilmub, kui kutse on ruumi kutse-loendist juba laetud (loadInvites).
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
            role={positive ? "status" : "alert"}
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
  const content = (
    <div className="invite-participant-workbench">
      {!hideHeader ? (
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
      ) : null}

      <div>
        {!session?.user?.id ? (
          <div>
            <p>{t("invite.login_required")}</p>
          </div>
        ) : (
          <Form className="invite-participant-form" onSubmit={submit}>
            {!roomId ? (
              <>
                <div>
                  <Input
                    id="invite-room-title"
                    className="invite-field-input"
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    disabled={busy}
                    placeholder={t("invite.room_title")}
                    aria-label={t("invite.room_title")}
                  />
                </div>
                <div>
                  <Input
                    id="invite-host-name"
                    className="invite-field-input"
                    value={hostDisplayName}
                    onChange={(e) => setHostDisplayName(e.target.value)}
                    disabled={busy}
                    placeholder={t("invite.host_name_ph")}
                    aria-label={t("invite.host_name")}
                  />
                </div>
              </>
            ) : null}
            <fieldset
              className="invite-participant-type"
              aria-describedby="invite-participant-scope"
              aria-invalid={inviteRelationshipRequiredError ? "true" : undefined}
              disabled={busy}
            >
              <legend>{t("invite.participant.question")}</legend>
              <div className="invite-participant-options">
                {allowedRelationshipTypes.map((type) => (
                  <OptionCard
                    key={type}
                    type="radio"
                    name="inviteRelationshipType"
                    value={type}
                    checked={effectiveRelationshipType === type}
                    onChange={(event) => {
                      setError("");
                      setMessage("");
                      setRelationshipType(event.target.value);
                      setTargetRole(null);
                    }}
                    disabled={busy}
                    fitTextLines={2}
                  >
                    <span>
                      {type === INVITE_RELATIONSHIP_CLIENT
                        ? t("invite.participant.client")
                        : t("invite.participant.professional")}
                    </span>
                  </OptionCard>
                ))}
              </div>
              <p id="invite-participant-scope" className="invite-participant-scope">
                {t("invite.participant.scope")}
              </p>
              {inviteRelationshipRequiredError ? (
                <p role="alert" className="invite-participant-error">
                  {error}
                </p>
              ) : null}
            </fieldset>
            <div>
              <Input
                id="invite-emails"
                className="invite-field-input"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={t("invite.classic.emails_ph")}
                aria-label={t("invite.classic.emails")}
                aria-invalid={inviteEmailsRequiredError ? "true" : undefined}
                aria-describedby={inviteEmailsRequiredError ? "invite-emails-error" : undefined}
                disabled={busy}
              />
              {inviteEmailsRequiredError ? (
                <p id="invite-emails-error">
                  {t("invite.error.emails_required")}
                </p>
              ) : null}
            </div>
            <div>
              <OptionCard
                type="checkbox"
                name="sponsoredInvite"
                value="SPONSORED_BY_HOST"
                checked={sponsoredSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    startSponsoredFlow();
                    return;
                  }
                  setError("");
                  setMessage("");
                  setPaymentMode("SELF_PAID");
                }}
                disabled={busy}
                fitTextLines={3}
              >
                <span>
                  {t("invite.pay.host")}
                </span>
              </OptionCard>

              {sponsoredSelected ? (
                <div id="invite-sponsored-panel">
                  <div>
                    <div>
                      {sponsoredRoleOptions.map((option) => (
                        <OptionCard
                          key={option.value}
                          type="radio"
                          name="targetRole"
                          value={option.value}
                          checked={effectiveTargetRole === option.value}
                          onChange={(e) => setTargetRole(e.target.value)}
                          disabled={busy}
                          fitTextLines={2}
                        >
                          <span>
                            {option.label}
                          </span>
                        </OptionCard>
                      ))}
                    </div>
                    <div>
                      <p>
                        {t("invite.sponsored.checkout.title")}
                      </p>
                      <div>
                        <Checkbox
                          id="invite-sponsored-consent"
                          name="inviteSponsoredConsent"
                          checked={sponsoredCheckoutAgreed}
                          disabled={busy}
                          onChange={(next) => setSponsoredCheckoutAgreed(next)}
                          label={
                            <RichText
                              as="span"
                              value={t("invite.sponsored.checkout.agreement")}
                              replacements={inviteCheckoutAgreementReplacements}
                            />
                          }
                        />
                      </div>
                      <div>
                        <Button
                          type="submit"
                          disabled={sponsoredCheckoutDisabled || busy || !effectiveTargetRole || !sponsoredCheckoutAgreed}
                        >
                          {busy
                            ? t("invite.sending")
                            : t("invite.sponsored.confirm_and_pay")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {((error && !inviteEmailsRequiredError && !inviteRelationshipRequiredError) || message || !sponsoredSelected) ? (
              <div>
                {error && !inviteEmailsRequiredError && !inviteRelationshipRequiredError ? (
                  <p role="alert">
                    {error}
                  </p>
                ) : null}
                {message ? (
                  <p role="status">
                    {message}
                  </p>
                ) : null}
                {!sponsoredSelected ? (
                  <Button
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? t("invite.sending") : sendLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Form>
        )}

        <div>
          <div>
            <span>
              {t("invite.list")}
            </span>
            <Button
              type="button"
              onClick={loadInvites}
              disabled={loadingList}
            >
              {loadingList ? t("invite.loading") : t("invite.refresh")}
            </Button>
          </div>
          {invites.length === 0 ? (
            <p>
              {t("invite.empty")}
            </p>
          ) : (
            <div>
              <div>
                <span>{t("invite.table.email")}</span>
                <span>{t("invite.table.payer")}</span>
                <span>{t("invite.table.status")}</span>
                <span></span>
              </div>
              {invites.map((inv) => (
                <div key={inv.id}>
                  <div>
                    <span>{inv.inviteeEmail}</span>
                  </div>
                  <div>
                    <span>
                      {inv.paymentMode === "SPONSORED_BY_HOST"
                        ? t("invite.payer.host")
                        : t("invite.payer.self")}
                    </span>
                  </div>
                  <div>
                    <span>{formatStatus(inv)}</span>
                  </div>
                  <span>
                    {inv.status === "SENT" ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => action(inv.id, "resend")}
                        >
                          {t("invite.resend")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => action(inv.id, "revoke")}
                        >
                          {t("buttons.cancel")}
                        </Button>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div>
        {content}
      </div>
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
      {content.props.children}
    </Modal>
  );
}
