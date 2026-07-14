# Sol U4 — teenuse kättesaadavus ja värskuskinnitus

> **Staatus:** VALMIS HARUL, OOTAB OPUSE SÕLTUMATUT AUDITIT
> **Teostaja:** Sol / Codex paralleelaken
> **Haru:** `codex/u4-availability-trust`
> **Tööpuu:** `C:\Users\rauds\Desktop\SotsiaalAI-u4`
> **Alus:** värske `origin/main` commit `df2f45c0`
> **Deploy:** keelatud
> **Audit:** Opus teeb U12+U3 ja U4 sõltumatud auditid pärast mõlema haru üleandmist

## 1. Eesmärk

Ehitada U4 vertikaal, kus teenuseosutaja kinnitab iga avaliku teenuse tegeliku
kättesaadavuse, pöörduja ja spetsialist näevad olekut ning info vanust enne
pöördumist ja admin näeb aegunud kirjeid teenuseosutaja nimel sisu muutmata.

U4 ei ole broneerimis-, kalendri-, ootenimekirja- ega kliendihaldussüsteem.
`not_accepting` jääb nähtavaks hoiatuseks ega peida teenust või blokeeri
pöördumist.

## 2. Enne koodi tehtud kaardistus

- `ServiceProviderService` sisaldab juba vabu `availabilityStatus` ja
  `availabilityDescription` välju, kuid kinnitamise aega ei ole.
- aktiivne redaktor kirjutab praegu väärtusi `Saadaval`, `Järjekord`,
  `Piiratud vastuvõtt` ja `Peatatud` ning kogu profiili salvestus kustutab ja
  loob teenusekirjed uuesti;
- avalik Teenusekaart saab teenused `listPublishedServiceMapEntries()` kaudu ja
  eelpöördumise adressaadivalik kasutab sama teenusekaardi andmekihti;
- RAG-i teenusemeta sisaldab praegu vaba olekut, kuid mitte kinnitamise aega ega
  stale-signaali;
- olemasolev `ServiceProviderProfile.checkedAt` ja `ServiceMapEntry.checkedAt`
  kirjeldavad kogu profiili/kaardikirje kontrolli, mitte teenuse saadavuse
  kinnitust, mistõttu neid U4 tõendina ei kasutata;
- tööpuus puudub keskkonnafail ja seetõttu ei tehtud tootmisandmete päringut.
  Repost leitud legacy-väärtusi käsitletakse alloleva säilituslepingu järgi.

## 3. Lukustatud andme- ja turvaleping

### 3.1 Kanooniline olek

Rakenduskihi whitelist, mitte PostgreSQL enum:

- `accepting` — võtab uusi pöördumisi vastu;
- `waitlist` — pöördumine on võimalik, kuid on ligikaudne ooteaeg;
- `not_accepting` — praegu uusi pöördumisi vastu ei võta;
- `unknown` / `NULL` — info on kinnitamata.

`availabilityDescription` jääb piiratud vabatekstiks. `waitlist` korral kuvab UI
seda ligikaudse ooteajana, kuid U4 ei loo ootenimekirja kirjeid.

### 3.2 Legacy säilitamine

- tundmatut ajaloolist `availabilityStatus` väärtust ei kustutata ega teisendata
  kõrvalise profiilimuudatuse salvestamisel;
- vana väärtus kuvatakse omanikule eraldi legacy-valikuna ja palutakse teadlikult
  valida üks kolmest kanoonilisest olekust;
- avalikus vaates teisendatakse ainult üheselt mõistetavad vana UI väärtused
  (`Saadaval`, `Järjekord`, `Peatatud`) esituskihis; mitmetähenduslik või tundmatu
  väärtus on ausalt `unknown`;
- migratsioon on additiivne ega tee olemasolevatele väärtustele andmebackfill'i.

### 3.3 Värskus

- lisatakse `availabilityCheckedAt DateTime?` ja meeldetuletuse duplikaadi
  tõkestamiseks `availabilityReminderSentAt DateTime?`;
- värskusaken on keskne `SERVICE_AVAILABILITY_FRESH_DAYS`, vaikimisi 28 päeva;
- stale/unknown on serveris arvutatud esitusolek, mitte DB tõeväärtus;
- uue kanoonilise oleku valik või oleku/ooteaja sisuline muutmine kinnitab selle
  serveriajaga; kõrvalise profiilivälja muutmine ei värskenda saadavust;
- teenuse stabiilne ID säilib profiili terviksalvestusel. Omanikule väljastatakse
  saadavuse sisust arvutatud opaque fingerprint. Kinnitus õnnestub ainult siis,
  kui serveri värske oleku fingerprint kattub;
- sama muutmata sisu korduv kinnitus on idempotentne. Muutunud sisu vana
  fingerprint annab `409` ja ei kirjuta midagi.

### 3.4 Autoriseerimine

- profiili ja teenuse saadavust saab muuta/kinnitada ainult profiili omanik;
- admini teenuseprofiili API ei anna õigust muuta teise omaniku kirjet;
- avalik serializer ei väljasta omaniku privaatseid andmeid ega suvalist legacy
  olekut usaldusväärse faktina;
