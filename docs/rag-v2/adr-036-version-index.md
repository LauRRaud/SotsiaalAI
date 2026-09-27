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

## Mõõtmine serveris (27.09.2026)

- **v30** = v29 korpus esimese `versions-v1` põlvkonnana (`search_generation_ef3a2d…`), täisehitus ühe korra:
  - plaan 2 min 18 s, töö 31 min (6000 dokumenti, 29 716 tekstiosa, kõik vahemälust, 6000 valmimismärki);
  - v29 vana viisiga: plaan 2 min 7 s, töö 43,5 min.
  - **Samad tulemused:** v29 (`generation`) ja v30 (`versions-v1`) andsid 4 sõnalisele päringule, 3 vektorpäringule ja 200 dokumendi tekstiosadele identsed ID-d ja skoorid (`layout-compare.mjs`, mudelikutseta). Päringuajad olid sama suurusjärku.
- **v31** = v30 + SHS 01.01–31.01.2027 (RT 111072026121) ja HMS alates 01.01.2027 (RT 109072026076), PR #211 (`search_generation_0e082e…`, 6002 dokumenti, 30 081 tekstiosa). Kogu serverikäik `run-v31.sh` kestis 5 min 46 s:

  | Samm | Aeg | Märkus |
  |---|---:|---|
  | ostuplaan | 2 min 0 s | luges veel kogu korpuse: 29 313 sisendit, neist 48 uued |
  | ost | 2 min 11 s | 48 sisendit, 26 864 tokenit, 0,0035 USD; aeg kulus arhiivide laadimisele |
  | indeksi plaan | 39 s | `documents_to_index` 2, `units_to_index` 365 |
  | indeksi töö | 47 s | 6000 dokumenti nimekirja (29 716 tekstiosa), 2 töödeldud ja valmis märgitud |
  | vestlusplaan | 9 s | `…20260927v.json` (id …-1758) |

- **Vanu ridu ega punkte ei kirjutatud** (`version-proof.mjs`, v30 enne ja pärast v31 lisamist):
  - tekstiosa ridade reaversioonide räsi `a0eabd46…`, valmimismärkide räsi `65267eb4…`, 29 716 punkti payload'ide räsiga `4136b317…`: kõik muutumatud;
  - jagatud tabel ja kollektsioon kasvasid 29 716 → 30 081 (+365).
- **Vestlus töötas lisamise ajal:** pööre 17:57:37–17:58:04 UTC vastas v30 põlvkonnalt, indeksi töö käis 17:57:30–17:58:17.
- **Kehtivus:** 27.09 seisuga on uued tekstid `not_yet_in_force`. 15.01.2027 seisuga jäävad tõendiks SHS 2027 ja HMS 2027, vanad on `expired`. Samas kontrollis ilmnes, et Riigilõivuseadusel pole 2027. aasta teksti.
- **Ketas:** v30 ja v31 read on koos 616 MB (`rag_v2_version_unit`) ja üks Qdranti kollektsioon. Vana viisiga oli iga põlvkond ~1 GB. Vanad põlvkonnad v25b–v29 kustutati omaniku loal ja `rag_v2_unit` kirjutati ümber (2,8 GB → 1,8 MB): vaba ruum 8,2 → 12 GB.

## Järelparandused (Codexi ülevaatus 27.09.2026)

Codexi ülevaatus (27.09.2026, PR-id #209–#211) leidis, et kirjutamine on muudatusepõhine, aga ettevalmistus veel mitte. v31 mõõtmine kinnitas seda: 5 min 46 s-st kulus ~4 min ostuplaanile ja ostule. Samal päeval parandatud:

- **Vektorid loetakse vajaduse järel.** `reusableEmbeddingCatalog` kontrollib pearaamatud kohe ja loeb vektorifaili koos räsikontrolliga siis, kui selle sisendit esimest korda küsitakse. Kahes arhiivis ostetud sisendi vektorid võrreldakse ikka. `StoredEmbedding.load` loeb vaikimisi endiselt kõik.
- **Muudatusepõhine ostuplaan** (`--indexed`, koos `--connections` ja `--lexical`): dokumendid, mille versioon on sihtseadistusega juba valmis märgitud, jäetakse lugemata ja planeerimata. Manifest (`indexed_versions`) nimetab väljajäetud versioonide arvu ja räsi, nii et kinnitus katab ka väljajätmise. Plaan ja ost peavad mõlemad lippu kasutama.
- **Mõõdetud pärast PR #212 deploy'd** (v31 korpus, midagi uut; `after-212.sh`, tasuta):
  - ostuplaan `--indexed`: **4,4 s** (6002 dokumenti valmis, loetud 0, sisendeid 0); v31 käigus 2 min 0 s;
  - indeksi plaan: **4,7 s** (`documents_to_index` 0); v31 käigus 39 s;
  - ostu ja indeksi töö aega uute dokumentidega pole veel mõõdetud (järgmine lisamine). Mõlemad loevad nüüd ainult uute tekstiosade vektorid.

## Piirid ja järgmised sammud

- **Mahupiir** (`capacity.js`): 10 000 dokumenti ja 60 000 tekstiosa põlvkonna kohta, seatud 25.09 vana viisi mõõtmiste järgi. Mitusada pikka õigusakti (nt 300 × 250 tekstiosa) sinna ei mahu. Piiri tõstmiseks tuleb mõõta vestluspöörde kulu suurema põlvkonnaga: kataloog, sõnaline päring ja täpne vektoriotsing (`exact: true`) kasvavad põlvkonna suurusega.
- Vanade versioonide read ja punktid jäävad jagatud tabelisse ja kollektsiooni, kuni koristus need eemaldab. Koristus (versioonid, mida ükski säilitatav põlvkond ei loetle) on tegemata.
- Valmis versioonidele jäävad lugemisaegsed kontrollid. Täielik kontroll on `--mode verify`; seda tasub käivitada hooldustööna.
- Vestlus võtab uue põlvkonna kasutusse alles plaani ümberehituse ja taaskäivitusega (järgmine etapp).
- Lisamise automaatne taustatöö on eraldi etapp. Sisestuse ülevaatus ja embeddingu kulu kinnitus jäävad inimese otsustada.
