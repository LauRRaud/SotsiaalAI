# ADR-150: Uudiskirja 20.10 korje, teemade materjalid ja CARe artiklite tõlked

Kuupäev: 20.10.2026. Teostus Claude Opus 5.5. Seis: **korpus v89: serveris alates 20.10.2026 kell 15.32: 73 uuringut ja juhendit ning kaks CARe artikli tõlget; ost 0,5699 USD.**

## Miks

Omanik leidis ajakirja Sotsiaaltöö uudiskirjadest numbrid, mis 07.10 korjes ([ADR-099](adr-099-official-studies-and-guides-by-list.md)) puudusid (21 kirja, 2020–2022), ja pani kausta `Andmebaasi/Uut juurde` teemad, mille kohta otsida materjale. Omaniku sõnad:

- „sealt pidime võtma uuringud, juhendid jms, mis on selline, mis väga ei aegu“;
- „Do this task here: Uute kogutud materjalide lisamine RAG-i“;
- CARe allikate kohta saatis omanik ülevaate: BMC Psychiatry 2015 ja 2017 artikli võib kohe tõlkida, „piisab viitamisest“;
- küsimusele, kas laadin paki serverisse ja käivitan ostu laega 0,60 USD ning kontrollpöörded laega 0,10 USD: „minu luba antud“.

## Mis sisse läks

| Rühm | Dokumente | Lõike |
|---|---:|---:|
| 20.10 uudiskirja korje (2020–2022) | 60 | 5197 |
| „Uut juurde“ teemadele leitud (uimastid, VIPS ja astmeline abi, kukkumised, töökeskkonna vaimne tervis) | 11 | 1164 |
| 07.10 kogu dokumendid, mis ootasid piltideta koopiat (inimarengu aruanne 2026, „Mälestuste mustrid“ nr 2) | 2 | 941 |
| CARe artiklite eestikeelsed tõlked (BMC Psychiatry 2015 ja 2017) | 2 | 47 |
| **kokku** | **75** | **7349** |

Liigid: 50 uuringut, 10 ametlikku juhendit, 7 infomaterjali, 6 poliitikaanalüüsi (sh vaimse tervise roheline raamat ja astmelise abi tegevuskava) ja 2 tõlget (uuringud). Väljaandjad on samade nimedega nagu korpuses (v66 reegel: faili hoidva saidi asutus; näiteks Justiitsministeeriumi 2019–2021 väljaanded on „Justiits- ja Digiministeerium“, Haigekassa omad „Tervisekassa“). Metaandmed on ADR-099 võtmetega, märksõnu ei ole; `collection.collected_from` ütleb uudiskirja numbri või väljaandja lehe. Aadress on faili enda aadress, millelt see loeti, uudiskirja lugemislinki ei kirjutata (kannab tellija tunnust).

**Enne lisamist kontrollitud:** ühegi faili baidid ega normaliseeritud pealkiri ei ole hoidla v88 peas (10 899 dokumenti); seotud failide teksti kattuvus on 0–11 % (näiteks „Lapse õigused 2020–2021“ on inimõiguste aruande peatüki täisversioon, mitte koopia). Uuemate väljaannete kontroll (`Andmebaasi/Sotsiaaltöö uudiskiri/Uuemad väljaanded 2026-10-20.txt`) jättis korjest välja dokumendid, mille uuem väljaanne on juba RAG-is.

**Välja jäi Tervisekassa töövihik** „Minu vaimse tervise esmaabi. Töövihik noortele ja täiskasvanutele“ (20 lk, 1333 sõna): vastuvõtt pidas selle kinni (`partial_text_needs_review`, liiga paljudel lehekülgedel puudub tekstikiht), nagu v68 kaks dokumenti. Fail on `tmp/rag-v2-v89/held/`, seis registris `held_partial_text`.

## Piltideta koopiad

Vastuvõtu piir on 32 MB. Kolm faili olid suuremad ainult piltide või joonistuste tõttu; ADR-099 loendis ootasid kaks neist „piltideta koopiat“.

