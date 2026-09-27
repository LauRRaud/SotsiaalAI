# ADR-036 — Muudatusepõhine indekseerimine: indeksiread kuuluvad dokumendiversioonile

27.09.2026. Teostus Claude Opus 5.5. Omaniku soov: „neid dokumente tuleb ehk sadu veel juurde, see oleks tohutu ajakadu“. Lahenduse kuju ja vastuvõtutingimused on kokku lepitud omaniku ja Codexiga samal päeval.

## Probleem

Iga uus korpus (v25–v29) ehitati täisindeksina, ka siis, kui muutus kaks dokumenti.
- Igal indeksipõlvkonnal olid oma tekstiosade read (`rag_v2_unit`, võti põlvkond + tekstiosa) ja oma Qdranti kollektsioon (`collectionName(tenant, põlvkond)`).
- `runIndexJob` kirjutas iga dokumendi uuesti: bundle'i objektid ükshaaval, tekstiosad ükshaaval, morfoloogia EstNLTK-ga, vektorid vahemälust, punktid Qdranti.
- Lõppkontroll luges kõik dokumendid uuesti läbi ja analüüsis kogu salvestatud morfoloogia teist korda.
- v29 (6000 dokumenti, 29 716 tekstiosa) ehitus kestis 43,5 minutit (~935 tekstiosa minutis), kuigi uusi tekstiosi oli 496. Iga põlvkond võttis kettal ~1 GB.

## Otsus

Uus salvestusviis `versions-v1` (`lib/rag-v2/search/layout.js`). Vana viis `generation` jääb olemasolevatele põlvkondadele ja on endiselt loetav.

- **Tekstiosa ja punkt kuuluvad dokumendiversioonile ja otsinguseadistusele.**
  - Tekstiosa ID sisaldas juba varem versiooni ID-d, nii et uued võtmed on (tenant, seadistus, tekstiosa).
  - `rag_v2_version_unit` hoiab tekstiosa ridu koos morfoloogiaga. Qdrantis on üks kollektsioon tenant'i ja seadistuse kohta (`versionCollectionName`).
  - Punkti payload'is pole põlvkonda. Päring filtreerib põlvkonna versioonide järgi ja kontrollib iga tulemuse versiooni põlvkonna hetkeseisu vastu.
- **Põlvkond on nimekiri.** Snapshot ja `rag_v2_generation_document` read (versioon ja kataloogirida) ütlevad, milliseid versioone põlvkond teenindab.
  - Lugemisteed (`units`, `lexical`, `canonicalReferences`, Qdranti `query`) valivad salvestusviisi põlvkonna järgi.
  - Põlvkonna identiteet sisaldab salvestusviisi (`generationIdentity`), nii et sama allikas ja seadistus võivad olla mõlemas.
