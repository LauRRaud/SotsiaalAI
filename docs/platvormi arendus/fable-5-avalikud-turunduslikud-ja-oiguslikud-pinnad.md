# AVALIK-A0 — avalike, turunduslike ja õiguslike pindade lubaduste tervikaudit

Kuupäev: 2026-07-16
Autor: Fable (read-only analüüs; rakenduskoodi, teste, tõlkefaile, Prisma skeemi ega migratsioone ei muudetud; ei stage'itud, commit'itud, push'itud, merge'itud ega deploy'tud)
Skoop: `/`, `/meist`, `/autorilt`, `/voimalused`, `/hinnastus`, `/tellimus`, `/tooalase-kasutuse-raamistik`, `/privaatsustingimused`, `/kasutustingimused`, `/kasutusjuhend` + avalik navigatsioon (RoomStage karussell, LoginModal), metaandmed, robots/sitemap, jalus ning registreerimise nõustumiste kuvamine ainult avalike tekstide rakendumise tõendina.

Välistatud (valmis dokumendid on tõeallikad, ei korrata):
- Help/Teenusekaardi privaatsusaudit → `fable-5-teenusekaart-profiil-ja-abivahendus-tervikvoog.md` + Help P0 auditi seis koordinaatorilaualt (`3479a447` = **CHANGES_REQUIRED**, ootab Help-P0a parandust, mitte merge'i)
- vestluse tervikanalüüs → `fable-5-vestlusaken-haalvestlus-ja-toovoogude-kaivitamine.md` (VEST-A0)
- profiili/konto elutsükkel → `fable-5-profiil-ja-konto-elutsukkel.md` (PROF-A0)
- töölaud/järeltegevused → `fable-5-igapaevane-toolaud-ja-jareltegevused.md` (TÖÖLAUD-A0)
- O-TK9 otsustuspakett → `fable-5-teekond-o-tk9-sent-retention-otsus.md`
- RAG kvaliteet/elutsükkel → `fable-5-rag-kvaliteedi-mootmine-ja-otsingu-arendus.md`, `fable-5-rag-materjalide-elutsukkel-ja-automaatne-allikavarskus.md`
- koordinaatoriseis → `koordinaatori-handoff-2026-07-16.md`

---

## 1. Tõeallikas: neli seisundit

| Seisund | Väärtus | Tõend |
|---|---|---|
| GitHubi `origin/main` | `2a63fcd0` | lokaalne ref; sandboxist `git fetch` ebaõnnestus (SSH keelatud), ref langeb kokku koordinaatori handoff'i 16.07 kontrolliga |
| Lokaalne `main` | `890124bd`, `origin/main`-ist 4 commit'i maas | `git status -b`; vahe on ainult RAG-P8.0 dokid/skriptid/testid (`git diff --stat main origin/main`), **avalikke lehti ei puuduta**: `git diff --name-only main origin/main -- app/ components/` = tühi |
| Lokaalsed commit'imata muudatused | `app/layout.js` (+PanelInfoSlotProvider mähis, read 10, 360–364), stiilid, workspace/room/journey komponendid, untracked dokid | `git status`; ükski muudatus ei muuda avalike lehtede lubadustekste; `app/layout.js` diff on ainult ⓘ-sloti provider |
| Live-server | `main @ 890124bd`, `sotsiaalai-frontend.service`, `sotsiaalai-rag.service`, `sotsiaalai-notifications.timer` aktiivsed | koordinaatori handoff 2026-07-16 (read-only SSH kontroll); käesolevas auditis lisaks avalike lehtede HTTP-runtime (ptk 12) |

Järeldus: **avalike pindade osas on main = origin/main = server** (sisuliselt identsed; 4 vahecommit'i ei puuduta app/ ega components/). Lokaalsed muudatused ei muuda avalikke lubadusi.

Harudel (EI ole main-is ega serveris; ei tohi avalikult lubada valminuna):
- U6 isiklik otsing — `opus/u6-personal-search` @ `ada42497`, auditeeritud, ootab merge-luba
- U7 selge keel — `codex/u7-plain-language` @ `657d3c68`, auditeeritud, ootab merge-luba
- U9 rolliteadlik osalejakutse — `codex/role-aware-invite-copy` @ `ead1d8d1`, auditita
- `claude/clever-bassi-243deb` (05.07) — 21 i18n-võtit `app/meist/page.jsx`/`app/page.js`/`app/layout.js` puutega, merge'imata
- DOK-XTEN-P0, ADMIN-P0.1(+a), Help-P0 (`3479a447` CHANGES_REQUIRED), RAG-QM-P0(a), SUP-P0, Tööheaolu E0 — kõik ainult harudel

**Kontroll punktile 3 (U6/U7/U9 enneaegne esitlemine): PASS.** Ühelgi avalikul lehel ei mainita isiklikku otsingut, selge keele režiimi ega rolliteadlikku osalejakutset. `voimalused.*`, `meist.*`, `about.guide.*` ei sisalda neid funktsioone. Avalik lubadustik kirjeldab main-i/serveri seisu, mitte harusid.

---

## 2. Arhitektuur: kuidas avalikud pinnad on ehitatud

Kõik 10 lehte on õhukesed serverikomponendid (19–54 rida), mis loevad sisu i18n-failidest (`messages/{et,en,ru}.json`) ja renderdavad `components/alalehed/*Body.jsx` kliendikomponendi. Metaandmed tulevad `lib/metadata.js` → `buildLocalizedMetadata()` kaudu. Navigatsioon on avalehe ruumikarussell (`components/room/RoomStage.jsx` `publicItems` read 740–753; sisselogitule `teaveItems` read 757–772) + iga alalehe `SubpageHeader` tagasi-nupp. Klassikaline päis/jalus puudub; jalus on ainult poliitikalehtedel `lib/footerNote.js` (`SotsiaalAI © <jooksev aasta>` — dünaamiline, ei aegu). Keelevalik on **küpsisepõhine** (`NEXT_LOCALE`, `app/layout.js:310–311`); `lib/localizePath.js:12–20` on teadlikult lokaadineutraalne (strippib /et|/en|/ru prefiksid).

---

## 3. Sihtrühmad ja rollijärjepidevus (küsimus 1)

| Leht | Sihtrühm | Hinnang |
|---|---|---|
| `/` (ruumi kõnnitekst) | kõik kolm rolli, nimetatud esimeses lauses (`room.walk_1`) | ✔ rollid samas sõnastuses kui registreerimisel |
| `/meist` | kõik kolm rolli (p1: „kui otsid selgust…, töötad spetsialistina või osutad teenuseid") | ✔ |
| `/voimalused` | segapublik; s5/s6/s11/s13/s14 eristavad pöörduja/spetsialisti/osutaja vaate | ✔ |
| `/hinnastus` | neli veergu: Tasuta / Pöördujale / Spetsialistile / Teenuseosutajale | ✔ ühtne rollisõnastus |
| `/autorilt` | üldpublik/taust | ✔, aga leht on orvuke (ptk 10) |
| `/kasutusjuhend` | uus kasutaja | ✔; rollivalik „pöörduja, teenuseosutaja või sotsiaaltöö spetsialist" = registreerimisvormi `role_hint`-iga kooskõlas |
| `/tooalase-kasutuse-raamistik` | spetsialist/osutaja, kes töötleb kliendi isikuandmeid org-i nimel | ✔ kitsam sihtrühm selgelt piiritletud |
| `/privaatsustingimused`, `/kasutustingimused` | kõik; §4/§8 eristavad isikliku ja tööalase kasutuse | ✔ |
| `/tellimus` | sisselogitud kasutaja (robots disallow) | ✔ |

Rollinimed on läbivalt järjepidevad: „eluküsimusega pöörduja", „sotsiaaltöö spetsialist", „teenuseosutaja". Erandid: kasutusjuhendi kohati „sotsiaaltöötaja" asemel alati „sotsiaaltöö spetsialist" — kontrollitud, kõrvalekallet ei leitud; `role_hint` kasutab „Teenuse osutaja" (tühikuga) vs mujal „Teenuseosutaja" (P3 kosmeetika).

---

## 4. Funktsioonilubadused vs main/serveri kood (küsimus 2)

`voimalused.s1–s14`, `meist.p3–p7` ja kasutusjuhendi kirjelduste vaste koodis:

| Lubadus | Kood (main = server) | Verdikt |
|---|---|---|
| Vestlusaken + allikad iga vastuse juures | `/vestlus`, RAG-allikad; VEST-A0 kinnitab põhivoo | ✔, aga vt kriisierand ptk 9 |
| Hääl (dikteerimine/ettelugemine) | `app/api/stt/route.js`, `app/api/tts/route.js` | ✔ |
| Töövood vestlusest: abisoov/abipakkumine/süvauuring/dok-analüüs | `lib/chat/requestBootstrap.js`, plusmenüü | ✔ |
| Teadmusbaas + allikakontroll | RAG-teenus; värskuse/elutsükli detailid RAG-dokides | ✔ (lubadus „hoitakse ajakohasena" on protsessilubadus — RAG-elutsükli dok näitab, et automaatne värskus on alles arendusjärgus; sõnastus on ettevaatlik, talutav) |
| Teekond privaatne, jagamine ainult kinnitusega | TK-analüüs: jagamispiiri **TK-P0 turvaparandus on tegemata** (fail-closed piir puudub serveris); O-TK9 retention-otsus lahtine | ⚠ lubadus „midagi ei liigu edasi ilma sinu kinnituseta" on UI-tasandil tõene, kuid serveripiir on nõrgem — vt `fable-5-teekond-eelpoordumine-ux-ja-navigeerimine.md` ptk 15 |
| Privaatsuse eelkiht enne saatmist | `lib/privacy/privacyGuard.js`, `lib/privacy/openaiPrivacyFilter.js` (lokaalne OPF-protsess) | ✔ |
| Eelpöördumine 3 alustusviisi | eelpöördumiste moodul; TÖÖLAUD-A0 kinnitab | ✔ |
| Abisoovid/-pakkumised + Teenusekaardil nähtavad | olemas; **avalik projektsioon lekib privaatvälju** (Help P0 `3479a447` CHANGES_REQUIRED) | ⚠ funktsioon on olemas, privaatsuslubadus on rikutud serveris kuni Help-P0a deploy'ni |
| Vestlusruumid + helikõne „ei salvestata" | `lib/calls/*`; kõnesalvestuse väide kuulub RUUM-A0 (pooleli) kontrolli | ⟳ RUUM-A0 kinnitab/lükkab ümber; siin `not_run` |
| Dokumendi koostamine/analüüs, DOCX/PDF eksport | dokumendimoodul; DOK-XTEN-P0 cross-tenant parandus on **serveris veel puudu** | ⚠ vt ptk 7(b) |
| Kovisioon | main-is ja serveris (`7f20d7ce` esivanem) | ✔ ainus suur lubadus, mis on täielikult „valmis ja serveris" |
| Tööheaolu 10 tööriista (kasutusjuhend §8) | leht ja töövood serveris; E0 parandused ainult harul | ✔ põhilubadus; E0-eelne käitumine serveris |
| Materjalide esitamine ülevaatusega | materjalimoodul + admin review | ✔ |
| Teenusekaart + teenuseprofiil | olemas; markeri-CSS jm V6/O1 harul | ✔ põhilubadus |

---

## 5. Hinnastus, tasuta/tasuline, tellimus, limiidid, sponsoreeritud kasutus vs serveriväravad (küsimus 4)

Hinnad on kolmes keeles identsed (kontrollitud programselt): 0 / 7,99 / 14,99 / 19,99 € kuus. Serveripool: `lib/subscriptionPlans.js:1–3` (7.99/14.99/19.99) ja `lib/usage/planSeeds.js` (plan_free_v1 0.00; client 7.99; social_worker 14.99; provider 19.99). **Hinnad klapivad.**

| Avalik väide | Tegelik värav | Verdikt |
|---|---|---|
| Hinnastuse „Tasuta" pakett: Töölaud (lihtne), abisoovid/-pakkumised, Teenusekaart; teadmusbaas/assistendid „–" | `plan_free_v1` entitlements = `[]` (`planSeeds.js:8–16`); kasutusteenus on fail-closed: puuduv entitlement → `USAGE_NOT_ENTITLED` (`lib/usage/service.js:175`); tellimuseta kasutaja saab AI-vestluse **ainult** abisoovi/-pakkumise töövoos (`lib/chat/subscriptionGate.js:1–38` FREE_HELP_CHAT_INTENTS) ja sobitusruumis (`lib/rooms/access.js:21–26` HELP_MATCH_FREE); muu → `requireSubscription` 402 + suunamine `/tellimus` (`lib/authz.js:64–101`) | ✔ tabeli read vastavad väravatele; „Töölaud (lihtne)" jäi ilma DB-ta runtime'is kinnitamata (`not_run`), kooditasandil töölaua leht tellimust ei nõua |
| „Alusta tasuta" jm nupud | kõik 4 nuppu `disabled` + tooltip `auth.register.closed_notice` (`HinnastusBody.jsx:211–219`) | ⚠ CTA-d on teadlikult suletud (launch-lukk), kuid `title`-atribuut disabled-nupul ei ole ligipääsetav selgitus (P2/a11y) |
| Tellimus on rollipõhine kuutellimus, pikeneb automaatselt, tühistatav | `subscription.*` UI + Maksekeskus recurring; `Subscription` mudel `prisma/schema.prisma:802–821` | ✔ |
| Terms §5: pöörduja 7,99, spetsialist 14,99 — **teenuseosutaja hind puudub** | osutaja 19,99 on hinnastuses, tellimuse UI-s (`subscription.active.summary`) ja seemnetes | **P1**: õigustekst ei kata üht müüdavat paketti (kõigis 3 keeles); ka kasutusjuhend §3.2/§13 nimetab ainult 7,99/14,99 |
| Terms §5: sponsoreeritud ligipääs 1 kuu; ei muutu automaatselt tasuliseks; oma aktiivse tellimuse korral võib sponsormakse olla blokeeritud | `app/api/invites/[id]/accept/route.js:299` `addOneMonth`, `:330` `billingSource: SPONSORED_BY_HOST`, aktiivse tellimuse kontroll `:99` | ✔ täpne |
| Terms §6 limiidid: 50 pööret/vestlus; süvauuring 1 aktiivne töö + „päevane kasutuspiirang"; sama dokumenti kuni 3× järjest; kuni 10 faili korraga, 100 MB päevas | 50: `lib/chat/guardrails.js:1–3`. 1 aktiivne töö: `lib/research/jobStore.js:225–229`. Refine 3: `app/api/documents/artifacts/refine/route.js:36,123`. 10 faili: `lib/storageGuardrails.js:6`. 100 MB/päev: `lib/storageGuardrails.js:5` | ✔ neli viiest täpselt; **„päevane" süvauuringu piirang on tegelikult KUINE** (`DEEP_RESEARCH_RUN` `MONTHLY` 2/6/12, `planSeeds.js:30,50,70`; päevast akent koodis pole) → P2 õigusteksti täpsusviga |
| `subscription.info`: „SotsiaalAI kasutamiseks on vajalik igakuine tellimus" | vs hinnastuse „Tasuta pakett sobib alustamiseks" ja tasuta abivoog | **P2 vastuolu**: kaks avalikku pinda räägivad tasuta kasutusest eri juttu (vt otsus O-AV2) |
| Registreerimisel luuakse konto | `app/api/register/route.js:53` `REGISTRATION_OPEN = false` (kõvakodeeritud launch-lukk; 403 `:166–169`) + klient `RegistreerimineBody.jsx:26` `isRegistrationOpen = false`; LoginModal registreerimislink `aria-disabled` (`LoginModal.jsx:1349–1359`) | ✔ järjepidevalt suletud kliendis ja serveris; avalehe `room.walk_2b` „Platvorm on arendamisjärgus ja avatakse peagi" toetab sama sõnumit |

Vaba tekstina: sponsoreeritud kutse tegelik maksesumma on `DEFAULT_SPONSORED_INVITE_AMOUNT = 4` €/roll-põhised env-overrided (`lib/subscriptionPlans.js:4,67–86`) — seda avalikud tekstid ei luba ega pea lubama; vastuolu pole.

---

## 6. Privaatsustingimused vs tegelik andmekäitlus (küsimus 5)

a) **Vestlused ja ChatLog.** Poliitika §2.2 deklareerib vestluste/sõnumite töötluse; §2.3 tehnilised sündmused; §10 lubab, et rakenduse logidesse ei salvestata vestluse sisu. Kood: `ChatLog` on sündmuslogi (`prisma/schema.prisma:1402–1414`: userId/role/event/data), mitte sisulogi; VEST-A0 runtime kinnitas sündmuspõhisust. Retention §7.3 „kuni 90 päeva viimasest aktiivsusest" = `lib/retention.js:196–246` (`conversations` lastActivityAt < 90 p; `chatLogs` 90 p). **Vastab.**

b) **RAG ja dokumendid.** §7.5/§7.6 (90 p; kustutus käivitab RAG-viite kustutuse; ebaõnnestumisel jääb kustutustöö kirje) = `lib/retention.js:317–402` (`deleteDocumentRagReference`, `deleteTrackedStorageFile`, `DataDeletionJob` retry `:90–116`). **Tekst vastab koodile.** Sisuline auk on teisal: §6 „Kasutaja isiklikud vestlused ja dokumendid on seotud kasutaja kontoga" + §4.9 rollipõhine ligipääs **ei kehti täna serveris täielikult** — DOK-XTEN-P0 cross-tenant RAG-leke on parandatud ainult harul (sõltumatu PASS), serveris parandamata (koordinaatorilaud). Avalik lubadus on õige sihtseis, serveri tegelikkus mitte → deploy-kiirus on juba eskaleeritud, siin ainult tõendipunkt.

c) **Süvauuring.** §1/§2.2 nimetavad süvauuringu päringud ja töö metaandmed; kood: `researchJob` tabel, 1 aktiivne töö, usage-arvestus. **Vastab** (limiit-perioodi sõnastusviga on terms'is, mitte privaatsuses).

d) **Heli, STT ja TTS.** §4.3/§5 nimetavad OpenAI ja Google Cloud TTS. Kood: STT = OpenAI `gpt-4o-mini-transcribe` (`app/api/stt/route.js:24`); TTS = Google primaarne, **OpenAI TTS fallback** (`app/api/tts/route.js:2,121–146`). OpenAI on §5 loetelus olemas („teatud tehisintellekti funktsioonide jaoks") → kaetud. Ruumikõne „ei salvestata" väite kontroll kuulub RUUM-A0-le (`not_run` siin). **Vastab.**

e) **E-post ja teavitused.** Kinnituskiri (`app/api/register/route.js:289–324`; TTL `:291` `EMAIL_VERIFY_HOURS || 24`), OTP-kirjad, teavitustimer serveris aktiivne (handoff). §5 nimetab „e-posti, logimise ja monitooringu pakkujaid" kategooriana, nimetamata konkreetset SMTP-pakkujat — hedge on olemas; kui pakkuja on EMP-väline, vajaks nimetamist (jurist, O-AV-J2). **Vastab miinimumile.**

f) **Sessioonid ja küpsised.** §7.2 TTL-id vs kood: e-posti kinnituslink 24 h (`EMAIL_VERIFY_HOURS || 24`, register route), PIN-i lähtestamine 60 min (`app/api/auth/password/reset/route.js:14`), ühekordne kood 15 min ja ajutine token 15 min (`lib/auth/pin-login.js:11–12`), usaldatud seade 30 päeva (`lib/auth/pin-login.js:13`); aegunud kirjete regulaarne koristus = `lib/retention.js:118–174`. §9 „ainult hädavajalikud küpsised, reklaamijälgijaid pole" — koodis kolmandate osapoolte analüütika/jälgijate laadimist ei leitud (ainult enda mõõdikud). **Täpne vaste, viie väärtuse peal 5/5.**

g) **Konto kustutamine ja retention.** §7.7/§7.9 = `lib/privacy/userDeletion*.js`, `DataDeletionJob` retry retention-sweep'is, maksed 7 a (`PAYMENT_RETENTION_DAYS`, `lib/retention.js:18–21`), toore payload'i kärpimine 90 p (`:404–413`). Detailne konto-elutsükli hinnang on PROF-A0-s; siinne kontroll: **avalik tekst vastab koodile.** Märkus: `frameworkAcceptance` kirjeid retention-sweep EI kustuta — §7.9 erand („pikem säilitamine aktsepteerimise tõendamiseks") katab selle sõnaliselt ✔.

h) **Auditilogid ja kasutusmõõdikud.** §10 minimeerimislubadus = `safeError`, sisuvabad auditikirjed (`lib/privacy/audit.js`), `documentAudits` 90 p (`retention.js:396–402`), usage-mõõdikud entitlement-põhised. **Vastab** (sama minimeerimisleping, mida varasemad auditid kontrollisid).

