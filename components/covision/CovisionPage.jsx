"use client";

import CovisionWorkspace from "@/components/covision/CovisionWorkspace";

/* Production entry: an explicit real-case/queued-seed chooser followed by the
   server-backed eight-stage session. The old local demo is intentionally not
   mounted on this path. */
export default function CovisionPage() {
  return (
    <div className="covision-page">
      <CovisionWorkspace />
    </div>
  );
}
