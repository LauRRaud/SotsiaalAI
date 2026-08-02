"use client";

/**
 * TEENUSPÄEVIK-V1 — pinna kest ja alaosad.
 *
 * Alaosad järgivad lepingu päist: **Päev · Suunamised · Aruanded** (Graafik on
 * E10 ja teda siin veel EI OLE — puuduv vaheleht on ausam kui tühi vaheleht,
 * mis lubab midagi, mida ei ole).
 *
 * MIKS VAHELEHED, MITTE ÜKS PIKK LEHT: kolm alaosa vastavad kolmele eri
 * hetkele osutaja päevas — töö kõrvalt (Päev), kuu jooksul (Suunamised) ja kuu
 * lõpus (Aruanded). Ühel lehel oleks igaüks neist teistele müra.
 *
 * ROLLIKONTROLL ON SIIN, mitte alaosades: üks koht, kus vastus „see pind ei ole
 * sinu oma" sünnib. Server ütleb sama niikuinii — UI ei ole värav, vaid viisakus.
 */

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import ServiceLogDay from "./ServiceLogDay";
import ServiceLogReferrals from "./ServiceLogReferrals";
import ServiceLogMonth from "./ServiceLogMonth";

const TABS = [
  { key: "day", labelKey: "service_log.tabs.day" },
  { key: "referrals", labelKey: "service_log.tabs.referrals" },
  { key: "reports", labelKey: "service_log.tabs.reports" }
];

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ServiceLogShell() {
  const { t } = useI18n();
  const { data: session, status: sessionStatus } = useSession();
  const allowed = String(session?.user?.role || "").toUpperCase() === "SERVICE_PROVIDER";

  usePanelInfoSlot({ infoId: "service_log" });

  const [tab, setTab] = useState("day");
  const [month, setMonth] = useState(currentMonth);

  if (sessionStatus === "loading") return null;

  if (!allowed) {
    return (
      <section className="sl-shell">
        <p className="sl-empty">{t("service_log.not_allowed", "")}</p>
      </section>
    );
  }

  return (
    <section className="sl-shell">
      <nav className="sl-tabs" aria-label={t("service_log.tabs.label", "")}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sl-tab${tab === item.key ? " is-active" : ""}`}
            aria-current={tab === item.key ? "page" : undefined}
            onClick={() => setTab(item.key)}
          >
            {t(item.labelKey, "")}
          </button>
        ))}
      </nav>

      {tab === "day" ? <ServiceLogDay /> : null}
      {tab === "referrals" ? <ServiceLogReferrals month={month} /> : null}
      {tab === "reports" ? <ServiceLogMonth month={month} onMonthChange={setMonth} /> : null}
    </section>
  );
}
