# RAG-i katvuskaart: eluolukorrad ja tööteemad × abi liik (08.10.2026)

Seis: loetud 08.10.2026 serveris töötavast RAG-ist (korpus v69, indeks `8b1e1008`, 8337 dokumenti, 68 408 lõiku). Ainult lugemine: mudelit ega embedding'ut ei kutsutud, RAG-i ei lisatud ega muudetud midagi. Dokumendis on ainult arvud; ühegi inimese nime, telefoni ega e-posti siin ei ole.

## Miks

Pärast kahte 30 pöördega testvestlust (ADR-105) loetlesin puuduvad materjalid nende kahe juhtumi põhjal. Omanik: „sa ei saa lähtuda „mida ragi lisada“ ainult ühe-kahe vestluse põhjal, sa pead seda veidi rohkem üldistama ka“. See kaart vaatab kogu välja: 34 abivajaja eluolukorda ja 15 sotsiaaltöö spetsialisti tööteemat, igaüks kuue abi liigi lõikes. Materjali lisamine on omaniku järgmine otsus; siin ei ole lisatud midagi.

## Lühidalt

1. **Tugev:** omavalitsuste teenused ja toetused (enamikus ridades on oma kirje või kord üle 40 omavalitsusel), puue, abivahendid, dementsus, hooldus ja hooldekodu, lastekaitse ning spetsialisti tööjuhendid (hindamine, juhtumikorraldus, kvaliteet ja järelevalve).
2. **Nõrk on riigi tasandi abi.** Ridade aluseks olevast 34 seadusest on RAG-is 7 (sotsiaalhoolekande seadus, sotsiaalseadustiku üldosa seadus, puuetega inimeste sotsiaaltoetuste seadus, lastekaitseseadus, perekonnaseadus, haldusmenetluse seadus, abivahendite määrus); 27 ei ole. Ametite veebilehti on 30 ja neist enamik räägib ligipääsetavusest ja puude mõistest. Töötukassa, Tervisekassa, notarite, kohtutäiturite, politsei, Rajaleidja ja vanglateenistuse oma veebilehti ei ole ühtegi (Tervisekassalt on 4 juhendit, kliinilised ja arengukava; Töötukassa osalusel 5 materjali töövõime teemal).
3. **Sellepärast on kõige suuremad lüngad kõige tavalisemates olukordades:** töö kaotus, pension, lapse sünd ja peretoetused, elatis, ravikindlustus ja arstiabi kulud, lähedase surm, volikiri ja esindamine. Neis on RAG-is omavalitsuse kirje (sünnitoetus, matusetoetus), uuringud ja artiklid, aga mitte riigi hüvitise selgitust, teekonda ega summat.
4. **Uuringud ja artiklid on pool tekstist:** loetud 64 831 lõigust on 31 882 (49%) uuringud ja ajakirja artiklid; ametlikud juhislehed on 234 lõiku (0,4%). Kui inimene kirjutab oma sõnadega, annab sõnaotsing esimesed kümme kohta 79% juhtudest uuringutele ja artiklitele.
5. **Olemas, aga ei leita:** 34 reast, kus juhis on olemas, ei too inimese enda sõnadega kirjutatud esimene lause seda sõnaotsingus 40 esimese hulka 17 real. Salvestatud testpööretes jõudis olemasolev juhis vastuse tõenditesse umbes pooltel kordadel (132 korda 273-st).

## Mida loeti

| Mis | Dokumente | Lõike |
|---|---:|---:|
| Ametlikud juhislehed (ametite veebilehed) | 30 | 234 |
| Juhendid ja infomaterjalid | 225 | 11 185 |
| Organisatsioonide ja abivahendimüüjate lehed | 572 | 2 431 |
| Hooldekodude hinnad ja abivahendipunktid omavalitsuste kaupa | 172 | 1 384 |
| Omavalitsuste teenuste ja toetuste kirjed | 3 195 | 3 200 |
| Omavalitsuste õigusaktid | 511 | 9 232 |
| Riigi õigusaktid (10 akti, koos redaktsioonidega 26 dokumenti) | 26 | 5 283 |
| Uuringud ja analüüsid | 204 | 23 658 |
| Ajakirja Sotsiaaltöö artiklid | 892 | 8 224 |
| **Loetud kokku** | **5 827** | **64 831** |

Lugemata jäid kontaktid (1638 dokumenti: pealkiri on inimese nimi) ja taotlusvormid (872: vastuses antakse lingina).

## Kuidas loeti

