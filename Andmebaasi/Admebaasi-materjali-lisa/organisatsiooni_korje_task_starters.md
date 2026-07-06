# SotsiaalAI organisatsioonikorje tööalgused

**Kuupäev:** 2026-04-29  
**Alus:** `organisatsiooni_rag_andmekorje_ulesanne.md` + `master_sources_final.json` organisatsioonikorje kirjed  
**Eesmärk:** anda valmis kopeeritavad tööalgused, et läbida master-listis olevad organisatsiooni-, asutuse-, partneri- ja teemaveebide lehed.

## Kuidas kasutada

Iga ploki võib anda ChatGPT/veebikorjeagendile eraldi ülesandena.

Soovituslik töömaht:

- suur või sisuliselt keeruline organisatsioon: **1 organisatsioon korraga**;
- keskmine organisatsioon: **1–2 organisatsiooni korraga**;
- väike lihtne organisatsioon või koda: **3–5 organisatsiooni korraga**;
- `REVIEW` plokid: kontrolli enne, kas need üldse sobivad organisatsioonipaketi töövoogu.

Peamine reegel: PDF/DOC/DOCX täisteksti ei panda organisatsiooni põhipaketti. Need märgitakse eraldi knowledge-doc kandidaatideks.

## Prioriteedid

- **A** — alusta siit: kõrge praktiline väärtus SotsiaalAI jaoks.
- **B** — järgmine kiht: selged organisatsioonid/teenuseosutajad.
- **C** — võib teha väiksemate batch’idena.
- **REVIEW** — vajab enne käsitsi otsust, sest võib olla KOV-leht, sotsiaalmeedia, registriviide, ajalooline kanal või mitteorganisatsiooni avaleht.

---

# Prioriteet A

### 01. Astangu Kutserehabilitatsiooni Keskus

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Astangu Kutserehabilitatsiooni Keskus
SLUG: astangu
ORGANISATSIOONI_TÜÜP: teenuseosutaja / riiklik asutus
FOOKUS: puudega inimeste rehabilitatsioon, õppimise ja töötamise toetamine
AMETLIK_VEEB: https://www.astangu.ee/et
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- astangu.sources.json
- astangu.json
- astangu.meta.json
- astangu.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: Lisatud kasutaja näite põhjal; ei olnud selles source-master organisatsioonide väljavõttes.

**Masterlisti/tuntud allikate kontroll:**

