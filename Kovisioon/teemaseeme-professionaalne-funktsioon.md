# Teemaseeme

## Professionaalne tööseeme SotsiaalAI platvormil

**Dokumendi staatus:** terviklik toote- ja funktsionaalsusspetsifikatsioon  
**Versioon:** 1.1  
**Eesmärk:** kirjeldada Teemaseemet kui professionaalset tööobjekti, mis ühendab juhtumi ettevalmistuse, kovisiooni ja üldistatud parimate praktikate õppetsükli.

**Muudatused v1.1 (2026-07-11, loomisvaate pildi + tellija kriitika põhjal):**

- §8: Etapp 0 täpsustatud kompaktseks väravaks; lisatud §8.1 loomisvaate viie sammu kaardistus.
- §9.2: „edukogemus” eemaldatud konteksti valikutest (jääb ainult juhtumi liigiks §9.3); „muu professionaalne dilemma” ja „juhtimisolukord” liidetud valikuks „muu professionaalne olukord”.
- §24.1: grupile nähtavale seemnekaardile lisatud olek.
- §33.2: loomisvaates ei ole sessioonifunktsioone (Paus, sessiooniroll); nähtav §3 piiriselgitus.
- §33.3: eelvaade = päris seemnekaart olekuga „Pole veel jagatud”; privaatse paneeli pealkiri „Valikuline privaatne ettevalmistus”; üks aktsentvärv.
- Uus §33.5: ausad algolekud ja loomise nupuloogika (Salvesta mustand / Loo Teemaseeme / jätkamise lüliti).
- §36: lisatud vastuvõtukriteeriumid 21–26.
- Kaanon kinnitatud: pealkiri kuni 80 tähemärki (§9.1); soovitud toe valikud = §9.5 loend.

---

# 1. Dokumendi eesmärk

Teemaseeme on SotsiaalAI platvormi keskne professionaalne tööobjekt.

See võimaldab spetsialistil:

- märgata ja talletada töö käigus tekkinud teema;
- valmistada juhtumit privaatselt ja struktureeritult ette;
- eristada inimese, lapse, lähedase ja spetsialisti vaateid;
- kaardistada eluvaldkondi, tugevusi, riske, võrgustikku ja olemasolevat abi;
- analüüsida seni kasutatud lähenemisviise, meetodeid ja tegevusi;
- sõnastada enda professionaalne takerdumine ja õpivajadus;
- suunata teema sobivasse professionaalsesse töövormi;
- viia valitud üldistus kovisioonisessiooni;
- siduda järelvaate tulemus hiljem üldistatud parima praktika kandidaadiga.

> **Teemaseeme ei ole ainult lühike teemakaart.**  
> See on privaatne professionaalne tööseeme, millest süsteem loob eri eesmärkide jaoks erinevad vaated.

---

# 2. Põhimõisted

## 2.1. Teemaseeme

Kasutajale nähtav tootenimi.

Teemaseeme tähistab tervet professionaalset tööobjekti, mis sisaldab:

- lühikest üldistatud seemet;
- privaatset ettevalmistust;
- elutsüklit;
- kovisiooni sisendit;
- järelvaadet;
- võimalikku parima praktika kandidaati.

## 2.2. Grupile nähtav seemnekaart

Teemaseemne lühike üldistatud vaade, mida grupiliikmed näevad Teemaseemnete lehel.

See ei sisalda detailset juhtumilugu ega tundlikke andmeid.

## 2.3. Privaatne professionaalne ettevalmistus

Seemne omaniku tööruum, kus saab juhtumit põhjalikumalt ette valmistada.

See võib sisaldada:

- eluvaldkondi;
- inimese või lapse vaadet;
- võrgustikku;
- seniseid tegevusi;
- kasutatud meetodeid;
- töötaja eneserefleksiooni;
- võimalikku kovisioonifookust.

Privaatne ettevalmistus ei ole automaatselt grupile nähtav.

## 2.4. Kovisioonipakk

Teemaseemnest teadlikult valitud ja isikustamata info, mis liigub kovisioonisessiooni.

## 2.5. Praktikakandidaat

Järelvaate ja tulemuse põhjal loodud täielikult üldistatud õppimisobjekt, mida võib pärast toimetamist ja professionaalset kinnitamist avaldada Parimate praktikate lehel.

---

# 3. Mida Teemaseeme ei ole?

Teemaseeme ei ole:

- ametlik abi- ja toetusvajaduse hindamine;
- STAR2 hindamisküsimustiku koopia;
- klienditoimik;
- ametlik juhtumiplaan;
- võrgustikukohtumise protokoll;
- kovisioonisessiooni transkriptsioon;
- AI koostatud diagnoos;
- automaatselt avaldatav parim praktika;
- kõigi võimalike andmete kogumise ankeet.

Täisealise inimese abi- ja toetusvajaduse hindamise juhendi eluvaldkondi kasutatakse Teemaseemnes **kohandatud orientiiridena**, mitte ametliku RFK või teenusevajaduse hindamisena.

UI-s peab olema nähtav selgitus:

> Teemaseemne kaardistus aitab professionaalset olukorda mõtestada.  
> See ei asenda seadusest tulenevat hindamist, ametlikku juhtumiplaani ega riskihindamist.

---

# 4. Teemaseemne keskne arhitektuur

Ühel Teemaseemnel on üks püsiv identiteet, kuid mitu vaadet.

```text
PRIVAATNE TÖÖSEEME
    │
    ├── grupile nähtav üldistatud seemnekaart
    ├── omaniku privaatne ettevalmistus
    ├── kovisioonipakk
    ├── järelvaatepakett
    └── üldistatud praktikakandidaat
```

## 4.1. Ühe allika põhimõte

Sama infot ei sisestata eri funktsioonides mitu korda.

Teemaseeme:

- kannab üldistatud info kovisiooni 1. etappi;
- annab 2. etapis omanikule ettevalmistusmaterjali;
- võtab 8. etapist vastu järgmise sammu ja järelvaate;
- võimaldab järelvaate põhjal luua praktikakandidaadi.

## 4.2. Teadliku jagamise põhimõte

Privaatne info ei liigu järgmisse vaatesse automaatselt.

Iga elemendi juures saab omanik valida:

- ainult mulle;
- kasutan enda ettevalmistuseks;
- sobib grupile nähtavasse seemnekaarti;
- võin jagada kovisioonis;
- sobib hiljem üldistatavaks õppimiseks;
- kustuta pärast kasutamist.

---

# 5. Põhiprintsiibid

## 5.1. Progressiivne, mitte pikk vorm

Ligikaudu:

- 80% sisust sisestatakse valikute, skaalade, lühikaartide ja struktureeritud objektidega;
- 20% sisust jääb vabatekstiks.

Kasutaja näeb korraga ainult ühte loogilist küsimust või moodulit.

## 5.2. Ainult asjakohane info

Süsteem ei ava kõiki välju.

Järgmised küsimused sõltuvad:

- juhtumi kontekstist;
- juhtumi liigist;
- valitud eluvaldkondadest;
- sellest, kas esineb risk;
- sellest, kas võrgustik või kasutatud meetod on takerdumise osa;
- kasutaja valitud töövormist.

## 5.3. Inimese vaade on eraldi

Inimese või lapse enda sõnad ei tohi sulanduda töötaja hinnangusse.

## 5.4. Allikas peab olema nähtav

Olulise väite juures saab märkida info allika:

- inimese enda sõnad;
- lapse enda sõnad;
- töötaja vaatlus;
- töötaja tõlgendus;
- lähedase kirjeldus;
- teise spetsialisti hinnang;
- dokument;
- teadmata.

## 5.5. Tugevused ja riskid on tasakaalus

Teemaseeme ei tohi muutuda ainult probleemide loendiks.

## 5.6. Aus olek

Süsteem ei märgi midagi:

- hinnatuks;
- kinnitatuks;
- jagatuks;
- tulemuslikuks;
- parimaks praktikaks;

enne vastava inimese teadlikku tegevust.

## 5.7. Automatiseeritakse haldus, mitte professionaalne otsus

Süsteem võib:

- avada sobivad moodulid;
- koondada struktureeritud valikuid;
- tuletada meelde puuduvaid vaateid;
- koostada kinnitatava üldistuse mustandi.

Süsteem ei otsusta:

