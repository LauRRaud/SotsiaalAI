# Codexi ülesanne: M2.3 sisulise rubriigi v2 ettevalmistus ja kordushindamine

Ülesande versioon: v0.1, 05.09.2026.
Ulatus: olemasoleva M2.3 järgmine osa, mitte uus arhitektuur ega M2.2 kordus.
Staatus: teostuse lähteülesanne; see fail ei kinnita ühtegi uut sisulist märgendit.

## 1. Eesmärk

Erista sama muutumatu otsingutulemuse puhul ajalooline v1 ankrutabamus ja küsimusele vastamiseks tegelikult olemas olev sisuline tugi. Täpsusta hindamislepingut enne otsingujärjestuse või kontekstivaliku muutmist.

Selle ploki edu ei ole suurem tabamusprotsent. Edu on jälgitav otsus: mida küsimus nõuab, milline algtekst seda toetab, mis jäi puudu ning kas varasem erinevus pärines hindamisest või otsingust.

Tulemused piirduvad etteantud korpuse ja küsimustega. Luna vastuseid selles plokis ei hinnata.

## 2. Alus ja juba lõpetatud töö

Loe tegeliku tööpuu juhiseid ning aktiivset `SotsiaalAI.md` S1.0 kirjet. Täpne failitee selgita olemasolevast repositooriumist; ära loo uut konkureerivat seisufaili.

Peamine lähteallikas:
`docs/audits/rag-v2-multi-source-preparation-2026-09-05.md`, jaotis „M2.3 kitsas diagnoos pärast koodiülevaatust” (ülesande aluseks olevas koopias read 128–166).

Diagnoosi auditi lähte-SHA on `aa2b120721f066233c4d77770dcd49fd9a0713a0`. Audit raporteerib 84 salvestatud RRF-järjestuse ja 405 tõendikatkendi kooskõla kontrolli. PDF-e selles diagnoosis uuesti visuaalselt ei kontrollitud. Seda diagnostikat ei pea tervikuna uuesti tegema; kontrolli kasutatavate lähteartefaktide identiteeti ja tööpuu võimalikke vahepealseid muudatusi.

Auditis tuvastatud eristused:
- Tehnopoli elluviijate vajalik lõik oli vektorirajas 3. ja hübriidis 14. kohal. Täpne küsimus nõuab Tehnopoli ning EKA materjali, mitte suvalist samateemalist allikat.
- Intsidendi ja EN/RU rahastuse vajalik viies tulemus jäi struktuurirajast välja `seed_limit` tõttu, mitte tokeniruumi puudumise tõttu.
- Tööandja vastutuse hübriidkonteksti 4. lehe tekst sisaldas sisulisi vastuseosi, mida 5. lehe fraasidega piiratud v1 ankrud ei tunnistanud.
- Inimsuhete/arendustingimuste ja andmeminimeerimise alternatiivne tekst oli asjakohane, kuid täielikku samaväärsust ei kinnitatud.
- Kanalite kattuvuse eelis seletab üht tegelikku mehhanismi, mitte kõiki juhtumeid. ESTA näites oli vajalik leksikaalne esikoht vektorirajas alles 17. kohal.

Neid tähelepanekuid ei teisendata automaatselt uuteks õigete vastuste siltideks.

## 3. Selle ploki muutumatud piirid

Ära muuda otsingutuuma järjestust, RRF-konstanti ega kaale, dokumendikvoote, kandidaatide arvu, top-k piire, struktuuri valikupoliitikat, tokenieelarvet, parserit, tükeldamist, metaandmeid või embedding-sisendeid.

Ära muuda olemasolevaid v1 küsimusi, ankrufaili ega ajaloolisi tulemusi. Täpsustus lisatakse uue rubriigi ja eraldi kordushindamise väljundina. Uue hindajaversiooni loomine on lubatud, v1 käitumise muutmine ei ole.

Ära indekseeri, aktiveeri uut põlvkonda ega kirjuta PostgreSQL-i või Qdranti. Kasuta salvestatud tulemusi ja muutumatuid lähteversioone. Vajaduse korral loe privaatsest hoidlast puuduvat algteksti ainult olemasolevate õiguste piires. Puuduv või räsiga mittekattuv sisend märgitakse tõrkena; seda ei asendata praeguse veebilehega.

