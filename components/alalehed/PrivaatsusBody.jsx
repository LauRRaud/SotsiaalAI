"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import RichText from "@/components/i18n/RichText";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { PRIVACY_VERSION } from "@/lib/legalDocuments";
import { getFooterNote } from "@/lib/footerNote";
import { backWithTransition, pushWithTransition } from "@/lib/routeTransition";
import { focusPolicyScrollArea, handlePolicyScrollKeyDown } from "@/components/alalehed/policyScrollKeyboard";
import { ReadingToc, useHashNavigation } from "@/components/alalehed/readingLayer";

const lawLinkReplacements = {
  aLawEst: {
    open: `<a href="https://www.riigiteataja.ee/akt/112072025014" target="_blank" rel="noopener noreferrer">`,
    close: "</a>"
  },
  aGdpr: {
    open: `<a href="https://eur-lex.europa.eu/legal-content/ET/TXT/HTML/?uri=CELEX:02016R0679-20160504" target="_blank" rel="noopener noreferrer">`,
    close: "</a>"
  },
  aDpa: {
    open: `<a href="https://www.aki.ee" target="_blank" rel="noopener noreferrer">`,
    close: "</a>"
  }
};
export default function PrivaatsusBody() {
  const activeSectionId = useHashNavigation();
  const router = useRouter();
  const {
    t,
    locale
  } = useI18n();
  const sections = [{
    heading: t("privacy.section1.heading"),
    content: [{
      value: t("privacy.section1.paragraph1")
    }, {
      value: t("privacy.section1.paragraph2"),
      replacements: lawLinkReplacements
    }]
  }, {
    heading: t("privacy.section2.heading"),
    content: [{
      value: t("privacy.section2.paragraph1")
    }, {
      value: t("privacy.section2.paragraph2")
    }, {
      value: t("privacy.section2.paragraph3")
    }]
  }, {
    heading: t("privacy.section3.heading"),
    content: [{
      value: t("privacy.section3.items"),
      type: "list"
    }]
  }, {
    heading: t("privacy.section4.heading"),
    content: [{
      value: t("privacy.section4.body")
    }]
  }, {
    heading: t("privacy.privacy_filter.heading"),
    content: [{
      value: t("privacy.privacy_filter.body")
    }]
  }, {
    heading: t("privacy.section5.heading"),
    content: [{
      value: t("privacy.section5.body")
    }]
  }, {
    heading: t("privacy.section6.heading"),
    content: [{
      value: t("privacy.section6.body")
    }]
  }, {
    heading: t("privacy.section7.heading"),
    content: [{
      value: t("privacy.section7.body")
    }]
  }, {
    heading: t("privacy.section8.heading"),
    content: [{
      value: t("privacy.section8.items"),
      type: "list",
      replacements: lawLinkReplacements
    }]
  }, {
    heading: t("privacy.section9.heading"),
    content: [{
      value: t("privacy.section9.body")
    }]
  }, {
    heading: t("privacy.section10.heading"),
    content: [{
      value: t("privacy.section10.body")
    }]
  }, {
    heading: t("privacy.section11.heading"),
    content: [{
      value: t("privacy.section11.body")
    }]
  }];
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      backWithTransition(router);
      return;
    }
    pushWithTransition(router, localizePath("/", locale));
  };
  return <section lang={locale}>
      <div>
        <div role="region" aria-labelledby="privacy-title">
        <div>
          <div
            tabIndex={0}
            aria-labelledby="privacy-title"
            onKeyDown={handlePolicyScrollKeyDown}
            onMouseDown={focusPolicyScrollArea}
          >
            <SubpageHeader
              onBack={handleBack}
              backAriaLabel={t("buttons.back_home")}
              holdPressedVisualDisabled
              anchorBack={false}
              titleId="privacy-title"
            >
              {t("privacy.title")}
            </SubpageHeader>
            <p className="legal-version-note">
              {t("legal.version_note", { version: PRIVACY_VERSION })}
            </p>
            <ReadingToc
              title={t("legal.toc_title")}
              items={sections.map((section, idx) => ({
                id: `s${idx + 1}`,
                label: section.heading
              }))}
              activeId={activeSectionId}
            />
            {sections.map((section, sectionIdx) => <div key={section.heading} id={`s${sectionIdx + 1}`} className="reading-section">
                <h2>{section.heading}</h2>
                <div>
                  {section.content.map((item, idx) => item.type === "list" ? <RichText key={`${section.heading}-list-${idx}`} as="ul" value={item.value} replacements={item.replacements || lawLinkReplacements} /> : <RichText key={`${section.heading}-p-${idx}`} as="div" value={item.value} replacements={item.replacements || {}} />)}
                </div>
              </div>)}
            <footer>
              {getFooterNote()}
            </footer>
          </div>
        </div>
      </div>
      </div>
    </section>;
}
