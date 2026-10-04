# RAG v2 — päris vestluse küsimustik 04.10.2026: täisraport ja parandatud järeldused

04.10.2026. Teostus Claude Opus 5.5. Omanik palus koostada 25 küsimust eri teemadel ja need päris vestluses läbi küsida („tee küsimustik ära, süvaanalüüs tulemustele“; „võid teha küsimusi järjest kui ka ükshaaval“). Esimese kokkuvõtte andsin omanikule vestluses. Codex vaatas selle üle ja leidis, et põhileid on põhjendatud, kuid osa põhjustest oli sõnastatud kindlamalt, kui tõendid lubasid, ning palus talletada jooksu täisraporti. See dokument teeb mõlemat: talletab tõendid ja parandab järeldused.

**Uusi pöördeid selle raporti jaoks ei tehtud.** Kõik allpool on loetud 32 olemasoleva pöörde kirjetest ja lähtefailidest.

## Lühidalt

- **32 pööret, 25 küsimusejuhtu.** 27 pööret viies teemavestluses ja 5 korduspööret eraldi vestlustes. Tervitus, küsimus ja parandus (Q25a–c) on üks juht.
- **Esimeses katses 17 head, 3 osalist ja 5 ebaõnnestunut.** Viiest kordusest puhtas vestluses 3 head, 1 osaline ja 1 ebaõnnestunu. Minu esimene kokkuvõte „22 head 25-st“ oli parim tulemus üle mõlema katse ja hindas kaht vastust leebemalt.
- **Põhjused on nüüd loetud pöördekirjetest, mitte oletatud.** Viis ebaõnnestumist jagunevad kolme eri mehhanismi vahel (jaotis „Mida pöördekirjed ütlevad“).
- **Kulu plaanihindades 0,1656 USD** (1 112 065 sisend- ja 53 090 väljundtokenit). Tegelik arve selgub OpenAI töölaualt.

## Ulatus ja meetod

- **Kus ja millal:** omaniku seanss sotsiaal.pro vestluses, rakenduse brauseripaan, 04.10.2026 kell 09.09–09.28 UTC. Sel päeval teisi pilootpöördeid ei olnud.
- **Seis:** plaan `m4-sotsiaalai-corpus-chat-20261004-064453-…`, korpus v48, otsinguplaan `rag-v2/search-assist-6`.
- **Ülesehitus:** viis vestlust teemade kaupa (omavalitsused Q1–Q8, seadused Q9–Q13, ajakiri Q14–Q19, juhendid Q20–Q24, vestluse käitumine Q25a–c), seejärel viis küsimust uuesti igaüks puhtas vestluses (R3, R5, R6, R7, R13).
- **Iga küsimus on igas kontekstis küsitud üks kord.** See on tähelepanek, mitte mõõtmine: üks katse ei erista konteksti mõju mudeli kõikumisest.
- **Luba ja kulu:** enne jooksu nimetasin umbes 0,2 USD 27 pöörde eest. Tegin 32 pööret; viis kordust tegin omaniku loa „järjest kui ka ükshaaval“ alusel. Etapiti: plaan 0,0073, eelvalik 0,0714, vastus 0,0861 USD; vektorite etapp ümardub nulli.
- **Hinnang** on minu oma: „hea“ tähendab, et vastus kattis küsimuse ja viitas sobivatele allikatele; „osaline“, et oluline osa jäi puudu; „ebaõnnestus“, et küsitud sisu ei tulnud. Sobiv allikas üksi ei tõenda iga vastuses oleva tingimuse või summa õigsust; mis on lähteandmete vastu kontrollitud, on kirjas eraldi jaotises.

## Kus on tõendid

- **Serveris, täielik:** `rag-v2-work/eval-files/live-questionnaire-2026-10-04/turns-full.json` (32 pöördekirjet nii, nagu vestlus need salvestas: küsimus, plaan, päringu tekst, tõendipakett, vastus, etappide tokenid ja ajad; loetav ainult juurkasutajale). Vastustes on omavalitsuse kontaktisikute nimed, seepärast jääb see serverisse.
- **Repos, nimedeta:** [evidence/live-questionnaire-2026-10-04.json](evidence/live-questionnaire-2026-10-04.json): üks rida pöörde kohta (juht, vestlus ja järjekord, pöörde ID, täpne küsimus, plaani inimene, kohad ja päringud, otsingu piirkond ja perioodid, tõendite pealkirjad, viited, vastus, ajad, tokenid, kulu, hinnang ja selle põhjus). Kontaktisikute nimed, telefonid ja e-postid on asendatud; artiklite autorid on bibliograafia ja jäid sisse.

