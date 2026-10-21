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

## Tulemus serveris (21.10.2026)

Võrdlus eelregistreeringu järgi ([eelregistreering](../audits/vestlustest-2026-10-21-kaardid-eelregistreering.json),
[andmed](../audits/evidence/sol-proof-20261014-01/server-rag-chat-three-cases-adr165-166-raw.json)). Samad 75 küsimust
kolmes seisus:
- **R0:** õhtune kordus, search-assist-16, answer-13;
- **R1:** baas, search-assist-18, answer-15;
- **R2:** kaardid, search-assist-19, answer-15.

| | R0 | R1 | R2 |
|---|---:|---:|---:|
| vastuseid | 75/75 | 75/75 | 74/75 (B03 vastusekutse ajapiir) |
| täis- / osalised vastused | 29 / 46 | 30 / 45 | 32 / 42 |
| H1 valiku täpsus (valitud lõigust tsiteeriti) | 55,2% | 52,2% | 55,3% |
| H2 autoriteetsete osa tsiteeritud teadmuslõikudest | 64,9% | 66,1% | 63,2% |
| „ei saa“ lausega pöördeid | 18 | 10 | 18 |
| aeg mediaan / p90 | 25,2 / 33,5 s | 26,0 / 33,9 s | 26,1 / 32,9 s |
| valiku sisend / aeg (mediaan) | 16 683 / 4,4 s | 16 838 / 4,8 s | 18 283 / 4,2 s |
| plaan (mediaan) | 3,8 s | 4,2 s | 4,4 s |

- **H1:** +3,1 pp R1 suhtes. Sama suur vahe oli R0 ja R1 vahel vastupidises suunas, nii et see on jooksudevahelise
  müra piires.
- **H2:** −2,9 pp, eelregistreeritud piiri (3 pp) sees.
- **H3:** ei täitunud.
  - „Ei saa“ pöördeid oli 18, lubatud oli kuni 13. R0-s oli neid samuti 18. Lisandunud laused on peamiselt
    tingimuslaused puuduva kasutaja asjaolu või hindamise kohta. Andmete puudumist väljendavad neist kolm (A20, A21:
    Tartu kohalik kord ja linn või vald; B20).
  - Valiku sisend kasvas 8,6%, lubatud oli 8%. Valiku aeg ei kasvanud.
- **H4:** Tabasalu küsimus viis korda. Tervishoiu lõik oli kandidaatide hulgas 4 korral ja valiti 3 korral, toimetulekutoetuse
  lõik 1 korral. Enne oli tulemus samuti 3/4, eesmärk oli vähemalt 4.
- **Eelregistreeritud otsus:** H3 ei täitunud põhjusel, mida muudatus võib põhjustada (valiku sisend), seega `revert_all`.
  Mõõdetavat kasu müra piiridest kõrgemal ei ole. Otsus on omaniku käes, see on allpool.