- (masterlisti kirjet pole selles väljavõttes; kasuta antud ametlikku veebilehte ja märgi masterlist_status = "not_checked" või "new_candidate")
### 02. Eesti Puuetega Inimeste Koda (EPIKoda)

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Puuetega Inimeste Koda (EPIKoda)
SLUG: epikoda
ORGANISATSIOONI_TÜÜP: katusorganisatsioon / MTÜ
FOOKUS: puudega inimesed, katusorganisatsioonid ja kojad
AMETLIK_VEEB: https://epikoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- epikoda.sources.json
- epikoda.json
- epikoda.meta.json
- epikoda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Puuetega Inimeste Koda (EPIKoda) — source_id: `eesti_puuetega_inimeste_koda_eesti_puuetega_inimeste_koda_epikoda`; url: https://epikoda.ee/; normalized_url: https://epikoda.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
- EPIKoja liikmed — source_id: `eesti_puuetega_inimeste_koda_epikoja_liikmed`; url: https://epikoda.ee/epikoja-liikmed/; normalized_url: https://epikoda.ee/epikoja-liikmed; link_check_status: OK; ingest_status: referenced_only; priority: low
- EPIKoja võrgustiku kontaktid — source_id: `eesti_puuetega_inimeste_koda_epikoja_vorgustiku_kontaktid`; url: https://epikoda.ee/epikoja-liikmed/koja-liikmed/; normalized_url: https://epikoda.ee/epikoja-liikmed/koja-liikmed; link_check_status: OK; ingest_status: referenced_only; priority: low
### 03. Eesti Pimedate Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Pimedate Liit
SLUG: eesti-pimedate-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline katusorganisatsioon / MTÜ
FOOKUS: nägemispuue, pimedad ja vaegnägijad, ligipääsetavus
AMETLIK_VEEB: https://pimedateliit.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-pimedate-liit.sources.json
- eesti-pimedate-liit.json
- eesti-pimedate-liit.meta.json
- eesti-pimedate-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Pimedate Liit — source_id: `nagemispuue_ja_liitpuue_eesti_pimedate_liit`; url: https://pimedateliit.ee/; normalized_url: https://pimedateliit.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
- EPL liikmesühingud — source_id: `nagemispuue_ja_liitpuue_epl_liikmesuhingud`; url: https://pimedateliit.ee/liikmesuhingud/; normalized_url: https://pimedateliit.ee/liikmesuhingud; link_check_status: OK; ingest_status: referenced_only; priority: low
- EPL teemaleht „Nägemispuue” — source_id: `nagemispuue_ja_liitpuue_epl_teemaleht_nagemispuue`; url: https://pimedateliit.ee/nagemispuue/; normalized_url: https://pimedateliit.ee/nagemispuue; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 04. Eesti Kurtide Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Kurtide Liit
SLUG: eesti-kurtide-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline katusorganisatsioon / MTÜ
FOOKUS: kurtus, viipekeel, kuulmispuue
AMETLIK_VEEB: https://www.ead.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-kurtide-liit.sources.json
- eesti-kurtide-liit.json
- eesti-kurtide-liit.meta.json
- eesti-kurtide-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Kurtide Liit — source_id: `kuulmispuue_kurtus_ja_viipekeel_eesti_kurtide_liit`; url: https://www.ead.ee/; normalized_url: https://www.ead.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 05. Eesti Vaegkuuljate Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Vaegkuuljate Liit
SLUG: eesti-vaegkuuljate-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline katusorganisatsioon / MTÜ
FOOKUS: vaegkuulmine, kuulmispuue, tugivõrgustik
AMETLIK_VEEB: https://vaegkuuljad.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-vaegkuuljate-liit.sources.json
- eesti-vaegkuuljate-liit.json
- eesti-vaegkuuljate-liit.meta.json
- eesti-vaegkuuljate-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Vaegkuuljate Liit — source_id: `kuulmispuue_kurtus_ja_viipekeel_eesti_vaegkuuljate_liit`; url: https://vaegkuuljad.ee/; normalized_url: https://vaegkuuljad.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
- EVL „Liidust” — source_id: `kuulmispuue_kurtus_ja_viipekeel_evl_liidust`; url: https://vaegkuuljad.ee/liidust/; normalized_url: https://vaegkuuljad.ee/liidust; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 06. Eesti Liikumispuudega Inimeste Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Liikumispuudega Inimeste Liit
SLUG: eesti-liikumispuudega-inimeste-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline katusorganisatsioon / MTÜ
FOOKUS: liikumispuue, ligipääsetavus, iseseisev elu
AMETLIK_VEEB: https://elil.ee/et/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-liikumispuudega-inimeste-liit.sources.json
- eesti-liikumispuudega-inimeste-liit.json
- eesti-liikumispuudega-inimeste-liit.meta.json
- eesti-liikumispuudega-inimeste-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Liikumispuudega Inimeste Liit — source_id: `liikumispuue_ja_iseseisev_elu_eesti_liikumispuudega_inimeste_liit`; url: https://elil.ee/et/; normalized_url: https://elil.ee/et; link_check_status: OK; ingest_status: referenced_only; priority: low
### 07. Vaimukad / Eesti Vaimupuudega Inimeste Tugiliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Vaimukad / Eesti Vaimupuudega Inimeste Tugiliit
SLUG: vaimukad-eesti-vaimupuudega-inimeste-tugiliit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: intellektipuue, eestkoste, tugivõrgustik
AMETLIK_VEEB: https://vaimukad.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- vaimukad-eesti-vaimupuudega-inimeste-tugiliit.sources.json
- vaimukad-eesti-vaimupuudega-inimeste-tugiliit.json
- vaimukad-eesti-vaimupuudega-inimeste-tugiliit.meta.json
- vaimukad-eesti-vaimupuudega-inimeste-tugiliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Vaimukad / Eesti Vaimupuudega Inimeste Tugiliit — source_id: `intellekti_autismi_psuuhikahairete__vaimukad_eesti_vaimupuudega_inimeste_tugiliit`; url: https://vaimukad.ee/; normalized_url: https://vaimukad.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 08. Eesti Autismiliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Autismiliit
SLUG: eesti-autismiliit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline katusorganisatsioon / MTÜ
FOOKUS: autism, pered, tugivõrgustik, info
AMETLIK_VEEB: https://www.autismiliit.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-autismiliit.sources.json
- eesti-autismiliit.json
- eesti-autismiliit.meta.json
- eesti-autismiliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Autismiliit — source_id: `intellekti_autismi_psuuhikahairete__eesti_autismiliit`; url: https://www.autismiliit.ee/; normalized_url: https://www.autismiliit.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 09. Dementsuse Kompetentsikeskus

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Dementsuse Kompetentsikeskus
SLUG: dementsuse-kompetentsikeskus
ORGANISATSIOONI_TÜÜP: kompetentsikeskus / teemaveeb
FOOKUS: dementsus, lähedaste ja spetsialistide tugi, info ja juhendid
AMETLIK_VEEB: https://dementsus.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- dementsuse-kompetentsikeskus.sources.json
- dementsuse-kompetentsikeskus.json
- dementsuse-kompetentsikeskus.meta.json
- dementsuse-kompetentsikeskus.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Dementsuse Kompetentsikeskus — source_id: `intellekti_autismi_psuuhikahairete__dementsuse_kompetentsikeskus`; url: https://dementsus.ee/; normalized_url: https://dementsus.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low

---

# Prioriteet B

