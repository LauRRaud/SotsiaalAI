# A2 — Toimetulekutoetuse eelkalkulaator: arendusleping

STATUS: väljastatud 04.08.2026. Leping ei muutu pärast väljastamist — muudatused
lähevad `SotsiaalAI.md`-sse.

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
lapseks. 18–19-aastased õpilased jäävad lapse piirmäära alla.

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
| **P1 — pöörduja vorm ja selgitus** vestluses / teekonnal | tegemata |
| **P2 — dokumentide kontrollnimekiri** taotluse jaoks | tegemata |
| **P3 — kontota avalik leht** (SEO-uks) | tegemata |
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

### P1 — mida vorm peab küsima

Pere koosseis (täisealised, alaealised) · eelmise kuu netosissetulek · makstud elatis ·
täitemenetluses kinnipeetu · eluruumi üldpind · üksi elav pensionär või osalise/puuduva
töövõimega inimene (51 m² erisus) · eluasemekulud liikide kaupa.

**Vorm peab ütlema ette, mida ta ei tea** — mitte alles tulemuse juures.

### DoD

- [ ] Iga tulemus kannab nähtavat lauset „see ei ole otsus, määrab KOV".
- [ ] Iga eluasemekuluga tulemus kannab nähtavat lauset KOV-i piirmäärade kohta.
- [ ] Selgitus on kolmes keeles (et/en/ru), `i18n:check` roheline.
- [ ] Määrade tabelis on jooksva aasta rida ja allikaviide.
- [ ] Kontota avalik versioon ei salvesta sisestatud andmeid.
