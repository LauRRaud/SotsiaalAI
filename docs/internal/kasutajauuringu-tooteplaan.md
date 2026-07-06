# SotsiaalAI kasutajauuringu tooteplaan

Kuupaev: 2026-05-01

See dokument teisendab tulevaste SotsiaalAI vastajate kvalitatiivse sisendi tootearenduse plaaniks. Valim on vaike, seega ei kasuta seda statistilise toestusena, vaid korduvate mustrite ja tootepohiste riskide tuvastamiseks.

## Kokkuvottev jareldus

Uuringu pohjal ei peaks SotsiaalAI spetsialisti vaade olema "AI kirjutab dokumendi valmis" toode. Tugevam positsioon on kontrollitav sotsiaalvaldkonna tooassistent:

1. kasutaja valib sisendid;
2. kasutaja valib voi kinnitab allikad;
3. kasutaja valib dokumenditüübi ja vajadusel malli;
4. SotsiaalAI loob mustandi;
5. kasutaja muudab ja annab uue juhise;
6. SotsiaalAI kontrollib mustandit;
7. kasutaja kinnitab, kopeerib, ekspordib voi viib ametlikku süsteemi.

Praegune platvorm katab osa sellest juba ara: olemas on dokumenditeek, agent-reziim, allikdokumentide valik, mallid, mustandi muutmine, versioonid, kinnitamine, DOCX/PDF eksport, vestluse allikapaneel, RAG riskipoliitika, SourcePackage'i loogika, KOV/Riigi Teataja kiht ja tooalase kasutuse raamistik. Suurimad paranduskohad on spetsialistile nähtavas töövoos: spetsiifilised sotsiaaltoo dokumenditüübid, allikate metaandmete kuvamine, enne kasutamist kontrollimise kiht, andmekaitse/anonüümimise praktiline abi ja lühem kasutusraamistiku seletus.

## Praegune platvormi seis

Tootepohiselt on olemas neli olulist alust.

1. **Dokumendi koostamise töölaud.** `AgentModePage` lubab valida allikdokumendid, malli, väljundi tüübi, sihtgrupi, tooni, keele ja pikkuse; mustandit saab muuta, salvestada, kinnitada ja eksportida.
2. **Dokumenditeek.** `DocumentsPage` lubab faile üles laadida, märkida neid malliks või materjaliks, lubada neid tööreziimis kasutada ja saata valitud failid dokumendi koostamisse.
3. **Allikapõhine vestlus/RAG.** Vestluses on allikate kuvamise paneel, riskipoliitika, legal lookup, SourcePackage ja KOV/Riigi Teataja kihid.
4. **Tööalase kasutuse raamistik.** Kasutajal on raamistik, allalaaditavad dokumendid ja kinnituse kirje.

Oluline piirang: dokumenditüübid on praegu üldised. Agent tunneb tüüpe `MEETING_SUMMARY`, `CASE_BRIEF`, `REPORT_DRAFT`, `CHECKLIST`, `LETTER_DRAFT`, `OTHER`. Uuringus esile tulnud "abivajaduse hinnang", "tegevus- või sekkumisplaan", "otsuse või kooskõlastuse mustand", "kliendile lihtsas keeles selgitus" ja "kontroll enne kasutamist" vajavad eraldi tooteloogikat, mitte ainult vabas vormis juhist.

## Peatükkide kaupa tootetõlge