## Tulemused

| Tulemus | Esimene katse (25 juhtu) | Kordus puhtas vestluses (5 juhtu) |
|---|---:|---:|
| hea | 17 | 3 |
| osaline | 3 | 1 |
| ebaõnnestus | 5 | 1 |

Kordused: Q3 → R3 hea, Q5 → R5 hea, Q7 → R7 hea, Q13 → R13 osaline, Q6 → R6 ebaõnnestus.

Veerg „Kataloogi piirkond“ näitab, millise omavalitsuse kirjetest otsiti ja mille alusel: `person_mentioned_region` (inimese elukoht selles sõnumis), `person_region` (inimese varem teada elukoht), `search_plan_region` (plaani nimetatud koht, kui elukohta teada pole).

| Juht | Vestlus/pööre | Pöörde ID | Plaani inimene ja koht | Kataloogi piirkond | Perioodid | Tõendeid / viiteid | Vastuse liik | Esimene tekst / kokku (s) | Kulu (USD) | Hinnang |
|---|---|---|---|---|---|---:|---|---:|---:|---|
| Q1 | ca1748f0 / 1 | `11303f06` | user; anija_vald:lives | anija_vald (person_mentioned_region) | – | 42 / 4 | grounded | 18.2 / 19.5 | 0.0052 | hea |
| Q2 | ca1748f0 / 2 | `a3b1a1da` | ema; kose_vald:lives | kose_vald (person_mentioned_region) | – | 58 / 4 | grounded | 17.1 / 19.4 | 0.0059 | hea |
| Q3 | ca1748f0 / 3 | `e907111f` | user; tartu_vald:other | anija_vald (person_region) | – | 42 / 2 | partial | 17.3 / 18.7 | 0.0063 | ebaõnnestus |
| Q4 | ca1748f0 / 4 | `ede849e0` | user; noo_vald:lives | noo_vald (person_mentioned_region) | – | 44 / 2 | partial | 10.4 / 11.3 | 0.0052 | hea |
| Q5 | ca1748f0 / 5 | `5bbff45a` | user; maardu_linn:other | noo_vald (person_region) | – | 44 / 0 | clarification | 14.2 / 14.7 | 0.0055 | ebaõnnestus |
| Q6 | ca1748f0 / 6 | `7cfe0399` | user; sidumata:unresolved | piirkonda pole (attribution_unresolved) | – | 1 / 1 | partial | 19.2 / 20.9 | 0.0048 | ebaõnnestus |
| Q7 | ca1748f0 / 7 | `5b8efc5a` | user; sidumata:unresolved | piirkonda pole (attribution_unresolved) | – | 0 / 0 | unsupported | 8.8 / 9.3 | 0.0046 | ebaõnnestus |
| Q8 | ca1748f0 / 8 | `16f5e00c` | user; marjamaa_vald:lives | marjamaa_vald (person_mentioned_region) | – | 38 / 3 | partial | 15.4 / 17.9 | 0.0060 | hea |
| Q9 | ebe11481 / 1 | `033a4456` | user; kohta pole | piirkonda pole | – | 6 / 4 | partial | 9.2 / 11.2 | 0.0054 | osaline |
| Q10 | ebe11481 / 2 | `3b9ba308` | abivajav laps; kohta pole | piirkonda pole | – | 8 / 2 | grounded | 9.8 / 10.7 | 0.0047 | hea |
| Q11 | ebe11481 / 3 | `59cdabf7` | user; kohta pole | piirkonda pole | – | 12 / 3 | partial | 12.1 / 13.1 | 0.0057 | hea |
| Q12 | ebe11481 / 4 | `0fd73800` | user; kohta pole | piirkonda pole | – | 15 / 1 | partial | 15.8 / 17.2 | 0.0060 | osaline |
| Q13 | ebe11481 / 5 | `9c1c6592` | user; kohta pole | piirkonda pole | – | 12 / 0 | unsupported | 11.0 / 11.4 | 0.0053 | ebaõnnestus |
| Q14 | 21dc5344 / 1 | `659e8289` | unclear; kohta pole | piirkonda pole | – | 8 / 7 | partial | 11.5 / 13.8 | 0.0050 | hea |
| Q15 | 21dc5344 / 2 | `e6633949` | user; kohta pole | piirkonda pole | – | 6 / 4 | partial | 15.1 / 18.9 | 0.0050 | hea |
| Q16 | 21dc5344 / 3 | `5e8e5a6e` | user; kohta pole | piirkonda pole | – | 8 / 5 | partial | 11.1 / 13.2 | 0.0046 | hea |
| Q17 | 21dc5344 / 4 | `4792aa76` | unclear; kohta pole | piirkonda pole | – | 9 / 6 | grounded | 13.5 / 15.8 | 0.0050 | hea |
| Q18 | 21dc5344 / 5 | `d105e62b` | valla sotsiaaltöötajad; kohta pole | piirkonda pole | – | 9 / 2 | partial | 11.2 / 13.5 | 0.0049 | hea |
| Q19 | 21dc5344 / 6 | `5294403a` | user; kohta pole | piirkonda pole | – | 4 / 3 | grounded | 8.6 / 10.0 | 0.0041 | hea |
| Q20 | c5ece885 / 1 | `24f169cc` | user; kohta pole | piirkonda pole | – | 6 / 6 | grounded | 12.9 / 14.7 | 0.0044 | hea |
| Q21 | c5ece885 / 2 | `30a64482` | laps; kohta pole | piirkonda pole | – | 6 / 4 | grounded | 10.3 / 11.8 | 0.0045 | hea |
| Q22 | c5ece885 / 3 | `b65189a8` | puudega laps; kohta pole | piirkonda pole | – | 9 / 5 | partial | 14.3 / 16.6 | 0.0055 | hea |
| Q23 | c5ece885 / 4 | `fb5252d0` | abivajav laps; kohta pole | piirkonda pole | – | 9 / 6 | grounded | 12.6 / 14.8 | 0.0050 | hea |
| Q24 | c5ece885 / 5 | `6f8dd2c3` | user; kohta pole | piirkonda pole | – | 9 / 6 | partial | 12.3 / 14.5 | 0.0042 | hea |
| Q25a | 10c9bb0a / 1 | `54a82d27` | –; kohta pole | piirkonda pole | – | 0 / 0 | clarification | 1.3 / 1.6 | 0.0010 | hea |
| Q25b | 10c9bb0a / 2 | `e137b6f1` | isa; harku_vald:lives | harku_vald (person_mentioned_region) | – | 57 / 4 | partial | 22.1 / 28.2 | 0.0074 | osaline |
| Q25c | 10c9bb0a / 3 | `30afc7f4` | isa; kohta pole | harku_vald (person_region) | – | 58 / 2 | partial | 15.3 / 16.9 | 0.0074 | hea |
| R3 | 2874c256 / 1 | `f1728663` | user; tartu_vald:other | tartu_vald (search_plan_region) | – | 50 / 4 | grounded | 15.5 / 17.0 | 0.0057 | hea |
| R5 | 4200f584 / 1 | `f19a014d` | user; maardu_linn:other | maardu_linn (search_plan_region) | – | 57 / 5 | grounded | 11.0 / 12.2 | 0.0049 | hea |
| R6 | 299ae4ae / 1 | `4969e5b6` | user; pohja_sakala_vald:other | pohja_sakala_vald (search_plan_region) | – | 45 / 0 | unsupported | 11.7 / 12.4 | 0.0045 | ebaõnnestus |
| R7 | 2ee9c8e0 / 1 | `6ba5c5e9` | user; harku_vald:other | harku_vald (search_plan_region) | – | 51 / 1 | grounded | 8.4 / 9.0 | 0.0054 | hea |
| R13 | 4123f1db / 1 | `141f8100` | unclear; kohta pole | piirkonda pole | – | 5 / 3 | partial | 22.7 / 25.7 | 0.0062 | osaline |

