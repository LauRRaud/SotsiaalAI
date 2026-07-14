"use client";

import Link from "next/link";

import { localizePath } from "@/lib/localizePath";

import { getRagAdminCopy } from "./ragAdminCopy";
import RagAdminRemediationContext from "./RagAdminRemediationContext";

const NAV_ORDER = ["home", "documents", "ingest", "kov", "organizations", "sourcePackages", "sourceFeedback"];

const NAV_PATHS = {
  home: "/admin/rag",
  documents: "/admin/rag/documents",
  ingest: "/admin/rag/ingest",
  kov: "/admin/rag/kov",
  organizations: "/admin/rag/organizations",
  sourcePackages: "/admin/rag/source-packages",
  sourceFeedback: "/admin/rag/source-feedback"
};

/* Täisekraani juhtimiskeskuse raam: kicker + pealkiri vasakul,
   sektsiooninav klaas-pillidena paremal. Sisu paigutab iga vaade
   ise ra-* võrgustikuga (rag-admin.css). */
export default function RagAdminPageFrame({
  locale,
  activeKey = "documents",
  title,
  subtitle,
  children
}) {
  const copy = getRagAdminCopy(locale);

  return (
    <section className="ra-shell">
      <header className="ra-head">
        <div className="ra-head-text">
          <div className="ra-head-kicker">SotsiaalAI · RAG</div>
          <h1>{title || copy.heading}</h1>
          {subtitle ? <p className="ra-head-sub">{subtitle}</p> : null}
        </div>

        <nav aria-label={copy.heading} className="ra-nav">
          {NAV_ORDER.map(key => {
            const isActive = activeKey === key;

            return (
              <Link
                key={key}
                prefetch={false}
                href={localizePath(NAV_PATHS[key], locale)}
                data-variant="default"
                data-selected={isActive ? "true" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{copy.nav[key]}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <RagAdminRemediationContext locale={locale} />

      {children}
    </section>
  );
}
