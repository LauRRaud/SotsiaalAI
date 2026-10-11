"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";
import { announceViewRole, claimPageSwitch, hasPageSwitch, watchPageSwitch } from "@/lib/viewRoleSignal";
import WorkspaceRoleCycleButton, { normalizeWorkspaceRole } from "./WorkspaceRoleCycleButton";

export default function AdminRoleViewCycleButton({
  t,
  locale,
  value,
  onRoleChanged,
  className,
  ariaLabel,
  placement = "corner",
  fallback = false
}) {
  const i18n = useI18n();
  const router = useRouter();
  const translate = t || i18n?.t;
  const activeLocale = locale || i18n?.locale || "et";
  const [optimisticRole, setOptimisticRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /* Lehtedel elab lüliti EKRAANI alumises paremas nurgas, samas kohas kus
     peamenüüs (omanik 10.10: „rolli vahetuse nupud peaks olema lehe enda all
     nurgas, nii nagu on peamenüüs"). Varem portaaliti ta paneeli ülanurka ⓘ
     kõrvale ja hõljus seal lehe sisu peal.
     Portaal läheb <body>-sse, mitte paneeli: klaaspaneelil on
     `backdrop-filter`, mis teeb paneelist `position: fixed` lapse
     sisaldusploki, ja „nurk" oleks siis paneeli, mitte ekraani oma.
     `placement="cards"`: peamenüü, lüliti renderdatakse kohapeal doki kõrval.
     `placement="inline"`: leht paneb lüliti ise oma pinnale (koha annab
     `className`): kaardilehel ei ole ekraani nurk vaba.
     `fallback`: ruumi varuvalik dokiga lehtedel; jääb ära, kui lehel on oma
     lüliti (vt lib/viewRoleSignal.js). */
  const [portalHost, setPortalHost] = useState(null);
  const pageHasSwitch = useSyncExternalStore(watchPageSwitch, hasPageSwitch, () => true);

  useEffect(() => {
    if (fallback || placement === "cards") return undefined;
    return claimPageSwitch();
  }, [fallback, placement]);

  useEffect(() => {
    setOptimisticRole("");
  }, [value]);

  useEffect(() => {
    setPortalHost(placement === "corner" ? document.body : null);
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
      announceViewRole(payload?.user || {});
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
        placement === "cards" ? "admin-role-view-cycle--cards" : "admin-role-view-cycle--corner",
        placement === "inline" && "admin-role-view-cycle--inline",
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

  if (fallback && pageHasSwitch) return null;
  if (placement !== "corner") return control;
  if (!portalHost) return null;
  return createPortal(control, portalHost);
}