| Peatükk | Uuringu signaal | Praegune katvus | Parandus platvormis |
| --- | --- | --- | --- |
| 1. Taust ja eesmärk | Vajadus on dokumenteerimine, infootsing ja tööalase kasutuse raam. | Kõik kolm on platvormis olemas, aga eraldi vaadetena. | Seo need üheks spetsialisti töövooks: infootsingust saab mustandi sisend, mustandil on allikad ja kontroll, tööalase kasutuse hoiatus on töövoos nähtav. |
| 2. Vastajate profiil | Kasutajad ei ole ainult KOV sotsiaaltöötajad; vajadus on klienditöö, haldus, juhtimine ja koolitus. | Rollid on üldiselt `SOCIAL_WORKER` ja `CLIENT`; dokumenditüübid on üldised. | Lisa spetsialisti töövaldkonna või kasutusstsenaariumi valik: klienditöö, haldusotsus, teenusekorraldus, koolitus/materjal. Seda ei pea kohe siduma uue rollimudeliga. |
| 3. Koostatavad dokumendid | Kõige sagedasemad on kirjad, hinnangud, juhtumikokkuvõtted ja tegevusplaanid. | Olemas on kiri, juhtumikokkuvõte, aruanne, kontrollnimekiri, kohtumise kokkuvõte. | Lisa prioriteetsed tüübid: abivajaduse hinnang, tegevus-/sekkumisplaan, otsuse/kooskõlastuse mustand, kliendile selgitus, taotlus/avaldus. |
| 4. Ajamahukad etapid | Sõnastamine, kokkuvõtted, vormistus, faktikontroll ja pisivead. | Agent loob ja täpsustab mustandeid; vestluses on infootsing. | Lisa eraldi toimingud: "Sõnasta ametlikumalt", "Tee lihtsamaks", "Lühenda", "Ühtlusta vormistus", "Kontrolli allikaid", "Leia vastuolud ja vead". |
| 5. Olemasolevad sisendid | Kasutaja alustab märkmetest, e-kirjadest, varasemast dokumendist, juhendist, vormist või häälsisendist. | Failide lisamine, dokumenditeek, STT ja kohtumise kokkuvõte on olemas. | Tee sisendi lisamise samm selgemaks: "Lisa märkmed", "Lisa e-kiri", "Lisa varasem dokument", "Lisa vorm/mall", "Lisa häälsisestus". |
| 6. Kontroll sisendmaterjalide üle | Kasutaja tahab ise otsustada, mida AI kasutab. | `agentAllowed`, valitud dokumendid ja allikdokumentide nimekiri on olemas. | Luba dokumendi koostamise töölaual allikaid eemaldada/lisada ilma Dokumentide vaatesse tagasi minemata. Lisa "AI kasutab praegu neid allikaid" kinnitusriba enne käivitust. |
| 7. Mallid ja näidised | Mall on vajalik ametlikel ja korduvatel dokumentidel, aga peab olema paindlik. | Mallid on olemas, kuid sihttüübid on üldised. | Laienda malli tüübid sotsiaalvaldkonna dokumentidele ja lisa "malli vastavuse kontroll". Luba organisatsiooni/KOV malle eristada isiklikest mallidest. |
| 8. Oodatavad tulemused | Esiplaanil hinnang, tegevusplaan, kiri ja juhtumikokkuvõte. | Osa kattub, osa puudub. | MVP prioriteet: abivajaduse hinnang, tegevusplaan, juhtumikokkuvõte, ametlik kiri, kliendile lihtkeelne selgitus. |
| 9. Kontroll enne kasutamist | Kasutaja tahab mustandit ise muuta, üle vaadata, allikaid näha ja kinnitada. | Mustand, käsitsi muutmine, salvestus, kinnitamine ja versioonid on olemas. | Muuda "Kinnita" samm sisulisemaks: enne kinnitamist kuva kontrollnimekiri ja küsi kinnitust, et spetsialist on sisu, allikad ja isikuandmed üle vaadanud. |
| 10. Pärast mustandit | Mustandit parandatakse, kooskõlastatakse, sisestatakse mujale või saadetakse edasi. | Kopeerimine, DOCX/PDF eksport ja salvestatud tulemused on olemas. | Lisa "Kooskõlastuseks" eksport/koopia, muudatuste kokkuvõte ja meta: mustand, mitte lõplik otsus. Integratsioon ametlike süsteemidega jääb hilisemaks. |
| 11. Hea tulemuse kvaliteet | Juriidiline, vormiline, allikapõhine, selge, väärikas, mittesildistav. | Promptides on allikapõhisus, neutraalsus ja piirangud; stiilivalikud on üldised. | Lisa sotsiaaltöö stiilikontroll: väärikus, sildistamise vältimine, kantseliit, lihtkeel, fakt/oletus/soovitus eristus, õigusväite allikavajadus. |
| 12. Vead ja ümbertegemine | Riskid on kirjavead, liiga pikk tekst, õiguslik nüanss, vana dokumendi jääk. | Puudub eraldi "kontrolli mustand" töövoog. | Ehita `CHECK_DRAFT` või eraldi agent action: kontrollib tooni, pikkust, vastuolusid, puuduvaid osi, allikata õigusväiteid, liigseid isikuandmeid ja vana põhja jäänukeid. |
| 13. Ajasäästu olukorrad | Kohtule seisukoht, seaduse lihtkeel, keeruline juhtum, KOV dokumendimaht, statistika, koolitused. | Kiri/juhtumikokkuvõte ja infootsing on olemas; statistikavoog puudub. | Tükelda: MVP-s seaduse lihtkeel ja juhtumi dokumenteerimine; hiljem lahendusvariantide võrdlus, KOV mallipaketid, koolitusmaterjalid ja teenusekorralduse analüüs. |
| 14. Info leidmine | 10/11 näeb infootsingu rolli. | Vestlus/RAG on tugev olemasolev alus. | Tee "Info assistent" spetsialistile nähtavamaks: allikad, allikaliik, kontrollimise kuupäev, mida vastus ei kata, ja nupp "Tee sellest kliendile selgitus" või "Kasuta mustandi sisendina". |
| 15. Otsitava info tüüp | Seadused, juhised, KOV teenused, SKA/Töötukassa/Tervisekassa, tingimused, kontaktid. | KOV ja RT kiht on olemas; riigiasutuste süstemaatiline katvus vajab kaardistust. | Tee teadmuse katvuse maatriks: riiklik õigus, KOV teenused, vormid, kontaktid, SKA, Töötukassa, Tervisekassa, juhised. Iga allikatüüp vajab meta contract'i. |
| 16. Infootsingu kasutusolukorrad | Kehtiv info, tingimused, paragrahv, lahendusvariantide võrdlus, lihtkeel, kontaktid. | Legal lookup, SourcePackage, riskipoliitika ja KOV allikad toetavad seda. | Paranda vastuse formaati kõrge riskiga küsimustes: lühivastus, põhjendus, allikad, allikaliik, kuupäev, paragrahv, piirangud, lihtkeelne versioon. |
| 17. Usaldusväärsus | Allikas, link, kuupäev, allikaliik, õigusakt/paragrahv ja andmekasutuse selgus. | Allikapaneel kuvab põhiliselt nime, lingi ja leheküljed; metaandmed on serveris rikkamad. | Laienda allikapaneeli: allikaliik, kontrollitud/uuendatud kuupäev, staatus, KOV/asutus, sektsioon, paragrahv, tõendusaste. |
| 18. Tööalase kasutuse raamistik | Raamistik on vajalik, aga pikk; vaja lühiversiooni, näiteid ja tehnilisi piire. | Raamistiku leht, allalaadimine ja kinnituse kirje on olemas. | Lisa praktiline lühileht: lubatud/ettevaatlik/keelatud tabel, anonüümimise juhis, organisatsiooni kasutuselevõtu checklist, töövoosisene hoiatus ja riskse sisendi tuvastus. |
| 19. Vajaduse tõestus | Vajadus on olemas, kui eristuvus ei ole lihtsalt tekstigeneraator. | Eristuvuse tehniline alus on olemas: RAG, KOV, SourcePackage, dokumendid, raamistik. | Kommunikatsioon ja UX peavad rõhutama kontrollitavat allikapõhist töövoogu, mitte "AI kirjutab teksti". |
| 20. Arendusprioriteedid | Kontrollitav mustand, allikad, hinnang/tegevusplaan, lihtkeel, kvaliteedikontroll, praktiline raamistik. | Katvus on osaline. | Kasuta seda MVP plaani selgroona. P0: kontrollitav mustand + allikapaneel + kvaliteedikontroll + raamistik lühiversioon. |
| 21. Kommunikatsioon | Sõnumid peavad lubama abi, mitte asendamist. | Tekstides on juba "mustand" ja kontrolli loogika, kuid landing/UX vajab joondamist. | Vaheta kõik tugevad "valmis dokument" toonid kontrollitava mustandi sõnumiks. Väldi "juriidiliselt korrektne" lubadust; kasuta "aitab leida ja kontrollida asjakohaseid õiguslikke aluseid". |
| 22. Kokkuvõte | Kolm põhiväärtust: kontrollitavus, allikapõhisus, töövoopõhisus. | Tehniline alus on olemas, toote fookus vajab teravdamist. | Planeeri järgmine arenduslaine nende kolme väärtuse ümber, mitte funktsioonide juhusliku lisamise ümber. |

