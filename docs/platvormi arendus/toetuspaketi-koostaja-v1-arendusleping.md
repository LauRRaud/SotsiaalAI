# `ST10-03 TOETUSPAKETT-V1` — Toetuspaketi koostaja arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: uus tööriist
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: nimeline funktsioon koodis 0; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2018. aasta ISTE-kogemus seob isikukesksuse eluvaldkondade, inimese eesmärkide,
teenusekomponentide, kohaliku koordineerimise ning vajadusega seotud mahu ja eelarvega.
**Toetuspaketi koostaja** aitab inimesel ja spetsialistil valmistada ette läbipaistva mustandi:
millises eluvaldkonnas on eesmärk, milline teenus või tugi võiks seda toetada, kes vastutab,
mis mahtu/hinda on sisestatud ning millal vaadatakse koos üle, kas tugi aitas.

Tulemus on ettevalmistus- ja arutelumaterjal, mitte toetus-, teenuse-, mahu- ega rahaotsus.

## 2. Sobivus olemasoleva platvormiga

**Olemas ja taaskasutatav:** eluvaldkondade küsimustik ja eelhindamine
`lib/preInquiriesQuestionnaire.js`, `lib/preInquiriesAssessment.js`; Teekonna mustand
`lib/journey/draft.js`; Teenusekaart ja teenuseprofiil `lib/serviceMap/*`,
`components/workspace/ServiceMapLeaflet.jsx`; juhtumitöö ning päritolu. `ServiceReferral`
kannab juba teenuse/osutaja viidet, `goalsText`-i, ühikut, `allocatedQuantity`-t ja
`allocationPeriod`-i; `ServiceProviderService` kannab `feeType`-i ja `priceDescription`-it.

**Päriselt uus:** olemasolevaid ridu ühendav paketi koondkandja, eelarveraam, mitme komponendi
eesmärgipõhine vaade ja järelhindamise tervik. Teenusekaart ega üks ServiceReferral ei ole täna
isiklik toetuspakett ja eelpöördumise küsimustik ei ole eelarveotsus.

## 3. V1 kasutajatee

1. Inimene valib ühe eluvaldkonna ja sõnastab enda eesmärgi.
2. Ta lisab juba saadava toe ning võimaliku puuduva toe. Teenusekaardi vaste on soovituslik
   otsingutulemus, mitte automaatne määramine.
3. Inimene või volitatud spetsialist sisestab komponendi, vastutaja, mahu, hinna allika ja
   eelarveraami. Iga arv on nähtava päritoluga ning muudetav.
4. Koostatakse paketi eelvaade koos kontrollpunktiga. Inimene kinnitab, mida jagatakse.
5. Pärast kokkulepitud aega lisatakse järelhindamine Minu muutuse kompassi põhimõttel.

## 4. Tootepiirid ja invariandid

- AI ei otsusta õigust toetusele, teenuse sobivust, mahtu, hinda, eelarvet ega rahastajat.
- „Soovituslik” ei tohi UI-s muutuda „määratud”, „sobib” ega „kuulub”.
- Teenuse hind kannab kuupäeva, allikat ja ühikut; puuduva hinna puhul ei oletata väärtust.
- Isiklik eelarve ei ole automaatne optimum ega ametlik rahastusotsus.
- Väljund on inimese kinnitatud mustand/eksport; platvorm ei loo ametliku juhtumiplaani
  paralleelkoopiat.
- Tervise-, puude- või diagnoosiandmeid ei tuletata eluvaldkonna vastustest.
- Ühe inimese pakett ei ole organisatsiooni analüütika sisend ilma eraldi anonüümse
  mõõtmislepinguta.

## 5. Minimaalne andmeleping

Pakett: omanik, seotud Teekond/juhtum, versioon, olek, eesmärk ja kinnitusaeg. Komponent:
eluvaldkond, inimese eesmärk, olemasolev/soovitud tugi, Teenusekaardi valikuline viide,
vastutaja, maht ja ühik, hind ja valuuta, hinna päritolu/kuupäev, eelarverida, rahastaja kui
inimese sisestatud fakt ning järelhindamise aeg.

