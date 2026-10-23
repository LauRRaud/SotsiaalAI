# ADR-189: linna ja valla vahel otsustavad inimese enda sõnad, mitte plaani oletus

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026: „kas ta ei peaks küsima täpsustust kas linna või valla? või tooma vastusesse mõlema info?“

## Probleem

[ADR-188](adr-188-a-place-name-two-municipalities-share.md) andis kahe omavalitsuse ühisele nimele (Tartu, Viljandi, Võru, Rakvere) mõlema info, kuid ainult siis, kui otsinguplaan kirjutas samuti ainult „Tartu“.

- Plaan kirjutas lause „Elan Tartus“ või „ema elab Tartus“ jaoks enamasti „Tartu linn“. F4, F5, F7, F10 ja F11 jooksis tegi ta nii igas pöördes, F9-s ja F10 C-vestluses kirjutas ta „Tartu“ / „Viljandi“.
- Server võttis plaani nime vastu ja vastus eeldas linna, kuigi inimene seda ei öelnud.
- Sama oletus tuli sisse ka plaani otsingupäringust. Küsimus „Kas Tartus saab eakas koduteenust?“, millel pole teadaolevat kodu, otsiti päringu „Tartu linn …“ järgi ainult Tartu linnast.
- [ADR-187](adr-187-a-shared-name-settled-later.md) laskis hilisema pöörde plaani oletusel lahtise nime otsustada. See põhines samal oletusel.

## Otsus

- **Plaani nimi ei otsusta** (`checkedTurnPlaces`, `lib/rag-v2/pilot/person-places.js`).
  - Kui elukoha või muu mainimise lause nimetab kohta ainult kahe omavalitsuse ühise nimega (üks mainimine kahe kandidaadiga), ei vali plaani nimi nende vahel.
  - Kodu jääb kahe kandidaadiga (ADR-188: skoop `ambiguous_region`, kirjed mõlemast, vastus annab kummagi info ja küsib). Muu mainimine läheb serveri enda lugemisega, samuti kahe kandidaadiga.
  - Plaani nimi valib edasi ainult ühe lause erinevate kohtade vahel („Ma ei ela enam Kose vallas, elan nüüd Harku vallas“). Eituse ja töökoha mainimise käsitlus on endine.
- **Plaani päring ei otsusta** (`sharedNamePlanned`). Kui plaani päring nimetab ühe kahest kandidaadist, mida praegune sõnum nimetab ainult ühise nimega, jäävad mõlemad (`search_plan_ambiguous_region`).
- **Otsustavad inimese sõnad:** „Tartu linnas“, „Tartu vallas“, valla küla nimi või hilisem vastus („Ta elab Tartu linnas“).
- **ADR-187 on tagasi võetud.** Tema kood on eemaldatud.

## Kontroll

**Kordus ilma mudelikutseteta** (päris kataloog ja EstNLTK; väljalase `fd3cd4cb` vs overlay):

| Juhtum | Väljalase | Muudatusega |
|---|---|---|
| „Elan Tartus“, plaan „Tartu linn“ | Tartu linn | Tartu linn + vald |
| „Elan Tartus“, plaan „Tartu“ | Tartu linn + vald | Tartu linn + vald |
| „Elan Tartu linnas“ / „Elan Tartu vallas“ | linn / vald | linn / vald |
| „Elan Viljandis“, plaan „Viljandi linn“ | Viljandi linn | Viljandi linn + vald |
| „Elan Pärnus“ | Pärnu linn | Pärnu linn |
| Ema „elab Tartus“, plaan „Tartu linn“; järgmine pöörde plaan sama | Tartu linn | Tartu linn + vald |
| Seejärel vastus „Ta elab Tartu linnas.“ | Tartu linn | Tartu linn |
| „Kas Tartus saab eakas koduteenust?“, päring „Tartu linn …“ | ainult Tartu linn | Tartu linn + vald |
| „Ma ei ela enam Tartus“ pärast Tartu linna | eitus | eitus |

**Pärast deploy'd:** pöörduja vestlused A (A01, A02, A04) ja C (C01, C10).
