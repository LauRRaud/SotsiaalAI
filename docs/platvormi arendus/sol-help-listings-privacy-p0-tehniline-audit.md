# HELP-P0-AUDIT — abisoovide ja abipakkumiste privaatsusparanduse tehniline ristkontroll

Auditi kuupäev: 2026-07-16
Audiitor: Codex / Sol
Auditi laad: sõltumatu read-only koodi-, Git-, testi- ja runtime-kontroll

## 1. Kokkuvõte

Paketi põhiline ligipääsuleping töötab: omanik näeb oma kirjet igas staatuses, võõras ja ADMIN saavad mitteavaliku kirje puhul ühetaolise 404, autentimata kasutaja saab 401 ning globaalne loend on mõlema kirjetüübi puhul OPEN + aegumata põrandaga. PATCH-i omanikupiir ja ADMIN-i DELETE-õigus säilisid.

Integratsiooni blokeerib siiski avaliku projektsiooni sisuline leke. `toPublicHelpListingDetailView` eemaldab privaatsete väljade võtmed, kuid säilitab `description`-i ja `roleLabel`-i. Mõlemad loomise töövood kopeerivad `beneficiaryLabel`, `urgency`, `providerScopeOrConditions`, `skillsOrBackground` ja `rawPlace` väärtusi `description`-i ning tuletavad `roleLabel`-i otse abisaaja või pakkuja tingimuse tekstist. Seetõttu tulevad keelatud väärtused võõrale tagasi teise võtme all. Sama `description` jõuab avalikku Teenusekaardi vastusesse ja vestluse abivahenduse `browseResults` olekusse. Sõltumatu autenditud HTTP-kontroll kinnitas lekke nii abisoovi kui abipakkumisega.

## 2. Git-kontroll

### 2.1 Kontrollitud seis

| Kontroll | Tulemus |
|---|---|
| Värske audit-worktree | `C:/Users/rauds/Desktop/SotsiaalAI-help-p0-audit` |
| Worktree algseis | puhas |
| Docs-only auditiharu | `codex/help-listings-privacy-p0-audit` |
| Kontrollitud teostus-SHA | `3479a4477865694fb1a6520583ba2131d55e856d` |
| Teostusharu remote SHA | `origin/fable/help-listings-privacy-p0` = `3479a4477865694fb1a6520583ba2131d55e856d` |
| Eelcommit | `e0875407ea54bbe9ad82e5750ac76313929caa24` |
| Algbaas / merge-base | `890124bdbef17f899ba15c11c93450ef17875fac` |
| Värskendatud `origin/main` | `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c` |
| Ahead/behind `origin/main...3479a447` | 4 taga, 2 ees |
| Baasi eellassuhe | `890124bd` on nii `origin/main` kui teostus-SHA eellane |

Teostusvahemik sisaldab kahte commit'i:

1. `e0875407` — docs-only progressidokumendi algversioon;
2. `3479a447` — rakenduskood, progressidokumendi täiendused ja testid.

### 2.2 Täpne paketi diff

`890124bd..3479a447`: 10 faili, 892 lisatud ja 28 eemaldatud rida.

| Olek | Fail |
|---|---|
| M | `app/api/help/listings/[kind]/[id]/route.js` |
| M | `app/api/help/listings/route.js` |
| A | `docs/platvormi arendus/fable-5-help-listings-privacy-p0-progress.md` |
| M | `lib/help/index.js` |
| A | `lib/help/listingAccess.js` |
| M | `lib/help/listingViews.js` |
| M | `lib/help/offers.js` |
| M | `lib/help/requests.js` |
| A | `tests/help/listingPrivacyP0.test.js` |
| A | `tests/help/listingPrivacyRouteContract.test.js` |

Prisma skeemi- ja migratsioonidiff on tühi.

### 2.3 `origin/main` neli uuemat commit'i

