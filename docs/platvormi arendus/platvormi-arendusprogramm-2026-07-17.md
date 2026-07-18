# SotsiaalAI platvormi arendusprogramm

STATUS: ACTIVE CANONICAL DEVELOPMENT PROGRAM

Viimati kontrollitud: 2026-07-17  
Programmi omanik: SotsiaalAI arenduse koordinaator  
Töörežiim: analüüs → arenduslaine → sõltumatu koondaudit → integratsioon → deploy → järelkontroll

## 1. Dokumendi eesmärk ja kasutus

See fail on platvormi **igapäevane arendusprogramm**. Siit peab alati saama ühe vastuse neljale küsimusele:

1. mis on päriselt valmis;
2. mida parajasti tehakse;
3. milline üks tegevus tuleb järgmisena;
4. mis takistab integratsiooni või serverisse viimist.

Detailne tõendilaud jääb faili
[`koordinaatori-handoff-2026-07-16.md`](./koordinaatori-handoff-2026-07-16.md).
Käesolev programm määrab **järjekorra, arenduslained ja väravad**. Teemapõhised analüüsid ja auditiraportid
annavad pakettide vastuvõtukriteeriumid.

Teemade ulatuse ja põhimõtte „üks teema = üks arendusharu/ülesanne/lõpparuanne” kanooniline register on `arendusteemade-masterregister.md`. Käesoleva programmi väiksemad paketi-ID-d on selle registri teemade sisemised kontrollpunktid, välja arvatud päris otsuse-, migratsiooni-, sõltuvus- või deploy-piir.

### Tõeallikate järjekord

Vastuolu korral võidab kõrgem allikas:

1. aktiivne Git-kood, commit'i tegelik diff ja runtime;
2. `origin/main` ning live-serveri kontrollitud release;
3. sõltumatu auditiraport;
4. käesolev arendusprogramm;
5. koordinaatori detailne handoff;
6. teemapõhine progressi- või analüüsidokument;
7. vana koondprotsent või varasem mälukirje.

Analüüsidokumendi `STATUS: COMPLETE` ei tähenda koodivalmidust. Push'itud haru ei tähenda main'i. Main ei
tähenda serverit.

## 2. Kontrollitud lähtepunkt

| Kiht | Kontrollitud seis 2026-07-17 | Järeldus |
|---|---|---|
| GitHub `origin/main` | `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` | aktiivne integratsioonibaas |
| Live-server `/home/ubuntu/apps/sotsiaalai` | puhas `main` @ `fe4eb4fa`; frontend ja RAG `active`; research-worker `inactive`, `LoadState=not-found` | GitHub main ja server kattuvad; research-worker unit puudub |
| Kohalik põhitööpuu | `main @ 0da4185b`, 1 ees / 22 taga, mitme kasutaja UI- ja dokumendimuudatustega määrdunud | **ei kasutata arenduseks, integratsiooniks ega deploy'ks** |
| Värsked worktree'd | iga pakett eraldi worktree's ja harus | kohustuslik tööviis |

Live-release sisaldab juba RAG-P8.0, DOK-XTEN-P0, Help P0 ning ADMIN-P0.1/P0.1a suletud turvapakette.
Neid ei avata uuesti ilma uue regressioonitõendita.

## 3. Strateegiline siht

Tänast platvormi ei arendata enam eraldiseisvate funktsioonilehtede kogumikuna. Siht on faasipõhine ruumiline
platvorm, kus kasutaja:

- liigub eesmärgi poole etappide kaupa;
- saab märkida olulise, ülesanded, kokkulepped ja muutused;
- saab tuge õigel hetkel, mitte ainult pika küsimustiku järel;
- näeb, mis muutus ja mida teha järgmisena;
- kontrollib ise osalejaid, jagamist, nõusolekut ja privaatsust.

Ruumivisiooni esimene täisring on failis
[`fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md`](./fable-5-ruumilise-platvormi-elav-visioon-ja-arendusteed.md).
See koondab tulevikusuunad viieks põhikeskkonnaks ja kaheks platvormikihiks.

### Ruumilise töölaua prototüüpide leping

Prototüüpimist ei korraldata ühe funktsioonilehe järgi nimetatud demode jadana. Praegused HTML-id on ühise kesta käitumispõhised alusproovid ning nende kanooniline register on [`prototyybid/README.md`](./prototyybid/README.md). Järgmine ühine `prototyybid/ruumilise-toolaua-prototuup.html` peab avanema näitevalikusse; vähemalt Dokumendi koostamine, Tööheaolu, Teekond, Kovisioon, Registreerimine/sisenemine ja Kasutusjuhend/lugemiskiht kasutavad sama dokki, faasiriba, Fookuse/Ülevaate/Võrdluse režiime, URL-olekut ning ligipääsetavat liikumis-/flat-lepingut. Ühe näite mock-sisu ei anna prototüübile selle lehe nime ega piira tulevast tarbijat.

### Kaks järgmist ühist alust

- **K1 tööruumileping:** V1 eelistus on normatiivne leping ja adapteripiir olemasolevate mudelite kohal
  (variant A), mitte kohe universaalne Workspace-tabel.
- **U1 sündmuse-/teavituskiht:** senine teavitusvertikaal on juba main'is ja serveris; järgmine areng on
  minimaalne `DomainEvent` outbox + olemasoleva `NotificationEvent` projektsioon (variant B), mitte täielik
  event-sourcing.

K1/U1 rakendusvalmis analüüs on lõpetatud failis
[`fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md`](./fable-5-k1-tooruumi-leping-ja-u1-sundmuse-teavituskiht.md)
707 rea ja 12 sisupeatükiga, `STATUS: COMPLETE`. SHA-256:
`a2e4294e7037eb6bc9ac13627b5cc457ad608feaa81f1e3aeb22dea72fa30d1f`. Tooteomanik kinnitas
17.07.2026 O-K1-1, O-U1-1 ja O-U1-2. K1-P0 on Terral `CODE_READY` commit'is `ef5973c9`; U1-P0
ootab K1-P0 sõltumatut tehnilist kontrolli ja avatakse seejärel eraldi kõrge riskiga paketina.

> Oluline nimetuse piir: ajalooline **U1-V0 teavitusvertikaal** on main'is ja serveris. Praegune
> **K1-U1-A0** üldistab seda tulevaste tööruumide sündmuskihiks; see ei ole sama paketi uuesti tegemine.

## 4. Töökorralduse põhireeglid

### Rollid

- **Fable:** toote-, metoodika-, UX-, arhitektuuri- ja tööplaanianalüüs. Rakenduskoodi ei muuda.
- **Sol/Codex:** koodipaketi teostus värskes eraldi worktree's.
- **Opus või teine Sol/Codex:** sõltumatu audit; ei paranda ise auditeeritavat paketti.
- **Koordinaator:** järjekord, paketipiir, otsused, integratsioonikorv ja programmi uuendamine.

### Mahusäästlik arendustsükkel — tooteomaniku täpsustus 2026-07-17

Pakette ei auditeerita ega testita koordinaatori poolt teist korda kohe pärast teostaja lõpparuannet:

1. Fable'i rakendusleping või kinnitatud tehniline tööplaan;
2. Sol/Codexi paketid eraldi commit'ideks, igaühel teostaja enda proportsionaalsed kontrollid ja lõpparuanne;
3. koordinaatori odav Git-vastuvõtt: haru/ref, parent, commit ja remote SHA; testide/buildi/runtime'i korduskäivitust ei tehta;
4. järgmiste funktsioonide arendus jätkub, valmis harud külmutatakse;
5. kui tooteomanik kuulutab platvormi funktsionaalselt terviklikuks, tehakse üks sõltumatu koondaudit, täissviit ja release-test ajutises integratsiooni-worktree's;
6. ainult koondkontrolli P0/P1 blokeerijate parandamine;
7. üks integratsioon ja üks deploy kasutaja eraldi loal;
8. deploy-järgne smoke.

Analüüsi alam-ID-d (`P0.1`, `P0.2`, `P1.1` jne) on ühe teemataseme ülesande sees kontrollpunktid, mitte vaikimisi eraldi arenduspaketid. Üks funktsiooniteema saab ühe haru, koondülesande ja lõpparuande. Eraldi paketipiir on põhjendatud ainult blokeeriva toote-/õigusotsuse, migratsiooni, teise haru sõltuvuse või teadlikult eraldi deploy'tava riski korral.

### Katkenud teemaarenduse jätkamine — tooteomaniku täpsustus 2026-07-17

Ülesanne on alati üks tervikteema, ühe worktree, haru ja lõppüleandmisega. Konto tüüp ega limiit ei jaga seda etapipõhisteks mikroülesanneteks ega muuda vastuvõtukriteeriume. Kui töö katkeb, jätkatakse hiljem sama teema täieliku lepingu ja olemasoleva tööseisu järgi. Täpne kord: [`teemaarenduse-jatkamise-kord.md`](./teemaarenduse-jatkamise-kord.md).

Järgmised teemad jäävad koondkontrollis eraldi riskimärgisega:

- autentimine ja konto ülevõtmise risk;
- kriisiohutus;
- maksed;
- tenant-/privaatsuspiir;
- pöördumatu kustutamine ja retention;
- andmebaasimigratsioonid;
- salvestuse nõusolek ja egress.