| Fail | Enne | Pärast | Mis eemaldati |
|---|---:|---:|---|
| Riigikontrolli aastaaruanne 2020 „Esmatähtsate avalike teenuste tulevik“ | 43,6 MB | 1,7 MB | 7 suurt vektorjoonist (vormiobjektid) |
| Eesti inimarengu aruanne 2026 | 174 MB | 23,7 MB | 177 pilti (igaüks üks valge piksel) |
| „Mälestuste mustrid“ nr 2 (Dementsuse Kompetentsikeskus) | 40 MB | 2,1 MB | 639 pilti |

Iga koopia iga lehekülje tekst võrreldi väljaandja failiga ja oli sama (`tmp/rag-v2-v89/tools/stripimages.py`, `stripforms.py`; koopiat ei hoita, kui mõni lehekülg erineb). Esimene katse salvestas inimarengu aruande sisuvoogude ümberkirjutamisega ja kuuel leheküljel muutusid reavahetused; koopia jäeti kõrvale ja tehti uuesti ilma ümberkirjutamiseta. Koopia metaandmetes on `collection.copy` ja väljaandja faili räsi.

## CARe artiklite tõlked

Omaniku ülevaade jagas CARe allikad kolme rühma. Mida tehti:

- **Sotsiaaltöö artiklid** (Tsuiman 2024, Hanga 2020, Roosipuu 2020) ja ajakirja artikkel WHO QualityRights'ist olid korpuses juba olemas; nende pärast ei olnud vaja midagi teha.
- **BMC Psychiatry 2015 (uuringu ülesehitus) ja 2017 (tulemused):** litsents loeti artikli enda failist (Europe PMC täistekst PMC4510908 ja PMC5725818): mõlemad on CC BY 4.0. Tõlgitud osaliselt: kokkuvõte, CARe teoreetiline taust (personaalne taastumine kolme faasi ja viie taastumistegurite rühmaga, kohalolule suunatud käsitlus, tugevate külgede mudeli kuus põhimõtet), metoodika kuus sammu, koolitus ja juhendamine, mudelitruuduse kriteeriumid, tulemused, arutelu ja järeldused; 2015. aasta tõlke lõpus on terminite loend. Välja jäid värbamise üksikasjad, mõõdikute psühhomeetrika, statistika tehniline osa, tabelid (olulised arvud tekstis) ja kirjanduse loetelu.
- Terminid on ühtlustatud korpuses olevate Sotsiaaltöö artiklitega: strengths assessment → tugevuste kaardistus (eesti CARe-materjalides isiklik profiil), recovery worksheet → taastumise tööleht (tegevusplaan), support plan → toetusplaan, presence approach → kohalolule suunatud käsitlus.
- Iga tõlke alguses on algupärandi autorid, pealkiri, DOI, litsentsi link, märge „osaline tõlge“, tõlkija (Claude, Anthropic), see, et erialatoimetaja ei ole tõlget üle vaadanud ja autorid ei ole seda heaks kiitnud, ning välja jäetud osade loetelu. Tõlge on HTML-ist tehtud PDF (`tmp/rag-v2-v89/care/`, `tools/html-pdf.py`); metaandmetes on riik NL, `collection.translation`, `collection.license` ja `collection.left_out`.
- **Ülevaatus käsitsi:** reegli märkus („alla laaditud väljaandja ametlikult aadressilt“) ei kehti tõlke kohta, seega on kahel kirjel oma märkus, mis ütleb, mis dokument on ja et see on taust ja tõendus, mitte juhis.
- **Teise assistendi kokkuvõte 2017. aasta tulemusest** („elukvaliteet paranes mõlemas grupis, gruppide vahel olulist erinevust ei leitud“) on õige ühe täpsustusega: 10 kuu järel oli sekkumisrühma kasuks väike erinevus elukvaliteedi ja rahuldamata vajaduste muutuses, 20 kuu järel see kadus; segamudelis sekkumise mõju ei olnud.
- Ei puudutatud: Wilken 2021 (CC BY-NC-ND, tõlge vajab luba), Scandinavian Journal of Caring Sciences 2019 (tasuline, õigused reserveeritud), uus käsiraamat „Supporting Recovery and Inclusion“ (EPRÜ tõlgib ise).

