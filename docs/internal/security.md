# SotsiaalAI turvalisuse kirjeldus

Kuupäev: 2026-04-25

See dokument kirjeldab SotsiaalAI platvormi ja production-serveri peamisi
turvameetmeid. Dokument on mõeldud sisemiseks kasutuseks, kliendisuhtluse
tehniliseks sisendiks ja andmekaitse kontrollide toetamiseks. See ei avalda
turvatundlikke detaile, nagu täpsed IP-aadressid, täielikud tulemüürireeglid,
saladused või sisevõrgu skeemid.

## 1. Platvormi üldarhitektuur

SotsiaalAI töötab productionis eraldatud VPS-serveris. Platvorm koosneb
järgmistest põhikomponentidest:

- Next.js rakendus, mis teenindab kasutajaliidest ja API route'e.
- PostgreSQL andmebaas, mille skeemi haldab Prisma.
- RAG service, mis töötab FastAPI/Uvicorni teenusena ja haldab otsingu- ning
  indeksiloogikat.
- Research worker, mis töötleb süvauuringu taustatöid.
- Reverse proxy kiht avaliku HTTPS-liikluse vastuvõtmiseks ja rakenduse
  sisemisele teenusele edastamiseks.

Rakendus- ja taustateenused töötavad systemd teenustena ning on eraldatud
avalikust veebiliiklusest. Avalik liiklus käib reverse proxy kaudu; sisemised
teenused töötavad loopback-liidesel või muul piiratud ligipääsuga teenusekihil.

## 2. Ühendused ja transport

- Avalik veebiliiklus toimub HTTPS-i kaudu.
- Rakenduse ees kasutatakse reverse proxy kihti, mis vahendab liikluse
  rakendusserverile.
- Rakenduse ja RAG teenuse vaheline suhtlus toimub sisemisel teenuseaadressil
  ning API võtmega kaitstud päringutega.
- Teenuse saladusi, API võtmeid ja andmebaasi ühendusandmeid hoitakse
  keskkonnamuutujates või serveri piiratud ligipääsuga env failides, mitte
  lähtekoodis.

## 3. Autentimine ja sessioonid

- Kasutajate autentimine toimub e-posti ja PIN-i põhise sisselogimise kaudu.
- PIN-i ei salvestata lihttekstina; rakendus kasutab parooliräsi põhist
  kontrolli.
- Sisselogimisvoos kasutatakse ajutisi login token'eid ja vajadusel OTP-koode.
- Ajutised tokenid, OTP-koodid ja seadme usaldamise kirjed on andmebaasis
  ajaliselt piiratud ning cleanup-loogika eemaldab aegunud kirjed.
- Sessioonid on piiratud kehtivusajaga ning kasutaja konto või sessiooni
  versiooni muutus võimaldab sessioone kehtetuks muuta.

## 4. Ligipääsukontroll

- Kasutajate dokumendid ja vestlused on vaikimisi owner-scoped: kasutaja saab
  lugeda ja muuta ainult enda andmeid, kui konkreetne admin-töövoog ei näe ette
  teisiti.
- Dokumendi API-d kontrollivad serveris omanikku enne lugemist, muutmist,
  allalaadimist ja kustutamist.
- Dokumendi artefaktide API-d kontrollivad samuti omanikku.
- Organisatsiooni või tööandja admini ligipääsu töötaja isiklikele vestlustele
  või failidele ei ole eraldi töövoona lisatud.
- Platvormi administraatori õigused on kõrgendatud õigused ja neid kasutatakse
  ainult haldusvajaduseks. Sellised ligipääsud tuleb käsitleda eraldi sisemise
  õiguste ja auditikorra osana.

## 5. Dokumendid ja failid

- Kasutaja üleslaetud dokumendid salvestatakse serveri dokumendihoidlasse ning
  nende andmebaasikirje sisaldab tehnilisi metaandmeid, näiteks faili tüüpi,
  suurust, räsi ja storage path'i.
- `storagePath` on serverisisene väärtus ning seda ei kuvata kasutajale
  avaliku andmeväljana.
- Dokumendi kustutamisel kustutatakse rakenduse andmebaasikirje ja sellega
  seotud fail.
- Kui dokument oli seotud RAG/indeksiga, käivitab rakendus RAG dokumendi
  kustutuse.
- Kui RAG kustutus ebaõnnestub, ei katkestata kasutaja dokumendi kustutust;
  selle asemel jääb alles `DataDeletionJob` kirje staatusega `failed` ning
  auditisse kirjutatakse `RAG_DELETE_PENDING`.

