/**
 * Deliberately classified admin pages.
 *
 * This is the single navigation/contract source for the URL-restorable admin
 * hub and its persistent dock. A newly implemented admin page module
 * must be classified here or the XFUNC contract test fails.
 */
export const ADMIN_SURFACES = Object.freeze([
  { key: "analytics", href: "/admin/analytics", group: "operations", labelKey: "admin.hub.items.analytics" },
  { key: "wellbeing", href: "/admin/wellbeing", group: "operations", labelKey: "admin.hub.items.wellbeing" },
  { key: "urgent-desks", href: "/admin/urgent-desks", group: "operations", labelKey: "admin.hub.items.urgent_desks" },
  { key: "service-availability", href: "/admin/service-availability", group: "operations", labelKey: "admin.hub.items.service_availability" },
  { key: "mentorlus", href: "/admin/mentorlus", group: "operations", labelKey: "admin.hub.items.mentoring" },
  { key: "framework-acceptances", href: "/admin/framework-acceptances", group: "operations", labelKey: "admin.hub.items.framework_acceptances" },
  { key: "rag", href: "/admin/rag", group: "knowledge", labelKey: "admin.hub.items.rag" },
  { key: "rag-documents", href: "/admin/rag/documents", group: "knowledge", labelKey: "admin.hub.items.rag_documents" },
  { key: "rag-ingest", href: "/admin/rag/ingest", group: "knowledge", labelKey: "admin.hub.items.rag_ingest" },
  { key: "rag-kov", href: "/admin/rag/kov", group: "knowledge", labelKey: "admin.hub.items.rag_kov" },
  { key: "rag-organizations", href: "/admin/rag/organizations", group: "knowledge", labelKey: "admin.hub.items.rag_organizations" },
  { key: "rag-source-feedback", href: "/admin/rag/source-feedback", group: "knowledge", labelKey: "admin.hub.items.rag_source_feedback" },
  { key: "rag-source-packages", href: "/admin/rag/source-packages", group: "knowledge", labelKey: "admin.hub.items.rag_source_packages" },
]);

export const ADMIN_SURFACE_PATHS = Object.freeze(
  ADMIN_SURFACES.map(surface => surface.href)
);
