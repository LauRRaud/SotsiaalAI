# ADR-190: ka töökoht ühise nimega jätab mõlemad omavalitsused

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026: „see töötamine ja elamine vist jah eri asjad või siis küsida, mille kohta infot otsitakse? linna või valla“. Seis: **vestluse juhis `m4-grounded-dialogue-57`.**

## Probleem

[ADR-189](adr-189-the-users-words-choose-a-shared-name.md) jättis töökoha puutumata.

- Spetsialisti või teenuseosutaja töökohaks sai plaani oletus:
  - „Töötan Tartus sotsiaaltöötajana“ plaaniga „Tartu linn“ → töökoht Tartu linn;
  - „Oleme Tartus koduteenust osutav ettevõte“ → samuti Tartu linn.
- Kui plaan kirjutas ainult „Tartu“, ei saanud spetsialist töökohta üldse.
- Serveri enda lugemine ei tunne kõiki esimese isiku tegusõnu. „Töötan Tartus“ loeti teise inimese (kliendi) mainimiseks.

Töökoht otsustab spetsialisti küsimuses, kumma omavalitsuse korda ja kontakte vastus annab ([ADR-167](adr-167-own-mention-shared-name-and-place-of-work.md)).

## Otsus

- **Töökoha mainimine ühise nimega** (`checkedTurnPlaces`):
  - plaan otsustab, kelle töökoht see on;
  - plaan ei otsusta, kumb omavalitsus see on;
  - mainimine jääb kasutaja töökohaks mõlema kandidaadiga (`reason: shared_work_place`).
- **Kaks töökohta** (`userWorkRegions`, `workScope`). Kui kellegi koht ei otsusta skoopi, on skoop `work_regions` mõlema omavalitsusega:
  - kirjed tulevad mõlemast ([ADR-188](adr-188-a-place-name-two-municipalities-share.md));
  - mõlemad kandidaadid kanduvad järgmisse pöördesse, kuni inimese sõnad valivad.
  - Inimese vastus („Tartu linn“) jääb vestlusse meelde nagu varem ([ADR-172](adr-172-provider-area-county-and-kept-reply.md)).
- **Vastuse juhis** (`m4-grounded-dialogue-57`): kahe omavalitsuse koht võib olla kodu, töökoht või küsitud koht. Vastus küsib, kumba mõeldakse, mitte ainult seda, kus inimene elab.
- **Otsustavad inimese sõnad:**
  - „Olen Tartu linna sotsiaaltöötaja“, „Olen Viljandi valla sotsiaaltöötaja“;
  - sama sõnumi „Linn suunas meile kliendi“ — server loeb sõna „linn“ juba praegu.

## Kontroll

**Kordus ilma mudelikutseteta** (päris kataloog ja EstNLTK; väljalase `cb7a09fa` vs overlay):

| Juhtum | Väljalase | Muudatusega |
|---|---|---|
| Spetsialist „Töötan Tartus sotsiaaltöötajana“, plaan „Tartu linn“ | töökoht Tartu linn | Tartu linn + vald (`work_regions`) |
| Järgmine pööre, töökohad kantud | lahtine | Tartu linn + vald |
| „Olen Tartu linna sotsiaaltöötaja“ / „Olen Viljandi valla sotsiaaltöötaja“ | linn / vald | linn / vald |
| Spetsialist Viljandi linnas, klient „elab Viljandis“ | töökoht Viljandi linn | sama |
| Teenuseosutaja „Oleme Tartus … ettevõte.“ | Tartu linn | Tartu linn + vald |
| Sama koos lausega „Linn suunas meile kliendi.“ | Tartu linn | Tartu linn (inimese sõna „linn“) |
| „Tegutseme Viljandis võlanõustajana“ | — | Viljandi linn + vald |
| „Narva linn suunas meile kliendi“ | Narva linn | Narva linn |
