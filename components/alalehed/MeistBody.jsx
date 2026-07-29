"use client";

/**
 * MeistBody — "Meist" leht. Sisu v2 kinnitatud 29.07.2026 (tellija: "uuenda meist
 * lehe tekst, annan sulle õiguse seda teha"); mustand ja põhjendused
 * docs/platvormi arendus/meist-tekst-v2.md. Vormistus tuleb paneeli
 * proosatüpograafiast (panel.css); OSKA viide avaneb uues aknas.
 */

import Link from "next/link";

import { useI18n } from "@/components/i18n/I18nProvider";

const OSKA_URL = "https://uuringud.oska.kutsekoda.ee/uuringud/sotsiaaltoo-seirearuande";

export default function MeistBody() {
  const { t } = useI18n();

  return (
    <article aria-labelledby="meist-title">
      <h1 id="meist-title">{t("meist.title")}</h1>

      <h2>{t("meist.h_intro")}</h2>
      <p>
        {t("meist.intro1a")}
        <a href={OSKA_URL} target="_blank" rel="noopener noreferrer">
          {t("meist.oska_link")}
        </a>
        {t("meist.intro1b")}
      </p>
      <p>{t("meist.intro2")}</p>

      <h2>{t("meist.h_never")}</h2>
      <p>{t("meist.never_intro")}</p>
      <p>
        <strong>{t("meist.never1_title")}</strong> {t("meist.never1_body")}
      </p>
      <p>
        <strong>{t("meist.never2_title")}</strong> {t("meist.never2_body")}
      </p>
      <p>
        <strong>{t("meist.never3_title")}</strong> {t("meist.never3_body")}
      </p>

      <h2>{t("meist.h_who")}</h2>
      <p>
        <strong>{t("meist.who1_title")}</strong> {t("meist.who1_body")}
      </p>
      <p>
        <strong>{t("meist.who2_title")}</strong> {t("meist.who2_body")}
      </p>
      <p>
        <strong>{t("meist.who3_title")}</strong> {t("meist.who3_body")}
      </p>

      <h2>{t("meist.h_success")}</h2>
      <p>{t("meist.success_body")}</p>

      <h2>{t("meist.h_we")}</h2>
      <p>{t("meist.we_body")}</p>
      <p>
        <Link href="/autorilt">{t("meist.we_link")}</Link>
      </p>

      <p>
        <strong>{t("meist.closing")}</strong>
      </p>
    </article>
  );
}
