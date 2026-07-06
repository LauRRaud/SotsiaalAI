# Tööheaolu lisaplaan: toe küsimine, KOV-piloot ja kovisiooni sidumine

**Dokumendi eesmärk:** kirjeldada Tööheaolu mooduli täiendavaid arendusmõtteid, mis puudutavad individuaalse toe küsimist, anonüümse koondandmestiku kasutuspiire, KOV-pilooti ja olemasoleva Kovisiooni mooduliga sidumist.

See dokument ei korda Tööheaolu mooduli 10 põhifunktsiooni kirjeldusi. Fookus on lisaloogikal, mis täiendab olemasolevat Tööheaolu kontseptsiooni.

---

## 1. Põhiprobleem: anonüümne koondandmestik ei aita konkreetset inimest

Tööheaolu moodulis tuleb eristada kahte erinevat eesmärki:

1. **Süsteemi parandamine**  
   Selleks sobib anonüümne koondandmestik. See aitab näha, millised töökorralduslikud koormustegurid korduvad KOVi, organisatsiooni, üksuse või rolligrupi lõikes.

2. **Konkreetse inimese toetamine**  
   Selleks anonüümsest koondandmestikust ei piisa. Kui spetsialist vajab abi, peab tal olema eraldi võimalus koostada ja jagada kasutaja kinnitatud abipalve, memo või kovisiooni sisend.

Seetõttu peab Tööheaolu moodulis olema kaks paralleelset rada:

```text
anonüümne koondandmestik → süsteemi ja töökorralduse parandamine

kasutaja kinnitatud jagatav kokkuvõte → konkreetse spetsialisti toetamine
```

---

## 2. Kolmekihiline andme- ja toe mudel

### 2.1 Kiht 1: privaatne isiklik töötoe vaade

See on vaikimisi.

Spetsialist näeb enda:

- kiirkontrolle;
- signaale;
- ülevaateid;
- taastumise vajadust;
- tööpiiride mustandeid;
- raske juhtumi või töövägivalla kokkuvõtteid;
- kovisiooni sisendeid;
- memosid ja plaane.

Neid ei näe automaatselt:

- KOV;
- juht;
- kolleeg;
- teenuseosutaja;
- teine kasutaja.

Privaatne töötoe vaade peab olema kasutaja kontrolli all.

### 2.2 Kiht 2: kasutaja kinnitatud jagamine

Kui kasutaja soovib abi või arutelu, saab ta koostada eraldi jagatava versiooni.

Võimalikud jagatavad väljundid:

- juhiga arutelu memo;
- abipalve;
- kovisiooni sisend;
- töö ümberjagamise ettepanek;
- tööpiiride kokkuleppe mustand;
- piloodi tugikontaktile pöördumine;
- supervisiooni või muu kokkulepitud toe sisend.

Jagamine toimub ainult siis, kui kasutaja:

1. näeb eelvaadet;
2. saab teksti muuta;
3. kinnitab, mida jagatakse;
4. valib, kellele jagatakse.

### 2.3 Kiht 3: anonüümne koondandmestik

See on mõeldud:

- KOVi töökorralduse analüüsiks;
- KOVide või üksuste võrdluseks;
- organisatsiooni või valdkonna töötingimuste arendamiseks;
- tööprotsesside ja tugisüsteemide parendamiseks.

Sinna ei lähe:

- nimed;
- e-postid;
- vabas vormis kirjeldused;
- kliendiandmed;
- juhtumite detailid;
- väikese grupi andmed, kui inimene võib olla kaudselt tuvastatav.

---

## 3. Kasutaja kontrollitud toe küsimise töövoog

Tööheaolu moodulisse tuleb lisada läbiv toe küsimise töövoog.

See ei ole eraldi põhifunktsioon ega uus kaart. See on korduv komponent, mis avaneb asjakohastes olukordades, näiteks:

- punane töökoormuse signaal;
- korduvad kollased signaalid;
- raske juhtum;
- töövägivalla olukord;
- taastumisvõimaluse puudumine;
- kovisiooni vajaduse märkimine;
- alustava spetsialisti kõrge toe vajadus;
- rollipiiride või tööprotsessi tugev ebaselgus.

