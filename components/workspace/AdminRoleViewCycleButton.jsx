"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import WorkspaceRoleCycleButton, { normalizeWorkspaceRole } from "./WorkspaceRoleCycleButton";

export default function AdminRoleViewCycleButton({
  t,
  locale,
  value,
  onRoleChanged,
  className,
  ariaLabel,
  placement = "panel"
}) {
  const i18n = useI18n();
  const router = useRouter();
  const translate = t || i18n?.t;
  const activeLocale = locale || i18n?.locale || "et";
  const [optimisticRole, setOptimisticRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /* Lehesiseses vaates tõstetakse lüliti otse PanelFrame'i .panel-i alla.
     Nii jagab ta ⓘ ja × nuppudega sama sisaldusplokki ning püsib igas
     paneelimõõdus täpselt ⓘ-st vasakul. Kaardivaates renderdatakse lüliti
     kohapeal alumise menüüdoki kõrval. */
  const [portalHost, setPortalHost] = useState(null);

  useEffect(() => {
    setOptimisticRole("");
  }, [value]);

  useEffect(() => {
    if (placement !== "panel") {
      setPortalHost(null);
      return;
    }
    setPortalHost(document.querySelector(".panel"));
  }, [placement]);

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
      /* Vaateroll elab küpsises, mida loevad serveri-komponendid
         (resolveSessionRoleState). Ilma refresh'ita jääks leht vana rolli
         serverisisuga: nt /documents suunab CLIENT-vaate /dokreziim'i alles
         järgmisel laadimisel — admin klikiks S/P/T ja "midagi ei juhtuks". */
      router.refresh();
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

  const control = (
    <div
      className={cn(
        "admin-role-view-cycle",
        placement === "cards" && "admin-role-view-cycle--cards",
        className
      )}
    >
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

  if (placement === "cards") return control;
  if (!portalHost) return null;
  return createPortal(control, portalHost);
}
