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
- **Paragrahvi number tekstis, mis hoiab ülaindekseid** (lisatud pärast v39 indeksit):
  - Ristviidete lugeja (ADR-055) pidas paljast „§ 131“ mitmetähenduslikuks, kui aktis on ka § 13¹. Vanas tekstis võis see olla § 13¹, mille ülaindeks kadus.
  - v28 tekstis ülaindeks ei kao, seega „§ 131“ on ainult § 131.
  - `keepsSuperscripts(version)` on tõene Riigi Teataja XML-i versioonil, mille töötlus on `source-structure-v28` või uuem. Siis loeb lugeja palja numbri täpselt (`exactNumbers`); vanemas tekstis jääb kehtima vana reegel.
  - Vestluse ristviited (profiil v3) annavad selle iga dokumendi versiooni järgi.
  - **Kohalik v39 korpus:** `section_ambiguous` 211 (v38 tekst) → 151 (v39 tekst) → 0. Need 151 on nüüd viited, näiteks SHS § 131 lg 7 ja 8 (perekonnaliikmed), § 133 lg 5 ja § 151 (tegevusluba vajavad teenused). Kontrollitud valimis olid kõik sihid õiged, ja ükski varasem viide ei muutunud. 7510-st tükist 6133 on versioonides, mis hoiavad ülaindekseid.

### Codexi järelülevaade 30.09: R3 ([Codexi järelülevaade 30.09](../audits/rag-v2-pr264-272-review-2026-09-30.md))

- v28 luges ülaindeksi numbrit ainult siis, kui see oli `<sup>`-elemendi ainus tekstilaps või CDATA-s täpselt `<sup>1</sup>`. `<sup><![CDATA[1]]></sup>`, `<sup><b>1</b></sup>` ja CDATA-s `<sup class="number">1</sup>` said tavalisteks numbriteks („§ 131“ § 13¹ asemel), ja täpsete numbritega lugeja valis siis kindlalt vale paragrahvi.
- **`source-structure-v29`** loeb ülaindeksi kogu teksti: CDATA, sisemine element, atribuudid. Numbritest erinev sisu („1a“) jääb tekstiks ega saa viiteks.
- **Kõik 134 registreeritud XML-allikat andsid v28 ja v29 all sama teksti** (132 identset, 2 tühja akti ebaõnnestuvad nagu enne), seega korpuses neid kujusid pole ja v39 versioonid jäävad õigeks. Uut korpust pole vaja.
- `keepsSuperscripts` ei usalda enam numbrit `>= 28`. Töötlused on nimetatud ükshaaval (`SUPERSCRIPT_NORMALIZATIONS`: v28 korpuse kontrolli ja v29 lugeja põhjal), ja test nõuab, et praegune töötlus oleks loendis. Uus töötlus ei pääse läbi ilma selle otsuseta.

## Piirid

- Töötlusest väljas: omavalitsuste aktide lisade tekstid (ADR-053) tulevad teisest adapterist (`rt-annex.js`) ega muutu.
- Muud kui numbrilised `<sup>`-elemendid jäävad tavatekstiks.
- Registris kaks korda olevad aktid (`X.xml` ja `X-<räsi>.xml`) jäävad nagu olid; aktiivne versioon tuleb failist, mille räsi korpus kasutab.

## Kontroll

- `tests/rag-v2-source-structure.test.mjs`: CDATA ja XML-elemendi ülaindeks, tühik elemendi sees.
- Kaardi- ja registritestid läbivad (74/74).
- Serveri mõõtmine (indeks, vestluse plaan, kataloogid) on kirjas allpool pärast korpuse v39 indeksit.

### Tulemused serveris (30.09.2026)

- **Korpus v39** (`run-v39.sh`):
  - 216 uut embeddingu sisendit (127 245 tokenit, 0,0165 USD plaani hinnaga); ülejäänud sisendid tulid varasematest ostudest;
  - indeks `8cfac9f3` valmis 1 min 54 s-ga: 54 dokumenti ja nende 6133 tükki indekseeriti uuesti, 5983 dokumenti võeti v38-st üle;
  - v38 tõendid (tükiread, pitserid, punktid) jäid samaks;
  - vestluse uus plaan `m4-corpus-chat-20260930a.json` profiiliga `hybrid-estnltk-chat-v3` (ADR-057) on aktiivne.
- **Otsingukatse** (ADR-057 jooksja, rerankita, ilma mudelikutseteta) v39 peal andis mõlemas kataloogis sama tulemuse mis v38 peal: esimene kataloog A 3/9, B 4/9, C 5/9, D 7/9, E 3/9; teine kataloog kõigil 5/6. Ülaindeksid ei muutnud nende küsimuste otsingut.
- **Täpsed paragrahvinumbrid** otsingukatses: haru D leidis samad 7/9. Ta lisas kahel toimetulekutoetuse küsimusel ka § 133 (toetuse arvestamine), mis enne jäi mitmetähenduslikuna välja. Kontekst kasvas keskmiselt 203 tokenit esimeses kataloogis ja 305 tokenit teises.
- **Vestluse täisahel** (aktiveerimata plaanid v39 peal: tootmiskood koos prompt 19-ga ja sama koos täpsete numbritega; vastus voogesitatud):

| Kataloog | Tootmiskood | Täpsed numbrid |
|---|---:|---:|
| Rasked tingimused 1 | 9/9 | 9/9 |
| Rasked tingimused 2 | 5/6 (parandatud 6/6*) | 6/6 |
| Kataloog v4 | 39/40** | 40/40 |

- \* Ainus viga oli õige vastus „ei võeta su palka … üldse arvesse“, mida muster ei tundnud; muster on laiendatud (ADR-057).
- \*\* Kuuldeaparaadi vastus andis õiged summad („piirmäär 350 eurot, riigi osa kuni 315 eurot“), aga kataloog ootab sõna „piirhind“.
