# Codexi järgmine tööplokk — kontrollitud väljalase ja nelja vormingu tervikrada

08.09.2026. Alus: `SOTSIAALAI_GITHUB_AUDIT_9780dee9c_2026-09-08.md`, omaniku lisatud uus RAG-master ja tegelik kohalik tööpuu. Auditeeritud GitHubi lähte-SHA: `9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd`.

**See fail on tööettepanek, mitte automaatne push’i, deploy või tasulise korpusejooksu luba.** Varasem konkreetse piloodi heakskiit ei asenda uue sisu/koodi käitamise sobivat töövolitust. Aktiivne töö juhtimine jääb projekti `SotsiaalAI.md` S1.0/S2 alla.

## Eesmärk

Saada üks korratavalt ehitatav ja ülevaadatud koodiversioon, mille kaudu olemasoleva uue M1 neli vormingut liiguvad väikese valimina allikast otsinguindeksisse ja õigusega piiratud allikavaatesse. M4 kasutatav väljalase ja aktiivne indeks peavad olema teadlikult kooskõlas. Parandada auditis F02 all tuvastatud konkreetne dokumendiloa korduskontroll.

Ei ehitata uut RAG-raamistikku, agentide ahelat ega uut parserit juba olemasoleva asemel. Ei alustata vana tsitaadikandidaadi päästmist ega sama küsimustiku suurt promptikatset.

## 1. Tegelik lähtepuu ja muudatuste eristus

Loe projekti `AGENTS.md`, aktiivne S1.0/S2/S11 ja olemasoleva M1 töö leping. Kontrolli kohalikku status/diff/HEAD ning GitHubi main-i. Uuemate tööde olemasolul ära kirjuta neid selle auditi SHA-le tagasi.

Erista kolm rühma: olemasolev nelja vormingu M1 töö; varem kohaliku teise akna quality-gate’i parandus; ülejäänud omaniku tööd. Stage’i ainult üle vaadatud nimelised failid või asjakohased hunks’id. Ei kasutata `git add .`, pimedat stash’i, reset’i ega võõraste failide taastamist.

Masteri kirjeldus ei asenda kohalikku diffi. Samuti ei tähenda GitHubist puuduva uue faili tuvastamine, et see tuleb nullist uuesti kirjutada.

## 2. F02 kitsas õiguste parandus

Vaata `IntakeService.get()` binaarse `pdf` ja `metadata` haru. Pärast tegeliku faili lugemist/räsi kontrolli tuleb jõustada **sama dokumendi** värske lubatavus, mitte lihtsalt välja kutsuda loendit tagastav `access()`.

Kasuta olemasolevat kviitungi- ja õiguselepingut. Soovituslik minimaalne suund on lõpus `receipt(jobId, await access())` või samaväärne täielik konkreetse dokumendi/kviitungi kontroll. Ära nõrgenda kasutaja-, konfiguratsiooni-, aegumise- ega allikaversiooni piire.

Lisa päris teenuse sihttestid: luba eemaldatakse pärast esmase kontrolli läbimist, kuid enne PDF-/metadata-lugemise tulemuse tagastamist. Konto jääb lubatud administraatoriks. Mõlemad varaliigid peavad olema keelatud. Kontrolli ka muutumatult lubatud lugemist ja olemasolevat JSON-kviitungi haru.

Auditi diagnostika **ootab vana vea taasesitumist**. Ära lisa seda muutmata vastuvõtutestina, mis eeldaks lekke säilimist; parandatud koodi regressioon peab ootama tõrjet.

## 3. CI ja serveri/brauseri piir

Auditeeritud SHA Actionsi vead olid `app/layout.js` välisskripti lint ning `node:crypto` jõudmine webpacki kliendipakki läbi diagnostikamoodulite.

Võta olemasolev kohalik lahendus esmalt ülevaatusse. Brauseri diagnostika esitus peab sõltuma brauserikõlblikust lepingust; serveri räside/analüüsi loogika jääb serverisse. Ära lahenda seda kogu diagnostika väljalülitamise, reegli vaigistamise või põhjendamata krüptopolüfilliga.

Kinnita tegeliku avaldatava puu lint, i18n ja projekti nõutud build-rajad. Kui CI ja kohalik ehitus kasutavad erinevat tööpuud või build-mootorit, näita seda eraldi. Sõltuvuste npm-i turvahoiatused tuleb liigendada enne jõuga paketiuuenduste tegemist.

## 4. Olemasoleva M1 ja allikaviite vertikaalne ühendus

