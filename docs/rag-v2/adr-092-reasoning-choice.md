# ADR-092 — Kasutaja valib vastuse arutlustaseme: menüü valik „Mõtle põhjalikumalt“

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „kas saaks teha nii, et mul on vestluse aknas lüliti 'kiire' ja 'põhjalikum'“, seejärel ekraanipilt teisest vestlusrakendusest („nt nii“), kus koostaja menüü viimane rida on linnukesega „Mõtle põhjalikumalt“, ja korraldus „Do this task here: Lisa vestluse menüüsse valik 'Mõtle põhjalikumalt'“.

**Kood on töös alates sellest PR-ist. Valik ilmub vestluse menüüsse siis, kui töötav vestlusplaan pakub kahte taset (jaotis „Kasutuselevõtt“). Kontrollitud testidega ja kohalikus brauseris testrežiimis (jaotis „Kontroll“). Kiire ja põhjaliku vastuse erinevus mudeliga on selle PR-i ajal mõõtmata.**

## Probleem

Vestluse pööre võtab 14–28 sekundit (viis pööret, mõõdetud 05.10.2026). Sellest 83–92% on kolm mudelikutset; vastuse kirjutamine üksi 8,5–22 s. Vektorotsing ise võtab soojalt 0,08–0,13 s.

Vastuse arutlustase on `medium`. Omanik otsustas nii 27.09 ja uuesti 29.09, kui mõõtmine näitas: `low` 37/40 õiget, vastuse kirjutamine 3,9 s; `medium` 39/40, 11,2 s. Tase on kirjas omaniku kinnitatud vestlusplaanis ja kehtis seni kõigile pööretele.

## Otsus

1. **Plaan võib pakkuda valikut.** Uus kinnitatav väli `reasoningChoices`: tasemete loend (`low`, `medium`, `high`), vähemalt kaks erinevat, plaani enda `reasoning` nende seas. `reasoning` jääb tasemeks, mida kasutatakse, kui kasutaja ei vali. Väli on osa sellest, mida omanik kinnitab: väljalaske uuendus hoiab selle alles, lisamine või eemaldamine teeb kinnituse kehtetuks.
2. **Päring võib taseme nimetada.** Vestluse päringu valikuline väli `reasoning` on lubatud ainult siis, kui see on plaani `reasoningChoices` seas. Muul juhul keeldub server (`reasoning_not_offered`) enne, kui midagi salvestatakse või saadetakse. Valik on osa pöörde identiteedist ja jääb pöörde kirjesse (`payload.reasoning`; saadetud päringu tase on `requestAudit.body.reasoning.effort`).
3. **Erineb ainult vastuse kirjutamine.** Otsinguplaan ja lõikude valik käivad endiselt `low`-ga; otsing, allikad ja kõik kontrollid on mõlemas olekus samad.
4. **Koostaja „+“ menüüs on linnukesega rida „Mõtle põhjalikumalt“.**
   - Linnuke sees = kõrgeim pakutud tase, linnuke maas = madalaim. Praeguse plaaniga: sees `medium`, maas `low`.
   - **Vaikimisi on linnuke sees**, sest plaani enda tase on `medium`. Omaniku 29.09 otsus jääb vaikekäitumiseks; kiirem vastus on kasutaja enda valik.
   - Rida on tekstiga nagu teised read (menüüs ei ole ikoone, tellija 07.07), linnuke paremal. Menüü jääb klõpsu järel lahti, et muutus oleks näha. Valik kehtib järgmisest küsimusest.
   - Valik jääb meelde selles brauseris. Kui plaan seda taset enam ei paku, kasutatakse plaani enda taset.
   - Rida on ainult tavavestluses ja ainult siis, kui plaan pakub kahte taset. Ruumivestluses ja dokumendi koostamise lehel seda ei ole.
