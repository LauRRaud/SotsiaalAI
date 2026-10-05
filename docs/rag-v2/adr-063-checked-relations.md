# ADR-063 — M3: kontrollitud seosed (mõõtmissamm)

01.10.2026, mõõtmissamm lõpetatud. Teostus Claude Opus 5.5. Omanik 01.10: „m3. M5 tuleb kunagi hiljem“. Järgib [ADR-054](adr-054-semantic-graph-pilot.md) (teadmiskaardid), [ADR-057](adr-057-graph-experiment.md) (akti enda viited, profiil v3) ja [ADR-062](adr-062-provision-dates.md) (sätte kuupäevad).

## Küsimus

Teekaardi M3 küsib kahte asja eraldi:

1. Kas seoste kasutamine toob otsustava tingimuse või erandi tõendite hulka, kui seosed on õiged?
2. Kas seoste automaatne eraldamine on piisavalt täpne?

See samm on mõõtmine. Vestlus, indeks ja profiil ei muutu.

## Kavand

Kavand valiti 01.10 kolme sõltumatu ettepaneku seast (kolmest hindajast kaks eelistasid kontrollitud seoseid). Täiskavand sammude, lävendite ja hindadega: [m3-next-step-plan-2026-10-01.json](../audits/evidence/m3-next-step-plan-2026-10-01.json).

## Tehtud (sammud 1–4, tasuta)

### 1. Lähteseis

- Serveris on aktiivne ainult korpus v47 (`search_generation_34fe1590…`, lugeja `source-structure-v30`). Generatsioonid v42–v46 kustutati 01.10 omaniku loal.
- 30.09 katse väljundid küsimuste kaupa on tõendina repos: [graph-hard-1](../audits/evidence/graph-hard-1-2026-09-30.json) ja [graph-hard-2](../audits/evidence/graph-hard-2-2026-09-30.json) (generatsioon `4b050698`, kuupäev 15.10.2026).
  - Kataloog 1: alus 3/9, rohkem teksti 4/9, kaardid 5/9, akti viited 7/9, naabrid 3/9.
  - Kataloog 2: kõik harud 5/6; `coach-reports-child` ei leidnud ükski.
- Küsimuste vektorid (`vectors.json`) on serveris alles ja korduvkasutatavad.

### 2. Viidete kuldkomplekt aktist, ilma mudelita

`scripts/rag-v2-relation-gold.mjs` loeb seitse 15.10.2026 kehtivat akti registrist ajutisse hoidlasse ja kirjutab `tests/evaluation/graph/relation-gold-1.json`.

- **Säte** on paragrahvi nummerdatud lõige; lõigeteta paragrahv on üks säte. Iga sätte juures on lõik (`passage`), kus see indeksis algab.
- **Viited:**
  - `other_section`: teisele paragrahvile, olemasoleva lugeja järgi (`readReferences`); lõike number tuleb viite sõnadest („§ 45⁹ lõikes 2“).
  - `own_section`: sama paragrahvi lõikele („käesoleva paragrahvi lõikes 2“). Seda praegune lugeja ei loe.
  - `other_act`: nimetatud teisele aktile. Akt lahendatakse ainult siis, kui see on nende seitsme seas.
- Iga viite juures: kas lause sisaldab erandi sõnastust („välja arvatud“, „erandina“, „ei kohaldata“ jt), kas siht on teises lõigus ja kas siht on paragrahvi esimeses lõigus. Otsing lisab praegu ainult viidatud paragrahvi esimese lõigu.
- **Keelavad sätted** (`denials`): „ei määrata“, „ei maksta“, „ei ole õigust“ jt, millele ükski viide ei osuta ja millest ükski ei lähtu.
- **Lugeja aruanne:** iga §-märk on kas lahendatud viide, teise akti loend või nimetatud põhjusega lahendamata.