Ka riskikorvi paketti ei saadeta automaatselt kohe uude auditisse. Varasem sõltumatu audit avatakse ainult kasutaja eraldi korraldusel või teostaja raporteeritud P0/P1 vea korral; muidu kontrollitakse riskileping release candidate'i koondauditis.

### Põhitööpuu kaitse

- Kohalikku määrdunud `main` tööpuud ei stage'ita, puhastata, rebase'ita, pull'ita ega kasutata deploy'ks.
- Iga uus pakett alustab `git fetch` järel värskest kontrollitud baasist.
- Teise teema faili ei muudeta „mugavuse pärast”.
- Ühes commit'is on üks paketileping.
- Amend ja force-push on keelatud, kui koordinaator pole seda eraldi lubanud.

## 5. Olekukoodid

| Olek | Tähendus |
|---|---|
| `LIVE` | main'is, serveris ja deploy-järgselt kontrollitud |
| `READY_BUILD` | leping valmis, kood pole alustatud |
| `READY_AFTER_K1` | otsused ja leping on valmis, kuid pakett algab alles K1-P0 kontrollitud valmimise järel |
| `IN_PROGRESS` | üks nimetatud tegija töötab paketiga |
| `CODE_COMMITTED_AWAITING_HANDOFF` | commit ja remote on olemas, kuid testide/runtime'i lõppüleandmine pole koordinaatorile jõudnud |
| `CODE_READY` | commit ja remote olemas, testid tehtud |
| `CODE_READY_LOCAL_ONLY` | commit on lokaalselt olemas, kuid remote-haru/push puudub |
| `READY_AUDIT` | kood valmis, sõltumatu kontroll puudu |
| `CHANGES_REQUIRED` | audit leidis integratsiooni blokeeriva vea |
| `READY_INTEGRATE` | audit PASS, merge/deploy puudub |
| `INTEGRATION_REHEARSAL` | paketid on ajutiselt aktiivse main'i peale kokku pandud |
| `BLOCKED_DECISION` | järgmine kood sõltub toote-/õigus-/ops-otsusest |
| `DEFERRED` | teadlikult hilisem horisont |
| `QUARANTINED_LOCAL` | väärtuslik kohalik diff, kuid eraldamata või segunenud; seda ei puututa |

## 6. Üldine valmisoleku definitsioon

### Pakett on `CODE_READY`, kui

- scope vastab töölepingule;
- haru, baas ja commit on fikseeritud;
- remote SHA kattub;
- sihttestid ja asjakohased regressioonid läbivad;
- riskile vastav runtime-smoke on tehtud või `not_run` põhjus täpselt kirjas;
- lint, i18n, build, Prisma/diff-check on riskile vastavas ulatuses kontrollitud;
- sünteetilised andmed ja protsessid on koristatud;
- worktree on puhas;
- merge'i ega deploy'd pole tehtud.

### Pakett on `READY_INTEGRATE`, kui

- sõltumatu audit on PASS;
- P0/P1 leide pole;
- P2/P3 on eraldi backlog'is ega muuda paketi lubatud käitumist valeks;
- aktiivse `origin/main` vastu on konflikt ja puutepind kontrollitud;
- migratsiooni- ja rollback-leping on selge.

### Release on `LIVE`, kui

- integratsiooniharu on värskest `origin/main`-ist;
- kõik paketid on täpsete commit'idena integreeritud;
- kogu testisviit, lint, i18n, build ja migratsiooniahel läbivad;
- keelatud failialad ja diff on kontrollitud;
- serveri HEAD kattub release-commit'iga;
- teenused on aktiivsed;
- paketipõhised deploy-järgsed smoke'id läbivad;
- rollback-punkt on fikseeritud.

## 7. Kanooniline arendustahvel

### 7.1 Praegune arenduslaine A — platvormi stabiliseerimine

| Järjekord | Pakett | Olek | Haru / commit | Main / server | Blokeerija | Täpne järgmine tegevus | Tegija |
|---:|---|---|---|---|---|---|---|
| 1 | VEST-P0/P0a kriisifail-safe | `CODE_READY` | `codex/vest-p0-crisis-failsafe @ ef01fc42`; järelcommit `codex/vest-p0a-empty-provider-fallback @ 043f0dce` | ei / ei | koondaudit | hoia harud muutmata; testi laine integratsioonis ET/EN/RU tühja provider-vastust ja püsistust | koondaudiitor laine lõpus |
| 2 | PROF-P1 e-posti uuesti autentimine + rate limit | `COMPLETE_IN_T02` | algne `codex/prof-p1-email-reauth-rate-limit @ 16e688f7`; T02 cherry-pick `69c11be0`, lõppharu `codex/account-v1 @ 929793f1` | ei / ei | T27 koondvärav | hoia mõlemad harud muutmata; ära ava PROF-ile uut üleandmist ega auditit | T27 koondaudiitor |
| 3 | K1-P0 tööruumileping ja read-adapterid | `CODE_READY` | `codex/k1-p0-workspace-contract @ ef5973c9eecfd8a9664dc2a0d7eb8c29f793b23a`; parent `fe4eb4fa`; local=remote; worktree puhas | ei / ei | sõltumatu tehniline kontroll; build jäi baasi identse `LogoExportStage.module.css:23` vea taha | hoia haru muutmata; kontrolli koondauditis viis uut faili ja buildi baseline-blokeerija | sõltumatu Sol/Codex |
| 4 | EXPORT-P0 ekspordi ausus ja auditijälg | `CODE_READY` | `codex/export-p0-pdf-docx-audit @ 65c82d048e52554cede55aec9fec8a828975ddc6`; parent `fe4eb4fa`; remote-ref kinnitatud; worktree puhas | ei / ei | sõltumatu koondaudit; sünteetiline runtime `not_run` | hoia haru muutmata; auditeeri Wave A koondis täpset vahemikku `fe4eb4fa..65c82d04` | koondaudiitor |
| 5 | TÖÖLAUD-P1 süvalinkide terviklus | `CODE_READY` | `codex/toolaud-p1-deep-link-integrity @ a23933017afbf944fb2d303917afbe8c37551494`; parent `fe4eb4fa`; local=remote | ei / ei | Wave A sõltumatu koondaudit; autentitud runtime `not_run` | hoia haru muutmata; auditeeri continuity/practice/preInquiry kolm rada ja omandipiir Wave A koondis | koondaudiitor |
| 6 | A11Y-I18N-P0 meta-pealkirjad ja kolm võtmeparandust | `CODE_READY` | `codex/a11y-i18n-p0-meta-titles @ 15ab986f111c41eb7eb0c493486ca59cda858067`; otsene parent `043f0dce`; local=remote; worktree puhas | ei / ei | Wave A koosmõjukontroll ja EN/RU sõnastuse sisuomaniku pilk enne integratsiooni | hoia haru muutmata; auditeeri incremental vahemikku `043f0dce..15ab986f` Wave A koondis | koondaudiitor |
| 7 | PERF-P0 reservatsioonide elutsükkel + research-valvekoer | `CODE_READY_AUDIT_DEFERRED` | `codex/perf-p0-reservation-lifecycle @ 5459f408f51c27f047f0d3b24952c2ba7059bc16`; parent `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe`; local=remote; worktree puhas | ei / ei | sõltumatu audit on tooteomaniku otsusel ootel; runtime `not_run`; ignoreeritud `.next/` cleanup oli keskkonna poolt blokeeritud | hoia haru muutmata ja säilita auditivõlg Wave A-sse | Wave A sõltumatu audiitor |
| 8 | AVALIK-P1S sitemap'i terviklus | `CODE_READY` | `codex/avalik-p1s-sitemap-integrity @ 8cae87123c6c6d7eefd3ea14fe77a8e4c8525ce7`; parent `fe4eb4fa`; local=remote; worktree puhas; 2 faili +59/−22 | ei / ei | Wave A incremental kontroll; eraldi Opust ei nõuta | hoia haru muutmata; auditeeri sitemap'i diff ja XML-smoke Wave A ajutises integratsioonis | Wave A sõltumatu audiitor |
| 9 | WAVE-A sõltumatu koondaudit | `DEFERRED_TO_T27` | auditiharu puudub | ei / ei | tooteomanik lükkas paketipõhised kordusauditid release candidate'i koondväravasse | ära ava praegu; säilita valmis harud ja kontrollivõlad T27 jaoks | koordinaator T27-s |
| 10 | WAVE-A integratsioon ja release | `DEFERRED` kuni audit PASS | release-haru puudub | ei / ei | koondauditi PASS ja deploy-luba | integreeri, täissviit, migratsioonid, build, serverideploy ja järel-smoke | Sol/Codex + koordinaator |

### 7.2 Eraldi riskikorvid

