# B0 idle-RAG latentsuse mõõtmisprotokoll

Mõõtmine toimub tootmises olemasoleva B0a/B0b instrumentatsiooniga. Selle ülesande
raames ei muudeta runtime-koodi, timeout'i, env-seadeid ega teenuseid.

## Mõõtmisrühm

Üks mõõtmisrühm sisaldab:

1. esimest mittetundlikku päringut pärast dokumenteeritud jõudeaega;
2. kohe järgnevat sisuliselt võrreldavat kontrollpäringut.

Mõlema päringu kohta salvestatakse ainult tehnilised mõõdikud: Eesti ajaga timestamp,
request-ID, observability stage, vaikuse pikkus, embeddingu ja retrieval'i kestus,
kogukestus, timeout, abort, HTTP tulemus, outcome ja allikate arv. Kasutaja päringu
teksti ega allikate sisu artefakti ei salvestata.

## Reeglid

- Mõõtmisakna ajal timeout'i ei muudeta.
- Enne esimest mõõtepäringut warm-up'i ei tehta.
- Warm-up'i ega readiness-loogikat ei lisata.
- Ebaõnnestunud ja edukad katsed jäävad valimisse.
- Nonstream- ja stream-rajatimingud ning vastavad RAG-service'i journald'i etapiread
  säilitatakse request-ID järgi korrelatsioonis.
- Eesmärk on kontrollitud mõõtmisaken, mitte kasutajate päringute pidev jälgimine.
- Mõõtmisfaili ei kirjutata küpsiseid, kasutaja- ega vestluse ID-sid, päringuteksti,
  allikate identifikaatoreid, dokumentide sisu ega embeddinguid.

CSV-i väljad on failis b0-idle-rag-measurements.csv. Fail sisaldab praegu ainult päiserida;
väljamõeldud mõõtmisi ei lisata.
