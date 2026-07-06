"use client";

import Link from "next/link";

import BackButton from "@/components/ui/BackButton";
import { localizePath } from "@/lib/localizePath";

import RagAdminContactRegistryPanel from "./RagAdminContactRegistryPanel";
import RagAdminKovSourceMonitorPanel from "./RagAdminKovSourceMonitorPanel";
import RagAdminRtRegistryPanel from "./RagAdminRtRegistryPanel";
import { getRagAdminCopy } from "./ragAdminCopy";

const NAV_KEYS = ["documents", "ingest", "kov", "organizations", "sourcePackages"];

export default function RagAdminLandingWorkspace({ locale }) {
  const copy = getRagAdminCopy(locale);

  return (
    <section>
      <div>
        <div>
          <BackButton
            ariaLabel={locale?.startsWith("et") ? "Tagasi" : "Back"}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign(localizePath("/", locale));
              }
            }}
          />

          <h1>{copy.heading}</h1>

          <nav aria-label={copy.heading}>
            {NAV_KEYS.map(key => (
              <Link
                key={key}
                prefetch={false}
                href={localizePath(`/admin/rag/${key === "documents" ? "documents" : key === "sourcePackages" ? "source-packages" : key}`)}
              >
                <span>{copy.nav[key]}</span>
              </Link>
            ))}
          </nav>

          <RagAdminContactRegistryPanel />
          <RagAdminKovSourceMonitorPanel />
          <RagAdminRtRegistryPanel />
        </div>
      </div>
    </section>
  );
}
