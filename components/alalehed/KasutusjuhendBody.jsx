"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import CloseButton from "@/components/ui/CloseButton";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import { localizePath } from "@/lib/localizePath";
import { localizeInternalHtmlLinks } from "@/lib/localizeHtmlLinks";
import { filterGuideSections } from "@/lib/guideSearch";
import { getFooterNote } from "@/lib/footerNote";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { focusPolicyScrollArea, handlePolicyScrollKeyDown } from "@/components/alalehed/policyScrollKeyboard";
import { ReadingToc, useHashNavigation } from "@/components/alalehed/readingLayer";

const SECTION_KEYS = ["accessibility", "home", "register", "signin", "chat", "rooms", "journey", "documents", "search", "agent_mode", "wellbeing", "pro_tools", "profile", "about", "before_use", "privacy_safety", "quickstart"];
export default function KasutusjuhendBody() {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const activeSectionId = useHashNavigation();
  const router = useRouter();
  const {
    t,
    locale
  } = useI18n();
  const {
    openModal: openA11y,
    isModalOpen
  } = useAccessibility();
  const handleA11yClick = e => {
    let node = e.target;
    let anchor = null;
    while (node && node !== e.currentTarget) {
      if (node.matches && node.matches("a[data-a11y-open]")) {
        anchor = node;
        break;
      }
      node = node.parentElement;
    }
    if (anchor) {
      e.preventDefault();
      openA11y();
    }
  };
  const handleContactClick = e => {
    let node = e.target;
    let anchor = null;
    while (node && node !== e.currentTarget) {
      if (node.matches && node.matches("a[data-contact-open], button[data-contact-open]")) {
        anchor = node;
        break;
      }
      node = node.parentElement;
    }
    if (anchor) {
      e.preventDefault();
      setIsContactOpen(true);
    }
  };
  const guideContent = {
    intro: t("about.guide.intro"),
    sections: SECTION_KEYS.map(key => ({
      key,
      title: t(`about.guide.sections_v2.${key}.title`),
      body: localizeInternalHtmlLinks(t(`about.guide.sections_v2.${key}.body`), locale)
    }))
  };
  const visibleSections = useMemo(
    () => filterGuideSections(guideContent.sections, searchQuery),
    // sections sõltub ainult lokaadist; filtreerime päringu muutumisel
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, searchQuery]
  );
  const isFiltering = searchQuery.trim().length > 0;

  /* Sisukorra klõps aktiivse otsingufiltri ajal: sihtpeatükk võib olla
     DOM-ist väljas ja brauseri ankruhüpe kukub vaikselt. Klõps tühjendab
     filtri (onNavigate) ja SEE efekt kerib pärast taasrenderdust kohale. */
  useEffect(() => {
    if (isFiltering || !activeSectionId) return;
    document.getElementById(activeSectionId)?.scrollIntoView({ block: "start" });
  }, [isFiltering, activeSectionId]);
  const hideGuideBackButton = isModalOpen;
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }
    pushWithTransition(router, localizePath("/", locale));
  };
  return <section lang={locale}>
      <div>
        <div role="region" aria-labelledby="kasutusjuhend-title">
        <div>
          <div
            tabIndex={0}
            aria-labelledby="kasutusjuhend-title"
            onKeyDown={handlePolicyScrollKeyDown}
            onMouseDown={focusPolicyScrollArea}
            onClick={handleContactClick}
          >
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("buttons.back_home")}
              showBack={!hideGuideBackButton}
              holdPressedVisualDisabled
              anchorBack={false}
              titleId="kasutusjuhend-title"
            >
              {t("about.guide.short_title")}
            </SubpageHeader>
            <p>
              {guideContent.intro}
            </p>
            <div className="reading-search" role="search">
              <label htmlFor="guide-search-input">
                {t("about.guide.search_label")}
              </label>
              <input
                id="guide-search-input"
                type="search"
                value={searchQuery}
                placeholder={t("about.guide.search_placeholder")}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <p role="status" className="reading-search-status">
                {isFiltering
                  ? t("about.guide.search_count", { count: visibleSections.length })
                  : ""}
              </p>
            </div>
            <ReadingToc
              title={t("legal.toc_title")}
              items={guideContent.sections.map(({ key, title }) => ({
                id: key,
                label: title
              }))}
              activeId={activeSectionId}
              onNavigate={() => setSearchQuery("")}
            />
            <div>
              {visibleSections.length === 0 ? (
                <p className="reading-search-empty">
                  {t("about.guide.search_empty")}
                </p>
              ) : null}
              {visibleSections.map(({
              key,
              title,
              body
            }) => <article key={key} id={key} className="reading-section" onClick={key === "accessibility" ? handleA11yClick : undefined} aria-label={title}>
                  <h2>{title}</h2>
                  <div dangerouslySetInnerHTML={{
                __html: body
              }} />
                </article>)}
            </div>
            <footer>
              {getFooterNote()}
            </footer>
          </div>
        </div>
      </div>
      <Modal
        open={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      >
        <div>
          <CloseButton
            onClick={() => setIsContactOpen(false)}
            ariaLabel={t("buttons.close")}
          />
          <h2>
            {t("about.contact.title")}
          </h2>
          <div
            dangerouslySetInnerHTML={{
              __html: t("about.contact.modal_body")
            }}
          />
        </div>
      </Modal>
      </div>
    </section>;
}
