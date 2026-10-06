# ADR-092 — Kasutaja valib vastuse arutlustaseme: menüü valik „Mõtle põhjalikumalt“

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „kas saaks teha nii, et mul on vestluse aknas lüliti 'kiire' ja 'põhjalikum'“, seejärel ekraanipilt teisest vestlusrakendusest („nt nii“), kus koostaja menüü viimane rida on linnukesega „Mõtle põhjalikumalt“, ja korraldus „Do this task here: Lisa vestluse menüüsse valik 'Mõtle põhjalikumalt'“.

**Töös alates #396 ja plaanist `m4-corpus-chat-20261006a.json` (06.10.2026): valik on sotsiaal.pro vestluse menüüs. Mõõdetud samal päeval vestlusaknas (jaotis „Mõõtmine vestlusaknas“): kiire vastus tuleb keskmiselt 9,7–10,0 sekundiga, põhjalik 15,6–18,5 sekundiga.**

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

**Tehtud 06.10.2026:** plaan `m4-corpus-chat-20261006a.json` (alus: omaniku korraldus lisada valik; sama korpus, kasutaja, hinnad ja 4 USD ülempiir nagu senistel plaanidel; ainus seadete erinevus eelmisest on `reasoningChoices`). Rida on päris lehel näha ja vaikimisi linnukesega.

Ilma sellise plaanita valikut ei pakuta ja rida ei ole näha. Plaan tehakse nii:

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

## Mõõtmine vestlusaknas (06.10.2026)

Omaniku korraldus 06.10: „10 küsimust küsi vestluse aknas, mõõda aeg. mõõda kõik medium ja siis low, võrdle aegu. Siis mõtle täiesti uued 10 küsimust ja tee test uuesti.“ Ulatus ja ülempiir (0,40 USD) öeldud enne jooksu. **Kulu 0,2341 USD** plaani hindades (46 pööret koos soojenduse ja ühe katkenud pöördega). [Tõend](../audits/evidence/reasoning-choice-measured-2026-10-06.json) ilma vastuste tekstita.

**Kuidas:** sotsiaal.pro vestlusaknas omaniku kontoga, iga küsimus uues vestluses; komplekti 10. küsimusel on samas vestluses jätkusõnum, seega 11 pööret komplekti kohta. Linnuke „Mõtle põhjalikumalt“ sees = `medium`, maas = `low`. Ajad on serveri enda etapiajad pöörde kirjest.

| Komplekt | Režiim | Pööre kokku | Esimene tekst | Vastuse kirjutamine | Vahemik |
|---|---|---|---|---|---|
| 1 (tuttavad küsimused) | põhjalik | 18,5 s | 16,4 s | 11,5 s | 11,9–24,5 s |
| 1 | kiire | 10,0 s | 7,5 s | 4,0 s | 7,2–13,2 s |
| 2 (uued küsimused) | põhjalik | 15,6 s | 13,7 s | 9,0 s | 12,1–20,6 s |
| 2 | kiire | 9,7 s | 7,3 s | 3,7 s | 7,7–12,6 s |

- **Kiire on 6–8,5 s kiirem** (38–46%). Kogu vahe tuleb vastuse kirjutamisest: 11,5 → 4,0 s ja 9,0 → 3,7 s. Otsinguplaan (2,0–2,4 s), embedding (0,4–0,6 s) ja otsing koos lõikude valikuga (3,5–4,1 s) on mõlemas samad.
- **Esimene tekst ilmub kiires režiimis umbes 7,4 s järel**, põhjalikus 13,7–16,4 s järel.
- **Järjekord ei seletanud vahet.** Esimeses komplektis küsiti põhjalik enne, teises kiire enne; vahe oli mõlemal juhul sama suunaga. Brauseris mõõdetud ajad (päringust voo lõpuni) on serveri omadest 0,4–0,5 s pikemad.
- **Arutlus:** põhjalik kasutas vastuse kohta keskmiselt 990–1407 arutlustokenit, kiire 48–59 (enamasti 0).
- **Kiire vastus on pikem, mitte lühem:** keskmiselt 1174–1193 tähemärki, põhjalik 944–958. Põhjalik valib kitsamalt.
- **Sisu, esimene komplekt** (jämedad mustrid, iga küsimuse kohta üks ootus): põhjalik 10/11, kiire 11/11. Põhjaliku ainus möödalask: Tallinna eaka isa küsimuses nimetas vastus koduteenust ja abivajaduse hindamist, aga mitte üldhooldust; kiire nimetas mõlemat. Toimetulekupiiri 2028 kohta ütlesid mõlemad õigesti, et summat kinnitada ei saa (minu esimene muster oli liiga kitsas; lugesin mõlemad vastused läbi ja parandasin mustri).
- **Sisu, teine komplekt:** ootusi ei olnud ette kirjutatud, seega sisu ei ole hinnatud. Vastuse liik oli mõlemas režiimis sama (7 täielikku, 4 osalist).

**Mida see ei näita:** kumb režiim vastab paremini. 22 küsimust jämedate mustritega ei ole kvaliteedi mõõt. 29.09 mõõtmine 40 pöördega andis `low` 37/40 ja `medium` 39/40; see mõõtmine seda ei kinnita ega lükka ümber.

**Kõrvalleid:** esimese komplekti teine küsimus (Tallinn) katkes esimesel katsel veaga `audit_packet_too_large`. Põhjus ei olnud arutlustase, vaid salvestatava paketi piir; parandatud samal päeval (#397, [ADR-089](adr-089-closest-contact-directory.md) jaotis „Auditipaketi piir“). Küsimus küsiti pärast parandust uuesti. Esimese komplekti 1. ja 3. küsimus põhjalikus režiimis on mõõdetud enne seda parandust; parandus ajakulu ei puuduta.

**Meetodi märkused:** esimese komplekti põhjaliku režiimi küsimused 1–7 saadeti päris klahvivajutustega, ülejäänud lehel oleva skriptiga läbi sama koostaja ja sama „uus vestlus“ toimingu. Pärast teenuse taaskäivitust tehti üks soojenduspööre, mis arvesse ei lähe.

## Lahti

- **Järjest ühes vestluses** küsitud küsimuste aeg on mõõtmata. Siis loeb otsinguplaan varasemaid sõnumeid ja kontekst kasvab; omanik küsis, kas see muudab tulemust.
- **Kvaliteedi võrdlus** vajab ette kirjutatud ootustega kataloogi ja mõlemat režiimi; hindajal on selleks nüüd `--reasoning`.
- Inglis- ja venekeelne silt („Think more thoroughly“, „Думать основательнее“) on minu valitud; omanik neid üle vaadanud ei ole.
- Tume teema ning inglise ja vene sildi laius on brauseris kontrollimata.
