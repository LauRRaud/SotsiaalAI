# SotsiaalAI koordinaatori avariihandoff teisele AI-kontole

STATUS: ACTIVE TRANSFER TASK

Viimati uuendatud: 2026-07-18 (integratsiooni järel; koordineerib kasutaja ise)

## Ülesanne

Sina oled SotsiaalAI ajutine arenduskoordinaator. Jätka olemasoleva kanoonilise seisu alusel. Ära alusta arendusprogrammi, analüüse ega auditeid nullist.

Töökaust:

`C:\Users\rauds\Desktop\SotsiaalAI`

Kui sul puudub ligipääs sellele kohalikule töökaustale, palu kasutajal lisada vähemalt käesolev fail, kaks allpool nimetatud kanoonilist dokumenti ning viimane saabunud lõpparuanne. Ilma repo ligipääsuta ei tohi Git-, worktree-, remote- ega failiseisu kinnitatuks lugeda.

## Loe kõigepealt täielikult

1. `docs/platvormi arendus/koordinaatori-handoff-2026-07-16.md`
2. `docs/platvormi arendus/platvormi-arendusprogramm-2026-07-17.md`
3. `docs/platvormi arendus/arendusteemade-masterregister.md`
4. `docs/platvormi arendus/arendusplaan-omanikuvaade.md`

Kanoonilise handoff'i alguses on peatükk „Järgmise akna käivitusseis — 2026-07-17”. Lähtu esmalt sellest. Käesolev fail on ülekandeülesanne; vastuolu korral on värskem kontrollitud Git-seis ja kanooniline handoff ülimuslikud.

## Kriitilised tööreeglid

- **UUENDATUD 18.07:** kohalik põhitööpuu on PUHAS ja kohalik `main @ 0ea13453` on uus kanooniline baas (26 haru konsolideeritud, värav roheline: 1551 testi + i18n + 96-migratsiooni ahel + lint + build). `origin/main` (server) on kohalikust `main`-ist 66 commit'i TAGA ja jääb puutumata kuni eraldi deploy-otsuseni.
- Uued teemaharud luuakse kohalikust `main`-ist (mitte `origin/main`-ist); põhitööpuud ennast kasutatakse ainult read-only baasina.
- Uus kooditöö tehakse ainult eraldi värskes worktree's ja ülesandes nimetatud baascommit'i pealt.
- Ära merge'i ega deploy ilma kasutaja eraldi selgesõnalise loata.
- Ära käivita `OPS-FINAL-A0`; see jääb release candidate'i lõppväravaks.
- Ära loe tootmiskasutajate sisu ega kasuta päris kasutajaid testimiseks.
- Ära saada päris e-kirju, tee päris makseid ega kontakteeru päris partneriga ilma eraldi loata.
- Ära korda teostaja teste, build'i, runtime-smoke'i ega sõltumatut auditit, kui lõpparuanne sisaldab nende tulemusi.
- Paketipõhised sõltumatud auditid ja täissviidid on tooteomaniku otsusel koondatud T27 release-candidate'i väravasse.
- Üks funktsiooniteema tähendab vaikimisi üht haru, üht terviklikku teostust ja üht lõppüleandmist, mitte hulka mikropakette.
- Analüüsidokumentide `P0.1`, `P1.2` jne on teema sisemised kontrollpunktid, mitte automaatselt eraldi arendusülesanded.
- Katkenud teemaarendus jätkub samas worktree's ja harus [`teemaarenduse-jatkamise-kord.md`](./teemaarenduse-jatkamise-kord.md) järgi. Konto tüüp ega limiit ei muuda teemaülesande ulatust.

## Esimene tegevus uues aknas

Kontrolli odavalt ja read-only viisil muutlikud Git-faktid:

- põhitööpuu branch, HEAD ja määrdunud seis;
- `origin/main`;
- kasutaja lõpparuandes nimetatud remote-haru SHA;
- commit'i parent või stack'i alus;
- nimetatud worktree branch ja puhtus;
- aruandes nimetatud diffstat.

Ära jooksuta selle kontrolli käigus teste, build'i ega runtime'i.

Kui kontrollitud Git-fakt erineb käesoleva faili hetkeülevaatest, kasuta kontrollitud fakti ja uuenda pärast vastuvõttu kõik kanoonilised dokumendid.

## Praegune jätkamispunkt

### 18.07 integratsioon (ülimuslik allolevate "ei ole main'is" märgete suhtes)

Kohalik `main @ 0ea13453` sisaldab nüüd 26 liidetud haru: kogu Faas-1 P0/P1 kiht (admin-v1-core, a11y-i18n-p0, u6/u7, perf-p0, maksed-p1a, k1-p0, prof-p1, avalik-p1s, vest-p0/p0a, rag-qm-p0/p0a, tooheaolu-e0 jt), T17 search-language, T11 service-mediation, T04+T05 workspace-stack, T06 journey, T28 rag-v1, supervision-v0-skeem ja registreerimise jaamalend. Allpool olevad „ei ole main'is” laused kehtisid 17.07 seisuga; Git-seis on ülimuslik.