- **Read ja veerud** on failis `scripts/lib/rag-v2-coverage-grid.json`. Igal real on eestikeelsed võtmesõnad, mis nimetavad olukorda ennast (mitte asutust ega üldsõna), ja üks lause, millega inimene võiks vestlust alustada. Veerud: selgitus (mis see on), teekond (kelle poole ja mis järjekorras), raha (summad, kes maksab), kohalik kord, mida teha ootamise ajal, õigused ja vaidlustamine.
- **Loetakse sisu, mitte pealkirju:** iga lõigu tekst (pealkiri, jaotise pealkirjad ja sisu) vaadatakse läbi. Lõik läheb lahtrisse, kui selles on rea võtmesõna ja kuni 300 tähemärgi kaugusel veeru tunnussõna (nt „pöördu“, „taotlus“; summa eurodes; „järjekord“; „vaie“).
- **Dokument loetakse rea kohta käivaks**, kui seda ütlevad tema enda pealkirjad (rea sõna on pealkirjas või jaotise pealkirjas vähemalt kolmandikul lõikudest või kolmel lõigul) või kui pikema dokumendi lõikudest pooled räägivad sellest. Üks mainimine üldises käsiraamatus ei loe. Õigusakt loeb ühe lõigu kaupa.
- **Praktiline juhis** on abivajaja ridades (A) ametlik juhisleht, juhend või infomaterjal ja organisatsiooni leht; spetsialisti ridades (B) ametlik juhisleht ja juhend. Uuring ja artikkel ei ole juhis.

**Märgid.** ● piisav: vähemalt 3 juhisdokumenti (arv on nende arv) või oma kirje/kord vähemalt 40 omavalitsusel („KOV“ ja omavalitsuste arv). ◐ õhuke: 1–2 juhisdokumenti või alla 40 omavalitsuse. § ainult õigusakti tekst (lõikudega dokumentide arv). ○ ainult uuringud või artiklid (nende arv). Veerg „Kohalik kord“ näitab, mitmel omavalitsusel 79-st on rea kohta oma kirje või akt. Päris tühja lahtrit ei ole: igas on vähemalt uuring, artikkel või seadusepunkt.

**Lisaveerud.** „Seadus“: mitu rea aluseks olevat riigi seadust on RAG-is (nimekiri on minu koostatud, vt lõpus). „Vastutaja juhis“: mitu rea kohta käivat juhist on selle asutuse omad, kes abi annab. „Sõnaotsing“: mitmendal kohal on esimene rea kohta käiv juhis, kui otsida ainult sõnade järgi rea alguslausega („ei leia“ = ei ole 40 esimese seas). „Testpöörded“: mitmes salvestatud testpöördes sellel teemal jõudis juhis vastuse tõenditesse / mitmes pöördes oli juhis sel hetkel RAG-is olemas.

## Tabel A: abivajaja eluolukorrad

