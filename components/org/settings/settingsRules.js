/**
 * Seadete osa (`/org/<id>/seaded`) ja andmete väljavõtte (`/org/<id>/eksport`)
 * reeglid ilma joonistamiseta: moodulite read, mis seisu muutused on sellel
 * inimesel võimalikud ja kuidas väljavõtte fail nime saab.
 *
 * `ACTIVE` ja `SUSPENDED` siirdeid näeb ainult platvormi admin: identiteedikontroll
 * ei ole midagi, mida organisatsioon saab endale ise anda (arenduskava §7.1).
 * Server keeldub niikuinii; tegevuse peitmine hoiab ära eksitava „proovi ja saa 403".
 *
 * Lehed (`../OrgSettingsClient.jsx`, `../OrgExportClient.jsx`) hoiavad olekut ja
 * teevad päringud, vaated (`./SettingsViews.jsx`) joonistavad.
 * Test: `tests/org-admin-views.test.mjs`.
 */

import { ORGANIZATION_MODULE_KEYS } from "@/lib/org/constants";

/** Seadete vaated lahtritena. */
export const SETTINGS_TABS = Object.freeze(["modules", "status", "export"]);

/**
 * Moodulite read. Koduteenus ilmub alles siis, kui pind on lipuga avatud või
 * moodul on juba aktiivne; server keeldub aktiveerimisest niikuinii.
 * Kirjutuskaitstud organisatsioonis (mustand, peatatud) mooduleid lülitada ei saa.
 */
export function moduleRows(activeModules, { t, homeCareUi = false, writable = true } = {}) {
  const active = new Set(activeModules || []);
  return ORGANIZATION_MODULE_KEYS.filter((moduleKey) => moduleKey !== "HOME_CARE" || active.has(moduleKey) || homeCareUi).map((moduleKey) => ({
    key: moduleKey,
    name: t(`org.module.${moduleKey}`),
    active: active.has(moduleKey),
    chip: t(active.has(moduleKey) ? "org.settings.module_on" : "org.settings.module_off"),
    canToggle: Boolean(writable)
  }));
}

/**
 * Seisu muutused, mis sellel inimesel selles seisus on: `[{ toStatus, label,
 * confirm, note, primary }]`. `confirm` tähendab teist vajutust samal nupul ja
 * `note` on lause, mis ütleb enne teist vajutust, mis juhtub.
 *
 * Peatatud organisatsiooni taastamine on siin olemas (vanal lehel nuppu ei
 * olnud, kuigi server siiret lubab): muidu sai platvormi admin organisatsiooni
 * peatada, aga mitte tagasi tööle panna.
 */
export function lifecycleActions(status, { isPlatformAdmin = false } = {}) {
  const actions = [];
  if (status === "DRAFT") actions.push({ toStatus: "PENDING_VERIFICATION", label: "org.settings.submitForVerification", primary: true });
  if (isPlatformAdmin && status === "PENDING_VERIFICATION") actions.push({ toStatus: "ACTIVE", label: "org.settings.activate_org", primary: true });
  if (isPlatformAdmin && status === "SUSPENDED") actions.push({ toStatus: "ACTIVE", label: "org.settings.restore_org", primary: true });
  if (isPlatformAdmin && status === "ACTIVE") actions.push({ toStatus: "SUSPENDED", label: "org.settings.suspend_org", confirm: "org.settings.suspend_org_confirm", note: "org.settings.suspend_org_note" });
  if (status && status !== "ARCHIVED") actions.push({ toStatus: "ARCHIVED", label: "org.settings.archive", confirm: "org.settings.archive_confirm", note: "org.settings.archiveHint" });
  return actions;
}

/** Väljavõtte faili nimi: `organisatsioon-<id>-<päev>.json`. */
export function exportFileName(organizationId, generatedAt) {
  return `organisatsioon-${organizationId}-${String(generatedAt || "").slice(0, 10)}.json`;
}

/** ISO hetk → `11.10.2026 09.30` inimese enda ajavööndis. Vigane väärtus annab tühja sõne. */
export function stampOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}.${two(date.getMinutes())}`;
}
