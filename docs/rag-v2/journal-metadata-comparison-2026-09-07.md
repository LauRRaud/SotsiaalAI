# Ajakirja kohalike failide võrdlus serveri metaandmetega

Mõõdetud 07.09.2026 kell 22.14 Europe/Tallinn. Omaniku juhise järgi on ajakirjanumbrite ja bibliograafiliste metaandmete võrdlusalus serveris säilinud versioon. Kohalik sisend on `Andmebaasi/ajakiri_sotsiaaltoo_pdf_meta/`; omaniku artiklitöö kausta ei kasutatud.

## Tulemus

Serveri vana RAG-i allikahoidla **on säilinud**: `/var/lib/sotsiaalai-rag/registry.json` ja selle all `docs/` PDF-id. Rakenduse tühja `RagDocument` tabeli järgi ei saa järeldada selle hoidla puudumist.

| Kontroll | Mõõdetud tulemus |
| --- | --- |
| Kohalikud PDF-id ja metafailid | 638 PDF-i ning 638 loetavat JSON-i; iga `source_path` lahendub kohaliku PDF-ini |
| PDF-i vastendus serveriga | Kõik 638 leidsid täpselt ühe mittekustutatud vaste sama SHA-256 järgi |
| Võrreldud bibliograafilised väljad | `title`, `authors`, `year`, `journalTitle`, `issueLabel`, `section`, `pageRange`, `articleId` |
| Nendes väljades samad metafailid | 505 |
| Vähemalt ühe erinevusega metafailid | **133** |
| Erinevused väljade kaupa | 68 autorite, 41 pealkirja, 26 rubriigi, 99 lehekülgede ja 42 artiklitunnuse erinevust; samal failil võib olla mitu erinevust |
| Aastaarvu, ajakirja pealkirja ja numbri erinevused | Nende 638 baitidentse vaste vahel puuduvad |
| Serveri ajakirjakogu register | 903 kirjet: 877 `ACTIVE`, 11 `DELETED`, 15 ilma `lifecycleState` väljata |
| Serveri mittekustutatud allikakirjed | 892: 638 PDF-i ja 254 TXT-allikat. Hilisem parserikontroll parandas algse failivormingu eelduse. |

15 elutsükliväljata kirjet on 2018. aasta erinumbri materjalid, mille PDF-id vastavad kohalikele failidele. Neid ei nimetata automaatselt aktiivseks ega jäeta korpusest vaikimisi välja. Uues impordimanifestis peab nende kaasamine ja staatus olema nähtav. Kustutatud 11 kirjet ei taastata kohaliku faili olemasolu põhjal.

254 serveris lisaks olnud TXT-allikat jaotuvad aastati: 2016 — 112; 2017 — 68; 2018 — 18; 2022 — 13; 2024 — 1; 2026 — 42. Need on selles vanemas kohalikus kaustas puuduvad vasted. Hiljem lisatud täielikus pakis olid vastavad JSON-id ja TXT-d olemas; parandatud paki praegune tulemus on [paranduse tõendis](journal-source-repair-2026-09-07.md).

## Konkreetsed erinevused

- `17-4/huvikaitse-puuetega-inimeste-kodade-naidel-2017.json` nimetab autoriks „autor puudub PDF esilehel”; sama PDF-i serverikirjes on **Mihkel Tõkke**.
- `18-1/antwerpenis-oppimine-2018.json` kirjeldab Antwerpeni sotsiaaltööõpet, kuid viidatud PDF-i baitidentne serverivaste on **„NASW juhtumikorralduse standardite analüüs”**, autorid Ele-Reet Ehelaid ja Kai Raku, lk 70–72. Üksnes vana `articleId` järgi sobitamine kannaks vale kirjelduse uude süsteemi.

Kõik vastendused, iga erinevuse kohalik ja serveriväärtus ning 254 täiendava serveriallikaga loend on [masinloetavas võrdlusfailis](journal-metadata-comparison-2026-09-07.json). Erinevuste arv ei ole sõltumatu sisuauditi veaarv; serveri bibliograafia autoriteetsus lähtub omaniku juhisest. Räsi tõendab failide identsust, mitte iseseisvalt kõigi bibliograafiliste väärtuste õigsust.

## Leitud vana logi

Serveris leidub `/home/ubuntu/apps/sotsiaalai/logs/rag-journal-reindex-20260821T231905Z.log`: 21.08 taasindekseerimisel valiti 873 artiklit, tulemuseks 863 õnnestumist ja 10 viga `Stored file is missing`. See on impordivigade logi, **mitte leitud bibliograafiliste paranduste täielik loend**. Eraldi varasemat metaandmete vealoendit tehtud piiratud otsinguga ei leitud. Tänane register sisaldab hilisemat seisu; vana logi 10 viga ei tähenda, et täna puuduks 10 aktiivset PDF-i.

## Ülekandereegel

Ajakirja bibliograafia võetakse omaniku kinnitatud serveri metaandmetest, arvestades paranduse käigus allikast tõendatud artiklipiire. PDF-id säilitatakse või eraldatakse terviknumbritest ning veebiallikad salvestatakse HTML-ina. Kohalikud failid seotakse serveriga räsi järgi. Bibliograafia kantakse serverist üle; uusi otsingu-, tekstiankru- ja graafivälju arvutatakse algteksti põhjal. Serveri vanu vektoreid, tekstiosade jaotust ega graafi pole vaja säilitada.

Kohalikke algfaile ja metafaile, serveri registrit ning indekseid selles kontrollis ei muudetud. Täielik võrdlus tehti failide ja metaandmete lugemisega; tasulisi mudelipäringuid ei tehtud. Impordi teostus jätkub projekti elavas tööfailis määratud plokina.