| Olukord | Selgitus | Teekond | Raha | Kohalik kord | Ootamise ajal | Õigused | Seadus | Vastutaja juhis | Sõnaotsing | Testpöörded |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 Lapse arengumure (kõne, käitumine, autismi kahtlus) | ● 31 | ● 10 | ● 6 | ◐ KOV 23 | ● 5 | ◐ 1 |  | 0 | ei leia | 17/19 |
| A2 Puudega laps peres | ● 9 | ● 4 | ● 7 | ● KOV 79 | ◐ 2 | ◐ 2 | 2/2 | 2 | 14. koht | 10/13 |
| A3 Lapse haridustee erivajadusega (tugi lasteaias ja koolis) | ● 9 | ● 9 | ● 5 | ◐ KOV 33 | ● 8 | ● 4 | 0/1 | 7 | 9. koht | 2/2 |
| A4 Lapse sünd ja väikelapsega pere (hüvitised, lapsehoid) | ◐ 2 | ● KOV 79 | ● KOV 77 | ● KOV 79 | § 23 | § 64 | 0/1 | 0 | ei leia | 0/4 |
| A5 Lahkuminek, elatis ja üksikvanem | ◐ 1 | ● KOV 52 | ● KOV 43 | ● KOV 70 | § 5 | ◐ 1 | 1/3 | 1 | ei leia | 0/1 |
| A6 Laps on hädas: hooletus, väärkohtlemine | ● 7 | ● 6 | ● 3 | ● KOV 63 | ● 3 | ● 5 | 1/1 | 5 | ei leia | 8/12 |
| A7 Laps ei saa kasvada oma vanemate juures (asendushooldus, lapsendamine) | ● 7 | ● 6 | ● 5 | ● KOV 79 | ● 3 | ● 6 | 2/2 | 7 | ei leia | 4/7 |
| A8 Noore käitumis- ja sõltuvusmure, õigusrikkumine | ● 3 | ◐ 1 | ◐ 1 | ◐ KOV 25 | ◐ 1 | ◐ 1 | 1/1 | 2 | ei leia | mõõtmata |
| A9 Lähisuhtevägivald | ● 10 | ● 7 | ● 4 | ◐ KOV 21 | ● 5 | ● 3 | 0/1 | 8 | ei leia | 0/2 |
| A10 Kuriteo või seksuaalvägivalla ohver | ● 13 | ● 12 | ● 9 | ● KOV 63 | ● 5 | ● 7 | 0/1 | 7 | ei leia | 1/2 |
| A11 Töö kaotus | ◐ 1 | ◐ 1 | ◐ KOV 11 | ● KOV 40 | ◐ 1 | § 23 | 0/3 | 0 | ei leia | mõõtmata |
| A12 Sissetulek ei kata elamist (toimetulekutoetus, toiduabi) | ◐ 1 | ● KOV 79 | ● KOV 79 | ● KOV 79 | ◐ 1 | § 96 | 1/1 | 1 | 17. koht | 0/3 |
| A13 Võlad ja täitemenetlus | ● 5 | ● 5 | ● 3 | ● KOV 79 | ◐ 1 | ● 3 | 0/2 | 0 | 1. koht | 1/4 |
| A14 Eluaseme kaotus või puudumine | ● 6 | ● 6 | ● 5 | ● KOV 79 | ◐ 1 | ● 4 | 1/1 | 5 | ei leia | 0/1 |
| A15 Ravikindlustus ja arstiabi kulud | § 24 | ● KOV 43 | ● KOV 49 | ● KOV 59 | § 3 | § 4 | 0/1 | 0 | ei leia | mõõtmata |
| A16 Töövõime vähenemine | ● 10 | ● 10 | ● 5 | ● KOV 60 | ● 5 | ● 6 | 0/1 | 4 | ei leia | mõõtmata |
| A17 Täiskasvanu puue (raskusaste, toetused, isiklik abistaja, rehabilitatsioon) | ● 85 | ● 36 | ● 27 | ● KOV 79 | ● 15 | ● 14 | 2/2 | 16 | 18. koht | 16/28 |
| A18 Abivahendid, kodu kohandamine ja liikumine | ● 60 | ● 38 | ● 30 | ● KOV 79 | ● 9 | ● 7 | 2/2 | 6 | 10. koht | 17/21 |
| A19 Raske haigus ja haiglast koju (insult, vähk; õendusabi, taastusravi) | ● 40 | ● 14 | ● 4 | ◐ KOV 21 | ● 3 | ● 3 | 0/2 | 2 | ei leia | 3/9 |
| A20 Lähedase hooldamine kodus (hoolduskoormus, hooldajatoetus, koduteenus) | ● 11 | ● 7 | ● 5 | ● KOV 79 | ● 4 | ● 5 | 1/1 | 8 | ei leia | 5/29 |
| A21 Dementsus | ● 49 | ● 26 | ● 7 | ◐ KOV 23 | ● 11 | ● 4 |  | 2 | 7. koht | 6/7 |
| A22 Eakas üksi kodus | ● 9 | ● 3 | ● 7 | ● KOV 76 | § 17 | § 27 | 1/1 | 0 | ei leia | 0/7 |
| A23 Hooldekodu (koht, hind, kes maksab) | ● 11 | ● 9 | ● 5 | ● KOV 79 | ● 7 | ● 3 | 2/2 | 4 | ei leia | 9/20 |
| A24 Lähedane ei saa enam oma asjadega hakkama (volikiri, esindamine) | ◐ 1 | ◐ 1 | ◐ 1 | ◐ KOV 33 | ○ 3 | § 17 | 1/3 | 0 | ei leia | 3/5 |
| A25 Eaka või abitu inimese väärkohtlemine ja rahaline ärakasutamine | ○ 1 | ○ 1 | ○ 1 | ◐ KOV 1 | ○ 1 | ○ 1 | 0/2 | 0 | ei leia | mõõtmata |
| A26 Psüühikahäirega täiskasvanu (erihoolekanne) | ● 34 | ● 12 | ● 14 | ● KOV 50 | ● 7 | ● 9 | 1/2 | 7 | 1. koht | 3/5 |
| A27 Vaimse tervise kriis ja enesetapumõtted | ● 6 | ● 5 | ● 4 | ● KOV 74 | ● 3 | ◐ 1 | 0/1 | 2 | ei leia | 1/1 |
| A28 Sõltuvus (alkohol, narkootikumid, hasartmäng) | ● 6 | ● 6 | ● 3 | ● KOV 40 | ● 3 | ◐ 1 |  | 3 | 21. koht | mõõtmata |
| A29 Intellektipuudega täiskasvanu (töö, elamine, täisealiseks saamine) | ● 25 | ● 3 | ● 4 | ● KOV 40 | ◐ 1 | ● 4 | 1/1 | 2 | ei leia | mõõtmata |
| A30 Lähedase surm (matus, toetused, pärimine, lein) | ◐ 1 | ● KOV 79 | ● KOV 76 | ● KOV 79 | ◐ 1 | § 56 | 0/2 | 0 | ei leia | mõõtmata |
| A31 Elu lõpp (palliatiivne ravi, hospiits) | ◐ 1 | ◐ 1 | ○ 1 | ◐ KOV 1 | ○ 1 | ○ 1 |  | 0 | ei leia | mõõtmata |
| A32 Pension ja pensioniiga | ◐ 1 | ● KOV 42 | ● KOV 48 | ● KOV 65 | ◐ 1 | § 26 | 0/1 | 0 | ei leia | mõõtmata |
| A33 Vanglast vabanemine | § 16 | ◐ KOV 1 | ◐ KOV 4 | ◐ KOV 7 | § 2 | ○ 5 | 0/2 | 0 | ei leia | mõõtmata |
| A34 Pagulane, sõjapõgenik, uussisserändaja | ◐ 2 | ◐ 2 | ◐ 2 | ◐ KOV 32 | § 12 | ◐ 2 | 0/2 | 1 | ei leia | mõõtmata |

## Tabel B: sotsiaaltöö spetsialisti tööteemad

