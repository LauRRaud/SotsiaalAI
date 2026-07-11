"use client";

import CovisionSession from "@/components/covision/CovisionSession";

/* Kovisiooni leht = uus 8-etapiline sessioonilõuend (spec:
   Kovisioon/kovisiooni digitaalne lõuend.md). Paneeli kroom
   (pealkiri, ⓘ, sulgemine) tuleb WorkspacePanel/PanelFrame'ist. */
export default function CovisionPage({ embedded = false, onBack = null, hideHeader = false }) {
  return (
    <div className="covision-page">
      {hideHeader ? null : <h1 className="sr-only">Kovisioon</h1>}
      <CovisionSession />
    </div>
  );
}
