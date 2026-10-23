# ADR-185: pöörde omavalitsuse õigusaktidel on valikus oma kohad

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 küsimusele „Kas võtan järgmisena ette need 9 osaliselt õiget vastust?“: „nii“, „jah“.

## Probleem

**B20** (teenuseosutaja, Narva suunatud klient): „Milline kvalifikatsioon peab võlanõustajal olema ja kas teenus peab kliendile tasuta olema?“

- 21.10 puudus pöördel omavalitsus. [ADR-172](adr-172-provider-area-county-and-kept-reply.md) ja [ADR-173](adr-173-earlier-municipality-and-plan-refinements.md) andsid talle Narva linna (F2, 22.10).
- Narva kirje „Võlanõustamisteenus“ ei ütle, kas teenus on tasuta. Seda ütleb Narva õigusakt „Võlanõustamise teenuse osutamise kord Narva linnas“ § 1. 21.10 leidis seda akti B08 (pöörduja küsis „Narva tasuta võlanõustamisteenus“), kuid B20 mitte: F2-s ega F3-s (23.10) polnud akt valikumudeli kandidaatide seas.
- F3 vastus: „Narva kirjelduses on kirjas, et kui klient suunatakse kohaliku omavalitsuse kaudu, võib sotsiaalosakond otsustada teenuse kulud kliendi eest tasuda. … tasuta teenus ei ole automaatne.“

Põhjus: valikumudel loeb liidetud järjekorrast 30 lõiku ja riiklike seaduste 6 reservkohta ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)). Omavalitsuse õigusakt ei ole riiklik seadus. Ta peab võistlema kümnete riiklike võlanõustamise tekstidega (SKA juhend, liidu lehed, artiklid) ja jääb basseinist välja. ADR-032 jättis omavalitsuste aktid reservist välja, sest toona täitsid umbes 50 omavalitsuse sarnased määrused basseini. Nüüd jätab skoop ([ADR-058](adr-058-municipal-social-acts.md), `municipalScope`) alles ainult pöörde omavalitsuse aktid.

## Otsus

- **Kaks reservkohta pöörde omavalitsuse õigusaktidele** (`MUNICIPAL_LAW_RESERVE`, `size: 2, perDocument: 1`), riiklike seaduste kohtade järel.
  - Õigusakt on dokument, millel on kehtivuse algus ja omavalitsus (`municipalLegalText`).
  - Skoop jätab alles ainult pöörde omavalitsuse omad. Kui omavalitsus pole teada, ei ole ka kohti.
  - Kahe võimaliku omavalitsuse puhul (Tartu linn ja Tartu vald) saavad kohad mõlema aktid.
- **Aktid otsitakse omaette** samade tekstide ja vektoritega (kanalid `municipal_*`), nagu reserv ja versioonimuutuste kohad.
  - Riiklike seaduste reserv jääb täpselt samaks.
  - Lisapäringud jooksevad teistega paralleelselt.
- **Lõik, mis on juba basseinis, kohta ei võta.** Järjekorras järgmine lõik saab selle koha.
- **Jäljes:**
  - reservkohtade loend (`rerank.reserved`) sisaldab ka neid kohti, seega märgib vaade need „reservkoht“;
  - eraldi loend `municipal_reserved`;
  - kanali nimi „omavalitsuse aktide reserv“;
  - valiku seadetes `pool_reserve.municipal`.

## Mis muutus

- `lib/rag-v2/search/unified.js`: `municipalLegalText`, `MUNICIPAL_LAW_RESERVE`.
- `lib/rag-v2/pilot/retrieval.js`: teadmiste raja `poolReserve.municipal`.
- `lib/rag-v2/search/ranking.js`: `poolReserve.municipal` kontroll.
- `lib/rag-v2/search/retrieval.js`: omaette otsing, kohad, audit.
- `components/admin/rag/ChatTurnTrace.jsx`, `chatTraceCopy.js`: kanali nimi ja valiku selgitus.

## Kontroll

- **F4** (väljalase `8af74266`, 23.10, samad 16 pööret kui F3-s: 9 osalist vastust ja iga vestluse avaküsimus): omavalitsuse kohti ei olnud üheski pöördes, kanaleid `municipal_*` ei olnud.
  - Põhjus: `validateQuery` (`lib/rag-v2/search/ranking.js`) ehitab `poolReserve` uuesti üles ja jättis `municipal` välja. Parandatud.
  - B20 leidis Narva korra siiski, sest plaani päring nimetas seekord Narvat („… tasuta Narva linn“) ja kord oli tavajärjekorras kohtadel 20 ja 29. Vastus: „Narva linnas osutatav võlanõustamisteenus on kliendile tasuta“ (korra § 1).
- **Kordus ilma mudelikutseta** (värava salvestatud vektorid, valiku konks ei vali midagi; `abbreviation-municipal-1`, kolm küsimust Narva linna, Sillamäe linna ja Põlva valla skoobiga).
  - Väljalase: 8 kanalit, bassein 36.
  - Parandusega overlay: 12 kanalit (`municipal_*` 40 kandidaati igaüks), bassein 38, `municipal_reserved` 2.
  - Kohad said vastava omavalitsuse aktid: Narva asendus- ja järelhooldusteenuse kord; Sillamäe asendus- ja järelhooldusteenuse kord ning sotsiaalteenuste kord; Põlva tugiisiku ja lapsehoiu korrad.
  - Raja aeg oli sama mis väljalaskel (8,9 / 6,1 / 9,1 s vs 9,1 / 6,5 / 10,9 s).
- **F5** pärast paranduse deploy'd: samad 16 pööret.
