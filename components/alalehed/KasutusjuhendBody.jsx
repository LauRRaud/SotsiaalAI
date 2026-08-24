"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import CloseButton from "@/components/ui/CloseButton";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { localizePath } from "@/lib/localizePath";
import { localizeInternalHtmlLinks } from "@/lib/localizeHtmlLinks";
import { filterGuideSections } from "@/lib/guideSearch";
import { getFooterNote } from "@/lib/footerNote";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { focusPolicyScrollArea, handlePolicyScrollKeyDown } from "@/components/alalehed/policyScrollKeyboard";
import { ReadingToc, useHashNavigation } from "@/components/alalehed/readingLayer";

const GUIDE_ROLES = ["client", "specialist", "provider"];
const COMMON_SECTION_KEYS = [
  "accessibility",
  "home",
  "register",
  "signin",
  "chat",
  "rooms",
  "documents",
  "search",
  "agent_mode",
  "profile",
  "about",
  "before_use",
  "privacy_safety"
];
const ROLE_SECTION_KEYS = ["workspace", "workflows", "quickstart"];

function isGuideRole(value) {
  return GUIDE_ROLES.includes(value);
}

export default function KasutusjuhendBody({ initialRole = "" }) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState(
    isGuideRole(initialRole) ? initialRole : ""
  );
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
  const commonSections = useMemo(
    () => COMMON_SECTION_KEYS.map(key => ({
      key,
      title: t(`about.guide.sections_v2.${key}.title`),
      body: localizeInternalHtmlLinks(
        t(`about.guide.sections_v2.${key}.body`),
        locale
      )
    })),
    [locale, t]
  );
  const roleSections = useMemo(() => {
    if (!selectedRole) return [];
    return ROLE_SECTION_KEYS.map(key => ({
      key: `role-${key}`,
      title: t(`about.guide.role_sections.${selectedRole}.${key}.title`),
      body: localizeInternalHtmlLinks(
        t(`about.guide.role_sections.${selectedRole}.${key}.body`),
        locale
      )
    }));
  }, [locale, selectedRole, t]);
  const guideSections = useMemo(
    () => [
      ...commonSections.slice(0, 4),
      ...roleSections,
      ...commonSections.slice(4)
    ],
    [commonSections, roleSections]
  );
  const visibleSections = useMemo(
    () => filterGuideSections(guideSections, searchQuery),
    [guideSections, searchQuery]
  );
  const isFiltering = searchQuery.trim().length > 0;

  const handleRoleChange = (event) => {
    const nextRole = event.target.value;
    if (!isGuideRole(nextRole)) return;
    setSelectedRole(nextRole);
    setSearchQuery("");

    const url = new URL(window.location.href);
    url.searchParams.set("role", nextRole);
    url.hash = "";
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}`
    );
  };

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
              {t("about.guide.intro")}
            </p>
            <fieldset
              className="guide-role-picker"
              id="guide-role-picker"
              aria-describedby="guide-role-picker-intro"
            >
              <legend>{t("about.guide.role_picker.title")}</legend>
              <p className="guide-role-picker__intro" id="guide-role-picker-intro">
                {t("about.guide.role_picker.intro")}
              </p>
              <div className="guide-role-picker__options">
                {GUIDE_ROLES.map((role) => (
                  <label className="guide-role-option" key={role}>
                    <input
                      type="radio"
                      name="guide-role"
                      value={role}
                      checked={selectedRole === role}
                      onChange={handleRoleChange}
                    />
                    <span className="guide-role-option__name">
                      {t(`about.guide.role_picker.${role}_name`)}
                    </span>
                    <span className="guide-role-option__hint">
                      {t(`about.guide.role_picker.${role}_hint`)}
                    </span>
                  </label>
                ))}
              </div>
              <p className="guide-role-picker__status" aria-live="polite">
                {selectedRole
                  ? t("about.guide.role_picker.selected", {
                      role: t(`about.guide.role_picker.${selectedRole}_name`)
                    })
                  : t("about.guide.role_picker.prompt")}
              </p>
            </fieldset>
            <div className="reading-search" role="search">
              <label htmlFor="guide-search-input">
                {t("about.guide.search_label")}
              </label>
              <Input
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
              items={guideSections.map(({ key, title }) => ({
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
