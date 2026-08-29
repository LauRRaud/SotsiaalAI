# `ST10-05 KRIISITEEKOND-V1` — Kriisiteekonna arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: olemasoleva [`sotsiaalkiirabi-v1-arendusleping.md`](./sotsiaalkiirabi-v1-arendusleping.md)
delta — kiireloomulise abipalve, Teekonna, hääle ja järeltoe integratsioon
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: olemasolev tehniline alus osaline; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2020. aasta kriisi- ja kaugtöökogemus tõi esile digilõhe, katkenud inimkontakti ning pika
järeltoe vajaduse. **Kriisiteekond** ühendab kontrollitud kriisiinfo, päris inimesele kinnitatud
üleandmise, telefoni või abistatud kasutuse varutee, kokkulepitud järelkontaktid ja võimaluse
jätkata pärast kiiret hetke inimese enda Teekonnal.

Platvorm ei ole häirekeskus ega loo reageerijat. Kui mehitatud partnerit pole, ei kuvata
digitaalset saatmisrada toimiva abina.

## 2. Sobivus olemasoleva platvormiga

Parent on [`sotsiaalkiirabi-v1-arendusleping.md`](./sotsiaalkiirabi-v1-arendusleping.md);
see fail ei loo teist kiire abi domeeni ega kirjuta ümber selle E1–E6 rada.

**Koodis olev alus:** kiireloomulise abipalve vorm, laua readiness/availability,
take/resolve, handover+accept ning urgent→eelpöördumise DRAFT-konversioon
`components/urgent/*`, `lib/urgent/request.js`, `lib/urgent/deskQueue.js`,
`app/api/urgent-requests/**`; SOTSIAALKIIRABI-V1 E1–E6 on kanoonilise seisu järgi koodis ja
peidus. Olemas on ka ruumid, hääl, teavitused, Teekond ning 112/Lasteabi/Ohvriabi suunamine.

**Puudu või tõendamata:** päris lepinguliselt mehitatud KOV/teenusepartneri runtime ja vastutus,
abistatud/telefonirada, ajastatud järelkontakti vastuvõtt ning kiirest palvest inimese kinnitatud
Journey-jätk. Tehniline desk-capability on olemas, kuid ei tõenda päris mehitatust.

## 3. V1 kasutajatee

1. Enne sisestamist näeb inimene, kas laud on päriselt mehitatud, millal palvet loetakse ja
   mida teha vahetu ohu korral.
2. Vahetu ohu või seadusega määratud kriisikanali korral suunatakse 112/Lasteabi/Ohvriabi
   juurde ning tavalist järjekorrakirjet ei looda.
3. Muul kiirel juhul koostab inimene või abistaja minimaalse palve ja näeb 1:1 eelvaadet.
4. Mehitatud saaja kinnitab vastuvõtu, võtab vastutuse või suunab kokkulepitud fallback'i.
5. Lepitakse kokku järgmine päris kontakt, selle aeg ja vastutav roll; vastuvõtt on nähtav.
6. Pärast kiiret faasi saab inimene oma kinnitatud kokkuvõtte Teekonnale võtta või sellest
   eelpöördumise teha. See ei juhtu automaatselt.

## 4. Tootepiirid ja invariandid

- Ei automaatset triaaži, kiireloomulisuse skoori ega AI otsust selle kohta, kes abi saab.
- Ei lubata reageerimisaega, lugemisaega ega järelkontakti, mida partner pole võtnud.
- Kriisi vabatekst ei lähe sündmuste, organisatsioonikoondi ega üldise RAG-i sisuks.
- Hääl on sisestusviis; transkriptsioon on enne saatmist inimesele nähtav ja parandatav.
- Abistaja ei saa saata inimese nimel ilma nähtava rolli ja õigusliku aluseta.
- Laua puudumine, suletus või aegumine sulgeb saatmisraja ning näitab päris alternatiive.
- Funktsioon ei asenda 112, Lasteabi, Ohvriabi, tervishoidu ega kohaliku omavalitsuse kohustust.

## 5. Minimaalne andmeleping