## Mida pöördekirjed ütlevad

### 1. Teise omavalitsuse küsimus jäi inimese elukoha valda (Q3, Q5)

- **Plaan luges küsimuse õigesti.** Q3 päringud olid „Tartu valla sotsiaaltransporditeenus taotlemine tingimused“ ja „Tartu vald sotsiaaltransporditeenuse hind …“, koht `tartu_vald` seosega `other`. Q5 puhul samamoodi `maardu_linn`, `other`.
- **Kataloog otsis siiski elukoha vallast:** Q3 `person_region` = Anija (kasutaja ütles Q1-s „elan Anija vallas“), Q5 `person_region` = Nõo (Q4).
- **Puhtas vestluses** (R3, R5) oli sama plaan ja kataloogi piirkond `search_plan_region` = küsitud vald; vastus tuli õigesti.
- See kinnitab Codexi sondiga leitud koodiraja nende kahe pöörde kohta: kui inimese piirkond on teada, ei kasutata teise valla nime allikapiirkonnana, kuigi plaan selle ära tundis.

### 2. Koht jäi plaanis sidumata (Q6, Q7)

- Samas pikas vestluses andis plaan Q6 ja Q7 kohta `relation: unresolved`, põhjus `place_not_attributed`. Kataloogi olek oli `region_required`, piirkonda ei valitud.
- Q7 sai 0 tõendit ja vastus oli „unsupported“. Puhtas vestluses (R7) oli koht `harku_vald`, `other`, piirkond `search_plan_region` ja vastus andis vormi lingi.
- See on teine mehhanism kui punktis 1: siin ei jõudnud vald plaanist kaugemale. Miks mudel pikas vestluses kohta ei sidunud, kirjest ei selgu.

