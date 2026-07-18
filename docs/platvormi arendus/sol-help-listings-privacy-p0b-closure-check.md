# HELP-P0b kitsas sõltumatu sulgemiskontroll

**Lõppverdikt: `PASS`**

HELP-P0b sulgeb P0a kordusauditis alles jäänud browse-workflow `municipalityId` võtme. Kõik neli kohustuslikku runtime-rada andsid rekursiivselt 0 `municipalityId` võtit, 0 `municipalityIds` võtit, 0 sünteetilise KOV-ID väärtusetabamust ja 0 privaatmarkeri tabamust. Omanikuvaade ning sisemine KOV-põhine workflow ja matching säilisid.

**Kogu Help P0 ahel on integratsioonivalmis. Seda ei integreeritud ega deploy'itud.**

## 1. Skoop ja Git-seis

Kontroll hõlmas ainult vahemikku `8e442bb3d9ca1f86d43b4c4e83145759e5529e9c..fb451593cf357f05c0eeb13333d5e18252d0afe7`.

| Kontroll | Tulemus |
|---|---|
| Värske eraldi worktree | **PASS** — `C:/Users/rauds/Desktop/SotsiaalAI-help-p0b-closure-audit` |
| Auditiharu | **PASS** — `codex/help-listings-privacy-p0b-closure-audit` |
| Auditeeritud HEAD | **PASS** — täpselt `fb451593cf357f05c0eeb13333d5e18252d0afe7` |
| HEAD parent | **PASS** — täpselt `8e442bb3d9ca1f86d43b4c4e83145759e5529e9c` |
| Committe vahemikus | **PASS** — 1 |
| Muudetud failid vahemikus | **PASS** — täpselt 3 |

Kolm faili olid:

1. `lib/help/chatWorkflow.js`;
2. `tests/help/publicProjectionPrivacyP0a.test.js`;
3. `docs/platvormi arendus/fable-5-help-listings-privacy-p0-progress.md`.

Algsete harude tipud jäid kontrolli lõpus muutmata:

- `fable/help-listings-privacy-p0` → `3479a4477865694fb1a6520583ba2131d55e856d`;
- `codex/help-listings-privacy-p0-audit` → `2f9323a6f4b61110e31048e7f9eb9ec9ac123b99`;
- `codex/help-listings-privacy-p0a-public-projection` → `56b70fe2a515c9e91a6d4e99ba308d71e05a3cf7`;
- `codex/help-listings-privacy-p0a-reaudit` → `8e442bb3d9ca1f86d43b4c4e83145759e5529e9c`;
- `codex/help-listings-privacy-p0b-workflow-key-removal` → `fb451593cf357f05c0eeb13333d5e18252d0afe7`.

Teostusharu ei amend'itud ega force-push'itud. Rakenduskoodi ei parandatud, merge'i ega deploy'd ei tehtud.

## 2. Staatiline turvapiir

### 2.1 Fail-closed allowlist

`toBrowseWorkflowOutputProjection` (`lib/help/chatWorkflow.js:737-782`) koostab browse-väljundi uue objektina ning loetleb lubatud väljad ükshaaval:

- workflow juhtväljad: `namespace`, `mode`, `intent`, `step`, `flowLocked`, `confirmationPending`;
- lähtekuulutuse viited: `sourceRecordId`, `linkedRequestId`, `linkedOfferId`;
- `browseResults`, mille iga rea ja selle `listingView` alamväljad koostatakse samuti eraldi allowlist'ina.

Projektsioonis pole state'i ega `listingView` objekti spread'i. Seetõttu ei kandu väljundisse automaatselt tulevased või tundmatud state-väljad.

Allowlist ei sisalda:

- `municipalityId`;
- `municipalityIds`;
- `municipalityCandidates`;
- `draft`;
- KOV-ID ümbernimetatud välju;
- tundmatuid state-välju.

Tekstiline `listingView.municipalityLabel` jääb lubatud avalikuks sildiks.

### 2.2 Ühine HTTP ja persistence'i projektsioon

`buildWorkflowMetadata` (`lib/help/chatWorkflow.js:789-794`) rakendab browse-intentidele ainult `toBrowseWorkflowOutputProjection` projektsiooni. Avalik `buildHelpWorkflowMetadata` (`:1503-1505`) delegeerib samale funktsioonile.

`lib/chat/workflowBranchHandlers.js` kasutab sama `buildHelpMeta(helpResult.workflowState)` projektsioonifunktsiooni mõlemal piiril:

- `:65-81` — `metadataExtra` kaudu persisted assistendi metadata;
- `:69` ja `:90-96` — HTTP-vastuse `workflow`.

Seega pole HTTP ja persistence'i vahel teist, leebemat projektsiooniteed.

### 2.3 Möödapääsud ja siseloogika

- `forbidMunicipalityKeys: false` ega samaväärset erandit `tests`/`lib` all ei leitud.
- `assertPublicPayloadIsSafe` kontrollib nüüd rekursiivselt KOV-ID võtmeid alati.
- Mõlemad browse-testid kontrollivad eraldi HTTP-kuju ja persisted metadata kuju.
- `lib/help/workflowState.js` jäi vahemikus muutmata ning sisemine `createHelpWorkflowDraftState.municipalityId` säilis (`:85`).
- `lib/help/matches.js`, request/offer create-storage, `workflowActions.js` ja Prisma jäid vahemikus muutmata.
- `chatWorkflow.js` koodidiff piirdus uue 52-realise projektsiooniploki ja ühe `buildWorkflowMetadata` rea asendusega; create/edit ja browse-matching käsitlejaid ei muudetud.