| Commit | Sisu | Mõju HELP-P0 failidele |
|---|---|---|
| `4c3fceb5` | RAG P8.0 master-allikate inventuur; 12 faili, sh üks `package.json` skriptilisa | puudub |
| `0972fdf8` | sõltumatu RAG P8.0 auditidokument | puudub |
| `67c76899` | RAG inventuuriharu merge-commit | puudub |
| `2a63fcd0` | RAG auditiharu merge-commit | puudub |

Ükski neli commit'i ei muuda kontrollitavaid route'e, `lib/help` faile ega seotud HELP-P0 teste. Paketi ja uuema main'i faililoendite ühisosa on tühi.

### 2.4 Read-only integratsioonihinnang

- Kogu vahemiku `890124bd..3479a447` kolmepoolne `merge-tree` praeguse `origin/main` vastu õnnestus konfliktita.
- `e0875407` eraldi rakendamise simulatsioon praegusele main'ile õnnestus.
- `3479a447` üksi ei ole puhas cherry-pick: simulatsioon andis `modify/delete` konflikti failis `fable-5-help-listings-privacy-p0-progress.md`, sest commit muudab eelcommit'is loodud faili. Seega on `e0875407` mehaaniliselt vajalik, kui commit'id võetakse muutmata kujul ja samas järjekorras.
- Main'i uuemad RAG-muudatused ei tekita HELP-P0-ga failikonflikti ega leitud semantilist regressiooni.
- Integratsiooni ei tohi praegu teha allpool kirjeldatud P0 leiu tõttu. Pärast parandust ja kordusauditit on soovitatud tee: rebase'ida kogu kahe commit'i vahemik koos uue paranduscommit'iga `origin/main` peale või cherry-pick'ida järjekorras `e0875407`, `3479a447`, `<privacy-projection-fix>`. Progressidokument tuleb samas paranduscommit'is tegeliku tulemusega kooskõlla viia.

## 3. Lepingu ristkontroll

| Kontroll | Staatiline tõend | HTTP runtime | Hinnang |
|---|---|---|---|
| Omanik näeb oma DRAFT-i | teenusekiht valib omanikuprojektsiooni | 200 | PASS |
| Võõras näeb ainult OPEN kirjet | ainult `OPEN` on avalik staatus | DRAFT/CLOSED/CANCELLED 404 | PASS |
| MATCHED/ARCHIVED võõrale | teenusekihi fail-closed haru; sihttestid | 404 teenusekihi testis | PASS |
| ADMIN ei loe võõrast DRAFT-i | roll ei osale GET-i loas | 404 | PASS |
| ADMIN-i DELETE säilib | DELETE kontrollib `auth.isAdmin` | võõra DRAFT-i DELETE 200 | PASS |
| Autentimata detail | route nõuab sessiooni enne kirje laadimist | 401 | PASS |
| PATCH | muutus puudutab ainult GET-i; omanikukontroll säilib | võõras 403, omanik 200 | PASS |
| Puuduv ja keelatud ID | sama 404 staatus, keha ja cache-leping | request ja offer bait-identne | PASS |
| Avaliku detaili otsesed privaatvõtmed | allowlist ei väljasta `rawPlace`, täpset aadressi/koordinaate, `beneficiaryLabel`, `urgency`, `providerScopeOrConditions`, `skillsOrBackground`, `editable*`, `structuredSummary`, `municipalityId`, `primaryCategoryId` ega `mapEntry` objekti | võtmed puudusid | PASS ainult võtmetasandil |
| Avaliku detaili kaudne sisu | `description` ja `roleLabel` pärivad keelatud väljade väärtusi | markerid tulid tagasi | FAIL |
| Fail-closed tulevikuväljade suhtes | tagastusobjekt ja alusvaade loetlevad väljad eksplitsiitselt | — | PASS struktuurselt |
| Globaalne request/offer | teenusekiht sunnib `OPEN` + aegumata, count kasutab sama filtrit | `status=DRAFT` ei toonud DRAFT-i; aegunud kirjed puudusid | PASS |
| `scope=mine` | ainult `scope === "mine" && userId` avab omaniku staatusefiltri | mõlema tüübi DRAFT nähtav omanikule | PASS |
| Request/offer sümmeetria | peegelteostus | mõlemad läbisid | PASS |
| Muud list-kutsujad | repo otsingus ainult listings route | — | PASS |
| Võtmesõna-kokkuvõte | `rawPlace` eemaldatud allikast | otsest `rawPlace` võtit ei olnud | PASS |
| Teenusekaart / markerid | serializer kasutab `listing.description` | avalik endpoint lekitas markerid | FAIL |
| Vestluse abivahendus | `browseResults.description` ja `listingView.roleLabel` säilitatakse kliendi/püsiva workflow metadata jaoks | eraldi täis-chat voogu ei olnud vaja P0 staatilise ja serializer-runtime tõendi kordamiseks | FAIL staatilise andmevoo põhjal |

