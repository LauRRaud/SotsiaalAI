"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * Isikuandmete hoiatuse lüliti konto seadetes (omaniku soov 11.10.2026).
 *
 * Üks rida samas kujus nagu teised konto toimingud: vasakul lause, mis ütleb praeguse seisu
 * ja mida see tähendab, paremal nupp, mis seisu vahetab. Otsuse teeb server igal kontrollil
 * andmebaasist (`lib/privacy/promptPreference.js`); see rida ainult salvestab valiku
 * (`PUT /api/profile/privacy-prompt`).
 */
export default function PrivacyPromptRow({ initialEnabled = true, disabled = false, onSaved }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(initialEnabled !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    if (busy) return;
    const next = !enabled;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/privacy-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ enabled: next })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "profile.privacy_prompt.save_failed" }));
        return;
      }
      const saved = payload.enabled !== false;
      setEnabled(saved);
      onSaved?.(saved);
    } catch {
      setError(t("profile.privacy_prompt.save_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="konto-row" aria-busy={busy} data-privacy-prompt={enabled ? "on" : "off"}>
      <div className="konto-row__text">
        {/* `aria-live`, mitte `role="status"`: olekuteate stiil värviks püsiva selgituse
            teiseks kui naaberridadel (mõõdetud brauseris). */}
        <p className="konto-hint" aria-live="polite">
          {enabled ? t("profile.privacy_prompt.on_hint") : t("profile.privacy_prompt.off_hint")}
        </p>
        {error ? (
          <p className="konto-hint" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="button" onClick={toggle} disabled={disabled || busy}>
        {enabled ? t("profile.privacy_prompt.turn_off") : t("profile.privacy_prompt.turn_on")}
      </Button>
    </div>
  );
}