Väliseid embedding- ega genereerimiskutseid ei tehta. Ei lisata mudelipõhist hindajat, agenti, Lunat, HTTP-rada ega tasulist teenust. `generationAvailable=false` ja struktuuri senine vaikimisi väljasolek ei muutu. Push, deploy ja tootmistoimingud ei kuulu ülesandesse.

Rubriik, oodatud allikad ja hindamismärgised on ainult hindaja sisend. Need ei lähe otsingusse, embedding-teksti ega tulevase vastaja konteksti.

## 4. Rubriigi sisu

Koosta versioonitud rubriik küsimuseperekondade kaupa. Kasuta olemasolevaid küsimusi ja nende tegelikku ulatust. Ära lisa nõudeid lihtsalt sellepärast, et mõni allikas sisaldab veel huvitavat teavet.

Iga perekond kirjeldab:
1. Vastamiseks vajalikud sisulised mõtted eraldi nõuetena. Erista kohustuslik mõte valikulisest näitest või lisaselgitusest.
2. Allika-, aja-, piirkonna-, subjekti- ja muud piirangud, mida küsimus või väite tähendus nõuab. Artiklis kirjeldatu leidmine ei ole iseseisev kinnitus tänase kehtiva õiguse kohta.
3. Iga nõude lubatud tõenduskomplektid. Ühest mitmest heakskiidetud alternatiivist võib piisata; mõne alternatiivi puhul tuleb leida mitu lõiku koos. Säilita JA- ning VÕI-tingimuste eristus.
4. Tingimused, mille puhul tekst on ainult osaline tugi, seotud taust või sobimatu tõend. Sama sõna või teemanimetus ei tõenda väidet.
5. Teksti täpne päritolu: algfaili räsi, dokumendiversioon, PDF-leht ja allikakohad. Tekstikoha määramise fraas on asukoha leidmise vahend, mitte üksinda sisulise piisavuse tõend.
6. Ülevaatuse seis, põhjendus ja tegelik ülevaataja. Codex ei märgi enda ettepanekut inimese heakskiiduks ega täida väljamõeldud `reviewed_by` väärtust.

Üks lõik võib toetada mitut nõuet, kuid iga seos peab olema põhjendatud. Vastutaja või piirava tingimuse tuvastamiseks peab tõenduskomplekt sisaldama vajalikku konteksti; pelk tegevuste loend ei tõenda, kelle vastutusest räägitakse.

## 5. Kõigepealt lahendatavad rubriigikohad

### 5.1. Tööandja vastutus

Säilita küsimuse kaks põhiteemat: artiklis kirjeldatud roll riskide hindamisel/ennetamisel ning tugi pärast vägivallajuhtumit.

Võrdle 4. lehe kandidaati 5. lehe seniste allikakohtadega. Kontrolli väite subjekti, lõigu konteksti ning seda, milliseid nõudeid kumbki tekstikomplekt tegelikult katab. Ära nõua kindlat lehekülge ega ministeeriumi kommentaari, kui küsimus seda ei nõua. Samuti ära otsusta automaatselt, et kõik 4. lehe tegevused on täielik asendus kõigile 5. lehe väidetele.

Auditis nimetatud kandidaat on `chunk_eb39b390683c652190a69f1c5ff056d6bd2e1c980300e43a041c445c7c45c6a1`; kasuta seda leidmiseks, mitte käitusaja erandreeglina. Heakskiidetud tugi seo allikakohtadega, mitte eeldatava võitnud otsingumeetodiga.

Sama teksti samaväärsuse otsus rakendub kõigile meetoditele, mille tegelikus kontekstis vajalik tõenduskomplekt olemas on. Hübriidi otsust ei kanta automaatselt struktuurirajale.

### 5.2. Inimsuhted ja arendustingimused

Määra enne alternatiivide kinnitamist, milliseid arendustingimusi küsimus nõuab ning kas tingimuste ulatus on üldine või konkreetse hooldusnäite piires. Erista läbipaistev teavitamine ja teadlik osalus laiemast arendusprotsessi läbipaistvusest ning kaasamisest. Ära kustuta vajalikku väärtuspõhist piirangut üksnes sobiva lühema tekstikoha heakskiitmiseks.

