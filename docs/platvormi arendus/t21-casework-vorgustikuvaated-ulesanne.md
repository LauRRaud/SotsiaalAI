# ÜLESANNE: T21 `CASEWORK` P4/P5 — Genogramm ja ökokaart (VÕRGUSTIKUVAATED)

**Olek:** `READY_TO_ASSIGN — KAKS VÄRAVAT LAHTI` (vt „Väravad enne koodi"). Teema oli `BLOCKED_DECISION` O-CW-7 taga; omanik langetas 19.07 aluse-otsuse ja see leping ehitab selle peale.
**Teostus:** üks haru, etapid E1–E6. **E1 ja E2 on lahutamatud** — kustutusõiguse rada peab olema olemas ENNE esimest püsikirjet, mitte pärast.
**Soovitatud teostaja:** Sol/Fable High (andmemudel + õiguste protseduurirada).
**Alus:** `docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` ptk 5 (kuue dimensiooni leping, alaealiste reegel) + ptk 6 (juhtumitöö lepingud) + COLLAB ptk 3 klass 5 + ptk 8 (alaealised).

## Miks see leping nüüd olemas on

Omaniku otsus 19.07 (**O-CW-7 alus**): **genogramm ja ökokaart on sotsiaaltöö tavapraktika seadusest tuleneva ülesande peal — meedium ei loo uut töötlemist.** Sotsiaaltöötaja koostab võrgustikukaardi niikuinii, paberil või ekraanil; spetsialistil on isikuandmete töötlemise raamleping olemas. Seega küsimus „kas mittekasutajate kirjeid tohib üldse luua" on vastatud ja senine kaitsereegel („mittekasutajate püsikirjeid EI LOODA") **asendub selle lepinguga**.

**Mida see otsus EI kata ja mis jääb väravaks:** art 14 teavitamiskohustus ja vastutava töötleja roll. Need ei ole „kas tohib" küsimused — need on „kelle kohustus ja mis mehhanismiga" küsimused, mis kehtivad ka paberil ja mille vastus muudab koodi (kas kirjel on teavitamise märge, kes vastab kustutusnõudele).

## Väravad enne koodi (kaks vastust, mitte üldine õigusanalüüs)

| # | Küsimus | Mida kood selle järgi teeb |
|---|---|---|
| **V1** | **Art 14 praktika:** kas, millal ja kuidas teavitatakse kolmandat isikut, kes satub juhtumikaardile? Mis on asutuse praegune paberipraktika? | Kas mittekasutaja kirjel on `notifiedAt`/`notificationBasis` väli ja kohustuslik olek; kas teavitamata kirje tohib eksisteerida ja kui kaua; kas kaardi jagamine nõuab teavitamise fakti |
| **V2** | **Vastutav töötleja (= O-CW-1):** KOV/asutus või platvorm? | Kelle nimel läheb välja art 14 teade; kes vastab pereliikme ligipääsu-/parandus-/kustutusnõudele; kas platvorm on volitatud töötleja ja vajab vastavat lepingurida |

