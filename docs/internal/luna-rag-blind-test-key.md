# Luna RAG pime testpakett — VASTUSEVÕTI

**Ära anna seda testijale enne hindamist.** Kuulub kokku failiga `luna-rag-blind-test.md`.

## Kontrollimise viis ja aeg

- **Aeg:** 31.07.2026, kell ~12:30–14:00 EEST.
- **Register:** elav rag-service register, `GET /documents` → 5824 dokumenti
  (`generated_at: 2026-07-31T12:30:30Z`). Kollektsioonid: `kov_services` 4931,
  `sotsiaaltoo_articles` 638, `national_guidelines` 93, `kov_legal` 78, `research_reports` 31,
  `organization_materials` 28, `organization_guidelines` 15, `policy_analyses` 7, muud 3.
- **Sisukontroll:** `POST /search` teemaotsing + `GET /documents/{id}/chunks` päris tekstilõikude
  lugemine. Read-only; midagi ei ingestitud, ei muudetud ega kustutatud.
- **Kontrolli tase on iga allika juures märgitud:**
  - **✔ sisu loetud** — dokumendi tekstilõigud loetud, väide pärineb tekstist;
  - **○ registris kinnitatud** — dokument on registris ja tuli teemaotsingus esile, kuid
    detailväiteid ei ole lõigutasandil üle kontrollitud. Hindaja peab neid väiteid
    vastust hinnates ise allikast kontrollima.
- **Lokaalseid faile ei kasutatud.** Ükski ülesanne ei tugine dokumendile, mis on ainult repos
  (nt ESTA uudised, heaolu arengukava programmid, kovisiooni juhendid). Master-registrit,
  valideerimisraporteid, lisakorje kandidaate ega inventuurifaile ei kasutatud allikana.

---

## Ülesanne 1 — Isiklik abistaja kolmes vallas

**Eesmärk.** Kas mudel loeb kolme määrust päriselt kõrvuti ja märkab, et üks vald **ei sea**
sama piirangut, mille teised seavad — või libiseb üldistusse „tingimused on sarnased".

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `national-rt-130122025029` (§ 27) | Sotsiaalhoolekande seadus — § 27 Isikliku abistaja teenuse eesmärk ja sisu | `national_regulations` | ✔ |
| 2 | `kov-rt-johvi-vald` (§ 45–46) | Sotsiaalhoolekandelise abi andmise kord Jõhvi vallas | `kov_legal` | ✔ |
| 3 | `kov-rt-poltsamaa-vald` (§ 87–90) | Põltsamaa valla sotsiaalhoolekandelise abi andmise kord | `kov_legal` | ✔ |
| 4 | `kov-rt-saku-vald` (§ 19–20) | Saku valla sotsiaalhoolekandelise abi andmise kord | `kov_legal` | ✔ |
| 5 | `kov::johvi-vald::item::johvi_vald_service_isikliku_abistaja_teenus` | Isikliku abistaja teenus | `kov_services` | ○ |
| 6 | `kov::poltsamaa-vald::item::poltsamaa_vald_service_isikliku_abistaja_teenus` | Isikliku abistaja teenus | `kov_services` | ○ |
| 7 | `kov::saku-vald::item::saku_vald_service_isikliku_abistaja_teenus` | Isikliku abistaja teenus | `kov_services` | ○ |

### Vajalikud põhiväited

1. **Eesmärk on kolmes vallas sisuliselt sama** ja järgib SHS § 27 sõnastust: suurendada puude tõttu
   füüsilist kõrvalabi vajava täisealise iseseisvat toimetulekut ja vähendada seadusjärgsete
   hooldajate hoolduskoormust. ✔
2. **Jõhvi § 46 lg 4:** isiklikuks abistajaks **ei määrata** esimese ja teise astme ülenejat või
   alanejat sugulast, samas eluruumis püsivalt elavat isikut **ega isikut, kelle karistatus
   tahtlikult toimepandud kuriteo eest võib ohtu seada teenuse saaja elu, tervise ja vara.** ✔
   Karistatuse tingimus on Jõhvil olemas, teistel selles sõnastuses ei ilmnenud.
3. **Saku § 20:** sama sugulase- ja kooselupiirang **+ tähtaeg — abistaja määratakse kuni üheks
   aastaks**, perioodi lõppedes tuleb asi uuesti otsustada. ✔ Tähtajapiirang on Saku eristav joon.
4. **Põltsamaa:** määruses **ei ole kategoorilist sugulase- ega kooselukeeldu**; § 90 järgi hindab
   ametiasutus, kas taotluses pakutud isik on „oma tavalisest elulaadist ja toimetulekust ning
   isikuomadustelt võimeline" vajalikku kõrvalabi tagama ja vastab SHS-i nõuetele. ✔
   **See on kaalutlusotsus, mitte keeld** — sisuliselt erinev regulatsioonimudel.
5. Kõigis kolmes: kui taotlejal on konkreetne soovitud isik, **lisatakse taotlusele selle isiku
   kirjalik nõusolek**. ✔ (Jõhvi § 46 lg 3, Põltsamaa § 89 lg 2, Saku analoogselt.)

### Kasulikud, aga mittekohustuslikud väited

- Jõhvi ja Saku loetlevad teenuse eraldi jaona sotsiaalteenuste peatükis; Põltsamaa käsitleb seda
  „mitterahaliste hüvitiste" peatükis — vormistuslik, mitte sisuline erinevus. ✔
- Vallad abistavad soovi korral teenuseosutaja leidmisel. ✔
- Viide, et KOV-i teenuselehed on lühikesed ja määrus on täpsem allikas.

### Väited, mida allikad EI toeta

- „Kõigis kolmes vallas kehtivad samad tingimused" — vale.
- „Sugulane ei tohi kunagi olla isiklik abistaja" — Põltsamaa puhul põhjendamatu üldistus.
- Konkreetsed tunnihinnad, teenusemahud või omaosalus — neid nendest paragrahvidest ei leitud.
- Väide, et SHS keelab sugulase määramise. Piirang tuleb **valla määrusest**, mitte § 27-st. ✔