| Akt | Sätteid | Viiteid teisele paragrahvile | neist väljaspool esimest lõiku | Oma paragrahvi viiteid teise lõiku | Teise akti viiteid (lahendatud) | Keelavaid sätteid ilma viiteta | Kaardiseosega kaetud lõiguüleseid viiteid |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sotsiaalhoolekande seadus (`130062026065`) | 855 | 278 | 24 | 44 | 88 (20) | 17 | 13 / 322 |
| Haldusmenetluse seadus (`106072023031`) | 324 | 24 | 0 | 0 | 0 | 9 | 0 / 24 |
| Sotsiaalseadustiku üldosa seadus (`130062026031`) | 120 | 9 | 0 | 0 | 4 (0) | 2 | – |
| Lastekaitseseadus (`111072026042`) | 155 | 53 | 4 | 16 | 15 (1) | 0 | – |
| Perekonnaseadus (`107052025017`) | 594 | 93 | 0 | 0 | 9 (0) | 39 | – |
| Abivahendite määrus (`126092026005`) | 33 | 3 | 1 | 0 | 4 (2) | 0 | 1 / 3 |
| Harku abi andmise kord (`404072025017`) | 288 | 10 | 1 | 2 | 18 (5) | 4 | 0 / 12 |

- **Täpsustus 05.10.2026 ([ADR-090](adr-090-link-targets-out-of-text.md)):** tabeli arvud on loetud lugejaga v30. Lugeja v31 jätab lingi sihtkoha tekstist välja; sotsiaalhoolekande seadusel on seetõttu üks lõik vähem ja „väljaspool esimest lõiku“ on 22 (oli 24). Teised arvud ja teised aktid ei muutunud; kuldkomplekti fail on uuesti loetud.
- **Mudeli kaardid katavad viidetest väikese osa:** SHS-is 13 lõiguülest viidet 322-st (4%). Viide on tekstis olemas ja loetav ilma mudelita.
- **30 viidet lähevad lõikele, mis ei ole paragrahvi esimeses lõigus.** Need jäävad praeguse otsinguga leidmata, kuigi viide on lahendatud. Näide: SHS § 131 viitab § 133 lõigetele 5 ja 6.
- **62 oma paragrahvi viidet lähevad teise lõiku** ja 138 viidet nimetavad teist akti. Kumbagi praegune otsing ei kasuta.
- Test `tests/rag-v2-relation-gold.test.mjs` hoiab SHS-i arve ja kontrollib, et repos olev fail on see, mille skript annab.

### 3. Käsitsi kontroll

**60 viidet** kindla valimi järgi ([relation-gold-1-checked.json](../../tests/evaluation/graph/relation-gold-1-checked.json)). Lävend: 0 vale sihiga.

- Tulemus: **60 õiget, 0 valet.**
- Leiud:
  - Lõigete vahemikust („lõigetes 2–4“) võttis skript ainult otsad. Parandatud: tavaline vahemik nimetab iga lõike; ülaindeksiga otsaga vahemik („2–4²“) jääb otsteks.
  - Muutmissätted (SHS §§ 161–189) tsiteerivad teiste sätete teksti, seega nende viited kordavad nende sätete oma (22 viidet).
  - Rakendussäte võib nimetada lõikeid enne hilisemat ümbersõnastamist kehtinud numbritega (SHS § 160 lg 40 ja § 13¹).

**76 lõiguülest kaardiseost** nelja kehtiva akti kaardifailist ([card-relations-1-checked.json](../../tests/evaluation/graph/card-relations-1-checked.json)). Lävend: kõige rohkem 3 valet ja mitte ühtegi ümberpööratud erandit.

