# ADR-092 — Kasutaja valib vastuse arutlustaseme: välgunupp „Kiire vastus“

06.10.2026. Teostus Claude Opus 5.5. Omanik 06.10: „kas saaks teha nii, et mul on vestluse aknas lüliti 'kiire' ja 'põhjalikum'“, seejärel ekraanipilt teisest vestlusrakendusest („nt nii“), kus koostaja menüü viimane rida on linnukesega „Mõtle põhjalikumalt“, ja korraldus „Do this task here: Lisa vestluse menüüsse valik 'Mõtle põhjalikumalt'“.

**Töös alates #396 ja plaanist `m4-corpus-chat-20261006a.json` (06.10.2026). Mõõdetud samal päeval vestlusaknas (jaotis „Mõõtmine vestlusaknas“): kiire vastus tuli 44 pöördes keskmiselt 9,8 sekundiga, põhjalik 17,0 sekundiga.**

**Muudetud samal päeval omaniku sõnul (jaotis „Välgunupp ja kiire vaikimisi“): valik on nüüd välgunupp koostaja paremas servas mikrofoni kõrval, menüürida on eemaldatud, ja vaikimisi on kiire vastus (`low`).** Allpool kirjeldavad punktid 1–3, 5 ja 6 endiselt kehtivat lahendust; punkt 4 kirjeldab esimest kuju (menüürida), mille välgunupp asendas.

## Probleem

Vestluse pööre võtab 14–28 sekundit (viis pööret, mõõdetud 05.10.2026). Sellest 83–92% on kolm mudelikutset; vastuse kirjutamine üksi 8,5–22 s. Vektorotsing ise võtab soojalt 0,08–0,13 s.

Vastuse arutlustase on `medium`. Omanik otsustas nii 27.09 ja uuesti 29.09, kui mõõtmine näitas: `low` 37/40 õiget, vastuse kirjutamine 3,9 s; `medium` 39/40, 11,2 s. Tase on kirjas omaniku kinnitatud vestlusplaanis ja kehtis seni kõigile pööretele.

## Otsus