- milline on tegelik probleem;
- milline riskitase on õige;
- millist teenust inimene vajab;
- milline meetod on professionaalselt parim;
- milline kovisiooniküsimus on lõplik;
- kas õppimine väärib parima praktika staatust.

---

# 6. Kasutajarollid ja õigused

## 6.1. Teemaseemne omanik

Saab:

- luua ja muuta seemet;
- hallata privaatset ettevalmistust;
- valida jagatava info;
- valida töövormi;
- kinnitada grupile nähtava seemnekaardi;
- valida kovisioonipaki;
- kinnitada järelvaate;
- algatada praktikakandidaadi.

## 6.2. Kovisioonigrupi liige

Näeb ainult:

- grupile nähtavat seemnekaarti;
- valiku ja planeerimise infot;
- kovisioonis teadlikult jagatud materjali.

Ta ei näe omaniku privaatset ettevalmistust.

## 6.3. Sessiooni juht

Näeb:

- valitud seemne üldistatud vaadet;
- kovisiooni alustamiseks vajalikku infot;
- mitte omaniku privaatset ettevalmistust, välja arvatud teadlikult jagatud osad.

## 6.4. Professionaalne toimetaja

Parimate praktikate funktsioonis saab:

- vaadata ainult üldistatud praktikakandidaati;
- kontrollida isikustamist;
- hinnata allika ja tulemuse kirjeldust;
- tagastada kandidaadi parandamiseks;
- kinnitada või tagasi lükata avaldamise.

Ta ei pea nägema algset juhtumit.

## 6.5. Organisatsiooni administraator

Saab hallata:

- valdkonnakatalooge;
- meetodite kataloogi;
- töövormide suunamisreegleid;
- andmete säilitamise tähtaegu;
- toimetamisvoogu;
- õiguseid.

Administraator ei saa vaikimisi lugeda privaatse seemne sisulist teksti.

---

# 7. Teemaseemne elutsükkel

```text
MUSTAND
    ↓
OOTEL
    ↓
VALITUD
    ↓
TÖÖS
    ↓
JÄRELVAATES
    ↓
SULETUD
```

Täiendavad kõrvalolekud:

- **Vajab kiiret sekkumist**
- **Suunatud teise töövormi**
- **Lahendatud enne kovisiooni**
- **Arhiveeritud**
- **Praktikakandidaat loodud**

## 7.1. Mustand

- nähtav ainult omanikule;
- grupile ei kuvata;
- väljad võivad olla pooleli.

## 7.2. Ootel

- grupile nähtav seemnekaart on omaniku poolt kinnitatud;
- teema võib olla kovisioonijärjekorras;
- privaatne ettevalmistus võib edasi areneda.

## 7.3. Valitud

- seotud konkreetse kovisioonikohtumisega;
- grupile nähtav kaart lukustatakse valiku hetktõmmiseks;
- omanik saab privaatset ettevalmistust jätkata.

## 7.4. Töös

- kovisioonisessioon on avatud;
- Teemaseemne detailne muutmine ei muuda sessiooni algset hetktõmmist.

## 7.5. Järelvaates

- sessioon on lõppenud;
- salvestatud on üldistatud järgmine samm;
- määratud on järelvaate aeg;
- oodatakse tulemust.

## 7.6. Suletud

- omanik on tulemuse üle vaadanud;
- teema ei vaja praegu uut käsitlust;
- detailse töömaterjali säilitamine toimub andmereeglite järgi.

---

# 8. Teemaseemne loomise kasutajateekond

## Etapp 0 — sobivuse ja turvalisuse kontroll

Kõigepealt küsitakse:

**Kas olukorras võib olla vahetu oht või kohese sekkumise vajadus?**

Valikud:

- ei;
- võimalik, vajab kontrollimist;
- jah;
- ei ole teada.

Kui vastus on „jah” või „võimalik”, avatakse turvalisuse värav.

> Kovisioon ega Teemaseeme ei asenda kiireloomulist sekkumist.  
> Kinnita, kas vajalikud vahetud toimingud on tehtud.

Valikud:

- vajalik sekkumine on käivitatud;
- juhtum ei saa oodata;
- salvestan mustandi ja väljun;
- risk on hinnatud ning professionaalne refleksioon võib jätkuda.

Etapp 0 on **kompaktne kontroll** (üks küsimus, mitte suur paneel) ja kuulub loomisvoo algusesse kõigil juhtudel. Turvalisuse värav avaneb, kui vastus on „jah” VÕI „võimalik, vajab kontrollimist”. Kui vastus on „jah”, ei liigu süsteem lihtsalt edasi — kuvatakse selge piir: kovisioon ei asenda kiireloomulist sekkumist.

## Etapp 1 — kiire seeme

Kohustuslik minimaalne osa:

- pealkiri;
- juhtumi kontekst;
- juhtumi liik;
- miks praegu;
- millist tuge vajan;
- olulisus 1–10.

Kiire seemne saab salvestada 1–2 minutiga.

## Etapp 2 — privaatne professionaalne ettevalmistus

Valikuline, moodulipõhine tööruum.

Kasutaja ei pea kõiki mooduleid läbima.

## Etapp 3 — professionaalne takerdumine

Kasutaja sõnastab:

- kus töö on takerdunud;
- milline on tema enda roll;
- mida ta soovib õppida või otsustada.

## Etapp 4 — vaadete ja privaatsuse kontroll

Kasutaja näeb eraldi:

- privaatset detailvaadet;
- grupile nähtava kaardi eelvaadet;
- kovisiooni mineva info eelvaadet.

## Etapp 5 — töövormi valik

Võimalikud sihid:

- lisa kovisioonijärjekorda;
- seo juba planeeritud kovisiooniga;
- vaata seotud parimaid praktikaid;
- suuna supervisiooni kaalumisele;
- suuna eetilise arutelu kaalumisele;
- jäta privaatseks tööseemneks;
- sulge ilma kovisioonita.

## 8.1. Loomisvaate viis sammu

Loomisvaate stepper kuvab viis sammu:

1. **Kiire seeme** — etapp 1;
2. **Professionaalne ettevalmistus** — etapi 2 eluvaldkondade, vaadete ja tugevuste moodulid;
3. **Võrgustik ja senine töö** — etapi 2 võrgustiku-, abi-, meetodi- ja tegevusmoodulid;
4. **Fookus ja soovitud muutus** — etapp 3 (takerdumine) + kovisioonifookuse tugi (§23);
5. **Eelvaade, jagamine ja töövormi valik** — etapid 4–5.

Etapp 0 (sobivuse ja turvalisuse kontroll) EI ole stepperi samm — see on kompaktne värav enne sammu 1.

Sammud 2–4 on valikulised. Kiire Teemaseemne saab luua ainult sammuga 1; jagamise ja töövormi valikud (samm 5) on kättesaadavad ka ilma sammudeta 2–4.

---

# 9. Kiire seemne kohustuslikud väljad

## 9.1. Pealkiri

- kuni 80 tähemärki;
- üldistatud;
- ei sisalda nime ega muud tuvastavat detaili.

Näited:

- Katkendlik kooliskäimine
- Eluaseme säilimine ja vastutuse jagamine
- Võrgustiku rollide ebaselgus
- Toimiva töövõtte kordamise mõistmine

## 9.2. Juhtumi kontekst

Kontekst vastab küsimusele: **millises professionaalses olukorras see teema asub?**

- täisealise inimese klienditöö;
- lapse või noore klienditöö;
- pere või leibkond;
- paari või lähisuhte kontekst;
- võrgustiku või koostöö juhtum;
- muu professionaalne olukord (roll, meetod, koostöö, eetiline pinge või juhtimine).

Konteksti valikus EI ole „edukogemust” — edukogemus on juhtumi liik (§9.3), mitte kontekst. „Juhtimisolukord” kuulub „muu professionaalse olukorra” alla.

## 9.3. Juhtumi liik

Liik vastab küsimusele: **millise töölaadiga on tegemist?**

- aktuaalne väljakutse;
- edukogemus;
- minevikus toimunud keeruline olukord;
- tulevikueesmärk.

Juhtumi kontekst ja liik on eri väljad.

Näiteks:

- kontekst: täisealise inimese klienditöö;
- liik: aktuaalne väljakutse.

## 9.4. Miks praegu?

Üks kuni kolm üldistatud lauset.

## 9.5. Millist tuge vajan?

Mitmikvalik:

- olukorra parem mõistmine;
- uued vaatenurgad;
- oma rolli mõtestamine;
- professionaalsete piiride selgitamine;
- võrgustikutöö analüüs;
- kasutatud meetodi refleksioon;
- eetilise dilemma uurimine;
- võimalike teede loomine;
- järgmise sammu leidmine;
- edukogemusest õppimine;
- muu.

## 9.6. Olulisus või motivatsioon

Skaala 1–10.

See ei ole süsteemi hinnang juhtumi raskusele.

---

# 10. Kontekstipõhised ettevalmistuspaketid

Teemaseeme kasutab ühist andmemudelit, kuid kuvab eri kontekstides erinevad moodulid.

## 10.1. Täisealise inimese pakett

Põhineb kohandatult seitsmel eluvaldkonnal:

- suhtlemine;
- vaimne tervis;
- füüsiline tervis;
- elukeskkond;
- hõivatus;
- vaba aeg ja huvitegevus;
- igapäevaelu toimingud.

Lisaks:

- võrgustik;
- olemasolev abi;
- inimese ja spetsialisti vaade;
- kasutatud meetodid;
- töötaja professionaalne olukord.

## 10.2. Lapse või noore pakett

Avab vähemalt:

- laps või noor ise;
- hooldajad;
- peresuhted;
- areng ja igapäevane toimetulek;
- haridus;
- tervis;
- turvalisus;
- lapse arvamus;
- vanemate arvamused;
- spetsialistide hinnangud;
- lapse parima huvi kaalutlus;
- ametlik ja mitteametlik võrgustik.

Selle paketi detailne valdkonnakataloog peab põhinema eraldi lapse heaolu metoodilisel allikal.

## 10.3. Pere või leibkonna pakett

Avab:

- pere liikmed rollidena;
- peresuhted;
- vastutuse jaotus;
- igapäevane elukorraldus;
- lapsevanemlus;
- majandus;
- eluase;
- turvalisus;
- võrgustik;
- pere enda eesmärk.

## 10.4. Muu professionaalse olukorra pakett

Ei küsi kliendi eluvaldkondi, kui need ei ole asjakohased.

Avab:

- olukorra kontekst;
- seotud rollid;
- senised otsused;
- professionaalne vastutus;
- organisatsiooni mõju;
- eetiline pinge;
- töötaja roll ja piirid;
- soovitud õppimine.

## 10.5. Edukogemuse pakett

Avab:

- mis õnnestus;
- millised valikud ja tegevused aitasid;
- kes või mis toetas;
- milliseid tugevusi kasutati;
- milline mõju tekkis;
- mida soovitakse korrata;
- milline osa võiks saada praktikakandidaadiks.

Edukogemust ei muudeta kunstlikult probleemiks.

## 10.6. Mineviku keerulise olukorra pakett

Avab:

- olulised sündmused;
- pöördepunktid;
- mõju;
- lõpetamata osa;
- töötaja reaktsioonid;
- mida soovitakse õppida või lõpetada.

## 10.7. Tulevikueesmärgi pakett

Avab:

- soovitud tulevikupilt;
- edu tunnused;
- tähtaeg;
- praegune asukoht;
- vahe-eesmärgid;
- toetavad tingimused;
- takistused;
- grupilt soovitud tugi.

---

# 11. Täisealise inimese eluvaldkondade moodul

## 11.1. Valdkondade valik

Kasutaja valib:

- kuni kolm põhivaldkonda;
- vajadusel kõrvalvaldkonnad.

Kuvatakse seitse teemakaarti:

1. Suhtlemine ja suhted
2. Vaimne tervis ja tegevusvõime
3. Füüsiline tervis ja liikumine
4. Elukeskkond
5. Hõivatus ja sissetuleku säilimine
6. Vaba aeg, osalus ja tähenduslik tegevus
7. Igapäevaelu toimingud

## 11.2. Mõju tase

Iga valitud valdkonna juures:

**Kui oluline on selle valdkonna mõju praegusele juhtumile?**

- puudub;
- vähene;
- mõõdukas;
- oluline;
- kriitiline;
- info puudub;
- ei kohaldu.

See on kovisiooni ettevalmistuse orientiir, mitte ametlik RFK raskusaste.

## 11.3. Üks lühike kommentaar

> Mis selles valdkonnas praeguse juhtumi jaoks kõige olulisem on?

## 11.4. Info allikas

Kohustuslik, kui lisatakse sisuline väide.

---

# 12. Seitsme eluvaldkonna lühikataloog

## 12.1. Suhtlemine ja suhted

Valikud:

- suhtleb iseseisvalt;
- vajab lihtsustatud või selgitavat infot;
- raskused vestluse alustamisel või hoidmisel;
- raskused ametiasutustega suhtlemisel;
- raskused võõrastega suhtlemisel;
- pinged peresuhetes;
- raskused sõprus- või lähisuhete hoidmisel;
- raskused piiride tajumisel;
- sotsiaalne isolatsioon;
- konfliktne suhtlemine;
- info puudub.

## 12.2. Vaimne tervis ja tegevusvõime

### Kognitiivne toimetulek

- mälu;
- otsustamine;
- probleemide lahendamine;
- tegevuste järjestamine;
- ajas orienteerumine;
- kohas orienteerumine;
- inimestes orienteerumine.

### Psüühiline seisund

- ärevus;
- meeleolu;
- emotsioonide reguleerimine;
- stressiga toimetulek;
- motivatsioon;
- haigusteadlikkus;
- raviplaani järgimine;
- koostöö tervishoiuspetsialistidega.

### Riskiteemad

- enese hooletusse jätmine;
- ennast kahjustav käitumine;
- agressiivsus või vägivald;
- sõltuvuskäitumine;
- oht lapsele või sõltuvale inimesele;
- lootusetus või jõuetus;
- ebaturvaline võrgustik;
- info puudub.

Riskiteema aktiveerib eraldi turvalisuse kontrolli.

## 12.3. Füüsiline tervis ja liikumine

- tervis ei piira praegu toimetulekut;
- abi tervishoiuteenuse kasutamisel;
- raskused ravi või soovituste järgimisel;
- liikumispiirang kodus;
- liikumispiirang väljaspool kodu;
- kukkumisrisk;
- transpordivajadus;
- liikumisabivahend;
- tervisega seotud regulaarne kõrvalabi;
- info puudub.

## 12.4. Elukeskkond

- stabiilne ja sobiv eluase;
- eluaseme kaotamise risk;
- kodutus või ajutine eluase;
- sobimatu eluase;
- ebaturvaline keskkond;
- konfliktne kooselu;
- eluaseme kohandamise vajadus;
- raskused lepingute või arvete korraldamisel;
- raskused eluaseme säilitamisel;
- puudub võimalus abi kutsuda;
- info puudub.

## 12.5. Hõivatus ja sissetuleku säilimine

### Hõivatus

- töötab;
- õpib;
- osaleb tähenduslikus tegevuses;
- töötu;
- soovib tööle või õppima;
- vajab tuge töö või õppimise leidmisel;
- raskused hõive säilitamisel;
- hõive ei vasta võimetele või vajadustele.

### Sissetuleku säilimine

- sissetulek on piisav;
- sissetulek on olukorra tõttu vähenenud;
- ebapiisav sissetulek;
- sõltub toetustest;
- sõltub teise inimese rahalisest toetusest;
- teise inimese kontroll rahaliste vahendite üle;
- info puudub.

Raha praktiline planeerimine ja pangateenused kuuluvad igapäevaelu toimingute alla.

## 12.6. Vaba aeg, osalus ja tähenduslik tegevus

- hobid;
- tähenduslik tegevus;
- kogukonnas osalemine;
- sõpruskond;
- varasemad huvid;
- töö ja puhkuse tasakaal;
- soov osaleda, kuid puudub võimalus;
- puudub sisukas päevategevus;
- ei tunne praegu huvi;
- info puudub.

## 12.7. Igapäevaelu toimingud

Esmalt:

**Kas igapäevaelu toimingud on selle juhtumi jaoks olulised?**

Kui jah:

- raha ja eelarve;
- pangateenused;
- ostude tegemine;
- toidu hankimine ja valmistamine;
- söömine ja joomine;
- koristamine;
- pesu pesemine;
- kodumasinate kasutamine;
- hügieen;
- riietumine;
- ravimite või kohustuste meelespidamine;
- asjaajamine;
- info puudub.

---

# 13. Inimese, lapse ja spetsialisti vaated

