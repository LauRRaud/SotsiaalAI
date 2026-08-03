# TEENUSPÄEVIK — teenuskirje ja osutaja aruandlus (disainileping)

**Tootenimi (omanik 29.07): Teenuspäevik** — üldistab valdkonnale tuttava
„hoolduspäeviku" (RT kordade termin) kõigile teenustele; ütleb ausalt, mis ta on
(päevik, millest kasvab aruanne); istub platvormi nimeperre (Teekond, Töölaud,
Tööheaolu, Teenusekaart, Välitöö). Marsruut `/teenuspaevik`. Alaosad: **Päev** (neli
märget + kiirsisestus) · **Graafik** (E10) · **Suunamised** (saldo) · **Aruanded**
(mallid + kuunarratiiv). Teemakood: TEENUSPÄEVIK-V1 (OSA I = E1–E9; OSA II = E10–E12).
OSA I moodulikaart: 11 taaskasutatavat (kataloog, FieldVisit-muster, REPORT_DRAFT,
U10, provenance, authz, PDF/CSV, i18n+ⓘ+dokk, töölauakaardid,
notifications-timer, Teenusekaardi kaardipinu) + 7 uut (3 Prisma mudelit,
lib/serviceLog, API-d, components/serviceLog, aruandevoog, km-arvutus, häälmärge
hiljem). OSA II lisab kolm additiivset töökorraldusobjekti ning eraldi töötaja
mobiili- ja juhi töölauavaate. Organisatsiooni, üksuste, liikmesuste, teenuseprofiili
ja õiguste alus tuleb valminud T25 `ORG-WORKSPACE-V1` kihist; Teenuspäevik ei ehita
teist organisatsioonimudelit. Väliseid teeke juurde ei ole kavandatud.

MUSTAND 28.07.2026 (Claude + Laur), täpsustatud 02.08.2026 Fleet Complete'i artikli,
ekraanivaate ja Teenuspäeviku päris teostuse põhjal. Eesmärk: ehitatav leping
teenuseosutaja töökorralduse ja aruandluse tervikule. Domeeniloogika on kinnitatud
õigusaktidega (Riigi Teataja KOV-korrad, vt allikad) ning platvormi koodi
topeltkontrolliga. Algne ühe külastuse mudel ei kata mitme järjestikuse kliendiga
tööpäeva; selle parandab OSA II päevateekonna ja organisatsioonivaate leping.

**Staatusereegel:** see dokument kirjeldab sihtarhitektuuri ja teostuslepingut;
tegelik valmidus ning lahtised tööd on kirjas failis `SEIS.md`. T25 organisatsioonikiht
on valmis, kuid Teenuspäeviku ühendus selle kihiga, päevateekond, juhi Teenuspäeviku
vaade ja GPS-i kasutajaliides ei ole valmis ainuüksi seetõttu, et nende aluskiht on
olemas.

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

### Kaks korraldusmudelit ja kaks aruandlussuunda

Teenuspäevik peab toetama kahte päriselulist mudelit, neid õigustes segamata:

1. **KOV osutab teenust ise.** KOV-i hoolduskoordinaator või sotsiaalosakonna juht on
   teenuseosutaja organisatsiooni sisemine juht: kavandab töötajate päevad, näeb oma
   üksuse tööde olekuid ja mahtusid ning kinnitab aruande.
2. **KOV ostab teenuse väliselt osutajalt.** Teenuseosutaja enda juht korraldab töötajate
   igapäevatööd ja kinnitab aruande; KOV saab ainult lepingus kokku lepitud kinnitatud
   mahu- ja sisuaruande, mitte vaikimisi osutaja töötajate reaalajavaadet, kõiki
   päevikumärkmeid ega GPS-punkte.

Seega on kaks eri andmevoogu: **töötaja → oma organisatsiooni juht** (töökorraldus,
kontroll, kinnitusring) ja **teenuseosutaja → rahastaja/KOV** (kinnitatud välisesitis).
Kui KOV osutab teenust ise, võivad need rollid olla samas organisatsioonis, kuid
capability ja üksuse skoop jäävad ikkagi eraldi.