Palve kasutab olemasolevat urgent-request mudelit ja minimaalset allowlist'i. Lisanduda võivad
kanal (tekst/hääl/abistatud/telefonis sisestatud), abistaja roll ja alus, järelkontakti aeg,
vastutav roll, vastuvõtukinnitus, aegumine ning Teekonnale viimise inimese kinnitus.

Desk capability on serveripoolne fakt: piirkond, lahtiolek/mehitus, lubatud palve tüüp,
lugemis- ja aegumisleping ning fallback. Audit on sisutu. Järelkontakti vabatekst ei lähe
teavituse payload'i.

## 6. Teostusetapid

### E0 — partneri- ja capability-leping

- Lukusta ühe päris pilootlaua vastutaja, mehitusajad, lugemisleping, fallback, aegumine ja
  järeltoe omanik. Kood üksi seda etappi ei lõpeta.
- Lepita olemasolev SOTSIAALKIIRABI-V1 kood kanoonilise seisu vastu; ära ehita teist palvevoogu.
- Sõnasta täpsed vahetu ohu negatiivrajad.

### E1 — olemasoleva capability aus kasutajapind ja karastus

- Taaskasuta `deskReadiness()` / `resolveUsableDesk()` sama reeglit vormis, availability API-s,
  loomisel ja handover'is; ära loo teist valmisolekuotsustajat.
- Kuva mehitus, lugemisaeg, aegumine ja alternatiivkanalid inimesele enne sisu sisestamist.
- Kontrolli, et vormi avatus ei sõltu ainult kliendipoolsest feature flag'ist ning ükski delta
  ei nõrgenda olemasolevat fail-closed capability't.

### E2 — abistatud ja hääle sisestus

- Kasuta olemasolevat dikteerimise/hääle rada parandatava tekstina.
- Lisa abistaja roll, inimese kinnitus ja telefonis saadud info minimaalne sisestusviis.
- Ära salvesta heli vaikimisi ega lisa varjatud transkriptsiooni.

### E3 — vastuvõtt, handover ja järelkontakt

- Taaskasuta olemasolevat vastuvõtu/üleandmise olekumasinat.
- Lisa nimelise rolli järelkontakt, vastuvõtt, tähtaeg, ebaõnnestumise fallback ja sisutu
  teavitus.
- Vana vastutaja ei vabane enne uue vastuvõttu.

### E4 — Teekonnale jätk

- Koosta kiire faasi järel inimesele parandatav kokkuvõte.
- Taaskasuta olemasolevat idempotentset urgent→`PreInquiry` DRAFT-konversiooni; Teekonnale või
  eelpöördumisse liigub ainult inimese kinnitatud valik ning teist konverterit ei looda.
- Kriisi sisemine märge ja inimese pikaajaline narratiiv jäävad eri nähtavusega.

### E5 — käsitsi partnerirada ja ligipääsetavus

- ET/EN/RU, lihtkeel, klaviatuur, ekraanilugeja, mobiil, halb ühendus ja telefonialternatiiv.
- Käsitsi kontrolli vahetu oht, suletud laud, avatud laud, vastuvõtt, handover, järelkontakt,
  aegumine ja Teekonnale jätk sünteetiliste andmetega.

## 7. Vastuvõtukriteeriumid ja DoD

Koodiviil on valmis siis, kui suletud/mehitamata laud on fail-closed, avatud laua palve saab
päris vastuvõtukinnituse, handover ei jäta vastutuse tühimikku, järelkontaktil on nõustunud
saaja ning inimene saab kinnitatud kokkuvõtte enda Teekonnale võtta. **Aktiveeritud** on
funktsioon alles siis, kui partnerirada on lepinguliselt mehitatud ja käsitsi tõendatud.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi sünteetiline partnerirada. Automaatteste ega sonde ei looda ega käivitata;
kontrollimata käitumine jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- P-KT-1: mehitatud KOV/teenusepartner ja nimeline vastutus.
- Õ-KT-1: abistatud/telefonis sisestamise õiguslik alus, teavituskohustus ja säilitus.
- O-KT-1: järelkontakti maksimaalne aeg ja fallback; vaikimine ei ole vastuvõtt.
- Feature flag jääb välja, kuni serveris on kehtiv desk capability.
