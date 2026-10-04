# ADR-081 — Tagasi viitav jätkuküsimus jääb küsitud valda ka siis, kui plaan valda ei nimeta

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10 õhtul: „sa toimeta edasi, kuni vigu ei ole. võid teha teste, raha pole probleem.“ Lähtekoht: [ADR-080](adr-080-one-query-per-message.md) mõõtmine; täiendab [ADR-074](adr-074-question-region-not-residence.md).

**Mõõtmata selle kirjutamise hetkel.** Tõend on kohalikud testid mõõdetud plaaniga. Mõõtmise tulemus lisatakse jaotisesse „Mõõtmine“.

## Probleem

Vestlus: „Elan Nõo vallas …“, „Kas Maardus saab isikliku abistaja teenust?“, „Ja mis see maksab?“.

- ADR-074 reegel: jätkuküsimus jääb küsitud valda (Maardu), kui sõnum ise valda ei nimeta, on sama inimese kohta **ja plaani päringud nimetavad seda valda**.
- Kolmes jooksus plaan nimetas („Maardu isikliku abistaja teenuse tasu …“). Neljandas kirjutas plaan ühe päringu ilma vallata: „Isikliku abistaja teenuse tasu kujunemine inimese omaosalus“. Otsing läks Nõo valda ja vastus ütles, et Maardu tasu ta öelda ei saa.
- search-assist-8 järel kirjutab plaan enamasti ühe päringu ja kulude reegel suunab selle üldisse sõnastusse. Reegel, mis sõltub sellest, kas mudel valla nime kordab, on habras.
- Sama auk oli inimesel, kes elukohta pole öelnud: esimese küsimuse vald tuli plaani päringust, jätkuküsimusele ilma valla nimeta ei jäänud ühtegi valda.

## Otsus

Serveri reegel; juhiseid ja versioone ei muudetud.

1. **Elukoht teada.** Kui sõnum viitab tagasi („see“, „seda“, „sealt“; sama sõnaloend mis ADR-074-s) ja plaani päringud ei nimeta ühtegi valda, jätkub otsing vallas, mille kohta eelmine vastus küsiti.
2. **Elukoht teadmata.** Sama: tagasi viitav sõnum, mis ise valda ei nimeta ja on sama inimese kohta, otsitakse vallas, kus otsiti eelmist küsimust. Olek on `continued_region` (mitme kandidaadi korral `continued_regions`); kellegi elukohaks seda ei salvestata.
3. **Plaan saab otsingu endiselt mujale viia:** kui päring nimetab inimese oma valda või kolmandat valda, kehtib senine reegel (otsing läheb inimese juurde või plaani nimetatud valda).
4. **Muu jääb samaks:** sõnum, mis tagasi ei viita („Aga millist koduteenust ma ise saan?“, „Ja kuidas taotleda?“), vajab jätkamiseks endiselt päringut, mis küsitud valda nimetab. Teise inimese palve ei ole kunagi selle küsimuse jätk. Sõnum, mis ise valda nimetab, loetakse iseseisvalt.

### Teostus

- `lib/rag-v2/pilot/person-places.js`: `queriedAmong` ütleb, kas päringud üldse mõnda valda nimetavad; `questionRegionScope` jätkab tagasi viitava sõnumi puhul ka siis, kui ei nimeta; uus `continuedRegionScope` elukohata inimese jaoks; `askedRegions` ja `askedPerson` annavad edasi ka plaani päringust või eelmisest küsimusest tulnud valla.

## Kontrollid

- `tests/rag-v2-question-region.test.mjs`: mõõdetud plaan jääb Maardusse; ka ilma ühegi päringuta (ebaõnnestunud plaan), minavormis, inglise ja vene keeles; järgmine jätk jätkub; plaan, mis nimetab Nõo või Viimsi valda, viib otsingu ära; tagasi mitteviitav sõnum ja teise inimese palve ei jätku; kaks küsitud valda jäävad mõlemad. Elukohata inimese samad juhud.
- `tests/rag-v2-dialogue-store.test.mjs` (päris hoidla, teenuse kaudu): mõlemad harud ühes vestluses.

## Piirid

- **„Kas see teenus on ka minu vallas olemas?“** viitab tagasi ja ei nimeta valda nimepidi. Kui plaan kirjutab päringu Nõo valla nimega, läheb otsing Nõo valda (nagu enne). Kui plaan valla nime ei kirjuta, jääb otsing nüüd Maardusse. Vastus nimetab valda, mille allikatest ta räägib, nii et viga on nähtav; mõõdetud see juht ei ole.
- Tagasiviite loend on sõnaloend (eesti, inglise, vene); muu sõnastusega jätk („Ja kuidas taotleda?“) sõltub endiselt plaanist.

## Mõõtmine

Tegemata selle kirjutamise hetkel; lisatakse pärast jooksu.
