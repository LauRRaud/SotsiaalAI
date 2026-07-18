# SotsiaalAI arendusplaan — omanikuvaade

STATUS: ACTIVE OWNER ROADMAP  
Kuupäev: 2026-07-17  
Omanik: tooteomanik + arenduskoordinaator

Selle faili eesmärk on näidata ühe pilguga, **mida praegu tehakse, mis tuleb järgmisena ja millal muutub platvorm kasutaja jaoks terviklikumaks**. Tehniline ulatus, auditileiud ja lehtede vastutus jäävad `arendusteemade-masterregister.md` faili; siin jälgitakse ainult suuri teemaarendusi ja nende kasutajatulemust.

---

## 1. Ühe minuti vaade

| Rada | Praegune seis | Järgmine liigutus |
|---|---|---|
| **Arendus** | T01, T04, T05, T06 ja T28 on koodina valmis; T28 `RAG-V1` on `8c3e5f77` remote'il | hoia valmis harud külmutatuna; T28 P8.6 päris proovipakk vajab omaniku ingest-otsust ja koondkontroll on T27-s |
| **Tulevikuanalüüs** | JOURNEY-D0 on `COMPLETE` ning T06 teostatud | analüüsi ei korrata; haru külmutatakse T27-ni |
| **Juba arendusvalmis tulevikuteema** | T23 `ESTA-MENTOR-V1` on `ANALYSIS_READY`, 0 blokeerivat otsust | hoida valmis; avada sobivas professionaalsete ruumide laines |
| **Integratsioon** | valmis koodiharud on külmutatud; paketipõhiseid kordusauditeid ei tehta | koondada alles release candidate'i väravas |
| **Merge/deploy** | luba puudub | ainult tooteomaniku eraldi loal |

### Praegune tegemise järjekord

1. **T16 Eksport ja andmekoopia** — on pooleli `codex/export-v1 @ 4be2153f`; jätkata samas worktree's, mitte avada uut tööd.
2. **T03 Vestlus, kriisirada, hääl, Stop/retry ja töövood** — T17 `ed95d6aa` läheb samasse stack'i.
3. **T07 Dokumendid, analüüs ja süvauuring** — T17 `ed95d6aa` ja T28 `RAG-V1` aluselt; sulgeb dokumendi privaatsuspiiri ja teeb töö jätkatavaks.

**T02 Konto** on sellest järjekorrast väljas: see on koodina valmis `codex/account-v1 @ 929793f1`. T09 maksed ja T10 avalik platvorm on samuti valmis alustama, kuid järgnevad ülalolevale kasutaja põhiteekonnale.

### Mudelivaliku säästureegel

- **Terra Medium** on vaikimisi mudel selgelt piiritletud UI-, töövoo-, adapteri-, i18n- ja tavapärase teenusekihi teostusele.
- **Sol Medium** on mudel turva-, privaatsus-, autentimis-, makse-, destruktiivse toimingu, migratsiooni, ühise arhitektuuri ja release-värava tööle.
- **Terra High** ei ole vaikimisi säästuvalik: suurem reasoning-tokenite hulk võib Terra poole väiksema tokenihinna eelise suures osas ära süüa.
- **Sol High/Max/Ultra** avatakse ainult eraldi põhjendusega; ükski praegune teemaarendus neid vaikimisi ei vaja.
- **Fast mode on väljas**, sest 1,5× kiiruse eest kulutab GPT-5.6 ametliku hinnastuse järgi 2,5× krediite.
- Mudel valitakse enne ülesande andmist. Konto või mudelilimiidi tõttu jätkamine ei loo uut teemat ega õigusta mudeli vahetust keset sama haru ilma koordinaatori otsuseta.

---

## 2. Kuidas edenemist märgitakse

Igal teemal on ainult üks kasutajasõbralik olek:

| Olek | Tähendus |
|---|---|
| `VALMIS ALUSTAMA` | analüüs ja piir on piisavad ühe tervikliku arendustöö andmiseks |
| `TÖÖS` | üks nimetatud arendaja töötab ühe haru peal |
| `KOOD VALMIS` | töö on push'itud ja teostaja kontrollid läbitud; koordinaator teste ei korda |
| `KOONDAMISEL` | teema on valitud release candidate'i integratsiooni |
| `SERVERIS` | kasutaja loal deploy'tud ja release-smoke läbitud |
| `OOTAB ALUST` | enne teemat peab valmima nimetatud teine teema |
| `OOTAB OTSUST` | tooteomaniku, õigus-, metoodika- või partneriotsus on päriselt vajalik |
| `HILJEM` | tooteomanik on teema teadlikult edasi lükanud |

Analüüsi valmimine ei tähenda, et funktsioon on koodina valmis. `ANALYSIS_READY` tõlgitakse siin olekuks `VALMIS ALUSTAMA`.

