# TEENUSPÄEVIK — teenuskirje ja osutaja aruandlus (disainileping)

**Tootenimi (omanik 29.07): Teenuspäevik** — üldistab valdkonnale tuttava
„hoolduspäeviku" (RT kordade termin) kõigile teenustele; ütleb ausalt, mis ta on
(päevik, millest kasvab aruanne); istub platvormi nimeperre (Teekond, Töölaud,
Tööheaolu, Teenusekaart, Välitöö). Marsruut `/teenuspaevik`. Alaosad: **Päev** (neli
märget + kiirsisestus) · **Graafik** (E10) · **Suunamised** (saldo) · **Aruanded**
(mallid + kuunarratiiv). Teemakood: TEENUSPÄEVIK-V1 (OSA I = E1–E9; OSA II = E10–E12).
Moodulikaart: 11 taaskasutatavat (kataloog, FieldVisit-muster, REPORT_DRAFT, U10,
provenance, authz, PDF/CSV, i18n+ⓘ+dokk, töölauakaardid, notifications-timer,
Teenusekaardi kaardipinu) + 7 uut (3 Prisma mudelit, lib/serviceLog, API-d,
components/serviceLog, graafik [NB org-kihi sõltuvus], km-arvutus, häälmärge hiljem);
väliseid teeke juurde null.

MUSTAND 28.07.2026 (Claude + Laur). Eesmärk: ehitatav leping teenuseosutaja aruandluse
MVP-le. Domeeniloogika on kinnitatud õigusaktidega (Riigi Teataja KOV-korrad, vt allikad)
ja platvormi koodi topeltkontrolliga (28.07: aruandlust ei ole; ServiceProviderService =
kataloog; FieldVisit = kestuse-muster).

## 1. Domeeniloogika (kuidas päriselt käib)

```
KOV SUUNAMISOTSUS ──► KOLMEPOOLNE LEPING ──► OSUTAMINE ──► KUU LÕPP ──► KOV KONTROLL ──► ARVE
(periood, MAHT h/kuus,  (KOV+inimene+osutaja)  (päevade      2 aruannet     (suunatud mahu
 sisu, koht, hind,                              kaupa)        10. kuupäevaks  vastu)
 omaosaluse määr)
```

- **Kaks aruannet** (nt tugiisiku kord): (1) **tööajaarvestus** ehk mahuaruanne — kuupäevad,
  tunnid/korrad, klient; arve alusdokument; (2) **sisuline aruanne** — tekst teenuse
  käigust ja inimese olukorrast. Tähtaeg tüüpiliselt **järgmise kuu 10. kuupäev**.
- **Suunamisotsus kannab mahtu** — osutaja PEAB jälgima jääki (üle suunatud mahu ei
  maksta).
- **Ühikud erinevad teenuseti**: tund (koduteenus, tugiisik, isiklik abistaja), kord/
  külastus, ööpäev (majutus), kuu (kohatasu).
- **Iga KOV-i vorm erineb** — korrad on KOV-i määruse tasandil; seega ehitame ANDMED +
  eksportmallid, mitte ühte „õiget" vormi.
- Mõni KOV nõuab **kliendi kinnitust** tundidele (allkiri tööajalehel) — digikinnitus on
  hilisem võimalus, mitte MVP.

## 0. PÕHIPRINTSIIP: aruandlus on töö kõrvalsaadus, mitte eraldi töö (omanik 28.07)