| Prioriteet | Pakett | Olek | Haru / commit | Põhirisk | Järgmine tegevus | Tegija |
|---:|---|---|---|---|---|---|
| R0 | PERF-P0 reservatsioonide elutsükkel + research-valvekoer | `CODE_READY_AUDIT_DEFERRED` | `codex/perf-p0-reservation-lifecycle @ 5459f408`; parent `fe4eb4fa`; 10 faili, +581/−56; leping `fable-5-joudlus-kulu-ja-skaleeruvus.md` ptk 12–13 | serveris puudub research-worker; teostus pole main-is ega serveris; eraldi audit on edasi lükatud | hoia haru muutmata; lisa settle/reaper/race/poll/worker-warning kontroll Wave A koondauditisse | hilisem Wave A audiitor |
| R1 | RAG-QM-P0a | `READY_AUDIT` | `codex/rag-qm-p0a-audit-fixes @ be96bcce`; parent `52883276` | privaatsusturvalise mõõteraporti fail-closed leping | kontrolli üks kord vahemikku `52883276..be96bcce`; PASS korral integratsioonikorvi | Opus või sõltumatu Sol |
| R2 | MAKSED-P1a plan-binding | `T09_READY_TO_ASSIGN` | `codex/maksed-p1a-server-plan-binding @ 0aca8c4b`; T02 `codex/account-v1 @ 929793f1` | paketi-/kvoodieskaleerimine | T09 kasutab mõlemat aluscommit'i; lõpus Fable fokuseeritud kontroll, päris makset ei tehta | Opus või Sol |
| R3 | SUP-P0 skeemialus | `CODE_READY_LOCAL_ONLY` | `codex/supervision-v0-p0-schema @ 2fc826c4`; parent `2a63fcd0`; remote puudub | 13 mudelit, 11 enumit, migratsioon ja retention-seosed | push'i haru muutmata; auditeeri skeem, migratsiooniahel ja kustutusleping aktiivse main'i vastu | Sol/Codex → Opus/teine Sol |
| R4 | FAILID-P0.1 nõusoleku kohene jõustamine | `READY_BUILD` | haru/commit puudub | LIVEKIT egress võib jätkuda pärast tagasivõttu | pärast Wave A koodi loo eraldi kõrge riski pakett: stop + temp cleanup + runtime | Sol/Codex |
| R5 | FAILID-A0-S1 admin-RAG tehniline lisa | `READY_BUILD` (docs-only analüüs) | väljund puudub | safeguard'i tõttu lugemata admin-RAG elutsükkel | tee read-only kood/runtime lisa; ära korda kogu FAILID-A0 auditit | Sol/Codex |
| R6 | Tööheaolu E0 | `READY_AUDIT` | `fable/tooheaolu-e0 @ fe8c7df2` | dedupe, lekketa vihjed, salvestuse idempotentsus | üks tehniline ristkontroll; E2/E4/E5 jäävad välja | Sol/Codex |

### 7.3 Integratsiooni ootavad ja kaitstud paketid

| Pakett | Olek | Tõend | Järgmine tegevus |
|---|---|---|---|
| U6 isiklik otsing | `COMPLETE_IN_T17` | T17 `codex/search-language-v1 @ ed95d6aa`; U6 alus `b4cab70` + `adf75782` | hoia stack muutmata; otsing on kasutaja- ja sisu-piiriga, T27-s koondvärav |
| U7 selge keel | `COMPLETE_IN_T17` | T17 `codex/search-language-v1 @ ed95d6aa`; U7 alus `29ff771` | hoia stack muutmata; Fable'i kitsas nõusoleku-/kriisi-/õiguspiiri kontroll on edasi lükatud, mudeli eval jääb mitteblokeerivaks P2-ks |
| T16 Eksport ja andmekoopia | `IN_PROGRESS_PAUSED` | worktree `SotsiaalAI-export-v1`, `codex/export-v1 @ 4be2153f`; EXPORT-P0 on stack'is, T02 `929793f1`; kohalik upstream puudub | jätka ainult samas worktree's faili `t16-export-v1-jatkuulesanne.md` järgi; registry/ZIP/DataExportJob/migratsioon/profiilipaneel on olemasolev commit'imata WIP |
| T11 Teenusekaart ja nõusolekuga kontakt | `CODE_READY` | `codex/service-mediation-v1 @ 7acb7a33` (remote=local); parent marker `7afa8c37`, T17 `ed95d6aa`; migratsioon `20260717233000_help_match_consent` | PENDING→ACCEPT/DECLINE, ruum alles ACCEPT-il, sisu-minimaalne teavitus ja kaart/loend; DB-runtime ning migratsiooniahel T27/sünteetilise DB väravas |
| T03 Vestlus, hääl ja töövood | `READY_TO_ASSIGN` | tööleping `t03-chat-voice-v1-ulesanne.md`; VEST-P0/P0a `ef01fc42` → `043f0dce`; T17 `ed95d6aa` | üks tervikharu: kriis, Stop/Retry, tekstipiir, tasuta abi piir, STT/TTS ja töövoo nõusolek |
| T07 Dokumendid, analüüs ja süvauuring | `READY_TO_ASSIGN` | tööleping `t07-documents-research-v1-ulesanne.md`; T28 `8c3e5f77`; T17 `ed95d6aa` | üks tervikharu: private RAG-piir, püsiv mustand ja analüüs, Minu dokumendid, jätkuv süvauuring, owner-404 ja snapshot-kustutus |
| RV-P0 kohalik rollivahetaja | `QUARANTINED_LOCAL` | kasutaja määrdunud põhitööpuus, eraldi commit puudub | ära puutu; hilisemas külmutuspaketis eralda RV tuum, paneeliinfo ja kõrvaldiffid |
| Role-aware invite copy | `BLOCKED_DECISION` | `codex/role-aware-invite-copy @ ead1d8d1` | enne integratsiooni kinnita maksja-roll → sponsoreeritav-roll maatriks ja seos MAKSED-P1d-ga |

### 7.4 Juba live ja suletud

| Pakett | Seis |
|---|---|
| RAG-P8.0 | main + server; audit PASS; kirjutav produktsioonikäivitus on eraldi ops-luba |
| DOK-XTEN-P0 | main + server; sõltumatu runtime PASS; cross-tenant P0 suletud |
| Help P0 | main + server; closure PASS; privaatmarkerid ja KOV-ID/võtmed avalikust projektsioonist väljas |
| ADMIN-P0.1/P0.1a | main + server; audit PASS; preview-secret seatud; tootmise reset-värav suletud |
| U1-V0 teavitused + U2 continuity | main + server; varasem audit heaks kiidetud; notification timer töötab serveris |
| U3/U4/U8 varasem usalduskiht | main + server; ei alustata uuesti K1/U1 nime all |

### 7.5 Järgmise arhitektuurilaine valmisolek

| Pakett | Olek | Leping | Blokeerija | Täpne järgmine tegevus |
|---|---|---|---|---|
| K1-U1-A0 analüüs | `COMPLETE` | 707 rida, 12 peatükki; K1=A, U1=B; eelpöördumise vertikaal | puudub | hoia kanoonilise lähtealusena; uuenda ainult uue Git/runtime-tõendi järel |
| K1-P0 | `CODE_READY_STACK_BASE` | `ef5973c9`; 5 uut faili, +885; registry, descriptor, Kovisiooni/Room read-adapterid ja 318-realine lepingutest; remote SHA kinnitatud | auditivõlg läheb T27 koondväravasse | kasuta T04 otsese baasina; ära kopeeri ega teosta K1 koodi uuesti |
| U1-P0/P1 + T05 + T06 stack | `CODE_READY @ f17a3c36` | T04 `87d9a141` → T05 `33f7fb82` → T06 `f17a3c36`; T06 fail-closed jagamine, elutsükkel, O-J1=B migratsioon, autorivoog, püsivus, eksport/kustutus ja UI | T06 teostaja: markerid 5 punast → 14/14 rohelist, koond-sihttestid 52/52, i18n/Prisma/lint/diff-check/build PASS; autentitud runtime, cleanup ja migratsiooni DB-seis `NOT_RUN/NOT_PROVEN`; täissviit/audit T27-s | hoia stack muutmata; T28 on nüüd `CODE_READY`; merge/deploy puudub |

### 7.6 Eksport ja koostalitlus

| Pakett | Olek | Leping / tõend | Blokeerija | Täpne järgmine tegevus |
|---|---|---|---|---|
| EXPORT-A0 analüüs | `COMPLETE` | 395 rida, `STATUS: COMPLETE`, SHA-256 `0071dc56b57a2cdc8db27644ae5fcc513825ae8cd0cdbb00d315b2fa5bb0a0b9`; E-1 GDPR andmekoopia puudub, E-2 PDF Latin-1 moondus | puudub | külmuta lähtealuseks; ära korda FAILID-A0 faili-elutsüklit |
| EXPORT-P0 | `CODE_READY` | `65c82d04`; 15 faili, +267/−45; sisuta `chat.exported`, päris DOCX, chat/artefakti PDF 409, `csvCell` kaitse | sõltumatu koondaudit; runtime `not_run` lokaalse `.env`/PostgreSQL puudumise tõttu | hoia haru muutmata; Wave A audit kontrollib auth/auditkirjet/Unicode DOCX/PDF 409/CSV kaitset |
| EXPORT-P1 | `BLOCKED_DECISION` | kasutaja andmekoopia MVP: `DataExportJob`, pindade register, manifest ja valmisolekuteade | O-E1, O-E2 | disaini võib jätkata, koodi ei alustata enne tooteomaniku ja juristi otsust |
| EXPORT-P2 | `DEFERRED` | auditijälje ühtlustus, agregaatekspordid, eelpöördumise päis, materjali esitaja koopia | EXPORT-P0/P1 piir | ava paketid eraldi, ära koonda üheks suureks diffiks |
| EXPORT-P3 | `BLOCKED_DECISION` | kustutuse-eelne koopiaportaal ja ooteaeg | EXPORT-P1, O-E1, O-TK9 | ära muuda konto kustutamist enne otsuseid |
| EXPORT-P4 | `DEFERRED` | versioonitud koostööpakett tulevastele tööruumidele | K1-P0, SUP seis, O-E5 | tuleviku koostalitluspakett, mitte praegune automaatne arendus |

