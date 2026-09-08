# RAG v2 kontrollitud väljalaske ettevalmistus ja nelja vormingu ühendus

08.09.2026. **Kohalik kood ja piiratud mehaaniline vastuvõtt on kontrollitud. Tootmisväljalase ning nelja vormingu pärismudelirada on NOT_PROVEN.** Aktiivset järgmist tööd juhib [SotsiaalAI.md S1.0/S2](../platvormi%20arendus/SotsiaalAI.md); siin on selle ploki dateeritud tõend.

Alus on [GitHubi audit](../SOTSIAALAI_GITHUB_AUDIT_9780dee9c_2026-09-08.md) ja [tööettepanek](../CODEX_JARGMINE_PLOKK_VALJALASE_JA_TERVIKRADA.md). Lähte-HEAD ja kontrollitud `origin/main` olid `9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd`. Lõplik rakenduskoodi commit on **`ad44c302e64c2330002c8f482a740fe4c17c5e42`**. Raporti hilisem dokumentatsiooni-commit ei muuda ehitatud koodi. [Masintõend](../rag-v2/release-integration-2026-09-08.json) sisaldab kõigi 47 kaasatud koodifaili Git-blob'i SHA-256 räsi, allikaversioone, indeksiobjektide arve ja mõõtmisi.

## Kaasatud muudatused

- Olemasolev, eelnevalt üle vaadatud [M1 sisendiplokk](../rag-v2/adr-010-source-structure-and-chunking.md): PDF/HTML/XML/JSON, algvara ja metaandmete päritolu, muutumatud versioonid, struktuursed tekstiosad ning allikakohtade kandmine otsingusse, M4-sse ja allikavaatesse. Uut paralleelset parserit ei ehitatud.
- F02: `IntakeService.get()` kontrollib PDF-i või metadata lugemise ja räsi kontrolli järel uuesti konkreetset kviitungit värske dokumendiloaga. Üksnes lubatud administraatoriks jäämine ei anna enam eemaldatud dokumendi faili.
- F01: Cloudflare'i moodulskript on asünkroonne. Brauseri diagnostika kasutab kolme eraldi krüptograafiata lepingumoodulit; vastuseteksti räsi, allikavaliku loomine ja serveripoolne valideerimine jäid serverisse. Diagnostikat ei eemaldatud.
- Brauserikontrollis leitud allikavaate viga: M4 piloot näitas ka HTML/XML/JSON puhul tühja PDF-lehekülje silti. Nüüd kuvab see tegeliku vormingu ja versioonidetailides täpse allikatee/vahemiku. ET/EN/RU juhis vastab neljale vormingule.

Korpuse kaustade ümbertõstmine, `Andmebaasi/REGISTER.*`, arhiiv, omaniku lisamaterjalid, hindamispaketid ja häälvaate failid jäid sellest koodicommit'ist välja. `scripts/lib/source-master-knowledge-docs.mjs` registritee muutus kuulub varasemasse korpuse korrastusse; see pole rakenduse build'i sõltuvus ning jäi samuti eraldi. Failid stage'iti nimeliselt. Omaniku 08.09 agentide kasutamise keeld on kantud S11-sse; lõppülevaatuse tegi vastutav kirjutaja ise.

## Kontrollitulemused

