"use client";

/**
 * VoimalusedBody — "Võimalused" leht (Plaan/sotsiaalai-voimalused-tekst.md,
 * kinnitatud 06.07.2026; sisu muudatused ainult tellijalt — 20.07.2026
 * tellija korraldusel lisatud LIVE-funktsioonide sektsioonid s15–s19:
 * supervisioon, mentorlus, välitöö, isiklik otsing, Meetodipeegel).
 * Plokkide järjekord on kinnitatud: teadmusbaas teadlikult Vestlusakna järel;
 * profiili/seadete plokki EI OLE. Vormistus tuleb paneeli tüpograafiast.
 * NB: võtmed on teadlikult EXPLITSIITSED (mitte template-literal) —
 * i18n surnud-võtme puhastus näeb neid.
 */

import { useI18n } from "@/components/i18n/I18nProvider";

export default function VoimalusedBody() {
  const { t } = useI18n();

  return (
    <article aria-labelledby="voimalused-title">
      <h1 id="voimalused-title">{t("voimalused.title")}</h1>
      <p>{t("voimalused.intro")}</p>

      <section>
        <h2>{t("voimalused.s1_title")}</h2>
        <p>{t("voimalused.s1_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s2_title")}</h2>
        <p>{t("voimalused.s2_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s3_title")}</h2>
        <p>{t("voimalused.s3_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s4_title")}</h2>
        <p>{t("voimalused.s4_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s5_title")}</h2>
        <p>{t("voimalused.s5_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s6_title")}</h2>
        <p>{t("voimalused.s6_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s7_title")}</h2>
        <p>{t("voimalused.s7_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s8_title")}</h2>
        <p>{t("voimalused.s8_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s9_title")}</h2>
        <p>{t("voimalused.s9_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s10_title")}</h2>
        <p>{t("voimalused.s10_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s18_title")}</h2>
        <p>{t("voimalused.s18_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s11_title")}</h2>
        <p>{t("voimalused.s11_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s15_title")}</h2>
        <p>{t("voimalused.s15_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s16_title")}</h2>
        <p>{t("voimalused.s16_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s12_title")}</h2>
        <p>{t("voimalused.s12_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s19_title")}</h2>
        <p>{t("voimalused.s19_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s17_title")}</h2>
        <p>{t("voimalused.s17_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s13_title")}</h2>
        <p>{t("voimalused.s13_body")}</p>
      </section>
      <section>
        <h2>{t("voimalused.s14_title")}</h2>
        <p>{t("voimalused.s14_body")}</p>
      </section>
    </article>
  );
}