### 3.1 Kasutajale kuvatavad valikud

Näited:

- **Jäta privaatseks**
- **Koosta juhiga arutelu memo**
- **Koosta kovisiooni sisend**
- **Koosta abipalve**
- **Koosta töö ümberjagamise ettepanek**
- **Koosta tööpiiride kokkuleppe mustand**
- **Ava Taastumine**
- **Ava Kovisioonis**

### 3.2 Toe küsimise põhimõte

Süsteem ei saada midagi automaatselt. Süsteem koostab kontrollitava mustandi.

Kasutaja peab enne jagamist saama:

- näha, mida jagatakse;
- muuta teksti;
- eemaldada liigsed detailid;
- kinnitada, et tekst sobib jagamiseks;
- valida adressaadi või sihtmooduli;
- otsustada, et jätab kõik privaatseks.

### 3.3 Jagatava versiooni tehniline loogika

Soovituslik andmestruktuur:

```ts
shareableVersion = {
  sourceWorkflowType: string,
  sourceRecordId: string,
  outputType: "manager_memo" | "support_request" | "covision_input" | "redistribution_proposal" | "boundary_agreement",
  recipientType: "manager" | "pilot_support_contact" | "supervisor" | "covision" | "other",
  generatedText: string,
  editedText?: string,
  userReviewed: false,
  userConfirmed: false,
  createdAt: Date
}
```

Oluline:

- toorandmeid ei jagata;
- jagatav versioon on eraldi tekst;
- `userReviewed` ja `userConfirmed` peavad enne jagamist olema `true`;
- kasutaja peab saama jagamise katkestada.

---

## 4. Kovisiooni sidumine Tööheaoluga

Tööheaolu alla ei lisata eraldi Kovisiooni funktsiooni, sest Kovisioon on platvormil olemas eraldi põhifunktsioonina.

Õige loogika:

```text
Tööheaolu koostab sisendi.
Kovisioon võtab sisendi vastu.
Kasutaja kinnitab, mida kaasa viiakse.
```

Tööheaolu ei loo automaatselt kovisiooniruumi ega saada infot kolleegidele. See koostab ainult kovisiooni arutelu aluse.

---

## 5. Millistest Tööheaolu töövoogudest võib kovisiooni suunata

Kovisiooni suunamist võib pakkuda järgmistes olukordades:

- raske juhtum;
- töövägivalla olukord;
- taastumise töövoog, kui kasutaja märgib kovisiooni vajaduse;
- rollipiiride töövoog, kui roll või vastutus on ebaselge;
- alustaja tugi, kui kasutaja märgib, et juhtumit ei peaks üksi kandma;
- ülevaade, kui korduvad punased või kollased signaalid;
- kiirkontroll, kui kasutaja märgib kovisiooni vajaduse või signaal on punane;
- tööprotsessid või katkestused, kui probleem on seotud keerulise rolli-, koostöö- või vastutusküsimusega.

---

## 6. Kovisiooni teemad

Kovisiooni lehel ei peaks kordama Tööheaolu funktsioonide kaarte üks-ühele. Kovisiooni lehel võiksid olla arutelu fookused.

Soovituslikud kovisiooni teemad:

- juhtumiarutelu;
- eetiline dilemma või moraalne pinge;
- töövägivald või ohustav olukord;
- rollipiirid ja vastutus;
- töökoormus ja taastumine;
- koostööpartnerite ootused;
- tööprotsessi või dokumenteerimise kitsaskoht;
- alustava spetsialisti juhtum või küsimus.

Tööheaolu sisendid paigutuvad nende teemade alla.

Näited:

| Tööheaolu lähtekoht | Kovisiooni teema |
|---|---|
| Raske juhtum | Juhtumiarutelu / eetiline dilemma |
| Töövägivald | Töövägivald või ohustav olukord |
| Rollipiirid | Rollipiirid ja vastutus |
| Taastumine | Töökoormus ja taastumine |
| Ülevaade | Korduv töökoormuse muster |
| Tööprotsessid | Tööprotsessi või dokumenteerimise kitsaskoht |
| Alustaja tugi | Alustava spetsialisti juhtum või küsimus |