---

## 3. Arenduslained

### Laine 1 — platvormi juhitav alus

**Tulemus kasutajale ja omanikule:** platvormi saab turvaliselt hallata, sündmused ei kao eri moodulitesse ning pooleli töö saab hiljem ühtselt jätkuda.

| Järjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 1 | T01 `ADMIN-V1-CORE` | **Sol Medium** | **KOOD VALMIS — `f5e20b21`** | admin näeb ausaid mõõdikuid ja operatiivloendureid ning ohtlikud toimingud kasutavad serveriväravaid |
| 2 | T04 `WORKSPACE-EVENTS-V1` | **Sol Medium** | **KOOD VALMIS — `87d9a141`** | tööruumidel on ühine descriptor, sündmus, teavitus, ack ja esimene eelpöördumise vertikaal |
| 3 | T18 `PERF-OPS-V1` | **Sol Medium** | **OSALINE KOOD VALMIS; OOTAB TE1/T1/T4 OTSUST** | research-worker, katkestamine, kulud, tähtajad ja durable workerid on repo-hallatud ning nähtavad |

T18 ei avata üksiku worker-parandusena. Kui TE1 otsus tehakse, jääb see sama PERF-OPS tervikteema sisse.

### Laine 2 — igapäevane põhiteekond

**Tulemus kasutajale:** inimene saab abi küsida, näeb muutusi, jätkab pooleli tööd ning liigub Teekonna või teenuseni.

| Järjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 4 | T05 `WORKBENCH-V1` | **Terra Medium** | **KOOD VALMIS `33f7fb82`; T27 VÄRAVAS** | autentitud avaleht koondab continuity, teavitused, jagamised ja järgmised tegevused |
| 5 | T06 `JOURNEY-V1` | **Sol Medium** | **KOOD VALMIS `f17a3c36`; RUNTIME/MIGRATSIOON T27-S** | Teekond, eelpöördumine, fail-closed jagamine, jätkamine, kustutamine ja eksport moodustavad ühe ausa elutsükli |
| 6 | T03 `CHAT-VOICE-V1` | **Opus või Sol Medium** | **VALMIS KÄSITLETAVAKS** | VEST-P0/P0a ja T17 `ed95d6aa` alus; kriisirada, tekst, hääl, Stop/retry ning töövoo käivitamine töötavad sama elutsüklina |
| 7 | T11 `SERVICE-MEDIATION-V1` | **Opus või Sol Medium** | **KOOD VALMIS `7acb7a33`; RUNTIME/MIGRATSIOON T27-S** | Teenusekaart, teenuseprofiil, nõusolekuga kontakt ning loend/kaart on ühel harus; ruum tekib alles vastuvõtja ACCEPT-il |

### Laine 3 — liitumine, konto ja avalik lubadus

**Tulemus kasutajale:** avalik info vastab päris tootele ning liitumine, konto ja tellimus ei anna eksitavaid lubadusi.

| Järjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 8 | T02 `ACCOUNT-V1` | **Opus** | **KOOD VALMIS** — `codex/account-v1 @ 929793f1` | verify-then-swap, sessioonide tühistus, turvateavitused, step-up, profiiliseisud ja modaalileping on valmis; brauseri QA ning koondkontroll T27-s |
| 9 | T09 `PAYMENTS-V1` | **Opus või Sol Medium** | **VALMIS KÄSITLETAVAKS** | P1a ja T02 alus ning lukustatud tehnilised vaikemudelid; tellimus, reconciliation, webhookid, tühistamine ja sponsoreeritud kasutus moodustavad ühe elutsükli |
| 10 | T10 `PUBLIC-V1` | **Terra Medium** | **VALMIS KÄSITLETAVAKS** — meta/sitemap aluscommit'id + tervikülesanne | avaleht, võimalused, registreerimine, hinnastus, juhend ja õigusinfo vastavad tegelikule funktsionaalsusele |
| 11 | T15 `A11Y-I18N-V1` | **Terra Medium** | **OSALINE KOOD VALMIS** | ET/EN/RU, klaviatuur, ekraanilugeja, 200% tekst, mobiil ja reduced-motion on ühises kasutuslepingus |

T15 nõuded kehtivad juba iga nähtava teema Definition of Done'is; seda ei jäeta lõppu pelgaks parandusauditiks.

### Laine 4 — dokumendid, teadmus ja andmete teisaldatavus

**Tulemus kasutajale:** dokumenti saab luua, analüüsida, jätkata, leida ja eksportida ning allikate värskus on kontrollitav.

| Järjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 12 | T28 `RAG-V1` | **Sol Medium** | **KOOD VALMIS** | turvaline allikate elutsükkel ja admini tööjärjekord on teostatud; päris kümne allika proovipakk vajab eraldi omanikuotsust |
| 13 | T07 `DOCUMENTS-RESEARCH-V1` | **Terra Medium** | **VALMIS KÄSITLETAVAKS** | T28 ja T17 alus on valmis; dokumendi mustand, analüüs, süvauuring, jätkamine ja katkestamine on kasutajale leitavad ja ausad |
| 14 | T16 `EXPORT-V1` | **Opus või Terra Medium** | **TÖÖS — JÄTKA SAMAS HARUS** | `codex/export-v1 @ 4be2153f` sisaldab WIP-andmekoopia alust; lõpeta registry, ZIP/job, retention ja kustutuse-eelne valik sama haru peal |
| 15 | T17 `SEARCH-LANGUAGE-V1` | **Opus** | **KOOD VALMIS — `ed95d6aa`** | isiklik otsing ja selge keel on push'itud; kahe kasutajaga live-runtime jääb T27-sse, Fable'i piirikontroll on edasi lükatud |
| — | T08 `FILES-MEDIA-V1` | **Sol Medium** | **HILJEM** | avamisel tehakse kogu faili-, heli-, salvestise-, retentioni- ja cleanup-elutsükkel ühe teemana |

### Laine 5 — professionaalsed ruumid ja töövormid

**Tulemus kasutajale:** spetsialist saab turvaliselt kohtuda, teha koostööd, valmistada juhtumit ette, kasutada supervisiooni või mentorlust ning töötada välitööl.

| Sõltuvusjärjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 16 | T12 `ROOMS-CALLS-V1` | **Sol Medium** | **OSALINE KOOD VALMIS** | liitumine, liikmesus, kutse, kõne, nõusolek, salvestis ja lahkumine on üks ruumituum |
| 17 | T20 `COLLAB-V1` | **Terra Medium** | **T04 ALUS VALMIS; OOTAB T12** | püsiruum, osalejad, jagamine, kohtumised, kinnitusring, ülesanded ja üleandmine töötavad koos |
| 18 | T21 `CASEWORK-V1` | **Sol Medium** | **T04 ALUS VALMIS; OOTAB T20** | juhtumitugi, Meetodipeegel ning genogrammi-/ökokaardivaated kasutavad sama privaatset andmestikku |
| 19 | T14 `WELLBEING-V2` | **Terra Medium** | **T04 ALUS VALMIS; E0 KOOD OSALISELT VALMIS** | „Minu kirjed”, nädalane rütm, naasmine, väljundid ja privaatne jätkutee on terviklikud |
| 20 | T22 `SUPERVISION-V1` | **Sol Medium** | **T04 ALUS VALMIS; OOTAB SUP-P0 PUSH'I JA OTSUSEID** | grant, leping, kohtumised, jagamine, kokkuvõte, sulgemine ja purge moodustavad ühe ruumi |
| 21 | T23 `ESTA-MENTOR-V1` | **Terra Medium** | **TEOSTUS POOLIK; COMMIT/PUSH PUUDUB** | mentori leidmisest suhte lõpetamiseni on üks partnerineutraalne, privaatne ja kinnitatud voog; jätkatakse olemasolevas worktree's |
| 22 | T24 `FIELD-V1` | **Sol Medium** | **TEOSTUS POOLIK; TESTIDE ETAPIS** | offline-, seadme-, privaatsus- ja olemasolevasse tööruumi üleandmise leping on kinnitatud; Fable jätkab samas worktree's testidest kuni ühe lõppüleandmiseni |

T23 võib tehniliselt varem avaneda, kuid vaikimisi hoitakse see selles laines, et ruumide ja sündmuste alus ei hakkaks eri funktsioonides lahknema.

### Laine 6 — ühine ruumikogemus, organisatsioon, piloot ja release

**Tulemus:** erinevad funktsioonid kasutavad sama töögrammatikat, organisatsioon näeb ainult turvalist koondit ning tervik läbib ühe lõppkontrolli.

| Järjekord | Teema | Soovitatud mudel | Tänane olek | Valmis siis, kui… |
|---:|---|---|---|---|
| 23 | T19 `SPATIAL-WORKSPACE-V1` | **Terra Medium** | **ANALÜÜS VALMIS; TOOTMISKOODI LUBA PUUDUB** | üks dokk, faasiriba, Fookus/Ülevaade/Võrdlus ja flat/reduced-motion toimivad korduskasutatava mootorina eri teemades |
| 24 | T13 `COVISION-V2` | **Terra Medium** | **HILJEM; TÖÖTAV PÕHIVOOG SERVERIS** | olemasolev kaheksaetapiline loogika saab omaniku loal uue ruumikogemuse ilma põhivoogu uuesti ehitamata |
| 25 | T25 `ORG-V1` | **Sol Medium** | **ANALÜÜS VALMIS; VALMIS ALUSTAMA** | liikmesus, õigused, k-anonüümsus, basis ja Tööheaolu/teenusepuudujäägi koond välistavad indiviidi jälgimise |
| 26 | T26 `PILOT-PARTNER-V1` | **Terra Medium** | **OOTAB PARTNERIOTSUST JA RELEASE CANDIDATE'I** | piloodil on kasutusjuhud, andmekaitse, koolitus, mõõdikud, tugi ja rollback |
| 27 | T27 `OPS-RELEASE-FINAL` | **Sol Medium** | **LÕPUVÄRAV** | koondtest, sõltumatu audit, migratsioonid, backup/restore, workerid, monitooring, deploy ja rollback on tõendatud |

