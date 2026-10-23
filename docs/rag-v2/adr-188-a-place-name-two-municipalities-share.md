# ADR-188: kahe omavalitsuse ühine kohanimi toob mõlema info

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 ettepanekule „Kui inimene ütleb ainult „Viljandi“ ja ei vasta küsimusele, kas linn või vald, võiks vastus anda mõlema omavalitsuse kontaktid“: „paranda. Pärnu ja teiste linnadega sama teema“. Seis: **vestluse juhis `m4-grounded-dialogue-56`.**

## Probleem

- **Kataloogis on neli linna, mille nimi kuulub ka vallale:** Tartu, Viljandi, Võru ja Rakvere.
  - „Elan Tartus“ jättis elukoha lahtiseks (`quote_names_several_places`). Kandidaadid läksid kaduma (`candidates: []`) ja skoop oli `region_required`.
  - Kirjeid ei loetud kummastki omavalitsusest. Vastus küsis, kumb omavalitsus, ja kui kasutaja ei vastanud, jäi ta ilma kohaliku infota.
  - Näide: F10 C10 „Kellega ma Viljandis esimesena ühendust võtan?“ → „oma elukohajärgse omavalitsuse …“.
- **Pärnu ei ole selline nimi.** Kontrollisin serveris 27 linna (maakonnakeskused ja muud) lausega „Elan …s“. „Pärnus“ loetakse Pärnu linnaks, „Kuressaares“ Saaremaa vallaks, „Sindis“ Tori vallaks ja nii edasi. Kahemõtteliseks jäid ainult need neli.
- Lahendus on üldine: iga nimi, mille kataloog annab kahele omavalitsusele, käitub nüüd samamoodi.

## Otsus

- **Olek** (`lib/rag-v2/pilot/person-places.js`).
  - Ühine nimi on üks mainimine kahe kandidaadiga. Elukoht jääb lahtiseks nagu varem (`unresolved`, et [ADR-187](adr-187-a-shared-name-settled-later.md) saaks selle hiljem otsustada), kuid hoiab mõlemad kandidaadid ja märgi `shared`.
  - Skoop on `ambiguous_region` kahe kandidaadiga (`reason: shared_name`).
  - Teadmiste rada hoidis kahe kandidaadiga skoobi korral mõlema omavalitsuse akte juba varem (`municipalScope`).
- **Kirjete rada** (`lib/rag-v2/pilot/retrieval.js`, `mergeRecordPackets` failis `structured-record-source.js`).
  - Kui skoobis on kaks kandidaati (ühine nimi, või kaks omavalitsust, mida küsimus nimetab), loetakse mõlema kirjed eraldi, kumbki poole kirjete tokenieelarvega, ja liidetakse üheks paketiks.
  - Iga kirje hoiab oma omavalitsust. Kontekst nimetab mõlemat (`regions`), mitte ühte.
- **Vastuse juhis** (`m4-grounded-dialogue-56`). Kui `records.regions` nimetab kahte omavalitsust, annab vastus kummagi kohta lühidalt, mida tema kirjed ütlevad (abi, taotlemine, kontakt), ja küsib üks kord, kumb on inimese oma. Kumbagi ei loeta kinnitatuks.
- **Jälg:** kirjete omavalitsusena kuvatakse mõlemat („viljandi_linn + viljandi_vald“).

## Kontroll

**Kordus ilma mudelikutseteta** (päris kataloog, EstNLTK, kirjete andmebaas; väljalase vs overlay):

| Juhtum | Väljalase | Muudatusega |
|---|---|---|
| „Elan Tartus / Viljandis / Võrus / Rakveres“ | `region_required`, kandidaadid puuduvad | `ambiguous_region`, linn + vald |
| „Elan Pärnus“, „Elan Narvas“ | Pärnu linn, Narva linn | sama |
| Ema „Tartu“ | lahtine | kaks kandidaati |
| Järgmises pöördes plaan „Tartu linn“ | Tartu linn | Tartu linn |
| Järgmises pöördes plaan jälle „Tartu“ | lahtine | kaks kandidaati |
| Kirjed, Viljandi linn + vald | — | 20 + 18 kirjet, 13 kontakti, 38 allikat; viited ja võtmed klapivad; mudeli kontekst 11 111 tokenit |
| Kirjed, Tartu linn + vald | — | 14 + 21 kirjet, 11 kontakti, 35 allikat; viited ja võtmed klapivad; 11 399 tokenit |

Kahe omavalitsuse kirjed mahuvad sama eelarvesse (~11 000 tokenit) mis ühe omavalitsuse omad. Vaade on siis pealkirjade vaade (`titles`) ja küsimusele lähimad kirjed on näha täielikult.

**Pärast deploy'd** (väljalase `fd3cd4cb`, 23.10 19.40 UTC; 5 pööret, 0,026 USD): C-vestlus (C01, C10) ning üksikküsimused Võru, Tartu („mitte kesklinnas, vaid veidi väljas“) ja Rakvere kohta.

- Plaan kirjutas igas pöördes kohe linna täisnime: „Viljandi linn“, „Võru linn“, „Tartu linn“, „Rakvere linn“.
- Kahe omavalitsuse tee seega ei käivitunud. Vastused olid selle linna kirjetega:
  - C10 andis Viljandi linna kontakti (Silja Simon);
  - Võru küsimus andis Võru linna sotsiaaltööosakonna ja taotlemise;
  - Rakvere küsimus andis Rakvere toimetulekupiiri ja taotluse.
- Tee käivitub, kui plaan kirjutab ainult linna nime (F9 ja F10: „Tartu“, „Viljandi“). Seda tõestab ülalolev kordus.

**Täiendus ([ADR-189](adr-189-the-users-words-choose-a-shared-name.md), sama päev):** tee käivitub nüüd ka siis, kui plaan kirjutab „Tartu linn“ inimese „Tartus“ kohta. Linna ja valla vahel otsustavad ainult inimese enda sõnad.