1. **Plaan võib pakkuda valikut.** Uus kinnitatav väli `reasoningChoices`: tasemete loend (`low`, `medium`, `high`), vähemalt kaks erinevat, plaani enda `reasoning` nende seas. `reasoning` jääb tasemeks, mida kasutatakse, kui kasutaja ei vali. Väli on osa sellest, mida omanik kinnitab: väljalaske uuendus hoiab selle alles, lisamine või eemaldamine teeb kinnituse kehtetuks.
2. **Päring võib taseme nimetada.** Vestluse päringu valikuline väli `reasoning` on lubatud ainult siis, kui see on plaani `reasoningChoices` seas. Muul juhul keeldub server (`reasoning_not_offered`) enne, kui midagi salvestatakse või saadetakse. Valik on osa pöörde identiteedist ja jääb pöörde kirjesse (`payload.reasoning`; saadetud päringu tase on `requestAudit.body.reasoning.effort`).
3. **Erineb ainult vastuse kirjutamine.** Otsinguplaan ja lõikude valik käivad endiselt `low`-ga; otsing, allikad ja kõik kontrollid on mõlemas olekus samad.
4. **Koostaja „+“ menüüs on linnukesega rida „Mõtle põhjalikumalt“** (esimene kuju, #396; asendatud välgunupuga, vt allpool).
   - Linnuke sees = kõrgeim pakutud tase, linnuke maas = madalaim. Praeguse plaaniga: sees `medium`, maas `low`.
   - **Vaikimisi on linnuke sees**, sest plaani enda tase on `medium`. Omaniku 29.09 otsus jääb vaikekäitumiseks; kiirem vastus on kasutaja enda valik.
   - Rida on tekstiga nagu teised read (menüüs ei ole ikoone, tellija 07.07), linnuke paremal. Menüü jääb klõpsu järel lahti, et muutus oleks näha. Valik kehtib järgmisest küsimusest.
   - Valik jääb meelde selles brauseris. Kui plaan seda taset enam ei paku, kasutatakse plaani enda taset.
   - Rida on ainult tavavestluses ja ainult siis, kui plaan pakub kahte taset. Ruumivestluses ja dokumendi koostamise lehel seda ei ole.
5. **Hindaja** (`scripts/rag-v2-conversation-eval.mjs`) sai valiku `--reasoning low|medium|high`: iga pööre küsib seda taset nagu kasutaja valik. Kahte olekut saab nii võrrelda ühe plaaniga.
6. **Korpuse täiendus hoiab valiku.** `scripts/rag-v2-corpus-run.sh` teeb iga täiendusega uue plaani; see loeb nüüd töötavast plaanist `reasoningChoices` ja annab need uuele plaanile. Muidu kaoks rida menüüst järgmise täiendusega.

## Välgunupp ja kiire vaikimisi (06.10.2026)

Omanik samal päeval, pärast mõõtmist: „et see võiks olla siin paremal ikoonide juures valik?“, siis „okei, paneme ainult välgu ja tee low hetkel ka default“ ning brauseris proovides „ikoon vist ei peaks olema täidetud, vaid tume servadest, kui on valitud low“ ja „liiga paksud servad on vist ikoonil […] liiga palju häirib kui on sisse lülitatud“.

1. **Üks lüliti: välgunupp koostaja paremas servas**, mikrofoni vasakul. Menüürida „Mõtle põhjalikumalt“ on eemaldatud, et samal seadel ei oleks kahte kohta. Menüü laiusepiir (18rem) ja linnukese stiilid läksid koos reaga.
   - **Välk põleb = kiire vastus** (madalaim pakutud tase), **kustus = põhjalik** (kõrgeim). Tähendus pöördus: menüüs märkis linnuke põhjalikku.
   - Välk on mõlemas olekus sama kontuur mikrofoni joonega (1,6). Olekut kannab ainult toon: põlev välk on teksti toonis, kustunud välk mikrofoni vaikses toonis. Täidetud välk (esimene katse) ja tugevam joon põleval välgul (2,1; #400) olid omaniku sõnul liiga valjud ja on eemaldatud. Taustaketast ei ole: kiire on vaikimisi sees, ketas seisaks mikrofoni kõrval kogu aeg.
   - Hiire all tekib ainult õrn taust nagu kiirmenüü nupul; värv ei muutu, et äsja välja lülitatud välk ei näeks hiire all välja nagu sisse lülitatud.
   - Nupu nimi on alati „Kiire vastus“ ja olek on `aria-pressed`; kohtspikker ütleb, kumb režiim parajasti sees on („Kiire vastus“ või „Põhjalik vastus“).
   - Nupp on ainult tavavestluses ja ainult siis, kui plaan pakub kahte taset, nagu rida enne.
2. **Vaikimisi on kiire vastus.** Plaani enda tase on `low` ja `medium` on kasutaja valik. Omaniku sõnastus on „hetkel“: 27.09 ja 29.09 otsus (`medium`) on sellega asendatud kuni uue otsuseni, mitte tühistatud. Kvaliteedi võrdlust selle otsuse aluseks ei ole (vt „Mõõtmine vestlusaknas“).
3. **Varem salvestatud valikut ei loeta.** Brauseris meelde jäetud valik tehti teise vaikeväärtuse vastu ja varjaks uue; võti on nüüd `sotsiaal.chat.reasoning.2`. Iga brauser alustab plaani tasemest.
4. **Korpuse täiendus hoiab ka plaani enda taseme.** `scripts/rag-v2-corpus-run.sh` andis uuele plaanile alati `--reasoning medium`; järgmine täiendus oleks vaikeväärtuse tagasi pööranud. Nüüd loeb see taseme töötavast plaanist.
5. **Seade muutmiseks tehtud plaan jätkab sama kuluarvestust.** Uus plaan (`newChatPlan`) alustas seni alati oma arvestust nullist, seega andis iga käsitsi tehtud plaan uue 4 USD piiri (nii ka `m4-corpus-chat-20261006a.json`; vt „Mõõtmine“, täpsustus 7). `scripts/rag-v2-chat-plan.mjs --continue-ledger <asendatav plaan>` paneb uue plaani kulutama sama arvestuse vastu: piir on üks ja kulutatu jääb kulutatuks. Vaikeväärtuse muutmine ei ava uut eelarvet. Korpuse täienduse plaan alustab endiselt oma arvestust; kas see peaks nii jääma, on omaniku otsus.

### Kontroll kohalikus brauseris (testrežiim, ühtegi mudelikutset)

Kohalik plaan `reasoning: low`, `reasoningChoices: [low, medium]`. Värvid loetud ilma üleminekuta.

| Mida | Tulemus |
|---|---|
| Nuppude järjekord paremal | „Kiire vastus“, „Alusta dikteerimist“, „Ava häälvestlus“ |
| Mõõdud | välk 44 × 44 px, glüüf 32 px, sama rida (y) ja sama vahe (4,8 px) mis mikrofonil ja häälvestlusel |
| Vaikimisi, midagi salvestamata | `aria-pressed="true"`, kohtspikker „Kiire vastus“; vana võtme all olnud `medium` ei mõjunud |
| Hele teema | põleb: `rgb(21, 21, 21)`; kustus: `rgba(21, 21, 21, 0.6)` (sama mis mikrofon); joon mõlemas 1,6 |
| Tume teema | põleb: `rgb(250, 250, 250)`; kustus: `rgba(233, 233, 233, 0.64)` (sama mis mikrofon). Mõõdetud joonega 2,1; värvireegel pärast seda ei muutunud |
| Täidis | mõlemas olekus `fill='none'`, tausta ei ole |
| Saadetud päring, välk põleb | `reasoning: "low"` |
| Saadetud päring, välk kustus | `reasoning: "medium"`; brauseris salvestatud `medium` |
| Lehe uuestilaadimine | välk jääb kustu, kohtspikker „Põhjalik vastus“ |
| Laius 375 px | kõik nupud mahuvad, horisontaalset kerimist ei ole; **üherealine kirjutusväli on 122 px** (ilma välguta oleks 171 px) |

**Telefonis on üherealine kirjutusväli kitsam:** 375 px laiusel mahub ühele reale umbes 10 tähemärki (enne umbes 14). Pikem tekst läheb nagu ennegi mitmerealiseks, kus tekst saab kogu laiuse ja nupud liiguvad alla.

**Kontrollimata:** mitmerealine koostaja (kood seal ei muutunud: nupp on samas nuppude rühmas), inglise ja vene kohtspikker lehel, kõrgkontrast, päris mudeliga pööre. Konsoolis olid ainult kohaliku aadressi analüütika CORS-teated ja 403 vastus vestluse ajaloo päringule enne esimest küsimust; viimane ei tule sellest muudatusest ja seda ei ole uuritud.

## Mida see ei muuda

- Plaan ilma väljata ja päring ilma valikuta käituvad täpselt nagu enne.
- Eelarve arvestus on sama: arutlus mahub samasse väljundi piiri.
- Dokumentide pool (transkripti ja koosoleku kokkuvõte) kasutab eraldi serveri seadet `OPENAI_REASONING_EFFORT` (`medium`) ega ole selle valikuga seotud. Dokumendi koostamine ja failianalüüs on endiselt peatatud.

## Kasutuselevõtt

**Tehtud 06.10.2026:** plaan `m4-corpus-chat-20261006a.json` (alus: omaniku korraldus lisada valik; sama korpus, kasutaja, hinnad ja 4 USD ülempiir nagu senistel plaanidel; ainus seadete erinevus eelmisest on `reasoningChoices`). Rida oli päris lehel näha ja vaikimisi linnukesega. See plaan alustas oma kuluarvestust nullist (vt „Mõõtmine vestlusaknas“, „Plaani eelarve“).

**Vaikimisi kiire, tehtud 06.10.2026:** plaan `m4-corpus-chat-20261006b.json` (alus: omaniku sõnad „paneme ainult välgu ja tee low hetkel ka default“), tehtud ja aktiveeritud väljalaskes `f98be679` (#401). Ühtegi mudelikutset ei tehtud.

- **Erinevus asendatud plaanist:** ainult `reasoning` (`medium` → `low`), plaani tunnus ja kinnituse väljad. Korpus, kasutaja, hinnad, pakutavad tasemed ja 4 USD piir on samad.
- **Kuluarvestus jätkub:** uus plaan nimetab plaani `20261006a` arvestust. Selles oli enne ja pärast vahetust 1,0763 USD 4-st (183 katset, neist 45 vastust). Arvestus loeb reserveeringuid plaani hindades; see ei ole teenusepakkuja arve.
- **Mida 06.10 hommikune uus plaan tegelikult muutis:** asendatud plaani `20261005d` arvestuses oli sel hetkel 0,144 USD (24 katset). Selle võrra tekkis piiri alla ruumi juurde; piiri ei ületatud kummaski arvestuses.
- **Päris lehel:** välk on mikrofoni kõrval ja põleb vaikimisi (`aria-pressed="true"`, toon `rgb(21, 21, 21)`, joon 1,6); brauseris vana võtme all olnud `medium` ei mõjunud; `ready` läbib.
- **Tegemata:** päris mudeliga pööre pärast muudatust (tasuline; luba ei ole küsitud).

Ilma kahte taset pakkuva plaanita valikut ei pakuta ja nuppu ei ole näha. Plaan tehakse nii:

```bash
node scripts/rag-v2-chat-plan.mjs ... --reasoning low --reasoning-choices low,medium --budget-usd 4 \
  --continue-ledger <asendatav plaan> --basis "<omaniku korraldus>" --activate
```

ja sama plaani aktiveerimist töötava väljalaske env-failis (`scripts/rag-v2-plan-release.mjs activate`, siis `ready` ja teenuse taaskäivitus), nagu korpuse täiendusel.

## Kontroll (esimene kuju: menüürida, #396)

Välgunupu kontroll on jaotises „Välgunupp ja kiire vaikimisi“. Testid katavad nüüd nuppu, vaikeväärtuse võtit, korpuse täienduse taset ja kuluarvestuse jätkamist.

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

**Kuidas:** sotsiaal.pro vestlusaknas omaniku kontoga. Kummaski komplektis 10 põhiküsimust, igaüks uues vestluses, ja 10. küsimusele samas vestluses üks jätkusõnum: 11 pööret komplekti ja režiimi kohta. Kokku 40 põhiküsimuse pööret, 4 jätkupööret, üks katkenud pööre ja üks soojendus ehk 46 pööret; vestlusi on vähem kui pöördeid (kuni 42, üle loetud ei ole). Mõõtmise ajal oli valik menüürida: linnuke „Mõtle põhjalikumalt“ sees = `medium`, maas = `low`. Ajad on serveri enda etapiajad pöörde kirjest, mitte hetk, mil tekst ekraanile jõudis.

| Komplekt | Režiim | Pööre kokku | Esimene tekst | Vastuse kirjutamine | Vahemik |
|---|---|---|---|---|---|
| 1 (tuttavad küsimused) | põhjalik | 18,5 s | 16,4 s | 11,5 s | 11,9–24,5 s |
| 1 | kiire | 10,0 s | 7,5 s | 4,0 s | 7,2–13,2 s |
| 2 (uued küsimused) | põhjalik | 15,6 s | 13,7 s | 9,0 s | 12,1–20,6 s |
| 2 | kiire | 9,7 s | 7,3 s | 3,7 s | 7,7–12,6 s |

Kõik 44 lõpetatud pööret koos (22 kummaski režiimis; arvutatud tõendifailist):

| Näitaja | Põhjalik | Kiire |
|---|---|---|
| Serveri etappide koguaeg, keskmine | 17,01 s | 9,82 s |
| Koguaeg, mediaan | 16,01 s | 9,68 s |
| Esimene tekst serveris | 15,04 s | 7,36 s |
| Otsinguplaan | 2,28 s | 2,03 s |
| Embedding | 0,56 s | 0,46 s |
| Otsing koos lõikude valikuga | 3,96 s | 3,47 s |
| Vastuse kirjutamine | 10,21 s | 3,86 s |
| Arutlustokeneid vastuse kohta | 1198 | 54 |
| Nähtava vastuse pikkus | 951 tähemärki | 1184 tähemärki |
| Lõpetatud pöörde hind plaani hindades | 0,00543 USD | 0,00491 USD |

- **Kiire oli kiirem kõigis 22 pöördepaaris**, 3,2–15,5 s võrra; keskmiselt 7,2 s ehk 42%. Ainult 20 põhiküsimust võttes on keskmised 17,34 s ja 9,80 s.
- **88% ajavõidust tuli vastuse kirjutamisest** (6,35 s 7,20-st). Ülejäänud 0,84 s tuli varasematest etappidest, mille seadeid lüliti ei muuda; nende kestus kõigub pöördest pöördesse. Varasem sõnastus „kogu vahe tuleb vastuse kirjutamisest“ ja „etapid on mõlemas samad“ oli ebatäpne.
- **Kiires režiimis kulub 61% ajast enne vastuse kirjutamist** (põhjalikus 41%). Järgmine suurem ajavõit eeldab otsinguplaani ja lõikude valiku uurimist.
- **Esimene tekst** tekib serveri voos kiires režiimis 7,4 s ja põhjalikus 15,0 s järel. Brauseris mõõdetud ajad (päringust voo lõpuni) olid serveri omadest 0,4–0,5 s pikemad; brauseriaegu tõendifailis ei ole, seega sealt seda üle kontrollida ei saa.
- **Sama otsinguseade, mitte sama tõendus.** Iga pööre tegi oma otsinguplaani ja lõikude valiku; vastusele antud tõendite arv erines 15 paaris 22-st ja vastuse liik 4 paaris. Mõõdetud on kogu vastamisahel. Arutlustaseme puhast mõju see ei näita: selleks peaks mõlemad režiimid saama täpselt sama salvestatud tõenduse.
- **Vahe püsis mõlemas mõõtmisjärjekorras:** esimeses komplektis küsiti põhjalik enne, teises kiire enne. Järjekorra mõju see ei välista, sest komplektides olid eri küsimused ja teine mõõdeti hiljem.
- **Arutlus:** kiire režiimi 22 vastusest 18-l oli arutlustokeneid null.
- **Kiire vastus oli pikem, mitte lühem.** Kas lühem põhjalik vastus on täpsem või jätab midagi välja, sellest mõõtmisest ei selgu; Tallinna küsimus (allpool) näitab, et välja jätta võib. Varasem lause „põhjalik valib kitsamalt“ oli tõlgendus, mitte mõõdetud tulemus.
- **Hind:** kiire pööre oli keskmiselt 9,6% odavam; ajavõiduga samas suurusjärgus kokkuhoidu ei ole. Tõendifailis on 45 pöörde kirjed summas 0,2302 USD; 46. pööre on soojendus (0,0039 USD), mille kirjet failis ei ole. Summad on plaani hindades, mitte teenusepakkuja arve.
- **Sisu, esimene komplekt** (jämedad mustrid, iga küsimuse kohta üks ootus): põhjalik 10/11, kiire 11/11. Põhjaliku ainus möödalask: Tallinna eaka isa küsimuses nimetas vastus koduteenust ja abivajaduse hindamist, aga mitte üldhooldust; kiire nimetas mõlemat. Toimetulekupiiri 2028 kohta ütlesid mõlemad õigesti, et summat kinnitada ei saa. Selle küsimuse muster muudeti pärast vastuste lugemist (esimene oli liiga kitsas), seega ei olnud hindamisreeglid lõpuni ette fikseeritud.
- **Sisu, teine komplekt:** ootusi ei olnud ette kirjutatud, seega sisu ei ole hinnatud. Vastuse liikide koguarv oli mõlemas režiimis sama (7 täielikku, 4 osalist), kuid üksikute küsimuste liik erines.

**Mida see ei näita:** kumb režiim vastab paremini. 22 küsimust jämedate mustritega ei ole kvaliteedi mõõt: väidete õigsust, viidete toetust, väljajäetud erandeid ega õiget redaktsiooni ei ole süsteemselt hinnatud. 29.09 mõõtmine 40 pöördega andis `low` 37/40 ja `medium` 39/40; see mõõtmine seda ei kinnita ega lükka ümber. Mõõtmine toetab kiire valiku pakkumist; vaikerežiimi muutmist kvaliteedi põhjal see ei põhjenda (omanik muutis vaikeväärtuse 06.10 sõnaga „hetkel“).

**Plaani eelarve:** plaan `m4-corpus-chat-20261006a.json` tehti uue plaanina ja alustas seetõttu oma kuluarvestust nullist, 4 USD piiriga. „Sama 4 USD ülempiir nagu senistel plaanidel“ ei tähendanud sama allesjäänud eelarvet: eelmise plaani arvestuses kulutatu uude ei kandunud. Seade muutmiseks tehtav plaan jätkab nüüd asendatava plaani arvestust (`--continue-ledger`, jaotis „Välgunupp ja kiire vaikimisi“).

Ebatäpsused selles jaotises parandati 06.10 sõltumatu ülevaatuse järel (omaniku edastatud); iga parandatud arv on tõendifailist üle arvutatud.

**Kõrvalleid:** esimese komplekti teine küsimus (Tallinn) katkes esimesel katsel veaga `audit_packet_too_large`. Põhjus ei olnud arutlustase, vaid salvestatava paketi piir; parandatud samal päeval (#397, [ADR-089](adr-089-closest-contact-directory.md) jaotis „Auditipaketi piir“). Küsimus küsiti pärast parandust uuesti. Esimese komplekti 1. ja 3. küsimus põhjalikus režiimis on mõõdetud enne seda parandust; parandus ajakulu ei puuduta.

**Meetodi märkused:** esimese komplekti põhjaliku režiimi küsimused 1–7 saadeti päris klahvivajutustega, ülejäänud lehel oleva skriptiga läbi sama koostaja ja sama „uus vestlus“ toimingu. Pärast teenuse taaskäivitust tehti üks soojenduspööre, mis arvesse ei lähe.

## Säilinud vastuste läbivaatus (06.10.2026)

Omaniku korraldus 06.10 („teeb need ära?“ sõltumatu ülevaatuse soovituste kohta). Ühtegi mudelikutset ei tehtud. [Tõend](../audits/evidence/reasoning-choice-review-2026-10-06.json): hinded ja põhjendused, ilma vastuste tekstita.

**Kuidas:** mõõtmise 22 küsimusepaari (44 vastust). Serveris tehti fail, kus iga küsimuse kaks vastust on juhuslikus järjekorras A ja B ning režiim on peidetud; võti jäi serverisse. Hindamisreeglid kirjutasin enne lugemist, hinded kõigile 22 paarile enne võtme avamist. Väiteid, milles kaks vastust erinesid, kontrollisin selle pöörde enda salvestatud tõenduse vastu.

**Tulemus:**

| | Kiire (`low`) | Põhjalik (`medium`) |
|---|---|---|
| Parem vastus (22 paarist; 18 võrdsed) | 3 | 1 |
| Vastab küsimusele otse | 21 | 17 |
| Vastab osaliselt | 1 | 5 |
| Tõenduseta väiteid | 1 | 0 |
| Vale omavalitsus, isik või kuupäev | 0 | 0 |
| Vajalik punkt välja jäetud, kuigi tõenduses olemas | 3 | 2 |
| Tarbetu täpsustav küsimus | 1 | 0 |

- **18 paari 22-st on sisult võrdsed:** samad faktid, erinev pikkus, järjekord või üks lisapunkt.
- **Kiire oli parem kolmes** (1. komplekti küsimused 2 ja 4, 2. komplekti küsimus 3). Kahes neist oli põhjus osaliselt või täielikult tõenduses: põhjaliku pöörde tõenduses ei olnud sätet, mida kiire kasutas. Kolmandas jättis põhjalik vastamata jah või ei ja nimetamata tasuta võimaluse, mis tema tõenduses oli.
- **Põhjalik oli parem ühes** (1. komplekti küsimus 10): kiire andis kontaktisiku ametinimetuses teise üksuse nime kui tõenduses ja jättis ütlemata, et teenus on tasuline.
- **Vale omavalitsust ega kuupäeva ei olnud kummaski.** Ainus tõenduseta väide, mille kontrollides leidsin, oli see üksuse nimi; kontrollisin väiteid, milles vastused erinesid, ja mõnda muud, mitte iga väidet.

**Mida see näitab ja mida mitte:**

- Nendel 22 küsimusel ei leidnud ma, et kiire režiim vastaks halvemini. 29.09 mõõtmise vahet (37/40 ja 39/40) see ei kinnita ega lükka ümber: küsimused on teised ja iga küsimus on küsitud üks kord.
- **Hindaja on üks ja ise mudel.** Kaks paari (1. komplekti küsimused 2 ja 8) ei olnud pimedad, sest lugesin neid vastuseid mõõtmise ajal; ilma nendeta on seis kiire 2, põhjalik 1, võrdseid 17.
- **Võrreldud on terve pööre, mitte arutlustase.** Kummalgi pöördel oli oma otsinguplaan ja tõendus; kahes kiire kasuks läinud paaris oli vahe just seal. Arutlustaseme puhast mõju näitab ainult sama tõendusega võrdlus (allpool „Lahti“).
- Kiire vastus on tihti pikem; see võis režiimi lugedes reeta.

## Lahti

- **Järjest ühes vestluses** küsitud küsimuste aeg on mõõtmata. Siis loeb otsinguplaan varasemaid sõnumeid ja kontekst kasvab; omanik küsis, kas see muudab tulemust.
- **Kvaliteedi võrdlus** vajab ette kirjutatud ootustega kataloogi ja mõlemat režiimi; hindajal on selleks nüüd `--reasoning`.
- **Sama tõendusega võrdlus:** arutlustaseme puhta mõju nägemiseks peab mõlemale režiimile andma sama salvestatud tõenduse; senine mõõtmine ja läbivaatus võrdlesid kogu ahelat. See on tasuline (44 vastusekutset, hinnanguliselt 0,2 USD); omaniku luba on küsitud 06.10.
- **Teine hindaja:** läbivaatuse tegi üks hindaja; pimefail ja võti on serveris alles (`eval-files/reasoning-choice-2026-10-06/review-blind.json`, `review-key.json`), nii et inimene saab sama faili ise hinnata.
- **Kolm taset:** plaan lubab ka `low, medium, high`, aga lüliti käib ainult madalaima ja kõrgeima vahel. Kui vaikimisi oleks keskmine, näitaks kustunud välk „põhjalikku“, kuigi kasutusel on keskmine, ja pärast esimest klõpsu keskmist enam valida ei saaks. Praegust plaani (`low`, `medium`) see ei puuduta; enne kolmanda taseme pakkumist tuleb lahendada.
- **Korpuse täienduse plaan** alustab endiselt oma kuluarvestust nullist; kas see peaks jätkama eelmist, on omaniku otsus.
- **Telefonis** on üherealine kirjutusväli välgu võrra kitsam (122 px 375 px laiusel).
- **Oleku loetavus:** põlevat ja kustunud välku eristab nüüd ainult toon (hele teema: tume 100% ja 60%). Kui see jääb liiga vaikseks, on see järgmine koht, mida muuta.
- Inglis- ja venekeelne kohtspikker („Quick answer“ / „Thorough answer“, „Быстрый ответ“ / „Вдумчивый ответ“) on minu valitud; omanik neid üle vaadanud ei ole.
- ~~Auditipaketi piiri (#397) regressioonikontroll ja salvestusvormi korduste vähendamine~~: tehtud 06.10, [ADR-089](adr-089-closest-contact-directory.md) jaotis „Paketi kokkupakitud salvestuskuju ja piiri regressioonitest“.