T19 ei ole ühe lehe demo. Selle esitlusmootor võetakse kasutusele koos päris teemaarendustega ning näitevalikus säilivad Dokumendi koostamine, Tööheaolu, Teekond, Kovisioon, Registreerimine ja lugemiskiht.

---

## 4. Omaniku otsused, mida on lähiajal päriselt vaja

| Millal | Otsus | Miks |
|---|---|---|
| enne T06 merge'i | O-J1 §7.7 ja kustutusdialoogi täpne sõnastus | JOURNEY-D1 sisuline vaikevalik on kinnitatud; omanik vaatab enne merge'i üle ainult pöördumatu konto kustutamise teksti |
| enne T18 tervikteostust | TE1, T1 ja T4 | research-worker, Stop-usage ning kuluajaloo horisont |
| enne T09 tervikteostust | O-M1…O-M6 ja O-J1…O-J4 vajalik alamhulk | reconciliation, tühistamine, clawback ning finants-/PII-piir |
| enne T22 päris granti/purge'i | grandi tõend, retention ja piloodi ulatus | Supervisiooni ligipääs ja kustutamine on pöördumatud tooteotsused |
| enne T25 päris aktiveerimist, mitte enne koodi | O-ORG-1/2/3 | päris org-i kinnitamine, heaolukoondi sisselülitus ja päris ANALYTICS_VIEWER grant; koodi võib ehitada gate'ide taga |

T01 esimene tervikskoop ei oota capability-migratsiooni ega ChatLog-retentioni otsust: need jäävad teadlikult praegusest ADMIN-V1-CORE tööst välja.

---

## 5. Ühe teemaarenduse valmimise reegel

Teema märgitakse `KOOD VALMIS` ainult siis, kui:

1. kogu kokkulepitud kasutajaeesmärk töötab algusest lõpuni, mitte ainult üks route või auditi alamleid;
2. olemasolevad valmis commit'id on taaskasutatud, mitte uuesti kirjutatud;
3. ET/EN/RU, mobiil, ligipääsetavus, laadimis-, tühi- ja veaseisud kuuluvad samasse töösse;
4. teostaja on ühe korra teinud teema sihttestid, sihtlintimise ja vajalikud tehnilised kontrollid;
5. lõpparuandes on haru, parent, commit, remote SHA, tehtud ulatus ja ausad `NOT_PROVEN` read;
6. koordinaator kontrollib Git-fakte, kuid ei korda teostaja teste ega telli automaatselt uut auditit;
7. merge'i ega deploy'd pole tehtud ilma tooteomaniku eraldi loata.

Täissviit, koosmõju, sõltumatu koondaudit ja deploy-valmidus tehakse üks kord T27 release candidate'i lõppväravas.

---

## 6. Kuidas seda faili pärast iga lõpparuannet uuendada

Pärast iga Fable'i või Sol/Terra lõpparuannet tehakse ainult kolm muudatust:

1. uuendatakse peatüki 1 „Ühe minuti vaadet”;
2. muudetakse vastava T-teema olekut tema laines;
3. nihutatakse järgmine teema ühe rea võrra edasi.

Uut arendusülesannet ei looda üksiku auditi, testi, faili, route'i, `P0.x` tähise ega konto limiidi tõttu. Kui töö jätkub uuel kontol, jätkub sama T-teema, sama haru ja sama üleandmisleping.

---

## 7. Tõeallikad

1. Git ja rakenduskood — tegelik teostus.
2. `koordinaatori-handoff-2026-07-16.md` — aktiivne töö-, haru- ja serveriseis.
3. `platvormi-arendusprogramm-2026-07-17.md` — tehnilised väravad ja release'i reeglid.
4. `arendusteemade-masterregister.md` — kõigi T01–T28 teemade detailne ulatus, lehevastutus ja auditite katvus.
5. Käesolev fail — tooteomaniku lihtne järjekorra- ja edenemisvaade.
6. Mudelivalik — OpenAI Codexi mudelijuhis ja krediiditabel, kontrollitud 2026-07-17; benchmark'i põhine tööreegel on Sol Medium kõrge riski ning Terra Medium selgelt piiritletud tavateostuse jaoks.
