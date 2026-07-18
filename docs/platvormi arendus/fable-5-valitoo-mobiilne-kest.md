# Fable 5: välitöö mobiilne kest (FIELD-A0)

STATUS: COMPLETE (esimene täisring 17.07.2026; vt lõpurida. COMPLETE tähendab valmis analüüsi, mitte valmis rakenduskoodi, ega anna paketile arendusluba — FIELD-V1 käib koordinaatori arendusvalmiduse väravast läbi eraldi.)

FIELD-D0 (17.07.2026): tooteomanik KINNITAS kõik kolm blokeerivat otsust O-FD-1, O-FD-2 ja O-FD-3 (ptk 10); FIELD-V1 pakett = `READY_THEME_BUILD` (ptk 12; masterregister T24). Haru avamise järjekord jääb koordinaatori otsuseks.

> Toote-, süsteemi-, privaatsus- ja UX-analüüs: kuidas sotsiaaltöötaja teeb SotsiaalAI-ga mobiilset
> välitööd — külastuse ettevalmistus, töö ühe käega ja ebastabiilse internetiga, märkmete/piltide/heli
> kogumine, nõusolek, turvaline sünkroonimine ning materjali üleandmine olemasolevasse tööruumi.
> Välitöö EI OLE uus eraldiseisev andmesüsteem: see on olemasolevate SotsiaalAI tööruumide mobiilne kest
> (RUUM-VIS 11.1: „spetsialisti stuudio mobiilne kest, mitte eraldi keskkond").
> Autor: Fable 5 (FIELD-A0), 2026-07-17. Ainult analüüs — rakenduskoodi, skeeme, migratsioone ega teste ei muudetud.

## Edenemistabel

| Etapp | Sisu | Seis |
|---|---|---|
| 0 | Tõeallikad (origin/main muutumatuse kontroll, read-only) | TEHTUD |
| 1 | Kohustuslike sisendite lugemine (5 dokumenti + teemakohased osad 4 dokumendist) | TEHTUD (loend Jätkamispunktis) |
| 2 | Koodikontroll (PWA/SW, offline-kiht, dikteerimine, failid/fotod, mustandid, continuity, eelpöördumine) | TEHTUD |
| 3 | Ptk 1 — kasutajad ja olukorrad | TEHTUD |
| 4 | Ptk 2 — üks terviklik põhiteekond + katkestusrajad | TEHTUD |
| 5 | Ptk 3 — offline- ja sünkroonimisleping (olekumasin) | TEHTUD |
| 6 | Ptk 4 — andmed ja privaatsus | TEHTUD |
| 7 | Ptk 5 — kaamera, heli ja OCR | TEHTUD |
| 8 | Ptk 6 — turvalisus ja välitöö turvasignaal | TEHTUD |
| 9 | Ptk 7 — kasutajaliides | TEHTUD |
| 10 | Ptk 8 — sidumine olemasolevate funktsioonidega | TEHTUD |
| 11 | Ptk 9 — tehnilised variandid + soovitus | TEHTUD |
| 12 | Ptk 10 — otsused (max 3 blokeerivat) | TEHTUD (10 otsust, 3 blokeerivat) |
| 13 | Ptk 11 — FIELD-V1 üks arenduspakett + ptk 12 valmidushinnang + registrid | TEHTUD |
| 14 | FIELD-D0 — kolme blokeeriva otsuse (O-FD-1/2/3) kinnitamine + registrite uuendus | TEHTUD (17.07.2026; ainult dokumentatsioon) |

## 0. Tõeallikad (kontrollitud 2026-07-17, read-only)

| Allikas | Seis | Tõend |
|---|---|---|
| `origin/main` | `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` — **muutumatu** võrreldes kanoonilise seisuga | `git ls-remote origin main` 17.07 = lokaalne `origin/main` ref. Kuna SHA ei muutunud, serveri- ega Git-kontrolle ei korratud (ülesande reegel); kehtib K1-U1-A0/CASEWORK-A0 sama päeva kontroll: server = `fe4eb4fa`, frontend/rag/livekit töötavad, notifications-timer ~5 min |
| Lokaalne main | `0da4185b`, määrdunud tööpuu (CSS, `components/register/`, i18n, dokumendid) | ei ole ühegi väite alus. Allpool loetud failid (`public/sw.js`, `components/pwa/`, `components/chat/hooks/useSpeech.js`, `app/api/stt/`, `lib/documents/constants.js`, `lib/workspaceContinuity.js`, `app/api/pre-inquiries/[id]/downloaded/`, `prisma/schema.prisma` enum'id) EI kuulu origin/main-i ja tööpuu teadaolevasse erinevushulka (Admin-P0.1 / Help-P0 / RAG-P8.0 / research-jobs failid — K1-U1-A0 ptk 1 ja CASEWORK-A0 ptk 0 diff-tõend samal SHA-l), st loetud sisu = origin/main sisu |
| K1-P0 | `origin/codex/k1-p0-workspace-contract @ ef5973c9` [BRANCH] — registry reserveerib **`field_visit`** kind'i (CASEWORK-A0 ptk 0 `git show` tõend) | välitöö tööruumitüüp on ühises lepingus JUBA ette nähtud |
| Välitöö kood [MAIN] | `field`/`külastus`/`visit` domeenikoodi **EI EKSISTEERI** (0 vastet; „kodukülastus" esineb ainult Kovisiooni konstandi ja Tööheaolu vormisildina) | grep lib/app/components |

Teemakohane koodiinventuur (kõik [MAIN]; read-only):

| Pind | Leid |
|---|---|
| PWA | `public/site.webmanifest` (standalone, portrait-primary, ikoonid) + `components/pwa/ServiceWorkerRegistrar.jsx` (registreerib `/sw.js`) on olemas; **`public/sw.js` on no-op** — ainult `skipWaiting`+`clients.claim`, 0 cache'i, 0 fetch-handlerit → rakendus on installitav, aga offline EI tööta ÜLDSE; samas ei ole ka privaatsete API-vastuste cache'imise riski (puhas leht) |
| Offline-kiht | IndexedDB/localforage kasutust **0**; `localStorage` kasutatakse ainult UI-eelistuste/oleku jaoks (~20 komponenti); sisestusmustandi kaitset ega ühenduseoleku märki pole (avastamata-vajadused võimekus 12 kehtib muutumatuna) |
| Dikteerimine | `components/chat/hooks/useSpeech.js` — MediaRecorder (webm/mp4/ogg) + WAV-fallback AudioContext'iga → `POST /api/stt` (STT_SERVER_URL või OpenAI `gpt-4o-mini-transcribe`; auth + tellimus + rate-limit 20/min + 12 MB); kasutajad: ChatComposer, AgentModePage. **STT on serveripõhine → offline'is transkriptsiooni EI OLE** |
| Heli failina | `/api/documents/audio-sources` (25 MB, signatuurikontroll, MP3-bypass FAILID F-10) → `/api/documents/[id]/transcribe` (CALL_TRANSCRIPT/AUDIO_TRANSCRIPT) → `/summary` (AgentArtifact TRANSCRIPT_SUMMARY) — heli→transkript→kokkuvõte rada on toodangus |
| Fotod | **EI toetata**: `ALLOWED_DOCUMENT_TYPES` = PDF/DOCX/TXT (`lib/documents/constants.js:43`); ühtegi pildi-MIME-i, kaamera-capture'it ega pilditöötluskohta koodis pole |
| OCR | **0 vastet** kogu koodibaasis (sh rag-service) |
| Mustandid | PreInquiry DRAFT + **`DOWNLOADED`** olek (`PreInquiryStatus` enum): autor märgib salvestatud pöördumise offline-kasutuseks alla laadituks `expectedUpdatedAt` CAS-iga; sisuline muudatus invalideerib offline-koopia (READY + 409 stale) — **platvormi ainus olemasolev „offline-koopia + värskuse ausus" muster** (`app/api/pre-inquiries/[id]/downloaded/route.js`, `lib/preInquiries.js:621–1227`) |
| „Jätka siit" | `lib/workspaceContinuity.js` [MAIN]: 8 liiki (next_contact prio 0 … journey prio 7), omaniku-skoobitud, Tallinna-kuupäev, href-dedup, badge'id — uus liik on lisatav ilma arhitektuurimuutuseta |
| Tööruumid/artefaktid | vastuvõtulaud + `receiverChecklist`/`receiverNote`/`nextContactOn` PATCH-workflow; `AgentArtifact` DRAFT/FINAL (STAR_HELPER, CASE_SUMMARY, CASE_BRIEF, PRE_ASSESSMENT_SUMMARY, CHECKLIST jt tüübid); `DocumentKind` PG-enum 8 väärtusega |
| Teavitused | NotificationEvent + reconciler (olekuskaneering, 7 allikat) + delivery + **toodangu 5-min timer** [SERVER, K1-U1 tõend]; loojaid täpselt üks (`createNotificationEvent` reconcilerist); lisaks otsekirjade rada (sisuta saabumiskiri, kutsekirjad) |

Kinnitus: käesoleva analüüsi käigus rakenduskoodi, Prisma skeemi, migratsioone ega testifaile ei muudetud; ühtegi serverit ega välist teenust ei käivitatud; tootmisandmeid ei loetud; commit'e, push'e, merge'e ega deploy'sid ei tehtud. Loodi ainult see dokument ja uuendati kahte registrifaili (ptk 12 järel loetletud).

Märgised: `[MAIN]` = origin/main+server; `[BRANCH]` = ainult harul; `[VISION]`/`[DOC]` = ainult analüüsides; `[DECISION]` = tooteomaniku otsus.

## 1. Kasutajad ja olukorrad

### 1.1. Kuus põhiolukorda

Põhikasutaja on SOCIAL_WORKER (KOV sotsiaaltöötaja, lastekaitse, outreach-töötaja). SERVICE_PROVIDER (nt koduteenuse osutaja, tugiisik) saab sama kesta kasutada, kui tal on külastusega seotud tööruum (nt eelpöördumine või abivahenduse ruum). CLIENT-rollil välitöökesta EI OLE — see on professionaalse töö pind.

| # | Olukord | Keskkond ja seade | Ühendus | Eripära ja risk |
|---|---|---|---|---|
| S1 | **Kodukülastus** | kliendi kodu; telefon käes, sageli üks käsi vaba (uks, trepp, laps süles) | muutlik; paneelmaja trepikojas/keldris sageli puudub | kolmandad isikud ruumis (pereliikmed, sh lapsed); pealtvaatamise risk ekraanil; töötaja turvarisk üksi võõras kodus |
| S2 | **Outreach-töö** | tänav, varjupaik, jaam, telklaager; seistes/liikudes | juhuslik | kontakt võib olla nimetu või poolnimeline; kiirus ja madal lävi on kriitilised; dokumenteerimine ei tohi kontakti ära ehmatada |
| S3 | **Kohtumine teenusekohas** | teise asutuse ruum (kool, haigla, varjupaik, teenuseosutaja) | tavaliselt olemas, aga võõras võrk | võõras WiFi ei ole usaldusväärne kanal (HTTPS kaitseb sisu, aga captive-portal'id katkestavad); vaja kiirviiteid teenuse infole |
| S4 | **Töö nõrga või puuduva internetiga** | maapiirkond, saared, keldrikorrus, hooldekodu paks sein | pikalt puudub või 2G-tasemel | kogu külastuse voog peab töötama ilma ühegi võrgupäringuta; sünkroonimine toimub hiljem; „laeb igavesti" seisund on keelatud |
| S5 | **Kiire märge liikumise ajal** | auto (parkides!), buss, kahe ukse vahel | suvaline | üks mõte tuleb kirja saada <30 sekundiga; hääl on kiireim sisend; kontekst (mis külastuse juurde) peab olema 1 puutega valitav |
| S6 | **Hilisem järeltöö arvutis** | kontor/kodukontor, suur ekraan | olemas | mobiilis kogutu peab olema töölaual SAMA külastuse all: korrastamine, transkribeerimine, üleandmine tööruumi ja järgmine samm tehakse mugavalt suurel ekraanil |

### 1.2. Enne — ajal — pärast (rollijaotus ajas)

| Faas | Töötaja teeb | Kus ja mis seadmel | Võrk |
|---|---|---|---|
| **Enne külastust** | valib tööruumi (nt saabunud eelpöördumine), loob külastuse, sõnastab eesmärgi, paneb kokku minimaalse külastuspaketi (võtmeküsimused, eelmise kontakti kokkuvõte, kaasavõetavad dokumendid ükshaaval), seab soovi korral turvasignaali kontrollakna, võtab paketi seadmesse | arvuti VÕI telefon; ettevalmistus on täisfunktsionaalne mõlemal | NÕUTAV (paketi koostamine ja seadmesse võtmine vajab serverit; see on teadlik piir — vt 3.1 p6) |
| **Külastuse ajal** | avab külastuse mini-ruumi, kinnitab soovi korral saabumise, teeb kiirmärkmeid (tekst/hääl/foto) päritolumärgisega, märgib nõusolekud, vaatab paketti (küsimused, checklist), kinnitab lahkumise | telefon, üks käsi | EI OLE NÕUTAV — kõik salvestub seadmesse |
| **Pärast külastust** | näeb sünkroonimisolekut, kontrollib iga üksuse enne saatmist, saadab, transkribeerib/OCR-ib kasutaja käsul, korrastab märkmed (fakt vs tõlgendus), annab materjali üle tööruumi, loob järgmise sammu, sulgeb külastuse, eemaldab kohalikud koopiad | telefon VÕI arvuti (S6) | NÕUTAV saatmiseks ja üleandmiseks; korrastada saab ka offline |

### 1.3. Mis on juba olemas ja mis puudub (kesta ausus)

Kest EI alusta nullist: ettevalmistuse andmed (vastuvõtulaud, checklist, nextContactOn), heli→transkript→kokkuvõte rada, dikteerimine, artefaktid, continuity ja teavituskonveier on [MAIN]. **Täielikult puudu on kolm asja: (1) offline-kiht (SW on no-op, IndexedDB-d ei kasutata), (2) fotode tugi (ühtegi pildi-MIME-i ei aktsepteerita), (3) külastuse kandja (field-domeeni koodi pole).** FIELD-V1 ehitab need kolm ja ühendab ülejäänu — see on kest, mitte uus andmesüsteem.

## 2. Üks terviklik põhiteekond

### 2.1. Põhiteekond algusest lõpuni (normatiivne V1)

Esimene vertikaal on eelpöördumisega seotud kodukülastus (S1); sama voog katab S2–S6 väiksemate variatsioonidega (standalone-külastus ilma eelpöördumiseta — O-FD-7).

1. **Ettevalmistus tööruumist.** Vastuvõtulaual avatud eelpöördumise juures (või `/valitoo` avalehel) valib töötaja „Valmista külastus ette". Tekib külastus (`FieldVisit` DRAFT): eesmärk (vabatekst), seotud eelpöördumine (valikuline viide, mitte koopia), planeeritud ajaaken, koht töötaja käsitsi sisestatud tekstina (mitte geokoordinaat — 4.7/O-FD-9).
2. **Minimaalse paketi kokkupanek.** Töötaja valib, mida seadmesse võtta: võtmeküsimused (ise kirjutatud või checklistist), **eelmise kontakti kokkuvõte töötaja enda valitud külmutatud tekstina** (mitte automaatne andmeväljavõte), kaasavõetavad dokumendid ÜKSHAAVAL märgituna (vaikimisi 0). UI näitab enne kinnitust täpselt, MIS seadmesse läheb — sama ausus, mis eelpöördumise DOWNLOADED-mustril [MAIN].
3. **Turvasignaali seadistus (valikuline, O-FD-3 järgi).** Töötaja määrab kontrollakna tähtaja ja usalduskontakti; relvastus kinnitatakse serveris (võrgus!) — ptk 6.
4. **„Võta seadmesse".** Pakett salvestub seadme krüptitud kohalikku hoidlasse (4.3); server märgib paketi väljastatuks (koopia-ausus: paketi allika muutus serveris → seade näeb järgmisel võrgukontaktil märget „pakett on aegunud, värskenda").
5. **Offline-režiimi sisenemine.** Kest töötab edasi ilma ühegi võrgupäringuta; püsiv ühenduseoleku riba ütleb seisu ausalt („Võrguta — kõik salvestub sellesse seadmesse").
6. **Saabumise kinnitus (valikuline).** Üks puude; salvestub lokaalselt; jõuab serverisse alles sünkroonimisel (turvasignaali aja-aritmeetika arvestab seda — ptk 6).
7. **Kogumine külastuse ajal.** Kiirmärge (tekst või dikteeritud heli-mustand), foto (dokumendist/keskkonnast), checklisti täitmine. **Iga sisuline märge kannab päritolumärgist sisestamisel** (CASEWORK 2.3 kaheksane sõnastik; välitöö miinimum: KLIENDI_ÖELDUD / TÖÖTAJA_TÄHELEPANEK / TÖÖTAJA_TÕLGENDUS / AI_MUSTAND / DOKUMENDIST) — kaks puudet, vaikimisi TÖÖTAJA_TÄHELEPANEK.
8. **Nõusoleku küsimine ja talletamine.** Heli salvestamine kliendi juuresolekul ja dokumendi/keskkonna pildistamine nõuavad enne alustamist nõusolekuvälja täitmist (kellelt, mille jaoks, suuline/kirjalik) — kirje on osa külastusest ja sünkroonitakse koos sisuga (4.9).
9. **Kohalik mustand.** Iga üksus (märge, foto, heli, kinnitus) salvestub kohe kohalikku hoidlasse olekuga `DEVICE_ONLY`; „Salvesta" nuppu ei ole — kadumine on arhitektuuriliselt välistatud, mitte kasutaja distsipliini küsimus.
10. **Lahkumise kinnitus (valikuline; turvasignaali korral oodatud).** Salvestub lokaalselt; UI ütleb ausalt, kui kinnitus EI OLE veel serverisse jõudnud (ptk 6).
11. **Ühenduse taastumine.** Riba muutub („Võrk taastus — N üksust ootab saatmist"); midagi ei lähe üles automaatselt peale külastuse enda oleku-/kinnitusmarkerite (saabumine/lahkumine/turvasignaal — need on kasutaja juba tehtud teadlikud toimingud ja lähevad kohe).
12. **Kasutaja kontroll enne üleslaadimist.** „Kontrolli enne saatmist" vaade: iga üksus eraldi — eelvaade, päritolu parandus, eemaldamine, jätmine seadmesse. Saatmine on üksuse- või koondkinnitusega. See on värav, mitte formaalsus: siin püütakse kinni kogemata salvestatud heli, vale foto, kolmanda isiku liigne info.
13. **Sünkroonimine.** Üksused liiguvad olekumasinat mööda (ptk 3): `QUEUED → UPLOADING → SYNCED`; failid muutuvad `UserDocument`-ideks (fotod uue kind'iga, heli olemasoleva rajaga), märkmed külastuse kirjeteks. Konfliktid ja tõrked jäävad nähtavaks, mitte vaikseks.
14. **Konfliktide ja duplikaatide lahendamine.** Sama üksuse kahes seadmes muutmine → `CONFLICT`, kasutaja valib versiooni (mõlemad säilivad revisjonidena kuni valikuni); duplikaadid on idempotentsusvõtmega välistatud (3.3).
15. **Järeltöö ja transkriptsioon.** Sünkroonitud heli-mustandi saab kasutaja käsul transkribeerida (olemasolev `/transcribe` rada); foto saab kasutaja käsul OCR-ida (uus serverirada, ptk 5); mõlema väljund on AI_MUSTAND-päritoluga kontrollimata mustand, kuni töötaja kinnitab.
16. **Üleandmine olemasolevasse tööruumi.** „Anna üle" viib valitud sihtkohta: (a) seotud eelpöördumise vastuvõtja töövoog — receiverNote'i täiendus ja `nextContactOn` OLEMASOLEVA workflow-PATCH-iga [MAIN]; (b) külastuse kokkuvõtte mustand `AgentArtifact` DRAFT-ina (CASE_SUMMARY tüüp [MAIN]), mille sisu koostatakse märkmetest päritolumärgistega (AI-abi valikuline, ainult võrgus); (c) failid on juba `UserDocument`-id ja seotakse külastuse kaudu. Üleandmine EI kopeeri külastust juhtumiks ega loo uut registrit — see täiendab olemasolevaid kandjaid.
17. **Järgmine samm.** `nextContactOn` uuendus (olemasolev K6 muster) või uue külastuse loomine; continuity kuvab selle töölaual [MAIN mustri laiendus].
18. **Kohalike koopiate turvaline eemaldamine.** Pärast üleandmist pakub kest „Eemalda sellest seadmest" (üksuse- või külastusepõhine); automaatne kustutus toimub hiljemalt vaikimisi tähtajal (4.5). Serveris midagi ei kustu — seade tühjeneb, tööruum jääb.

### 2.2. Katkestus-, tühistus-, aegumis- ja taastumisrajad

| Rada | Käitumine |
|---|---|
| Aku saab tühjaks / rakendus tapetakse keset märget | iga sisestus on juba kohalikus hoidlas (samm 9); taasavamisel avaneb sama külastus samas faasis; pooleli tekstiväli taastub viimase vahesalvestuse seisuga (autosave ≤2 s sammuga) |
| Rakendus suletakse sünkroonimise ajal | sünkimootori päevik (journal) kohalikus hoidlas; taasavamisel reconcile: iga `UPLOADING` üksus kontrollitakse serverist `clientItemId` järgi — kohale jõudnud → `SYNCED`, muidu tagasi `QUEUED`; duplikaate ei teki, sest server on idempotentne (3.3) |
| Sessioon aegub külastuse ajal (offline) | kohalik töö JÄTKUB (hoidla ei sõltu sessioonist); sünkroonimine nõuab sisselogimist — üksused jäävad `QUEUED` olekusse märkega „vajab sisselogimist"; andmed EI kao ega kustu |
| Külastus jääb ära | „Tühista külastus" → külastus `CANCELLED`; kogumata pakett eemaldatakse seadmest; juba tehtud märkmed küsivad: saada ikkagi (nt telefonikõne asendas külastust) või kustuta |
| Klient keeldub külastusest/salvestamisest | keeldumine on legitiimne faktimärge (TÖÖTAJA_TÄHELEPANEK); heli-/fotonõusoleku puudumisel vastavad sisendid lihtsalt ei avane — tekst ja checklist töötavad alati |
| Ühendus ei taastu N päeva | üksused püsivad seadmes (`DEVICE_ONLY`/`QUEUED`) kuni kohaliku säilituspiirini (4.5); enne automaatset kustutust kuvatakse selge hoiatus; FAILED/DEVICE_ONLY üksusi EI kustutata vaikselt |
| Töötaja unustab lahkumiskinnituse (turvasignaal relvastatud) | serveripoolne kontrollaken eskaleerub ausalt (ptk 6); hilinenud kinnitus saadab kontaktile „lahenenud" järelteate; töötaja näeb, et signaal läks välja |
| Seade kaob külastuse järel | serveris: sessiooni invalideerimine (olemasolev auth-rada) → seadme API-ligipääs sureb; seadmes: krüptitud minimaalne sisu + kohalik aegumine (4.4); kaug-kustutust EI lubata, sest PWA-s pole see tehniliselt garanteeritav — lubadus oleks vale |
| Paketi allikas muutub serveris (nt eelpöördumine arhiveeritakse) | seade saab järgmisel võrgukontaktil märke „pakett aegunud"; kogutud märkmed jäävad kehtima (need on külastuse, mitte paketi omad); üleandmisel kontrollitakse sihtkoha olek uuesti — kadunud sihtkoht → üleandmine teise kohta või ainult külastuse alla |
| Üleandmine katkeb poole pealt | üleandmine on serveris üks tehing sihtkoha kohta (workflow-PATCH; artefakti create) — kas õnnestub tervikuna või jääb tegemata ja on korratav; poolikuid „pooleldi üle antud" seise ei eksisteeri |

## 3. Offline- ja sünkroonimisleping

### 3.1. Aluspõhimõtted (normatiivsed)

1. **Server on tõde, seade on ülekandepuhver ja töömustand.** Ükski seadmes olev üksus ei ole „ainueksemplar" kauem kui sünkroonimiseni; kest ei ehita seadmesse teist andmebaasi, mille skeem elab oma elu.
2. **Taustatööd EI eeldata.** Kogu sünkroonimine toimub avatud rakenduses nähtava olekuga. Background Sync API-le ei toetuta (iOS Safari's puudub; Chrome'is best-effort); push-teavitusi V1 ei kasuta. Kui rakendus on kinni, ei toimu midagi — ja UI ei väida vastupidist.
3. **Üksusepõhisus.** Sünkroonimise ühik on üksus (külastuse meta, märge, fail, kinnitus, nõusolekukirje), mitte „kogu külastus" — osaline õnnestumine on normaalne seis, mida UI näitab üksuste kaupa.
4. **Kasutajakontroll.** Sisu-üksused (märkmed, failid) lähevad üles AINULT pärast „Kontrolli enne saatmist" kinnitust. Erand: külastuse olekumarkerid ja turvasignaali kinnitused — need on kasutaja juba tehtud teadlikud toimingud, mis saadetakse esimesel võimalusel (kasutaja ohutus > review-tseremoonia).
5. **Nähtav ausus.** Iga üksuse olek on kasutajale nähtav; „saadetud" tähendab serveri kinnitust, mitte katse algust; tõrge on nähtav seis, mitte vaikne kadu.
6. **Ettevalmistus on võrgutoiming.** Paketi koostamine ja seadmesse võtmine nõuavad serverit (õiguste ja värskuse kontroll toimub laadimishetkel). „Lähen kohe ukse taha ja mul pole midagi kaasas" olukorras töötab kest tühja külastusega (standalone, O-FD-7) — kogumine ei nõua kunagi võrku, ainult ettevalmistuspakett nõuab.

### 3.2. Üksuse olekumasin (kohalik + serveripoolne vaade)

Olekud on rakenduskihi konstandid (mitte PG-enum). Kohalik hoidla kannab üksuse kohta: `clientItemId` (seadmes genereeritud cuid — idempotentsuse juur), `visitId`, `revision` (kasvav täisarv), olek, sisu, loomis-/muutmisajad, viimase katse aeg ja tõrkekood.

| Olek (ülesande sõnastus) | Konstant | Tähendus | Sisenemine | Väljumine |
|---|---|---|---|---|
| ainult seadmes | `DEVICE_ONLY` | loodud/muudetud; kasutaja pole saatmist kinnitanud | iga sisestus | kasutaja kinnitab review's → `QUEUED`; kasutaja kustutab → `REMOVED` |
| salvestamist ootav | `QUEUED` | saatmiseks kinnitatud, ootab võrku/järjekorda | review-kinnitus; reconcile | võrk olemas → `UPLOADING`; kasutaja tühistab → `CANCELLED` |
| sünkroonimisel | `UPLOADING` | päring on teel; failidel koos edenemisprotsendiga | sünkimootor | serveri 2xx → `SYNCED`; viga → `QUEUED` (retry) või `FAILED`; konfliktivastus → `CONFLICT` |
| sünkroonitud | `SYNCED` | server kinnitas; serveri ID teada | serveri vastus | kohalik koopia → `PURGE_PENDING` (kasutaja käsul või tähtajal) |
| konflikt | `CONFLICT` | serveris on sama üksuse uuem/lahknev revisjon (teine seade) | serveri 409 + revisjonivõrdlus | kasutaja valib versiooni → `QUEUED` (valitud revisjon) / `SYNCED` (serveri oma jääb) |
| ebaõnnestunud | `FAILED` | automaatsete katsete piir täis või püsiv viga (4xx v.a 401/403/409) | retry-piir | kasutaja „proovi uuesti" → `QUEUED`; kasutaja kustutab → `REMOVED` |
| kasutaja tühistatud | `CANCELLED` | kasutaja võttis saatmise tagasi enne serverisse jõudmist | kasutaja toiming | uuesti saatmine → `QUEUED`; kustutus → `REMOVED` |
| kustutamist ootav | `PURGE_PENDING` | sünkroonitud sisu kohalik koopia ootab turvalist eemaldamist | üleandmine/kasutaja käsk/tähtaeg | kustutus tehtud → `REMOVED` |
| seadmest eemaldatud | `REMOVED` | kohalik koopia kustutatud (kirje võib jääda õhukese olekureana kuni külastuse sulgemiseni) | purge | terminaalne (seadmes) |

Erireegel `SYNCED`-järgsele muutmisele: sünkroonitud üksuse muutmine loob uue revisjoni, mis läheb uuesti `DEVICE_ONLY → QUEUED` rajale sama `clientItemId` ja `revision+1`-ga; server hoiab revisjoniajalugu külastuse eluea jooksul (mitte igavesti — retention O-FD-1).

### 3.3. Sünkroonimisreeglid (ülesande punktid ükshaaval)

| Nõue | Leping |
|---|---|
| **Idempotentsus** | serveri kirjutusrajad on PUT-semantikaga: `PUT /api/field/visits/[id]/items/[clientItemId]` koos `revision`-iga; DB unikaalsus `(visitId, clientItemId)`; sama päringu kordus (katkenud vastus, topeltklõps, reconcile) tagastab olemasoleva kirje `200 existing`, mitte duplikaadi. Failidel lisaks sisu SHA-256: sama sisu kordussaatmine seob olemasoleva failiga |
| **Korduskatsete piir** | automaatselt max 5 katset üksuse kohta backoff'iga 5 s → 5 min (ainult avatud rakenduses); seejärel `FAILED` + käsitsi „proovi uuesti". Lõputut vaikset retry-tsüklit ei ole — see põletaks akut ja varjaks tõrget |
| **Duplikaatide vältimine** | `clientItemId` unikaalsus + failide sisu-SHA + reconcile-kontroll enne kordussaatmist (`GET items?clientItemIds=…`). Kahe seadme SAMA külastuse alla loodud eri üksused ei ole duplikaadid — need on eri `clientItemId`-dega legitiimsed kirjed |
| **Osaliselt üles laaditud fail** | server kirjutab failid atomaarselt (temp → commit; FAILID-A0 P2.1 muster on kohustuslik juba V1-s, mitte hilisem parandus): poolik upload EI muutu kunagi `UserDocument`-iks ega jää nähtavaks; katkestus → uus katse saadab faili algusest (V1 failipiirid: foto ≤ ~4 MB pärast seadmes kompressiooni, heli ≤ 25 MB nagu olemasolev audio-source — chunk-upload'i V1 EI ehita); serveri temp-failid koristatakse loomisaja järgi |
| **Kahe seadme konflikt** | üksusel on `revision`; kui server saab revisjoni, mis ei ole `serveri_revision+1`, salvestab ta saabunu KÕRVALREVISJONINA ja vastab 409 → üksus `CONFLICT`; kasutaja valib säiliva versiooni (mõlemad on vaadatavad); midagi ei kirjutata vaikselt üle ega kaotata. Külastuse meta (staatus, ajad) kasutab CAS-i (`version` Int — Kovisiooni muster) — hilisem kirjutus kaotab 409-ga, mitte vaikse võiduga |
| **Aegunud õigused** | 401 → sünk peatub, üksused jäävad `QUEUED` „vajab sisselogimist" märkega; kohalik hoidla EI kustu. 403/404 sihtkohal (nt eelpöördumine kadus/õigus võeti) → üksus jääb külastuse alla ja sünkroonitakse SINNA; ainult üleandmine sihtkohta ebaõnnestub nähtava selgitusega. Ligipääsu re-verify toimub igal sünkil serveri poolel (omaniku-skoobitud päringud, võõral 404 — FAILID K8 room-share muster) |
| **Välja logimine** | teadlik logout pooleli mustanditega → hoiatus + kolm valikut: (a) saada enne ära (kui võrk on), (b) jäta seadmesse lukustatult (hoidla partitsioon jääb, avaneb sama konto sisselogimisel), (c) kustuta seadmest. Vaikevalik (b); lukustatud partitsioon aegub kohaliku säilituspiiriga (4.5) — vaikne igavene jääk on välistatud |
| **Konto või seadme vahetus** | kohalik hoidla on partitsioneeritud `userId` järgi ja krüptitud (4.3): teise kontoga sisselogimine EI näe eelmise konto üksusi; uus seade alustab tühjalt (server on tõde — sünkroonitud külastused laetakse serverist, `DEVICE_ONLY` üksused elavad ainult oma seadmes ja see öeldakse kasutajale välja); vana seadme partitsioon kustub aegumisega või käsitsi |
| **Rakenduse sulgemine sünkroonimise ajal** | journal + reconcile (2.2 tabel); `UPLOADING` ei ole usaldusseis — taasavamisel kontrollitakse serverist tegelik tulemus. Brauser ei tööta taustal — see on disaini eeldus, mitte tõrge |

### 3.4. Külastuse serveripoolne elutsükkel (K1 kaardistus)

`FieldVisit` on K1 mini-tööruum kind'iga `field_visit` (K1-P0 registris JUBA RESERVED [BRANCH]). Faasid on toetavad, mitte sundivad (K1 4.2.2); ükski faas ei vahetu taimeriga.

| Külastuse olek | K1 lifecycle | Tähendus |
|---|---|---|
| DRAFT | DRAFT | loodud, pakett koostamisel |
| PLANNED | ACTIVE (phase `prep`) | pakett seadmes, külastus ees |
| IN_PROGRESS | ACTIVE (phase `on_site`) | saabumine kinnitatud VÕI esimene märge tehtud |
| WRAP_UP | ACTIVE (phase `follow_up`) | kogumine lõppenud, järeltöö/üleandmine pooleli |
| CLOSED | CLOSED | töötaja sulges; üleandmised tehtud; kirjutuskaitse |
| CANCELLED | CLOSED (cancel-lipuga) | ära jäänud; auditijälg säilib |

Descriptor (K1 4.1): `goal` = külastuse eesmärk; `nextAction` = järgmine samm/`nextContactOn`; `visibility` = PRIVATE (külastus on töötaja privaatne tööruum — osalejaid EI OLE; kohtumise mitmepoolne kiht on T20 COLLAB, mitte FIELD). Adapter `listFieldVisits(userId)` on FIELD-V1 tingimuslik etapp (kui K1-P0 on merge'itud — sama muster nagu ESTA-MENTOR E6).

## 4. Andmed ja privaatsus

### 4.1. Mida tohib offline-seadmesse võtta (külastuspaketi whitelist)

Ainult järgnev, ja ainult kasutaja nähtava kinnitusega („Seadmesse läheb: …"):

1. külastuse enda väljad (eesmärk, ajaaken, töötaja sisestatud kohatekst, checklist, võtmeküsimused);
2. töötaja VALITUD külmutatud eelmise kontakti kokkuvõte (tekst, mille töötaja ise ette valmistas — mitte automaatne andmeväljavõte eelpöördumisest);
3. ükshaaval märgitud dokumendid (vaikimisi 0; iga dokument eraldi valikuga; suurus kuvatakse);
4. turvasignaali seadistus (tähtaeg, kontakti nimi — ilma kontakti e-postita: see elab ainult serveris, sest signaali saadab server);
5. töötaja enda külastusel loodud üksused (märkmed, failid, kinnitused, nõusolekukirjed).

### 4.2. Mida EI panda kunagi automaatselt vahemällu

- eelpöördumiste/klientide LOENDID ja teiste klientide andmed — seadmes on alati ainult käesoleva külastuse pakett;
- vestlusajalugu, RAG-vastused ja teadmusbaasi sisu;
- Teekonna sisu (K1-U1 11.3 p4 keeld kehtib ka kohalikule hoidlale);
- dokumentide sisu ilma punkti 4.1(3) teadliku valikuta;
- API-vastused HTTP-vahemälus (4.10);
- autentimissaladused väljaspool olemasolevat httpOnly-sessiooniküpsist (kohalik hoidla EI hoia tokeneid).

### 4.3. Kohaliku salvestuse kaitse

- Hoidla: IndexedDB, partitsioneeritud `userId` järgi; kirjete sisu (märkmete tekst, failiblobid, nõusolekuväljad) krüptitakse WebCrypto AES-GCM-iga; võti on mitte-eksporditav (`extractable:false`) `CryptoKey` samas IndexedDB-s.
- **Aus piir:** selline krüpteerimine kaitseb juhusliku failisüsteemi-ligipääsu ja „laenatud seadme sirvimise" eest, MITTE täieliku seadmekompromissi eest — esmane kaitse on OS-i ekraanilukk + sisu miinimum + lühike eluiga. Seda öeldakse ka kasutusjuhendis, mitte ei lubata „krüpteeritud = turvaline".
- O-FD-2 [BLOKEERIV] otsustab, kas V1 piloodile piisab miinimumist (võti + OS-lukk + auto-purge) või nõutakse rakendusetaseme PIN-lukku (võti mähitakse PIN-ist tuletatud võtmega; platvormil on PIN-mõiste juba olemas — `/uuenda-pin` [MAIN]).
- `localStorage`-i tundlikku sisu EI panda kunagi (praegune kasutus on UI-eelistused — see jääb nii).

### 4.4. Jagatud või kadunud seade, ekraanilukk, väljalogimine

- Jagatud seade (nt asutuse valvetelefon): partitsioon per konto + logout-valikud (3.3) + soovitus mitte kasutada jagatud seadet välitööks (juhend); rakenduselukk (O-FD-2) on jagatud seadme ainus päris kaitse.
- Kadunud seade: (1) kasutaja/admin invalideerib sessiooni serveris → API-ligipääs sureb; (2) kohalik sisu aegub automaatselt (4.5); (3) kaugkustutust EI lubata — PWA ei saa seda garanteerida ja valelubadus oleks turvarisk; (4) juhend ütleb: teata kadunud seadmest nagu töövahendi kaotusest.
- Ekraanilukk: kest lukustub koos seadmega (OS); rakenduse naasmine EI nõua V1-s uut sisselogimist offline'is (see teeks kogumise võimatuks), rakenduselukk on O-FD-2 teema.
- Väljalogimine: 3.3 leping (kolm valikut, vaikimisi „jäta lukustatult", aegumisega).

### 4.5. Kohalik säilitusaeg ning automaatse ja käsitsi kustutamise piir

| Kohalik sisu | Automaatne kustutus (vaikeväärtus; O-FD-1 kinnitab) | Käsitsi |
|---|---|---|
| Külastuspakett (4.1 p1–4) | külastuse sulgemisel; hiljemalt 72 h pärast planeeritud ajaakent, kui külastust ei avatud; 7 p pärast loomist, kui külastus jäi DRAFT-i | „Eemalda pakett" igal ajal |
| `SYNCED` üksuste kohalikud koopiad | 7 p pärast üleandmist/sulgemist (`PURGE_PENDING` → `REMOVED`) | „Eemalda sellest seadmest" kohe |
| `DEVICE_ONLY`/`QUEUED`/`FAILED` üksused (server pole näinud!) | **EI kustutata vaikselt.** 30 p möödumisel kuvatakse püsiv hoiatus + kustutus toimub alles 37. päeval pärast kolme selget hoiatust | kasutaja kustutab teadlikult; kustutus nõuab kinnitust „seda pole serverisse saadetud" |
| Lukustatud partitsioon (logout/kontovahetus) | 30 p | sama konto sisselogimine avab; „kustuta kõik kohalikud andmed" seadetes |

Automaatse ja käsitsi kustutuse piir: automaatika tohib kustutada ainult seda, mille koopia on serveris VÕI mille tähtaeg + hoiatused on ammendatud; kasutaja käsitsi kustutus võib kõike, aga sünkimata sisu puhul alati eksplitsiitse hoiatusega. Serveripoolsed säilitusajad on O-FD-1 maatriks (vaikevalikud ptk 10).

### 4.6. Logide ja veateadete privaatsus

- Kliendipoolne sünkipäevik hoiab ainult üksuse ID-sid, olekuid, aegu ja tõrkekoode — MITTE sisu.
- Serveri logid: `safeError` [MAIN] jääb; välitöö rajad ei logi märkmesisu, kohateksti, failinimesid (FAILID F-13 õppetund: failinimi on PII kandja — välitöö failid saavad serveris UUID-nime ja kasutaja antud pealkiri elab ainult DB-väljal) ega nõusolekuväljade sisu.
- Veateated kasutajale on üldistatud ega peegelda serveri siseolekut; 404/403 leket ei tohi tekkida (owner-404 muster).
- `DataAuditLog` kirjed (turvasignaal, purge, üleandmine) kannavad ainult tehnilisi välju (ID-d, ajad, loendurid).

### 4.7. Kolmandate isikute andmed

Kodukülastus on paratamatult kolmandate isikute keskkond (pereliikmed, sh lapsed). Leping (CASEWORK ptk 5 rakendus välitööle):

- kolmanda isiku info märkmes on lubatud reaalsus vabatekstina + päritolumärgisega; struktureeritud püsikirjeid kolmandate isikute kohta FIELD EI loo (see on COLLAB-P5/O-CW-7 taga);
- märkmed, mis sisaldavad kolmanda isiku infot, EI kopeeru artefaktidesse/üleandmisse vaikimisi — „Kontrolli enne saatmist" ja üleandmise koostevaade on kohad, kus töötaja selle teadlikult otsustab;
- fotol ei tohi vaikimisi olla inimesi — foto eesmärk on dokument/keskkond (O-FD-4); UI ütleb seda pildistamisel;
- asukoht: kliendi aadress on kliendi isikuandmed — seadmes elab see ainult paketi kohatekstina ja kustub paketiga; **geolokatsiooni API-t V1 ei kasuta üldse** (O-FD-9 vaikevalik): „ava juhis" avab välise kaardirakenduse töötaja sisestatud aadressitekstiga, ilma et platvorm seadme asukohta loeks või salvestaks. Taustal asukohajälgimine on arhitektuuriline keeld (RUUM-VIS ptk 7) — mitte seadistus.

### 4.8. Kandjapõhised säilitusreeglid (foto, heli, transkript, OCR)

| Kandja | Serveris | Vaike-retention serveris (O-FD-1 kinnitab) | Seadmes |
|---|---|---|---|
| Foto | `UserDocument` uue kind'iga `FIELD_PHOTO` (DocumentKind on olemasolev PG-enum; additiivne laiendus — sama muster, millega TRANSCRIPT_SUMMARY omal ajal lisandus) | 90 p `updatedAt` sweep nagu muu UserDocument; üleandmata foto = külastuse sulgemisel ülevaatus („kustuta või seo") | 4.5 tabel |
| Heli-mustand (offline-dikteering) | `UserDocument` kind `UPLOADED_AUDIO_SOURCE` (OLEMASOLEV rada; `agentAllowed=false` vaikimisi jääb) | toorheli kustub kasutaja kinnitatud transkripti järel kohe VÕI 7 p pärast transkribeerimist (vaikevalik; RUUM-VIS ptk 7 „toorheli EI säilitata vaikimisi") | pärast `SYNCED` → `PURGE_PENDING` kohe (heli on seadmes kõige tundlikum ja suurim üksus) |
| Transkript | olemasolev `AUDIO_TRANSCRIPT` rada [MAIN] | olemasolev 90 p klass | transkript tekib serveris; seadmesse tuleb ainult vaatamiseks (ei ladustata püsivalt) |
| OCR-tekst | märkme kirje (AI_MUSTAND päritoluga), mitte eraldi failikandja | märkmete klass (90 p pärast sulgemist) | nagu märge |
| Märkmed | `FieldVisitNote` read külastuse all | 90 p pärast külastuse CLOSED/CANCELLED (vaikevalik O-FD-1) | 4.5 tabel |

### 4.9. Nõusolek ja selle tagasivõtmine

- Nõusolek on külastuse kirje: kellelt (roll/nimi töötaja sõnastuses), mille jaoks (heli / foto / dokumendi pildistamine), vorm (suuline/kirjalik), aeg. Heli- ja fotosisend ei avane enne vastava nõusolekukirje täitmist (v.a dokument, mille kohta töötaja märgib „kliendi dokument, kliendi palvel").
- Tagasivõtmine ENNE sünki: üksus kustub seadmest jäljetult (server pole seda näinud) + nõusolekukirje saab „tagasi võetud" märke.
- Tagasivõtmine PÄRAST sünki: kasutaja algatab kustutuse; heli/foto kustutusrada on olemasolev dokumendikustutus + külastuse kirje märge. FAILID F-01 õppetund on siduv: **tagasivõtt peab jõustuma tehniliselt, mitte ainult olekuväljana** — FIELD-i eelis on, et siin pole striimivat egressi: fail kas kustub või kustutus on nähtav tõrge, mitte vaikne jääk (FAILID F-07 klassi viga ei tohi korduda: kustutuse vastus ütleb ausalt, kui fail/vektor jäi, ja jätab retry-töö).
- Nõusolekukirjed säilivad külastuse auditiosana ka sisu kustutamise järel (audit_long klass — K1-U1 7.4 consent-perekonna muster).

### 4.10. Service workeri leping (normatiivne, absoluutne)

1. SW precache'ib AINULT staatilise rakenduskesta (välitöö route'ide JS/CSS/ikoonid/fondid) versioonitud manifestiga.
2. **SW EI cache'i ÜHTEGI `/api/` vastust** — ei vaikimisi ega „mugavuse" pärast; kõik andmed liiguvad rakendusekihi kaudu kohalikku krüptitud hoidlasse (4.3). Praegune no-op `sw.js` tähendab, et ühtegi halba harjumust pole vaja lammutada — leping kehtestatakse esimesest realist.
3. Navigatsioonipäringule, mis offline'is ebaõnnestub, vastab SW välitöö offline-kestaga (mitte üldise „oled võrguta" leheküljega, kui sihtroute on välitöö oma; muud route'id saavad lihtsa offline-teate).
4. SW uuendus: uus versioon aktiveerub alles siis, kui ükski sünk ei ole pooleli; kasutaja näeb „värskenda" viiba (mitte keset tööd vahetuvat kesta).
5. SW ei tee taustal fetch'e, ei hoia andmeid ega saada midagi — ta on kest, mitte andmekanal.

## 5. Kaamera, heli ja OCR

Läbiv reegel (normatiivne): **STT, OCR ja igasugune AI-väljund on kontrollimata mustand (`AI_MUSTAND` päritolu), kuni kasutaja on selle üle vaadanud ja kinnitanud; kinnitamine EI kustuta AI-päritolu, vaid lisab kinnitusfakti** (CASEWORK 2.3: märgis ei „parane" automaatselt). Ükski sisendiliik ei ole ainus kasutustee — tekst ja checklist töötavad alati, kõigil seadmetel, ilma ühegi loata.

| Dimensioon | Foto (kaamera) | Heli-mustand (offline-dikteering) | Kohene dikteerimine (online) | OCR (fotost tekst) |
|---|---|---|---|---|
| Kasutaja eesmärk | dokumendi/olukorra jäädvustus (nt esitatud paberdokument, eluaseme seisukord) | mõte/vestluse kokkuvõte heli kujul, kui tippimine pole võimalik | kõne otse tekstiks märkmeväljale (olemasolev [MAIN] rada) | pildistatud dokumendi tekst märkmeks/analüüsiks |
| Nõusolek | nõusolekukirje enne avanemist (4.9); inimesi vaikimisi ei pildistata (O-FD-4) | nõusolekukirje, kui salvestus toimub kliendi juuresolekul; töötaja üksi dikteerimine nõusolekut ei vaja | sama | ei lisa uut nõusolekut (foto oma katab); OCR käivitub ainult kasutaja käsul |
| Eelvaade | foto eelvaade kohe; uuesti tegemise nupp | salvestuse kestus + taasesitus seadmes | transkript ilmub sisestusväljale enne saatmist (olemasolev kontrollitud režiim säilib) | pilt ja tuvastatud tekst kõrvuti (lokaalsed-mudelid 8.1 muster) |
| Parandamine | kärpimine V1-st väljas; halb foto → kustuta ja tee uus | ümbersalvestamine; osaline kärpimine V1-st väljas | tekst on vabalt redigeeritav | tekst on vabalt redigeeritav enne kinnitamist |
| Kinnitamine | „Kontrolli enne saatmist" väravas | sama + transkribeerimisotsus on eraldi kasutaja käsk | kasutaja saadab ise (ei muutu) | kasutaja kinnitab teksti → saab märkmeks |
| Päritolumärgistus | `DOKUMENDIST` (dokumendifoto) või `TÖÖTAJA_TÄHELEPANEK` (keskkond) | heli küljes olev märge kannab valitud päritolu; transkript = `AI_MUSTAND` | dikteeritud tekst = töötaja tekst (ta kontrollib enne saatmist); AI ei sekku | `AI_MUSTAND` + viide lähtefotole |
| Üleslaadimine | `FIELD_PHOTO` UserDocument atomaarse create'iga; kliendipoolne kompressioon (~≤4 MB, EXIF-metaandmed, sh GPS, EEMALDATAKSE enne salvestust seadmes) | `UPLOADED_AUDIO_SOURCE` olemasolev rada (25 MB piir) | — (tekst läheb märkme sees) | serveripäring sünkroonitud foto peale; tulemus tuleb mustandina tagasi |
| Säilitamine | 4.8 tabel | 4.8 tabel (toorheli lühiealine) | märkmete klass | märkmete klass |
| Eemaldamine | üksuse kustutus seadmes/serveris; nõusoleku tagasivõtu rada (4.9) | sama; transkript ja heli kustuvad eraldi otsustena (kasutajale selgelt) | märkme kustutus | teksti kustutus ei kustuta fotot (ja vastupidi öeldakse välja) |
| Alternatiivne kasutustee | kirjeldav tekstimärge | tekstimärge | tippimine | teksti käsitsi ümbertrükkimine; OCR on mugavus, mitte eeldus |

Tehnilised valikud (ptk 9 põhjendusega): foto võetakse `<input type="file" accept="image/*" capture="environment">` kaudu — töötab kõigis mobiilibrauserites ilma getUserMedia-loata ja annab OS-i kaamera-UI; heli kasutab OLEMASOLEVAT `useSpeech` MediaRecorder-mustrit, aga salvestab tulemuse kohalikku hoidlasse (mitte kohe `/api/stt`-sse); OCR on **serveripoolne** (Tesseract `est` rag-service'i kõrval või Node-workeris — lokaalsed-mudelid 8.1 kandidaat): seadmes-OCR (Tesseract.js ~15+ MB WASM+traineddata) lükatakse edasi, kuni serverivariandi kvaliteet on mõõdetud (O-FD-5). Offline'is OCR-i EI OLE — foto ootab võrku; see on aus piir, mitte viga.

## 6. Turvalisus ja välitöö turvasignaal

### 6.1. Kas FIELD-V1 vajab turvasignaali? — JAH, minimaalsel kujul

Analüüs: kodukülastus ja outreach on sotsiaaltöö kõrgeima isikliku riskiga olukorrad (Tööheaolu vägivallavorm loeb „üksi töötamise / kodukülastuse riski" juba täna riskiteguriks [MAIN]); RUUM-VIS ptk 7 nimetab töötaja turvalisuse välitöö osaks, mitte lisaks. Ilma selleta jääks kest „märkmikuks", mis ignoreerib välitöö kõige tõsisemat reaalsust. SAMAS peab V1 signaal olema aus selle kohta, mida brauseripõhine rakendus SUUDAB — seepärast valitakse **serveripoolne kontrollaken (dead-man's switch)**, mis töötab just siis, kui töötaja seade on võrguta.

### 6.2. Mudel: serveripoolne kontrollaken

1. **Relvastamine (ainult võrgus, enne külastust):** töötaja määrab tähtaja („kinnitan lahkumise hiljemalt 15:30") ja saaja; server kinnitab relvastuse. Külastust EI SAA relvastada offline — kest ütleb seda selgelt (vale kindlustunne oleks ohtlikum kui puuduv funktsioon).
2. **Kontroll:** teavituskonveieri olekuskaneering (olemasolev reconciler-muster + 5-min timer [MAIN]) leiab relvastatud külastused, mille tähtaeg on möödas ilma lahkumiskinnituseta serveris.
3. **Eskaleerimine:** server saadab saajale e-kirja (olemasolev mailer; TRANSACTIONAL-klass) + kirjutab `DataAuditLog` kirje. Enne päris eskaleerimist on armuaeg (vaikimisi 15 min) ja töötajale endale saadetakse meeldetuletus (in-app + e-kiri), kui ta on võrgus.
4. **Offline-aritmeetika ausus:** lahkumiskinnitus salvestub seadmes, aga LOEB alles serverisse jõudes. UI näitab relvastatud külastusel püsivalt: tähtaeg, kas kinnitus on serveris, ja teksti „kui sa enne tähtaega võrku ei saa, saab [kontakt] teate". Tähtaja soovitus arvutatakse varuga (külastuse ajaaken + puhver) ja pikendamine on üks puude (võrgus).
5. **Ekslik käivitamine / valehäire:** hilinenud kinnitus saadab saajale kohe „lahenenud — valehäire" järelteate; töötaja näeb ajajoonel, et signaal läks välja ja millal lahenes. Relvastuse saab enne tähtaega tühistada (võrgus) — tühistus on auditijäljega.

### 6.3. Saaja, sisu ja piirid

| Küsimus | Leping |
|---|---|
| Kes on saaja | O-FD-3 [BLOKEERIV]; soovitus: **töötaja enda määratud usalduskontakt** (kolleeg, juht, lähedane — e-posti aadress, mille töötaja ise sisestab ja mille õigsuse eest vastutab); asutuse valvenumbri/keskse korralduse variant tuleb alles organisatsioonikihiga (T25) — FIELD ei ehita org-mudelit |
| Minimaalne saadetav info | töötaja nimi; planeeritud ajaaken; fakt „lahkumiskinnitus puudub"; töötaja ENDA ette kirjutatud juhis saajale (nt „helista mulle numbril …; kui ei vasta, helista minu juhile / vajadusel 112"). Kliendi nime, aadressi ega külastuse sisu vaikimisi EI saadeta; töötaja võib juhisesse ise lisada, mida peab vajalikuks — see on tema teadlik tekst |
| Kuidas toimib ühenduseta | signaal EI sõltu töötaja seadmest: server eskaleerub kinnituse PUUDUMISE peale — see töötab just siis, kui seade on võrguta/katki/kadunud. Töötaja seade näitab ausalt, mis serverini on jõudnud (6.2 p4) |
| Kuidas näidatakse, et signaal ei jõudnud kohale | e-kirja saatmise tõrge kasutab olemasolevat delivery-retry't (claim-CAS + backoff [MAIN]); lõplik tõrge on töötajale nähtav külastuse ajajoonel („kontaktile ei õnnestunud teadet saata") — vaikselt ei kao midagi |
| Ekslik käivitamine | 6.2 p5: „lahenenud" järelteade + nähtav ajalugu + tühistusrada |
| Miks see EI OLE hädaabiteenuse asendus | kest ütleb seda relvastamisel ja juhendis eksplitsiitselt: signaal sõltub e-posti kättesaamisest ja inimese reageerimisest; platvorm ei helista 112, ei tea töötaja asukohta ega garanteeri reageerimisaega. Ohuolukorras helistab inimene ise 112 — kest ei tohi luua vastupidist ootust |

### 6.4. Keelud (arhitektuurilised, mitte seadistused)

- Taustal asukoha jälgimist EI OLE; signaal EI sisalda seadme asukohta; geolokatsiooni API-t ei kasutata (O-FD-9).
- Tööandja välitöö-dashboard'i, töötajate reaalaja kaarti ega „kes on kus" vaadet EI ehitata (RUUM-VIS ptk 7 „mida teadlikult MITTE ehitada"; sama klass kui Tööheaolu jälgimiskeeld).
- Turvasignaali andmeid (relvastused, eskaleerimised) ei koondata kellegi teise vaatesse peale töötaja enda; org-koond on ORG-A0 otsuste taga.
- Automaatset heli-/videosalvestust „ohu tuvastamiseks" EI ole ja ei tule.

## 7. Kasutajaliides

### 7.1. Põhialad (üheksa)

Kest elab route'idel `/valitoo` (loend + olekud) ja `/valitoo/[visitId]` (külastuse mini-ruum). Nimereegel järgib olemasolevat diakriitikata mustrit (`/tooheaolu`).

| Ala | Sisu | Seis/märkused |
|---|---|---|
| 1. „Valmista külastus ette" | külastuse loomine + paketi koostaja (2.1 sammud 1–4); sissepääsud: vastuvõtulaua eelpöördumise juurest JA `/valitoo` avalehelt | töölaual/arvutis sama vaade responsiivselt |
| 2. Külastuse mini-ruum | 3 faasi (ettevalmistus → kohal → järeltöö) ühe alumise tegevusribaga; faasivahetus on kasutaja puude, mitte automaatika | K1 faasid toetavad; „ruumiline" esitus EI OLE nõue — V1 on flat/loendipõhine; dokk-muster on esteetiline valik, mitte sõltuvus |
| 3. Kiire märge | üks suur nupp (alati pöidla ulatuses); tekstiväli + päritoluvalik (2 puudet, vaikimisi TÖÖTAJA_TÄHELEPANEK); autosave ≤2 s | S5 stsenaarium: märge <30 s |
| 4. Hääl / foto / OCR | sisendiriba märkme juures: mikrofon (heli-mustand offline / kohene STT online), kaamera (capture), sünkroonitud foto juures „Loe tekst" (OCR) | iga sisend avaneb ainult nõusolekuloogika järgi (4.9); kõigil on tekstialternatiiv |
| 5. Mustandite ja sünkroonimise olek | püsiv ühenduseriba (võrgus/võrguta/sünkroonin N/M) + üksuste olekuloend (3.2 olekud inimkeeles) | „laeb igavesti" spinner on keelatud — iga olek on nimetatud seis |
| 6. „Kontrolli enne saatmist" | üksuste review-loend: eelvaade, päritolu parandus, eemalda/saada üksuse kaupa või koos | 3.1 p4 värav |
| 7. Üleandmine tööruumi | sihtkoha valik (seotud eelpöördumine / ainult külastus) + koostevaade (mis läheb receiverNote'i täienduseks, mis kokkuvõtte mustandiks, mis failid seotakse) + kinnitus | 2.1 samm 16 |
| 8. Järeltöö | märkmete korrastus (fakt/tõlgendus), transkribeeri/OCR käsud, kokkuvõtte mustand, järgmine samm (`nextContactOn`), sulgemine, „eemalda seadmest" | S6: sama vaade arvutis |
| 9. „Jätka siit" | continuity uus liik `field_visit` [MAIN mustri laiendus]: täna toimuv külastus (prio 1 klass), sünkimata üksustega külastus, sulgemata külastus | töölaud viib süvalingiga otse õigesse faasi |

### 7.2. Kasutatavusnõuded (Definition of Done osa, mitte hilisem audit)

- **Üks käsi:** kõik põhitoimingud (märge, foto, hääl, faasivahetus, kinnitused) alumises kolmandikus; ülemine ala on info, mitte toimingud.
- **Puutealad:** ≥48×48 px, kriitilised nupud suuremad; nuppude vahed ≥8 px (kinnastega/liikudes kasutamine).
- **Väike ekraan:** töötab 320 px laiuselt; üks veerg; mitte ühtegi horisontaalset kerimist.
- **Klaviatuur ja ekraanilugeja:** kogu voog läbitav klaviatuuriga; olekumuutused (võrk, sünk, salvestus) `aria-live` teadetega; loendivaade ON põhivorm (K1 esitusnõue — mitte paralleelvorm efektile).
- **ET/EN/RU:** kõik uued stringid `field.*` i18n-võtmetena kolmes failis samas PR-is (`i18n:check` et-pariteet); DB-sse ei lähe ühtegi tõlgitavat silti (P2-6 õppetund; receiverChecklist ET-only viga ei kordu).
- **Vähendatud liikumine:** reduced-motion austatakse; V1-s liikumisefekte sisuliselt polegi — üleminekud on ristsulandused.
- **Nõrk valgus:** vaikimisi tume kõrge kontrastiga teema välitöörežiimis; fondisuurus järgib olemasolevat uiScale'i [MAIN].
- **Katkestused:** iga vaade talub sulgemist/taasavamist andmekaota (2.2); „salvestamata muudatuste" dialooge ei eksisteeri, sest salvestamata seisu ei eksisteeri.
- **Nähtav offline-olek:** püsiv riba + üksuseolekud (7.1 ala 5); offline EI peida funktsioone vaikselt — võrku vajav toiming on nähtav, kuid selgitusega keelatud olekus („vajab ühendust").
- **Laadimine, tühiseisud, vead:** igal alal defineeritud kolmik: skeleton-laadimine (ainult võrgutoimingutel), sisuline tühiseis („Ühtegi külastust pole — alusta ettevalmistusest") ja nimetatud veaseis taastumisteega (proovi uuesti / salvesta seadmesse / võta ühendust).
- **Kaamera, hääl ega ruumiline efekt ei ole kohustuslik kasutustee** — lubade keelamine või vanem seade ei sulge ühtegi funktsiooni sisuliselt (5. ptk alternatiivid).

## 8. Sidumine olemasolevate funktsioonidega

| Olemasolev funktsioon | Kuidas kest seostub | Mida kest EI tee (dubleerimiskeeld) |
|---|---|---|
| **Juhtumitöö assistent (T21, CASEWORK-A0)** | külastus on JTA kohtumismärkmete mobiilne kest (CASEWORK ptk 7 rida FIELD); päritolumärgistus on SAMA 8-väärtuseline K2 sõnastik — kui CASEWORK-P0 (`lib/workspaces/provenance.js`) on merge'itud, FIELD tarbib seda; kui ei, toob FIELD sama faili identsete väärtustega ise (koordinaator liidab — mitte kaks sõnastikku) | ei loo juhtumikonteinerit, riskiskoori ega STAR2-välju; välitöö märkmed on klass 1 töömustand (kandjapiir CASEWORK 2.1) |
| **Eelpöördumine (T06)** | esimene vertikaal: külastus lingitakse eelpöördumisega (`preInquiryId` SetNull); üleandmine kasutab OLEMASOLEVAT workflow-PATCH-i (receiverNote, nextContactOn) [MAIN]; DOWNLOADED-mustri koopia-ausus üldistub külastuspaketile | ei muuda eelpöördumise elutsüklit, õigusi ega UI-d; ei kopeeri eelpöördumise sisu seadmesse automaatselt (ainult töötaja valitud külmutatud kokkuvõte) |
| **Kohtumised / kohtumise ühisvaade (T20 COLLAB)** | külastus on töötaja PRIVAATNE tööruum (visibility PRIVATE, osalejaid pole); kui tulevikus tekib mitmepoolne kohtumise ühisvaade, on külastuse kokkuvõte selle SISEND (U10 artefakti-jagamise rada), mitte konkurent | ei ehita osalejakihti, kutseid ega mitmepoolset vaadet — see on COLLAB-i K3/K4 territoorium |
| **Meetodipeegel (CASEWORK-P3, tulevik)** | järeltöö faasis „ava refleksioon" navigatsiooniline link (kui P3 on olemas); külastus on refleksiooni sourceRef-kandidaat | andmesidet ei looda; refleksioonikirje jääb Meetodipeegli mudeliks; FIELD ei lisa refleksiooniväljasid |
| **Dokumendid ja failid (T07/T08)** | fotod/heli/transkriptid on `UserDocument`-id (olemasolev omanikupiir, download-päised, kustutusrajad, retention-sweep); sidumine külastusega käib õhukese `FieldVisitAttachment` liitetabeliga | ei loo paralleelset failisüsteemi, oma storage'it ega oma kustutusloogikat; FAILID-A0 tugevusmustrid (UUID-nimi, atomic create, fail-closed konto-kustutus, owner-404) on kohustuslikud |
| **Ülesanded / järgmine samm (K6)** | järgmine samm = `nextContactOn` olemasolev muster + continuity/NEXT_CONTACT_DUE teavitus [MAIN] | oma ülesandesüsteemi EI ehita (CASEWORK 6.4 piir: mitmepoolne ülesanne on COLLAB objektiklass) |
| **Teenusekaart (T11)** | külastuse ajal kiirviited: teenuse detail + kriisikontaktid on tavalised route'id (võrgus); offline-paketti võib töötaja lisada teenuseinfo TEKSTINA (oma märkmena) | teenusekaardi andmeid ei cache'ita seadmesse; „enne minekut" ploki omanik on T11 |
| **Tööruumide K1 leping (T04)** | `field_visit` kind on K1-P0 registris RESERVED [BRANCH]; külastuse elutsükkel kaardistub K1 4.2.1 sõnastikku (3.4); descriptor-adapter on tingimuslik etapp (K1-P0 merge järel) | K1-P0 merge EI OLE eeldus (ESTA-MENTOR pretsedent); ilma selleta töötab kest oma olekutega, adapter lisandub hiljem samas lepingus |
| **U1 sündmused ja teavitused (T04)** | V1 kasutab OLEMASOLEVAT NotificationEvent + reconciler + delivery kihti [MAIN]: uued olekuskaneeringu-tüübid `FIELD_CHECKIN_DUE` (töötajale) ja turvasignaali eskaleerimise otsekiri (mailer, nagu sisuta saabumiskiri); U1-P0 DomainEvent outbox EI ole eeldus — kui see valmib, migreeruvad külastuse elutsüklisündmused sinna (K1-U1 ptk 10 adapteripakettide muster) | ei loo oma teavituskanalit ega e-kirjarada; payload-privaatsus (K1-U1 6.4: sisuta, koodid+ID-d) kehtib absoluutselt |
| **„Jätka siit" (U2/T05)** | `workspaceContinuity.js` saab uue liigi `field_visit` (omaniku-skoobitud, prio-loogika: täna toimuv/relvastatud külastus kõrgel, sünkimata üksustega külastus keskel) | continuity jääb töölaua omaks (T05); FIELD annab ainult kandidaadid |

Koondreegel: **FIELD-V1 loob TÄPSELT KOLM uut serverimudelit (FieldVisit, FieldVisitNote, FieldVisitAttachment) + ühe DocumentKind väärtuse (FIELD_PHOTO)** — kõik muu (failid, transkriptid, artefaktid, teavitused, continuity, nextContactOn, nõusolekuaudit) kasutab olemasolevaid kandjaid. FieldVisitNote on põhjendatud uus kandja, sest ühtegi sobivat märkmekandjat ei eksisteeri: `receiverNote` on eelpöördumise ÜKS tekstiväli (päritolumärgistuseta, teise omanikuga), `AgentArtifact` on AI-/dokumendimustand, `RoomMessage` nõuab ruumi. Ülesande keeld („ei paralleelseid märkme-, faili-, ülesande- ega juhtumiandmeid, kui olemasolev kandja sobib") on seega täidetud: failid→UserDocument, ülesanded→nextContactOn, juhtum→viide, märkmed→uus kandja AINULT seetõttu, et sobivat pole.

## 9. Tehnilised variandid

### 9.1. Kolm varianti

| Kriteerium | 1. Responsiivne veeb (praegune) | 2. Installitav PWA (sama koodibaas + päris SW + IndexedDB) | 3. Eraldi mobiilirakendus (native/Capacitor) |
|---|---|---|---|
| Offline-mustand | EI (SW no-op; iga navigatsioon vajab võrku) | JAH: kest precache'itud, andmed IndexedDB-s; **piisav 2.1 voo jaoks** | JAH, kõige tugevam (SQLite, taustaprotsessid) |
| Kaamera | `<input capture>` töötab juba responsiivses veebis | sama (+ getUserMedia võimalus hiljem) | täielik |
| Mikrofon/dikteerimine | töötab [MAIN] | töötab (MediaRecorder on olemas iOS 14.3+/Android) | täielik |
| Taustal sünk / push | EI | **EI — ja seda ei lubata ka kasutajale** (iOS: Background Sync puudub; push ainult installitud PWA-le 16.4+, V1 ei kasuta) | JAH (taustateenused, push) |
| Salvestuse püsivus | — | IndexedDB + `navigator.storage.persist()` (best-effort; installitud PWA-l oluliselt soodsam eviction-poliitika) — kohalik eluiga on niikuinii lühike (4.5), seega eviction-risk on talutav | garanteeritud |
| Levitus ja uuendused | tavaline deploy | sama deploy; „Lisa avaekraanile" juhend; ei app store'i | App Store/Play review, teine release-tsükkel, teine kood/kest |
| Arendus- jaReview-kulu | 0 lisakulu | väike: SW + hoidla + sünkimootor samas Next.js repos | SUUR: teine platvorm, teine turvaaudit, teine i18n/a11y pind |
| Seadmepark (KOV töötelefonid, eri vanused) | töötab kõikjal | töötab kõikjal, kus brauser; installimine on soovitus, mitte eeldus — **kest töötab ka installimata brauseris** (offline-võime on siis brauserisessiooni-põhine ja seda öeldakse) | nõuab paigaldusõigusi hallatavas seadmes (sageli takistus!) |
| Turvahoiatus | — | veebi krüpto-/salvestuspiirid (4.3 aus piir) | keychain/keystore tugevam |

### 9.2. Soovitus [otsustatud vaikevalik, ei blokeeri]

**Variant 2: installitav PWA sama koodibaasi sees.** Põhjendus: (1) kogu vajalik sisendivõimekus (kaamera-capture, MediaRecorder, IndexedDB, WebCrypto) on tänastes mobiilibrauserites olemas ja 2.1 voog EI VAJA taustatööd — ainus native-rakenduse päris eelis (taust + push) on disainiga teadlikult välditud (3.1 p2); (2) PWA-taristu on juba olemas (manifest + registrar [MAIN]) ja sw.js on puhas leht, millele saab kehtestada range lepingu (4.10) ilma midagi lammutamata; (3) eraldi rakendus tähendaks teist koodibaasi, teist auditipinda ja app-store'i sõltuvust olukorras, kus KOV-ide hallatavates seadmetes on paigaldamine sageli just takistus; (4) kui tulevikus tekib tõendatud vajadus tausta/pushi/tugevama krüpto järele, on Capacitor-kest SAMA veebikoodi ümber loomulik evolutsioon — mitte praegune eeldus (O-FD-6 fikseerib). Brauseri tegelikud piirid on ptk-des 3–5 disaini sisse ehitatud, mitte maha vaikitud: ei taustatööd, ei kaugkustutust, ei offline-STT/OCR-i, storage-eviction'i maandab lühike kohalik eluiga.

## 10. Otsused

| ID | Otsus | Variandid | Soovituslik vaikevalik | Blokeerib | Viimane hetk |
|---|---|---|---|---|---|
| **O-FD-1** ✅ | Välitöökandjate retention-maatriks (FieldVisit, märkmed, foto, toorheli, kohalikud koopiad) + foto/heli lubatud eesmärkide kinnitus | ptk 4.5/4.8 vaikeväärtused / muudetud tähtajad | **KINNITATUD (FIELD-D0, 17.07.2026): ptk 4.5/4.8 vaikeväärtused** — sünkroonitud kohalikud koopiad 7 p; saatmata sisu (DEVICE_ONLY/QUEUED/FAILED) kuni 30 p, seejärel hoiatused ja kustutus 37. päeval; serveris külastus ja märkmed 90 p pärast sulgemist; toorheli 7 p VÕI kustutus kohe pärast kasutaja kinnitatud transkripti; foto = UserDocument 90 p sweep | oli: skeemietapp E1 — kinnitusega lahendatud (K7 keeld täidetud: kandja sünnib tähtaegadega) | TEHTUD (enne haru avamist) |
| **O-FD-2** ✅ | Kohaliku salvestuse kaitsetase piloodile | (a) WebCrypto + OS-lukk + auto-purge miinimum; (b) + rakenduse PIN-lukk (PIN-ist tuletatud võtmemähis) | **KINNITATUD (FIELD-D0, 17.07.2026): variant (a)** — V1 piloodis WebCrypto + seadme ekraanilukk + automaatne kustutamine; tooteomanik võtab 4.3 ausa piiri riski omaks; rakenduse PIN-lukk jääb hilisema laia kasutuselevõtu otsuseks | oli: hoidlaetapp E2 — kinnitusega lahendatud | TEHTUD |
| **O-FD-3** ✅ | Turvasignaali saaja ja kohustuslikkus | (a) töötaja määratud usalduskontakt, opt-in; (b) asutuse number (vajab org-kihti); (c) V1 ilma signaalita | **KINNITATUD (FIELD-D0, 17.07.2026): variant (a)** — signaal on vabatahtlik (opt-in) ja saaja on töötaja enda määratud usalduskontakt; asutuse keskne kontakt jääb organisatsioonikihi (T25) hilisemaks võimaluseks; RUUM-VIS [DECISION] on sellega vastatud | oli: etapp E8 — kinnitusega lahendatud | TEHTUD (ühes otsustusringis O-FD-1/2-ga) |
| O-FD-4 | Fotode kasutuspoliitika | dokumendid+keskkond, inimesi vaikimisi mitte / vabam | dokumendid+keskkond; inimese pildistamine ainult eraldi teadliku nõusolekukirjega ja mitte V1 UI-vaikevalikuna | ei blokeeri (UI-tekst + juhend) | E6 UI-tekstid |
| O-FD-5 | OCR paigutus | serveris (Tesseract est) kasutaja käsul / seadmes WASM / väljas | serveris, ainult käsul, ainult sünkroonitud foto peale; seadme-WASM alles kvaliteedimõõtmise järel | ei blokeeri (OCR on mugavuskiht) | E6 |
| O-FD-6 | Kesta vorm | eraldi teadlik välitöörežiim `/valitoo` / pelgalt responsive-käitumine / native rakendus | eraldi teadlik kest PWA-na (ptk 9.2; RUUM-VIS soovitus „eraldi teadlik režiim minimaalse paketiga") | ei blokeeri | — (fikseeritud) |
| O-FD-7 | Standalone-külastus (ilma eelpöördumiseta) | lubatud / keelatud | lubatud (outreach S2 nõuab); kliendi-viiteta väljad on vabatekst, mitte registriväljad — varju-registri keeld (CASEWORK 2.4 p3 analoog: külastus ilma allikata ei kogu struktureeritud kliendiandmeid) | ei blokeeri | E1 skeemikommentaar |
| O-FD-8 ✅ | Kohalike koopiate vaike-eluiga | 4.5 väärtused / muud | 4.5 tabel (osa O-FD-1 maatriksist, eraldi rida kasutaja-UI läbipaistvuse pärast) — **KINNITATUD koos O-FD-1-ga (FIELD-D0, 17.07.2026)** | koos O-FD-1-ga | — |
| O-FD-9 | Asukoht | ainult käsitsi tekst + väline kaardilink / geolocation API ühekordseks kasutuseks | ainult käsitsi tekst; geolocation API-t V1 EI kasuta üldse (väikseim pind, selgeim lubadus); ümberhindamine alles kasutajate küsimisel | ei blokeeri | — (fikseeritud) |
| O-FD-10 | Kahe seadme konflikti lahendus | mõlemad revisjonid säilivad + kasutaja valib / viimane võidab | revisjonid + kasutaja valik (3.3); „viimane võidab" ainult külastuse meta CAS-iga | ei blokeeri | E2/E3 |

**Blokeerivaid otsuseid oli täpselt kolm (O-FD-1, O-FD-2, O-FD-3) ja kõik kolm on KINNITATUD** — tooteomanik sulges need ühe FIELD-D0 otsustusringina 17.07.2026, analüüsi soovituslike vaikevalikutega (O-FD-8 kinnitati sama maatriksi osana; partnerit, õigusbürood ega uut analüüsi ei vajatud). FIELD-V1 alustamiseks ei ole ühtegi lahtist otsust; kõik ülejäänud küsimused on lahendatud põhjendatud soovitusega ülal.

## 11. FIELD-V1 — mobiilse välitöö terviklik teostus (üks arenduspakett)

Kopeeritav ülesanne Sol/Terra aknale. Üks teema = üks haru = üks lõppüleandmine; sisemised etapid E1–E10 on kontrollpunktid sama haru sees (mitte eraldi paketid); mitu commit'i on lubatud ja oodatud.

```
ÜLESANNE: FIELD-V1 — mobiilse välitöö terviklik teostus (T24)

LOE ENNE:
- docs/platvormi arendus/fable-5-valitoo-mobiilne-kest.md (KOGU dokument — see on leping; eriti ptk 2 vöög,
  ptk 3 olekumasin, ptk 4 privaatsus, ptk 10 otsuste kinnitatud väärtused)
- docs/platvormi arendus/fable-5-failide-ja-meedia-elutsukkel.md ptk 7 (säilitatavad mustrid) ja ptk 9 P2.1
  (atomic file-create — kohustuslik FIELD-i failiradadel)
- docs/platvormi arendus/fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md ptk 4 (K1 leping) ja 5.1
  (NotificationEvent/reconciler — turvasignaali ja meeldetuletuse kandja)
- docs/platvormi arendus/fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md ptk 2.3 (päritolumärgistuse
  8-väärtuseline sõnastik — FIELD kasutab SAMA)

EELDUSED (kontrolli alustades):
- O-FD-1, O-FD-2, O-FD-3 on tooteomaniku poolt KINNITATUD (FIELD-D0, 17.07.2026) — kinnitatud väärtused on
  all plokis KINNITATUD OTSUSED; uusi otsuseid ei ole vaja küsida
- värske worktree origin/main pealt (fe4eb4fa või uuem)
- kui lib/workspaces/provenance.js on olemas (CASEWORK-P0 merge'itud), kasuta seda; kui ei, loo see ise
  CASEWORK-A0 2.3 väärtustega (8 väärtust) — sama fail, sama leping, EI kahte sõnastikku
- K1-P0 merge EI ole eeldus: kui lib/workspaces/registry.js on olemas, lisa field_visit adapter (E7 osa);
  kui ei, jäta adapter vahele ja märgi lõpparuandes

KINNITATUD OTSUSED (FIELD-D0, 17.07.2026 — kasuta täpselt neid väärtusi; ära küsi uuesti ega muuda):
- O-FD-1 retention: sünkroonitud kohalikud koopiad seadmes 7 p; saatmata sisu (DEVICE_ONLY/QUEUED/FAILED)
  seadmes kuni 30 p, seejärel püsivad hoiatused ja kustutus 37. päeval; serveris külastus ja märkmed 90 p
  pärast külastuse CLOSED/CANCELLED; toorheli 7 p pärast transkribeerimist VÕI kustutus kohe pärast kasutaja
  kinnitatud transkripti; foto = UserDocument 90 p sweep; ülejäänud kohalikud tähtajad = doc ptk 4.5 tabel
  (O-FD-8 kinnitatud sama maatriksi osana)
- O-FD-2 kohalik kaitse V1 piloodis: WebCrypto AES-GCM non-extractable võti + seadme ekraanilukk (OS) +
  automaatne kustutamine (auto-purge); rakenduse PIN-lukku V1-s EI ehitata (laia kasutuselevõtu hilisem otsus)
- O-FD-3 turvasignaal: vabatahtlik (opt-in); saaja = töötaja enda määratud usalduskontakt (e-post, mille
  töötaja ise sisestab ja mille õigsuse eest vastutab); asutuse keskne kontakt = organisatsioonikihi (T25)
  hilisem võimalus — FIELD org-mudelit ei ehita

KASUTAJALE NÄHTAV LÕPPTULEMUS (vastuvõtukriteerium):
Sotsiaaltöötaja valmistab arvutis või telefonis külastuse ette (eesmärk, võtmeküsimused, valitud kokkuvõte,
turvasignaal), võtab paketi seadmesse, läheb kohta, kus internetti EI OLE, teeb seal tekst-/hääl-/fotomärkmeid
päritolumärgistusega, naaseb võrku, kontrollib iga üksuse üle, saadab, transkribeerib/OCR-ib käsul, annab
materjali üle seotud eelpöördumise töövoogu, loob järgmise kontakti kuupäeva, suleb külastuse ja eemaldab
seadme koopiad. Kogu voog on läbitav ka ilma kaamera, mikrofoni ja installimiseta (tekst + checklist).

ULATUS (sisemised etapid; järjekord on soovituslik, E1→E2→E3 on kõva sõltuvus):
E1  Skeem + migratsioon: FieldVisit (ownerUserId, eesmärk, ajaaken, kohatekst, preInquiryId? SetNull,
    olekud String-konstantidena + version Int CAS, turvasignaali väljad, retention-väljad O-FD-1 järgi),
    FieldVisitNote (visitId Cascade, clientItemId, revision, provenance, body, ajad; @@unique([visitId,
    clientItemId])), FieldVisitAttachment (visitId, documentId, clientItemId, role, nõusolekuviide);
    DocumentKind += FIELD_PHOTO. Indeksid loenditele ja sweep'ile. Rollback = DROP (andmekadu ainult uues kihis).
    MITTE: PG-enum'e olekutele; FK-sid üle moodulipiiri; kliendi struktureeritud andmevälju.
E2  Kohalik hoidla + sünkimootor: IndexedDB partitsioon per userId; AES-GCM non-extractable CryptoKey
    (O-FD-2 tase); üksuse olekumasin (9 olekut, doc ptk 3.2); journal + käivitusel reconcile; autosave;
    retry-piir 5 + backoff; kohalik auto-purge (doc 4.5). localStorage'i tundlikku sisu EI lähe.
E3  Server-API: /api/field/visits (loomine/loend/meta CAS), /api/field/visits/[id]/items/[clientItemId]
    idempotentne PUT (200 existing; revisjonikonflikt 409 + kõrvalrevisjon), attachments-upload atomaarse
    temp→commit rajaga (FAILID P2.1), pildi signatuurikontroll (JPEG/PNG magic; EXIF/GPS strip serveris
    varukontrollina), review/üleandmise endpoint (eelpöördumise workflow-PATCH-i kutse + AgentArtifact
    CASE_SUMMARY DRAFT loomine), kvoodid ja rate-limit olemasoleva mustri järgi; KÕIK rajad omaniku-skoobitud
    404-ga (mitte 403-oraakel).
E4  Service worker + offline-kest: precache ainult staatiline kest; /api/* cache KEELATUD (doc 4.10 leping
    testiga!); offline-fallback; versioonivahetus ilma poolelioleva sünkita.
E5  UI põhialad: /valitoo + /valitoo/[visitId] — doc ptk 7.1 üheksa ala + 7.2 nõuded (üks käsi, 48px,
    320px, aria-live, tume kõrge kontrast, nimetatud laadimis-/tühi-/veaseisud, nähtav offline-riba).
E6  Sisendid: foto <input capture> + kliendipoolne kompressioon + EXIF-strip; heli-mustand olemasoleva
    useSpeech MediaRecorder-mustriga kohalikku hoidlasse; online-dikteerimine taaskasutab /api/stt;
    OCR-endpoint (Tesseract est, O-FD-5) + pilt-tekst-kõrvuti review-UI; nõusolekukirje värav (doc 4.9);
    KÕIGIL tekstialternatiiv.
E7  Üleandmine + navigatsioon: „Kontrolli enne saatmist" värav; üleandmise koostevaade; workspaceContinuity
    uus liik field_visit; süvalingid; (tingimuslik) K1 field_visit read-adapter kui registry olemas.
E8  Turvasignaal (O-FD-3 järgi): relvastus võrgus; reconciler-tüüp FIELD_CHECKIN_DUE (meeldetuletus
    töötajale); eskaleerimise otsekiri usalduskontaktile (minimaalne sisu doc 6.3; mailer + delivery-retry);
    „lahenenud" järelteade; DataAuditLog kirjed; „ei ole hädaabi asendus" tekstid.
E9  Privaatsus/retention jõustamine: serveripoolne sweep uutele kandjatele (O-FD-1 klassid; lisa
    lib/retention.js radadele); toorheli kustutus transkripti kinnitusel; nõusoleku tagasivõtu kustutusrajad
    (aus vastus, kui fail/vektor jäi — FAILID F-07 klassi viga keelatud); konto kustutuse laiendus (FieldVisit*
    read fail-closed orkestreerimisse); logimiinimum (ei sisu, ei failinime, ei kohateksti logidesse).
E10 Testid + kontroll + dokumentatsioon (vt allpool) + lõpparuanne.

VÄLISTUSED (EI kuulu paketti):
- taustal sünk, push-teavitused, äratussõna, offline-STT/offline-OCR, geolocation API, kaugkustutus
- mitmepoolne kohtumine/osalejad (COLLAB), refleksioonikirje (CASEWORK-P3), org-vaated, tööandja dashboard
- ruumiline flight-esitus (kest on flat; SPATIAL on T19)
- chunk-upload, kärpimis-/redigeerimistööriistad fotol/helil
- STAR2 väljad, kliendiregistri väljad, riskiskoorid

ANDMEMUDEL: täpselt 3 uut mudelit + 1 enum-väärtus (E1); mitte ühtegi muud skeemimuutust.
SÕLTUVUSED: 0 kõva koodisõltuvust; CASEWORK-P0/K1-P0 tingimuslikud (vt EELDUSED); U1-P0 EI ole eeldus.

ET/EN/RU + LIGIPÄÄSETAVUS: kõik stringid field.* võtmetena 3 failis samas PR-is; npm run i18n:check roheline;
klaviatuur + ekraanilugeja kogu voos; reduced-motion; 320px; DB-s 0 tõlgitavat silti.

SEADME- JA BRAUSERIMAATRIKS (käsitsi kontroll, tulemused lõpparuandesse):
- Android Chrome (uusim + 2a vanune seade): install, offline-voog, kaamera, mikrofon, storage-püsivus
- iOS Safari (16.4+; installitud PWA JA tavaline sakk): sama loend + eviction-käitumine taasavamisel
- töölaua Chrome/Firefox: ettevalmistus + järeltöö (S6) responsiivselt
- kitsaskoht dokumenteeritakse, mitte ei vaikita maha

AUTOMAATTESTID (repo konventsioon: node:test, süstitud fake-db, EI elavat DB-d):
- tests/field/syncApi.test.js — idempotentne PUT (kordus → existing), revisjonikonflikt → 409 + kõrvalrevisjon,
  võõras kasutaja → 404, kvoodid
- tests/field/stateMachine.test.js — 9 oleku üleminekud, retry-piir, reconcile-loogika (UPLOADING → serveri
  kontroll → SYNCED/QUEUED), duplikaadivälistus
- tests/field/privacy.test.js — paketi whitelist (4.1), logimiinimum, nõusolekuvärava jõustumine,
  tagasivõtu kustutusrajad, konto kustutuse kate uutele mudelitele
- tests/field/swContract.test.js — SW ei registreeri /api/ cache-handlerit (staatiline leping-test)
- tests/field/handover.test.js — üleandmine on tehinguna terviklik/korratav; receiverNote täiendus ei
  kirjuta üle vastuvõtja olemasolevat teksti
- i18n leping: iga field.* võti 3 keeles (registri-test nagu tests/events mustris)

SÜNTEETILINE RUNTIME-KONTROLL (lokaalne dev, temp-login retsept memory's; EI tootmisandmeid):
- Playwright: login → ettevalmistus → context.setOffline(true) → 3 märget (tekst+päritolu) + foto-mock →
  taasavamine offline'is (püsivus!) → setOffline(false) → review → saatmine → DB-s read → üleandmine →
  continuity kaart nähtav → purge → IndexedDB tühi
- offline/online ÜLEMINEKUKATSED: sünk katkeb poole pealt (route abort) → reconcile ei dubleeri;
  sessiooni aegumine offline'is → andmed säilivad, sünk nõuab loginit
- KADUNUD ÕIGUSE KATSE: eelpöördumise õigus kaob enne üleandmist → üleandmine annab selgituse, külastus säilib
- DUPLIKAADIKATSE: sama clientItemId kaks korda (kaks tabi) → 1 kirje serveris
- turvasignaal: relvastus → tähtaeg möödub (test-kell) → reconciler loob eskaleerimise → hilinenud
  kinnitus → „lahenenud" kiri (mailer-mock)

CLEANUP: iga testi/runtime-kontrolli sünteetilised kasutajad, failid, IndexedDB partitsioonid ja temp-failid
koristatakse; lõpparuandes kinnitus „0 jääki".

DEFINITION OF DONE:
1) kasutajale nähtav lõpptulemus (ülal) on käsitsi läbitav mobiiliseadmes ILMA võrguta kogumisfaasis;
2) npm test + npm run i18n:check + lint rohelised; migratsioon läbib npm run db:migrate:check;
3) kõik automaattestid + runtime-kontrollid PASS; seadmematrix täidetud;
4) SW-leping (4.10) tõendatud testiga; ühtegi /api/ vastust HTTP-vahemälus pole;
5) privaatsuslubadused kehtivad: paketi whitelist, EXIF-strip, logimiinimum, kohalik auto-purge,
   nõusoleku tagasivõtu jõustumine, konto kustutuse kate;
6) ei ühtegi muudatust väljaspool FIELD-i pindu peale: DocumentKind enum-lisa, retention.js sweep-lisa,
   workspaceContinuity liik, i18n-failid, (tingimuslik) workspaces registry/adapter — loetle diff lõpparuandes;
7) commit'id haru peal, push, EI merge'i — koordinaator võtab vastu.

LÕPPARUANDE VORM:
- haru + commit'ide loend + remote SHA; muudetud failide täisloend
- etappide E1–E10 seis (TEHTUD/OSALINE/VAHELE + põhjus)
- testide arvud (X/X) + runtime-kontrollide protokoll + seadmematrixi tabel
- privaatsuskontrollide checklist (DoD p5 punkthaaval)
- teadaolevad piirid ja edasilükatud asjad (ausalt)
- kinnitus: tootmisandmeid ei loetud, deploy'd ei tehtud, cleanup = 0 jääki
```

## 12. Arendusvalmiduse hinnang

| Küsimus | Vastus |
|---|---|
| Kas FIELD-V1 saab kohe arendusse minna? | **Jah.** Analüüs on täielik, pakett on defineeritud (ptk 11) ja kolm blokeerivat otsust (O-FD-1/2/3) on kinnitatud (FIELD-D0, 17.07.2026) — sisulisi eeldusi enam ei ole; haru avamise järjekord on koordinaatori otsus (masterregister ptk 8) |
| Millised sõltuvused on koodis veel puudu? | Kõva sõltuvust **ei ole ühtegi**. Tingimuslikud: CASEWORK-P0 päritolusõnastik ja K1-P0 registry (kui pole merge'itud, toob FIELD-V1 vastavad failid ise sama lepinguga — koordinaator liidab). U1-P0 outbox EI ole vajalik (reconciler + otsekirjad katavad). FAILID-P0/P1 ei blokeeri, kuid FAILID-A0 mustrid (atomic create, owner-404, fail-closed kustutus) on paketi sees kohustuslikud |
| Paketi staatus | **`READY_THEME_BUILD` (alates 17.07.2026)** — analüüs COMPLETE, pakett rakendusvalmiks kirjutatud ja O-FD-1/2/3 kinnitatud FIELD-D0 ringis; kinnitused määrasid skeemi (retention), hoidla (kaitsetase) ja turvasignaali etapi ning väärtused on ptk 10 ja ptk 11 KINNITATUD OTSUSED plokis. Varasem seis oli `BLOCKED_DECISION (kerge)`; uut analüüsi ei tehtud ega vajatud |
| Fikseeritud otsused (vaikevalikuga, ei blokeeri) | O-FD-4 fotopoliitika; O-FD-5 OCR serveris käsul; O-FD-6 installitav PWA (mitte native); O-FD-7 standalone-külastus lubatud vabateksti piiriga; O-FD-8 kohalik eluiga; O-FD-9 geolokatsiooni API-t ei kasutata; O-FD-10 konflikt = revisjonid + kasutaja valik |
| Blokeerivad otsused (max 3) | **KÕIK KINNITATUD (FIELD-D0, 17.07.2026):** O-FD-1 retention-maatriks = ptk 4.5/4.8 vaikeväärtused; O-FD-2 = WebCrypto + seadme ekraanilukk + auto-purge (PIN-lukk = laia kasutuselevõtu hilisem otsus); O-FD-3 = vabatahtlik signaal töötaja määratud usalduskontaktile (asutuse keskne kontakt = T25) |
| Kas kogu kasutajateekond, privaatsus, offline-töö, sünkroonimine, failid, vead ja testimine on kaetud? | **Jah.** Teekond algusest lõpuni + katkestusrajad (ptk 2); offline/sünk 9-olekulise masina ja kõigi ülesande erijuhtudega (ptk 3); privaatsus whitelist'ist SW-lepinguni (ptk 4); sisendid alternatiividega (ptk 5); turvasignaal ausa offline-mudeliga (ptk 6); UI koos vea-/tühi-/laadimisseisudega (ptk 7); integratsioonid dubleerimiskeeldudega (ptk 8); tehniline valik brauseripiiridega (ptk 9); testid, üleminekukatsed, kadunud õiguse ja duplikaadi katsed, cleanup ja DoD paketis (ptk 11) |

## Jätkamispunkt

- **FIELD-D0 (17.07.2026, teine töökord):** tooteomanik kinnitas kõik kolm blokeerivat otsust analüüsi vaikevalikutega — O-FD-1 retention = ptk 4.5/4.8 väärtused (sünkroonitud kohalikud koopiad 7 p; saatmata sisu kuni 30 p + hoiatused, kustutus 37. päeval; serveris külastus+märkmed 90 p sulgemisest; toorheli 7 p või kustutus kohe pärast kinnitatud transkripti); O-FD-2 = WebCrypto + seadme ekraanilukk + auto-purge (rakenduse PIN-lukk = laia kasutuselevõtu hilisem otsus); O-FD-3 = vabatahtlik signaal töötaja määratud usalduskontaktile (asutuse keskne kontakt = T25 hilisem võimalus). O-FD-8 kinnitatud O-FD-1 maatriksi osana. Uuendatud: STATUS-plokk, Edenemistabel (rida 14), ptk 10, ptk 11 (KINNITATUD OTSUSED plokk), ptk 12, masterregistri T24 ning tulevikuanalüüside registri otsuseread+logi. Rakenduskoodi, skeemi, teste, handoff'i ega arendusprogrammi ei muudetud; commit'e ei tehtud.
- **Seis:** kõik 13 etappi TEHTUD (vt Edenemistabel); esimene täisring COMPLETE; dokument jääb elavaks — uus töökord lisab uue kuupäevaga rea, ei muuda ptk 0 lukustatud kontrolle.
- **Kontrollitud allikad (17.07.2026):** `git ls-remote` → origin/main `fe4eb4fa` MUUTUMATU (serveri-/Git-kontrolle ei korratud; kehtib K1-U1-A0/CASEWORK-A0 sama päeva serveritõend). Dokumendid täies mahus: arendusteemade-masterregister, tulevikuanalüüside register, K1-U1-A0 (707 r), FAILID-A0 (397 r), CASEWORK-A0 (501 r); teemakohased osad: RUUM-VIS ptk 5.1–5.3, 7, 8–10, 11–12 + Jätkamispunkt; lokaalsed-mudelid (täies mahus); avastamata-vajadused ptk 1.2–2; ideed ptk 7 (meetod 32 outreach) + 28.8 viited. Kood [MAIN]: `public/sw.js` (no-op) + `site.webmanifest` + `ServiceWorkerRegistrar`; IndexedDB/OCR/field-kood = 0 vastet; `useSpeech.js` + `/api/stt` (limiidid); `ALLOWED_DOCUMENT_TYPES` (pdf/docx/txt); `/api/documents/audio-sources`+`transcribe` rada; `workspaceContinuity.js` (8 liiki); `PreInquiryStatus.DOWNLOADED` + `downloaded/route.js` (CAS-semantika); `DocumentKind` enum (8 väärtust); K1-P0 `field_visit` RESERVED [BRANCH, CASEWORK-A0 tõend].
- **Peamised tulemused:** välitöö = olemasolevate tööruumide mobiilne kest, MITTE andmesilo (3 uut mudelit + 1 enum-väärtus on kogu skeemijälg); offline-kiht on täna 0 (no-op SW on „puhas leht", millele kehtestati range leping 4.10); 9-olekuline üksuse sünkroonimismasin idempotentse PUT-i ja reconcile'iga (ptk 3); külastuspaketi whitelist + kohalik krüptitud lühiealine hoidla (ptk 4); STT/OCR/AI väljund = alati kontrollimata AI_MUSTAND kuni kinnituseni (ptk 5); turvasignaal = serveripoolne kontrollaken, mis töötab just võrguta olles (ptk 6); soovitus = installitav PWA samas koodibaasis (ptk 9); 10 otsust, neist 3 blokeerivat vaikevalikutega (ptk 10); üks kopeeritav FIELD-V1 pakett E1–E10 + DoD (ptk 11).
- **Järgmine töökord siin dokumendis:** (1) TEHTUD 17.07.2026 (FIELD-D0): O-FD-1/2/3 kinnitatud, ptk 10 märgitud, FIELD-V1 = `READY_THEME_BUILD` — haru avamine on koordinaatori teemajärjekorra otsus (ptk 11 leping on Sol/Terra-valmis); (2) kui CASEWORK-P0 või K1-P0 merge'itakse, uuenda ptk 8/11 tingimuslikud read; (3) kui U1-P0 valmib, lisa külastuse elutsüklisündmuste outbox-migratsiooni rida; (4) seadmematrixi tegelikud tulemused kanda ptk 9 alla pärast teostust.
- **Katkemise korral:** Edenemistabel + see punkt on tõeallikas; ptk 0 kontrollid on lukus 17.07 seisuga — uus sessioon teeb UUE kontrolli ja lisab uue rea, mitte ei muuda vana.

STATUS: COMPLETE