- Tulemus kahe lugeja järel: **52 õiget, 24 valet** (15 vale siht, 6 vale liik, 3 vale suund). Ümberpööratud erandeid 0.
- Liigi kaupa: `REQUIRES` 10 valet 32-st, `EXCEPTION_TO` 7/14, `QUALIFIES` 5/21, `DESCRIBES` 2/2, `DEFINES` 0/7.
- Näited: „teenust ei tohi osutada isik, kes…“ on märgitud erandiks haldusakti koostamise sättele; SHS § 56 lg 1 tingimus on seotud abivahendi lepinguga (§ 54), kuigi säte nimetab § 65 lepingut.
- **Lävend ei ole täidetud.** Mudeli tehtud tüübitud seost ei näidata mudelile tüübitud seosena.
- **Teine lugeja (Codex, 01.10, [raport](../audits/rag-v2-pr289-299-review-2026-10-01.md)):** luges kõik 75 rida uuesti, esimese lugeja hinnanguid nähes. Viis õigeks märgitud seost on valed (read 38, 39, 45, 71, 72); ülejäänud 70 hinnanguga nõustus. Esimene lugeja luges need viis sätet uuesti ja nõustub. Esimene hinnang (55 õiget, 20 valet) on failis iga muudetud rea juures alles.
  - Näited: Harku § 27 lg 7 ja 8 on eraldi alused lõike 2 kulude katmiseks, mitte lõike 3 madala sissetuleku hüvitise täpsustused; HMS § 58 piirab kehtetuks tunnistamise nõuet, aga ei tee akti § 54 mõttes õiguspäraseks.
- **Valim parandatud:** esimene valik võttis kaardi asukohaks lõigu, kus selle säte algab. Pikk lõige jätkub aga järgmises lõigus. Nüüd loeb kaardi ankru tegelik lõik (`cardRelationPopulation`): üks rida langes välja (mõlemad kaardid samas lõigus) ja kaks abivahendite määruse seost tulid juurde (mõlemad õiged). Algsel 75 real oli tulemus 50 õiget ja 25 valet.
- Test kontrollib, et faili read on täpselt see üldkogum ja et tulemus on ridade loendus.

### 4. Kolmas raske kataloog, lukus enne seoste faili

`tests/evaluation/graph/hard-conditions-3.json` ja selle vestluse kaksik `tests/evaluation/dialogue/scenarios-hard-conditions-3.json`. Kirjutatud 01.10.2026 enne ühtegi jooksu ja enne seoste faili.

- **15 küsimust kujude kaupa**, mida kaks esimest kataloogi ei kata:

| Kuju | Küsimusi | Näide |
|---|---:|---|
| Otsustav lõige väljaspool paragrahvi esimest lõiku | 2 | eluasemelaen toimetulekutoetuse arvestamisel (SHS § 131 lg 2 → § 133 lg 5) |
| Hilisem lõige viitab oma paragrahvi varasemale | 2 | sel kuul 25-aastaseks saav üliõpilane (§ 131 lg 10 → lg 8) |
| Otsustav säte nimetab teemaparagrahvi mujalt | 2 | teenuse lõpetamine sõjaseisukorra ajal (§ 13² lg 3 → § 80 lg 1 p 1) |
| Teine akt | 3 | pensionäritoetus ja õppiv laps (SHS § 139¹ lg 4 → PKS § 97); lapse abivajadus (SHS § 59 → LasteKS § 28); Harku kord → SHS § 25 lg 2 (piirkonnaga) |
| Erand, mis ei nimeta midagi | 2 | eestkostetav vend pere koosseisus (§ 131 lg 12); varasem võlg eluasemekuluna (§ 133 lg 7) |
| Mõiste | 1 | ühise majapidamisega sõbrad (§ 131 lg 7 p 3) |
| Rakendussäte | 1 | Kuusalu piirmäärade algus (§ 5 lg 1, piirkonnaga) |
| Kontroll | 2 | üks, mille alusotsing peab leidma; üks, kus erand on olemas, aga ei kohaldu |