### 3. Plaan avas varasemad küsimused uuesti (Q12, Q13)

- Seaduste vestluse neljandas ja viiendas pöördes kirjutas plaan päringud ka varasemate, juba vastatud küsimuste kohta. Q13 („Kas hooldekodu kohatasu võib nõuda lastelt?“) päringud olid: „toimetulekupiir toimetulekutoetuse arvutamine“, „abivajavast lapsest teatamise kohustus eestkoste toetatud otsustamine“, „täisealise puude raskusastme tuvastamine hooldekodu kohatasu ülalpidamiskohustus lastel“.
- Q13 tõendid (12) olid peamiselt varasemate teemade omad: sotsiaalhoolekande seadus 8, abivajavast lapsest teatamise juhend, eestkoste artikkel, lastekaitseseadus, perekonnaseadus. Vastus oli „unsupported“.
- Puhtas vestluses (R13) olid päringud ainult hooldekodu kohatasu ja ülalpidamiskohustuse kohta, tõendeid 5 ja vastus osaline.
- **Minu esimene seletus oli vale:** kirjutasin, et Q13 rikkus eelmise vastuse täpsustav küsimus. Kirje näitab, et plaan otsis varasemaid teemasid.
- Lisaks: põhiotsingu päringutekst sisaldas varasemaid kasutajasõnumeid kõigis 22 hilisemas pöördes (`buildDialogueQuery`); see on kavandatud käitumine ja võib mõjuda koos plaaniga.

### 4. Kuupäevast ei tekkinud perioodi (Q6, R6)

- Küsimus oli „… alates 6. oktoobrist“ (aastata, sõnaga). Mõlemas pöördes on `legal_periods` tühi ja kehtivuse aluskuupäev 04.10.2026.
- R6-s oli piirkond õige (Põhja-Sakala), aga teadmiste rada ei valinud ühtki lõiku; tõendites olid ainult valla toetuste kirjed.
- **Minu esimene seletus oli liiga lai:** kirjutasin, et tulevast redaktsiooni enne jõustumist ei pakuta. Codexi sond näitab, et kuupäev kujul „06.10.2026“ lisab perioodi ja lubab mõlemad redaktsioonid. Mõlemad on indeksis (kuni 05.10 ja alates 06.10).
- Kontrollimata: kas perioodi olemasolul vastus muudatuse ka leiaks ja kahte redaktsiooni võrdleks.