## Suurem arendusplaan

### Faas 0: sõnumi ja UX-i korrastus

Eesmärk: teha praegune olemasolev väärtus kasutajale arusaadavaks.

- Muuta tootetekstid läbivalt "kontrollitava mustandi" sõnumile.
- Dokumentide ja dokumendi koostamise vaates tuua esile: sisendid, allikad, mustand, kontroll, kinnitamine.
- Lisada tööalase kasutuse lehele lühikokkuvõte enne pikka dokumenti.
- Koostada organisatsiooni kasutuselevõtu ühe lehe juhis.

### Faas 1: uuringu MVP

Eesmärk: katta kõige sagedasemad ja usaldust loovad kasutuslood.

- Lisa dokumenditüübid: abivajaduse hinnang, tegevus-/sekkumisplaan, kliendile selgitus, otsuse/kooskõlastuse mustand.
- Lisa "Kontrolli mustand enne kasutamist" töövoog.
- Laienda allikapaneeli allikaliigi, kontrollimise kuupäeva, staatuse ja tõendusastmega.
- Lisa enne agenti käivitamist selge "AI kasutab neid allikaid" kinnitusriba.
- Lisa lihtkeele kiirtoiming: "Selgita kliendile arusaadavalt" ja vajadusel "Koosta vene keeles".