- admini U4 ülevaade on admin-only ja read-only;
- meeldetuletuse link avab autentimist nõudva teenuseosutaja enda
  `/teenuseprofiil` vaate, mitte tokenipõhise anonüümse muutmis-URL-i.

## 4. Meeldetuletuse leping

- perioodiline CLI/admin-toiming valib ainult avaldatud, kanoonilise olekuga
  aegunud teenused;
- sama `availabilityCheckedAt` kinnitust meenutatakse maksimaalselt üks kord;
- kiri sisaldab organisatsiooni/teenuse nime ja halduslinki, mitte eelpöördumise,
  kliendi ega juhtumi andmeid;
- puuduva saatja, saaja või päris transpordi korral tulemus on `not_sent` ja
  `DataAuditLog` saab põhjuse; vale `sent` edu ei tagastata;
- edukas saatmine märgib `availabilityReminderSentAt` ning jätab auditirea.

## 5. UI leping

- Teenusekaart ja eelpöördumise adressaadikaart näitavad olekut tekstina koos
  ikooniga, ligikaudset ooteaega, suhtelist kinnitamise vanust ja tekstilist
  stale/unknown hoiatust;
- ükski tähendus ei sõltu ainult värvist;
- teenuseosutaja redaktoris on kolm kanoonilist olekut, kinnitamise aeg,
  stale/unknown olek ja üheklõpsu „Kinnitan, et info kehtib”;
- kinnituse `409` korral laetakse värske profiil ja kasutajale selgitatakse
  konflikti;
- adminivaade näitab teenust, profiili, omaniku kontakti, viimast kinnitust ja
  aegumise põhjust, kuid ei sisalda omaniku eest kinnitamise toimingut;
- kõik uued kasutajatekstid lisatakse ET/EN/RU pariteediga.

## 6. Teostusjärjekord

- [x] eraldi worktree ja haru värskest `origin/main` seisust;
- [x] handoffi, nelja Fable alusdokumendi ja U4 aktiivse tööplaani lugemine;
- [x] skeemi, profiilisalvestuse, Teenusekaardi, eelpöördumise, RAG-i, e-posti ja
  admini mustrite kaardistus;
- [x] additiivne skeem ja migratsioon;
- [x] keskne oleku/freshness/fingerprint leping;
- [x] owner API, profiilisalvestuse identiteedi säilitamine ja RAG;
- [x] Teenusekaart, eelpöördumine ja teenuseosutaja haldus;
- [x] reminder-töö ja admini stale-ülevaade;
- [x] ET/EN/RU;
- [x] sihttestid, kogu testipakk, Prisma, migratsioonikontroll, lint ja build;
- [x] autentitud Playwrighti kontroll QA-andmetega;
- [x] käesoleva dokumendi lõplik tõenduspakk;
- [ ] commit ja push (täidetakse kohe pärast selle dokumendi lukustamist).

## 7. Kontrollmaatriks

Kohustuslikud sihtjuhtumid:

1. omanik muudab ja kinnitab; võõras ei saa;
2. stale fingerprint annab `409` ja null kirjutust;
3. whitelist lükkab uue tundmatu väärtuse tagasi;
4. vana tundmatu väärtus säilib kõrvalise salvestuse korral;
5. Teenusekaart kuvab oleku, vanuse ja stale/unknown hoiatuse;
6. eelpöördumine hoiatab `not_accepting` ja stale korral, kuid ei blokeeri;
7. reminder on idempotentne ja kliendiinfota;
8. admin näeb stale-loendit, kuid ei saa owner-kinnitust teha;
9. RAG metadata eristab värsket, aegunud ja kinnitamata saadavust;
10. ET/EN/RU pariteet, klaviatuur, fookus ja tekstiline tähendus.

## 8. Valmis vertikaal

### 8.1 Server, andmed ja turve

- additiivne migratsioon lisab teenusele nullable `availabilityCheckedAt` ja
  `availabilityReminderSentAt` väljad ning vajalikud indeksid; olemasolevaid
  olekuid ei kirjuta ümber;
- keskne whitelist, legacy-kaardistus, värskusarvutus ja avalik/RAG-projektsioon
  on koondatud ühte lepingukihti;
- profiili terviksalvestus säilitab teenuse ID ja muutmata saadavuse kinnituse.
  Lugemine ja kirjutamine toimuvad `Serializable` tehingus ning P2034 korral on
  piiratud retry, et samaaegne üheklõpsukinnitus ei kaoks terviksalvestuse alla;
- owner-only kinnitus kasutab serveri arvutatud opaque SHA-256 fingerprint'i,
  tingimuslikku kirjutust, idempotentset kordust ja `409` konfliktivastust;
- võõras kasutaja ega admin ei saa owner-kinnitus-API kaudu teenust kinnitada;
- avalik kaart, eelpöördumine ja RAG saavad ainult normaliseeritud oleku,
  kinnituse vanuse ning stale/unknown signaalid;