### 01. Tallinna Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tallinna Puuetega Inimeste Koda
SLUG: tallinna-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: koda / MTÜ
FOOKUS: puudega inimesed, Tallinn, liikmesühingud
AMETLIK_VEEB: https://tallinnakoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tallinna-puuetega-inimeste-koda.sources.json
- tallinna-puuetega-inimeste-koda.json
- tallinna-puuetega-inimeste-koda.meta.json
- tallinna-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Tallinna Puuetega Inimeste Koda — source_id: `1_katusorganisatsioonid_ja_kojad_tallinna_puuetega_inimeste_koda`; url: https://tallinnakoda.ee/; normalized_url: https://tallinnakoda.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
- Tallinna Koja liikmesühingud — source_id: `1_katusorganisatsioonid_ja_kojad_tallinna_koja_liikmesuhingud`; url: https://tallinnakoda.ee/liikmesuhingud/; normalized_url: https://tallinnakoda.ee/liikmesuhingud; link_check_status: OK; ingest_status: referenced_only; priority: low
### 02. Eesti Puuetega Inimeste Fond

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Puuetega Inimeste Fond
SLUG: eesti-puuetega-inimeste-fond
ORGANISATSIOONI_TÜÜP: sihtasutus / fond
FOOKUS: puudega inimesed, rahastus ja toetusvõimalused
AMETLIK_VEEB: https://www.epifond.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-puuetega-inimeste-fond.sources.json
- eesti-puuetega-inimeste-fond.json
- eesti-puuetega-inimeste-fond.meta.json
- eesti-puuetega-inimeste-fond.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Puuetega Inimeste Fond — source_id: `1_katusorganisatsioonid_ja_kojad_eesti_puuetega_inimeste_fond`; url: https://www.epifond.ee/; normalized_url: https://www.epifond.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 03. Põhja-Eesti Pimedate Ühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Põhja-Eesti Pimedate Ühing
SLUG: pohja-eesti-pimedate-uhing
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: nägemispuue, piirkondlik tugi, infoleht Kuukiir
AMETLIK_VEEB: https://ppy.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- pohja-eesti-pimedate-uhing.sources.json
- pohja-eesti-pimedate-uhing.json
- pohja-eesti-pimedate-uhing.meta.json
- pohja-eesti-pimedate-uhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Põhja-Eesti Pimedate Ühing — source_id: `nagemispuue_ja_liitpuue_pohja_eesti_pimedate_uhing`; url: https://ppy.ee/; normalized_url: https://ppy.ee/; link_check_status: Redirect; ingest_status: referenced_only; priority: low
- PPÜ infoleht "Kuukiir" — source_id: `nagemispuue_ja_liitpuue_ppu_infoleht_kuukiir`; url: https://ppy.ee/kuukiir/; normalized_url: https://ppy.ee/kuukiir; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 04. Eesti Pimekurtide Tugiliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Pimekurtide Tugiliit
SLUG: eesti-pimekurtide-tugiliit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: pimekurtus, liitpuue, tugivõrgustik
AMETLIK_VEEB: https://www.pimekurdid.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-pimekurtide-tugiliit.sources.json
- eesti-pimekurtide-tugiliit.json
- eesti-pimekurtide-tugiliit.meta.json
- eesti-pimekurtide-tugiliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Pimekurtide Tugiliit — source_id: `nagemispuue_ja_liitpuue_eesti_pimekurtide_tugiliit`; url: https://www.pimekurdid.ee/; normalized_url: https://www.pimekurdid.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 05. Pimedate raamatukogu (RaRa)

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Pimedate raamatukogu (RaRa)
SLUG: pimedate-raamatukogu-rara
ORGANISATSIOONI_TÜÜP: raamatukoguteenus / avalik asutus
FOOKUS: nägemispuue, ligipääsetav kirjandus, audioraamatud
AMETLIK_VEEB: https://www.rara.ee/meist/rara/pimedate-raamatukogu/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- pimedate-raamatukogu-rara.sources.json
- pimedate-raamatukogu-rara.json
- pimedate-raamatukogu-rara.meta.json
- pimedate-raamatukogu-rara.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Pimedate raamatukogu (RaRa) — source_id: `nagemispuue_ja_liitpuue_pimedate_raamatukogu_rara`; url: https://www.rara.ee/meist/rara/pimedate-raamatukogu/; normalized_url: https://www.rara.ee/meist/rara/pimedate-raamatukogu; link_check_status: OK; ingest_status: referenced_only; priority: low
### 06. Tallinna ja Harjumaa Kurtide Ühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tallinna ja Harjumaa Kurtide Ühing
SLUG: tallinna-ja-harjumaa-kurtide-uhing
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: kurtus, viipekeel, piirkondlik tugi
AMETLIK_VEEB: https://www.thky.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tallinna-ja-harjumaa-kurtide-uhing.sources.json
- tallinna-ja-harjumaa-kurtide-uhing.json
- tallinna-ja-harjumaa-kurtide-uhing.meta.json
- tallinna-ja-harjumaa-kurtide-uhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Tallinna ja Harjumaa Kurtide Ühing — source_id: `kuulmispuue_kurtus_ja_viipekeel_tallinna_ja_harjumaa_kurtide_uhing`; url: https://www.thky.ee/; normalized_url: https://www.thky.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 07. Eesti Kuulmispuuetega Laste Vanemate Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Kuulmispuuetega Laste Vanemate Liit
SLUG: eesti-kuulmispuuetega-laste-vanemate-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: kuulmispuudega lapsed, pered, vanemate tugi
AMETLIK_VEEB: https://www.eklvl.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-kuulmispuuetega-laste-vanemate-liit.sources.json
- eesti-kuulmispuuetega-laste-vanemate-liit.json
- eesti-kuulmispuuetega-laste-vanemate-liit.meta.json
- eesti-kuulmispuuetega-laste-vanemate-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Kuulmispuuetega Laste Vanemate Liit — source_id: `kuulmispuue_kurtus_ja_viipekeel_eesti_kuulmispuuetega_laste_vanemate_liit`; url: https://www.eklvl.ee/; normalized_url: https://www.eklvl.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 08. Eesti Viipekeeletõlkide Kutseühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Viipekeeletõlkide Kutseühing
SLUG: eesti-viipekeeletolkide-kutseuhing
ORGANISATSIOONI_TÜÜP: erialaorganisatsioon / kutseühing
FOOKUS: viipekeeletõlge, spetsialistid, kutseinfo
AMETLIK_VEEB: https://evkty.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-viipekeeletolkide-kutseuhing.sources.json
- eesti-viipekeeletolkide-kutseuhing.json
- eesti-viipekeeletolkide-kutseuhing.meta.json
- eesti-viipekeeletolkide-kutseuhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Viipekeeletõlkide Kutseühing — source_id: `kuulmispuue_kurtus_ja_viipekeel_eesti_viipekeeletolkide_kutseuhing`; url: https://evkty.ee/; normalized_url: https://evkty.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 09. Tallinna Liikumispuudega Inimeste Ühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tallinna Liikumispuudega Inimeste Ühing
SLUG: tallinna-liikumispuudega-inimeste-uhing
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: liikumispuue, Tallinn, kogukonnatugi
AMETLIK_VEEB: https://www.tliy.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tallinna-liikumispuudega-inimeste-uhing.sources.json
- tallinna-liikumispuudega-inimeste-uhing.json
- tallinna-liikumispuudega-inimeste-uhing.meta.json
- tallinna-liikumispuudega-inimeste-uhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Tallinna Liikumispuudega Inimeste Ühing — source_id: `liikumispuue_ja_iseseisev_elu_tallinna_liikumispuudega_inimeste_uhing`; url: https://www.tliy.ee/; normalized_url: https://www.tliy.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 10. MTÜ Iseseisev Elu

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: MTÜ Iseseisev Elu
SLUG: mtu-iseseisev-elu
ORGANISATSIOONI_TÜÜP: teenuseosutaja / MTÜ
FOOKUS: iseseisev elu, puudega inimesed, tugi ja teenused
AMETLIK_VEEB: https://www.iseseisev-elu.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- mtu-iseseisev-elu.sources.json
- mtu-iseseisev-elu.json
- mtu-iseseisev-elu.meta.json
- mtu-iseseisev-elu.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- MTÜ Iseseisev Elu — source_id: `liikumispuue_ja_iseseisev_elu_mtu_iseseisev_elu`; url: https://www.iseseisev-elu.ee/; normalized_url: https://www.iseseisev-elu.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 11. Tugiliisu

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tugiliisu
SLUG: tugiliisu
ORGANISATSIOONI_TÜÜP: teenuseosutaja / MTÜ
FOOKUS: intellektipuue, tugiisik, kogukonnatugi, teenused
AMETLIK_VEEB: https://tugiliisu.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tugiliisu.sources.json
- tugiliisu.json
- tugiliisu.meta.json
- tugiliisu.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Tugiliisu — source_id: `intellekti_autismi_psuuhikahairete__tugiliisu`; url: https://tugiliisu.ee/; normalized_url: https://tugiliisu.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 12. Põhja-Eesti Autismi Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Põhja-Eesti Autismi Liit
SLUG: pohja-eesti-autismi-liit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: autism, piirkondlik tugivõrgustik
AMETLIK_VEEB: https://autism.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- pohja-eesti-autismi-liit.sources.json
- pohja-eesti-autismi-liit.json
- pohja-eesti-autismi-liit.meta.json
- pohja-eesti-autismi-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Põhja-Eesti Autismi Liit — source_id: `intellekti_autismi_psuuhikahairete__pohja_eesti_autismi_liit`; url: https://autism.ee/; normalized_url: https://autism.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 13. EPPiL

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: EPPiL
SLUG: eppil
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: psüühikahäired või erivajadus, täpsustada veebilehe põhjal
AMETLIK_VEEB: https://epill.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eppil.sources.json
- eppil.json
- eppil.meta.json
- eppil.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- EPPiL — source_id: `intellekti_autismi_psuuhikahairete__eppil`; url: https://epill.ee/; normalized_url: https://epill.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 14. Elu dementsusega

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Elu dementsusega
SLUG: elu-dementsusega
ORGANISATSIOONI_TÜÜP: teemaveeb / infoportaal
FOOKUS: dementsus, kogemusinfo, lähedaste tugi
AMETLIK_VEEB: https://eludementsusega.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- elu-dementsusega.sources.json
- elu-dementsusega.json
- elu-dementsusega.meta.json
- elu-dementsusega.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Elu dementsusega — source_id: `intellekti_autismi_psuuhikahairete__elu_dementsusega`; url: https://eludementsusega.ee/; normalized_url: https://eludementsusega.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 15. Eesti Puuetega Naiste Ühenduste Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Puuetega Naiste Ühenduste Liit
SLUG: eesti-puuetega-naiste-uhenduste-liit
ORGANISATSIOONI_TÜÜP: katusorganisatsioon / MTÜ
FOOKUS: puudega naised, võrdne kohtlemine, huvikaitse
AMETLIK_VEEB: https://epnu.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-puuetega-naiste-uhenduste-liit.sources.json
- eesti-puuetega-naiste-uhenduste-liit.json
- eesti-puuetega-naiste-uhenduste-liit.meta.json
- eesti-puuetega-naiste-uhenduste-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Puuetega Naiste Ühenduste Liit — source_id: `intellekti_autismi_psuuhikahairete__eesti_puuetega_naiste_uhenduste_liit`; url: https://epnu.ee/; normalized_url: https://epnu.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 16. Eesti Afaasialiit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Afaasialiit
SLUG: eesti-afaasialiit
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: afaasia, kõne- ja kommunikatsioonihäired
AMETLIK_VEEB: https://afaasia.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-afaasialiit.sources.json
- eesti-afaasialiit.json
- eesti-afaasialiit.meta.json
- eesti-afaasialiit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Afaasialiit — source_id: `kone_ja_kommunikatsioonihaired_eesti_afaasialiit`; url: https://afaasia.ee/; normalized_url: https://afaasia.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low

