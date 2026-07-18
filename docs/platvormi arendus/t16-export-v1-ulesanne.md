# ÜLESANNE: T16 `EXPORT-V1` — eksport, andmekoopia ja kustutuse-eelne koopia

**Olek:** `READY_TO_ASSIGN`  
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine  
**Soovitatud teostaja:** Opus või Terra Medium  
**Järjekord:** T02 `ACCOUNT-V1 @ 929793f1` on valmis ja tuleb samasse stack'i võtta, sest andmekoopia ja kustutuse-eelne ooteaken kasutavad sama konto-/sessiooni-/kustutuslepingut. Päris kasutajaandmeid ega tootmiskoopiat ei loeta.

## Eesmärk

Kasutaja eristab selgelt üksiku faili või vestluse allalaadimist oma tervikandmekoopiast. Ta saab taotleda turvalise ZIP-koopia oma andmetest, näha selle valmimist, laadida selle piiratud ajal alla ning enne konto kustutamist valida, kas ta soovib koopia valmis saada. Ükski eksport ei leki teise inimese sõnumeid, märkmeid, kontakte ega auditite toorsisu.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-andmete-eksport-teisaldatavus-ja-koostalitlus.md` — tervikuna; eriti ptk 4, 6–8, 11–15 ja 17
4. `docs/platvormi arendus/arendusteemade-masterregister.md` — T16
5. T02 lõpparuanne ning konto kustutuse lõppharu `codex/account-v1 @ 929793f1339ce5754ae0206b87450e8ee1689e48`
6. aluscommit `65c82d048e52554cede55aec9fec8a828975ddc6` (`EXPORT-P0`), `lib/chat/exportDocument.js`, `lib/documents/docxExport.js`, `lib/documents/pdfExport.js`, `lib/aggregateExport.js`
7. olemasolev `DataDeletionJob`, failide/objektide omandikontroll, teavitus/outbox, retention ning kasutaja kustutuse töövoog.

## Alus ja worktree

1. Kontrolli enne alustamist `origin/main` ja T02 remote SHA-d `929793f1339ce5754ae0206b87450e8ee1689e48`. Kasuta ainult koordinaatori kinnitatud T02 stack'i, sest T02 ei ole veel main'is.
2. Ära kasuta ega muuda määrdunud põhitööpuud `C:\Users\rauds\Desktop\SotsiaalAI`.
3. Loo uus worktree, näiteks `C:\Users\rauds\Desktop\SotsiaalAI-export-v1`, ja haru `codex/export-v1` kinnitatud T02 alus-SHA-st.
4. Too EXPORT-P0 samasse stack'i `cherry-pick -x 65c82d048e52554cede55aec9fec8a828975ddc6`. Säilita selle DOCX Unicode, PDF fail-closed ja CSV valemisüsti kaitse; ära muuda algset haru.

## Lukustatud V1 valikud

| Teema | V1 valik |
|---|---|
| Koopia sisu | Profiil ja nõustumised; kasutaja enda vestlused koos oma sõnumite ja kasutajale nähtavate assistendivastustega; oma Teekonnad; oma dokumendid/artefaktid; enda Tööheaolu kirjed; enda eelpöördumiste saatja-vaade; „Minu jagamised” faktid. |
| Väljas | Teiste inimeste ruumisõnumid, adressaadi märkmed, teiste kasutajate andmed, privaatne auditijälg, täis teavituste ajalugu, salvestised ning admini koondid. Need ei lähe koopiasse enne eraldi õigusotsust. |
| Vorm | Üks ZIP: `manifest.json`, versioonitud JSON/NDJSON pindade kaupa ning olemasolevad kasutajale kuuluvad originaalfailid. Üksik PDF/DOCX/CSV allalaadimine jääb eraldi toiminguks. |
| Valmimine | `DataExportJob` on asünkroonne ja idempotentne. Taotlus nõuab T02 step-up'i; valmis ZIP on omanikule saadaval 7 päeva, ühe aktiivse tööga korraga. |
| Kustutuse seos | Kustutustaotlus pakub enne pöördumatut etappi „koosta koopia” või „jätka ilma koopiata”. Koopia valik peatab lõpliku kustutuse kuni koopia valmimise või 7-päevase kasutaja valitud ooteaja lõpuni; ligipääs/sessioonid sulguvad kohe vastavalt T02 lepingule. |
| Teavitus | Valmimine ja allalaadimine on minimaalsed sündmused/outbox-teavitused; e-kiri ei sisalda ZIP-i ega privaatset sisu. |
| Õiguspiir | Juristi art 15, kolmandate isikute, auditilogide ja avalike/legal failide lõppkinnitus on `NOT_PROVEN`; see blokeerib vaid V1-st välja jäetud sisu ning päris rollout'i, mitte turvalise enda-andmete MVP-d. |

## Teostus

### E1 — EXPORT-P0 alus ja ekspordiregister

- Too P0 stack'i ning säilita kõik olemasolevad üksikekspordi turvalepingud. Paranda vajadusel ainult T16 piires CSV `= + - @` prefiksi neutraliseerimine ning ekraanil nähtav eristus üksikekspordi ja andmekoopia vahel.
- Loo käsitsi hallatav V1 ekspordiregister: iga pind deklareerib oma omaniku filtri, serialiseerija, faili kaasamise reegli, versiooni ja kolmandate isikute välistuse. Ära loo supertabelit ega sõltu veel merge'imata K1-st.
- Iga serialiseerija kasutab minimaalset allowlist-projektsiooni. Puuduv adapter tähendab „ei kaasata”, mitte toorandmete automaatset dump'i.

### E2 — DataExportJob, ZIP ja turvaline allalaadimine

- Lisa `DataExportJob` olekumudel, idempotentsusvõti, progress, aegumine ja failure-põhjus. Kasuta DataDeletionJob/retention muster ning advisory-lock/CAS, et kordustaotlus/race ei tee kahte koopiat.
- Taotlus nõuab serveris T02 step-up'i, ei võta kasutajalt pindu/päringukonstruktsiooni ning ei ava exporti võõrale ega adminile kasutaja nimel ilma olemasoleva autoriteetse aluseta.
- Koosta ZIP voona/piiratud partiidena; manifest sisaldab ainult skeemiversiooni, töö ID, genereerimisaja, pinna nime, kirjehulka ja failide räsi. Ära pane manifesti andmete sisu, tokenit või teise inimese ID-d.
- Allalaadimine kontrollib omanikku ja aegumist, jätab minimaalse auditikirje ning ei anna objekti olemasolu-oraaklit. ZIP salvestus ja ajutised failid puhastuvad retentioniga.

### E3 — kasutajatee ja kustutuse-eelne koopia

- Lisa profiili/andmete pinnale „Taotle andmekoopia” koos selge sisu, väljasolevate andmete, valmimisaja, aktiivse töö ning aegumise selgitusega. Kasutaja saab töö tühistada enne valmisolekut; tühistus ei kustuta kontoandmeid.
- Valmis koopia saab eraldi allalaadimisnupu ja staatuse. Veaseis, aegumine, kordustaotlus ja tühistamine on eristatavad ning ei väida, et andmed on hävinud.
- Seo T02 kustutusflowga: enne lõppkinnitust saab inimene valida koopia, oodata, või jätkata ilma koopiata. Kustutuse edenemise taustatöö kontrollib DataExportJob-i seisusid idempotentselt; job ega ZIP ei takista lõpmatult kustutust.
- Ära muuda T02 turvalist sessioonide sulgemist, 202 pending või anonüümset kustutuse vastust.

### E4 — teavitus, audit ja retention

- Kasuta olemasolevat teavitus/outbox kihti sündmustele `requested`, `ready`, `downloaded`, `failed`, `expired`, `cancelled`; payloadis on ainult töö ID ja kasutajale vajalik staatus, mitte koopia sisu.
- Audit on sisuta ning korduskindel. Jälgi, et retry ei saadaks kahte „valmis” kirja ega genereeriks uut ZIP-i.
- Retention kustutab aegunud ZIP-i, ajutised osad ja jobi tundliku väljundiviite; auditi minimaalne fakt säilib olemasoleva retentioni põhimõttel.

### E5 — keeled, a11y ja koostalitluse tõend

- Lisa ET/EN/RU copy, klaviatuur, ekraanilugeja olekuteated, mobiili- ja reduced-motion rada. Ära lisa alla laaditavasse ZIP-i tõlkimata UI-sõnumeid ega kasutajaliidese tekste.
- Lisa iga registripinna manifestiversiooni- ja JSON-kujutuse test. Üksik DOCX/PDF/CSV eksport peab jääma selgelt eraldi ning P0 Unicode/409/CSV testid säilima.

## Selgelt väljas

- Kolmandate isikute ruumi-/koostöösisu, adressaadi märkmed, auditijälje täiskoopia, salvestised, admini koondid, arved/kviitungid ja public/legal failide väljastus.
- Päris kasutajaandmete eksport, päris e-kirjad, välissalvestus, tootmisandmed või kustutuse lõplik käivitamine.
- K1, T07, T08, T12, T16-järgne koostööpakett ning juristi lõppotsuste ümberteostus.
- Merge, deploy, PR, põhitööpuu puhastus, rebase ja force-push.

## Nõutud testilepingud

1. Iga V1 registripind tagastab vaid omaniku allowlistitud väljad; võõra kasutaja, ruumisõnumi, adressaadi märkme, audititoorvälja või tokeni leke puudub.
2. Taotlus nõuab step-up'i; üks aktiivne job on idempotentne; race/cancel/retry ei tooda topelt-ZIP-i.
3. Manifest on versioonitud, räsidega ning ei sisalda sisu/sekretse; ZIP-is on ainult lubatud failid ja JSON/NDJSON.
4. Allalaadimine on omanikule, aegumisele ja kustutusele turvaline; võõras/puuduv/aegunud job ei anna olemasolu-oraaklit.
5. Kustutuse koopia-valik, ooteaeg, „ilma koopiata” jätkamine ning lõpuaegumine on idempotentsed ja ei jäta ligipääsu/sessiooni avatuks.
6. Ready/downloaded/outbox teavitused ja audit on dedupeeritud ning sisuta; retention eemaldab ZIP-i ja ajutise väljundi.
7. CSV valemisüst on neutraliseeritud; P0 DOCX Unicode ja PDF fail-closed lepingud jäävad roheliseks.
8. ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja reduced-motion on andmekoopia ja kustutusvaliku pindadel kaetud.

Käivita T16 sihttestid, muudetud failide lint, `npm run i18n:check`, Prisma validate + migratsiooniahela kontroll, `git diff --check` ja production build. Täissviit ja sõltumatu release-audit jäävad T27-sse.

## Sünteetiline runtime ja DoD

Kasuta ainult lokaalset sünteetilist DB-d ning töö käigus loodud kontot/vestlust/Teekonda/dokumenti. Tõenda koopia taotlus→ready→download→expiry, võõra kasutaja keeld, job race/cancel ning kustutuse koopia-valik; korista ZIP-id, jobid ja testandmed. Kui see pole turvaliselt võimalik, raporteeri `NOT_RUN`/`NOT_PROVEN`.

Valmis on siis, kui E1–E5 on samas harus, EXPORT-P0 alus on säilinud, kasutaja enda-andmete koopia ei leki teisi inimesi, kustutuse-eelne valik on aus, worktree on puhas ja commit/push tehtud. `main`, server, merge ja deploy jäävad puutumata.

## Lõpparuanne

Esita worktree, haru, baas ja T02 alus-SHA, EXPORT-P0 cherry-pick SHA, lõppcommit/remote SHA, migratsioonid, E1–E5 kokkuvõte, testid/lint/i18n/Prisma/diff-check/build, runtime/cleanup või `NOT_RUN`/`NOT_PROVEN`, V1-st välja jäetud andmeliigid ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

Pärast lõpparuannet teeb Fable fokuseeritud kontrolli: ekspordiregistri omandipiir, manifest/ZIP sisu, kustutuse-eelne valik, retention ning kolmandate isikute välistus. Täissviiti ega uut ekspordiauditit ei korrata.
