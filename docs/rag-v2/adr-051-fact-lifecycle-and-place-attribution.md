# ADR-051 — Dialoogi olek v4: faktide elutsükkel ja kohtade kuuluvus otsinguplaanist

29.09.2026. Teostus Claude Opus 5.5. Omanik 29.09: „need arendused tee kindlasti ära ja võid isegi kaugemale arenduses minna“ Codexi süsteemianalüüsi ([audit](../audits/rag-v2-system-analysis-2026-09-29.md)) avatud leidude kohta. Järgib [ADR-049](adr-049-person-bound-municipality.md)-t.

## Probleem

- **F3: mälu tupik.**
  - Olekud v1–v3 nõudsid, et mudel kirjutaks igal pöördel kogu oleku uuesti.
  - Iga eelmine fakt pidi korduma sama teema, isiku ja tsitaadiga. Välja jäetud või ümber sõnastatud fakt lükkas kogu uue oleku tagasi, koos uue omavalitsuse ja perioodiga.
  - 12 fakti piir ei lubanud 13. fakti lisada, ja vana väljajätmine lükkas samuti tagasi.
  - v3 parandas ainult teemasildi ja välja jäetud kehtiva fakti. 29.09 lükati v3-s tagasi veel 10% ja v2-s 30% jätkupööretest.
- **F1/F2: kuuluvus.**
  - v3-s andis isiku omavalitsuse vastusemudel. Kontroll tõendas ainult, et tsitaat nimetab omavalitsust.
  - Mudel võis ema lause („Minu ema omavalitsus on Kose vald“) omistada kasutajale.
  - Kataloog (enne vastust) ja olek (pärast vastust) kasutasid eri tõlgendust.

## Otsus

### Olek v4 (`m4-dialogue-state-4`, `dialogue-state-4.js`)

- **Mudel kirjutab ainult muutused:**
  - `new_facts`: tsitaat kasutaja pöördest, teema ja isik (`user` või silt);
  - `superseded`: parandus (`fact` → `by: N1`) või tagasivõtmine (`by: null`);
  - `needs` ja `unknowns`, mis viitavad kehtivale faktile ID-ga (`F3`) või uuele faktile järjekorraga (`N1`);
  - `periods` ja `language_hint`.
- **Server hoiab olekut:**
  - fakte püsivate ID-dega (`F1`, `F2`, …) ja olekuga `current`, `superseded`, `retracted` või `archived`;
  - kuni 12 uut fakti sõnumi kohta ja kuni 16 kehtivat fakti. Üle selle lähevad vanimad ajalukku (`archived`) ja ajalugu hoiab 96 uusimat (8 pööret × 12).
  - Mudel näeb **aktiivset vaadet**: kehtivad faktid ID-dega, isikud ja fookus, mitte ajalugu.
- **Üksus korraga, mitte kõik või mitte midagi:**
  - välja jäetakse tsiteerimata fakt, olematu või juba asendatud fakti asendus ja vigane periood (siis jääb eelmine);
  - vajadus või lahtine küsimus jääb alles, kui tal on vähemalt üks kehtiv viide; välja jäetud viide on kirjas kui `reference_dropped`;
  - põhjus on kirjas `model.dropped`;
  - puuduv või vigane mudeli olek jätab eelmise mudeliosa alles (`model.accepted: false`), aga serveri osa liigub edasi;
  - **olek ei jää kunagi tervikuna maha.**
- Sama isik ja samad tsitaadid kui kehtival faktil ei tee uut fakti; viide sellele lahendub olemasolevale ID-le.

### Kohtade kuuluvus otsinguplaanist (`search-assist-4`, `person-places.js`)

- Plaan nimetab **iga praeguses sõnumis nimetatud koha** kohta:
  - tsitaadi, täpselt nagu sõnumis;
  - isiku (`user`, teadaolev silt või uus silt kasutaja sõnadega);
  - seose: `lives`, `not` või `other`.
