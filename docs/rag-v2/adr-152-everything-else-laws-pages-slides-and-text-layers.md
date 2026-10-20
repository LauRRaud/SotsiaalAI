# ADR-152: „Kõik muu“: puuduvad seadused, aruannete veebipeatükid, seminari slaidid ja tekstikihiga koopiad

Kuupäev: 20.10.2026. Teostus Claude Opus 5.5. Seis: **korpused v91 ja v92 on serveris alates 20.10.2026 kella 15.18 ja 15.24 UTC-st. v91: 67 dokumenti, ost 0,1234 USD. v92: kolm inimarengu aruande dokumenti, ost 0,0514 USD. Indeks 48dbc850: 11 023 dokumenti, 107 727 lõiku.**

## Miks

Pärast v90 ettevalmistust ([ADR-151](adr-151-newer-editions-and-audits.md)) küsis omanik, kas RAG-i läheb veel materjale. Ülejäänud kandidaatide loendi kohta ütles omanik:

- „inglisekeelseid materjale me ei lisa. Kõik muu pane“;
- tervishoiu omaosaluse uuringu joonise kohta: „selliseid jooniseid kindlasti ei ole mul andmebaasi vaja“.

Seega läksid sisse kõik eestikeelsed kandidaadid. Ingliskeelseid ei lisatud, jooniseid ei kirjeldatud ja vanemaid väljaandeid ei eemaldatud.

## Mis sisse läks

| Rühm | Dokumente | Lõike | Tokeneid |
|---|---:|---:|---:|
| Seadused, mida RAG-is ei olnud: alkoholiseadus (kehtiv ja 01.11.2026 jõustuv redaktsioon), rahvatervishoiu seadus, narkootiliste ja psühhotroopsete ainete ning nende lähteainete seadus | 4 | 210 | 80 035 |
| Aruannete veebiväljaannete peatükid: Centari alushariduse ja lapsehoiu uuring (10), Eesti inimarengu aruanne 2019/2020 (11), Inimõigused Eestis 2026 (10); Sotsiaalministeeriumi leht väheintensiivsete psühholoogiliste sekkumiste pakkujatest (1) | 32 | 497 | 275 769 |
| Dokumendid: Justiitsministeeriumi 2021. a seminari „Õigusrikkujatele teenused justiitsasutuste kaudu“ 12 ettekannet, vaimse tervise tegevuskava 2023–2026, infoleht vaimse tervise probleemidega patsiendist esmatasandil, „Inimõigused Eestis 2026“ kaks infovoldikut, ESTA pressiteade 04.09.2026 ja uudiskirja seitse dokumenti, mis ootasid tekstituvastust | 24 | 670 | 277 534 |
| Uudiskirja 20.10 korje dokumendid, mille leidis teine otsing | 7 | 595 | 333 192 |
| **kokku** | **67** | **1972** | **966 530** |

Kohalik arvestus oli 966 530 tokenit ehk 0,1256 USD (0,13 USD miljoni sisendtokeni kohta), ja lae 0,15 USD seadis koostaja. Omanik ütles käivitamise kohta: „käivita ise, olen autos“. Ost tehti 1916 sisendiga, 949 216 tokenit, 0,1234 USD; plaan kasutas osa lõike uuesti.

## v92: inimarengu aruanded

Kui ütlesin, et 2019/2020 aruande kaks peatükki jäid välja, küsis omanik: „inimarengu aruanne?“ ja „uuemat ei ole?“. Uusim, Eesti inimarengu aruanne 2026, on RAG-is alates v89. Kontroll leidis aga, et 2023. aasta aruanne „Vaimne tervis ja heaolu“ (SA Eesti Koostöö Kogu, toim Merike Sisask) RAG-ist puudus. Selle teema on sotsiaaltöö jaoks kõige lähedasem.