---

## 7. Kovisiooni sisendi struktuur

Kovisiooni ei viida automaatselt toorandmeid. Kaasa viiakse ainult kasutaja kinnitatud üldistatud sisend.

Soovituslik struktuur:

```text
Kovisiooni sisend

Teema:
Olukorra üldistatud kirjeldus:
Minu keskne küsimus:
Mis teeb olukorra keeruliseks:
Peamised tööalased koormustegurid:
Riskid või tähelepanu vajavad kohad:
Kaitsetegurid või olemasolevad tugevused:
Mida soovin kovisioonis arutada:
```

### 7.1 Mida ei kanta automaatselt üle

Kovisiooni ei kanta automaatselt:

- kasutaja toorvastuseid;
- privaatseid märkmeid;
- varasemaid kiirkontrolle;
- vabatekste;
- kliendiandmeid;
- juhtumi tuvastatavaid detaile;
- kogu tööheaolu ajalugu.

### 7.2 Enne Kovisiooni liikumist

Kasutaja peab nägema eelvaadet:

- mida kaasa viiakse;
- mida ei viida kaasa;
- kas tekst võib sisaldada liigseid isikuandmeid;
- võimalust teksti muuta;
- võimalust kõik privaatseks jätta;
- nuppu **Ava olemasolevas Kovisioonis**.

---

## 8. Kovisiooni lehe täiendamine

Kovisiooni lehele võib lisada uue ploki:

**Heaolu töövoogudest ette valmistatud kovisiooni sisendid**

Selles plokis saab kasutaja näha enda salvestatud või koostatud sisendeid, näiteks:

- Raske juhtum — koostatud 26.05.2026;
- Rollipiirid — koostatud 25.05.2026;
- Töövägivald — koostatud 24.05.2026;
- Taastumine — koostatud 23.05.2026.

Iga sisendi juures võiks olla nupud:

- **Ava**
- **Muuda**
- **Kasuta kovisioonis**
- **Jäta privaatseks**
- **Kustuta**

### 8.1 Kovisiooni alustamise viisid

Kovisiooni lehel võiks olla kaks alustamise viisi:

1. **Alusta tühjalt**  
   Kasutaja valib ise teema ja täidab arutelu aluse.

2. **Alusta Tööheaolu sisendist**  
   Kasutaja valib Tööheaolu töövoos ette valmistatud sisendi, muudab seda ja kinnitab kasutamise Kovisioonis.

---

## 9. KOV piloodi loogika

KOV piloodis peab olema väga selge, et tööandja ei näe individuaalseid sisestusi.

KOV saab:

- anonüümse koondpildi;
- töökorralduslike koormustegurite ülevaate;
- soovitused, milliseid töövooge või kokkuleppeid parandada;
- üldistatud aruande, kui grupis on piisavalt osalejaid.

KOV ei saa:

- üksiktöötaja vastuseid;
- punaste töötajate nimekirja;
- vabatekste;
- kliendiandmeid;
- juhtumite detaile;
- väikese tiimi tulemusi, kui inimene võib olla äratuntav.

### 9.1 Piloodi võimalik kestus

Soovituslik piloodi kestus:

```text
8–12 nädalat
```

### 9.2 Esimese piloodi võimalik fookus

Esimeses piloodis võiks eelistada vähem tundlikke ja töökorralduslikult kõige kasulikumaid töövooge:

- Kiirkontroll;
- Ülevaade;
- Tööprotsessid;
- Tööpiirid;
- Rollipiirid.

Teises ringis võib lisada tundlikumad töövood:

- Raske juhtum;
- Töövägivald;
- Taastumine;
- Alustaja tugi;
- kovisiooni sisendi liikumine.

---

## 10. Uued arenduskomponendid

### 10.1 Jagatava versiooni mudel

