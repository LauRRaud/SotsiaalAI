"use client";

import { cn } from "@/components/ui/cn";

const WORKSPACE_ROLE_CYCLE = Object.freeze([
  "SERVICE_PROVIDER",
  "SOCIAL_WORKER",
  "CLIENT"
]);

function normalizeWorkspaceRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  return WORKSPACE_ROLE_CYCLE.includes(normalized) ? normalized : "SOCIAL_WORKER";
}

function workspaceRoleShortLabel(role) {
  if (role === "SERVICE_PROVIDER") return "T";
  if (role === "SOCIAL_WORKER") return "S";
  return "P";
}

function workspaceRoleLabel(t, role) {
  if (role === "CLIENT") {
    return typeof t === "function"
      ? t("workspace_feature_pages.roles.client", "Pöörduja")
      : "Pöörduja";
  }
  if (role === "SERVICE_PROVIDER") {
    return typeof t === "function"
      ? t("workspace_feature_pages.roles.service_provider", "Teenuseosutaja")
      : "Teenuseosutaja";
  }
  return typeof t === "function"
    ? t("workspace_feature_pages.roles.social_worker", "Spetsialist")
    : "Spetsialist";
}

/* Tellija 06.07 öö: mitte tsükli-nupp, vaid KOLM nuppu — S (spetsialist),
   P (pöörduja), T (teenuseosutaja); aktiivne helendab. */
const WORKSPACE_ROLE_BUTTONS = Object.freeze([
  "SOCIAL_WORKER",
  "CLIENT",
  "SERVICE_PROVIDER"
]);

export default function WorkspaceRoleCycleButton({
  t,
  value,
  onChange,
  className,
  ariaLabel,
  disabled = false
}) {
  const normalizedValue = normalizeWorkspaceRole(value);

  return (
    <div
      className={cn("workspace-role-switch", className)}
      role="group"
      aria-label={ariaLabel || workspaceRoleLabel(t, normalizedValue)}
    >
      {WORKSPACE_ROLE_BUTTONS.map((role) => {
        const label = workspaceRoleLabel(t, role);
        const active = role === normalizedValue;
        return (
          <button
            key={role}
            type="button"
            data-variant={active ? "primary" : "default"}
            data-on={active ? "1" : "0"}
            aria-pressed={active}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange?.(role);
            }}
          >
            <span aria-hidden="true">{workspaceRoleShortLabel(role)}</span>
          </button>
        );
      })}
    </div>
  );
}

export {
  normalizeWorkspaceRole
};
