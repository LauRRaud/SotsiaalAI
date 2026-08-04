# A2 — Toimetulekutoetuse eelkalkulaator: arendusleping

STATUS: **MUSTAND 04.08.2026 — ootab omaniku kinnitust.**

**P0 tuum on 04.08 auditi järel ümber kirjutatud.** Sõltumatu audit (Codex) leidis, et esimene
versioon andis mitmes olukorras usutava, kuid vale summa. Leiud **A–G on parandatud ja
testidega lukus** (32 testi); H on osaliselt lahtine, vt DoD.

**Muutunud põhimõte: kahtluse korral ei anna tuum numbrit, vaid keeldub.** Tulemusel on nüüd
`usable` lipp — `false` korral on `estimate` alati `null` ja kuvakiht ei tohi summat näidata.
Blokeerivad `issues` ja mitteblokeerivad `caveats` on eraldi.

Üks õigusküsimus jääb lahtiseks (leid C, vt DoD lõpp): milline on õige kärpimistehe siis, kui
KOV-i piirmäärad ei ole teada.

## Mis see on

Pöördujale mõeldud **informatiivne eelhinnang**: „kas mul võib olla õigus toimetulekutoetusele
ja umbes kui palju" — koos selgitusega, millest see number koosneb, ja dokumentide
kontrollnimekirjaga taotluse jaoks.

Toetuse **määrab ja maksab valla- või linnavalitsus** (SHS § 134). Kalkulaator ei otsusta, ei
hinda abivajaduse taset ega asenda menetlust. Ta teeb seaduses kirjas oleva tehte läbi ja
näitab selle koosseisu.

Miks see on pöörduja raja tugevaim üksik funktsioon: toimetulekutoetus on Eesti kõige
laiema haardega rahaline abimeede, mille arvestus on **seaduses deterministlik**, aga
inimesele läbipaistmatu. Õiguskantsleri seisukohad näitavad, et määramata jätmise vaidlusi on
palju. Eelselgus vähendab mõlema poole koormust. Kontota avalik versioon on ühtlasi SEO-uks.

## Õiguslik alus ja kontrollitud faktid (04.08.2026)

