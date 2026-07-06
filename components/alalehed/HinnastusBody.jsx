"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import AppLink from "@/components/ui/Link";
import Button from "@/components/ui/Button";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";

const planKeys = ["free", "client", "worker", "provider"];

const featureRows = [
  {
    key: "workspace",
    values: ["simple", "client_view", "worker_view", "provider_view"]
  },
  {
    key: "help",
    values: ["included", "included", "included", "included"]
  },
  {
    key: "service_card",
    values: ["included", "included", "included", "included"]
  },
  {
    key: "knowledge_base",
    values: ["dash", "included", "included", "included"]
  },
  {
    key: "assistants_agents",
    values: ["dash", "included", "included", "included"]
  },
  {
    key: "sources",
    values: ["dash", "included", "included", "included"]
  },
  {
    key: "rooms",
    values: ["listing_only", "included", "included", "included"]
  },
  {
    key: "drafting",
    values: ["dash", "limited", "extended", "unlimited"]
  },
  {
    key: "analysis",
    values: ["dash", "limited", "extended", "unlimited"]
  },
  {
    key: "research",
    values: ["dash", "limited", "extended", "unlimited"]
  },
  {
    key: "documents",
    values: ["dash", "limited", "extended", "unlimited"]
  },
  {
    key: "pre_inquiry",
    values: ["dash", "included", "dash", "dash"]
  },
  {
    key: "intake",
    values: ["dash", "dash", "by_agreement", "included"]
  },
  {
    key: "kovisioon",
    values: ["dash", "dash", "included", "included"]
  },
  {
    key: "materials_adding",
    values: ["dash", "dash", "included", "included"]
  },
  {
    key: "service_card_listing",
    values: ["dash", "dash", "dash", "included"]
  },
  {
    key: "service_profile",
    values: ["dash", "dash", "dash", "included"]
  }
];

function PlanValue({ value, t }) {
  if (value === "included") {
    return (
      <span aria-label={t("about.pricing.values.included")}>
        &#10003;
      </span>
    );
  }
  if (value === "dash") {
    return <span aria-label={t("about.pricing.values.not_included")}>-</span>;
  }
  return <span>{t(`about.pricing.values.${value}`)}</span>;
}

export default function HinnastusBody() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const panelRef = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const body = document.body;

    root?.classList.add("framework-page-scroll-lock");
    body?.classList.add("framework-page-scroll-lock");

    return () => {
      root?.classList.remove("framework-page-scroll-lock");
      body?.classList.remove("framework-page-scroll-lock");
    };
  }, []);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }

    pushWithTransition(router, localizePath("/", locale));
  };

  const handleShellWheel = useCallback((event) => {
    const panel = panelRef.current;
    const target = event.target;
    if (!panel || panel.contains(target)) return;

    const maxScrollTop = panel.scrollHeight - panel.clientHeight;
    if (maxScrollTop <= 0) return;

    event.preventDefault();
    panel.scrollTop = Math.max(0, Math.min(maxScrollTop, panel.scrollTop + event.deltaY));
  }, []);

  const openRegistration = (pathname) => {
    pushWithTransition(router, localizePath(pathname, locale));
  };

  const openFeatures = (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    pushWithTransition(router, localizePath("/voimalused", locale));
  };

  const actions = [
    { key: "free", type: "button", path: "/registreerimine" },
    { key: "client", type: "button", path: "/registreerimine?role=client" },
    { key: "worker", type: "button", path: "/registreerimine?role=specialist" },
    { key: "provider", type: "button", path: "/registreerimine?role=provider" }
  ];

  return (
    <section lang={locale} onWheel={handleShellWheel}>
      <div ref={panelRef}>
        <SubpageHeader
          onBack={handleBack}
          backAriaLabel={t("buttons.back_previous")}
          titleId="hinnastus-title"
        >
          {t("about.pricing.title")}
        </SubpageHeader>

        <div>
          <p>
            {t("about.pricing.intro")}{" "}
            <AppLink href="/voimalused" onClick={openFeatures}>
              {t("about.links.features")}
            </AppLink>
          </p>

          <div>
            <table aria-labelledby="hinnastus-title">
              <colgroup>
                <col />
                {planKeys.map((planKey) => (
                  <col key={planKey} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    {t("about.pricing.columns.feature")}
                  </th>
                  {planKeys.map((planKey) => (
                    <th key={planKey} scope="col">
                      {t(`about.pricing.columns.${planKey}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    {t("about.pricing.rows.price")}
                  </th>
                  {planKeys.map((planKey) => (
                    <td key={planKey}>
                      <span>{t(`about.pricing.prices.${planKey}`)}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">
                    {t("about.pricing.rows.start")}
                  </th>
                  {actions.map((action) => (
                    <td key={action.key}>
                      {action.type === "button" ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => openRegistration(action.path)}
                        >
                          {t(`about.pricing.actions.${action.key}`)}
                        </Button>
                      ) : (
                        <span>{t(`about.pricing.actions.${action.key}`)}</span>
                      )}
                    </td>
                  ))}
                </tr>
                {featureRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      {t(`about.pricing.features.${row.key}`)}
                    </th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${index}`}>
                        <PlanValue value={value} t={t} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>{t("about.pricing.note")}</p>
        </div>
      </div>
    </section>
  );
}