## 6. Audit ja kustutustööde jälg

Rakenduses kasutatakse kahte uut tehnilist andmekaitse tabelit:

- `DataAuditLog` salvestab tehnilise auditijälje tundlikest andmetoimingutest.
- `DataDeletionJob` salvestab kustutustööde jälje ja staatuse.

Auditikirjed on mõeldud tehnilise kontrolli, järelkäsitluse ja vastavuse
toetamiseks. Need ei ole mõeldud dokumendi sisu, vestluse sisu ega kasutaja
vabas vormis sisestatud teksti säilitamiseks.

Dokumendi kustutuse korral kirjutatakse vähemalt:

- `DOCUMENT_DELETE` auditikirje.
- `RAG_DELETE` auditikirje, kui RAG kustutus õnnestub.
- `RAG_DELETE_PENDING` auditikirje ja failed deletion job, kui RAG kustutus
  ebaõnnestub.
- `FILE_DELETE` deletion job faili kustutuse jälgimiseks.

Konto kustutamisel kustutatakse kasutaja konto ja seotud rakenduse andmed
kaskaad- ning cleanup-loogika kaudu, kuid `DataAuditLog` ja `DataDeletionJob`
kirjed jäävad alles tehnilise auditijäljena.

## 7. Logimise minimeerimine

Rakendus kasutab logides andmete minimeerimist ja redigeerimist:

- `safeError` ja redaction helperid eemaldavad või lühendavad tundlikke välju,
  nagu `authorization`, `cookie`, `token`, `secret`, `raw`, `body`, `payload`,
  `audioBuffer`, `file`, `content`, `text` ja `messageContent`.
- Dokumendi audit console log ei kirjuta enam dokumendi `title`,
  `originalName`, `fileName` ega muid kasutaja antud nimetusi.
- Dokumendi audit console logis hoitakse ainult tehnilisi välju: sündmus,
  timestamp, kasutaja ID, dokumendi ID, artefakti ID, liik, MIME, suurus,
  action ja status.
- RAG validation error logib tehnilised andmed: route, vea asukoht/tüüp,
  content-type, body byte length, sha256/fingerprint ja request/correlation ID,
  kui see on olemas.
- RAG validation response ei tagasta request body preview'd.

Logide eesmärk on töökindluse, veaotsingu ja turbeintsidentide käsitlemine.
Logid ei ole mõeldud dokumendi sisu, vestluse sisu, audio bufferite,
makseteenuse toorandmete ega saladuste säilitamiseks.

## 8. Säilitustähtajad ja cleanup

Productioni rakenduse tasemel säilitustähtajad on:

```env
DATA_RETENTION_DAYS=90
CONVERSATION_TTL_DAYS=90
PAYMENT_RETENTION_DAYS=2555
PAYMENT_RAW_RETENTION_DAYS=90
LOG_RETENTION_DAYS=90
RAG_DELETE_ON_DOCUMENT_DELETE=true
```

Tähendused:

- `DATA_RETENTION_DAYS` on üldine cleanup aken rakenduse tööandmetele.
- `CONVERSATION_TTL_DAYS` määrab uute vestluste aegumise.
- `PAYMENT_RETENTION_DAYS` määrab maksekirjete pikema säilituse.
- `PAYMENT_RAW_RETENTION_DAYS` määrab makseteenuse toorpayloadi eemaldamise
  aja.
- `LOG_RETENTION_DAYS` määrab rakenduse `ChatLog` cleanup akna.
- `RAG_DELETE_ON_DOCUMENT_DELETE=true` tähendab, et dokumendi kustutamisel
  proovitakse kustutada ka seotud RAG/indeksi kirje.

`BACKUP_RETENTION_DAYS` võib esineda ops dokumentatsiooni väljana, kuid
rakendus ei jõusta backupide kustutamist. Backupide, journald logide, proxy
logide ja teenusepakkujate logide retention tuleb seadistada ja kontrollida
eraldi ops/provider tasemel.

## 9. Makseandmed

- Maksetöötluse logimine kasutab eraldi minimeeritud observability helperit.
- Payment logides redigeeritakse tundlikud väljad, sealhulgas `raw`, `body`,
  `payload`, `token`, `secret`, `authorization` ja sarnased võtmed.
- Maksekirjete toorandmeid kärbitakse rakenduse retention cleanupiga vastavalt
  `PAYMENT_RAW_RETENTION_DAYS` väärtusele.
