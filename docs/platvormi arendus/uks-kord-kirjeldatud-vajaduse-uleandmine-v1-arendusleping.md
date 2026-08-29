# `ST10-09 VAJADUSE-ULEANDMINE-V1` — „üks kord kirjeldatud vajaduse” üleandmise arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: `ST10-02` ja `ST10-07` asutusteülene laiendus
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: doonorid osaliselt olemas; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2024. aasta toetatud lapse ja pere teekonna käsitlus kirjeldab sama vajaduse ja dokumentide
korduvat esitamist eri asutustele. Funktsioon lubab inimesel **sõnastada kinnitatud tuumvajaduse
ühe korra ning kasutada seda uue saaja puhul uue, eesmärgipõhise nõusolekuga**, lisades ainult
selle saaja tööks vajaliku minimaalse info.

„Üks kord” ei tähenda piiramatut korduskasutust ega üldnõusolekut. Iga uus eesmärk, saaja või
väljaloend vajab uut eelvaadet ja kinnitust.

## 2. Sobivus olemasoleva platvormiga

**Taaskasutatav:** Journey→PreInquiry serveri allowlist
`lib/journey/preInquiryHandoff.js`; külmutatud NetworkShare `lib/network/share.js`;
organisatsiooni assignment/handoff `lib/org/inbox.js`; päritolu, eelpöördumine,
„Minu jagamised” ja ST10-02 plaanikandja. ST10-07 Abiteekonna pass on inimese kaasaskantav
vaade, mitte asutusteülese töövoo asendus.

**Puudu:** üks eesmärgipõhine pakett koos õigusliku aluse, saaja rolli, tähtaja, väljade,
vastuvõtukinnituse, paranduse ja edasijagamise keeluga. Ametlikke SKAIS/STAR/EHIS/TERVIK
liideseid ei ole tõendatud.

## 3. V1 kasutajatee

1. Inimene avab enda kinnitatud vajaduse tuuma Teekonnalt või Abiteekonna passist.
2. Ta valib uue eesmärgi ja konkreetse saaja ning näeb selle saaja küsitud/minimaalselt vajalikke
   välju. Saaja ei saa ise vabalt kogu Teekonnast valida.
3. Inimene parandab snapshot'i ja kinnitab selle versiooni.
4. Saaja näeb eesmärki, õiguslikku alust, rolli, tähtaega, päritolu ja ainult valitud välju ning
   kinnitab vastuvõtu või keeldub.
5. Parandus loob uue versiooni; saaja näeb, et eelmine on asendatud.
6. Teisele asutusele edasiandmine nõuab uut inimese kinnitust, välja arvatud eraldi seadusest
   tulenev alus, mis on lepingus ja UI-s nimeliselt kirjeldatud.

## 4. Tootepiirid ja invariandid

- Ühe saaja nõusolek ei laiene teisele saajale, eesmärgile ega andmekoosseisule.
- Saaja liikmelisus ei ava Journey, ruumi, juhtumit ega teise asutuse paketti.
- Vastuvõtukinnitus ei tähenda teenuseotsust ega abi tagamist.
- AI ei vali saajat, õiguslikku alust, välju ega otsusta vajalikkust.
- Snapshot on muutumatu; parandus supersede'ib, mitte ei kirjuta ajaloolist versiooni üle.
- Edasijagamine on vaikimisi keelatud ning audit kannab fakti ja väljade võtmeid, mitte väärtusi.
- Platvorm saab lõpetada tulevase ligipääsu, kuid ei saa tehniliselt kustutada ega tagasi võtta
  koopiat, mille väline asutus on juba vastu võtnud, alla laadinud või ametlikku süsteemi kandnud;
  see piir kuvatakse enne saatmist ja tagasivõtmist.
- Ilma ametliku partnerita ei kasutata UI-s sõnu „saadetud STAR-i/SKAIS-i/EHIS-esse”.

## 5. Minimaalne andmeleping

Üleandmispakett: omanik, tuumvajaduse versioon, eesmärk, saaja/asutus/roll, õiguslik alus,
kehtivus/tähtaeg, valitud väljad ja päritolu. Elutsükkel: DRAFT, CONFIRMED, SENT, RECEIVED,
DECLINED, SUPERSEDED, REVOKED, EXPIRED. Iga siire kannab tingimuslikku versiooni ja aega.

Saaja päringu- või capability-leping määrab lubatud väljade maksimaalse loendi; inimese valik
saab seda ainult kitsendada. Üldist vabateksti ega toorobjekti dump'i ei aktsepteerita.

## 6. Teostusetapid

### E0 — ühise kandja ja saaja capability lepitamine

- Tõenda, et ST10-02 kandja ja ST10-07 ühine projektsioon teenindavad paketti ilma uue
  paralleelmudeli või teise serveriprojektorita. ST10-09 teostus algab pärast ST10-07 E1.
- Lukusta esimene partner/saaja, eesmärk, õiguslik alus ja maksimaalne allowlist.
- Kaardista tagasivõtu, saaja kohustusliku säilituse ja supersede'i piir.

### E1 — eesmärgipõhine paketikoostaja

- Laienda ST10-07 keskset serveriprojektsiooni saaja capability ning eesmärgi kitsendusega;
  ära loo teist projektsioonikihti.
- Eelvaade, saatmine ja audit kasutavad sama versiooni ning väljade võtmeid.
- Tundmatu capability või väli sulgeb saatmise.

### E2 — saatmine ja vastuvõtukinnitus

- Kasuta ST10-02 vastuvõtu/keeldumise olekumasinat ja sisutuid teavitusi.
- Näita andjale, kes võttis vastu, millal ja mis eesmärgil; saaja ei näe teisi pakette.
- Vaikimine ei ole vastuvõtt ja üleandmine ei lõpeta vana vastutust enne aktsepti.

### E3 — parandus, tagasivõtt ja ajalugu

- Parandus loob supersede-versiooni ja teavitab saajat ilma vana sisu payload'i lisamata.
- Tagasivõtt lõpetab tulevase platvormiligipääsu; välise koopia ja kohustusliku säilituse piir
  kuvatakse ausalt.
- „Minu jagamised” näitab eesmärki, saajat, versiooni ja olekut.

### E4 — partneradapteri värav

- Ametlik liides ehitatakse eraldi adapterina pärast partnerlepingut, autentimist, skeemi,
  kviitungit ja veataaste otsust.
- Inimene näeb lõplikku payload'i ja teeb saatmisteo; automaatset registrikannet ei lisata.
- ET/EN/RU, ligipääsetavus, mobiil ja käsitsi partnerirada.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis V1 saadab ühele kokkulepitud partnerile ainult eesmärgipõhise allowlist'i ja inimese
kinnitatud snapshot'i, saab saaja vastuvõtu/keeldumise, supersede'ib paranduse ning ei ava
Teekonda ega teise asutuse infot. Uus saaja nõuab uut kinnitust; tundmatu capability on
fail-closed.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi inimese/saaja/võõra/paranduse/tagasivõtu rada. Automaatteste ega sonde ei
looda ega käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- P-VU-1: esimene asutus, saajaroll, capability ja vastutuse piir.
- Õ-VU-1: eesmärk, õiguslik alus, minimaalne andmekoosseis, retention ja edasijagamine.
- O-VU-1: vastuvõtu tähtaeg ja fallback.
- SKAIS/STAR/EHIS/TERVIK nimega adapter vajab oma partneri tehnilist lepingut.