## 8. Arenduslaine A täpne programm

### A1. PROF-P1 — T02 konto-teema aluscommit

Git-kontroll 17.07.2026 kinnitas puhta worktree, haru ja remote'i samal commit'il
`16e688f76fc68be237f21ee187bd7191d055f00d`. Seda ei lõpetata eraldi paketina ega saadeta eraldi auditisse.
T02 `ACCOUNT-V1` teostaja võtab commit'i `cherry-pick -x` abil oma värskesse harusse ning tõendab selle
käitumise koos ülejäänud konto-, taastamise-, sessiooni- ja kustutusteekonnaga.

Vastuvõtukriteeriumid:

- tegelik e-postimuutus nõuab serveris õiget praegust PIN-i;
- vale/puuduv PIN ei muuda DB-d, sessiooni ega e-posti;
- sama e-post ei tekita reauth'i;
- PUT/DELETE tundlikud PIN-kontrollid on IP + userId võtmega piiratud;
- 429 tekib enne kallist räsi kontrolli;
- paroolita konto senine rada ei muutu;
- auth/profiili regressioonid ja võimaluse korral sünteetiline runtime on rohelised;
- üks commit/push, merge/deploy puudub.

### A2. TÖÖLAUD-P1

Paketipiir:

- `lib/workspaceContinuity.js`;
- `components/covision/EffectivePracticesPage.jsx`;
- `components/workspace/WorkspaceFeaturePage.jsx`;
- ainult vajalikud URL-/omanditestid.

Vastuvõtukriteeriumid:

- Teekonna continuity viib päris kirje route'ile;
- `?practice=` avab olemasoleva praktikadetaili;
- vastuvõtja fallback avaneb ainult serverist tõendatud omandiga;
- inbox'i, badge'e, uut gating'ut ega TÖÖLAUD-P2/P3 ei lisata.

### A3. A11Y-I18N-P0 — `CODE_READY`

Terra teostas paketi eraldi worktree's harul `codex/a11y-i18n-p0-meta-titles`. Otsene parent on
`043f0dce5b9c08e5a017f63009b293aa039dc308`; commit ja remote SHA on
`15ab986f111c41eb7eb0c493486ca59cda858067`. A11Y incremental diff on 4 faili, +240/−2 ning muudab ainult
`messages/{et,en,ru}.json` ja lisab `tests/i18n/metaTitles.test.js`. VEST-i ajalugu ei muudetud.

Koordinaatori sõltumatu kordus kinnitas:

- 15 aktiivset juur-`meta.*` gruppi on ET/EN/RU-s mittetühja title'i ja description'iga;
- meta sihttest 1/1, kõik i18n-testid 7/7, `npm run i18n:check` ja `npm test` 1254/1254 PASS;
- sihtlint PASS; täislint 0 viga / 358 olemasolevat hoiatust;
- production build, Prisma validate ohutu placeholder-URL-iga, tühi Prisma skeemi-/migratsioonidiff ja `git diff --check` PASS;
- worktree on puhas ning local=remote;
- autentitud runtime `not_run`, sest worktree's puuduvad `.env*` ja ohutu auth/DB seade; kasutajaandmeid, DB-ühendust ega väliskutseid ei kasutatud.

Hoia commit muutmata ja lisa `043f0dce..15ab986f` Wave A ajutisse integratsiooni. Seal korratakse meta-leping,
avalike ja autentitud lehtede title-smoke, messages-merge, i18n, täissviit ja build. EN/RU sõnastus vajab enne
integratsiooni sisuomaniku pilku. Merge/deploy puudub.

### A4a. PERF-P0 — `CODE_READY`, sõltumatu audit edasi lükatud

PERF-P0 on teostatud eraldi worktree's `C:\Users\rauds\Desktop\SotsiaalAI-perf-p0-reservation-lifecycle`, harul
`codex/perf-p0-reservation-lifecycle`, otsese parent'iga `fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe` ja
commitiga `5459f408f51c27f047f0d3b24952c2ba7059bc16`. Remote SHA kattub; worktree on puhas. Diff on 10 faili,
+581/−56.

Teostuse leping:

- stale research-job vabastab reservatsiooni ainult siis, kui tingimuslik error-üleminek õnnestus;
- kõik adapteri reserveeringud saavad scope'i järgi `expiresAt`-i (chat/tundmatu 15 min, document/research 24 h),
  TTL-id on env-seadistatavad;
- retention-reaper vabastab piiratud partiina ainult aegunud `RESERVED` kirjeid usage-teenuse kaudu ning race jääb
  idempotentseks;
- serveri DB-poll ja kliendi persistence-poll lõppevad 15 minuti järel ning koristavad taimerid abort/error/success
  radadel;
- worker-mode annab puuduva unit'i kohta selge env- ja deploy-hoiatuse; inline-rada jäi muutmata.

Koordinaatori korduskontroll: sihttestid 11/11, `npm test` 1300/1300, sihtlint PASS, täislint 0 viga/358
olemasolevat hoiatust, i18n PASS, Prisma validate placeholder-URL-iga PASS, skeemi-/migratsioonidiff tühi,
`git diff --check` PASS ja production build PASS. Runtime `not_run`: DB-d, serverit, autentitud kasutajat ega
väliskutseid ei käivitatud. Worktree'sse jäi ignoreeritud `.next/`, mille eemaldamine oli keskkonna poolt blokeeritud;
see ei ole tracked diff.

Sõltumatu audit on tooteomaniku otsusel edasi lükatud ja jääb Wave A auditivõlaks. Hilisem teine tegija kontrollib täpset vahemikku
`fe4eb4fa7997a7eada9417a27c6cea75ccd23cbe..5459f408f51c27f047f0d3b24952c2ba7059bc16`, sh settle/race/reaper/poll/
worker-warning lepingud, scope-TTL-id, cleanup, keelatud faili- ja skeemimuudatuste puudumise ning selle, et
`RESEARCH_JOB_MODE` väärtus jäi muutmata. Merge/deploy puudub; auditivõlg ei blokeerinud kitsa AVALIK-P1S teostust ja säilib nüüd Wave A koondauditi skoobis.

### A4. AVALIK-P1S

Vastuvõtukriteeriumid:

- sitemap'is on iga URL üks kord;
- `/meist` on olemas;
- praegused avalikud URL-id säilivad;
- sitemap XML valideerub;
- tõlkefailid, õigustekstid ja lokaadipõhine URL-arhitektuur jäävad välja.

Kontrollitud tulemus: worktree `C:\Users\rauds\Desktop\SotsiaalAI-avalik-p1s-sitemap-integrity`, haru
`codex/avalik-p1s-sitemap-integrity`, parent/merge-base `fe4eb4fa`, commit/local/remote `8cae8712`; ainult
`app/sitemap.js` ja `tests/public/sitemapIntegrity.test.js`, +59/−22. Koordinaatori kordus: sihttest 1/1,
täissviit 1293/1293, lint 0 viga / 358 olemasolevat hoiatust, i18n, Prisma, tühi skeemi-/migratsioonidiff,
diff-check ja production build PASS. Runtime `/sitemap.xml`: HTTP 200, 10 kirjet / 10 unikaalset, `/meist`
üks kord, 0 lokaadiprefiksit ja 0 hreflang'i; protsess suletud, port 3017 vaba. Worktree puhas; main/server,
merge ja deploy puuduvad.

### A5. Koondaudit

Audiitor loob värskest `origin/main`-ist ajutise integratsiooni ja kontrollib iga incremental commit'i ning kogu
puu. Minimaalne auditimaatriks:

| Pind | Kohustuslik kontroll |
|---|---|
| VEST | ET/EN/RU tühi non-stream ja null-delta stream; HTTP/SSE=püsistus; veaharu ja hüdratsioon |
| PROF | vale/puuduv/õige PIN; same-email no-op; 429; kõrvalmõjude puudumine |
| TÖÖLAUD | kolm deep-link/omandi rada päris route-semantikaga |
| A11Y/I18N | meta-leping, võtmepariteet ja avalike lehtede title-smoke |
| PERF | research'i stale-settle, reservatsiooni reaper/race, poll-ülempiir ja worker-unit'i deploy-hoiatus |
| AVALIK | sitemap dedupe, `/meist`, XML ja avalik smoke |
| Koosmõju | messages-merge, WorkspaceFeaturePage puutepind, build, kogu testisviit |

Koondaudit annab:

- paketikaupa PASS/CHANGES_REQUIRED;
- koondverdikti;
- P0–P3 leiud;
- täpse integratsioonijärjekorra;
- merge-/deploy-keelu või loa.

### A6. Integratsioon ja deploy

Integratsioon toimub ainult pärast koondauditi PASS-i ja kasutaja merge/deploy-luba.

Soovitatud integratsioonijärjekord kinnitatakse rehearsal'is; vaikimisi:

1. VEST-P0 + P0a stack;
2. PROF-P1;
3. TÖÖLAUD-P1;
4. A11Y-I18N-P0;
5. PERF-P0;
6. AVALIK-P1S.

T17 lisamine samasse release'i otsustatakse rehearsal'i alguses. Kui selle aluscommit'ide ja i18n diff suurendab
riski, lähevad nad järgmisse eraldi integratsioonirelease'i.

