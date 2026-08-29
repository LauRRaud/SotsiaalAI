# `ST10-01 MUUTUSE-KOMPASS-V1` — Minu muutuse kompassi arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: Teekonna ja professionaalse tulemuskihi laiendus
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: staatiline kaart; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2016. aasta allikakiht rõhutab, et kvaliteet ei võrdu teenusetundide või kohtade arvuga:
oluline on inimese enda eesmärk ja tema elus toimunud muutus. **Minu muutuse kompass** aitab
inimesel sõnastada algseisu, soovitud muutuse, järgmise väikese sammu ja kontrollpunkti ning
hiljem võrrelda, mis tema enda hinnangul muutus.

Funktsioon ei hinda inimese „edukust”. Ta loob parandatava ja jagatava narratiivse tulemuskihi,
mille üle jääb kontroll inimesele.

## 2. Sobivus olemasoleva platvormiga

**Olemas ja taaskasutatav:**

- Teekonna privaatne olukorra-mälu ja valikuline jagamine: `lib/journey/*`,
  `components/journey/*`, `JOURNEY-V1` leping;
- professionaalse refleksiooni eesmärgi, sihi ja kontrollpunkti alus:
  `lib/reflection/constants.js`, `lib/reflection/records.js`,
  `components/reflection/ReflectionPage.jsx`;
- refleksiooni väljad `clientGoal`, `clientReaction` ja `interimOutcome` ning Teenuspäeviku
  `ServiceReferral.goalsText`, tegevuskirjed, narratiivne edenemine ja kliendi kuu digikinnitus;
- päritolu ja inimese kinnituse sõnastik: `lib/workspaces/provenance.js`;
- külmutatud minimaalne jagamine ja „Minu jagamised”.

**Pooleli või puudu:** olemasolevad killud ei moodusta inimese omandis kompassi. Puuduvad
nimeline kompassivaade, algseisu ja vahehindamise muutumatu versiooniajalugu, Teekonna,
refleksiooni ning Teenuspäeviku teadlik seos ja tegelik tulemuse tagasisiderada. Kvaliteedijuhise
tagasiside-/vahehindamisrütm on kuvameeldetuletus, mitte salvestatud klienditagasiside.

## 3. V1 kasutajatee

1. Inimene avab Teekonna juures „Minu muutuse kompassi”.
2. Ta kirjutab enda sõnadega eesmärgi, algseisu, soovitud muutuse ja kontrollpunkti kuupäeva.
3. AI võib pakkuda lihtkeelset sõnastusmustandit, kuid algne tekst säilib ja inimene kinnitab.
4. Kontrollpunktis lisab inimene uue hinnangu: mis muutus, mis ei muutunud, mis aitas ja mis on
   järgmine samm. Varasem kirje ei kirjutata üle.
5. Inimene võib koostada valitud väljadega külmutatud väljavõtte spetsialistile. Spetsialisti
   märge ei muutu inimese enda hinnanguks.
6. Inimene saab jagamise tagasi võtta; välise faili juba alla laadinud saaja puhul kuvatakse
   tagasivõtmise piir ausalt.

## 4. Tootepiirid ja invariandid

- Ei looda edenemis-, heaolu-, motivatsiooni- ega riskiskoori.
- AI ei otsusta, kas eesmärk on saavutatud, ega ühenda vastuseid automaatseks hinnanguks.
- Inimese enda hinnang, spetsialisti tähelepanek ja AI mustand on eri päritoluga objektid.
- Kompass on vaikimisi privaatne. Roll või juhtumisuhe ei anna automaatset lugemisõigust.
- Jagamisel liigub serveris koostatud allowlist-projektsioon, mitte kogu Teekond.
- Uut tabelit ei lisata enne E0 tõendit, et olemasolev Journey/Reflection mudel ei suuda
  omandit, versioone ja nähtavust korrektselt kanda.
- Kompass ei asenda ametlikku hindamist ega tõenda teenuse mõju.

## 5. Minimaalne andmeleping

V1 vajab vähemalt: omanik, seotud Teekond, inimese eesmärk, algseisu kirjeldus, soovitud
muutus, järgmine samm, kontrollpunkti aeg, versioon, päritolu, inimese kinnitamise aeg ja
valikuline jagamisviide. Vahehindamine on uus versioon/sündmus, mitte algseisu üle kirjutamine.

Säilitus järgib Teekonna inimese juhitud elutsüklit. Jagamise audit kannab saajat, eesmärki,
väljade võtmeid ja aega, mitte kompassi vabateksti. Kustutamine peab arvestama külmutatud
eelpöördumise või muu õiguspäraselt saadetud väljavõtte eraldi elutsüklit.

## 6. Teostusetapid

### E0 — doonorite ja andmemudeli lepitamine

- Kaardista Journey, PracticeReflection, ServiceReferral/Teenuspäeviku edenemine,
  kliendi kuu digikinnitus ning kvaliteedijuhise kuvameeldetuletus.
- Lukusta üks omanikumudel, versioonireegel ja jagamisprojektsioon; ära dubleeri Teekonda.
- Sõnasta käsitsi tõendatav V1 rada ja täpsed failipiirid.

### E1 — privaatne kompass ja versioonid

- Lisa omaniku-skoobitud loomine, lugemine, vahehindamine, parandamine ja kustutamine.
- Säilita algne inimese tekst ning märgi AI ümberkirjutus mustandiks.
- Lahenda sama kirje kahe vahekaardi muutmine tingimusliku versioonikontrolliga.

### E2 — Teekonna kasutajapind

- Lisa Teekonnale algseis → soovitud muutus → järgmine samm → kontrollpunkt vaade.
- Näita ajalugu ja parandusi, mitte ainult viimast väärtust.
- Lisa ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion käitumine.

### E3 — valikuline jagamine ja professionaalne peegel

- Loo 1:1 eelvaatega allowlist-väljavõte ning seo see „Minu jagamistega”.
- Spetsialist näeb ainult kinnitatud väljavõtet ja lisab oma vaate eraldi kihina.
- Välista privaatne refleksioon ning jagamata Teekonna väljad.

### E4 — tulemuse järelvaade

- Seo kontrollpunkt inimese enda järgmise sammuga ja vajadusel sekkumispäeviku sündmusega.
- Kuva selgelt „inimese hinnang”, „spetsialisti tähelepanek” ja „kontrollimata”.
- Ära genereeri koondmõju ega organisatsiooninäitajat enne eraldi mõõtmis- ja privaatsuslepingut.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis on siis, kui inimene saab eesmärgi ning algseisu luua, teha vähemalt ühe muutumatu
ajalooga vahehindamise, parandada AI mustandit, koostada minimaalse jagamise ja selle tagasi
võtta; võõras kasutaja ega spetsialist ilma jagamiseta kompassi ei näe. Inimese ja spetsialisti
vaated ei segune ning ükski pind ei kuva skoori.

Kontroll: muudetud koodi lint, `git diff --check`, tõlgete muutumisel `i18n:check`, skeemi
korral `prisma validate`, peatüki lõpus build ning olemasolevas lokaalses keskkonnas käsitsi
omanik/spetsialist/võõras rada. Automaatteste ega sonde ei looda ega käivitata.
Kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-MK-1: kas kompass elab ainult Teekonnal või saab eraldi naasmispunkti; V1 soovitus on
  Teekond + otselink, mitte uus paralleelne tööruum.
- O-MK-2: säilituse ja saadetud väljavõtte kustutuse lõplik õiguslik sõnastus.
- Päris mõjuväide vajab eraldi pilooti ja eelnevalt määratud tulemuse mõõtmist.
