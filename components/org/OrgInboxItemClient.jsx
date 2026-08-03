"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Ühe pöördumise vaade.
 *
 * KUVATAV SISU tuleb serveri valge nimekirjaga projektsioonist
 * (`projectSourcePackage`) ja on koordinaatorile ning määratud töötajale
 * TÄPSELT SAMA. Siin komponendis ei tohi olla ühtegi välja, mida server ei
 * saatnud — kui midagi puudub, on see serveri otsus, mitte UI puudujääk.
 */
export default function OrgInboxItemClient({ context, item, members, canAssign }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useOrgApi();
  const [assigneeId, setAssigneeId] = useState("");
  const [handoverId, setHandoverId] = useState("");

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;
  const source = item.source || {};
  const assignment = item.assignment || null;
  const isMyAssignment = assignment?.membershipId === context.membership?.id;

  const refresh = useCallback(() => router.refresh(), [router]);

  const assign = useCallback(async () => {
    if (!assigneeId) return;
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}/assign`, {
      method: "POST",
      body: { assigneeMembershipId: assigneeId },
      fallbackKey: "org.errors.work_assign_failed"
    });
    if (payload) refresh();
  }, [assigneeId, call, item.id, organizationId, refresh]);

  const respond = useCallback(
    async (action) => {
      const payload = await call(`/api/org/${organizationId}/assignments/${assignment.id}`, {
        method: "PATCH",
        body: { action },
        fallbackKey: "org.errors.work_response_failed"
      });
      if (payload) refresh();
    },
    [assignment, call, organizationId, refresh]
  );

  const handOver = useCallback(async () => {
    if (!handoverId) return;
    const payload = await call(`/api/org/${organizationId}/assignments/${assignment.id}`, {
      method: "POST",
      body: { toMembershipId: handoverId },
      fallbackKey: "org.errors.work_handover_failed"
    });
    if (payload) refresh();
  }, [assignment, call, handoverId, organizationId, refresh]);

  const close = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/inbox/${item.id}`, {
      method: "PATCH",
      body: { toStatus: "CLOSED" },
      fallbackKey: "org.errors.inbox_transition_failed"
    });
    if (payload) router.push(`/org/${organizationId}/vastuvott`);
  }, [call, item.id, organizationId, router]);

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <Link className="ow-nav__link" href={`/org/${organizationId}/vastuvott`}>
          {t("org.inbox.backToList")}
        </Link>
        <dl className="ow-meta">
          <div>
            <dt className="ow-meta__term">{t("org.inbox.status")}</dt>
            <dd className="ow-meta__value">{t(`org.inboxStatus.${item.status}`)}</dd>
          </div>
          <div>
            <dt className="ow-meta__term">{t("org.inbox.assignee")}</dt>
            <dd className="ow-meta__value">
              {assignment ? t(`org.workStatus.${assignment.status}`) : t("org.inbox.unassigned")}
            </dd>
          </div>
          {item.urgencyDeclaredBySender ? (
            <div>
              <dt className="ow-meta__term">{t("org.inbox.urgency")}</dt>
              <dd className="ow-meta__value">{item.urgencyDeclaredBySender}</dd>
            </div>
          ) : null}
        </dl>
        <p className="ow-notice ow-notice--privacy">{t("org.inbox.openedNotice")}</p>
      </div>

      <section className="ow-card" aria-labelledby="ow-package">
        <h2 id="ow-package" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.inbox.sourcePackage")}
        </h2>
        <dl className="ow-meta">
          <div>
            <dt className="ow-meta__term">{t("org.inbox.topic")}</dt>
            <dd className="ow-meta__value">{source.topic || "—"}</dd>
          </div>
        </dl>
        <div>
          <h3 className="ow-meta__term">{t("org.inbox.situation")}</h3>
          <p className="ow-meta__value" style={{ whiteSpace: "pre-wrap" }}>
            {source.situation || "—"}
          </p>
        </div>
        {source.userEditedDraft || source.generatedDraft ? (
          <div>
            <h3 className="ow-meta__term">{t("org.inbox.draft")}</h3>
            <p className="ow-meta__value" style={{ whiteSpace: "pre-wrap" }}>
              {source.userEditedDraft || source.generatedDraft}
            </p>
          </div>
        ) : null}
      </section>

      {writable ? (
        <section className="ow-card" aria-labelledby="ow-work">
          <h2 id="ow-work" className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.members.actions")}
          </h2>
          <div className="ow-actions">
            {canAssign && !assignment ? (
              <>
                <label>
                  <span className="ow-meta__term">{t("org.inbox.assign")}</span>
                  <Dropdown
                    value={assigneeId}
                    onChange={setAssigneeId}
                    ariaLabel={t("org.inbox.assign")}
                    placeholder="—"
                    options={members.map((member) => ({
                      value: member.membershipId,
                      label:
                        [member.person.firstName, member.person.lastName].filter(Boolean).join(" ") ||
                        member.person.email
                    }))}
                  />
                </label>
                <Button type="button" onClick={assign} disabled={busy || !assigneeId}>
                  {t("org.inbox.assign")}
                </Button>
              </>
            ) : null}

            {/* Vastu võtta või tagasi lükata saab AINULT määratud inimene ise —
                juht ei saa töötaja eest vastutust võtta. */}
            {isMyAssignment && assignment.status === "PENDING" ? (
              <>
                <Button type="button" onClick={() => respond("accept")} disabled={busy}>
                  {t("org.inbox.accept")}
                </Button>
                <Button type="button" onClick={() => respond("reject")} disabled={busy}>
                  {t("org.inbox.reject")}
                </Button>
              </>
            ) : null}

            {assignment && (canAssign || isMyAssignment) ? (
              <>
                <label>
                  <span className="ow-meta__term">{t("org.inbox.handOver")}</span>
                  <Dropdown
                    value={handoverId}
                    onChange={setHandoverId}
                    ariaLabel={t("org.inbox.handOver")}
                    placeholder="—"
                    options={members
                      .filter((member) => member.membershipId !== assignment.membershipId)
                      .map((member) => ({
                        value: member.membershipId,
                        label:
                          [member.person.firstName, member.person.lastName].filter(Boolean).join(" ") ||
                          member.person.email
                      }))}
                  />
                </label>
                <Button type="button" onClick={handOver} disabled={busy || !handoverId}>
                  {t("org.inbox.handOver")}
                </Button>
              </>
            ) : null}

            {canAssign ? (
              <Button type="button" onClick={close} disabled={busy}>
                {t("org.inbox.close")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