- Päringud on sellised, nagu otsinguplaan kirjutaks, ega nimeta otsustavat paragrahvi. Iga fraas on kontrollitud selle akti lõigust, mis kehtib 15.10.2026.
- Üks fraas ei ole ühene: Harku küsimuse fraas seisab SHS-is nii § 25 lg 2 (tugiisik) kui ka § 29 lg 2 (isiklik abistaja) all.
- **Mustrite test:** iga `must` ja `must_not` on testitud kirjutatud õige ja vastupidise vastuse peal (`tests/rag-v2-conversation-eval.test.mjs`). ADR-057-s lükkasid mustrid neli õiget vastust tagasi ja lasid ühe vale läbi.
- **Lukk:** kataloogi git-objekti räsi on `7b94a63a6b2e15c608ee405666803a4d92260afa`, kaksiku oma `7839df66ddd4aeea3eeabaab49b5d3f3e3a55942`. Seoste fail (samm 5) kirjutatakse pärast seda.
- Kataloogi kirjutamisel leitud viga kuldkomplektis: teise akti nimi võeti kogu lausest, mitte vahetult loendi eest („nakkushaiguste ennetamise ja tõrje seaduse § 13“ läks perekonnaseaduseks). Parandatud; lahendatud viiteid on 28, mitte 40.

## Vaheotsus

- **Viide tekstist on usaldusväärne, mudeli seos ei ole.** 60 viitest 60 õiged; 76 kaardiseosest 24 valed.
- Järgmine samm mõõdab, kas tekstist loetud viited (teise lõiku, oma paragrahvi lõikele, sissetulevad viited, nimetatud teine akt) toovad otsustava sätte tõenditesse seal, kus praegune otsing selle kaotab.

## Tehtud (sammud 5–10)

### Kõrvalekalle kavandist

Kavand nägi ette kuni 40 käsitsi kontrollitavat seost eraldi failis ja harud F ja G. Seda ei tehtud, sest sammud 2–3 näitasid lihtsamat teed:

- Mudeli tüübitud seos kukkus käsitsi kontrollis läbi (24 valet 76-st), seega seda mudelile ei näidata.
- Akti enda viited on loetavad ilma mudelita ja kontrollis õiged (60/60). Neid saab katses järgida otse kuldkomplekti lugejaga.
- Seoste faili asemel on katseskriptis kaks simuleeritud haru. Käsitsi kirjutatud seoseid ei ole, seega omanikule ülevaatuseks lehte ei tekkinud.
- Mudeliga eraldamise jooksu (samm 9) ei tehtud. Eraldamise täpsuse vastus on sammudes 2–3: kaardid katavad SHS-i 322 lõiguülesest viitest 13 ja neljandik kontrollitud kaardiseostest on valed.

### Katseskripti uued harud

`scripts/rag-v2-graph-experiment.mjs`, skeem `rag-v2/graph-experiment-2`:

| Haru | Mis see on |
|---|---|
| L | päris vestluse profiil `hybrid-estnltk-chat-v3` |
| V | `hybrid-estnltk-chat-v1` (v3 ilma akti viideteta); R ja S lähtekoht |
| S | V + tänane reegel (viidatud paragrahvi esimene lõik), simuleeritud. Kontroll: peab andma sama tulemuse kui L |
| R | V + akti enda viidete järgimine, simuleeritud |

Haru R lisab V leitud lõikudele kuni 4 lõiku ja 3000 tokenit (sama ruum mis kaartide harul C), selles järjekorras:

1. viide teisele paragrahvile: täpne lõige, kui viide seda nimetab, muidu paragrahvi esimene lõik;
2. viide oma paragrahvi teisele lõikele;
3. sissetulev viide: säte, mis nimetab leitud sätet;
4. nimetatud teine akt: selle akti 15.10.2026 kehtiva redaktsiooni nimetatud paragrahv ja lõige.

Iga liigi sees tulevad erandi sõnastusega viited enne. Küsimuse `region` rakendab valla piirangu nagu vestlus. Test `tests/rag-v2-relation-gold.test.mjs` kontrollib reegleid SHS-i ja PKS-i peal.

### Otsingukatse kolmandal kataloogil

Server, korpus v47, kuupäev 15.10.2026, ilma vastuseta ja ilma rerank'ita. 45 teksti vektoriteks: 1380 tokenit, alla 0,001 USD. Väljund küsimuste kaupa: [graph-hard-3-2026-10-01.json](../audits/evidence/graph-hard-3-2026-10-01.json).