```ts
shareableVersion = {
  sourceWorkflowType: string,
  sourceRecordId: string,
  recipientType: "manager" | "pilot_support_contact" | "supervisor" | "covision" | "other",
  outputType: string,
  generatedText: string,
  editedText?: string,
  userReviewed: boolean,
  userConfirmed: boolean,
  visibility: "private" | "shared",
  createdAt: Date
}
```

### 10.2 Kovisiooni sisendi mudel

```ts
wellbeingToCovisionDraft = {
  id: string,
  userId: string,
  sourceWorkflowType: string,
  sourceRecordId: string,
  draftTitle: string,
  covisionTopic: string,
  generalizedSummary: string,
  centralQuestion: string,
  discussionPoints: string[],
  riskNotes: string[],
  protectiveFactors: string[],
  supportNeeds: string[],
  generatedText: string,
  editedText?: string,
  userReviewed: boolean,
  userConfirmed: boolean,
  status: "draft" | "ready_for_covision" | "used_in_covision" | "archived",
  createdAt: Date,
  updatedAt: Date
}
```

### 10.3 Toe küsimise korduv komponent

Lisada korduv komponent töövoogudesse:

- **Soovin tuge küsida**
- **Koosta abipalve**
- **Koosta juhiga arutelu memo**
- **Koosta kovisiooni sisend**
- **Jäta privaatseks**

### 10.4 Kovisiooni lehe täiendused

Lisada Kovisiooni lehele:

- **Alusta tühjalt**
- **Alusta Tööheaolu sisendist**
- **Heaolu töövoogudest ette valmistatud sisendid**
- sisendi eelvaade;
- muutmine;
- kasutaja kinnitus;
- kasutamine olemasolevas Kovisiooni töövoos.

---

## 11. Oluline sõnastus piloodi ja ekspertide jaoks

Tööheaolu moodul ei ole töötajate jälgimise süsteem. See on spetsialisti enda töötoe vahend, millel on kaks vabatahtlikku laiendust:

1. anonüümne koondanalüüs süsteemi ja töökorralduse parandamiseks;
2. kasutaja kinnitatud abipalve või kovisiooni sisend konkreetse toe saamiseks.

Kõige lühem selgitus:

> Anonüümne koondandmestik aitab näha, mis süsteemis koormust tekitab. Kasutaja kinnitatud abipalve või kovisiooni sisend aitab konkreetset spetsialisti. Need kaks rada peavad olema eraldi, selged ja kasutaja kontrolli all.

---

## 12. Kontrollnimekiri

Pärast arendust kontrolli:

- Tööheaolu töövood ei jaga midagi automaatselt;
- kasutaja saab valida “jäta privaatseks”;
- kasutaja saab koostada jagatava versiooni;
- jagatav versioon on eraldi objekt, mitte toorandmete jagamine;
- kasutaja peab jagatava versiooni üle vaatama ja kinnitama;
- kovisiooni sisend ei sisalda automaatselt toorandmeid;
- Kovisiooni lehel saab alustada tühjalt või Tööheaolu sisendist;
- Kovisiooni teemad ei dubleeri Tööheaolu 10 kaarti üks-ühele;
- KOV piloodi koondandmestik ei sisalda isikuandmeid ega vabatekste;
- väikese grupi andmeid ei kuvata äratuntaval kujul;
- raske juhtumi ja töövägivalla korral kuvatakse ohutustekst;
- olemasolevat Kovisiooni moodulit ei dubleerita, vaid kasutatakse sihtmoodulina.

---

## 13. Lõpptulemus

Selle lisaplaani eesmärk on teha Tööheaolu moodulist süsteem, mis suudab teha kahte asja korraga:

1. **Aidata konkreetset spetsialisti**, kui ta soovib tuge küsida, kovisiooni minna või juhiga töökorralduslikku arutelu ette valmistada.

2. **Aidata parandada töökorraldust**, kasutades anonüümseid ja koondatud andmeid korduvate koormustegurite nähtavaks tegemiseks.

Põhimõte:

```text
Privaatne sisestus jääb kasutajale.
Jagatav tugi tekib ainult kasutaja kinnitusega.
Koondandmestik aitab süsteemi, mitte ei jälgi töötajat.
Kovisioon saab sisendi, aga ei saa toorandmeid.
```