## 13.1. Inimese enda vaade

Väljad:

- mida inimene ise peab põhiprobleemiks;
- mida ta soovib;
- millist abi ta aktsepteerib;
- millist abi ta ei soovi;
- keda ta soovib kaasata;
- keda ta ei soovi kaasata;
- üks lühike kommentaar;
- allikas: inimese enda sõnad.

## 13.2. Spetsialisti vaade

Väljad:

- millised tegevused või vajadused vajavad tähelepanu;
- millised riskid või piirangud on nähtavad;
- milline eesmärk võiks vajada täpsustamist;
- üks lühike kommentaar;
- allikas: töötaja hinnang.

## 13.3. Vaadete kattuvus

- kattuvad;
- kattuvad osaliselt;
- ei kattu;
- inimese vaade ei ole teada;
- spetsialisti hinnang ei ole veel kujunenud.

Süsteem võib valikute põhjal kattuvust soovitada, kuid kasutaja kinnitab selle.

## 13.4. Lapse juhtumi vaated

Eraldi:

- lapse arvamus;
- esimese hooldaja arvamus;
- teise hooldaja arvamus;
- spetsialistide hinnangud;
- lapse parima huvi kaalutlus.

Lapse arvamus ja lapse parim huvi ei ole sama väli.

---

# 14. Tugevused ja ressursid

Mitmikvalik:

- soov muutuseks;
- oskab abi küsida;
- varasem edukas toimetulek;
- praktilised oskused;
- töötamise või õppimise kogemus;
- toetav pereliige;
- toetav sõber;
- toimiv spetsialistide võrgustik;
- stabiilne eluase;
- regulaarne sissetulek;
- hobid või tähenduslik tegevus;
- head suhtlemisoskused;
- tugev side lastega;
- toimiv ravikoostöö;
- muu;
- pole veel kaardistatud.

Lisaväli:

**Olulisim tugevus selles juhtumis**

Iga valitud eluvaldkonna juures võib eraldi küsida:

> Mis selles valdkonnas juba toetab inimese toimetulekut?

---

# 15. Turvalisus ja kiireloomulisus

## 15.1. Kiireloomulisus

- kohene sekkumine;
- 24 tunni jooksul;
- nädala jooksul;
- vajab plaanilist abi;
- kiireloomulisus puudub;
- hindamata.

## 15.2. Riskikategooriad

- elu või tervise oht;
- kodutuse oht;
- lapse heaolu oht;
- vägivald;
- enese või teiste kahjustamise risk;
- toidu või ravimite puudumine;
- ärakasutamise oht;
- teenustest väljalangemine;
- võlgade kiire suurenemine;
- sotsiaalne isolatsioon;
- muu.

Iga riski juures:

- madal;
- keskmine;
- kõrge;
- teadmata.

## 15.3. Piir

Süsteem ei hinda riski kasutaja eest.

Kõrge riski valimisel kontrollib süsteem ainult protsessi sobivust:

- kas vahetu tegevus on käivitatud;
- kas kovisioon võib oodata;
- kas teema tuleks suunata teise töövormi.

---

# 16. Võrgustik ja koostöö

Võrgustik on Teemaseemnes eraldi professionaalne moodul.

Sellel on neli vaadet:

1. võrgustikukaart;
2. mõju ja tugi;
3. koostöö toimimine;
4. kovisiooni fookus.

## 16.1. Võrgustikuliikme kaart

### Roll

- partner;
- laps;
- vanem;
- õde-vend;
- muu sugulane;
- sõber;
- naaber;
- eestkostja;
- sotsiaaltöötaja;
- lastekaitsetöötaja;
- õpetaja või sotsiaalpedagoog;
- perearst;
- vaimse tervise spetsialist;
- tugiisik;
- politsei;
- ohvriabi;
- Töötukassa;
- teenuseosutaja;
- muu.

### Võrgustiku liik

- mitteametlik;
- ametlik.

### Mõju olukorrale

- tugevalt toetav;
- mõnevõrra toetav;
- neutraalne;
- mõnevõrra takistav;
- tugevalt takistav;
- konfliktne;
- vastuoluline;
- teadmata.

### Kaasatus

- aktiivselt kaasatud;
- aeg-ajalt kaasatud;
- kaasamata;
- peaks olema kaasatud;
- inimene ei soovi kaasamist;
- roll on ebaselge.

### Infovahetus

- toimib;
- osaliselt toimib;
- ei toimi;
- õiguslik alus vajab kontrollimist;
- hindamata.

### Vajadusel avanevad lisaväljad

- millist abi pakub;
- kas abi on piisav;
- millist eesmärki toetab;
- praegune vastutus;
- seotud tegevus;
- tegevuse tähtaeg;
- järgmise kontakti aeg;
- info allikas;
- nähtavus.

## 16.2. Võrgustikutöö tervisekontroll

Iga mõõde:

**Toimib · Osaliselt · Ei toimi · Pole teada**

- inimese või lapse hääl on nähtav;
- olukorrast on ühine arusaam;
- ühine eesmärk on selge;
- rollid ja vastutus on selged;
- vajalik infovahetus toimib;
- tegevused on koordineeritud;
- tulemust hinnatakse.

## 16.3. Võrgustikutöö vajab kovisioonis arutamist

Valikud:

- oluline osapool puudub;
- rollid on ebaselged;
- vastutus on koondunud ühele inimesele;
- osapoolte eesmärgid on erinevad;
- spetsialistide seisukohad on vastuolus;
- infovahetus ei toimi;
- tegevused dubleeruvad;
- kokkulepped ei jõua elluviimiseni;
- inimese või lapse hääl ei ole nähtav;
- inimene ei soovi olulise osapoole kaasamist;
- võrgustik tegutseb ilma inimese osaluseta;
- lähedase hoolduskoormus on liiga suur;
- puudub tervikpilti hoidev inimene;
- vaja võib olla võrgustikukohtumist;
- muu.

## 16.4. Võrgustikutöö ja kovisiooni piir

Kovisioonis:

- analüüsitakse võrgustiku toimimist;
- märgatakse puuduvaid vaateid;
- mõtestatakse töötaja rolli;
- valmistatakse ette järgmine professionaalne samm.

Kovisioonis ei:

- määrata teistele osapooltele kohustusi;
- kinnitata ametlikku tegevusplaani;
- tehta kliendi või lapse eest otsuseid.

Võrgustikukohtumisel lepitakse tegelike osapooltega kokku:

- ühine eesmärk;
- tegevused;
- vastutajad;
- tähtajad;
- infovahetus;
- vahehindamine.

---

# 17. Olemasolev abi

## 17.1. Mitteametlik abi

- pere;
- sugulased;
- sõbrad;
- naabrid;
- kogukond;
- muu;
- puudub.

## 17.2. Ametlik abi

- KOV-i sotsiaaltöö;
- tugiisik;
- koduteenus;
- rehabilitatsioon;
- erihoolekanne;
- tervishoiuteenus;
- Töötukassa;
- haridusteenus;
- eluasemeteenus;
- rahaline toetus;
- muu.

## 17.3. Abivahendid ja esemeline abi

- isiklik abivahend;
- liikumisabivahend;
- suhtlemise abivahend;
- eluruumi kohandus;
- side- või häirevahend;
- muu.

## 17.4. Abi toimivus

- piisav;
- osaliselt piisav;
- ebapiisav;
- olemas, kuid inimene ei kasuta;
- vajalik abi puudub;
- pole hinnatud.

## 17.5. Hoolduskoormus

Kui mitmes valdkonnas kannab abi peamiselt üks lähedane, küsib süsteem:

> Kas lähedase hoolduskoormus vajab eraldi tähelepanu?

See on uurimiskutse, mitte automaatne hinnang.

---

# 18. Lähenemisviisid, meetodid ja tegevused

Süsteemis eristatakse neli tasandit.

## 18.1. Lähenemisviis

Kuidas spetsialist olukorda käsitleb?

Näiteks:

- isikukeskne;
- lapsekeskne;
- tugevustel põhinev;
- jõustav;
- traumateadlik;
- lahenduskeskne;
- süsteemne või ökoloogiline;
- taastumisele suunatud;
- õigustel põhinev;
- kultuuritundlik;
- kahjude vähendamisele suunatud.

## 18.2. Professionaalne meetod

Kuidas muutust toetatakse?

Näiteks:

