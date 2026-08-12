# SotsiaalAI SOL-süvaaudit — jätk: Teenusekaart, lõpetus

**Auditi seis:** Teenusekaardi korduskontroll, funktsioonidevahelised sisenemisteed, konto-/andmekoopia seosed ning anonüümne ja sünteetilise vastusega brauseriruntime `DONE`; autentitud mitme kasutaja, päris PostgreSQL-i, RAG-i ja välise geokooderi tervikruntime `NOT_PROVEN`; `runtime: PARTIAL`.

**Fikseeritud audit-commit:** `a4e00e43ea72e6d0e08a09103df804d14123dbb0`

**Audit-worktree:** `C:\Users\rauds\Desktop\SotsiaalAI-sol-audit-smapclose-a4e00e4` (detached HEAD). Worktree praegune HEAD `fc34d636324ca6946d9810981d2adf169c41ad25` lisab ainult jätkuauditite registri; tootmiskoodi tõendibaas on endiselt fikseeritud commit `a4e00e43`. Põhiprojekti commit'imata PWA-, autentimis- ega auditimuudatusi ei kasutatud tõendina.

Kasutaja tagasiside põhjal tehtud Teenusekaardi visuaalparandus elab eraldi harus `codex/service-map-glass-visual-fix` ja eraldi worktree's. See ei kuulu käesoleva fikseeritud koodi audititõendisse ning seda ei ole commit'itud, push'itud ega deploy'itud.

## Katvustabel

| Pind | Seis | Kontrollitud ulatus |
|---|---|---|
| Varasemad `SOL-SMAP-01`–`08` | DONE | fikseeritud koodi võrdlus eelmise audit-commit'iga, leidude kattuvus, vastuvõtukriteeriumid ja praegune seis |
| Otsing, tulemused ja detail | DONE | 500/24 piir, kliendifilter, URL-i algfiltrid, marker, üksik- ja grupipopup, detaili-/toimingute võrdsus |
| Süvalingid ja teavitused | DONE | `entryId`, `listing` ja `match` lingitootjad; Teenusekaardi parser, tüübivalik, markerifookus ja popup |
| Anonüümne avalik pind | DONE | päris HTTP vastus, `peerListingsAvailable`, anonüümsed filtrid, aadressiotsingu ja abisobituse auth-värav |
| Konto kustutus ja andmekoopia | DONE | SOLO teenuseprofiili/kaardikirjete peitmine, RAG-i kustutusjärjekord ning ekspordiregistri katvus; olemasolevate `SOL-SPROF` leidude kattuvus |
| Teised tarbijad | DONE | vestluse KOV-kontakti retrieval, Teekonna Teenusekaardi handoff, eelpöördumise tagasilink ja notification/action deep-link'id |
| Väline kaardipakkuja | DONE | tile-URL, päris brauseripäringud, request-headerid, privaatsuspoliitika teenusepakkujate loend ja UI teavitus |
| Autentitud päris tervikvoog | NOT_PROVEN | jagatud sünteetiliste credential'idega teenuseosutaja/KOV/abikuulutuse loomine, kahe kasutaja sobitus, eelpöördumine ja notification click-through |
| Päris andmekihid | NOT_PROVEN | suur PostgreSQL-i andmestik, päris RAG-i reconcile, Maa- ja Ruumiameti geokooder ning scheduler/deploy-seadistus |

## Auditeeritud lisapinnad

- `lib/actions/registry.js` ja `lib/notifications.js`: Teenusekaardi `listing`- ja `match`-süvalingid.
- `components/journey/JourneyDetail.jsx`: Teekonna märksõna-/piirkonnahandoff ja kasutajale antud privaatsuslubadus.
- `lib/chat/retrievalContextAssembler.js`: avaldatud KOV Teenusekaardi kontaktide laadimine vestluse autoriteetsesse konteksti.
- `lib/dataExport/registry.js`, `lib/dataExport/service.js`: isikuandmete koopia suletud pinnaregister.
- `lib/privacy/effectivePracticeAccountCleanup.js`: SOLO teenuseprofiili ja kaardikirjete `HIDDEN`-siire ning RAG-kustutuse töö.
- `messages/et.json`: privaatsuspoliitika tehnilised andmed, välised teenusepakkujad ja Teenusekaardi/Teekonna privaatsustekstid.
- `components/workspace/ServiceMapLeaflet.jsx`: sama päritolu tile-proxy, Leafleti veakäitlus ja nähtav aluskaardi atributsioon.

