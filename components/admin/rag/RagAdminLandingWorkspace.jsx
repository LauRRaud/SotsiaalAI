"use client";

import Link from "next/link";

import { localizePath } from "@/lib/localizePath";

import RagAdminContactRegistryPanel from "./RagAdminContactRegistryPanel";
import RagAdminKovSourceMonitorPanel from "./RagAdminKovSourceMonitorPanel";
import RagAdminMasterSourcesPanel from "./RagAdminMasterSourcesPanel";
import RagAdminRtRegistryPanel from "./RagAdminRtRegistryPanel";
import RagAdminPageFrame from "./RagAdminPageFrame";
import { getRagAdminCopy } from "./ragAdminCopy";

/* Mooduli glüüfid (stroke = currentColor, helendav toon tuleb CSS-ist) */
const MODULE_ICONS = {
  "/admin/rag/documents": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  "/admin/rag/ingest": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  "/admin/rag/kov": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  "/admin/rag/organizations": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20v-1a5 5 0 0 1 10 0v1" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.6a4.2 4.2 0 0 1 5.5 4V20" />
    </svg>
  ),
  "/admin/rag/source-packages": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </svg>
  )
};

/* Avaleht = juhtimiskeskuse ülevaade: viis moodulkaarti (alamvaated)
   + kolm registriseire paneeli kõrvuti täislaiuses võrgustikus. */
export default function RagAdminLandingWorkspace({ locale }) {
  const copy = getRagAdminCopy(locale);

  return (
    <RagAdminPageFrame
      locale={locale}
      activeKey="home"
      title={copy.heading}
      subtitle={copy.subtitle}
    >
      <div className="ra-modules">
        {copy.landing.cards.map(card => (
          <Link
            key={card.href}
            prefetch={false}
            href={localizePath(card.href, locale)}
            className="ra-module"
          >
            {MODULE_ICONS[card.href] ? (
              <span className="ra-module-icon">{MODULE_ICONS[card.href]}</span>
            ) : null}
            <span className="ra-module-title">{card.title}</span>
            <span className="ra-module-desc">{card.body}</span>
          </Link>
        ))}
      </div>

      <div className="ra-grid">
        <div className="ra-col-4">
          <RagAdminMasterSourcesPanel locale={locale} />
        </div>
        <div className="ra-col-4">
          <RagAdminContactRegistryPanel />
        </div>
        <div className="ra-col-4">
          <RagAdminKovSourceMonitorPanel />
        </div>
        <div className="ra-col-4">
          <RagAdminRtRegistryPanel />
        </div>
      </div>
    </RagAdminPageFrame>
  );
}