- juhtumikorraldus;
- struktureeritud vestlus;
- nõustamine;
- motiveeriv intervjueerimine;
- lahenduskeskne töö;
- tugevustel põhinev töö;
- psühhoharidus;
- oskuste õpetamine;
- kriisisekkumine;
- turvaplaan;
- kahjude vähendamine;
- traumateadlik töö;
- peretöö;
- vanemlust toetav töö;
- vahendamine;
- rühmatöö;
- võrgustikutöö;
- huvikaitse;
- välitöö;
- kogukonnatöö;
- muu.

## 18.3. Konkreetne töövõte või tegevus

Mida päriselt tehti?

- vestlus;
- vaatlus;
- kodukülastus;
- dokumentide läbivaatamine;
- küsimustik või skaala;
- ajajoon;
- genogramm;
- ökokaart;
- võrgustikukohtumine;
- telefonikõne;
- päring;
- teenusele suunamine;
- toetuse taotlemine;
- praktiline abi;
- tegevuskava;
- vahehindamine;
- muu.

## 18.4. Professionaalne tugimeetod

- kovisioon;
- supervisioon;
- eetiline arutelu;
- juhtumiarutelu;
- kriitilise juhtumi järelanalüüs;
- meeskonna refleksioon.

See aitab süsteemil hinnata, milline töövorm võib olla sobivaim.

---

# 19. Meetodikaart

Iga olulise meetodi kohta saab luua ühe kaardi.

## Põhiväljad

- lähenemisviis;
- meetod;
- miks valiti;
- mida meetod pidi muutma;
- kellega kasutati;
- staatus;
- sagedus;
- inimese või lapse osalus;
- tulemus;
- takistus;
- kas vajab kovisioonis arutamist;
- üks võimalik uurimisküsimus.

## Miks valiti?

- inimene kõhkleb muutuse suhtes;
- koostöö on ebastabiilne;
- vaja on suurendada inimese osalust;
- vaja on toetada otsustamist;
- esineb kriis;
- vaja on koordineerida võrgustikku;
- vaja on kaitsta õiguseid;
- muu.

## Staatus

- kaalumisel;
- kavandatud;
- kasutatud;
- jätkub;
- lõpetatud;
- ei sobinud;
- inimene keeldus.

## Sagedus

- üks kord;
- korduvalt;
- regulaarselt;
- teadmata.

## Inimese osalus

- aktiivne;
- osaline;
- kõikuv;
- passiivne;
- vastumeelne;
- puudus;
- teadmata.

## Tulemus

- eesmärk saavutatud;
- osaline muutus;
- muutust ei olnud;
- olukord halvenes;
- tulemus pole veel teada.

## Takistus

- usaldamatus;
- vähene valmisolek;
- tervis;
- keele- või suhtlustakistus;
- teenuse puudumine;
- võrgustiku konflikt;
- töötaja rolli ebaselgus;
- meetod ei sobinud;
- eesmärk oli ebaselge;
- muu.

---

# 20. Tegevused ja praegune plaan

## 20.1. Tegevuskaart

- tegevuse liik;
- eesmärk;
- vastutaja;
- osalejad;
- tähtaeg;
- staatus;
- tulemus;
- takistus;
- seos meetodiga;
- seos võrgustikuliikmega.

## 20.2. Staatus

- kavandatud;
- alustatud;
- edeneb;
- takerdunud;
- saavutatud;
- lõpetatud;
- vajab muutmist;
- jäi tegemata.

## 20.3. Tulemus

- tehtud ja toimis;
- tehtud, kuid tulemus puudus;
- osaliselt toimis;
- pooleli;
- inimene loobus;
- teenus polnud kättesaadav;
- jäi tegemata;
- tulemus teadmata.

## 20.4. Takistused

- inimene ei jõudnud;
- valmisolek puudus;
- tervislik seisund;
- teenuse järjekord;
- transport;
- rahaline takistus;
- info jäi ebaselgeks;
- tegevus oli liiga keeruline;
- vastutus oli ebaselge;
- võrgustiku koostöö puudus;
- muu.

Süsteem võib struktureeritud valikutest koostada neutraalse kokkuvõtte:

> Proovitud on nelja tegevust. Üks toimis, kaks jäid pooleli ja üks ei käivitunud teenuse puudumise tõttu.

See ei ole AI järeldus, vaid valikute kokkuvõte.

---

# 21. Takerdumine ja töötaja professionaalne olukord

## 21.1. Takerdumise liik

- inimene ei osale kokkulepitud tegevustes;
- inimene ja töötaja näevad olukorda erinevalt;
- eesmärk ei ole inimese enda eesmärk;
- plaan on liiga keeruline;
- töötaja teeb liiga palju inimese eest;
- võrgustik ei tee koostööd;
- vastutus on ebaselge;
- vajalik teenus puudub;
- turvalisus ja enesemääramine on pinges;
- eetiline dilemma;
- professionaalsed piirid;
- töötaja tugev emotsionaalne reaktsioon;
- kasutatud meetod ei anna oodatud tulemust;
- pole selge, mida järgmisena teha;
- muu.

Lisaväli:

**Kirjelda takerdumist ühe või kahe lausega**

## 21.2. Töötaja tunded

- mure;
- segadus;
- abitus;
- frustratsioon;
- ärevus;
- hirm;
- süütunne;
- vastutustunne;
- soov inimest päästa;
- ärritus;
- lootusetus;
- kaastunne;
- muu.

See osa on vaikimisi privaatne.

## 21.3. Töötaja võetud roll

- toetaja;
- koordinaator;
- kontrollija;
- päästja;
- vahendaja;
- otsustaja;
- inimese eest tegutseja;
- roll on ebaselge.

## 21.4. Mida spetsialist vajab?

- uusi vaatenurki;
- tegevusideid;
- juhtumiplaani analüüsi;
- rollide ja vastutuse jagamist;
- professionaalsete piiride uurimist;
- eetilise dilemma arutamist;
- võrgustiku kaardistamist;
- emotsionaalset peegeldust;
- meetodi sobivuse refleksiooni;
- abi tööfookuse sõnastamisel;
- muu.

---

# 22. Töövormi sobivuse tugi

Süsteem ei otsusta, kuid aitab kasutajal valida.

## Kovisioon võib sobida, kui vaja on

- juhtumit mõtestada;
- märgata pimekohti;
- analüüsida kasutatud meetodit;
- arutada rolli ja piire;
- uurida võrgustiku toimimist;
- leida järgmine professionaalne samm.

## Supervisioon võib olla sobivam, kui keskmes on

- tugevad ja korduvad emotsionaalsed reaktsioonid;
- töötaja ja inimese suhte sügavam dünaamika;
- professionaalne identiteet;
- läbipõlemisrisk;
- organisatsiooni mõju töötajale.

## Eetiline arutelu võib olla sobivam, kui keskmes on

- enesemääramine versus turvalisus;
- lapse arvamus versus lapse parim huvi;
- konfidentsiaalsus versus info jagamine;
- inimese soov versus ametikohustus;
- napp ressurss versus suur abivajadus.

## Kiire sekkumine peab eelnema, kui

- esineb vahetu oht;
- olukord on ebastabiilne;
- vajalik on kohene tegevus.

---

# 23. Kovisiooni fookuse tugi

Süsteem pakub küsimusealgusi, mitte valmis lõppküsimust.

## Võimalikud algused

- Kuidas saaksin…?
- Mida ma selles olukorras ei pruugi märgata?
- Kuidas tasakaalustada … ja …?
- Kuidas jagada vastutus … vahel?
- Milline võiks olla minu järgmine professionaalne samm?
- Kuidas kujundada töö nii, et…?
- Kuidas toetada inimest nii, et ma ei…?
- Kas takerdumine on meetodis, eesmärgis, ajastuses või rakendamises?
- Kuidas korraldada võrgustikutöö nii, et…?
- Mida tahan sellest õnnestumisest korrata?

## Kvaliteedikontroll

Süsteem võib küsida:

- Kas fookus puudutab sinu professionaalset mõjuulatust?
- Kas see annab lõpliku vastutuse sulle, mitte grupile?
- Kas küsimus on avatud?
- Kas selles on üks põhifookus?
- Kas see väldib teise inimese diagnoosimist?
- Kas see on seotud inimese või lapse soovitud muutusega?

Lõpliku tööfookuse kinnitab alati seemne omanik.

---

# 24. Teemaseemne automaatsed väljundid