## 3. Automaatkontrollid

Värskes worktree's puudus algul `.env`, mistõttu esimene `npm ci` peatus postinstalli `prisma generate` sammul puuduva `DATABASE_URL` tõttu. See oli ootuspärane worktree bootstrap, mitte koodiviga. Repo tavapärane `npm ci` korrati nii, et põhitööpuu `.env` väärtused laaditi ainult protsessi keskkonda; Prisma Client genereeriti edukalt. `.env` faili worktree'sse ei kopeeritud.

| Kontroll | Tulemus |
|---|---|
| Privaatsuse sihttestid | **31/31 PASS**, 0 fail, 0 skip |
| Help/Teenusekaart/vestlus regressioonid | **44/44 PASS**, 0 fail, 0 skip |
| Sihtlint: `lib/help/chatWorkflow.js`, `tests/help/publicProjectionPrivacyP0a.test.js` | **PASS**, 0 viga, 0 hoiatust |
| `git diff --check 8e442bb3..fb451593` | **PASS** |
| Muutmata sisefailide/Prisma diff | **PASS**, diff 0 |
| Testi möödapääsu otsing | **PASS**, `forbidMunicipalityKeys: false` tabamusi 0 |

Täissviiti ei jooksutatud, sest see ei olnud kitsa sulgemiskontrolli kohustus.

## 4. Autenditud runtime-kontroll

### 4.1 Isolatsioon ja markerid

Runtime-run: `helpp0bca1784215457742`.

Ajutine PostgreSQL DB: `helpp0bca1784215457742_closure`; sinna rakendati kõik 92 olemasolevat migratsiooni. Kasutati päris NextAuth credentials callback'i ja ühekordseid `LoginTempToken`-eid.

Andmestikus olid:

- request'i ja offer'i omanik ning kolmas sünteetiline kasutaja;
- üks põh request ja offer samas sünteetilises KOV-is;
- üks request- ja offer-peibutuskirje teises KOV-is;
- kaks kaardikirjet ja üks match;
- eraldi marker igal põh request'i ja offer'i kontrollitud privaatväljal;
- eraldi markerid sisemise state'i `draft`-is, `municipalityCandidates`-is, tundmatus väljas ja ümbernimetatud väljas;
- tegelik sünteetiline KOV-ID `MUNICIPALITY_P0B_INTERNAL_helpp0bca1784215457742`.

### 4.2 Neli kohustuslikku rada

| Rada | `municipalityId` võtmed | `municipalityIds` võtmed | KOV-ID väärtus | Privaatmarkerid |
|---|---:|---:|---:|---:|
| Offer-browse HTTP-vastus | 0 | 0 | 0 | 0 |
| Offer-browse persisted metadata | 0 | 0 | 0 | 0 |
| Request-browse HTTP-vastus | 0 | 0 | 0 | 0 |
| Request-browse persisted metadata | 0 | 0 | 0 | 0 |

Mõlemad HTTP-kutsed tagastasid 200. Offer-browse tagastas täpselt ühe sama KOV-i offer'i; request-browse täpselt ühe sama KOV-i request'i.

### 4.3 Omanik ja sisemine workflow/matching

- request'i omanik nägi oma detailis **16/16** privaatmarkerit;
- offer'i omanik nägi oma detailis **15/15** privaatmarkerit;
- sisemine `runHelpChatWorkflow` säilitas sünteetilise `municipalityId` väärtuse;
- sisemine draft'i privaatmarker säilis workflow sees;
- mõlema suuna matching leidis sama KOV-i kirje;
- teise KOV-i request- ja offer-peibutuskirjed jäid tulemustest välja.

See kinnitab, et parandus eemaldab KOV-võtmed ainult avaliku/persisted browse-väljundi piirilt ega riku sisemist KOV-põhist töövoogu.

## 5. Koristus ja lõppjäägid

Koristuseelsed sihtloendurid:

| Objekt | Enne | Pärast |
|---|---:|---:|
| Kasutajad | 3 | 0 |
| Sessioonid | 2 | 0 |
| Login-tokenid | 3 | 0 |
| Request'id | 2 | 0 |
| Offer'id | 2 | 0 |
| Kaardikirjed | 2 | 0 |
| Match'id | 1 | 0 |
| Vestlused | 2 | 0 |
| Sõnumid | 4 | 0 |
| Kategooriad | 1 | 0 |
| Sihtrühmad | 1 | 0 |
| KOV-id | 2 | 0 |

Ajutise DB puudumine kinnitati pärast eemaldamist. Runtime-pordi kuulavaid protsesse oli 0 ja runtime-logide/`.next` failijääke 0. Auditirunner, esimese bootstrap-katse npm-logi, worktree `node_modules` ja genereeritud Prisma klient eemaldati.

**Lõppjääk: 0 sünteetilist kasutajat, sessiooni, tokenit, kuulutust, kaardikirjet, match'i, vestlust, sõnumit, taksonoomiarida, ajutist DB-d, runtime-protsessi, kuulavat porti või runtime-faili.**

## 6. Lõppotsus

`PASS`

Kõik neli rada andsid võtmete, väärtuste ja markerite arvestuses 0 ning sisemine/omanikuvaade säilis. HELP-P0-01, HELP-P0-02, P0a ja P0b sulgemisahel on integratsioonivalmis.

Selles kontrollis ei tehtud integratsiooni, merge'i ega deploy'd ning rakenduskoodi ei muudetud.
