# Help-P0a kitsas kordusaudit

**Otsus: `CHANGES_REQUIRED`**

HELP-P0-01 on suletud, kuid HELP-P0-02 ei ole nõutud väljundilepingu järgi täielikult suletud. Autenditud HTTP-smoke kinnitas mõlemas vestluse browse-suunas keelatud singulaarse võtme `workflow.help.municipalityId` olemasolu nii kliendile tagastatud workflow-vastuses kui ka salvestatud assistendi metadata's. Väärtus oli selles run'is `null` ja sünteetilise KOV-i tegelik sisemine ID ei lekkinud, kuid ülesande kriteerium nõuab, et `municipalityId` ja `municipalityIds` võtmed avalikust väljundist puuduksid ning singular/plural ID-lekke loendur oleks 0. Tegelik võtmetabamus oli igal kontrollitud vestluspinnal 1.

Pakett ei või veel integratsioonikorvi liikuda.

## 1. Skoop ja lähtepunkt

See on algse Help P0 auditi leidude HELP-P0-01 ja HELP-P0-02 kitsas korduskontroll. HELP-P0-03 404 ajastuserinevust ei mõõdetud, sest see on mitteblokeeriv P3 ja P0a skoobist väljas.

| Väli | Väärtus |
|---|---|
| Algne audit | `codex/help-listings-privacy-p0-audit` @ `2f9323a6f4b61110e31048e7f9eb9ec9ac123b99` |
| Algne teostus | `3479a4477865694fb1a6520583ba2131d55e856d` |
| Parandusharu | `codex/help-listings-privacy-p0a-public-projection` |
| Paranduscommit / auditi HEAD | `56b70fe2a515c9e91a6d4e99ba308d71e05a3cf7` |
| Auditeeritud vahemik | `3479a4477865694fb1a6520583ba2131d55e856d..56b70fe2a515c9e91a6d4e99ba308d71e05a3cf7` |
| Kordusauditi haru | `codex/help-listings-privacy-p0a-reaudit` |
| Worktree | värske eraldi worktree commit'i `56b70fe2` pealt; selle otsene vanem oli `3479a447` |

Koodiparandusi, merge'i ega deploy'd ei tehtud. Auditi ainus püsiv muudatus on see raport.

## 2. Allesjäänud leid

### HELP-P0-02 — workflow ümbrises säilib keelatud `municipalityId` võti

**Staatus: AVATUD / integratsiooni blokeeriv selles paketis**

`createHelpWorkflowDraftState` ehitab `lib/help/workflowState.js:85` juures väljundolekusse alati välja

```text
municipalityId: String(input?.municipalityId || "").trim() || null
```

Browse-tulemus ise on ohutu avalik projektsioon, kuid `buildHelpWorkflowMetadata` mähib kogu workflow-oleku `workflow.help` alla (`lib/help/chatWorkflow.js:737-741`, `1451-1453`). Sama objekt:

- tagastatakse `/api/chat` vastuses `workflow` väljana (`lib/chat/workflowBranchHandlers.js:65-96`, `lib/chat/responseFinalizer.js:96-128`);
- lisatakse assistendi salvestatud metadata'sse `metadataExtra` kaudu (`lib/chat/workflowBranchHandlers.js:65-81`).

HTTP-smoke'i täpsed võtmerajad olid mõlemas browse-suunas:

```text
response:  $.workflow.help.municipalityId
metadata:  $.workflow.help.municipalityId
```

Kõigil neljal juhul oli väärtus `null`; tegeliku sünteetilise KOV-ID väärtuse tabamusi oli 0. See ei ole sisemise ID väärtuse avaldamine, vaid keelatud väljundivõtme säilimine. Vastuvõtukriteerium 6 ütleb siiski, et väli peab puuduma, ning smoke'i singular/plural võtmeleke peab olema 0.

Roheline sihttest ei kata seda lepingut täielikult: `tests/help/publicProjectionPrivacyP0a.test.js:272` ja `:285` kutsuvad workflow metadata kontrolli valikuga `{ forbidMunicipalityKeys: false }`. Seetõttu võivad 31/31 testid läbida ka siis, kui metadata sisaldab `municipalityId` võtit.

Nõutav sulgemistingimus on konkreetne: mõlema browse-suuna kliendivastuses ja salvestatud assistendi metadata's peavad rekursiivsed `municipalityId`/`municipalityIds` võtmetabamused olema 0. Käesolevas auditis koodi ei parandatud.

## 3. Staatiline korduskontroll