## Eelmise Teenusekaardi auditi ametlik seis

`f72c2f468bffdb3befe4e9c7c05c3ebc04d350a5..a4e00e43ea72e6d0e08a09103df804d14123dbb0` võrdluses ei ole Teenusekaardi lehte, API-t, kaardikomponenti, sünkroniseerijaid, eelpöördumise adressaadilahendust, Prisma skeemi ega sihtteste muudetud. Seetõttu ei saa ühtki varasemat leidu parandatuks lugeda ainult uuema commit'i alusel.

| Leid | Praegune seis | Värske lisatõend |
|---|---|---|
| `SOL-SMAP-01` — geokooder avaldab ülevaatamata kirje | NOT_DONE | olekusiirde kood muutumata; uut admini publish/CAS/auditilepingut ega negatiivtesti pole |
| `SOL-SMAP-02` — allikast kadunud kontakt jääb avalikuks | NOT_DONE | RAG/KOV reconcile-, generatsiooni- ja tombstone-rada endiselt puudub; vestluse retrieval võimendab sama stale-rida |
| `SOL-SMAP-03` — keelatud kanalite toimingud | NOT_DONE | teenuse+asukoha serveripoolne kanalipoliitika ja teenuse stabiilse ID serverikontroll puuduvad endiselt |
| `SOL-SMAP-04` — vaikne 500/24 kärbe | NOT_DONE | klient küsib endiselt `limit=500`, tulemusriba lõikab 24 peale ning vastuses puudub cursor/truncation leping |
| `SOL-SMAP-05` — grupipopup kaotab detaili | NOT_DONE; runtime reproduced | kahe samal koordinaadil sünteetilise KOV-kontakti popup näitas nime, telefoni, e-posti ja `Kirjuta`, kuid mitte kummagi teenuseid, ligipääsuteed ega platvormipöördumist |
| `SOL-SMAP-06` — süvalink ei ava kirjet | NOT_DONE; runtime reproduced | `?entryId=audit-entry-target&type=SERVICE_PROVIDER` valis tüübi ja kuvas rea/markeri, kuid ei valinud kirjet ega avanud popup'i; sama parser eirab `listing` ja `match` linke |
| `SOL-SMAP-07` — ühe allika viga võtab maha kogu kaardi | DONE | omaniku kinnitatud osalise tulemuse leping on aktiveeritud; allikapõhine route, fail-closed turvapiir, kombineeritud cursor ja nähtav hoiatus on sihttesti ning Chromiumiga tõendatud |
| `SOL-SMAP-08` — anonüümsele näidatakse keelatud peer-filtreid | NOT_DONE; runtime reproduced | päris anonüümne API tagastas `peerListingsAvailable:false`, kuid UI näitas endiselt `Abisoovid` ja `Abipakkumised` valikuid |

`SOL-SMAP-06` alla kuuluvad lisaks eelpöördumise `entryId`-le kaks sama juurpõhjusega teavitusrada: `ActionKind.OPEN_LISTING` loob `/teenusekaart?listing=...` ja sobitusteavitus `/teenusekaart?match=...`, kuid `readInitialServiceMapFilters()` loeb ainult märksõna, piirkonna ja tüübi. Neile ei tehtud uusi duplikaat-ID-sid.

## Uus lõpetusleid

### SOL-SMAP-09 — kaardi vaateala liigub otse välisele tile-serverile ilma Teenusekaardi-põhise teavituseta — P2

