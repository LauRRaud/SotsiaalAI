# ADR-056 — Riigi Teataja ülaindeks sisutekstis loetakse nii, nagu akt seda tsiteerib

30.09.2026. Teostus Claude Opus 5.5. Viga leiti ristviidete lugeja korpusekontrollis (ADR-055, J5). Omanik 30.09: „tee arendustööd edasi“.

## Probleem

- Riigi Teataja XML-i sisutekstis on paragrahvi ülaindeks XML-element: `käesoleva seaduse § 45<sup>9</sup> lõike 1`.
- `text-source.js` teisendas ainult CDATA sees tekstina kirjutatud `<sup>`-i (ADR-034). XML-elemendi numbrid liitusid paragrahvi numbriga, ja tükk luges „§ 459“.
- „§ 459“ on teine paragrahv. Vale number jõudis tükkidesse ja otsingusse. Vastusemudel näeb vale viidet ega saa seda tsiteerides parandada.
- Kohaliku korpuse 134 registreeritud XML-allikast muutus 80 teksti. Neist 54 on aktiivses korpuses; 16 on registris ülevaatamata (`version_and_jurisdiction_validation_pending`) ja 10 on sama akti teine fail.
- Ristviidete lugeja jättis sellised numbrid põhjendatult lahendamata (`section_ambiguous`: 211 korda), sest „459“ võis olla § 45⁹ või § 459.

## Otsus

- `<sup>`-element, mille sisu on ainult numbrid, loetakse ülaindeksi numbriteks: „§ 45⁹“, „§ 45¹⁶“, „§ 34⁸“. Muu sisuga element jääb tavatekstiks.
- Tühik elemendi sees („§ 22<sup>1 </sup>lõikes“) on sõnade vahe ja jääb alles: „§ 22¹ lõikes“.
- Töötlussilt `source-structure-v27` → `v28`; töötluse sõrmejälg on kirjutatud uuesti.
- **Kontroll:** 134 XML-allikat vana ja uue koodiga. 80 teksti erineb ainult ülaindeksi numbrite poolest, 52 on identsed ja 2 tühja akti ebaõnnestuvad nagu enne.
- **Teadmiskaardid** (ADR-054) tsiteerivad allikat täpselt.
  - Viies kaardifailis luges 62 tsitaati „§ 348“, kus allikas nüüd loeb „§ 34⁸“. Asukoht ja pikkus on samad.
  - `scripts/rag-v2-knowledge-reanchor.mjs` loeb iga ankru tsitaadi uuesti sealt, kuhu ankur osutab, nii nagu praegune töötlus allikat loeb.
  - Skript lubab ainult ülaindeksi numbrite erinevust; muu erinevus peatab selle.
  - Ümberseos on kirjas kaardi ettevalmistuse kirjes (`preparation.reanchored`), ja failide räsid on uuendatud `REGISTER.json`-is.
  - Teine käivitus ei muuda midagi.
- **Korpus v39:**
  - 54 aktiivset akti said uue versiooni (sisestusrühm `ingest_batch_93c75134…`, allikapõlvkond `generation_961c427c…`).
  - Iga uue versiooni tükid erinevad aktiivsest versioonist ainult ülaindeksi numbrite poolest: 542 tükki, samad otsingutekstid peale ülaindeksite. Muid muutusi pole.
  - Embedding ostetakse ainult muutunud sisenditele (korduvkasutus nagu v27-s).

## Piirid

- Töötlusest väljas: omavalitsuste aktide lisade tekstid (ADR-053) tulevad teisest adapterist (`rt-annex.js`) ega muutu.
- Muud kui numbrilised `<sup>`-elemendid jäävad tavatekstiks.
- Registris kaks korda olevad aktid (`X.xml` ja `X-<räsi>.xml`) jäävad nagu olid; aktiivne versioon tuleb failist, mille räsi korpus kasutab.

## Kontroll

- `tests/rag-v2-source-structure.test.mjs`: CDATA ja XML-elemendi ülaindeks, tühik elemendi sees.
- Kaardi- ja registritestid läbivad (74/74).
- Serveri mõõtmine (indeks, vestluse plaan, kataloogid) on kirjas allpool pärast korpuse v39 indeksit.

### Tulemused serveris

(täidetakse pärast v39 indeksit)