---

# Prioriteet C

### 01. Tartu Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tartu Puuetega Inimeste Koda
SLUG: tartu-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://tartukoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tartu-puuetega-inimeste-koda.sources.json
- tartu-puuetega-inimeste-koda.json
- tartu-puuetega-inimeste-koda.meta.json
- tartu-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Tartu Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_tartu_puuetega_inimeste_koda`; url: https://tartukoda.ee/; normalized_url: https://tartukoda.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 02. Pärnumaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Pärnumaa Puuetega Inimeste Koda
SLUG: parnumaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://xn--prnukoda-0za.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- parnumaa-puuetega-inimeste-koda.sources.json
- parnumaa-puuetega-inimeste-koda.json
- parnumaa-puuetega-inimeste-koda.meta.json
- parnumaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Pärnumaa Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_parnumaa_puuetega_inimeste_koda`; url: https://xn--prnukoda-0za.ee/; normalized_url: https://xn--prnukoda-0za.ee/; link_check_status: OK, Corrected; ingest_status: referenced_only; priority: low
### 03. Ida-Virumaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Ida-Virumaa Puuetega Inimeste Koda
SLUG: ida-virumaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://www.erivajadus.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- ida-virumaa-puuetega-inimeste-koda.sources.json
- ida-virumaa-puuetega-inimeste-koda.json
- ida-virumaa-puuetega-inimeste-koda.meta.json
- ida-virumaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Ida-Virumaa Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_ida_virumaa_puuetega_inimeste_koda`; url: https://www.erivajadus.ee/; normalized_url: https://www.erivajadus.ee/; link_check_status: Redirect; ingest_status: referenced_only; priority: low
### 04. Lääne-Virumaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Lääne-Virumaa Puuetega Inimeste Koda
SLUG: laane-virumaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://www.virukoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- laane-virumaa-puuetega-inimeste-koda.sources.json
- laane-virumaa-puuetega-inimeste-koda.json
- laane-virumaa-puuetega-inimeste-koda.meta.json
- laane-virumaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Lääne-Virumaa Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_laane_virumaa_puuetega_inimeste_koda`; url: https://www.virukoda.ee/; normalized_url: https://www.virukoda.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 05. Saaremaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Saaremaa Puuetega Inimeste Koda
SLUG: saaremaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://www.saarekoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- saaremaa-puuetega-inimeste-koda.sources.json
- saaremaa-puuetega-inimeste-koda.json
- saaremaa-puuetega-inimeste-koda.meta.json
- saaremaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Saaremaa Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_saaremaa_puuetega_inimeste_koda`; url: https://www.saarekoda.ee/; normalized_url: https://www.saarekoda.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 06. Viljandimaa Puuetega Inimeste Nõukoda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Viljandimaa Puuetega Inimeste Nõukoda
SLUG: viljandimaa-puuetega-inimeste-noukoda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://viljandipin.eu/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- viljandimaa-puuetega-inimeste-noukoda.sources.json
- viljandimaa-puuetega-inimeste-noukoda.json
- viljandimaa-puuetega-inimeste-noukoda.meta.json
- viljandimaa-puuetega-inimeste-noukoda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Viljandimaa Puuetega Inimeste Nõukoda — source_id: `maakondlikud_kojad_viljandimaa_puuetega_inimeste_noukoda`; url: https://viljandipin.eu/; normalized_url: https://viljandipin.eu/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 07. Võrumaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Võrumaa Puuetega Inimeste Koda
SLUG: vorumaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://www.vorukoda.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- vorumaa-puuetega-inimeste-koda.sources.json
- vorumaa-puuetega-inimeste-koda.json
- vorumaa-puuetega-inimeste-koda.meta.json
- vorumaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Võrumaa Puuetega Inimeste Koda — source_id: `maakondlikud_kojad_vorumaa_puuetega_inimeste_koda`; url: https://www.vorukoda.ee/; normalized_url: https://www.vorukoda.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 08. Põlvamaa Puuetega Inimeste Koda

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Põlvamaa Puuetega Inimeste Koda
SLUG: polvamaa-puuetega-inimeste-koda
ORGANISATSIOONI_TÜÜP: maakondlik koda / MTÜ
FOOKUS: puudega inimesed, maakondlik tugivõrgustik
AMETLIK_VEEB: https://www.polvakoda.ee/eesti-puuetega-inimeste-liidud-ja-kojad
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- polvamaa-puuetega-inimeste-koda.sources.json
- polvamaa-puuetega-inimeste-koda.json
- polvamaa-puuetega-inimeste-koda.meta.json
- polvamaa-puuetega-inimeste-koda.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: URL tundub kataloogileht; kontrolli, kas organisatsioonil on ametlikum avaleht.

**Masterlisti/tuntud allikate kontroll:**

- Põlvamaa Puuetega Inimeste Koda (kataloogileht) — source_id: `maakondlikud_kojad_polvamaa_puuetega_inimeste_koda_kataloogileht`; url: https://www.polvakoda.ee/eesti-puuetega-inimeste-liidud-ja-kojad; normalized_url: https://www.polvakoda.ee/eesti-puuetega-inimeste-liidud-ja-kojad; link_check_status: OK; ingest_status: referenced_only; priority: low
### 09. NIRK

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: NIRK
SLUG: nirk
ORGANISATSIOONI_TÜÜP: teenuseosutaja / keskus
FOOKUS: nägemispuue, rehabilitatsioon või nõustamine, täpsustada veebilehe põhjal
AMETLIK_VEEB: https://nirkkeskus.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- nirk.sources.json
- nirk.json
- nirk.meta.json
- nirk.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- NIRK — source_id: `nagemispuue_ja_liitpuue_nirk`; url: https://nirkkeskus.ee/; normalized_url: https://nirkkeskus.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 10. Viipekeeletõlgid OÜ

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Viipekeeletõlgid OÜ
SLUG: viipekeeletolgid-ou
ORGANISATSIOONI_TÜÜP: teenuseosutaja / eraõiguslik organisatsioon
FOOKUS: viipekeeletõlge, tõlketeenus
AMETLIK_VEEB: https://www.viipekeeletolgid.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- viipekeeletolgid-ou.sources.json
- viipekeeletolgid-ou.json
- viipekeeletolgid-ou.meta.json
- viipekeeletolgid-ou.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Viipekeeletõlgid OÜ — source_id: `kuulmispuue_kurtus_ja_viipekeel_viipekeeletolgid_ou`; url: https://www.viipekeeletolgid.ee/; normalized_url: https://www.viipekeeletolgid.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 11. Eesti Paralümpiakomitee

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Paralümpiakomitee
SLUG: eesti-paralumpiakomitee
ORGANISATSIOONI_TÜÜP: spordiorganisatsioon / MTÜ
FOOKUS: parasport, puudega inimesed, harrastus ja tippsport
AMETLIK_VEEB: https://www.paralympic.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-paralumpiakomitee.sources.json
- eesti-paralumpiakomitee.json
- eesti-paralumpiakomitee.meta.json
- eesti-paralumpiakomitee.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Paralümpiakomitee — source_id: `liikumispuue_ja_iseseisev_elu_eesti_paralumpiakomitee`; url: https://www.paralympic.ee/; normalized_url: https://www.paralympic.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 12. Eesti Kogelejate Ühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Kogelejate Ühing
SLUG: eesti-kogelejate-uhing
ORGANISATSIOONI_TÜÜP: puudespetsiifiline organisatsioon / MTÜ
FOOKUS: kogelus, kõne- ja kommunikatsioonihäired
AMETLIK_VEEB: https://kogelus.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-kogelejate-uhing.sources.json
- eesti-kogelejate-uhing.json
- eesti-kogelejate-uhing.meta.json
- eesti-kogelejate-uhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Kogelejate Ühing — source_id: `kone_ja_kommunikatsioonihaired_eesti_kogelejate_uhing`; url: https://kogelus.ee/; normalized_url: https://kogelus.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 13. Eesti Sclerosis Multiplexi Ühingute Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Sclerosis Multiplexi Ühingute Liit
SLUG: eesti-sclerosis-multiplexi-uhingute-liit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: sclerosis multiplex, krooniline haigus, patsiendiorganisatsioon; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://smk.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-sclerosis-multiplexi-uhingute-liit.sources.json
- eesti-sclerosis-multiplexi-uhingute-liit.json
- eesti-sclerosis-multiplexi-uhingute-liit.meta.json
- eesti-sclerosis-multiplexi-uhingute-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Sclerosis Multiplexi Ühingute Liit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_sclerosis_multiplexi_uhingute_liit`; url: https://smk.ee/; normalized_url: https://smk.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 14. Eesti Parkinsoniliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Parkinsoniliit
SLUG: eesti-parkinsoniliit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: Parkinsoni tõbi, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.parkinson.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-parkinsoniliit.sources.json
- eesti-parkinsoniliit.json
- eesti-parkinsoniliit.meta.json
- eesti-parkinsoniliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Parkinsoniliit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_parkinsoniliit`; url: https://www.parkinson.ee/; normalized_url: https://www.parkinson.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 15. Eesti Insuldipatsientide Selts

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Insuldipatsientide Selts
SLUG: eesti-insuldipatsientide-selts
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: insult, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.insuldiselts.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-insuldipatsientide-selts.sources.json
- eesti-insuldipatsientide-selts.json
- eesti-insuldipatsientide-selts.meta.json
- eesti-insuldipatsientide-selts.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Insuldipatsientide Selts — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_insuldipatsientide_selts`; url: https://www.insuldiselts.ee/; normalized_url: https://www.insuldiselts.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 16. Eesti Hemofiiliaühing

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Hemofiiliaühing
SLUG: eesti-hemofiiliauhing
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: hemofiilia, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.hemofiilia.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-hemofiiliauhing.sources.json
- eesti-hemofiiliauhing.json
- eesti-hemofiiliauhing.meta.json
- eesti-hemofiiliauhing.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Hemofiiliaühing — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_hemofiiliauhing`; url: https://www.hemofiilia.ee/; normalized_url: https://www.hemofiilia.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 17. Eesti Lihasehaigete Selts

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Lihasehaigete Selts
SLUG: eesti-lihasehaigete-selts
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: lihasehaigused, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.els.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-lihasehaigete-selts.sources.json
- eesti-lihasehaigete-selts.json
- eesti-lihasehaigete-selts.meta.json
- eesti-lihasehaigete-selts.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Lihasehaigete Selts — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_lihasehaigete_selts`; url: https://www.els.ee/; normalized_url: https://www.els.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 18. Eesti Allergialiit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Allergialiit
SLUG: eesti-allergialiit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: allergia, patsiendiinfo, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://allergialiit.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-allergialiit.sources.json
- eesti-allergialiit.json
- eesti-allergialiit.meta.json
- eesti-allergialiit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Allergialiit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_allergialiit`; url: https://allergialiit.ee/; normalized_url: https://allergialiit.ee/; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 19. Eesti Diabeediliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Diabeediliit
SLUG: eesti-diabeediliit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: diabeet, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.diabetes.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-diabeediliit.sources.json
- eesti-diabeediliit.json
- eesti-diabeediliit.meta.json
- eesti-diabeediliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Diabeediliit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_diabeediliit`; url: https://www.diabetes.ee/; normalized_url: https://www.diabetes.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 20. Eesti Reumaliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Reumaliit
SLUG: eesti-reumaliit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: reumaatilised haigused, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://reumaliit.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-reumaliit.sources.json
- eesti-reumaliit.json
- eesti-reumaliit.meta.json
- eesti-reumaliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Reumaliit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_reumaliit`; url: https://reumaliit.ee/; normalized_url: https://reumaliit.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 21. Eesti Kopsuliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Kopsuliit
SLUG: eesti-kopsuliit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: kopsuhaigused, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.kopsuliit.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-kopsuliit.sources.json
- eesti-kopsuliit.json
- eesti-kopsuliit.meta.json
- eesti-kopsuliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Kopsuliit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_kopsuliit`; url: https://www.kopsuliit.ee/; normalized_url: https://www.kopsuliit.ee/; link_check_status: Search-confirmed, Corrected; ingest_status: referenced_only; priority: low
### 22. Eesti Vähiliit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Vähiliit
SLUG: eesti-vahiliit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: vähk, patsiendiorganisatsioon, ennetus ja tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://cancer.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-vahiliit.sources.json
- eesti-vahiliit.json
- eesti-vahiliit.meta.json
- eesti-vahiliit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Vähiliit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_vahiliit`; url: https://cancer.ee/; normalized_url: https://cancer.ee/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 23. Eesti Neeruhaigete Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Neeruhaigete Liit
SLUG: eesti-neeruhaigete-liit
ORGANISATSIOONI_TÜÜP: patsiendiorganisatsioon / MTÜ
FOOKUS: neeruhaigused, patsiendiorganisatsioon, tugivõrgustik; organisatsiooniprofiil ei tohi anda diagnoosi- ega ravisoovitusi
AMETLIK_VEEB: https://www.neer.ee/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-neeruhaigete-liit.sources.json
- eesti-neeruhaigete-liit.json
- eesti-neeruhaigete-liit.meta.json
- eesti-neeruhaigete-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

**Masterlisti/tuntud allikate kontroll:**

- Eesti Neeruhaigete Liit — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_neeruhaigete_liit`; url: https://www.neer.ee/; normalized_url: https://www.neer.ee/; link_check_status: Redirect; ingest_status: referenced_only; priority: low

