# ADR-168 — Kasutaja enda omavalitsus ei vasta teise inimese ega teise omavalitsuse küsimusele

22.10.2026. Teostus Claude Opus 5.5. Omaniku reegel: „kui vestluses uurin mingi teise KOV või teise inimese kohta, siis ei
tohi mu enda KOV profiil mõjutada vastuse andmist“.

## Mis juba nii oli

- **Igal inimesel on oma omavalitsus** (dialoogi olek v5).
  - Ema küsimus otsitakse ema omavalitsusest.
  - Kui ema oma pole öeldud, ei otsita kasutaja omavalitsusest.
- **Küsimuses nimetatud omavalitsus** („Kas Maardus saab …?“) on pöörde allikaulatus ega muuda kellegi kodu (ADR-074).
- **ADR-167:**
  - kasutaja enda mainimine ei kustuta tema kodu;
  - mainimine, mille kandidaat on inimese enda omavalitsus, ei tee küsimust teisest sama nimega omavalitsusest.

## Leid: kaks kohta, kus kasutaja omavalitsus võis siiski teise küsimusse minna

1. **Plaani päringud.**
   - Kui küsimuse inimesel omavalitsust pole, loeb server selle plaani päringutest (`knowledgeRegionScope`).
   - Päring võis kasutaja enda omavalitsuse teise inimese palvesse kaasa viia. Näiteks „Elan Harku vallas. Mu ema vajab
     igapäevaelus abi.“ ja päring Harku valla koduteenusest. Siis otsiti ema küsimusele Harku vallast.
2. **Küsitud omavalitsus vajas plaani nõusolekut.**
   - ADR-074 võtab küsitud omavalitsuse ainult siis, kui plaani päringud seda nimetavad.
   - Kui päringud ei nimetanud ühtegi omavalitsust, jäi „Kas Maardus saab …?“ inimese oma omavalitsusse (Nõo vald).

## Otsus

- **Päring ei anna kasutaja omavalitsust teisele inimesele** (`othersOwnRegion`).
  - Kehtib siis, kui küsimuse inimene ei ole kasutaja ja päringust loetud omavalitsus on kasutaja enda oma. Kasutaja oma
    on dialoogi oleku ja selle pöörde kontrollitud kohtade järgi (`userOwnRegions`).
  - Sellist päringut arvesse ei võeta. Pöördel pole omavalitsust ja vastus küsib seda, kui see on vajalik.
  - Kehtima jääb:
    - kui praegune sõnum nimetab selle omavalitsuse sellele inimesele („Kas ema saab Harku vallas …?“);
    - kasutaja enda küsimustes.
- **Päringud, mis ei nimeta ühtegi omavalitsust, ei vaidle vastu** (`questionRegionScope`).
  - Küsitud omavalitsus jääb kehtima.
  - Töökoht küsimuses vajab endiselt plaani päringut, nagu ADR-074 selle jättis. „Kas ma saan koduteenust kui töötan
    Maardus?“ on küsimus inimese enda abi kohta.
  - Päring, mis nimetab kolmanda omavalitsuse või ainult inimese enda oma, jätab otsingu nagu enne inimese juurde. Siis
    lähevad server ja plaan lahku. Seda juhtub harva ja see jääb piiriks.
- **Pereliige (omaniku otsus samal päeval: „Laps ja abikaasa: jah“).**
  - Pöörduja vestluses on kasutaja enda omavalitsus vaikimisi tema lapse ja abikaasa või elukaaslase oma, kui selle inimese
    omavalitsust pole öeldud (`household_region`, `interpretation: users_own_municipality_for_household_member_not_confirmed`).
    Näiteks „Mu 12-aastane poeg ei käi enam koolis“.
  - Laps ei saa seda vaikimisi kohta, kui vestlus ütleb, et ta on täiskasvanu (vanus 18 või rohkem või sõna
    „täiskasvanud“).
  - Teised inimesed (ema, isa, sõber, naaber) seda ei saa. Siis küsib vastus omavalitsust, kui see on vajalik.
  - Plaani isikusilt loetakse terve sõnana (`householdMember`). „Perearst“ ja „lastekaitsetöötaja“ ei ole pereliikmed.
    „Mees“ ja „naine“ on abikaasa ainult siis, kui see on kogu silt: „eakas naine“ on keegi teine.
  - Spetsialisti ja teenuseosutaja vestluses on laps klient. Tema vaikimisi koht on tööpiirkond (ADR-167, omaniku valik
    „Tööpiirkond eeldusena“).
- **Profiili omavalitsus**, kui see tuleb, on kasutaja enda vaikimisi koht samade reeglite järgi. Teise inimese või küsitud
  omavalitsuse asemele see ei lähe.

## Kontroll

Kohalik kontroll: 15 juhtumit ADR-167 koodiga (enne) ja uue koodiga (pärast). EstNLTK asemel on väike lemmade tabel.

| juhtum | enne | pärast |
|---|---|---|
| ema; päring nimetab kasutaja Harku valla | `search_plan_region harku_vald` | `region_required` (ema) |
| „Kas ema saab Harku vallas …?“ | `search_plan_region harku_vald` | sama |
| ema; päring nimetab Viimsi valla | `search_plan_region viimsi_vald` | sama |
| kasutaja enda küsimus | `person_region harku_vald` | sama |
| spetsialisti klient (ADR-167) | `work_region tartu_linn` | sama |
| „Kas Maardus saab …?“, päringud valda ei nimeta | `person_region noo_vald` | `question_region maardu_linn` |
| sama, päring nimetab Maardu | `question_region maardu_linn` | sama |
| sama, päring nimetab Viimsi | `person_region noo_vald` | sama |
| „Kas ma saan koduteenust kui töötan Maardus?“ | `person_region noo_vald` | sama |
| „Elan Nõo vallas, töötan Maardus; …“ (Codex F2) | `person_mentioned_region noo_vald` | sama |
| pöörduja 12-aastane poeg, päring valda ei nimeta | `region_required` | `household_region narva_linn` |
| sama, päring nimetab Narva | `search_plan_region narva_linn` | sama |
| 30-aastane poeg, päring nimetab kasutaja Narva | `search_plan_region narva_linn` | `region_required` |
| abikaasa | `region_required` | `household_region narva_linn` |
| spetsialisti klient „12-aastane poiss“ | `work_region narva_linn` | sama |

ADR-167 kontroll, `npm test` (70 läbis, 0 kukkus), ADR-154 ja 157 kontrollid läbisid.
