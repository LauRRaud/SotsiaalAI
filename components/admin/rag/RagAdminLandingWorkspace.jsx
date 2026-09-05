"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import RagAdminContactRegistryPanel from "./RagAdminContactRegistryPanel";
import RagAdminPageFrame from "./RagAdminPageFrame";
import { getRagAdminCopy } from "./ragAdminCopy";

export default function RagAdminLandingWorkspace({ locale }) {
  const { t } = useI18n();
  const copy = getRagAdminCopy(locale);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function selftest() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/rag/selftest", { method: "POST", cache: "no-store", credentials: "same-origin" });
      const payload = await response.json();
      setResult(t(payload.messageKey || "admin.rag.errors.selftest_failed"));
    } catch {
      setResult(t("admin.rag.errors.selftest_failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <RagAdminPageFrame locale={locale} activeKey="home" title={copy.heading} subtitle={t("api.rag.retired")}>
      <section className="ra-card">
        <Button type="button" onClick={selftest} disabled={busy}>
          {t(busy ? "admin.rag.selftest.running" : "admin.rag.selftest.run")}
        </Button>
        {result ? <p role="status">{result}</p> : null}
      </section>
      <RagAdminContactRegistryPanel />
    </RagAdminPageFrame>
  );
}