| Dokument | Lk | Lõike | Mis tehti |
|---|---:|---:|---|
| Eesti inimarengu aruanne 2023. Vaimne tervis ja heaolu | 195 | 659 | Väljaandja trükiversioon on 50 MB (piir 32 MB), seega läks RAG-i piltideta koopia (4,5 MB; `tmp/rag-v2-v89/tools/stripimages.py`). Iga lehekülje tekst on sama. |
| 2019/2020: 1.2 Keskuse ja ääremaa lõhe Eestis | 12 | 25 | Veebileht on 35 MB, peaaegu kõik kaartide ja jooniste skriptid. Võeti väljaandja trükiversioon `print/EIA-2019-1.2.pdf`. |
| 2019/2020: 1.5 Ligipääsetavuse muutused autostunud Eestis | 12 | 19 | Veebileht on 11 MB. Võeti trükiversioon `print/EIA-2019-1.5.pdf`. |

Kohalik arvestus oli 395 782 tokenit (0,0515 USD), lagi 0,07 USD. Ost tehti 701 sisendiga, 395 702 tokenit, 0,0514 USD.

## Tekstikiht pildina olnud lehekülgedele

Windowsis ei ole eesti keele tekstituvastust ja midagi ei paigaldatud. Seepärast loeti tekstita lehekülgede pildid käsitsi läbi ja tekst kirjutati üles (`tmp/rag-v2-v91/ocr/<võti>/text*.json`, `ocr3/`). Seejärel kirjutati see väljaandja faili koopiale nähtamatu tekstikihina (`tools/ocr-layer.py`, renderdusrežiim 3, nagu tuvastatud skaneeringul):

- Nähtav lehekülg jääb samaks. Iga koopia kontrollitakse: tekstikihiga lehekülg loeb tagasi täpselt nii, nagu kirjutati, ja iga muu lehekülg loeb nagu enne.
- Kiht on Segoe UI kirjas. PyMuPDF-i ToUnicode-tabelis on üks glüüf mitme märgi jaoks (sidekriips U+2010, sulg U+FD3E, tühik U+00A0), seega kirjutati tabel uuesti: iga glüüf vastab märgile, mille jaoks üleskirjutus seda kasutab.
- Jooniseid ja fotosid ei kirjeldata. Nurksulgudes on ainult lühikesed märked, näiteks täitmiseks mõeldud tabel või viidete loend. „Digiareng ja noorsootöö“ kujunduslikel vahelehtedel on märge, et teksti ei ole.
- Koopia metaandmetes (`collection.copy`) on lehekülgede loetelu ja väljaandja faili räsi.

Koopiad (11): uudiskirja dokumendid „Digiareng ja noorsootöö“, „Dementsus: riskitegurid ja ennetamine“, „Enesevigastamisest loobumise töövihik noorele ja lähedasele“, „Lootuselaegas“ noore ja spetsialisti juhis, „Uuringud suhtumisest psüühilise erivajadusega inimestesse 2021 ja 2022“ ning Tervisekassa töövihik „Minu vaimse tervise esmaabi“ (v89-s kinni peetud); lisaks „Inimõigused Eestis 2026“ lihtsa keele voldik (kõverateks teisendatud tekst) ning seminari slaidid „Taastava õiguse kasutamise võimalused õigussüsteemis“ (lk 13 ja 24) ja „Kuriteoohvrite kaitse võimalused Eestis“ (lk 15, 16 ja 23). Slaididel olid need leheküljed veebilehtede kuvatõmmised või siltidega joonistus. Kaart ja fotoslaid jäid tekstita, sest nende osakaal jäi vastuvõtu piiri alla.

**Välja jäi** 2018. a uuring sissetulekute ja omaosaluse seosest tervishoiuteenuste kättesaadavusega. Kõik selle tekstita leheküljed on joonised. Register: `held_partial_text`.

## Teine otsing (uudiskirja 20.10 korje, „PDF jäi kättesaamatuks“)

Kõigist 18 dokumendist:

- **Leiti 6:** „Pilk hallile alale II“ (TLÜ Eesti demograafia keskus), MTÜ Peaasjad kaks juhendit lapsevanematele („Kuidas saan oma lapsi aidata?“, „Kuidas saan oma laste eest hoolt kanda?“), skautluse mõju-uuring (TÜ), Kodukandi „Vabatahtliku seltsilise käsiraamat“ ja KOV-ide kompetentsipõhise koolitusvajaduse analüüs 2021. Viimase väljaandja domeen ei vasta enam, nii et fail on Internet Archive'i koopia ministeeriumi aadressist ja seda ütleb ka metaandmete märkus.
- **Asendusega 1:** Kodukandi lõpparuande asemel on sama projekti tulemuste ettekanne 15.09.2020.
- **RAG-is juba 1:** Lipusüsteemi juhend.
- **Vaba kasutusega ei ole 4:** „Ise oled vana!“ ja „Kirjad lapsevanemale“ (DIGARis autorikaitsega) ning kaks Juridica artiklit.
- **Ei leitud 6:** dementsusega inimeste KOV-teenused, RFK testimise raport, „Võlgnike õigustest täitemenetluses“, „Lapsed Eesti ühiskonnas“ ja „Kodutud Tallinnas 2020“. Laste puude raskusastme 2021. a juhend on asendunud ja uuem juhend ver 1.1 on SKA lehelt kadunud.

Täpsemalt: `tmp/rag-v2-v91/refind.json`. Väljaandjatele ei kirjutatud.

## Mis jäi tegemata

- EPRÜ lehti ei saanud korjata: sait vastab ainult http-aadressil ja korjaja seda ei luba.
- Kaks inimarengu aruande 2019/2020 lehte olid korjaja piirist suuremad. Need tulid v92-s väljaandja trükiversioonina.
- Kriminaalpoliitika seminari leht ise on teade, seega võeti ainult ettekanded.

## Kohalik kontroll enne ostu

Kõik 67 läbisid vastuvõtu, v92 kolm samuti. Ülevaatus tehti käsitsi märkustega (`tools/review-docs.py`, `review-docs2.py`, `review-docs3.py`): koopia, pressiteate ja Internet Archive'i faili kohta ütleb märkus, mis see on. Faili sõnadest jõudis lõikudesse üle 85 % kõigil peale kolme (viidete loendit ei tükeldata):
- „Dementsus: riskitegurid ja ennetamine“ 84 %;
- 2019/2020 aruande peatükk 1.5 82 %;
- peatükk 1.2 88 % sõnadest ja 92 % lehekülgedest.

## Kontroll serveris

Pärast v92 töötab plaan `m4-corpus-chat-20261020d.json`, indeks `48dbc850`. Korpuse jooksu ajal tegi teine sessioon kaks deploy'd (212c8e34 pärast v90-t ja 8f0dc519 v92 ajal). Kumbki uuendas kinnitatud plaani tolle hetke indeksile, ja v92 plaan kirjutati pärast viimast deploy'd.

**Otsinguvärav (tasuta, 33 küsimust, üks kord v90 + v91 + v92 kohta, kaks jooksu):**

- Vigu ja kadunud otsustavaid lõike ei olnud. Väljundkood 10 („erinevused, mida lugeda“), nagu v89 järel.
- **Paremaid oli 4:** leibkonna mõiste 7. kohalt 5., Sillamäe järelhooldus 2. kohalt 1., lisaks kaks ühe koha võrra.
- **Halvemaid oli 4.** Kaks olid samad mis v89 järel: Harku tugiisik sugulasena (8. kohalt 14.) ja Narva asendushoolduse isiklikud kulud (8. kohalt 17.).
- **Kaks halvenemist on uued:**
  - vanglas viibija toimetulekutoetus: 3. kohalt (v89 järel) 18. kohale, v77 alusjoones 5. kohal;
  - eestkostja ja eestkostetava pere: 2. kohalt 7. kohale.

  Kummagi põhjus on üks v90 dokument ja otsustav lõik jõuab endiselt mudelini. Vaata jaotist „Kahe uue halvenemise põhjus“.
- Mediaanaeg oli esimesel jooksul 9,0 s ja teisel 6,0 s (v89 järel 5,9 s). Esimene jooks oli aeglane soojenemise pärast.