| Nõue | Tulemus | Tõend |
|---|---|---|
| 1. Detail, globaalne loend, Teenusekaart, browseResults ja workflow kasutavad sama fail-closed projektsiooni | **OSALINE** | Avalik detail suundub `toPublicHelpListingDetailView` kaudu ühisesse `toPublicHelpListingProjection`-isse (`listingAccess.js:73`, `listingViews.js:485`, `648-649`). Globaalne request/offer loend kasutab sama projektsiooni (`requests.js:393`, `offers.js:388`), Teenusekaart samuti (`mapEntries.js:370`) ning vestluse `browseResults` samuti (`chatWorkflow.js:1220`, `workflowActions.js:130`). Välimine workflow-olek ise säilitab aga keelatud `municipalityId` võtme. |
| 2. Avalik väljund ei kasuta fallback'ina salvestatud title/description/roleLabel/structuredSummary ega privaatväljadest tuletatud vabateksti | **PASS** | `toPublicHelpListingProjection` on allowlist-projektsioon: pealkiri ja kokkuvõte sünteesitakse usaldatud kategooria-, piirkonna-, tüübi- ja sihtrühmaandmetest; salvestatud vabatekstivälju ei loeta avaliku teksti fallback'ina. Runtime-markerite leke oli detailis, loendis, kaardil ja vestluses 0. |
| 3. Legacy-kirje on kaitstud ka avaliku nimega tekstivälja kopeeritud privaatväärtuse korral | **PASS** | Runtime legacy request sisaldas eraldi markereid väljades `title`, `description`, `structuredSummary`, `roleLabel`, `rawPlace` ning kaardikirje vabatekstiväljades. Võõra detailis, globaalses loendis, Teenusekaardil ja request-browse'is oli markerileke 0. |
| 4. Omanik näeb privaatvälju edasi | **PASS** | Autenditud omanikud nägid request'i 16/16 ja offer'i 15/15 eraldi privaatmarkerit. |
| 5. Sisemine matching ja salvestusloogika pole muutunud | **PASS** | `lib/help/matches.js` diff oli tühi. `requests.js` ja `offers.js` vahemiku muudatused piirduvad avaliku projektsiooni impordi ning listingu lõppprojektsiooni valikuga; create/update salvestusharud jäid muutmata. |
| 6. Avalikus väljundis puuduvad municipalityId, region.municipalityIds ja ümbernimetatud kujud | **FAIL** | Detaili, loendi ja kaardi võtme- ning väärtusetabamused olid 0; browseResults'i kandidaatprojektsioon oli ohutu. Mõlema `/api/chat` workflow-vastuses ja persisted metadata's oli siiski üks `workflow.help.municipalityId` võtmetabamus. ID-väärtuse tabamusi oli 0. |
| 7. Tekstiline municipalityLabel võib säilida | **PASS** | Võõra detail ja kõik kolm siht-kaardikirjet tagastasid tekstilise väärtuse `Kordusauditi vald`, sisemist ID-d tagastamata. |
| 8. Prisma skeemi ega migratsioone pole muudetud | **PASS** | `git diff --exit-code 3479a447..56b70fe2 -- prisma` oli tühi. Ajutisse DB-sse rakendusid kontrolliks kõik 92 olemasolevat migratsiooni. |

## 4. Automaatkontrollid

| Kontroll | Tulemus |
|---|---|
| Privaatsuse sihttestid: `listingPrivacyP0`, `listingPrivacyRouteContract`, `publicProjectionPrivacyP0a` | **31/31 PASS**, 0 fail, 0 skip |
| Help/Teenusekaart/vestluse regressioonid: `tests/help/*.test.js`, `serviceMap/publicEntriesPolicy`, `chat/helpListingsReturnTarget` | **44/44 PASS**, 0 fail, 0 skip |
| Sihtlint paranduse kuue teostusfaili ja kahe muudetud testi üle | **PASS**, 0 viga, 0 hoiatust |
| `git diff --check 3479a447..56b70fe2` | **PASS** |
| `git diff --exit-code 3479a447..56b70fe2 -- lib/help/matches.js prisma` | **PASS**, diff 0 |

Testide roheline seis ei muuda otsust, sest workflow metadata sihttest keelab markerid, kuid vabastab `municipalityId`/`municipalityIds` võtmed teadlikult kontrollist.

## 5. Autenditud HTTP-smoke

### 5.1 Isolatsioon ja andmestik

Lõplik sõltumatu run oli `helpp0a1784211430449`; ajutine PostgreSQL DB oli `helpp0a1784211430449_reaudit`. Kasutati päris NextAuth credentials callback'i, kolme ühekordset `LoginTempToken`-it ja kolme eraldi sünteetilist kasutajat:

- request'i omanik;
- offer'i omanik;
- võõras vaataja.

