"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAccessibility } from "@/components/accessibility/AccessibilityProvider";
import CloseButton from "@/components/ui/CloseButton";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import { localizePath } from "@/lib/localizePath";
import { localizeInternalHtmlLinks } from "@/lib/localizeHtmlLinks";
import { getFooterNote } from "@/lib/footerNote";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { focusPolicyScrollArea, handlePolicyScrollKeyDown } from "@/components/alalehed/policyScrollKeyboard";

const SECTION_KEYS = ["accessibility", "home", "register", "signin", "chat", "documents", "agent_mode", "wellbeing", "profile", "about", "before_use", "privacy_safety", "quickstart"];
export default function KasutusjuhendBody() {
  const [isContactOpen, setIsContactOpen] = useState(false);
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
            <div>
              {guideContent.sections.map(({
              key,
              title,
              body
            }) => <article key={key} onClick={key === "accessibility" ? handleA11yClick : undefined} aria-label={title}>
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
