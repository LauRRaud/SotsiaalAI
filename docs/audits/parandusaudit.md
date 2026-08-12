# Parandusaudit — SOL-süvaauditi seis

**Tuletatud loend. Olekut kannab `sotsiaalai-sol-suvaaudit.md` ise** (Seis-lõik iga leiu all);
see fail on ainult ülevaade ja ta ei ole allikas. Numbrid on **loetud raportist**, mitte
käsitsi kokku pandud — ja alates 11.08 on sellel väitel ka kate: **`npm run sol:tally`**
(`scripts/sol-audit-tally.mjs`) loendab `### SOL-XXX-NN — … — Pn` pealkirju ja loeb tehtuks
ainult need, mille Seis-lõik ALGAB sõnaga `DONE`. Käsitsi siia numbreid enam ei kirjutata.
Mõõdetud **12.08.2026** (kümnes mõõtmine, pärast SOL-PAY-06/-07); eelmised olid pärast
SOL-PAY-02/-03, SOL-AUTH-15, -09/-10, -08/-12/-13 ja -07/-11 koos loenduri enda parandusega.

**Selle faili jutustav osa („Mis on tehtud") lõpeb SOL-CHAT-08 juures ja on sealt edasi
maas.** SOL-VOICE, SOL-ROOM, SOL-CALL, SOL-INV ja SOL-PAY plokke siin lahti kirjutatud ei ole —
nende Seis-lõigud elavad raportis, kes on ainus allikas. Numbrid allpool on `sol:tally` omad ja
nad on värsked; jutustuse järelejõudmine on eraldi töö.

**Loendur ise oli 11.08-ni vaikiv ja andis seetõttu vale nimetaja.** Range muster tundis
ainult kaheosalist koodi, seega jätkufaili `SOL-DOC-J-01…-06` (6 leidu) ei olnud kordagi
loenduses — sama veaklass, mille pärast loendur üldse kirjutati (SOL-MAT). Parandatud:
`-J` on tunnustatud jätku-nimeruum ja kuulub oma peatüki (`SOL-DOC`) alla, ning loendur
**kukub nüüd nimeliselt**, kui mõni `### SOL-…` pealkiri rangele mustrile ei vasta —
vaikselt väiksemat nimetajat ta enam anda ei saa (`tests/scripts/solAuditTally.test.js`).

## Kokkuvõte

| | |
|---|---|
| Tehtud leidu | **140 / 403** selle tööpuu loenduri järgi · **140 / 429** kogu auditikorpuse peale — **26 leidu üheksas failis ei ole `main`-is**, vt „Auditikorpus ei ole ühes puus" allpool |
| Peatükke lõpuni | **11 / 39** — SOL-SCHEMA, SOL-BUILD, **SOL-AUTH**, SOL-RAGADMIN, SOL-FIELD, SOL-MEET, SOL-CHAT, **SOL-VOICE**, **SOL-ROOM**, **SOL-CALL**, **SOL-INV** |
| Lahtised prioriteedi järgi | **P0-sid EI OLE** · 185 × P1 · 77 × P2 · 1 × P3 (selle puu loenduri järgi; kogu korpuses 289) |
| Nimetaja kasvas 357 → 397 → **403** | **jätkuauditid, mis olid siit loendist täielikult väljas.** Vt eraldi lõiku allpool — see ei ole tagasiminek, vaid see, et loendus ei näinud esmalt seitset faili ja seejärel kuut leidu neist ühes. |
| Toodangus | **DEPLOY'MATA JÄÄK: 25 leidu** — SOL-AUTH-14 (`b7539345`, `origin/main`-is), SOL-AUTH-15 (**vajab migratsiooni `20260811220000`**), kogu SOL-VOICE (01…03), kogu SOL-ROOM (01…07), kogu SOL-CALL (07…09), kogu SOL-INV (01…03) ja SOL-PAY-01…-07 (**vajab migratsioone `20260811230000`, `20260812010000` ja `20260812020000`**; toodangu PostgreSQL on mõõdetuna 16.14, seega `ALTER TYPE … ADD VALUE` migratsioonitehingus on lubatud). Viimane deploy oli viieteistkümnes, 11.08 18:31: server = `1ed23452`. Kõik 115 selle-eelset tehtud leidu on tootmises — see deploy viis välja kogu ülejäänud SOL-AUTH ploki (-07, -11 ja -08…-10, -12, -13). Mõõdetud: `.next` 18:31:01, kolm teenust `active`, `/` `/vestlus` `/toolaud` **200**, veatasemel logi tühi. Migratsioon **`20260811210000`** rakendatud 18:30:20 (`AuthThrottleCounter` olemas) ja `/etc/sotsiaalai/frontend.env`-i lisatud **`TRUSTED_PROXY_IP_HEADER=x-real-ip`** (varukoopia tehtud; nginx `proxy_set_header X-Real-IP $remote_addr` kirjutab päise üle, seega ta ei ole kliendi juhitav). **Läbiv smoke toodangus:** tundmatu e-post annab `401 INVALID_CREDENTIALS` 0,38 s (bcrypt jookseb) ja tekitab **mõlemad** loendurid `pin:email` + `pin:ip` — seega usaldatud IP luges päriselt. Sondi read koristatud. |
| Järgmine peatükk | **SOL-AUTH (15/15), SOL-VOICE (3/3), SOL-ROOM (7/7), SOL-CALL (13/13) ja SOL-INV (3/3) on lõpetatud** — üksteist täis peatükki. Käsil on **SOL-PAY (7/11)**: lahtised on PAY-08, -10 ja -11 ning **PAY-09, mis ootab omaniku + juristi/raamatupidaja otsust** (konto kustutamine kaskaadib makseajaloo enne seitsmeaastast säilitustähtaega). Vt ka lahtist jätkufailide otsust allpool. |
| Suurimad lahtised sabad | SOL-RAGSVC 26 · SOL-SLOG 19 · SOL-WB 18 · SOL-PRE 16 · SOL-JOUR 15 · SOL-SUP 15 · SOL-HELP 13 · SOL-MAT 13 · SOL-NET 11 · SOL-URG 11 |
| Lahtine tooteotsus | **kas jätkufailid liidetakse peaauditi dokumendijärjekorda või jäävad eraldi järjekorraks.** Kuni see on lahtine, ei ole „järgmine dokumendi järjekorras" üheselt määratud. |

## Auditikorpus ei ole ühes puus (mõõdetud 11.08 hilisõhtul)

**Audit ise on lõpuni viidud** — kõik 20 funktsiooni, Haldus, Ruumid ja Töölaud on kaetud ning
lisandus funktsioonideülene ring (kustutus, andmekoopia, retention, RAG, failid, SMTP,
süvalingid, rolli- ja organisatsioonivahetus, samaaegsus). **Tema failid on aga laiali seitsmes
tööpuus ja üheksa neist ei ole `main`-is.** Seepärast ei saa ükski loendurijooks praegu anda
tervikpilti: `npm run sol:tally` loeb ainult neid faile, mis on TEMA puus.

| Fail | Leiud | Kus ta on | Seis |
|---|---|---|---|
| `…-jatk-valitoo.md` | 11 | `SotsiaalAI-sol-audit-field-eaca270` | commit `335fa002`, **lahtine pea** |
| `…-jatk-teenuspaevik.md` | 7 | `SotsiaalAI-sol-audit-slog-11bc4f3` | commit `e82fc587`, **lahtine pea** |
| `…-funktsioonideulene-lopetus.md` | 3 (`SOL-XFUNC-01…-03`) | `SotsiaalAI-sol-audit-smapclose-a4e00e4` | **jälgimata fail** |
| `…-jatk-organisatsioonid-lopetus.md` | 2 | `SotsiaalAI-sol-audit-orgclose-a4e00e4` | commit `d0892171`, **lahtine pea** |
| `…-jatk-minu-jagamised-lopetus.md` | 2 | `SotsiaalAI-sol-audit-shares-a4e00e4` | commit `116c99e6`, **lahtine pea** |
| `…-jatk-teenusekaart-lopetus.md` | 1 | `SotsiaalAI-sol-audit-smapclose-a4e00e4` | **jälgimata fail** |
| `…-jatk-tooheaolu-lopetus.md` | 0 | `SotsiaalAI-sol-audit-wellclose-11bc4f3` | commit `ecc0cdb6`, **lahtine pea** |
| `…-jatk-register.md` (raportiregister) | 0 | `SotsiaalAI-sol-audit-smapclose-a4e00e4` | commit `fc34d636`, **lahtine pea** |
| `…-loppkoond.md` | 0 | `SotsiaalAI-sol-audit-smapclose-a4e00e4` | **jälgimata fail** |

**Kokku 26 leidu, mida selle puu loendur ei ole kordagi näinud** — seega tegelik nimetaja on
**429**, mitte 403, ja lahtiseid on **312**, mitte 286. Prioriteedijaotust ei saa siia kirjutada
enne, kui failid on ühes puus ja loendur jookseb korra terve korpuse peal: käsitsi kokku pandud
jaotus on täpselt see viga, mille pärast loendur üldse kirjutati.

**Kolm uut leidu** on funktsioonideülesest ringist: `SOL-XFUNC-01` (P2, Haldus ei ole URL-iga
taastatav ja jätab kolm halduspinda menüüst välja) · `SOL-XFUNC-02` (P2, Ruumid eirab serveri
tegevuslippe ja peidab keelatud kustutuse vea) · `SOL-XFUNC-03` (P1, isikuandmete koopia
registril puudub skeemiülene täielikkusvärav).

**See on andmekao risk, mitte korrastusküsimus.** „Lahtine pea" tähendab detached HEAD-i, mille
peale ei näita ükski haru — kui tööpuu kustutatakse või `git gc` jookseb, kaob commit. Kolm
faili ei ole üldse commit'itud. **Kuus commit'i on lisaks tehtud `a4e00e43` pealt, mis on
rebase-EELNE koopia** (`main`-is on tema sisu `1ed23452` all), seega nende `parandusaudit.md`
ja `sotsiaalai-sol-suvaaudit.md` versioonid on **vanemad kui siinsed** — koondamisel võetakse
neist AINULT uued failid, mitte nende versioonid nendest kahest.

**Sama klassi lahtine asi kõrval:** teenusekaardi klaaskujunduse parandus (`workspace.css`,
`ServiceMapLeaflet.jsx`, `WorkspaceFeaturePage.jsx` + kaks visuaallepingu testi, +307/−85) elab
tööpuus `SotsiaalAI-service-map-glass-a4e00e4` **commit'imata**. Haru
`codex/service-map-glass-visual-fix` on olemas, aga ta ei kanna ühtki oma commit'i — ta on
lihtsalt silt `a4e00e43` peal. „Parandus on harus" ei pea mõõdetuna paika.

**Autenditud tervikruntime jäi selles auditiringis `NOT_PROVEN`:** viis sünteetilist kontot olid
olemas, aga 0/5 credential'ist kehtis. Kontosid ega seansse ei muudetud. Lokaalse testkeskkonna
taastamine (vt SotsiaalAI.md S11) on eeldus, mitte kõrvalmärkus.

## Jätkuauditid — miks nimetaja muutus

Loendus luges ainult peafaili pealkirju, seega **iga jätkufail oli tema alt väljas**. 11.08
õhtuks on neid seitse, kokku **46 leidu, kõik NOT_DONE**:

| Jätkufail | Peatükk | Leiud | Mida ta teeb |
|---|---|---|---|
| `…-jatk-materjalid.md` | SOL-MAT | 13 | **uus peatükk** |
| `…-jatk-teenusekaart.md` | SOL-SMAP | 8 | **uus peatükk** |
| `…-jatk-minu-jagamised.md` | SOL-SHARE | 5 | **uus peatükk** |
| `…-jatk-koosta-dokument.md` | SOL-COMP | 5 | **uus peatükk** |
| `…-jatk-organisatsioonid.md` | SOL-ORG | 5 | laiendab **lõpetatuks loetud** peatükki |
| `…-jatk-tooheaolu.md` | SOL-WB | 4 | laiendab olemasolevat (14 → 18) |
| `…-jatk-dokumendid.md` | SOL-DOC | 6 | laiendab **lõpetatuks loetud** peatükki (9 → 15); ainus **`-J` nimeruumiga** fail |

Kolm tagajärge, mis ei ole kosmeetika:

- **„SOL-ORG 12/12 tehtud" ei kehti enam** — SOL-ORG-13…-17 on lahtised.
- **„SOL-DOC 9/9 tehtud" ei kehti enam** — `SOL-DOC-J-01…-06` on lahtised, sh **`-02`
  paralleelsed muudatused kirjutavad vaikides üksteise üle** ja **`-03` RAG-kasutusloa
  tagasivõtmine ei eemalda indekseeritud koopiat** (mõlemad P1). Koos SOL-ORG-iga on
  lõpetatud peatükke **6**, mitte 8.
- **SOL-MAT-01 on serveripiiri puudumine tasulisel spetsialistifunktsioonil** — iga autentitud
  konto saab otse-API kaudu üles laadida. See ei ole ääreala ja ta ei olnud kunagi loendis.

**115 tehtud leidu on 11.08 18:31 seisuga tootmises. Deploy'mata on kaks: SOL-AUTH-14 ja
SOL-AUTH-15**, viimane koos migratsiooniga `20260811220000` (uus tabel
`VerificationLinkDispatch`; olemasolevaid ridu ei puudutata).

**Üks asi, mille see ring välja tõi ja mis on siia varem valesti kirjutatud:** eelmine
versioon väitis, et „AUTH-03…-07 ja -11 on `origin/main`-is". Mõõdetuna oli **`a4e00e43`
(AUTH-07/-11) push'imata** ja harud olid lahknenud — teine sessioon oli sama vanema (`58e379a8`)
pealt push'inud kaks PWA-commit'i. Rebase tehti eraldi worktree's, et peatöölaua võõrast
poolelolevat tööd mitte puutuda, ja mõlema commit'i sisu on rebase'i järel bait-täpselt sama.
Reegel jääb: **serveri ja `origin/main`-i seisu ei võeta selle faili pealt, vaid mõõdetakse.**
Kolmeteistkümnes deploy
(11.08 13:06, server `27af4a02`) viis välja kogu SOL-CHAT-01…-08 ploki koos migratsiooniga
**`20260811160000`** (uus tabel `ChatTurn` + enum `ChatTurnStatus`; olemasolevaid ridu ei
puudutatud) ning ühtlasi eelmisest ringist üle jäänud SOL-MEET-05/-06.
Üheteistkümnes deploy (11.08 10:17) oli kogu SOL-DOC (01…09) ja SOL-RES-01…-07 kahe
migratsiooniga. `ResearchJob` ja `MeetingSummaryJobClaim` on toodangus mõlemad 0 rida, seega
mõlemad unikaalsed indeksid läksid läbi triviaalselt — esimesed päris kinnitused tulevad alles
päris koormusega. **Enne deploy'd mõõdetud:** SOL-MEET-03 snapshotikataloog oli toodangus tühi,
seega uuel koristusel ei olnud midagi kustutada.
Ainus P3 kogu auditis on SOL-SEARCH-i oma ja teda ei ole allpool eraldi veerus.

**Deploy-järgne kontroll tõi ühe asja välja:** `npm run rag:path:probe` — RAGSVC-01/02
HTTP-negatiivtest, mis oli teadlikult deploy'd ootamas — andis esimesel jooksul
`PROBE_FAIL 6/7`, **aga viga oli sondis, mitte serveris**. Kettalt mõõdetuna ei olnud ühtki
faili hoidlast väljas. Sondi otsustusreegel oli iseenesest tõene (`/rag-escape-probe/`
vastab vaenuliku faili enda nimele ka pärast korrektset puhastust). Parandatud: sond õpib
hoidla juure kontrollfailist ja küsib „kus fail on", mitte „kas nimi näeb kahtlane välja".
Teine jooks: **`PROBE_OK 8/8`**.

## Peatükid dokumendi järjekorras

Tabel on `npm run sol:tally` väljund; järjestus on peatüki ESIMESE leiu koht dokumendis.
Jätkufailidest tulnud leiud on read sees ja märkuses eraldi välja toodud.

| Peatükk | Kood | Tehtud | Lahtised | Märkus |
|---|---|---|---|---|
| Skeemi ja Prisma mudeli vastavus | SOL-SCHEMA | **1/1** | – | **tehtud** |
| Build | SOL-BUILD | **1/1** | – | **tehtud** |
| Autentimine ja autoriseerimine | SOL-AUTH | **15/15** | – | **tehtud** — auditi suurim lõpetatud peatükk |
| Juhtumitöö (JTA-V1) | SOL-CW | 17/20 | 2 × P1 · 1 × P2 | kolm kvalifitseeritud seisu, vt allpool |
| RAG-i admin ja failihaldus | SOL-RAGADMIN | **4/4** | – | **tehtud** |
| Organisatsioonid ja skoop | SOL-ORG | 12/17 | 2 × P1 · 3 × P2 | **enam mitte lõpetatud** — 5 leidu jätkufailist |
| Välitöö | SOL-FIELD | **6/6** | – | **tehtud** |
| Dokumendid ja AI-kasutus | SOL-DOC | 9/15 | 3 × P1 · 3 × P2 | **enam mitte lõpetatud** — 6 leidu jätkufailist (`SOL-DOC-J-*`) |
| Uuringud | SOL-RES | 6/7 | 1 × P2 | lahtine ainult RES-07 (kvalifitseeritud) |
| Koosolekukokkuvõtted | SOL-MEET | **6/6** | – | **tehtud** |
| Vestlus | SOL-CHAT | **13/13** | – | **tehtud** |
| Hääl (STT/TTS) | SOL-VOICE | **3/3** | – | **tehtud** |
| Ruumid | SOL-ROOM | **7/7** | – | **tehtud** |
| Kõned ja salvestus | SOL-CALL | **13/13** | – | **tehtud** |
| Kutsed ja sponsorlus | SOL-INV | **3/3** | – | **tehtud** |
| Maksed | SOL-PAY | 7/11 | 2 × P1 · 2 × P2 | käsil; PAY-09 ootab otsust, vt allpool |
| Teavitused | SOL-NOTIF | 0/7 | 3 × P1 · 4 × P2 | |
| Domeenisündmused | SOL-EVENT | 0/1 | 1 × P2 | |
| Kiireloomuline abi | SOL-URG | 2/13 | 11 × P1 | mõlemad P0-d tehtud |
| Tööheaolu | SOL-WB | 0/18 | 12 × P1 · 6 × P2 | 4 leidu jätkufailist |
| Teenuspäevik | SOL-SLOG | 5/24 | 18 × P1 · 1 × P2 | **P0-dest tühi**, SLOG-01/13/14/17/18 tehtud |
| RAG-teenus ja ingest | SOL-RAGSVC | 2/28 | 19 × P1 · 7 × P2 | suurim peatükk; mõlemad P0 tehtud |
| Migratsioonid | SOL-PRISMA | 0/4 | 3 × P1 · 1 × P2 | |
| Mentorlus | SOL-MENT | 0/7 | 7 × P1 | |
| Supervisioon | SOL-SUP | 0/15 | 11 × P1 · 4 × P2 | |
| Kovisioon | SOL-COV | 0/8 | 8 × P1 | |
| Tõenduspõhised praktikad | SOL-PRAC | 0/8 | 8 × P1 | |
| Teemaseemned | SOL-SEED | 0/5 | 3 × P1 · 2 × P2 | |
| Teekond ja jagamine | SOL-JOUR | 2/17 | 12 × P1 · 3 × P2 | mõlemad P0 tehtud |
| Eelpöördumised | SOL-PRE | 2/18 | 15 × P1 · 1 × P2 | mõlemad P0 tehtud |
| Abikuulutused | SOL-HELP | 0/13 | 11 × P1 · 2 × P2 | |
| Võrgustikutöö | SOL-NET | 2/13 | 9 × P1 · 2 × P2 | mõlemad P0 tehtud |
| Refleksioonid | SOL-REF | 0/9 | 3 × P1 · 6 × P2 | |
| Otsing | SOL-SEARCH | 0/7 | 1 × P1 · 5 × P2 · 1 × P3 | auditi ainus P3 |
| Teenuseosutaja profiil | SOL-SPROF | 2/15 | 6 × P1 · 7 × P2 | auditi viimased kaks P0-d, mõlemad tehtud |
| Dokumendi koostamine | SOL-COMP | 0/5 | 3 × P1 · 2 × P2 | **ainult jätkufailis** |
| Materjalid | SOL-MAT | 0/13 | 8 × P1 · 5 × P2 | **ainult jätkufailis**, suurim uus peatükk |
| Minu jagamised | SOL-SHARE | 0/5 | 2 × P1 · 3 × P2 | **ainult jätkufailis** |
| Teenusekaart | SOL-SMAP | 0/8 | 3 × P1 · 5 × P2 | **ainult jätkufailis** |

## Mis on tehtud

- **SOL-SCHEMA-01** · **SOL-BUILD-01**
- **SOL-AUTH-01, AUTH-02**
- **SOL-AUTH-03** (11.08) — `VerificationToken.token` kandis paroolitaaste ja e-posti kinnituse
  bearer-tokenit **toorkujul**: andmebaasi lugemisõigus, varukoopia või diagnostikaväljavõte
  andis töötava lingi. Kirja läheb nüüd `raw`, ritta `v2:` + sha256; veerg ise ei muutunud,
  seega migratsiooni ei ole. **Prefiks ei ole dekoratsioon, vaid kogu üleminekumehhanism:**
  pärandread kannavad toorväärtust ja neid otsitakse ka verbatim, AGA ainult siis, kui sisend
  ei ole juba salvestuskujul — ilma selle väravata saaks lugeja kleepida rea väärtuse lingi
  asemele ja leid oleks paranduse enda sees tagasi. Tarbimine sai atomaarse ühekordse claim'i
  (vana `delete` tehingu lõpus tegi topeltklikist 500). `npm run auth:token:probe` **26/26**
  päris PostgreSQL-is, kaks negatiivkontrolli. **Kõrvalleid:** konto kustutus ei tühjendanud
  `password-reset:<email>` nimeruumi.
- **SOL-AUTH-04 + -05 + -06** (11.08) — **üks juur: kinnitus otsustas asjade üle, mida ta ei
  hoidnud kinni.** `-04`: kinnituslingi pelk AVAMINE vahetas identiteedi, seega skanner tegi
  seda kasutaja eest; GET annab nüüd vahelehe ja POST vahetab — muster oli koodibaasis olemas
  (`verify-email`), uut ei ehitatud, ja GET ei tee ühtki DB-päringut. `-05`: `id` ei ole siin
  identiteet, sest resend kirjutab SAMA rea peale ümber — kõik on nüüd ühes tehingus, rea lukk
  tuleb lugemise ETTE ja tarbimine on tingimuslik `deleteMany({ id, tokenHash })`; eraldi
  versiooniveergu ei tehtud, sest `tokenHash` ise on versioon. `-06`: parandus on **järjekord** —
  mint → SAADA → alles siis rotatsioon, seega vana link elab kuni uus on teele läinud; vale
  eduteade asendus 502-ga ja esmane PUT kannab ausat `emailDelivery` seisu.
  `npm run auth:emailchange:probe` **27/27** päris PostgreSQL-is, **kolm negatiivkontrolli**:
  vana GET-rada vahetab identiteedi pelgalt avamisel · vana kinnitusmuster vahetab VANA
  aadressi peale ja hävitab värske tokeni · vana resend-järjekord tapab varem kohale jõudnud
  lingi.
- **SOL-AUTH-07 + -11** (11.08) — **`LoginTempToken` elutsükkel, üks plokk.** `-07`: PIN-i
  vahetus kasvatas ainult `sessionVersion`-it, aga vana PIN-iga alustatud sisselogimine loeb
  tarbimisel KÄESOLEVAT versiooni — rotatsioon nägi välja nagu tühistaks kõik ja ei tühistanud.
  Nüüd kustutatakse samas tehingus `LoginTempToken`, `EmailOtpCode`, `TrustedDevice` ja
  `Session`; sama leping oli kõrval juba kaks korda olemas (paroolitaaste, e-posti vahetus) ja
  PIN-i vahetus oli ainus credential-rotatsioon, mis seda ei teinud. `-11`: sama katse sai
  väljastada mitu usaldatud seadet, sest `usedAt` täideti alles NextAuthis — nüüd tingimuslik
  claim `trustedDeviceId: null` peal (kaotaja seaderida rullub tagasi) + kasutajapõhine
  nõuandelukk `4712`. `npm run auth:attempt:probe` **19/19** päris PostgreSQL-is; tõend on
  **NextAuthi päris `authorize()` vastus**, mitte rea puudumine. Kaks negatiivkontrolli: ainult
  `sessionVersion` EI tühista pooleliolevat sisselogimist · vana muster väljastab samast
  katsest KAKS seadet. **Sond leidis lõksu, mis oleks tõendi tühjaks teinud:**
  `provider.authorize` on next-auth'i tühi stub ja päris funktsioon on
  `provider.options.authorize` — kinni püüdis baasjoone kontroll „enne vahetust ANNAB".
- **SOL-AUTH-08 + -12 + -13** (11.08) — **sisselogimise e-kirja link, üks plokk, ja kõigil
  kolmel oli kõrval juba lahendatud vaste.** `-08`: kinnituslingi pelk AVAMINE kinnitas teise
  faktori, seega postkasti turvaskanner tegi seda konto omaniku eest ja PIN-i teadnud ründaja
  sai oma brauseris sessiooni — GET annab nüüd vahelehe ja POST kinnitab (muster
  `verify-email`-ist, AUTH-04 kaudu), aga **siin ilma auto-submit'ita**: ohver ise võib lingi
  avada, seega ta peab NÄGEMA seadet, aega ja IP-d, mille katset ta kinnitab. `-12`: turvalingi
  origin langes puuduva baas-URL-i korral tagasi kliendi `Host`-päisele — nüüd tuleb ta ainult
  `resolveBaseUrl()`-ist ja funktsiooni allkirjast kadus `request` (päist, mida ei anta, ei saa
  usaldada); ilma originita jääb kiri saatmata ja teist faktorit ei saa läbida. `-13`: resend
  kirjutas uue räsi reale enne maileri kutset, seega SMTP-tõrge tappis kohale jõudnud lingi —
  järjekord on nüüd mint → SAADA → rotatsioon (sama, mis AUTH-06 e-posti vahetuses) ja tõrge
  annab 502 koos ausa tekstiga „varem saadetud link kehtib edasi".
  **`npm run auth:emaillink:probe` 27/27 päris PostgreSQL-is**, kutsudes marsruudi PÄRIS `GET`-i
  ja `POST`-i; kaks negatiivkontrolli: vana GET-rada kinnitab pelgalt avamisel · vana järjekord
  tapab lingi juba enne saatmiskatset. Ühikuid 9. **Brauseris läbi käidud** päris reaga:
  vahelehel `scripts: 0` (ühtki skripti, seega ka mitte auto-submit'i) ja pärast nupuvajutust
  töötab endine ootamis- ja handoff-loogika muutumatuna. Hind on **üks klikk** — omaniku 28.07
  vastuväide käis kinnituse-JÄRGSE kliki kohta, mis jääb lahendatuks.
- **SOL-AUTH-09 + -10** (11.08) — **kaks leidu, mida ei saa eraldi parandada.** `-09`:
  PIN-katsete loendur elas mooduli mälus, seega iga instants pidas oma arvet ja iga restart
  nullis kõik — neljakohalise PIN-i 10 000 variandi juures oli see ainus kaitse. Nüüd on ta
  andmebaasis (`AuthThrottleCounter`, migratsioon **`20260811210000`**), kasutajapõhise
  nõuandeluku `4713` taga, aeglustuse ja turvalise taastamisega; IP tuleb ainult
  konfigureeritud edge-päisest (`TRUSTED_PROXY_IP_HEADER`) ja sealt VIIMASEST väärtusest,
  ilma konfiguratsioonita IP-piiri ei tehta. `-10`: `EMAIL_NOT_FOUND` ja `PIN_INCORRECT`
  asendas üks `INVALID_CREDENTIALS`, **ja ajastus ühtlustus peibutusräsiga** — bcrypt cost 12
  jookseb nüüd ka tundmatul kontol, muidu oleks vastus kordades kiirem ja lekitaks konto
  puudumise ka identse tekstiga. **Kokkupuutepunkt:** loenduri subjekt on e-posti räsi, MITTE
  kasutaja ID — konto järgi käiv lukustus oleks teinud 429-st uue oraakli.
  **`npm run auth:throttle:probe` 23/23 päris PostgreSQL-is**, sh **päris teine protsess**
  (`spawn`, pid kontrollitud) ja restart; negatiivkontrollid: vana mälupõhine loendur annab
  igale instantsile oma täie limiidi · ilma peibutusräsita on tundmatu konto rada kordades
  kiirem. Ühikuid 12. **Brauseris mõõdetud päris HTTP kaudu**: tundmatu 440/442/413 ms vs
  vale PIN 441/437/436 ms, mõlemal sama kood ja sõnum; 9. katse annab 429.
- **SOL-AUTH-14** (11.08) — **väljalogimine ütles „tehtud" enne, kui midagi oli tehtud.**
  NextAuthi `signOut` event kustutas jälgitava sessiooni best-effort'ina ja neelas iga vea
  peale `P2025`: kasutaja kaotas küpsise ja nägi end väljas, aga sama JWT varem kopeerinud
  osapool autoriseeris edasi. Nüüd tühistab `POST /api/profile/logout` rea ENNE küpsise
  eemaldamist ja klient kutsub `signOut()` ainult kinnituse peale — **muster oli olemas ja
  kasutamata**, `logout-all` teeb täpselt sama. `sessionRecordId` loetakse tokenist, mitte
  kliendi kehast, ja kustutus on tingimuslik (`{ id, userId }`), sest `count === 0` tähendab
  kahte vastupidist asja: juba kadunud rida või VÕÕRAS rida. **`npm run auth:logout:probe`
  14/14 päris PostgreSQL-is**; tõend on `refreshTokenAuthorization()` vastus, mitte rea
  puudumine — enne annab, pärast `SESSION_REVOKED`, teine seade jääb sisse. Kaks
  negatiivkontrolli vana raja koodiga: ta raporteeris tõrke kiuste edu · ta kustutas võõra
  sessiooni omanikku küsimata. **Brauseris päris sessiooniga:** `/api/auth/session` annab
  pärast väljalogimist `null` ka siis, kui küpsist ei eemaldatud.
- **SOL-AUTH-15** (11.08) — **peatüki lõpetas leid, kus järjekord oli õige ja omand puudus.**
  Iga paroolitaaste-POST mintis tokeni, saatis lingi ja kustutas siis „kõik ülejäänud" —
  aga „ülejäänud" hulka kuulus ka see token, mille teine samaaegne päring oli just välja
  saatnud. Kaks näiliselt edukat kirja, null töötavat linki; topeltklikk või aeglane tarne
  muutis konto taastamise juhuslikult võimatuks. `mint → SAADA → rotatsioon` (SOL-AUTH-06,
  -13) jäi puutumata; juurde tuli **omand**: identifikaatoripõhine nõuandelukk `4714` ja
  claim'i jälg `VerificationLinkDispatch` (migratsioon `20260811220000`), mis ütleb, MILLINE
  token teele läks. Rotatsioon kustutab ainult neid, mille peale rida ei näita, ja ainult
  siis, kui rida näitab veel minu peale — `count === 0` loetakse siin sama rangelt kui
  AUTH-14-s. Teine samaaegne päring on **idempotentne** (ei mindi, ei saada, vastab `ok`).
  Vananemisaken 2 min on lepingu osa, muidu lukustaks surnud saatja konto igaveseks.
  **`npm run auth:reset:probe` 31/31 päris PostgreSQL-is**; tõend on sama marsruudi `PUT` —
  kasutaja kliki rada — ja token loetakse VÄLJA SAADETUD KIRJAST. Negatiivkontroll jooksutab
  vana rada samas harnessis: mõlemad raporteerivad edu, mõlemad kirjad lähevad teele ja
  andmebaasi ei jää ühtki tokenit. **Kõrvalparandus:** puuduv baas-URL või saatja andis 500
  ainult olemasolevale kontole — konfiguratsioonivea kujul sama oraakel, mille AUTH-10 sulges;
  kontroll käib nüüd enne kasutaja otsimist. **Sama muster elas veel `verify-email` resend'is
  ja registreerimises — mõlemad on nüüd samal rajal** (auditis neid ei ole; tagajärg oli sama:
  kaks paralleelset „saada uuesti" jätsid konto ilma töötava kinnituslingita). Sond mõõdab
  `verify-email`-i eraldi jaamana, **`npm run auth:reset:probe` 35/35**, ja ühiktest nõuab
  jagatud rada kõigilt kolmelt marsruudilt.
- **SOL-VOICE-01, -02, -03** (11.08) — **kogu häälepeatükk ühe plokina, sest kõik kolm elasid
  ühes voos.** `-01`: tundmatu formaadi korral maksis kuni 12 MB tihendatud kõne täpselt
  minuti ühikuid (`|| 60`) ja provideri kinnitatud kestust ei kasutatud arvestuses kunagi —
  lahendus oli koodibaasis olemas ja kasutamata (`lib/usage/sttDuration.js`, SOL-DOC-02).
  Lisaks kadus lipp `transcriptionCompleted`, mis pani commit'i vea kasutaja arvele:
  reservatsioon jäi rippuma JA valmis transkript visati ära. `-02`: neljal providerikutsel ei
  olnud ajapiiri ega päringu signaali — aeglane provider hoidis Next-i töölõnga, liidest ja
  reservatsiooni määramata aja kinni, sest vabastus elab `catch`-is, kuhu igavesti ootel
  promise ei jõua. Nüüd kannab üks signaal kahte ERISTATAVAT sündmust (meie ajapiir → 504,
  kasutaja Stop → 499) ja `withAbort` hoiab piiri ka siis, kui SDK signaali eirab. `-03`:
  „Peata ettelugemine" ei teadnud pooleliolevast serverikutsest midagi — heli võis hakata
  mängima pärast Stop'i, ka pärast lehelt lahkumist; primitiiv oli olemas ja kasutamata
  (`lib/client/latestRequestGate.js`), ja otsus „kas ma tohin veel heli teha" tehakse nüüd
  VASTUSE saabudes. **`npm run voice:settle:probe` 15/15 päris PostgreSQL-is MITTE KUNAGI
  LAHENEVA provideriga**; tõend on `UsageReservation` rida ja ämbri seis. Negatiivkontroll
  sama ämbri peal: vana commit ilma tegeliku kestuseta võtab kogu reservatsiooni, ja 12 MB
  fail, mis vanas rajas maksis 60 sekundit, ei mahu enam 900-sekundilise limiidi sisse.
  **NOT_PROVEN jääb brauserikiht** (DOM-testisviiti ei ole) ja `-01` „transkripti taastamine"
  ainult arvelduse mõttes — teksti ennast `/api/stt` ei püsista, vt leiu Seis-lõiku.
- **SOL-ROOM-01…-07** (11.08) — **kogu ruumipeatükk, neli plokki ühe päevaga.** `-01`: sama
  „leia ruum → leia liikmesus → kontrolli arveldust" otsus elas neljas käsitsi hoitud
  koopias ja KÕIK valisid ruumist ainult `id` ja `helpMatch`, seega `archivedAt` ei jõudnud
  otsuseni kordagi — lõpetatud ruumi sai otse API kaudu edasi kirjutada. Uus jagatud värav
  `lib/rooms/accessGuard.js` eristab kolme lepingut ja kolmas neist (`ROOM_WIND_DOWN`)
  tekkis paranduse kirjutamise ajal: kui kõik kõnemarsruudid oleksid kirjutused, jääks
  arhiveerimise hetkel käimasoleva kõne osaleja LUKKU. **Katvustest käib läbi kõik
  `app/api/rooms` marsruudid** ja erandid on nimeline loend põhjustega. `-02`/`-03`: hiline
  vastus kirjutas teise ruumi vaatesse võõra ajaloo ja SSE lammutas iseennast; otsused
  kolisid Reactist välja (`lib/rooms/roomMessageSession.js`), sest leid ON ajastus. `-04`:
  omanikuvahetus ja lahkumine jätsid ruumi ilma aktiivse omanikuta — mõlemad võtavad nüüd
  sama ruumiluku ja kirjutus on kohtunik; **`npm run room:owner:probe` 22/22 päris
  PostgreSQL-is, deterministlike võistlustega mõlemas järjekorras**, negatiivkontroll rikub
  invariandi. `-05`: kolm elutsüklisiiret said jälje samasse tehingusse, tõend on ROLLBACK.
  `-06`: jagamise kandja kirjutamise vaikiv tõrge jättis kõik ilma privaatkoopiata — nüüd
  üks tehing ja VISKAB. `-07`: saajate ring on jagamise hetk, mitte ruumi lõpp.
  **Kaks testi lukustasid VALE käitumise ja on ümber pööratud.** NOT_PROVEN: HTTP- ja
  brauserikiht.
- **SOL-CW-01…CW-08, CW-10…CW-13, CW-15…CW-18, CW-20** (17 leidu)
- **SOL-RAGADMIN-01, -02, -03, -04** (peatükk lõpuni)
- **SOL-CALL-01, -02, -03** — igal kolmel on vastuvõtukriteeriumist osa katmata, vt leidude
  Seis-lõike.
- **SOL-CALL-04, -05** (10.08) — üks plokk: mõlemad ütlevad, et salvestuse alustamise rajal
  loetakse asju ÜHEKS, ilma et miski neid üheks hoiaks. CALL-04 sai katsepõhise failivõtme ja
  idempotentse korduse; CALL-05 sai unikaalse indeksi + jagatud `upsert`-tee ja on **ainus
  selle päeva parandus, mis on tõendatud päris PostgreSQL-is** (`npm run call:consent:probe` 8/8).
- **SOL-CALL-06** (10.08) — kustutus sai astmelise `DELETE_PENDING` seisu ja lõpetas
  `ok:true` vastamise kustutamata faili kohta. Parandust kirjutades tuli välja **teine,
  raportis kirjas mitte olnud leid**: karantiini pandud toorest egress-faili ei kustutanud
  keegi, sest ta saadeti dokumendisalvestuse teele, kus ta andis neelatud tee-vea. Sama
  neelamine oli teinud `discardActiveRecording()` `DELETED`/`QUARANTINED` valiku surnud
  koodiks. Ketast ennast tõendab ainult mock — vt Seis-lõigu NOT_PROVEN.
- **SOL-CALL-10** (10.08) — salvestis sai kolm piiri, kus enne oli null: voogedastav
  finaliseerimine (mälukulu ei sõltu enam salvestise pikkusest), kestuselagi koos serveri
  automaatse peatamisega ja kvoodireserv enne providerit. Kriteeriumi osa **„jõustada
  maksimaalne kestus provideris"** ei ole teostatav — LiveKit'i egress ei tunne sellist
  seadet — ja ta on Seis-lõigus nimeliselt asendatud serveripoolse valvega.
- **SOL-URG-01** (10.08) — laua järjekord võttis kõik pöördumised vanimast alates ja lõikas
  200 peal, seega ajaloos 200 vanema rea taha jäi iga uus abipalve **deterministlikult**
  nähtamatuks. Töö ja ajalugu on nüüd eri päringud, loendurid tulevad andmebaasist ja kärbe
  ütleb ennast välja. Sama parandus kattis ka `GET /api/urgent-requests?role=desk`, kus oli
  teine koopia samast valikureeglist.
- **SOL-URG-02 + SOL-PRE-01** (10.08) — **kaks P0-d eri peatükkidest, üks tehing.** Konto
  kustutus vastas `ok: true` töö kohta, mida ta ei teinud: kiire abi verbatim-tekst, nimi ja
  telefon jäid alles, saatmata eelpöördumiste mustandid samuti. Neid ei saanud eraldi
  parandada, sest konversioon kopeerib kiire abi teksti mustandisse — ainult ühe sulgemine
  oleks jätnud samad sõnad teise tabeli alla. **Omanikule jääb lahtiseks retentsiooni
  tähtaeg**, vt URG-02 Seis-lõiku.
- **SOL-SLOG-13 + SOL-SLOG-14** (10.08) — kaks P0-d, üks loend. `listShareRecipients()` ei
  ole ainult UI valik, vaid ka saatmise autoriseerimise alus, seega mõlemad andsid ÕIGUST
  kliendinimedega aruandele. SLOG-13: juhiseos lisas saaja ise, vastu mudeli enda invarianti
  („EI ANNA SISUÕIGUSI"). SLOG-14: kaks `OR`-i ühes objektis — teine kirjutas esimese üle ja
  `validUntil` kontroll kadus päris WHERE-st, seega aegunud luba töötas edasi. Kehtivus ja
  skoop on nüüd ühe `AND` harudena: struktuur ise välistab vea.
- **SOL-SLOG-01** (10.08) — seadme `localStorage` oli BRAUSERI oma, mitte konto oma: jagatud
  arvutis nägi järgmine töötaja eelmise kliendi nime ja märkust, ja võrgujärjekord saatis
  need kirjed UUE töötaja teenuskirjeteks. Read on nüüd omaniku ID järgi eraldatud ühe
  jagatud värava taga (`lib/serviceLog/deviceStore.js`), mis annab omanikuta **`null`** —
  identiteedita on seade lukus. Parandus on **tõendatud päris brauseris päris sessiooniga**
  ja tõi välja **kaks raportis kirjas mitte olnud leidu**: mustand kustus lehe avamisel
  (lipp oli viide ja jooksis taastatud väärtustest ette) ning üks ootel kirje läks teele
  kolme POST-iga (voo-lukk puudus). Mõlemad parandatud.
- **SOL-SLOG-17 + SOL-SLOG-18** (10.08) — **kaks P0-d, üks juur.** Külastus ei kandnud
  organisatsioonilist päritolu ja juhi tahvel tuletas skoobi INIMESE kaudu. Kahes majas
  töötaval inimesel on aga üks SOLO-profiil ja üks tööpäev, seega org A juht nägi org B
  klientide nimesid (-17) ja sai teadaoleva `visitId` abil org B töö oma töötajale ümber
  määrata (-18). Neid ei saanud eraldi parandada: mõlema kriteerium algab samast
  külmutatud väljast. `ServiceVisit.assignedOrganizationId` (migratsioon `20260810160000`)
  kirjutatakse seal, kus ta on tõendatud; `NULL` tähendab „mitte kellelegi", mitte
  „kõigile". Ümbermääramine annab võõrale päritolule **404** enne olekukontrolli, ja audit
  on nüüd `$transaction`-is, mitte `.catch(() => {})` taga. Tõendatud päris PostgreSQL-is
  (üks teekond, kaks maja + päritoluta rida; `EXPLAIN` = Index Scan).
- **SOL-RAGSVC-01 + SOL-RAGSVC-02** (10.08) — **kaks P0-d, üks viga:** kliendi tekst
  kasutati failiteena ilma tõendamata, et ta jääb hoidlasse. `-01` andis kirjutamise
  (`raw_path = d / file_name`, kus Pythoni `/` viskab absoluutse parema poole korral vasaku
  ära), `-02` lugemise (kliendi `source_path` → registri `path` → `FileResponse`). Uus
  `rag-service/storage_paths.py` on eraldi moodul, sest `main.py` sõltuvusi ei saa
  ühiktestis laadida — **piir, mida ei saa testida, ei ole piir**. `/ingest/text` salvestab
  nüüd allikateksti ise. Auditis nimetatud ühe lugemiskoha asemel leidsin **kuus**: sama
  registri `path` avatakse ka `reindex`-i kolmes harus, artiklite ingestis ja metaandmete
  uuenduses. **HTTP-negatiivtest on kirjutatud, aga teadlikult jooksmata** — enne deploy'd
  oleks ta ise rünnak päris serveri vastu; `npm run rag:path:probe` ootab deploy-järgset
  käivitust.
- **SOL-JOUR-01** (10.08) — eelpöördumise jagamisvalikuid oli KAKS ja ainult esimene juhtis
  teksti. Teine — see, mida kasutaja näeb vahetult enne adressaadi valikut — filtreeris
  ainult manifesti koopiat; `topic`, `situation` ja kirjamustand jäid esimese projektsiooni
  kujule. Linnuke läks maha, tekst läks adressaadile. Nüüd küsib iga muutus serverilt uue
  projektsiooni ja kõik püsivad väljad tulevad sellest ühest vastusest; kliendipoolne filter
  on kustutatud, mitte parandatud. Vana vaikehulk `personWish` ei kuulunud isegi serveri
  sõnavarasse. **Tõendatud lõpuni: salvestatud andmebaasireas eemaldatud võtme markerit EI
  OLE**, `confirmedKeys` vastab täpselt projektsioonile.
- **SOL-NET-01 + SOL-NET-02** (10.08) — **kaks P0-d, üks juur:** kogu `lib/network/share.js`
  kirjutas mustriga „loe rida → kontrolli mälus → kirjuta `where:{id}`", seega kinnitus
  viitas REALE, mitte tekstile. Parandus on kaks veergu (`contentHash`,
  `confirmedContentHash`, migratsioon `20260810180000`) ja üks primitiiv `commitOnce`, mida
  kasutavad kõik kuus kirjutavat rada. Saatmine nõuab rea tingimuslikult endale **enne**
  ruumi loomist ja teeb mõlemad ühes tehingus — vana järjekord jättis kaotanud saatmise
  järel orvu ruumi ja ruumitõrke järel `CONFIRMED` rea koos ruumiga. Kanooniline räsi-string
  on JS-is ja SQL-is sama; pariteet **mõõdetud**, mitte eeldatud. Sama klassi leid, mida
  raportis ei olnud: avamine-vs-tagasivõtmine, kus mõlemad lähtusid seisust `SENT`.
  Sond `npm run net:share:probe` **30/30 päris PostgreSQL-is**, deterministlike
  lukuvõistlustega mõlemas järjestuses; **vana käitumise vastu 14 passed / 16 failed**.
  Ühiktestide fake sai parandatud (tagastas lugemisel sama objektiviite — just see peitis
  selle veaklassi).
- **SOL-PRE-02** (10.08) — tagasivõetud pöördumise pakett oli organisatsioonile endiselt
  avatav ja uuesti määratav. Parandus on üks invariant kahes tükis: **sisu** peatab
  `projectSourcePackage()` (`recalledAt` → `null`, värav on ainsa ukse sees, mitte
  kutsujates) ja **töö** peatab `isTerminalInboxStatus()`, mis on **tuletatud
  seisumasinast**, mitte teine käsitsi hoitud loend. Kirjutavad rajad võtavad nüüd
  `FOR UPDATE` postkastikirje real **enne lugemist** — seisukontroll üksi ei püüa
  võistlust, sest ta mõõdab hetke, mis on möödas enne, kui ta jõuab otsustada.
  Avamise rajal on **kirjutus kohtunik**: kui `updateMany({openedAt: null, recalledAt:
  null})` ei kirjutanud, loetakse värskelt üle, MIKS. Kolm leidu, mida raportis ei olnud:
  saatja kiirusmärge elas org-tabelis koopiana (kustutatakse tagasivõtmisel + maskeeritakse
  vanadel ridadel), vananenud lugemine oleks andnud sisu ka pärast tagasivõtmist, ja
  `respondToAssignment` sõltus tuletisest. Sond `npm run org:recall:probe` **42/42 päris
  PostgreSQL-is**, deterministlike lukuvõistlustega mõlemas järjestuses; **vana koodi vastu
  21 passed / 21 failed**. Brauseris läbi käidud kahe kirjega kõrvuti.
- **SOL-JOUR-02** (10.08) — Teekonna mustand elas globaalse `sessionStorage` võtme all ilma
  kasutaja ID-ta; sama vahekaardi kontovahetus taastas eelmise inimese olukirjelduse.
  Sama viga mis SOL-SLOG-01, seega kaitse kolis ühte kohta
  (`lib/device/ownerScopedStorage.js`) ja teenuspäevik delegeerib sinna. Tõendatud brauseris:
  vana sildistamata rida kustutati, võõra omaniku rida jäi puutumata ja kummastki ei jõudnud
  ekraanile midagi.
- **SOL-CALL-11, -12, -13** (10.08) — kõneklienti puudutav plokk: kolm leidu elasid kõik
  `components/rooms/useRoomCall.js`-is ja neid parandati koos, sest üks fail on üks sidus
  funktsiooniplokk. **Dokumendi järjekorrast tehti siin teadlik erand**: CALL-12 oli
  peatüki ainus lahtine P0 ja CALL-04…-10 (P1/P2) jäid tema taha ootele. Otsused kolisid
  hookist välja `lib/calls/clientState.js`-i, sest testijooksja ei renderda React-hooke —
  seesama muster, mis JTA E2-s (laua sektsiooni olek). Kõigil kolmel on runtime katmata,
  vt Seis-lõike.

**SOL-SPROF-01 ja -02 (10.08): kood tehtud, seis KVALIFITSEERITUD.** Mõlema juur oli sama —
profiil ütles „eemaldatud" enne, kui midagi oli eemaldatud, ja kaotas seejuures ainsa viida
orvule. Uus jagatud moodul `lib/privacy/serviceProfileRagRemoval.js` kirjutab püsiva
`RAG_DELETE` töö **enne** kustutuskatset ja kustutab `ragSourceId` **ainult kinnitatud
kustutuse järel**; puuduv RAG-võti ei ole enam „skipped". Konto kustutus peidab SOLO-profiili
ja tema kaardikirjed ning kirjutab töö — kõik enne `user.delete`-i, samas lukustatud
tehingus. Uut töölist ei ehitatud: `DataDeletionJob` + `deletionJobRetryService` +
deploy-värav olid olemas. Kolm puuduvat otsa said **10.08 õhtul** kaetud: päringuaegne
fail-closed nõusolekuvärav (`lib/privacy/serviceProfileRetrievalGuard.js`), aus
pending/failed seis liideses ja runtime-tõend päris PostgreSQL-i vastu
(`npm run sprof:consent:probe` 22/22). Ühiktest leidis seejuures, et esimene värav oli
**vales kohas** — `searchRagQueries` tagastab kahest kohast ja ühe päringu kiirtee käis
mööda; värav kolis `searchRagDirect`-i. Teine, seni märkamata uks oli **kovisiooni
teadmusotsing**, mis käib sama RAG-indeksi peal ilma kollektsioonifiltrita.

**Kogu SOL-ORG peatükk (01…12) on 10.08 õhtul tehtud** — auditi neljas lõpuni viidud
peatükk. Muster kordus enamikus: loe seis → otsusta → kirjuta tingimusteta; parandus on kas
`updateMany ... WHERE <eeldatav seis>` või rea lukk ENNE lugemist. Viis uut sondi, kõik päris
PostgreSQL-i vastu (`slog:org:probe` 34/34 · `org:seat:probe` 26/26 · `org:sponsor:probe`
33/33 · `org:inbox:probe` 51/51 · `org:invite:probe` 38/38 · `org:offboard:probe` 60/60) ja
**iga sond jooksutati ka vana koodi vastu**, punaste arv on kirjas iga leiu Seis-lõigus.
Neli asja tulid välja alles sondiga ja audit ise neid ei nimetanud: korduv sponsorluse
vastuvõtmine tegi kaks tellimusrida · korduv kutse vastuvõtmine oleks teinud kaks liikmesust ·
`REVOKED` kutse all oli aktiivne liikmesus koos õigustega · ühest olekumuutusest jäi auditisse
kaks sündmust. Migratsioon `20260810200000` teeb külastuse organisatsioonilise päritolu
andmebaasi tasemel muutumatuks.

**SOL-FIELD-01 ja -02 (10.08): kaks sama klassi leidu vastupidises suunas.** FIELD-01-l oli
otsus õige, aga teda TOITEV loendur luges vale asja — hoiatuste loendurit kasvatas taustakäik,
mida mitte ükski komponent ei kuvanud („kolm hoiatust" = „rakendus avati kolmel eri päeval").
FIELD-02-l on otsus õige ja teda ei kutsu mitte keegi: `fieldPackPurgeDue()` oli olemas, aga
ainus automaatne säilituskäik luges `items`, mitte pakke — ohutusinfot kandev külastuspakett
kadus seadmest ainult käsitsi. FIELD-02 sond käib **päris Chromiumi päris IndexedDB ja
WebCrypto vastu** (`npm run field:pack:probe` 26/26), sest fake-hoidla ei tõenda seda, et
otsus tuleb toime ainult metaandmetega — sisu on seadmes krüptitud. Vana koodi vastu 6 plokki
punast. FIELD-01 brauserikiht jääb `NOT_PROVEN`.

**SOL-FIELD-03 (10.08): audit kirjutas alati globaalse ühenduse kaudu ja neelas iga vea.**
Nüüd on kaks eksporti ja kaks lepingut — `writeDataAudit()` võtab `db` süstituna ja VISKAB,
`logDataAudit()` jääb best-effort'iks. Viis kohustuslikku välitöö rada on põhitehingus;
turvahoiatuse ja säilituskäigu kirjed said süstitud kliendi, aga jäid teadlikult
best-effort'iks, sest seal on kiri juba saadetud ja fail juba kustutatud — rollback teeks
rohkem kahju. Teine pool leidu oli TESTIDES: fake-DB-ga roheline test proovis vaikselt päris
andmebaasi kirjutada (mõõdetud: 241 ms esimesel kirjutusel). Fake-hoidla ise pidi saama
päris rollback'i ja pesastatud seose-projektsiooni — mõlemad peitsid veaklassi. Vana koodi
vastu **8/12 punast**.

**SOL-FIELD-04 (10.08): marker kadus kolmel viisil, millest üks oli raportist väljas.**
Kinnine väljaloend ei kopeerinud teda (kolmas kord samas failis), flush eemaldas ta pärast
IGA täidetud päringut staatust vaatamata — ja võrguta kinnitus kutsus `storePack`-i
**võltsvisiidiga**, mis kirjutas üle terve ettevalmistuspaketi, sealhulgas OHUTUSINFO.
Marker on nüüd versioonitud pakiskeemi osa ja kaob ainult 2xx või tõendatud sündmuse peale;
kõik muu jätab ta alles nähtava tõrkeseisu ja korduskatsega. Sond **35/35** päris IndexedDB
vastu (sh rakenduse taasavamine), ühikuid **18**. Mõõtmise aus piir on Seis-lõigus: vanal
koodil ei olnud moodulipiiri, mille vastu jooksutada.

**SOL-FIELD-05 ja -06 (10.08) lõpetasid peatüki.** FIELD-05: teksti vastuvõtmine ja toorheli
kustutuskell olid kaks eraldi päringut, millest teise viga neelati ja eduteade anti alati —
nüüd on nad **üks idempotentne serveritoiming** (märge kannab viidet salvestisele, kell
käivitub samas tehingus) ja eduteade tuleb ainult siis, kui kirje jõudis `SYNCED`-i. Vana
koodi vastu 4/9 punast; kolm rohelist on seal **tühjalt** rohelised, sest kella ei
käivitatud kunagi. FIELD-06: lubatud 5 s → 5 min backoff oli olemas ainult arvutusena —
ükski taimer ei käivitanud kordust. Uus `lib/field/syncScheduler.js` on Reactist väljas ja
tema kell on süstitav, seega **viis automaatset katset, backoff, peatumine, parkimine ja
unmount'i koristus on mõõdetud võltskella all**, ilma ühegi päris ootamiseta.

**SOL-DOC-01 (11.08) avas dokumendipeatüki: tasu võeti enne, kui tulemus oli olemas.** Kolm
rada arvestasid kasutuse maha kohe pärast mudelikutset ja märkisid siis „valmis" lipu, mis
keelas hilisema vabastuse — mustandi loomise viga, üle kvoodi jäänud sisu (413) või auditirea
viga tuli juba arvestatud ühiku otsa. Järjekord `reserve → produce → persist → commit` on nüüd
omaette moodulis (`lib/usage/paidResult.js`) kahe piiriga: viga enne tasu vabastab, tasu enda
viga EI vabasta (püsiv tulemus on juba omaniku oma). Refine'i puhul on püsiv asi **auditirida**
— ühtlasi kolme refinement'i loenduri ainus allikas — seega käivad audit ja tasu ühes tehingus.
Parandus ise oleks tekitanud uue lõksu (stabiilne kliendivõti + vabastus = igaveseks surnud
kavatsus), nii et vabastatud võti on nüüd sama perioodi sees uuesti reserveeritav. Vana koodi
vastu kolm punast ja **üks, mis ei kuku, vaid lukustub** — vana `commit` avab alati oma
tehingu, ja just see lukk on tõend, miks audit ja tasu ei saanud varem üks toiming olla.

**SOL-DOC-02 (11.08): kaks otsepunkti väljaspool lepingut.** Helifaili transkriptsioon kutsus
päris teenusepakkujat ilma ühegi `STT_SECONDS` reservatsioonita ja transkripti kokkuvõte tegi
AI-genereerimise ilma `DOCUMENT_GENERATE` lepinguta; mõlemal oli ainult minutipõhine
**mälupõhine** rate-limit, mis ei ole perioodikvoot. Uus `lib/usage/sttDuration.js` hoiab lahus
kaks eri küsimust: **enne** kutset vastust ei ole, seega reserveeritakse turvaline ülempiir
(kõnesalvestise teadaolev kestus → failist loetud kestus → baitidest tuletatud piir kõne
madalaima usutava bitikiiruse järgi); **pärast** kutset on vastus olemas, seega arvestatakse
tegelik kestus — piiratud reserveeritud mahuga, et vale hinnang ei muutuks 500-ks kasutajale,
kelle transkript on juba olemas. Olemasoleva transkripti tagastamine ei reserveeri midagi.
Limiidi ületamise negatiivne rada on tõendatud ahelana (teenus viskab → deskriptor teeb 429 →
leping mõõdab, et marsruut seda kasutab), mitte ühe HTTP-testiga.

**SOL-DOC-03 (11.08): kontroll oli olemas — lihtsalt vales kohas.** Nii artefakti muutmine
kui kinnitamine lugesid seisu eraldi päringuga ja kontrollisid mälus, et rida on `DRAFT`, aga
kirjutus tuli hiljem ja sihtis ainult `where: { id }`. Kahe vahekaardi tavaline kasutus piisas:
kui kinnitus jõudis vahele, muutis hilinenud salvestus **juba kinnitatud dokumendi sisu**.
Kontroll ja kirjutus on nüüd üks tingimuslik lause (`id + ownerId + status + oodatud versioon`,
versiooniks `updatedAt`, migratsiooni ei vaja) ja kinnitamine võib kliendi sisu kaasa võtta,
nii et detailivaate kaks päringut said üheks. **`npm run artifact:race:probe` 33/33 päris
PostgreSQL-is**, sealhulgas negatiivkontroll: sond jäljendab samas harnessis vana mustrit ja
nõuab, et see FINAL-i ära rikuks — rikub, seega on võistlus päris ja ülejäänud rohelised on
paranduse teene.

**SOL-DOC-04 (11.08): kaks tõde ühest dokumendist.** Transkripti muutmine kirjutas uue teksti
vana faili PEALE ja alles siis andmebaasi: DB-vea korral luges allalaadimine juba uut sisu, aga
API ja AI-kokkuvõte vana `content` välja. Uue transkripti rada kirjutas faili enne rea loomist ja
catch ei teadnud loodud teed — tundlik tekst jäi kettale ilma omaniku- ja retention-reata.
Järjekord on nüüd ümber: uus sisu läheb ajutisse faili ja avaldatakse `rename`-ga **tehingu sees
viimase sammuna**, ülekirjutusel hoitakse vana varukoopiana, et ka „rename õnnestus, tehing
kukkus" aken taastuks. **`npm run doc:staging:probe` 17/17** päris hoidla ja päris tehinguga,
kolm veasüsti: viga enne avaldamist, viga PÄRAST avaldamist, ja loomise viga (orbfaili ei teki).

**SOL-DOC-05 (11.08): piir oli loendus, mitte koht.** Kolme paranduse limiit luges auditiread
kokku ENNE AI-kutset, aga auditirida lisandus alles PÄRAST — kaks samaaegset päringut lugesid
sama arvu, mõlemad nägid ruumi ja mõlemad said läbi. Koht võetakse nüüd enne kutset ja on püsiv
rida; kontrolli ja kirjutuse tehingut serialiseerib artefaktipõhine nõuandelukk
(`pg_advisory_xact_lock`, ainult `$executeRaw` kaudu). Reserveeritud rida kannab `pending: true`
ja kustutada saab AINULT kinnitamata koha, seega päris auditijälge see tee ei puuduta.
**`npm run refine:slot:probe` 13/13**: 2/3 täis + neli võistlejat → võidab täpselt üks; tühi
artefakt + kuus võistlejat → võidab täpselt kolm. Negatiivkontroll näitab, et vana muster laseb
sama samaaegsuse all limiidist üle.

**SOL-DOC-06 (11.08): kaks paralleelset esmakutset nägid mõlemad tühja lauda.** Marsruut
kontrollis „kas transkript on olemas", ja kui ei olnud, lõi job'i ning kutsus teenusepakkujat —
ilma ühegi unikaalsuseta aktiivsele tööle. Üks kasutajategevus võis seega teha mitu välist kulu
ja mitu eri sisuga transkripti. Otsus ja tema jälg on nüüd ühes allikapõhise nõuandelukuga
tehingus: valmis transkript → taaskasutus ilma kutseta, aktiivne töö → 409, muidu claim, milleks
ON job ise. Vananemisaken on lepingu osa — ilma temata lukustaks surnud protsess allika
igaveseks. **`npm run transcribe:claim:probe` 13/13**: neli esmakutset annavad ühe töö, täisvoog
võltspakkujaga ühe kutse ja ühe transkripti; negatiivkontroll näitab, et vana muster teeb sama
samaaegsuse all mitu.

**SOL-DOC-07 (11.08): kvoot kehtis ainult ühele päringule korraga.** Neli rada — tavaline ja
helifaili üleslaadimine, artefakti loomine ja muutmine — lugesid senise mahu agregaatpäringuga ja
lõid rea alles hiljem, seega kaks päringut mahtusid mõlemad vana summa järgi ära ja ületasid koos
limiidi. Mõõtmine ja kirjutus käivad nüüd ühes kasutajapõhise nõuandelukuga tehingus
(`write(tx)` jookseb luku SEES — kui ta jookseks väljaspool, oleks tulemus täpselt vana kood).
Loenduriveergu teadlikult ei tehtud: kanooniline maht on tuletatav summa mitmest tabelist ja
eraldi loendur oleks neljas koht, mille lahknemine oleks nähtamatu. **`npm run
storage:quota:probe` 8/8**: ruumi kahele + neli võistlejat annab täpselt kaks võitjat ja lõppsumma
ei ületa limiiti; negatiivkontroll näitab, et vana muster ületab. Üleslaadimine sai ühtlasi
SOL-DOC-04 lepingu, seega kvoodi 413 ei jäta enam faili kettale.

**SOL-DOC-08 (11.08): kontroll, mis iseennast ei näinud.** Salvestatud analüüsi loomine
kontrollis kasutaja üldist salvestusmahtu, aga see summa luges ainult dokumente, materjale ja
artefakte. Analüüs võib olla kuni 200 kB ja ükski neist ei muutnud järgmise kontrolli sisendit —
neid sai järjest salvestada piiramatult, ilma 413-ta. Analüüs on nüüd kanoonilise summa neljas
pott ja salvestamine kasutab sama atomaarset reservatsiooni. Sondis mõõdetud: kaks analüüsi
annavad oma baidid nii omas potis kui kogusummas, täis kvoodi all saab järgmine 413, kustutamine
vabastab mahu. **Kõrvalleid:** kõneteenuse fake-klient ei tundnud `savedAnalysis` mudelit ja
puuduv pott ei andnud seal nulli, vaid krahhi — see oleks maskeerinud kvoodikeelu millekski muuks.

**SOL-DOC-09 (11.08) lõpetas peatüki: vaikus oli leiu tuum.** Analüüsi salvestus ja kustutus
kutsusid auditit sündmustega, mida auditikaardis ei olnud — tundmatu sündmus andis `null` ja
logifunktsioon lõpetas kirjutamata. Toiming paistis koodis auditeerituna, aga ühtki rida ei
jäänud, ja funktsioonikutset kontrolliv test oleks olnud roheline kogu selle aja. Skeem sai kaks
oma action'it (ainus migratsiooni vajav leid selles peatükis), `writeDocumentAudit()` on
kohustuslik tee, mis kaardistamata sündmuse ja kirjutuse vea peale VISKAB, ja kustutus koos oma
jäljega on üks tehing. **`npm run analysis:audit:probe` 10/10**, sh „olematu analüüsi kustutus ei
loo jälge".

**SOL-RES-01 (11.08): kaks eri asja olid ühte aetud.** Kogu uuringupind käis läbi värava, mis
nõudis alati aktiivset tellimust — aegunud tellimusega inimene ei näinud oma uuringu sisendit,
tulemust ega olekut ja ei saanud teda ka koristada, kuigi dokumentidel on sama küsimus juba
lahendatud kõva reegliga. Ja `DELETE` kutsus ainult `cancelResearchJob()`, mis terminaltöö puhul
väljus kohe midagi muutmata, aga marsruut vastas ikkagi eduga: kasutajale öeldi „kustutatud" ja
rida ilmus kohe uuesti. Nüüd on lugemine, peatamine ja kustutamine tellimusevabad (POST jääb
värava taha, mõlemad ühes failis kõrvuti), peatamiseks on oma marsruut ja DELETE eemaldab rea
päriselt; aktiivne töö annab 409 „peata enne". **`npm run research:delete:probe` 15/15** kõigis
viies olekus. Sond tõi välja fakti, mida raportis ei olnud: andmebaasis on osaline unikaalne
indeks „üks aktiivne töö kasutaja kohta".

**SOL-RES-02 (11.08): idempotentsus toimis kahes kihis vastupidise tähendusega.** Võti sidus
kasutusühikut, aga töö loodi alati uue UUID-ga — sama võtit teadlikult korrates sai ühe ühikuga
käivitada järjest uusi täismahus uuringuid, samas kui tavaklient ei saatnud võtit üldse ja
võrguvea kordus lõi uue tasulise töö. Kavatsus sai oma veeru ja unikaalse `(userId,
clientIntentKey)` paari; sama võti tagastab olemasoleva töö ka pärast lõppu, teine sisend annab
409. **`npm run research:intent:probe` 21/21.** Sond leidis kohe ühe päris vea paranduse enda
sees: taaskasutatud töö tuli protsessimälust ja kandis vana seisu — lõppseisu autoriteet on nüüd
andmebaas.

**SOL-RES-03 (11.08): kaks protsessi, kaks tõde.** Töö loonud frontend pani iga uue töö oma
lokaalsesse Map'i, aga worker-režiimis jooksutab tööd hoopis teine protsess — päritoluprotsess ei
saanud tema sündmusi kunagi ja andis detailis ning voos lõputult `queued`, kuigi töö oli
andmebaasis ammu lõppenud. Parandus on OMANDI küsimus, mitte sünkroonimise oma: runtime-objekt on
ainult sellel protsessil, kes tööd päriselt jooksutab; teised loevad andmebaasist. SSE tuleb kaasa
ilma eraldi mehhanismita, sest voog valib andmebaasi pollimise täpselt siis, kui lokaalset objekti
ei ole. **`npm run research:worker:probe` 8/8 PÄRIS kahe protsessiga** (sond kontrollib, et lapse
pid on teine); negatiivkontroll näitab, et oma runtime-objektiga protsess näeb ikka vana seisu.

**SOL-RES-04 ja -05 (11.08) käivad kokku.** RES-04: heartbeat uuendas rida tingimusel `workerId`,
aga ei vaadanud kunagi `updateMany.count` väärtust, progress kirjutas tingimusteta ja kirjutas vana
lease'i tagasi, terminalsiire nõudis ainult aktiivset staatust — pausi järel jätkas vana worker
mudeli- ja RAG-kutseid ning võis tulemuse esimesena commit'ida. Fencing käib nüüd `workerId` järgi
(eraldi veergu ei ole vaja) ja `count === 0` katkestab töö; TÜHISTUS jäi teadlikult fence'imata,
sest Stop tuleb frontendist, kes ei ole kunagi omanik. **`npm run research:lease:probe` 9/9 kahe
päris workeri ja kahe protsessiga.**

RES-05: `persistDone` neelas DB-vead ja pipeline ei vaadanud tagastusväärtust — uuring märgiti
`done` ja kasutus commit'iti ka siis, kui vestlusse ei jäänud raportist jälgegi. Lõpp on nüüd
seotud KINNITATUD koopiaga; kui teda ei ole, jääb töö aktiivseks ja kasutust ei arvestata. Kirjutus
on job-idempotentne (`persistKey`), mis kattis ühtlasi RES-04 kriteeriumi viimase lause. **`npm run
research:persist:probe` 10/10.**

**SOL-RES-06 (11.08): vaikus oli kogu mehhanism.** Arveldus käis pärast `done`-iks märkimist ja
tema vead neelati täielikult: edukaks märgitud töö võis jääda RESERVED-iks ja reaper vabastas ta
hiljem kui kasutamata ühiku. Tühistatud töö arveldust ei saanud snapshot'ist üldse teha, sest võtit
otsiti payload'ist, mida snapshot ei säilita. Nüüd loetakse võti vajadusel reast juurde, arvelduse
tulemus jääb reale kirja ja pooleli jäänud arveldusi korratakse oma tempos. **`npm run
research:settle:probe` 13/13**; migratsiooni ei olnud vaja.

**SOL-MEET-01 (11.08): kaks vaikset viga, üks tagajärg — kasutaja jäi lukku.** Töö pandi protsessi
Map'i ENNE snapshoti kirjutamist, seega kirjutuse vea korral jäi `queued` töö sinna igaveseks
(sweep ei kustuta queued/running olekut) ja aktiivse töö limiit oli protsessi elueaks kinni. Teiseks
seisid running-märge, tema snapshot ja `import("openai")` `try`-plokist väljas — nende viga jõudis
ainult logisse, tööd ei märgitud error'iks ega vabastatud kasutust. Nüüd kirjutatakse enne ja
tehakse nähtavaks pärast, kogu jooksu algus on ühe fail-closed katuse all ja terminalolek pannakse
paika mälus enne ketast. **4/4 veasüstetesti päris fs-vigadega** (`EEXIST` `mkdir`-il, `EPERM`
`rename`-il); igal testil on negatiivkontroll. Migratsiooni ei ole vaja.

**SOL-MEET-02 (11.08): lahendus oli koodibaasis olemas ja kasutamata.** `usageService.commit()`
võtab `tx` parameetri just selleks, et arveldus saaks kuuluda kutsuja püsiva kirjutusega ühte
tehingusse — ja see moodul oli kogu koodibaasis ainus kutsuja, kes seda ei kasutanud. Nüüd sünnivad
kvoodikontroll, `UserDocument` rida ja ühiku commit ühes tehingus: kas kõik kolm või mitte ükski.
Kvooti saab jõustada just sellepärast, et commit on tehingu sees. `commit_pending` oli olemas, aga
seda ei lugenud keegi tagasi — nüüd on püsiv kordus, ja sama sweep ei tohi enam pooleli arveldusega
snapshotit ära visata. **`npm run meeting:summary:probe` 12/12** päris PostgreSQL-is, sh päris
rollback. Migratsiooni ei ole vaja.

**SOL-MEET-03 (11.08): TTL kehtis täpselt nii kaua, kuni server ei taaskäivitunud.** Koristus käis
läbi protsessi mälu ja kustutas snapshoti ainult sealt leitud terminaaltöö puhul; pärast restarti on
see mälu tühi, aga snapshot kannab valmis kokkuvõtte teksti — seega jäi kohtumise tundlik sisu
kettale tähtajatult. Nüüd loeb sweep kataloogi ennast: kehtiv terminalkirje aegub oma `endedAt`
järgi, rippuma jäänud `queued`/`running` katkestatakse ja vabastab kvoodi, ning loetamatu `.json`
ja orb `.tmp` kaovad **fail-closed** faili vanuse järgi — tundliku teksti puhul on „ei suutnud
lugeda" argument kustutamise POOLT. **7 uut testi**; negatiivkontroll kukutab 5 seitsmest.
Migratsiooni ei ole vaja.

**SOL-MEET-04 (11.08): loendus oli leiu põhjus, seega ta on kadunud, mitte parandatud.** Aktiivsete
tööde arvu loeti protsessi mälust ja kataloogist ning uus töö lisati alles hiljem — kaks põimuvat
POST-i lugesid mõlemad „aktiivseid ei ole". `MeetingSummaryJobClaim.userId` unikaalsus on ainus
koht, kus see võidujooks päriselt lõpeb; aegunud claim on üle võetav ainult compare-and-swap'iga.
**Paranduse kirjutamise ajal tuli välja auk, mida raportis ei olnud:** kui claim'i `updatedAt` jääks
loomise hetke peale seisma, muutuks üle 15 minuti kestev töö „aegunuks" ja teine POST võiks ta
ELUSALT üle võtta — südamelöök käib nüüd jooksu kahes punktis. **`npm run meeting:summary:probe`
16/16** päris PostgreSQL-is, sh kaks `Promise.all`-iga samaaegset loomist. **Vajab migratsiooni**
(`20260811120000`, uus tabel; olemasolevaid ridu ei puudutata).

**SOL-MEET-05 (11.08): fikseeritud 60 sekundit ei olnud konservatiivne oletus, vaid möödapääs.**
Tundmatu kestusega fail — kuni 12 MB, seega potentsiaalselt tunnipikkune — reserveeris alati täpselt
minuti, ja commit tehti ilma tegeliku mahuta, seega võeti alati kogu reserv. Nüüd tuleb tundmatu
kestuse reserv failimahust (ohutu ülempiir, vaikimisi 32 kbps põrand) ja commit kannab mõõdetud
tegelikku, klammerdatuna reservatsiooni piiri. **Hind on teadlik:** kliendi kuulimiit on 900 s ja
12 MB tundmatu fail annab üle 3000 s, seega selline üleslaadimine lükatakse tagasi — 60-sekundilise
reserviga läbi lastud tunnipikkune fail oligi see viga. 10 testi; negatiivkontroll kukutab kolm.

**SOL-MEET-06 (11.08): toorviga läks kahte kohta korraga** — kasutajale HTTP vastuses ja PÜSIVASSE
JSON-snapshoti. Nüüd käib avalik viga `publicErrorMessageKey()` allowlist'ist läbi ja toorviga
ainult `safeError()`-iga redigeeritud logisse. Teel ühtlustus ka välja kuju: sama `error` väli
kandis kolme eri asja (võti, tõlgitud lause, toortekst) — nüüd on kõik võtmed. Test kontrollib
markeri puudumist eraldi ka kettalt, sest just snapshot on püsiv.

**SOL-CHAT-01 ja -02 (11.08): tasu võeti püsivast kirjutusest LAHUS ja iga viga neelati.** Commit
käis kohe pärast providerit ja püsistus tuli alles pärast seda, seega üks pööre sai lõppeda kolmel
parandamata viisil: limiit kulus ja vastust ei olnud kuskil · vastus oli ja limiit kulumata ·
katkestatud pööre jäi TTL-ini kinni. Arveldus on nüüd `persistDone`-i TEHINGUS — kas terminalmarker
ja tasu mõlemad või mitte kumbki. `usageService.release` sai `tx` toe (commit'il oli ta olemas).
Kinnitamata püsistus ei anna enam `done`-i. **`npm run chat:settle:probe` 23/23 päris
PostgreSQL-is**, sondi tuum on ROLLBACK, mida fake-Prisma ei saa tõendada; negatiivkontroll näitab,
et vana järjekord tekitab arvestatud ühiku ilma vastuseta.

**SOL-CHAT-05 (11.08): kaks viga ühe pealkirja all.** `streamFinalized = true` pandi
finaliseerimisse SISENEMISEL, seega hilisem `finalizeStreamAbort()` oli surnud kood; ja püsistati
`accumulated` (provideri puhver), mitte seda, mida kasutaja nägi. Nüüd kasvab `emitted` ainult
õnnestunud `enqueue` peale ja edurajal on kaks abordikontrolli. Neli testi neljale ajastusele, kaks
neist **enesekontrolliga** (`discardedChars > 0` ja `rag_trace` await'i olemasolu) — muidu oleksid
nad vaikselt rohelised.

**SOL-CHAT-03 ja -04 (11.08): pöördel ei olnud rida, mille külge kinnituda.** Uus mudel `ChatTurn`
(migratsioon `20260811160000`): `(userId, clientTurnKey)` unikaalsus = üks kavatsus, üks rida.
Sessioonipiiri lugemine ja kirjutamine käivad ühes tehingus vestlusepõhise `pg_advisory_xact_lock`
all; üks aktiivne pööre vestluse kohta; aegunud RUNNING suletakse ausalt ERROR-iks. Klient hoiab
kavatsuse võtit kuni lahenduseni ja sama võti läheb ka kasutusarvestusse — **primitiiv
`resolveIntentKey` oli koodibaasis olemas (SOL-DOC-01) ja teda ei kirjutatud teist korda.**
`retryOf` tüübiviga parandatud seal, kus ID sünnib. **`npm run chat:turn:probe` 20/20 päris
PostgreSQL-is** + negatiivkontroll: vana muster ületab sessioonipiiri.

**SOL-CHAT-06 (11.08): EOF ilma `done`-ita märgiti alati eduks.** Nüüd küsitakse serverilt
kinnitust (`readPersistedConversationResult` oli olemas, aga kasutusel ainult uuringu rajal) ja
kinnituseta EOF annab nähtava vea koos Retry-nupuga. Kaasa tuli **SOL-CHAT-04 kriteeriumi viimane
lause**: `/api/chat/run` loeb seisu nüüd `ChatTurn` realt, mitte „viimane sõnum oli kasutajalt"
heuristikast.

**SOL-CHAT-07 (11.08): leid oli KAHE REEGLI VAHE.** Ruumisõnumite API nõuab liikmesust kõigilt,
chat bootstrap tegi adminile erandi, ja sõnumi kirjutaja ise ei kontrollinud midagi. Erand
kustutatud; `saveAssistantRoomMessage()` kontrollib nüüd ise ja **VISKAB** — kirjutus on ainus koht,
kust mööda ei saa. Break-glass jäeti teadlikult ehitamata.

**SOL-CHAT-08 (11.08): commit'i viga viskas valmis analüüsi ära.** `analysisCompleted` lipp keelas
vabastuse JA `catch` tagastas vea, seega kasutaja kaotas tulemuse ja reservatsioon jäi kinni. Nüüd
kehtib `paidResult` teine piir: tasu viga ei vabasta ega tühista tulemust. Klient saadab
failipõhise kavatsuse võtme. **Üks kriteeriumi lause jäi teadlikult täitmata** (kordus parsib faili
uuesti), sest analüüs on lepingu järgi efemeerne — vt leiu Seis-lõiku.

## Lahtised, mis EI OLE lihtsalt tegemata

Neid viit ei saa „järgmise tööna" ette võtta — nad ootavad kas otsust või tõendust, mida
kood ei anna:

- **SOL-PAY-09** (P1) — *BLOCKED_DECISION, õiguslik.* Konto kustutamine kaskaadib makseajaloo
  (`Payment`, `Subscription`, `BillingMethod`) kohe, kuigi `lib/retention.js` hoiaks makseid
  seitse aastat ja raamatupidamise seadus § 12 nõuab algdokumentide säilitamist seitse aastat.
  Vastuvõtukriteerium ütleb ise, et jurist/raamatupidaja peab kinnitama, **milline minimaalne
  finantsdokument säilib ja kui kaua** — seda ei saa koodiga ette otsustada. Ülejäänud
  SOL-PAY leiud sellest ei sõltu.

- **SOL-CW-09** (P2) — *kood DONE, brauseritest NOT_PROVEN.* Parandus on olemas, aga
  tagasinupu käitumist ei ole päris brauserist läbi käidud. Loendis on ta seepärast lahtine.
- **SOL-CW-14** (P1) — *mehhanism DONE ja alarm tõendatud päris PostgreSQL-is; taimeri
  LUBAMINE ootab omaniku enda lukustatud järjekorda* (Õ2/Õ3 andmekaitseanalüüs → cron →
  kuivjooks → aktiveerimine). Unit-failid on serveris paigaldatud, taimer on `disabled`.
- **SOL-RES-07** (P2) — *leidmine ja Stop DONE; elava edenemisvoo taastamine ja brauseritest
  TEGEMATA.* Aktiivse töö saab nüüd vestluse avamisel üles leida ja peatada (ka „Minu dokumentide"
  real on Stop-nupp), aga SSE-progressi taastamine nõuab `useChatStream`-i voo-tarbimise
  väljatõstmist `sendMessage`-i seest — eraldi refaktor, mida P2 leid ei kanna.
- **SOL-CW-19** (P1) — *BLOCKED_DECISION.* Leid on mõõdetud ja tõene, aga kriteerium algab
  tooteotsusest, mis on omaniku oma. Koodi ei ole muudetud.

## Kuidas seda loendit lugeda

- **Loend on mehaaniline ja nüüd ka jooksutatav: `npm run sol:tally`.** Tehtuks loetakse ainult
  leid, mille Seis-lõik ALGAB sõnaga `DONE`. Kvalifitseeritud seisud („kood DONE; brauseritest
  NOT_PROVEN", „mehhanism DONE…") loetakse **lahtiseks**. Seepärast on SOL-CW siin **17/20**,
  mitte varem kirjas olnud 18/20 — see ei ole tagasiminek, vaid rangem lugemine. Kolm
  kvalifitseeritud leidu on ülal nimetatud.
- **Loendur loeb ka jätkufaile** (`…-jatk-*.md`) ja just nende puudumine oli senise loenduse
  suurim viga: SOL-MAT peatükk (13 leidu) ei olnud siin tabelis kordagi. Kui uus jätkufail
  lisandub, muutub nimetaja — jooksuta loendur uuesti, ära paranda numbrit käsitsi.
- **Loenduri enda veaklass on vaikimine, mitte vale arvutus.** Sama viga kordus 11.08 teist
  korda kitsamalt: `SOL-DOC-J-01…-06` ei vastanud rangele mustrile ja kadus. Nüüd nõuab
  loendur, et **iga** `### SOL-…` pealkiri oleks arvestatud, ja kukub muidu nimeliselt —
  seega „numbrid on raportist loetud" on kate ka tulevaste ID-vormingute peal.
- **`runtime: not_run` ei tee leidu lahtiseks.** Enamik parandusi on tõendatud teenuse- ja
  andmebaasitasemel; „päris admini sessioonist läbi käimata" on kirjas iga leiu Seis-lõigus
  eraldi ja seda ei loeta siin puuduseks.
- **Järjekorra reegel: P0 EES, dokumendi järjekord on tasavägiste vahel otsustaja.** Reegel
  tekkis 09.08, sest pelk dokumendijärjekord ei kannatanud tabelit välja. **P0-sid ei ole
  auditis enam ühtegi** (viimased kaks olid SPROF-01 ja -02, mõlemad 10.08 kaetud), seega
  järjekord ON langenud tagasi puhtale dokumendijärjekorrale. **SOL-AUTH on 11.08 lõpetatud**,
  ja järgmine peatükk sõltub nüüd otseselt allolevast jätkufailide otsusest.
- **Reegel ei ütle veel midagi jätkufailide kohta ja see on lahtine otsus.** Kui nad
  liidetakse peaauditi järjekorda, tuleb SOL-ORG-13…-17 ette SOL-AUTH-i sabast; kui nad
  jäävad eraldi järjekorraks, tuleb kokku leppida, millal seda tehakse.
- **Uue ploki alustamisel loe ENNE raportist**, mis juba tehtud on — see fail võib olla
  vananenud, raport ei ole.