- **Versiooni valmimismärk** (`rag_v2_version_index`): plaani kirje (bundle'i ja tekstiosade räsid, arv), kataloogirida ja salvestatud morfoloogia räsi. Olek `staged` → `ready`.
- **Töö** (`runIndexJob`, `scripts/rag-v2-index-batch.mjs --layout versions-v1`, vaikimisi):
  - Kui järjest tulevad versioonid on selle seadistusega juba valmis, lisatakse need uue põlvkonna nimekirja ühe lausega (kuni 1000 dokumenti). Nende teksti, morfoloogiat ega vektoreid ei loeta ega kirjutata.
  - Uus või muutunud versioon töödeldakse nagu varem, aga objektid ja tekstiosad kirjutatakse koondpäringutega (500 rida lause kohta, `jsonb_to_recordset`).
  - Morfoloogia analüüsitakse üks kord ja selle räsi pannakse kirja. Valmimisel võrreldakse salvestatud ridu plaani räside ja morfoloogia räsiga; teist analüüsi ei tehta.
  - Valmimisel kontrollitakse veel bundle'it, kataloogirida ja allikaobjekte nii, nagu vestlus neid loeb. Enne taaskäivitust kirjutatud punktid võrreldakse uuesti salvestatud vektoritega.
  - Plaan (`--mode plan`) küsib andmebaasist valmis versioonid ega loe neid hoidlast. Väljund näitab `documents_to_index` ja `units_to_index`.
- **Avaldamine on endiselt terviklik.** Põlvkond muutub aktiivseks alles siis, kui kõik plaani versioonid on valmis. Aktiveerimisel kontrollitakse:
  - nimekiri vastab plaanile, iga versioon on `ready` sama plaani kirjega ja sama kataloogireaga;
  - tekstiosade arv ja Qdranti punktide arv (põlvkonna versioonide filtriga) on plaanis kirjas olev.
  Seni teenindab otsingut eelmine põlvkond; üks otsing kasutab läbivalt ühte põlvkonda.
- **Terve korpuse põhjalik kontroll on eraldi hooldustöö:** `--mode verify` (`verifyIndexJob`). See loeb iga dokumendi hoidlast, analüüsib morfoloogia uuesti ja võrdleb iga punkti salvestatud vektoriga. Midagi ei avalda.

Muutmata:
- lugemisaegsed kontrollid (bundle'i räsi, allikaobjektid, tekstiosa veerud, morfoloogia uus analüüs üks kord protsessis);
- ligipääsu kontroll igal otsingul (poliitika);
- vestlusplaani seotus põlvkonnaga (plaan tuleb uue põlvkonna järel ümber ehitada, nagu enne).

## Mida see tähendab

| Muudatus | Töö |
|---|---|
| Lisad N dokumenti | N dokumendi töötlus; ülejäänud versioonid nimekirja |
| Sama fail uuesti | Sama versiooni ID, valmis versioon, töötlust pole |
| Dokument muutub | Uus versioon töödeldakse; vana jääb varasematele põlvkondadele |
| Dokument eemaldatakse | Nimekirjast välja; töötlust pole, uus põlvkond seda ei leia |
| Embedding-mudel, leksikaalne seadistus või kataloogiskeem muutub | Uus seadistus, uus kollektsioon ja täisehitus (nagu enne) |

Õiguste muutus annab dokumendile uue versiooni ID. See versioon töödeldakse uuesti, kuid vektorid tulevad vahemälust või ostetud kataloogist ja uusi ei osteta.

## Kontroll

- `tests/rag-v2-version-index.integration.test.mjs` (päris Postgres, Qdrant ja EstNLTK):
  - kahe dokumendi lisamine töötleb ainult neid; varasemate ridade reaversioonid ja punktide payload'id ei muutu; otsing leiab uued, eelmine põlvkond mitte;
  - eemaldamine: üks nimekirja lause, töötlust pole, uus põlvkond dokumenti ei leia;
  - muutunud dokument: kumbki põlvkond loeb ainult oma versiooni;
  - taaskäivituse järel muudetud punkt peatab valmimise; erinev valmimismärk peatab töö; `verify` leiab muudetud morfoloogia;
  - CLI: plaan näitab ainult töödeldavaid dokumente.
- Olemasolevad indekseerimistöö testid (vana salvestusviis ja CLI uuega) läbivad.

## Piirid ja järgmised sammud

- Vanade versioonide read ja punktid jäävad jagatud tabelisse ja kollektsiooni, kuni koristus need eemaldab. Koristus (versioonid, mida ükski säilitatav põlvkond ei loetle) on tegemata ja vajab omaniku nõusolekut, nagu vanade põlvkondade kustutamine.
- Valmis versioonidele jäävad lugemisaegsed kontrollid. Täielik kontroll on `--mode verify`; seda tasub käivitada hooldustööna.
- Vestlus võtab uue põlvkonna kasutusse alles plaani ümberehituse ja taaskäivitusega (järgmine etapp).
- Lisamise automaatne taustatöö on eraldi etapp. Sisestuse ülevaatus ja embeddingu kulu kinnitus jäävad inimese otsustada.
- Esimene `versions-v1` põlvkond ehitatakse serveris üks kord täies mahus. Kiirus mõõdetakse siis ja kantakse siia.