- reminder-dispatch on avaldatud kanooniliste stale-teenuste põhine,
  duplikaadikaitsega ja audititud. Puuduva reaalse transpordi/saatja/saaja korral
  ei raporteerita valet edu;
- admini stale-loend on admin-only ja read-only.

### 8.2 UI ja i18n

- teenuseosutaja näeb iga teenuse olekut, kinnituse vanust, stale/unknown
  hoiatust ja üheklõpsukinnitust;
- Teenusekaardi popup ja eelpöördumise adressaadikaart näitavad kolme olekut,
  ooteaja kirjeldust ning värskust tekstiliselt; `not_accepting` jääb nähtavaks
  ja pöördumine ei ole blokeeritud;
- admin näeb eraldi aegunud teenuste ülevaadet ilma omaniku eest kinnitamise
  võimaluseta;
- kõik lisatud kasutajatekstid on ET/EN/RU pariteedis ning olekud ei sõltu
  ainult värvist.

## 9. Kontrollitõendid

Kõik kontrollid tehti eraldi U4 tööpuus, deploy'ta.

- `npm test`: **1095/1095 läbitud**;
- U4 sihttestid: **25/25 läbitud** (leping, autoriseerimine, reminder, UI ja
  teenuse asukohaprojektsioon);
- `npm run i18n:check`: ET/EN/RU pariteet läbitud;
- `npx prisma validate` ja `npx prisma generate`: läbitud;
- `npm run db:migrate:check`: kogu **88 migratsiooni** puhas ahel läbitud ning
  ajutine kontrollandmebaas eemaldatud;
- `npm run lint`: **0 viga**, repo baastaseme 359 warning'ut;
- `npm run build`: läbitud, 52 staatilist lehte genereeritud ning uued admini
  ja owner-confirmation route'id buildis nähtavad;
- `npm run ci:smoke`: läbitud;
- `git diff --check`: sisuvigu ei ole (Windowsi LF/CRLF hoiatused on tööpuu
  konfiguratsiooni teavitus).

`npm run css:budget` ei käivitu värskel `origin/main` baasil, sest seal puudub
skripti nõutud `reports/css-cleanup/important-budget.json`. U4 ei loonud ega
muutnud seda kõrvalist baastaseme artefakti.

### 9.1 Autentitud brauserikontroll

Playwrightiga kontrolliti päris Next.js runtime'i ja eraldi ajutise PostgreSQL
QA-andmebaasi peal teenuseosutaja, kliendi ning admini rolle:

- omanik nägi kolme teenuse olekut ja stale-hoiatusi, kinnitas
  `not_accepting` teenuse ning korduskinnitus jäi idempotentselt `200`;
- Teenusekaardi API ja popup näitasid `accepting`, `waitlist` ja
  `not_accepting` olekuid, kinnituse vanust ja stale-hoiatust; teenust ei
  peidetud;
- klient nägi eelpöördumises `not_accepting` ja stale-waitlist hoiatusi;
- kliendi admini GET ja owner-confirmation POST tagastasid `403`;
- admin nägi ainult allesjäänud stale-teenust ning vaates puudus owner-kinnitus;
- päris profiili PUT säilitas teenuse ID-d ja muutmata kinnituse ajad;
- popup'i kõrgus/scroll, Leafleti dünaamilise CSS-i teema ning owneri,
  eelpöördumise ja admini kontrast parandati brauseritõendi põhjal.

Ajutine QA-andmebaas eemaldati ja QA-server suleti. Tootmisandmeid ei muudetud.

## 10. Piirid ja kasutuselevõtt

- U4 ei sisalda broneerimist, kalendrit, CRM-i ega tegelikku ootenimekirja;
- reminder vajab käituskeskkonnas seadistatud e-posti transporti, saatja aadressi,
  baas-URL-i ja perioodilist `service-availability:remind` käivitust;
- migratsiooni ega reminder-job'i ei ole tootmises käivitatud;
- haru ei tohi main-i ühendada enne Opuse U12+U3 ja U4 sõltumatute auditite
  lõpetamist ning paranduste järelkontrolli.

## 11. Juhis Opuse koondauditiks

Auditida U12+U3 ja U4 eraldi lepingutena, kuid ühe auditiringina. U4 puhul
kontrollida eelkõige:

1. tundmatu legacy-oleku säilimist kõrvalise profiilimuudatuse korral;
2. profiili terviksalvestuse ja üheklõpsukinnituse samaaegsuse järjekordi;
3. fingerprint'i `409` null-kirjutust ning korduskinnituse idempotentsust;
4. owner/admin/client õiguste piire ja avaliku serializer'i andmeminimaalsust;
5. reminder'i duplikaadikaitset, auditit ja vale edu puudumist;
6. `not_accepting` nähtavust ilma peitmise või blokeerimiseta;
7. stale/unknown semantika võrdsust kaardil, eelpöördumises, adminis ja RAG-is;
8. migratsiooni additiivsust ja 88 migratsiooni puhast ahelat.

Auditibaas: `codex/u4-availability-trust`, lähtebaas `df2f45c0`. Commit'i SHA
lisatakse pärast teostuscommit'i; main-i ühendamist ega deploy'd ei ole tehtud.