Lk 7–8 asjakohasus ei anna automaatselt kogu küsimuse täielikku katvust. Lk 12 fraasi puudumine ei tähenda automaatselt igasuguse asjakohase toe puudumist.

### 5.3. Andmeminimeerimine ja väljasaatmine

Erista iga detaili vajalikkus, konkreetse dokumendi/sisu edastamise õigus ning üldised andmeliigi, õigusliku aluse ja lepingulise katvuse käsitlused. Määra täpse küsimuse järgi, mis on täielik ja mis osaline tugi. Ära muuda õigusliku või lepingulise aluse mainimist automaatselt kõigi nõuete täitmiseks.

### 5.4. Tehnopoli ja EKA rollid

Säilita küsimuse eksplitsiitne allikaeristus: Tehnopoli kirjeldus elluviijatest JA EKA enda rollikirjeldus. EKA allikast leitud elluviijate nimed ei täida üksinda Tehnopoli allikanõuet. EKA rolli juba lubatud alternatiivid säilivad, kui nende allikavastavus on kontrollitud.

## 6. Hindaja ja inimülevaatuse tööjaotus

Ära püüa asendada kitsast fraasihindajat uue kontrollimatu „semantilise” regexi, sarnasuskünnise või mudeli usaldusskooriga.

Programm kontrollib identiteeti, algteksti, heakskiidetud allikakohtade leidumist, tõenduskomplektide koosseisu ja versioone. Sisulise samaväärsuse ning kohustuslike mõtete määramise otsus peab olema eraldi põhjendatud ja üle vaadatud.

Koosta uute ja vaidlustatud vastenduste jaoks ülevaatusfail. Meetodi nimi, skoor ja järjestus peidetakse sisulise otsuse tegemise vaates; vajalik allikapäritolu jääb nähtavaks. Kõigi meetodite sama tekstikomplekti saab sisuliselt hinnata üks kord ja otsuse jälitatavalt taaskasutada.

See ei muuda hindamist tagantjärele puutumatuks: seniseid tulemusi on juba nähtud. Märgi v2 analüüs retrospektiivseks.

Ära kontrolli ainult v1 ebaõnnestumisi. Rakenda sama rubriiki ka varem õnnestunuks loetud juhtumitele. See väldib ühe meetodi kasuks ainult alternatiivsete võitude lisamist.

## 7. Eraldi mõõtmised ja olekud

Säilita igale reale muutmata v1 ankrumõõdik. Lisa sellest eraldi v2 nõuete katvuse esitus.

Erista:
- millistele küsimuse osadele leidub valitud korpuses kinnitatud tugi;
- millised neist jõudsid konkreetsesse lõppkonteksti;
- milliseid nõudeid kontekst ei kata või mille ülevaatus on lahti;
- kas kontekstis on tuvastatud vastuolu või vale ulatusega väide.

V2 sisulise kokkuvõtte võimalikud seisud on `full`, `partial`, `absent` ja `needs_review`. Vastuolu märgi lisaks eraldi, mitte ära loe vastandväidet nõude toetuseks.

`absent` tähendab, et läbivaadatud tagastatud kontekst ei toeta ühtegi küsimuse nõutud sisulist osa; see EI tähenda lihtsalt „ükski heakskiidetud fraas ei kattunud”. Kui võimalik samaväärne tugi pole veel hinnatud, kasuta `needs_review` või eraldi ülevaatuse lippu, mitte automaatset puudumise järeldust.

Täielikkus nõuab kõiki kohustuslikke mõtteid ja allika-/ulatustingimusi. Ainult teemakohane tekst ei ole tingimata osaline vastusetugi. Lahendamata vajalik hinnang välistab lõpliku täielikkuse kinnituse.

Osaliselt vastatava küsimuse puhul raporteeri eraldi olemasoleva toe leidmine ja terve küsimuse katvus. Näiteks projektide arv ning teemad ei anna täielikku vastust küsimusele, mis nõuab lisaks mõõdetud tulemusi, kui neid valitud korpuses ei ole.

Juhul kui ülevaatus on lahti, ei esitata lahendamata ridade eemaldamisega kunstlikult paranenud kvaliteediprotsenti. Näita nende arvu ja mõju koondile.

