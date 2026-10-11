"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { isHomeCareUiEnabled } from "@/lib/homeCare/flags";

import OrgPart from "./OrgPart";
import { ExportLinkView, ModulesView, StatusView } from "./settings/SettingsViews";
import { SETTINGS_TABS, lifecycleActions, moduleRows } from "./settings/settingsRules";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Seaded: moodulite aktiveerimine ja organisatsiooni elutsükkel.
 *
 * `ACTIVE` ja `SUSPENDED` nuppe näeb ainult platvormi admin — identiteedikontroll
 * ei ole midagi, mida organisatsioon saab endale ise anda (arenduskava §7.1).
 * Server keeldub niikuinii; nupu peitmine hoiab ära eksitava „proovi ja saa 403".
 *
 * KUJU (11.10). Leht oli kolm kasti üksteise all. Nüüd on kolm väikest vaadet
 * (moodulid, seis, väljavõte), valik lahtritest üleval. Vaated on failis
 * ./settings/SettingsViews.jsx, reeglid failis ./settings/settingsRules.js; see
 * fail hoiab olekut ja teeb päringud. Mooduli peatamine, organisatsiooni
 * peatamine ja LÕPLIK arhiveerimine küsivad teist vajutust.
 */
export default function OrgSettingsClient({ context, isPlatformAdmin }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, error, setError } = useOrgApi();
  const [activeModules, setActiveModules] = useState(context.activeModules || []);
  const [tab, setTab] = useState("modules");
  /* Mis päring käib: "" | "module:<võti>" | "status:<seis>". */
  const [pending, setPending] = useState("");
  const confirm = useSecondPress();
  const clearConfirm = confirm.clear;
  const sending = useRef(false);
  const rootRef = useRef(null);

  const organizationId = context.organization.id;
  const status = context.organization.status;

  const toggleModule = useCallback(
    async (moduleKey, activate) => {
      const payload = await call(`/api/org/${organizationId}/modules`, {
        method: activate ? "POST" : "DELETE",
        body: { moduleKey },
        fallbackKey: activate ? "org.errors.module_activate_failed" : "org.errors.module_suspend_failed"
      });
      if (payload) {
        setActiveModules((current) =>
          activate ? [...current, moduleKey] : current.filter((key) => key !== moduleKey)
        );
      }
    },
    [call, organizationId]
  );

  const changeStatus = useCallback(
    async (toStatus) => {
      const payload = await call(`/api/org/${organizationId}/status`, {
        method: "POST",
        body: { toStatus },
        fallbackKey: "org.errors.status_change_failed"
      });
      if (!payload) return;
      /* Arhiveeritud organisatsiooni lehti enam ei ole (server vastab neile nagu
         olematule): pärast arhiveerimist avaneb organisatsioonide loend, mitte
         „lehte ei leitud". */
      if (toStatus === "ARCHIVED") router.push("/org");
      else router.refresh();
    },
    [call, organizationId, router]
  );

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  /* Vaate vahetusel läheb fookus vaate pealkirjale (valitud lahter joonistatakse uuesti). */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== tab;
    shown.current = tab;
    if (first || !moved) return;
    rootRef.current?.querySelector("[role=radio][aria-checked=true]")?.focus({ preventScroll: true });
  }, [tab]);

  const changeTab = (value) => {
    clearConfirm();
    setError("");
    setTab(value);
  };
  const notice = error ? { tone: "risk", text: error } : null;
  const tabs = [...SETTINGS_TABS];

  let view;
  if (tab === "status") {
    view = (
      <StatusView
        t={t}
        tabs={tabs}
        tab={tab}
        onTab={changeTab}
        statusLabel={t(`org.status.${status}`)}
        statusLine={t(`org.settings.status_lines.${status}`)}
        actions={lifecycleActions(status, { isPlatformAdmin })}
        armedStatus={confirm.armed.startsWith("status:") ? confirm.armed.slice(7) : ""}
        busyStatus={pending.startsWith("status:") ? pending.slice(7) : ""}
        onPress={(action) => {
          const run = () => once(`status:${action.toStatus}`, () => changeStatus(action.toStatus));
          if (action.confirm) confirm.press(`status:${action.toStatus}`, run);
          else {
            clearConfirm();
            void run();
          }
        }}
        notice={notice}
      />
    );
  } else if (tab === "export") {
    const href = `/org/${organizationId}/eksport`;
    view = (
      <ExportLinkView
        t={t}
        tabs={tabs}
        tab={tab}
        onTab={changeTab}
        href={href}
        onOpen={(event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          router.push(href);
        }}
      />
    );
  } else {
    view = (
      <ModulesView
        t={t}
        tabs={tabs}
        tab={tab}
        onTab={changeTab}
        rows={moduleRows(activeModules, { t, homeCareUi: isHomeCareUiEnabled(), writable: context.writable !== false })}
        toggle={{
          armedKey: confirm.armed.startsWith("module:") ? confirm.armed.slice(7) : "",
          busyKey: pending.startsWith("module:") ? pending.slice(7) : "",
          onPress: (row) => {
            const run = () => once(`module:${row.key}`, () => toggleModule(row.key, !row.active));
            /* Peatamine sulgeb töövoo kõigile liikmetele: see küsib teist vajutust. */
            if (row.active) confirm.press(`module:${row.key}`, run);
            else {
              clearConfirm();
              void run();
            }
          },
          onCancel: clearConfirm
        }}
        notice={notice}
      />
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="settings">
        {view}
      </OrgPart>
    </div>
  );
}
