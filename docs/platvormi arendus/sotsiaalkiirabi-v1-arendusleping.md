# `SOTSIAALKIIRABI-V1` (SK-V1) — arendusleping

STATUS: `READY_FOR_BUILD` — disain on omanikuga läbi vaieldud ja kinnitatud 29.–30.07.2026;
kood kirjutamata; ühendamata KOV-i rada on omaniku otsusel peidetud ja serveris
fail-closed (ptk 3.6 ja 7).

- **Ülesanne:** pöörduja-poolne kiireloomulise sotsiaalabi kanal — inimene ütleb ise, et
  olukord ei kannata hommikuni, ja tema enda sõnadega kirjeldus liigub tema valitud KOV-i
  lauale või teenuseosutajale.
- **Iseloom:** arendusleping teostajale. Kõik koodiseisu väited kannavad failiviidet ja on
  kontrollitud 29.07.2026 töökoopiast (`main`, commit'imata töö peal).
- **Ajend:** Virro & Leesment, „Sotsiaaltöö aastal 2050. Unistus sotsiaalkiirabist",
  ajakiri Sotsiaaltöö 2/2025. Nende ettepanek on **füüsiline** väljasõiduüksus. SK-V1 ei
  ole see. SK-V1 on **eelkiht ja väljakutsepind** — vt ptk 2.
- **Võrdlusallikas (lisatud 30.07.2026):** Merike Mikk,
  [„Sotsiaalkiirabi või pigem sotsiaal- ja kriisiabi? Soome kogemus"](https://www.sotsiaalkindlustusamet.ee/sotsiaaltoo-artiklid/sotsiaalkiirabi-voi-pigem-sotsiaal-ja-kriisiabi-soome-kogemus),
  Sotsiaaltöö 2/2026. Artikkel kirjeldab täismahus ööpäevaringset inimteenust; SK-V1
  võtab sealt vastuvõtu, vastutusjälje ja üleandmise nõuded, mitte väljasõiduteenuse
  skoopi.
- **Eesti rakendustõend (lisatud 30.07.2026):** Estkeer OÜ piloodi
  [rahastusotsus](https://adr-docs.karlerss.com/vGptejVOOMwg2gZbWz5xcAjLvs9p9faH/Taotluse%20rahuldamise%20kohta.pdf),
  [jaanuari 2026 käivituskogemus](https://peegel.ut.ee/node/1158) ja
  Sotsiaalministeeriumi [2026. aasta kukkumisjuhtumite analüüs](https://sm.ee/sites/default/files/documents/2026-06/Koduses%20keskkonnas%20toimunud%20kukkumisjuhtumid.pdf).
  Teenuse valmisolek ei tekita juhtumeid, kui öisel vajadusel on päevane KOV-i värav,
  Häirekeskusel puudub suunamisalus ja info ei jõua operatiivteenistustelt sotsiaalpoolele.
  SK-V1 peab tõendama tervet vastuvõtuahelat, mitte üksnes vormi töötamist.
- **Seotud:** `SotsiaalAI.md` ptk 4 C-tabel (SOTSIAALVALVE, Häirekeskuse järelsuunamise
  sild), 5.4 (AI-määruse positsioon), 5.9 (anti-engagement), T26 partnerpiloot.

---

## 1. Lähteseis — mis on koodis olemas (kontrollitud 29.07.2026)

| Fakt | Koht | Tähendus SK-V1-le |
|---|---|---|
| Saajatüübid `KOV_CONTACT` / `SERVICE_PROVIDER` | `prisma/schema.prisma:319`, `lib/preInquiryRouting.js:21` | mõlemad pooled on juba modelleeritud; SK saab oma enum'i sama kujuga |
| Tagasivõtt | `lib/preInquiries.js:724` (`recallPreInquiry`), tingimused `:741–751` | INTERNAL + SENT + `openedAt` null; SK-le sama loogika, aga oma objektil |
| Päritolumärgistus | artefaktide kiht (vt `SotsiaalAI.md` ptk 1) | „kliendi öeldud" vs „AI mustand" — SK-s **kohustuslik** |
| Vastuvõtu töövoog | `lib/preInquiryReceiverWorkflow.js` | koondvaate (E4) teine allikas |
| „Minu jagamised" | `components/sharings/MySharingsPage.jsx` | SK-kirjed peavad siia ilmuma |
| Kriisirada | `lib/chat/safety.js:12` `detectCrisis()`, tekst `messages/et.json:2105` | fail-safe 3 keeles; SK vormi **esimene lukk**, muutmata |
| Saajate kataloog | `ServiceMapEntry` (teenusekaart) | KOV-kontaktid on olemas, **lugemisaega ei ole** |
| Masintuletatud kiireloomulisus | `lib/preInquiries.js:330` `detectUrgencyLevel`, kasutus `:1769`, marsruut `lib/preInquiryRouting.js:111` | **SK-s seda EI kasutata** (ptk 3.3); PreInquiry pärand jääb eraldi otsuseks O-SK-6 |

**Kokkuvõte:** toru on olemas, **kell puudub.** Mitte kuskil ei ole kirjas, millal
inimene selle päriselt läbi loeb — ei saatja ekraanil ega vastuvõtja pool. SK-V1 tuum
ongi see kell.

---

## 2. Mida SK-V1 EI ole

Need read on toote piir, mitte skoobi kärbe. Neid ei tohi pehmendada ilma omaniku
otsuseta.

1. **Ei ole hädaabinumber.** Eluohu korral juhib vorm 112 juurde ega loo järjekorda.
2. **Ei luba reageerimisaega.** Platvorm saab lubada ainult **lugemisaega** — millal
   inimene selle läbi loeb. Kohalesõitmine on KOV-i või osutaja töö.
3. **Ei mehita valvet.** Valvepersonal on partneri oma. SotsiaalAI annab laua.
4. **AI ei triaaži.** Kiireloomulisuse määrab inimene ise. Ükski mudel ega regex ei
   järjesta inimesi. (AI-määruse III lisa piir + RAKE pretsedent, `SotsiaalAI.md` 5.4/5.10.)
5. **Ei ole register.** Pärast üleandmist on ametlik kandja KOV-i oma; platvormile jääb
   inimese enda koopia.
6. **Ei ole eelpöördumine.** Eraldi objekt, eraldi elutsükkel (ptk 3.1).
7. **Ei ole täismahus sotsiaal- ja kriisiabiteenus.** SK-V1 ei paku inimvalvet,
   ametnikukanalit, registripäringuid, väljasõitu ega kriisitöö toiminguid. Need eeldavad
   avaliku teenuse korraldajat, õiguslikku alust, personali ja ametkondade kokkulepitud
   rolle.

---

## 3. Disainiotsused (kinnitatud 29.07.2026)

### 3.1. Eraldi objekt, mitte eelpöördumise režiim

Omaniku otsus. Põhjendus, mis kaalus üles jagatud objekti mugavuse:

- **oma elutsükkel** — SK-teade aegub hommikuks, eelpöördumine ei aegu;
- **väiksem andmepind** — neli välja jäävadki neljaks, päritud välju ei ole täita;
- **oma õiguslik positsioon** — kui SoM/SKA vastavad kiireloomulise ja ettevalmistatud
  pöördumise kohta erinevalt, saab neid erinevalt kohelda;
- **oma lüliti** — riskantseim funktsioon peab saama kinni ilma töötavat eelpöördumist
  puutumata;
- **puhas algus** — SK ei päri `detectUrgencyLevel` tagavara.

**Hind, mis tuleb teadlikult maksta:** vastuvõtja koondvaade (E4) ei tule tasuta.
Ilma selleta jääb lühike ärev teade sellesse postkasti, mida keegi ei ava.

### 3.2. Neli välja

| Väli | Kohustuslik | Märkus |
|---|---|---|
| **mis toimub** | jah | vabatekst või hääl, **inimese enda sõnadega** |
| **kus** | jah | KOV — ilma selleta ei ole marsruuti |
| **kuidas sind kätte saab** | jah | nimi + telefon |
| **kas keegi on ohus** | jah | ainus jah/ei; „jah" → 112-ekraan, **mitte järjekorda** |

Rohkem ei küsita. Sissetulek, leibkond, eluase, varasemad teenused — **kõik see on
vastuvõtja töö küsida.** Pikk küsimustik kell 23.47 ei ole eelinfo kogumine, vaid filter,
mis jätab välja täpselt need, kelle pärast funktsioon olemas on.

### 3.3. Nupp, mitte klassifikaator

Kiireloomulisuse allikas on **ainult inimese enda tegu**. Kolm põhjust:

1. Tuvastuspõhine järjekord on inimeste järjestamine = triaaž = riskitunnus. See lõhuks
   platvormi keskse lubaduse („ühelegi ametnikule ei liigu automaatset teadet").
2. Tuvastus kukuks nagunii läbi: „homme on kohtutäitur ukse taga" ei jää ühtegi regexi
   külge; alahindaja jääb märkamata, dramaatiline saab valelipu.
3. **Ise-öeldud number on tugevam tõend:** „189 inimest vajutas nuppu" on vaieldamatu,
   „algoritm liigitas 189 juhtumit" on vaieldav.

Abiline **tohib küsida** („kas see on asi, mis ei kannata hommikuni?") — see on
ettepanek, mille inimene kinnitab või eirab. Sama muster, mis platvormil juba kehtib:
AI valmistab ette, inimene kinnitab.

### 3.4. Nupuvajutus on nõusolek

Eraldi „kas nõustud edastamisega" linnukest ei ole. Inimene ise palub info edasi saata —
toiming ja nõusolek on sama asi. Vorm ütleb selgelt, kuhu ja mis läheb; saatmine on
kinnitusega; kirje tekib „Minu jagamistesse"; tagasivõtt kehtib kuni avamiseni.

### 3.5. Enda sõnad läbi muutmata

Vastuvõtja näeb **inimese teksti sõna-sõnalt**. Kui abiline midagi struktureerib, on see
eraldi plokk ja märgitud kui masina mustand. Hädaolukorras kannab algne sõnastus
signaali, mille kokkuvõte tapab: *„ma ei tea, mis ma teen"* ja *„isik väljendas
ebakindlust"* ei ole sama teade.

### 3.6. Lüliti on saaja seadistus ise

**Eraldi funktsioonilippu ei tehta.** Server keeldub SK-pöördumist vastu võtmast, kui
valitud piirkonna jaoks ei ole seadistatud saajat **koos lugemisajaga**.

Tagajärg: nuppu ei saa tekkida ilma lauata, mis teda vastu võtab. Lekkinud lipp, vana
vahemälu, otse-URL ega rolli väärseadistus ei suuda toota nuppu, mis ei vii kuhugi.
Ohutusreegel elab arhitektuuris, mitte teostaja mälus.

Kuni ühtegi saajat seadistatud ei ole, on funktsioon **peidus ja päris isikuandmeteta**
— see on omaniku 28.07 „ehitus võib alata kohe, värav kehtib sisselülitamisele" reegli
rakendus koos selle ausa piiranguga (lipp väljas + 0 päris isikuandmeid + additiivne
skeem; sünteetiliste andmetega tohib täisvormis elada).

---

## 4. Andmemudel

Uus mudel, PreInquiry mustri järgi, aga oma elutsükliga. Enum'id eraldi — SK olekud ei
ole PreInquiry omad.

```prisma
enum UrgentRequestRecipientType { KOV_CONTACT  SERVICE_PROVIDER }
enum UrgentRequestStatus        { SENT  READ  TAKEN  DECLINED  RESOLVED  EXPIRED  RECALLED }

model UrgentRequest {
  id                  String   @id @default(cuid())
  authorId            String?
  authorErasedAt      DateTime?
  recipientDeskId     String?                        // vt E2
  recipientEntryId    String?                        // ServiceMapEntry
  recipientType       UrgentRequestRecipientType
  situationVerbatim   String   @db.Text              // inimese enda sõnad, MUUTMATA
  assistantStructured String?  @db.Text              // AI mustand, alati eraldi
  regionCode          String                          // „kus"
  contactName         String
  contactPhone        String
  safetyAnswer        Boolean                         // „kas keegi on ohus"
  status              UrgentRequestStatus @default(SENT)
  readingTimePromise  String                          // KÜLMUTATUD saatmise hetkel
  sentAt              DateTime @default(now())
  readAt              DateTime?
  takenAt             DateTime?
  declinedAt          DateTime?
  declineReason       String?
  resolvedAt          DateTime?
  expiresAt           DateTime                        // vt E5
  recalledAt          DateTime?
  convertedPreInquiryId String? @unique               // esiuks → tuba
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

Kaks nõuet, mis ei ole ilukirjandus:

- **`situationVerbatim` on ainus koht, kust vastuvõtja sisu loeb.** `assistantStructured`
  kuvatakse alati eraldi ja märgistatult, mitte selle asemel.
- **`readingTimePromise` külmutatakse saatmise hetkel** (tekstina, mitte viitena). Kui
  KOV muudab hiljem oma lugemisaega, ei tohi see tagantjärele muuta seda, mida inimesele
  öeldi.

---

## 5. Kaks kasutajale nähtavat haru ja puuduva saaja lukk

| Haru | Tingimus | Mis juhtub | Mida inimene näeb |
|---|---|---|---|
| **A — ühendatud** | saaja seadistatud + lugemisaeg olemas | `INTERNAL`, laud, teavitus | „läheb X lauale, loetakse …" |
| **B — ühendamata** | saajat või lugemisaega pole | rada on peidetud; otse-URL ja API on fail-closed | Sotsiaalkiirabi rada ei kuvata; tavaline teenuseotsing, AI nõuanne ja eelpöördumine jäävad kasutatavaks |
| **C — eluoht** | `safetyAnswer = true` VÕI `detectCrisis()` | vorm **ei liigu edasi**; 112 + 116 111 + 116 006 | kriisiekraan |

Haru B ei ole eraldi saatmisviis. See on ohutuslukk: kiireloomulise abi nupp ei tohi
tekitada muljet öisest vastuvõtust, kui tegelikku mehitatud saajat ja lubatud lugemisaega
ei ole. Liidestus võib olla tervikuna valmis ja sünteetiliste andmetega testitud, kuid
piirkond avaneb inimesele alles saaja seadistamisega.

---

## 6. Etapid

**E1 — andmemudel + serverikiht, fail-closed (0 UI).**
Mudel, migratsioon, teenuskiht, API. Saatmine keeldub, kui saajat lugemisajaga ei ole.
Tagasivõtt, päritolumärgistus ja marsruutimine võetakse **teegina** olemasolevast
koodist — mitte kopeerituna. Sünteetilised andmed, testid.
*DoD:* API keeldub ilma saajata; recall'i tingimused testitud; `db:migrate:check` puhas.

**E2 — saaja seadistus = lüliti.**
Laudade register: piirkond → laud → avalik nimi + tööaeg + kes tohib pöörduda +
eelhindamise tingimus + inimese kulu + **lugemisaeg** + omanik + kontakt + 112 piir +
`lastVerifiedAt`. Admin-vaade. Automatiseeritud korje võib anda muutuse hoiatuse, kuid
kiireloomulise raja tingimused kinnitab partner.
*DoD:* piirkond lülitub inimesele sisse ainult siis, kui mehitatud laud on aktiivne,
otse pöördumine on lubatud, lugemisaeg ja 112 piir on määratud ning tingimused pole
aegunud. Saaja lisamine ei muuda teiste piirkondade seisu.

**E3 — sissevõtt.**
Neli välja, hääl valikuline, kriisilukk esimese sammuna, saaja-põhine nähtavus, saatmise
kinnitus, kirje „Minu jagamistesse". ET/EN/RU.
*DoD:* `i18n:check` OK; kriisilukk fail-closed kõigis kolmes keeles; saajata piirkonnas
rada ei kuvata ning otse-URL-i ega API-ga ei saa kirjet luua.

**E4 — vastuvõtu laud + KOONDVAADE + üleandmine.**
Järjekord aja järgi; SK ja eelpöördumine **ühes vaates** (see on eraldi objekti hind);
vahetuse üleandmine; „võtan" / „ei jõua" tegevused; isikuline sündmusjada vastuvõtust,
vaatamistest, toimingutest ja edasisuunamisest.
*DoD:* koondvaade näitab mõlemat allikat; iga vaatamine ja toiming on seotud töötaja ning
kellaajaga; üleandmine säilitab, kes mida nägi, tegi ja kellele edasi andis.

**E5 — elutsükkel ja eitav vastus.**
`EXPIRED` automaatika; `DECLINED` **kohustuslik rada** — kui KOV ei jõua, saab inimene
teada (vaikus on halvim tulemus); säilitus + üleandmine; konversioon eelpöördumiseks
(esiuks → tuba), ilma et midagi uuesti trükitaks; öise juhtumi üleandmine õigele
päevasele üksusele koos vastuvõtukinnitusega.
*DoD:* ükski SK-kirje ei saa jääda vastuseta lõpmatuseks; konversioon ei kaota
verbatim-teksti; üle antud juhtumil on nimetatud vastuvõttev üksus ja kinnitatud
vastuvõtmise aeg.

**E6 — mõõdik + koondkontroll.**
k≥5 koond: mitu ise-deklareeritud kiireloomulist pöördumist, mis kellaajal, mis
piirkonnas — **ilma sisuta**. Sünteetiline runtime-sond, lõpparuanne.
*DoD:* koond ei väljasta ühtegi rühma alla 5; sond tõendab ühendatud saaja voo,
saajata piirkonna serverikeelu ja eluohtliku olukorra kriisiluku. Partneri aktiveerimise
eel läbib sünteetiline proov kogu ahela: avalik saatmine → mehitatud laua vastuvõtt →
lugemisaja täitmine → vastuvõtmine või põhjendatud keeldumine → vajadusel päevase üksuse
vastuvõtukinnitus.

---

## 7. Otsused

| Kood | Küsimus | Seis |
|---|---|---|
| **O-SK-3** | **Ühendamata KOV: kas nupp on nähtav või peidetud kuni saajani?** | **OTSUSTATUD 30.07:** peidetud. Server keeldub kirjet loomast, kui saajat koos lugemisajaga ei ole. Liidestus ehitatakse valmis ja seda testitakse sünteetiliselt. |
| O-SK-1 | Kas platvorm tohib KOV-lepingu olemasolul saata oma domeenilt? | **SK-V1 skoobist väljas:** V1 kasutab seadistatud sisemist vastuvõtulauda. Küsimus jääb asjakohaseks tavalise välise eelpöördumise jaoks (`SotsiaalAI.md` H-A õigusselgus). |
| O-SK-2 | Kaks vastutavat töötlejat või vastutav + volitatud? | Sama selgitustaotlus. Ei blokeeri E1–E2. |
| O-SK-4 | Säilitusaeg platvormil pärast üleandmist | Omaniku otsus enne E5. |
| O-SK-5 | Teenuseosutaja kiirreageerimise võimekus — kes lülitab, mis tõendi alusel? | Soovitus: värav = MTR/tegevusloa kontroll avalikust registrist (C-tabel A4). Keegi ei kuuluta end ise kiirreageerijaks. |
| O-SK-6 | `detectUrgencyLevel` märksõnatagavara PreInquiry's (`lib/preInquiries.js:330`) | SK-d ei blokeeri. Aga otsustada: kas jääb (dokumenteeritult „soovitus vastuvõtjale, mitte järjestus") või kaob. |
| O-SK-7 | Avalik nimi: „Sotsiaalkiirabi", „kiire sotsiaalabi" või muu? | **OTSUSTATUD 30.07:** SotsiaalAI üldine avalik nimi on **„Kiireloomuline abipalve"**. `SOTSIAALKIIRABI-V1` jääb sisemiseks teemakoodiks. Partneri teenusenime kuvatakse ainult siis, kui rada viib päriselt selle teenuse mehitatud vastuvõttu. Põhjus: Eestis tähendab „sotsiaalkiirabi" juba mitut erinevat väljasõidu- ja tugimudelit ning SoM 2026 analüüs ei pea nimetust enne ühist kokkulepet põhjendatuks. |

---

## 8. KOV-lepingu lisa (10 punkti)

Need ei sisaldu tavalises asutuselitsentsis ja peavad olema kirjas enne haru A
aktiveerimist:

1. **Saaja on funktsionaalne laud**, mitte nimeline töötaja — ja laual on omanik.
2. **Lugemisaeg, mitte reageerimisaeg.** KOV ei luba, et keegi tuleb; ta lubab, et keegi loeb.
3. **Rollid** — kaks vastutavat töötlejat või vastutav + volitatud (O-SK-2).
4. **Eitava vastuse kohustus.** Kui KOV ei jõua, saab inimene teada. Lepingus, mitte hea tahte peal.
5. **Säilitus ja üleandmine.** Ametlik kandja = KOV; platvormile jääb inimese enda koopia.
6. **KOV ei tohi saabuvatest teadetest koostada riskinimekirja.** Ilma selleta sureb
   „kedagi ei kanta riskirühma" partnerluse sees.
7. **k≥5 lugemisõigus** — platvorm tohib loendada, mitte lugeda sisu.
8. **Isikuline vastutusjälg.** Funktsionaalse laua taga seotakse iga vaatamine, toiming
   ja edasisuunamine konkreetse töötaja ning kellaajaga.
9. **Vahetuse ja üksuse üleandmine.** Leping määrab, kuhu liigub lahendamata öine juhtum
   päeval ning milline kinnitus tõendab, et järgmine üksus võttis selle vastu.
10. **Sisenemis- ja suunamisahel.** Avalik otsepöördumine ei sõltu päevase sotsiaaltöötaja
   eelhinnangust. Leping nimetab eraldi, kes võib ametnikukanalist juhtumi suunata,
   millisel õiguslikul alusel, millise ohuhinnangu järgi ja millal liigub inimene 112
   rajale. Enne avamist tehakse kogu ahelaga tööajaväline proov.

---

## 9. Väravad ja riskid

**Väravad enne igat commit'i:** `npm test`, `npm run i18n:check`, eslint muudetud
failidel, `npm run db:migrate:check` (E1 on ainus migratsioon).

| Risk | Vastus |
|---|---|
| Nupp ilmub ilma vastuvõtjata | lüliti = saaja seadistus (3.6); server fail-closed, mitte UI-peitmine |
| Vastuvõtja ei märka lühikest teadet | E4 koondvaade — eraldi objekti hind, mida ei tohi vahele jätta |
| Nõusoleku/tagasivõtu loogikast tekib kaks teostust | E1: teegina, mitte kopeerituna |
| Inimene jääb vastuseta | E5 `DECLINED` kohustuslik rada |
| Funktsioon muutub 112 asenduseks | 2.1 + haru C + `detectCrisis()` esimese lukuna |
| Skoop libiseb valvegraafiku ja dispetši poole | SK-V1 lõpeb laual. Graafik, vahetused ja väljasõit on SOTSIAALVALVE, eraldi teema |
| Avalik nimi lubab rohkem kui funktsioon teeb | O-SK-7: UI ütleb „Kiireloomuline abipalve", mitte „Sotsiaalkiirabi" ega „abi on teel"; partneri nimi ainult päris ühenduse korral |
| Teenus on tehniliselt valmis, kuid ühtegi juhtumit ei jõua kohale | KOV-lepingu p 10 + E6: otsene sissepääs, suunamisõigus, avalik teavitus ja tööajaväline läbiv proov; valmisolekut ei loeta kasutuselevõtuks |

---

## 10. Seis

`READY_FOR_BUILD`. O-SK-3 on otsustatud: ühendamata piirkonnas rada ei kuvata ja server
ei võta kirjet vastu. Funktsioon ehitatakse tervikuna liidestusvalmis, kuid seda saab
enne partneri saaja seadistamist katsetada ainult sünteetiliste andmetega. O-SK-2,
O-SK-4 ja O-SK-5 tuleb lahendada enne neid puudutava päris partneri või avaliku kasutuse
aktiveerimist, mitte enne peidetud terviku ehitamist. O-SK-7 on lahendatud.
