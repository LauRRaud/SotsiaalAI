# ADR-120: ainult tänusõnast koosnev sõnum käib lühikest teed

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „Do this task here: Tänusõna ei käivita otsingut“. Seis: **kood ja testid tehtud; enne väljalaset mõõdetud kahe päris kontrolliga (15 pööret, kokku 0,0390 USD), millest esimene leidis vea ja teine näitas parandust.**

## Probleem

Sõnum, mis midagi ei küsi, käis ikkagi läbi otsinguplaani, vektori, kogu teema tekstiga tehtud otsingu, valiku ja vastuse ([ADR-106](adr-106-asking-instead-of-a-limit.md), „Mis jääb lahti“). Lühike tee oli olemas ainult teema esimese sõnumina saadetud tervitusele ([ADR-067](adr-067-greeting-route.md)). Peaaegu iga vestlus lõpeb tänusõnaga; pööre maksab umbes 0,4 senti ja võtab umbes 13 sekundit, millest pool on valik.

## Otsus

**Sõnum, mis on ainult tänusõna, läheb teema igas kohas tervituse teed** (`loneThanks`, `lib/rag-v2/pilot/greeting.js`): otsinguplaani, vektorit, otsingut ega valikut ei tehta. Jääb üks kutse: vastus.

Sama kitsas reegel mis tervitusel: kogu sõnum, ilma kirjavahemärkide ja emotikonideta, on üks loendi fraasidest („aitäh“, „suur aitäh“, „tänan väga“, „aitäh abi eest“, „thanks“, „thank you“, „спасибо“ ja nende lähedased; eesti, inglise ja vene keeles). Vastus tuleb tänusõna keeles.

**Mis jääb välja ja miks:**

- Tänusõna koos palvega („Aitäh, aga mis see maksab?“) on palve ja käib täisteed.
- **Sõna, mis võib olla vastus Luna küsimusele, ei ole loendis ei üksi ega tänusõna ees:** „jah“, „ei“, „ok“, „selge“, „hästi“, ka „ok aitäh“ ja „ei, tänan“. Luna küsib sageli üle ([ADR-119](adr-119-assistants-question-reaches-plan-and-selection.md)) ja selline sõna võib olla tema küsimuse vastus.

### Omavalitsuse kirjeid ei loeta, ulatus jääb

Tervituse tee jooksutas otsinguta ka kirjete rada: teema keskel, kui inimese omavalitsus on teada, oleks see laadinud omavalitsuse kataloogi (kuni 12 000 sõnaosa) vastuse sisendisse. Tänule vastamiseks ei ole kirjeid vaja, nii et **tänusõna pöördel kataloogi ei loeta** (`recordCatalogue` valik `read: false`): pakett on sama kujuga nagu pöördel, kus omavalitsust ei ole valitud.

**Pöörde allikate ulatus otsustatakse ja salvestatakse sellegipoolest**: järgmine sõnum loeb sealt, kelle ja mis omavalitsuse kohta eelmine pööre käis ([ADR-074](adr-074-question-region-not-residence.md)). Inimene ja koht on pärast tänusõna samad mis enne.

Pöörde kirjes on märge `searchAssist.thanks`.

### Juhis tänule vastamiseks (dialoogi juhis 41)

Esimene päris kontroll näitas, et ilma juhiseta vastab mudel tänule tõenditeta pöördel halvasti (vaata „Mõõdetud“). Seepärast saab **ainult tänusõnast koosnev pööre ühe lisarea** (`THANKS_INSTRUCTIONS`): vestluse sisendis on märge `messageKind: "thanks"` ja juhis ütleb, et midagi juurde otsida ega piirangut kirjutada ei tule; vastus on üks lühike sõbralik lause sõnumi keeles, mis võtab tänu vastu ja ütleb, et võib veel kirjutada. Lause läheb vastuse lepingu väljale `clarification`, sest see on ainus koht lausele, mis midagi ei tsiteeri. Kõigi teiste pöörete juhised on täht-tähelt samad mis juhises 40.

### Mida see säästab ja mida mitte

Säästetakse plaani kutse, vektori kutse ja valiku kutse ning vastuse sisendist teadmuslõigud ja kataloog. **Vastuse kutse jääb.** Kohalikus testis teeb tänusõna pööre ühe teenusekutse (vastus) nelja asemel (plaan, vektor, valik, vastus). Päris summat ja aega ei ole mõõdetud.

