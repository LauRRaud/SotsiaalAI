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

import { useCallback, useEffect, useState } from "react";
import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import ServiceLogDay from "./ServiceLogDay";
import ServiceLogReferrals from "./ServiceLogReferrals";
import ServiceLogMonth from "./ServiceLogMonth";

const TAB_PARAM = "vaade";
const MONTH_PARAM = "kuu";

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
  /* ROLL TULEB PLATVORMI ROLLIVAATEST, mitte toorest sessioonist.
     Nii näeb omanik oma admin-kontolt teenuseosutaja pinda, kui ta S/P/T
     lülitiga rolli vahetab — ja server ütleb sama (`lib/serviceLog/access.js`).
     Skoop jääb ikka `ownerId`-põhiseks: rollivaates admin näeb AINULT oma
     teenuseprofiili kirjeid, mitte kellegi teise omi. */
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = effectiveRole === "SERVICE_PROVIDER";

  usePanelInfoSlot({ infoId: "service_log" });

  const [tab, setTabState] = useState("day");
  const [month, setMonthState] = useState(currentMonth);

  /* SEIS ON URL-is. Ilma selleta ei saa osutaja aruannete vaadet järjehoidjasse
     panna ega kolleegile saata, ja brauseri tagasinupp viib lehelt hoopis ära.
     Kasutame `history.replaceState`-i, mitte marsruuti: vahelehe vahetus ei ole
     navigatsioon ja ei tohi tekitada iga puute kohta ajaloo kirjet. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get(TAB_PARAM);
    if (requested && TABS.some((item) => item.key === requested)) setTabState(requested);
    /* KUU KA URL-is. Ainult vahelehest ei piisa: järjehoidjaga avatud aruanne
       näitaks JOOKSVAT kuud ja lugeja arvaks, et vaatab seda, mille ta salvestas. */
    const requestedMonth = params.get(MONTH_PARAM);
    if (/^\d{4}-\d{2}$/.test(requestedMonth || "")) setMonthState(requestedMonth);
  }, []);

  const writeUrl = useCallback((nextTab, nextMonth) => {
    const url = new URL(window.location.href);
    url.searchParams.set(TAB_PARAM, nextTab);
    url.searchParams.set(MONTH_PARAM, nextMonth);
    window.history.replaceState(null, "", url);
  }, []);

  const setTab = useCallback(
    (next) => {
      setTabState(next);
      writeUrl(next, month);
    },
    [month, writeUrl]
  );

  const setMonth = useCallback(
    (next) => {
      setMonthState(next);
      writeUrl(tab, next);
    },
    [tab, writeUrl]
  );

  if (!isRoleResolved) return null;

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