| Haru | Leidis otsustava fraasi (15-st) | Kontrollideta (13-st) | Keskmine kontekst (tokenit) |
|---|---:|---:|---:|
| A alus | 12 | 10 | 6775 |
| B rohkem teksti | 13 | 11 | 9564 |
| C kaardid | 12 | 10 | 9025 |
| D akti viited | 12 | 10 | 7514 |
| E naabrid | 12 | 10 | 9557 |
| L päris profiil v3 | 12 | 10 | 8752 |
| V profiil v1 | 12 | 10 | 7986 |
| S tänane reegel (simuleeritud) | 12 | 10 | 8621 |
| **R viidete järgimine (simuleeritud)** | **14** | **12** | 10 071 |

- **Simulatsiooni kontroll:** S ja L leiavad otsustava fraasi samades küsimustes (15/15). See võrdleb ainult leidmist, mitte lõike: S lisas kokku 14 lõiku, L 23 (L-is on ka kaartide lisandused). S on katvuse kontroll, mitte tõend, et simulatsioon kordab päris rada.
- **Akti sees ei kaota otsing midagi.** Kõik 12 akti sisest küsimust leiab juba alusotsing: lõige väljaspool esimest lõiku, oma paragrahvi hilisem lõige, sissetulev viide, nimetamata erand, mõiste, rakendussäte ja mõlemad kontrollid.
- **Vahe on ainult kujus „teine akt“.** Kolmest küsimusest ei leia päris profiil ühtegi.

| Küsimus | L | R | Kuidas R leidis |
|---|---|---|---|
| Pensionäritoetus ja õppiv laps (SHS § 139¹ lg 4 → PKS § 97) | ei | jah | nimetatud teine akt; 10 kandidaadist neljas ehk viimane, mis ruumi mahtus |
| Harku tugiisik (kord § 15 lg 3 → SHS § 25 lg 2) | ei | jah | nimetatud teine akt, ainus kandidaat |
| Lapse abivajadus (SHS § 59 → LasteKS § 28) | ei | ei | viitav säte ise ei olnud leitud lõikude seas |

- **R hind:** 47 lisatud lõiku 15 küsimuses, neist 2 tõid kataloogi otsustava fraasi, mida enne ei olnud; kontekst kasvab V-ga võrreldes 2085 ja D-ga võrreldes 2557 tokenit küsimuse kohta.
- Liigi „nimetatud teine akt“ lisandusi oli kokku 3, neist 2 otsustavad.

### Kavandi lävendite vastu

| Lävend | Tulemus |
|---|---|
| Varajane peatus: L leiab vähemalt 11 kontrollideta küsimust 13-st | ei täitunud (10) |
| H1: uus haru leiab vähemalt 10 ja vähemalt 4 rohkem kui D | 12, aga ainult 2 rohkem kui D |
| H3: vähemalt kaks kolmandikku võidust tuleb tekstist loetud viidetest | jah, 2 kahest (mõlemad „nimetatud teine akt“) |
| Tootekasutuse piir: lisatud lõikudest kuni veerand otsustavast sättest väljas | ei (45 lõiku 47-st) |
| Tootekasutuse piir: kontekst kuni 800 tokenit üle D | ei (+2557) |

### Kolm teise akti küsimust päris vestluses

Tootmise plaan (profiil v3, dialoog 22), üks jooks, 3 pööret, 0,0165 USD plaani hindade järgi.

| Küsimus | Tulemus | Vastus käsitsi loetuna |
|---|---|---|
| Pensionäritoetus ja õppiv laps | läbis | Õige: kuni 21-aastane õppiv laps ei välista toetust; viitab SHS-ile ja PKS-ile. |
| Lapse abivajadus | läbis | Õige: hindab lastekaitsetöötaja või lapsega töötav isik; viitab LasteKS-ile ja SHS-ile. |
| Harku tugiisik | otsing | Ütleb, et teenust ei tohi osutada SHS § 25 lõikes 2 nimetatud isik, annab valla kontakti ja lisab ausalt, et § 25 lõike 2 sisu ei ole tõendites. Vanaema kohta jääb vastus andmata. |