**Tasuline kontroll:** 10 pööret laega 0,06 USD, **0,0348 USD**. Kõik lõppesid ja valideerusid, 9 vastust 10-st viitas v91 või v92 uuele dokumendile:
- prokuratuuri teenustele suunamine: Põhja piirkonna ülevaade;
- lootuselaegas: mõlemad juhised (tekstikihiga koopiad);
- dementsuse riskitegurid: tekstikihiga koopia;
- SHARE ja mitteformaalne hooldus: „Pilk hallile alale II“;
- toetav telefonivestlus: „Vabatahtliku seltsilise käsiraamat“;
- vaimse tervise tegevuskava 2023–2026;
- täiskasvanute vaimne tervis: inimarengu aruanne 2023;
- ääremaa ja autostumine: 2019/2020 peatükk 1.5;
- kliendi küsimus alkoholist ja lastest: „Kuidas saan oma laste eest hoolt kanda?“.

Taastava õiguse küsimus viitas olemasolevale lehele „Taastav õigus“, mitte seminari slaididele. Neli vastust olid osalised („partial“).

## Kahe uue halvenemise põhjus (20.10.2026 õhtul, tasuta)

Mõõdetud serveris töötaval väljalaskel (12cdf6cc, indeks 48dbc850, 20.10). Mudelit ja embedding'ut ei kutsutud. Otsing on sama mis väraval: salvestatud vektorid ja valikumudeli asemel konks. Lisaks trükiti kandidaatide pealkirjad ja korrati otsingut nii, et osa dokumente oli plaanist välja jäetud. Kõigepealt jäeti välja rühmad v90, v91 ja v92, seejärel iga v90 dokument eraldi. Väljajäetud dokument on otsingule sama, mis lisamata dokument. Otsingukoodi v89 ja v92 jooksu vahel ei muudetud (8b084e2e..8f0dc519 on ainult Tööheaolu).

| Küsimus | Praegu | v90 22 dokumendita | Ainult ühe dokumendita |
|---|---:|---:|---|
| vanglas viibija toimetulekutoetus (SHS § 132 lg 7) | 18. | 3. | 3.: Riigikontroll, „Pikaajaline vaade vanglasüsteemile“ |
| eestkostja ja eestkostetava pere (SHS § 131 lg 12) | 7. | 2. | 2.: JDM, „Alaealisele lapsele elatise arvutamise korra muutmine. Rakendamispraktika analüüs“ |

v91 ja v92 väljajätmine ei muutnud kumbagi kohta. Kriminaalhoolduse märgukiri ja elatisraha auditid ei mõjutanud kumbagi küsimust.

**Mehhanism.** Mõlemas küsimuses oli otsustav lõik ühes vektorikanalis 40 kandidaadi piiri peal. Vanglaküsimuses oli see küsimuse enda vektoriga 40. kohal, eestkoste küsimuses esimese otsingupäringu vektoriga 36. kohal. Uus dokument sobib küsimuse teemaga ja tõrjus lõigu sellest kanalist välja. Liitjärjestuses (RRF, k = 60, vektorikanali kaal 2) annab vektorikanali 40. koht 2/100 = 0,020 punkti, 41. koht aga 0 punkti. See on rohkem, kui annab sõnaotsingu 1. koht (1/61 = 0,016). Kandidaatide 5.–20. koha skoorid on 0,05–0,07, seega lükkab ühe kanali kadu lõigu 5–15 kohta tahapoole:

- vangla: skoor oli 0,069 ja on nüüd 0,049. Teistes kanalites on lõik endiselt samal kohal (vektor 21. ja 22.). Sõnaotsingus ei olnud lõiku ka v89 järel 40 parima seas.
- eestkoste: skoor oli 0,097 ja on nüüd 0,076. Otsustav esimene lõik on toimetulekutoetuse juhend, mitte seadus: sõnaotsingus on see 1. kohal, vektorikanalites 6. ja 8. kohal. SHS § 131 lg 12 lõik on seaduste reservis endiselt 31. kohal.

