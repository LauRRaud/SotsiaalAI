# ADR-084 — Codexi ülevaatus #357–#364: plaani päringuid ei jäeta sõnade järgi välja; „minu vallas“ on inimese oma vald

04.10.2026. Teostus Claude Opus 5.5. Lähtekoht: Codexi sõltumatu ülevaatus (`docs/audits/rag-v2-pr357-364-review-2026-10-04.md` põhikaustas, omaniku edastatud), kaks P2 leidu. Mõlemad kordasin enne parandamist Codexi sondidega (4/4).

**Mõõtmata mudeliga.** Mõlemad vead ja parandused on serveri reeglites ja deterministlikud; tõend on kohalikud testid Codexi sondide sisenditega. Tasulisi jookse ei tehtud.

## F1 — sõnade kattumise järgi jäeti välja vajalik päring ([ADR-080](adr-080-one-query-per-message.md))

- **Viga:** „Mul on raske liikumispuue ja vajan eluruumi kohandamist.“ ja siis „Millist rahalist abi saan taotleda?“. Plaan kirjutas ühe päringu kummagi sõnumi kohta; ADR-080 reegel jättis esimese („Liikumispuudega inimese eluruumi kohandamise toetus“) välja. Otsingutekst on [ADR-078](adr-078-search-text-is-the-current-message.md) järgi ainult praegune sõnum, nii et otsingusse ei jäänud ühtegi sõna puudest ega kohandamisest.
- **Miks reegel ei pea:** päringute arv, järjekord ja sõnade kattumine ei tõenda, et varasema sõnumi päring praegust palvet ei toeta. Varasem sõnum võib olla olukorra kirjeldus, mille peal praegune küsimus seisab.
- **Otsus: reegel on tagasi võetud.** Server ei jäta plaani päringuid välja; `currentMessageQueries` ja kirje väli `droppedQueries` on eemaldatud.
- **Mis jääb vastatud küsimuste vastu:** plaani juhis (search-assist-7 ja -8) ja eelvalik, mis loeb vestlust ja lõike ega hoia juba vastatud küsimuste lõike (mõõdetud neljas jooksus). Otsustus, milline lõik praegust palvet teenib, on eelvaliku teha.
- **Tagajärg:** viie sidumata küsimuse vestluse kolmas pööre võib jälle saada päringu igale sõnumile (neljas jooksus viiest sai). See raiskab otsingut ja kataloogi kontroll `plan_queries_must_not` märgib selle; vastus oli neis jooksudes teemakohane.

## F2 — „minu vallas“ otsiti eelmise küsimuse vallast ([ADR-081](adr-081-follow-up-without-a-named-municipality.md))

- **Viga:** elukoht Nõo vald, eelmine küsimus Maardu kohta, siis „Kas see teenus on ka minu vallas olemas?“ ja plaani päring ilma valla nimeta. Otsing jäi Maardusse. „See“ viitab teenusele; „minu vallas“ ütleb, kus küsitakse.
- **Otsus:** sõnum, mis nimetab valda üldsõnaga (vald, linn, omavalitsus, elukoht, kodukoht jt; inglise ja vene vasted), ei ole küsitud valla jätk. Otsing läheb inimese oma valda, olenemata sellest, mida plaani päringud nimetavad. Elukohata inimesel ei valita valda (vastus küsib).
  - Eesti sõnad loetakse algvormi järgi (nagu valdade nimed), nii et „vallas“, „omavalitsuses“, „elukohas“ sobivad.
  - Loetakse ainult sõnumit, mitte plaani päringuid: päring võib öelda „kohaliku omavalitsuse kehtestatud tasu“ ka Maardu jätkuküsimuses.
- **Mis jääb:** „Ja mis see maksab?“, „Kuidas ma seda taotleda saan?“ jätkuvad küsitud vallas, ka ilma valla nimeta plaaniga (ADR-081).

### Teostus

- `lib/rag-v2/pilot/search-assist.js`, `service.js`, `scripts/rag-v2-conversation-eval.mjs`: ADR-080 reegel eemaldatud.
- `lib/rag-v2/pilot/record-scope.js`: `namesPlaceByCommonWord`; `person-places.js`: mõlemad jätkuharud kontrollivad seda.
- Juhiseid ja versioone ei muudetud.

## Kontrollid

- `tests/rag-v2-dialogue-store.test.mjs` (päris hoidla, teenuse kaudu): Codexi F1 vestlus, mõlemad päringud jäävad ja kohandamine on otsingus; päring iga sõnumi kohta otsitakse tervena.
- `tests/rag-v2-question-region.test.mjs`: Codexi F2 sõnum viie plaaniga (ka Maardut nimetavaga) läheb Nõo valda; eesti, inglise ja vene sõnastus; elukohata inimene; tavalised jätkud jäävad Maardusse.
- Codexi sondifail impordib eemaldatud funktsiooni ega käivitu enam; selle F1 ja F2 sisendid on nüüd nendes testides.

## Piirid

- **„Kas siin ka on?“, „Aga minu juures?“** ei nimeta valda üldsõnaga; need sõltuvad endiselt plaanist (jätkuvad küsitud vallas, kui plaan valda ei nimeta).
- Küsimus valdade kohta üldiselt („Kas see on teistes linnades ka nii?“) otsitakse inimese oma vallast.
- Kui plaan kirjutab ainult ühe üldise päringu ja jätab olukorra välja, on otsingutekst ikka ainult praegune sõnum (ADR-078). See on plaani viga, mida server ei paranda.