### Faas 2: sotsiaaltöö töövoogude süvendamine

Eesmärk: liikuda üldisest agent-reziimist spetsialisti tööriistaks.

- Iga prioriteetse dokumenditüübi jaoks eraldi struktuurijuhis, puuduva info küsimused ja kvaliteedikriteeriumid.
- Juhtumikokkuvõtte, hinnangu ja tegevusplaani puhul erista faktid, spetsialisti hinnang, riskid, vajadused, järgmised sammud ja kontrollimata info.
- Otsuse/kooskõlastuse mustandis erista asjaolud, õiguslik alus, kaalutlus, resolutsioon ja vaidlustamisinfo ainult siis, kui allikas/mall seda toetab.
- Kliendile selgituse töövoos lisa lihtkeel, viisakus, järgmine samm ja "mida see sinu jaoks tähendab" osa.

### Faas 3: teadmuse ja SourcePackage'i laiendamine

Eesmärk: muuta infootsing eristuvaks eeliseks.

- Teha katvuse audit: KOV teenused/toetused, KOV korrad, riiklikud seadused, SKA, Töötukassa, Tervisekassa, vormid, kontaktid, juhised.
- Seada igale allikaliigile meta contract: source type, staatus, last checked, jurisdiction, paragrahv/sektsioon, vormi/kontakti seos.
- Jätkata SourcePackage'i täiendamist teenus + tingimused + vormid + kontaktid + õiguslik alus + tasud + tähtajad mudelina.
- Lisada kõrge riskiga väidetele claim-level kontroll või vähemalt sektsioonipõhine nähtav kontroll.

