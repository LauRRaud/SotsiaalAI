"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import BackButton from "@/components/ui/BackButton";
import { localizePath } from "@/lib/localizePath";

import { getRagAdminCopy } from "./ragAdminCopy";
import RagAdminRemediationContext from "./RagAdminRemediationContext";

const NAV_ORDER = ["documents", "ingest", "kov", "organizations", "sourcePackages"];

function buildNav(locale, copy) {
  const localized = path => localizePath(path, locale);

  return {
    documents: {
      href: localized("/admin/rag/documents"),
      label: copy.nav.documents
    },
    ingest: {
      href: localized("/admin/rag/ingest"),
      label: copy.nav.ingest
    },
    kov: {
      href: localized("/admin/rag/kov"),
      label: copy.nav.kov
    },
    organizations: {
      href: localized("/admin/rag/organizations"),
      label: copy.nav.organizations
    },
    sourcePackages: {
      href: localized("/admin/rag/source-packages"),
      label: copy.nav.sourcePackages
    }
  };
}

export default function RagAdminPageFrame({
  locale,
  activeKey = "documents",
  title,
  subtitle,
  children
}) {
  const router = useRouter();
  const copy = getRagAdminCopy(locale);
  const nav = buildNav(locale, copy);

  return (
    <section>
      <div>
        <div>
          <BackButton
            ariaLabel={locale?.startsWith("et") ? "Tagasi" : "Back"}
            onClick={() => router.push(localizePath("/", locale))}
          />

          <h1>{title || copy.heading}</h1>
          {subtitle ? <p>{subtitle}</p> : null}

          <nav aria-label={copy.heading}>
            {NAV_ORDER.map(key => {
              const item = nav[key];
              const isActive = activeKey === key;

              return (
                <Link
                  key={key}
                  prefetch={false}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <RagAdminRemediationContext locale={locale} />
        </div>

        {children}
      </div>
    </section>
  );
}
