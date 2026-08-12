"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { CAPABILITY_TEMPLATE_KEYS, CAPABILITY_TEMPLATES, ORGANIZATION_SEAT_ROLES } from "@/lib/org/constants";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Kutsete haldus.
 *
 * TOORE LINK kuvatakse ainult üks kord ja seda ei salvestata kuhugi. Andmebaasis
 * on ainult räsi — kui link kaob, tuleb saata uus kutse. See on teadlik piir,
 * mitte puudujääk.
 */
export default function OrgInvitesClient({ context, initialPage, units }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [invites, setInvites] = useState(initialPage?.items || []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor || null);
  const [email, setEmail] = useState("");
  const [seatRole, setSeatRole] = useState("SOCIAL_WORKER");
  const [templateKey, setTemplateKey] = useState("MEMBER");
  const [primaryUnitId, setPrimaryUnitId] = useState("");
  const [issuedLink, setIssuedLink] = useState("");

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;
  const templateNeedsUnit = CAPABILITY_TEMPLATES[templateKey]?.scope === "UNIT";

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/invites`);
    if (payload?.items) {
      setInvites(payload.items);
      setNextCursor(payload.nextCursor || null);
    }
  }, [call, organizationId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const payload = await call(`/api/org/${organizationId}/invites?cursor=${encodeURIComponent(nextCursor)}`);
    if (!payload?.items) return;
    setInvites((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...payload.items.filter((item) => !known.has(item.id))];
    });
    setNextCursor(payload.nextCursor || null);
  }, [call, nextCursor, organizationId]);

  const create = useCallback(
    async (event) => {
      event.preventDefault();
      setIssuedLink("");
      const payload = await call(`/api/org/${organizationId}/invites`, {
        method: "POST",
        body: {
          email,
          seatRole,
          capabilityTemplate: templateKey,
          primaryUnitId: primaryUnitId || null
        },
        fallbackKey: "org.errors.invite_create_failed"
      });
      if (payload?.inviteToken) {
        setIssuedLink(`${window.location.origin}/org/liitu?token=${encodeURIComponent(payload.inviteToken)}`);
        setEmail("");
        await reload();
      }
    },
    [call, email, organizationId, primaryUnitId, reload, seatRole, templateKey]
  );

  const revoke = useCallback(
    async (inviteId) => {
      const payload = await call(`/api/org/${organizationId}/invites/${inviteId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.invite_revoke_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.invites.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.invites.intro")}</p>
      </div>

      {writable ? (
        <Form className="ow-card" onSubmit={create}>
          <div className="ow-grid">
            <label>
              <span className="ow-meta__term">{t("org.invites.email")}</span>
              <Input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.invites.seatRole")}</span>
              <Dropdown
                value={seatRole}
                onChange={setSeatRole}
                ariaLabel={t("org.invites.seatRole")}
                options={ORGANIZATION_SEAT_ROLES.map((role) => ({
                  value: role,
                  label: t(`org.seatRole.${role}`)
                }))}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.invites.template")}</span>
              <Dropdown
                value={templateKey}
                onChange={setTemplateKey}
                ariaLabel={t("org.invites.template")}
                options={CAPABILITY_TEMPLATE_KEYS.map((key) => ({
                  value: key,
                  label: t(CAPABILITY_TEMPLATES[key].labelKey)
                }))}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.invites.unit")}</span>
              <Dropdown
                required={templateNeedsUnit}
                value={primaryUnitId}
                onChange={setPrimaryUnitId}
                ariaLabel={t("org.invites.unit")}
                options={[
                  { value: "", label: "—" },
                  ...units.map((unit) => ({ value: unit.id, label: unit.name }))
                ]}
              />
            </label>
          </div>
          <div className="ow-actions">
            {/* Üksuse VÄRAV. Varem hoidis seda kinni natiivne `required`
                <select>'il; oma valikmenüü juures tuleb värav siia, muidu
                saaks üksusepõhise malli kutse välja saata ilma üksuseta.
                Põhjust ütleb välja all seisev vihje (.dd-required). */}
            <Button type="submit" disabled={busy || (templateNeedsUnit && !primaryUnitId)}>
              {t("org.invites.create")}
            </Button>
          </div>
        </Form>
      ) : null}

      {issuedLink ? (
        <div className="ow-card">
          <h3 className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.invites.linkHeading")}
          </h3>
          <p className="ow-subtitle">{t("org.invites.linkHint")}</p>
          <p className="ow-code">{issuedLink}</p>
        </div>
      ) : null}

      {invites.length === 0 ? (
        <p className="ow-empty">{t("org.invites.empty")}</p>
      ) : (
        <div className="ow-tablewrap">
          <table className="ow-table">
            <caption>{t("org.invites.heading")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("org.invites.email")}</th>
                <th scope="col">{t("org.invites.seatRole")}</th>
                <th scope="col">{t("org.invites.template")}</th>
                <th scope="col">{t("org.invites.expiresAt")}</th>
                <th scope="col">{t("org.invites.status")}</th>
                <th scope="col">{t("org.members.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td data-label={t("org.invites.email")}>{invite.email}</td>
                  <td data-label={t("org.invites.seatRole")}>{t(`org.seatRole.${invite.seatRole}`)}</td>
                  <td data-label={t("org.invites.template")}>
                    {CAPABILITY_TEMPLATES[invite.capabilityTemplate]
                      ? t(CAPABILITY_TEMPLATES[invite.capabilityTemplate].labelKey)
                      : invite.capabilityTemplate}
                  </td>
                  <td data-label={t("org.invites.expiresAt")}>
                    {new Date(invite.expiresAt).toISOString().slice(0, 10)}
                  </td>
                  <td data-label={t("org.invites.status")}>{invite.status}</td>
                  <td data-label={t("org.members.actions")}>
                    {writable && invite.status === "PENDING" ? (
                      <Button type="button" onClick={() => revoke(invite.id)} disabled={busy}>
                        {t("org.invites.revoke")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor ? (
        <div className="ow-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={loadMore}>
            {t("org.pagination.loadMore")}
          </Button>
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
