# SEIS — SotsiaalAI arenduse elav seisufail

STATUS: SINGLE SOURCE OF TRUTH

## 0. Kuidas seda faili lugeda ja kirjutada

**Fail on järjestatud TEEMA, mitte kuupäeva järgi.** Kronoloogiline kandevoog kolis
03.08.2026 faili [`SEIS-ajalugu.md`](./SEIS-ajalugu.md) — sealt ei loeta olekut, sealt
loetakse põhjendust („miks see nii tehti"). Põhjus: ajajärjestuses ei saa fakti parandada,
saab ainult uue kande lisada, ja sama teema laguneb kümnesse kohta. Teemasektsiooni saab
parandada kohapeal.

**MAHUREEGEL (omanik 03.08).** Mahtu ei tohi võtta **teostuslugu** — SHA-ahelad,
merge-järjekorrad, mõõtmisprotokollid, väravate tulemused, „mis päeval mis parandati".
See kõik elab ajaloos ja analüüsifailides.

| Olek | Mida kirjutada |
|---|---|
| **TEHTUD** | **lõik või kaks: mida funktsioon inimese jaoks teeb** — kellele, mis lubadusega, mis piiriga. Kirjutatud nii, et sellest saab otse infolehe või hinnakirja funktsioonikirjelduse tekst. Teostuslugu EI. |
| **POOLIK** | üks rida „mis töötab" + **nimeliselt kõik lahtised sabad** |
| **TEGEMATA** | mis see on, mis seda blokeerib, mis selle avab |

Kui sektsioon kasvab, kontrolli esimesena, kas keegi on valmis töö kohta **ajalugu** tagasi
kirjutanud — kirjeldus tohib olla pikk, kroonika mitte.

**HÜLJATUD VARIANTE EI KIRJELDATA (omanik 03.08).** Siia ei kirjutata „mida ei tule",
„kaalusime, aga otsustasime teisiti" ega pargitud alternatiive. Kui mingi lahendusvariant
langeb ära, ta lihtsalt kaob — sektsioon kirjeldab seda, mis on, ja seda, mis tuleb. Erand
on ainult **tootepiir**, mille inimene või partner peab teadma (nt „AI ei hinda õigust
teenusele", „ei ole hädaabinumber") — see ei ole hüljatud variant, vaid lubadus.

**Muud reeglid.** Olekut kannab AINULT see fail — `SotsiaalAI.md` (visioon ja plaan),
`ideed.md` (otsustamata ideed) ning ~130 analüüsi-, lepingu- ja auditifaili on detail ja
tõend, mitte olek; vastuolu korral kehtib SEIS.md. Pooleliolek kirjutatakse siia KOHE, mitte
töö lõpus.

### Sektsioonid

| # | Sektsioon | Seis |
|---|---|---|
| 0 | Kuidas lugeda + reeglid | ✅ |
| 1 | Alus (main, server, väravad) | ✅ |
| 2 | Pöörduja rada | ✅ |
| 3 | Hääl ja multimodaalsus | ✅ |
| 4 | **Kogu lahtine töö — täisnimekiri** | ✅ |
| 5 | Spetsialisti rada | ⏳ vana kujul allpool |
| 6 | Professionaalne areng ja ühistegevus | ⏳ vana kujul allpool |
| 7 | Ruumid ja kõned | ⏳ vana kujul allpool |
| 8 | Organisatsioon ja partnerid | ⏳ vana kujul allpool |
| 9 | Platvormi alused | ⏳ vana kujul allpool |
| 10 | Avalik pind ja release | ⏳ vana kujul allpool |
| 11 | Lahtised otsused | ⏳ vana kujul allpool |
| 12 | Ajalugu | → [`SEIS-ajalugu.md`](./SEIS-ajalugu.md) |

Sektsioon 4 on kogu lahtise töö täisnimekiri — sealt ei tohi ükski tegemata või poolik asi
puududa. Sektsioonid 5–11 on veel 03.08 seisutabeli kujul (allpool) ja kolivad siia sama
mustri järgi; sektsioon 4 jaotub nende vahel laiali alles siis, kui nad on olemas.

---

## 1. Alus

`main` = `origin/main` = `db514ba0`. Üks tööpuu, üks haru.

**Töökord (omanik 03.08, ülimuslik):** tööpuid ja harusid ei tehta, kõik läheb otse
`main`-i. Vt JADATÖÖ-sektsiooni täiendust allpool. Merge'i ja deploy luba küsitakse endiselt
eraldi.

**Viimane roheline mõõtmine** (03.08): `npm test` 2483/2483, `npm run i18n:check` OK,
`npx eslint .` 0 viga. Serveri seisu 03.08 tabeliringis eraldi üle ei kontrollitud.

---

## 2. Pöörduja rada

### Tehtud

**Vestlus ja teadmusbaas.**
SotsiaalAI vestlusaken vastab sotsiaalvaldkonna küsimustele eesti, inglise ja vene keeles
ööpäev läbi. Vastus ei tule mudeli mälust, vaid platvormi teadmusbaasist: seadustest,
riigi juhenditest, KOV-ide teenuskirjeldustest ja ajakirja Sotsiaaltöö materjalidest — ja
iga vastuse juures on näha, millisele allikale ta tugineb. Inimene saab kontrollida, kust
lause tuli, ja minna algallika juurde. Vestlus ei nõua kellegi teise järjekorras ootamist
ega tööaega.

Vestlusesse on sisse ehitatud kriisirada: kui jutust tuleb välja vahetu oht elule või
tervisele, katkeb tavaline vastamine ja ette tulevad hädaabi ja usaldustelefonide numbrid.
See lukk töötab kõigis kolmes keeles ja on tahtlikult „fail-safe" — pigem käivitub liiga
tihti kui liiga harva. AI ei hinda kellegi õigust teenusele ega abivajaduse taset; ta
selgitab, valmistab ette ja suunab.

**Teekond.**
Teekond on inimese enda lugu ühes kohas: mis mure on, mida on juba proovitud, kellega on
räägitud, mis on järgmine samm. See ei ole ametniku toimik ega register — kirje kuulub
inimesele endale ja liigub tema otsusel edasi. Teekonnalt saab ühe vajutusega minna
eelpöördumise koostamisse, teenusekaardile või abivahenduse rajale, ilma et midagi tuleks
uuesti kirjutada. Sisse on ehitatud kaks eraldi selgitajat: abivahendi hankimise teekond
(tõend → loetelu → piirhind → müüja) ja tervishoiukontakti rada.

**Eelpöördumine ja vastuvõtulaud.**
Eelpöördumine on inimese poolt ettevalmistatud pöördumine kohalikule omavalitsusele või
teenuseosutajale. Inimene kirjeldab olukorra rahulikult ette, AI aitab selle
struktureerida — aga saadab alati inimene ise ja saatmise hetkel on näha täpselt, mis ja
kellele läheb. Kuni vastuvõtja ei ole kirja avanud, saab pöördumise tagasi võtta. Kõik
saadetu jääb inimesele endale nähtavaks vaates „Minu jagamised".

Vastuvõtja poolel on laud, kus pöördumised seisavad järjekorras koos ettevalmistatud
kokkuvõttega. Ametnik näeb inimese enda sõnu ja AI koostatud struktuuri eraldi ja
märgistatult — masina mustandit ei esitata kunagi inimese ütlusena.

**Teenusekaart ja teenuseprofiil.**
Teenusekaart näitab, millised sotsiaalteenused ja osutajad piirkonnas olemas on, kellele
nad on mõeldud ja kuidas nendeni jõuab. Osutajal on oma profiil, mida ta ise haldab.
Kaardil on kättesaadavuse elav signaal — teenuse info ei jää seisma sinna, kus ta kunagi
sisestati.

**Abisoovid ja -pakkumised.**
Inimene saab kirja panna, millist abi ta vajab, ja teine pool selle, mida ta pakub;
platvorm viib need kokku. Vestlusest saab töövoo käivitada otse — soovi ei pea eraldi
vormilt otsima.

**Isiklik otsing.**
Otsing inimese enda materjali sees: vestlused, teekond, dokumendid, jagamised. See on ainus
otsing platvormil, mis vaatab isiklikku sisu — ja ta vaatab ainult seda, mis kuulub
otsijale endale.

**Dokumendid ja koostamine.**
Dokumendi saab platvormile tuua, lasta sellest teha kokkuvõte või süvaanalüüs ning koostada
uut teksti olemasoleva põhjal. Helisalvestisest tehakse transkriptsioon ja koosolekust
kokkuvõte. Iga AI koostatud osa kannab märget, et tegemist on mustandiga.

**Eksport ja andmekoopia.**
Inimene saab oma andmetest koopia ja saab oma materjali välja viia PDF- või DOCX-kujul.
See lubadus ei sõltu tellimusest: ligipääs oma andmetele ei aegu kunagi.

### Poolik

| Teema | Mis töötab | Lahtised sabad |
|---|---|---|
| Teadmusbaas | otsing + allikaviited + mõõdetud kvaliteedi lähtejoon | P8.6 päris allikate proovipakk; allikavärskuse timerite aktiveerimine (omaniku otsus) |
| Teekond | tuum LIVE | TK-P0 jagamispiir — **03.08 kontrollimata, ei tea kummaski suunas**; Teekonna kompass (horisont C) |
| Teenusekaart | kaart + kättesaadavus | loendivaade/klasterdamine; usaldusmärgistus — vajab MTR-kontrolli (vt tegemata) |
| Abisoovid | kood valmis | kriitiline mass (kasutajad); match-nõusoleku tooteotsus; moderatsioonimudel |
| Eelpöördumine | täisrada koodis | piloodis tõendamata — vajab KOV-partnerit |

### Tegemata

- **Toimetulekutoetuse eelkalkulaator** — SHS § 131–134 deterministlik valem, informatiivne eelhinnang, MITTE otsus. Eraldi koodi ei ole. Registris märgitud „pöörduja tapjafunktsiooniks"; ei vaja partnerit ega õigusanalüüsi.
- **MTR/tegevusloa kontroll** — avalik register → usaldusmärgise objektiivne alus. Topeltroll: vajalik ka SK-V1 osutaja-raja otsustamiseks (O-SK-5).
- **SOTSIAALKIIRABI-V1** — 0 rida koodi, `READY_FOR_BUILD`. Vt sektsioon 7.

---

## 3. Hääl ja multimodaalsus

Juhtprintsiip (`SotsiaalAI.md` ptk 4): **hääl ja kaamera on liides, mitte teine aju** — iga
sisuline vastus käib läbi sama tekstitorustiku (teadmusbaas + allikad + kriisirada +
kvoodid), mis kannab platvormi lubadusi.

### Tehtud

**Dikteerimine vestlusaknas.**
Kui kirjutamine on raske — käed on kinni, silmad väsinud, olukord ärev või kirjatöö lihtsalt
ei ole inimese tugevus — saab oma mure vestlusaknasse rääkida. Mikrofon on komposeris
tekstivälja kõrval, salvestus käib vajutusega ja kõne muudetakse tekstiks, mille inimene
näeb ja saab enne saatmist parandada. Tekstiväli on alati nähtav ja mikrofon seisab selle
kõrval lisavõimalusena — inimene võib vahetada kirjutamise ja rääkimise vahel keset vestlust.

**Ettelugemine.**
Vastuseid saab kuulata eesti, inglise ja vene keeles. See teenib kahte gruppi korraga:
nägemispuudega või lugemisraskustega inimesi ning neid, kes tahavad pikka selgitust kuulata
samal ajal, kui käed on muuga hõivatud.

**Helikõned ruumides.**
Platvormi ruumides saab pidada helikõne — kovisiooniks, supervisiooniks, võrgustikutööks või
kliendikohtumiseks. Kõne toimub platvormi sees, eraldi konverentsitarkvara ei ole vaja.
Salvestamine ei ole vaikimisi sees ja käivitub ainult siis, kui osalejad on selleks
selgesõnalise nõusoleku andnud; salvestise eesmärk märgitakse ette ära.

**Heli dokumentides.**
Salvestisest saab transkriptsiooni ja koosolekust kokkuvõtte. See kaotab ära käsitsi
ümberkirjutamise, mis on üks valdkonna vaiksemaid ajaröövleid — ja kokkuvõte jääb mustandiks,
mille inimene üle vaatab.

**Välitöö dikteerimine.**
Välitöö kestas saab külastuse märkme rääkida kohapeal ära, ka siis, kui internetti ei ole —
kirje läheb järjekorda ja sünkroniseerub, kui võrk tuleb tagasi. Töötaja ei pea kandma
märkmeid peas kontorisse tagasi.

Kõne ja ettelugemine kasutavad platvormi ühiseid arvesteid (`STT_SECONDS`, `TTS_CHARS`,
`CHAT_ASSISTANT_REPLY`) — häälekasutus käib olemasoleva kvoodi arvelt, eraldi häälepaketti
ei ole.

### Poolik — T03 E4/E5 karastus

Hääl töötab, aga tema servajuhud ei ole karastatud. Leping:
[`t03-chat-voice-v1-ulesanne.md`](./t03-chat-voice-v1-ulesanne.md) ptk E4/E5.

1. **Salvestuse katkestamine enne transkribeerimist** — blob visatakse ära, providerikutset ei tehta. *Privaatsuslubaduse küsimus, mitte mugavus.*
2. **2,5 min hoiatus/piir** + taimerite ja helirajade puhastus abort/error/success radadel.
3. **TTS locale-fallback** — RU/EN kasutaja ei tohi jääda vaikivasse ebaõnnestumisse.
4. **Mikrofoninupu kolm keeldu eristatud tekstina** — tellimusnõue vs brauseri loakeeld vs tehniline viga.
5. A11Y-seisud klaviatuuriga + reduced-motion → kuulub sektsiooni 8 a11y-sappa, ei dubleerita siin.
6. ET/EN/RU sümmeetria uuel copy'l → sama.

**Omaniku verdikt 03.08:** punktid 1–4 teha ära.

### Poolik — häälega seotud vead ruumides

Tõendatud ruumianalüüsis, **osa neist on nõusolekulubaduse rikkumine toodangus**:

- hiline liituja saab ainult `REQUESTED` nõusolekurea, **aga salvestus jätkub katkematult**;
- **nõusoleku tagasivõtmine ei peata egressi** — toorheli maandub storage'isse, failirida jääb igaveseks `PROCESSING`;
- „Helikõne toimus …" tekib ruumi kaks korda;
- salvestusriba staatusetekstid kõvakodeeritud eesti keeles — RU/EN kasutaja näeb eesti keelt.

Kuuluvad sektsiooni 6 (ruumid), aga on sama pere. **Tõsidusaste kõrgem kui T03 E4/E5.**

- **VEST-L8** — RU/EN TTS kvaliteedierinevus, märgitud lahtiseks ligipääsetavuse analüüsis.

### Tegemata

| Idee | Mis see on | Mis seda avab |
|---|---|---|
| **Kõnerežiim** | eraldi pind nagu telefonikõne: lahtine mikrofon, VAD teeb vooruvahetuse (~0,7 s vaikus), elavad subtiitrid + allikakaardid ekraanil, barge-in kohustuslik. Arhitektuur: kaskaad (STT → olemasolev torustik → voogav TTS) → siht „õhuke hääl, paks server". **Uusi teenusepakkujaid ei vaja, uut kvooti ei looda.** „3 lause leping": hääl annab tuuma, täisvastus koos allikatega maandub tekstina | omaniku hinnastusotsus (kas kõigil tasulistel või 14,99+) |
| **Häälkäsklused — „kaks rada, üks mikrofon"** | ruuter valib raja: sõnastikuvaste → kohalik refleks (sõnastik olemas, `roomDock.js`); muu → LLM kui kavatsuste tõlk. **AI ei saa kunagi vaba kätt ekraani üle** — sama piiratud kavatsuste sõnastik mis nooleklahvidel; navigeerimine kohe, loomine/saatmine/kustutamine kinnitusega | faas 1 (sõnastik + esiletõst) on otsustevaba |
| **Eesti TTS suveräänsus — TartuNLP** | MIT-litsents, ise-hostitav, 12 eesti neuraalset häält + 2 võro. Katsetus = kolmas pakkuja olemasolevasse TTS-route'i, **~50 rida lipu taga** | miski ei blokeeri; EKI on alternatiiv, aga ärikasutus vajab luba |
| **Lokaalsed mudelid** | Whisper/whisper.cpp eesti dikteerimiseks seadmes; VAD; eesti TTS-mudel; PII-märkaja | päästikud: riigipartneri „kus heli töödeldakse?", kasvav pilvearve, võrguta välitöö |
| **Häälvestlus supervisiooni-/kovisiooniruumis** | `ideed.md` 23.6. Range leping: ei salvestata vaikimisi, **automaatset transkripti ei tehta, AI ei kuula ega koosta kokkuvõtet**, superviisor ei saa ühepoolselt salvestamist käivitada | ESTA partnerlus |
| **Piiratud häälruum tervishoiukontaktis** | `ideed.md` MVP-loend | TERVIK-reform |
| **Kaamera / žestid** | MediaPipe brauseris, **kaader ei lahku seadmest**; vehe = liigu, näpistus = vali | VR-viilude järel |

---
## 4. Kogu lahtine töö — täisnimekiri

Koostatud 03.08 läbiva korjega: `ideed.md` (29 peatükki), `SotsiaalAI.md` register,
`shs-katvuskaart.md`, ~130 analüüsi- ja lepingufaili. Korje leidis **122 paketikoodi**
(`XXX-Pn`) — varem ei olnud neist üheski nimekirjas rohkem kui paarkümmend.

**Miks see sektsioon olemas on:** omanik 03.08 — *„lihtsalt kõik kanna tegemata, ma ei
näinud neid."* Kui funktsioon ei ole siin, siis teda praktikas ei ole olemas: teda ei
plaanita, ei prioriseerita ega mäletata.

**Kaks liiki tööd, mida ei tohi ühte nimekirja panna (omanik 03.08).**

| Liik | Mis see on | Mida vajab |
|---|---|---|
| **TÖÖRIIST** | suurem funktsioon — uus võimekus, mida täna ei ole | oma arendusleping, oma DoD, sageli migratsioon ja otsus/partner |
| **VÄIKE MUUDATUS või LISA** | parandus, saba või täiendus olemasoleva funktsiooni sees | ei vaja lepingut; kirjelduse ja väravad mahuvad ühte tööringi |

Kõik allpool on üks või teine. Vahepealset kategooriat ei tehta — kui kahtled, on ta
tööriist ja vajab lepingut.

---

### 4.1. TÖÖRIISTAD — suuremad funktsioonid

#### Juhtumikorraldus

`ideed.md` ptk 4 kannab tervet kontseptsiooni **„Juhtumitöö assistent STAR2 kõrval"**, mida
üheski senises seisunimekirjas ei olnud.

| Tööriist | Sisu | Mis blokeerib |
|---|---|---|
| **Juhtumi objekt elutsükliga** | juhtum → plaan → tegevused → ülevaatus → sulgemine. **Skeemis on 157 mudelit ja juhtumit nende hulgas ei ole** — on ainult artefaktid (`CASE_SUMMARY`, `CASE_BRIEF`, `ACTION_PLAN`, `STAR_HELPER`) | analüüsimata; ptk 4.7/10 „paralleelset kliendibaasi ei looda" on otsus, mis väärib ülevaatust |
| Juhtumitöö assistendi töölaud (4.3) | töötaja juhtumite koondvaade | eelmine |
| Ühe tööprotsessi assistendivaade (4.4) | üks juhtum algusest lõpuni | eelmine |
| STAR2 kandmise järjekord + mustand (4.5–4.6) | mustand registri väljade kujul | Teenuspäeviku väljavõte on olemas (`lib/serviceLog/export/star.js`); juhtumi mustandit ei ole |

#### Võrgustikutöö ja ühistegevus

| Tööriist | Sisu | Mis blokeerib |
|---|---|---|
| **COLLAB-P4 võrgustiku vertikaal** | kinnitatud kokkuvõte → üks piiratud nähtavusega kutse → kirjalik ruum → kokkuleppemustand | **miski ei blokeeri** — kõik osalejad on kasutajad, O-CO-6 ei kehti |
| COLLAB-P5 võrgustiku täisfunktsioon | mittekasutajate kirjed võrgustikus | O-CO-6 GDPR-analüüs |
| COLLAB-P6 kohtumise ühisvaade | päevakord, otsused, ülesanded, kinnitusring. **Täna kannavad kohtumisi kolm eraldi mudelit** (`SupervisionMeeting`, `MentoringMeeting`, `lib/calls/`) ja ühist vaadet ei ole | O-CO-2 |
| Võrgustikukaart (`ideed.md` 5.5) | professionaalne võrgustikukaart | vt visuaalsed |

#### Visuaalsed professionaalsed tööriistad

| Tööriist | Seis | Mis blokeerib |
|---|---|---|
| **Genogramm** (9.1, T21 E4) | **0 rida koodi**; leping valmis: [`t21-casework-vorgustikuvaated-ulesanne.md`](./t21-casework-vorgustikuvaated-ulesanne.md) | V1 + V2 (allpool) |
| **Ökokaart** (9.2, T21 E5) | **0 rida koodi** | sama |
| Professionaalne võrgustikukaart (9.3) | 0 rida | sama |

Väravad: **V1** art 14 teavitamiskohustus (kas kolmandat isikut teavitatakse, millal, mis
mehhanismiga) ja **V2** vastutav töötleja (KOV või platvorm). O-CW-7 lahendas juba raskema
küsimuse — genogramm on tavapraktika seadusest tuleneva ülesande peal, meedium ei loo uut
töötlemist. **V1/V2 ja COLLAB-P5 O-CO-6 on osaliselt sama küsimus:** mis staatuses on
inimene, kes ei ole kasutaja, aga kelle kohta kaardil kirje on. Küsi ühe
selgitustaotlusega — vastus avab korraga T21 E1–E6 ja COLLAB-P5.

#### Meetodid ja refleksioon

| Tööriist | Mis blokeerib |
|---|---|
| **Meetodite ja töövõtete kataloog** (`ideed.md` ptk 7, kuus perekonda A–F) | — |
| Meetodi valimise assistent (8.4) | eelmine |
| Sekkumispäevik (8.5) | — |
| Kliendi tagasiside (8.6) | omaniku otsus |
| Praktika arenguvaade (8.8) | — |

#### Seadusest tulenevad moodulid (`shs-katvuskaart.md`)

| # | Moodul | Mis blokeerib |
|---|---|---|
| A1 | Erihoolekande profiil Teenuspäevikule (§ 70–107) — tegevusplaan + kvartali- ja aastahinnang on seadusega ette kirjutatud aruanderütm; kataloogis „suurim leid" | — |
| A2 | **Toimetulekutoetuse eelkalkulaator** (§ 131–134) — deterministlik valem, informatiivne eelhinnang, MITTE otsus | **miski ei blokeeri** |
| A4 | **MTR/tegevusloa kontroll** (§ 147–155) | miski ei blokeeri; **avab ka teenusekaardi usaldusmärgise ja SK-V1 O-SK-5 värava** |
| A5 | Võlanõustamise eelkaardistus (§ 44–45) | — |
| A6 | Sotsiaaltransport Teenuspäeviku tüübina (§ 38–40) | — |
| A7 | „Teata abivajajast" avalik juhis (§ 13, igaühe kohustus) — kontota avalik leht | — |
| A8 | Hooldekodu valiku rada (§ 20–22²) | — |
| A9 | Kriisirežiimi seaduslik konks (§ 13¹) | — |

*(A3 abivahendi teekond on tehtud — `lib/journey/assistiveDevices.js`.)*

#### Hääl ja multimodaalsus

Kõnerežiim, häälkäsklused („kaks rada, üks mikrofon"), lokaalsed mudelid, häälvestlus
supervisiooniruumis, kaamera/žestid — täisloend koos blokeerijatega on **sektsioonis 3**,
siin ei dubleerita.

#### Muud

| Tööriist | Mis blokeerib |
|---|---|
| **SOTSIAALKIIRABI-V1** — 0 rida, `READY_FOR_BUILD` | E1+E2 otsustevabad; leping [`sotsiaalkiirabi-v1-arendusleping.md`](./sotsiaalkiirabi-v1-arendusleping.md) |
| SUP-P1…P11 supervisiooni täismudel | omaniku prioriseerimine |
| TK-P1…P5 + Teekonna kompass | — |
| T08 failide ja meedia elutsükkel | omaniku otsus |
| T19 ruumiline töölaud | DEFERRED |

---

### 4.2. VÄIKSED MUUDATUSED JA LISAD — olemasoleva sees

Liik: **VIGA** = lubadus on katki · **SABA** = väljalastud funktsiooni lõpetamata ots ·
**LISA** = väike täiendus · **LÜLITI** = kood olemas, ootab otsust.

| # | Mis | Kus | Liik |
|---|---|---|---|
| 1 | Hiline liituja saab ainult `REQUESTED` nõusolekurea, **aga salvestus jätkub katkematult** | ruumid | **VIGA** |
| 2 | **Nõusoleku tagasivõtmine ei peata egressi** — toorheli maandub storage'isse, failirida jääb igaveseks `PROCESSING` | ruumid | **VIGA** |
| 3 | „Helikõne toimus …" tekib ruumi kaks korda | ruumid | VIGA |
| 4 | Salvestusriba staatusetekstid kõvakodeeritud eesti keeles — RU/EN kasutaja näeb eesti keelt | ruumid | VIGA |
| 5 | Salvestuse katkestamine enne transkribeerimist — blob peab ära lendama, providerikutset ei tehta | hääl (T03 E4) | **VIGA** |
| 6 | 2,5 min hoiatus/piir + taimerite ja helirajade puhastus abort/error/success radadel | hääl (T03 E4) | SABA |
| 7 | TTS locale-fallback — RU/EN kasutaja ei tohi jääda vaikivasse ebaõnnestumisse | hääl (T03 E4) | SABA |
| 8 | Mikrofoninupu kolm keeldu eristatud tekstina (tellimus / brauseri loakeeld / tehniline viga) | hääl (T03 E4) | SABA |
| 9 | VEST-L8 — RU/EN TTS kvaliteedierinevus | hääl | SABA |
| 10 | TartuNLP kolmanda TTS-pakkujana, **~50 rida lipu taga** — ise-hostitav, 12 eesti häält | hääl | LISA |
| 11 | `ROOM_OWNERSHIP_TRANSFERRED` teavitus | COLLAB-P3 jääk | SABA |
| 12 | U1 mitme-osaleja audience-reegel — `lib/events/recipients.js` tunneb ainult `OWNER`/`AUTHOR`/`RECIPIENT_OWNER` | töölaud/teavitused | SABA |
| 13 | Kvoodileke (`lib/storageGuardrails.js`) | PERF-P0 jääk | VIGA |
| 14 | L3 renewals-timerid | PERF-P0 jääk | SABA |
| 15 | L5 kuluajaloo retention | PERF-P0 jääk | SABA |
| 16 | Teenusekaardi loendivaade / klasterdamine | teenusekaart | LISA |
| 17 | RV-P1 rollivahetaja jätk + tõlkestrateegia | a11y | SABA |
| 18 | A11Y P1 juured | a11y | SABA |
| 19 | RAG P8.6 päris allikate proovipakk | teadmusbaas | SABA |
| 20 | RAG allikavärskuse timerite aktiveerimine | teadmusbaas | **LÜLITI** |
| 21 | Maksete recurring sisselülitamine — mõlemad rajad koodis olemas | maksed | **LÜLITI** |
| 22 | Päris Maksekeskuse ost toodangus tõendamata | maksed | SABA (QA) |
| 23 | Kovisiooni privaatne märkmik | kovisioon | LISA |
| 24 | Lõuendireegel uues cvl-kestas rikutud | kovisioon | VIGA |
| 25 | TK-P0 jagamispiir — **kontrollimata, ei tea kummaski suunas** | teekond | kontrolli enne liigitamist |

**Neli esimest ja punkt 5 on nõusoleku- ja privaatsuslubaduse rikkumised** — need ei ole
kosmeetika ja peaksid liikuma enne uusi tööriistu.

---

### 4.3. Paketikoodide täisinventuur

Korje leidis **122 koodi**. Perekonnad ja teadaolevalt lahtised liikmed:

| Perekond | Koodid | Lahtised |
|---|---|---|
| RAG | P0–P8.1, RAG-QM-P0/P0a/P1 | P8.1, RAG-QM-P1, P8.6 |
| SUP supervisioon | P0–P11 | P1–P11 |
| TK teekond | P0–P5, KOMPASS-P0 | P0 (kontrollimata), P1–P5, KOMPASS-P0 |
| COLLAB | P0–P6 | P3 jääk, P4, P5, P6 |
| CASEWORK | P0–P6 | P2–P6 |
| WB-V2 tööheaolu | P0–P5, TH-RUUM-P0, TO-P1, TO-P4 | P3–P5, TH-RUUM-P0 |
| PERF | P0–P6 | P0 jääk, P1–P6 |
| MAKSED | P0–P3 (+P1a/b/d/e) | P2, P3, recurring |
| RV rollivahetaja | P0–P3 | P1, P2, P3 |
| VEST vestlusaken | P0/P0a, P1–P4 | P1–P4 |
| EXPORT | P0–P4 | P2–P4 |
| FAILID (T08) | P0/P0.1, P1–P3 | kõik — omaniku otsusega ootel |
| ADMIN | P0.1–P0.4, P1 | P0.2, P0.3, P0.4, P1 |
| AVALIK | P0–P4 | P2–P4 |
| TÖÖLAUD | P0–P3 | P2, P3 |
| DOK-XTEN | P0, P1 | P1 |
| HELP | P0/P0a/P0b | — tehtud |
| VÄLI, OPS, VOICE-V1, KOV, PROF, SOL, OPUS | üksikud | vt lähtefaile |

**Aus piirang:** neist 122-st kontrollisin koodist ~25. Ülejäänute seis pärineb
dokumentidest ja **võib olla sama vananenud nagu A/B/C register oli** — täielik
kontrollpass on ise eraldi töö ja seda ei ole tehtud.

---

### 4.4. Sahtel ja kaugemad ideed

`ideed.md`: ESTA foorum + piirkonnaruumid + teemakogukonnad (27), ESTA liikmepakett ja
1 € mudel (26), tööheaolu anonüümne valdkondlik andmekiht (20), KOV osakonna kuukoond (21),
supervisioon tasuta teenuse ja töölauana (22), supervisiooniruum keskse töövormina (23),
ruumilise kasutuskogemuse täpsustus (28). `SotsiaalAI.md` C-tabel: omastehooldaja ruum,
VIPS-spetsialistide tööruum, tervise teejuhi tööruum, heaoluplaani peegel, kriisirežiim,
juhendite värskuskanal, lubaduste audit, ukraina keel, SOTSIAALVALVE, Häirekeskuse
järelsuunamise sild.

---
## Töökord

**Uude aknasse kleepimiseks üks rida:**

> Loe `docs/platvormi arendus/SEIS.md` ja jätka sealt.

Uue teema väljastamiseks lisa lepingufaili nimi (nt `sotsiaalkiirabi-v1-arendusleping.md`).
Töökaust: `C:\Users\rauds\Desktop\SotsiaalAI`.

### Reeglid

1. **Töö käib otse `main`-is.** Harusid ega worktree-kaustu ei tehta. Üks teema korraga.
2. **Väravad enne igat commit'i:** `npm test`, `npm run i18n:check`, eslint muudetud failidel; skeemimuudatusel `npm run db:migrate:check`.
3. **Merge ja deploy ainult omaniku selgel loal.** Sama kehtib päris e-kirjade, päris maksete ja päris partnerini jõudmise kohta.
4. **Ära loe tootmiskasutajate sisu** ega kasuta päris kasutajaid testimiseks.
5. **Ära käivita `OPS-FINAL-A0`** — see on release candidate'i lõppvärav.
6. **Ära korda teostaja teste, build'i ega auditeid**, kui lõpparuanne juba sisaldab nende tulemusi.
7. **Olekut kannab ainult see fail.** Pooleliolek kirjutatakse siia kohe, mitte töö lõpus.

Miks need reeglid tekkisid — [`SEIS-ajalugu.md`](./SEIS-ajalugu.md), „Töökorra reeglite
põhjendused".

### Ülesande lõpus

Uuenda **selles failis** teemasektsiooni: mis liikus TEHTUD / POOLIK / TEGEMATA vahel, mis
saba jäi lahti, mis jäi `NOT_PROVEN`. Kui töö käigus selgus, et mõni siinne lause on vale,
paranda see kohapeal. Konkureerivat seisufaili ega „handoff-<kuupäev>" faili ei looda.

### Esimene tegevus uues aknas

Kontrolli read-only: `git status`, `git log -1`, `origin/main`. Teste ega build'i selleks ei
jooksutata. Kui kontrollitud fakt erineb sellest failist, kehtib fakt — paranda fail.

### Viitematerjal (ei kanna olekut)

| Fail | Mille jaoks |
|---|---|
| `SEIS-ajalugu.md` | kronoloogia ja põhjendused |
| `SotsiaalAI.md` | visioon, strateegia, piirid |
| `ideed.md` | otsustamata ideed |
| `arendusteemade-masterregister.md` | teemade definitsioonid ja piirid |
| `tXX-…-ulesanne.md` | teemalepingud — ei muutu pärast väljastamist |


## SEISUTABEL — 2026-08-03 (KEHTIV)

Koostatud 03.08 **koodist üle käies**, mitte varasemaid tabeleid kopeerides. Allpool olev
„SEISUTABEL — 2026-07-18" jääb alles teostuse detaili ja SHA-de pärast, aga **tema
olekuveerg on 20.07 seisuga ja ei kehti**. Sama kehtib `SotsiaalAI.md` täisarenduse
registri (A/B/C tabelid) kohta — see on 28.07 plaanitõmmis.

Alus: `main` = `origin/main` = `db514ba0` (03.08 konsolideerimine). **Serveri seisu selles
ringis eraldi üle ei kontrollitud** — varasem kanne ütleb, et server on samal SHA-l.

Olekusõnad: **TEHTUD** = kood olemas ja teema oma V1-DoD ulatuses suletud · **POOLIK** =
tuum töötab, nimetatud saba lahtine · **TEGEMATA** = koodi ei ole või ootab
otsust/partnerit/QA-d.

### TEHTUD

| Teema | Tõend koodist |
|---|---|
| T01 ADMIN-V1-CORE | `app/admin/`, `lib/admin/` |
| T02 ACCOUNT + T16 EXPORT (lepitus) | `lib/dataExport/`, `lib/privacy/` |
| T04+T05 WORKSPACE + WORKBENCH | `lib/workspaces/`, `lib/preInquiryReceiverWorkflow.js` |
| T06 JOURNEY-V1 | `lib/journey/` — sh `assistiveDevices.js`, `healthContact.js` ja **kolm üleandmissilda** (`preInquiryHandoff`, `serviceMapHandoff`, `helpMediationHandoff`) |
| T07 DOCUMENTS-RESEARCH-V1 | `CLOSED_SCOPED`; `app/documents/`, `lib/documents/`, `lib/research/` |
| T11 SERVICE-MEDIATION-V1 | `lib/help/` 26 moodulit (`requests`, `offers`, `matches`, `workflow*`), `app/teenusekaart/` |
| T17 SEARCH-LANGUAGE-V1 | `lib/search/` |
| T22 SUPERVISION-V1 | E1–E7 LIVE `17b5d7cc`; `lib/supervision/`, `app/supervisioon/` |
| T23 ESTA-MENTOR-V1 | `lib/mentoring/`, `app/mentorlus/` (kood; partnerlus eraldi) |
| T25 ORG-V1 | **EI OLE ENAM „ANALÜÜS":** `app/org/` (`vastuvott`, `liitu`, `toetus`, `[orgId]/graafik`), `lib/org/{audit,units,constants}.js`, kontrolliring `91eea927` |
| **TEENUSPÄEVIK-V1** | **Registrist puudub täielikult.** OSA I (E1–E9, migratsioon `20260802100000_service_log_v1`) + OSA II (E10–E12) 02.–03.08; `lib/serviceLog/` (sh `dayRouteMachine`, `dispatchAssign`), `app/teenuspaevik/`; sünteetiline runtime 35/35 |
| Geokodeerimine + marsruudimootor | `lib/serviceMap/geocoding.js` (Maa-amet in-ADS, `e9d0ed94`); ise majutatud OSRM `af446748` |
| RAG-QM-P0 baasjoon | `npm run rag:qm:baseline`, `scripts/rag-quality-baseline.mjs`, `scripts/ops/golden-37-*`; `docs/internal/` baseline-freeze + pimeevalveerija + Luna-võrdlus + `luna-rag-run-results.csv` |
| RAG P8.0 | `rag-p8-0-codex-progress.md` + `rag-p8-0-independent-audit.md`; `rag:master:inventory/check/recheck`, `rag:audit:freshness` |
| VEST-P0 vestlusaken/kriisirada | `vest-p0-codex-progress.md` + `sol-vest-p0-independent-audit.md` |
| A11Y-I18N-P0 | kontrollitud 20.07: juba main'is (`meta.*` ×3 keelt, `tests/i18n/metaTitles.test.js`) |
| GPS juurparandus | `e04c4c46` + `04c2c6c4` — `Permissions-Policy` keelas asukoha, oli surnud sünnist saati |
| Vormielementide koondamine | 03.08 neli viilu: rippmenüüd, vorm/veakeel, tekstiväljad, märkeruudud (`5df4568a`…`f7cd1f97`) |

### POOLIK

| Teema | Mis töötab | Mis on lahtine |
|---|---|---|
| T03 CHAT-VOICE-V1 | mitte-häälne turvapakett LIVE `86df453c` | häälvestlus pargitud (`codex/chat-voice-v1 @ 7bdd1288` = retsept); ärkab kriisiraja analüüsi + WER-mõõtmisega |
| T09 PAYMENTS-V1 | tuum LIVE `7b49e9f7`, Maksekeskuse parandus tehtud | recurring teadlikult väljas (`lib/payments/constants.js`-is konstanti ei ole); päris ost toodangus tõendamata |
| T10 PUBLIC-V1 | avalikud teed olemas (`voimalused`, `kasutusjuhend`, `kasutustingimused`, `privaatsustingimused`, `meist`, `autorilt`, `hinnastus`, `tooalase-kasutuse-raamistik`); sisu merge `0f66685d` (võimalused 14→19 sektsiooni) | E1 kest + avalehe viil — **selles ringis kontrollimata**; lubaduste audit (19 lubadust → tõend) tegemata |
| T12 ROOMS-CALLS-V1 | E1 LIVE `2e945ee1`; `lib/rooms/`, `lib/calls/`, `ops/livekit/` | päris-egress QA (T27); `RECORDING_ENABLED` |
| T13 COVISION-V2 | etapid + lõuend main'is; `components/covision/`, `lib/covision*.js` (12 moodulit); teenuseosutaja saab juhtumi luua `ecd268d2` | privaatne märkmik puudub (grep ei leidnud); lõuendireegel uues cvl-kestas rikutud |
| T14 WELLBEING-V2 | `lib/wellbeing/` 24 moodulit, E0 + piloodirada (`pilotAccess`, `pilotReport`) | P3–P5; TH-RUUM-P0 nädalarütm; TO-otsused |
| T15 A11Y/RV | P0 LIVE `7ca89462`; rollivahetaja RV-P0 | RV-P1+, tõlkestrateegia, P1 juured |
| T18 PERF | L1 worker LIVE; L4 reaper koodis (`lib/usage/reservationReaper.js`) | kvoodileke (`lib/storageGuardrails.js`), L3 renewals-timerid, L5 kuluajalugu |
| T20 COLLAB-V1 | P0–P3 LIVE `86df453c` | **U1 mitme-osaleja audience-reegel — tõendatult lahtine:** `lib/events/recipients.js` tunneb ainult `OWNER`/`AUTHOR`/`RECIPIENT_OWNER`; P4–P6 ootavad O-CO-6 |
| T21 CASEWORK-V1 | tuum + P3 Meetodipeegel LIVE `e5c62e0b` | P2 STAR2 eksport-uks; P4/P5 genogramm+ökokaart (O-CW-7); Meetodipeegli sekkumispäevik + vahehindamine (koodivastet ei ole) |
| T24 FIELD-V1 | LIVE `ae59516f`; `lib/field/` täiskomplekt sh `ocr.js`, GPS parandatud | seadme-QA maatriks; oma piloot outreach-osakonnaga |
| T28 RAG-V1 | LIVE; `lib/rag/`, 20+ `rag:*` skripti | P8.6 päris allikate proovipakk; timerite aktiveerimine (omaniku otsus) |
| Teenusekaart + profiil | `lib/serviceAvailability{,.server,Operations}.js` = kättesaadavuse elav signaal **on koodis** | loendivaade/klasterdamine; usaldusmärgistus (MTR-i kaudu — vt allpool) |

### TEGEMATA

| Teema | Miks | Mis avab |
|---|---|---|
| **SOTSIAALKIIRABI-V1** | 0 rida koodi; `READY_FOR_BUILD` | E1+E2 on otsustevabad, võib alustada kohe |
| T08 FILES-MEDIA | omaniku otsusega hilisemaks | omaniku „nüüd" |
| T19 SPATIAL-WORKSPACE-V1 | DEFERRED; kasvab viiludena (dokk, jaamalend, klaas) | horisont C |
| T26 PILOT-PARTNER-V1 | piloodikoodi ei avata enne RC-d | T27 RC |
| T27 OPS-FINAL-A0 | värav teadlikult käivitamata | omaniku „lähme turule" |
| Toimetulekutoetuse eelkalkulaator | eraldi koodi ei ole (ainult RAG/chat mainib mõistet) | SHS § 131–134 valem; pöörduja tapjafunktsioon |
| MTR/tegevusloa kontroll | `lib/serviceMap/`-is vastet ei ole | **topeltroll: teenusekaardi usaldusmärgise objektiivne alus JA SK-V1 O-SK-5 soovitatud värav** |
| SOTSIAALVALVE, Häirekeskuse sild | partner-gated | 1–2 valve-KOV-i / Häirekeskus+SoM |
| Omastehooldaja ruum | ainult `lib/chat/questionPlanner.js` mainib sõna | vajaduskaardistus (EPIK) |
| Ukraina keel | 4. keele kandidaat | Šveitsi-Eesti programmi taotlus |
| Kestlikkuse baromeeter, KOV kuukoond, U5 puudujäägikoond | analüüsid valmis, kood alustamata | partnerlepe + k≥5 |
| ESTA nõusolekud, eelpöördumise piloot | ei ole koodiküsimused | partner |

### Mida see ring EI tõendanud

Kaks asja jäid kontrollimata **kummaski suunas** — ära tsiteeri neid kummaski lahtris:
Teekonna **TK-P0 jagamispiir** (`lib/journey/constants.js`-is jagamis-konstante ei näinud,
võib elada mujal) ja **P8.6** päris allikate proovipaki teostus. Samuti ei mõõdetud selles
ringis serveri seisu ega jooksutatud väravaid — viimane roheline mõõtmine on 03.08
konsolideerimise kandes (2483/2483, i18n OK, eslint 0).

---