| Olukord | Selgitus | Teekond | Raha | Kohalik kord | Ootamise ajal | Õigused | Seadus | Vastutaja juhis | Sõnaotsing | Testpöörded |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 Abivajaduse hindamine | ● 15 | ● 14 | ● 8 | ● KOV 76 | ◐ 2 | ● 3 | 1/1 | 9 | 26. koht | 5/10 |
| B2 Kodukülastus ja abist keeldumine | ◐ 1 | ● KOV 58 | ◐ KOV 16 | ● KOV 61 | ◐ 1 | § 48 | 2/2 | 0 | ei leia | 0/2 |
| B3 Juhtumikorraldus ja juhtumiplaan | ● 6 | ● 5 | ● 3 | ● KOV 77 | ● 4 | ● 6 | 1/1 | 4 | 5. koht | 1/2 |
| B4 Eestkoste ja teovõime | ● 3 | ● 3 | ● KOV 58 | ● KOV 79 | ◐ 1 | ● 3 | 1/3 | 2 | ei leia | 3/15 |
| B5 Lastekaitse sammud | ● 7 | ● 5 | ◐ 1 | ● KOV 55 | ● 3 | ● 5 | 2/2 | 5 | 3. koht | 8/17 |
| B6 Andmete jagamine ja STAR | ● 10 | ● 9 | ● 6 | ● KOV 67 | ● 3 | ● 6 | 1/3 | 8 | 32. koht | 6/9 |
| B7 Võrgustikutöö | ● 7 | ● 4 | ◐ 1 | ◐ KOV 4 | ◐ 2 | ● 3 |  | 3 | ei leia | 0/3 |
| B8 Haldusmenetlus: taotlus, otsus, tähtajad | ● 4 | ● 4 | ● 3 | ● KOV 78 | § 57 | ● 3 | 2/2 | 4 | 5. koht | mõõtmata |
| B9 Vaided ja kaebused | ● 6 | ● 6 | ● 4 | ● KOV 70 | ◐ 2 | ● 6 | 1/2 | 4 | ei leia | 0/5 |
| B10 Teenuste kvaliteet ja järelevalve | ● 25 | ● 13 | ● 16 | ● KOV 78 | ◐ 1 | ● 22 | 1/1 | 23 | 2. koht | mõõtmata |
| B11 Teenuse korraldamine ja rahastamine | ● 5 | ● 5 | ● 3 | ● KOV 77 | ◐ 2 | ● 3 | 2/3 | 5 | 35. koht | 3/3 |
| B12 Tahtest olenematu abi ja paigutamine | ◐ 2 | ◐ 2 | § 5 | ◐ KOV 1 | ○ 1 | ◐ 1 | 1/3 | 1 | ei leia | mõõtmata |
| B13 Dokumenteerimine | ◐ 2 | ◐ 2 | ◐ KOV 20 | ● KOV 71 | § 3 | ◐ 1 | 1/2 | 1 | ei leia | 0/1 |
| B14 Eetika, töönõustamine ja läbipõlemine | ● 5 | ◐ 2 | ◐ KOV 38 | ● KOV 42 | ● 3 | § 1 |  | 2 | 21. koht | 0/1 |
| B15 Kriisiabi ja hädaolukord (elanikkonnakaitse) | ● 15 | ● 10 | ● 5 | ● KOV 75 | ● 8 | ● 4 | 1/2 | 10 | 19. koht | 0/3 |

Lahtreid on 294: piisav 193, õhuke 69, ainult õigusakt 21, ainult uuringud või artiklid 11.

## Mida märk tähendab ja mida mitte

Märk on arvutatud reegli järgi; see ütleb, et selle teema kohta on dokumente, kus õige tunnussõna on teema lähedal. See ei ütle, et vastus on täielik. Pealkirju lugedes nägin valesid tabamusi, mis reeglist läbi lähevad: rea A23 (hooldekodu) kaheksast juhendist neli on tuleohutuse õppematerjalid (räägivad hooldekodust, mitte koha saamisest); rea A19 (raske haigus) kolmest juhendist kaks on pika COVID-i juhendid; rea A30 (lähedase surm) ainus juhend on kliimaärevuse käsiraamat. Seepärast on ● ülempiir, mitte kinnitus. Usaldusväärsem on vastupidine: kus märk on ◐, § või ○, seal juhist tõesti ei ole.

Reegel sai rangemaks kahel korral. Esimene kuju (teema viiendikus lõikudest, tunnussõna samas lõigus) andis 262 „piisavat“ lahtrit 294-st; pealkirjad näitasid, et loeti juhuslikke mainimisi. Teine kuju lisas läheduse ja kitsamad võtmesõnad (238), kolmas pealkirjade nõude (193).

## Olemas, aga ei leita

**Sõnaotsing inimese enda sõnadega** (tasuta; ainult sõnade kanal, ilma vektorotsingu ja otsinguplaanita, mida päris vestlus samuti kasutab; omavalitsuste oma dokumendid välja jäetud). Iga rea alguslausega otsiti 40 esimest lõiku.

