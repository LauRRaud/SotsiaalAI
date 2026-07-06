"use client";

/**
 * MeistBody — "Meist" leht (Plaan/sotsiaalai-meist-tekst.md, kinnitatud
 * 06.07.2026; sisu muudatused ainult tellijalt). Vormistus tuleb paneeli
 * proosatüpograafiast (panel.css); OSKA viide avaneb uues aknas.
 */

import { useI18n } from "@/components/i18n/I18nProvider";

const OSKA_URL = "https://uuringud.oska.kutsekoda.ee/uuringud/sotsiaaltoo-seirearuande";

export default function MeistBody() {
  const { t } = useI18n();

  return (
    <article aria-labelledby="meist-title">
      <h1 id="meist-title">{t("meist.title")}</h1>
      <p>{t("meist.p1")}</p>
      <p>
        {t("meist.p2a")}
        <a href={OSKA_URL} target="_blank" rel="noopener noreferrer">
          {t("meist.p2_link")}
        </a>
        {t("meist.p2b")}
      </p>
      <p>{t("meist.p3")}</p>
      <p>{t("meist.p4")}</p>
      <p>{t("meist.p5")}</p>
      <p>{t("meist.p6")}</p>
      <p>{t("meist.p7")}</p>
      <p>{t("meist.p8")}</p>
    </article>
  );
}
