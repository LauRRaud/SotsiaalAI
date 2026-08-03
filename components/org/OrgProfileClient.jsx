"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Organisatsiooni teenuseprofiil.
 *
 * TOIMETAJAD ON NIMEDEGA (§5.9: „jagatud kontot ei looda"). Loend ei ole
 * kaunistus — ta on selle nõude nähtav pool: iga toimetaja on inimene, kelle
 * auditijälg on eraldi.
 *
 * SALVESTAMINE KANNAB VERSIOONI (`expectedUpdatedAt`). Kaks toimetajat võivad
 * sama profiili korraga avada; kes teisena salvestab, saab 409 ega kirjuta
 * esimese muudatust vaikselt üle.
 */
export default function OrgProfileClient({ context, profile, editors, convertibleProfile }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [form, setForm] = useState(() => ({
    organizationName: profile?.organizationName || "",
    shortDescription: profile?.shortDescription || "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    website: profile?.website || ""
  }));
  const [convertConfirmed, setConvertConfirmed] = useState(false);

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const save = useCallback(
    async (event) => {
      event.preventDefault();
      const payload = await call(`/api/org/${organizationId}/teenusprofiil`, {
        method: "PATCH",
        body: { profileId: profile.id, expectedUpdatedAt: profile.updatedAt, ...form },
        fallbackKey: "org.errors.profile_update_failed"
      });
      if (payload) window.location.reload();
    },
    [call, form, organizationId, profile]
  );

  const convert = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/teenusprofiil`, {
      method: "POST",
      body: { profileId: convertibleProfile.id, ownerConfirmed: convertConfirmed },
      fallbackKey: "org.errors.profile_convert_failed"
    });
    if (payload) window.location.reload();
  }, [call, convertConfirmed, convertibleProfile, organizationId]);

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.profile.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.profile.intro")}</p>
      </div>

      {profile ? (
        <>
          <Form className="ow-card" onSubmit={save}>
            <div className="ow-grid">
              {[
                ["organizationName", t("org.create.displayName")],
                ["phone", t("org.profile.phone")],
                ["email", t("org.profile.email")],
                ["website", t("org.profile.website")]
              ].map(([field, label]) => (
                <label key={field}>
                  <span className="ow-meta__term">{label}</span>
                  <input
                    value={form[field]}
                    onChange={(event) => setForm((old) => ({ ...old, [field]: event.target.value }))}
                    style={{ width: "100%" }}
                  />
                </label>
              ))}
            </div>
            <label>
              <span className="ow-meta__term">{t("org.profile.shortDescription")}</span>
              <textarea
                rows={3}
                value={form.shortDescription}
                onChange={(event) => setForm((old) => ({ ...old, shortDescription: event.target.value }))}
                style={{ width: "100%" }}
              />
            </label>
            {writable ? (
              <div className="ow-actions">
                <Button type="submit" disabled={busy}>
                  {t("org.profile.save")}
                </Button>
              </div>
            ) : null}
          </Form>

          <section className="ow-card" aria-labelledby="ow-editors">
            <h3 id="ow-editors" className="ow-title" style={{ fontSize: "1rem" }}>
              {t("org.profile.editors")}
            </h3>
            {editors.length === 0 ? (
              <p className="ow-empty">{t("org.profile.noEditors")}</p>
            ) : (
              <ul className="ow-chips">
                {editors.map((editor) => (
                  <li key={editor.membershipId} className="ow-chip">
                    {[editor.firstName, editor.lastName].filter(Boolean).join(" ") || editor.email}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="ow-card">
          <p className="ow-empty">{t("org.profile.noProfile")}</p>
          {convertibleProfile && writable ? (
            <>
              {/* MIS profiili ma üle annan. Üleandmine on pöördumatu tegu ja
                  ilma objekti nimeta on kinnitus pime — kasutaja võib arvata,
                  et jutt on hoopis mõnest teisest profiilist. */}
              <p className="ow-meta__value">
                <span className="ow-meta__term">{t("org.profile.convertSubject")}</span>{" "}
                {convertibleProfile.organizationName || convertibleProfile.id}
              </p>
              <p className="ow-subtitle">{t("org.profile.convertHint")}</p>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={convertConfirmed}
                  onChange={(event) => setConvertConfirmed(event.target.checked)}
                />
                <span>{t("org.profile.convertConfirm")}</span>
              </label>
              <div className="ow-actions">
                <Button type="button" onClick={convert} disabled={busy || !convertConfirmed}>
                  {t("org.profile.convert")}
                </Button>
              </div>
            </>
          ) : null}
        </section>
      )}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
