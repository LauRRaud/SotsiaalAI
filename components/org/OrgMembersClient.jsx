"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Liikmete haldusvaade.
 *
 * SIIN EI OLE JA EI TOHI TULLA: „viimati aktiivne", kasutuskordi, vestluste
 * arvu, tootlikkust ega ühtegi privaatset kirjet (arenduskava §7.4). Server ei
 * saada neid välju; see komponent ei tohi neid ka tuletada.
 */
export default function OrgMembersClient({ context, initialMembers, units, canGrant }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [members, setMembers] = useState(initialMembers || []);

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/members`);
    if (payload?.members) setMembers(payload.members);
  }, [call, organizationId]);

  const act = useCallback(
    async (membershipId, action) => {
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "PATCH",
        body: { action },
        fallbackKey: "org.errors.member_update_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const end = useCallback(
    async (membershipId) => {
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.member_end_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const setUnit = useCallback(
    async (membershipId, unitId) => {
      if (!unitId) return;
      const payload = await call(`/api/org/${organizationId}/members/${membershipId}`, {
        method: "PATCH",
        body: { action: "setPrimaryUnit", unitId },
        fallbackKey: "org.errors.member_update_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const revoke = useCallback(
    async (membershipId, grantId) => {
      const payload = await call(
        `/api/org/${organizationId}/members/${membershipId}/capabilities/${grantId}`,
        { method: "DELETE", fallbackKey: "org.errors.capability_revoke_failed" }
      );
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.members.heading")}
        </h2>
        <p className="ow-notice ow-notice--privacy">{t("org.members.privacyNotice")}</p>
      </div>

      {members.length === 0 ? (
        <p className="ow-empty">{t("org.members.empty")}</p>
      ) : (
        <div className="ow-tablewrap">
          <table className="ow-table">
            <caption>{t("org.members.heading")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("org.members.person")}</th>
                <th scope="col">{t("org.members.seatRole")}</th>
                <th scope="col">{t("org.members.units")}</th>
                <th scope="col">{t("org.members.capabilities")}</th>
                <th scope="col">{t("org.members.status")}</th>
                <th scope="col">{t("org.members.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.membershipId}>
                  <td data-label={t("org.members.person")}>
                    {[member.person.firstName, member.person.lastName].filter(Boolean).join(" ") ||
                      member.person.email}
                    <br />
                    <span className="ow-meta__term">{member.person.email}</span>
                  </td>
                  <td data-label={t("org.members.seatRole")}>{t(`org.seatRole.${member.seatRole}`)}</td>
                  <td data-label={t("org.members.units")}>
                    <ul className="ow-chips">
                      {member.units.map((unit) => (
                        <li key={unit.id} className="ow-chip">
                          {unit.name}
                          {unit.isPrimary ? " ★" : ""}
                        </li>
                      ))}
                    </ul>
                    {writable && units.length ? (
                      <label>
                        <span className="ow-meta__term">{t("org.structure.parent")}</span>
                        <select
                          defaultValue=""
                          onChange={(event) => setUnit(member.membershipId, event.target.value)}
                          disabled={busy}
                        >
                          <option value="">—</option>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </td>
                  <td data-label={t("org.members.capabilities")}>
                    <ul className="ow-chips">
                      {member.capabilities.map((grant) => (
                        <li
                          key={grant.id}
                          className={grant.scopeType === "UNIT" ? "ow-chip ow-chip--scope" : "ow-chip"}
                        >
                          {t(`org.capability.${grant.capability}`)}
                          {canGrant && writable ? (
                            <button
                              type="button"
                              onClick={() => revoke(member.membershipId, grant.id)}
                              disabled={busy}
                              aria-label={`${t("org.members.revokeCapability")}: ${t(
                                `org.capability.${grant.capability}`
                              )}`}
                            >
                              ×
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td data-label={t("org.members.status")}>
                    {t(`org.membershipStatus.${member.status}`)}
                  </td>
                  <td data-label={t("org.members.actions")}>
                    <div className="ow-actions">
                      {writable && member.status === "ACTIVE" ? (
                        <Button type="button" onClick={() => act(member.membershipId, "suspend")} disabled={busy}>
                          {t("org.members.suspend")}
                        </Button>
                      ) : null}
                      {writable && member.status === "SUSPENDED" ? (
                        <Button
                          type="button"
                          onClick={() => act(member.membershipId, "reactivate")}
                          disabled={busy}
                        >
                          {t("org.members.reactivate")}
                        </Button>
                      ) : null}
                      {writable && member.status !== "ENDED" ? (
                        <Button type="button" onClick={() => end(member.membershipId)} disabled={busy}>
                          {t("org.members.end")}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
