# Eesti lemma-FTS shadow-kanali disain

## Eesmärk

Lisada olemasoleva dense- ja FTS5-otsingu kõrvale eesti morfoloogiat arvestav
diagnostiline kanal, mis aitab mõõta käänete ja liitsõnade tõttu praegu leidmata
jäävaid chunke. Esimene väljalase ei muuda kandidaatide ühendamist, järjestust,
dokumendiidentiteeti, vastuse koostamist, valideerimist ega allikate kuvamist.

## Piir

- Olemasolev chunkimine, Chroma embeddingud ja `lexical-index.sqlite3` jäävad
  muutmata.
- Lemmad tuletatakse juba olemasolevatest aktiivsetest Chroma chunkidest.
- Eraldi `lemma-index.sqlite3` on taastatav otsingukiirendi, mitte sisuallikas.
- Indeks seotakse sama registrigeneratsiooniga nagu olemasolev FTS5 indeks.
- EstNLTK/Vabamorf analüüsib ainult eesti päringuid; päringu keel liigub
  olemasolevast keeleplaanist bounded `query_language` väljana RAG-teenusele.
- Indeks ehitatakse ja värskendatakse taustal. Selle puudumine või viga ei muuda
  RAG-i health-väravat punaseks ega blokeeri tootmisotsingut.

## Andmevoog

```text
aktiivsed Chroma chunkid
  -> olemasolev chunk body + title
  -> EstNLTK/Vabamorf lemma + liitsõna root-tokenid
  -> eraldi SQLite FTS5 lemmaindeks

eestikeelne retrieval query
  -> sama lemmatiseerija
  -> lemma-FTS kandidaadid
  -> bounded shadow-võrdlus tootmisotsingu lõpptulemusega
  -> rag_trace (ei mõjuta otsust)
```

## Lemmatiseerimine

- Sisend tokeniseeritakse Unicode-tähtedeks ja arvudeks.
- Vabamorf töötab `disambiguate=true`, `guess=true`, `propername=true` ja
  `compound=true` režiimis.
- Iga tokeni põhiväljund on lemma. Liitsõna puhul lisatakse otsinguvälja ka
  Vabamorfi `root_tokens`, et toetada nii tervikliitsõna kui selle koostisosi.
- Tundmatu või analüüsita token säilib normaliseeritud algkujul.
- Lemmatiseerimise järel rakendatakse sama diakriitikavaba otsingunormaliseerimist
  nagu praeguses leksikaalses kihis.

## Indeksi elutsükkel

- Fail ehitatakse ajutisse SQLite faili, kontrollitakse ja asendatakse
  atomaarse `replace` operatsiooniga.
- Metadata sisaldab skeemiversiooni, analüsaatoriversiooni, registrigeneratsiooni,
  chunkide/dokumentide arvu ja ehitusaega.
- Korpuse commit, rollback, metadata muutus ja kustutus märgivad lemmaindeksi
  stale'iks ning ajastavad ühe koondatud taustavärskenduse.
- Startup käivitab puudunud või aegunud lemmaindeksi ehituse taustal; olemasolev
  dense + FTS5 valmisolek ei oota selle lõppu.

## Shadow trace

Trace on bounded ja ei sisalda toorküsimust, lemmasid ega allikateksti. Ta sisaldab:

- versiooni, lubatust, indeksi valmisolekut ja bounded reason-enumit;
- päringu keelt, käivitumise olekut ja analüsaatoriversiooni;
- päringu lemma-tokenite ning kandidaatide arvu;
- maksimaalselt 12 kandidaadi `chunk_id`, `document_id` ja rank'i;
- lemma- ja tootmistulemuste chunk- ning dokumendikattuvust;
- lemmaanalüüsi ja SQLite päringu kestust.

## Fail-closed ja promotion

Kui sõltuvus, analüsaator või indeks pole valmis, jääb shadow ausalt
`executed=false` ning tootmisrada jätkab muutumatult. Lemma-kandidaadid võivad
saada fusion'is otsustusõiguse alles eraldi mõõdetud sentineli- ja
release-värava järel. See disain ei anna neile tootmisautoriteeti.
