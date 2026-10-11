"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { buildRoomChatPath } from "@/lib/roomPath";

import { ItemView } from "./inbox/InboxViews";
import { itemFacts, itemTabs, sourceParts, workActions, workerOptions } from "./inbox/inboxRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Ühe vastuvõtukirje vaade.
 *
 * PAKETT ON SAATJA KINNITATUD ja ainult see. Siin ei ole ega tule Teekonda,
 * vestlusi ega muud materjali. Vaade kuvab ainult välju, mille server on
 * saatnud — kui midagi puudub, on see serveri otsus, mitte UI puudujääk.
 *
 * KUJU (11.10). Neli kasti üksteise all on nüüd kaks väikest vaadet (pöördumine
 * ja töö), vt ./inbox/InboxViews.jsx; mis tegevused on võimalikud, otsustab
 * ./inbox/inboxRules.js. Tagasilükkamine ja sulgemine küsivad teist vajutust.
 */
export default function OrgInboxItemClient({ context, item, members, canAssign }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { call, error, setError } = useOrgApi();
  const [assigneeId, setAssigneeId] = useState("");
  const [handoverId, setHandoverId] = useState("");
  const [wantedTab, setWantedTab] = useState("package");
  /* Mis päring käib: "" | "assign" | "accept" | "reject" | "handover" | "close". */
  const [pending, setPending] = useState("");
  const [hint, setHint] = useState("");
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);

  const organizationId = context.organization.id;
  /* Server ei saatnud sisu ja ütles ka, miks. UI ei tohi seda tõlgendada
     „andmed ei laadinud" veaks ega joonistada tühje välju, mille kõrval on
     endiselt „määra töötaja" — nupp, mille server niikuinii 409-ga tagasi
     lükkab. Tühi vorm annaks lubaduse, mida ei ole. */
  const withheld = item.sourceWithheldReason || null;
  const assignment = item.assignment || null;

  const refresh = useCallback(() => router.refresh(), [router]);
  /* Töötaja, kes töö ära andis või tagasi lükkas ega ole ise määraja, ei näe
     kirjet enam (server vastab talle nagu olematule): tema jaoks avaneb loend,
     mitte „lehte ei leitud". Määraja jääb kirje juurde. */
  const leaveOrRefresh = useCallback(() => {
    if (canAssign) router.refresh();
    else router.push(`/org/${organizationId}/vastuvott`);
  }, [canAssign, organizationId, router]);

  const assign = useCallback(async () => {
    if (!assigneeId) return;
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}/assign`, {
      method: "POST",
      body: { assigneeMembershipId: assigneeId },
      fallbackKey: "org.errors.work_assign_failed"
    });
    if (payload) refresh();
  }, [assigneeId, call, item.id, organizationId, refresh]);

  const respond = useCallback(
    async (action) => {
      const payload = await call(`/api/org/${organizationId}/assignments/${assignment.id}`, {
        method: "PATCH",
        body: { action },
        fallbackKey: "org.errors.work_response_failed"
      });
      if (!payload) return;
      if (action === "reject") leaveOrRefresh();
      else refresh();
    },
    [assignment, call, leaveOrRefresh, organizationId, refresh]
  );

  const handOver = useCallback(async () => {
    if (!handoverId) return;
    const payload = await call(`/api/org/${organizationId}/assignments/${assignment.id}`, {
      method: "POST",
      body: { toMembershipId: handoverId },
      fallbackKey: "org.errors.work_handover_failed"
    });
    if (payload) {
      setHandoverId("");
      leaveOrRefresh();
    }
  }, [assignment, call, handoverId, leaveOrRefresh, organizationId]);

  /* Töö vastu võtnud töötaja vastab pöördujale samas ühises vestlusruumis, mida kasutab
     nimeline saaja. `item.room.canOpen` ütleb ainult, kas nuppu näidata: ligipääsu
     otsustab server igal vajutusel uuesti. */
  const sourceId = item.source?.id || "";
  const openRoom = useCallback(async () => {
    if (!sourceId) return;
    const payload = await call(`/api/pre-inquiries/${encodeURIComponent(sourceId)}/room`, {
      method: "POST",
      fallbackKey: "pre_inquiries.errors.room_failed"
    });
    if (payload?.room?.id) router.push(buildRoomChatPath(payload.room.id, locale));
  }, [call, locale, router, sourceId]);

  const close = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}`, {
      method: "PATCH",
      body: { toStatus: "CLOSED" },
      fallbackKey: "org.errors.inbox_transition_failed"
    });
    if (payload) router.push(`/org/${organizationId}/vastuvott`);
  }, [call, item.id, organizationId, router]);

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    setHint("");
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const actions = workActions(item, { context, canAssign });
  const tabs = itemTabs(actions);
  const tab = tabs.includes(wantedTab) ? wantedTab : "package";
  const listHref = `/org/${organizationId}/vastuvott`;

  /* Vaate vahetusel läheb fookus valitud lahtrile (lahtrid joonistatakse uuesti). */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== tab;
    shown.current = tab;
    if (first || !moved) return;
    rootRef.current?.querySelector("[role=radio][aria-checked=true]")?.focus({ preventScroll: true });
  }, [tab]);

  const armedNote = confirm.armed === "close" ? t("org.inbox.close_note") : confirm.armed === "reject" ? t("org.inbox.reject_note") : "";
  const notice = error ? { tone: "risk", text: error } : hint ? { tone: "risk", text: hint } : null;

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="inbox">
        <ItemView
          t={t}
          tabs={tabs}
          tab={tab}
          onTab={(value) => {
            clearConfirm();
            setError("");
            setHint("");
            setWantedTab(value);
          }}
          facts={itemFacts(item, members, { t })}
          parts={sourceParts(item, { t })}
          withheld={Boolean(withheld)}
          work={{
            actions,
            pending,
            workers: workerOptions(members, { t }),
            assigneeId,
            onAssignee: (value) => {
              setAssigneeId(value);
              setHint("");
            },
            onAssign: () => {
              if (!assigneeId) {
                setHint(t("org.inbox.pick_first"));
                return;
              }
              clearConfirm();
              void once("assign", assign);
            },
            others: workerOptions(members, { t, exclude: assignment?.membershipId || "" }),
            handoverId,
            onHandover: (value) => {
              setHandoverId(value);
              setHint("");
            },
            onHandOver: () => {
              if (!handoverId) {
                setHint(t("org.inbox.pick_first"));
                return;
              }
              clearConfirm();
              void once("handover", handOver);
            },
            onAccept: () => {
              clearConfirm();
              void once("accept", () => respond("accept"));
            },
            rejectArmed: confirm.armed === "reject",
            onReject: () => confirm.press("reject", () => once("reject", () => respond("reject"))),
            closeArmed: confirm.armed === "close",
            onClose: () => confirm.press("close", () => once("close", close))
          }}
          room={
            item.room?.canOpen
              ? {
                  busy: pending === "room",
                  onOpen: () => {
                    clearConfirm();
                    void once("room", openRoom);
                  }
                }
              : null
          }
          notice={notice}
          armedNote={armedNote}
          back={{
            href: listHref,
            onBack: (event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              router.push(listHref);
            }
          }}
        />
      </OrgPart>
    </div>
  );
}