- 34 real on rea kohta vähemalt 3 juhist. Neist tuli juhis 10 esimese hulka 9 real, kohtadele 11–40 8 real ja ei tulnud üldse 17 real: A1, A6, A7, A8, A9, A10, A14, A16, A19, A20, A22, A23, A27, A29, B4, B7, B9.
- 49 otsingu 490 esimesest kohast said ajakirja artiklid 206, uuringud 179, juhendid 91, seadused 10, organisatsioonide lehed 3 ja ametlikud lehed 1.
- Põhjus on sõnavara: inimene kirjutab „ei räägi“, „lööb mind“, „kirjutatakse haiglast välja“; juhis kirjutab „kõne areng“, „lähisuhtevägivald“, „õendusabi“. 49 alguslausest 27 ei sisalda ühtegi oma rea võtmesõna.

**Salvestatud testpöörded** (233 pööret, mis olid salvestatud 08.10 kell 18.00, kui rakenduses oli üks konto; hilisemaid ei loetud; loetud 231 lõpetatud pööret, neist 96 praegusel korpusel). Pööre loeti rea alla, kui küsimuses või otsinguplaani päringutes oli rea võtmesõna; üks pööre võib kuuluda mitme rea alla (309 paari). Väljastati ainult arvud.

- 36 paaris ei olnud rea kohta sel hetkel RAG-is ühtegi juhist. Ülejäänud 273 paarist oli juhis valiku kandidaatide seas 202 korral (74%), valik jättis selle alles 133 korral (49%), vastus viitas sellele 105 korral (38%).
- Hästi jõuab kohale: A1 autism ja kõne (17/19), A21 dementsus (6/7), A18 abivahendid (17/21), A2 puudega laps (10/13).
- Halvasti: A20 lähedase hooldamine kodus (5/29; kandidaatide seas 17), A22 eakas üksi kodus (0/7), B4 eestkoste (3/15, viidatud 0), B9 vaided (0/5), A19 raske haigus ja haiglast koju (3/9), B1 abivajaduse hindamine (5/10).
- Ettevaatust lugemisel: omavalitsuse teenuse küsimusele vastatakse õigesti omavalitsuse kirjest ja seadusest, nii et väike arv ei ole iseenesest viga. Vastuse headust see ei mõõda.
- 15 rida on mõõtmata, sest nende kohta testpöördeid ei ole: A8, A11, A15, A16, A25, A28, A29, A30, A31, A32, A33, A34, B8, B10, B12. Need on suuresti samad read, kus juhist ei ole.

## Suurimad lüngad

Järjekord on olukorra sageduse järgi; sagedus on minu hinnang, mitte statistika, ja omanik tunneb seda välja paremini. „Mis täidaks“ nimetab väljaandja ja lehe liigi; ma ei ole neid lehti avanud ega kontrollinud, et need sellisel kujul olemas on.