## Jurist aitab: lisatavat ei ole

20.10 teemade kontrollis olin pakkunud lisada 268 lepinguõiguse, eestkoste, ülalpidamise ja pärimise lehte, mida korpuses ei ole. Iga lehte lugedes (`tmp/rag-v2-v89/tools/jurist-kind.py`, 2 s vahega) olid 266 neist juristi vastused eraisiku küsimusele (märge „Vastatud: kuupäev“, vastatud 2024–2026); neid omanik 11.10 ei soovinud ([ADR-143](adr-143-edited-legal-articles-and-15000-documents.md)). Ülejäänud kaks („Mis on korteriühistu?“, „Millal eestkoste lõpeb?“) on toimetatud artiklid, mis loeti 11.10 korjes ja jäid reegli alampiiri tõttu välja (27 sõna). Seega ei lisatud ühtegi lehte ja varasem soovitus failis `Andmebaasi/Uut juurde/Leitud 2026-10-20/RAG-materjalid teemade kaupa.txt` oli selles osas vale.

## Kohalik kontroll enne ostu

Partii 73 dokumenti läbisid reegliga ülevaatuse (`scripts/rag-v2-review-by-rule.mjs`, liik `document`): 0 probleemi. Faili sõnadest jõudis lõikudesse üle 85 % kõigil peale ühe: „Teel tasakaalustatud ühiskonda III“ (tabelitega kogumik) 80 % sõnadest ja lehekülgedest. Kohalik arvestus: 7349 lõiku, 4 384 400 tokenit.

## Ost ja indeks

| | |
|---|---|
| alus | korpus v88, hoidla pea `generation_0499a50e…` (serveris sama, kontrollitud enne üleslaadimist) |
| pakk | 455 MB, 75 versiooni, räsi `5d8da4a2…`; poliitika 10 931 dokumenti |
| tasuta plaan | 7338 sisendit (11 kordust), 4 383 560 tokenit, 0,5699 USD, `matches_baseline: true` |
| ost | 7338/7338 sisendit, **0,5699 USD** (`usage_cost_usd`, arvestatud kinnitatud kasutusest, mitte arvelt), teadmata tulemusega 0; lagi 0,60 |
| indeks | `1fe64adb`: **10 931 dokumenti, 103 464 lõiku** (piirid 15 000 ja 150 000); 75 dokumenti suletud, 10 856 üle võetud; käik 11.51–12.32 UTC |
| vestlusplaan | `m4-corpus-chat-20261020a.json` |
| ketas | enne 14 GB vaba; pärast 11 GB vaba (87 %); 75 versioonikausta pakiti (1049 MiB → 189 MB) |

Käigu ajal paigaldati teise töö väljalase `8b084e2e` (11.53 UTC, plaani uuendus väljalaskega); vestlusplaani samm hoidis paigalduse lukku ja võttis aluseks selle uuendatud plaani (tase `low`, valikud `low,medium`, auditipäevi 7); teenus töötab uue plaaniga. Kuluarvestus algab uuel plaanil nullist, nagu igal korpuse täiendusel.

Hind 0,13 USD miljoni sisendtokeni kohta, loetud pakkuja lehelt 20.10.2026. Serveri käigu käivitas omanik ise: seansi õiguste kontroll ei lubanud mul serveris käivitusskripti käivitada (nagu v88 puhul); paki üleslaadimine ja serveri seisu lugemine olid lubatud.

## Kontroll pärast täiendust