Süsteem loob struktureeritud andmetest mustandid.

## 24.1. Grupile nähtav seemnekaart

Näitab ainult:

- pealkirja;
- konteksti;
- juhtumi liiki;
- 1–3 põhiteemat;
- miks praegu;
- soovitud tuge;
- üldistatud võrgustiku või meetodi takerdumist;
- olulisust;
- omanikku;
- olekut (mustand / ootel / valitud / töös / järelvaates / suletud).

## 24.2. Ühe minuti kokkuvõte

Omaniku privaatne spikker.

## 24.3. Kolme kuni viie minuti juhtumiesitlus

Omaniku privaatne jutustamisstruktuur.

## 24.4. Kovisioonipaki eelvaade

Näitab, millised elemendid on omanik valinud kovisioonis teadlikult jagamiseks.

## 24.5. Järelvaatepakett

Pärast kovisiooni:

- valitud järgmine samm;
- tähtaeg;
- toetav ressurss;
- oodatav muutuse märk;
- järelvaate kuupäev;
- tulemus.

## 24.6. Praktikakandidaadi mustand

Tekib ainult omaniku eraldi toiminguga ja pärast tulemust.

---

# 25. Grupile nähtava seemnekaardi näide

**Eluaseme säilimine ja vastutuse jagamine**

- Kontekst: täisealise inimese klienditöö
- Liik: aktuaalne väljakutse
- Põhiteemad: elukeskkond · majanduslik toimetulek · vaimne tervis
- Miks praegu: eluaseme kaotamise risk on suurenenud
- Vaated: inimese ja spetsialisti vaated kattuvad osaliselt
- Võrgustikutöö: rollid on osaliselt ebaselged
- Soovin: abi vastutuse jagamisel ja järgmise professionaalse sammu leidmisel
- Olulisus: 9/10
- Omanik: Mari Mets

Kaardil ei kuvata:

- nime ega sünniaega;
- diagnoosi;
- riskide detailset loetelu;
- teenuste täpset ajalugu;
- võrgustikuliikmete tundlikke suhtehinnanguid;
- töötaja tundeid;
- tegevuste tähtaegu.

---

# 26. Teemaseemnete leht

## 26.1. Põhivaated

- Kõik
- Ootel
- Tänaseks valitud
- Töös
- Järelvaates
- Suletud
- Minu seemned

## 26.2. Filtrid

- kontekst;
- juhtumi liik;
- põhivaldkond;
- soovitud toe liik;
- omanik;
- staatus;
- ooteaeg;
- järelvaate aeg.

## 26.3. Õigluse ja roteerimise tugi

Süsteem kuvab:

- kui kaua seeme on oodanud;
- millal omanik viimati juhtumi tooja oli;
- kas mõni osaleja pole veel saanud oma teemaga töötada;
- kas mõni seeme on järelvaates.

Süsteem ei vali teemat grupi eest.

## 26.4. Seemnekaardi toimingud

Omanikule:

- Ava
- Jätka ettevalmistust
- Muuda üldistust
- Lisa kovisioonijärjekorda
- Seo kohtumisega
- Vaata seotud praktikaid
- Sulge
- Kustuta

Grupile:

- Vaata üldistust
- Märgi enda jaoks oluliseks
- Osale kokkulepitud valikus

---

# 27. Sidumine kovisiooniga

## 27.1. Enne sessiooni

Kui Teemaseeme valitakse:

1. staatus muutub **Valitud**;
2. luuakse grupile nähtava kaardi hetktõmmis;
3. omanik valib kovisioonipaki;
4. sessiooni 1. etappi liigub ainult üldistatud kaart.

## 27.2. Kovisiooni 1. etapp

Kuvatakse:

- pealkiri;
- omanik;
- juhtumi liik;
- miks praegu;
- soovitud tugi;
- üldistatud põhiteemad.

Privaatne ettevalmistus ei avane grupile.

## 27.3. Kovisiooni 2. etapp

Omanik saab enda privaatsest ettevalmistusest kasutada:

- ühe minuti kokkuvõtet;
- esitlusstruktuuri;
- valitud võrgustikukaarti;
- meetodikaarti;
- ajajoont;
- soovitud muutust.

Ühisele lõuendile jõuab ainult teadlikult jagatud info.

## 27.4. Kovisiooni 3.–7. etapp

Teemaseemne objektid võivad lõuendil edasi areneda:

- küsimusteks;
- uurimiskohtadeks;
- mustriteks;
- võimalusteks;
- ressurssideks;
- valitud sammuks.

## 27.5. Kovisiooni 8. etapist tagasi

Teemaseemne juurde jõuab:

- sessiooni kuupäev;
- üldistatud peamine taipamine;
- omaniku valitud järgmine samm;
- järelvaate kuupäev;
- säilitamise valik.

Tagasi ei jõua automaatselt:

- täielik lõuend;
- küsimuste loend;
- grupiliikmete privaatne õppimine;
- tundlikud peegeldused;
- heli või video.

---

# 28. Sidumine Parimate praktikatega

Teemaseeme ja Parimad praktikad on seotud kahes suunas.

## 28.1. Parimad praktikad toetavad Teemaseemet

Valitud konteksti, eluvaldkondade, võrgustiku ja meetodite põhjal võib süsteem näidata:

**Seotud professionaalsed materjalid**

Näiteks:

- võrgustikukohtumise ettevalmistamise juhis;
- motiveeriva intervjueerimise põhimõtted;
- lapse arvamuse nähtavaks tegemise kontrollküsimused;
- eluaseme säilitamise juhtumikorralduse praktika;
- professionaalsete piiride refleksioonikaart.

Need on valikulised viited.

Süsteem ei ütle:

> See on sinu juhtumi õige lahendus.

Kasutaja saab märkida:

- vaatasin;
- kasutasin;
- ei olnud asjakohane;
- soovin arutada kovisioonis.

## 28.2. Teemaseemnest võib tekkida praktikakandidaat

Praktikakandidaati saab algatada ainult siis, kui:

- tegevus või tööviis on päriselt kasutatud;
- järelvaate tulemus on teada;
- õppimine on üldistatav;
- tundlik juhtumiinfo on eemaldatud;
- omanik soovib seda jagada.

## 28.3. Praktikakandidaadi väljad

- praktika pealkiri;
- professionaalne kontekst;
- millist olukorda see aitab käsitleda;
- kasutatud lähenemisviis või meetod;
- mida tehti;
- kelle osalus oli vajalik;
- mis tulemus tekkis;
- millest tulemus teada on;
- millistes tingimustes praktika sobib;
- millal see ei pruugi sobida;
- riskid ja piirangud;
- seotud töövahendid;
- allika liik;
- kinnitamise staatus.

## 28.4. Tõenduse või kogemuse tase

- ametlik juhend;
- organisatsiooni kinnitatud praktika;
- mitme juhtumi üldistatud kogemus;
- ühe juhtumi üldistatud õppimine;
- ekspertarvamus;
- katsetamisel olev praktika.

Kasutaja peab nägema, millist tüüpi teadmine on avaldatud.

## 28.5. Avaldamise voog

```text
MUSTAND
    ↓
OMANIKU ÜLDISTUS
    ↓
ISIKUSTAMISE KONTROLL
    ↓
PROFESSIONAALNE TOIMETAMINE
    ↓
KINNITAMINE
    ↓
AVALDATUD PRAKTIKA
```

Ühtegi praktikakandidaati ei avaldata automaatselt.

## 28.6. Tagasiside praktikast Teemaseemnesse

Kui kasutaja seob praktika oma seemnega, saab järelvaates märkida:

- kasutati täielikult;
- kasutati osaliselt;
- ei kasutatud;
- ei sobinud;
- vajab kohandamist;
- tulemus pole veel teada.

See võimaldab Parimate praktikate sisu hiljem täiustada, kuid üks juhtum ei muuda praktikat automaatselt „tõestatuks”.

---

# 29. Reeglipõhine professionaalne tugi

Eelistada tuleb deterministlikke kontrollreegleid.

## 29.1. Näited

### Inimese vaade puudub

> Inimese enda soov ei ole märgitud. Kas tema vaade on teadmata, küsimata või pole seda võimalik praegu saada?

### Vastutus on ebaselge

> Kolm osapoolt on seotud sama eesmärgiga, kuid vastutaja pole märgitud.

### Lähedase koormus

