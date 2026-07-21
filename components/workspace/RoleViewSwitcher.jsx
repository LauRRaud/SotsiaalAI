"use client";

/**
 * RoleViewSwitcher — iseseisev admini S/P/T vaatelüliti.
 *
 * Töölaual, eelpöördumistel, dokumentidel jm on lüliti seotud lehe enda
 * rolliolekuga (nt Töölaua kaardiruudustik loeb `dashboardRole`'i), seega
 * need pinnad kutsuvad AdminRoleViewCycleButton'i otse. Vestluspinnal sellist
 * lokaalset olekut ei ole — roll mõjub serveris (süsteemiprompt, RAG-sihtrühm,
 * vastuse pikkus), seega piisab küpsisest + refresh'ist. See mähis hoiab
 * ChatBodyView' propsid puutumata.
 *
 * Paigutuse annab .admin-role-view-cycle (app/styles/workspace.css):
 * lehel ⓘ-st vasakul, kaardivaates alumise menüüdoki paremal küljel.
 */

import { useI18n } from "@/components/i18n/I18nProvider";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import AdminRoleViewCycleButton from "./AdminRoleViewCycleButton";

export default function RoleViewSwitcher({ ariaLabel = "", className, placement = "panel", onRoleChanged }) {
  const { t, locale } = useI18n();
  const { effectiveRole, isAdmin, isRoleResolved, refresh } = useEffectiveRole();

  if (!isAdmin || !isRoleResolved) return null;

  /* refresh värskendab selle mähise oma hooki; onRoleChanged laseb ka
     kutsuval pinnal (nt RoomStage töölaud) oma rolliolekut värskendada, et
     kaardid vahetuksid KOHE, mitte alles järgmisel laadimisel. */
  const handleRoleChanged = (user) => {
    refresh();
    onRoleChanged?.(user);
  };

  return (
    <AdminRoleViewCycleButton
      t={t}
      locale={locale}
      value={effectiveRole}
      onRoleChanged={handleRoleChanged}
      ariaLabel={ariaLabel || undefined}
      className={className}
      placement={placement}
    />
  );
}
