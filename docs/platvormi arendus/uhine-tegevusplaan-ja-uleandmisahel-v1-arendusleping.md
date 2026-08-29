# `ST10-02 UHINE-TEGEVUSPLAAN-V1` — ühise tegevusplaani ja üleandmisahela arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: COLLAB/JTA tervik- ja laiendusleping
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: staatiline kaart; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2017. aasta artiklikiht toob esile jagatud eesmärgi, selged rollid, vastutuse ning
eesmärgipärase ja minimaalse andmevahetuse. Funktsioon annab inimesele ja tema valitud
osalistele ühe kontrollitud vaate: **mida püüame saavutada, kes teeb mida ja mis ajaks, millist
infot selleks päriselt vaja on ning kas uus vastutaja võttis ülesande vastu**.

## 2. Sobivus olemasoleva platvormiga

**Olemas ja taaskasutatav:**

- JTA töökorraldus, kohtumise ettevalmistus ja päritolu — koodis, peidetud;
- `NetworkShare` külmutatud nõusolekuga jagamine ja „Minu jagamised”:
  `lib/network/share.js`, `components/network/*`, `components/sharings/MySharingsPage.jsx`;
- ruumide liikmelisus, kinnitatud kokkuvõte ja teavitused;
- kiire abipalve handover + vastuvõtukinnitus: `lib/urgent/request.js`,
  `app/api/urgent-requests/**/handover*`;
- organisatsiooni assignment/handoff: `lib/org/inbox.js`, `components/org/OrgInboxClient.jsx`.

**Pooleli või puudu:** üks versioonitud eesmärk–tegevus–vastutaja–tähtaeg–minimaalne info–
vastuvõtt–tulemus kandja; COLLAB-P6 ühine kohtumis-/tegevusplaan; inimese kinnituse ja
professionaalse töömärkme range eristus. Vanad COLLAB lepingupäised ei ole teostusseisu allikas.

## 3. V1 kasutajatee

1. Inimene või volitatud spetsialist alustab ühise eesmärgi mustandit.
2. Inimene kinnitab enda eesmärgi ja jagatavad lähtefaktid.
3. Iga tegevus saab tegija, tähtaja, vajalike väljade allowlist'i ja päritolu.
4. Kutsutud tegija näeb enne vastuvõttu sisu, vastutust ja nähtavuspiiri ning võtab ülesande
   vastu või keeldub põhjusega.
5. Vana vastutaja vastutus ei lõpe enne uue vastuvõtukinnitust.
6. Tegevuse tulemus ja järgmine samm lisatakse uue versioonina. Osaleja näeb, mis muutus.
7. Inimene saab tulevase ligipääsu tagasi võtta; ajalooline vastuvõtu- ja tegevusfakt säilib
   minimaalselt vastavalt retention-lepingule.

## 4. Tootepiirid ja invariandid

- Üks plaanikandja teenindab ka ST10-04 hooldaja vaadet ja ST10-09 vajaduse üleandmist.
- Ruumi, organisatsiooni või ülesande liikmelisus ei ava automaatselt juhtumit, Teekonda,
  STAR2 mustandit ega teisi tegevusi.
- AI ei määra eesmärki, vastutajat, tähtaega, õiguslikku alust ega tegevuse tulemust.
- Kliendi/pöörduja osa on enne jagamist külmutatud ja inimese kinnitatud.
- Privaatne professionaalne refleksioon, sisemärkmed ja teise inimese andmed ei jõua plaani.
- Sündmus/outbox kannab ID-d, olekukoodi ja aega, mitte plaani vabateksti.
- Plaan ei ole ametlik STAR/SKAIS/EHIS juhtumiplaan ega asenda asutuse dokumenteerimiskohustust.

## 5. Minimaalne andmeleping