> Mitteametlik abi toetab mitut eluvaldkonda, kuid ametlik abi on märgitud ebapiisavaks. Kas lähedase hoolduskoormus vajab tähelepanu?

### Meetodil puudub eesmärk

> Kasutatud meetodi juures pole märgitud, mida see pidi muutma.

### Sama meetod ilma tulemuseta

> Sama meetod on märgitud kasutatuks korduvalt, kuid tulemus on „muutust ei olnud”. Kas soovid uurida eesmärki, rakendamist, ajastust või sobivust?

### Võrgustikuprobleem

> Võrgustikutöö on märgitud takerdumiseks, kuid ühist eesmärki või koordinaatorit pole kaardistatud.

### Vahehindamine puudub

> Tegevus jätkub, kuid pole märgitud, millal või mille alusel tulemust hinnatakse.

## 29.2. Sõnastus

Reegel peab kasutama:

- „võimalik uurimiskoht”;
- „kas info on puudu?”;
- „kas soovid seda täpsustada?”;

mitte:

- „probleem on…”;
- „klient ei ole motiveeritud”;
- „meetod on vale”.

---

# 30. AI roll ja piirid

## 30.1. AI võib

- aidata üldistada pealkirja;
- pakkuda isikustamata sõnastust;
- märgata võimalikku nime või muud tuvastavat detaili;
- aidata eristada vaatlust ja tõlgendust;
- koostada struktureeritud valikutest kokkuvõtte mustandi;
- pakkuda kovisiooniküsimuse alguseid;
- aidata praktikakandidaati üldistada;
- soovitada seotud teadmistebaasi märksõnu;
- tõlkida või lihtsustada kasutajaliidese teksti.

## 30.2. AI ei või

- diagnoosida;
- määrata riskitaset;
- valida teenust;
- otsustada professionaalse meetodi sobivust;
- muuta töötaja tõlgendust faktiks;
- avaldada privaatset infot;
- valida teemat kovisiooniks;
- teha juhtumi tooja eest lõplikku kovisiooniküsimust;
- avaldada praktikakandidaati;
- nimetada ühe juhtumi põhjal midagi parimaks praktikaks.

## 30.3. Hääle roll

Teemaseemne loomine on peamiselt struktureeritud kirjalik töö.

Häälsisestus võib olla valikuline ligipääsetavusfunktsioon, kuid:

- see ei ole Teemaseemne põhiloogika;
- see ei loo automaatselt ühiseid kaarte;
- see ei tähenda püsivat transkriptsiooni.

Kovisioonis tähendab hääl eelkõige inimeste omavahelist reaalajas vestlust.

---

# 31. Andmekaitse ja konfidentsiaalsus

## 31.1. Minimaalsus

Kogutakse ainult professionaalse refleksiooni jaoks vajalik info.

## 31.2. Isikustamine

Vaikimisi kasutatakse:

- rolle;
- vanusevahemikke;
- üldistatud ajaperioode;
- konteksti kirjeldusi.

Ei kasutata:

- nime;
- isikukoodi;
- täpset aadressi;
- detailset sünniaega;
- haruldast tuvastavat kombinatsiooni;
- tundlikku dokumenti, kui piisab viitest.

## 31.3. Ametliku infosüsteemi duplikaadi vältimine

Kui info asub ametlikus juhtumisüsteemis:

- Teemaseeme viitab allikale;
- ei kopeeri kõiki andmeid;
- võimaliku integratsiooni korral tuuakse ainult vajalik üldistus.

## 31.4. Nähtavustasemed

- ainult omanikule;
- valitud kaastöötajale;
- kovisioonigrupile;
- sessiooni juhile;
- üldistatavaks õppimiseks;
- ajutine ja kustutatav.

## 31.5. Audit

Salvestatakse:

- kes muutis nähtavust;
- kes kinnitas üldistuse;
- millal loodi kovisiooni hetktõmmis;
- millal loodi praktikakandidaat;
- kes selle kinnitas.

## 31.6. Kustutamine

Omanik saab:

- kustutada mustandi;
- eemaldada privaatse mooduli;
- katkestada jagamise;
- sulgeda teemaseemne;
- taotleda detailandmete kustutamist vastavalt organisatsiooni reeglitele.

---

# 32. Tehniline andmemudel

## 32.1. Seed

- seed_id
- owner_id
- organization_id
- title
- context_type
- case_type
- why_now
- requested_support[]
- importance
- status
- created_at
- updated_at
- selected_session_id
- follow_up_date
- closed_at

## 32.2. VisibilityProfile

- item_id
- visibility_level
- shared_with[]
- retention_policy
- owner_confirmed
- confirmed_at

## 32.3. SubjectProfile

- subject_type
- age_range
- living_arrangement[]
- case_duration
- case_origin
- optional_context

## 32.4. DomainCard

- domain
- subtopics[]
- relevance_level
- short_comment
- information_source
- priority_order
- strengths[]
- visibility

## 32.5. PerspectiveCard

- perspective_owner
- expressed_need[]
- short_comment
- source_type
- overlap_status
- visibility

## 32.6. RiskCard

- risk_category
- user_selected_level
- urgency
- immediate_action_status
- short_comment
- visibility

## 32.7. NetworkMember

- role
- network_type
- relationship_to_subject
- impact
- involvement
- information_exchange
- support_provided
- support_sufficiency
- responsibility
- linked_actions[]
- next_contact
- source_type
- visibility

## 32.8. MethodCard

- approach
- method
- selection_reason[]
- intended_change
- used_with[]
- status
- frequency
- subject_participation
- result
- barriers[]
- needs_reflection
- linked_actions[]
- visibility

## 32.9. ActionCard

- action_type
- goal
- responsible_role
- participants[]
- deadline
- status
- result
- barriers[]
- linked_method
- linked_network_members[]
- visibility

## 32.10. ProfessionalReflection

- stuck_points[]
- feelings[]
- assumed_roles[]
- requested_support[]
- short_reflection
- recommended_workform_candidates[]
- visibility

## 32.11. KovisioonPackage

- public_summary_snapshot
- owner_selected_items[]
- private_presentation
- provisional_focus
- selected_at

## 32.12. FollowUp

- selected_step
- deadline
- expected_indicator
- actual_result
- owner_reflection
- follow_up_status
- reviewed_at

## 32.13. PracticeCandidate

- generalized_title
- context
- challenge
- approach
- method
- actions
- participation_conditions
- result
- evidence_type
- applicability
- limitations
- risks
- anonymization_status
- review_status
- linked_seed_reference_private

---

# 33. Kasutajaliidese loogika

## 33.1. Üldstiil

- sama soe tume taust nagu platvormi teistes osades;
- läbipaistvad klaaspaneelid;
- korraga üks põhitegevus;
- puudub pikk vormileht;
- puudub üldine tööriistariba;
- järgmine valik avaneb kontekstist;
- privaatne ja ühine info on visuaalselt selgelt eristatud;
- tähendus ei sõltu ainult värvist.

## 33.2. Loomise põhivaade

Üleval:

- seemne loomise sammud;
- privaatsusolek;
- salvesta mustand.

Loomisvaade EI ole kovisioonisessioon. Üleval ei kuvata:

- nuppu „Paus”;
- sessioonipõhist rolli (nt „Sessiooni juht”).

Abifunktsioon kannab nime **Abi** või **Loomise juhis**. Kasutaja profiili juures kuvatakse nimi ja amet või organisatsioon (nt „Jaanika Kask · Lastekaitsetöötaja”).

Loomisvaates on alati nähtav §3 piiriselgitus:

> Teemaseemne kaardistus aitab professionaalset olukorda mõtestada.  
> See ei asenda seadusest tulenevat hindamist, ametlikku juhtumiplaani ega riskihindamist.

Keskel:

- aktiivne moodul;
- valikukaardid;
- üks lühike kommentaar;
- vajadusel visuaalne kaart.

Paremal:

- „Miks seda küsitakse?”
- privaatsuse selgitus;
- seotud professionaalne materjal.

All:

- tagasi;
- jäta vahele;
- salvesta;
- jätka.

## 33.3. Privaatne ja ühine eelvaade

Enne avaldamist kuvatakse kõrvuti:

### Valikuline privaatne ettevalmistus

Pealkiri on just selline — sõna „valikuline” on nähtav. Selgitus:

> Võid hiljem lisada ainult selle info, mis aitab sul juhtumit professionaalselt ette valmistada.

