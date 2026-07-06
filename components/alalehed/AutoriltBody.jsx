"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";

export default function AutoriltBody() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const panelRef = useRef(null);
  const pageTitle = t("about.author.title");
  const paragraphs = t("about.author.paragraphs");
  const storyParagraphs = Array.isArray(paragraphs) ? paragraphs : [];

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

  return (
    <section lang={locale} onWheel={handleShellWheel}>
      <div ref={panelRef} className="overflow-y-auto">
        <SubpageHeader
          onBack={handleBack}
          backAriaLabel={t("buttons.back_previous")}
          titleId="autorilt-title"
        >
          {pageTitle}
        </SubpageHeader>

        <div>
          <article aria-labelledby="autorilt-title">
            <p>{t("about.author.byline")}</p>
            {storyParagraphs.map((paragraph, index) => (
              <p key={index}>
                {paragraph}
              </p>
            ))}
          </article>
        </div>
      </div>
    </section>
  );
}