Vali olemasolevast üle vaadatud valimist väike PDF/HTML/XML/JSON kogum. Eesmärk pole uus üldine parserivastuvõtt, vaid olemasoleva töö liitmine indeksiga. Iga vormingu kohta peab olema üks kontrollitav allikakoht; JSON-i puhul eraldi valitud kirje, mitte kogu KOV-paketi semantiliste identiteetide segamine.

Kontrolli:
- algvara ja metaandmete päritolu säilib;
- vana `rag-v2/1` PDF on endiselt loetav;
- uus kuju ja allikavahemikud jõuavad PostgreSQL-i objektidesse ning kompaktse viitekaardini;
- HTML/XML/JSON-ile ei lisata väljamõeldud PDF-lehti;
- allika avamine, autori/aasta ja muu päritolu puuduvad väärtused ei muutu mudeli oletuseks;
- muutunud versioon ei muuda varem avaldatud viite teksti;
- uue vormingu teadmiskandidaadi piir on nähtav, kui M3 ankrud sellele veel ei laiene.

Kohalik mehaanikarada võib kasutada selgelt eraldatud testvektoreid; see ei ole semantilise otsingu tõend. Pärisvektorite jaoks taaskasuta ainult sobiva tegeliku sisendi, mudeli, konfiguratsiooni ja õigusega olemasolevaid vektoreid. Puuduvate vektorite puhul vormista üks tegeliku mahu põhine partii, mitte varjatud väliskutse.

## 5. Allikaregistri, indeksi ja M4 kooskõla

Näita eraldi allikaregistri versioonipilt, `rag_v2_head` ning M4 plaani `generationId/documents/profileId`. Ära tõlgenda värske indeksi olemasolu tõendina, et vestlus seda kasutab.

Koosta kontrollitud uuele põlvkonnale ülemineku ja tagasipöördumise toiming. Eelkontrolli erinevus peab jätkuvalt andma selge vea; seda ei lahendata `active_index_mismatch` kontrolli eemaldamisega. Varem salvestatud vastused kasutavad oma lubatud ajaloolisi allikaversioone.

Praeguse arhitektuuri jaoks sobib esialgu kontrollitud hooldussamm; ära ehita selleks uut hajussüsteemi. Tulevase väljalaskemanifesti kuju kirjeldatakse minimaalselt, et järgmine mahu- ja valikulise lugemise töö saaks seda kasutada.

## 6. Väljund ja vastuvõtt

Esita üks raport olemasoleva töökorralduse all: tegelik lähte- ja lõpp-SHA, kaasatud/puutumata muudatused, käivitatud sihttestide pass/fail/skip, CI/build’i seis, nelja vormingu allikaseoste näited, aktiivse indeksi ja M4 valiku vastavus ning võimalikud blokeeringud.

Kõik järgmised punktid peavad olema eristatavad:

| Vastuvõtt | Minimaalne tõend |
|---|---|
| Õiguse tühistamine | PDF ja metadata tõrjutakse pärast asjakohase dokumendigrandi eemaldamist lugemise ajal. |
| Korratav väljalase | Ülevaadatud puu vajalikud CI/build väravad läbivad; kohaliku ja avaldatud teostuse erinevus pole peidetud. |
| Nelja vormingu indeksileping | Iga näidise tekst, asukoht, versioon ja viide säilivad päris salvestus-/lugemisrajas. |
| Kooskõlaline põlvkond | Uue päringu jaoks valitakse teadlikult õige valmis indeks; vana vastuse viide ei muutu uueks tekstiks. |
| Katkestus ja tagasipöördumine | Tõrge ei hävita vana aktiivset indeksit ega käivita loata kordusmodelleerimist. |
| Teadaolev piir | Mehaanika, mudeli sisu ja kogu korpuse kvaliteet ei ole üks ühine PASS. |

Arenduseks vajalikud kohalikud muudatused ja kontrollid on üks piiritletud töövoor. Tasuline töö ja serverisse paigaldamine toimuvad ainult nende tegelikku ulatust katva loa olemasolul. Avalikku vastamist ei avata selle ploki lõpetamise põhjal.

## Teadlikult edasi lükatud

Kogu registri massindekseerimine, 5000 piiri pime tõstmine, fusiooni-/mudelivahetus, M3 automaatne kõikide dokumentide seostamine, uus suur semantiline hindamisring ning kogu M5/M6 ehitamine ei kuulu siia.

Pärast selle ploki tulemuste ülevaatust alustada kahte seotud, kuid eraldi mõõdetavat tööd: **jätkatav korpuse mahutöötlus** ning **päringu valikuline lugemine**. Teise kliendi liidesed ja õiguste piirid peavad säilima, kuid toodet ei üldistata ainult abstraktsioonide kirjutamise abil.