`roleLabel` ei ole ohutu kontrollitud silt. Mõlemas loomise teostuses määratakse see request'i korral `beneficiaryLabel`-ist ning offer'i korral `providerScopeOrConditions`-ist. Välja pikkus on piiratud, kuid väärtus on vabatekst. PII-redaktsioon vähendab mõne otsese identifikaatori riski, kuid ei muuda abisaaja, kolmanda isiku või tingimuse teksti avalikuks taksonoomiaks ega takista tundliku konteksti avaldamist.

Avalik detail väljastab lisaks `region.municipalityIds`. Kaardikirje sünk kopeerib sinna sama `record.municipalityId` väärtuse. Seega on top-level `municipalityId` küll eemaldatud, kuid sama sisemine ID tuleb pluraliseeritud alamvälja kaudu tagasi.

## 4. Leiud

### HELP-P0-01 — keelatud privaatväljade väärtused lekivad avalike tekstiväljade kaudu

- Raskusaste: **P0**
- Tõend: staatiline ja autenditud runtime
- Mõjutatud failid/API-d:
  - `lib/help/workflowActions.js:319-359`
  - `lib/help/chatWorkflow.js:925-965`
  - `lib/help/listingViews.js:391-425,525-556`
  - `lib/help/mapEntries.js:365-425`
  - `lib/help/workflowState.js:157-190`
  - `GET /api/help/listings/[kind]/[id]`
  - `GET /api/service-map/entries`
  - vestluse abivahenduse browse-workflow
- Tegelik risk: võõras autenditud kasutaja saab OPEN abisoovi detailist `beneficiaryLabel`, `urgency`, `rawPlace`, `skillsOrBackground` ja kolmanda isiku teksti; offer'i puhul `providerScopeOrConditions`, `rawPlace`, `skillsOrBackground` ja tingimuse teksti. Avalik Teenusekaardi endpoint tagastab samad väärtused ka autentimata kliendile. Väljade võtmete eemaldamine ei vähenda leket, kui väärtus on kopeeritud `description`-i või `roleLabel`-i.
- Runtime-tõend: request'i avalik detail sisaldas viit keelatud markerit; offer'i avalik detail nelja. Teenusekaardi kaks sünteetilist kirjet sisaldasid kokku request'i ja offer'i seitset privaatmarkerit, kuigi `address` oli mõlemal `null`.
- Blokeerib integratsiooni: **jah**
- Minimaalne eraldi paranduspakett:
  1. lõpetada privaatsete detailväljade automaatne kopeerimine avalikku `description`-i;
  2. asendada `roleLabel` kontrollitud avaliku taksonoomiasildiga või eemaldada see avalikest projektsioonidest;
  3. ehitada avalik detail, Teenusekaart ja vestluse browse-tulemus ühest sisuliselt turvalisest avalikust projektsioonist, mitte toorkirjest;
  4. lisada request'i ja offer'i ristvälja-markeritega testid detailile, globaalsele loendile, Teenusekaardile, workflow reply'le ja workflow metadata'le;
  5. katta legacy-kirjed: väljundleping ei tohi sõltuda ainult loomisel tehtud PII-redaktsioonist.