**Edasi lükatud (disainikollisioon, EI liidetud):** T03 `chat-voice-v1` (kannab vanemat Räägi/Kirjuta spatial-entry mudelit; main'is on uuem mic-nupu lahendus), T02 `account-v1` + T16 `export-v1` (verify-then-swap e-postimudel vs main'i kohene swap; export sõltub account'ist). Kõik kolm haru on remote'is alles; igaüks vajab sihitud rebase+lepitussessiooni, mitte mehaanilist merge'i.

**Teadaolev .env-leid:** `SUBSCRIPTION_RECURRING_ENABLED` on seatud, aga `MAKSEKESKUS_PUBLIC_KEY` puudub → maksed-p1a uus check-env reegel kukutab deploy-kontrolli. Enne deploy'd lisada võti või keelata recurring.

**Backup'id:** `backup/main-pre-sync-2026-07-18`, `backup/main-pre-integration-2026-07-18`, `integration/2026-07-18` (= main).

### Valmis alus

- T01 `ADMIN-V1-CORE`: `CODE_READY @ f5e20b2190ec043b8c598cd81c77cc844575b10b`.
- T04 `WORKSPACE-EVENTS-V1`: `CODE_READY @ 87d9a141ee609597844912dcc37ca949a13c3329`.
- T04 otsene parent on K1 `ef5973c9eecfd8a9664dc2a0d7eb8c29f793b23a`.
- T04 haru, feature flag'id ja tootmismigratsioon ei ole main'is ega serveris.
- T26 `PILOT-PARTNER-A0` on `COMPLETE`; T26 on `ANALYSIS_READY`, kuid enne release candidate'i eraldi piloodikoodi ei avata.

### Viimane vastu võetud arendus

T06 `JOURNEY-V1` on vastu võetud, kuid ei ole main'is ega serveris.

Kontrollitud faktid:

- haru `codex/journey-v1`;
- baas T05 `33f7fb827ec35bbde3e7ce5a190213eb1c1174dc`;
- lõppcommit/local/remote `f17a3c365928433fbe5a9a681d6f8a91bb762010`, ahead/behind `0/0`, worktree puhas;
- neli järjestikust commit'i; diff 32 faili `+1062/−114`;
- teostaja tõend: markerid 5 punast → 14/14 rohelist, koond-sihttestid 52/52, i18n/Prisma/lint/diff-check/build PASS;
- autentitud runtime, cleanup ja migratsiooni rakendamise DB-seis `NOT_RUN/NOT_PROVEN`; need lähevad T27 koondväravasse;
- merge ja deploy puuduvad.

### Fable'i analüüside seis

- `JOURNEY-D0` on vastu võetud: `fable-5-teekond-ja-eelpoordumine-v1-arendusleping.md`, tööpuus 368 rida, `STATUS: COMPLETE`.
- T06 fail-closed jagamisleping on otsustevaba ja üheselt määratud.
- JOURNEY-D1 vaikevalikud kinnitati 17.07.2026: O-J1=B, O-J2=iseseisev Teekonna leht + rajasisene tagasi-nool ja O-J3=2-sammuline kustutamine + eksport.
- T19 `RUUM-VIS-D1` prototüüp jäi algses Fable'i aknas limiidi tõttu pooleli. Seda ei alustata uues aknas nullist; algne aken jätkab pärast limiidi taastumist.
- Uut sõltumatut Fable'i süvaanalüüsi praegu ei avata.

### T28 vastuvõetud kood

T28 `RAG-V1` on `CODE_READY`, mitte aktiivne jätkuülesanne.

- Worktree `C:\Users\rauds\Desktop\SotsiaalAI-rag-v1`, haru `codex/rag-v1`, lõppcommit ja remote `8c3e5f778d1a85eb1281ee076f578ed227aeec55`, baas T06 `f17a3c36`, otsene parent `77510353`, local=remote, tööpuu puhas.
- P8.3 kinnitatud `html_or_topic` ingest, retry/dead-letter + advisory-lock/CAS, versioonivahetus/RAG_DELETE + `chunks==0` fixture-runtime ning seire/mitteaktiveeritud systemd mallid on lõpetatud. Teostaja tõend: 18/18 RAG-testi, lint/i18n/Prisma/diff-check/build/runtime ja cleanup PASS.
- [`t28-rag-v1-mitme-konto-ulesanded.md`](./t28-rag-v1-mitme-konto-ulesanded.md) on ajalooline järjestikuste etappide üleandmisfail; seda ei väljastata enam uuesti.
- P8.6 päris kümne allika proovipakk on `NOT_DONE — OWNER_DECISION`; päris korje/ingest ja timeri aktiveerimine pole tehtud. Täissviit ja sõltumatu audit kuuluvad T27-sse.
- T06 jääb külmutatuks `f17a3c36`; selle runtime-/migratsioonitõend tehakse T27-s, mitte eraldi auditiülesandena.

T24 `FIELD-V1` on aktiivne, kuid pausil Fable'i worktree's testide alguses. Skeemi-, teenuse-, API-, retention-, service worker'i ja UI töö on teostaja vaheinfo järgi pooleli; lõppcommit'i, remote SHA-d ja tööpuu lõppseisu pole veel üle antud. Uus konto ei dubleeri seda tööd; algne Fable jätkab samast worktree'st.

**Järgmine väljastatav tervikteema on T10 `PUBLIC-V1`** — leping `t10-public-v1-ulesanne.md` on 18.07 uuendatud uuele baasile (kohalik `main @ 0ea13453`; meta+sitemap cherry-pick'e enam ei vajata, need on baasis). Paralleelaknasse on väljastatud ka T07 `DOCUMENTS-RESEARCH-V1` (`t07-documents-research-v1-ulesanne.md`, baas uuendatud 18.07 kohalikule `main`-ile; worktree `SotsiaalAI-documents-research-v1`, haru `codex/documents-research-v1`). T09 `PAYMENTS-V1` on blokeeritud kuni T02 account-lepitus on tehtud. Selleks on 18.07 väljastatud kolmas ülesanne: **T02+T16 LEPITUS** (`t02-t16-account-export-lepitus-ulesanne.md`, worktree `SotsiaalAI-t02-t16-remerge`, haru `codex/t02-t16-remerge`; verify-then-swap võidab, PROF-P1 kaitsed säilivad).

T23 `ESTA-MENTOR-V1` on samuti pooleli ning seda ei anta uue teemana välja. Worktree `C:\Users\rauds\Desktop\SotsiaalAI-esta-mentor-v1`, haru `codex/esta-mentor-v1 @ 33f7fb82` (T05 baas), remote-haru puudub. Worktree sisaldab 12 muudetud faili ning uusi mentorluse API/UI/teenuse/migratsiooni faile; enne jätkamist loe olemasolev diff ja ESTA-MENTOR-V1 algne leping. Ära puhasta, rebase'i ega tee uut mentorluse worktree'd.

## T06 vastuvõtu lõpetus

T06 Git-ahel, remote SHA, diff ja tööpuu puhtus on kontrollitud; registreid on uuendatud. Teostaja teste, buildi ega runtime'i ei korrata. T06 on `CODE_READY`, mitte main'is ega serveris. Runtime, cleanup ja migratsiooni DB-seis on ausalt tõendamata ning jäävad T27-sse. Merge'i ja deploy'd ei tehta.

## T06 kinnitatud otsused

- O-J1: autori konto kustutamisel jääb adressaadile anonüümne faktikiht ja tema märkmed.
- O-J2: Teekond saab iseseisva täislehe ning koostamisrajal on tagasi-nool ainult raja sees.
- O-J3: kasutaja saab Teekonna jäädavalt kustutada 2-sammulise kinnituse järel; seotud eelpöördumised jäävad, side katkeb ning enne pakutakse eksporti.

T06 on `CODE_READY @ f17a3c36`; TK-P0…P5 eraldi pakette ei avata. Haru hoitakse muutmata T27-ni.

## Mudelivalik

- Terra Medium: tavapärane terviklik frontend/backend teemaarendus.
- Sol Medium: suurema turva-, privaatsus-, migratsiooni- või keeruka olekumasina raskusega arendus.
- Terra High: kasuta ainult siis, kui teema vajab erakordselt laia repoülest integratsiooni; see ei ole vaikimisi valik.
- T06 soovitus: Sol Medium.
- Claude Fable 5 Low: ainult väike, madala riskiga ja selgelt piiritletud muudatus; mitte tervikliku T-teema jaoks.
- Claude Fable 5 Medium, kui see on valikus: hea vaikimisi tase tavapärase tervikliku teemaarenduse jaoks.
- Claude Fable 5 High: kasuta privaatsus-, turva-, migratsiooni-, retention'i-, kustutamis- või keeruka olekumasinaga tervikteemal. T06 soovitus Claude'i keskkonnas on Fable 5 High.
- Fable 5 kõrgeimat/max effort'i ei kasutata tavapärase lõpparuande vastuvõtuks ega dokumentide uuendamiseks; see kulutaks koordinaatoritöös limiiti tarbetult.

## Dokumentide muutmise reeglid

- Kasuta olemasolevaid dokumente; ära loo sama teema kohta uut konkureerivat registrit.
- Säilita paralleelsete sessioonide muudatused.
- Ära stage'i ega commit'i määrdunud põhitööpuu dokumente.
- Kasuta failimuudatusteks patch-meetodit.
- Pärast muutmist kontrolli dokumentide `diff --check` tulemust ja vastuolulisi aktiivseid staatuseid.
- Käesolevat faili uuendatakse pärast iga vastu võetud lõpparuannet nii, et „Praegune jätkamispunkt” ja järgmine arendus oleksid värsked.

## Lõppvastus kasutajale

Teata lühidalt:

- milline töö vastu võeti;
- millised Git-faktid kontrolliti;
- mida teadlikult uuesti ei testitud;
- milliseid kanoonilisi dokumente uuendati;
- mis on järgmine terviklik arendusteema;
- kas mõni otsus vajab kasutaja kinnitust;
- kinnitus, et merge'i ega deploy'd ei tehtud.