---

# REVIEW / enne otsustamist kontrollida

### 01. Tallinna nõustamine nägemispuudega inimesele

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Tallinna nõustamine nägemispuudega inimesele
SLUG: tallinna-noustamine-nagemispuudega-inimesele
ORGANISATSIOONI_TÜÜP: KOV teenuseinfo / vajab eraldi otsust
FOOKUS: nägemispuue, Tallinna teenuseinfo
AMETLIK_VEEB: https://www.tallinn.ee/et/noustamine-nagemispuudega-inimesele
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- tallinna-noustamine-nagemispuudega-inimesele.sources.json
- tallinna-noustamine-nagemispuudega-inimesele.json
- tallinna-noustamine-nagemispuudega-inimesele.meta.json
- tallinna-noustamine-nagemispuudega-inimesele.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: See võib kuuluda pigem KOV moodulisse, mitte organisatsioonipaketti. Märgi needs_review, kui kasutad.

**Masterlisti/tuntud allikate kontroll:**

- Tallinna nõustamine nägemispuudega inimesele — source_id: `nagemispuue_ja_liitpuue_tallinna_noustamine_nagemispuudega_inimesele`; url: https://www.tallinn.ee/et/noustamine-nagemispuudega-inimesele; normalized_url: https://www.tallinn.ee/et/noustamine-nagemispuudega-inimesele; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 02. Sotsiaalministeeriumi kompetentsikeskuse leht: Eesti Pimedate Liit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Sotsiaalministeeriumi kompetentsikeskuse leht: Eesti Pimedate Liit
SLUG: sm-kompetentsikeskus-eesti-pimedate-liit
ORGANISATSIOONI_TÜÜP: riiklik teemaleht / reference
FOOKUS: ligipääsetavus, infoportaalid ja võrgustikud
AMETLIK_VEEB: https://kompetentsikeskus.sm.ee/et/vordsed-voimalused/ligipaasetavus/tahad-teada-rohkem/infoportaalid-ja-vorgustikud/eesti-pimedate-liit
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- sm-kompetentsikeskus-eesti-pimedate-liit.sources.json
- sm-kompetentsikeskus-eesti-pimedate-liit.json
- sm-kompetentsikeskus-eesti-pimedate-liit.meta.json
- sm-kompetentsikeskus-eesti-pimedate-liit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: See ei ole organisatsiooni ametlik avaleht; kasuta pigem reference-allikana või jäta organisatsioonipaketi lisaviiteks.