Andmestik sisaldas kahte OPEN request'i (üks tavaline ja üks legacy), ühte OPEN offer'it, kolme PUBLISHED kaardikirjet, ühte match'i, ühte sünteetilist KOV-i, kategooriat ja sihtrühma. Request'i ning offer'i igal kontrollitud privaatväljal oli oma marker. Legacy-kirje avaliku nimega tekstiväljade ja kaardikirje persisted vabateksti markerid olid samuti eraldiseisvad.

### 5.2 Tulemused

| Pind | HTTP / hulk | Privaatmarkerite leke | KOV-ID väärtuse leke | municipalityId(s) võtmeleke |
|---|---:|---:|---:|---:|
| Omaniku request-detail | 200 | omanik nägi 16/16 | lubatud omanikuprojektsioon | ei hinnatud avaliku pinnana |
| Omaniku offer-detail | 200 | omanik nägi 15/15 | lubatud omanikuprojektsioon | ei hinnatud avaliku pinnana |
| Võõra request-detail | 200 | 0 | 0 | 0 |
| Võõra offer-detail | 200 | 0 | 0 | 0 |
| Võõra legacy-detail | 200 | 0 | 0 | 0 |
| Globaalne request-loend | 200 | 0 | 0 | 0 |
| Globaalne offer-loend | 200 | 0 | 0 | 0 |
| Teenusekaart | 200, 3/3 sihtkirjet | 0 | 0 | 0 |
| Chat browse offers, vastus | 200, 1 browseResult | 0 | 0 | **1** (`$.workflow.help.municipalityId`) |
| Chat browse offers, persisted metadata | 1 assistendi rida | 0 | 0 | **1** (`$.workflow.help.municipalityId`) |
| Chat browse requests, vastus | 200, 2 browseResult'i, sh legacy | 0 | 0 | **1** (`$.workflow.help.municipalityId`) |
| Chat browse requests, persisted metadata | 1 assistendi rida | 0 | 0 | **1** (`$.workflow.help.municipalityId`) |

Teenusekaardi aadressi/rawPlace erikontroll:

- 3/3 sihtkirjel `address === null`;
- 3/3 sihtkirjel `normalizedAddress === null`;
- rekursiivseid `rawPlace` võtmeid 0;
- kõigi aadressi, normalizedAddress'i, rawPlace'i, serviceArea, needTags'i ja privacyNote'i markerite leke 0;
- legacy-kaardikirje oli vastuses olemas ja jäi fail-closed.

## 6. Koristus ja lõppjäägid

Lõpliku run'i koristuseelsed sihtread olid: kasutajad 3, sessioonid 3, login-tokenid 3, request'id 2, offer'id 1, kaardikirjed 3, match'id 1, vestlused 2, sõnumid 4, kategooriad 1, sihtrühmad 1 ja KOV-id 1.

Pärast koristust oli iga nimetatud rea sihtloendur **0**. Ajutise DB puudumine kinnitati pärast `DROP DATABASE`; runtime-pordi kuulavaid protsesse oli 0 ning runtime-logide ja `.next` ajutiste failide jääke 0. Auditi jaoks loodud `node_modules` ja Prisma `generated` sõltuvusartefaktid eemaldati samuti.

Esimene diagnostiline run `helpp0a1784211356876` katkestati kohe esimesel chat-võtmetabamusel. Selle finally-koristus andis samuti kõikidele sihtridadele 0, ajutine DB eemaldati ja pordijääk oli 0. Selle run'i järel parandati ainult auditirunneri diagnostikat, mitte auditeeritavat koodi. Lõplik teine run kinnitas kumulatiivse runtime-failijäägi 0. Ajutine auditirunner ja selle tühi abikaust eemaldati.

**Raporteeritavad lõppjäägid: 0 sünteetilist kasutajat, sessiooni, tokenit, request'i, offer'it, kaardikirjet, match'i, vestlust, sõnumit, taksonoomiarida, ajutist DB-d, runtime-faili või kuulavat protsessi.**

## 7. Lõppotsus

`CHANGES_REQUIRED`

- **HELP-P0-01: SULETUD.** Stored/legacy privaattekst ei jõudnud võõra detaili, globaalloendisse, Teenusekaardile, browseResults'i, workflow vastuseteksti ega persisted metadata'sse; omanikuprojektsioon säilis.
- **HELP-P0-02: OSALISELT AVATUD.** Sisemise KOV-ID väärtus ja `region.municipalityIds` ei lekinud, kuid keelatud singulaarne `workflow.help.municipalityId` võti säilib null-väärtusega kliendivastuses ja assistendi metadata's. Nõutud null võtmetabamust ei saavutatud.

Integratsioonikorvi liikumiseks tuleb see võtmejääk eemaldada või kitsendada workflow avalikust/persisted projektsioonist ning lisada regressioon, mis ei kasuta workflow metadata puhul `{ forbidMunicipalityKeys: false }`. See raport ei sisalda koodiparandust.
