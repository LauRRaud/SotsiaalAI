# ÜLESANNE: T14 `WELLBEING-V2` teine viil — kontrollpunkt, „kas pidas?" ja kirje parandus

**Olek:** `READY_TO_ASSIGN` (otsused langetatud 19.07 — vt SEIS „Otsustering 19.07").
**Teostus:** üks worktree, üks haru, üks terviklik lõppüleandmine.
**Soovitatud teostaja:** Fable 5 High või Sol High (koondi-invariandid + olemasoleva `records.js`/`aggregate.js` puutumine).
**Alus:** `fable-5-tooheaolu-v2-iganadalane-pusiruum.md` (ptk 10 pakett WB-V2-P2, ptk 7.1 adapter, ptk 4 privaatsusinvariandid) + `fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` (ptk 12 TO-1/TO-2, ptk 13 E3).
**Eelmine viil:** [`t14-wellbeing-v2-ulesanne.md`](./t14-wellbeing-v2-ulesanne.md) (E1+E2 = P0+P1) — **TEHTUD ja LIVE** (`8eb3430b` → server `ac0b7d3f`).

## Eesmärk

Esimene viil andis kasutajale kirjete **lugemisraja**: näeb, avab, kustutab. See viil sulgeb ringi teise poole — kasutaja saab kirjele **järgmise sammu ja kontrollkuupäeva** panna, tähtajal küsitakse „kas pidas?", ja eksinud kirje saab **parandada uue kirjena** ilma mustri-statistikat tagantjärele ümber kirjutamata.

Kandev mõte (ptk 3.4 p5): rütmi väärtus tuleb sellest, et **eelmise nädala sisend muutub järgmisel nädalal nähtavaks väärtuseks**. Lugemiskiht üksi on album; kontrollpunkt teeb sellest ringi.

## Loe enne tervikuna

1. `CLAUDE.md`
2. `docs/platvormi arendus/teemaarenduse-jatkamise-kord.md`
3. `docs/platvormi arendus/fable-5-tooheaolu-v2-iganadalane-pusiruum.md` — **ptk 4** (privaatsusinvariandid W-INV), **ptk 7.1** (adapteri `nextAction` leping), **ptk 10** (pakett WB-V2-P2 ja tema piirid).
4. `docs/platvormi arendus/fable-5-tooheaolu-tervikloogika-ja-jatkuteed.md` — **ptk 12** (TO-1, TO-2 sõnastus), **ptk 13 E3** (teostuse kolm sammu).
5. `docs/platvormi arendus/SEIS.md` — „Otsustering 19.07" (otsuste kanooniline sõnastus) + „T14 teostus 19.07" (mis eelmises viilus valmis sai).
6. Kood: `lib/wellbeing/records.js`, `lib/wellbeing/aggregate.js` (**`buildWhere` on selle viilu süda**), `lib/wellbeing/supportDrafts.js`, `components/wellbeing/MyRecordsWorkflow.jsx`, `app/api/wellbeing/records/**`, `lib/workspaces/adapters/wellbeingAdapter.js`, `lib/workspaces/workspaceContinuity.js`, `lib/notifications.js` + `lib/actions/registry.js` (U1 pind).
7. `docs/platvormi arendus/tehis-testkontod.md` enne lokaalset autentitud kontrolli.

## Alus ja worktree

> **JADATÖÖ REEGEL.** Üks haru, üks teostaja. E1–E3 on selle haru sisemised etapid, mitte eraldi väljastused.

1. **Baas = `main`-i PRAEGUNE tipp.** Koostamise ajal `f8295403`. Kui `main` on vahepeal liikunud → alusta praegusest tipust ja raporteeri kasutatud SHA.
2. Worktree: `git worktree add ../SotsiaalAI-wellbeing-kontrollpunkt -b codex/wellbeing-kontrollpunkt main`.
3. **Worktree `node_modules`: tee `npm ci`, ÄRA tee junction'it/sümbollinki põhitööpuule** — see lõhub Turbopacki (`Symlink [project]/node_modules is invalid`) ja build jääb tõendamata. Õppetund T22-st.
4. Tõlkefailid ainult selle viilu võtmetes; ET/EN/RU pariteet.
5. Lõpetamisel: väravad rohelised → **`main`, server, merge, deploy puutumata kuni omaniku loani.**

## Otsuste alus (langetatud 19.07 — ära tõlgenda ümber)

| Otsus | Valik | Mida see koodis tähendab |
|---|---|---|
| **TO-1** | **„Paranda uue kirjena" (versioonitus)** | Vana kirje JÄÄB alles ja jääb omanikule loetavaks; parandus on UUS kirje, mis viitab vanale. **Päris muutmine (UPDATE vastuste peal) on KEELATUD** — see kirjutaks mustri-statistika tagantjärele ümber. Kustutamine jääb päris kustutuseks (§19.8). |
| **TO-2** | **U1 sündmus + badge, e-kirjata** | Kontrollpunkti tähtaeg tekitab U1-sündmuse JA badge'i „Minu kirjed" vaates. **E-kiri jääb välja** — ka opt-in'ina mitte. Tööandja-poolset rütmi ei teki (§19.2 keeld). |

## Skoop ja otsuste väravad (OLULINE — loe enne alustamist)

**Selle ülesande skoop = WB-V2-P2 + TO-1 versioonitus.** Rütmikihi ülejäänud osa EI kuulu siia.

**⚠ Parandus SEIS-i varasemale väitele:** 19.07 otsustering kirjutas „T14 rütmiviil P2–P5 avatud". **See oli liiga lai.** Paketispetsi (ptk 10) järgi avanes ainult **P2**; P3–P5 kannavad edasi omi väravaid:

| Pakett | Puuduv värav | Miks ei kuulu siia |
|---|---|---|
| **P3** nädalarütm + `weekly_checkin_due` | **O-WB-1** (nädalakirje kuju — „viimane hetk: enne P2/P3"), **O-WB-5** (PAUSED = „rütm väljas" semantika), **O-WB-2a** (U1 admin-tõrkeloendi maskimine), + TH-U1 järjekord | taimer-tootja + kanalieelistused + admin-maskimine on eraldi tööpind |
| **P4** nädalaruumi vormirütm | TO-8 (vormifaktor) | kujundusotsus |
| **P5** uued väljundid, koondi tugevdamine | TO-3/4/5/7/9 + O-WB-2 auditilogi | otsuste laine |
| Org-suunaline koond | **O-WB-3 õigusanalüüs** | kas heaolumarkerid = GDPR art 9 |

**Kontrollpunkt ≠ nädalarütm.** Selles viilus on kontrollpunkt **kasutaja enda pandud kuupäev konkreetsel kirjel**. Iganädalane `weekly_checkin_due` taimer-tootja (ptk 7.2) on P3 ja jääb VÄLJA.

## Teostus

### E1 — TO-1 „paranda uue kirjena" (versioonitus)

- **Versiooniahel.** Kirje saab viidata kirjele, mida ta parandab. Uus kirje luuakse tavarada pidi (kõik olemasolev valideerimine/skoorimine kehtib), lisaks side vanale.
- **Koondi-invariant (KRIITILINE).** Parandatud (vana) kirje **peab kukkuma elusast koondist välja**, muidu topeltloendus rikub täpselt selle statistika, mille kaitseks TO-1 (c) valiti. Tee see `aggregationEligible = false` kaudu vanal kirjel — väli on olemas, on indekseeritud (`@@index([aggregationEligible, workflowType, createdAt])`) ja `aggregate.js` `buildWhere()` filtreerib juba selle peal. **`aggregate.js`-i ennast EI muudeta.**
- **Omanikule jääb kõik nähtavaks.** Vana kirje on „Minu kirjed" vaates endiselt avatav, märgistatud „parandatud" + link uuele; uus kirje viitab tagasi. Ahel on omanik-skoobis nagu kõik muu.
- **Kustutus jääb päris kustutuseks.** Ahela liikme kustutamine ei tohi jätta rippuvat viidet ega katkestada teiste kirjete lugemist.
- **Keelatud:** olemasoleva kirje vastuste UPDATE; „parandamise" peitmine kasutaja eest; vana kirje vaikne kustutamine paranduse ajal.

**Migratsiooniotsus (teadlik kõrvalekalle paketispetsist).** Ptk 10 ennustas P2-le „0 migratsiooni", **aga see ennustus tehti enne TO-1 vastust** ja `WellbeingRecord`-il ei ole versiooniahela välja. Kaks teed:

- **(A) SOOVITATUD — üks additiivne migratsioon:** nullitav enda-viide (nt `supersedesRecordId` + indeks, `onDelete: SetNull`). Päris viiteterviklikkus, indekseeritud ahelapäring, kustutus ei jäta rippuvat viidet.
- **(B) 0 migratsiooni:** viide `standardizedFields` JSON-i sisse. Hoiab „0 migratsiooni" lubaduse, aga ilma FK/indeksita — ahelapäring muutub JSON-skaneeringuks ja kustutus võib jätta surnud viite.

**Vali (A)** ja nimeta migratsioon `20260720xxxxxx_wellbeing_record_supersede` (main'i uusimast hilisem). Kui valid (B), põhjenda lõpparuandes. `followUp` ja soovituse „tehtud" olek (E2) mahuvad olemasolevatesse JSON-väljadesse ja **ei vaja migratsiooni kummalgi teel**.

### E2 — Kontrollpunkt, „kas pidas?" ja soovituse „tehtud" olek (WB-V2-P2)

- **„Järgmine samm + kontrollkuupäev" plokk** kõigi tööriistade lõppu. Andmed lähevad `standardizedFields`-i — **skeemimuutust ei ole** (ptk 13 E3 p1).
- **„Kas pidas?" märge** kirje avamisel, kui kontrollkuupäev on käes: pehme `followUp` võti JSON-is (ptk 13 E3 p2). Kolm ausat olekut — pidasin / ei pidanud / ei ole veel selge. **Ei mingit skoori, striiki ega punast loendurit** (W-INV-4: nädalate/õnnestumiste loendamine oleks skoor).
- **Soovituse „tehtud" olek:** klikk soovitusel + naasmine märgib `recommendedActions` JSON-is (ptk 13 E3 p3).
- **Badge „Minu kirjed" vaates** avatud kontrollpunkti kohta. Badge töötab ka ilma U1-ta (ptk 10) — ehk E2 on E3-st sõltumatu ja peab üksi töötama.
- **Vahelejätmine on võrdväärne tulemus** (ptk 3.4 p2): möödunud kontrollpunkt ei kuhju „võlaks", ei kuvata punasena, ei katke „streak". Vaade näitab olemasolevat, mitte auke.

### E3 — TO-2 U1-sündmus kontrollpunkti tähtajal

- Kontrollpunkti saabumine tekitab **U1-sündmuse olemasolevas `NotificationEvent` mustris**: adressaat AINULT omanik, sisuta (fakt + viide), dedupe-võti kirje+tähtaja kohta.
- **Kasuta olemasolevat sündmuseperekonda** (`workspace.next_action_due` klass). **ÄRA loo uut teavituskanalit ega neljandat osalejasüsteemi** (K1-U1 keeld).
- **E-post on VÄLJAS** — TO-2 otsus. Ka mitte opt-in'i taga. See on toote-, mitte tehniline piir: ära „paranda" seda mugavuse nimel.
- **`weekly_checkin_due` EI kuulu siia** — see on P3 ja tal on omad väravad (O-WB-1/O-WB-5/O-WB-2a).
- **Adapteri `nextAction`:** ptk 7.1 lubab pärast TO-2 kujul `{labelKey: "wellbeing.space.checkpoint", dueOn}` — **kuupäev JAH, workflowType/sisu EI**. `wellbeing_space` descriptor peab jääma sisutuks (W-INV-7); ainult kontrollpunkti OLEMASOLU on omanikule-ainult descriptor'is lubatud.

## Selgelt väljas

- **P3 nädalarütm** (`weekly_checkin_due` taimer-tootja, rütmiseadistus sees/väljas/päev, PAUSED-semantika, admin-loendi maskimine, kanalieelistused), **P4** (vormirütm, töötoad 3–5 sammuks), **P5** (uued väljundid, koondi tugevdamine), **org-suunaline koond** (O-WB-3).
- Kirje vastuste päris muutmine (TO-1 välistas), e-kiri kontrollpunktist (TO-2 välistas), uus workflowType, uus konteinertabel, Flight/3D.
- `aggregate.js` arvutusloogika muutmine (ainult `aggregationEligible` lipp vana kirje peal — päring ise jääb puutumata).
- Merge, deploy, PR, põhitööpuu puhastus, tootmisandmete lugemine, päris kasutajate testimine.

## Nõutud testilepingud

1. **Versiooniahel on omanik-skoobis:** võõras ei näe ega saa parandada; parandus võõra kirje peale → 404.
2. **Koondi-invariant:** kirje parandamine eemaldab VANA kirje elusast koondist ja lisab UUE — koondnumber ei kasva parandamisest. (See on selle viilu tähtsaim test.)
3. **Vana kirje jääb loetavaks** ja on märgistatud „parandatud" + viide uuele; uus viitab tagasi.
4. **Kustutus ahelas:** ahela liikme kustutamine on päris kustutus, ei jäta rippuvat viidet, teised ahela liikmed jäävad loetavaks.
5. **Kontrollpunkt:** „järgmine samm + kontrollkuupäev" salvestub `standardizedFields`-i ja tuleb detailvaates tagasi; `followUp` kolm olekut salvestuvad; soovituse „tehtud" olek püsib.
6. **Badge** kuvab avatud kontrollpunkti ilma U1-ta (E2 üksi töötab).
7. **U1:** kontrollpunkti sündmus on omanik-adressaadiga, sisuta ja dedupe'itud; **e-posti rada ei aktiveeru** (negatiivne test — mitte ainult „ei kutsu", vaid tõenda, et rada on suletud).
8. **Adapteri sisutus:** `wellbeing_space` descriptor `nextAction`-iga ei lekita workflowType'i, signaale ega sisu; võõras → tühi.
9. **E0/E1-regressioon ei katke:** `records.js` advisory-lock + `deduplicated` leping, „Minu kirjed" lugemis-/kustutusrada, V6 continuity href.
10. ET/EN/RU pariteet, klaviatuur, fookus, aria-live, reduced-motion katavad kontrollpunkti ploki + „kas pidas?" + badge.

Käivita T14 sihttestid + kahjustatud regressioonid (Tööheaolu + koond + K1-adapter), muudetud failide lint, `npm run i18n:check`, `prisma validate`, `npm run db:migrate:check` (kui valid tee A), `git diff --check`, build. Täissviit + sõltumatu audit → T27.

## Sünteetiline runtime ja DoD

Lokaalne sünteetiline DB + testidentiteedid. **Tõenda päris päringutega** (mitte ainult fake-prismaga): parandusahel omanik-skoobis, **koondnumber enne ja pärast parandust**, kontrollpunkti salvestus ja tagasilugemine, U1-sündmuse teke ilma e-postita, adapteri sisutus. Korista loodud kirjed/mustandid/sündmused.

Valmis on siis, kui E1–E3 on samas harus, koondi-invariant on runtime-tõendatud, kontrollpunkt+badge töötavad ilma U1-ta, U1-sündmus on sisuta ja e-postita, adapter jääb sisutuks, E0/E1-pind ei katke, worktree puhas, commit tehtud. `main`, server, merge, deploy puutumata.

## Lõpparuanne

Esita worktree, haru, baas-SHA, lõppcommit SHA, **migratsioonid (tee A = 1 additiivne, või tee B põhjendus)**, E1–E3 kokkuvõte, testid/lint/i18n/Prisma/migrate-check/diff-check/build, sünteetiline runtime + koondnumbri tõend, cleanup, VÄLJAS jäänud P3–P5 + org-koond, ning kinnitus, et tootmisandmeid, merge'i ega deploy'd ei puudutatud.

## Lõpetamisel: uuenda AINULT `SEIS.md`

1. **Seisutabeli T14 rida** → uus olek, haru + SHA, baas-SHA, väravad, `NOT_PROVEN`.
2. **Järjekord** → mis avanes, mis järgmine.
3. **Vananenud väide** → paranda kohe. **Sh:** „T14 rütmiviil P2–P5 avatud" tuleb parandada — avanes ainult P2; P3 väravad on O-WB-1/O-WB-5/O-WB-2a.

Masterregistrit ei uuendata oleku pärast. Kirjuta SEIS-i ka pooleliolek.