**Masterlisti/tuntud allikate kontroll:**

- Sotsiaalministeeriumi kompetentsikeskus: Eesti Pimedate Liit — source_id: `nagemispuue_ja_liitpuue_sotsiaalministeeriumi_kompetentsikeskus_eesti_pimedate_liit`; url: https://kompetentsikeskus.sm.ee/et/vordsed-voimalused/ligipaasetavus/tahad-teada-rohkem/infoportaalid-ja-vorgustikud/eesti-pimedate-liit; normalized_url: https://kompetentsikeskus.sm.ee/et/vordsed-voimalused/ligipaasetavus/tahad-teada-rohkem/infoportaalid-ja-vorgustikud/eesti-pimedate-liit; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 03. Eesti Aspergerite / Autistide liidu vana WordPress-kanal

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Aspergerite / Autistide liidu vana WordPress-kanal
SLUG: eesti-aspergerite-autistide-liidu-vana-wordpress-kanal
ORGANISATSIOONI_TÜÜP: ajalooline veebikanal / needs_review
FOOKUS: autism, Aspergeri sündroom, ajalooline info
AMETLIK_VEEB: https://aspiyhing.wordpress.com/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-aspergerite-autistide-liidu-vana-wordpress-kanal.sources.json
- eesti-aspergerite-autistide-liidu-vana-wordpress-kanal.json
- eesti-aspergerite-autistide-liidu-vana-wordpress-kanal.meta.json
- eesti-aspergerite-autistide-liidu-vana-wordpress-kanal.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: Tõenäoliselt ajalooline/vananenud kanal; kontrolli, kas on aktiivne organisatsioon või ainult arhiiv.

