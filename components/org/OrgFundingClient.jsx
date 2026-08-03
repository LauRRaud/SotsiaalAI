"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import {
  CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS,
  ORGANIZATION_SEAT_ROLES,
  SEAT_ROLE_REFERENCE_PRICE_CENTS
} from "@/lib/org/constants";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/**
 * Rahastuse vaade.
 *
 * MIDA SIIN EI OLE JA EI TULE: ühegi inimese kasutussagedust, vestluste arvu,
 * aktiivsusaega ega tootlikkust. Organisatsioon näeb, KELLE eest ta maksab —
 * mitte seda, mida see inimene teeb (arenduskava §5.6, §7.4).
 */
function formatCents(cents, locale) {
  return new Intl.NumberFormat(locale || "et", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2
  }).format((Number(cents) || 0) / 100);
}

export default function OrgFundingClient({ context, initialSeatPlans, initialSponsorships, members }) {
  const { t, locale } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [seatPlans, setSeatPlans] = useState(initialSeatPlans || []);
  const [sponsorships, setSponsorships] = useState(initialSponsorships || []);
  const [seatRole, setSeatRole] = useState("SOCIAL_WORKER");
  const [seatLimit, setSeatLimit] = useState(1);
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [issuedLink, setIssuedLink] = useState("");

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  /* Juba koha saanud inimene ei tohi valikuloendis olla: server keelduks
     (`seat_already_assigned`), aga kasutaja jaoks näeks see välja nagu viga
     tema toimingus. Koht on liikmesuse kohta ÜKS, seega arvestame kõiki
     plaane, mitte ainult käesolevat. */
  const seatedMembershipIds = new Set(
    seatPlans.flatMap((plan) => plan.assignments.map((assignment) => assignment.membershipId))
  );

  const reload = useCallback(async () => {
    const [plans, sponsors] = await Promise.all([
      call(`/api/org/${organizationId}/seats`),
      call(`/api/org/${organizationId}/sponsorships`)
    ]);
    if (plans?.seatPlans) setSeatPlans(plans.seatPlans);
    if (sponsors?.sponsorships) setSponsorships(sponsors.sponsorships);
  }, [call, organizationId]);

  const addPlan = useCallback(
    async (event) => {
      event.preventDefault();
      const payload = await call(`/api/org/${organizationId}/seats`, {
        method: "POST",
        body: { seatRole, seatLimit: Number(seatLimit) },
        fallbackKey: "org.errors.seat_plan_create_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload, seatLimit, seatRole]
  );

  const assign = useCallback(
    async (seatPlanId, membershipId) => {
      if (!membershipId) return;
      const payload = await call(`/api/org/${organizationId}/seats/${seatPlanId}/assignments`, {
        method: "POST",
        body: { membershipId },
        fallbackKey: "org.errors.seat_assign_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const release = useCallback(
    async (assignmentId) => {
      const payload = await call(`/api/org/${organizationId}/seat-assignments/${assignmentId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.seat_release_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const endPlan = useCallback(
    async (seatPlanId) => {
      const payload = await call(`/api/org/${organizationId}/seats/${seatPlanId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.seat_plan_end_failed"
      });
      if (payload) await reload();
    },
    [call, organizationId, reload]
  );

  const sponsor = useCallback(
    async (event) => {
      event.preventDefault();
      setIssuedLink("");
      const payload = await call(`/api/org/${organizationId}/sponsorships`, {
        method: "POST",
        body: { email: sponsorEmail },
        fallbackKey: "org.errors.sponsorship_create_failed"
      });
      if (payload?.sponsorshipToken) {
        setIssuedLink(
          `${window.location.origin}/org/toetus?token=${encodeURIComponent(payload.sponsorshipToken)}`
        );
        setSponsorEmail("");
        await reload();
      }
    },
    [call, organizationId, reload, sponsorEmail]
  );

  const revokeSponsorship = useCallback(
    async (sponsorshipId) => {
      const payload = await call(`/api/org/${organizationId}/sponsorships/${sponsorshipId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.sponsorship_revoke_failed"
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
          {t("org.funding.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.funding.intro")}</p>
        <p className="ow-notice ow-notice--privacy">{t("org.funding.privacyNotice")}</p>
      </div>

      <section className="ow-card" aria-labelledby="ow-plans">
        <h3 id="ow-plans" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.funding.plans")}
        </h3>

        {seatPlans.length === 0 ? (
          <p className="ow-empty">{t("org.funding.empty")}</p>
        ) : (
          <div className="ow-tablewrap">
            <table className="ow-table">
              <caption>{t("org.funding.plans")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("org.funding.seatRole")}</th>
                  <th scope="col">{t("org.funding.seatLimit")}</th>
                  <th scope="col">{t("org.funding.price")}</th>
                  <th scope="col">{t("org.funding.source")}</th>
                  <th scope="col">{t("org.funding.status")}</th>
                  <th scope="col">{t("org.members.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {seatPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td data-label={t("org.funding.seatRole")}>{t(`org.seatRole.${plan.seatRole}`)}</td>
                    <td data-label={t("org.funding.seatLimit")}>
                      {plan.usedSeats} / {plan.seatLimit}
                      <br />
                      <span className="ow-meta__term">
                        {t("org.funding.free")}: {plan.freeSeats}
                      </span>
                      <ul className="ow-chips">
                        {plan.assignments.map((assignment) => (
                          <li key={assignment.id} className="ow-chip">
                            {[assignment.person.firstName, assignment.person.lastName]
                              .filter(Boolean)
                              .join(" ") || assignment.person.email}
                            {writable ? (
                              <button
                                type="button"
                                onClick={() => release(assignment.id)}
                                disabled={busy}
                                aria-label={`${t("org.funding.release")}: ${assignment.person.email}`}
                              >
                                ×
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td data-label={t("org.funding.price")}>
                      {formatCents(plan.unitPriceCents, locale)}
                      {plan.priceReason ? (
                        <>
                          <br />
                          <span className="ow-meta__term">{plan.priceReason}</span>
                        </>
                      ) : null}
                    </td>
                    <td data-label={t("org.funding.source")}>{t(`org.seatPlanSource.${plan.source}`)}</td>
                    <td data-label={t("org.funding.status")}>{t(`org.seatPlanStatus.${plan.status}`)}</td>
                    <td data-label={t("org.members.actions")}>
                      {writable && plan.status === "ACTIVE" ? (
                        <div className="ow-actions">
                          <label>
                            <span className="ow-meta__term">{t("org.funding.assign")}</span>
                            {/* TOIMINGUMENÜÜ, mitte väli: valik käivitab
                                määramise ja liige liigub kohe ülal olevasse
                                loendisse. Seetõttu jääb menüü ise alati tühja
                                seisu (varem tegi sama `defaultValue=""`). */}
                            <Dropdown
                              value=""
                              disabled={busy}
                              onChange={(membershipId) => assign(plan.id, membershipId)}
                              ariaLabel={t("org.funding.assign")}
                              placeholder={t("org.funding.chooseMember")}
                              options={members
                                .filter(
                                  (member) =>
                                    member.seatRole === plan.seatRole &&
                                    member.status === "ACTIVE" &&
                                    !seatedMembershipIds.has(member.membershipId)
                                )
                                .map((member) => ({
                                  value: member.membershipId,
                                  label:
                                    [member.person.firstName, member.person.lastName]
                                      .filter(Boolean)
                                      .join(" ") || member.person.email
                                }))}
                            />
                          </label>
                          <Button type="button" onClick={() => endPlan(plan.id)} disabled={busy}>
                            {t("org.funding.endPlan")}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {writable ? (
          <Form onSubmit={addPlan} className="ow-grid">
            <label>
              <span className="ow-meta__term">{t("org.funding.seatRole")}</span>
              <Dropdown
                value={seatRole}
                onChange={setSeatRole}
                ariaLabel={t("org.funding.seatRole")}
                options={ORGANIZATION_SEAT_ROLES.map((role) => ({
                  value: role,
                  label: t(`org.seatRole.${role}`)
                }))}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.funding.seatLimit")}</span>
              <input
                type="number"
                min="0"
                value={seatLimit}
                onChange={(event) => setSeatLimit(event.target.value)}
              />
            </label>
            <p className="ow-empty">
              {t("org.funding.referencePrice")}: {formatCents(SEAT_ROLE_REFERENCE_PRICE_CENTS[seatRole], locale)}
            </p>
            <div className="ow-actions">
              <Button type="submit" disabled={busy}>
                {t("org.funding.addPlan")}
              </Button>
            </div>
          </Form>
        ) : null}
      </section>

      <section className="ow-card" aria-labelledby="ow-sponsorships">
        <h3 id="ow-sponsorships" className="ow-title" style={{ fontSize: "1rem" }}>
          {t("org.funding.sponsorships")}
        </h3>
        <p className="ow-subtitle">{t("org.funding.sponsorshipIntro")}</p>

        {sponsorships.length === 0 ? (
          <p className="ow-empty">{t("org.funding.noSponsorships")}</p>
        ) : (
          <ul className="ow-chips">
            {sponsorships.map((row) => (
              <li key={row.id} className="ow-chip">
                {row.email} · {formatCents(row.unitPriceCents, locale)}
                {writable && row.status === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => revokeSponsorship(row.id)}
                    disabled={busy}
                    aria-label={`${t("org.funding.revokeSponsorship")}: ${row.email}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {writable ? (
          <Form onSubmit={sponsor} className="ow-grid">
            <label>
              <span className="ow-meta__term">{t("org.funding.sponsorEmail")}</span>
              <input
                required
                type="email"
                value={sponsorEmail}
                onChange={(event) => setSponsorEmail(event.target.value)}
              />
            </label>
            <p className="ow-empty">
              {t("org.funding.referencePrice")}:{" "}
              {formatCents(CLIENT_SPONSORSHIP_REFERENCE_PRICE_CENTS, locale)}
            </p>
            <div className="ow-actions">
              <Button type="submit" disabled={busy}>
                {t("org.funding.createSponsorship")}
              </Button>
            </div>
          </Form>
        ) : null}

        {issuedLink ? (
          <div className="ow-card">
            <h4 className="ow-title" style={{ fontSize: "0.9375rem" }}>
              {t("org.funding.linkHeading")}
            </h4>
            <p className="ow-subtitle">{t("org.funding.linkHint")}</p>
            <p className="ow-code">{issuedLink}</p>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
