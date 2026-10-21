# ADR-157 — Kahe omavalitsuse ühise nime valib sõnumi kontrollitud koht

21.10.2026. Teostus Claude Opus 5.5. Omanik 21.10: „okei, paranda“ (parandusnimekirja punkt 18b, E7).

## Leid

Küsimus: „Milline teenuseosutaja pakub Tartus kõige paremat koduteenust?“ (juhise 46 kordustest). Vastus küsis, kas
mõeldakse Tartu linna või Tartu valda, ja linna koduteenuse kord ei tulnud paketti.

Admini jälg (`/admin/rag/chat-trace`) näitas:
- AI plaan luges „Tartus“ õigesti: koht „Tartu linn“, tsitaat „Tartus“, kontrollitud vastu sõnumit, `region:
  tartu_linn`, `relation: other`, `asking: true`;
- isik oli „user“ ja tema enda elukohta polnud teada, nii et pöörde allikapiirkond võeti plaani otsingupäringutest
  (`knowledgeRegionScope`, ADR-081);
- päring oli „Tartu koduteenus teenuseosutajad kvaliteet ja valik“. Seal sobib sõna „Tartu“ nii Tartu linna kui ka
  Tartu vallaga, ja seis jäi `search_plan_ambiguous_region`;
- kirjete rada jäi piirkonnata (`no_evidence`) ja vastus küsis kohta.

## Otsus

`plannedPlaceChoice` (`lib/rag-v2/pilot/person-places.js`) valib kandidaatide seast, kui kehtivad kõik tingimused:
- päringud jätavad ühise nime kahe või enama omavalitsuse vahele;
- sama pöörde kontrollitud kohad, mis kuuluvad selle isiku omale (või ebaselgele isikule) ega ole eitatud, osutavad
  täpselt ühele neist kandidaatidest.

Siis on pöörde allikapiirkond see omavalitsus, seisuga `search_plan_region`, nagu päringust leitud piirkonnal.

Uut omavalitsust ei lisata kunagi. Kui kohti on mitu või koht on eitatud, teise isiku oma või varasema pöörde oma, ei
valita midagi. Inimese enda piirkonna seis (`personRegionScope`) ei muutu. See on ainult allikapiirkond, mitte
elukoht.

## Kontroll

Kohalik kontroll tehti puhta funktsiooniga:
- E7 juhul valitakse `tartu_linn` ja vallaga `tartu_vald`;
- midagi ei valita, kui koht ei ole kandidaatide seas, kohti on kaks, koht on eitatud, teise isiku oma, eelmise
  pöörde oma, kohti pole või seis ei ole mitmetähenduslik;
- kandidaatidega koht ja ebaselge isik töötavad.

Testid `rag-v2-pilot-crisis-route` ja `deploy-plan-release` läbisid. Serveris kontrollitakse sama küsimusega
(eelregistreeringu lisa).
