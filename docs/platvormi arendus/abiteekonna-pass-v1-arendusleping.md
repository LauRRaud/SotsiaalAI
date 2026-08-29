# `ST10-07 ABITEEKONNA-PASS-V1` — Abiteekonna passi arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: uus inimese kontrollitud ekspordi- ja üleandmistööriist
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: doonorid olemas, nimeline pass koodis 0; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2022. aasta allikakiht ühendab ühise töökeele, varem kogutud info taaskasutuse, hooldaja toe
eraldi hindamise ning keele-, transpordi- ja ligipääsetavusvajaduse. **Abiteekonna pass** on
inimese koostatud lühike ja versioonitud väljavõte, mida saab kasutada järgmise kontakti
ettevalmistamiseks ilma kogu Teekonda või elavat kontot avamata.

Inimene valib eesmärgi, saaja ja väljad ning näeb enne saatmist täpselt sama sisu, mille saaja
saab. Pass ei ole ametlik register ega otsus.

## 2. Sobivus olemasoleva platvormiga

**Taaskasutatav:** Teekonna eksport `lib/journey/export.js`, Journey teenus ja ekspordi API;
Teekond→eelpöördumine minimaalne allowlist `lib/journey/preInquiryHandoff.js`; päritolu
`lib/workspaces/provenance.js`; „Minu jagamised”, dokumendi eksport ja vastuvõtukinnituse
doonorid.

**Oluline piir:** praegune üldine Teekonna JSON-eksport võib sisaldada ka `riskSignals` ja
muud omaniku tervikkoopia välju. Seda ei tohi Abiteekonna passina otse taaskasutada. Pass vajab
oma eesmärgipõhist serveripoolset projektsiooni.

## 3. V1 kasutajatee

1. Inimene valib passi eesmärgi: näiteks esimene kontakt, teenusekohtumine või abi jätkamine.
2. Ta valib allowlist'ist väljad: enda eesmärk, kinnitatud olukorrakirjeldus, kokkulepitud
   järgmine samm, keel/kommunikatsioon, ligipääsetavus, transport, valikuline hooldaja vajadus
   ning valikuline kontrollitud RFK-kirjeldus.
3. Iga väli näitab päritolu; AI võib lihtsustada sõnastust mustandina.
4. Inimene näeb 1:1 eelvaadet, saajat, kehtivust ja välise faili tagasivõtmise piirangut.
5. Pass saadetakse turvalise lingi/snapshot'ina või laaditakse PDF/DOCX-ina alla.
6. Platvormisisene saaja kinnitab kättesaamise. Parandus loob uue versiooni ja märgib eelmise
   asendatuks; vana välisfaili hävimist ei lubata.

## 4. Tootepiirid ja invariandid

- Ei jagata kogu Teekonda, elavat viidet, vestlusi, riskisignaale ega kolmandate isikute infot.
- RFK-, tervise-, puude- ja hooldajaandmed ei ole vaikimisi valitud.
- Diagnoosi, abivajadust ega RFK koodi ei tuletata AI-ga vabatekstist.
- Passi saaja ei saa vaikimisi seda edasi jagada ega inimese muud sisu avada.
- Platvormisisene tagasivõtt lõpetab tulevase ligipääsu; allalaaditud faili ei saa tehniliselt
  tagasi võtta ja UI ütleb seda enne eksporti.
- Passi versioon ei muutu saaja käes elavaks; parandus on uus snapshot.
- Pass ei asenda eelpöördumist, STAR/SKAIS/EHIS kirjet ega spetsialisti hindamist.

## 5. Minimaalne andmeleping

Pass: omanik, eesmärk, saaja, versioon, keel, kehtivus, loomise/kinnitamise aeg ja olek.
Väljad: stabiilne võti, väärtus, päritolu, omaniku kinnituse aeg ja tundlikkusklass. Saatmine:
versioon, väljade võtmed, kanal, saaja, saatmise/vastuvõtu/tagasivõtu aeg ning supersede-viide.

Passi audit ei kanna väärtusi. Turvaline link on lühiajaline, saajapõhine ja serveris
autoriseeritud. Failiekspordi manifest kannab versiooni ja päritolu, mitte varjatud välju.

## 6. Teostusetapid

### E0 — minimaalse andmekoosseisu otsus

- Lukusta V1 eesmärk ja allowlist koos tundlikkusklasside ning vaikimisi väljas valikutega.
- Kaardista RFK, hooldaja, keele ja ligipääsetavuse tegelikud kanoonilised väljad; kui neid pole,
  ära leiuta vaba metaandmeskeemi.
- Otsusta snapshot'i, turvalise lingi ja välisfaili retention/tagasivõtmise sõnastus.

### E1 — serveripoolne passiprojektsioon

- Loo omaniku-skoobitud versioonitud pass ja keskne allowlist-projektsioon.
- Puuduv või tundmatu väli tähendab „ei kaasata”, mitte toorobjekti dump'i.
- Välista riskSignals, sisemärkmed, kolmandate isikute andmed ja jagamata Journey väljad.

### E2 — koostaja ja 1:1 eelvaade

- Lisa eesmärgi, saaja, väljade, keele, kehtivuse ja päritolu valik.
- Eelvaade peab tulema samast serveriprojektsioonist, mida saadetakse või eksporditakse.
- Näita AI mustandit, inimese parandust ja kinnitatud lõppteksti eraldi.

### E3 — saatmine, vastuvõtt ja parandamine

- Platvormisisene saatmine kasutab saajapõhist ligipääsu ja vastuvõtukinnitust.
- Lisa tagasivõtt, aegumine, supersede-versioon ja „Minu jagamiste” ajalugu.
- Välise saaja/faili puhul kuva piirid ega väida kättesaamise kontrolli, mida ei ole.

### E4 — PDF/DOCX, keeled ja ligipääsetavus

- Ekspordi ainult eelvaates näidatud snapshot; säilita Unicode ja ligipääsetav dokumendistruktuur.
- ET/EN/RU, lihtkeel, klaviatuur, ekraanilugeja, mobiil ning print/faili päritolumärge.
- Kontrolli käsitsi tundlike vaikevalikute, aegumise ja vana versiooni rada.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis on siis, kui inimene saab koostada minimaalse passi, näeb 1:1 eelvaadet, tundlikud väljad
on vaikimisi väljas, saaja saab ainult valitud versiooni, vastuvõtt/tagasivõtt/aegumine ja
supersede on jälgitavad ning üldise Journey ekspordi lisaväljad ei leki passi. PDF/DOCX ütleb
ausalt, et välisfaili ei saa tagasi võtta.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi omaniku/saaja/võõra/ekspordi rada. Automaatteste ega sonde ei looda ega
käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-AP-1: esimese passi eesmärk ja minimaalne V1 allowlist.
- Õ-AP-1: tervise/RFK/hooldaja väljade alus, retention ja välise faili hoiatus.
- P-AP-1: vähemalt üks päris saaja-piloot, kes valideerib arusaadavuse ja minimaalsuse.
