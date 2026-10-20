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

  Tõenäoliselt on konkurentideks uued Riigikontrolli auditid vanglasüsteemist ja kriminaalhooldusest ning eestkostel olevate laste elatisrahast. Värav pealkirju ei näita, seega pole see kontrollitud.
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

## Lahtine

- Kahe uue halvenemise põhjus (vanglas viibija toimetulek, eestkostja pere) on kontrollimata.
- Seaduste lühendite tabelisse tulid alkoholiseadus („AS“), rahvatervishoiu seadus („RTHS“) ja narkootiliste ja psühhotroopsete ainete seadus („NPALS“) (`lib/rag-v2/search/act-abbreviations.json`). Tabel jõuab serverisse järgmise väljalaskega. „AS“ on ka aktsiaseltsi lühend, kuid tabel loeb lühendit ainult paragrahviviite ees ja seadusekaardi märkena.
