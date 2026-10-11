"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { MemberView, MembersBoard } from "./members/MembersViews";
import { grantNeedsConfirm, heldRights, memberActions, memberFacts, memberName, memberRow, memberTabs, primaryUnitId, shownTab } from "./members/memberRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Liikmete haldusvaade.
 *
 * SIIN EI OLE JA EI TOHI TULLA: „viimati aktiivne", kasutuskordi, vestluste
 * arvu, tootlikkust ega ühtegi privaatset kirjet (arenduskava §7.4). Server ei
 * saada neid välju; see komponent ei tohi neid ka tuletada.
 *
 * KUJU (11.10). Leht oli kuue veeruga tabel, mille ridade sees olid rippmenüüd
 * ja nupud. Nüüd on ees kas loend (liikmed madalate ridadena) või üks avatud
 * liige kolme väikese vaatega. Vaated on failis ./members/MembersViews.jsx,
 * reeglid failis ./members/memberRules.js; see fail hoiab olekut ja teeb
 * päringud. Liikmesuse lõpetamine ja õiguse äravõtmine küsivad teist vajutust.
 */
export default function OrgMembersClient({ context, initialMembers, units, canGrant }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [members, setMembers] = useState(initialMembers || []);
  const [openId, setOpenId] = useState("");
  const [wantedTab, setWantedTab] = useState("member");
  /* Õnnestunud tegevuse lause (nt „Liikmesus on lõpetatud."); tõrke lause tuleb `error`-ist. */
  const [done, setDone] = useState("");
  const confirm = useSecondPress();
  const sending = useRef(false);
  const rootRef = useRef(null);

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/members`);
    if (payload?.members) setMembers(payload.members);
  }, [call, organizationId]);

  const act = useCallback(
    async (membershipId, action) => {
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "PATCH",
        body: { action },
        fallbackKey: "org.errors.member_update_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const end = useCallback(
    async (membershipId) => {
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.member_end_failed"
      });
      if (payload) {
        await reload();
        /* Lõpetatud liiget loendis enam ei ole: tagasi loendisse ja lause, mis juhtus. */
        setOpenId("");
        setDone(t("org.members.ended"));
      }
    },
    [call, organizationId, reload, t]
  );

  const setUnit = useCallback(
    async (membershipId, unitId) => {
      if (!unitId) return;
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "PATCH",
        body: { action: "setPrimaryUnit", unitId },
        fallbackKey: "org.errors.member_update_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const revoke = useCallback(
    async (membershipId, grantId) => {
      const payload = await call(
        `/api/org/${organizationId}/members/${membershipId}/capabilities/${grantId}`,
        { method: "DELETE", fallbackKey: "org.errors.capability_revoke_failed" }
      );
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const grant = useCallback(
    async (membershipId, capability) => {
      if (!capability) return;
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}/capabilities`, {
        method: "POST",
        body: { capability, scopeType: "ORGANIZATION" },
        fallbackKey: "org.errors.capability_grant_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut (`busy` jõuab
     nupuni alles järgmise joonistusega). */
  const once = useCallback(async (work) => {
    if (sending.current) return;
    sending.current = true;
    setDone("");
    try {
      await work();
    } finally {
      sending.current = false;
    }
  }, []);

  const member = members.find((item) => item.membershipId === openId) || null;
  const rows = useMemo(() => members.map((item) => memberRow(item, { t })), [members, t]);

  /* Vaate vahetusel (loend ↔ liige) kaob vajutatud rida või nupp: fookus läheb
     vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(null);
  const shownKey = member ? member.membershipId : "";
  useEffect(() => {
    const first = shown.current === null;
    const moved = shown.current !== shownKey;
    shown.current = shownKey;
    if (first || !moved) return;
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [shownKey]);

  const notice = error ? { tone: "risk", text: error } : done ? { text: done } : null;

  if (!member) {
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="members">
          <MembersBoard
            t={t}
            rows={rows}
            notice={notice}
            onOpen={(id) => {
              confirm.clear();
              setDone("");
              setWantedTab("member");
              setOpenId(id);
            }}
          />
        </OrgPart>
      </div>
    );
  }

  const id = member.membershipId;
  const actions = memberActions(member, { writable, canGrant, units, activeModules: context.activeModules || [] });
  const tabs = memberTabs(actions);
  const held = heldRights(member, units, { t });
  const armedRight = held.find((right) => confirm.armed === `revoke:${right.id}`);
  const armedGrant = confirm.armed.startsWith("grant:") ? confirm.armed.slice(6) : "";
  const armedNote =
    confirm.armed === `end:${id}`
      ? t("org.members.end_note")
      : armedRight
        ? t("org.members.revoke_note", { name: armedRight.label })
        : armedGrant
          ? t("org.members.grant_owner_note")
          : "";

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="members">
        <MemberView
          t={t}
          name={memberName(member)}
          tabs={tabs}
          tab={shownTab(tabs, wantedTab)}
          onTab={(value) => {
            confirm.clear();
            setWantedTab(value);
          }}
          facts={memberFacts(member, { t })}
          unit={{
            options: units.map((unit) => ({ value: unit.id, label: unit.name })),
            value: primaryUnitId(member),
            onChange: (unitId) => {
              if (unitId === primaryUnitId(member)) return;
              void once(() => setUnit(id, unitId));
            }
          }}
          rights={{
            held,
            grantable: actions.grant.map((capability) => ({ value: capability, label: t(`org.capability.${capability}`) })),
            canRevoke: actions.revoke,
            armedId: armedRight?.id || "",
            armedGrant,
            onRevoke: (right) => confirm.press(`revoke:${right.id}`, () => once(() => revoke(id, right.id))),
            onGrant: (capability) => {
              if (grantNeedsConfirm(capability)) {
                confirm.press(`grant:${capability}`, () => once(() => grant(id, capability)));
                return;
              }
              confirm.clear();
              void once(() => grant(id, capability));
            }
          }}
          life={{
            suspend: actions.suspend,
            reactivate: actions.reactivate,
            end: actions.end,
            endArmed: confirm.armed === `end:${id}`,
            onSuspend: () => {
              confirm.clear();
              void once(() => act(id, "suspend"));
            },
            onReactivate: () => {
              confirm.clear();
              void once(() => act(id, "reactivate"));
            },
            onEnd: () => confirm.press(`end:${id}`, () => once(() => end(id)))
          }}
          notice={notice}
          armedNote={armedNote}
          busy={busy}
          onBack={() => {
            confirm.clear();
            setOpenId("");
          }}
        />
      </OrgPart>
    </div>
  );
}
