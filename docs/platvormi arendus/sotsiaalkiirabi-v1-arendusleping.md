# `SOTSIAALKIIRABI-V1` (SK-V1) — arendusleping

STATUS: `READY_FOR_BUILD_AFTER_O-SK-3` — disain on omanikuga läbi vaieldud ja kinnitatud
29.07.2026; kood kirjutamata; üks otsus blokeerib sissevõtu-UI (ptk 7).

- **Ülesanne:** pöörduja-poolne kiireloomulise sotsiaalabi kanal — inimene ütleb ise, et
  olukord ei kannata hommikuni, ja tema enda sõnadega kirjeldus liigub tema valitud KOV-i
  lauale või teenuseosutajale.
- **Iseloom:** arendusleping teostajale. Kõik koodiseisu väited kannavad failiviidet ja on
  kontrollitud 29.07.2026 töökoopiast (`main`, commit'imata töö peal).
- **Ajend:** Virro & Leesment, „Sotsiaaltöö aastal 2050. Unistus sotsiaalkiirabist",
  ajakiri Sotsiaaltöö 2/2025. Nende ettepanek on **füüsiline** väljasõiduüksus. SK-V1 ei
  ole see. SK-V1 on **eelkiht ja väljakutsepind** — vt ptk 2.
- **Seotud:** `SotsiaalAI.md` ptk 4 C-tabel (SOTSIAALVALVE, Häirekeskuse järelsuunamise
  sild), 5.4 (AI-määruse positsioon), 5.9 (anti-engagement), T26 partnerpiloot.

---

## 1. Lähteseis — mis on koodis olemas (kontrollitud 29.07.2026)

| Fakt | Koht | Tähendus SK-V1-le |
|---|---|---|
| Saajatüübid `KOV_CONTACT` / `SERVICE_PROVIDER` | `prisma/schema.prisma:319`, `lib/preInquiryRouting.js:21` | mõlemad pooled on juba modelleeritud; SK saab oma enum'i sama kujuga |
| Kanalid `INTERNAL` / `EXTERNAL_EMAIL` | `prisma/schema.prisma:324` | kolme haru mudel (ptk 5) on olemasoleva mustri kordus |
| **`externalSendConfirmedAt`** | `prisma/schema.prisma` (`model PreInquiry`) | **„inimene saatis ise, platvorm salvestas tema kinnituse" on juba väljakujunenud muster** — SK ei leiuta seda |
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
enum UrgentRequestChannel       { INTERNAL  PERSON_SENT_EMAIL }
enum UrgentRequestStatus        { SENT  READ  TAKEN  DECLINED  RESOLVED  EXPIRED  RECALLED }

model UrgentRequest {
  id                  String   @id @default(cuid())
  authorId            String?
  authorErasedAt      DateTime?
  recipientDeskId     String?                        // vt E2
  recipientEntryId    String?                        // ServiceMapEntry
  recipientType       UrgentRequestRecipientType
  channel             UrgentRequestChannel @default(INTERNAL)
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
  personSendConfirmedAt DateTime?                     // PERSON_SENT_EMAIL haru
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

## 5. Kolm haru KOV-i seisu järgi

| Haru | Tingimus | Mis juhtub | Mida inimene näeb |
|---|---|---|---|
| **A — ühendatud** | saaja seadistatud + lugemisaeg olemas | `INTERNAL`, laud, teavitus | „läheb X lauale, loetakse …" |
| **B — ühendamata** | saajat pole | platvorm **koostab kirja**, inimene saadab **oma postikliendist** (`mailto:`), kinnitus → `personSendConfirmedAt` | „see kiri läheb sinu nimel aadressile Y; nad loevad tööpäeviti alates 8-st" |
| **C — eluoht** | `safetyAnswer = true` VÕI `detectCrisis()` | vorm **ei liigu edasi**; 112 + 116 111 + 116 006 | kriisiekraan |

Haru B täpsustus: platvorm **ei saada inimese aadressilt** (SPF/DKIM) ega oma domeenilt
(siis oleks saatja tema). Kiri lahkub inimese enda kliendist; platvorm salvestab tema
kinnituse. Muster on koodis olemas (`externalSendConfirmedAt`).

Haru B on ajutine ja kaob iga uue partneriga — ja ta surub haru A poole: iga KOV, kes
hakkab neid kirju saama, tahab lõpuks lauda.

---

## 6. Etapid

**E1 — andmemudel + serverikiht, fail-closed (0 UI).**
Mudel, migratsioon, teenuskiht, API. Saatmine keeldub, kui saajat lugemisajaga ei ole.
Tagasivõtt, päritolumärgistus ja marsruutimine võetakse **teegina** olemasolevast
koodist — mitte kopeerituna. Sünteetilised andmed, testid.
*DoD:* API keeldub ilma saajata; recall'i tingimused testitud; `db:migrate:check` puhas.

**E2 — saaja seadistus = lüliti.**
Laudade register: piirkond → laud → **lugemisaeg** + omanik + kontakt. Admin-vaade.
Ilma kirjeta ei ole funktsiooni.
*DoD:* laua lisamine lülitab funktsiooni selle piirkonna jaoks sisse ja ei tee midagi muud.

**E3 — sissevõtt.**
Neli välja, hääl valikuline, kriisilukk esimese sammuna, kolm haru, saatmise kinnitus,
kirje „Minu jagamistesse". ET/EN/RU.
*DoD:* `i18n:check` OK; kriisilukk fail-closed kõigis kolmes keeles; haru B `mailto` töötab
ilma platvormi-saatmiseta.

**E4 — vastuvõtu laud + KOONDVAADE + üleandmine.**
Järjekord aja järgi; SK ja eelpöördumine **ühes vaates** (see on eraldi objekti hind);
vahetuse üleandmine; „võtan" / „ei jõua" tegevused.
*DoD:* koondvaade näitab mõlemat allikat; üleandmine säilitab, kes mida nägi.

**E5 — elutsükkel ja eitav vastus.**
`EXPIRED` automaatika; `DECLINED` **kohustuslik rada** — kui KOV ei jõua, saab inimene
teada (vaikus on halvim tulemus); säilitus + üleandmine; konversioon eelpöördumiseks
(esiuks → tuba), ilma et midagi uuesti trükitaks.
*DoD:* ükski SK-kirje ei saa jääda vastuseta lõpmatuseks; konversioon ei kaota verbatim-teksti.

**E6 — mõõdik + koondkontroll.**
k≥5 koond: mitu ise-deklareeritud kiireloomulist pöördumist, mis kellaajal, mis
piirkonnas — **ilma sisuta**. Sünteetiline runtime-sond, lõpparuanne.
*DoD:* koond ei väljasta ühtegi rühma alla 5; sond läbib kõik kolm haru.

---

## 7. Otsused

| Kood | Küsimus | Seis |
|---|---|---|
| **O-SK-3** | **Ühendamata KOV: kas nupp on üldse nähtav (haru B), või peidetud kuni saajani?** | **BLOKEERIB E3.** See määrab, kas nupp on lubadus või pettumus. Soovitus: haru B nähtav, sest ta surub haru A poole ja on ausam kui nupu puudumine — aga sõnastus peab olema karm („keegi ei tule täna öösel"). |
| O-SK-1 | Kas platvorm tohib KOV-lepingu olemasolul saata oma domeenilt? | Ootab SoM/SKA selgitustaotlust (`SotsiaalAI.md` H-A õigusselgus). Kuni vastuseta: haru B ainult inimese kliendist. |
| O-SK-2 | Kaks vastutavat töötlejat või vastutav + volitatud? | Sama selgitustaotlus. Ei blokeeri E1–E2. |
| O-SK-4 | Säilitusaeg platvormil pärast üleandmist | Omaniku otsus enne E5. |
| O-SK-5 | Teenuseosutaja kiirreageerimise võimekus — kes lülitab, mis tõendi alusel? | Soovitus: värav = MTR/tegevusloa kontroll avalikust registrist (C-tabel A4). Keegi ei kuuluta end ise kiirreageerijaks. |
| O-SK-6 | `detectUrgencyLevel` märksõnatagavara PreInquiry's (`lib/preInquiries.js:330`) | SK-d ei blokeeri. Aga otsustada: kas jääb (dokumenteeritult „soovitus vastuvõtjale, mitte järjestus") või kaob. |

---

## 8. KOV-lepingu lisa (7 punkti)

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

---

## 10. Seis

`READY_FOR_BUILD_AFTER_O-SK-3`. E1 ja E2 on otsustevabad ja võib alustada kohe —
nad ei sisalda päris isikuandmeid ega ühtegi nähtavat pinda.
