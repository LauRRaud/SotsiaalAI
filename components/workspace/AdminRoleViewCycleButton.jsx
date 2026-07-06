"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import WorkspaceRoleCycleButton, { normalizeWorkspaceRole } from "./WorkspaceRoleCycleButton";

export default function AdminRoleViewCycleButton({
  t,
  locale,
  value,
  onRoleChanged,
  className,
  ariaLabel
}) {
  const i18n = useI18n();
  const translate = t || i18n?.t;
  const activeLocale = locale || i18n?.locale || "et";
  const [optimisticRole, setOptimisticRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOptimisticRole("");
  }, [value]);

  async function handleChange(nextRole) {
    if (saving) return;
    const normalizedRole = normalizeWorkspaceRole(nextRole);
    setSaving(true);
    setError("");
    setOptimisticRole(normalizedRole);

    try {
      const response = await fetch("/api/profile/view-role", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": activeLocale
        },
        body: JSON.stringify({ viewRole: normalizedRole })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Role view switch failed.");
      }
      onRoleChanged?.(payload?.user || {});
    } catch (switchError) {
      setOptimisticRole("");
      setError(
        switchError?.message ||
          (typeof translate === "function"
            ? translate("profile.view_mode.save_failed", "Vaate vahetamine ebaonnestus.")
            : "Vaate vahetamine ebaonnestus.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("admin-role-view-cycle", className)}>
      <WorkspaceRoleCycleButton
        t={translate}
        value={optimisticRole || value}
        onChange={handleChange}
        disabled={saving}
        ariaLabel={
          ariaLabel ||
          (typeof translate === "function"
            ? translate("chat.workspace.view_role.label", "Toolaua vaade")
            : "Toolaua vaade")
        }
      />
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </div>
  );
}