Deploy-järgsed kohustuslikud smoke'id:

- kriisifallback kolmes keeles ilma välise AI-kutseta kontrollitud stub-/testirajal;
- profiili e-postimuutuse PIN-värav ja rate-limit sünteetilise kontoga;
- continuity/practice/preInquiry linkide avamine;
- avalike lehtede title'id ja sitemap;
- frontend/RAG health;
- serveri HEAD, puhas tööpuu ja rollback-ref.

## 9. K1/U1 järgmine arenduslaine B

K1/U1 analüüs on `STATUS: COMPLETE`. Laine B kood ei alga enne, kui järgmised punktid on tooteomaniku
otsustega lukustatud:

- K1 normatiivne sõnastik;
- K1 adapteri descriptor ja invariandid;
- U1 sündmuskataloog;
- action/deep-link registry;
- `DomainEvent` minimaalne skeem;
- esimene vertikaalne kasutusjuht;
- migratsioon, dual-run, dedupe ja rollback;
- blokeerivad otsused.

Praegune eelistatud arhitektuur:

- K1: variant A, leping + adapterid olemasolevate mudelite kohal;
- U1: variant B, `DomainEvent` on teavituslik fakt, mitte ärioleku tõeallikas;
- olemasolev reconciler ja `NotificationEvent` jäävad üleminekuajal tööle;
- vabatekst ja privaatne sisu ei lähe event-payload'i;
- deep-link salvestab action-tüübi ja ressursiviite, mitte suvalise URL-i.

Lõplik soovitatud laine B järjestus:

1. `K1-P0` — normatiivne tööruumileping ja adapteriregister;
2. `U1-P0` — minimaalne `DomainEvent` outbox + üks vertikaalne kasutusjuht;
3. `U1-P1` — kasutajapõhine notification-projektsioon ja minimaalne teavituskeskuse API;
4. `U1-P2` — tööruumi timeline, töölaud ja action/deep-link registry;
5. `U1-P3` — eelistused, digest, push ja kanalilaiendused.

## 10. Ruumiliste funktsioonide tootearenduse horisondid

### Horisont H1 — ühine alus

- K1-P0;
- U1-P0/P1;
- osaleja, jagamise ja nõusoleku adapteripiir;
- tööruumi action/deep-link registry.

### Horisont H2 — kolm esimest ruumilist pilooti

Soovitatud järjestus:

1. **kohtumise kokkuvõtte kinnitamine** — väikseim vertikaal sündmusest artefakti ja reaktsioonini;
2. **Teekonna kompass** — faasid, eesmärk, „mis muutus” ja järgmine tegevus;
3. **Tööheaolu iganädalane püsiruum** — rütm, lühike märkimine, võrdlus ja tugi.

### Horisont H3 — professionaalsed ja võrgustikuruumid

- Kovisiooni ruumiline ümberkujundus;
- Supervisiooni SUP-P1…P11;
- võrgustikutöö;
- juhtumitöö assistent;
- genogramm ja ökokaart;
- Meetodipeegel;
- organisatsiooni analüütika;
- koostöövariandid ja professionaalne ühistegevus;
- ESTA partnerluse järel.

3D-kaart, voice/kaamera juhtimine ja AR-laadne kest on esituskihid. Need ei tohi blokeerida K1/U1 lepingut
ega õiguste, nõusoleku ja sündmuste alust.

### Tulevikufunktsioonide jooksev süvaanalüüsiprogramm

Praeguse platvormi stabiliseerimine ja tulevikufunktsioonide analüüs on kaks paralleelset rada. Tulevikurada ei
vähenda olemasoleva platvormi auditite ega koodipakettide prioriteeti, kuid väldib olukorda, kus tehniline alus
ehitatakse valmis enne seda, kui järgmiste funktsioonide siht, sõltuvused ja ühised lepingud on läbi mõeldud.