5. **Hindaja** (`scripts/rag-v2-conversation-eval.mjs`) sai valiku `--reasoning low|medium|high`: iga pööre küsib seda taset nagu kasutaja valik. Kahte olekut saab nii võrrelda ühe plaaniga.
6. **Korpuse täiendus hoiab valiku.** `scripts/rag-v2-corpus-run.sh` teeb iga täiendusega uue plaani; see loeb nüüd töötavast plaanist `reasoningChoices` ja annab need uuele plaanile. Muidu kaoks rida menüüst järgmise täiendusega.

## Mida see ei muuda

- Plaan ilma väljata ja päring ilma valikuta käituvad täpselt nagu enne.
- Eelarve arvestus on sama: arutlus mahub samasse väljundi piiri.
- Dokumentide pool (transkripti ja koosoleku kokkuvõte) kasutab eraldi serveri seadet `OPENAI_REASONING_EFFORT` (`medium`) ega ole selle valikuga seotud. Dokumendi koostamine ja failianalüüs on endiselt peatatud.

## Kasutuselevõtt

Töötav plaan valikut ei paku, seega rida ei ole enne näha. Vaja on uut omaniku kinnitatud plaani:

```bash
node scripts/rag-v2-chat-plan.mjs ... --reasoning medium --reasoning-choices low,medium --budget-usd 4 --basis "<omaniku korraldus>" --activate
```

ja sama plaani aktiveerimist töötava väljalaske env-failis (`scripts/rag-v2-plan-release.mjs activate`, siis `ready` ja teenuse taaskäivitus), nagu korpuse täiendusel.

## Kontroll

- **Testid** (`tests/rag-v2-reasoning-choice.test.mjs`, `tests/rag-v2-pilot-store.test.mjs`, `tests/rag-v2-corpus-run.test.mjs`): plaani välja kontroll; uus plaan ja väljalaske uuendus; keeldumine pakkumata tasemest enne salvestamist; terve pööre andmebaasiga (vastusepäringus valitud tase, kirjes valik, sama võti teise valikuga on teine sisend); brauseri olek ja meelespidamine; korpuse täiendus kannab valiku edasi.
- **Kohalikus brauseris, testrežiimis** (kohalik plaan kahe tasemega, fikseeritud testvastaja, ühtegi mudelikutset):

| Mida | Tulemus |
|---|---|
| Rida menüüs | viies rida, `menuitemcheckbox`, vaikimisi `aria-checked="true"` |
| Stiil | sama mis naabritel: kiri 17 px, sama värv, polsterdus ja nurgaraadius; rea kõrgus 46,75 px nagu teistel |
| Linnuke | teksti värvi, 18,7 px, paremal; maas olles nähtamatu, rida ei nihku |
| Klõps | `aria-checked="false"`, menüü jääb lahti, brauseris salvestatud `low` |
| Saadetud päring, linnuke maas | `reasoning: "low"`; kirjes valik `low`, vastusepäringu tase `low` |
| Lehe uuestilaadimine | linnuke jääb maha |
| Saadetud päring, linnuke sees | `reasoning: "medium"`; kirjes `medium` |
| Vaate laius | 419 px ja 850 px: menüü mahub ekraanile |

- **Leitud ja parandatud mõõtes:** üldise 15rem laiusepiiriga jäi reast 1,3 px puudu ja tekst murdus kahele reale (rea kõrgus 73,1 px). „+“ menüü võib nüüd olla kuni 18rem lai; eesti keeles on menüü 241 px (enne 240).
- Konsoolis ei olnud selle muudatuse vigu (ainult kohaliku aadressi analüütika CORS-teated).

**Kontrollimata:** tume teema (linnuke kasutab teksti värvi), inglise ja vene keele rea laius, päris mudeliga pööre.

## Lahti

- Kiire ja põhjaliku vastuse aja ja kvaliteedi võrdlus vestlusaknas (omaniku korraldus 06.10; tasuline, tulemus lisatakse siia).
- Inglis- ja venekeelne silt („Think more thoroughly“, „Думать основательнее“) on minu valitud; omanik neid üle vaadanud ei ole.