Privaatset kihti eristab lukumärk ja kergelt sügavam klaas, MITTE eraldi aktsentvärv. Kogu Teemaseemne vaates on üks aktsentvärv (platvormi soe merevaik); violett jääb kovisioonisessiooni aktsendiks.

### Mida grupp näeb pärast jagamist?

Eelvaate pealkiri on just selline — mitte „see info on nähtav kõigile”. Eelvaade kuvatakse **päris seemnekaardi kujul** (§25 vorming: pealkiri, kontekst · liik, miks praegu, soovitud tugi, olulisus, omanik), koos nähtava olekusildiga:

**Pole veel jagatud**

Enne omaniku teadlikku jagamistoimingut ei ole seemnekaart kellelegi nähtav. Pärast loomist valib omanik jagamise sihi (§8 etapp 5): lisa grupi ootejärjekorda / seo planeeritud kovisiooniga / jäta ainult endale / jaga valitud grupiga. Teemaseeme ei muutu automaatselt nähtavaks kogu organisatsioonile.

Kasutaja peab vajutama:

**Kinnitan grupile nähtava üldistuse**

## 33.4. Moodulite kokkupakkimine

Lõpetatud moodul muutub kompaktseks kaardiks:

- põhiteema;
- olulisuse tase;
- mitu elementi;
- privaatsuse olek;
- „Ava uuesti”.

## 33.5. Ausad algolekud ja loomise nupuloogika

Algolekud:

- olulisuse skaala on algolekus **Valimata** — väärtus kuvatakse alles kasutaja puudutuse järel;
- kontekst ja juhtumi liik on algolekus valimata;
- süsteem ei eeltäida ühtegi sisulist välja kasutaja eest.

Nupud loomisvaate all:

- **Salvesta mustand** — sekundaarne, alati aktiivne;
- **Loo Teemaseeme** — primaarne, aktiivne alles siis, kui kohustuslikud väljad (§9) on täidetud;
- lüliti: **„Pärast loomist jätkan privaatse ettevalmistusega”** — vaikimisi väljas.

Kui „Loo Teemaseeme” on mitteaktiivne, on põhjus nähtav, nt:

> Lisa pealkiri, kirjelda teema olulisust ja vali vähemalt üks soovitud toe liik.

Kiire Teemaseemne loomine ei tohi nõuda privaatse ettevalmistuse läbimist. Privaatne ettevalmistus on jätk, mitte tingimus.

---

# 34. Minimaalne toimiv versioon

## MVP põhifunktsioonid

- kiire seeme;
- konteksti ja juhtumi liigi valik;
- privaatne ja grupile nähtav kiht;
- täisealise inimese seitse eluvaldkonda;
- inimese ja spetsialisti vaade;
- tugevused;
- kiireloomulisuse kontroll;
- võrgustikukaardid;
- senised tegevused ja tulemused;
- meetodikaart;
- takerdumise tüüp;
- töötaja professionaalne vajadus;
- kovisioonifookuse tugi;
- grupile nähtava kaardi eelvaade;
- kovisioonijärjekord;
- kovisioonipaki valik;
- järelvaade;
- seotud parimate praktikate kuvamine;
- praktikakandidaadi käsitsi algatamine.

## MVP-s ei ole vaja

- kogu ametliku hindamisjuhendi detailküsimustikku;
- RFK koode;
- automaatset diagnoosi;
- automaatset teenusesoovitust;
- täismahus lapse hindamispaketti ilma metoodilise aluseta;
- automaatset häälelt-kaardile töövoogu;
- automaatset praktikate avaldamist;
- ametliku juhtumiplaani täielikku dubleerimist.

---

# 35. Hilisemad täiustused

- eraldi lapse ja pere valdkonnapaketid;
- organisatsioonipõhised kataloogid;
- ametlike infosüsteemide turvaline integratsioon;
- ajajoon ja genogramm;
- võrgustikukohtumise ettevalmistuspakk;
- meetodite kompetentsi- ja pädevusviited;
- tulemuste võrdlus järelvaadetes;
- praktikakandidaatide versioonihaldus;
- anonüümitud organisatsiooni õpitrendid;
- mitmekeelne kasutajaliides;
- ligipääsetavus- ja lihtsas keeles vaated;
- organisatsiooni õppetsükli analüütika.

---

# 36. Vastuvõtukriteeriumid

Teemaseemne funktsioon on loogiliselt valmis, kui:

1. kasutaja saab luua kiire seemne ilma detailset ankeeti täitmata;
2. privaatne ettevalmistus ja grupile nähtav kaart on selgelt eraldatud;
3. ükski privaatne element ei muutu automaatselt jagatuks;
4. kontekst muudab kuvatavaid mooduleid;
5. täisealise inimese pakett kasutab seitset eluvaldkonda kohandatud kujul;
6. inimese, lapse ja spetsialisti vaated on eristatavad;
7. iga olulise väite allikas saab olla nähtav;
8. tugevused on riskidega võrdselt kaardistatavad;
9. kõrge risk käivitab sobivuskontrolli, mitte automaatse otsuse;
10. võrgustikukaart eristab inimese suhet ja koostöö toimimist;
11. lähenemisviis, meetod, tegevus ja teenus ei ole süsteemis üks ja sama;
12. kovisiooni liigub ainult omaniku teadlikult valitud pakk;
13. kovisiooni tulemus jõuab tagasi järelvaatesse;
14. praktikakandidaat tekib ainult pärast tulemust ja omaniku algatust;
15. parim praktika ei sisalda juhtumi tuvastatavaid detaile;
16. AI ettepanek on alati mustand;
17. süsteem ei tee professionaalset otsust kasutaja eest;
18. hääle põhifunktsioon kovisioonis on inimestevaheline vestlus;
19. ametliku hindamise ja Teemaseemne piir on kasutajale arusaadav;
20. sama infot ei pea eri funktsioonides uuesti sisestama;
21. loomisvaates ei ole sessioonifunktsioone (Paus, sessioonipõhine roll);
22. olulisus, kontekst ja juhtumi liik on algolekus valimata;
23. primaarne nupp on täitmata kohustuslike väljade korral mitteaktiivne ja põhjus on nähtav;
24. kiire seemne saab luua ilma privaatset ettevalmistust avamata (Loo Teemaseeme + valikuline jätkamise lüliti);
25. grupile nähtava eelvaate juures on enne jagamist olek „Pole veel jagatud” ja pealkiri „Mida grupp näeb pärast jagamist?”;
26. jagamise adressaat on alati omaniku teadlik valik — seeme ei muutu automaatselt nähtavaks kogu organisatsioonile.

---

# 37. Terviklik andmevoog

```text
TEEMASEEMNE LOOMINE
    ↓
Kiire üldistus + privaatne ettevalmistus
    ↓
SEOTUD PARIMATE PRAKTIKATE VAATAMINE
    ↓
Omanik otsustab, kas teema vajab kovisiooni
    ↓
KOVISIOONIJÄRJEKORD
    ↓
KOVISIOONI 1. ETAPP
Üldistatud tänane juhtum
    ↓
KOVISIOONI 2.–7. ETAPP
Juhtum areneb ühisel lõuendil
    ↓
KOVISIOONI 8. ETAPP
Taipamine + järgmine samm + järelvaade
    ↓
TEEMASEEMNE JÄRELVAADЕ
Mis päriselt juhtus?
    ↓
VALIK
Sulge / jätka / uus kovisioon / praktikakandidaat
    ↓
PARIMA PRAKTIKA TOIMETAMINE
Täielik üldistamine + professionaalne kinnitus
    ↓
AVALDATUD PRAKTIKA
Võib toetada tulevasi Teemaseemneid
```

---

# 38. Lõplik määratlus

> **Teemaseeme on professionaalne, privaatne ja dünaamiline tööseeme, mis aitab spetsialistil muuta hajusa tööalase olukorra struktureeritud õpi- ja tegutsemisküsimuseks.**

See:

- ei dubleeri ametlikku juhtumihaldust;
- ei taanda inimest probleemide loendiks;
- ei automatiseeri professionaalset otsustamist;
- ei muuda kovisiooni vormitäitmiseks;
- ei nimeta ühe juhtumi tulemust automaatselt parimaks praktikaks.

Teemaseeme loob kontrollitud silla:

> **juhtumi märkamisest → professionaalse ettevalmistuseni → kovisioonini → järelvaateni → üldistatud organisatsioonilise õppimiseni.**
