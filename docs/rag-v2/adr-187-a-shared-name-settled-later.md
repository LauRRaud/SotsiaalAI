# ADR-187: hilisem plaan võib lahtiseks jäänud jagatud nime otsustada

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 küsimusele „Kas parandan järgmisena ka selle, et hilisem täpsem omavalitsuse nimi („Tartu linn“) asendaks vestluses varasema kahemõttelise „Tartu“?“: „jah“.

## Probleem

F9 (23.10, väljalase `616f16fb`), pöörduja vestlus A01 → A02 → A04:

- **A01:** „Mu 81-aastane ema elab Tartus üksi … Ma elan Tallinnas …“. Plaan andis ema kohale nime „Tartu“. „Tartus“ on kahe omavalitsuse nimi (Tartu linn ja Tartu vald), seega jäi ema koht lahtiseks (`quote_names_several_places`, olek `unresolved`, skoop `region_required`) ja vastus küsis, kumb.
- **A02 ja A04:** plaan andis sama lause kohta nime „Tartu linn“. Server jättis selle välja, sest sõnum 1 oli olekul juba loetud (`places: []`). Ema jäi ilma omavalitsuseta ja A04 vastus ei leidnud Tartu hooldajatoetuse tingimusi.
- **F4, F5 ja F7:** plaan andis kohe esimeses pöördes „Tartu linn“ ning ema sai Tartu linna kohe. Tulemus sõltus seega sellest, mida plaan esimeses pöördes juhtus kirjutama.

## Otsus

`checkedTurnPlaces` (`lib/rag-v2/pilot/person-places.js`) loeb olekul loetud sõnumit uuesti ainult ühel juhul:

- salvestatud olek jättis selle isiku elukoha just selles sõnumis lahtiseks (`unresolved`, ilma omavalitsuseta, tugi selles sõnumis);
- plaani koht on sama isiku elukoht (`lives`) ja tema lause on selles sõnumis;
- lause nimi on mitme omavalitsuse oma ja plaani nimi valib neist täpselt ühe.

Samad kontrollid mis lugemata sõnumile:

- koht on lauses üks kord;
- lause ei ole kasutaja enda oma;
- lause ei eita (eitav lause jääb välja).

Siis saab isik selle omavalitsuse sama sõnumi toel (`reason: shared_name_settled_later`). Kõik muu loetud sõnumist jääb nii, nagu olek selle salvestas: juba teadaolevat elukohta hilisem plaan ei muuda.

## Kontroll

**Kordus ilma mudelikutseteta** (päris omavalitsuste kataloog ja EstNLTK, F9 lause ja plaani kohad; väljalase vs overlay):

| Juhtum | Väljalase | Muudatusega |
|---|---|---|
| A01, plaan „Tartu“ | lahtine | lahtine |
| A02, plaan „Tartu linn“ | lahtine | Tartu linn (`person_region`) |
| A02, plaan „Tartu vald“ | lahtine | Tartu vald |
| A02, plaan jälle „Tartu“ | lahtine | lahtine |
| Esimene plaan „Tartu linn“, hiljem „Tartu vald“ | Tartu linn | Tartu linn |

Pärast deploy'd: pöörduja vestlused A (A01, A02, A04) ja C (C01, C10).