### Faas 4: organisatsioon ja kasutuselevõtt

Eesmärk: toetada KOV-i või organisatsiooni päris kasutuselevõttu.

- Organisatsiooni haldusvaade: lubatud kasutajad, lubatud töövood, andmekategooriate juhised, KOV/organisatsiooni mallid.
- Töövoosisene andmekaitse: tundlike andmete hoiatus, anonüümimise soovitus, riskse sisendi blokeerimine või ümberkirjutamise pakkumine.
- Raamistiku kõrval praktilised materjalid: lubatud/ettevaatlik/keelatud näited, töötaja juhis, juhi juhis, kasutuselevõtu checklist.
- Audit ja aruandlus: mitte sisu kontrollimiseks, vaid kasutuse, kinnituste, allikate ja tehniliste toimingute tõendamiseks.

## Prioriteedid

### P0

- Allikapaneeli metaandmed: allikaliik, kuupäev, staatus, tõendusaste.
- "Kontrolli enne kasutamist" mustandikontroll.
- Uued peamised dokumenditüübid: abivajaduse hinnang, tegevusplaan, kliendile selgitus.
- Tööalase kasutuse lühiversioon ja näidete tabel.
- Selge sisendite/allikate kinnitusriba dokumendi koostamise alguses.

### P1

- Otsuse/kooskõlastuse mustand.
- Taotluse/avalduse mustand.
- Malli vastavuse kontroll.
- Vene keele spetsialisti- ja kliendivastusena kasutamine.
- Vana dokumendipõhja jääkide kontroll.

### P2

- Lahendusvariantide võrdlus keerulises juhtumis.
- KOV-põhised dokumendipaketid teenuste ja toetuste kaupa.
- Koolitusmaterjalide ja tööjuhiste töövoog.
- Teenusekorralduse/statistika analüüsi eraldi moodul.
- Organisatsiooni haldus- ja kasutuselevõtu vaade.

## Tooteotsused

1. **SotsiaalAI ei peaks lubama lõplikku dokumenti.** Toote põhimõiste on mustand.
2. **Dokumendi koostamine peab jääma allikate ja sisendi kontrolli alla.** Kasutaja peab alati nägema, mida kasutati.
3. **Allikapõhisus peab olema nähtav, mitte ainult tehniline.** Serveris olev meta peab jõudma kasutaja allikapaneeli ja dokumendi töövoogu.
4. **Andmekaitse ei saa olla ainult leping.** Töövoog peab aitama kasutajal aru saada, millal tuleb anonüümida või sisendit vähendada.
5. **Eristuvus tuleb sotsiaalvaldkonna töövoogudest.** Üldine "kirjuta kiri" on nõrk positsioon; tugev positsioon on Eesti sotsiaalvaldkonna allikad, mallid, KOV-info, õigusruum ja väärikas keel.

## Esimene praktiline tööpakett

Kui arendada järgmise sammuna, oleks kõige mõistlikum võtta üks kitsas, kuid väärtuslik tööpakett:

1. laiendada `AgentArtifactType` ja `TemplateFor` väärtusi prioriteetsete sotsiaaltöö dokumenditüüpidega;
2. lisada nendele tüüpidele eraldi struktuurijuhised agendi genereerimises;
3. lisada "Kontrolli enne kasutamist" eraldi artifact/refine action'ina;
4. kuvada tulemuse juures kontrolli leidude plokk;
5. täiendada allikapaneeli metaandmetega, mis on RAG-ist juba kättesaadavad;
6. lisada raamistikule lühiversioon ja lubatud/ettevaatlik/keelatud näidete tabel.

See pakett vastab uuringu kõige korduvamatele mustritele ning kasutab ära platvormi olemasolevat arhitektuuri.