**V1 ja V2 vastused kirjutatakse siia lepingusse ENNE E1 algust.** Ilma nendeta võib teha ainult E0 (allpool). Kõik ülejäänud arhitektuurinõuded kehtivad **sõltumata** sellest, millised vastused on — need on alusdokumendi ptk 5 leping ja neid ei avata uuesti.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` — **ptk 5 tervikuna** (kuus dimensiooni + alaealised), ptk 4.1 (vaadete arhitektuur), ptk 6.2 (jagamisleping)
4. COLLAB analüüs: ptk 3 klass 5 (kolmandate isikute andmed), ptk 8 (alaealised)
5. **Kood:** `lib/workspaces/provenance.js` (jagatud päritolusõnastik — T21 P0 tulemus, MITTE uut sõnastikku), `lib/casework/` adapterid (P0/P1), supersededBy-ahela muster (Tööheaolu `wellbeing_record_supersede` migratsioon), U1 outbox `lib/events/`

## Alus ja worktree

1. **Baas = `main`-i praegune tipp.** `git rev-parse main`, raporteeri SHA.
2. Worktree: `git worktree add ../SotsiaalAI-casework-network -b codex/casework-network main`
3. Migratsioonid: **jah** (uus mittekasutaja-kirje mudel + versioonimine + retention-väljad). Ajatempel uusimast hilisem.
4. Tõlkefailid ainult selle teema võtmetes, ET/EN/RU pariteet.

## Lukustatud otsused (alusdokumendi ptk 5 — EI avata uuesti)

| Dimensioon | Leping |
|---|---|
| **Minimaalsus** | Miinimumväljad: kuvanimi (võib olla roll/initsiaal — „ema", „perearst R"), suhte domeen+tüüp, kaasamise/kaardistamise eesmärk. **EI vaikimisi:** kontaktandmed, sünniaeg, isikukood, terviseinfo, aadress. Iga lisaväli nõuab dokumenteeritud vajadust. Eluloofaktid (surm, lahutus) on lubatud struktuurifaktid — ei ole eriliigi andmed, aga on pieteeditundlikud |
| **Nähtavus** | Kirje nähtav ainult kaardi omanikuringile. Mittekasutaja ise ei näe platvormil midagi |
| **Parandamine** | Versioonitud (`supersededBy`-ahel). Kliendi eriarvamus järgib „sain aru / mul on parandus" mustrit. Kolmanda isiku parandustaotlus käib andmesubjekti õiguste protseduuri kaudu — **admin-protseduurirada auditijäljega** |
| **Eemaldamine** | Kustutus mõjub läbi **KÕIGI vaadete korraga**. Ei kustuta ajaloolisi külmutatud jagamisi, aga märgib need „kirje eemaldatud" markeriga |
| **Retention** | Kaasamise/kaardistamise **lõpp on kohustuslik väli** („igavesti vaikimisi" keeld). Juhtumi sulgemine käivitab kaardi **ülevaatuse, mitte automaatkustutuse** — inimene otsustab. Tähtaja möödumisel U1 sündmus omanikule, mitte vaikiv kustutus |
| **Alaealised** | Genogramm sisaldab lapsi paratamatult. Lapse kirje kannab **AINULT struktuurifakte** (laps, vajadusel vanusevahemik — MITTE sünnikuupäev) ja **ei ole kunagi jagatava väljavõtte vaikimisi osa**. Lapse/eestkostja ligipääsumudel jääb teadlikult MVP-st välja |
| **Jagamine** | Elav kaart **ei liigu kunagi**. Ainult külmutatud väljavõte olemasoleva `shareKeys`-mustri kaudu |

## Teostus

### E0 — Väravate täitmine (võib teha enne V1/V2 vastuseid)

Kirjuta V1 ja V2 vastused sellesse lepingusse. Kui vastused muudavad mõnda välja allpool, paranda leping ENNE koodi. Muud tööd E0-s ei ole.

### E1 — Mittekasutaja kirje mudel (migratsioon)

`CaseNetworkPerson` (või alusdokumendi nimi): omanik-juhtum, kuvanimi, suhte domeen+tüüp, kaardistamise eesmärk, kaasamise lõpp (**kohustuslik**), päritolumärgistus jagatud `provenance.js` kaudu, `supersededBy` ahel, V1-st tulenevad teavitamise väljad. Miinimumväljade jõustus koodis: lisaväljade lisamine nõuab eraldi migratsiooni + dokumenteeritud vajadust, mitte vaba JSON-i.

### E2 — Andmesubjekti õiguste rada (LAHUTAMATU E1-st)

Kustutus, parandus ja ligipääsuvastus kolmandale isikule: admin-protseduurirada auditijäljega, kustutus mõjub kõigis vaadetes korraga, külmutatud jagamised saavad „kirje eemaldatud" markeri. **E1 ei lähe merge'i ilma E2-ta** — alusdokument nõuab, et rada on olemas enne esimest püsikirjet.

### E3 — Retention ja ülevaatus

Kohustuslik lõpp-väli, juhtumi sulgemine → kaardi ülevaatuse ülesanne (mitte kustutus), tähtaja möödumine → U1 sündmus omanikule. Ühendus olemasoleva `runRetentionCleanup` mustriga, ilma vaikiva kustutuseta.

### E4 — Genogramm (perestruktuur)

Struktuurivaade `FAMILY`-domeeni seostest. Alaealiste reegel jõustatud vaates ja väljavõttes.

### E5 — Ökokaart (keskkonnaseosed)

`ENVIRONMENT`-domeeni seosed. Sama kirjekiht mis E4 — **kaks vaadet, üks tõde** (ptk 4.1 vaadete-arhitektuuri põhieelis, mis teeb ka kustutuse ühekorraga toimivaks).

### E6 — Jagamispiir

Külmutatud väljavõte `shareKeys`-mustri kaudu; elav kaart ei liigu; alaealised ei ole vaikimisi väljavõttes; V1-st tulenev teavitamise eeltingimus jagamisel, kui vastus seda nõuab.

## Selgelt väljas

- Lapse/eestkostja ligipääsumudel (ideed 17 k12) · kliendi õigus näha teda puudutavat kaarti (**O-CW-9**, eraldi otsus) · võrgustikuruum ja juhtumikonverents (COLLAB perekond A, O-CO-10) · meetodite teadmusbaas (P6, ootab O-CW-5) · P2 STAR2-ülekanne ja P3 Meetodipeegel (eraldi paketid) · merge, deploy, PR, tootmisandmete lugemine.

## Nõutud testilepingud

1. Mittekasutaja kirje **ei saa** kanda keelatud välju (kontaktandmed, isikukood, sünniaeg, terviseinfo, aadress) — mutatsioonikontroll: välja lisamine kukutab testi.
2. Kaasamise lõpp on **kohustuslik** — ilma selleta kirjet ei teki.
3. Kustutus mõjub **korraga** genogrammil ja ökokaardil; külmutatud jagamine säilib, aga kannab „kirje eemaldatud" markerit.
4. Parandus loob **uue versiooni** (`supersededBy`), vana jääb auditisse; kolmanda isiku taotlus jätab auditijälje.
5. Juhtumi sulgemine tekitab **ülevaatuse ülesande**, MITTE kustutuse; tähtaja möödumine tekitab U1 sündmuse.
6. Lapse kirje kannab ainult struktuurifakte ja **ei satu** jagatavasse väljavõttesse vaikimisi.
7. Elav kaart ei ole jagatav ühegi marsruudi kaudu; ainult külmutatud väljavõte.
8. Kaardi näeb ainult omanikuring; võõras saab 404 (mitte 403 — ei ole eksistentsi-oraaklit).
9. V1 vastusest tulenev teavitamise invariant (kui vastus seda nõuab) on jõustatud, mitte ainult kuvatud.
10. ET/EN/RU pariteet, klaviatuur, fookus, aria-live, mobiil, reduced-motion.

## Sünteetiline runtime ja DoD

Lokaalne sünteetiline DB, olemasolevad testidentiteedid. Tõenda: kirje loomine miinimumväljadega, keelatud välja tõrge, kustutuse levik mõlemasse vaatesse + külmutatud jagamise marker, versioonitud parandus, retention-ülevaatus + U1 sündmus, alaealise kirje väljavõttest väljajäämine. Korista kõik loodud juhtumid, kirjed, jagamised ja sündmused.

**Valmis on siis, kui** E1–E6 on samas harus, V1/V2 vastused on lepingus, kustutusrada töötab enne esimest püsikirjet, kuue dimensiooni leping on koodis jõustatud (mitte ainult dokumenteeritud), worktree puhas, commit/push tehtud. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne

Esita worktree, haru, baas-SHA, lõppcommit/remote SHA, migratsioonid, E1–E6 kokkuvõte, testid/lint/i18n/Prisma/migratsiooniahel/build, sünteetiline runtime või `NOT_PROVEN`, **V1/V2 vastused nagu need lepingusse kirjutati**, välja jäänud osad ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. Seisutabeli T21 rida → uus olek, haru + SHA, mis P-pakettidest valmis.
2. Järjekord → mis avanes (nt O-CW-9 kliendi vaade), mis järgmine.
3. Vananenud väide → paranda kohe (nt „P4/P5 ootab O-CW-7 juristi" → alus otsustatud 19.07).
