# ADR-012: jätkatav kohalik indekseerimine

Kuupäev: 23.09.2026. Baas: `00fb25ac0`; muudatused kohalikus main-tööpuus.
See fail kirjeldab teostusotsust ja tõendeid. Aktiivset tööd kannab SotsiaalAI.md.

## Tulemus

Avaldatud allikaversioonidest saab koostada külmutatud indeksiplaani ning seda
väikeste portsjonitena käivitada ja jätkata. PostgreSQL salvestab lõpetatud
dokumendid ja tekstiosad; Qdranti laaditakse ning kontrollitakse kuni 100 vektorit
korraga. Poolik põlvkond ei asenda kasutatavat indeksit. Olemasolev `indexSnapshot`
ja selle põlvkondade identiteet säilivad.

Uus rada ei loo tasulisi vektoreid: see kasutab kohalikku testadapterit või
olemasolevaid kontrollitud vektoriarhiive. Puuduv pärisvektor peatab töö;
automaatset väliskutset ei järgne. Vestluse vastusekutsete arv ei muutu.

## Leping ja katkestusest jätkamine

`planIndexJob` seob kliendi, avaldatud kataloogipõlvkonna, valitud dokumendid,
versioonid, töötlemistulemuse ja otsinguüksuste räsid ning otsinguseadistuse.
Tekstiosa- ja tokenimahud arvutatakse planeerimisel lokaalselt. Plaani loomine
ei muuda andmebaasi ega aktiveeri indeksit.

`IndexJobStore` salvestab plaani eraldi kohaliku RAG-andmebaasi tabelisse
`rag_v2_index_job`. Plaan seotakse hoidla tegeliku teega. Edenemine koosneb
dokumendi indeksist, dokumendisisese tekstiosa indeksist ning lõpetatud tekstiosade
arvust; need kontrollitakse omavahel kooskõlaliseks. Seis on `pending` või `ready`.
`ready` näitab töö valmimist; hiljem võib aktiivne indeks olla juba uuem.

Ühel tööl on korraga üks tähtajaline tööõigus. Kordumatu token ja kontroll
andmebaasi kella järgi takistavad aegunud töötleja hilinenud kinnitust või
asendaja luku vabastamist. Töötleja pikendab kehtivat tööõigust portsjonite vahel;
aegunud tööõigust ta taastada ei saa. Vaikimisi on kestus 120 sekundit.
Käsu tavapärane lõpp või viga vabastab tööõiguse; protsessi kadumisel saab uus
töötleja jätkata pärast selle aegumist.

Tekstid loetakse ja PostgreSQL-i imporditakse ühe dokumendi kaupa. Iga vektoriportsjon
kirjutatakse, loetakse kontrolliks tagasi ja alles siis kinnitatakse edenemine.
Kui kirjutamine õnnestus, kuid kinnitus kadus, korratakse sama portsjonit samade
tunnuste ja kontrollitud vahemälu abil. Varem kinnitatud portsjoneid uuesti ei
kirjutata. Katkise allika või teise hoidla vastu töö ei jätku.