**Tõend.** `ServiceMapLeaflet` kasutab vaikimisi brauseripoolset URL-i `https://tiles.maaamet.ee/.../{z}/{x}/{y}.png&ASUTUS=SOTSIAALAI&KESKKOND=LIVE&IS=TEENUSEKAART` ja annab selle otse `L.tileLayer()`-ile (`components/workspace/ServiceMapLeaflet.jsx:17-18,798-801`). Fikseeritud koopia päris anonüümses Chromiumi runtime'is tegi Teenusekaardi avamine 18 otsest `GET`-päringut `tiles.maaamet.ee` domeenile; kõik vastasid 200. Ühe päringu headerites olid brauseri user-agent, Windowsi platvormisignaal ja `Referer: http://localhost:3004/`; võrgutasandil jõuab teenusepakkujani ka kliendi IP ning tile'i `z/x/y` kirjeldab kuvatavat vaateala. SotsiaalAI sessiooniküpsist, Teekonna teksti ega Teenusekaardi URL-i täispäringut tile-requestis ei tuvastatud.

Privaatsuspoliitika nimetab tehniliste andmetena IP-aadressi, brauseri ja seadme metaandmed (`messages/et.json:1772-1775`) ning loetleb välised teenusepakkujad (`:1785-1787`), kuid Maa- ja Ruumiametit või kaardiplaatide otsepäringut loendis ei ole. Teenusekaardi pinnal on ainult kaardiattributsioon; enne tile-requesti ei ole andmevoo teavitust ega serveripoolset proxy't. Teekonna handoff ütleb kasutajale, et Teenusekaart ei jaga Teekonda ühegi osapoolega (`components/journey/JourneyDetail.jsx:1214`); otsest Teekonna sisu ei jagata, kuid märksõna/piirkonna järgi muutuv kaardivaade võib välise teenuse jaoks koos IP-ga teha otsitud piirkonna tuletatavaks.

**Mõju.** Kasutaja ja organisatsioon ei saa olemasolevast Teenusekaardi UI-st ega teenusepakkujate loendist teada, et kaardi avamine tekitab vahetu kolmanda domeeni ühenduse. Eriti Teekonnast või tundlikust otsingust avatud piirkonnapõhise vaate puhul on vähemalt tehniliselt võimalik seostada võrguidentifikaator kuvatud geograafilise alaga. Algne otseühendus oli seetõttu päris privaatsusrisk. Välise teenuse logide täpne säilitusaeg ei ole avaldatud, kuid pärast sama päritolu proxy kasutuselevõttu ei ole upstream'i päringu IP enam Teenusekaardi lõppkasutaja IP.

**Vastuvõtukriteerium.** Tile-teenuse tegelik brauser → SotsiaalAI proxy → Maa- ja Ruumiamet andmevoog ja ametlik kasutusõigus peavad olema dokumenteeritud. Lõppkasutaja IP/UA, Cookie/Auth/Referer/XFF, Teekonna tekst ega otsingusisu ei tohi upstream'i minna; proxy peab minimeerima metaandmed, valideerima vastuse ja ebaõnnestuma tulemuste loendit kaotamata. Nähtav atributsioon peab vastama aluskaardi juhisele. Brauseritest peab tõendama lubatud domeenid, päringu andmeminimaalsuse ja välisteenuse veakäitumise.

**Paranduse tõend.** Brauser kasutab ainult sama päritolu `/api/service-map/tiles/{z}/{x}/{y}` proxy't. Proxy upstream on fikseeritud; päringus on ainult tile-koordinaadid, staatilised `ASUTUS=SOTSIAALAI`, `KESKKOND=LIVE`, `IS=TEENUSEKAART` tähised, PNG aktsept ja fikseeritud proxy user-agent. Kliendi Cookie/Auth/Referer/XFF/IP/UA-d, Teekonna tekst ja otsingusisu upstream'i ei edastata. Koordinaadi-, MIME-, mahu-, redirect- ja timeout-kontroll on fail-closed ning vastus on `no-store`. Chromiumi kontrollis tekkis pärast zoomi 10 sama päritolu tile-päringut ja 0 otsest `tiles.maaamet.ee` päringut; provider-failure jättis tulemuste loendi kasutatavaks.