- Vestlus leiab PKS-i ja LasteKS-i ise, sest otsinguplaan kirjutab mitu päringut. Ühe päringuga otsingukatse näitab seda vahet suuremana, kui see vestluses on.
- Päris vahe on üks kuju: **valla määrus nimetab SHS-i sätet ja selle sätte tekst ei jõua tõenditesse.** Harku korras on 18 teise akti viidet.
- Ühtegi valet vastust ei olnud. H4 lävend (vestlus vastab juba 80%-le) ei täitunud: R-i võidetud kahest küsimusest vastab vestlus ühele.

## Otsus

1. **Kontrollitud kaartide teed ei minda.** Mudeli tüübitud seosed ei läbi käsitsi kontrolli ja akti sees leiab otsing otsustava sätte ilma nendeta.
2. **Üldist viidete järgimist (haru R tervikuna) ei ehitata.** 47 lisatud lõigust tõid puuduva otsustava fraasi 2 ja kontekst kasvab 2500 tokenit.
3. **Viidete lugejat täiendatakse ühe reegliga:** kui leitud säte nimetab teist akti ja täpset paragrahvi, lisab otsing selle akti küsimuse kuupäeval kehtiva redaktsiooni nimetatud lõike. Esimesena valla määrus → SHS.
   - Eraldi PR, mis muudab otsinguprofiili. Mõõdetakse enne ühendamist kolme teise akti küsimusega (umbes 0,02 USD) ja ühe jooksuga väikseimast kataloogist.
   - Lävend: Harku küsimus läbib, kaks ülejäänut jäävad läbima, kontekst kasvab keskmiselt alla 800 tokeni.
   - **Tehtud 01.10: [ADR-064](adr-064-named-other-act.md), profiil v4.** Otsingukatses 28 küsimust 30-st (v3: 26), midagi ei kadunud; Harku küsimus läbib vestluses.
4. Kavandi järgmise sammu suurem jooksukomplekt (umbes 0,40 USD) ei ole selle otsuse jaoks vajalik ja jääb tegemata, kuni omanik seda ei küsi.

Selle sammu tasuline kulu kokku: alla 0,02 USD plaani hindade järgi (eelarve oli 0,10 USD).

## Piirid

- Kuldkomplekt loeb ainult viiteid, mille akt ise sõnades teeb. Tingimus, millele ükski viide ei osuta (71 keelavat sätet), jääb sellest välja; need on kontrollitud seoste ja kolmanda kataloogi töö.
- Teise akti viide lahendatakse ainult seitsme akti piires (28 viidet 138-st) ja ainult siis, kui akti nimi seisab vahetult loendi ees.
- Kolmandas kataloogis on 15 küsimust, neist 3 teise akti kohta; iga jooks tehti üks kord. Üks küsimus vestluses on kitsas alus, seepärast mõõdetakse reegel enne ühendamist uuesti.
- Haru R on simulatsioon profiili v1 leitud lõikudest ilma rerank'ita; vestluses valib lõigud rerank.
- „2 otsustavat 47-st“ loeb ainult kataloogi sihtfraase. Ülejäänud 45 lõigu sisulist asjakohasust ei ole keegi hinnanud, seega ei ole see lisanduste täpsuse mõõt.
- Sätte lõik on kuldkomplektis lõik, kus säte algab. Pikk lõige jätkub järgmises lõigus (abivahendite määruse § 7 lg 7). Järgmine reegel peab tooma lõigu, kus nimetatud lõike tekst tegelikult on.
- Kaardiseoseid hindas kaks lugejat, kuid teine nägi esimese hinnanguid; see ei ole pimekatse.
- Nimetamata tingimusi (71 keelavat sätet ilma viiteta) seostega ei mõõdetud. Kataloogi kaks sellist küsimust leidis alusotsing.
- SHS-i teadmiskaardid on redaktsioonidel, mis kehtivad 30.11.2026-ni. Järgmistel redaktsioonidel kaarte pole; see on omaniku otsus.
