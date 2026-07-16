# Admini analüütika, haldus- ja koondvaated

**Kuupäev:** 2026-07-15
**Analüüsi ulatus:** aktiivne `main` (töökataloogi seis), read-only
**Meetod:** koodiaudit (route'id, API-d, Prisma skeem, komponendid) + read-only runtime-kontroll võimalusel
**Staatus:** VALMIS — 12 peatükki (ptk 1–6 audit 2026-07-15; ptk 7–12 süntees 2026-07-16)

Põhiküsimus:

> Milline peab olema SotsiaalAI administraatori terviklik juhtimisvaade, et platvormi seis, riskid ja vajalikud tegevused oleksid arusaadavad, ilma kasutajate privaatset sisu või töötajate individuaalset sooritust jälgimata?

---

## 1. Adminiala tegelik kaart

### 1.1 Kuidas admin adminialale üldse jõuab

Eraldi `/admin` avalehte **ei ole** (`app/admin/page.jsx` puudub). Admini „hub" on ruumilava karussellikomplekt [RoomStage.jsx:838](components/room/RoomStage.jsx#L838) — „Haldus" kaardilt avaneb alamkomplekt, milles on **ainult 4 linki**:

1. `/admin/analytics` (Analüütika),
2. `/admin/rag` (RAG teadmusbaas),
3. `/admin/service-availability` (Teenuseinfo kinnitused),
4. `/admin/framework-acceptances` (Raamistiku kinnitused).

**`/admin/wellbeing` ei ole üheski menüüs ega lingis** — kogu `app/`, `components/`, `lib/` peale viitavad sellele ainult tema enda failid. See on kättesaadav ainult URL-i käsitsi trükkides.

Lehekaitse on **lehe- ja route-põhine, mitte tsentraalne**: rakendusel puudub `middleware.js`; iga admin-leht teeb ise `getServerSession` + `isAdmin`-kontrolli ja redirect'i (nt [page.jsx:36](app/admin/analytics/page.jsx#L36)), iga API-route kutsub `assertAdmin(session)` ([authz.js:106](lib/authz.js#L106)). Kontroll on kõikjal sama: `session.user.isAdmin === true` VÕI `role === "ADMIN"` — üks lame binaarne õigus.

### 1.2 Adminialade kaart

| Adminiala | Route | Mida näitab | Mida saab muuta | Õiguse kontroll | Seos teiste adminialadega | Seis |
|---|---|---|---|---|---|---|
| **Analüütika koondleht** | `/admin/analytics` | 10 sektsiooni: KPI-d (30p päringud, RAG, kriis, STT/TTS), platvormi ülevaade (vestlused, abivoog, ruumid, dokumendid), salvestusruum, raamistiku kinnitused, RAG-dokumentide värskus, arveldus + maksetoru, kasutajate tabel (kulud/limiidid), AI-kulud, sündmuste logi | **Palju:** kasutajate kustutamine, mass-e-kiri, logide kustutamine, 6 „prelaunch-reset" toimingut (sh arvelduse tühjendus), paketiversioonid, override'id, kasutaja peatamine, deletion-jobi retry | leht: sessioon+isAdmin; API: `assertAdmin` | Kuvab RAG-värskust (viitab RAG-alale `admin_href`-idega), raamistiku kinnitusi (dubleerib eraldi lehte), embed'ib UsageAdminPanel + DeletionJobsPanel | **EKSITAV** — andmed ja funktsioonid on olemas, aga kujundus on teadlikult strip'itud (vt ptk 2) ning kirjutavad toimingud on analüütika sees |
| **RAG teadmusbaas** | `/admin/rag` (+ `documents`, `ingest`, `kov`, `organizations`, `source-packages`, `source-feedback`) | Allikate/dokumentide seis, ingest, KOV-monitor, kontaktiregister, RT-register, allikapakettide ülevaatus, allikate tagasiside | Ingest, revalidate, light-check, reset-rag-state, failihaldus, pakettide review, tagasiside lahendamine | leht + API: `assertAdmin` | Analytics kuvab sama värskusauditi kokkuvõtet; deletion-jobid (RAG_DELETE/RAG_INGEST) elavad analytics-lehe paneelis | **TÖÖTAB** (oma täisekraani ra-* kujundusega; süvaanalüüs on tehtud eraldi dokumentides, siin ei korrata) |
| **Raamistiku kinnitused** | `/admin/framework-acceptances` | Töökasutuse kinnituste loend (kes, millal, mis versioon, kas raamleping alla laaditud), filtrid q/frameworkKey/days | Ei midagi (read-only) | leht + API: `assertAdmin` | Sama sisu kokkuvõte dubleerub `/admin/analytics` sektsioonis `#analytics-framework-acceptances` | **TÖÖTAB**, aga dubleeriv — kaks kohta sama asja jaoks, kumbki ei viita teisele |
| **Teenuseinfo kinnitused** | `/admin/service-availability` | Teenusekirjete kinnituse seis (kinnitatud/aegumas/aegunud), omanik, põhjus | **„Saada meeldetuletused"** — POST saadab omanikele e-kirjad | leht + API: `assertAdmin` | Iseseisev; seotud teenusekaardi vooga (Teenusekaart-analüüs) | **TÖÖTAB**; irooniline detail: lehe jaluses on `read_only_note`, kuigi lehel on kirjutav massiteavituse nupp |
| **Tööheaolu koond** | `/admin/wellbeing` | K-anonüümne koonddatastik (min grupp 3, `suppressed`-lipp), filtrid (rolligrupp, töövoog, periood), CSV-eksport, piloodiskoopide loend | Piloodiskoopi **loomine** (POST), vaataja **lisamine** piloodile (POST) | leht + API: `assertAdmin`; piloodivaatajad eraldi rajal (vt ptk 4) | Sisuliselt Tööheaolu analüüsi admin-pool; analytics-lehel Tööheaolu EI kajastu (õigesti) | **ERALDI SAAR** — töötab, aga pole kuskilt lingitud |
| **Kasutusplaanid (paketid)** | `/admin/analytics` sees (`#admin-usage-controls`, UsageAdminPanel) | Aktiivsed paketidefinitsioonid + entitlementid + versiooniajalugu (20 viimast auditikirjet) | Uue paketiversiooni loomine (PATCH, kohustuslik `reason`, auditikirje) | API: `assertAdmin` | Kasutab sama `dataAuditLog`-i, mida kuvab ainult see paneel | **TÖÖTAB**, aga peidus analüütikalehe lõpus |
| **Kasutajate haldus** | sama paneel (otsing e-posti/ID järgi) | Kasutaja detail: sessioonid, viimane aktiivsus, peatamise seis, kasutuse snapshot | **Suspend/resume** (põhjusega, auditikirje, sessioonide kustutus); ei tööta admini enda ega teiste adminide peal | API: `assertAdmin` | Sama kasutaja kuvatakse ka analytics-kasutajatabelis (maskitud e-postiga) — kaks eri „kasutajavaadet" | **TÖÖTAB** / **OSALINE** — üks kasutaja korraga, ilma loendita |
| **Entitlement-override'id** | sama paneel | Kasutaja kehtivad ja ajaloolised override'id | Override'i loomine (kohustuslik reason, auditikirje) ja lõpetamine (`window.prompt` põhjus) | API: `assertAdmin` | Mõjutab analytics-kasutajatabeli limiidiveerge | **TÖÖTAB** |
| **Deletion-jobid** | sama leht (`#admin-deletion-jobs`, DeletionJobsPanel) | `DataDeletionJob` read (pending/failed vaikimisi, kuni 200), staatuste loendus | **Retry** (POST, auditijälg `retryDeletionJob` sees) | API: `assertAdmin` | Jobid tekivad kasutajakustutusest (sh analytics-lehe kustutusnupust) ja RAG-kustutustest | **TÖÖTAB**, aga elab analüütika all, kuigi on privaatsus-operatsioonide järjekord |
| **Materjalide ülevaatus** | `/admin/rag` vaadete sees (API: `/api/materials/[id]` PATCH/DELETE) | Kasutajate esitatud materjalid (MaterialSubmission) | Review-staatus + märkus; kustutamine | API: `assertAdmin` | RAG-ala osa; analytics näitab ainult salvestusmahtu (`materialsBytes`) | **OSALINE** — ülevaatuse järjekorda pole üheski koondis näha |
| **Allikate tagasiside** | `/admin/rag/source-feedback` (API: `/api/admin/source-feedback`) | Kasutajate raporteeritud allikaprobleemid (status OPEN/…) | Lahendamine ([id] PATCH) | API: `requireChatUser` + admin-kontroll (**vastab 404, mitte 403**) | RAG-ala osa; analytics ei näita OPEN-tagasiside arvu | **TÖÖTAB** RAG-saarena; koondnähtavus **PUUDUB** |
| **Maksehoiatused** | UI puudub; API `/api/admin/analytics/payment-alerts/dispatch` + cron-skript `scripts/payment-alert-dispatch.mjs` | (arvutab maksetoru läveületused, saadab webhook'i) | Dispatch (POST; dry-run tugi; dedupe 6h; HMAC-allkirjastatud webhook) | `assertAdmin` VÕI `x-dispatch-key` (cron) | Sama `buildPaymentAlerts` loogika, mida analytics kuvab arveldussektsioonis | **OSALINE** — hoiatused on lehel nähtavad, dispatch on nähtamatu taustamehhanism |
| **AI-kulud** | `/admin/analytics` sees (`#analytics-ai-costs`) | ChatLog-põhised kulusündmused: otsene vs hinnanguline, ühikumudel v2, jaotused rolli/paketi/mudeli/route'i kaupa, läviseisud (70/85/100%) | Ei midagi (read-only) | API: `assertAdmin` | Kasutab samu ChatLog-ridu, mida logisektsioon ja reset kustutavad | **TÖÖTAB**, selgelt märgistatud „ligikaudne" |
| **Retrieval-statistika** | **UI PUUDUB**; API `/api/admin/retrieval-stats` | Protsessisisene (in-memory) retrieval-observability | — | API: `assertAdmin` | Mitte ükski komponent ei fetch'i seda | **ERALDI SAAR** — API ilma tarbijata; restart nullib |
| **Piloodi koondid** | `/admin/wellbeing` piloodisektsioon + `lib/wellbeing/pilotReport` | Piloodiskoobid, vaatajad, k-anonüümne raport | Skoobi loomine, vaataja lisamine | admin või piloodivaataja (email-grant) | Tööheaolu-ala osa | **OSALINE** — loomine/vaatamine töötab, aga ala ise on lingtimata saar |

### 1.3 Struktuurne kokkuvõte

Kaardilt paistab kolm süsteemset mustrit:

1. **Kaks küpset „päris rakendust" ja üks kaootiline koondleht.** RAG-alal ja (väiksemas mahus) service-availability'l on oma kujundus, selge ülesanne ja piiritletud toimingud. `/admin/analytics` on seevastu konteiner, kuhu on aja jooksul kuhjatud kõik ülejäänu: analüütika, kasutajahaldus, arveldushaldus, ohtlikud reset-toimingud ja privaatsusoperatsioonid.
2. **Nähtavus ei järgi tähtsust.** Kriitilised operatiivsed järjekorrad (deletion-jobid, materjalide ülevaatus, allikate tagasiside, maksehoiatuste dispatch) on kas lehe lõppu peidetud, teise ala sees või üldse ilma UI-ta; samal ajal on esimesel ekraanil RAG-i keskmiste tehniline statistika.
3. **Menüü ja tegelikkus on lahknenud.** 4 lingiga „Haldus"-menüü ei kata `/admin/wellbeing`-ut ega anna aimu, et analytics-lehe sees on veel kolm eraldi haldusala.

## 2. `/admin/analytics` praegune tegelik funktsionaalsus

### 2.1 Ülesehitus

Leht ([app/admin/analytics/page.jsx](app/admin/analytics/page.jsx)) on server-komponent: sessiooni- ja adminikontroll, seejärel RAG-admini kest-klassid (`ragAdminPageShellClassName`) + kliendikomponent. Klient ([AdminAnalyticsClient.jsx](app/admin/analytics/AdminAnalyticsClient.jsx)) renderdab kolm plokki:

1. `AnalyticsDashboard` (dünaamiline import, `ssr:false`) — 3 981-realine monoliit;
2. `UsageAdminPanel` — paketid, kasutajaotsing, suspend/resume, override'id;
3. `DeletionJobsPanel` — kustutustööde järjekord + retry.

Dashboard laadib mount'imisel **4 sõltumatut GET-i**: `/summary` (30p koondid), `/events` (100 viimast logikirjet), `/users` (200 kasutajat, 30p), `/ai-costs` (30p). Kõik käivituvad uuesti „Värskenda" nupust; eraldi ajavahemiku valikut UI-s ei ole (API toetaks kuni 180 päeva, UI saadab alati 30/hardcoded).

### 2.2 Miks leht näib „ilma kujunduse ja funktsionaalsuseta"

Vastus on koodis otsesõnu kirjas — [AnalyticsDashboard.jsx:14](components/admin/AnalyticsDashboard.jsx#L14):

```js
// Dekoratiivsed className-konstandid on strip'itud (Fable 5 annab kujunduse hiljem).
// Nimed on säilinud, et kõik JSX-viited resolvuksid; väärtused on tühjad.
const pageClassName = "";
… // ~85 tühja konstanti
```

**Kõik** paigutus-, kaardi-, tabeli-, grid- ja alert-klassid on tühjad stringid. See tähendab runtime'is:

- KPI-kaardid, „kaardid", grid'id ja tabelid renderduvad **stiilimata div-de reana** — üks pikk vertikaalne tekstijada;
- eristamatud on ka veateated (alert-klassid tühjad) — punast/kollast tooni pole, ainult tekst;
- `UsageBar` on dekoratiivne tühi `div` + tühi `span` (edenemisriba **ei näita kunagi midagi**; `progressToneClassName()` tagastab alati `""` ja `value`-parameetrit isegi ei kasutata);
- sektsiooninavigatsioon (`#analytics-…` ankrud) on olemas, aga näeb välja nagu tavaline tekstirida.

Seega kasutaja kirjeldus **„lehel pole kujundust"** on täpne ja **teadlik vaheseis** (kujundus eemaldati ja on lubatud hiljem tagasi anda), ning **„pole funktsionaalsust"** on ekslik mulje, mille loob seesama stiilitus: funktsionaalsus on tegelikult ulatuslik, aga ilma visuaalse hierarhiata on 10 sektsiooni, ~40 KPI-kirjet, 3 tabelit ja ~15 nuppu eristamatu tekstimüristik. Diagnoos: **mitte puuduv funktsioon, vaid (a) teadlikult eemaldatud CSS + (b) halb infohierarhia, mis oli probleem juba enne stiilide eemaldamist** (kõik on ühel lehel, tähtsusjärjestuseta).

`UsageAdminPanel` ja `DeletionJobsPanel` kasutavad seevastu oma `usage-admin__*` klasse — need kaks paneeli on osaliselt kujundatud, mis teeb lehe alumise osa ülemisest visuaalselt erinevaks ja võimendab „katkise lehe" muljet.

### 2.3 Mis päriselt renderdub (sektsioonide kaupa)

| # | Sektsioon (ankur) | Sisu | Andmeallikas | Kirjutav? |
|---|---|---|---|---|
| 1 | `#analytics-overview` | Pealkiri, 4 header-pilli (avatud abisoovid, aktiivsed tellimused, „kasutajaid tabelis", logiridade arv), Värskenda-nupp, ankrunav | summary + laaditud lehtede pikkused | ei |
| 2 | KPI-dekk | 7 KPI-d (päringud, RAG-otsingud, RAG-trace'id, kontekstita, kriis, STT, TTS) + „Live snapshot" (6 rida) | summary (ChatLog 30p count'id) | ei |
| 3 | RAG-keskmised | keskmised vasted/grupid/valitud, grounding-jaotus, retriever'id, query-planner | summary (viimased ≤1000 rag_search + ≤1000 rag_trace logi) | ei |
| 4 | `#analytics-platform` | 4 kaarti: vestlus&hääl, abivoog, ruumid&kutsed, dokumendid&agent | summary (Prisma count'id) | ei |
| 5 | `#analytics-storage` | failisalvestuse maht (docs/RAG-admin/materjalid/agent) + ketta vaba ruum | serveri failisüsteem (`statfs`, kataloogide rekursiivne mõõtmine) | ei |
| 6 | `#analytics-framework-acceptances` | 3 KPI-d + 20 viimase kinnituse tabel (e-post, roll, versioon) | summary (FrameworkAcceptance) | ei |
| 7 | `#analytics-rag-docs` | kogused, FAILED, vead 30p, staatuse/audience'i jaotus, **värskusaudit** (aegunud/puuduvad metaandmed, kõrgriski allikad, remediation-lingid RAG-alale), 12 viimast dokumenti | summary (RagDocument ≤1000 + rag-service fallback) | ei (remediation-nupud navigeerivad RAG-alale) |
| 8 | `#analytics-billing` | aktiivsed/uued/katkestatud tellimused, maksete staatusjaotus, laekunud summa, 20 viimast makset, **maksetoru 30p** (init→checkout→callback→webhook), **maksehoiatused** (buildPaymentAlerts) | summary (Subscription/Payment + ChatLog makse-sündmused) | ei |
| 9 | `#analytics-users` | kokkuvõtte-KPI-d (hinnanguline kulu, laekumised, eelarvemaht, limiidilähedased) + kasutajatabel (maskitud e-post, roll, pakett, kasutus, **hinnanguline kulu**, eelarve%, analüüsilimiit) + otsing + **valik-checkboxid** | users API | **JAH:** valitud kasutajate KUSTUTAMINE; mass-e-kiri (valitutele või KÕIGILE) |
| 10 | `#admin-usage-controls` | paketiversioonid + entitlementid; kasutajaotsing → suspend/resume; override'id | usage API-d | **JAH:** paketiversioon, suspend, override |
| 11 | `#admin-deletion-jobs` | kustutustööde tabel (pending/failed), staatuseloendus | deletion-jobs API | **JAH:** retry |
| 12 | `#analytics-ai-costs` | 5 kulukaarti, keskmised, ligikaudne EUR jaotus, atributsiooni täielikkus, lävendikaardid, top-jaotused, admini juhis (8 selgitusrida) | ai-costs API (ChatLog kulusündmused) | ei |
| 13 | `#analytics-logs` | sündmusefilter (26 tüüpi) + kriisifilter + 100 viimast logikirjet (aeg, sündmus, roll, **userId**, meta kokkuvõte) | events API | **JAH:** „Kustuta filtreeritud" / „Kustuta kõik" logid |
| 14 | Reset-sektsioon (logide all) | 6 prelaunch-reset nuppu | reset API | **JAH:** vt 2.5 |

### 2.4 Mis on päris, mis arvutatud, mis placeholder

**Päris andmebaasist (TÕENDATUD):** kõik loendid ja jaotused, mis tulevad otse Prisma `count/groupBy/aggregate`-ist — vestlused, abivoog, ruumid, dokumendid, tellimused, maksed (sh `paidAmount30d` = `Payment.amount` summa `PAID`+`paidAt≥30p`), raamistiku kinnitused, deletion-jobid, paketid, override'id. Salvestusruum tuleb päris failisüsteemist (koos `issues`-massiiviga, kui mõnda teed ei saanud mõõta).

**Arvutuslik/valimipõhine (OSALINE):**
- RAG-keskmised ja grounding/retriever/planner-jaotused arvutatakse **viimase ≤1000 logikirje** pealt (`take: 1000`) — UI ei ütle kuskil, et see on valim, mitte kogu 30p;
- värskusaudit auditeerib **≤1000 RagDocument-i** (uuendamisjärjekorras) + vajadusel rag-service'i fallback;
- allikapakettide „missing sections" loendatakse **≤1000 aktiivse paketi** pealt;
- maksetoru ja hoiatused on tuletatud ChatLog-sündmustest — kui logid on kustutatud (vt 2.5), näitab toru nulli, mitte „andmed puuduvad".

**Hinnanguline, fikseeritud konstantidega (VALE NIMEGA risk):**
- kasutajatabeli „kulud" (`chatEur/ragEur/sttEur/ttsEur`) = päringute arv × käsitsi seatud konstandid (`lib/usageBudget`) — see on eelarvemudel, mitte kulu; UI pealkirjad ütlevad „kulud";
- AI-kulude sektsiooni „Ligikaudne AI kulu" on samuti ühikumudel (v2, nt sisendtoken ≈ 0,00000125 €), **aga** see sektsioon ütleb seda ausalt nii kaartide metas kui admini juhises — hea eeskuju, mida kasutajatabel ei järgi.

**Placeholder/surnud:**
- `UsageBar` — alati tühi (grounding-KPI „riba" ei kanna infot);
- `analyzeDaily`/`analyzeBaseDaily`/`analyzeToday` väljad users-vastuses dubleerivad lihtsalt bucket'i väärtusi eri nimede all (pärand);
- headerStats „Logs: N" = laaditud lehe pikkus (max 100), mitte logide koguarv — pseudomõõdik.

### 2.5 Kirjutavad toimingud analüütikalehel (kriitiline leid)

„Analüütika" lehel on **kuus klassi päris andmeid muutvaid toiminguid**, millest mitu on pöördumatud:

| Toiming | API | Värav praegu | Auditijälg |
|---|---|---|---|
| Valitud kasutajate kustutamine | `DELETE /api/admin/analytics/users` | 1× `window.confirm` (arvuga); admin/enda kaitse serveris | JAH — `deleteUserWithPrivacyCleanup` (reason `admin_analytics_users_delete`, IP, UA) |
| Mass-e-kiri (valitud VÕI **kõik** kasutajad, kuni 500) | `POST /api/admin/analytics/users` | **confirm puudub üldse** — ainult subject/text valideerimine | **PUUDUB** — ei auditikirjet ega ChatLog-sündmust |
| Logide kustutamine (filtreeritud/kõik) | `DELETE /api/admin/analytics/events` | 1× `window.confirm` | **PUUDUB** — ja kustutab ise auditisisendi (ChatLog), millel põhinevad AI-kulud, maksetoru ja kriisiloendus |
| Prelaunch-reset ×6: `clear_logs`, `clear_conversations`, `clear_rooms`, `clear_auth_tokens`, `clear_usage_metrics`, `clear_billing` | `POST /api/admin/analytics/reset` | 2× `window.confirm` (teine dry-run arvuga) — **põhjust ei küsita** | **PUUDUB** — `dataAuditLog`-i ei kirjutata; `clear_billing` kustutab kõik Payment+Subscription read jäädavalt |
| Paketiversioon / override / suspend | `/api/admin/usage/*` | vorm + kohustuslik `reason` | JAH — `dataAuditLog` |
| Deletion-jobi retry | `POST /api/admin/usage/deletion-jobs` | nupp | JAH — retry-teekonnas |

Kontrast on ilmne: **usage-paneeli toimingud järgivad head mustrit (põhjus + audit), analytics-dashboardi omad mitte.** Kõige teravam on `clear_billing` — raamatupidamisandmete jäädav kustutus kahe brauseri-confirm'iga, ilma põhjuse, auditikirje ja „kirjuta CONFIRM"-tüüpi tõkketa — ning mass-e-kiri, mis on väline pöördumatu tegevus ilma ühegi kinnituseta.

### 2.6 Vea- ja tühiseisud

- Üks jagatud `pageError`-string kogu lehe peale — kui nt users-fetch kukub, kaob ka eelmise õnnestunud fetch'i veakontekst; sektsioonid ise jäävad „Loading…" või „-" seisu.
- Tühjad tabelid näitavad „No records found" — korrektne.
- `|| 0`-muster läbivalt: **iga puuduv väärtus renderdub nullina** (vt ptk 3.3) — API osaline rike on eristamatu tühjast platvormist.
- `share_missing` („Share unavailable") on olemas ainult protsendijaotustel — hea erand.
- Storage-sektsioon näitab `issues` korral hoiatust „Mõnda salvestusteed ei saanud mõõta" — parim tühiseisu käsitlus lehel.
- ai-costs kaetuse märkus (`coverage.note_excluded/included`) selgitab, kas RAG-kulu on kaasatud — hea muster.

### 2.7 Runtime-kontroll (read-only, 2026-07-15)

Kontroll tehti töötava lokaalse dev-serveri (127.0.0.1:3000) vastu autenditud admini sessiooniga (ühekordne temp-login token, sama muster mis varasemates RAG-admini verifitseerimistes). **Ainsad kirjutused: 1 auth-tokeni rida + sisselogimise sessioon; ühtegi kirjutavat admin-nuppu ei vajutatud.** Ekraanipilt polnud võimalik (teadaolev viga: brauseripaani screenshot hangub Galaxy-taustaga lehtedel), seega tõendus on DOM-i ja API-vastuste kaudu.

**Kinnitatud runtime-faktid:**

1. **Leht renderdub ruumipaneeli sees** (dialoog „Avatud paneel" + „Sulge ja naase ruumi") — admin ei saa täisekraani; kogu 11-sektsooniline sisu keritakse paneeliaknas.
2. **Kõik 11 sektsiooniankrut on DOM-is olemas** ja kõik 4 API-t vastavad andmetega — funktsionaalsus on päriselt olemas.
3. **Stiilitus on totaalne:** `h1` klass tühi; KPI-„kaardi" arvutatud stiil = läbipaistev taust, 0 äärist, 0 padding'ut; „Kustuta valitud" nupp ilma klassita brauserinupp.
4. **Topeltrender:** kuna responsive-klassid on tühjad, renderduvad **desktop-tabel JA mobiilikaardid korraga** — nt maksete „FAILED" silt esineb lehel 32× (16 makset × 2 vaadet), kõik nähtavad. Sisu näib „müristikuna" ka seetõttu, et kõike on kaks korda.
5. **Ohtlike nuppude rida ilma visuaalse eristuseta:** ühes brauserinuppude jadas on „Värskenda", „Saada e-kiri", „Kustuta valitud", „Kustuta kõik logid" ja 6 lähtestusnuppu („Kustuta analüütika logid", „Kustuta vestlused", „Kustuta ruumide andmed", „Kustuta autentimise tokenid", „Kustuta kasutusmõõdikud", **„Kustuta makseandmed"**) sektsioonis „Käivituseelne lähtestus".
6. **Numbrid on päris ja paljastavad mõõdikuvea:** `totalRequests=26`, `ragSearchCount=18` (kuvatud „Osakaal 69%"), `noContextCount=18` (samuti „Osakaal 69%") — kaks „osakaalu" summeeruvad 138%-ni, sest sündmused pole teineteist välistavad; UI esitab neid kui terviku jaotust.
7. **Vaikne veaseis kinnitatud:** kohalik `RagDocument`-tabel on tühi (`total=0`), rag-service'i fallback kukkus veaga `documents.artifacts.errors.analysis_failed` (i18n-võti toorelt API-väljas `ragServiceFallbackError`) — UI ei näita sellest **mitte midagi**; värskusaudit lihtsalt „0 auditeeritud, probleeme pole" — tühi ja katkine on eristamatud. Samal ajal `retrieverDistribution: {dense: 18}` tõendab, et RAG-otsing ise käib (rag-service'i kaudu) — kaks „tõeallikat" on lahknenud.
8. **Ajaakende segadus kinnitatud:** „Viimased maksed" tabel (all-time, 20 viimast) näitab 16 FAILED makset veebruarist-märtsist, otse selle kohal „Viimase 30 päeva jooksul pole maksehoiatusi" — mõlemad on korrektsed omas aknas, aga kõrvuti loevad need vastukäivalt.
9. **E-posti maskimine töötab** kasutajatabelis (`c********t@l***l.invalid`), kuid täispikk `userId` kuvatakse kõrval; raamistiku kinnituste sektsioon kuvaks e-posti maskimata (praegu tühi).
10. `/admin/wellbeing` (saar) töötab: aggregate vastab `suppressed=true, sampleSize=0, minimumGroupSize=3` — **k-anonüümsuse summutus toimib runtime'is**; UI ütleb miinimumgrupi seisu ausalt.

## 3. Andmete päritolu ja usaldusväärsus

### 3.1 Andmeliinid põhimõõdikute kaupa

Vorming: `mudel/logi → serveriarvutus → API-väli → UI-koht`. Hinnang: **TÕENDATUD** (liin on terve ja nimi vastab sisule), **OSALINE** (töötab piirangutega, mida UI ei avalda), **VALE NIMEGA** (väärtus on olemas, aga silt lubab muud), **PUUDUV** (mõõtmist ei toimu), **EI TOHI KOONDISSE TUUA** (isikutase/privaatne sisu).

| Mõõdik | Andmeliin | Hinnang |
|---|---|---|
| Kasutajate arv rollide kaupa | `User` → *(mitte kuskil koondina)* → users-API annab `totalUsers` (ilma rollijaotuseta) → UI kuvab ainult „Users in table" = laaditud lehe pikkus (≤200) | **PUUDUV** — platvormi kõige elementaarsem mõõdik (mitu kasutajat, mitu töötajat/klienti/admini) ei jõua ühelegi kaardile; `totalUsers` arvutatakse, aga ei kuvata |
| Aktiivsus (aktiivsed kasutajad) | ainult kaudselt: `Conversation.lastActivityAt` (aktiivsed vestlused) ja ai-costs `unique_users` (AI-aktiivsusega kasutajad 30p) | **OSALINE** — „aktiivsete kasutajate" mõõdikut kui sellist pole; kaks lähedast asendajat eri sektsioonides, kumbki eri definitsiooniga |
| Vestlused | `Conversation.count()` + `lastActivityAt≥30p, archivedAt:null` → summary.chat → Platvormi kaart | **TÕENDATUD** |
| Chat-päringud/kriis/STT/TTS | `ChatLog(event=…)` 30p count → summary → KPI-dekk | **TÕENDATUD** loendina; NB! allikas on kustutatav logi (vt 3.2) |
| Teekonnad (Journey) | `Journey` mudel on olemas → **ühtegi count'i üheski admin-API-s pole** | **PUUDUV** — Teekondade kasutust (loodud/aktiivsed/jagatud) ei mõõdeta üldse |
| Pöördumised (PreInquiry) | `PreInquiry` mudel olemas → admin-koondit pole | **PUUDUV** |
| Ruumid | `Room.count()`, `RoomMessage` 30p (deletedAt:null), distinct roomId, `Invite(PENDING_PAYMENT)`, sponsored-liikmed → summary.collaboration → kaart | **TÕENDATUD** |
| Dokumendid | `UserDocument`, `AgentArtifact` (DRAFT/FINAL/loodud/kinnitatud), `DocumentAudit.groupBy(action)` → summary.documents → kaart | **TÕENDATUD** |
| Salvestusruum | failisüsteem: kataloogide rekursiivne suurus + `statfs` → summary.documents.storage (+`issues`) → storage-sektsioon | **TÕENDATUD**, ausa veapoolega |
| Abisoovid/-pakkumised | `HelpRequest/HelpOffer(status OPEN,MATCHED)` + 30p + `HelpMatch.groupBy(status)` → summary.help → kaart | **TÕENDATUD** |
| Kovisioon | `CovisionCase` jt mudelid olemas → admin-koondit pole | **PUUDUV** koondina. NB: kui kunagi lisatakse, siis ainult juhtumite arv/staatusjaotus — juhtumi sisu on **EI TOHI KOONDISSE TUUA** |
| Tööheaolu | `WellbeingRecord` → `buildWellbeingExportDataset` (min grupp 3, `suppressed`, `suppressionReason`) → `/api/admin/wellbeing/aggregate` → eraldi leht | **TÕENDATUD** ja õigesti kaitstud (k-anonüümsus); analytics-lehele toomata — nii peabki, isikutase on **EI TOHI KOONDISSE TUUA** |
| RAG-päringud (arv) | `ChatLog(rag_search/rag_trace)` count → summary → KPI | **TÕENDATUD** |
| RAG-keskmised (vasted, grounding, retriever'id) | viimased ≤1000 `rag_search` + ≤1000 `rag_trace` logi (`take:1000`) → aritmeetiline keskmine → summary.averages → KPI-d | **OSALINE** — vaikiv valimipiir; suure mahu juures kajastab ainult hiljutist osa 30 päevast; UI esitab kui perioodi keskmist |
| RAG-dokumentide värskus | `RagDocument` ≤1000 (+ rag-service fallback) → `summarizeFreshnessAudit` → summary.ragDocs.freshness → sektsioon + remediation-lingid | **OSALINE** — sisuliselt tugev, aga ≤1000 piir on vaikiv; `auditSource`-väli (prisma vs rag-service) on API-s olemas, UI-s kuvamata |
| AI tokenid ja kulu | `ChatLog(openai_usage, rag_cost_usage, tts/stt_cost_usage)` → ühikumudel v2 (fikseeritud €-ekvivalendid) → ai-costs API → AI-kulude sektsioon | **OSALINE**, ausalt märgistatud („ligikaudne", „mitte arveldus", kaetuse märkus, atributsiooni-%) — parim andmeausus lehel |
| Kasutajapõhine „kulu" | `ChatLog` count'id × `lib/usageBudget` konstandid → users-API `costs.totalEur` → kasutajatabel „Kulud" | **VALE NIMEGA** — see on eelarveühik, mitte kulu; sama rea kõrval kuvatav „Ligikaudne AI kulu" (ai-costs) annab sama asja kohta eri numbri, sest mudel on teine. Kaks „kulu" eri definitsiooniga samal lehel, kumbki viitamata teisele |
| Tellimused | `Subscription(status ACTIVE, validUntil>now)` + 30p uued/katkestatud → summary.billing → arveldus | **TÕENDATUD** |
| Maksed | `Payment.groupBy(status)` 30p + `SUM(amount, PAID, paidAt≥30p)` + 20 viimast → arveldus | **TÕENDATUD** |
| Maksetoru (init→checkout→callback→webhook) | `ChatLog(subscription_*)` count'id → `buildPaymentPipelineFromCounts` → arveldus + hoiatused | **OSALINE** — tuletatud kustutatavast logist; pärast `clear_logs`-i näitab toru „0", mis loeb kui „makseid pole algatatud", kuigi tegelikult „mõõtmisandmed kustutatud" |
| Maksehoiatused | sama toru → `buildPaymentAlerts` (läved: checkout-määr, PAID-konversioon, webhook-vead) → arveldussektsiooni alert'id + dispatch-API | **TÕENDATUD** arvutusena, **OSALINE** kanalina (UI-s pole dispatch'i seisu — kas cron töötab, millal viimati saadeti) |
| Deletion-jobid | `DataDeletionJob` (pending/failed, ≤200) + `groupBy(status)` → deletion-jobs API → paneel | **TÕENDATUD** |
| Vead / ebaõnnestunud taustatööd | kild-kild: `rag_error/openai_error` count (KPI), `RagDocument FAILED`, deletion-jobs failed, webhook-vead maksetorus | **OSALINE** — neli eri kohta, ühtset „taustatööde tervis" vaadet pole; nt materjalide ülevaatusjärjekord ja source-feedback OPEN-arv ei jõua kuhugi |
| Retrieval-statistika | protsessi mälu (`getRetrievalStats`) → `/api/admin/retrieval-stats` → **UI puudub** | **PUUDUV** kasutajale; restart nullib; kahe protsessi juures näitaks eri numbreid |
| Otsingupäringute sisu | `ChatLog.data` (rag_search meta) → events-API → logisektsioon | **EI TOHI KOONDISSE TUUA** sisuna — praegu võib logikirje meta sisaldada päringu/vea detaile; koondvaates tohib olla ainult arv ja tehniline meta (vt ptk 5) |
| Riskisignaalid (kriis) | `crisis_detected` count → KPI; **aga** logifiltris saab kriisikirjeid listida koos `userId`-ga | loendina **TÕENDATUD**; kirjete kuvana **EI TOHI KOONDISSE TUUA** — kriisisignaal + isikutunnus analüütikaekraanil on privaatsusrisk (vt ptk 5) |
| Kasutaja e-post | `User.email` → maskEmail (vaikimisi maskitud; `ADMIN_ANALYTICS_SHOW_FULL_EMAILS` env avab) → kasutajatabel; **AGA** framework-acceptances sektsioon/leht kuvab e-posti **maskimata**; usage-paneeli kasutajaotsing samuti | **OSALINE/EBAJÄRJEKINDEL** — kolm eri poliitikat samal lehel |

### 3.2 Alusprobleem: analüütika elab operatiivlogis, mida admin ise kustutab

Peaaegu kogu käitumis- ja kuluanalüütika (KPI-d, maksetoru, AI-kulud, kasutajakulud) põhineb **ühel tabelil `ChatLog`**, millel puudub igasugune säilituspoliitika ja mida saab samalt lehelt kustutada (`clear_logs`, logide kustutusnupud). Tagajärjed:

1. mõõdikud pole reprodutseeritavad — eilne aruanne võib täna näidata teisi numbreid, sest keegi „koristas logisid";
2. `0` muutub mitmetähenduslikuks: *päriselt null*, *logid kustutatud*, *sündmust ei logitud* (nt vanem kood ei kirjutanud `rag_cost_usage`-t ChatLogi — ai-costs ütleb seda kaetuse märkuses ausalt) ja *mõõtmine ebaõnnestus* on kõik sama pilt;
3. arveldusmõõdikud (maksetoru) ja raamatupidamislik reaalsus (`Payment`-tabel) võivad lahku minna, sest üks pool on kustutatav.

### 3.3 `0` vs „andmed puuduvad" vs „mõõtmist pole" vs „mõõtmine ebaõnnestus"

Praegune UI kasutab läbivalt mustrit `formatCount(summary?.x || 0)` — **kõik neli seisundit renderduvad identselt „0"-na**. API-d tegelikult eristavad rohkem, kui UI näitab:

- summary tagastab `ragServiceFallbackError`, `storage.issues`, `sourcePackages.unavailable` — UI kuvab neist ainult storage'i oma;
- ai-costs tagastab `coverage`/`attribution_completeness` — UI kuvab (hea);
- users tagastab `costModel`-i (mudeli avalikustamine — hea);
- events/summary ei erista „logid kustutatud" seisu üldse (pole ka võimalik ilma retention-metaandmeteta).

Järeldus ptk 10 jaoks: iga mõõdiku lepingusse kuulub kohustuslik `basis`-väli (loendatud allikas + aken + valimipiir) ja UI-tasand, mis renderdab `null`→„—", mitte „0".

## 4. Õigused ja admini tüübid

### 4.1 Praegune seis: üks lame ülemõigus

Kogu adminiala kasutab ühte kontrolli: `assertAdmin` → `isAdmin(session.user)` → `user.isAdmin === true || role === "ADMIN"`. See tähendab, et **iga admin näeb ja saab teha kõike**: kustutada suvalise kasutaja, tühjendada makseandmed, saata e-kirja kõigile, hallata RAG-i, näha logisid koos userId-dega, luua piloote ja lugeda Tööheaolu koondit. Peenemaid admin-rolle skeemis pole (`Role` enum: CLIENT, SOCIAL_WORKER, ADMIN, …), õiguste tabelit pole.

**Olemasolevad piiratud grant-mustrid** (tõestus, et kitsam mudel on juba kodus):

1. **Tööheaolu piloodivaataja** — parim näide: `WellbeingPilotScope` (skoop: KOV/organisatsioon, rolligrupid, ajaaken, min grupp) + `WellbeingPilotViewer` (e-postipõhine grant) + env-fallback (`WELLBEING_PILOT_VIEWER_EMAILS/ROLE_GROUPS`). Mitte-admin näeb **ainult** oma skoobi k-anonüümset koondit ([pilotAccess.js:84](lib/wellbeing/pilotAccess.js#L84)); rolligrupp valideeritakse, `minimumGroupSize` tuleb skoobist kaasa.
2. **Masin-grant:** maksehoiatuste dispatch lubab `assertAdmin` VÕI `x-dispatch-key` (cron), timing-safe võrdlusega.
3. **Nähtavus-grant env-lülitina:** `ADMIN_ANALYTICS_SHOW_FULL_EMAILS` (vaikimisi maskitud). Muster on õige, aga globaalne env on vale granulaarsus — see peaks olema roll, mitte serveri seadistus.
4. **Struktuurne eeldus tulevaseks org-halduriks:** `MunicipalityKovAdmin`, `OrganizationAdmin` mudelid seovad sisu KOV-i/organisatsiooniga — skoobipiir on andmetes olemas, õigustes mitte.

### 4.2 Viis admini tüüpi, mida toode tegelikult vajab

| # | Tüüp | Põhitöö | Mida EI tohi näha |
|---|---|---|---|
| 1 | **Platvormi globaalne administraator** | tervis, riskid, õiguste andmine, eskalatsioonid | privaatsisu (vestlused, Teekonnad, Tööheaolu kirjed) — ka temal pole selleks tööpõhjust |
| 2 | **Organisatsiooni/KOV-i haldur** (tulevik) | oma org-i allikad, teenuseinfo, liikmete ligipääsuseis | teiste org-ide andmed; oma liikmete sisu (vestlused, dokumendid, Teekond, Supervisioon, privaatne Tööheaolu) — kuulumine organisatsiooni EI ole sisuligipääsu alus |
| 3 | **Piloodikoondi vaataja** (olemas) | oma piloodi k-anonüümne koond | isikutaseme read; teiste pilootide/rolligruppide andmed |
| 4 | **RAG-/materjalihaldur** | allikad, ingest, värskus, materjalide ülevaatus, allikatagasiside | kasutajaandmed (tabel, e-postid, kasutus, kulud), arveldus, logide isikuväljad |
| 5 | **Arveldus-/kasutusõiguste haldur** | paketid, override'id, maksed, tellimusprobleemid, suspend | vestlused, Tööheaolu, Kovisioon, RAG-i sisuhaldus; logidest ainult makse-sündmused |

### 4.3 V1 õiguste mudel (leping)

Ettepanek — **mitte ehitada üldist RBAC-raamistikku**, vaid lisada olemasolevale kolm asja:

1. **`AdminGrant`-tabel** (userId, `capability`, `scopeType/scopeId?`, `grantedBy`, `reason`, `validUntil?`, auditikirje loomisel/lõpetamisel). Capability'd V1-s: `platform_admin`, `knowledge_steward`, `billing_steward`, `pilot_viewer` (migreerub WellbeingPilotViewer pealt), hiljem `org_steward:<orgId>`.
2. **`assertAdmin` → `assertCapability(session, capability)`** — sama kujuga abifunktsioon; `platform_admin` implitseerib kõik. Route'ide kaupa: analytics-read = iga capability oma sektsioonile; usage/plans+overrides+users = `billing_steward`; rag/* + materials + source-feedback = `knowledge_steward`; wellbeing aggregate = `platform_admin` või `pilot_viewer` (juba olemas); reset/mass-email = **ainult** `platform_admin` + lisaväravad (ptk 6).
3. **Kõvad keelud lepingusse** (testidena kinnitatav):
   - `pilot_viewer` ei ava kunagi isikutaseme ridu — ainult `suppressed`-mehhanismiga koond;
   - `knowledge_steward` API-d ei tagasta kunagi `User`-välju peale enda;
   - `billing_steward` ei näe ChatLog-i sisumeta-t (ainult makse-sündmuste klass) ega ühtegi sisumudelt;
   - org-kuuluvus (Room/organisatsioon) ei anna ühtegi admin-õigust automaatselt;
   - iga grant nõuab `reason`-it ja tekitab `dataAuditLog` kirje; grant on tähtajaline vaikimisi.

Globaalse admini arv hoitakse väike (≤2) ja `isAdmin`-lipp jääb ainult neile; kõik ülejäänud haldustöö käib capability-grantidega. See on evolutsioon, mitte revolutsioon: sama sessioonimudel, sama `dataAuditLog`, sama muster mis piloodivaatajal juba on.

## 5. Privaatsus ja keelatud analüütika

### 5.1 Siduv andmeklasside tabel

| Andmeklass | Lubatud koond | Minimaalne lävi | Lubatud drill-down | Keelatud kuva |
|---|---|---|---|---|
| Vestluste sisu (Conversation/Message) | arv, aktiivsus, veamäär | — (arvud) | **puudub** analüütikas; sisu ainult kasutaja enda jagamisel tugijuhtumis | sisu, pealkirjad, fragmentid, „kelle vestlus" nimekiri |
| Teekonna sisu (Journey) | loodud/aktiivsed/jagatud arv | 5 rolligrupi kaupa | puudub | sisu, sihtmärgid, üksikkasutaja teekonnaseis |
| Eelpöördumiste sisu (PreInquiry) | arv staatuse/kanali kaupa | 5 | operatiivjärjekord (kohaletoimetamise vead) **ilma sisuta** | pöördumise tekst, adressaadi-poolne seis isikuti |
| Adressaadi privaatmärkmed | **mitte mingit koondi** | — | puudub | igasugune kuva, ka arvuna kasutaja kohta |
| Dokumendid (UserDocument/artefaktid) | arvud, maht, toimingute jaotus (DocumentAudit action) | — (arvud) | üksikdokument ainult deletion-/tugijuhtumi ID kaudu, sisu mitte | pealkirjade/sisu listing, kasutaja dokumentide loend |
| Tööheaolu | ainult k-anonüümne koond (olemas: min grupp, `suppressed`) | **3 (skoobist), kunagi alla selle)** | puudub — ka platform_admin ei ava kirjeid | üksikkirje, üksiku töötaja trend, „riskis töötajad" nimekiri |
| Kovisioon | juhtumite arv staatuse kaupa; praktikakandidaatide arv | 5 | puudub analüütikas (juhtumisisu elab oma töövoos) | juhtumi sisu, osalejate nimed, üksiku juhtumi „kvaliteet" |
| Supervisioon (tulevik) | seansside arv, ootel taotlused | 5 | puudub | sisu, osalejad, mentori „edetabel" |
| Otsingupäringud (RAG) | arv, grounding-jaotus, retriever-jaotus, veamäär | — (arvud) | tehniline trace **ilma päringutekstita ja userId-ta** | päringutekstide loend, kasutaja×päring seosed |
| Riskisignaalid (crisis_detected) | ainult arv ja trend | 5 (perioodi kohta; alla selle „<5") | **eraldi õigusega** tugiprotsess, mitte analüütikaekraan | kriisikirjete list userId-ga (praegu logisektsioonis võimalik!), kasutajapõhine kriisiloendur |
| Kasutaja e-post/kontoandmed | arvud rollide kaupa | — | üksikkasutaja kaart **konkreetse tugijuhtumi raames** (otsing, mitte lehitsetav loend); e-post maskitud vaikimisi kõikjal | kogu kasutajabaasi e-postide tabel; maskimata e-post koondvaates |
| AI-kulu | summad, jaotused rolli/paketi/mudeli kaupa; läviületajate **arv** | isikuti: ainult läviületus (≥85%), mitte pingerida | läviületanud kasutaja kaart (limiit + kasutus, ilma sisuta), põhjusega | „top kulukad kasutajad" edetabel e-postidega; kulu sidumine sisuga |
| Maksed | summad, staatusjaotus, toru, hoiatused | — | konkreetse makse/tellimuse kaart tugijuhtumi raames | maksete sidumine kasutuse/sisuga ühes vaates |
| Auditikirjed (DataAuditLog) | toimingute arv tüübi kaupa | — | täiskirje (kes-mida-millal) `platform_admin`-ile; **kustutamatu** | auditi kustutus- või muutmisvõimalus UI-s |

### 5.2 Kohustuslikud põhimõtted (V1 leping)

1. **Vaikimisi ainult metaandmed ja koondid** — ükski analüütika-API ei tagasta sisuteksti (praegu rikub: events-API `data` sisaldab vabateksti `error_message`-t jm).
2. **Väikese grupi summutamine** — Tööheaolu muster (`suppressed`, `suppressionReason`) laieneb igale rolligrupi-/org-lõikelisele mõõdikule: alla läve näita „< N", mitte arvu.
3. **Puuduv väärtus ei ole null** — API leping: `null` + `basis`-väli; UI renderdab „—" + seletuse (praegu rikub: `|| 0` kõikjal).
4. **Individuaalse töötaja „tootlikkust", pingerida ega riskiskoori ei ehitata kunagi** — ei „aktiivseim sotsiaaltöötaja", ei „kõige rohkem kriisivestlusi", ei Tööheaolu isikutrende. See on ka sõnum töötajaile: platvorm ei ole jälgimisvahend.
5. **Privaatset sisu ei kuvata analüütikakaardil** — mitte kunagi, ka „näidise" või „viimase sündmuse" vormis.
6. **Drill-down ainult operatiivse ülesande + eraldi õigusega** — koondnumbrilt ei saa klikkida isikuni; isikuni jõuab ainult tugijuhtumi rajalt (otsing konkreetse tunnuse järgi) ja see jätab auditijälje.
7. **Kõik kirjutavad admin-toimingud: põhjus + auditijälg + astmeline värav** — usage-paneeli muster (reason kohustuslik, `dataAuditLog`) muutub üldreegliks; pöördumatud toimingud saavad lisaks „trüki kinnitussõna" värava ja kahe-admini reegli seal, kus võimalik.

## 6. Probleemid ja leiud

Raskusastmed: **P0** = kohe ohtlik (pöördumatu kahju või privaatsusrike ühe-kahe klikiga), **P1** = tõsine risk/eksitus, mis vajab lähiajal parandust, **P2** = oluline kvaliteedivõlg, **P3** = kosmeetiline/koristus.

| # | Leid | Tõend | Raskus |
|---|---|---|---|
| L1 | **„Kustuta makseandmed" (`clear_billing`) kustutab kõik Payment+Subscription read jäädavalt; värav = 2× `window.confirm`; põhjust ei küsita, `dataAuditLog` kirjet EI teki.** Sama kehtib 5 ülejäänud reset-toimingu kohta (sh `clear_auth_tokens`, mis logib kõik välja). Runtime: nupud on stiilitud eristamatult „Värskenda" kõrval. | [reset/route.js:99](app/api/admin/analytics/reset/route.js#L99) (RESET_ACTIONS, transaktsioon, auditi puudumine); UI [AnalyticsDashboard.jsx:1731](components/admin/AnalyticsDashboard.jsx#L1731); runtime ptk 2.7 p5 | **P0** |
| L2 | **Mass-e-kiri „Kõik kasutajad" (kuni 500 adressaati) saadetakse ilma ühegi kinnitusdialoogi ja auditijäljeta.** Väline pöördumatu tegevus; ka ebaõnnestumised tagastatakse ainult vastuses. | [users/route.js:706](app/api/admin/analytics/users/route.js#L706) (POST, ei auditit); UI `handleSendBulkEmail` [AnalyticsDashboard.jsx:1622](components/admin/AnalyticsDashboard.jsx#L1622) — confirm puudub | **P0** |
| L3 | **Logide kustutus (filtreeritud/kõik) hävitab AI-kulude, maksetoru ja kriisistatistika alusandmed; audit puudub; nupud elavad samas vaates, kus analüütika ise.** `ChatLog` on ainus allikas ai-costs'ile ja maksetorule → kustutuse järel näitavad need „0", mitte „andmed kustutatud". | [events/route.js:110](app/api/admin/analytics/events/route.js#L110) (DELETE, ei auditit); ptk 3.2 | **P1** (P0-lähedane, kuna moonutab arveldusjärelevalvet) |
| L4 | **Kriisisündmuste drill-down isikutunnuseni analüütikaekraanil:** logifilter `crisis_detected` + kirje `userId` ja meta. Riskisignaal + isik ühes tabelis = keelatud kuva (ptk 5.1). | events-API tagastab `userId, data`; UI kriisifilter [AnalyticsDashboard.jsx:494](components/admin/AnalyticsDashboard.jsx#L494) | **P1** |
| L5 | **Vaikne veaseis: RAG-värskusauditi allikas kukkus, UI näitab „probleeme pole".** Runtime: Prisma peegel tühi, rag-service fallback viskas `documents.artifacts.errors.analysis_failed` (i18n-võti toorena), sektsioon renderdab „0 issues" ja rohelise seisu; samal ajal RAG-otsing ise töötab (dense: 18). Tühi ≠ terve. | ptk 2.7 p7; [summary/route.js:844](app/api/admin/analytics/summary/route.js#L844) (fallback-viga läheb ainult `ragServiceFallbackError` väljale, mida UI ei kuva) | **P1** |
| L6 | **Kujundus strip'itud + topeltrender teeb lehe kasutuskõlbmatuks ja ohtlikuks:** kõik className'id tühjad (teadlik vaheseis), desktop+mobiil renderduvad korraga (FAILED ×32), ohtlikud nupud eristamatud. See ON kasutaja raporteeritud „pole kujundust ega funktsionaalsust" juurpõhjus. | [AnalyticsDashboard.jsx:14](components/admin/AnalyticsDashboard.jsx#L14); runtime ptk 2.7 p3–p5 | **P1** |
| L7 | **Eksitav „Osakaal"-mõõdik:** rag_search 69% + no_context 69% = 138%; sündmused pole välistavad, aga UI esitab terviku jaotusena. | runtime ptk 2.7 p6; [AnalyticsDashboard.jsx:980](components/admin/AnalyticsDashboard.jsx#L980) (`requestSplit` jagab kõik `totalRequests`-iga) | **P1** |
| L8 | **`/admin/wellbeing` on lingtimata saar** — funktsionaalne (k-anon summutus töötab), aga üheski menüüs pole; „Haldus"-karussellis 4 linki 5 alast. | grep: ainsad viited on lehe enda failid; [RoomStage.jsx:838](components/room/RoomStage.jsx#L838) | **P1** (halduritee puudub) |
| L9 | **E-posti kuvamise poliitika on kolmes kohas erinev:** analytics-kasutajatabel maskib (env-lüliti), framework-acceptances sektsioon+leht kuvavad maskimata, usage-paneeli otsing kuvab maskimata. | [users/route.js:34](app/api/admin/analytics/users/route.js#L34) vs [summary/route.js:713](app/api/admin/analytics/summary/route.js#L713) (`user.email` otse) | **P1** |
| L10 | **Kaks eri „kulu" definitsiooni samal lehel viitamata:** kasutajatabeli `costs` (fikseeritud konstandid × loendid) vs ai-costs „ligikaudne EUR" (ühikumudel v2). Nimed ei erista; otsustaja võib valel numbril põhineda. | ptk 3.1 read „AI tokenid" ja „Kasutajapõhine kulu" | **P1** |
| L11 | **Platvormi elementaarne mõõdik puudub:** kasutajate koguarv ja rollijaotus ei jõua ühelegi kaardile (`totalUsers` arvutatakse, ei kuvata). | ptk 3.1 rida 1; grep `totalUsers` UI-s puudub | **P2** |
| L12 | **Vaikivad valimipiirid:** RAG-keskmised/grounding ≤1000 logi, värskusaudit ≤1000 dokumenti, allikapaketid ≤1000 — UI ei märgi kuskil. | [summary/route.js:724](app/api/admin/analytics/summary/route.js#L724), :734, :402 | **P2** |
| L13 | **Retrieval-stats API on orb:** in-memory, UI-tarbijata, restart nullib. | grep: ainus viide route ise | **P2** |
| L14 | **Ajaakende kollisioon arveldussektsioonis:** „viimased maksed" (all-time 20) FAILED-ridadega otse „hoiatusi pole" (30p) kõrval. | runtime ptk 2.7 p8 | **P2** |
| L15 | **Deletion-jobid, materjalide ülevaatus ja allikatagasiside pole üheski koondis:** admin ei näe kuskilt „mitu tööd on kinni / mitu asja ootab ülevaatust" ilma kolme eri kohta avamata. | ptk 1.2 read | **P2** |
| L16 | **Teekonnad, pöördumised, Kovisioon mõõtmata** — kasvavad tootealad ilma ühegi operatiivmõõdikuta (kas või „aktiivseid juhtumeid N"). | ptk 3.1 | **P2** |
| L17 | Header-pseudomõõdikud: „Logid: 100" = laaditud lehe pikkus; „Kasutajaid tabelis" = lehe suurus. | [AnalyticsDashboard.jsx:1206](components/admin/AnalyticsDashboard.jsx#L1206) | **P3** |
| L18 | `UsageBar` on surnud placeholder (alati tühi, väärtust ei kasutata). | [AnalyticsDashboard.jsx:340](components/admin/AnalyticsDashboard.jsx#L340) | **P3** |
| L19 | Framework-acceptances dubleerub (analytics-sektsioon + eraldi leht), kumbki ei viita teisele. | ptk 1.2 | **P3** |
| L20 | Service-availability jaluses „read-only" märge, kuigi lehel on kirjutav massiteavituse nupp; source-feedback admin-kontroll vastab 404 (mujal 403). | [AdminServiceAvailabilityClient.jsx:118](app/admin/service-availability/AdminServiceAvailabilityClient.jsx#L118); [source-feedback/route.js:11](app/api/admin/source-feedback/route.js#L11) | **P3** |
| L21 | Pärandväljad users-vastuses (`analyzeDaily`=`analyzeBaseDaily`=hardLimit jne) — API-müra, mis julgustab valesid tõlgendusi. | [users/route.js:546](app/api/admin/analytics/users/route.js#L546) | **P3** |

**P0/P1 kinnituse märkus:** L1, L2, L3 tõendid on jäädvustatud koodiviidetena ja runtime-DOM-i nuppude loendina (ptk 2.7 p5) **ilma ühtegi toimingut käivitamata**; analüüs jätkus read-only, risk ei suurenenud.

## 7. Admini päris tööülesanded

Eelmised peatükid näitasid, et praegune adminiala vastab küsimusele „mida me mõõdame?". Admini tegelik küsimus on „mida ma pean täna tegema?". See peatükk defineerib tööülesanded, mis platvormi olemasoleva funktsionaalsuse juures reaalselt eksisteerivad — iga ülesanne on seotud juba olemasoleva andmeallikaga (ptk 3.1) ja admini tüübiga, kes seda teeb (ptk 4.2/4.3). Kehtib pöördreegel: mõõdik, millel tööülesannet pole, jääb V1-st välja (ptk 5 põhimõte — „huvitav statistika" ei ole tööriist).

### 7.1 Mida admin peab jälgima (regulaarne seire)

| Jälgitav | Tööülesanne, mida see teenib | Allikas | Kelle töö |
|---|---|---|---|
| Kustutustööde järjekord: FAILED arv, vanim PENDING | privaatsuslubaduse täitmine on õiguslik kohustus — kinnijäänud töö = täitmata kustutus | `DataDeletionJob` (olemas) | platform_admin |
| rag-service'i kättesaadavus ja peegli sünk | ptk 2.7 p7: analüütika võib vaikselt „pimedaks" jääda, ilma et miski punaseks läheks | summary `ragServiceFallbackError` + `RagDocument` count vs retriever-aktiivsus (olemas, UI-s kuvamata) | platform_admin |
| RAG ingest-vead, FAILED dokumendid, värskusaudit | teadmusbaasi kvaliteet = vastuste kvaliteet; aegunud allikas on sisurisk | `RagDocument` + freshness-audit (olemas) | knowledge_steward |
| Ülevaatusjärjekorrad: materjalid ootel (`status="pending"`), allikatagasiside OPEN | kasutajate esitatu ei tohi vastuseta rippuda | `MaterialSubmission`, source-feedback (olemas, koondnähtavuseta — L15) | knowledge_steward |
| Teenuseinfo kinnituste aegumine | teenusekaardi info peab klientide jaoks tõene püsima | service-availability API (olemas) | platform_admin (hiljem org_steward) |
| Maksetoru tervis: konversioon, webhook-vead; FAILED maksed | raha liikumine ja tellimuste toimimine | `Payment` + ChatLog-toru (olemas; allika haprus — ptk 3.2) | billing_steward |
| Limiidilähedaste kasutajate arv (≥85%) | ette näha teenusekatkestusi ja kasutajapöördumisi | usage-snapshot (olemas) | billing_steward |
| Salvestusruum ja vaba kettapind | teenuse käideldavus | failisüsteem (olemas, aus veapool) | platform_admin |
| Kriisisignaalide trend (ainult arv) | tugiprotsessi mahu piisavus — mitte üksikjuhtumite jälgimine | `crisis_detected` count (olemas) | platform_admin |
| Admin-toimingute auditivoog | halduse enda järelevalve: kes mida muutis | `dataAuditLog` (olemas; kuvatud vaid 20 kirjet usage-paneelis) | platform_admin |

### 7.2 Millele peab reageerima (sündmuspõhine)

Järjestatud tõsiduse järgi. „Reaktsioon" tähendab konkreetset toimingut, mitte teadmiseks võtmist — kui reaktsiooni ei eksisteeri, ei kuulu signaal ka avalehele.

| Seisund | Nõutav reaktsioon | Ajahorisont |
|---|---|---|
| Kustutustöö FAILED | retry; kordumisel eskalatsioon arendusse — kasutajale antud kustutuslubadus on täitmata | sama tööpäev |
| rag-service pime (fallback-viga + tühi peegel, aga retriever töötab) | intsident: teenuse kontroll; kuni lahenduseta käsitle RAG-värskusnäite ebausaldusväärsena | sama tööpäev |
| Webhook-vigade läviületus / PAID-konversiooni langus (`buildPaymentAlerts` läved olemas) | makseteenuse kontroll; vajadusel kasutajate teavitamine | tunnid |
| RAG-dokumendi FAILED ingest | reingest või allika parandus | päevad |
| Teenusekinnitus aegunud | meeldetuletus omanikule (nupp olemas) | nädal |
| Kasutaja 100% limiidil | kasutaja pöördumisel override või paketisoovitus — MITTE proaktiivne „kasutusvestlus" | pöördumisel |
| Kriisitrendi anomaalia (arv ületab ajaloolise taseme) | tugiprotsessi ja RAG-i kriisijuhiste ülevaatus — mitte üksikkirjete avamine | nädal |
| Storage >90% | puhastus või laiendus | päevad |

### 7.3 Mida saab parandada või hallata (aktiivsed toimingud)

Capability kaupa (ptk 4.3 mudel):

**platform_admin:**
- capability-grantide andmine ja lõpetamine (uus, P0.4);
- kasutaja tugijuhtum: konto kustutamine kasutaja taotlusel (`deleteUserWithPrivacyCleanup` rada on olemas ja auditeeritud), sessioonide seis;
- teenusekinnituste meeldetuletused;
- Tööheaolu piloodiskoopide loomine ja vaatajate grantimine (olemas);
- retention-poliitika parameetrid (tekib P1.2-ga).

**knowledge_steward:**
- allikate ingest, revalidate, light-check, failihaldus (olemas);
- allikapakettide ülevaatus, KOV-monitor, kontaktiregister (olemas);
- materjalide ülevaatus: staatus + märkus + kustutus (API olemas, järjekorravaade puudub);
- allikatagasiside lahendamine (olemas).

**billing_steward:**
- paketiversioonide loomine (olemas, hea väravaga);
- entitlement-override'id (olemas, hea väravaga);
- suspend/resume (olemas, hea väravaga);
- makseprobleemi tugijuhtum (makse/tellimuse kaart otsingu kaudu).

**Ei ole kellegi „haldustöö":**
- prelaunch-reset'id — käivituseelsed hooldustoimingud, mis toodangus kas eemaldatakse või lähevad hooldusrežiimi klass C värava taha (ptk 11 P0.1);
- mass-e-kiri — teavituskanali vajadus on lahtine tooteotsus (ptk 12.4); kuni otsuseta jääb see platform_admin'i klass B toiminguks või eemaldatakse.

### 7.4 Väravaklassid: mis vajab kinnitust ja auditijälge

Kolm klassi, mis üldistavad usage-paneeli head mustrit (ptk 2.5) kogu adminialale:

| Klass | Värav | Toimingud |
|---|---|---|
| **A — tavaline haldustoiming** | kohustuslik `reason` + `dataAuditLog` kirje | override, suspend/resume, paketiversioon (juba vastavuses); materjali review-otsus, tagasiside lahendamine, meeldetuletuste saatmine, deletion-retry, grandi andmine/lõpetamine (viia vastavusse) |
| **B — pöördumatu või väljapoole suunatud** | A + mõjuarvu eelvaade (dry-run) + kirjutatav kinnitus (toimingu nimi / „CONFIRM") | kasutaja(te) kustutamine; mass-e-kiri (praegu täiesti väravata — L2); retention-välise logikustutuse erijuht |
| **C — hävitav/süsteemne** | B + teise admini kinnitus VÕI viiteaeg (tühistusaken) + toodangus vaikimisi keelatud | kõik 6 reset-toimingut, eriti `clear_billing` (L1). Auditilogi kustutamist ei eksisteeri üheski klassis (ptk 5.1) |

Kaks lisareeglit:

1. ükski B/C toiming ei ela analüütika- ega ülevaatevaates — ainult oma töövoo alal (ptk 8), kus kontekst ja õigus on üheselt selged;
2. iga värav on **serveripoolne** (API keeldub ilma `reason`/kinnituseta), mitte ainult UI-dialoog — praegused `window.confirm`-id ei ole väravad, sest API võtab päringu vastu ka ilma nendeta.

## 8. Soovitatud infoarhitektuur

### 8.0 Mudelivõrdlus ja valik

**Variant A — üks suur analüütikapaneel** (praegune mudel, viimistletuna): kõik graafikud, kasutajad, kulud ja haldustoimingud ühel lehel; parandataks ainult CSS ja sektsioonide järjekord.

**Variant B — admini juhtimiskeskus:** eraldi alad („Tähelepanu vajab", „Platvormi tervis", „Kasutus ja teekonnad", „Teadmus ja allikad", „Kasutajad ja ligipääs", „Maksed ja kulud", „Privaatsus ja kustutamine", „Piloodid ja koondid"), igaüks oma URL-i, õiguspiiri ja tegevuskohaga.

| Kriteerium | Variant A | Variant B |
|---|---|---|
| Ptk 7 tööülesanded | ükski töö ei alga loogilisest kohast; T2 nõuab 4+ koha peast teadmist | iga töö = üks sissepääs + üks järjekord |
| Õiguste lahusus (ptk 4) | võimatu — üks leht, üks õigus; billing/knowledge steward'it ei saa eristada | capability-piir = ala piir |
| Kirjutavate toimingute väravad (ptk 6 L1–L3) | struktuurne põhjus, miks reset/mass-e-kiri elavad analüütika sees | klass B/C toimingud ainult oma töövoo alal |
| Privaatsus (ptk 5) | logi-drill-down, isikuread ja koondid samal ekraanil | uurimisvaated eraldatud, koondid isikuvabad |
| Teostuskulu | väikseim (CSS + ümberjärjestus) | suurem, aga etapiviisiline (P2→P3), küpsed alad jäävad paika |
| Tõendatud läbikukkumine | jah — praegune 11-sektsiooniline monoliit ON Variant A; runtime ptk 2.7 näitas tulemust | — |

**Otsus: Variant B on soovituslik V1.** Variant A jääb üleminekuseisuks ainult seniks, kuni B kest valmib (P2.1); pärast seda analytics-monoliit lammutatakse (P3.2). Ainus kohandus lähteideele: B kaheksa plokki konsolideeruvad seitsmeks alaks — „Tähelepanu vajab" ei ole eraldi ala, vaid Ülevaate-avalehe ülemine tsoon (8.1/ptk 9), ja „Kasutus ja teekonnad" + „Piloodid ja koondid" ühinevad Töövoogude alaks (8.3), sest mõlemad on sama privaatsuslepinguga koondvaated. Kaardistus: Platvormi tervis→8.6, Teadmus→8.4, Kasutajad ja ligipääs + Maksed→8.2 (tehniline maksetoru 8.6), Privaatsus→8.7.

**Neli tegevusklassi, mida kest alati eristab** (läbiv leping, mille ülejäänud peatükid operatsionaliseerivad):

| Klass | Näide | UI-leping |
|---|---|---|
| **Jälgimine** | KPI, järjekorra pikkus, terviserida | alati nähtav, read-only, värskusajaga; signaaliklassid [I]/[T]/[B] (ptk 9.1) |
| **Uurimine** | logivaade, makse detail, kasutaja kaart | eraldi leht, kuhu koondilt viib link; isikuandmed ainult tugijuhtumi rajal (ptk 9.4) |
| **Otsustamine** | „kas tõsta limiiti?", „kas allikas maha võtta?" | võrdlusvaade + kontekst ilma kirjutamata; otsus viib toimingusse, mitte vastupidi |
| **Kirjutav haldustoiming** | override, retry, review, dispatch, kustutus | väravaklassid A/B/C (ptk 7.4); mitte kunagi mõõdikukaardi sees; alati auditijäljega |

### 8.0.1 Alade loogika

Seitse ala, millest igaüks vastab ptk 7 tööülesannete klastrile — mitte andmemudelile ega ajaloolisele lehejaotusele. Küpsed alad (RAG, teenuseinfo) jäävad paika ja saavad uued naabrid; analytics-monoliit lammutatakse sektsioonhaaval laiali. „Analüütika" kui eraldi sihtkoht kaob — koondnumbrid elavad Ülevaates ja iga ala enda lehel, iga number selle ala töö kontekstis.

### 8.1 Ülevaade — `/admin`

Praegu puuduv avaleht. Sisu: tegevusjärjekorrad, terviseseisundid, 30 päeva põhimahud, alade navigatsioon (täpne mudel ptk 9). Kirjutavaid toiminguid ei ole peale klass A kiirtoimingute (retry, meeldetuletus), mis viivad kinnituse oma ala konteksti. Iga capability näeb ainult oma ala kaarte; platform_admin kõiki.

### 8.2 Kasutajad, õigused ja arveldus — `/admin/users`

Nimevalik: arveldus kuulub siia, sest paketid, override'id ja maksed on kasutajakonto külge seotud tugitöö (billing_steward'i ala); maksetoru *tehniline* tervis elab 8.6 all.

Konsolideerib praegused kaks eraldi „kasutajavaadet" (analytics-tabel + usage-paneeli otsing — ptk 1.2) üheks:

- **tugijuhtumi otsing** (e-post/ID) → kasutajakaart: seisund, sessioonid, pakett, kasutus, override'id, maksed/tellimused, suspend/resume, kustutamine (klass B);
- **paketidefinitsioonid ja -versioonid** (olemas usage-paneelis);
- **AdminGrant-haldus** (P0.4 + P2.5): kehtivad grantid, aegumised, andmine/lõpetamine;
- **piloodivaatajate grantid** (kolivad wellbeing-lehelt — grant on õiguste, mitte töövoo küsimus);
- **raamistiku kinnitused** — üks kodu siin (katvus + otsitav loend, e-post maskitud); analytics-sektsioon ja eraldi leht kaovad (L19).

Põhimõtted: mitte lehitsetavat kasutajaloendit — ainult otsing ja järjekorrapõhised sisenemised; e-post maskitud vaikimisi kõikjal (L9); iga isikukaardi avamine on põhjendatav tugijuhtumiga ja jätab jälje.

### 8.3 Pöördumised ja töövood — `/admin/workflows`

Kliendi- ja töötajasuunaliste voogude **operatiivseis** — mitte kunagi sisu:

- **eelpöördumised:** järjekord seisus „SENT, aga avamata üle N päeva" (`sentAt` olemas, `openedAt` null — skeem toetab, admin-API-t veel pole, ptk 3.1 PUUDUV), ilma pöördumise tekstita;
- **Tööheaolu koond ja piloodid:** olemasolev k-anonüümne leht saab siit lingi ja koju (L8 lahendus); ligipääs endiselt `platform_admin` või `pilot_viewer`;
- **Teekonnad, kovisioon, supervisioon:** V1-s teadlikult AINULT siis, kui tekib operatiivne järjekord (nt ootel taotlused); pelgad mahunumbrid on „huvitav statistika" ja jäävad välja (ptk 11 „hilisem").

See ala on kõige privaatsustundlikum: ainult koondid, summutus „<N", null sisu- ja isikuvälja.

### 8.4 Teadmusbaas ja materjalide elutsükkel — `/admin/rag`

Jääb praegusele kujule (küps ala; süvaanalüüs eraldi dokumentides). Juurde kolib ja pinnale tõuseb:

- materjalide ülevaatusjärjekord nähtava loendina (`MaterialSubmission.status="pending"` — API olemas, koondnähtavus puudub, L15);
- allikatagasiside OPEN-arv ala pealehele;
- värskusauditi täisvaade (analytics-sektsiooni asemel; Ülevaade näitab ainult kokkuvõtet + linki);
- `auditSource` ja rag-service'i fallback-vead nähtavaks (L5).

### 8.5 Teenusekaart ja abivahendus — `/admin/services`

- teenuseinfo kinnitused (olemasolev leht) + meeldetuletuste ajalugu (millal, kellele — praegu nähtamatu);
- teenuseprofiilide/teenusekaardi seis (seos Teenusekaart-analüüsi pakettidega — eraldi dokument, siin ainult admini vaatepunkt);
- abisoovid ja -pakkumised: OPEN/MATCHED loendid + sobitamata soovide vanus — otsustamaks, kas vahendus toimib.

### 8.6 Süsteemi tervis ja vead — `/admin/health`

„Taustatööde tervis ühes kohas" (L15 teine pool):

- rag-service'i kättesaadavus + peegli lahknevus; ingest-veamäärad;
- maksetoru tehniline seis + webhook-vead + payment-alert dispatch'i seis (kas cron käib, millal viimati saatis — praegu nähtamatu, ptk 1.2);
- STT/TTS/openai/rag veamäärad; salvestusruum;
- AI-kulu koond (ühikumudel, ausalt sildistatud nagu praegune ai-costs) — kulujälgimine on ressursitervise, mitte kasutajahalduse küsimus;
- retrieval-stats, KUI otsustatakse säilitada (persistituna; muidu kustutada — L13).

Read-only ala; tehniline drill-down ilma isikuväljadeta.

### 8.7 Privaatsus, kustutused ja auditijälg — `/admin/privacy`

- kustutustööde järjekord + retry (DeletionJobsPanel kolib siia — see on privaatsusoperatsioonide, mitte analüütika ala);
- DataAuditLog täisvaade: otsitav, filtreeritav, **kustutamatu**;
- retention-poliitika seis (P1.2): mida hoitakse kui kaua, millal viimane puhastus jooksis; logide käsitsi kustutusnupud kaovad;
- reset-toimingud, KUI need toodangusse üldse jäävad — ainult siin, hooldusrežiimi + klass C värava taga;
- kriisiprotsessi viide: kust jookseb tugirada (analüütiline drill-down on suletud — P0.2).

### 8.8 Kolimiste kaart ja navigatsioon

| Praegu | Uus kodu |
|---|---|
| analytics KPI-d, platvormikaardid, storage | Ülevaade (kokkuvõte) + Tervis (detail) |
| analytics kasutajatabel + usage-paneeli otsing | Kasutajad (üks tugijuhtumi vaade) |
| analytics arveldussektsioon | Kasutajad (maksed/tellimused) + Tervis (toru) |
| analytics RAG-värskussektsioon | RAG (täisvaade); Ülevaates kokkuvõte |
| analytics logisektsioon | Tervis (tehniline, isikuväljadeta) + Privaatsus (auditivaade) |
| reset-nupud | Privaatsus (klass C) või eemaldus — tooteotsus 12.4 |
| mass-e-kiri | eemaldus või Kasutajad (klass B) — tooteotsus 12.4 |
| UsageAdminPanel (paketid, suspend, override'id) | Kasutajad |
| DeletionJobsPanel | Privaatsus |
| ai-costs sektsioon | Tervis |
| framework-acceptances (leht + sektsioon) | Kasutajad (üks kodu) |
| `/admin/wellbeing` | Töövood (lingitud; õigused endised) |
| `/admin/service-availability` | Teenused |
| source-feedback, materials | RAG |
| retrieval-stats API | Tervis või kustutus |

Navigatsioonipõhimõtted: ruumilava „Haldus"-karussell viitab `/admin` hub'ile, mitte neljale suvalisele alamlehele; iga ala kasutab täisekraani ra-* kesta, mitte ruumipaneelit (runtime ptk 2.7 p1); menüü on capability-filtriga — ala, kuhu õigust pole, ei paista üldse.

## 9. V1 ekraanimudel

### 9.1 Nelja signaaliklassi leping

| Klass | Tähendus | Käitumine |
|---|---|---|
| **[I] Informatiivne mõõdik** | arv ilma läveta; taustateadmine, mitte kohese otsuse sisend | neutraalne kuva; puudumisel „—" + basis-info; ei värvu, ei vilgu |
| **[T] Tähelepanu vajav seisund** | lävi ületatud, aga teenus töötab | kollane; **seisund, mitte sündmus** — püsib, kuni järjekord on tühi/lahendatud; alati koos „ava järjekord" viitega |
| **[B] Blokeeriv / turvakriitiline** | õiguslik kohustus täitmata, andmekadu, teenusekatkestus või analüütika pimedus | punane riba lehe tipus; ei ole sulgetav ega peidetav; nimetab vastutava capability ja esimese sammu |
| **[A] Adminitoiming** | midagi muutev nupp/vorm | alati väravaklassiga A/B/C (ptk 7.4); klass B/C toiming ei asu kunagi Ülevaates |

Reegel: iga ekraanielement kuulub täpselt ühte klassi. Number, mis pole ühegi otsuse sisend, jääb ekraanilt välja (ptk 5 kõva piir).

### 9.2 Avaleht: mida admin kohe näeb

Visand (ülalt alla):

```
┌─ [B] riba (renderdub ainult siis, kui aktiivne) ──────────────┐
│ „2 kustutustööd FAILED (vanim 3 p)" → [Ava privaatsusala]     │
├─ [T] tegevusjärjekorrad ──────────────────────────────────────┤
│ materjalid ootel 12 (vanim 6 p) · tagasiside OPEN 4 ·         │
│ kinnitused aegumas 7 · limiidil (≥85%) 3 · webhook-vead 2     │
├─ terviserida ─────────────────────────────────────────────────┤
│ rag-service ✓ · peegel ✓ · storage 62% · maksetoru ✓ ·        │
│ retention viimati: eile 03:00                                 │
├─ [I] mahud 30p ───────────────────────────────────────────────┤
│ kasutajad rollide kaupa · vestlused · päringud · RAG ·        │
│ abivoog · dokumendid · AI-kulu ~N € · kriisisignaale N        │
├─ alad (capability-filtriga) ──────────────────────────────────┤
│ Kasutajad · Töövood · RAG · Teenused · Tervis · Privaatsus    │
└───────────────────────────────────────────────────────────────┘
```

Loogika: kõige ülal see, mis **nõuab** tegevust; keskel see, mis võib nõuda; all see, mis lihtsalt informeerib. Praegune leht on täpselt vastupidine (KPI-d üleval, ohtlikud toimingud all logide kõrval).

### 9.3 Elementide klassifikatsioon

| Element | Klass | Lävi/reegel | Kuhu viib | Toiming sihtkohas |
|---|---|---|---|---|
| Kustutustöö FAILED | **[B]** | ≥1 | Privaatsus | retry (A-värav) |
| Kustutustöö PENDING üle 24 h | **[T]** | vanus | Privaatsus | retry |
| rag-service pime (fallback-viga + tühi peegel + retriever aktiivne) | **[B]** | kolmiktingimus (ptk 2.7 p7) | Tervis | intsidendi uurimine |
| Auditilogi kirjutusviga | **[B]** | ≥1 | Privaatsus | halduse peatamine kuni logimine taastub |
| Salvestusruum | [I] → **[T]** 80% → **[B]** 95% | protsent | Tervis | puhastus/laiendus |
| Maksetoru hoiatus (`buildPaymentAlerts`) | **[T]**; **[B]** kui webhook-vead + laekumised seiskunud | olemasolevad läved | Tervis | dispatch-seis, uurimine |
| Materjalid ootel | **[T]** kui >0 | vanim >7 p tõstab esile | RAG | ülevaatus (A) |
| Allikatagasiside OPEN | **[T]** kui >0 | — | RAG | lahendamine (A) |
| RAG FAILED dokumendid | **[T]** | ≥1 | RAG | reingest (A) |
| Värskusaudit: kõrgriski/aegunud allikad | **[T]** | ≥1 | RAG | remediation (lingid olemas) |
| Teenusekinnitused aegumas/aegunud | **[T]** | olemasolevad kategooriad | Teenused | meeldetuletus (A) |
| Limiidiületajate arv (≥85%) | **[T]** | ≥1 | Kasutajad | override tugijuhtumis (A) |
| Eelpöördumised „SENT, avamata >N p" | **[T]** (kui P1 mõõdiku lisab) | ≥1 | Töövood | operatiivne järelkontroll ilma sisuta |
| Kriisisignaalid 30 p | **[I]** — trend, mitte juhtumid | <5 → „<5" | protsessiviide, MITTE kirjed | — |
| Kasutajad rollide kaupa | **[I]** | — | Kasutajad (otsing) | — |
| Vestlused/päringud/RAG-otsingud/abivoog/dokumendid 30 p | **[I]** | — | ala kokkuvõte | — |
| AI-kulu 30 p | **[I]**; **[T]** eelarveläve juures (70/85/100 olemas) | läved olemas | Tervis | — |
| Aktiivsed tellimused, laekunud 30 p | **[I]** | — | Kasutajad (arveldus) | — |
| FAILED maksed 30 p | **[T]** kui üle tavataseme | — | Kasutajad (tugijuhtum) | — |

### 9.4 Süvenemise (drill-down) reeglid

1. [I]-kaart avab ala koondlehe — mitte kunagi isikuloendit (ptk 5.2 p6).
2. [T]/[B]-kaart viib täpselt sellesse järjekorda/juhtumisse, kus toiming on võimalik; toiming ise küsib väravaklassi järgi põhjust ja kinnitust.
3. Isikutasandini viib ainult kaks rada: tugijuhtumi otsing (Kasutajad) või järjekorra üksikkirje (kustutustöö, materjal). Mõlemad jätavad auditijälje, kui avatakse isikuandmeid sisaldav kaart.
4. Iga kaart kannab basis-teavet (allikas + aken + valim + arvutusaeg) ja oskab kolme eriseisu: „—" (andmed puuduvad), „valimi põhjal" (≤1000-piirid), „pole usaldusväärne" (allikas degradeerunud — nt logikustutus perioodis, rag-service'i viga).

### 9.5 Mida avalehel EI ole

- ühtegi klass B/C toimingut (kustutamised, reset, mass-e-kiri);
- ühtegi sisufragmenti (vestlused, päringutekstid, logi-meta vabatekst);
- ühtegi isikurida — ka mitte „viimati aktiivsed kasutajad" vms;
- RAG tehnilisi keskmisi (grounding, retriever-jaotus) — need on knowledge_steward'i ala-lehel;
- pingeridu ega „top kasutajaid" üheski vormis (ptk 5.2 p4).

## 10. Mõõdikute V1 kataloog

### 10.1 Ühine leping (kehtib igale mõõdikule)

- **API kuju:** `{value, basis: {source, window, computedAt, sampleLimit?, degraded?, suppressed?}}`. `value: null` → UI renderdab „—", mitte kunagi „0" (parandab ptk 3.3 `|| 0` mustri).
- **„Andmed puuduvad"** näidatakse, kui: allika päring ebaõnnestus; mõõtmist pole selles keskkonnas seadistatud; snapshot on vanem kui lubatud.
- **„Tulemus pole usaldusväärne"** näidatakse, kui: (a) allikas on degradeerunud (nt `ragServiceFallbackError` ≠ null); (b) mõõdik põhineb ChatLog-il ja perioodis on toimunud logikustutus või retention-poliitika (P1.2) pole veel kehtestatud — kuni selleni kannavad KÕIK ChatLog-põhised mõõdikud püsimärget „operatiivlogi-põhine, mitte raamatupidamislik"; (c) arvutus toetub valimile (≤1000-piirid) ja andmestik ületab valimi — siis lisandub märge „valimi põhjal".
- **Summutus:** iga rolligrupi-/skoobilõige alla 5 isiku → „<5" (Tööheaolu skoobil skoobi enda miinimum, ≥3). Kontohalduse faktid (nt kasutajate arv rolli kohta) summutust ei vaja — need pole käitumisandmed.
- **Nähtavus:** capability järgi (ptk 4.3); platform_admin näeb kõike. „Kellele" veerus on kitsaim õigus, kellel mõõdikut tööks vaja.
- **Värskus:** „live" = Prisma count päringu hetkel (praegune muster); „snapshot" = perioodiline arvutus, `computedAt` kuvatakse.

### 10.2 Grupp A — järjekorrad ja kohustused (iga rida = tegevus)

| Mõõdik | Kellele | Allikas | Värskus | Tase | Privaatsuspiir | Mida tohib otsustada | „—" / ebausaldusväärne |
|---|---|---|---|---|---|---|---|
| Kustutustööd staatuse kaupa + vanim PENDING | platform_admin | `DataDeletionJob` | live | koond; üksikkirje = tugijuhtum | kirje sisaldab userId → ainult privaatsusala sees, avamine auditiga | retry / eskalatsioon | „—" kui päring ebaõnnestub (mitte 0) |
| Materjalid ülevaatusel (arv + vanim) | knowledge_steward | `MaterialSubmission.status="pending"` | live | koond | esitaja identiteet ainult ülevaatusvaates | ülevaatuse prioriseerimine | — |
| Allikatagasiside OPEN | knowledge_steward | source-feedback status | live | koond | raporteerija ainult lahendusvaates | lahendamise järjekord | — |
| Teenusekinnitused: kinnitatud/aegumas/aegunud | platform_admin (hiljem org_steward) | service-availability API | live | koond + omanikuloend toimingu piires | omaniku kontakt ainult meeldetuletuse kontekstis | meeldetuletuse saatmine | — |
| Limiidiületajad: kasutajate ARV ≥85% ja =100% | billing_steward | usage-snapshot | snapshot | koond; isik ainult otsingu-tugijuhtumis | EI pingerida — ainult läviületuse fakt (ptk 5.1) | override / paketisoovitus | „—" kui snapshot >24 h vana |
| Eelpöördumised „SENT, avamata >7 p" (uus arvutus P1) | platform_admin | `PreInquiry.sentAt/openedAt` | live | koond | sisu (situation/draft) MITTE KUNAGI; ka adressaadi identiteet mitte | kohaletoimetamise järelkontroll protsessina | „—" kuni P1 mõõdiku lisab |

### 10.3 Grupp B — süsteemi tervis

| Mõõdik | Kellele | Allikas | Värskus | Tase | Privaatsuspiir | Mida tohib otsustada | „—" / ebausaldusväärne |
|---|---|---|---|---|---|---|---|
| rag-service kättesaadavus + peegli lahknevus | platform_admin, knowledge_steward | summary fallback-viga + `RagDocument` count vs retriever-aktiivsus | live | süsteemitase | — | intsidendi avamine | see mõõdik ON teiste usaldusväärsuse allikas: kui punane, märgi kõik RAG-mõõdikud degradeerituks |
| RAG ingest FAILED + `rag_error` 30 p | knowledge_steward | `RagDocument` + ChatLog | live | koond | tehniline meta ilma userId-ta | reingest / allika parandus | ChatLog-osa: retention-märge |
| Värskusaudit: aegunud / kõrgriski / metaandmeteta | knowledge_steward | freshness-audit (≤1000) | arvutuslik | koond dokumenditasemel (dokument pole isikuandmed) | — | allika uuendus (remediation olemas) | „valimi põhjal" ≥1000 juures; degradeeritud kui fallback-viga |
| Salvestusruum kategooriate kaupa + vaba ketas | platform_admin | failisüsteem | live | süsteem | — | puhastus / laiendus | `issues`-massiiv → osaline (muster juba hea) |
| Maksetoru konversioon + webhook-vead 30 p | billing_steward, platform_admin | ChatLog `subscription_*` | live | koond | — | makseteenuse intsident; teavitus | retention-märge; pärast logikustutust „pole usaldusväärne", MITTE 0 (L3) |
| Payment-alert dispatch'i seis (viimane jooks, tulemus) | platform_admin | dispatch-API/cron logi | live | süsteem | — | kas hoiatuskanal üldse töötab | „—" kui cron pole seadistatud |
| STT/TTS/openai veamäärad 30 p | platform_admin | ChatLog | live | koond | — | teenuseseire, mudeliprobleemid | retention-märge |

### 10.4 Grupp C — mahud ja äri (informatiivsed, aga otsusega seotud)

| Mõõdik | Kellele | Allikas | Värskus | Tase | Privaatsuspiir | Mida tohib otsustada | „—" / ebausaldusväärne |
|---|---|---|---|---|---|---|---|
| Kasutajad rollide kaupa (koguarv) | platform_admin | `User` groupBy (uus kuva — L11) | live | koond | kontohalduse fakt, summutust ei vaja | mahuplaneerimine, õiguste ülevaade | — |
| Aktiivsed tellimused + uued/katkestatud 30 p | billing_steward | `Subscription` | live | koond | — | paketiotsused koos päris makseandmetega | — |
| Laekunud summa 30 p + maksete staatusjaotus | billing_steward | `Payment` | live | koond | üksikmakse ainult tugijuhtumis | raamatupidamise kõrvutus — ainus rahanumber, mida tohib aruandluses kasutada | — |
| AI-kulu 30 p (ühikumudel) + jaotused rolli/mudeli kaupa | platform_admin, billing_steward | ChatLog kulusündmused | live | koond; lõige <5 kasutajaga → „<5" | kulu EI seota kunagi sisuga ega isiku pingereaga | eelarvelävede seadmine; mudelivaliku hind | ALATI silt „ligikaudne, mitte arveldus"; atributsiooni-% madal → hoiatus (olemas); retention-märge |
| Vestlused kokku/aktiivsed; päringud; RAG-otsingute arv 30 p | platform_admin | `Conversation`, ChatLog | live | koond | sisu mitte kunagi | võimsuse/koormuse hindamine | ChatLog-osa: retention-märge; „osakaalud" ainult välistavate sündmuste peal (L7 parandus) |
| Abivoog: OPEN/MATCHED + sobitamata soovide vanus | platform_admin | `HelpRequest/HelpOffer/HelpMatch` | live | koond | kuulutuse sisu modereerimine on eraldi töövoog, mitte analüütika | kas vahendus toimib (seisvad soovid) | — |
| Ruumid aktiivsed 30 p; kutsed PENDING_PAYMENT | platform_admin | `Room/RoomMessage/Invite` | live | koond | sõnumisisu mitte kunagi | maht; ootel maksega kutse = arveldusjuhtum | — |
| Dokumendid/artefaktid loendid + toimingute jaotus | platform_admin | `UserDocument/AgentArtifact/DocumentAudit` | live | koond | pealkirju/sisu ei kuvata | maht, agendi kasutus | — |
| Raamistiku kinnituste arv + katvus aktiivsetest töökasutajatest | platform_admin | `FrameworkAcceptance` + `User` (katvus = uus arvutus P1) | live | koond; loend Kasutajate alal | e-post maskitud ka loendis (L9 parandus) | kas kinnitusnõue on täidetud enne funktsiooni avamist | — |
| Kriisisignaalide arv 30 p (trend) | AINULT platform_admin | `crisis_detected` count | live | AINULT koond | <5 → „<5"; drill-down analüütikas keelatud (L4); tugirada eraldi protsessiga | tugiprotsessi mahu planeerimine | retention-märge; mitte kunagi isikuni |

### 10.5 Grupp D — halduse enda järelevalve

| Mõõdik | Kellele | Allikas | Värskus | Tase | Privaatsuspiir | Mida tohib otsustada | „—" / ebausaldusväärne |
|---|---|---|---|---|---|---|---|
| Admin-toimingute arv tüübi kaupa 30 p + viimased kirjed | platform_admin | `DataAuditLog` | live | koond + täiskirjed platform_admin'ile | kirje sisaldab admini identiteeti — see ONGI eesmärk (aruandekohuslus) | väravate toimimise kontroll; intsidendi uurimine | kirjutusvea korral [B]-seisund — audit ei tohi vaikselt katkeda |
| Grantide seis (kehtivad capability'd, aeguvad) | platform_admin | `AdminGrant` (uus, P0.4) | live | koond + loend | — | õiguste perioodiline ülevaatus | „—" kuni P0.4 |

### 10.6 Mida kataloogis teadlikult EI ole

- **Teekondade/kovisiooni/supervisiooni mahunumbrid** — tegevusväärtuseta „huvitav statistika"; tõusevad V1-järgselt ainult koos operatiivse järjekorraga (ptk 11 „hilisem");
- **kasutajatabeli „kulud"-veerg senisel kujul** (L10) — asendub kahe selgelt nimetatud asjaga: „eelarveühikud" (limiidiotsusteks, billing_steward) ja „ligikaudne AI-kulu" (ressursiseireks, Tervise alal);
- **retrieval-statistika** — kuni pole persistitud ja tarbijat, pole see mõõdik (L13);
- **iga töötaja/kasutaja individuaalne aktiivsus, sooritus või pingerida** — ei V1-s ega hiljem (ptk 5.2 p4);
- **header-pseudomõõdikud** („logisid lehel: 100" jms — L17).

## 11. Rakendusjärjekord

Põhimõtted: iga pakett on väike (üks kuni paar PR-i), iseseisvalt väärtuslik ja testitav; P0 käib enne kõike, sest praegused riskid on aktiivsed (L1/L2 nupud on toodangu-koodis olemas); ühtegi uut koondvaadet ei ehitata enne, kui andmeleping (P1) kehtib — vastasel juhul ehitame ilusa kesta valede numbrite ümber.

### P0 — privaatsus ja õigused (kohe)

| Pakett | Sisu | Lahendab | Maht |
|---|---|---|---|
| **P0.1 Ohtlike toimingute väravad** | reset-toimingutele klass C (serveripoolne `reason` + kirjutatav kinnitus + `dataAuditLog` + toodangus vaikimisi keelatud env-lülitiga); mass-e-kirjale klass B + audit; logikustutusele klass B + audit (ajutine, kuni P1.2 asendab retention'iga). Failid teada: [reset/route.js](app/api/admin/analytics/reset/route.js), [users/route.js](app/api/admin/analytics/users/route.js) POST-haru, [events/route.js](app/api/admin/analytics/events/route.js) DELETE + AnalyticsDashboard'i handlerid. Testid: ilma `reason`-ita → 400; auditikirje tekib | L1, L2, L3 | S–M |
| **P0.2 Kriisi drill-down'i sulgemine** | events-API ei tagasta `crisis_detected` kirjetel userId-d ega vaba meta-t; kriisifilter annab ainult loenduse. Tugirada disainitakse eraldi (tooteotsus 12.4 p4) | L4 | S |
| **P0.3 E-posti poliitika ühtlustamine** | maskEmail kõigis kolmes kohas (users-tabel, framework-acceptances, usage-otsing); env-lüliti dokumenteeritakse ajutisena, sihtseis = grant-põhine avamine | L9 | S |
| **P0.4 Capability-kiht** | `AdminGrant` tabel + `assertCapability` + route'ide kaardistus (ptk 4.3); `platform_admin` = senine isAdmin; pilot_viewer migreerub; grantide haldus esialgu seed-skriptiga, UI tuleb P2.5-s. **Ainus skeemimuudatus P0-s** | ptk 4 | M |

### P1 — usaldusväärne andmealus

| Pakett | Sisu | Lahendab | Maht |
|---|---|---|---|
| **P1.1 basis-leping** | summary/users/ai-costs vastustesse `basis`-väli; UI „—"-renderdaja + valimi-/degradatsioonimärked; `ragServiceFallbackError`, `sourcePackages.unavailable` jm pinnale | L5, L12, ptk 3.3 | M |
| **P1.2 ChatLog retention-poliitika** | säilitusklassid (arveldus-sündmused pikemalt, operatiivlogi lühemalt), taimerkustutus, käsitsi kustutusnuppude eemaldus, „logid kustutatud" seisu eristamine retention-metaandmetega. Eeldab tooteotsust 12.4 p1 | L3, ptk 3.2 | M |
| **P1.3 Mõõdikuparandused** | `requestSplit` välistavaks (L7); kahe „kulu" lahutamine nimedes (L10); `totalUsers` + rollijaotus kuvale (L11); header-pseudomõõdikud maha (L17); pärandväljad maha (L21); ajaakende sildid (L14) | L7, L10, L11, L14, L17, L21 | S–M |
| **P1.4 Puuduvad operatiivloendurid** | materials pending, source-feedback OPEN, deletion backlog, teenusekinnituste seis, eelpöördumiste „SENT avamata" ühte summary-vastusesse — Ülevaate (P3.1) toiduks | L15, ptk 10 grupp A | S–M |

### P2 — admini tegelikud töövood

| Pakett | Sisu | Lahendab | Maht |
|---|---|---|---|
| **P2.1 `/admin` hub + navigatsioon** | 7 ala capability-filtriga; wellbeing lingitud; ruumikarussell → hub; täisekraani kest (mitte ruumipaneel) | L8, ptk 8.8 | M |
| **P2.2 Privaatsusala** | deletion-jobid + otsitav DataAuditLog-vaade + retention-seis ühel lehel | ptk 8.7 | M |
| **P2.3 Kasutaja tugijuhtum** | kaks kasutajavaadet üheks (otsing → kaart: seisund, pakett, override'id, maksed, sessioonid, suspend, kustutus klass B väravaga); framework-acceptances kolib siia | L19, ptk 8.2 | M |
| **P2.4 Järjekorrad tegevuskohtadeks** | materjalide ülevaatuse UI-loend + tagasiside lahendusvaade RAG-alal; meeldetuletuste ajalugu + payment-alert dispatch'i seis nähtavaks | L15, L20 osa | M |
| **P2.5 Grantide haldus-UI** | P0.4 peale: loend, andmine, lõpetamine, aegumised | ptk 8.2 | S |

### P3 — kujundus ja koondvaated

| Pakett | Sisu | Lahendab | Maht |
|---|---|---|---|
| **P3.1 Ülevaate-avaleht** | ptk 9 mudel — alles nüüd, kui andmed on ausad (P1) ja järjekorrad olemas (P1.4/P2.4) | ptk 9 | M |
| **P3.2 Analytics-monoliidi lammutus** | sektsioonid kolivad aladele (ptk 8.8 kaart); ra-* kesta stiilid tagasi; topeltrenderi parandus; ohtlike nuppude visuaalne eristusklass | L6 | M–L |
| **P3.3 Pisiparandused** | UsageBar elustada või kustutada (L18); retrieval-stats otsus: persist või kustuta (L13); source-feedback 404→403 ja service-availability jaluse märge (L20) | L13, L18, L20 | S |

### Teadlikult HILJEM (mitte V1)

- **org_steward + KOV/organisatsioonipõhised lõiked** — vajab andmepiiride ja summutuse eraldi disaini (väikesed org-id on k-anonüümsuse risk);
- **prognoosid, trendigraafikud, anomaaliahoiatused** (peale makse omade, mis on olemas);
- **Teekondade/kovisiooni/supervisiooni/adoption-mahudashboard** — kuni operatiivset tegevusväärtust pole; supervisiooni admin-vaated tulevad supervisiooni tootemudeli oma paketijadas (eraldi dokument);
- **organisatsioonianalüütika tööandjatele** — eraldi toode eraldi privaatsuslepinguga, mitte adminiala laiendus;
- **MITTE KUNAGI:** töötaja individuaalne sooritus, kasutaja käitumisprofiilid, sisu koondanalüüs (ptk 5).

### Sõltuvused

P0 → kõik; P1.1 → P3.1/P3.2; P1.4 → P3.1; P0.4 → P2.1/P2.5; P1.2 eeldab tooteotsust 12.4 p1; P2 võib joosta P1-ga osaliselt paralleelselt (P2.2/P2.3 vajavad ainult P0-i).

## 12. Lõpphinnang

### 12.1 Mis on päriselt olemas

- **Andmekorje on lai ja suures osas TÕENDATUD** (ptk 3.1): põhimudelite loendid, maksed, tellimused, salvestusruum, raamistiku kinnitused, kustutustööd — kõik vastavad päris andmebaasist ja API-d töötavad (runtime ptk 2.7).
- **Kaks küpset admin-rakendust** (RAG-ala, teenuseinfo kinnitused) oma kujunduse ja piiritletud ülesannetega.
- **Kolm head mustrit, mida üldistada:** usage-paneeli `reason` + `dataAuditLog`; Tööheaolu k-anonüümsus + skoobipõhine grant (`WellbeingPilotScope/Viewer`); ai-costs'i aus „ligikaudne" sildistus + kaetuse märkused.
- **Kustutuste toru** (`deleteUserWithPrivacyCleanup` + `DataDeletionJob` + retry) on olemas ja auditeeritud.
- Analytics-lehe **funktsionaalsus on olemas** — kasutaja mulje „funktsionaalsust pole" oli stiilituse loodud väärmulje (ptk 2.2).

### 12.2 Mis jätab eksitavalt valmis mulje

- **Analytics-leht näib koondvaatena, aga ei ole kasutatav ega usaldatav:** stiilitus + topeltrender (L6), eksitavad mõõdikud (138% „osakaalud" L7; kaks eri „kulu" L10), vaikivad rikked („probleeme pole", kui allikas on pime — L5), pseudomõõdikud (L17) ja ohtlikud nupud analüütika sees (L1–L3).
- **„Kõik on mõõdetud" ≠ usaldusväärselt mõõdetud:** suur osa analüütikast elab kustutatavas ChatLog-is ilma säilituspoliitikata (ptk 3.2) — iga number võib homme teine olla.
- **„Adminiala on olemas" mulje:** tegelikult puudub avaleht, 1/5 aladest on lingtimata saar (L8), tegelikud tööjärjekorrad (materjalid, tagasiside, kustutused) pole üheski koondis (L15) ja kaks kasvavat tooteala on täiesti mõõtmata (L16).
- **Õigused näivad korras** (assertAdmin on järjekindlalt igal route'il), aga üks lame ülemõigus tähendab, et iga admin saab kustutada makseandmed ja lugeda kriisikirjeid userId-ga (ptk 4.1, L4).

### 12.3 Minimaalne kasutatav admini V1

**= P0 (väravad + capability) + P1 (basis + retention + mõõdikuparandused) + P2.1–P2.4 (hub, privaatsusala, tugijuhtum, järjekorrad).** P3 teeb selle mugavaks, aga kasutuskõlblikkuse piir jookseb P2 lõpus: admin näeb, mis vajab tegevust; iga toiming on väravaga; ükski number ei valeta vaikides.

V1 **ei sisalda:** org-analüütikat, prognoose, adoption-mõõdikuid, Teekondade/kovisiooni/supervisiooni mahunumbreid, individuaalset sooritust (mitte kunagi).

### 12.4 Blokeerivad tooteotsused

1. **ChatLog retention:** säilitusklassid ja tähtajad (arveldusjälg vs operatiivlogi). Ilma selleta ei saa P1.2 ehitada; omanik peab ütlema, kas maksetoru-ajalugu peab olema taastatav >30 päeva.
2. **Reset-toimingute saatus toodangus:** eemaldada või hooldusrežiim? Soovitus: eemaldada — git taastab vajadusel; P0.1 värav on vahelahendus.
3. **Mass-e-kirja saatus:** kas platvorm vajab admini teavituskanalit üldse ja kas see on „analüütika" funktsioon? Soovitus: analüütikast eemaldada; kui kanal on vajalik, on see eraldi teavitusfunktsioon oma sihtimise ja auditiga.
4. **Kriisisignaali tugirada:** kes ja mis protsessiga reageerib? Kuni otsuseta jääb kriis ainult koondloenduseks (P0.2 sulgeb praeguse userId-raja).
5. **Esimesed grantid:** globaalsete adminide arv (soovitus ≤2) ja kes saavad knowledge_steward/billing_steward — P0.4 seed vajab nimekirja.
6. **Tööheaolu koondi nähtavus:** kas platform_admin näeb kõiki skoope vaikimisi (praegune seis) või ainult piloodivaatajad oma skoope?
7. **E-posti avamise poliitika:** kas eksisteerib juht, kus admin vajab maskimata e-poste loendina? Soovitus: ei — maskimata e-post ainult tugijuhtumi kaardil, auditijäljega.

### 12.5 Täpne jätkamispunkt

Järgmine teostatav pakett on **P0.1 (ohtlike toimingute väravad)** — failid: [reset/route.js](app/api/admin/analytics/reset/route.js), [users/route.js](app/api/admin/analytics/users/route.js) (POST-haru), [events/route.js](app/api/admin/analytics/events/route.js) (DELETE) + [AnalyticsDashboard.jsx](components/admin/AnalyticsDashboard.jsx) kinnitus-handlerid; eeskujumuster on usage-paneeli `reason` + `dataAuditLog` rada. P0.1 ei vaja migratsioone ega tooteotsuseid. Enne P0.4 (ainus skeemimuudatus) kinnitada otsus 12.4 p5; enne P1.2 otsus 12.4 p1.

Dokumendi enda jätk: kui P0–P1 on teostatud, uuendada ptk 2.5 ja ptk 6 tabelid (väravate tegelik seis) ning ptk 10 basis-veerg tegelikuks.

---

STATUS: COMPLETE
