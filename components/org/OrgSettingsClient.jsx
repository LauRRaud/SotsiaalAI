"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { ORGANIZATION_MODULE_KEYS } from "@/lib/org/constants";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Seaded: moodulite aktiveerimine ja organisatsiooni elutsükkel.
 *
 * `ACTIVE` ja `SUSPENDED` nuppe näeb ainult platvormi admin — identiteedikontroll
 * ei ole midagi, mida organisatsioon saab endale ise anda (arenduskava §7.1).
 * Server keeldub niikuinii; nupu peitmine hoiab ära eksitava „proovi ja saa 403".
 */
export default function OrgSettingsClient({ context, isPlatformAdmin }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useOrgApi();
  const [activeModules, setActiveModules] = useState(context.activeModules || []);

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
      if (payload) router.refresh();
    },
    [call, organizationId, router]
  );

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <section className="ow-card" aria-labelledby="ow-modules-settings">
        <h2 id="ow-modules-settings" className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.settings.modules")}
        </h2>
        <p className="ow-subtitle">{t("org.settings.modulesIntro")}</p>
        <ul className="ow-chips">
          {ORGANIZATION_MODULE_KEYS.map((moduleKey) => {
            const isActive = activeModules.includes(moduleKey);
            return (
              <li key={moduleKey} className="ow-chip">
                {t(`org.module.${moduleKey}`)}
                {context.writable !== false ? (
                  <Button type="button" onClick={() => toggleModule(moduleKey, !isActive)} disabled={busy}>
                    {isActive ? t("org.settings.suspend") : t("org.settings.activate")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ow-card" aria-labelledby="ow-lifecycle">
        <h2 id="ow-lifecycle" className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.settings.lifecycle")}
        </h2>
        <p className="ow-subtitle">{t(`org.status.${status}`)}</p>
        <div className="ow-actions">
          {status === "DRAFT" ? (
            <Button type="button" onClick={() => changeStatus("PENDING_VERIFICATION")} disabled={busy}>
              {t("org.settings.submitForVerification")}
            </Button>
          ) : null}
          {isPlatformAdmin && status === "PENDING_VERIFICATION" ? (
            <Button type="button" onClick={() => changeStatus("ACTIVE")} disabled={busy}>
              {t("org.status.ACTIVE")}
            </Button>
          ) : null}
          {isPlatformAdmin && status === "ACTIVE" ? (
            <Button type="button" onClick={() => changeStatus("SUSPENDED")} disabled={busy}>
              {t("org.status.SUSPENDED")}
            </Button>
          ) : null}
          {status !== "ARCHIVED" ? (
            <Button type="button" onClick={() => changeStatus("ARCHIVED")} disabled={busy}>
              {t("org.settings.archive")}
            </Button>
          ) : null}
        </div>
        <p className="ow-empty">{t("org.settings.archiveHint")}</p>
      </section>

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