Enne aktiveerimist kontrollitakse kõiki dokumente, tekste, struktuuriobjekte,
vektorite väärtusi ja päritolu ning vektorite täpset koguarvu uuesti. Qdranti
kontroll kasutab [punktide lugemise API-t](https://api.qdrant.tech/api-reference/points/get-points)
ja [täpset loendamist](https://api.qdrant.tech/api-reference/points/count-points).
Avaldamise kirjutuslukk hoitakse ainult viimase kataloogipõlvkonna kontrolli ja
aktiveerimistehingu ajal. Muutunud algkorpus või uuem indekseerimistaotlus
peatab vana töö aktiveerimise. Töö `ready` seis ja aktiivse indeksi vahetus
salvestuvad samas PostgreSQL-i tehingus.

Täieliku lõppkontrolli katkestamisel korratakse kontrolli, mitte juba lõpetatud
vektorite laadimist. Valmis töö korduskäivitus tagastab `reused: true`, kui sama
põlvkond on endiselt aktiivne; see kiire vastus ei ole uus andmete terviklusaudit.

## Kohalik kasutamine

Eeldused: allikad on avaldatud, kohalikud PostgreSQL/Qdrant töötavad ning
õigustefail nimetab operaatorile lubatud dokumenditunnused. Näidisõigustefail:

```json
{"tenants":{"LOCAL_TEST":{"operator":["document_<tegelik SHA-256 tunnus>"]}}}
```

```powershell
node scripts/rag-v2-local.mjs migrate
node scripts/rag-v2-index-batch.mjs --mode plan --tenant LOCAL_TEST --subject operator --policy tmp/batch/policy.json --store tmp/batch/store --manifest tmp/batch/index.json --development-only
node scripts/rag-v2-index-batch.mjs --mode run --tenant LOCAL_TEST --subject operator --policy tmp/batch/policy.json --store tmp/batch/store --manifest tmp/batch/index.json --batch-size 50 --max-batches 2 --development-only
node scripts/rag-v2-index-batch.mjs --mode status --tenant LOCAL_TEST --subject operator --policy tmp/batch/policy.json --manifest tmp/batch/index.json --development-only
# Sama run-käsk jätkab; --max-batches võib järgmisel käivitusel olla suurem.
```

Ilma `--vectors` parameetrita kasutatakse testvektoreid. Olemasolevate pärisvektorite
jaoks lisa nii `plan` kui ka `run` käsule `--vectors <kontrollitud arhiivikaust>`;
mitme arhiivi korral korda parameetrit. Kasutatakse olemasolevat
`reusableEmbeddingCatalog` lugejat, mis kontrollib lõpetatud töö registrit,
kliendi tunnust, vektorifaile ning seadistuste ja kattuvate vektorite kooskõla.
API-võtit pole selleks vaja. `status` ei vaja vektoriarhiivi laadimist.

CLI kontrollib jooksvaid dokumendiõigusi enne töö alustamist ja enne aktiveerimist.
CLI operaatorikontekst on kohalik leping, mitte veebikasutaja autentimine.
Admini HTTP-liides vajab oma seniseid autentimise ja õiguste kontrolle.

## Kontrollitõend ja piirid

Migratsioon `202609230003_index_jobs` rakendati ainult eraldatud kohalikus
`rag_v2_dev` andmebaasis aadressil `127.0.0.1:55432`. RAG-i Prisma skeemi kontroll
läbis. Platvormi põhiandmebaasi ega serverit ei muudetud.

`TZ=UTC` all läbisid **42 testi**, neist **11 uut indekseerimistesti**:

- Osaline töö jätkub uue andmebaasiühenduse ja eraldi CLI-protsessiga.
- Kadunud kinnituse järel taaskasutatakse vektoreid; valmis portsjoneid ei kirjutata uuesti.
- Vana indeks säilib katkise teksti, vektori, liigse punkti ja muutunud allikapõlvkonna korral.
- Aegunud tööõigus ja uuem indekseerimistaotlus tõkestavad vana töö lõpetamise.
- Kliendi, hoidla, plaani ja edenemisarvude muutmine tuvastatakse.
- Sünteetiline 3072-mõõtmeline salvestatud vektoriarhiiv läbib API ja CLI; elavat teenuseadapterit ei lubata.
- Valmis indeksist leiab käändevormi tekstotsing täpsed allikakohad ainult lubatud dokumentidest.

Ülejäänud 31 testi katavad varasema avaldamise, allikastruktuuri ja morfoloogia
regressioonid. Muudetud JS/MJS-failide ESLint ja `git diff --check` läbisid.
Väliseid mudelikutseid oli 0. Sünteetilised vektorid tõendavad salvestus- ja
otsingumehhanismi, mitte pärismudeli keelelist või semantilist kvaliteeti.

See plokk ei suurenda olemasolevat **5000 tekstiosa** piiri; üks plaan võib
sisaldada kuni 1000 dokumenti. Otsingu päringute pool loeb endiselt liiga palju
andmeid korraga ning vajab enne suure korpuse avamist valikulist laadimist.
Tekstitöötlus on dokumendipõhine, kuid olemasolev pärisvektorite arhiivilugeja
laadib oma vektorikataloogi mällu. Lõppkontroll loeb kogu valimi portsjonite kaupa
uuesti ja selle kestus ei ole piiratud `--max-batches` parameetriga.

Teadmiskandidaatide koostamise mahttöö, puuduvate pärisvektorite loomine ja
tegeliku kulu koondarvestus, adminiliides ning kogu korpuse kasutuselevõtt on
eraldi arendusosad. Olemasolevat admini käsitsi RAG-enesetesti ei muudetud.
Brauseriruntime ja tootmiskäitamine on `NOT_PROVEN`; UI-d ega importimispiiri
selles plokis ei muudetud ning build'i ei käivitatud.
