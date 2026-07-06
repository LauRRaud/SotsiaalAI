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
  const [targetRole, setTargetRole] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [sponsoredCheckoutAgreed, setSponsoredCheckoutAgreed] = useState(false);
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
  const sponsoredAmount = Number(process.env.NEXT_PUBLIC_INVITE_SPONSORED_AMOUNT || 4);
  const sponsoredAmountLabel = formatEuroAmount(
    Number.isFinite(sponsoredAmount) && sponsoredAmount > 0 ? sponsoredAmount : 4,
    locale,
  );
  const sponsoredRoleOptions = [
    {
      value: "SOCIAL_WORKER",
      label: `${t("invite.sponsored.role.worker")} - ${sponsoredAmountLabel}`,
    },
    {
      value: "CLIENT",
      label: `${t("invite.sponsored.role.client")} - ${sponsoredAmountLabel}`,
    },
  ];
  const inviteEmailsRequiredError = error === t("invite.error.emails_required");
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
    setOpen(true);
    setOpenSource("");
    setRoomId(params.get("roomId") || null);
    if (invitePayment === "success") {
      setMessage(t("invite.sponsored.payment_success"));
      setError("");
    } else if (invitePayment === "canceled") {
      setError(t("invite.sponsored.payment_canceled"));
      setMessage("");
    } else if (invitePayment === "failed") {
      setError(t("invite.sponsored.payment_failed"));
      setMessage("");
    }
  }, [embedded, t]);
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
    if (multipleEmailsForSponsored) {
      setError(t("invite.error.sponsored_single_email_required"));
      return;
    }
    setTargetRole(null);
    setSponsoredCheckoutAgreed(false);
    setPaymentMode("SPONSORED_BY_HOST");
  }, [multipleEmailsForSponsored, t]);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    const parsed = emailsParsed;
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
    if (paymentMode === "SPONSORED_BY_HOST" && !targetRole) {
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
            targetRole,
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
  const content = (
    <div>
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
          <form onSubmit={submit}>
            {!roomId ? (
              <>
                <div>
                  <input
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
                  <input
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
            <div>
              <input
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
                          checked={targetRole === option.value}
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
                          disabled={sponsoredCheckoutDisabled || busy || !targetRole || !sponsoredCheckoutAgreed}
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

            {((error && !inviteEmailsRequiredError) || message || !sponsoredSelected) ? (
              <div>
                {error && !inviteEmailsRequiredError ? (
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
          </form>
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
    >
      {content.props.children}
    </Modal>
  );
}