Plaan: omanik/kontekst, inimese kinnitatud eesmärk, versioon, olek ja osalised. Tegevus:
kirjeldus, tegija roll/ID, tähtaeg, päritolu, minimaalse info võtmed, vastuvõtuseis, tulemus ja
järgmine samm. Üleandmine: andja, saaja, eesmärk, versioon, saadetud väljade võtmed, saatmise,
vastuvõtu või keeldumise aeg ja põhjus.

Vabatekst ei lähe üldisesse auditisse. Plaani sisu säilib ainult vajalikus töövoos;
ligipääs, arhiveerimine, kustutamine ja saadetud snapshot'i eluiga lahendatakse parent-objekti
ning konkreetse jagamise alusel, mitte ühe platvormiülese tähtajaga.

## 6. Teostusetapid

### E0 — COLLAB/JTA doonorite lepitamine

- Kontrolli värske koodi vastu NetworkShare, ruumi, JTA, org assignment'i ja urgent handover'i
  tegelik seis; ära kopeeri aegunud lepingupäiseid.
- Lukusta üks plaanikandja, nähtavusmaatriks ja versioonireegel.
- Määra ST10-04 ja ST10-09 laienduskohad samale kandjale.

### E1 — domeen ja omanikupiir

- Loo plaani, tegevuse, osaluse, vastuvõtu ja versiooni teenus ühe tehingulise piiri ümber.
- Iga lugemine/kirjutus on serveris parent-objekti ja rolli järgi scope'itud.
- Vastuvõtt/keeldumine ja vastutuse üleminek kasutavad tingimuslikku olekusiiret.

### E2 — koostamise ja kinnitamise pind

- Lisa ühise eesmärgi, tegevuste, vastutajate ja tähtaegade vaade.
- Näita eraldi inimese kinnitatud osa, spetsialisti töömärget ja AI mustandit.
- Kutsu saaja olemasoleva kutse/teavituse kaudu; väldi uut teavitussüsteemi.

### E3 — üleandmine ja vastuvõtukinnitus

- Loo 1:1 eelvaade minimaalsest saadetavast sisust.
- Saaja aktseptib või keeldub; andja näeb olekut ja aegumist.
- Üleandmine ei märgita lõpetatuks enne vastuvõttu ega kokkulepitud fallback'i.

### E4 — järeltegevus ja ajalugu

- Lisa tulemus, järgmine samm, tähtaja muutmine, uue vastutaja handover ja supersede-versioon.
- Tegevusajalugu näitab fakti ja muudatust, mitte kõigi varasemate tundlike väljade koondit.
- Seo sobivad sündmused Töölaua naasmispunkti ja sisutute teavitustega.

### E5 — ligipääsetavus ja käsitsi tervikrada

- ET/EN/RU, klaviatuur, ekraanilugeja, mobiil, reduced motion, tühi/keeld/timeout/konflikt.
- Käsitsi rada vähemalt inimese, andja, saaja ja võõra rolliga; kontrolli ka tagasivõttu ning
  vana vahekaardi konflikti.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis on siis, kui ühisel eesmärgil saab olla mitu tegevust, iga tegevuse vastutaja võtab
selle teadlikult vastu, minimaalne info on eelvaates nähtav, vastutuse üleminek ei jäta tühimikku,
muudatused on versioonitud ning võõras osaline ei saa parent-objekti ega teisi tegevusi lugeda.
ST10-04 ja ST10-09 saavad sama kandjat laiendada uut plaanimudelit loomata.

Kontroll: asjakohane lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`,
peatüki lõpus build ning käsitsi mitme rolli runtime-rada. Automaatteste ega sonde ei looda ega
käivitata; kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-UTP-1: kes võib algatada plaani inimese eest; V1 safe default — inimene või temaga juba
  õiguspärases juhtumisuhtes volitatud spetsialist, alati inimese kinnitusega jagatava osa puhul.
- O-UTP-2: vastuvõtu aegumine ja fallback; ei tohi vaikimisi lugeda vaikimist vastuvõtuks.
- Asutusteülene aktiveerimine vajab osalevate organisatsioonide rolle, vastutust ja retention'i
  kirjeldavat partnerlepet.