### Oluline puuduv info

- Teenuse maht ja rahastus vallati.
- Kas Põltsamaa praktikas siiski välistab lähisugulase — määrus seda ei ütle.
- Jõhvi karistatuse tingimuse kontrollimise kord (kes ja kuidas kontrollib).

### Eksitavad / teisejärgulised allikad

- Teiste valdade isikliku abistaja lehed (Lääne-Harju, Harku, Valga, Tartu, Järva, Kiili, Türi,
  Paide, Peipsiääre) — otsing toob neid esile, kuid küsimuses neid ei küsitud.
- `kov-rt-kihnu-vald`, `kov-rt-mustvee-vald`, `kov-rt-laane-nigula-vald` — tulevad samast otsingust.

### Soovituslik struktuur

Ühine alus (SHS) → vallati erinevused, iga erinevus koos paragrahviviitega → kokkuvõttev lause
selle kohta, mis on ümarlauas ohutu väita ja mis mitte.

### Verbosity-tundlikud punktid

- **Põltsamaa keelu puudumine.** Lühivastus kipub kolme valda ühte lausesse kokku suruma
  („kõigis on sarnased piirangud") — see on faktiviga, mitte lühidus.
- **Saku üheaastane tähtaeg.**
- **Jõhvi karistatuse tingimus.**
- Paragrahvinumbrid — nende puudumine vähendab praktilist kasutatavust, sest kasutaja läheb
  ümarlauda.

### Aktsepteeritav puudumine

- Määruste vastuvõtmise kuupäevad ja RT-viited.
- Peatükkide/jagude numeratsiooni erinevused.
- Teiste valdade näited.

### Kriitilised vead (faktitäpsus ≤ 1)

- Väidab, et Põltsamaa keelab sugulase määramise.
- Omistab sugulasekeelu või tähtaja SHS-ile.
- Väidab, et vallad on identsed.

---

## Ülesanne 2 — Üldhooldusteenuse omaosalus ja hooldereform

**Eesmärk.** Kas mudel eristab **kehtivat õigust**, **2023. aasta reformi kavatsust** ja
**2014. aasta uuringut** — ning ütleb, et vana uuring ei ole tänase korra alus.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `national-rt-130122025029` (§ 22) | Sotsiaalhoolekande seadus — § 22 Väljaspool kodu osutatav üldhooldusteenus | `national_regulations` | ✔ |
| 2 | `sotsiaaltoo-1-2023-hooldekodude-rahastamise-pohimotted-ja-kommentaar-2023-1` | Hooldekodude rahastamise põhimõtted muutuvad (Kupper, Tuubel, Koppel, Sotsiaaltöö 1/2023, lk 9–14) | `sotsiaaltoo_articles` | ✔ |
| 3 | `praxis_centar_kohaliku_omavalitsuse_poolt_isikult_ja_voi_perekonnalt_sotsi` | KOV-i poolt isikult ja/või perekonnalt sotsiaalteenuste eest tasu nõudmine (**2014**) | `national_guidelines` | ✔ |
| 4 | `kov-rt-poltsamaa-vald` (§ 75) | Põltsamaa vald — hüvitise määramine, hooldusplaan SHS § 21 alusel | `kov_legal` | ✔ |
| 5 | `kov::johvi-vald::item::johvi_vald_resource_hooldereform` | Hooldereform ja üldhooldusteenuse rahastamine | `kov_services` | ○ |
| 6 | `riigikontroll_koduteenuste_korraldus` | Koduteenuste korraldus — Riigikontrolli aruanne Riigikogule, **22.11.2023** | `national_guidelines` | ✔ |

### Vajalikud põhiväited

1. **Kehtiv alus on SHS § 22**, mitte artikkel ega uuring. ✔
2. **Muudatus jõustus 1. juulil 2023** — artikkel 1/2023 kirjeldab seda tulevikuvormis
   („alates 2023. aasta 1. juulist muutub"). ✔ Vastus peab ütlema, et artikkel kirjeldas
   **tulevast** muudatust ja tänaseks on see jõustunud; artiklit ei tohi esitada kehtiva korrana.
3. **Praxise analüüs on 2014. aastast** ja eelnes kodifitseerimisele — see on taustamaterjal,
   **mitte kehtiv reegel**. ✔ Vastus peab selle vanuse välja ütlema.
4. Teenuse määramine käib **haldusakti või halduslepinguga** ja eeldab **hooldusplaani SHS § 21
   nõuete järgi**, koostöös inimese, vajadusel lähedaste ja teenuseosutajaga (Põltsamaa § 75). ✔
5. Kohalik kord (määrus) täpsustab riiklikku raamistikku — vald ei saa omaosalust kehtestada
   määrusest ja seadusest sõltumatult.

### Kasulikud, aga mittekohustuslikud väited

- Riigikontrolli 2023. aasta koduteenuste audit seob hooldereformi ka koduteenuse
  kättesaadavusega — reform pidi seda parandama. ✔
- Artikkel 1/2023 osutab, et rahastuse loogika peaks motiveerima KOV-e arendama koduteenust,
  päevahoidu ja teenuskomponente, et üldhooldusele minekut edasi lükata. ✔
- Viide, et osalise rahastamise taotlusvormid on KOV-ide kaupa olemas.

### Väited, mida allikad EI toeta

- Konkreetsed eurosummad, kohatasu määrad või protsendid — neid nendest lõikudest ei leitud.
- „Praxise uuring ütleb, kui palju tohib küsida" — 2014. aasta uuring ei ole normiallikas.
- Väide, et reform on omaosaluse kaotanud.

### Oluline puuduv info

- Konkreetse valla kehtiv hinnakiri ja hooldusteenuse komponendipõhine jaotus.
- Ülalpidamiskohustuse (perekonnaseadus) täpne roll — perekonnaseadust registris ei ole.
- Reformi järelmõju hindamine pärast 2023. aastat.

### Eksitavad / teisejärgulised allikad

- **`riigikontroll_koduteenuste_korraldus` metaandmetes on `YEAR 2025`, kuid dokumendi tekst ütleb
  selgelt „Riigikontrolli aruanne Riigikogule, Tallinn, 22. november 2023".** ✔
  See on tahtlik lõks: vastus, mis nimetab seda 2025. aasta auditiks, on lugenud metaandmeid,
  mitte sisu. Karista faktitäpsuses.
- `praxis_centar_sotsiaalne_innovatsioon_pikaajalises_hoolduses` — teemakohane, aga ei vasta küsimusele.
- Teiste valdade üldhoolduse teenuslehed.

### Soovituslik struktuur

Kehtiv õigus → mis muutus ja millal → mis on ainult uuring/taust → mida vald peab ise otsustama →
üks lause selle kohta, mida istungil kindlalt väita ei saa.

### Verbosity-tundlikud punktid

- **Allikate ajaline järjestus.** Lühivastus võib esitada 2014. aasta uuringu ja 2023. aasta
  artikli kehtiva korrana. See on kriitiline viga, sest kasutaja küsis just seda vahet.
- **Hooldusplaani nõue (SHS § 21).**
- **Haldusakt vs haldusleping.**

### Aktsepteeritav puudumine

- Riigikontrolli auditi detailleiud.
- Artikli autorid ja leheküljed.
- Jõhvi teenuslehe olemasolu eraldi mainimine.

### Kriitilised vead (faktitäpsus ≤ 1)

- Esitab 2014. aasta uuringu kehtiva reeglina.
- Väidab, et hooldereform alles tuleb.
- Nimetab Riigikontrolli koduteenuste auditi 2025. aasta dokumendiks.

---

## Ülesanne 3 — Dementsushoolduse arengupilt

**Eesmärk.** Süntees kuue-seitsme aasta artiklitest: kas mudel eristab **vajaduste kirjeldust
(2018)**, **praktikaprojekti (2022)**, **käivitatud programmi (2024)** ja **hetkehinnangut (2025)**.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `sotsiaaltoo-1-2018-dementsusega-inimeste-ja-omastehooldajate-vajadused-2018` | Dementsusega inimeste ja omastehooldajate vajadused (40 lõiku) | `sotsiaaltoo_articles` | ○ |
| 2 | `sotsiaaltoo-3-2022-dementsusega-inimeste-omastehooldajate-voimestamine-tugigruppide-abil-2022-3` | Omastehooldajate võimestamine tugigruppide abil | `sotsiaaltoo_articles` | ○ |
| 3 | `sotsiaaltoo-3-2024-dementsuse-valdkonna-arenguprogramm-aitab-parandada-teenuse-kvaliteeti-2024-3` | Dementsuse valdkonna arenguprogramm aitab parandada teenuse kvaliteeti | `sotsiaaltoo_articles` | ○ |
| 4 | `sotsiaaltoo-3-2024-dementsuse-kompetentsikeskus-toetab-lahedasi-ja-spetsialiste-2024-3` | Dementsuse kompetentsikeskus toetab lähedasi ja spetsialiste | `sotsiaaltoo_articles` | ○ |
| 5 | `sotsiaaltoo-3-2025-dementsusega-inimestele-parima-abi-pakkumises-ollakse-poolel-teel-2025-3` | Dementsusega inimestele parima abi pakkumises ollakse poolel teel (Kuulpak, 3/2025, lk 3–10) | `sotsiaaltoo_articles` | ✔ |
| 6 | `sotsiaalkindlustusamet_hoolekandeteenuste_kvaliteedi_juhendmaterjal` | Hoolekandeteenuste kvaliteedi juhendmaterjal | `national_guidelines` | ○ |
| 7 | `sotsiaaltoo-3-2024-dementsusega-inimesi-toetavad-kohandatud-keskkond-ja-abivahendid-2024-3` | Kohandatud keskkond ja abivahendid | `sotsiaaltoo_articles` | ○ |

### Vajalikud põhiväited

1. **2025. aasta seis on „poolel teel"** — nimetatud kitsaskohad on **järjekorrad, töötajate nappus
   ja sügava dementsusega inimeste teenuskohtade puudus**; rõhutatakse individuaalset lähenemist,
   lähedaste kaasamist, töötajate koolitamist ja inimese iseseisvuse hoidmist nii kaua kui võimalik. ✔
2. Areng on toimunud **struktuurides** (kompetentsikeskus, valdkonna arenguprogramm) — need on
   **käivitatud tegevused**, mitte mõõdetud tulemused. Vastus ei tohi programmi olemasolu esitada
   tõendina, et kvaliteet on paranenud.
3. **2018. aasta artikkel on vajaduste kaardistus**, mitte tänase olukorra kirjeldus.
4. **2022. aasta tugigrupid on praktikakirjeldus** — ühe sekkumise kogemus, mitte üleriigiline mõju.
5. Kvaliteedi hindamiseks on olemas eraldi juhendmaterjal, mis on hooldekodu arendusplaani
   loomulik alus.

### Kasulikud, aga mittekohustuslikud väited

- Rahvusvahelised võrdlused (Šotimaa inimkeskne mudel 3/2025, Jaapani näide 3/2025) — inspiratsioon,
  mitte tõend Eesti kohta.
- Keskkonnakohanduste ja abivahendite roll.
- Dementsussõbralikkuse kujundamise artikkel 3/2024.

### Väited, mida allikad EI toeta

- Arvulised väited teenuskohtade hulga, järjekorra pikkuse või kaetuse kohta ilma allikata.
- „Olukord on viimastel aastatel oluliselt paranenud" — allikad ütlevad „poolel teel".
- Väide, et arenguprogramm on kvaliteeti tõestatavalt parandanud.

### Oluline puuduv info

- Dementsusega inimeste arv ja prognoos Eestis (registris ei tuvastatud usaldusväärset alust).
- Konkreetse hooldekodu tasandi mõõdikud.
- Teenuskohtade kättesaadavuse aegrida.

### Eksitavad / teisejärgulised allikad

- 19 dementsuseteemalist artiklit kokku — otsing toob palju; osa on lühiuudised (2–5 lõiku,
  nt „Dementsusega inimesed peaksid olema ühiskonnas kaua tegusad", 2 lõiku).
- `sotsiaaltoo-3-2020-eestis-on-nyyd-spetsiaalselt-dementsusega-inimestele-ehitatud-kodu-2020-3`
  — üksikjuhtum, ei kanna üldistust.

### Soovituslik struktuur

Ajajoon (2018 → 2022 → 2024 → 2025) → mis on tõendatud, mis on käivitatud, mis on plaan →
mida sellest arendusplaani võtta.

### Verbosity-tundlikud punktid

- **Eristus „käivitatud programm" vs „paranenud tulemus".** Lühivastus kipub ütlema
  „olukord on paranenud, loodi kompetentsikeskus" — see on kaks asja kokku surutud.
- **2025. aasta kolm kitsaskohta** (järjekorrad, tööjõud, sügava dementsuse kohad).
- Aastaarvud allikate juures.

### Aktsepteeritav puudumine

- Rahvusvahelised näited.
- Artiklite autorid.
- Kvaliteedijuhendi struktuuri kirjeldus.

### Kriitilised vead (faktitäpsus ≤ 1)

- Esitab programmi või kompetentsikeskuse olemasolu tõendina kvaliteedi paranemisest.
- Väljamõeldud arvud järjekordade või teenuskohtade kohta.
- Esitab 2018. aasta vajaduste kaardistuse tänase seisuna.

---

## Ülesanne 4 — Kas liituda MARAC-võrgustikuga?

**Eesmärk.** Kas mudel kasutab **päris mõjuhindamist**, esitab ka **mõju piirid** ja eristab
juhendmaterjali (kuidas teha) mõjuhindamisest (kas töötab).

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `sotsiaalkindlustusamet_marac_i_vorgustiku_mudeli_moju_hindamine_loppraport` | MARAC-i võrgustiku mudeli mõju hindamine. Lõppraport (**2024**, 404 lõiku) | `research_reports` | ✔ |
| 2 | `sotsiaalkindlustusamet_marac_i_juhendmaterjal` | MARAC-i juhendmaterjal (144 lõiku) | `national_guidelines` | ○ |
| 3 | `sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele` | MARAC-i mudeli juhend KOV lastekaitsele | `national_guidelines` | ○ |
| 4 | `sotsiaaltoo-3-2020-elude-paastmine-vorgustikutoos-maraci-abil-2020-3` | Elude päästmine võrgustikutöös MARACi abil (3/2020) | `sotsiaaltoo_articles` | ○ |
| 5 | `sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota` | Riskihindamine lähisuhtevägivalla juhtumites – tervishoiutöötajatele | `research_reports` | ○ |
| 6 | `sotsiaalkindlustusamet_naiste_tugikeskuste_2021_aasta_kogemusuuringu_aruanne` | Naiste tugikeskuste 2021. aasta kogemusuuringu aruanne | `research_reports` | ○ |

### Vajalikud põhiväited

1. **Mõju kohta on olemas päris hindamine (2024)**, mis käsitleb eraldi nii **MARAC-i kasutegureid
   ohvrile** kui ka **tulemuslikkust vähendavaid tegureid**. ✔ Vastus peab mainima mõlemat poolt —
   ainult kasutegurite esitamine on valikuline refereerimine.
2. **Juhtum ei lähe MARAC-i automaatselt.** Raporti järgi arutatakse enne, kas juhtumit saab
   lahendada MARAC-i väliselt, ja tõstetakse MARAC-i siis, kui on vaja tuumikliikmete osalust. ✔
   Vastus peab ütlema, et MARAC on kõrge riskiga juhtumite mehhanism, mitte üldine koostöövorm.
3. MARAC eeldab **võrgustiku tuumikliikmete kohalolekut** ja struktureeritud riskihindamist —
   see on ressursikulu, mida juhtkonnale tuleb ausalt nimetada.
4. KOV lastekaitse jaoks on **eraldi juhend** — see on praktiline sisenemispunkt.
5. Vastus peab eristama: **2020. aasta artikkel** on praktikakirjeldus, **2024. aasta raport**
   on hindamistõend, **juhendmaterjal** ei ole mõjutõend.

### Kasulikud, aga mittekohustuslikud väited

- Naiste tugikeskuste kogemusuuring annab ohvri vaate, aga on 2021. aastast.
- Tervishoiutöötajate riskihindamise materjal näitab, et võrgustikus on ka väljaspool sotsiaalala
  osapooli.
- Soovitus alustada olemasoleva piirkondliku MARAC-iga liitumisest, mitte oma mudeli loomisest.

### Väited, mida allikad EI toeta

- Numbriline mõju („vähendab kordumist X%") ilma raportist pärineva täpse aluseta.
- „MARAC sobib kõigile lähisuhtevägivalla juhtumitele."
- Väide, et liitumine on KOV-ile kohustuslik.

### Oluline puuduv info

- Konkreetse piirkonna MARAC-i olemasolu ja kontaktid.
- Osalemise ajakulu tundides ja rahaline kulu.
- Andmekaitse ja andmete jagamise kord võrgustikus (registris ei tuvastatud MARAC-spetsiifilist
  andmekaitse dokumenti).

### Eksitavad / teisejärgulised allikad

- **`sotsiaalkindlustusamet_evaluation_of_the_impact_of_the_marac_networking_model` (462 lõiku,
  `national_guidelines`) on sama mõjuhindamise ingliskeelne versioon.** Kui vastus esitab selle
  **teise, sõltumatu uuringuna**, on see tõendusbaasi kunstlik kahekordistamine — karista
  kategoorias 4 (ebakindluse ja allikapiiride aus käsitlemine).
- `sotsiaalkindlustusamet_marac_i_teavitusleht` (3 lõiku) — teavitusmaterjal, mitte tõend.

### Soovituslik struktuur

Mida tõend ütleb (mõlemad pooled) → mida MARAC praktikas nõuab → millistele juhtumitele see on →
mida me veel ei tea → soovitatav järgmine samm.

### Verbosity-tundlikud punktid

- **Tulemuslikkust vähendavad tegurid.** Lühivastus kipub jätma alles ainult kasutegurid.
- **MARAC-i välise lahenduse eelistus** — sisuline sisenemiskriteerium.
- Eristus juhend vs mõjuhindamine.

### Aktsepteeritav puudumine

- Naiste tugikeskuste uuringu detailid.
- Artikli 3/2020 näitejuhtum.
- Ingliskeelse versiooni mainimine (selle **mittemainimine on parem** kui selle esitamine
  eraldi tõendina).

### Kriitilised vead (faktitäpsus ≤ 1)

- Esitab väljamõeldud mõjunumbri.
- Väidab, et MARAC on kohustuslik või sobib kõigile juhtumitele.
- Esitab ingliskeelset versiooni teise uuringuna.

---

## Ülesanne 5 — Juhtum: teade lasteaiast

**Eesmärk.** Nelja tõendusliigi eristamine: **vaatlusfakt**, **kolmanda isiku väide**,
**professionaalne hinnang**, **puuduv info** — ja sellest tulenev tegevusplaan.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat` | Lapse heaolu hindamise käsiraamat (242 lõiku) | `national_guidelines` | ○ |
| 2 | `oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse` | Juhend: abivajavast lapsest teatamine ja andmekaitse | `national_guidelines` | ○ |
| 3 | `lastekaitse_liit_lapse_osalusoiguse_rakendamise_juhend` | Lapse osalusõiguse rakendamise juhend | `organization_guidelines` | ○ |
| 4 | `sotsiaaltoo-3-2019-lapse-oigus-osaleda-abivajaduse-hindamises-2019` | Lapse õigus osaleda abivajaduse hindamises | `sotsiaaltoo_articles` | ○ |
| 5 | `sotsiaaltoo-1-2023-lapse-abivajaduse-eelhindamise-arendus-star-is-2023-1` | Lapse abivajaduse eelhindamise arendus STAR-is | `sotsiaaltoo_articles` | ○ |

### Vajalikud põhiväited

1. **Tõendusliikide lahterdamine peab olema vastuses nähtav**, vähemalt sisuliselt:
   - *Vaatlusfakt / esmase allika tähelepanek:* õpetaja nägi kolmel hommikul pesemata ja söönuta
     tulnud last, väsimust ja hommikuringis magamajäämist.
   - *Kolmanda isiku väide (kuuldus):* teiste lapsevanemate jutt uuest elukaaslasest ja öisest
     valjust muusikast. **Seda ei tohi käsitleda tuvastatud asjaoluna.**
   - *Kontrollitav asjaolu:* ema ei ole kahel korral vestlusele tulnud; ema selgitus on haigus.
   - *Puuduv info:* lapse enda vaade, kodune olukord, tervisetõend, kas peres on varasem kontakt.
2. **Lapse enda ärakuulamine on eraldi samm**, mitte valikuline lisa.
3. Plaan peab algama **abivajaduse hindamisest**, mitte järelduse kinnitamisest.
4. **Andmekaitse:** teabe kogumine ja jagamine võrgustikus on lubatud ulatuses, mis on lapse abistamiseks
   vajalik — vastus ei tohi soovitada piiramatut info kogumist naabritelt ja teistelt vanematelt.
5. Vastus peab ütlema, mida **ei saa praegu järeldada** — hooletusse jätmine ei ole tuvastatud.

### Kasulikud, aga mittekohustuslikud väited

- Kodukülastuse ja lasteaia täiendava vaatluse kombineerimine.
- Kontakt perearsti või tervishoiuga (kui ema väidab haigust).
- STAR-i eelhindamise loogika.
- Kohtumise pakkumine ajal, mis emale sobib — mitteilmumine ei ole iseenesest tõend.

### Väited, mida allikad EI toeta

- Väide, et laps on hooletusse jäetud.
- Väide, et uus elukaaslane on riskitegur (praegu on see kuuldus kuulduse põhjal).
- Konkreetsed seaduse tähtajad, kui vastus neid ei suuda allikast tuletada.
- Väide, et tuleb kohe algatada lapse perest eraldamine.

### Oluline puuduv info

- Lapse enda ütlused ja seisund.
- Kas on varasem juhtumitöö või teated.
- Ema tervislik ja majanduslik olukord.
- Kes veel peres elab.

### Eksitavad / teisejärgulised allikad

- Räägime Lastest logiraamatud (`organization_materials`) — head vestlusvahendid, kuid ei vasta
  „mis on siin teada" küsimusele.
- `sotsiaaltoo-3-2019-miks-on-keelatud-lapse-kehaline-karistamine-2019` — teema ei ole tõendatud.
- Tark Vanem töölehed — vanemlusnõustamise vahend, mitte hindamisalus.

### Soovituslik struktuur

Mis on teada → mis on kellegi jutt → mis on minu hinnang → mis on puudu → homme tehtavad sammud
prioriteedi järjekorras.

### Verbosity-tundlikud punktid

- **Kolme tõendusliigi eristamine.** Kui lühivastus annab ainult tegevusnimekirja, on kasutaja
  põhiküsimus vastamata — see on kategooria 3 (eristamine) nullilähedane tulemus, isegi kui plaan on hea.
- **Lapse ärakuulamine.**
- **Hoiatus kuulduste kohta.**

### Aktsepteeritav puudumine

- STAR-i tehniline kirjeldus.
- Osalusõiguse juhendi teoreetiline taust.
- Pikk andmekaitse käsitlus — piisab ühest hoiatavast lausest.

### Kriitilised vead (faktitäpsus ≤ 1)

- Käsitleb teiste lapsevanemate juttu tuvastatud faktina.
- Nimetab elukaaslast riskiks või vägivallatsejaks.
- Esitab väljamõeldud seadusesätte või tähtaja.

---

## Ülesanne 6 — Sama juhtum, uus info

**Eesmärk.** Riskihinnang **peab muutuma**, kuid ilma diagnoosi või süüdistuseta. Testib
kalibreeritust: liiga ettevaatlik vastus jätab signaali märkimata, liiga julge vastus tuvastab
vägivalla.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `sotsiaalkindlustusamet_riskihindamine_lahisuhtevagivalla_juhtumites_tervishoiutoota` | Riskihindamine lähisuhtevägivalla juhtumites | `research_reports` | ○ |
| 2 | `sotsiaalkindlustusamet_marac_i_mudeli_juhend_kov_lastekaitsele` | MARAC-i mudeli juhend KOV lastekaitsele | `national_guidelines` | ○ |
| 3 | `sotsiaalkindlustusamet_lapse_heaolu_hindamise_kasiraamat` | Lapse heaolu hindamise käsiraamat | `national_guidelines` | ○ |
| 4 | `oiguskantsler_juhend_abivajavast_lapsest_teatamine_ja_andmekaitse` | Juhend: abivajavast lapsest teatamine ja andmekaitse | `national_guidelines` | ○ |
| 5 | `sotsiaalkindlustusamet_marac_i_juhendmaterjal` | MARAC-i juhendmaterjal | `national_guidelines` | ○ |

### Vajalikud põhiväited

1. **Riskihinnang tõuseb.** Kolm uut elementi koos on signaal, mitte müra:
   ema vaikimine ja pilgu pööramine elukaaslase sissetulekul, katkine uks, naabri kirjeldus karjumisest.
2. **Ükski neist ei tõenda vägivalda.** Vastus peab säilitama sõnastuse „viitab võimalusele",
   mitte „kodus toimub vägivald".
3. **Järgmine samm on ema ärakuulamine ilma elukaaslase juuresolekuta** — see peab plaanis olema.
4. **Struktureeritud riskihindamise vahend tuleb kasutusele võtta**, mitte tugineda muljele.
5. Kui risk hinnatakse kõrgeks, on **MARAC-i suunamine** kaalumisel — koos märkusega, et see on
   kõrge riski mehhanism (vt ülesanne 4).
6. Lapse heaolu hindamine jätkub — täiskasvanute suhte küsimus ei asenda lapse abivajaduse hindamist.

### Kasulikud, aga mittekohustuslikud väited

- Vaatluste dokumenteerimine sõna-sõnalt, ilma tõlgenduseta.
- Turvaplaani teema tõstatamine, kui ema räägib.
- Ohvriabi kontakti pakkumine.
- Ettevaatus infot kogudes: naabrilt küsimine võib ohtu suurendada.

### Väited, mida allikad EI toeta

- „Tegemist on lähisuhtevägivallaga."
- „Elukaaslane on vägivallatseja."
- „Laps tuleb kohe perest eraldada."
- Vastupidine viga: „midagi ei ole muutunud, jätkame plaani järgi."

### Oluline puuduv info

- Ema enda kirjeldus ohutundest.
- Kas on politsei väljakutseid või varasemaid teateid.
- Elukaaslase roll peres ja lapse suhe temaga.
- Kas lapsel on nähtavaid vigastusi.

### Eksitavad / teisejärgulised allikad

- Naiste tugikeskuste kogemusuuring — kasulik taust, mitte selle juhtumi alus.
- MARAC-i mõjuhindamine (404 lõiku) — see on poliitikatasandi tõend, mitte juhtumijuhis;
  kui vastus tsiteerib mõjuhindamist juhtumiotsuse põhjendusena, on see altitude-viga.

### Soovituslik struktuur

Mis muutus → miks see riski tõstab → mida see EI tõenda → järgmised sammud, sh ohutu ärakuulamine →
millal ja kelle poole edasi.

### Verbosity-tundlikud punktid

- **Ema ärakuulamine üksi.** See on üks lause, mille kadumine muudab plaani ohtlikuks.
- **„Viitab, ei tõenda" sõnastus.**
- Kolme uue signaali eraldi nimetamine — koondlause „olukord tundub tõsisem" ei ole sama.

### Aktsepteeritav puudumine

- MARAC-i protseduuri kirjeldus.
- Riskihindamisvahendi punktisüsteem.
- Ohvriabi kontaktandmed.

### Kriitilised vead (faktitäpsus ≤ 1)

- Kinnitab vägivalla toimumist.
- Nimetab elukaaslast vägivallatsejaks.
- Ei tõsta riskihinnangut üldse.
- Soovitab kohest eraldamist ilma hindamiseta.

---

## Ülesanne 7 — Otsustusmemo: erihoolekande kättesaadavus

**Eesmärk.** Umbes lehekülje pikkune ametlik väljund, milles on **kohustuste jaotus** ja **tõendile
tuginemine** — mitte üldsõnaline arvamus.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `riigikontroll_ulevaade_erihoolekandeteenuste_kattesaadavusest` | Ülevaade erihoolekandeteenuste kättesaadavusest — Riigikontrolli ülevaade Riigikogule, **5. september 2025** | `national_guidelines` | ✔ |
| 2 | `epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-2026` | Täisealiste psüühikahäirega inimeste, sh eestkostetavate uuringu kokkuvõte (213 lõiku) | `research_reports` | ○ |
| 3 | `praxis_centar_taiskasvanud_erivajadusega_inimeste_abivajaduse_hindamine_ja` | Täiskasvanud erivajadusega inimeste abivajaduse hindamine ja teenuste osutamine | `research_reports` | ○ |
| 4 | `national-rt-130122025029` (§ 76) | Sotsiaalhoolekande seadus — § 76 Erihoolekandeteenus | `national_regulations` | ✔ |
| 5 | `riigikontroll_omavalitsuste_tegevus_erivajadustega_inimeste_toetamisel` | Omavalitsuste tegevus erivajadustega inimeste toetamisel | `national_guidelines` | ○ |
| 6 | `kov::johvi-vald::item::johvi_vald_service_kogukonnapohise_toetatud_elamise_teenus` | Kogukonnapõhise toetatud elamise teenus | `kov_services` | ○ |

### Vajalikud põhiväited

1. **Erihoolekandeteenus on riigi (SKA) korraldatav teenus** SHS 3. peatüki „Riigi korraldatav abi"
   tähenduses — KOV ei saa seda oma otsusega asendada. ✔ See on memo tuum.
2. **Riigikontrolli 2025. aasta ülevaade on tõendusalus** ja selle sõnum on, et kättesaadavus ja
   kvaliteet ei ole tagatud kõigile vajajatele; valdkonna jätkusuutlik areng eeldab poliitilist
   tahet ja strateegilist investeeringut. ✔ Memo peab kuupäevaga viitama.
3. **Kinnisele teenusele on järjest enam jõudnud autismispektrihäirega inimesed** — konkreetne
   Riigikontrolli tähelepanek, mis näitab sihtrühma muutust. ✔
4. **KOV-i roll on reaalne, aga piiritletud:** abivajaduse hindamine, KOV-i enda teenused
   (koduteenus, tugiisik, isiklik abistaja, eluruumi tagamine, kogukonnapõhine toetatud elamine),
   lähedaste toetamine, suunamine ja järjekorras oleku ajal toetamine.
5. Memo peab eristama **mida vald saab otsustada** (oma teenuste maht, koordineerimine) ja
   **mida ei saa** (riiklike teenuskohtade loomine).

### Kasulikud, aga mittekohustuslikud väited

- Eestkostetavate uuring toob eraldi välja eestkoste ja otsustusõiguse teema.
- Praxise uuring puudutab hindamise ja teenuste sidusust.
- Ettepanek koguda vallas oma andmed järjekorras olevate inimeste kohta — memo saab lõppeda
  konkreetse ülesandega.

### Väited, mida allikad EI toeta

- Konkreetsed järjekorra pikkused üleriigiliselt või vallas.
- Väide, et vald võib ise erihoolekandeteenust osutada ilma riikliku raamistikuta.
- Rahalised prognoosid.

### Oluline puuduv info

- Valla enda arvandmed (kui palju inimesi, millistes teenustes).
- SKA piirkondlik teenuskohtade seis.
- Lähedaste hoolduskoormuse mõõdetud tase vallas.

### Eksitavad / teisejärgulised allikad

- `epikoda-taisealiste-psuuhikahairega-eestkostetavate-uuring-luhikokkuvote-2026` (6 lõiku) —
  sama uuringu lühiversioon; eraldi tõendina esitamine on tõendusbaasi kahekordistamine.
- Erihoolekande teenuslehed teistes valdades.
- `epikoda_epikoja_arengukava_2025_2030` — organisatsiooni enda arengukava, mitte olukorra tõend.

### Soovituslik struktuur

Pealkiri ja adressaat → olukord (tõendiga) → õiguslik jaotus riik/KOV → mida vald saab teha →
mida on otsustamiseks veel vaja → ettepanek. Ligikaudu üks lehekülg.

### Verbosity-tundlikud punktid

- **Riik/KOV kohustuste jaotus.** Ilma selleta ei ole memo otsustuskõlblik.
- **Viide Riigikontrolli ülevaatele koos kuupäevaga** — ametlikus memos on see kande alus.
- **Ettepaneku osa.** Lühivastus võib lõpetada olukorra kirjeldusega ja jätta otsuse õhku.
- Memo vorm (adressaat, kuupäev, ettepanek) — kasutaja ütles, et peab saama „sellisena edasi saata".

### Aktsepteeritav puudumine

- Praxise uuringu metoodika.
- EPIKoja uuringu detailid.
- Naabervaldade näited.

### Kriitilised vead (faktitäpsus ≤ 1)

- Väidab, et erihoolekanne on KOV-i korraldatav teenus.
- Esitab väljamõeldud järjekorranumbreid.
- Segab erihoolekande ja üldhooldusteenuse kohustused kokku.

---

## Ülesanne 8 — Kas töövõimereform tasus ära?

**Eesmärk.** Aus „ei saa öelda". Küsimus sisaldab kahte hüpet: (a) kas reform on tööhõivet
suurendanud, (b) kas sellest järeldub midagi ühe valla eelarve kohta. Allikad ei kanna kumbagi
täies ulatuses.

### Vajalikud allikad

| # | docId | Pealkiri | Kollektsioon | Tase |
|---|---|---|---|---|
| 1 | `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja` | Töövõime toetamise süsteemi makromajandusliku mõju hindamine (755 lõiku) | `research_reports` | ○ |
| 2 | `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami` | Töövõime toetamise skeemi **vahehindamise** lõpparuanne (291 lõiku) | `research_reports` | ○ |
| 3 | `tootukassa_ska_sotsiaalministeerium_teadlikkus_ja_hoiakud_vahenenud_toovoimega_inimeste_ning_too` | Teadlikkus ja hoiakud vähenenud töövõimega inimeste ning töövõimereformi teemal (413 lõiku) | `national_guidelines` | ○ |
| 4 | `riigikontroll_toovoime_vahenemise_ennetamine` | Töövõime vähenemise ennetamine | `national_guidelines` | ○ |
| 5 | `sotsiaaltoo-3-2020-toovoimereformi-voimalused-ja-kitsaskohad-2020-3` | Töövõimereformi võimalused ja kitsaskohad (3/2020) | `sotsiaaltoo_articles` | ○ |
| 6 | `tootukassa_ska_sotsiaalministeerium_toovoime_toetamise_skeemi_loomise_ja_juurutamise_vahehindami_2` | Sama vahehindamise infoleht (4 lõiku) | `research_reports` | ○ |

### Vajalikud põhiväited

1. **Vastus peab ütlema selgelt, mida ei saa väita:** allikad ei võimalda kinnitada, et reform on
   tööhõivet suurendanud sellisel kujul, nagu volikogu liige väitis.
2. **Vahehindamine ei ole lõpphinnang** — nimi ise ütleb, et tegu on vahepealse seisuga.
3. **Hoiakute ja teadlikkuse uuring ei mõõda tööhõivet.** Kui vastus kasutab seda tööhõive
   tõendina, on see kategooria 4 põhiviga.
4. **Üleriigilisest hindamisest ei saa tuletada ühe valla järeldust** — ei kohaliku tööturu
   struktuuri, sihtrühma suuruse ega meetmete katvuse kohta.
5. Vastus peab ütlema, **mida oleks vaja**, et küsimusele vastata: valla enda andmed
   sihtrühma, meetmete kasutuse ja tulemuste kohta.
6. Vastus **ei tohi** anda eelarve vähendamise soovitust ega selle vastandit ilma aluseta.

### Kasulikud, aga mittekohustuslikud väited

- 2020. aasta artikkel nimetab nii võimalusi kui kitsaskohti — sobiv viide sellele, et pilt oli
  juba tol ajal kahetine.
- Riigikontrolli ennetuse-aruanne käsitleb teist etappi (ennetus enne töövõime langust) ja
  ei vasta otse küsimusele.
- Ettepanek, kuidas volikogus vastata: eristada „reformi mõju riigis" ja „meie meetmete mõju vallas".

### Väited, mida allikad EI toeta

- „Reform on tööhõivet suurendanud" ilma kvalifikatsioonita.
- „Reform ei ole midagi muutnud."
- Igasugune arvuline mõjuhinnang, mida vastus ei suuda allikast tuletada.
- Soovitus eelarvet vähendada või suurendada.

### Oluline puuduv info

- Valla tööturu andmed ja sihtrühma suurus.
- Meetmete katvus vallas.
- Värskem kui hindamisaruannete periood.

### Eksitavad / teisejärgulised allikad

- **`praxis_centar_toovoime_toetamise_susteemi_loomise_ja_juurutamise_makromaja` (103 lõiku) on
  sama makromajandusliku hindamise teine registrikirje.** Kahe kirje esitamine kahe sõltumatu
  uuringuna on tõendusbaasi kunstlik kahekordistamine.
- Infoleht (4 lõiku) ei ole eraldi tõend.
- Tööandjate hoiakute materjal — hoiak ei ole tulemus.

### Soovituslik struktuur

Mida allikad ütlevad → mida nad ei ütle → miks üleriigilisest ei järeldu kohalik →
mida oleks vaja teada → mida volikogus ohutult öelda.

### Verbosity-tundlikud punktid

- **Kahe hüppe eristamine** (kas reform mõjus / kas sellest järeldub kohalik otsus). Lühivastus
  kipub vastama ainult esimesele.
- **Hoiakute uuringu piir.**
- **Lause selle kohta, mida volikogus öelda** — kasutaja praktiline vajadus.

### Aktsepteeritav puudumine

- Hindamisaruannete metoodika.
- Riigikontrolli ennetusaruande sisu.
- Artikli 3/2020 detailid.

### Kriitilised vead (faktitäpsus ≤ 1)

- Kinnitab volikogu liikme väite tõeseks ilma allikata.
- Annab eelarvesoovituse.
- Esitab kahte sama uuringu kirjet sõltumatute tõenditena.
- Esitab väljamõeldud protsente.

---

## Hindamisrubriik (kõik ülesanded)

Iga vastus saab kuus hinnet skaalal **0–3**.

| Kategooria | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **1. Faktitäpsus** | Sisaldab väljamõeldud fakti või kriitilist viga | Üks oluline ebatäpsus | Väiksed ebatäpsused, mis otsust ei muuda | Kõik kontrollitavad väited peavad paika |
| **2. Vajalike allikate mõtete katvus** | Katab ≤1 vajalikust allikast | Katab osa, põhilõng puudu | Katab enamiku põhiväidetest | Katab kõik põhiväited |
| **3. Fakti, hinnangu ja ettepaneku eristamine** | Kõik esitatud ühel tasandil | Eristus juhuslik | Eristus enamasti selge | Iga väide on äratuntavalt fakt, hinnang või ettepanek |
| **4. Ebakindluse ja allikapiiride aus käsitlemine** | Varjab ebakindlust või esitab oletuse faktina | Mainib ebakindlust üldsõnaliselt | Nimetab peamised piirid | Nimetab täpselt, mida ei saa väita ja miks |
| **5. Praktiline kasutatavus** | Ei ole tööülesandes kasutatav | Vajab suurt ümbertegemist | Kasutatav väikeste täiendustega | Kasutatav nii, nagu on |
| **6. Selgus ja proportsionaalne pikkus** | Segane või mahult täiesti vale | Kas liiga napp või täidetud korduva tekstiga | Enamasti sobiv | Täpselt nii pikk, kui ülesanne nõuab |

**Kriitiliste vigade reegel.** Kui vastus sisaldab ülesande juures loetletud kriitilist viga, ei saa
kategooria 1 hinne olla üle **1 punkti**, isegi kui ülejäänud vastus on hea.

**Verbosity-tundlike punktide reegel.** Iga ülesande juures loetletud verbosity-tundlik punkt
loetakse eraldi: märgi iga vastuse kohta, mitu neist on olemas (nt „3/3"). See on **peamine
mõõdik A ja B võrdlemisel** — kategooriate summa üksi võib lühivastust põhjendamatult premeerida
kategoorias 6.

**Vastuvõetava puudumise reegel.** „Aktsepteeritav puudumine" all loetletud info puudumine
**ei tohi** hinnet vähendada üheski kategoorias. See on kaitse, et pikk vastus ei võidaks
lihtsalt mahu tõttu.

### Koondamise soovitus

Iga ülesande kohta arvuta seadistuse kaupa:

- kuue kategooria keskmine (kaks kordust kokku);
- verbosity-tundlike punktide katvus protsendina;
- kriitiliste vigade arv;
- keskmine väljundtokenite arv.

**Verbosity=low on edukas**, kui verbosity-tundlike punktide katvus on ≥90% mediumist ja
kriitiliste vigade arv ei kasva — väiksema tokenikuluga. **Verbosity=low kukub läbi**, kui katvus
langeb alla 75% või kui mõni kategooria 4 hinne langeb kahe punkti võrra.