| Kontroll | Tulemus ja tõendi piir |
| --- | --- |
| Intake'i teenuse sihttest | **14 pass, 0 fail, 0 skip**, `TZ=UTC`. PDF ja metadata tõrjuvad lugemise ajal eemaldatud dokumendiloa; konto jääb administraatoriks. JSON-kviitungi sama piir ja lubatud lugemine säilivad. Enne parandust ebaõnnestusid mõlemad uued binaarse vara regressioonijuhud oodatud tõrke puudumise tõttu. |
| Diagnostika lepingud | **4 pass, 0 fail, 0 skip**. Privaatne küsimusetekst ei lähe projektsiooni; allikavaliku sidumine ja vastuse räsi kontroll säilivad. |
| Cloudflare'i layout-leping | **1 pass, 0 fail, 0 skip**. |
| Varasem M1 vastuvõtt | [50 valitud juhtumit](../rag-v2/m1-source-acceptance-2026-09-08.json), sealhulgas 18 struktuurijuhtu; sama M1 teostust ei testitud rituaalselt uuesti. Vana `rag-v2/1` PDF-i 16 tekstiosa ja veel kaheksa olemasoleva dokumendi lugemine on seal tõendatud. |
| Lint ja i18n | Läbisid. Kogu lint jättis kaks varasemat hoiatust: `CurvedInput` hook'i sõltuvus ja `TiltedCard` tõlkimata tekst. Hilisema allikavaate muudatuse sihitud lint ja i18n läbisid. |
| Lõplik tootmisbuild | **Turbopack ja Webpack läbisid** sama lõpliku koodipuu peal, `TZ=UTC`. Vahepealne Webpacki tõrge paljastas kolmanda krüptoimpordi `sourceSelection` kaudu; lõppbuild sisaldab selle parandust. |
| Tüübid / skeem | M1 tüüpidel on varasem sihitud kontroll; Prisma skeemi ega migratsioone ei muudetud. |
| Diff | `git diff --check` ja stage'itud koodi kontroll läbisid. |
| Avaldatud CI | Selle kohaliku commit'i GitHub Actions ning puhas Linuxi `npm ci` on **not_run**. Kohalikud Windowsi build'id ei tõenda Actionsi rohelist staatust. |

Npm-i auditis nimetatud 19 sõltuvushoiatust ei ole siin valideeritud turvaleidudeks ümber nimetatud. Täpne advisory-, dev/runtime- ja kasutatava raja liigitus on eraldi lahti; jõuga sõltuvusuuendusi ei tehtud. M1 `htmlparser2` sõltuvus ja lukufail kuuluvad kontrollitud koodisse.

## Nelja vormingu päris salvestus- ja lugemisrada

Eraldatud kohalik tenant `m1-source-acceptance-20260908`, PostgreSQL ja Qdrant; **4 dokumenti / 52 tekstiosa, mock-vektorid, 0 välist mudelikutset**. Kasutati olemasolevat M1 muutumatute bundle'ite valimit ja olemasolevat indeksi CLI-d. PostgreSQL-ist loetud bundle'id olid algsete bundle'itega täpselt võrdsed. Otsingu tõendipaketi S-viide lahendati PostgreSQL-i kanoonilise resolutsiooni kaudu ning kontrolliti algteksti, versiooni, bibliograafiat ja vahemikke.

| Vorming | Allikas / üksused | Kontrollitud näidiskoht |
| --- | --- | --- |
| PDF | Katrin Pedastsaar, „Lastekaitse juhtumikorraldusest sotsiaalteenuste ja -toetuste andmeregistris”, 2016; 10 tekstiosa | Otsinguviites tegelikud PDF-lehed 3–4, esimene vahemik lk 3 `[1859,3623)`. UI eraldi näites lk 2. Ajakirjalehti ei võrdsustatud PDF-lehtedega. |
| HTML | Raili Pütsepp, eakate seksuaalse eneseteostuse artikkel, 25.09.2024; 7 tekstiosa | DOM-tee lõpp `h3[2]`, `[0,28)`, ja järgnevad lõigud. `pdf_pages=[]`. |
| XML | „Sotsiaalhoolekandelise abi andmise kord”, avaldamine 01.11.2019; 29 tekstiosa | `/oigusakt[1]/sisu[1]/peatykk[4]/paragrahv[3]`, element `para22`, `[0,2082)`. `pdf_pages=[]`; puuduv autor jäi puuduvaks. |
| JSON | Alutaguse „Asendushooldusteenus”; 6 tekstiosa | Ainult kirje `alutaguse_vald_service_asendushooldusteenus`, `/items/0/conditions`, `[0,96)`. Kogu KOV-paketti ei käsitletud ühe teenuse identiteedina; autor ja avaldamisaeg jäid puuduvaks. |

Algvara-/metadata-räsid ja kõik versioonid on masintõendis; täielik metaandmete päritolu on lisaks M1 vastuvõtus. Uute vormingute M3 teadmiskandidaatide ankurdamine ei laienenud selle kontrolliga: teadmiskihile ei omistata tekstiosade läbimise põhjal vastuvõttu.