| Nr | Olukord | Mis RAG-is on | Mis puudub | Mis allikas täidaks |
|---:|---|---|---|---|
| 1 | Töö kaotus (A11) | 1 organisatsiooni leht; 3 seadusest 0; omavalitsustel oma kirjet ei ole | selgitus, teekond, hüvitise summad ja õigused | Töötukassa juhislehed: töötuna arvele võtmine, töötuskindlustushüvitis, töötutoetus, koondamine; töötuskindlustuse seadus, tööturumeetmete seadus, töölepingu seaduse lõpetamise osa |
| 2 | Pension ja pensioniiga (A32) | 1 organisatsiooni leht; seadus puudub; omavalitsuste pensionäritoetused | kõik riigi pensioni kohta | Sotsiaalkindlustusameti pensionilehed (vanaduspension, paindlik pension, rahvapension, üksi elava pensionäri toetus); riikliku pensionikindlustuse seadus |
| 3 | Lapse sünd ja peretoetused (A4); lahkuminek ja elatis (A5) | sünnitoetuse kirje vähemalt 65 omavalitsusel, perelepituse kirje vähemalt 13; perekonnaseadus | vanemahüvitis, lapsetoetused, elatisabi, hooldusõiguse ja suhtluskorra teekond | Sotsiaalkindlustusameti peretoetuste, elatisabi ja perelepituse lehed; perehüvitiste seadus, riikliku perelepitusteenuse seadus |
| 4 | Ravikindlustus ja arstiabi kulud (A15) | omavalitsuste ravimi- ja hambaravitoetused; juhist 0, seadus puudub | kuidas saada ravikindlustus, mis saab kindlustamata inimesest, hambaravi- ja ravimihüvitis | Tervisekassa juhislehed; ravikindlustuse seadus |
| 5 | Raske haigus ja haiglast koju (A19); elu lõpp (A31) | 37 haiguste organisatsioonide lehte (insult, vähk); Tervisekassalt kaks pika COVID-i juhendit | õendusabi, koduõendus, taastusravi teekond ja omaosalus; palliatiivne ravi ja hospiits (1 leht) | Tervisekassa lehed õendusabi, koduõenduse, taastusravi ja palliatiivse ravi kohta; tervishoiuteenuste korraldamise seaduse vastav osa |
| 6 | Lapse arengumure ja tugi koolis (A1, A3) | 31 juhisdokumenti, neist 28 autismi ja kõneravi organisatsioonide lehed; HARNO juhendid õpetajale | ametlik teekond vanemale: perearst, logopeed, Rajaleidja; esimest lauset ei leita sõnade järgi | Rajaleidja (Haridus- ja Noorteamet) lehed vanemale; Tervisekassa lehed lapse arengu jälgimise ja kõneravi kohta; põhikooli- ja gümnaasiumiseaduse tugiteenuste osa |
| 7 | Lähedase surm (A30) | matusetoetus 76 omavalitsusel; leinatoe kirje mõnel | mida teha pärast surma, toitjakaotuspension, pärimine | riigiportaali juhis „lähedase surm“, Sotsiaalkindlustusameti toitjakaotuspensioni leht, Notarite Koja pärimise leht; pärimisseadus |
| 8 | Lähedane ei saa oma asjadega hakkama: volikiri, esindamine, eestkoste (A24, B4) | 1 organisatsiooni leht õiguslikest küsimustest; perekonnaseadus; eestkoste kirje vähemalt 12 omavalitsusel | volikiri ja tulevikuvolikiri, eestkoste seadmise käik kohtus, eestkostja aruandlus | Notarite Koja lehed volikirjast; kohtute juhis ja vormid eestkoste seadmiseks; tsiviilkohtumenetluse seadustiku eestkoste osa, tsiviilseadustiku üldosa seaduse esinduse osa |
| 9 | Võlad ja täitemenetlus (A13) | 5 juhendit spetsialistile, võlanõustamise kirje vähemalt 69 omavalitsusel; 2 seadusest 0 | arestimine, mittearestitav sissetulek, võlgadest vabanemine inimese vaates | Kohtutäiturite ja Pankrotihaldurite Koja juhislehed; täitemenetluse seadustiku vastav osa, füüsilise isiku maksejõuetuse seadus |
| 10 | Töövõime vähenemine (A16) | 7 juhendit ja infomaterjali (loetud neljast kolm on hoiakute uuringud ja hindamised), 3 organisatsiooni lehte; seadus puudub | hindamise käik, töövõimetoetuse summa, haigushüvitis | Töötukassa töövõime hindamise ja töövõimetoetuse lehed, Tervisekassa haigushüvitise leht; töövõimetoetuse seadus |
| 11 | Lähisuhtevägivald ja kuriteo ohver (A9, A10) | 10 ja 13 juhendit, peamiselt spetsialistile ja koolitajale; ohvriabi kohta oma kirje või kord 63 omavalitsusel | ohvriabi seadus; lihtne juhis ohvrile endale; sõnaotsing ei leia | ohvriabi seadus; Sotsiaalkindlustusameti ohvriabi lehed ohvrile; politsei leht lähenemiskeelust ja avalduse tegemisest |
| 12 | Eakas üksi kodus (A22); eaka väärkohtlemine ja rahaline ärakasutamine (A25) | A22: 9 organisatsioonide ja müüjate lehte, oma kirje või kord 76 omavalitsusel, ootamise ja õiguste kohta ainult seadus; A25: 1 uuring | ülevaade üksi elava eaka abist; kõik ärakasutamise ja pettuste kohta | Sotsiaalkindlustusameti ja politsei lehed eakate väärkohtlemisest ja pettustest; karistusseadustiku vastavad sätted |
| 13 | Vaimse tervise kriis ja sõltuvus (A27, A28); tahtest olenematu abi (B12) | 6 ja 6 juhisdokumenti (sõltuvuse omadest kaks on ülevaated ja üks spetsialistile); B12: 2 juhendit, 3 seadusest 1 | eneseabi ja abi leidmise lehed inimesele; tahtest olenematu ravi ja kinnisesse asutusse paigutamise kord | Peaasi ja Tervise Arengu Instituudi abi leidmise lehed; psühhiaatrilise abi seadus, tsiviilkohtumenetluse seadustiku paigutamise osa |
| 14 | Pagulane, sõjapõgenik, uussisserändaja (A34) | 2 juhendit spetsialistile, 18 artiklit; 2 seadusest 0 | mis abi ja toetusi saab, kuhu pöörduda | Sotsiaalkindlustusameti lehed rahvusvahelise kaitse saajale, Politsei- ja Piirivalveameti lehed ajutisest kaitsest ja elamisloast; välismaalasele rahvusvahelise kaitse andmise seadus |
| 15 | Vanglast vabanemine (A33); spetsialisti töö: kodukülastus ja abist keeldumine (B2), dokumenteerimine (B13), andmete jagamine (B6) | A33: 15 artiklit, 4 uuringut; B2: 1 juhend; B13: 2; B6: 10 juhendit, 3 seadusest 1 | A33: kõik praktiline; B2: mida teha, kui inimene abist keeldub; B6 ja B13: isikuandmete kaitse seadus ja avaliku teabe seadus | vanglateenistuse ja kriminaalhoolduse lehed vabanejale; Sotsiaalkindlustusameti või õiguskantsleri juhis abist keeldumise kohta; isikuandmete kaitse seadus, avaliku teabe seadus |

Rida A12 (sissetulek ei kata elamist) ei ole loendis, kuigi olukord on väga sage: toimetulekutoetuse kirje on 79 omavalitsusel ja seadus on RAG-is; puudu on ainult üks lihtne üleriigiline selgitus (1 juhend, omavalitsusele kirjutatud).

