# ADR-166 — Valikumudeli kandidaadikaardil on lõigu alampealkiri, allika liik ja väljaandja (search-assist-19)

21.10.2026. Teostus Claude Opus 5.5. Omaniku otsus: „Panna kaardile eraldi väljale lõigu enda alampealkiri, allika liik
(seadus, ametlik juhend, veebileht, uuring) ja väljaandja.“ Seda mõõdetakse kogu 75 küsimusega.

## Leid

- Kaardil olid seni `id`, `title` (dokumendi pealkiri), `year`, õigusakti kehtivus ja lõigu otsingutekst.
- ADR-165 juhtum: narko.ee lehe kahel lõigul on sama pealkiri, „Tasuta sotsiaal- ja õigusabi ning tervishoiuteenused
  ravikindlustamata inimestele“. Üks lõik on toimetulekutoetusest, teine ravikindlustamata inimeste tervishoiust.
  Valikumudel võttis kahel juhul kolmest esimese. Alampealkiri oli teksti esimesel real, aga eraldi välja sel polnud.
- Allika liik ja väljaandja on dokumendi väljadel (`source_type`, `authority`), kuid valikumudel ei näinud neid. Reegel
  „keep the most specific and authoritative one“ pidi autoriteedi teksti järgi ära arvama.

## Otsus

- **`section`:** lõigu enda pealkirjatee dokumendi pealkirja all, otsinguteksti esimeselt realt (`passageSection`,
  kuni 200 märki). Ilma oma alampealkirjata lõigul seda välja ei ole.
- **`source_type`** (näiteks `legal_act`, `official_guideline`, `research_report`, `kov_service_info`,
  `information_material`, `journal_article`) ja **`authority`** (näiteks Riigikogu, Sotsiaalkindlustusamet,
  Statistikaamet või omavalitsus):
  - laaditud allikal tema enda väljadelt;
  - teistel `PostgresCatalog.documentSources` kaudu: kaks välja salvestatud bundle'ist, loetakse üks kord dokumendi ja
    protsessi kohta, nagu pealkirjad.
- **Valikumudeli juhis** (search-assist-19, `RERANK_CARD_INSTRUCTIONS`, kohe sisendi kirjelduse järel):
  - kirjeldab välju;
  - ütleb, et sama dokumendi eri alampealkirjadega lõigud on eri lõigud;
  - ütleb, et liiki ja väljaandjat kasutatakse koos tekstiga kõige täpsema ja autoriteetsema lõigu valimisel.
- Otsingu järjestus, kandidaatide arv ja profiil ei muutu. Muutub ainult see, mida valikumudel kaardil näeb.

## Kontroll

- **Kohalik `retrieve()`** mälus hoitud dokumentidega:
  - sama lehe kaks lõiku said eri `section`-i;
  - seadus sai `legal_act` / Riigikogu;
  - alampealkirjata lõigul välja ei ole;
  - ilma `documentSources`-ita adapter töötab edasi.
- **Kohalik Postgres:** `documentSources` 40 dokumendile võttis 150 ms, mälust 0,1 ms.
- **Serveris:** 75 küsimust enne (ADR-165 seis) ja pärast. Võrreldakse:
  - valitud ja tsiteeritud lõike kanali ja koha järgi;
  - vastuste liike ja tsiteeritud allikaid;
  - „ei saa“ lauseid;
  - aegu.