## 8. Kordushindamine ilma uue otsinguta

Valmista ette kohalik võrguta kordushindamise käsk, mis loeb salvestatud v1 tulemuse ning uue rubriigi/ülevaatusotsused ja kirjutab eraldi väljundid. See ei tohi kutsuda `retrieve()` funktsiooni ega teenuseid tulemuste uuesti moodustamiseks.

Kontrolli tulemuse payload-räsi, küsimuste räsi, korpuse identiteeti ja heakskiidetud allikakohtade seoseid. Säilita iga meetodi täpne valitud tekstikogum, järjekord ja tokeniarvestus. Puuduva masinloetava tulemuse korral kasuta olemasolevat kontrollitud ekspordirutiini; ära koosta teksti kadudega HTML-i nähtavate pealkirjade põhjal.

Rakenda rubriik kõigile 84 meetodireale. Senised regressioonitulemused säilivad eraldi; nende vajaduspõhine sisuline täpsustus ei kirjuta vana tulemust üle.

Näita v1 → v2 erinevuse juures täpselt, mis muutus:
- kinnitatud alternatiivne tugi;
- varem puudumisena märgitud osaline tugi;
- varem piisavaks loetud, kuid täpsustatud nõuet mitte täitev tekst;
- muutmata hinnang;
- lahendamata ülevaatus.

Selgita raportis selgelt: „Otsingut ei muudetud; erinevus tuleneb hindamisrubriigi või kinnitatud vastenduste muutusest.” Ära nimeta v2 kordushindamist otsingualgoritmi paranemiseks.

## 9. Nõutavad kontrollid ja üleandmine

Kasuta olemasolevat testitaristut, mitte uut raamistikku. Testi vähemalt järgmisi piire:
- sobiv alternatiiv katab ainult talle kinnitatud nõude;
- ühe nõude mitu koos vajalikku lõiku ei taandu ühe lõigu OR-tabamuseks;
- sama teema vale allikas ei täida eksplitsiitset allikanõuet;
- õige allika ID või lehekülg ilma vajaliku tekstita ei anna tuge;
- osaline, puuduv ja lahendamata hinnang on eristatavad;
- kõigi olemasolevate osavastuste leidmine ei muutu kogu küsimuse täielikkuseks;
- sama tegelik kontekst saab sama hinnangu sõltumata meetodi nimest;
- v1 failid ning väljundid jäävad muutmata ja kordushindamine on võrguta.

Lõpuks anna üle rubriigi v2 ettepanek, kinnitatud/ootel vastenduste fail, kordushindamise käsk ja raport ning tegelikult käivitatud testide pass/fail/skip tulemused. Märgi ülevaataja roll ausalt. Omaniku või määratud sisulise ülevaataja heakskiidu puudumisel anna valmis ülevaatuspakett ja märgi koond esialgseks; ära kinnita seda ise nende nimel.

Uuenda ainult olemasolevat aktiivset S1.0 kirjet projekti töökorra kohaselt. Detailid lähevad asjakohasesse auditisse. Privaatsed algtekstid, raportid, load ja vektorid ei lähe avalikku Git-repositooriumisse.

## 10. Peatumiskoht ja järgnev otsus

Peatu enne järjestuse või valikupoliitika muutmist. Selle ploki väljund peab võimaldama otsustada, milline konkreetne otsingupuudujääk jääb alles pärast rubriigi korrastamist.

V1 kontrollosa on juba diagnoosiks avatud. Selle ümberhindamine või ümbernimetamine ei tee sellest uut puutumatut kontrollosa. Järjestuse hilisem häälestus peab kasutama deklareeritud arendusandmeid ning lõplik kontroll uut enne häälestust varjatud küsimuseperekondade kogumit. Sama perekonna tõlkeid ega parafraase ei tohi jagada arenduse ja puutumatu kontrolli vahel.

Kanalite tugevate leidude säilitamine, fusioonikaalud ja naabrite valik on hilisema võrdluse hüpoteesid, mitte selle ülesande ette antud lahendus. Suure korpuse päringu töömahu muutmine ning M4 ühendamine jäävad eraldi töödeks.