## Maht ja ruum

Indeksi piir on 100 000 lõiku ja 10 000 dokumenti (ADR-108); kasutusel on 68 408 lõiku ja 8337 dokumenti, vaba 31 592 lõiku ja 1663 dokumenti.

Hinnang, mitte mõõtmine: 15 lünga täitmine on umbes 200–260 dokumenti ja 3500–4500 lõiku ehk 11–14% vabast lõiguruumist ja 12–16% vabast dokumendiruumist. Arvutus: ametlik juhisleht on RAG-is keskmiselt 3 lõiku (mediaan 30 lehe pealt), umbes 170–220 lehte on kuni 1000 lõiku; riigi seaduse üks redaktsioon on keskmiselt 203 lõiku, puuduvast 27 seadusest umbes 15 läheks tervikuna ja 12 suurest seadustikust ainult vajalikud osad, kokku umbes 2700 lõiku. Kettal on see umbes 1,7 GB (380 KB lõigu kohta). Ostu hind varasemate täienduste järgi (0,00003–0,00009 USD lõigu kohta) on suurusjärgus 0,1–0,4 USD; see on omaniku otsus ja siin ei ole midagi ostetud.

## Mida kontrollisin ja mida mitte

Kontrollitud:
- Loendus kõigi 49 rea ja 6 veeru kohta üle 5827 dokumendi 64 831 lõigu, kolm korda (iga kord rangema reegliga). Loendur ja ruudustik on ühiktestiga kaetud.
- Juhisdokumentide pealkirjad lugesin kolmanda loenduse järel läbi 30 real 49-st: kõik read, mida lünkade loend nimetab, ja A8, A12, A20, A23. Ülejäänud 19 rea märgid on sellised, nagu reegel andis.
- RAG-is olevate riigi seaduste, ametlike lehtede, juhendite ja infomaterjalide loendi lugesin tervikuna (10 seadust, 30 lehte, 225 juhendit ja infomaterjali).

Kontrollimata:
- Kas loetud dokument tegelikult vastab inimese vajadusele: tekste ei lugenud inimene ega mudel.
- Vektorotsing ja vastuste sisu. Leitavuse mõõtmine 15 mõõtmata real vajab päris pöördeid: 49 alguslauset on ruudustikus valmis, üks pööre on umbes 0,005 USD, kokku umbes 0,25 USD. Seda ei ole käivitatud; see ootab omaniku sõna.
- Seaduste nimekiri (34) ja vastutavad asutused ridade juures on minu koostatud ja võivad olla puudulikud või vananenud nimega.
- Olukordade sageduse järjekord on minu hinnang.
- Nimetatud ametlike lehtede olemasolu väljaandja juures.

## Kuidas uuesti käivitada

Pärast iga korpuse täiendust, serveris, tasuta, umbes 4 minutit:

```
sh /home/ubuntu/rag-v2-work/ov2-run.sh w4-empty scripts/rag-v2-coverage-map.mjs --out /home/ubuntu/rag-v2-work/coverage-out --probe --turns
```

Tulemus: `coverage-map.md` (tabelid) ja `coverage-map.json` (arvud ja dokumentide pealkirjad lugemiseks; kontaktide ja vormide pealkirju ei loeta). Read, võtmesõnad, seadused ja reeglite arvud muudetakse failis `scripts/lib/rag-v2-coverage-grid.json`; loendusreeglid on failis `scripts/lib/rag-v2-coverage-map.mjs`. Testpöördeid loeb skript ainult siis, kui rakenduses on üks konto; muul juhul tuleb anda `--turns-until <aeg>`, milleni oli üks konto.

## Read, mille juures seadust RAG-is ei ole

Puuduvad 27 (ridade järgi): põhikooli- ja gümnaasiumiseadus; perehüvitiste seadus; riikliku perelepitusteenuse seadus; ohvriabi seadus; töötuskindlustuse seadus; tööturumeetmete seadus; töölepingu seadus; täitemenetluse seadustik; füüsilise isiku maksejõuetuse seadus; ravikindlustuse seadus; töövõimetoetuse seadus; tervishoiuteenuste korraldamise seadus; tsiviilseadustiku üldosa seadus; tsiviilkohtumenetluse seadustik; karistusseadustik; psühhiaatrilise abi seadus; pärimisseadus; riikliku pensionikindlustuse seadus; vangistusseadus; kriminaalhooldusseadus; välismaalasele rahvusvahelise kaitse andmise seadus; välismaalaste seadus; isikuandmete kaitse seadus; avaliku teabe seadus; halduskohtumenetluse seadustik; riigihangete seadus; hädaolukorra seadus.

## Täiendus 08.10.2026 õhtul: puuduvad seadused on alla laaditud

Omanik: „otsi internetist ja lae alla, pane lokaalselt Andmebaas/i kausta“. Riigi Teatajast (avalik otsing ja XML, samad päringud mis skriptil `scripts/rag-v2-law-validity.mjs`) on toodud iga seaduse 08.10.2026 kehtiv terviktekst, kokku 27 faili (13,4 MB), ja kantud registrisse (`scripts/rag-v2-corpus-refresh.mjs register`). **RAG-is neid ei ole:** vastuvõtt ja indekseerimine on omaniku järgmine otsus ja maksab.