[Maa- ja Ruumiameti kehtivad kaarditeenuste kasutustingimused](https://geoportaal.maaruum.ee/est/teenused/wms-wfs-wcs-teenused/maa-ja-ruumiameti-kaarditeenuste-kasutustingimused-p24.html) hõlmavad TMS/WMTS teenuseid, lubavad tasuta integreerimist ka ärilisel eesmärgil ning nõuavad allikaviidet; eraldi luba ei ole tingimustes nõutud. Tingimused kirjeldavad koormuse ja päringute IP-aadresside jälgimist ning ei soovita puhverdamist; SotsiaalAI `no-store` proxy ei puhverda. Pärast proxy't on teenusepakkujale nähtav IP SotsiaalAI serveri, mitte lõppkasutaja oma. [Halltoonides aluskaardi kirjeldus](https://geoportaal.maaruum.ee/est/ruumiandmed/topokaardid-ja-aluskaardid/kaart-p560.html) annab soovitusliku kuju „Aluskaart: Maa- ja Ruumiamet“, mida komponent nüüd nähtavalt kasutab. [EDPB rolliselgituse](https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en) põhjal eeldaks volitatud töötleja roll isikuandmete töötlemist vastutava töötleja nimel; tehnilisest voost ei ilmne, et Maa- ja Ruumiamet saaks SotsiaalAI lõppkasutaja isikuandmeid. See viimane järeldus on dokumenteeritud andmevoost tehtud hinnang, mitte väide ameti avaldamata serverilogide täpse sisu või säilitusaja kohta.

**Seis.** DONE. Algne otsene lõppkasutaja võrgu- ja vaatealainfo leke on proxy'ga suletud, välisteenuse rike ei muuda tulemuste loendit kasutamatuks, ametlik integratsiooniõigus ja allikaviite nõue on dokumenteeritud ning nähtav atributsioon on parandatud. Avaldamata upstream-logide täpne säilitusaeg ei blokeeri seda leidu, sest proxy ei saada upstream'i Teenusekaardi lõppkasutaja identifikaatorit ega otsingusisu.

## Testide ja runtime'i täpsed tulemused

1. Worktree algse setup'i katse enne lokaalse Prisma kliendi genereerimist: **50 testi läbis**, 13 testifaili ei laadinud puuduva genereeritud Prisma kliendi / `node_modules` tõttu. See oli auditikeskkonna setup-viga, mitte tootmiskoodi tulemus.
2. Pärast ignoreeritud `node_modules` junction'i ja `prisma generate` taastamist:
   `node --import ./scripts/register-node-test-loader.mjs --test tests/serviceMap/*.test.js tests/serviceProvider/*.test.js tests/preInquiries/serviceMapRecipientId.test.js tests/help/matchConsent.test.js tests/help/listingPrivacyP0.test.js tests/help/listingPrivacyRouteContract.test.js tests/journey/helpMediation.test.js tests/events/actionsRegistry.test.js tests/notifications/workspaceContinuity.test.js tests/notifications/workspaceContinuityUi.test.js tests/chat/retrievalContextAssembler.test.js tests/dataExport/dataExportService.test.js tests/effectivePractices/effectivePracticeAccountDeletion.test.js`
   — **141/141 PASS**, 0 failed/skipped/todo.
3. Fikseeritud koopia Webpack-dev server `localhost:3004`: käivitus edukalt.
4. Päris anonüümne HTTP:
   - `GET /api/service-map/entries?limit=500` — **200**, `ok=true`, `entries=0`, `peerListingsAvailable=false`;
   - `GET /api/service-map/address-suggestions?query=Tartu` — **401**;
   - `GET /api/help/matches` — **401**.
5. Sünteetilise ühe teenuseosutajaga route-mock: URL-i tüüp rakendus ja sihtkirje oli vastuses/kaardil, kuid `entryId` ei tekitanud valikut ega popup'i — `SOL-SMAP-06` runtime kinnitatud.
6. Kahe samal koordinaadil sünteetilise KOV-kontaktiga route-mock: grupipopup avanes, kuid mõlema fixture'i teenused ja ligipääsuteed puudusid — `SOL-SMAP-05` runtime kinnitatud.
7. Sama anonüümne vastus kandis `peerListingsAvailable=false`, kuid brauseri radiogrupis olid kõik neli tüüpi, sealhulgas `Abisoovid` ja `Abipakkumised` — `SOL-SMAP-08` runtime kinnitatud.
8. Brauseri network-logi: **18/18** Maa- ja Ruumiameti tile-päringut vastasid 200; request-headeri kontroll kinnitas `Referer`, user-agent'i ja platvormisignaali. Välise teenuse serveriloge ei kasutatud.

## Funktsioonidevahelised kattuvused

- Konto lõppkustutus muudab kasutaja SOLO teenuseprofiili ja selle kaardikirjed `HIDDEN`-iks ning järjekorrastab RAG-kustutuse (`lib/privacy/effectivePracticeAccountCleanup.js:225-281`). See toetab olemasoleva `SOL-SPROF-01` DONE-seisu; uut SMAP leidu ei lisatud.
- Isikuandmete ekspordiregister ei sisalda teenuseprofiili ega Teenusekaardi kirjeid. See on juba `SOL-SPROF-08`; Teenusekaardi lõpetus ei dubleeri seda.
- Vestluse retrieval laeb avaldatud KOV Teenusekaardi kontakte autoriteetse kontekstina. Kui ülevaatamata või allikast kadunud kontakt on `PUBLISHED`, suurendab see `SOL-SMAP-01`/`02` mõju, kuid ei ole eraldi juurpõhjus.
- Help-kuulutuste anonüümne projektsioon, nõusolek ja sobituse olekumasin jäävad `SOL-HELP` leidude alla. Siin kontrolliti üksnes Teenusekaardi võimekuslippu ja süvalinki.
- Välitöö/Teenuspäeviku muud asukoharajad kontrollitakse funktsioonideüleses auditiplokis; `SOL-SMAP-09` ei väida veel kogu platvormi kaardipakkujate koondseisu.

## Leidude koondseis

| Allikas | P0 | P1 | P2 | P3 | Kokku |
|---|---:|---:|---:|---:|---:|
| Varasem Teenusekaardi jätkuaudit `SOL-SMAP-01`–`08` | 0 | 3 | 5 | 0 | 8 |
| Käesolev lõpetus `SOL-SMAP-09` | 0 | 0 | 1 | 0 | 1 |
| **Kokku aktiivselt avatud** | **0** | **3** | **6** | **0** | **9** |

## Mis jäi Teenusekaardis tõendamata

- autentitud teenuseosutaja profiili avaldamine, teenusekanalite muutmine ja sama kirje nägemine teise kasutaja brauseris;
- kahe sünteetilise kasutaja abisobitus, nõusolek, ruumi loomine, notification delivery ja `match`-lingi tegelik click-through;
- eelpöördumise saatmine, saaja kanalipoliitika serverikontroll ja `entryId`-lingi parandatud sihtkäitumine;
- 501+ teenuse-/help-kirjega päris PostgreSQL-i paginatsioon, stabiilne sort ja asukohaks laiendamise duplikaadid;
- RAG/KOV täieliku, osalise, tühja ja nurjunud allika reconcile ning scheduler/deploy-seadistus;
- Maa- ja Ruumiameti geokooderi päris vastused ja limiter mitme Node'i vahel;
- tootmiskeskkond, päris kasutajad ja päris andmed — neid ei kasutatud.

**Runtime'i lõppseis:** `PARTIAL`; autentitud runtime `NOT_PROVEN`.

**Järgmine auditiplokk:** kõik `PARTIAL`, `NOT_PROVEN`, esimese süvaploki ja `runtime: not_run` funktsioonid, seejärel Haldus/Ruumid/Töölaud ning funktsioonideülene audit.