Väljakaebus („aruandlust tehakse rohkem kui päris tööd, õigemini selle arvelt") on kogu
mooduli disainikriteerium. Kaks juurt, eri ravi: (1) TÖÖRIISTADE PUUDUS — dubleeriv
sisestus, iga KOV eri kujul, kuulõpu „aruande-õhtu" = lahendame meie; (2) NÕUETE
INFLATSIOON = poliitika, mida tööriist ei paranda — aga platvorm teeb koormuse
NÄHTAVAKS: teenuskirje kõrvalsaadus on esimene päris number „aruandlusele kulub X h/kuus,
sh Y dubleerimist" (= heaolutalgute idee 1.7 baasjoon + sügiskooli B3 andmestik; kaebus →
mõõdetud argument ESTA/riigi lauale). **Neli kaitsereeglit:** (a) kirje sünnib seal, kus
töö lõpeb (visiidi lõpp = 10 sek; välitöö kest → „loo teenuskirje"), mitte õhtul mälu
järgi; (b) MITTE ÜHTEGI välja, mida KOV ei nõua — miinimum on püha; (c) kui süsteem juba
teab, ei küsita (teenus suunamisest, kestus kellaaegadest); (d) üks sisestus → kõik
väljundid (KOV-aruanne + arve lisa + sisuaruande mustand + oma ülevaade). **EDU MÕÕDIK:
aruandlusele kuluva aja LANGUS** — mõõdame pilootides enne/pärast; kui meie tööriistaga
kulub rohkem aega kui Exceliga, oleme läbi kukkunud ja ütleme selle ise välja. (Visiooni-
dokumendi lause, mille see moodul lunastab: „sotsiaaltöötajad põlevad läbi süsteemis, mis
dokumenteerib rohkem kui toetab.")

## 1a. Arhitektuuri võtmeotsus: tuum on sama, erinevus elab väljundis (omanik 28.07)

Kinnitatud arusaam: aruandlus EI ole igale teenusele erinev funktsioon. **Muutumatu tuum**
kõigil teenustel ja KOV-idel: suunamine (maht) → kirjed → perioodi kokkuvõte → kontroll →
arve lisa; andmeaatom alati sama (klient + teenus + millal + ühik×kogus + kelle poolt).
**Varieeruvad ainult parameetrid:** ühik (tund/kord/ööpäev/kuu), vormi kuju (KOV-iti),
sisuaruande nõue (lipp), detailsus (päev vs kuu — eksport otsustab), kliendi kinnitus
(valikuline), rahastaja (KOV/SKA/Töötukassa — sama aatom, teine saaja). Järeldus: **üks
andmemudel + üks sisestusvoog + N ekspordimalli** — sama muster mis K1 lepingul (üks
leping, eri profiilid). Müügilause, mis sellest sünnib: mitut KOV-i teenindav osutaja
(tavaline!) sisestab ÜHE korra ja ekspordib igale KOV-ile tema kujul — ainuüksi see võib
olla väikese osutaja 19,99 põhjendus.

## 2. Platvormi lähteseis (mis on juba olemas)

| Olemas | Roll uues disainis |
|---|---|
| `ServiceProviderService` (teenuste kataloog) | teenuskirje rippmenüü — kirje viitab kataloogi teenusele |
| `FieldVisit` (saabumis-/lahkumiskinnitus, märkmed) | kestuse-muster; välitöö kirje võib hiljem GENEREERIDA teenuskirje |
| `REPORT_DRAFT` (AI tekstimustand: eesmärk/faktid/hinnang/sammud) | SISUARUANDE mustand kirjete märkmetest — inimene kinnitab |
| U10 kohtumise kokkuvõte + „sain aru/parandus" | pretsedent kliendi kinnituse UX-ile (hiljem) |
| Kvoodi-/reserveerimissüsteem, owner-scoped privaatsus | samad mustrid kehtivad |

## 3. Andmemudel (ettepanek)

### Referral (Suunamine) — v1.1, MVP-s võib olla tekstiväli

- providerProfileId; kovName (tekst); referralNumber (suunamisotsuse nr)
- serviceId → ServiceProviderService
- clientRef (vt allpool); periodStart/periodEnd
- unit (HOUR | SESSION | DAY | MONTH); allocatedQuantity (nt 40 h/kuus — NB kas maht on
  kuupõhine või perioodipõhine → väli `allocationPeriod: MONTH | TOTAL`)
- [price?, copaymentRate?] — AINULT ekspordi tarbeks, arveldust EI ehita
- status (ACTIVE/ENDED)

### ServiceEntry (Teenuskirje) — MVP tuum

- id, providerProfileId, ownerUserId (kes sisestas)
- serviceId → kataloog; referralId? (v1.1) VÕI referralNote (tekst, MVP)
- **clientRef, kaks rada:** (a) platvormi kasutaja viide (kui klient on platvormil —
  avab hiljem digikinnituse); (b) väline klient: displayName + externalRef
  (suunamisotsuse nr) — minimeeritud, EI dubleeri isikuandmeid rohkem kui osutaja
  tänane Excel
- date; unit; quantity (decimal, nt 1,5 h); workerName? (suurel osutajal: kes osutas)
- note? (lühimärge — sisuaruande tooraine; hoia teadlikult LÜHIKE, tundlik sisu ei
  kuulu siia)
- provenance (kes lõi, millal), createdAt/updatedAt
- confirmedByClientAt? (v1.2, digikinnitus)

### Vaated

- **Kiirsisestus** (ka mobiilis) — järjekord PARANDATUD (omanik 28.07 küsis, kas
  teenus-enne on mõistlik — EI ole): **KLIENT enne, teenus tuletatakse.** Osutaja mõtleb
  „käisin Mardi juures 2 tundi", mitte „osutasin teenust X". Voog: klient (viimased
  ülevalt) → kogus → salvesta; teenus eeltäidetakse suunamisest (v1.1) või kliendi
  viimati kasutatud teenusest (MVP heuristika) ja küsitakse AINULT siis, kui kliendil on
  mitu aktiivset suunamist. Kui osutajal on kataloogis ÜKS teenus, ei küsita teenust
  kunagi. Printsiip: ära küsi seda, mida süsteem juba teab. Eilse/tänase kuupäeva
  kiirvalik. Välitöö kesta lõpetamine võib pakkuda „loo teenuskirje".
- **Aruande koostamine on TEISE järjekorraga:** periood (kuu) → saaja (KOV/suunaja) →
  eksport; teenus on GRUPEERING aruande sees, mitte sisend — aruanne katab saaja kõik
  kliendid ja teenused korraga.
- **Kuuvaade**: kliendi ja teenuse kaupa summad; suunamise jääk (v1.1); tähtaja
  meeldetuletus (järgmise kuu 5. kuupäeval: „aruanne ootab esitamist 10-ndaks").
- **Eksport**: CSV alati; PDF-mall(id) — vormingud kohandatakse septembri päris-vormide
  järgi (Südamekodu, Keiu Talve: 2–3 PÄRIS aruandevormi = ekspordi spetsifikatsioon).
- **Sisuaruande mustand**: REPORT_DRAFT võtab perioodi kirjed + märkmed → tekstimustand
  → inimene toimetab ja kinnitab (AI on mustand — sama leping mis mujal).

### Sisuline aruanne = kliendi LUGU, mitte numbrid (omaniku täpsustus 28.07)

Tugiisiku-tüüpi teenustel on lugu põhiroog: numbrid on arve lisa, **narratiiv on see,
mille põhjal KOV otsustab teenuse jätkamise**. Struktuur peegeldab suunamisotsuse
eesmärke: *perioodi tegevused → edenemine EESMÄRKIDE suhtes → takistused → ETTEPANEK
(jätka / muuda mahtu / lõpeta)* — ettepanek toidab KOV-i järgmist suunamisotsust.
**Platvormi eelis: päritolumärgistus** (KLIENDI_ÖELDUD / TÖÖTAJA_TÄHELEPANEK /
TÖÖTAJA_TÕLGENDUS / AI_MUSTAND) — kirjemärkmed kannavad päritolu, REPORT_DRAFT koostab
mustandi, inimene kinnitab; fakti/tõlgenduse lahusus teeb aruande PAREMAKS kui
Wordi-praktika. **Andmeklassi tagajärjed:** (a) KAKS KIHTI lahus — kirjepõhised lühikesed
faktimärkmed vs kliendi KUUNARRATIIV (eraldi objekt, eri tundlikkus, eri säilitus);
(b) klient peaks teadma (kolmepoolne leping = alus; kvaliteedijuhis = juurdepääs teda
puudutavale infole); (c) **LAHTINE OMANIKU OTSUS: kas klient näeb oma kuuaruannet**
(U10 „sain aru/parandus" laiendus — enneolematu ja platvormi vaimus; AUS PINGE:
riskihinnanguid peab saama kirjutada avameelselt — ei lahenda praegu, otsus enne v1.2).
**MVP PARANDUS:** ilma loota pole aruanne esitatav → MVP-sse lisandub käsitsi kirjutatav
kuunarratiivi plokk kliendi kohta (lihtne tekstiväli, läheb eksporti kaasa); AI-mustand
märkmetest = v1.1. MVP maht jääb 1–2 päeva (üks tekstiväli + ekspordi liitmine).

## 4. Piirid (mida EI ehita)

- **Arveldust/raamatupidamist EI** — väljund on arve LISA (mahud), mitte arve.
- **Vari-registrit EI** — see on osutaja OMA töökiht (õiguslikult sama jalgealune kui
  tema tänane Excel; platvorm on volitatud töötleja). Ametlik kandja on KOV/STAR.
- **Automaatset edastust EI** enne STAR-liidese avanemist — siis „ekspordi" → „edasta".
- Sisuaruanne EI genereeru automaatselt lõplikuna — alati inimese kinnitusega.

## 5. Eraldi disainiotsused (märgi teadlikult)

1. **Säilitus:** arve alusdokument = raamatupidamise seaduse 7-aastane säilitus →
   teenuskirjete retention ERINEB muust platvormi sisust; kustutamisreeglid ja konto
   sulgemise käitumine (eksport enne!) vajavad oma rida andmekaitsetingimustes.
2. **GDPR rollid:** osutaja = vastutav töötleja oma kirjete osas; platvorm = volitatud
   töötleja; kirja andmetöötlusleppesse (sama pakett, mis KOV-diilidel).
3. **Minimeerimine:** tunnid (vähetundlik) ja sisumärkmed (tundlik) hoida eraldi
   väljades; ekspordis valikuline, mida kaasa läheb.
4. **Kliendi kinnitus** (kui KOV nõuab): v1.2 digikinnitus platvormi-kliendile (U10
   muster); väline klient → paberi-varutee märge (`confirmedManually`).

## 6. TEENUSKIRJE-ARUANDLUS-V1 — üks terviklik teemaleping (omaniku otsus 28.07)

> Omanik: „ei lükkaks edasi aruandluse visiooni, vaid prooviks näha tervikut… see
> „järgmises viilus" lõpeb sellega, et funktsioon jääb poolikuks." — Kinnitatud SEIS-i
> enda tõenditega (P2/P4/v1.1 sabad juulist). Pretsedent: FIELD-V1 = üks terviklik pakett,
> ehitati jadatöös lõpuni. MVP-lõige on TÜHISTATUD; teema ehitatakse tervikuna.

**Põhimõte väliste sisendite kohta: värav muutub sisuks, mitte ehituseks.** Kaks sisendit
saabuvad hiljem — septembri päris KOV-vormid ja omaniku otsus kliendi nähtavusest. Kumbki
EI lükka ehitust edasi: mallimootor ehitatakse valmis (uus vorm = uus mall-FAIL, mitte
kood); kliendi-nähtavus ehitatakse LÜLITINA valmis (otsus keerab lüliti). Teema on
„valmis" ka enne septembrit.

### Etapid E1–E9 (kõik teema SEES, jadatöö, lipu taga)

- **E1 Andmemudel tervikuna:** ServiceEntry + Referral (KOHE, mitte hiljem) +
  kuunarratiivi objekt + 7a säilituse reeglid — üks migratsioon, terve mudel.
- **E2 Sisestusvood:** kiirsisestus (klient-enne, tuletamisreeglid, <30 sek) + välitöö
  kesta sild („lõpeta külastus" → „loo teenuskirje").
  **E2b Nelja märke voog (omanik 29.07: „läksin, sain kohale, sain tagasi"):** suured
  nupud mobiilis [LÄKSIN]→[KOHAL]→[LAHKUSIN]→[TAGASI]; iga puude = ajatempel + (lülitiga)
  ÜHE hetke asukohatempel (töötajale nähtav). Annab: (a) KOHAL–LAHKUSIN = teenuse kestus
  → kogus tuletatakse ise; (b) sõidulõigud = SÕIDUAEG kui tööaeg (mall A valikuline
  veerg; KOV-iti hüvitatav) — **aeg JAH, kilomeetrid EI** (distantsi ei arvuta ka
  templitest — sõidupäevik on sõidukidomeen, jäägu FC-le); (c) LÄKSIN ilma TAGASI-ta
  tähtajaks = **turvasignaali käivitus** (FIELD-i kontrollakna taaskasutus — kaitse, mis
  ei nõua lisaliigutust); (d) järjestikused kliendid: TAGASI pole vahel kohustuslik,
  järgmine KOHAL lõpetab eelmise sõidulõigu. NB kolmik on FieldVisit-mudelis juba
  pooleldi olemas (arrivedConfirmedAt/departedConfirmedAt/safety*) — üldistus, mitte uus
  leiutis.
- **E3 Suunamiste haldus:** suunamise kirje (maht, periood, ühik, allocationPeriod) +
  jäägi saldo + ületamise hoiatus.
- **E3b Kerge plaanimine (õpitud Fleet Complete'ilt, ILMA GPS-ita):** plaanitud visiidid
  suunamise rütmist (nt E+K+R hommikuti) → päeva lõpus töötaja kinnitab ühe puutega
  tehtuks → kinnitatud plaan MUUTUB kirjeks (eeltäidetud kuupäev/klient/teenus/kestus,
  paranda kui erines). Suurel osutajal: hooldusjuht määrab plaanitud visiidid töötajatele
  (kerge nädalavaade). MITTE: marsruudioptimeerimist, sõidukihaldust, reaalajas
  GPS-jälgimist — see on logistika, mitte meie mäng.
- **E4 Kuuvaade + rütm:** summad kliendi/teenuse kaupa; tähtajaloogika (järgmise kuu
  10.); ÜKS leebe meeldetuletus (5. kuupäeval).
- **E5 Sisuaruanne:** kuunarratiiv kliendi kohta + REPORT_DRAFT mustand
  päritolumärgistatud märkmetest → inimene toimetab ja kinnitab.
- **E6 Eksport-mallimootor:** CSV + PDF-mallide ARHITEKTUUR; **NELI sisseehitatud malli
  kohe valmis** (spetsifikatsioonid ptk 6a — koostatud päris allikatest 29.07, septembrit
  EI oodata; septembri saak lisab ainult KOV-spetsiifilisi variante). Mitme KOV-i tugi:
  üks sisestus → igale saajale tema kujul.
- **E7 Kliendi kinnitus:** digikinnitus platvormi-kliendile (U10 muster) + käsitsi
  kinnituse märge välisele kliendile; „kas klient näeb oma kuuaruannet" = valmis ehitatud
  LÜLITI, mille omaniku otsus keerab (vaikimisi väljas).
- **E8 Mõõtmine:** aruandlusajale kuluva aja küsimine pilootides (enne/pärast) +
  koormuse baasjoone kõrvalsaadus (talgute idee 1.7; sügiskooli B3 andmestik).
- **E9 STAR-valmidus:** ekspordi andmekuju, mis vastab STAR-i strateegia lubatud
  osutaja-liidestusele — „ekspordi" → „edasta" ootab ainult riigi ust, meie pool valmis.

### 6a. Sisseehitatud mallid A–D (koostatud päris allikatest 29.07 — RT korrad +
Riigikontrolli koduteenuste audit; septembrit ei oodata)

**MALL A — Tööajaarvestus / mahuaruanne (universaalne; arve lisa).**
Päis: osutaja (nimi, registrikood) · saaja (KOV/asutus) · periood · lepingu/hanke viide.
Read, grupeeritud kliendi kaupa: klient + suunamisotsuse nr · kuupäev · teenus ·
[tegevus] · ühik · kogus · töötaja. Jalus: summad teenuse ja kliendi kaupa + koguperiood ·
koostaja + kuupäev · [kliendi kinnituse veerg, kui KOV nõuab]. Kaks varianti SAMADEST
andmetest: päevapõhine lahtikirjutus VÕI kuukokkuvõte.

**MALL B — Hoolduspäevik / päevaleht (koduteenuse-tüüpi; struktuur RT kordadest).**
Klient · kuupäev · saabumis-/lahkumisaeg (kestus tuletatud — sama muster mis FieldVisit) ·
tegevused LOETELUST (linnukesed teenuse tegevuskataloogist) · **rahalised tehingud**
(summa + selgitus — kliendi raha kasutamine poeskäigul jm; RT kordade PÄRIS nõue!) ·
erijuhtumid/tähelepanekud (päritolumärgisega) · töötaja · kinnitused (töötaja + kliendi
allkiri/käsitsi-märge).

**MALL C — Sisuline aruanne (narratiiv).**
Klient + suunamise nr + periood · suunamise EESMÄRGID · perioodi tegevused kokkuvõtvalt
(genereeritav kirjetest) · edenemine eesmärkide suhtes · takistused · **ETTEPANEK**
(jätka / muuda mahtu / lõpeta + põhjendus) · koostaja + kuupäev. REPORT_DRAFT mustandab
märkmetest, inimene toimetab ja kinnitab.

**MALL D — S-veebi statistikaväljavõte (riigi aastaaruandlus).**
Auditi leid: riigi aruandluse (s-veeb) töötundide ja kulude arvestus on osutajate/KOV-ide
eraldi ajakulu — meie andmetest tuletatav (teenuse saajate arv, mahud perioodis). Täpsed
s-veebi väljad kontrollida ehituse ajal; mall = sama aatomi neljas väljund.

**Mudeli täiendused mallidest (E1 kuulub):** ServiceEntry saab valikulised väljad
`activities[]` (teenusepõhine tegevuskataloog — hoolduspäeviku nõue), `arrivedAt/leftAt`
(kestuse tuletamiseks) ja **rahaliste tehingute plokk** (summa+selgitus; sisse lülitatud
teenusetüübi lipuga — koduteenuse eripära). Rütmidesse (E4) lisanduvad kvaliteedijuhise
AASTASED kohustused, mille täitmata jätmise Riigikontroll tuvastas: tagasisideküsitluse
meeldetuletus (audit: 6/10 KOV-i kogub suuliselt ja dokumenteerimata) + kliendi
vahehindamise meeldetuletus (kord aastas — **kvaliteedijuhisest, MITTE seadusest**;
parandatud 30.07.2026). Seadusest tuleneb kohustus märgata abivajaduse muutumist ja
sellele reageerida, mitte kalendripõhine aastane vahehindamine. **Mõju tootele: seda
meeldetuletust EI TOHI kuvada kui seadusest tulenevat nõuet** — vale vastavusväide
töövahendis on tõsisem viga kui puuduv meeldetuletus.

### 6b. Konkurentsianalüüs: Fleet Complete (loetud 29.07, ajakirja Sotsiaaltöö artikkel TAI lehel)

**Nende profiil:** logistikatoode hoolekandesse tõlgituna — automaatne tööde jaotus,
ajaarvestus, **reaalajas GPS-jälgimine**, marsruutide/sõidukite optimeerimine, digitaalne
dokumenteerimine, kiirem aruandlus. Skaala 2023 lõpus: 18 KOV-i aktiivselt + 5 testis,
**261 koduhooldustöötajat päevas**, 15 haiglat. Tõestatud number: töötaja klientide arv
7,4 → 11; „hooldusjuht saab teha kahe inimese töö".

**Kus nemad võidavad (austusega):** tööde jaotus/dispetšerlus, marsruudid, küpsus ja
skaala, haiglasegment. **Mida neilt õppisime:** plaani-kinnita silmus → E3b. **Mida EI
klooni:** marsruudioptimeerimine, sõidukihaldus, reaalajas GPS.

**Kus meie võidame struktuurselt:** (1) **proportsionaalne tõendus, mitte pidev jada**
(TÄPSUSTATUD 29.07 omaniku õiglase torke peale — „eks see GPS on neil pigem teekond,
mitte otsene jälgimine?"): FC GPS teenib eeskätt LOGISTIKAT (marsruudid, sõidupäevik,
tööde jaotus, visiidi tõendus — viimane KAITSEB ka töötajat arvevaidluses) ja see on
õigustatud otstarve; AGA arhitektuur kogub töötaja pidevat asukohajada („reaalajas
jälgimine + ajalooliste andmete kontroll" on artikli enda sõnad) ja kasu-kulu käivad
koos — pidev asukogumine on töötaja-usalduse hind ning tööõiguslikult tundlik
(proportsionaalsus). MEIE positsioneering EI ole „nemad jälgivad" (õlgmees, ei müü 18
KOV-i ees), vaid **„sama tõendusväärtus, proportsionaalsem mehhanism"**: visiidi tõendus
= saabumis-/lahkumiskinnitus ühe puutega (punkt, mitte jada; `arrivedAt/leftAt` mudelis
olemas) + **valikuline ÜHEKORDNE asukohatempel kinnituse hetkel** (lüliti
`SERVICE_LOG_LOCATION_STAMP`, vaikimisi VÄLJAS, töötajale alati nähtav, mis salvestati) —
kui KOV nõuab kohalolutõendit, sama tõend ilma tööpäeva-pikkuse jäljeta. Pidevat
asukohajada EI koguta KUNAGI. **POSITSIONEERING MUUDETUD (omaniku suunaotsus 29.07:
„minu rakendus ei ole täiendus konkurendile — ta peab olema ülim, võimalusel
lisafunktsioonidega"):** me EI ole FC kõrvale, vaid ASEMELE — vt OSA II (E10–E12
täisasendus). Varasem „sõidupäevikut ei ehita / km ei arvuta" piir on OSALISELT
TÜHISTATUD: E12 toob kerge sõidupäeviku (odomeeter või templipõhine hinnang, TÖÖTAJA
kinnitab — töötaja enda kasuks tuletatud km ei ole jälgimine); pideva jälje keeld JÄÄB;
ainus teadlik välistus = sõidukipargi haldus (autode broneerimine/hooldus — see on
autopargi-, mitte hoolekandetarkvara; piir, mis hoiab meid ERP-iks paisumast).
Turvalisus = välitöö turvasignaal (töötaja algatatud); (2) **elutsükkel, mitte
tabel** — nende väljund on tunnitabel, meie mall C lõpeb ETTEPANEKUGA + kvaliteedijuhise
rütmid (Riigikontrolli märkuste vastavus); (3) **sisuaruanne + AI** — kirjutamisaja
sääst, kus FC ei mängi (neil pole keelemudelit ega päritolumärgistust); (4) **tootlikkus
+ KESTLIKKUS** — nende 7,4→11 ilma heaolukihita on läbipõlemise kiirendi; meil toidab
sama kirje (AINULT töötaja enda vaates) tema koormuspilti + Taastumise voog; (5)
**ökosüsteem** — klient on osaline (kinnitus/tagasiside/CLIENT_VIEW), töötajal
teadmuskiht taskus, väikeste osutajate pikk saba (FC müüb enterprise'ile) + STAR/s-veebi
valmidus. Positsioneering (uuendatud 29.07): **„Kõik, mida senine rakendus teeb — ilma
pideva jälgimiseta — pluss kiht, mida logistikatoode ei ehita kunagi: AI, heaolu, klient
ja kvaliteet."** Me ei jaga turgu; me asendame ja ületame.

### 6c. OSA II — TÄISASENDUS: E10–E12 (+ oma DoD-2, et miski ei jää „viiluks")

- **E10 Graafik ja dispetšerlus:** hooldusjuhi nädalavaade; visiitide määramine
  töötajatele; asenduste haldus (haigestumine → visiidid liiguvad); staatustahvel
  („kus mu inimesed on?" = olekud läksin/kohal/lahkusin/tagasi + hilinemised, MITTE
  elav punktikaart). **SÕLTUVUS: mitme töötajaga graafik EELDAB org-kihi
  (SERVICE_PROVIDER_ORG, T25) aktiveerimist** — üksik-FIE-le pole vaja; see ongi
  loomulik esimene org-klient.
- **E11 Päevaplaan kaardil:** töötaja päeva visiidid järjekorras kaardivaates
  (taaskasuta Teenusekaardi kaardipinu) + üks puude avab navigatsiooni (Google/Waze
  URL). Optimeerimisalgoritmi EI ehita — „näen oma päeva ja saan sinna sõita" katab
  90% vajadusest.
- **E12 Kerge sõidupäevik:** km-arvestus hüvitiseks — odomeetri algus/lõpp VÕI
  templipõhine punkt-punkt hinnang; töötaja kinnitab iga rea; väljund mall A
  lisaveeruna ja eraldi km-väljavõttena. Teenib töötajat (hüvitis), mitte jälgimist.
- **DoD-2:** suur osutaja saab FC-st loobuda ilma ühtegi hoolekande-töövoogu
  kaotamata (graafik + märked + tõendus + sõiduaeg + km + aruanded ühes kohas);
  staatustahvel vastab juhi „kus mu inimesed on" vajadusele ilma GPS-jäljeta;
  org-kiht aktiveeritud vähemalt ühel päris osutajal.
- Ajahinnang: E10 2–3 p (org-kihi aktiveerimine lisaks) · E11 1–1,5 p · E12 1 p →
  OSA II ≈ 4,5–5,5 p pärast OSA I DoD-d.

### 6d. Lisafunktsioonide kiht (mida FC ei ehita kunagi järele — „ülim" teine pool)

AI-sisuaruanne märkmetest · **häälmärge** (käed-vabad kirje — multimodaalse kihi
esimene päris kasutuskoht osutajal!) · teadmus taskus (RAG visiidil) · tööheaolu
integratsioon (koormus AINULT töötaja enda vaates + Taastumise voog) · kliendi osalus
(kinnitus/tagasiside/CLIENT_VIEW) · kvaliteedirütmid (Riigikontrolli vastavus) ·
suunamise saldo + mitme KOV-i mallid · STAR/s-veebi valmidus · turvasignaal ·
kolm keelt + selge keel.

**Turufaktid (29.07, Riigikontrolli auditist):** paberivaba hoolduspäevik on Eestis JUBA
praktikas („toiming valitakse loetelust, algus/lõpp klahvivajutusega… rohkem aega
sisuliseks hooldustööks"; Saaremaa kaotas ühe hooldusjuhi koha) = meie ptk 0 printsiibi
väline tõestus; **hinnaanker: olemasolevad rakendused maksavad KOV-ile „kõigi kasutajate
peale mõnisada eurot kuus"** (asutuselitsentsi lagi/põhi); **konkurent olemas** (Pärnu
katsetab Fleet Complete'i sotsiaaltöörakendust) — eristus: meil on ökosüsteem (pöörduja +
spetsialist + kvaliteedikiht), mitte ainult toimingute äpp; **müügiargument KOV-ile:**
tagasiside- ja vahehindamise vaated vastavad otse Riigikontrolli märkustele.

### DoD — „valmis" definitsioon (teema suletakse AINULT selle vastu)

1. Kirje sisestus <30 sekundiga (mõõdetud);
2. kuu lõpus sünnib TERVIKLIK esitis (tunnitabel + sisuaruanne) kahe klõpsuga;
3. mitut KOV-i teenindav osutaja ekspordib igaühele tema kujul ÜHEST sisestusest;
4. suunamise jääk alati nähtav, ületamine hoiatab;
5. aruandlusaja mõõtmine sisse ehitatud ja baasjoon võetav;
6. ptk 0 neli kaitsereeglit kehtivad igas vaates (kontrollitakse üle DoD-s);
7. kõik lipu taga kuni omanik avab; 7a säilituse reeglid dokumenteeritud
   andmekaitsetingimuste mustandina.

**Aus maht:** ~1,5–2 nädalat jadatööd (FIELD-V1 mõõtu), iga etapp jätab töötava
tarkvara, teema suletakse DoD-ga — mitte ühtegi „ootab järgmist viilu" rida SEIS-i.
EELDUS: puhas tööpuu (commit enne — migratsioon).

## 8. TEOSTUSKAART (kaardistatud 29.07 öösel — iseseisvalt teostatav ilma vestluse
kontekstita; järgi projekti rituaale: jadatöö, väravad, SEIS.md uuendus lõpus)

### 8.1. Skeem (E1 — üks additiivne migratsioon, nt `20260729120000_service_log_v1`)

```prisma
model ServiceReferral {            // Suunamine
  id                 String   @id @default(cuid())
  providerProfileId  String   // → ServiceProviderProfile
  serviceId          String?  // → ServiceProviderService (kataloog)
  kovName            String   // saaja/rahastaja nimi (tekst; hiljem normaliseeritav)
  referralNumber     String?  // suunamisotsuse nr
  clientUserId       String?  // platvormi klient (kui on)
  clientDisplayName  String?  // väline klient (minimeeritud)
  clientExternalRef  String?  // nt suunamisotsuse/lepingu viide
  periodStart        DateTime?
  periodEnd          DateTime?
  unit               String   @default("HOUR")  // HOUR|SESSION|DAY|MONTH
  allocatedQuantity  Decimal? // nt 40
  allocationPeriod   String   @default("MONTH") // MONTH|TOTAL
  goalsText          String?  @db.Text  // suunamise eesmärgid (sisuaruande C-mall!)
  status             String   @default("ACTIVE") // ACTIVE|ENDED
  createdAt/updatedAt
  @@index([providerProfileId, status])
}
model ServiceEntry {               // Teenuskirje (aatom)
  id                 String   @id @default(cuid())
  providerProfileId  String
  ownerUserId        String   // sisestaja
  referralId         String?  // → ServiceReferral
  serviceId          String?  // → kataloog (tuletatav suunamisest)
  clientUserId/clientDisplayName/clientExternalRef  // sama muster mis suunamisel
  date               DateTime // teenuse kuupäev
  departedForVisitAt DateTime? // LÄKSIN (sõidulõigu algus)
  arrivedAt          DateTime? // KOHAL (teenuse algus)
  leftAt             DateTime? // LAHKUSIN (teenuse lõpp; kestus tuletatav)
  returnedAt         DateTime? // TAGASI (sõidulõigu lõpp; turvasignaali sulgur)
  locationStamps     Json?     // {departed:{lat,lng,acc,at},arrived:{...},left:{...},returned:{...}}
                               // AINULT kui SERVICE_LOG_LOCATION_STAMP lüliti sees;
                               // punktid, mitte jada; distantsi EI arvutata
  unit               String   @default("HOUR")
  quantity           Decimal  // 1.5
  activities         String[] @default([]) // teenusepõhisest tegevuskataloogist (mall B)
  moneyAmount        Decimal? // kliendi raha kasutamine (mall B; teenusetüübi lipuga)
  moneyNote          String?
  workerName         String?  // kes osutas (suurel osutajal)
  note               String?  @db.Text // LÜHIKE faktimärge; päritolu eraldi väljal
  noteProvenance     String?  // TOOTAJA_TAHELEPANEK | KLIENDI_OELDUD | ...
  confirmedManually  Boolean  @default(false) // kliendi paberil-kinnituse märge
  confirmedByClientAt DateTime? // E7 digikinnitus (lüliti taga)
  createdAt/updatedAt
  @@index([providerProfileId, date])
  @@index([referralId])
}
model ServiceMonthlyNarrative {    // Kuunarratiiv kliendi kohta (mall C keha)
  id, providerProfileId, referralId?, clientUserId?/clientDisplayName
  periodYear Int; periodMonth Int
  bodyText   String @db.Text      // inimese kinnitatud lõpptekst
  draftSource String?             // REPORT_DRAFT artefakti id (kui mustandati)
  createdAt/updatedAt
  @@unique([providerProfileId, referralId, periodYear, periodMonth])
}
```
Tegevuskataloog: `ServiceProviderService` saab `activityCatalog String[]` (additiivne).
NB kirjete kustutamine: hard-delete BLOKEERITUD kui kirje < 7a (raamatupidamise seadus) —
vt 8.9.

### 8.2. Lib + API (uued failid, olemasolevate mustrite järgi)

- `lib/serviceLog/constants.js` — ühikud, staatused, provenance-sõnastik (jaga olemasolevat
  provenance-sõnastikku `lib/workspaces/provenance.js`-ist, ÄRA dubleeri).
- `lib/serviceLog/flags.js` — ÜKS tõeallikas: `SERVICE_LOG_ENABLED` (server) +
  `NEXT_PUBLIC_SERVICE_LOG_ENABLED` (UI; NB küpsetatakse BUILD'i — deploy vajab rebuild'i,
  sama õppetund mis 27.07 hindadega).
- `lib/serviceLog/saldo.js` — puhas fn: suunamise jääk perioodis (testitav ilma DB-ta).
- `lib/serviceLog/export/` — mallimootor: `mallA-tunnitabel.js` (2 varianti),
  `mallB-hoolduspaevik.js`, `mallC-sisuaruanne.js`, `mallD-sveeb.js`; iga mall = puhas fn
  (kirjed+suunamine+narratiiv sisse, CSV-read/PDF-struktuur välja). PDF: kasuta olemasolevat
  PDF-rada (NB teadaolev piirang: kirillitsa→DOCX, sama reegel).
- API: `app/api/service-entries/route.js` (GET loend + POST), `[id]/route.js`
  (PATCH/DELETE), `app/api/service-referrals/...` (sama muster),
  `app/api/service-reports/export/route.js` (periood+saaja+mall → fail),
  `app/api/service-narratives/...` (upsert kuu kaupa).
  KÕIK: sessioon + roll — **ainult `SERVICE_PROVIDER`** (PARANDATUD 02.08 kontrolli
  peale: varem ütles see rida „SERVICE_PROVIDER + ADMIN", aga platvormi admin EI
  KIRJUTA kellegi teise arve alusdokumente; tema rada on haldusvaadete lugemine.
  Teostus ja SEIS ütlevad sama, dokument oli ainus koht, mis lubas rohkem).
  **Org-režiimi profiil vastab 404-ga** kuni E10-ni — „kes tohib org-profiili nimel
  kirjeid teha" on capability-küsimus ja poolik õigusmudel oleks halvem kui
  fail-closed. Owner-scoped 404 muster (foreign-id == missing-id), rate-limit nagu
  teistel POST-idel.

### 8.3. UI pinnad

- Uus paneelileht `/teenuskirjed` (komponendid `components/serviceLog/`): kiirsisestus
  (klient-enne! vt ptk „Vaated"), kuuvaade, suunamised, eksport. Tavaline paneel + dokk
  (EI ole canvas/wide — `panelHasRoomDock` annab doki vaikimisi).
- Töölaua kaart osutaja-vaatesse (`lib/workspaceDashboardCards.js` provider-haru,
  `requiresPaid` nagu teised) — lipu taga.
- **ⓘ kohustuslik** (tänane muster): `lib/dashboardInfoContent.js` uus kirje
  `service_log` (tekstid tõlkevõtmetest!) + lehel `usePanelInfoSlot({infoId:"service_log"})`.
- i18n: namespace `service_log.*` KOLMES keeles (`messages/{et,en,ru}.json`), `i18n:check`
  peab läbima; JSX-is mitte ühtegi kõvakodeeritud teksti (lint keelab).

### 8.4. Integratsioonid

- **Välitöö sild (E2):** FieldVisit lõpetamisel paku „loo teenuskirje" — eeltäida kuupäev,
  kestus (arrived/departed), klient; EI loo automaatselt (kasutaja kinnitab).
- **REPORT_DRAFT (E5):** kuunarratiivi mustand = olemasolev dokumendigeneraator sisendiga
  (perioodi kirjed+märkmed+suunamise eesmärgid); tarbib DOCUMENT_GENERATE kvooti nagu
  ikka; väljund on MUSTAND kuni inimese kinnituseni (marker nagu SavedAnalysisel).
- **Kvoodid:** kirje-CRUD EI tarbi AI-kvoote (puhas CRUD; storage tühine).
- **E7 kinnitus:** platvormi-kliendile U10 „sain aru" mustri taaskasutus; „klient näeb
  kuuaruannet" = lüliti `SERVICE_LOG_CLIENT_VIEW` (vaikimisi väljas, omaniku otsus).

### 8.5. Testiplaan (tests/serviceLog/, node:test + fake-prisma nagu mujal)

Lepingutestid: saldo-arvutus (ühikud, MONTH vs TOTAL, ületus); owner-404 rajad; kirje
kustutuskeeld <7a; eksport-mallide kuju (A päevane vs kuine, B rahaliste tehingutega, C
narratiiviga, D koond); klient-enne tuletamisreeglid (üks teenus → ei küsita; mitu
suunamist → küsitakse); lipp väljas → API-d 404/leht peidus. + `db:migrate:check`
(migratsiooniahel), i18n pariteet, build.

### 8.6. Väravad ja rituaal (IGA etapi lõpus)

`npm test` (täissviit, praegu 1973 — kasvab) → `npx eslint` muudetud failidel →
`npm run i18n:check` → `npm run build` → SEIS.md kirje (mis tehtud, mis NOT_PROVEN,
mis järgmisena). Serverisse EI lähe enne omaniku sõna; lipud väljas. Ajutisi
devlogin-marsruute EI jäeta commit'i (25.07 reegel).

### 8.7. Järjekord ja ajahinnang (jadatöö, ~8–10 tööpäeva)

E1 skeem+migratsioon (0,5–1 p) → E2 sisestusvood (1,5–2 p) → E3 suunamised+saldo (1 p) →
E4 kuuvaade+rütmid (1 p) → E5 narratiiv+mustand (1–1,5 p) → E6 mallimootor+4 malli (2 p)
→ E7 kinnitused+lüliti (1 p) → E8 mõõtmine (0,5 p) → E9 s-veebi/STAR-kuju (0,5 p).
Iga etapp jätab töötava terviku; teema suletakse DoD vastu (ptk 6).

### 8.8. Omaniku lülitid ja otsused (koondatud; ehitus EI oota)

1. `SERVICE_LOG_ENABLED` — millal avada (piloot? osutaja-beeta?).
2. `SERVICE_LOG_CLIENT_VIEW` — kas klient näeb oma kuuaruannet (E7 lüliti; aus pinge
   riskihinnangutega — otsus enne avamist, mitte enne ehitust).
3. Rahaliste tehingute plokk — mis teenusetüüpidel sees (vaikimisi ainult koduteenus).
4. Hinnastus: kas teenuskirjed on 19,99 sees või asutuselitsentsi argument (soovitus:
   sees — see ONGI väärtus, mis hinda õigustab; anker: konkurendid „mõnisada €/kuus").
5. `SERVICE_LOG_LOCATION_STAMP` — kas ühekordne asukohatempel kinnituse hetkel on
   lubatud (vaikimisi VÄLJAS; sisse ainult kui KOV nõuab kohalolutõendit; töötajale
   alati nähtav, mis salvestati; pidevat jada EI KUNAGI).

### 8.9. Õiguslik kontrollnimekiri (enne avamist, MITTE enne ehitust)

- 7a säilitus (raamatupidamise seadus): kirjed = arve alusdokumendid → hard-delete keeld
  <7a; konto sulgemisel KOHUSTUSLIK eksport + kirjete saatus (õigusanalüüsi küsimus:
  anonüümitud säilitus vs eksport-ja-kustutus) — rida andmekaitsetingimustesse.
- Rollid: osutaja = vastutav töötleja oma kirjete osas, platvorm = volitatud töötleja →
  volitatud töötleja leping (sama pakett, mis KOV-diilidel; DPA-mall).
- Minimeerimine: kliendi väli minimaalne (displayName + viide); tundlik sisu EI kuulu
  kirje märkmesse (UI vihje + ⓘ tekst ütlevad seda).
- Kliendi teavitamine: kolmepoolne leping = alus; kui CLIENT_VIEW avatakse, lisandub
  teavitus kliendile.

## 7. Septembri saak (toidab E6/E7 SISU, ei blokeeri ehitust)

- 2–3 päris KOV-aruandevormi → uued mall-failid E6 mootorisse;
- päevapõhine lahtikirjutus vs kuu summa → malli seadistus;
- kliendi allkirja/kinnituse nõue → E7 lüliti seadistus KOV-iti;
- käibel olevad ühikud partneri teenustes → kataloogi seadistus;
- maht kuupõhine vs perioodipõhine → Referral.allocationPeriod väärtus.

## Allikad

- Tugiisikuteenuse osutamise kord (Riigi Teataja) — tööajaarvestus + sisuline aruanne,
  järgmise kuu 10. kuupäevaks: https://www.riigiteataja.ee/akt/403122020029
- Sotsiaalteenuste osutamise kord (RT): https://www.riigiteataja.ee/akt/404052022004
- Koduteenuse osutamise kord (RT): https://www.riigiteataja.ee/akt/429122018107
- Suunamisotsuse kohustuslikud andmed (periood, maht, sisu, koht, tasu, omaosalus) —
  KOV-kordade läbiv muster; kolmepoolne leping suunamisotsuse alusel.
- NB: korrad on KOV-i tasandi määrused — vormid ja detailid ERINEVAD omavalitsuseti;
  seepärast andmed + mallid, mitte üks vorm.
- Riigikontrolli aruanne „Koduteenuste korraldus" (22.11.2023):
  https://www.riigikontroll.ee/sites/default/files/documents/2025-11/19294_RKTR_6564_2-1.4_2312_002-2.pdf
  — paberivaba praktika tõestus (p 56–58), s-veebi aruandlus, tagasiside/vahehindamise
  lüngad (p 60–62), hinnaanker, Fleet Complete Pärnus.
- Koduteenuse kvaliteedijuhis (SKA 2020) — aastane tagasisideküsitlus + vahehindamine.
- SKA koduteenuse juhend KOV ametnikule (2024) — PDF-id SKA lehel botikaitse taga,
  vajadusel laadida brauseriga käsitsi.
