"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { ORGANIZATION_LEGAL_KINDS } from "@/lib/org/constants";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * `/org` klient. Kolm valikut arenduskava §7.1-st: isiklik kasutus, kutse
 * vastuvõtt, organisatsiooni loomine.
 */
export default function OrgHomeClient({ organizations, pendingInvites, canCreate, canCreateRole }) {
  const { t } = useI18n();
  /* ⓘ kiirmenüüsse (lib/dashboardInfoContent → `org`). Ilma selleta oli /org
     ainus dokiga pind ilma infonuputa ja privaatsuse selgitus pidi elama lehe
     pealkirja all — infot pealkirja alla ei panda. */
  usePanelInfoSlot({ infoId: "org" });
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [legalKind, setLegalKind] = useState("MUNICIPALITY");
  const [legalName, setLegalName] = useState("");
  const [registryCode, setRegistryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName, legalKind, legalName, registryCode })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setError(resolveApiMessage({ payload, t, fallbackKey: "org.errors.create_failed" }));
          return;
        }
        router.push(`/org/${payload.organization.id}`);
      } catch {
        setError(t("org.errors.create_failed"));
      } finally {
        setBusy(false);
      }
    },
    [displayName, legalKind, legalName, registryCode, router, t]
  );

  return (
    <section className="ow-shell">
      <header className="ow-header">
        <div>
          <h1 className="ow-title">{t("org.home.heading")}</h1>
          <p className="ow-subtitle">{t("org.home.intro")}</p>
        </div>
      </header>

      <section className="ow-card" aria-labelledby="ow-orgs-heading">
        <h2 id="ow-orgs-heading" className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.switcher.organizations")}
        </h2>
        {organizations.length === 0 ? (
          <p className="ow-empty">{t("org.home.empty")}</p>
        ) : (
          <ul className="ow-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {organizations.map((organization) => (
              <li key={organization.id} className="ow-card">
                <h3 className="ow-title" style={{ fontSize: "1rem" }}>
                  {organization.displayName}
                </h3>
                <p className="ow-subtitle">
                  {t(`org.status.${organization.status}`)}
                  {" · "}
                  {t(`org.seatRole.${organization.seatRole}`)}
                </p>
                <Link className="ow-nav__link" href={`/org/${organization.id}`}>
                  {t("org.home.openWorkspace")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ow-card" aria-labelledby="ow-invites-heading">
        <h2 id="ow-invites-heading" className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.home.pendingInvites")}
        </h2>
        {pendingInvites.length === 0 ? (
          <p className="ow-empty">{t("org.home.noPendingInvites")}</p>
        ) : (
          <ul className="ow-chips">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="ow-chip">
                {invite.organizationName} · {t(`org.seatRole.${invite.seatRole}`)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCreate && canCreateRole ? (
        <section className="ow-card" aria-labelledby="ow-create-heading">
          <h2 id="ow-create-heading" className="ow-title" style={{ fontSize: "1.125rem" }}>
            {t("org.home.createHeading")}
          </h2>
          <p className="ow-subtitle">{t("org.create.hint")}</p>
          <form onSubmit={submit} className="ow-grid">
            <label>
              <span className="ow-meta__term">{t("org.create.displayName")}</span>
              <input
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="ow-code"
                style={{ width: "100%", fontFamily: "inherit", fontSize: "1rem" }}
              />
            </label>
            {/* Platvormi oma valikmenüü, MITTE natiivne <select>: avatud loendi
                joonistab natiivsel operatsioonisüsteem ja hämariku klaasi keskele
                avanes valge Windowsi loend (sama viga, mis teenuspäevikus 02.08
                parandati). */}
            <label>
              <span className="ow-meta__term">{t("org.create.legalKindLabel")}</span>
              <Dropdown
                name="legalKind"
                value={legalKind}
                onChange={setLegalKind}
                ariaLabel={t("org.create.legalKindLabel")}
                options={ORGANIZATION_LEGAL_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`org.legalKind.${kind}`)
                }))}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.create.legalName")}</span>
              <input
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                className="ow-code"
                style={{ width: "100%", fontFamily: "inherit", fontSize: "1rem" }}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.create.registryCode")}</span>
              <input
                value={registryCode}
                onChange={(event) => setRegistryCode(event.target.value)}
                className="ow-code"
                style={{ width: "100%", fontFamily: "inherit", fontSize: "1rem" }}
              />
            </label>
            <div className="ow-actions">
              <Button type="submit" disabled={busy}>
                {t("org.create.submit")}
              </Button>
            </div>
          </form>
          {error ? (
            <p className="ow-notice ow-notice--warning" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