## Autenditud kohalik allikavaade

Olemasolevas eraldatud arendusandmebaasis ja testkasutajaga läbiti päris brauseris iga vormingu vastuse loomine, allika modaal, lehe uuestilaadimine ning sama vestluse/allika taastamine. Neljas katses kasutati **kohalikku fikseeritud M4 testadapterit**, üks embedding- ja üks vastuseetapp iga näite kohta, 0 väliskutset ja 0 rahalist kulu. Adapter luges samu muutumatuid failiversioone; see ei kasutanud ülal mõõdetud PostgreSQL-i otsingupäringut. Need on kaks ühenduslepingut tõendavat kontrolli, mitte üks pärismudeli tootmispäring.

PDF-i ja HTML-i eraldi `/chat-source` vaade avanes õige teksti ning asukohaga. Testkasutaja eemaldamisel kohalikust lubatud kasutajate loendist keelas allikavaade ligipääsu ja ei näidanud algteksti; õiguse taastamisel tuli sama HTML-allikas tagasi. Esimene vana fikstuurikatse peatus `stage_budget_not_configured` veaga enne mudelitransporti; parandati privaatse katsekonfiguratsiooni etapipiirid. Rakenduse turvaväravat ei nõrgendatud. Testide dev-server lõpetati.

## Katkestus, ajalooline viide ja tagasipöördumine

Lähteindeks: `search_generation_4e290603189d3ce8009a95fc0fdf32931c70e35eb932c5a9790cb036d2a6a2bd`.

HTML-ist tehti eraldi selgelt sünteetilise arendusmuudatusena märgitud versioon; algallikat ei muudetud. Avaldamine katkestati pärast PostgreSQL-i sammu ja enne valmimist: vana aktiivne indeks jäi alles. Kordus lõpetas põlvkonna `search_generation_581c35371911741f1f52df4456eb4a85b8406eba869e05db0278bd1a33d89500`: 45 cache-tabamust, 7 uut mock-vektorit, 0 välist kutset. Vana avaldatud HTML-viite sisu jäi muutumatuks.

Seejärel taastati eraldatud tenanti vana aktiivne põlvkond käsitsi hooldustehingus: head lukustati, kontrolliti oodatud aktiivset põlvkonda ja tellimuse järjenumbrit ning vana põlvkonna `ready` olekut. `requested_sequence` säilitati monotoonsena. See **ei tähenda**, et vana `indexSnapshot()` kordamine teeb automaatse rollback'i: vana järjenumber ei tohi uut tellimust üle kirjutada. Tootmise tagasipöördumist ei käivitatud.

## Serveri tegelik kooskõla 08.09 kell 07:00 UTC

Ainult lugemine, 0 serverimuudatust, 0 välist mudelikutset. Frontend oli aktiivne SHA-l `9780dee9c68b0ea699b4a4cee2f8257bb84ce5dd`.

| Kiht | Mõõdetud valik |
| --- | --- |
| Allikaregistri põlvkond | `generation_71046a49e931530a218e57d9925439f7c5018d6ff7ac05c3996927fdd89bf13d`, 8 dokumendiversiooni |
| `rag_v2_head` | `search_generation_cce615aba3a9fa3e5a6a0ab573dc655e660fcdb33eabc7918a18e6c6093ed4af`, `ready`, 8 dokumenti / 69 tekstiosa; versioonid vastavad registrile |
| M4 plaan | `m4-evidence-comparison-baseline-20260907-1`, `search_generation_386d51771eff1ece99cc354144ea589736a4c36c18101847dc57d6e3665d4e6e`, profiil `vector-ranked-first-v1` |
| M4 dokumendierinevused | ESTA andmekaitse/eetilised valikud ja Tehnopoli programm: kaks varasemat versiooni |
| Tegelik `runtimeAdapters.preflight()` | **`active_index_mismatch`**; uut päringut ei saa kirjeldada lihtsalt vana indeksi kasutamisena |
| Adminiseadistus | Tähtaeg `2026-09-08T00:00:00Z` on möödas. M4 `expiresAt=null` on eraldi leping. |