### 5. Toimetulekupiiri summa (Q9, Q25b)

- **Summa on lähteandmetes olemas.** 78 omavalitsuse lähtefailist 48 sisaldavad toimetulekutoetuse kirjes 2026. aasta summasid 220, 176 ja 264 eurot, sh Anija ja Harku.
- **Q9** (üldine küsimus, valda ei nimetatud): piirkonda ei valitud, valdade kirjeid ei loetud; kuues tõendis (kõik sotsiaalhoolekande seadusest) summat ei olnud.
- **Q25b** (isa Harku vallas): Harku toimetulekutoetuse kirje koos summadega oli tõendites ja vastus viitas sellele, aga ütles: „Siin esitatud õigusakt ei anna kehtiva toimetulekupiiri konkreetset summat.“ Summa jäi kasutamata vastuse etapis.
- **Minu esimene väide „summa puudub korpusest“ oli vale.** Üleriigiline määr jõuab praegu vastusesse ainult valla kirjelduse kaudu ja ka siis mitte kindlalt.

### 6. Kaks seadust on eri juhtumid

- **Puuetega inimeste sotsiaaltoetuste seadust** indeksi aktide nimekirjas (520 akti) ei ole. Q12 vastas 2026. aasta ajakirjaartikli põhjal. See on allikakatvuse puudus.
- **Perekonnaseadus** on indeksis. Q13 tõendites oli sellest üks lõik, R13 viidetes mitte ühtki; vastus ütles ise, et laste kohustuse alus jäi kinnitamata. See vajab otsingu ja lõiguvaliku kontrolli.

## Mis on lähteandmete vastu kontrollitud

- **Anija ja Kose kontakt** (Q1, Q2): registririda on 04.10 kontrollis kinnitatud; telefon ja Kose puhul ka e-post klapivad vastusega.
- **Nõo** (Q4): vana vale numbriga kontakti vastus ei andnud.
- **Märjamaa sünnitoetus** (Q8): 500 + 300 eurot klapib valla lähtefailiga.
- **Maardu kord** (R5): viidatud akt kehtib 04.10.2026-st; 03.10 lõppenud redaktsiooni indeks ei paku.

Kontrollimata: ajakirja- ja juhendivastuste sisu lähtetekstide vastu (kontrollitud on ainult, et viidatud allikad on pealkirja järgi asjakohased), Tartu valla hinnad (R3), seaduste vastuste üksikud väited.

## Kiirus

Serveri enda etapiaegade järgi, 31 täispööret: esimene tekst mediaan 12,6 s (8,4–22,7 s), vastus valmis mediaan 14,7 s (9,0–28,2 s). Tervitus: esimene tekst 1,3 s, valmis 1,6 s. Üks katse pöörde kohta.

## Mida see raport ei tõenda

- Et kontekst on ebaõnnestumiste ainus põhjus: neli küsimust õnnestusid puhtas vestluses, aga kummaski olukorras on üks katse.
- Vigade kordumise sagedust.
- Tegelikku arvet.

## Järgmised sammud (Codexi järjekorras)

1. ~~Talletada jooksu tõendid ja parandada järeldused.~~ See dokument.
2. **Eristada küsimuse allikapiirkond inimese elukohast**, kohalike regressioonikontrollidega. Maardu kohta küsimine ei tähenda sinna kolimist ega tohi elukohta üle kirjutada; iga mainitud vald ei saa ka automaatselt võita („elan Nõos, töötan Maardus“). Tasuline jooks ei ole alustamise eeltingimus.
3. Aastata kuupäeva lugemine; üleriigilise määra allikas, mis ei sõltu valla kirjeldusest; puuduva seaduse lisamine eraldi olemasoleva seaduse otsingu kontrollist. Siia kuulub ka punkt 3 ülal: plaan ei peaks juba vastatud küsimusi uuesti otsima.
4. Kontaktide uus eksport ja indeks on eraldi avaldamistöö oma hinnangu ja loaga. Registri 860 kinnitatud rida ei ole vestluse kontaktide arv: vestluses on avaldatud 376, neist oli 04.10 lubatud 369.
