# ADR-075 — Aastata kuupäev on kehtivusperiood

04.10.2026. Teostus Claude Opus 5.5. Lähtekoht: [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md), jaotis 4, ja Codexi ülevaatuse järjekord („aastata kuupäev“).

**Mõõtmata.** Muudatus on serveri kuupäevalugemises; ühtegi mudeli juhist ei muudetud ja ühtegi tasulist kutset ei tehtud. Tõend on kohalikud testid. Need näitavad, et periood tekib ja õige redaktsioon lubatakse otsingusse, **mitte** seda, et vastus muudatuse üles leiab (vt „Piirid“).

## Probleem

Küsimus Q6 ja selle kordus R6: „Mis muutub Põhja-Sakala valla sotsiaalabi korras alates 6. oktoobrist?“

- Mõlema pöörde kirjes on `legal_periods` tühi ja kehtivuse aluskuupäev 04.10.2026. Õigusteksti lubatakse otsingusse ainult redaktsioonis, mis kehtib aluskuupäeval või küsitud perioodil ([ADR-038](adr-038-law-validity-check.md), [ADR-041](adr-041-exact-dates.md)). 6. oktoobril jõustuv redaktsioon jäi seega välja, kuigi ta on indeksis.
- Codexi sond: sama küsimus kujul „06.10.2026“ lisab perioodi ja lubab mõlemad redaktsioonid (kuni 05.10 ja alates 06.10).
- Põhjus: `dateCandidates` (`lib/rag-v2/pilot/retrieval-plan.js`) luges päeva ja kuud ainult koos aastaga.

## Otsus

Päev ja kuu ilma aastata on kuupäev: **tänasele lähim selline päev**, möödunud või tulev. Võrdse kauguse korral tulev.

- 04.10.2026 küsitud „6. oktoobrist“ on 06.10.2026; „1. jaanuarist“ on 01.01.2027; 10.02.2026 küsitud „1. jaanuarist“ on 01.01.2026.
- Päev, mida lähimates aastates pole („29. veebruaril“ 2026. aasta sügisel, „31. aprillil“), ei ole kuupäev.
- Leitud päev lisatakse kehtivusperioodina **tänase kõrvale**, nagu aastaga kuupäev. Tänane õigus ei kao kunagi; periood ei piira ajakirjade ilmumisaja otsingut (täpsus `day`).
- Tänane päev võetakse üks kord ja antakse nii kuupäevalugemisele kui kehtivuse aluskuupäevale (`retrieval.js`), et need ei saaks keskööl lahku minna.

### Mida loetakse

| Kuju | Näide | Tingimus |
|---|---|---|
| Päev ja kuu sõnaga | „alates 6. oktoobrist“, „6. oktoobril“, „6 oktoober“, „enne 6. oktoobrit“, „kuni 6. oktoobrini“, „6. oktoobriks“, „from 6 october“, „с 6 октября“ | Kuu on suletud loendi terve sõna: nimetav, omastav ja käänded -l, -st, -t, -ni, -ks; inglise ja vene nimi |
| Päev ja kuu numbritega | „alates 6.10“, „kuni 06.10 kehtib“ | Ainult kuupäeva küsiva sõna järel: alates, kuni, enne, pärast, peale, hiljemalt, seisuga, kuupäeval/-st/-ks/-ni, from, since, until, с, до, по, от |

### Mida ei loeta (testides vastunäidetena)

- Numbrid ilma kuupäevasõnata: „Hind oli 6.10.“, „Mis muutub 6.10?“. „6.10“ on ka hind, kellaaeg ja punkti number.
- Kuupäevasõna järel, aga raha või protsent: „Toetus on kuni 6.10 eurot.“, „kuni 6.10 % sissetulekust“.
- Kellaaeg, paragrahv, punkt, versioon, kümnendmurd: „kell 6.10“, „§ 6.10“, „punkt 6.10“, „1.5 aastat“.
- Kuu tüvi suvalise lõpuga: „3 mainitud toetust“, „5 maili“. Aastaga kuupäeva muster lubab tüve järel iga lõppu, sest aasta kinnitab kuupäeva; aastata kujul teeks see sõnast „mainitud“ kolmanda mai.
- Aastaga kuupäev („06.10.2026“, „6. oktoobril 2026“, „alates 6.10.26“) loetakse nagu enne; aastata reegel teda ei puuduta.

## Piirid

- **Vastuse paranemine on tõendamata.** R6-s oli piirkond õige, aga teadmiste rada ei valinud ühtki õigusakti lõiku; tõendites olid ainult valla toetuste kirjed. Periood lubab 6. oktoobri redaktsiooni otsingusse, kuid ei taga, et otsing ta valib ega et vastus kahte redaktsiooni võrdleb. Seda näitab ainult päris pööre.
- Paljas „6.10“ ilma kuupäevasõnata jääb lugemata (teadlik valik valehäirete vastu).
- „Lähim päev“ on eeldus. Kes küsib oktoobris „mis muutus 1. märtsil“, saab möödunud märtsi (õige); kes küsib jaanuaris „mis muutub 1. detsembrist“, saab möödunud detsembri, kuigi võis mõelda tulevat. Vale lugemine lisab ainult ühe lubatud perioodi; tänane õigus jääb alles.
- Lause lõpu number ja järgmise lause algus („Lapsi on 3. Mai lõpus …“) loetakse kuupäevaks. Mõju on sama: üks lisaperiood.
- Kolm või enam kuupäeva ühes sõnumis annab endiselt „liiga palju“ ja perioodi ei teki.
- Nädalapäevi, „järgmisel kuul“, „aasta algusest“ ja muid suhtelisi aegu ei loeta.

## Tõend

`tests/rag-v2-legal-scope.test.mjs`, neli uut testi:

1. „alates 6. oktoobrist“ annab 04.10.2026 perioodi 06.10.2026 ning kehtivuse kontroll lubab nii tänase kui 6. oktoobril jõustuva redaktsiooni; kõik tabeli kujud annavad sama päeva.
2. Lähim päev möödunud ja tuleva vahel (sh aastavahetus, võrdne kaugus, olematu päev).
3. Vastunäited annavad „perioodi pole“.
4. Aastaga kuupäevad on muutmata; kolm aastata kuupäeva on „liiga palju“; mudeli varem salvestatud periood jääb alles, kui uues sõnumis kuupäeva pole.

Versioonid ei muutunud (plaan 6, dialoog 24, vastus 12): juhiste tekst on sama. Vestlusplaani teostuse räsi uueneb väljalaskega nagu iga koodimuudatuse puhul ([ADR-037](adr-037-release-chat-plan.md)).

## Järgmine samm

Üks päris pööre küsimusega R6 näitaks, kas periood jõuab vastuseni. See on tasuline (küsimustiku järgi umbes 0,005 USD pööre) ja vajab omaniku luba.