## 0. PÕHIPRINTSIIP: aruandlus on töö kõrvalsaadus, mitte eraldi töö (omanik 28.07)

Väljakaebus („aruandlust tehakse rohkem kui päris tööd, õigemini selle arvelt") on kogu
mooduli disainikriteerium. Kaks juurt, eri ravi: (1) TÖÖRIISTADE PUUDUS — dubleeriv
sisestus, iga KOV eri kujul, kuulõpu „aruande-õhtu" = lahendame meie; (2) NÕUETE
INFLATSIOON = poliitika, mida tööriist ei paranda. Teenuspäevik peab vähendama
dubleerimist ega tohi ise muutuda uueks aruandekohustuseks. **Neli kaitsereeglit:**
(a) kirje sünnib seal, kus
töö lõpeb (visiidi lõpp = 10 sek; välitöö kest → „loo teenuskirje"), mitte õhtul mälu
järgi; (b) MITTE ÜHTEGI välja, mida KOV ei nõua — miinimum on püha; (c) kui süsteem juba
teab, ei küsita (teenus suunamisest, kestus kellaaegadest); (d) üks sisestus → kõik
väljundid (KOV-aruanne + arve lisa + sisuaruande mustand + oma ülevaade). **EDU MÕÕDIK:
aruandlusele kuluva aja LANGUS** — seda kontrollitakse piloodis enne/pärast lühiajalise
uuringu või vaatlusega, mitte Teenuspäeviku püsifunktsioonina. Kui meie tööriistaga
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
- **Mitme külastuse päev (OSA II):** põhiobjekt on eraldi planeeritud või planeerimata
  **külastus/töö**, mitte eeldus „kontor → klient → kontor". Töötajal on päeva jooksul
  järjestatud tööd. Pärast kliendi juurest lahkumist valib ta „järgmine klient",
  „paus/tööväline lõik" või „lõpetan tööteekonna". „Tagasi" ei tähenda kontorisse
  jõudmist: päev võib alata kodust, jätkuda otse kliendilt kliendile ja lõppeda mujal.
  Tööteekonna alguses ja lõpus salvestatakse vaikimisi ainult aeg, mitte GPS-punkt —
  muidu võiks tööriist koguda töötaja koduasukohta.
- **Kaks eri UI-d:** töötaja mobiilivaade näitab järgmist tööd, aadressi/navigatsiooni,
  üht muutuvat tegevusnuppu, tegevuste kiirvalikut ja võrguühenduseta järjekorda;
  hooldus-/osakonnajuhi töölaual on töötajate kaupa grupeeritud päevaplaan, planeerimata
  tööd, staatused, asendused, kaart, mahuhoiatused ning aruannete kinnitusring.
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
  kesta sild („lõpeta külastus" → „loo teenuskirje"). Ühe külastuse ajatemplid jäävad
  toimima ka ilma päevaplaanita.
  **E2b Külastuse märkimine:** [KOHAL]→[LAHKUSIN] annab teenuse kestuse ja loob
  teenuskirje aluse. Kui `SERVICE_LOG_LOCATION_STAMP` on sees, küsib [KOHAL] ainult
  selle vajutuse hetkel ühe asukohapunkti; loa puudumine või GPS-i viga EI TOHI takistada
  ajatemplit ega teenuse osutamist. Töötaja näeb, kas punkt salvestati. `watchPosition`-i,
  taustajälgimist ega punktijada ei kasutata.
  **E2b PARANDUS 03.08 (omaniku otsus, tühistab varasema ühe-punkti tõlgenduse):**
  asukohapunkt võetakse **igas teadlikus sõidusündmuses**, mitte ainult saabumisel:
  `[Läksin teele]`, `[Olen kohal]` ja sõidu lõpp. Põhjendus omanikult sõna-sõnalt:
  „üldiselt võib töötaja alustada sõitu igalt poolt, käib enne poes või kuskil
  lihtsalt kodukülastuses. Seega mingi märk on vaja maha panna. Samuti sõidu lõpus
  on vaja märk panna, et arvutada teekonda. **Tähtis on see, et ei ole reaalajas
  jälgimist, kõik muu on lubatud.**"
  See EI riku DoD punkti 10 — reegel on „maksimaalselt üks punkt TEADLIKU SÜNDMUSE
  kohta", mitte „üks punkt külastuse kohta"; `watchPosition` ja taustajälg jäävad
  keelatuks. Kaks tagajärge: (1) **konfigureeritavat lähtekohta ei ole vaja** —
  märk ise on lähtekoht, olgu see pood, eelmine klient või kodu; (2) sõidulõik
  muutub täpsemaks: `enRouteAt` punkt → `arrivedAt` punkt on PÄRIS sõit, mitte
  eelmise kliendi ja järgmise kliendi vaheline sirge. Sõidu alguses arvutab OSRM
  kohe teepikkuse sihtkohta („Sihtkohani 7,4 km · ~10 min"), saabumine kinnitab ja
  päeva lõpp annab kokkuvõtte.

  **E2c Päevateekond (parandus 02.08):** nelja fikseeritud märke
  [LÄKSIN]→[KOHAL]→[LAHKUSIN]→[TAGASI] asemel juhib OSA II külastuste olekumasinat:
  `PLANNED → EN_ROUTE → ARRIVED → COMPLETED → FINAL`, kõrvalharud `CANCELLED`,
  `NOT_DONE`, `NEEDS_CORRECTION`. Töötaja võib pärast lahkumist minna järgmise kliendi
  juurde, teha pausi või lõpetada tööteekonna. Järgmise töö `EN_ROUTE→ARRIVED` on uus
  sõidulõik; eelmist külastust ei märgita fiktiivselt „tagasi". Tööteekond annab
  turvasignaalile päris sulguri: pooleli `EN_ROUTE`/`ARRIVED` üle kokkulepitud kontrollaja
  vajab kontrolli. Kõik nupuvajutused lähevad olemasolevasse offline-järjekorda
  idempotentsusvõtmega, et ühenduse taastumine ei looks topeltkirjet ega topeltarvet.
- **E3 Suunamiste haldus:** suunamise kirje (maht, periood, ühik, allocationPeriod) +
  jäägi saldo + ületamise hoiatus.
- **E3b Plaanimine ja jaotus (Fleet Complete'i õppetund):** suunamise rütmist tekivad
  plaanitud külastused (nt E+K+R hommikuti); juht määrab need töötajale ja järjekorda,
  korraldab asenduse ning lisab planeerimata töö. Töötaja kinnitatud külastus muutub
  teenuskirjeks, mitte vastupidi. Juhi vaade grupeerib tööd töötaja ja päeva kaupa ning
  näitab vähemalt klienti, teenust, aadressi/aega, staatust, kestust ja kinnituse seisu.
  MITTE: pidevat GPS-jälgimist ega autopargi täishaldust. Päevaplaan ja punktidevaheline
  töötaja kinnitatud km-hinnang kuuluvad OSA II-sse; sõidukite broneerimine/hooldus ning
  elav liikumisrada ei kuulu SotsiaalAI sotsiaalteenuse töökihti.
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
- **E8 Piloodi tehniline kontroll — mitte Teenuspäeviku funktsioon:** vajaduse korral
  võetakse piiratud piloodis enne/pärast ajaproov, et kontrollida sisestusvoo kiirust.
  See ei kuulu töötaja püsivasse töövoogu, juhi aruandlusse ega organisatsiooni
  analüütikasse. Teostatud `ServiceLogTimeSample` ja `/api/service-log/measure` on
  seetõttu ajutine valideerimisinstrument, mille edasine säilitamine või eemaldamine
  otsustatakse pärast pilooti; sellest ei kujundata eraldi tootevõimekust.
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

### 6b. Konkurentsianalüüs: Fleet Complete (TAI artikkel ja ekraanivaade kontrollitud 02.08)

**Nende profiil:** KOV-i koduteenuse töökorralduse ja logistika tervik — hoolduskoordinaator
kavandab ning jaotab tööd; töötajal on nutiseadmes päevakava, kliendiandmed ja
hooldusplaan; juhil on töötajate kaupa tööde loend, kaardivaade, staatused, ajakulu,
kilomeetrid ja aruanded. Lisaks on reaalajas töötajate/sõidukite liikumine, elektrooniline
sõidupäevik ja sõidukite broneerimine. 2023. aasta lõpu ettevõtte andmetel kasutas
lahendust 18 KOV-i, viies oli test ning igapäevaseid koduhooldajast kasutajaid oli 261.

**Mõjutõendid vajavad ausat keelt.** Viie omavalitsuse 2022. aasta uuringus kasvas
keskmine klientide arv töötaja kohta 7,4-lt 11-ni, kuid korraga muutusid nii rakendus kui
töökorraldus — see ei ole puhas põhjuslik tarkvarakatse. „Hooldusjuht saab teha kahe
inimese töö" on tugev kasutuskogemuse väide, mitte garanteeritav ROI. Piloodis mõõdame
enda lähtejoont: sisestusaeg, topeltsisestused, külastused töötaja kohta, juhi
koordineerimisaeg ja katkestused.

**Mida neilt üle võtame:** eraldi töö/külastus kui põhiobjekt; töötaja päevaplaan;
planeeritud ja planeerimata tööd; töötajate kaupa grupeeritud juhi töölaud; selged
staatused; asendused; klient/teenus/aadress/aeg ühel real; kaart; digipäevik ja
aruandlus; töötaja koolitus ning väga lihtne mobiilivoog.

**Mida parandame:** artikkel kirjeldab ühenduse katkemist, hangumist ja kadunud töid —
meie iga nupuvajutus peab töötama offline-järjekorra ning idempotentsusvõtmega. Fleet
Complete'i reaalajas GPS annab logistika, kilometraaži ja visiidi tõenduse, kuid kasutajad
kirjeldasid ka pideva kontrolli hirmu. Meie piir on **punkt, mitte jada**: [KOHAL]
salvestab lülitiga ühe nähtava punkti; ajatempleid ja tööolekuid saab juht näha ilma
elava töötajakaardita; punktidevahelise km-hinnangu kinnitab töötaja. Üldvaates näeb juht
„asukoht kinnitatud / salvestamata"; täpne punkt avaneb ainult konkreetse külastuse
kontrollis, õigustatud capability'ga ja auditijäljega. Välisele KOV-ile GPS ei lähe
vaikimisi üldse.

**Aus positsioneering:** SotsiaalAI saab asendada Fleet Complete'i **sotsiaalteenuse
töövoos** (plaan, külastused, tõendus, sõiduaeg/km, teenuskirjed, aruanded) ja lisada AI,
päritolumärgistuse, kliendi osaluse, tööheaolu, kvaliteedirütmid ning STAR/s-veebi
valmiduse. Ta EI asenda autopargi funktsioone (sõidukite broneerimine/hooldus) ega paku
pidevat reaalajas liikumiskaarti. Seetõttu ei kasutata enam absoluutset lubadust „kõik,
mida Fleet Complete teeb"; õige lubadus on **„koduteenuse töökorraldus ja aruandlus ilma
pideva töötajajälgimiseta, koos sotsiaaltöö sisukihiga"**.

### 6c. OSA II — ORGANISATSIOONI TÖÖKORRALDUS: E10–E12 (+ oma DoD-2)

- **E10 Graafik, päevateekond ja dispetšerlus:** hooldusjuhi nädala-/päevavaade;
  planeeritud ja planeerimata külastused; töötajale määramine ja järjestamine; asendused;
  olekud `PLANNED/EN_ROUTE/ARRIVED/COMPLETED/CANCELLED/NOT_DONE/NEEDS_CORRECTION`;
  töötaja päeva algus/lõpp, pausid ja kliendilt-kliendile sõidulõigud. Juhi staatustahvel
  näitab olekut ja hilinemist, mitte elavat GPS-jada. **VALMIS ALUS:** T25 annab
  organisatsioonikonteksti, üksuse skoobi, `SERVICE_DELIVERY` mooduli,
  organisatsioonile kuuluva teenuseprofiili ning aktiivsed `WORK_ASSIGNER` ja
  `UNIT_LEAD` capability'd. `WORK_ASSIGNER` planeerib ja määrab töid; eraldi
  `SCHEDULER`-it ei lisata. `REPORT_APPROVER` on T25-s reserveeritud nimi, mis tuleb
  Teenuspäeviku kinnitusringi avamisel aktiveerida ja mooduliga siduda. KOV-i oma
  teenuse puhul on juht KOV-i üksuses; välise osutaja puhul osutaja üksuses.
- **E11 Päevaplaan kaardil:** töötaja järjestatud külastused, järgmine töö, aadress ja
  ühe puutega navigatsioon (Google/Waze URL); juhil list+kaart. Marsruudi
  optimeerimisalgoritmi ei ehita esimeses versioonis. Kaart näitab teenuskohti ja
  kinnitatud külastusolekuid, mitte töötaja pidevalt liikuvat punkti.
- **E12 Kerge sõidupäevik:** sõidulõik tekib tööteekonna sündmuste vahel; tööväline paus
  ei lähe arvestusse. Km saadakse odomeetri algus/lõpp VÕI saabumis-punktide vahelise
  hinnanguna; töötaja kinnitab iga rea ja saab vea parandada põhjusega. Päeva alguse/lõpu
  GPS-punkt on vaikimisi keelatud, et mitte koguda koduasukohta. Väljund mall A
  lisaveeruna ja eraldi km-väljavõttena.
- **DoD-2:** töötaja läbib vähemalt kolme järjestikuse kliendiga päeva ilma fiktiivse
  „tagasi kontorisse" märketa; võrgu kadumine ei kaota sündmusi ega loo duplikaate;
  osakonna-/hooldusjuht näeb ainult oma üksuse plaane, olekuid, mahtusid ja kontrollijälgi;
  `REPORT_APPROVER` kontrollib/parandab/kinnitab KOV-ile mineva aruande; välisel KOV-il
  puudub vaikimisi ligipääs töötaja jooksvale päevale ja GPS-ile; GPS-lipp sees kogub
  maksimaalselt ühe punkti sündmuse kohta ning koodis puudub `watchPosition`.
- **Mahu märkus:** varasem 4,5–5,5 päeva hinnang ei sisaldanud päevateekonna olekumasinat,
  offline-sündmusi, org-capability'sid ega kinnitusringi ja ei ole enam usaldusväärne;
  uus hinnang tehakse pärast E10 skeemi/API teostuskaarti.

### 6d. Sotsiaaltöö sisukiht, mis eristab meid logistikakesksest lahendusest

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
5. piloodis on eraldi valideeritud, et tavakirje saab sisestada alla 30 sekundi ja
   tervikprotsess vähendab aruandlusele kuluvat aega; püsivat ajamõõtjat selleks ei nõuta;
6. ptk 0 neli kaitsereeglit kehtivad igas vaates (kontrollitakse üle DoD-s);
7. kõik lipu taga kuni omanik avab; 7a säilituse reeglid dokumenteeritud
   andmekaitsetingimuste mustandina;
8. vähemalt kolme järjestikuse kliendiga tööpäev toimib ilma vahepealse „tagasi"
   märketa, paus ja tööväline lõik ei lähe sõiduajaks;
9. sama lahendus toetab KOV-i oma teenuseüksust ja välist osutajat: sisemine juht näeb
   ainult oma üksust, välisele KOV-ile läheb ainult kinnitatud esitis;
10. GPS-lipp sees tähendab maksimaalselt üht punkti teadliku sündmuse kohta;
    `watchPosition`/taustajälg puudub ja GPS-i tõrge ei blokeeri ajatemplit;
11. töötaja mobiilivoog töötab ühenduseta ning juhi aruandesse ei teki kordussaatmisel
    topeltkülastust ega topeltmahtu.

**Mahu ausus:** OSA I algne hinnang oli ~1,5–2 nädalat jadatööd. OSA II ulatus on
pärast mitme külastusega päevateekonna, T25-ga liidestamise, planeerimise ja aruande
kinnitamise lisamist suurem. Uut koguhinnangut ei anta enne E10–E12 detailset
teostuskaarti. Terviku DoD on täidetud alles siis, kui mõlema osa serveriloogika,
kasutajavaated ja negatiivsed õigustestid on valmis. Migratsioonitööd tehakse
isoleeritud ja kontrollitud tööpuus.

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
  departedForVisitAt DateTime? // ühe külastuse lihtvoo sõidulõigu algus
  arrivedAt          DateTime? // KOHAL (teenuse algus)
  leftAt             DateTime? // LAHKUSIN (teenuse lõpp; kestus tuletatav)
  returnedAt         DateTime? // ühe külastuse lihtvoo lõpp; EI tähenda alati kontorit
  locationStamps     Json?     // {departed:{lat,lng,acc,at},arrived:{...},left:{...},returned:{...}}
                               // AINULT kui SERVICE_LOG_LOCATION_STAMP lüliti sees;
                               // server lubab max ühe punkti sündmuse kohta, mitte jada;
                               // OSA II km-hinnang kasutab ainult töötaja kinnitatud lõiku
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

**E10 skeemiparandus — ära suru mitme külastuse päeva `ServiceEntry.returnedAt` sisse.**
Praegune `ServiceEntry` on ühe osutamissündmuse/arveaatom. Päevaplaan ja kliendilt
kliendile liikumine vajavad additiivseid objekte (täpsed nimed kinnitatakse E10
teostuskaardis):

```text
ServiceWorkday
  providerProfileId · organizationId? · unitId? · workerUserId
  assigneeMembershipId? · date · startedAt? · endedAt? · status

ServiceVisitAssignment
  workdayId? · referralId? · serviceId? · klient · assigneeMembershipId?/workerUserId
  plannedStartAt? · plannedEndAt? · sequence · status
  enRouteAt? · arrivedAt? · leftAt? · completedAt?
  arrivalLocationStamp? · serviceEntryId? · cancellationReason?

ServiceTravelSegment
  workdayId · fromVisitId? · toVisitId? · startedAt · endedAt?
  kind=WORK|PAUSE|PRIVATE · includeInWorkTime
  distanceSource=ODOMETER|POINT_ESTIMATE|MANUAL · distanceKm? · confirmedAt?
```

Invariandid: üks lõpetatud külastus loob maksimaalselt ühe teenuskirje; üks sõidulõik
kuulub täpselt ühe tööpäeva alla ja seda ei summeerita kahe teenuskirje juures; järgmise
kliendi `ARRIVED` võib lõpetada eelmise tööalase sõidulõigu, kuid ei muuda eelmise
kliendi kirjes ühtegi „tagasi" välja; paus/erasõit ei lähe tööaja ega km-hüvitise hulka;
päeva algus/lõpp ei kogu vaikimisi asukohta.

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
- **E10 uued API-d:** tööpäevad, külastusülesanded, sõidulõigud, määramine/asendus,
  olekumuutus ja aruande kinnitusring. Töötaja kirjutab ainult endale määratud või enda
  algatatud planeerimata külastust; T25 `WORK_ASSIGNER` määrab töid, `UNIT_LEAD` näeb
  oma üksuse operatiivkoondit ja aktiveeritav `REPORT_APPROVER` kinnitab välisesitise.
  Üks capability ei anna automaatselt teisi. Võõras organisatsioon/üksus/külastus
  annab 404.
- **Aruande saaja ei saa org-ligipääsu:** välisele KOV-ile faili või tulevase liidese
  kaudu aruande saatmine ei loo talle liikmesust ega õigust osutaja päevaplaanile,
  töötajate märkmetele või asukohatemplitele.

### 8.3. UI pinnad

- Paneelileht `/teenuspaevik` (komponendid `components/serviceLog/`): kiirsisestus
  (klient-enne! vt ptk „Vaated"), kuuvaade, suunamised, eksport. Tavaline paneel + dokk
  (EI ole canvas/wide — `panelHasRoomDock` annab doki vaikimisi).
- Töölaua kaart osutaja-vaatesse (`lib/workspaceDashboardCards.js` provider-haru,
  `requiresPaid` nagu teised) — lipu taga.
- **ⓘ kohustuslik** (tänane muster): `lib/dashboardInfoContent.js` uus kirje
  `service_log` (tekstid tõlkevõtmetest!) + lehel `usePanelInfoSlot({infoId:"service_log"})`.
- i18n: namespace `service_log.*` KOLMES keeles (`messages/{et,en,ru}.json`), `i18n:check`
  peab läbima; JSX-is mitte ühtegi kõvakodeeritud teksti (lint keelab).
- **E10 töötaja mobiilivaade:** järgmine külastus + aadress/navigeerimine + üks muutuv
  tegevusnupp; pärast lahkumist „järgmine klient / paus / lõpeta"; planeerimata töö
  lisamine; offline-olek alati nähtav; GPS-loa/saamise seis kasutajale arusaadav.
- **E10 juhi töölauavaade:** töötajate kaupa grupeeritud plaan ja planeerimata tööde
  järjekord vasakul, teenuskohtade/olekute kaart paremal; filtrid päeva, üksuse, töötaja,
  teenuse ja staatuse järgi; eraldi aruandlus- ja kinnitusring. Üldkaart ei näita
  töötaja elavat asukohta ega toor-GPS-punkti.

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

E10 lisatestid: kolm järjestikust klienti ilma `returnedAt`-ita; sõidulõik summeerub üks
kord; paus/erasõit ei summeeru; planeerimata töö; asendus; katkine võrk ja kordussaatmine
annavad ühe sündmuse/teenuskirje; GPS keelatud/timeout/ebatäpne ei blokeeri ajatemplit;
server eemaldab tundmatud punktid ja jada; `watchPosition` puudub kliendikoodist;
liige näeb enda, `UNIT_LEAD` ainult oma üksuse ja võõras org 404; `REPORT_APPROVER`
saab kinnitada, kuid ei kirjuta töötaja algkirjet vaikselt üle; väline KOV-i saaja ei
saa org-vaadet ega GPS-i.

### 8.6. Väravad ja rituaal (IGA etapi lõpus)

`npm test` (täissviit, praegu 1973 — kasvab) → `npx eslint` muudetud failidel →
`npm run i18n:check` → `npm run build` → SEIS.md kirje (mis tehtud, mis NOT_PROVEN,
mis järgmisena). Serverisse EI lähe enne omaniku sõna; lipud väljas. Ajutisi
devlogin-marsruute EI jäeta commit'i (25.07 reegel).

### 8.7. Järjekord ja ajahinnang (OSA I algne hinnang; OSA II vajab uut kaarti)

E1 skeem+migratsioon (0,5–1 p) → E2 sisestusvood (1,5–2 p) → E3 suunamised+saldo (1 p) →
E4 kuuvaade+rütmid (1 p) → E5 narratiiv+mustand (1–1,5 p) → E6 mallimootor+4 malli (2 p)
→ E7 kinnitused+lüliti (1 p) → E8 ajutine piloodikontroll (0,5 p; ei ole
tootefunktsioon) → E9 s-veebi/STAR-kuju (0,5 p).
Iga etapp jätab töötava terviku; teema suletakse DoD vastu (ptk 6).
E10–E12 ei kasuta varasemat 4,5–5,5 päeva hinnangut: enne ehitust kaardistatakse
olekumasin, additiivne skeem, org-capability'd, offline-sündmused, GPS-i teavitustekst,
juhi raportid ja kinnitusring üheks jadatööks.

### 8.8. Omaniku lülitid ja otsused (koondatud; ehitus EI oota)

1. `SERVICE_LOG_ENABLED` — millal avada (piloot? osutaja-beeta?).
2. `SERVICE_LOG_CLIENT_VIEW` — kas klient näeb oma kuuaruannet (E7 lüliti; aus pinge
   riskihinnangutega — otsus enne avamist, mitte enne ehitust).
3. Rahaliste tehingute plokk — mis teenusetüüpidel sees (vaikimisi ainult koduteenus).
4. Hinnastus: kas teenuskirjed on 19,99 sees või asutuselitsentsi argument (soovitus:
   sees — see ONGI väärtus, mis hinda õigustab; anker: konkurendid „mõnisada €/kuus").
5. `SERVICE_LOG_LOCATION_STAMP` — kas ühekordne asukohatempel kinnituse hetkel on
   lubatud (vaikimisi VÄLJAS; sisse ainult dokumenteeritud eesmärgi, õigusliku aluse,
   töötajate teavituse ja juurdepääsureegliga; töötajale alati nähtav, mis salvestati;
   pidevat jada EI KUNAGI).

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
- Töötaja asukohaandmed: eesmärk, kasutajad, täpsus, säilitus, vaidluse avamise kord ja
  töötaja õigused dokumenteerida ENNE GPS-lipu avamist. Tööandja üldine soov „näha, kus
  inimesed on" ei ole eraldi õiguslik alus. Üldvaates piisab olekust ja tõendi olemasolu
  märgist; toorpunkt on üksikkülastuse piiratud kontrollandmestik, mitte juhtide kaart.
- Kodust algav/lõppev päev: tööteekonna algus/lõpp ei kogu vaikimisi GPS-i; muidu võib
  teenuseosutaja tahtmatult töödelda töötaja koduasukohta. Erand vajab eraldi eesmärki
  ja lahendust, mitte sama üldlülitit.
- Organisatsiooni sisemine juht vs väline KOV: sisemine ligipääs tuleb liikmesusest,
  capability'st ja üksuse skoobist; lepingu/aruande saajaks olemine ei anna õigust
  töötajate operatiivandmetele. Kõik aruande kinnitamised ja parandused on auditeeritud.

## 7. Septembri saak (toidab E6/E7 SISU, ei blokeeri ehitust)

- 2–3 päris KOV-aruandevormi → uued mall-failid E6 mootorisse;
- päevapõhine lahtikirjutus vs kuu summa → malli seadistus;
- kliendi allkirja/kinnituse nõue → E7 lüliti seadistus KOV-iti;
- käibel olevad ühikud partneri teenustes → kataloogi seadistus;
- maht kuupõhine vs perioodipõhine → Referral.allocationPeriod väärtus.
- ühe päris hoolduskoordinaatori päevaplaan: mitu töötajat, vähemalt kolm järjestikust
  klienti, planeerimata töö, tühistamine, asendus ja päev, mis ei alga/lõpe kontoris;
- sisemise juhi minimaalne koond ja kinnitusring ning täpne piir, mida väline KOV
  aruande saajana näeb;
- kas kohalolutõendiks piisab „punkt olemas" märgist või millal vajab volitatud
  kontrollija toorpunkti — GPS-i lipp ei avane enne seda kokkulepet.

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
- TAI / ajakiri Sotsiaaltöö, „Fleet Complete rakendus aitab kokku hoida koduhooldaja
  tööaega" (08.02.2024):
  https://www.tai.ee/et/sotsiaaltoo/fleet-complete-rakendus-aitab-kokku-hoida-koduhooldaja-tooaega
  — tööde kavandamine ja jaotus, töötaja+juhi vaated, reaalajas GPS, sõidupäevik,
  sõidukite broneerimine, 5 KOV-i kasutajauuring, ühenduse/kadunud tööde probleemid,
  töötajate jälgimishirm. Arvud 18 KOV-i / 261 päevakasutajat on ettevõtte andmed;
  7,4→11 kaasnes rakenduse JA töökorralduse muutusega, mitte tõendatud üksikmõjuga.