Kõik arvud on sisendfaktid või läbipaistva valemiga summad. Audit kannab tegevuse fakti ja
väljade võtmeid, mitte inimese olukorra vabateksti. Jagamine kasutab versioonitud snapshot'i.

## 6. Teostusetapid

### E0 — toote-, õiguse- ja doonoriaudit

- Määra V1 kasutajaroll, eluvaldkondade kanooniline sõnastik, Teenusekaardi sobivad väljad ning
  millised hinna/mahu andmed on faktina piisavalt kontrollitavad.
- Lepita `ServiceReferral`-i ja `ServiceProviderService`-i väljade tähendus, omand ja
  versioonikäitumine; pakett viitab või külmutab neid teadlikult ega dubleeri teenust, osutajat,
  eesmärki, ühikut, mahtu, perioodi või hinnakirjeldust uue sõnastikuna.
- Otsusta, kas esimene vertikaal on inimese enda mustand või spetsialisti ja inimese ühine rada;
  soovitus on inimese mustand + valikuline professionaalne kaasamine.
- Kaardista retention ja saadetud paketi elutsükkel.

### E1 — paketi domeen ja arvude päritolu

- Loo ainult uus versioonitud koondkandja, eelarveraam ja järelhindamise seos; taaskasuta või
  lepita olemasolevad `ServiceReferral` / `ServiceProviderService` doonorid.
- Rakenda ühikud, valuuta, hinna kuupäev/allikas ja läbipaistvad summad; väldi peidetud
  soovitusalgoritmi.
- Tingimuslikud kirjutused väldivad vana vahekaardi ülekirjutust.

### E2 — koostamisvaade

- Ehita eluvaldkond → eesmärk → komponent → vastutaja → maht/hind → eelarve rada.
- Näita alati, millise välja sisestas inimene, spetsialist, allikas või AI mustand.
- Lisa tühjad/puuduvad hinnad, veaseisud ja „ei ole veel otsustatud” olek.

### E3 — Teenusekaardi ja Teekonna ühendus

- Otsi Teenusekaardist kontrollitud kandidaate, kuid lisa paketti ainult kasutaja toiminguga.
- Seo eesmärk Teekonna/Kompassiga ning väldi sama teksti teise aktiivse koopiana hoidmist.
- Hoia teenuseprofiili muutus ja paketi ajalooline snapshot eristatavad.

### E4 — eelvaade, jagamine ja järelhindamine

- Loo inimese valitud väljadel 1:1 eelvaade ning versioonitud eksport/üleandmine.
- Lisa vastuvõtukinnitus ainult olemasoleva ST10-02 kandja kaudu.
- Kontrollpunktis seo tulemus Minu muutuse kompassiga; ära arvuta mõju automaatselt.

### E5 — ligipääsetavus ja esimene pilootviil

- ET/EN/RU, lihtkeel, klaviatuur, ekraanilugeja, mobiil, arvude/ühikute arusaadavus.
- Käsitsi tõenda ühe eluvaldkonna otsast lõpuni rada sünteetiliste andmetega enne järgmiste
  valdkondade avamist.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis V1 võimaldab koostada vähemalt ühe eluvaldkonna mitme komponendiga paketi, näitab
kõigi arvude alust, eristab olemasolevat ja soovitud tuge, lubab inimese kinnitatud snapshot'i
ning seob järelhindamise ilma automaatotsuseta. Võõras kasutaja paketti ei näe ja saaja ei saa
rohkem välju kui eelvaates.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi inimese/spetsialisti/saaja/võõra rada. Automaatteste ega sonde ei looda ega
käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-TPK-1: esimese eluvaldkonna ja pilootpartneri valik.
- O-TPK-2: hinna, mahu ja isikliku eelarve õiguslik/tooteline sõnastus, et mustandit ei
  tõlgendataks ametliku otsusena.
- O-TPK-3: kas paketti võib koostada ainult inimene või ka volitatud spetsialist inimese eest;
  mõlemal juhul vajab jagatav lõppversioon inimese kinnitust.
