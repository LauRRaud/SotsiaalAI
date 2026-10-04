# ADR-075 — Aastata kuupäev on kehtivusperiood

04.10.2026. Teostus Claude Opus 5.5. Lähtekoht: [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md), jaotis 4, ja Codexi ülevaatuse järjekord („aastata kuupäev“).

**Mõõdetud pärast avaldamist, omaniku loal** (jaotis „Mõõtmine“): üks pööre, läbis, 0,0052 USD. Pöördekirjes on periood 06.10.2026, otsing leidis 6. oktoobrist kehtiva redaktsiooni ja vastus viitab sellele. Varasemat redaktsiooni tõenditesse ei valitud, nii et vastus ei võrdle sõnastusi ja ütleb seda ise.

Muudatus on serveri kuupäevalugemises; ühtegi mudeli juhist ei muudetud. #348 läks tootmisse mõõtmata, kohalike testidega.

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

- **Üks pööre, üks kord.** Mõõtmine näitab, et periood jõuab otsinguni ning uus redaktsioon leitakse ja sellele viidatakse. See ei erista muudatuse mõju mudeli kõikumisest: R6-s ei valinud järjestaja vana redaktsiooni lõikudest ühtki, nüüd valis kuus uue redaktsiooni lõiku.
- **Vastus ei võrdle redaktsioone.** Tõendites olid ainult uue redaktsiooni lõigud. Vastus kirjeldab sätteid, millel on muutmismärge, ja ütleb, et ei saa öelda, milline sõnastus on uus. Küsimusele „mis muutub“ on see osaline vastus.
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
5. Pärast mõõtmist lisatud: mõõdetud pööre läbib kataloogi kontrollid, R6 kirje enne muudatust ei läbi (otsing, viide, sisu).

Versioonid ei muutunud (plaan 6, dialoog 24, vastus 12): juhiste tekst on sama. Vestlusplaani teostuse räsi uueneb väljalaskega nagu iga koodimuudatuse puhul ([ADR-037](adr-037-release-chat-plan.md)).

## Mõõtmine (04.10.2026, pärast avaldamist)

Omaniku luba 04.10 („tegutse“ pakkumisele: üks päris pööre sama küsimusega, umbes 0,005 USD). Kataloog `tests/evaluation/dialogue/scenarios-yearless-date-1.json` on kirjutatud ja kohalikult salvestatud enne jooksu; küsimus on R6 sõna-sõnalt, vestluse esimese sõnumina. Jooks töötavalt väljalaskelt `a9f88988`, `--auto-modes`, `--max-usd 0.02`. [Tõendifail](../audits/evidence/yearless-date-measured-2026-10-04.json).

| | R6 enne (küsimustik 04.10) | Nüüd |
|---|---|---|
| Periood pöördekirjes | puudub (`no_period`) | 06.10.2026, aluskuupäev 04.10.2026 |
| Piirkond | Põhja-Sakala | Põhja-Sakala |
| Teadmiste rada | ei valinud ühtki lõiku | kuus lõiku, kõik 6. oktoobrist kehtivast redaktsioonist |
| Vana redaktsioon (kuni 05.10) tõendites | – | 0 lõiku; välja jäetud ei olnud kumbki redaktsioon |
| Viidatud | mitte midagi | kord, 6. oktoobrist kehtiv redaktsioon |
| Vastuse liik | toetuseta, küsis tagasi | osaline, ei küsinud tagasi |
| Kulu plaanihindades | 0,0045 USD | 0,0052 USD |
| Aeg | 12,4 s | 23,9 s |

**Mida vastus ütles.** Taotluse esitamine ja lisatavad andmed (kuni kolme kuu sissetulekud, eelneva kuu eluasemekulude tõendid), kes võib abi vajava inimese eest taotleda, valla õigus teha päringuid, ülesannete jaotus ametiasutuse ja valitsuse vahel. Need sätted on uues redaktsioonis tõesti muudetud (võrdlus lähtefailidega `Andmebaasi/oigusaktid/404072025051.xml` ja `403102026022.xml`). Lõpus ütleb vastus, et ei saa väljavõtete põhjal täpselt võrrelda, milline sõnastus või kohustus on uus, sest varasemat redaktsiooni tal ei ole.

**Mida kontrollid näitasid.** Kõik viis läbisid. `must` tabas sõna „spetsialist“ lauses, kus uus redaktsioon selle sõna tõesti vahetas; muster üksi on jäme, hinnang tugineb kogu vastuse lugemisele.

**Mida jooks ei näidanud.** Kas vastus toob välja suuremad sisulised muudatused (sünni- ja matusetoetuse taotlemise tähtaeg kolm kuud, puudega lapse hooldajatoetus alates 18 kuu vanusest, hoolduse seadmine kuni viieks aastaks, vähekindlustatud leibkonna mõiste): neid lõike järjestaja ei valinud. Kas numbritega kuju („alates 6.10“) käitub päris vestluses samamoodi.

## Järgmine samm

Otsustada, kas „mis muutub“ küsimus vajab mõlema redaktsiooni lõike kõrvuti. Praegu lubab periood mõlemad redaktsioonid otsingusse, aga järjestaja valib lõigud küsimuse järgi ja võrdluspaari ei taga. See on eraldi muudatus (otsing või vastuse juhis), mille mõju tuleks mõõta; alustamata.