## Minimaalne väljalaskemanifest ja hooldustoiming

Manifest seob `codeCommit + implementationHash`, tenanti, allikaversioonipildi ja algvarade räsid, indeksi `generationId/configId/embeddingModel`, valmisoleku, M4 `documents/profileId`, plaani räsi, õiguspoliitika viite, mudelieelarve/loa ning eelneva väljalaske tunnuse. Õigusi kontrollitakse päringu ajal värskelt. Masintõendi `code_commit`, `git_blob_sha256`, `index` ja `server` on mõõdetud sisend selle moodustamiseks; need ei ole käivitatav M4 heakskiit.

Pärast omaniku konkreetset väljalaskeluba:

1. Mõõda serveri HEAD, config ja index uuesti. Peata kontrollitud hooldusajaks uute M4 pöörete vastuvõtt ja indeksi kirjutajad; lase pooleliolevatel töödel lõppeda. Säilita eelmine kood, M4 plaan/konfiguratsioon, aktiivse indeksi tunnus ning kõik ajaloolised allikaversioonid.
2. Paigalda üle vaadatud kood. Vali teadlikult kas praeguse kaheksa dokumendi valmis indeks või eraldi heakskiidetud uus valim. Kontrolli täpsed `documents`, index config, vektorite olemasolu ja profiil. Mock-põlvkonda ei aktiveerita päris vastamise jaoks.
3. Moodusta **uus** M4 plaan koos tegeliku runtime'i implementation-räsi ja valitud põlvkonnaga ning seo sobiva kasutajaloa ja eelarvega. Varasema kinnitatud plaani `generationId` käsitsi asendamine ei säilita vana heakskiidu kehtivust. Aegunud adminiseadistus vajab eraldi sobivat uut tähtaega, kui adminirada taas avatakse.
4. Kooskõlasta hooldusaknas head ja M4 konfiguratsioon. Käivita olemasolev preflight: põlvkond, versioonid, profiil, konfiguratsioon ja luba peavad sobima. Alles siis ava lubatud päringud. Pärismudelikatse toimub ainult seda katva loa/mahu piires; kontrolli ka vana vastuse lubatud allika avamist.
5. Tõrke korral hoia uued päringud suletuna. Taasta eelmine kooskõlaline kood/plaan/head hoolduslukuga ja oodatud aktiivse põlvkonna kontrolliga. Säilita tellimuse järjenumber ning ajaloolised versioonid; veendu, et pooleli kirjutaja ei aktiveeri vahepeal teist põlvkonda. Ava alles pärast taastatud kombinatsiooni preflight'i. `active_index_mismatch` kaitse jääb alles.

Nelja vormingu pärisvektorite puudumise jaoks on masintõendis üks **käivitamata partiiettepanek**: 52 täpselt räsitud sisendit, 22 197 tokenit, `text-embedding-3-large`, 3072 mõõdet, 0 päringu-/vastusekutset ja 0 automaatset korduskatset. Hind ja rahaline ülempiir vajavad kinnitamist enne käivitatava heakskiidu koostamist. Ühtegi olemasolevat pärisvektorit ei loetud sobivaks ainult sama dokumendinime alusel.

## Vastuvõtu piir ja järgmine samm

F01/F02 kohaliku paranduse väravad, nelja vormingu salvestus-/viiteleping, piiratud brauserirada ning arendusindeksi katkestus/rollback on tõendatud. Serveri kooskõla probleem on mõõdetud ja üleminek ette valmistatud, kuid lahendamata kuni lubatud hooldustoiminguni. Push'i, deploy'd, tasulist jooksu ega avalikku vastamist ei avatud.

Järgmisena kontrollitud serveriväljalase ja kooskõlaline M4 plaan; seejärel jätkatav korpuse mahutöötlus ning päringu valikuline lugemine. Kogu korpuse kvaliteet, OCR/keerukad PDF-id, mitte-PDF adminivastuvõtt, mitte-PDF M3 ning nelja vormingu pärismudeli sisuline tulemus jäävad eraldi tööks.
