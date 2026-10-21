"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { buildRoomChatPath } from "@/lib/roomPath";

import { ItemView } from "./inbox/InboxViews";
import {
  CLOSING_NOTE_LIMIT,
  ENDINGS,
  activeEnding,
  closingNoteOf,
  endingProblem,
  endingReason,
  groupOfItem,
  inboxPagePath,
  itemFacts,
  itemTabs,
  showsOpenedNotice,
  sourceParts,
  workActions,
  workerOptions
} from "./inbox/inboxRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/* Teist vajutust küsiva tegevuse märkus: mis juhtub, kui inimene kinnitab. */
const ARMED_NOTES = Object.freeze({
  reject: "org.inbox.reject_note",
  takeBack: "org.inbox.take_back_note"
});

/**
 * Ühe vastuvõtukirje vaade.
 *
 * PAKETT ON SAATJA KINNITATUD ja ainult see. Siin ei ole ega tule Teekonda,
 * vestlusi ega muud materjali. Vaade kuvab ainult välju, mille server on
 * saatnud — kui midagi puudub, on see serveri otsus, mitte UI puudujääk.
 *
 * KUJU (11.10). Neli kasti üksteise all on nüüd kaks väikest vaadet (pöördumine
 * ja töö), vt ./inbox/InboxViews.jsx; mis tegevused on võimalikud, otsustab
 * ./inbox/inboxRules.js. Töö tagasilükkamine ja töö tagasivõtmine küsivad teist vajutust.
 *
 * TÖÖ LÕPETAMINE (sulgemine, pöördumise tagasilükkamine) avab töö vaates väikese vormi:
 * selgitus pöördujale ja mis juhtub. Tagasilükkamisel on selgitus kohustuslik, sulgemisel
 * soovi korral (omanik 11.10.2026: põhjust peab küsima ja pöörduja peab seda nägema). Vorm
 * ise on teine samm, seega eraldi teist vajutust seal ei ole.
 */