Vanglaauditi ükski lõik ei ole 36 kandidaadi seas. See võtab ainult küsimuse vektorikanali kohti. Elatisanalüüsi üks lõik on 29. kohal. Otsustava lõigu ees on mõlemas küsimuses ainult varasemad dokumendid: toimetulekutoetuse lehed, SHS, palga- ja töövõimetoetuse lehed.

**Kas otsustav lõik jõuab mudelini?** Jah, mõlemas küsimuses:

- See on 36 kandidaadi seas, mille valikumudel loeb tervikuna läbi (30 liitjärjestusest ja 6 seaduste reservist). Valikumudel järjestab kandidaate sisu järgi, mitte koha järgi. 10.10 tasulises kontrollis (korpus v74, 72 pööret samadel 30 küsimusel) oli otsustav säte tõendite hulgas 71 pöördel. Värava 10.10 alusjoone (v75) järgi oli see neist küsimustest neljas 16.–32. kohal. Päris pöörde päringud koostab plaan, seega ei ole kohad päris pöördes täpselt samad. Ainus eksimus oli küsimus, kus säte kandidaatide seast üldse puudus.
- Ka siis, kui valik ebaõnnestub (jääb liitjärjestus), on otsustav lõik kontekstis. Vanglaküsimuses toob selle SHS-i semantiline sõltuvus. Eestkoste küsimuses on juhendilõik 7. seemne kohal (seemneid on 9) ja seaduse lõike toob semantiline sõltuvus. Kontekstis on vastavalt 11 936 ja 11 221 tokenit.

**Otsus: midagi ei muudeta.** Mõlemad dokumendid on küsimuse teemaga seotud ja käituvad nii, nagu lisatud dokument käituma peab. Mõlemas küsimuses jõuab otsustav lõik mudelini. Seadusesätte eelistus ei aitaks eestkoste küsimust, sest selle otsustav esimene lõik on juhend, mitte seadus. Sätete eelistuseks on juba seaduste reserv (ADR-032), kuid see toob ainult kandidaatide hulgast väljas olevaid lõike, ja vanglaküsimuse lõik on niigi sees. Järsu ääre pehmendamine (näiteks 60 kandidaati kanali kohta) nihutaks ainult piiri ja muudaks järjestust igas küsimuses. See vajab oma väravakontrolli ja tasulist kontrolli, ning praegu ei ole kahju, mida see parandaks.

**Väravale (ettepanek, tegemata):** praegu on iga kohanihe „deciding_worse“. Väravarida võiks lisaks öelda, kas otsustav lõik on liitjärjestuse kontekstis (`deciding_in_fallback`). Siis eristuks nihe, mis jätab lõigu mudeli lugemisse, nihkest, mis viib selle välja. Teiseks tasub pärast v92 salvestada uus alusjoon (tasuta). Siis võrdleb järgmine korpusekontroll v92-ga, mitte v77-ga, ja vanad nihked (Harku, Narva) ei ilmu igas aruandes uuesti.

Uuesti: `sh /home/ubuntu/rag-v2-work/diag-v92/start.sh` (pealkirjad ja rühmade väljajätmine) ning `start-single.sh` (iga v90 dokument eraldi). Skript on `diag-v92/ov/scripts/rag-v2-gate-diag.mjs` ja väljund `diag-v92/diag.out` ning `single.out`. Väljundis on avalike dokumentide pealkirjad, kohad ja järgud, isikuandmeid ei ole.

## Lahtine

- Kahe uue halvenemise põhjus on leitud (vt eelmist jaotist). Harku ja Narva halvenemise põhjust (juba v89 järel) ei ole samal viisil uuritud.
- Seaduste lühendite tabelisse tulid alkoholiseadus („AS“), rahvatervishoiu seadus („RTHS“) ja narkootiliste ja psühhotroopsete ainete seadus („NPALS“) (`lib/rag-v2/search/act-abbreviations.json`). Tabel on serveris alates väljalaskest 12cdf6cc (20.10.2026 kell 15.53 UTC), mis uuendas kinnitatud plaani indeksile 48dbc850. „AS“ on ka aktsiaseltsi lühend, kuid tabel loeb lühendit ainult paragrahviviite ees ja seadusekaardi märkena.