**Masterlisti/tuntud allikate kontroll:**

- Eesti Aspergerite / Autistide liidu vana WordPress-kanal — source_id: `intellekti_autismi_psuuhikahairete__eesti_aspergerite_autistide_liidu_vana_wordpress_kanal`; url: https://aspiyhing.wordpress.com/; normalized_url: https://aspiyhing.wordpress.com/; link_check_status: OK; ingest_status: referenced_only; priority: low
### 04. Põhja-Eesti Neeruhaigete Selts

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Põhja-Eesti Neeruhaigete Selts
SLUG: pohja-eesti-neeruhaigete-selts
ORGANISATSIOONI_TÜÜP: sotsiaalmeedia leht / needs_review
FOOKUS: neeruhaigused, piirkondlik patsiendiorganisatsioon; kontrolli ametlik veebiallikas
AMETLIK_VEEB: https://www.facebook.com/p/P%C3%B5hja-Eesti-Neeruhaigete-Selts-100011071697630/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- pohja-eesti-neeruhaigete-selts.sources.json
- pohja-eesti-neeruhaigete-selts.json
- pohja-eesti-neeruhaigete-selts.meta.json
- pohja-eesti-neeruhaigete-selts.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: Facebook ei ole ideaalne põhiandmeallikas; otsi võimalusel ametlikum veeb või jäta referenced_only/needs_review.