**Parandus loendisse:** hädaolukorra seadus on alates 01.10.2026 kehtetu; selle asemel kehtib kriisiolukorra ja riigikaitse seadus, mis on alla laaditud. Ruudustiku rea B15 seaduse nimi on parandatud.

| Seadus | Fail `Andmebaasi/oigusaktid/` | Kehtib alates | Kehtib kuni | Paragrahve | Juba avaldatud järgmine redaktsioon |
|---|---|---|---|---:|---|
| Põhikooli- ja gümnaasiumiseadus | `109072026017.xml` | 01.09.2026 | 31.12.2026 | 131 | 01.01.2027 |
| Perehüvitiste seadus | `111072026059.xml` | 01.10.2026 |  | 88 |  |
| Riikliku perelepitusteenuse seadus | `131032022015.xml` | 01.09.2022 |  | 21 |  |
| Ohvriabi seadus | `109072026046.xml` | 01.10.2026 |  | 63 |  |
| Töötuskindlustuse seadus | `130062026040.xml` | 01.10.2026 | 31.12.2026 | 75 | 01.01.2027 |
| Tööturumeetmete seadus | `130062026038.xml` | 01.10.2026 | 31.12.2026 | 39 | 01.01.2027 |
| Töölepingu seadus | `103072026035.xml` | 01.10.2026 | 31.12.2026 | 164 | 01.01.2027 |
| Täitemenetluse seadustik | `111072026097.xml` | 01.10.2026 | 31.12.2026 | 259 | 01.01.2027, 01.07.2027 |
| Füüsilise isiku maksejõuetuse seadus | `114032025014.xml` | 01.01.2025 |  | 73 |  |
| Ravikindlustuse seadus | `130062026028.xml` | 01.10.2026 | 31.01.2027 | 99 | 01.02.2027 |
| Töövõimetoetuse seadus | `130062026034.xml` | 01.10.2026 | 31.01.2027 | 38 | 01.02.2027 |
| Tervishoiuteenuste korraldamise seadus | `130062026132.xml` | 01.10.2026 | 31.12.2026 | 161 | 01.01.2027 |
| Tsiviilseadustiku üldosa seadus | `131122024048.xml` | 01.01.2025 |  | 175 |  |
| Tsiviilkohtumenetluse seadustik | `120062026021.xml` | 30.06.2026 | 31.12.2026 | 844 | 01.01.2027, 01.07.2027 |
| Karistusseadustik | `109072026028.xml` | 01.10.2026 | 31.12.2026 | 576 | 01.01.2027 |
| Psühhiaatrilise abi seadus | `131122024024.xml` | 10.01.2025 |  | 28 |  |
| Pärimisseadus | `114032025019.xml` | 01.01.2025 |  | 193 |  |
| Riikliku pensionikindlustuse seadus | `111072026061.xml` | 01.10.2026 | 31.12.2026 | 110 | 01.01.2027, 01.01.2031, 01.01.2037 |
| Vangistusseadus | `111072026066.xml` | 01.10.2026 | 31.12.2026 | 242 | 01.01.2027 |
| Kriminaalhooldusseadus | `114032025025.xml` | 01.01.2025 |  | 42 |  |
| Välismaalasele rahvusvahelise kaitse andmise seadus | `130062026102.xml` | 01.10.2026 | 31.12.2026 | 116 | 01.01.2027 |
| Välismaalaste seadus | `130062026103.xml` | 01.10.2026 | 31.12.2026 | 457 | 01.01.2027, 01.01.2028, 01.01.2029, 31.10.2029 |
| Isikuandmete kaitse seadus | `130062026052.xml` | 01.10.2026 |  | 78 |  |
| Avaliku teabe seadus | `130062026009.xml` | 01.10.2026 | 30.11.2026 | 85 | 01.12.2026, 01.01.2027, 24.04.2030 |
| Halduskohtumenetluse seadustik | `103062026067.xml` | 12.06.2026 | 31.12.2026 | 306 | 01.01.2027, 01.07.2027, 01.01.2033 |
| Riigihangete seadus | `103072026006.xml` | 01.10.2026 | 31.10.2026 | 235 | 01.11.2026, 01.01.2027 |
| Kriisiolukorra ja riigikaitse seadus (hädaolukorra seaduse asemel) | `130062026001.xml` | 01.10.2026 |  | 286 |  |

17 seadusel on Riigi Teatajas juba avaldatud järgmine redaktsioon (enamasti alates 01.01.2027); neid ei ole alla laaditud. Riigihangete seaduse praegune redaktsioon kehtib 31.10.2026-ni ja avaliku teabe seaduse oma 30.11.2026-ni.

Kontrollitud: iga faili pealkiri ja tunnus vastavad otsingu omale, Riigi Teataja märgib redaktsiooni kehtivaks, failis on paragrahvid; registri räsi võrdub alla laaditud baitidega (27/27). Kontrollimata: seaduste lugemine korpuse lugejaga (struktuur, lõikude arv) ja see, millised osad suurtest seadustikest tasub RAG-i võtta.