**Otsinguvärav (tasuta, [ADR-122](adr-122-free-search-gate.md)):** 33 kontrollküsimust v77 lähteseisu vastu, kaks jooksu: vigu 0, ühtki otsustavat lõiku ei kadunud, 4 paremat, 2 halvemat, 27 muutunud (sama 0). Halvemad on samad kaks, mis v88 järel: Harku tugiisiku küsimus ja Narva asendushoolduse isiklike kulude küsimus, mille otsustav säte on nüüd 17. kohal (v77 8., v88 järel 21.). Paremaks läks lisaks v88-le pöördumise tähtaja küsimus (25 → 24). Kolmel v88 „sama“ küsimusel on otsustav lõik samal kohal, muutus on kandidaatide koosseisus. Otsingu mediaanaeg: esimene jooks 8,0 s, teine 5,9 s (v77 lähteseis 5,2 s, v88 järel 5,1 s); esimese jooksu lisaaeg oli soojenemine pärast teenuse taaskäivitust; ülejäänud umbes 0,8 s võib tulla 7 % suuremast indeksist või mõõtmise kõikumisest, seda ei ole eraldi mõõdetud.

**Tasuline kontroll (päris vestluse rada, `w4/check-v89`, lagi 0,10 USD):** 12 küsimust uute dokumentide teemadel, igaüks üks kord (9 spetsialisti, 3 abiotsija sõnastuses). **12 pööret, vigu 0, kõik vastused läbisid kontrolli, 0,0444 USD**, ajutisi kasutajaid ei jäänud. Kõik 12 vastust viitasid vähemalt ühele uuele dokumendile:

| Küsimus | Uued allikad vastuse viidetes |
|---|---|
| CARe sammud, isiklik profiil ja tegevusplaan | mõlemad tõlked koos Tsuimani ja Hanga artikliga |
| CARe tõhusus kontrollrühmaga | mõlemad tõlked; vastus eristab 10 kuu esialgset erinevust lõppanalüüsist ja nimetab piirangu (üks uuring, Hollandi teenused) |
| lühisekkumine alkoholi liigtarvitajaga | TAI töölehed ja perearsti abimaterjal |
| astmelise abi tegevuskava ja omavalitsus | SoM tegevuskava 2024–2027 |
| Problem Management Plus Eestis | TAI teostatavusuuring |
| eaka kodu kukkumisriski hindamine | Päästeameti metoodika ja TAI teiste riikide praktikate analüüs |
| Riigikontroll eakate probleemide märkamisest | RK 2021 audit |
| tsiviilõiguslik lähenemiskeeld | JM kohtupraktika analüüs |
| pikaajaline hooldus aastani 2035 | Arenguseire Keskuse kolm raportit |
| laps annab kohtus tunnistusi (abiotsija) | juhendmaterjal lapsele ja kriminaalmenetluse seadustik |
| lahku minev pere (abiotsija) | õiguskantsleri vanema juhend ja infomaterjal |
| narkootikumide kahjude vähendamine (abiotsija) | TAI 2023 teabeleht koos olemasolevate lehtedega |

Kümnes vastuses oli tüüp „osaline“ (vastus ütleb, mida allikad ei kata), kahes „põhjendatud“.

## Lahtine

- Uuemate väljaannete otsus: vanemad sarja väljaanded (narkootikumide olukord 2024, EUROSTUDENT 8, EU Kids Online 2018 jt) on RAG-is koos uuematega; kas need jäävad aastaga eristatult või võetakse välja, on omaniku otsus.
- Lisamiskandidaadid, mida kogus ei ole (sama fail, jaotised 2 ja 5): Inimõigused Eestis 2024, TAI suitsiidistatistika ülevaated, SKA 2026 seksuaalvägivalla uuring, JDM elatise ja alaealiste uuemad analüüsid, Riigikontrolli üheksa sotsiaalvaldkonna auditit.
- CARe tõlgete terminite ülevaatus EPRÜ-ga.
- Tervisekassa töövihik vajab tekstituvastust.