Fable peab looma ja iga töökorra lõpus uuendama master-registrit
`docs/platvormi arendus/fable-5-tulevikufunktsioonide-suvaanaluusi-programm.md`. Registris on vähemalt paketi nimi,
eraldi väljundfail, seis (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED_DECISION`), kontrollitud Git/serveri
tõeallikas, sõltuvused, otsused ja täpne jätkamispunkt. Üks töökord lõpetab ühe piiritletud süvaanalüüsi; kõiki
teemasid ei kirjutata üheks piiritlemata dokumendiks. Iga valminud süvaanalüüsi lõpus peab olema
`STATUS: COMPLETE` ja järgmise paketi üleandmine.

| Järjekord | Analüüsipakett | Eraldi väljund | Tuumküsimus |
|---:|---|---|---|
| 1 | **COLLAB-A0** — professionaalne ühistegevus, võrgustikutöö ja kohtumise ühisvaade | `fable-5-professionaalne-uhistegevus-vorgustikutoo-ja-kohtumise-uhisvaade.md` | ühine osaleja-, rolli-, nõusoleku-, jagamise-, ülesande- ja kohtumisleping |
| 2 | **CASEWORK-A0** — juhtumitöö assistent, Meetodipeegel, genogramm ja ökokaart | `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md` | inimese otsustusõigus, metoodiline tugi ja võrgustikuandmete privaatsus |
| 3 | **WELLBEING-V2-A0** — Tööheaolu iganädalane püsiruum | `fable-5-tooheaolu-v2-iganadalane-pusiruum.md` | kerge nädalane rütm, trend, tugi ja eskaleerumine ilma küsimustikuväsimuseta |
| 4 | **SUP-V1-A0** — Supervisiooni P1–P11 | `fable-5-supervisioon-p1-p11-suvaanaluus.md` | SUP-P0 skeemialuse sidumine ruumilise kasutusvoo, artefaktide ja õigustega |
| 5 | **KOV-V2-A0** — Kovisiooni uus ruumikogemus | `fable-5-kovisioon-uus-ruumikogemus.md` | töötava põhivoo säilitamine ja selle ruumiline edasiarendus |
| 6 | **ESTA-MENTOR-A0** — ESTA ja mentorlus — **COMPLETE** | `fable-5-esta-ja-mentorlus.md` | partnerineutraalne ESTA välisviide, kaitstud mentorlussuhe, mõlemapoolne kokkulepe, kohtumised, privaatsus ja Tööheaolu sild; O-EM-1…10, 0 blokeerivat otsust |
| 7 | **FIELD-A0 + FIELD-D0** — välitöö mobiilne kest — **COMPLETE / FIELD-V1 IN_PROGRESS** | `fable-5-valitoo-mobiilne-kest.md` | 576 rida; O-FD-1/2/3 kinnitatud; FIELD-V1 teostus on Fable'i worktree's pausil testide alguses |
| 8 | **ORG-A0** — organisatsiooni analüütika — **COMPLETE** | `fable-5-organisatsiooni-analuutika.md` | 643 rida; 5-tabeline õhuke org-kiht, ORG-INV-1…12 ja `k≥5` koondimootor; ORG-V1 `ANALYSIS_READY` |

See on analüüsi-, mitte automaatne arendusjärjekord. Enne iga koodipaketti kontrollib koordinaator, kas vajalikud
K1/U1, osaleja-, nõusoleku-, jagamise-, retention- ja capability-lepingud on kinnitatud. Fable ei korda
`RUUM-VIS-A0`, `K1-U1-A0`, olemasolevaid funktsiooniauditeid ega SUP-P0 teostust, vaid kasutab neid tõendatud
sisenditena. Rakenduskoodi, skeemi, migratsioone, merge'i ega deploy'd selle raja käigus ei muudeta.

## 11. Blokeerivate otsuste register

| Otsus | Mõju | Viimane otsustushetk | Praegune soovitus |
|---|---|---|---|
| O-K1-1: K1 kanooniline sõnastik + WorkspaceKind algregister | avas K1-P0 | **KINNITATUD 17.07.2026** | analüüsi ptk 4 kuju on V1 normatiivne alus |
| O-U1-1: DomainEvent püsikiht + retention-klassid | avab U1-P0 pärast K1-P0 | **KINNITATUD 17.07.2026** | variant B; `standard90`, `short30`, `audit_long` klassid |
| O-U1-2: U1-P0 esimene vertikaal | fikseeris esimese emitteri ja auditiskoobi | **KINNITATUD 17.07.2026** | eelpöördumise staatusemuutus |
| O-E1: andmekoopia ulatus, SLA ja kustutuse ooteaeg | blokeerib EXPORT-P1/P3 | enne andmekoopia skeemi ja kustutusvoo muutmist | määra MVP pinnad, valmimisaeg ja ooteaja põhimõte |
| O-E4: salvestiste väljundileping | blokeerib salvestise ekspordi, mitte EXPORT-P0 | enne `RECORDING_ENABLED=true` | kinnita kes, mis vormis ja kui kaua saab väljundit |
| O-E5: koostööpaketi esimene tarbija | määrab EXPORT-P4 esimese adapteri | enne EXPORT-P4 | valida supervisioon, kovisioon või KOV-eelpöördumine |
| O-E2/O-E6/O-E7: andmekoopia õiguslik ulatus, vahetekst ja public/legal failid | juristi otsused; blokeerivad vastavad EXPORT-P1/õigusteksti osad | enne andmekoopia avalikku rada | jurist määrab auditijälje/kolmandate isikute piiri ja ajutise §8 protsessi |
| O-TK9 SENT säilitus A/B/C | blokeerib TK-R1 ja Teekonna retention-haru | enne TK-R1 | Fable soovitab B: anonüümitud minimaalne kandja |
| Makseridade retention konto kustutamisel | blokeerib MAKSED-P1e | enne skeemimuudatust | jurist/raamatupidamine määrab minimaalse säilitatava kirje |
| Sponsoreeritud rollimaatriks | blokeerib role-aware invite ja osa MAKSED-P1d | enne nende integratsiooni | kinnita maksja-roll → adressaadi-roll maatriks |
| SUP retention, grandi tõend ja piloot | blokeerib hilisema SUP rollout'i, mitte SUP-P0 auditit | enne esimest päris granti | minimaalne auditeeritav grant |
| FAILID AV-skann/retention SLA | blokeerib osa FAILID-P1/P2, mitte P0.1 | enne parseri-/retention-pakette | otsusta riskipõhiselt pärast P0.1 |
| A11Y localized title sõnastus | ei blokeeri koodi, kuid peab enne integratsiooni kinnitatud olema | Wave A audit | kasuta neutraalset V1 teksti |
| T17 release'i kaasamine | määrab otsingu/selge keele i18n-integratsiooni mahu | enne Wave A rehearsal'i | lisa ainult siis, kui T17 on valmis ja konflikt rehearsal'is jääb väikeseks |
| O-FD-1/2/3: retention, kohaliku hoidla kaitse ja turvasignaali saaja | avasid FIELD-V1 | **KINNITATUD 17.07.2026 FIELD-D0-s** | rakenda dokumendi kinnitatud retention-maatriks, WebCrypto AES-GCM + seadmelukk ning töötaja valitud usaldusisiku e-post; ära küsi otsuseid uuesti |
| O-ORG-1/2/3: päris org-i kinnitamine, heaolukoondi gate ja päris koondvaataja grant | piiravad ORG-V1 aktiveerimist, mitte koodi | enne vastavat päris aktiveerimist | ehita ORG-V1 gate'ide taha; partnerlepet ei vajata koodi kirjutamiseks |

## 12. Teadlikult keelatud või edasi lükatud tööd

- K1-P0 otsus on kinnitatud, kuid ära tee seda paralleelselt teise Sol/Codexi aktiivse paketiga. U1-P0 algab alles pärast K1-P0 kontrollitud valmimist.
- Ära lülita päris makseid sisse enne MAKSED-P1b–P1d ja kontrollitud rollout'i.
- Ära lülita salvestust/egress'i laiemalt sisse enne FAILID-P0.1 sõltumatut PASS-i.
- Ära alusta SUP-P1 enne SUP-P0 push'i ja auditit.
- Ära re-ingesti RAG master-listi PDF-i ega käivita kirjutavat patch-meta't ilma ops-loata.
- Ära korda DOK-XTEN, Help P0, Admin P0.1, RAG-P8.0 ega lõpetatud Fable'i tervikanalüüse.
- Ära ehita visuaalset „ruumilist kesta” enne, kui selle tööruumileping, õigused ja sündmused on määratletud.
- Ära eralda ega „korista” RV-P0 määrdunud diffi enne spetsiaalset külmutuspaketti.
- Ära käsitle serveris olevat U1-V0 teavitusvertikaali kui uut üldist DomainEvent-kihti.

## 13. Testi- ja auditimahtude poliitika

Autenditud lokaalse runtime'i jaoks kasutatakse ühiseid sünteetilisi testidentiteete failist
`docs/platvormi arendus/tehis-testkontod.md`. Ülesandesse lisatakse ainult viide registrile; PIN-e ei kopeerita.
Agent ei loo iga paketi jaoks uusi kontosid, ei kasuta tootmisandmeid ning kustutab ainult enda loodud
sünteetilise sisu, mitte ühiseid testkontosid. Kontod ei asenda sihtteste ega anna tootmispääsu.

### Koordinaatori vastuvõtt

- teostaja lõpparuandes esitatud testide, buildi ja runtime'i tulemusi ei käivitata koordinaatori poolt uuesti;
- koordinaator kontrollib ainult haru/ref'i, parent'i, commit'i ja remote SHA vastavust ning kannab ülejäänud tulemused programmi **teostaja tõendina**;
- kui tõend puudub või on vastuoluline, märgitakse see `NOT_PROVEN` ning küsitakse täpsustus; vaikimisi ei alustata kordustesti ega auditit;
- paketipõhine audit vajab kasutaja eraldi korraldust või teostaja raporteeritud P0/P1 viga;
- täissviit, koosmõju, runtime ja sõltumatu audit koondatakse release candidate'i ühte lõppväravasse.

### Paketi teostaja

- kõrge risk: sihttestid + seotud regressioonid + kogu testisviit + build + runtime;
- madal/keskmine risk: sihttestid + seotud regressioonid + lint/diff + vajadusel build;
- kogu platvormi täissviit tehakse release candidate'i koondauditis ja integratsioonis, mitte iga arenduslaine või tagastatud paketi järel;
- teostaja ei nimeta enda kontrolli sõltumatuks auditiks.

### Sõltumatu audiitor

- loeb koodi ja käivitab käitumise, mitte ainult progressidokumenti;
- kasutab täpset commitivahemikku;
- kontrollib aktiivse main'i integratsiooni;
- ei paranda auditeeritavat paketti;
- annab paketi- ja koondverdikti;
- commit'ib soovi korral ainult docs-only auditiraporti.

### Runtime

- ainult sünteetilised andmed;
- päris tootmiskasutajate sisu ei loeta;
- väliseid makse-/e-posti-/AI-kutseid tehakse ainult eraldi loal;
- koristus peab lõppema nulljäägiga või täpse põhjendusega.

## 14. Iga töökorra standardne käik

1. Loe käesoleva faili „Täpne järgmine tegevus”.
2. `git fetch` ja kontrolli `origin/main`.
3. Kontrolli, et sama teemaga ei tegele teine tegija.
4. Loo värske eraldi worktree ja `codex/…` haru.
5. Kinnita baas-SHA ja paketipiir.
6. Teosta ainult üks pakett.
7. Käivita riskile vastavad kontrollid.
8. Tee üks commit ja push; merge/deploy puudub.
9. Anna üle haru, baas, commit, testid, runtime, `not_run`, koristus ja järgmine vahemik.
10. Koordinaator uuendab seda faili ning avab järgmise paketi.

## 15. Üleandmise kohustuslik vorm

```text
Pakett:
Tegija:
Worktree:
Haru:
Baas-SHA:
Commit / remote-SHA:
Muudetud failid:
Kood valmis: jah/ei
Sihttestid:
Seotud regressioonid:
Täissviit/build/lint/i18n/Prisma:
Runtime:
not_run / not_proven:
Koristus:
Sõltumatu audit:
Main-is: jah/ei
Serveris: jah/ei
Blokeerijad:
Täpne järgmine tegevus:
```

## 16. Täpsed järgmised tegevused

Neid tehakse selles järjekorras, kui uus P0 regressioon ei muuda prioriteeti:

1. **Anna järgmise uue tervikteemana T02 `ACCOUNT-V1` ülesanne** failist `t02-account-v1-ulesanne.md`; PROF-P1 `16e688f7` läheb sama stack'i.
2. **K1-P0 haru `ef5973c9` hoitakse muutmata** ja lisatakse Wave A sõltumatusse tehnilisse kontrolli.
3. **EXPORT-P0 haru `65c82d04` hoitakse muutmata** ja lisatakse Wave A sõltumatusse koondauditisse.
4. **TÖÖLAUD-P1 haru `a2393301` hoitakse muutmata** ja lisatakse Wave A sõltumatusse koondauditisse.
5. **A11Y-I18N-P0 `15ab986f` hoitakse muutmata** ja lisatakse Wave A sõltumatusse koondauditisse.
6. **PERF-P0 audit on tooteomaniku otsusel ootel**; haru hoitakse muutmata ja kontroll lisatakse Wave A koondauditisse.
7. **AVALIK-P1S `8cae8712` on valmis ja haru hoitakse muutmata.**
8. **Paketipõhist Wave A auditit praegu ei avata.** Valmis harud ja kontrollivõlad lähevad T27 release-candidate'i koondväravasse.
9. **Koordinaator otsustab T17 kaasamise release-rehearsal'i.**
10. **Pärast PASS-i tehakse üks integratsioon ja deploy**, ainult kasutaja loal.
11. T04 `87d9a141`, T05 `33f7fb82`, T06 `f17a3c36` ja T28 `8c3e5f77` on koodina valmis. T28 on remote'il `codex/rag-v1`, local=remote ja tööpuu puhas; P8.6 päris proovipakk jääb omaniku otsuseks. RAG-QM auditit ei korrata.
12. **FIELD-A0, FIELD-D0, ORG-A0, PILOT-PARTNER-A0 ja JOURNEY-D0 on `COMPLETE`; T06 on `CODE_READY @ f17a3c36`**. T23 ESTA-MENTOR-V1 on `IN_PROGRESS_LOCAL` worktree's `SotsiaalAI-esta-mentor-v1` ja T24 FIELD-V1 on `IN_PROGRESS` samas Fable'i worktree's ning pausil testide alguses; T25 ORG-V1 ja T26 PILOT-PARTNER-V1 on `ANALYSIS_READY`. T06 autentitud runtime, cleanup ja migratsiooni DB-seis jäävad T27 koondväravasse. T26 ei ava enne release candidate'i uut koodipaketti; päris piloot ootab O-PP-1/2/3 ja G3 PASS-i. T19 pooleliolev prototüüp jätkub algses aknas; `SUP-V1-A0` ootab SUP-P0 push'i ja auditit ning tooteomanik lükkas `KOV-V2-A0` hilisemaks.

### Aktiivne ja järgmine kooditegevus

> **T28 `RAG-V1` on `CODE_READY`: `codex/rag-v1 @ 8c3e5f778d1a85eb1281ee076f578ed227aeec55`, baas T06 `f17a3c36`, parent `77510353`, viis commit'i, local=remote ja tööpuu puhas; 35 faili `+6287/−18`. Registry-reference piir, safe-fetch/dry-run, `html_or_topic` kinnitatud ingest, retry/dead-letter+lock/CAS, versioonivahetus/RAG_DELETE, seire ja mitteaktiveeritud systemd mallid on teostatud. Teostaja tõend: 18/18 siht-/seotud RAG-testi, lint/i18n/Prisma/diff-check/build ning fixture v1→v2→delete runtime ja cleanup PASS. P8.6 päris proovipakk on `NOT_DONE — OWNER_DECISION`; päris URL-korje, väline ingest ja timeri aktiveerimine on `NOT_RUN`; täissviit/audit T27-s. Main'i, serverit, merge'i ega deploy'd pole.**

> **T02 `ACCOUNT-V1` on `CODE_READY @ 929793f1339ce5754ae0206b87450e8ee1689e48`: baas `fe4eb4fa`, PROF-P1 cherry-pick `69c11be0`, remote=local ja worktree puhas. Teostaja tõend: 1314/1314, lint/i18n/Prisma/93-migratsiooni ahel/build PASS ning isoleeritud runtime+cleanup PROVEN; brauseri QA jääb T27-sse. Main/server/merge/deploy puuduvad.**

> **Järgmine valmis tervikteema on T10 `PUBLIC-V1`, olek `READY_TO_ASSIGN`. Kopeeritav leping on `docs/platvormi arendus/t10-public-v1-ulesanne.md`; see kasutab uut worktree'd/haru aktiivsest `origin/main`-ist ning võtab meta `15ab986f` ja sitemap'i `8cae8712` sama avaliku teema stack'i. Suund on registreerimislehe laadne ühe-fookuse teekond koos avaliku lugemiskihiga.**

### Fable'i seis praegu

> **PERF-COST-A0, COLLAB-A0, CASEWORK-A0, WELLBEING-V2-A0, ESTA-MENTOR-A0, FIELD-A0, FIELD-D0, ORG-A0, PILOT-PARTNER-A0 ja JOURNEY-D0 on lõpetatud; T06 JOURNEY-V1 on `CODE_READY @ f17a3c36`. T23 ESTA-MENTOR-V1 on `IN_PROGRESS_LOCAL` (commit'imata mentorluse diff olemas) ning T24 FIELD-V1 on `IN_PROGRESS` ja pausil testide alguses; T25 ORG-V1 ja T26 PILOT-PARTNER-V1 on `ANALYSIS_READY`. T26 soovitatud piloot on 1 KOV-osakond + olemasolev eelpöördumise täisrada ning enne release candidate'i eraldi koodi ei vaja. T19 pooleliolev prototüüp jätkub algses aknas. SUP-V1-A0 jääb SUP-P0 sõltuvuse taha ja KOV-V2-A0 on hilisem.
> Olemasoleva platvormi OPS-FINAL-A0 jääb release-candidate'i lõppväravaks.**

## 17. Muudatuslogi

| Kuupäev | Muudatus | Tõend / põhjus |
|---|---|---|
| 2026-07-17 | T10 PUBLIC-V1 tervikülesanne valmis | `t10-public-v1-ulesanne.md`; meta `15ab986f` ja sitemap `8cae8712` lähevad sama stack'i; kinnitatud avalik ühe-fookuse etapiteekond ning eraldi lugemiskiht |
| 2026-07-17 | T02 ACCOUNT-V1 kood valmis ja vastu võetud | `codex/account-v1 @ 929793f1`, baas `fe4eb4fa`, 10 commit'i, remote=local ja worktree puhas. PROF-P1 cherry-pick `69c11be0`; E2–E6 teostatud, 1314/1314 + lint/i18n/Prisma/93 migratsiooni/build PASS ning isoleeritud runtime/cleanup PROVEN. Brauseri QA ja koondkontroll T27-s; main/server/merge/deploy puuduvad. |
| 2026-07-17 | T02 ACCOUNT-V1 tervikülesanne valmis | `t02-account-v1-ulesanne.md`; hiljem samal päeval Fable'ile antud (`ASSIGNED_WAITING_START`); PROF-P1 `16e688f7` võetakse samasse stack'i; lukustatud verify-then-swap, turvateavituse, paroolita step-up'i, aegunud tellimuse, admini vaaterolli ja `202 pending` valikud |
| 2026-07-17 | Arendusprogramm loodud | `origin/main = server fe4eb4fa`; PROF-P1 teostuses; VEST-P0a valmis; K1-U1-A0 443 rida IN PROGRESS |
| 2026-07-17 | K1-U1-A0 lõpetatud ja arhitektuurilaine lukustatud | 707 rida, STATUS COMPLETE; K1 variant A; U1 variant B; U1-P0 vertikaal eelpöördumise staatusemuutus |
| 2026-07-17 | O-K1-1, O-U1-1 ja O-U1-2 kinnitatud | K1-P0 `READY_BUILD`; U1-P0 `READY_AFTER_K1`; retention `standard90` / `short30` / `audit_long` |
| 2026-07-17 | PROF-P1 Git-seis värskendatud | `16e688f7` local=remote, worktree puhas; testide/runtime'i lõppüleandmine puudub; Soli järgmine pakett K1-P0 |
| 2026-07-17 | EXPORT-A0 lõpetatud | 395 rida, E-1/E-2 P1; EXPORT-P0 lisatud järgmisse vabasse teostuspessa; EXPORT-P1/P3 ootavad otsuseid |
| 2026-07-17 | K1-P0 kood valmis | `ef5973c9` local=remote; 5 uut faili, +885; sihttest 5/5, täissviit 1297/1297; build baseline CSS-blokeerija; sõltumatu kontroll puudu |
| 2026-07-17 | EXPORT-P0 kood valmis | `65c82d04` remote-ref kinnitatud; 15 faili, +267/−45; 13/13 ja 1302/1302; build PASS; runtime `not_run`; sõltumatu kontroll puudu |
| 2026-07-17 | TÖÖLAUD-P1 kood valmis | `a2393301` local=remote; 5 faili, +35/−6; sihttestid 20/20, seotud testid 201/201, täissviit 1294/1294; build PASS; runtime `not_run`; sõltumatu koondaudit puudu |
| 2026-07-17 | PERF-COST-A0 lõpetatud | `fable-5-joudlus-kulu-ja-skaleeruvus.md`, STATUS COMPLETE; L1 P0: research-worker puudub ja stale job ei vabasta reservatsiooni; PERF-P0 lisatud P0-riskikorvi enne AVALIK-P1S-i |
| 2026-07-17 | A11Y-I18N-P0 kood valmis ja koordinaatori kontroll PASS | `15ab986f`, otsene parent `043f0dce`, local=remote; 4 faili +240/−2; 1/1, 7/7 ja 1254/1254; lint 0/358; i18n, build, Prisma ja diff-check PASS; autentitud runtime `not_run`; Wave A koondaudit puudu |
| 2026-07-17 | CASEWORK-A0 lõpetatud | `fable-5-juhtumitugi-meetodipeegel-genogramm-ja-okokaart.md`, 501 rida, STATUS COMPLETE; 10 otsust O-CW-1…10; rakenduskoodi, skeemi, migratsioone ega teste ei muudetud; origin/main `fe4eb4fa` kattub serveriga; järgmine analüüs WELLBEING-V2-A0 |
| 2026-07-17 | PERF-P0 kood valmis ja koordinaatori korduskontroll PASS | `5459f408`, parent `fe4eb4fa`, local=remote; 10 faili +581/−56; sihttestid 11/11, täissviit 1300/1300; lint 0/358; i18n, Prisma, skeemi-/migratsioonidiff, diff-check ja production build PASS; runtime `not_run`; ignoreeritud `.next/` cleanup blokeeritud; eraldi audit tooteomaniku otsusel edasi lükatud, järgmine kood AVALIK-P1S |
| 2026-07-17 | AVALIK-P1S kood valmis ja koordinaatori korduskontroll PASS | `8cae8712`, parent/merge-base `fe4eb4fa`, local=remote; 2 faili +59/−22; sihttest 1/1, täissviit 1293/1293; lint 0/358; i18n, Prisma, tühi skeemi-/migratsioonidiff, diff-check ja build PASS; XML-runtime 200, 10/10 unikaalset, `/meist` üks kord, 0 locale-prefix/hreflang; port 3017 vaba; main/server/merge/deploy puudub; järgmine värav Wave A koondaudit pärast PROF-P1 lõppüleandmist |
| 2026-07-17 | WELLBEING-V2-A0 lõpetatud | `fable-5-tooheaolu-v2-iganadalane-pusiruum.md`, 619 rida, STATUS COMPLETE; püsiruum = olemasoleva kihi lugemis- ja rütmikiht, 5 otsust O-WB-1…5; esimene pakett WB-V2-P0 ootab E0 järelkontrolli+merge'i; SUP-V1-A0 sõltuvus täitmata, järgmine analüüs KOV-V2-A0 |
| 2026-07-17 | KOV-V2-A0 lükatud hilisemaks | Tooteomaniku otsus; SUP-V1-A0 on samuti sõltuvuse taga, seega järgmine Fable'i analüüs on ESTA-MENTOR-A0 |
| 2026-07-17 | ESTA-MENTOR-A0 lõpetatud | `fable-5-esta-ja-mentorlus.md`, 619 rida, STATUS COMPLETE; masterregistri T23 `ANALYSIS_READY`; O-EM-1…10 vaikevalikud, 0 blokeerivat otsust; partnerineutraalne ESTA V1 ei vaja välist lepet ega K1-P0/U1-P0 eeldust; koodi, skeemi, migratsioone ega teste ei muudetud; järgmine aktiivne analüüs FIELD-A0, seejärel ORG-A0 |
| 2026-07-17 | FIELD-A0 lõpetatud | `fable-5-valitoo-mobiilne-kest.md`, 559 rida, STATUS COMPLETE; T24 `ANALYSIS_READY`, FIELD-V1 `BLOCKED_DECISION (kerge)` kuni O-FD-1/2/3 ühe otsustusringi kinnituseni; üks terviklik pakett E1–E10; järgmine Fable'i tegevus FIELD-D0 |
| 2026-07-17 | ORG-A0 lõpetatud | `fable-5-organisatsiooni-analuutika.md`, 643 rida, 22 peatükki, STATUS COMPLETE; T25 `ANALYSIS_READY`; 5-tabeline õhuke liikmesuskiht, ORG-INV-1…12 ja fikseeritud-vaadetega `k≥5` koondimootor; O-ORG-1/2/3 ei blokeeri koodi, vaid ainult päris aktiveerimist; üks terviklik ORG-V1 pakett E1–E10 |
| 2026-07-17 | ADMIN-V1-CORE kood valmis | `codex/admin-v1-core @ f5e20b21`, otsene parent `fe4eb4fa`, local=remote, 16 faili +1183/−283, worktree puhas; teostaja tõend 67/67, muudetud JS/JSX lint 0/0, i18n ja diff-check PASS; runtime `not_run`; full suite/full lint/build/audit, merge ja deploy puuduvad; järgmine teema T04 K1 `ef5973c9` stack'i pealt |
| 2026-07-17 | FIELD-D0 lõpetatud | `fable-5-valitoo-mobiilne-kest.md`, 576 rida, STATUS COMPLETE; O-FD-1 retention-maatriks, O-FD-2 WebCrypto AES-GCM + seadmelukk ja O-FD-3 töötaja valitud usaldusisiku e-post kinnitatud; T24 FIELD-V1 `READY_THEME_BUILD`; avatud blokeerivaid otsuseid ega aktiivset järgmist Fable'i tööd pole |
| 2026-07-17 | T04 WORKSPACE-EVENTS-V1 kood valmis | `codex/workspace-events-v1 @ 87d9a141`, parent K1 `ef5973c9`, local=remote, 32 faili +1797/−31, worktree puhas; teostaja tõend 146/146, lint/i18n/Prisma/93 migratsiooni/build/diff-check ja sünteetiline runtime PASS; privaatse payload'i tabamusi 0, ajutise DB jääke 0; täissviit/audit T27-s; järgmine tervikteema T05 |
| 2026-07-17 | PILOT-PARTNER-A0 lõpetatud | `fable-5-esimese-partnerpiloodi-ja-kasutuselevotu-mudel.md`, tööpuus 413 rida, 17 peatükki + edenemistabel, STATUS COMPLETE; T26 `ANALYSIS_READY`; vaikeulatus 1 KOV-osakond, 2–4 töötajat + 10–30 pöördujat ja olemasolev eelpöördumise täisrada; 12-etapiline mudel G0–G5 + STOP/rollback; O-PP-1/2/3 blokeerivad päris kasutajaid, mitte ettevalmistust; uut koodi enne release candidate'i ei vajata; G3 eeldab T27, TK-P0 ja U1-P0 release'i ning sünteetilise proovi/koolituse PASS-i |
| 2026-07-17 | JOURNEY-D0 lõpetatud | `fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md`, tööpuus 368 rida, STATUS COMPLETE; T06 kanooniline E1–E7 leping valmis; TK-P0 fail-closed jagamispiir on otsustevaba ja T26 G3 nimeline eeldus. Sama päeva hilisem JOURNEY-D1 kinnitusring avas T06 ning T05 `33f7fb82` vastuvõtt fikseeris Sol Mediumi alusharu. |
| 2026-07-17 | JOURNEY-D1 vaikevalikud kinnitatud | O-J1=B (anonüümitud faktikiht + adressaadi märkmed), O-J2=iseseisev Teekonna leht + rajasisene tagasi-nool ja O-J3=2-sammuline kustutamine + eksport. Need rakendati hiljem T06 `f17a3c36` harus; O-J1 §7.7/kustutusdialoogi täpne sõnastus kinnitatakse enne merge'i. |
| 2026-07-17 | T05 WORKBENCH-V1 kood valmis | `codex/workbench-v1 @ 33f7fb827ec35bbde3e7ce5a190213eb1c1174dc`, parent `6fa84ffa`, T04 stack `87d9a141`, local=remote, worktree puhas; stack'i diff 16 faili `+679/−76`; teostaja tõend 49/49, lint/i18n/diff-check/build ja autentitud sünteetiline runtime PASS, cleanup 0; täissviit/audit T27-s; järgmine tervikteema T06 täpselt selle stack'i pealt. |
| 2026-07-17 | T06 JOURNEY-V1 kood valmis | `codex/journey-v1 @ f17a3c365928433fbe5a9a681d6f8a91bb762010`, baas `33f7fb82`, neli järjestikust commit'i, local=remote, ahead/behind 0/0, worktree puhas; 32 faili +1062/−114; markerid 5 punast → 14/14 rohelist, koond-sihttestid 52/52, i18n/Prisma/lint/diff-check/build PASS; autentitud runtime, cleanup ja migratsiooni DB-seis NOT_RUN/NOT_PROVEN; täissviit/audit T27-s; järgmine tervikteema T28. |
| 2026-07-17 | T28 RAG-V1 vaheüleandmine | `codex/rag-v1 @ 77510353`, baas `f17a3c36`, tööpuu puhas, remote puudub; 25 faili +5462/−14; RAG-QM porditud, safe-fetch/dry-run/retrieval/admini alus valmis; teostaja tõend 105+67 testi ja build PASS; T28 jääb IN_PROGRESS, kuni P8.3, retry/dead-letter+lock/CAS, RAG_DELETE+chunks==0 ja timer/worker seire on samas harus lõpetatud ning pushitud; P8.6 jääb omaniku otsuseta välja. |
| 2026-07-17 | T28 RAG-V1 kood valmis | `codex/rag-v1 @ 8c3e5f778d1a85eb1281ee076f578ed227aeec55`, baas `f17a3c36`, parent `77510353`, local=remote, worktree puhas; viis commit'i, 35 faili `+6287/−18`. Teostaja tõend: 18/18 siht-/seotud RAG-testi, lint/i18n/Prisma/diff-check/build ja fixture v1→v2→delete runtime PASS; cleanup tehtud. P8.3 ingest, retry/dead-letter+lock/CAS, RAG_DELETE+`chunks==0` ja seire/mitteaktiveeritud systemd mallid lõpetatud. P8.6 päris proovipakk `NOT_DONE — OWNER_DECISION`; päris korje/ingest/timeri aktiveerimine `NOT_RUN`; täissviit ja sõltumatu audit T27-s; main/server/merge/deploy puuduvad. |
| 2026-07-17 | T24 FIELD-V1 teostus pausil | Fable alustas värskes FIELD-V1 worktree's E1 skeemi, teenuse-/API-kihi, retention'i, service worker'i ja UI teostust; töö jõudis testide alustamiseni ning jäi konto limiidi tõttu pausile. Lõppcommit'i, remote SHA-d ega tööpuu lõppseisu pole veel üle antud; uus teostaja seda worktree'd ei dubleeri. |
| 2026-07-17 | T23 ESTA-MENTOR-V1 pooleli leitud | `codex/esta-mentor-v1 @ 33f7fb82` worktree's `SotsiaalAI-esta-mentor-v1`; remote-haru puudub. 12 muudetud faili ning uued mentorluse API/UI/teenuse/migratsiooni failid on commit'imata. Jätkata samast worktree'st; uut mentorluse haru ei avata. |

## 18. Programmi uuendamise reegel

Iga valminud töö järel uuendatakse vähemalt:

- kanoonilise tahvli vastavat rida;
- haru/commit ja testide seis;
- audit/main/server veerge;
- teisele AI-kontole antava `koordinaatori-avariihandoff.md` praegust jätkamispunkti;
- „Täpsed järgmised tegevused” järjekorda;
- muudatuslogi.

Vana infot ei jäeta aktiivse tegevusena nähtavale. Ajalooline tõend jääb detailse handoff'i ja teemapõhise
raporti sisse.