## Kontrollitud

- Ühiktestid (värske põhiharu peal): 1253, neist 1231 läbi ja 22 vahele jäetud; ESLint muudetud failidel. Kolm uut testi (kolmas hoiab juhise 41 rida: ainult tänusõna pöördel, teiste pöörete juhised muutmata): tänusõna tuntakse ära kolmes keeles, suurtähtede, kirjavahemärkide ja emotikoniga; palvega tänusõna, vastuseks sobiv sõna, tervitus ja mittesõne ei ole tänusõna; tervituse ja tänusõna loendid ei kattu.
- **Kohalik andmebaas, teenuse kaudu** (`tests/rag-v2-dialogue-store.test.mjs` 39/39, `tests/rag-v2-pilot-store.test.mjs` 48/48), kaks uut testi päris plaani suunamisega: tänusõna teema keskel teeb ainult vastuse kutse; otsing saab märke, ei saa vektorit ega valikut; inimene ja omavalitsus on tänusõna pöördel ja järgmisel sõnumil samad; järgmine sõnum käib täisteed. Palvega tänusõna, „ok aitäh“ ja „jah“ käivad täisteed.

## Mõõdetud päris vestluses enne väljalaset (09.10.2026)

Omaniku loal (lagi 0,05 USD) muudetud kood töötava väljalaske peal, päris vestlusteenuse ja päris otsinguadapteri kaudu.

**Esimene kontroll (juhiseta), 7 pööret, 0,0187 USD.** Tee töötas, vastus mitte:

| Sõnum | Kutsed | Aeg | Kulu | Vastus |
|---|---|---|---|---|
| „Aitäh!“ | ainult vastus | 5,5 s | 0,0014 USD | piirang: „Mul pole praegu lisateavet, mida sulle juurde anda.“ |
| „Suur aitäh!“ (elukoht Tartu) | ainult vastus | 5,2 s | 0,0005 USD | piirang: „Selle vastuse jaoks pole uut tõendatud teavet.“ |
| „Спасибо!“ | ainult vastus | 3,9 s | 0,0013 USD | „Пожалуйста.“ ja küsis uuesti, kus ema elab |

Samade vestluste tavalised pöörded võtsid 30–51 sekundit ja 0,003–0,005 USD. Jätkuküsimus pärast tänusõna („Ja kui suur see toetus on?“) sai vastuse Tartu linna summadega: koht püsis.

**Teine kontroll (juhisega 41), 8 pööret, 0,0203 USD:**

| Sõnum | Kutsed | Aeg | Kulu | Vastus |
|---|---|---|---|---|
| „Aitäh!“ | ainult vastus | 2,3 s | 0,0013 USD | „Võta heaks! Kui midagi veel küsida tahad, kirjuta julgelt.“ |
| „Aitäh!“ (teine kord) | ainult vastus | 2,3 s | 0,0004 USD | sama |
| „Suur aitäh!“ (elukoht Tartu) | ainult vastus | 3,5 s | 0,0005 USD | sama; ulatus jäi Tartu linnaks |
| „Спасибо!“ | ainult vastus | 2,2 s | 0,0013 USD | „Пожалуйста. Если появятся другие вопросы, напишите.“ |

Kolm eestikeelset vastust kolmest on juhise näitelause sõna-sõnalt.

## Kontrollimata

- Tänusõna pärast vastust, mis ise lõppes küsimusega: Luna küsimus jääb siis vastuseta ja tänu vastus seda ei korda.
- Inglise keeles tänusõna eestikeelses vestluses.
- Tänu vastus on vestluse kirjes Luna „küsimuse“ väljal. Kui järgmine sõnum on lühike, antakse see lause ADR-119 reegli järgi otsinguplaanile kaasa; juhis ütleb plaanile, et sõnumit, mis sellele ei vasta, tuleb lugeda ilma selleta. Mõõtmata.

## Mis jääb lahti

- Muud sõnumid, mis midagi ei küsi („selge“, „olgu“, hüvastijätt), käivad endiselt täisteed: osa neist võib olla vastus Luna küsimusele.