**Masterlisti/tuntud allikate kontroll:**

- Põhja-Eesti Neeruhaigete Selts (Facebook) — source_id: `neuroloogilised_ja_kroonilised_seis_pohja_eesti_neeruhaigete_selts_facebook`; url: https://www.facebook.com/p/P%C3%B5hja-Eesti-Neeruhaigete-Selts-100011071697630/; normalized_url: https://www.facebook.com/p/Põhja-Eesti-Neeruhaigete-Selts-100011071697630; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 05. Eesti Epilepsialiit

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Eesti Epilepsialiit
SLUG: eesti-epilepsialiit
ORGANISATSIOONI_TÜÜP: registripõhine viide / needs_review
FOOKUS: epilepsia, patsiendiorganisatsioon; kontrolli, kas aktiivne ametlik veeb on olemas
AMETLIK_VEEB: https://www.inforegister.ee/80068934-EESTI-EPILEPSIALIIT-MTU/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- eesti-epilepsialiit.sources.json
- eesti-epilepsialiit.json
- eesti-epilepsialiit.meta.json
- eesti-epilepsialiit.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: Inforegister on registripõhine/ajalooline viide, mitte organisatsiooni ametlik sisuleht.

**Masterlisti/tuntud allikate kontroll:**

- Eesti Epilepsialiit (ajalooline / registripõhine viide) — source_id: `neuroloogilised_ja_kroonilised_seis_eesti_epilepsialiit_ajalooline_registripohine_viide`; url: https://www.inforegister.ee/80068934-EESTI-EPILEPSIALIIT-MTU/; normalized_url: https://www.inforegister.ee/80068934-EESTI-EPILEPSIALIIT-MTU; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
### 06. Epilepsiaga inimeste tugigrupp

```text
Kasuta organisatsiooni_rag_andmekorje_ulesanne.md reegleid.

ORGANISATSIOONI_NIMI: Epilepsiaga inimeste tugigrupp
SLUG: epilepsiaga-inimeste-tugigrupp
ORGANISATSIOONI_TÜÜP: sotsiaalmeedia grupp / needs_review
FOOKUS: epilepsia, kogukonnatugi; ei sobi iseseisvaks ametlikuks organisatsiooniprofiiliks
AMETLIK_VEEB: https://www.facebook.com/groups/epilepsialiit/
CHECKED_AT: 2026-04-29

Tee 4 tuumfaili:
- epilepsiaga-inimeste-tugigrupp.sources.json
- epilepsiaga-inimeste-tugigrupp.json
- epilepsiaga-inimeste-tugigrupp.meta.json
- epilepsiaga-inimeste-tugigrupp.rag.md

Ära tee PDF/DOC/DOCX täisingest’i. Materjalid märgi eraldi knowledge-doc kandidaatideks.
Kui allikas on ebaselge, aegunud, sotsiaalmeedia, registripõhine või mitte organisatsiooni ametlik leht, märgi needs_review.
```

MÄRKUS: Facebooki grupp ei sobi üldjuhul ametliku organisatsiooniprofiili põhiandmeallikaks.

**Masterlisti/tuntud allikate kontroll:**

- Epilepsiaga inimeste tugigrupp (Facebook) — source_id: `neuroloogilised_ja_kroonilised_seis_epilepsiaga_inimeste_tugigrupp_facebook`; url: https://www.facebook.com/groups/epilepsialiit/; normalized_url: https://www.facebook.com/groups/epilepsialiit; link_check_status: Search-confirmed; ingest_status: referenced_only; priority: low
