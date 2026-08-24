"use client";

/*
 * Avalik SotsiaalAI funktsioonikataloog. Omaniku 24.08.2026 korraldus:
 * loend peab kirjeldama kõiki ehitatud kasutaja-, organisatsiooni- ja
 * haldusvõimeid avalikus toote- ja teenusekeeles.
 */

import { useI18n } from "@/components/i18n/I18nProvider";

const FEATURE_GROUPS = [
  {
    key: "roles",
    titleKey: "voimalused.group_roles_title",
    bodyKey: "voimalused.group_roles_body",
    features: [
      { key: "s5", titleKey: "voimalused.s5_title", bodyKey: "voimalused.s5_body" }
    ]
  },
  {
    key: "core",
    titleKey: "voimalused.group_core_title",
    bodyKey: "voimalused.group_core_body",
    features: [
      { key: "s1", titleKey: "voimalused.s1_title", bodyKey: "voimalused.s1_body" },
      { key: "s20", titleKey: "voimalused.s20_title", bodyKey: "voimalused.s20_body" },
      { key: "s2", titleKey: "voimalused.s2_title", bodyKey: "voimalused.s2_body" },
      { key: "s23", titleKey: "voimalused.s23_title", bodyKey: "voimalused.s23_body" },
      { key: "s21", titleKey: "voimalused.s21_title", bodyKey: "voimalused.s21_body" },
      { key: "s22", titleKey: "voimalused.s22_title", bodyKey: "voimalused.s22_body" },
      { key: "s4", titleKey: "voimalused.s4_title", bodyKey: "voimalused.s4_body" },
      { key: "s18", titleKey: "voimalused.s18_title", bodyKey: "voimalused.s18_body" }
    ]
  },
  {
    key: "client",
    titleKey: "voimalused.group_client_title",
    bodyKey: "voimalused.group_client_body",
    features: [
      { key: "s3", titleKey: "voimalused.s3_title", bodyKey: "voimalused.s3_body" },
      { key: "s6", titleKey: "voimalused.s6_title", bodyKey: "voimalused.s6_body" },
      { key: "s7", titleKey: "voimalused.s7_title", bodyKey: "voimalused.s7_body" },
      { key: "s30", titleKey: "voimalused.s30_title", bodyKey: "voimalused.s30_body" },
      { key: "s31", titleKey: "voimalused.s31_title", bodyKey: "voimalused.s31_body" },
      { key: "s14", titleKey: "voimalused.s14_title", bodyKey: "voimalused.s14_body" },
      { key: "s24", titleKey: "voimalused.s24_title", bodyKey: "voimalused.s24_body" }
    ]
  },
  {
    key: "collaboration",
    titleKey: "voimalused.group_collaboration_title",
    bodyKey: "voimalused.group_collaboration_body",
    features: [
      { key: "s9", titleKey: "voimalused.s9_title", bodyKey: "voimalused.s9_body" },
      { key: "s10", titleKey: "voimalused.s10_title", bodyKey: "voimalused.s10_body" },
      { key: "s8", titleKey: "voimalused.s8_title", bodyKey: "voimalused.s8_body" },
      { key: "s25", titleKey: "voimalused.s25_title", bodyKey: "voimalused.s25_body" }
    ]
  },
  {
    key: "professional",
    titleKey: "voimalused.group_professional_title",
    bodyKey: "voimalused.group_professional_body",
    features: [
      { key: "s26", titleKey: "voimalused.s26_title", bodyKey: "voimalused.s26_body" },
      { key: "s17", titleKey: "voimalused.s17_title", bodyKey: "voimalused.s17_body" },
      { key: "s27", titleKey: "voimalused.s27_title", bodyKey: "voimalused.s27_body" },
      { key: "s11", titleKey: "voimalused.s11_title", bodyKey: "voimalused.s11_body" },
      { key: "s29", titleKey: "voimalused.s29_title", bodyKey: "voimalused.s29_body" },
      { key: "s15", titleKey: "voimalused.s15_title", bodyKey: "voimalused.s15_body" },
      { key: "s16", titleKey: "voimalused.s16_title", bodyKey: "voimalused.s16_body" },
      { key: "s19", titleKey: "voimalused.s19_title", bodyKey: "voimalused.s19_body" },
      { key: "s12", titleKey: "voimalused.s12_title", bodyKey: "voimalused.s12_body" },
      { key: "s13", titleKey: "voimalused.s13_title", bodyKey: "voimalused.s13_body" },
      { key: "s32", titleKey: "voimalused.s32_title", bodyKey: "voimalused.s32_body" }
    ]
  },
  {
    key: "account",
    titleKey: "voimalused.group_account_title",
    bodyKey: "voimalused.group_account_body",
    features: [
      { key: "s28", titleKey: "voimalused.s28_title", bodyKey: "voimalused.s28_body" },
      { key: "s33", titleKey: "voimalused.s33_title", bodyKey: "voimalused.s33_body" },
      { key: "s34", titleKey: "voimalused.s34_title", bodyKey: "voimalused.s34_body" },
      { key: "s37", titleKey: "voimalused.s37_title", bodyKey: "voimalused.s37_body" }
    ]
  },
  {
    key: "admin",
    titleKey: "voimalused.group_admin_title",
    bodyKey: "voimalused.group_admin_body",
    features: [
      { key: "s35", titleKey: "voimalused.s35_title", bodyKey: "voimalused.s35_body" },
      { key: "s36", titleKey: "voimalused.s36_title", bodyKey: "voimalused.s36_body" }
    ]
  }
];

export default function VoimalusedBody() {
  const { t } = useI18n();

  return (
    <article aria-labelledby="voimalused-title">
      <h1 id="voimalused-title">{t("voimalused.title")}</h1>
      <p>{t("voimalused.intro")}</p>

      <nav className="reading-toc" aria-labelledby="voimalused-toc-title">
        <h2 className="reading-toc-title" id="voimalused-toc-title">
          {t("voimalused.toc_title")}
        </h2>
        <ul className="reading-toc-list">
          {FEATURE_GROUPS.map((group) => (
            <li key={group.key}>
              <a href={"#voimalused-" + group.key}>{t(group.titleKey)}</a>
            </li>
          ))}
        </ul>
      </nav>

      {FEATURE_GROUPS.map((group) => (
        <section
          key={group.key}
          className="reading-section"
          aria-labelledby={"voimalused-" + group.key}
        >
          <h2 id={"voimalused-" + group.key}>{t(group.titleKey)}</h2>
          <p>{t(group.bodyKey)}</p>
          <div>
            {group.features.map((feature) => (
              <section key={feature.key} aria-labelledby={"voimalused-" + feature.key}>
                <h3 id={"voimalused-" + feature.key}>{t(feature.titleKey)}</h3>
                <p>{t(feature.bodyKey)}</p>
              </section>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
