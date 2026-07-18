# SotsiaalAI koordinaatori avariihandoff teisele AI-kontole

STATUS: ACTIVE TRANSFER TASK

Viimati uuendatud: 2026-07-17

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

- Kohalik põhitööpuu on kasutaja muudatustega määrdunud ja `origin/main`-ist maas.
- Põhitööpuud ei puhastata, stage'ita, commit'ita, merge'ita ega kasutata uue arendusharu baasina.
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