### HELP-P0-02 — `municipalityId` tuleb avalikus detailis tagasi `region.municipalityIds` all

- Raskusaste: **P2**
- Tõend: staatiline + serializeri sõltumatu käivitus
- Mõjutatud fail/API: `lib/help/mapEntries.js:292`, `lib/help/listingViews.js:542-546`, avalik detail-GET
- Tegelik risk: sisemine stabiilne andmebaasi-ID rikub kokkulepitud andmeminimeerimist ja võimaldab kirjete ristseostamist sisemise identifikaatori järgi. See ei avalda üksi täpset aadressi.
- Tõend: sisend `municipalityId="mun-internal-123"` muutus väljundiks `region.municipalityIds=["mun-internal-123"]`.
- Blokeerib integratsiooni: **jah vastuvõtukriteeriumi mõttes**, kuigi mõju on P0-leiust väiksem
- Minimaalne eraldi paranduspakett: eemaldada sisemised `municipalityIds` avalikust detailist; vajaduse korral kasutada juba olemasolevat avalikku `municipalityLabel`-it või eraldi dokumenteeritud avalikku slug'i. Lisada negatiivne test nii singular- kui plural-vormi vastu.

### HELP-P0-03 — identse 404 keha kõrval jäi mõõdetav lokaalne ajastuserinevus

- Raskusaste: **P3**
- Tõend: autenditud runtime, 25 interleeritud päringut variandi kohta
- Mõjutatud API: `GET /api/help/listings/[kind]/[id]`
- Mõõtmine:
  - request: puuduv mediaan 13,67 ms; DRAFT 17,23 ms; CLOSED 15,65 ms;
  - offer: puuduv mediaan 13,95 ms; DRAFT 16,99 ms; CANCELLED 15,98 ms;
  - vahemikud kattusid osaliselt; suurimad üksikväärtused olid 15,64–24,88 ms.
- Tegelik risk: lokaalses keskkonnas oli olemasolev keelatud rida mediaanis umbes 2–3,6 ms aeglasem. See on mõõdetud signaal, kuid mitte tõendatud kaugvõrgu eksploit: võrguvariatsioon, autentimisnõue ja suure entroopiaga CUID-id vähendavad praktilist riski. Staatuse ja keha kaudu olemasolu ei eristu.
- Blokeerib integratsiooni: **ei**
- Minimaalne eraldi järelm: lisada detail-ID iteratsiooni vastu kiirusepiir ning korrata interleeritud mõõtmist production-like võrgu ja andmemahu juures. Konstantse aja kunstlikku viivitust ei ole selle auditi põhjal põhjendatud.

## 5. Testid ja kontrollid

### 5.1 Sõltumatult korratud tulemused

| Kontroll | Tulemus |
|---|---|
| `tests/help/listingPrivacyP0.test.js` + `listingPrivacyRouteContract.test.js` | 26 pass / 0 fail |
| Help/Teenusekaardi/vestluse sihtregressioonid | 44 pass / 0 fail |
| Kogu `npm test` | 1248 pass / 0 fail / 0 skip |
| Lint 9 kontrollitud teostus- ja testifailile | 0 errorit / 0 warningut |
| `npm run i18n:check` | et/en/ru sümmeetria korras |
| `npm run build` | PASS; Next.js tootmisbuild ja mõlemad help-route'id genereeritud |
| `git diff --check` | PASS |
| `npx prisma validate` | PASS |
| `npm run db:migrate:check` | PASS; 92 migratsiooni puhtasse ajutisse andmebaasi, skeem ajakohane, ajutine DB eemaldatud |
| Skeemi- ja migratsioonidiff | tühi nii algbaasi kui praeguse main'i suhtes |
| Sõltumatu serializer-markerikatse | FAIL: detail/list/map kaudsed markerid leitud |

### 5.2 Fable'i progressidokumendis varem raporteeritud tulemused