i) **Välised mudeli-/taristuteenused.** §5 loetelu (Zone Media, Maksekeskus, OpenAI, Google TTS, e-post/monitooring) vs kood: muid LLM-pakkujaid ei leitud (Anthropic/Gemini/Mistral greppe 0 vastet lib/ ja app/api all); „OpenAI Privacy Filteri mudel serveris lokaalselt" (§4.10) = `lib/privacy/openaiPrivacyFilter.js:1–24` — tõesti lokaalne spawn-protsess, mitte API-kutse. **Loetelu on täielik ja täpne.**

Kokkuvõte: privaatsuspoliitika on koodiga erakordselt hästi joondatud — TTL-id, retention-numbrid, töötlejate loetelu ja logiminimeerimine klapivad rida-realt. Peamine kääre pole tekstis, vaid serveri deploy-mahajäämuses (DOK-XTEN, Help P0) ja need on juba eraldi pakettidena teel.

---

## 7. Kasutus- ja tööalase raamistiku nõustumis-, versiooni- ja tõendusmudel (küsimus 6)

| Nõustumine | Kuvamine | Persist? | Tõend |
|---|---|---|---|
| Kasutustingimused + privaatsus (`auth.register.agreement`) | reg-vormi checkbox, valideeritakse kliendis (`RegistreerimineBody.jsx:309–313`) | **EI** — `agree` ei liigu POST-i kehas (`:316–331`) ega salvestu | **P1 tõendusauk**: nõustumise aeg/versioon puudub; ainult kaudne („konto olemasolu eeldab nõustumist") |
| Kasutusjuhendiga tutvumine (`guide_ack`) | checkbox | **EI** (sama) | sama auk (madalam kaal — informatiivne kinnitus) |
| Tööalase kasutuse raamistik (`worker_framework_ack`, ainult SW/SP + `workerUse=ORG_IDENTIFIABLE`) | eraldi samm: ava raamistik, laadi DOCX + allkirjastatud DigiDoc | **JAH** — `frameworkAcceptance` kirje: frameworkKey, **versioon** (`WORKER_FRAMEWORK_VERSION = "2026-07-06"`, `lib/frameworkAcceptances.js:6`), acceptanceType/source, roleAtAcceptance, locale, IP, UA, acceptedAt, reviewDocumentOpenedAt, signedDocumentDownloadedAt (`app/api/register/route.js:250–266`) + genereeritav kinnitusdokument (`createFrameworkAcceptanceDocument`) + admin-vaade (`app/api/admin/framework-acceptances/route.js`) | ✔ tugev, versioonitud, tõendatav mudel |
| Makse-eelne nõustumine (`subscription.checkout.agreement`) | kohustuslik checkbox enne Maksekeskust | kontrollimata (tellimusvoo runtime `not_run`) | tõendipunkt PROF/tellimuse paketile |
| Tellimuseta/raamistikuta serveripiir | `requireSubscription` 402; `requiresFramework && !frameworkAck` → 400 (`register/route.js:224–228`) | — | ✔ värav on serveris, mitte ainult UI-s |

Failid on olemas ja lingid terved: `/legal/sotsiaalai_tooalase_kasutuse_raamleping.docx` + `.asice` + EN/RU DOCX-id (`public/legal/`, `lib/frameworkAcceptances.js:14–19`); leht laeb täisteksti `docs/legal/sotsiaalai_raamleping*_extracted.txt`-st (`lib/frameworkDocument.js:4–13`). Terms §8 ja privaatsus §4.7 ütlevad selgelt, et töötaja kinnitus EI seo organisatsiooni ilma nõuetekohase allkirjata — kood toetab (eraldi allkirjastatud DigiDoc-i allalaadimiskinnitus). Mudel on avalike tekstidega kooskõlas; ainus auk on üldnõustumiste (terms/privacy) tõendikirje puudumine (leid L-07).

---

## 8. Kriisiabi, professionaalse vastutuse ja AI piirangute sõnastus vs VEST-A0 (küsimus 7)

- **AI piirangud:** terms §2/§7/§9 („teenus ei ole hädaabikanal", „väljund on mustand", „AI võib eksida", inimotsuse primaarsus) + privaatsus §4.3/§4.4 + `meist.p4` + `voimalused.s4` — järjepidev, kolmes keeles, ja vastab tegelikule tootedisainile (kinnita-enne-kasutust vood). ✔
- **Professionaalne vastutus:** terms §8 + raamistik + „AI valmistab ette, spetsialisti ta ei asenda" (`meist.p4`) — kooskõlas. ✔
- **Kriisiabi:** siin on lubaduse ja serveri käik lahku:
  - `voimalused.s4`: „Kui kirjeldatud olukord on kiireloomuline, **kuvame kohe** õiged kontaktid — 112, Lasteabi ja Ohvriabi." Kasutusjuhend §5: „kuvatakse punane teavitus kiire abi juhistega."
  - VEST-A0 (tõeallikas): **VEST-L1 P0** — kriisivastus ja bänner kaovad just kriisis (allikateta kriis → tühi vastus; hüdratsioon kirjutab bänneri üle; 502 teel bännerit ei teki); **L1d** — abisoovi/dokumendi töövoos on `isCrisis: false` kõvakodeeritud (`workflowBranchHandlers.js:82,276,341,468,537`); **L1e** — detektor on ainult eestikeelne, RU/EN kriisisõnum ei käivita rada, kuigi avalik lubadus on kolmes keeles. Need defektid on live-serveri koodis; VEST-P0 parandus on järjekorras (Help-P0a järel).
  - Terms §7 on ettevaatlikum („**võib** kuvada kiire abi juhiseid") — õigustekst on ok; turundustekst (`voimalused.s4`, juhend) lubab kategooriliselt rohkem, kui server täna teeb → **L-04 (P1)**. Lahendus ei ole siin uut analüüsi teha, vaid: (a) VEST-P0 deploy sulgeb käitumise augu; (b) kuni selleni võiks `voimalused.s4`/juhendi sõnastust pehmendada või VEST-P0 ette tõsta (tooteotsus O-AV5).

---

## 9. CTA-d, siselingid, nupud, rajad (küsimus 8)

Avalehe karussell (runtime-kinnitatud): Tutvu võimalustega → `/voimalused` ✔; Kasutusjuhend ✔; Logi sisse (modaal) ✔; Kasutustingimused ✔; Privaatsuspoliitika ✔; Hinnastus ✔; Paigalda (PWA-modaal) ✔; Kontakt (modaal: OÜ, reg-kood 14206225, Tabasalu aadress, info@sotsiaal.ai) ✔; Meist ✔. Sisselogitu „Teave" komplektis lisaks Raamleping → `/tooalase-kasutuse-raamistik` ✔.

Leiud:
- **`/autorilt` on orvuke**: sitemap'is (`app/sitemap.js:13`), aga mitte üheski UI-komplektis (grep: ainus viide `app/sitemap.js`). Kasutaja ei jõua lehele ilma URL-i teadmata. (L-09, P2)
- **`/meist` puudub sitemap'ist** (`app/sitemap.js:6–15` loetelus pole), kuigi leht on olemas, linkitud ja ainsana korraliku metakirjeldusega. (L-09)
- **Kasutusjuhendi `/#meist` ankrud on katkised**: `about.guide.sections_v2.{home,chat,about,before_use,quickstart}.body` viitavad `/#meist` jaotisele; `id="meist"` ei eksisteeri üheski komponendis (grep 0 vastet). Juhend kirjeldab vana keritavat avalehte („MEIST asub avalehel allpool, sisselogimise ja registreerimise all") — praegune avaleht on ruumikarussell. (L-08, P2)
- Registreerimisrada: juhend kirjeldab avatud registreerimist samm-sammult, ent registreerimine on suletud (teadlik launch-lukk). Juhendis pole „praegu suletud" märget — talutav eelavamise seisus, aga vt O-AV6. Hinnastuse nupud `disabled` + ainult `title`-tooltip (`HinnastusBody.jsx:216`) — puuteseadmel ja ekraanilugejal selgituseta. (L-12, P3/a11y)
- Terms §5 sisaldab tooreid siselinke i18n-HTML-is (`<a href="/tellimus">`, `<a href="/profiil">`) — kuna marsruudid on lokaadineutraalsed, lingid töötavad kõigis keeltes ✔; kasutusjuhend kasutab `localizeInternalHtmlLinks` ✔.
- OSKA väline link (`MeistBody.jsx:11` → uuringud.oska.kutsekoda.ee), Riigi Teataja, EUR-Lex, aki.ee (`PrivaatsusBody.jsx:12–25`) — kõik `target=_blank rel=noopener` ✔; sihtkohtade elususe süvakontrolli ei teinud (välised lehed, `not_run`).
- `mailto:info@sotsiaal.ai` kontaktmodaalis ja terms §5-s ✔ (aadress = privaatsuspoliitika kontakt ✔).

---

## 10. ET/EN/RU pariteet, hardcode'id, loetavus, a11y, mobiil (küsimus 9)

- **Võtmepariteet on täielik**: programne kontroll üle avalike nimeruumide (`meist, voimalused, privacy, terms, room, nav, about, subscription, auth.register, auth.login`) — et/en/ru võtmed 1:1, 0 puuduvat, 0 tühja väärtust; hinnad kolmes keeles identsed. See on erakordselt hea seis.
- **Hardcode'id:** (1) root-layout'i vaikimisi `description` on eestikeelne kõigile keeltele (`app/layout.js:237`) — mõjutab ainult lehti, millel oma metadata puudub; (2) raamistikulehe `DEFAULT_DESCRIPTION` on inglise keeles kõigile (`app/tooalase-kasutuse-raamistik/page.jsx:7`); (3) `TooalaseRaamistikuBody.jsx:28–171` hoiab ET/EN/RU tekste komponendis, mitte messages-failides (töötab, aga erineb ülejäänud i18n-mustrist). (L-13, P3)
- **Keelevalik** on küpsisepõhine; `/en/...` ja `/ru/...` URL-id **suunatakse tagasi** prefiksita aadressile (runtime: `/en/voimalused` → 3xx → `/voimalused`). Tagajärg SEO-le ptk 11-s; funktsionaalselt keelevahetus töötab (Keel ja ligipääsetavus modaal).
- **Loetavus:** poliitikatekstid on pikad, kuid liigendatud (§-pealkirjad, loendid); `policyScrollKeyboard.js` annab klaviatuurikerimise; `SubpageHeader` + `aria-labelledby` + `role=region` ✔. Kasutusjuhendi `dangerouslySetInnerHTML` sisu tuleb omaenda i18n-failist (usaldatav allikas) ✔.
- **Mobiil:** `data-layout=mobile` lülitus (`app/layout.js:175–187`), `viewport-fit=cover`, PWA-paigaldus; hinnastustabel on lai — horisontaalkerimine mobiilis on tõenäoline, DB-vaba runtime seda ei kinnitanud (`not_run`, väike risk).
- **A11y tugevused:** skip-link, `room-static-copy` ekraanilugejale/otsimootorile (`app/page.js:24–52`), fondi/kontrasti/liikumise seaded, `format-detection` väljas. Nõrkus: L-12 (disabled-nupu tooltip) ja kasutusjuhendi lubadus „Teema: Hele või Tume" — teemad on lukus „Hämar" peale (`app/layout.js:137–141`, kommentaar „LUKUS (07.07): ainult Hämar avaldatud"); ka profiili-juhend kordab hele/tume lubadust (L-06, P2).

---

## 11. SEO, metaandmed, canonical/robots, jagamisvaated (küsimus 10)

**Keskne leid (L-01, P1):** i18n-failides puudub kogu `meta.*` nimeruum (kontrollitud: `meta` võtit pole üheski keeles). Kõik lehed peale `/meist` küsivad `messages.meta.<leht>` → `{}` → `buildLocalizedMetadata({title: "", description: ""})`. Runtime kinnitas serveris:
- `/voimalused`, `/privaatsustingimused` (ja sama mustriga `/hinnastus`, `/kasutustingimused`, `/kasutusjuhend`, `/tellimus`, `/autorilt`): **`<title>` puudub üldse, description puudub, og:title/og:description puuduvad**; alles on ainult og:site_name/type/url + canonical.
- `/` : title „SotsiaalAI" ✔ (kõvakodeeritud lühititel, teadlik — `app/page.js:14–16` kommentaar), kuid description puudub (meta.home puudub).
- `/meist`: title „Meist" + täiskirjeldus + og/twitter ✔ — ainus täisväärtuslik jagamisvaade; tõestab, et mehhanism töötab ja viga on ainult puuduvates võtmetes.

Muud:
- **Canonical** on igal lehel ✔ (`lib/metadata.js:6–15`).
- **hreflang/alternates on sisutühjad**: `localizePath` on lokaadineutraalne → `alternates.languages.{et,en,ru}` on kolm identset URL-i; sitemap genereerib iga lehe **kolmekordselt** sama URL-iga (`app/sitemap.js:18–38` × lokaadineutraalne localizePath). EN/RU sisu pole URL-iga adresseeritav (küpsisepõhine) → otsimootor ei saa EN/RU versioone indekseerida. Kui mitmekeelne SEO on eesmärk, on see arhitektuuriotsus (O-AV4); kui ei, tuleks hreflang/duplikaadid eemaldada. (L-10, P2)
- **Jagamispilt puudub**: `twitter:card = summary_large_image` ilma ühegi pildita (`lib/metadata.js:40–45`, `openGraph.images` ei seata kusagil) → suurte kaartide lubadus ilma pildita; sotsiaaljagamine renderdub kehvalt. (L-10, P2)
- **robots.txt** ✔ (runtime-kinnitatud): privaatsed rajad disallow, sh `/tellimus`; sitemap-viide olemas. `/ru/...`/`/en/...` disallow-read on pärast lokaadineutraalsust surnud read (kahjutud).
- **SSR-sisu:** `/privaatsustingimused` täistekst on server-HTML-is ✔ (hea SEO-le ja arhiveeritavusele); `/meist` ja `/voimalused` fetch'is artiklisisu ei ilmunud — tõenäoline ekstraktori artefakt, kuid vajab brauserikinnitust enne kui SSR-i puudumist väita (`not_run`; kui sisu tõesti ei SSR-du, tõuseb L-01 mõju).
- Struktuurandmeid (JSON-LD Organization vms) pole — valikuline parendus (P3).

---

## 12. Runtime-kontrollid

Meetod: avalikud lehed päris HTTPS-päringutega (`https://sotsiaal.ai`), ilma autentimiseta; autenditud kontrolle EI tehtud, sest registreerimine on serveris suletud (`REGISTRATION_OPEN=false`) ja analüüsisandboxist puudub DB-ligipääs — sünteetilise konto rada polnud võimalik puhtalt läbida → `not_run`. Jääke ei tekitatud (0 kontot, 0 kirjet).

| Kontroll | Tulemus |
|---|---|
| `GET /` | 200; title/og:title „SotsiaalAI"; description puudub; kõnnitekst SSR-is (sh „Platvorm on arendamisjärgus ja avatakse peagi"); karusselli 9 CTA-d nähtavad; „Logi sisse — 3 / 9" positsiooniindikaator |
| `GET /voimalused` | 200; **title/description/og puuduvad** (ainult site_name/type/url + canonical) |
| `GET /privaatsustingimused` | 200; **title puudub**; täistekst §1–§11 + §4.10 SSR-is; viidatud õigusaktilingid renderduvad; jalus „SotsiaalAI © 2026" |
| `GET /meist` | 200; title „Meist" + täielik description/og/twitter — ainus täismetaga leht |
| `GET /en/voimalused` | **3xx → `/voimalused`** (lokaadiprefiksiga URL-e ei eksisteeri) |
| `GET /robots.txt` | 200; ootuspärane disallow-loend + sitemap-viide |
| `GET /sitemap.xml` | 200 (XML; sisu hinnatud koodist: iga URL 3×, `/meist` puudub) |
| Autenditud rajad (tellimus, checkout-nõusolek, töölaud tasuta paketiga, hinnastustabel mobiilis) | `not_run` — põhjus ülal; staatilised järeldused on märgitud koodiviidetega, mitte runtime-tõendina |
| Väliste linkide (OSKA, RT, EUR-Lex, AKI) elusus | `not_run` (välised teenused) |

---

## 13. Lehtede ja lubaduste vastavusmaatriks

Veerud: peamine lubadus → kood main-is → serveris → verdikt (✔ vastab / ⚠ osaline / ✖ ei vasta / ⟳ teise auditi skoop).

| Pind | Peamised lubadused | main | server | Verdikt |
|---|---|---|---|---|
| `/` kõnnitekst | 3 rolli; arendusjärgus, avaneb peagi; küsi-koosta-vestle; allikad nähtavad; sina otsustad jagamise | ✔ | ✔ (runtime) | ✔ aus eelavamise sõnum |
| `/meist` | digikeskkond; vestluskeskne; AI ei asenda spetsialisti; kriisis suuname kohe; Töölaud/ruumid/Teenusekaart; sotsiaalne ettevõte | ✔ | kriisilubadus ⚠ (VEST-L1) | ⚠ ainult kriisirida |
| `/autorilt` | ajalugu 2017→2026; funktsioonide loetelu p7–p9; „abisoovid/-pakkumised tasuta kõigile" | ✔ (tasuta abivoog kinnitatud koodis) | ✔ | ✔; leht ise orvuke (L-09) |
| `/voimalused` | 14 funktsiooniplokki; s4 kriisikontaktid „kuvame kohe"; s8 kõnet ei salvestata | valdavalt ✔ | s4 ⚠ (VEST-L1/L1d/L1e); s8 ⟳ RUUM-A0 | ⚠ |
| `/hinnastus` | 4 paketti, hinnad, feature-maatriks, „ükski AI-maht pole piiramatu" | ✔ hinnad = seemned; maatriks = väravad | ✔ | ✔ (nupud teadlikult suletud) |
| `/tellimus` | rollipõhine kuutasu, auto-pikenemine, tühistus, sponsoreeritud 1 kuu | ✔ | `not_run` (autenditud) | ✔ koodi tasandil |
| `/tooalase-kasutuse-raamistik` | versioonitud raamleping, DOCX/DigiDoc allalaadimine, kinnituse tõendus | ✔ failid + acceptance-mudel | ✔ (failid avalikud) | ✔ tugevaim õiguslik pind |
| `/privaatsustingimused` | TTL-id, 90p/7a retention, töötlejad, logiminimeerimine, õigused | ✔ rida-realt (ptk 6) | ⚠ ainult DOK-XTEN/Help deploy-mahajäämus | ✔ tekst; ⚠ serveri seis |
| `/kasutustingimused` | §5 hinnad (**osutaja puudub**), §6 limiidid (süvauuring „päevane" ≠ kuine), §7–§9 AI piirangud | ⚠ kaks täpsusviga | sama | ⚠ |
| `/kasutusjuhend` | registreerimisjuhis; teema hele/tume; `/#meist` ankrud; 13 jaotist | teema ✖ (lukus mid); ankrud ✖; hinnad osutajata ⚠ | sama | ⚠ vajab värskendust |
| Navigatsioon/CTA | 9 avalikku kaarti + Teave-komplekt | ✔ | ✔ (runtime) | ✔ |
| Metaandmed | title/description/og igal lehel | ✖ `meta.*` puudub | ✖ (runtime) | ✖ L-01 |

---

## 14. Leiud P0–P3

P0 leide käesolev audit ei lisa: kriitilised turvateemad (DOK-XTEN-P0, Help-P0, VEST-P0/L1) on juba tuvastatud, paketistatud ja koordinaatorilaual; avalikud pinnad ise ei tekita uut P0 (registreerimine on suletud, eksitav lubadus ei saa täna kasutajat kahjustada maksete ega andmete kaudu).

| # | Leid | Raskus | Viide |
|---|---|---|---|
| L-01 | `meta.*` nimeruum puudub kõigis keeltes → title/description/og tühjad kõigil avalehtedel peale `/` (osaline) ja `/meist`; runtime-kinnitatud serveris | **P1** | `messages/et.json`/`en.json`/`ru.json` (võti puudub); tarbijad: `app/voimalused/page.jsx:10`, `app/hinnastus/page.jsx:10`, `app/tellimus/page.js:10`, `app/privaatsustingimused/page.js:9`, `app/kasutustingimused/page.js:9`, `app/kasutusjuhend/page.jsx:10`, `app/autorilt/page.jsx:10`, `app/page.js:12` (description) |
| L-02 | Terms §5 ei nimeta teenuseosutaja 19,99 € paketti; kasutusjuhend §3.2/§13 sama (kõigis keeltes); UI ja seemned müüvad seda | **P1** (õigustekst ei kata müüdavat paketti) | `messages/*:terms.section5.paragraph1`, `about.guide.sections_v2.register.body`, `quickstart.body` vs `lib/subscriptionPlans.js:2`, `lib/usage/planSeeds.js:62` |
| L-03 | Üldnõustumiste (terms+privacy, guide_ack) tõendikirjet ei salvestata — kliendi checkbox ei jõua serverisse | **P1** (tõendusauk; jurist + PO) | `components/alalehed/RegistreerimineBody.jsx:309–331` (agree/guideAck puuduvad POST-kehast), `app/api/register/route.js:166–…` (ei loe neid) |
| L-04 | Kriisilubadus „kuvame kohe õiged kontaktid" / „punane teavitus" on serveri tegelikust käitumisest tugevam (VEST-L1 P0: bänner kaob/ei teki; L1d töövoos kõvakodeeritud `isCrisis:false`; L1e ainult ET-detektor, lubadus aga kolmes keeles) | **P1** (kuni VEST-P0 deploy'ni) | `messages/*:voimalused.s4`, `about.guide.sections_v2.chat.body` vs VEST-A0 ptk „P0 — kinnitatud kriisiraja defektid" (VEST-L1, read 303–306; L1d rida 213; L1e rida 215) |
| L-05 | Privaatsus §6/§4.9 isolatsioonilubadus vs serveris parandamata DOK-XTEN cross-tenant leke ja Help P0 avaliku projektsiooni leke — tekst on õige sihtseis, server mitte | **P1** (tõendipunkt; lahendus = olemasolevate pakettide deploy, mitte uus tekst) | privaatsus §6; koordinaatorilaud DOK-XTEN-P0 ja Help-P0 read; Help P0 `3479a447` CHANGES_REQUIRED |
| L-06 | Kasutusjuhend lubab teemavalikut „Hele või Tume" (§1 ja §9), kuid teemad on lukus „Hämar" peale | P2 | `messages/*:about.guide.sections_v2.accessibility.body`, `profile.body` vs `app/layout.js:137–141` („LUKUS (07.07)") |
| L-07 | Terms §6 „süvauuringus … kehtib ka **päevane** kasutuspiirang" — koodis on kuupõhine limiit, päevast pole | P2 | `messages/*:terms.section6.body` vs `lib/usage/planSeeds.js:30,50,70` (`DEEP_RESEARCH_RUN` MONTHLY), `app/api/research/jobs/route.js:191` |
| L-08 | Kasutusjuhendi `/#meist` ankrud on katkised (id="meist" puudub); juhendi avalehe kirjeldus („MEIST asub allpool…") ei vasta ruumikarussellile | P2 | `messages/*:about.guide.sections_v2.{home,chat,about,before_use,quickstart}.body`; grep `id="meist"` = 0 vastet components/ ja app/ all |
| L-09 | Sitemap/nähtavus: `/meist` puudub sitemap'ist; `/autorilt` on sitemap'is, aga UI-st linkimata (orvuke); sitemap genereerib iga URL-i 3× (lokaadineutraalne localizePath) | P2 | `app/sitemap.js:6–15,18–38`; `components/room/RoomStage.jsx:741–771` (autorilt puudub); `lib/localizePath.js:12–20` |
| L-10 | hreflang-alternates kolm identset URL-i + `/en|/ru` URL-id suunatakse tagasi → EN/RU sisu pole indekseeritav; twitter `summary_large_image` ilma pildita; root-description ET kõigile | P2 | `lib/metadata.js:6–15,40–45`; runtime `/en/voimalused`→`/voimalused`; `app/layout.js:237` |
| L-11 | „Tasuta pakett sobib alustamiseks" (hinnastus) vs „SotsiaalAI kasutamiseks on vajalik igakuine tellimus" (`subscription.info`, juhend §3) — kaks pinda räägivad tasuta kasutusest vastupidist | P2 (sõnastusotsus O-AV2) | `messages/*:about.pricing.intro` vs `subscription.info`, `about.guide.sections_v2.register.body` |
| L-12 | Hinnastuse disabled-nuppude selgitus ainult `title`-tooltipis (a11y/mobiil); registreerimislink LoginModalis `aria-disabled` sama mustriga | P3 | `components/alalehed/HinnastusBody.jsx:211–219`; `components/LoginModal.jsx:1349–1359` |
| L-13 | Hardcode'id: raamistikulehe EN-vaikekirjeldus kõigile keeltele; TooalaseRaamistikuBody i18n komponendi sees; „Teenuse osutaja"/„Teenuseosutaja" ebaühtlus | P3 | `app/tooalase-kasutuse-raamistik/page.jsx:7`; `components/alalehed/TooalaseRaamistikuBody.jsx:28–171`; `messages/et.json:auth.register.role_hint` |
| L-14 | SSR-sisu kinnitus `/meist`/`/voimalused` kohta jäi lahtiseks (fetch-ekstraktor ei näidanud artiklit; `/privaatsustingimused` näitas) — kui artikkel ei SSR-du, võimendab L-01 SEO-mõju | P3 (kontrolliküsimus) | runtime ptk 12; vajab brauseri view-source kontrolli |

---

## 15. Mis töötab hästi

1. **Privaatsuspoliitika ↔ kood on rida-realt joondatud**: kõik viis autentimise TTL-i, 90 p / 7 a retention, toore makse-payload'i kärbe, RAG-kustutuse jälg, kustutustööde retry, töötlejate loetelu (Zone/Maksekeskus/OpenAI/Google TTS/OPF lokaalne) — kontrollitud ja klapib (ptk 6). See on haruldaselt kõrge kvaliteet.
2. **Terms §6 limiidid on päris väravad**, mitte turundus: 50 pööret, 1 aktiivne süvauuring, refine 3×, 10 faili, 100 MB/päev — kõik koodis olemas (üks perioodisõna viga, L-07).
3. **Launch-lukk on järjepidev**: server 403 + kliendivorm + hinnastuse nupud + LoginModali link räägivad sama juttu; avalehe „avatakse peagi" toetab. Ausalt suletud, mitte katkine.
4. **Raamistiku nõustumismudel on tugev**: versioon 2026-07-06, IP/UA/roll/lokaat/ajatemplid, avamis- ja allalaadimiskinnitused, genereeritav tõendidokument, admin-vaade, serveripoolne kohustuslikkus.
5. **i18n võtmepariteet 100%** avalikes nimeruumides; hinnad ja rollinimed kolmes keeles identsed.
6. **U6/U7/U9 distsipliin**: ühtegi harufunktsiooni ei müüda valminuna.
7. **Tasuta abivoog on päriselt tasuta** (subscriptionGate + HELP_MATCH_FREE) ja autorilehe lubadus vastab koodile.
8. **A11y-baas**: skip-link, ekraanilugeja koopia avalehel, klaviatuurikerimine poliitikalehtedel, aria-struktuur, seadete püsivus.
9. **robots/canonical** korras; poliitikatekst SSR-itud (privaatsus, runtime-kinnitatud); jalusaasta dünaamiline.

---

## 16. Otsust vajavad küsimused

Tooteomanik:
- **O-AV1 — metaandmete sisu.** L-01 parandus vajab igale lehele title/description teksti kolmes keeles. Kes kinnitab sõnastused (meta on turundustekst, mitte õigustekst)? Ettepanek: Fable koostab, tellija kinnitab.
- **O-AV2 — tasuta paketi positsioneering.** Kas „Tasuta" jääb hinnastusse eraldi paketina (siis tuleb `subscription.info` ja juhendi „tellimus on vajalik" sõnastust pehmendada „vestluse aktiivne kasutus vajab tellimust" kujule) või kaob tasuta veerg? Mõjutab L-11.
- **O-AV3 — kriisisõnastus kuni VEST-P0 deploy'ni.** Kas (a) pehmendada `voimalused.s4`/juhendit terms §7 tasemele („võib kuvada") või (b) kiirendada VEST-P0 ja jätta tekst? Fable soovitab (b) + L1e mitmekeelsuse selge järjekorrastamine, sest lubadus 112/Lasteabi/Ohvriabi on väärtuslik.
- **O-AV4 — mitmekeelne SEO.** Kas EN/RU peavad olema otsimootoris indekseeritavad (nõuab URL-põhist lokaati — suur arhitektuurimuudatus) või piisab küpsisepõhisest keelest (siis eemaldada tühjad hreflang-alternates ja sitemap'i 3× duplikaadid)?
- **O-AV5 — `/autorilt` nähtavus.** Linkida (nt Meist-lehelt või Teave-komplekti) või eemaldada sitemap'ist.
- **O-AV6 — kasutusjuhendi värskenduse ulatus.** Teemalubadus (L-06), `/#meist` ankrud (L-08), registreerimise „praegu suletud" märge, osutaja hind — üks juhendipakett või mitu.

Jurist (sisulise õigusteksti otsused; analüüs ei kirjuta lõplikku juriidilist teksti):
- **O-AV-J1 — terms §5 täiendus** teenuseosutaja hinnaga (või hindade üldviide hinnastuslehele, et vältida kolmekordset hooldust). Seotud L-02.
- **O-AV-J2 — nõustumiste tõendamise standard.** Kas terms/privacy nõustumine vajab isikustatud tõendikirjet (aeg + versioon + viis) nagu raamistik? Kui jah, tuleb ka tingimustele anda versioonitunnus (praegu õigustekstidel versiooni/jõustumiskuupäeva ei kuvata — seotud L-03). Ühtlasi: kas e-posti/monitooringu pakkujad tuleb §5-s nimetada konkreetselt?
- **O-AV-J3 — terms §6 perioodisõnastus** („päevane" → tegelik mudel: kuupõhine maht + 1 aktiivne töö). Seotud L-07.

---

## 17. Paketid

**AVALIK-P0 — (tühi).** Uusi P0 ei ole; olemasolevad P0-d (DOK-XTEN deploy, Help-P0a, VEST-P0) on juba koordinaatorilaual ja EI kuulu selle auditi paketti.

**AVALIK-P1 — metaandmete ja sitemap'i pakett (esimene, rakendusvalmis, EI vaja sisulise õigusteksti otsust).**
- Lisa `meta.{home,features,pricing,subscription,privacy,terms,guide,author}` võtmed (title+description) `messages/et.json`, `en.json`, `ru.json` — tekstid kinnitab tellija O-AV1 all, kuid pakett on tehniliselt sõltumatu: võib alustada olemasolevate lehesisude kokkuvõtetega;
- lisa `/meist` sitemap'i loetellu (`app/sitemap.js`);
- eemalda sitemap'i kolmekordsed identsed kirjed (üks kirje lehe kohta, kuni O-AV4 otsustab hreflang-suuna);
- DoD: iga avaliku lehe `<title>` ja description on kolmes keeles mittetühjad (runtime-kontroll curl-iga), sitemap ilma duplikaatideta, `npm test` + i18n-kontroll rohelised. Puutepind: 3 messages-faili + `app/sitemap.js`. Migratsioone, API-d ega õigustekste ei puuduta. Maht: väike (S).
- NB: see dokument on read-only analüüs — paketi teostab Sol/Codex eraldi kirjutusloaga.

**AVALIK-P2 — juhendi ja hinnastuse tõesuspakett** (pärast O-AV2/O-AV6): kasutusjuhendi teemalubaduse, `/#meist` ankrute, registreerimisseisu ja osutaja hinna parandus; `subscription.info` kooskõlla hinnastusega; hinnastuse disabled-nuppude ligipääsetav selgitus (nähtav tekst tooltipi asemel). Puutepind: messages + HinnastusBody + juhenditekstid.

**AVALIK-P3 — õigusteksti täpsuspakett** (pärast O-AV-J1…J3): terms §5 osutaja hind, §6 perioodisõnastus, nõustumise tõendikirje (kui J2 nõuab, siis +1 väike migratsioon `TermsAcceptance` või olemasoleva `frameworkAcceptance` mustri laiendus) ja tingimuste versiooni/jõustumiskuupäeva kuvamine. Sisu tuleb juristilt; tehniline teostus väike.

**AVALIK-P4 — SEO/jagamise pakett** (pärast O-AV4): OG-pilt (staatiline bränditud 1200×630), hreflang-strateegia rakendus või eemaldus, JSON-LD Organization, `/autorilt` linkimine või eemaldus (O-AV5), root-description'i lokaliseerimine, raamistikulehe kirjelduse lokaliseerimine (L-13).

Järjestus: P1 kohe (sõltumatu); P2 ja P3 pärast vastavaid otsuseid; P4 viimasena. Ükski ei blokeeri teineteist ega olemasolevaid turvapakette.

---

STATUS: COMPLETE