export default function OrgInboxItemClient({ context, item, members, canAssign }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { call, error, setError } = useOrgApi();
  const [assigneeId, setAssigneeId] = useState("");
  const [handoverId, setHandoverId] = useState("");
  const [wantedTab, setWantedTab] = useState("package");
  /* Mis päring käib: "" | "assign" | "accept" | "reject" | "handover" | "takeBack" | "close" | "rejectItem" | "room". */
  const [pending, setPending] = useState("");
  const [hint, setHint] = useState("");
  /* Mis lõpetamise vorm on ees ("" | "close" | "rejectItem") ja mis sinna on kirjutatud. */
  const [wantedEnding, setWantedEnding] = useState("");
  const [endingText, setEndingText] = useState("");
  /* Töö tähtaeg (koordinaator): kuupäevavälja väärtus; algab serveri öeldud tähtajast. */
  const [dueOn, setDueOn] = useState(item.dueOn || "");
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
  /* Töötaja, kes töö ära andis või tagasi lükkas ega ole selle kirje koordinaator, ei näe
     kirjet enam (server vastab talle nagu olematule): tema jaoks avaneb loend,
     mitte „lehte ei leitud". Koordinaator jääb kirje juurde. Töö määramise õigus üksi
     kirjet ei ava, seega otsustab serveri öeldud `isCoordinator`, mitte `canAssign`. */
  const leaveOrRefresh = useCallback(() => {
    if (item.isCoordinator) router.refresh();
    else router.push(`/org/${organizationId}/vastuvott`);
  }, [item.isCoordinator, organizationId, router]);

  const assign = useCallback(async () => {
    if (!assigneeId) return;
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}/assign`, {
      method: "POST",
      body: { assigneeMembershipId: assigneeId },
      fallbackKey: "org.errors.work_assign_failed"
    });
    if (payload) refresh();
  }, [assigneeId, call, item.id, organizationId, refresh]);

  const saveDue = useCallback(async (value) => {
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}`, {
      method: "PATCH",
      body: { dueOn: value || null },
      fallbackKey: "org.errors.inbox_due_failed"
    });
    if (payload) refresh();
  }, [call, item.id, organizationId, refresh]);

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
      body: { toStatus: "CLOSED", reason: endingReason(endingText) },
      fallbackKey: "org.errors.inbox_transition_failed"
    });
    if (payload) router.push(`/org/${organizationId}/vastuvott`);
  }, [call, endingText, item.id, organizationId, router]);

  /* Pöördumise tagasilükkamine: nii lõpetab koordinaator pöördumise, millel ei ole vastutajat
     (omaniku otsus 11.10.2026). Server teeb sama mis sulgemisel: töö lõpeb, pöörduja saab
     teate ja tema vestlusruum, kui see on, jääb ainult loetavaks. Selgitus on kohustuslik:
     server keeldub ilma selleta. */
  const rejectItem = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}`, {
      method: "PATCH",
      body: { toStatus: "REJECTED", reason: endingReason(endingText) },
      fallbackKey: "org.errors.inbox_transition_failed"
    });
    if (payload) router.push(`/org/${organizationId}/vastuvott`);
  }, [call, endingText, item.id, organizationId, router]);

  /* Töö tagasivõtmine töötajalt: käsitsi „ootab määramist" lõpetab serveris elava määramise
     (`transitionInboxItem`). Koordinaator jääb kirje juurde ja saab töö uuesti määrata. */
  const takeBack = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}`, {
      method: "PATCH",
      body: { toStatus: "ASSIGNMENT_PENDING" },
      fallbackKey: "org.errors.inbox_transition_failed"
    });
    if (payload) {
      setHandoverId("");
      refresh();
    }
  }, [call, item.id, organizationId, refresh]);

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
  /* Vorm on ees ainult töö vaates ja ainult tegevusele, mis selles seisus võimalik on. */
  const ending = tab === "work" ? activeEnding(wantedEnding, actions) : "";
  const openEnding = (kind) => {
    clearConfirm();
    setError("");
    setHint("");
    setEndingText("");
    setWantedEnding(kind);
  };
  const submitEnding = () => {
    const problem = endingProblem(ending, endingText);
    if (problem) {
      setHint(t(`org.inbox.${problem}`));
      return;
    }
    void once(ending, ending === "close" ? close : rejectItem);
  };
  /* Lõpetatud kirjelt viib „Tagasi loendisse" lõpetatud pöördumiste rühma, kust inimene tuli. */
  const listHref = inboxPagePath(organizationId, groupOfItem(item));

  /* Vaate vahetusel läheb fookus valitud lahtrile (lahtrid joonistatakse uuesti). */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== tab;
    shown.current = tab;
    if (first || !moved) return;
    rootRef.current?.querySelector("[role=radio][aria-checked=true]")?.focus({ preventScroll: true });
  }, [tab]);
  /* Vormi avanemisel läheb fookus tekstiväljale, vormist loobumisel tagasi vaate lahtrile. */
  const shownEnding = useRef("");
  useEffect(() => {
    const before = shownEnding.current;
    shownEnding.current = ending;
    if (before === ending) return;
    const target = ending ? rootRef.current?.querySelector("textarea") : rootRef.current?.querySelector("[role=radio][aria-checked=true]");
    target?.focus({ preventScroll: true });
  }, [ending]);

  const armedNote = ARMED_NOTES[confirm.armed] ? t(ARMED_NOTES[confirm.armed]) : "";
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
            setWantedEnding("");
            setWantedTab(value);
          }}
          facts={itemFacts(item, members, { t })}
          parts={sourceParts(item, { t })}
          closingNote={closingNoteOf(item)}
          openedNotice={showsOpenedNotice(item)}
          withheld={Boolean(withheld)}
          ending={
            ending
              ? {
                  kind: ending,
                  question: t(ENDINGS[ending].question),
                  hint: t(ENDINGS[ending].hint),
                  note: t(ENDINGS[ending].note),
                  submit: t(ENDINGS[ending].submit),
                  value: endingText,
                  limit: CLOSING_NOTE_LIMIT,
                  busy: pending === ending,
                  onChange: (value) => {
                    setEndingText(value);
                    setHint("");
                  },
                  onBack: () => {
                    setError("");
                    setHint("");
                    setWantedEnding("");
                  },
                  onSubmit: submitEnding
                }
              : null
          }
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
            takeBackArmed: confirm.armed === "takeBack",
            onTakeBack: () => confirm.press("takeBack", () => once("takeBack", takeBack)),
            onClose: () => openEnding("close"),
            onRejectItem: () => openEnding("rejectItem"),
            dueOn,
            dueSaved: Boolean(item.dueOn),
            onDueOn: (value) => {
              setDueOn(value);
              setHint("");
            },
            onSaveDue: () => {
              if (!dueOn) {
                setHint(t("org.inbox.due_pick_first"));
                return;
              }
              clearConfirm();
              void once("due", () => saveDue(dueOn));
            },
            onClearDue: () => {
              clearConfirm();
              setDueOn("");
              void once("dueClear", () => saveDue(""));
            }
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