- Pikem maksekirjete säilitus on eraldatud toorpayloadi säilitusest.

## 10. Serveri turvameetmed

Production-serveri turvalisuse põhimõtted:

- Serveri haldus toimub SSH kaudu võtmapõhiselt.
- Parooliga SSH ja root-kasutaja otselogin peavad olema keelatud.
- Haldusligipääs on viidud privaatse Tailscale tailneti taha või muul viisil
  piiratud haldusvõrku.
- Avalik ründepind on piiratud ainult vajalike avalike teenustega.
- Rakendus, RAG service ja research worker töötavad systemd teenustena.
- Andmebaas ja sisemised teenused ei ole mõeldud avalikust internetist otse
  kättesaadavaks.
- Serveris kasutatakse süsteemi- ja turvauuenduste haldust ning vajadusel
  käsitsi kontrollitud uuendusi.
- SSH kaitseks kasutatakse täiendavaid meetmeid, näiteks korduvate ebaõnnestunud
  sisselogimiste piiramine.

## 11. Varundus ja taastamine

- Serveri ja andmebaasi varundus on ops-taseme kohustus.
- Backupide eesmärk on teenuse taastatavus tehnilise rikke, andmekao või
  intsidendi korral.
- Rakenduse retention cleanup ei kustuta automaatselt provider- või
  serveritaseme varukoopiaid.
- Backupide täpne retention, taastetestid ja kustutuspoliitika tuleb hoida
  eraldi serveri/provid eri konfiguratsioonis või ops runbook'is.

## 12. Kontrollid pärast production deploy'd

Andmekaitse-hardeningu kontrollis on productionis kinnitatud:

- `DataAuditLog` ja `DataDeletionJob` migratsioon on rakendatud.
- Production env sisaldab 90 päeva üldist, vestluste ja logide retention
  väärtust.
- `PAYMENT_RETENTION_DAYS=2555` ja `PAYMENT_RAW_RETENTION_DAYS=90` on seatud.
- `RAG_DELETE_ON_DOCUMENT_DELETE=true` on seatud.
- Fiktiivse testkasutaja ja testdokumendiga kontrolliti dokumendi kustutust,
  `DOCUMENT_DELETE`, `RAG_DELETE`, `FILE_DELETE`, konto kustutust ning audit- ja
  deletion job ridade säilimist.
- Teenusepõhistest frontend, RAG ja research worker logidest ei leitud
  testdokumendi sisu, tundlikku failinime, body preview'd, tokenit, raw payloadi
  ega audio bufferit.

## 13. Teadaolevad piirangud

- Platform-admin on kõrgendatud tehniline roll. Selle kasutus peab olema
  piiratud, põhjendatud ja vajadusel auditeeritav.
- Rakenduse logide minimeerimine ei tähenda, et kõik ops-kihi logid oleksid
  rakenduse kontrolli all. Näiteks journald, Tailscale SSH auditlogid, reverse
  proxy logid ja teenusepakkujate logid sõltuvad vastavatest ops/provider
  seadistustest.
- AI-, kõne-, e-posti-, makse- ja hostinguteenuse pakkujatel võivad olla oma
  logimise ja retention mehhanismid. Need tuleb katta alltöötlejate loetelu,
  lepingute ja provider seadistustega.
- See dokument kirjeldab hetkeseisu. Turvameetmeid tuleb üle vaadata pärast
  olulisi arhitektuuri-, funktsiooni-, teenusepakkuja- või õigusmuudatusi.

## 14. Lühikokkuvõte lepingu või kliendisuhtluse jaoks

SotsiaalAI rakendab riskipõhiseid tehnilisi ja korralduslikke turvameetmeid, et
kaitsta isikuandmete konfidentsiaalsust, terviklust, käideldavust ja
taastatavust. Platvorm kasutab HTTPS-ühendusi, serveripoolset autentimist,
rolli- ja omanikupõhist ligipääsukontrolli, andmete minimeeritud logimist,
tehnilist auditijälge, kustutustööde jälgimist ning rakenduse tasemel
säilitamis- ja kustutusreegleid. Serveri haldusligipääs on piiratud
võtmepõhise SSH ja privaatse haldusvõrguga, rakenduse teenused töötavad
systemd teenustena ning andmebaas ja siseteenused ei ole avalikust internetist
otse kättesaadavad. Backupid, proxy/journald logid ja teenusepakkujate logid
kuuluvad eraldi ops- ja provider seadistuste alla.
