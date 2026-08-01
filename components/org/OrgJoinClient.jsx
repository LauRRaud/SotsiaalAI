"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { CAPABILITY_TEMPLATES } from "@/lib/org/constants";

import { useOrgApi } from "./useOrgApi";

/**
 * Kutse vastuvõtt KAHE sammuna (arenduskava §5.5).
 *
 * Samm 1 (GET) näitab, millega inimene nõustub: organisatsioon, üksus,
 * hinnastatav roll, kavandatud õigused. See ei muuda mitte midagi.
 * Samm 2 (POST) on teadlik nõustumine. Lingile klikkimine üksi ei tee kellestki
 * liiget — see on tahtlik ja seda ei tohi „mugavuse pärast" ühte sammu suruda.
 */
export default function OrgJoinClient() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { call, busy, error } = useOrgApi();
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;
    (async () => {
      const payload = await call(`/api/org/join?token=${encodeURIComponent(token)}`, {
        fallbackKey: "org.errors.invite_invalid"
      });
      if (!cancelled && payload?.preview) setPreview(payload.preview);
    })();
    return () => {
      cancelled = true;
    };
  }, [call, token]);

  const respond = useCallback(
    async (action) => {
      const payload = await call("/api/org/join", {
        method: "POST",
        body: { token, action },
        fallbackKey: "org.errors.invite_invalid"
      });
      if (!payload) return;
      if (action === "accept" && payload.organizationId) {
        router.push(`/org/${payload.organizationId}`);
        return;
      }
      setDone(t("org.invites.declined"));
      setPreview(null);
    },
    [call, router, t, token]
  );

  const template = preview ? CAPABILITY_TEMPLATES[preview.capabilityTemplate] : null;

  return (
    <section className="ow-shell">
      <header className="ow-header">
        <div>
          <h1 className="ow-title">{t("org.invites.previewHeading")}</h1>
          <p className="ow-subtitle">{t("org.invites.previewIntro")}</p>
        </div>
      </header>

      {done ? <p className="ow-notice ow-notice--privacy">{done}</p> : null}

      {preview ? (
        <div className="ow-card">
          <dl className="ow-meta">
            <div>
              <dt className="ow-meta__term">{t("org.title")}</dt>
              <dd className="ow-meta__value">{preview.organization.displayName}</dd>
            </div>
            <div>
              <dt className="ow-meta__term">{t("org.invites.seatRole")}</dt>
              <dd className="ow-meta__value">{t(`org.seatRole.${preview.seatRole}`)}</dd>
            </div>
            <div>
              <dt className="ow-meta__term">{t("org.invites.unit")}</dt>
              <dd className="ow-meta__value">{preview.unit?.name || "—"}</dd>
            </div>
            <div>
              <dt className="ow-meta__term">{t("org.invites.template")}</dt>
              <dd className="ow-meta__value">{template ? t(template.labelKey) : preview.capabilityTemplate}</dd>
            </div>
          </dl>

          <h2 className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.members.capabilities")}
          </h2>
          {preview.capabilities.length === 0 ? (
            <p className="ow-empty">{t("org.overview.noCapabilities")}</p>
          ) : (
            <ul className="ow-chips">
              {preview.capabilities.map((capability) => (
                <li key={capability} className="ow-chip">
                  {t(`org.capability.${capability}`)}
                </li>
              ))}
            </ul>
          )}

          <p className="ow-notice ow-notice--privacy">{t("org.personalWorkspaceHint")}</p>

          <div className="ow-actions">
            <Button type="button" onClick={() => respond("accept")} disabled={busy}>
              {t("org.invites.accept")}
            </Button>
            <Button type="button" onClick={() => respond("decline")} disabled={busy}>
              {t("org.invites.decline")}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