- Kui abivajaja elab koos isikuga, kelle koha sõnum annab, või tema naabruses (pereliige, naaber, naabri laps), saab ta sama koha. Mujal elav sugulane seda ei saa.
- Plaan nimetab ka **abivajaja** (`person`) vabatekstina, nii et uus inimene saab kohe oma sildi.
- **Järelejõudmine:** plaan loeb kohti kõigist sõnumitest, mida salvestatud olek pole näinud (`place_messages`).
  - Tavaliselt on see ainult praegune sõnum.
  - Pärast pööret, mille olek jäi salvestamata (näiteks vastus lükati tagasi), jõuavad ka selle pöörde sõnumi kohad järgmisse olekusse.
  - Iga koht saab selle sõnumi numbri, kust tsitaat pärineb. Hilisem sõnum võidab, ka siis, kui see ütleb, et isik seal enam ei ela.
- **Server võtab ainult selle, mida sõnum ise näitab:**
  - tsitaat on sõnumi tekst ja nimetab ühe omavalitsuse;
  - lause tsitaadi ümber otsustab eituse. „Minu elukoht ei ole Kose vald“ ei ole elukoht, ükskõik mida plaan ütleb;
  - `lives` seab isiku omavalitsuse, `not` kustutab selle, kui see on sama.
- **Sama lugemine kataloogile ja olekule:**
  - kataloogi valib `placeScope`: abivajaja koht sõnumist, siis tema teadaolev omavalitsus, muidu ei midagi;
  - oleku `people` ja `focus` tulevad samast lugemisest, mitte vastusemudelist.
- **Endine resolver jääb varuks:**
  - plaan ei oska öelda (`unclear`);
  - plaan ei andnud ühtegi kohta, kuigi sõnum nimetab kohta (siis võidab mainimine nagu varem).
- Taastamine kordab projektsiooni: plaani kontrollitud kohad ja isik on pöördes salvestatud (`searchAssist.places`, `.person`).

### Prompt ja leping

- Dialoogi prompt `m4-grounded-dialogue-16` annab v4 juhised; isikud ja fookus on mudelile ainult lugemiseks.
- Plaani leping nõuab olekut v4. v2 ja v3 plaanid jäävad ainult loetavaks. Väljalase uuendab plaani ise (ADR-037).
- **Hindaja** (F5):
  - `state_region`, `person_regions`, `person` ja `state_kept`;
  - iga raport loendab jätkupöörded ja tagasi lükatud olekud;
  - v4-s on „tagasi lükatud“ puuduv mudeli olek.

## Piirid

- **Kuuluvus on endiselt mudeli tõlgendus**, nüüd ühe sihitud küsimusena plaanis ja sama nii kataloogile kui olekule. Tsitaadi ja eituse kontroll on deterministlik, aga isiku valik mitte. Kui plaan omistab ema lause kasutajale, saab kasutaja ema omavalitsuse. Vale kuuluvus tuleb nüüd plaanist, mitte vastusemudelist, ja see on näha pöörde `searchAssist.places` väljal.
- Kui plaan ei anna kohti, otsustab endine resolver, kus kehtib „mainimine võidab“.
- Arhiveeritud fakte mudel enam ei näe. Vestluse ulatus on 8 pööret, seega mõjutab see ainult väga tihedaid vestlusi.
- Semantiline graaf (Codex F6) jääb eraldi tööks.

## Kontroll

- `tests/rag-v2-dialogue-state-4.test.mjs`:
  - ID-d, parandus ja tagasivõtmine;
  - üksikute osade väljajätmine koos põhjusega, puuduv mudeli olek, kordusfakt;
  - 8 × 12 fakti: 16 kehtivat, ajalugu ≤ 96, väljajätmisi pole;
  - osaliselt kehtivate viidetega vajadus jääb alles;
  - v4 projektsioon ja eelmise oleku ahel;
  - kohtade kontroll: tsitaat, üks omavalitsus, eitus lausest;
  - Codexi juhtumid kataloogi ulatuses;
  - järelejõudmine: salvestamata pöörde kohad, hilisem sõnum võidab.
- `tests/rag-v2-dialogue-store.test.mjs` (päris andmebaas): kolm v4 pööret teenuse kaudu. Mudel näeb aktiivset vaadet ID-dega ja vigane mudeli olek jätab faktid alles.
- `tests/rag-v2-search-assist.test.mjs`: plaani `people`, vabateksti isik ja `places`.
- `tests/rag-v2-dialogue-config.test.mjs`: v4 käivitub, v2 ja v3 on ainult loetavad.
- Serveris enne PR-i: sihtkataloogid ja kataloog v4 aktiveerimata plaaniga (tulemused allpool).