Allikad: [SHS § 131–134](https://www.riigiteataja.ee/akt/130062023073) ·
[Sotsiaalministeerium, toimetulekutoetus](https://sm.ee/toimetulekutoetus) ·
[SKA „KOV-idele SHS TTT kommenteeritud variant 2026", 12.03.2026](https://sotsiaalkindlustusamet.ee/sites/default/files/documents/2026-03/KOV-idele%20SHS%20TTT%20kommenteeritud%20variant%202026_12.03.2026.pdf) ·
[SoM: toimetulekutoetus tõuseb 2026](https://www.sm.ee/uudised/toimetulekutoetus-touseb-ja-muutub-inimestele-lihtsamini-kattesaadavaks)

**Valem (SKA kommenteeritud variant, sõna-sõnalt):**

```
toimetulekutoetus = pereliikmete arvestuslik toimetulekupiir
                  + eluaseme normkulu
                  - sissetulekud
```

**Toimetulekupiir alates 01.01.2026** (SHS § 131 lg 3–5):

| Kes | Määr | Suhe |
|---|---|---|
| üksi elav inimene või perekonna esimene liige | **220 €/kuus** | 100% |
| teine ja iga järgnev täisealine pereliige | **176 €/kuus** | 80% |
| iga alaealine pereliige | **264 €/kuus** | 120% |

(2025: 200 / 160 / 240.)

**Pereliige** = samas eluruumis elav ühise majapidamisega isik (SHS § 131 lg 7). Määrav on
ühine majandamine, mitte sissekirjutus. 18. sünnipäeva kuul loetakse inimene **kogu kuu**
lapseks.

**PARANDATUD 04.08.** Varasem lause „18–19-aastased õpilased jäävad lapse piirmäära alla"
oli **dateerimata ja pärines uudisest, mitte seadusest**. Audit väidab, et see laiendus
jõustub alles **01.04.2027** ja 2026. aastal kehtib lapse määr ainult 18-aastaseks saamise
kuu lõpuni; kontrolli Riigi Teatajast enne kasutamist. Eraldi ja MITTE sama säte: SKA
kommenteeritud variant kirjeldab reeglit, mille järgi põhikoolis, gümnaasiumis või
kutseõppes õppiva keskhariduseta lapse **töine sissetulek** ei lähe pere sissetulekute hulka
kuni 19-aastaseks saamiseni või jooksva õppeaasta lõpuni. Leping ajas need varem segamini;
kood ei implementeeri kumbagi.

**Eluasemekulud** (SHS § 133 lg 5) — 11 liiki, millele KOV volikogu kehtestab piirmäärad
(§ 133 lg 6), pluss eluasemelaenu tagasimakse: üür · korterelamu haldamise kulu · korterelamu
renoveerimislaenu tagasimakse · veevarustus ja reovesi · soojaveevarustus · küte · elekter ·
majapidamisgaas · maamaks (kolmekordne elamualune pind) · hoonekindlustus · olmejäätmete vedu.

**Eluruumi sotsiaalselt põhjendatud norm** (elamuseadus § 7 lg 2): **18 m² iga pereliikme
kohta + 15 m² perekonna kohta**. Üksi elavale pensionärile ning osalise või puuduva
töövõimega inimesele võib arvestada normpinnaks **kuni 51 m²** (SHS § 133 lg 5).

**Sissetulekust arvatakse maha** (SHS § 133 lg 1): makstud elatis; täitemenetluses TMS
§-de 131–132 kohaselt õiguspäraselt kinni peetud summad (Riigikohus 3-16-1759: võlakoorma
vähenemine ei ole netosissetulek).

**Sissetulekute hulka ei arvata** (SHS § 133 lg 2, valik): riigi või KOV ühekordsed toetused ·
KOV perioodilised sissetulekust sõltuvad või teenusekulu kompenseerivad toetused · puuetega
inimeste sotsiaaltoetused (v.a puudega vanema toetus) · riigi tagatisel antud õppelaen ·
tööturuteenuste seaduse või struktuurivahendite stipendium ning sõidu- ja majutustoetus ·
õppetoetuste ja õppelaenu seaduse põhitoetus ja vajaduspõhine õppetoetus.

## Tootepiirid — mida see kalkulaator EI tee

Need ei ole hüljatud variandid, vaid **lubadused**, mis peavad kasutajani jõudma:

1. **Ei ole otsus.** Määrab KOV (SHS § 134). Tulemus kannab masinloetavat lippu
   `isDecision: false` ja `decidedBy: "KOV"`, et ükski kuvakiht ei saaks seda ära kaotada.
2. **Ei tea KOV-i piirmäärasid.** SHS § 133 lg 6 jätab piirmäärade suuruse iga volikogu
   otsustada ja need on piirkonniti erinevad (üüri piirmäär kehtestatakse ruutmeetrile;
   paljudel KOV-idel on 2–3 astet). Seetõttu on eluasemekulude pool **ülemine hinnang** ja
   iga eluasemekuluga vastus kannab hoiatust `KOV_HOUSING_LIMITS_UNKNOWN`.
3. **Ei tee kaalutlusotsuseid.** SHS § 134 lg 4–7: vara olemasolu ja kasutatavus, töise tulu
   puudumine, kuue kuu keskmise rakendamine, tagasiulatuvalt või ette makstud sissetulek.
   Need on menetleja kaalutlused, mitte aritmeetika.
4. **Ei hinda abivajadust ega õigust teenusele.** Sama piir, mis kehtib kogu platvormil.

## Teostuse osad

| Osa | Seis |
|---|---|
| **P0 — deterministlik tuum** (`lib/benefits/subsistence.js`, `subsistenceRates.js`) | **TEHTUD 04.08** |
| **P1 — pöörduja vorm** (`components/benefits/SubsistenceCalculator.jsx`) | **TEHTUD 04.08, brauseris tõendatud** |
| **P3 — kontota avalik leht** `/toimetulekutoetus` | **TEHTUD 04.08** |
| **P2 — dokumentide kontrollnimekiri** taotluse jaoks | tegemata |
| **P4 — KOV piirmäärade andmekiht** (kui KOV-partner annab oma määrused) | tegemata, partneri taga |

### P0 — mis on tehtud

`estimateSubsistenceBenefit()` tagastab summa **koos koosseisuga**: perekonna piiri
jaotus rollide kaupa, eluasemekulude read (deklareeritud vs arvesse minev, ja kas rida
skaleeriti pinna järgi), sissetuleku mahaarvamised, ning `caveats` massiiv. Number ilma
koosseisuta ei ole selgitus, ja selgitus on siin pool toodet.

Määrad elavad **kuupäevastatud tabelis** (`subsistenceRates.js`), mitte valemi sees: vale
aasta määr annaks vaikselt vale vastuse. Uue aasta lisamine on üks rida.

Pinnasõltuvad kulud (üür, küte, haldus, hoonekindlustus, eluasemelaen) skaleeritakse
normpinna suhtega; tarbimispõhised (elekter, vesi, gaas, jäätmevedu, maamaks) lähevad täies
ulatuses — nende suurus ei sõltu korteri pindalast.

Väravad: `npm test` roheline, 20 uut testi.

### Parandusskoop enne P1 — auditi leiud (Codex, 04.08)

Kuni need on lahendatud, ei tohi kalkulaator avalikku numbrit näidata.

| # | Leid | Kus |
|---|---|---|
| **A** | **Tuleviku kuupäev saab vaikselt 2026. määra `exact: true` märkega.** 04.08.2027 → 220/176/264, hoiatuseta. Kommentaar lubab vastupidist; test kontrollib ainult liiga vana kuupäeva. **Peab olema fail-closed:** toetamata kuupäev keeldub summat andmast | `subsistenceRates.js` `resolveSubsistenceRates` |
| **B** | **Maamaks on valesti pinnast sõltumatu.** SKA järgi on maamaksu piirmäär m²-põhine ja SHS § 133 lg 5 p 9 ütleb ise „arvestamise aluseks on kolmekordne elamualune pind" | `subsistenceRates.js` `HOUSING_COST_KINDS` |
| **C** | **Kärpimismehhanism on tõlgendus, mitte seaduse ümberkirjutus.** Kood skaleerib proportsionaalselt (`norm/tegelik`), aga KOV kehtestab üüri piirmäära **ruutmeetrile** → õige tehe on tõenäoliselt `min(tegelik, piirmäär_m² × normpind)`. Need annavad eri tulemuse | `subsistence.js` `calculateHousingNormCost` |
| **D** | **Implementeerimata norm-erand:** kui eluruumi tubade arv võrdub alaliste elanike arvuga ja pind on normist suurem, võetakse normpinnana **kogu üldpind**. Kood ei tea tubade arvust midagi → alahindab | `subsistence.js` `socallyJustifiedAreaM2` |
| **E** | **Puuduvad kohustuslikud (mitte kaalutluslikud) reeglid:** § 131 lg 7–12 perekoosseisu erandid · sugulastevahelise üüri piirang · eluasemelaenu tingimused ja kuue kuu piir · korterelamu haldus- ja renoveerimiskulu elamutüübi tingimus · varasema eluasemevõla välistamine · maamaksuvabastuse mõju · õppiva alla 19-aastase töise tulu erand | `subsistence.js` |
| **F** | **Sisendivead muutuvad vaikides nulliks.** Tundmatu kululiik (`{internet: 99}`) → 0 € ja `caveats: []`; puuduv pind → ei kärbita; null pereliiget → siiski positiivne tulemus. Avalik kalkulaator peab keelduma või hoiatama nähtavalt | `subsistence.js`, testid |
| **G** | **Sissetuleku leping ei vasta vormile.** `excludedIncome` ainult kuvatakse, ei lahutata — eeldab, et välistatud tulud on juba `netIncome`-st eemaldatud. P1 vorm küsib aga ainult „eelmise kuu netosissetulekut"; tavakasutaja ei tea, mida sinna panna | `subsistence.js` + P1 |
| **H** | **DoD ei tõenda arvutuse ohutust** — kontrollib hoiatusi, keeli ja mittesalvestamist, aga mitte sisendivalideerimist, toetatud kuupäevavahemikku ega kohustuslikke erandeid | DoD allpool |

### P1 + P3 — mis on tehtud (04.08)

**Arvutus käib brauseris.** Tuum on puhas funktsioon, seega sissetulek, pere koosseis ja
eluasemekulud **ei lahku seadmest** — `fetch`-i ei ole, `localStorage`-it ei ole, server ei
näe kunagi kellegi sissetulekut. Testid keelavad nende ilmumise sellesse faili.

**Leht on avalik ja kontot ei nõua.** See ei ole mööndus: inimene, kes kaalub, kas tal võib
olla õigus toimetulekutoetusele, on tihti täpselt see, kes ei taha end kuskile kirja panna.
Turvaline on ta **konstruktsiooni, mitte lubaduse tõttu** — kui midagi ei saadeta, ei ole
midagi kaitsta.

Mõlemad lubadused („ei ole otsus" ja „jääb seadmesse") seisavad **enne vormi**, mitte tulemuse
juures: inimene peab teadma, mida ta teeb, enne kui ta sissetuleku sisestab.

**Brauseris tõendatud** (localhost, 04.08):

| Katse | Tulemus |
|---|---|
| 1 täisealine, muu sissetulek 150 € | **70,00 €** — piir 220, eluase 0, sissetulek 150. Kattub [SoM-i enda avaldatud näitega](https://www.sm.ee/uudised/toimetulekutoetus-touseb-ja-muutub-inimestele-lihtsamini-kattesaadavaks) |
| üür 300 € ilma täpsustusteta | **summat EI kuvata** — ilmusid kaks väravaküsimust ja kaks nimetatud puudujääki |

Brauseris leitud ja parandatud: kaks vastamata väravat andsid sama teate kaks korda järjest —
korduv lause näeb välja nagu viga, mitte nagu juhis.

### P1 — mida vorm peab küsima

Pere koosseis (täisealised, alaealised) · eelmise kuu netosissetulek · makstud elatis ·
täitemenetluses kinnipeetu · eluruumi üldpind · üksi elav pensionär või osalise/puuduva
töövõimega inimene (51 m² erisus) · eluasemekulud liikide kaupa.

**Vorm peab ütlema ette, mida ta ei tea** — mitte alles tulemuse juures.

### DoD

**Arvutuse ohutus** (leid H — varem puudus täielikult):

- [x] Toetamata kuupäev **keeldub** summat andmast (`UNSUPPORTED_DATE`), ei kuva lähimat määra.
- [x] Tundmatu kululiik **blokeerib**, ei kao vaikselt nulliks.
- [x] Puuduv eluruumi pind või tubade arv blokeerib, kui norm mõjutaks tulemust.
- [x] Negatiivne või vigane summa blokeerib.
- [x] Null pereliiget ei anna kunagi positiivset tulemust.
- [x] Vastamata õigusvärav blokeerib, ei muutu vaikseks eelduseks.
- [x] `usable: false` korral on `estimate` ja `surplus` alati `null`.
- [ ] P1 vorm suudab tuuma KÕIGI nõutud sisenditega varustada (pind, toad, väravad,
      tululiigid) — kui vorm ei küsi, ei tohi tuum arvata.

**Nähtavad lubadused:**

- [x] Iga tulemus kannab `isDecision: false` + `decidedBy: "KOV"`.
- [x] Iga eeldusel põhinev eluasemearvutus kannab `HOUSING_METHOD_ASSUMED_PROPORTIONAL`
      ja `KOV_HOUSING_LIMITS_UNKNOWN`.
- [ ] Need kaks jõuavad ka **nähtava lausena** kasutajani, mitte ainult koodikoodina.
- [ ] Selgitus on kolmes keeles (et/en/ru), `i18n:check` roheline.
- [x] Määrade tabelis on jooksva aasta rida, `confirmedUntil` ja allikaviide.
- [ ] Kontota avalik versioon ei salvesta sisestatud andmeid.

**Endiselt lahtine õigusküsimus (leid C).** Kui KOV-i piirmäärad on teadmata, kasutab tuum
proportsionaalset lähendit ja märgib selle eeldusena. Statuudijärgne tehe
`min(kulu, piirmäär_m² × normpind)` on koodis olemas ja rakendub kohe, kui `capsPerM2`
antakse. **Kumb on õige, kui piirmäärasid ei tea, on endiselt vastuseta** — see vastus tuleb
KOV-partnerilt või SoM-i selgitustaotlusest, mitte koodist.