Progressidokument raporteeris 26/26 sihttesti, 1248/1248 kogu testi, 0 lint-errorit, i18n PASS, build PASS ja muutmata Prisma skeemi/migratsioone. Need arvud korrati sõltumatult; progressidokumendi järeldus, et avalik projektsioon ei leki privaatvälju, ei pea ristvälja-markerite ja päris HTTP vastuste põhjal paika.

### 5.3 `not_run`

Kohustuslikest kontrollidest ei jäänud ükski keskkonna tõttu tegemata. Kogu repo `eslint .` ei olnud nõutud ega käivitatud; lint tehti täpselt kontrollitud üheksale teostus- ja testifailile.

## 6. Autenditud runtime ja koristus

Kasutati lokaalset tootmisbuildi, päris PostgreSQL-i/Prisma ühendust, NextAuth `LoginTempToken` sessioone ning ainult `example.invalid` sünteetilisi kontosid. E-kirju ega teavitusi ei saadetud.

| Kontroll | Request | Offer |
|---|---:|---:|
| Omaniku DRAFT detail | 200 | mine-skoobis nähtav |
| Võõra DRAFT detail | 404 | 404 |
| Võõra CLOSED/CANCELLED detail | 404 | 404 |
| Puuduv vs keelatud 404 staatus ja keha | identne | identne |
| OPEN detail võõrale | 200, otsesed privaatvõtmed puudusid, kaudsed markerid lekkisid | 200, otsesed privaatvõtmed puudusid, kaudsed markerid lekkisid |
| `scope=global&status=DRAFT` | DRAFT puudus, OPEN olemas | DRAFT puudus, OPEN olemas |
| `scope=mine&status=DRAFT` | DRAFT olemas | DRAFT olemas |
| Aegunud OPEN globaalvaates | puudus | puudus |
| ADMIN võõra DRAFT GET | 404 | teenusekiht sama lepinguga |
| Autentimata detail | 401 | sama route-leping |

Täiendavalt: võõra PATCH = 403, omaniku PATCH = 200, ADMIN-i võõra DRAFT DELETE = 200.

Koristuseelne sünteetiline maht oli 3 kasutajat, 6 ühekordset login-tokenit, 4 abisoovi, 4 abipakkumist, 3 kaardikirjet ja 0 match'i. Kasutajate kustutamise järel kontrolliti jäägid eraldi: kasutajad 0, tokenid 0, abisoovid 0, abipakkumised 0, kaardikirjed 0, match'id 0. Ruumide ega teavituste sünteetilisi kirjeid ei loodud. Auditiserver peatati.

## 7. Lõppotsus ja täpne edasitee

Paketi võib hoida auditi- ja parandusfaasis, kuid seda ei tohi praegusel kujul main'i integreerida. Uus eraldi paranduscommit peab sulgema HELP-P0-01 ja HELP-P0-02, täiendama testid ristvälja-markeritega ning parandama progressidokumendi väited. Seejärel tuleb korrata vähemalt 26 P0 testi, uued detail/list/map/chat markeritestid, kogu testipakk, kontrollitud failide lint, i18n, build, migratsioonikontroll ja autenditud request/offer HTTP-smoke koos nulljääkide kontrolliga.

Pärast rohelist kordusauditit on puhas tehniline integratsioonitee praegusele `origin/main @ 2a63fcd0`: `e0875407` → `3479a447` → uus privaatsusprojektsiooni paranduscommit. Alternatiivina võib sama kolme commit'i vahemiku rebase'ida tervikuna main'i peale. `3479a447` üksi ei ole soovitatav, sest progressidokumendi modify/delete konflikt on simulatsiooniga tõendatud.

Rakenduskoodi, Prisma skeemi, migratsioone, teste ja tõlkefaile auditi käigus ei muudetud. Merge'i ega deploy'd ei tehtud. Ainus jälgitav muudatus on käesolev auditidokument docs-only auditiharul.

VERDICT: CHANGES_REQUIRED
STATUS: COMPLETE
