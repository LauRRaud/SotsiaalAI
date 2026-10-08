# RAG-i tervikaudit: sisendikulu, kvaliteet ja käituskindlus

08.10.2026. Audit: Codex. Käituskoodi ei muudetud.

## Järeldus

Suur sisendmaht on kinnitatud. Peamine põhjus on iga infopöörde kolmeastmeline
mudelirada: otsinguplaan → kümnete täistekstlõikude valik → vastus, mis loeb
valitud tõendid uuesti. Omavalitsuse olemasolul lisandub suur kohalik kataloog.
Praeguse vastamisjuhise ja väljundiskeemi enda maht on juba ligikaudu 8100
kohaliku tokeniseerija tokenit, enne vestlust ja tõendeid.

Tuum on allikate päritolu, versioonide, õiguste ja taastamise poolest arenenud.
Kulu ja küsimuse keerukus ei ole aga piisavalt seotud. Ühelauseline jätk võib
käivitada sama kuluka otsingu- ja lugemisraja kui uus mitmeosaline küsimus.
Lisaks ei võimalda praegune telemeetria kogu tegelikku arvet taastada ning
eelarvereservatsioon on tarbitud summast oluliselt suurem.

Esimene parandussuund on mõõtmise korrastamine ja küsimuse järgi vajaliku
konteksti valimine. Mudeli vahetus, kogu ajaloo äralõikamine ega kõigi
top-k piiride vähendamine ei ole selle auditi põhjal põhjendatud esimene samm.

## Ulatus ja tõendi piir

- Kohaliku tööpuu HEAD oli `36d857c084dae17d3ac0b8482bc7334ca9facee9`.
  Tööpuus oli enne auditit teiste töö; see säilitati.
- `git ls-remote`, `git fetch` ja töötava frontendi `WorkingDirectory`
  kinnitasid auditeeritud versiooni **`e499edfb1cb30bc4056979e2feddc74cf9f9bdb6`**.
  Kohalikku haru ei liigutatud ega uut tööpuud loodud. Uuema versiooni
  moodulid loeti kohalikeks proovideks otse muutumatutest Git-objektidest.
- Käsitletud ahel: allikate vastuvõtt ja korje, struktuur/lõigud,
  muutumatu versiooni indeks, hübriidotsing, graaf ja õigusviited,
  omavalitsuse kirjed/kontaktid, dialoog, vastus ja voogedastus,
  õigused/privaatsus, veast taastumine, kulu, säilitus ja hindamine.
- Serveris kasutati ainult lugemist. PostgreSQL: `BEGIN READ ONLY` ja
  ühenduse `default_transaction_read_only=on`, päringu piir 15 s,
  lukupiir 1 s. Ei valitud küsimusi, vastuseid, kasutajanimesid ega muid
  kasutajate sisuvälju. Tulemused on anonüümsed tehnilised koondarvud.
- Mudelikutseid, ingest'i, indekseerimist, tootmiskirjutusi, deploy'd,
  serveriteste ega build'i ei tehtud. Kohalikud proovid kasutasid sünteetilisi andmeid.
- See on kogu aktiivse RAG-arhitektuuri audit, mitte iga repositooriumifaili
  ammendav turvaanalüüs ega kõigi allikatekstide sisuline läbivaatus.

**Oluline ajapiir:** säilinud 233 pärispööret on 05.–07.10 ja kasutavad
`search-assist-8` / `search-assist-9`. Viimane on 07.10 kell 20.59 EEST.
Praegu töötavad `search-assist-11`, `dialogue-35` ja 30 pöörde piir.
Nende viimaste muudatuste pärismudeli kvaliteeti see kasutusvalim ei tõenda.
Praeguse koodi sisendiehitus on eraldi kohalikult mõõdetud.

## Mõõdetud sisend ja kulu

231 lõpetatud pöörde keskmine on **34 760,2 sisendtokenit** ja
**1144,1 väljundtokenit**, mediaansisend 34 297, p95 43 954,
maksimaalne sisend 49 167. Sisend hõlmab plaani, allikavalikut ja vastust.

Kõigi 233 pöörde mõõdetud mudelikutsete jaotus:

| Etapp | Kutseid | Sisend kokku | Sisend/kutse | Osakaal mudelite sisendist | Väljund kokku |
|---|---:|---:|---:|---:|---:|
| Otsinguplaan | 233 | 315 861 | 1355,6 | 3,90% | 43 478 |
| Allikavalik | 233 | 4 043 520 | 17 354,2 | 49,94% | 25 038 |
| Vastus | 232 | 3 737 517 | 16 110,0 | 46,16% | 197 008 |
| Kokku | 698 | **8 096 898** | — | 100% | **265 524** |

Embedding on eraldi: 233 kutset, ainult 13 627 sisendtokenit kokku ehk
58,5 kutse kohta. See ei ole praeguse probleemi peamine allikas.
Etappide keskmiste nimetajad erinevad; neid ei esitata ühe lõpetatud pöörde täpse summana.

Kõige suurema sisendmahuga säilinud vestlus: **30 pööret, 1 250 753
sisendtokenit ja 27 324 väljundtokenit**. Järgmine 30-pöördeline vestlus
kasutas 1 049 497 sisendtokenit. Nende kasutuseesmärki ei määratud:
koond sisaldab ka arenduse hindamist ning ei ole tavakasutaja käitumise valim.

Rahakulu tuleb eristada kolmel tasandil:

1. **Teenusepakkuja tagastatud tokenid:** ülaltoodud mõõtmine.
2. **Plaani konservatiivne arvutus:** mudelikutsed 1,144874 USD,
   embedding lisaks 0,001772 USD. Mudelisisendi osa sellest arvutusest
   1,012112 USD ehk 88,4%; väljundi osa 0,132762 USD.
3. **Eelarvesse reserveeritud summa:** samade mudelisündmuste peale
   5,451394 USD ehk **4,76 korda** konservatiivne kasutusarvutus.

Need ei ole kontrollitud arveldatud summad. Plaan kasutab 23.09 dateeritud
hindu, sisendil cache-write ülempiiri. OpenAI Costs-arvestust ja konto
hinnalepingut ei loetud. 30-pöördelise suurima vestluse plaanihinnaga
arvutus on 0,170302 USD; sellest ei tohi teha kontrollitud arve väidet.

Vastuse etapil on 1 357 777 tokenit märgitud vahemälust loetuks
(36,33% selle etapi sisendist) ning 2 379 044 kirjutatuks.
Plaani ja allikavaliku samad väljad puuduvad, kuigi teenusepakkuja võib need tagastada.

## Leiud ja parandussuund

Prioriteet tähistab tööjärjekorda: P1 on peamine kulu-/arvestusprobleem,
P2 oluline töökindluse või kvaliteedi piir. Kavandatud disainipiir ei ole
automaatselt turvanõrkus; allpool on eristatud mõõdetud viga ja tõendamata mõju.

### F1 — P1: allikavalik loeb suure koguse täisteksti igal tavalisel infopöördel

`RERANK_POOL=30`, üleriigiliste seaduste reserv lisab kuni 6 ning
redaktsioonimuutuste reserv kuni 8 kandidaati: kokku kuni 44.
Mudeli sisendis on `unit.input_text`, mitte lühike kandidaatkirjeldus.
Valik hoiab kuni 9 lõiku; seejärel loeb vastusemudel need uuesti.

Indeksi 68 408 lõigu sisendpikkus: keskmine 497,8, mediaan 525,
p95 891 ja maksimaalne 1872 tokenit. Lõigud ei ole üldiselt hiiglaslikud;
kuluprobleem tuleb peamiselt nende **arvust ja korduvast lugemisest**.
Valimi allikavalik tarbis 49,94% mudelisisendist.

Koodis puudub rerank'i eraldi sisendtokenite eelarve. Lõikude arvu piir
ei taga kindlat hinda. Sünteetiline 36 umbes 1170-tokenilise lõiguga
päring oli kohalikus mõõtmises 43 171 tokenit koos juhise/skeemiga.
See on koormusproov, mitte tootmise keskmine.

**Muudatus:** kandidaatide tokenipõhine eelarve, duplikaatide kontroll enne
mudelikutset ning kitsastel küsimustel väiksem esmane kandidaatvalik.
Lisatõendit küsida siis, kui esimene valik ei kata vajalikku tingimust.
Säilitada seaduste erandite, eri redaktsioonide ja mitmeosalise küsimuse kohad.
Rerank'i täielikku eemaldamist see audit ei soovita.

Kood: [retrieval.js:73](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/search/retrieval.js#L73),
[retrieval.js:331](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/search/retrieval.js#L331).

### F2 — P1: teadaolev omavalitsus toob kataloogi ka küsimusele, mis seda ei vaja

Ühendatud otsing käivitab kirjete raja, kui piirkond on olemas; eraldi
otsust „kas praegune küsimus vajab kohalikke teenuseid/kontakte?“ ei ole.
Kataloog järjestab kirjeid küsimuse järgi, kuid ei filtreeri neid asjakohasuse
järgi välja. Kuni 12 000 tokeni sisse püütakse mahutada kogu lubatud loend,
kolm lähimat detailkirjet ja sobiv kontaktide kataloog.

See on põhjendatud laia abivajaduse esmaküsimusel, kuid kulukas nt samas
vestluses üldise mõiste selgitamisel või lühikesel jätkupöördel. Kontaktide
tihendamine on uuemas koodis juba tehtud; seda ei loeta puuduolevaks tööks.
Teenuste/toetuste väljades ja tõenditekstis on endiselt sisukordusi.

**Muudatus:** eristada kogu kataloogi ülevaadet, valitud teenuse detaili,
kontaktivajadust ja üleriigilist/üldteadmise küsimust. Saata üks kanoniline
väljade esitus koos viitekaardiga. Vajaliku allika puudumisel laiendada valikut,
mitte väita, et teenust pole. Eelmise tõendi taaskasutus peab uuesti kontrollima
õigusi, versiooni, kehtivust ja kontaktiseost.

Kood: [recordCatalogue](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/retrieval.js#L204),
[structured-record-source.js](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/search/structured-record-source.js#L19),
[modelEntry](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/search/model-context.js#L80).

### F3 — P1: kasutusarvestus jätab kaks etappi vahemäluinfota ja reserv ei vabane

`providerCall` säilitab `cachedInput` ja `cacheWriteInput` ainult siis,
kui `stage === 'answer'`. Sama teenusepakkuja vastuse tasuta testadapter
tõendas väljade kadumist nii plaani kui rerank'i korral.

`store.usage` kasutab igale sisendtokenile ühte konservatiivset hinda.
Lõppenud kutse üleliigne reserv jääb päevikusse. See on teadlik
konservatiivne kaitse, mitte tõend OpenAI ülearvestusest, kuid tulemuseks
on eelarve enneaegne ammendumine ja kulu raskesti arusaadav näit.
Töötava plaani päevikus on 69 vastusekatsega reserveeritud 1,748319 USD
4 USD piirist. See ei tähenda, et 1,748319 USD oleks arveldatud.

**Muudatus:** säilitada kõigi Responses-etappide täielik kasutusjaotus;
eraldi väljad `reserved`, `settled`, `unknown` ja hinnaversioon. Kui kutse
lõplik kasutus on teada, asendada reserv arvestatud kuluga samas lukustatud,
idempotentses tehingus. Teadmata tulemusega kutse reserv peab säilima.
Näidata arveldatud summat ainult vastava arveallika olemasolul.

Kood: [provider.js:67](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/provider.js#L67),
[store.js:237](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/store.js#L237).

### F4 — P2: suur püsijuhis ja muutuva sisu paigutus piiravad vahemälu kasu

Praegune `dialogue-35`, sama leping mis aktiivses plaanis:

| Osa | Kohaliku `cl100k_base` tokenid |
|---|---:|
| Vastamisjuhised | 6954 |
| Väljundivormingu leping ja skeem | 1144 |
| Tühja tõendipaketiga sünteetiline kogu JSON-päring | 8283 |
| Otsinguplaani juhis | 1381 |
| Allikavaliku juhis | 578 |

Need on kohalikud võrdlusmõõdud, mitte täpne Luna arveldustokeniseerija.
Juhisesse on kogunenud üldreeglid, dialoog, faktiseis, kohalike kirjete,
õigusaktide, aastate, täpsustuste ja rolli reeglid ka siis, kui konkreetne
pööre kõiki neid ei vaja.

Suur dünaamiline sisend on ühes JSON-sõnumis järjekorras
`question → dialogue → evidence`. Uus küsimus muudab prefiksit enne tõendeid.
Selgesõnalisi vahemälupiire ei määrata. Sellest ei järeldu, et cache üldse
ei tööta: vastuse etapis mõõdeti 36,33% cache-read'i.

**Muudatus:** tihendada korduvad juhised, võtta tingimuslikud juhiseosad
kasutusele vastavalt tegelikule rajale ning paigutada püsiv juhis selgelt
korduvkasutatavasse prefiksisse. Mõõta cache-read'i kõrval ka cache-write'i.
Vahemällu kirjutatud muutuva lõpu vähendamine võib säästa raha ilma
vajalikku tõendit eemaldamata; kokkuhoiu suurus on veel `NOT_PROVEN`.

GPT-5.6 ja uuemate mudelite dokumentatsioon lubab selgesõnalisi cache-piire;
read ja write kasutavad eri määrasid ning write pole sisendihinnale lisatav
teine tasu. Ainult `prompt_cache_key` lisamine ei lahenda seda ülesehitust.
[OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).

Kood: [dialogueRequest](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/dialogue.js#L320),
[search-assist request](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/search-assist.js#L149).

### F5 — P2: sisendipiir ja tokenireserv on erinevad asjad, kuid kood segab ühikuid

`maxInputTokens=300000` kontrollitakse vastuse rajal tegelikult avaldisega
`Buffer.byteLength(JSON.stringify(body), 'utf8') + 1024`.
See on konservatiivne baidiülapiir, mitte tokeniloendus.
Plaani ja rerank'i `assistCall` sama seadistuse piiri üldse ei kontrolli.
Sünteetilises katses jõudis rerank testteenusepakkujani ka
`maxInputTokens=1` korral. Kogu plaani raha-/katsepiir endiselt kehtib;
tegemist pole piiramatu arveldamise võimalusega.

Tühja tõendipaketi 8283 kohalikku tokenit reserveerivad 41 112
sisendtokeni jagu raha ning lisaks maksimaalse väljundi.
See selgitab osa F3 4,76-kordsest reservi ja kasutusarvutuse vahest.

**Muudatus:** baidipiir kaitsku transporti ja mälu eraldi nime all;
mudeli sisendile olgu igas etapis mõõdetud tokenieelarve ning turvavaru.
Enne tasulist etappi kontrollida, et ka järgmise vajaliku etapi jaoks
jääb raha. Valimis oli üks `audit_packet_too_large` katkestus pärast
plaani, embedding'ut ja allikavalikut: nende kulu oli juba tekkinud.

Kood: [assistCall](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/service.js#L96),
[vastuse piir](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/service.js#L373).

### F6 — P2: 30 pöörde piir ei taga 30 pöörde täielikku mälu

`scopeTurns=30`, aga `scopeTokens=3000` jäi kehtima. Pikkade sõnumitega
vestlus läheb uude mälulõiku varem. Üleminekul säilivad viimane sõnum
ning kuni 1800 märki olekusse salvestatud tsitaate. Mudeli märkamata asjaolu
ei saa see kokkuvõte säilitada. Ka õigesti salvestatud faktid võivad
mahupiiri tõttu välja jääda: 12 lubatud pikkusega sünteetilisest tsitaadist
jõudis ülekandesse 8.

See on koodiga tõendatud mälupiir. Millise tegeliku inimese olulise asjaolu
praegune versioon kaotaks, ei kontrollitud. 30-pöördelised tootmisvestlused
selles valimis jooksid enne praegust 30 pöörde muudatust.

**Muudatus:** kaitstud asjaolude eelarve ja selge kadumise mõõdik;
kriitilised kehtivad asjaolud, parandused ning inimese/piirkonna seos
peavad olema sihttestides üle tokenipiiri säilitatud. Ülekande põhjus ja
välja jäänud faktide arv olgu tehnilises mõõtmises nähtav.

Kood: [dialoogipiirid](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/dialogue.js#L155),
[carriedStatements](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/dialogue-carry.js#L13).

### F7 — P2: korjaja failisuuruse piir rakendub liiga hilja

Uus veebikorjaja kutsub enne `maxBytes` kontrolli
`await response.arrayBuffer()`. Seetõttu piirab 3 MB seadistus vastuvõetud
faili, kuid ei piira selle lugemiseks kuluvat mälu ega võrguandmete mahtu.
Proov 32-baidi piiriga luges kõigepealt kõik 4096 baiti ja keeldus alles siis.
Vastuse keha lugemise viga pääseb lisaks välja `fetchPage` tavalisest
`{ok:false,error}` lepingust; seda kinnitas katkestust simuleeriv proov.

**Muudatus:** voogedastusega lugemine ja katkestus piiri ületamisel,
`Content-Length` eeltõke võimaluse korral, keha lugemise vead sama
veatulemuse alla. Testida piiri ületamist, katkist keha ja ümbersuunamist.
See on operaatori korjetööriista töökindluse leid; avalikku SSRF-rünnet
selles auditis ei tõendatud. URL-i nimekuju kontroll ei ole siiski
DNS-i avaliku IP kontroll ning nende võrdsust ei tohi eeldada.

Kood: [fetchPage:14–33](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/web-collect.js#L14).

### F8 — P2: korrektne viide ei tähenda kontrollitud väidet

`validateAnswer` kontrollib skeemi, viite olemasolu ja vastuse liigi
kooskõla; funktsioon ei saa isegi allikateksti sisendiks.
Sünteetiline valeväide „Toetust makstakse kõigile alati miljon eurot“
läbis kontrolli olemasoleva `S1` viitega. Allika enda kanonilisuse kontroll
on eraldi ja tugev, kuid see ei tõenda, et väide allikast järeldub.

Voogedastuse tekst on enne lõplikku viite-/vastusekontrolli nähtav.
See on teadlik ooteaja vähendamise lahendus, mitte sama mis valideeritud
väidete kaupa väljastamine. Valimis oli üks hiljem `invalid_answer`
tõttu tagasi lükatud vastus; kasutajale nähtud teksti ulatust ei uuritud.

**Muudatus:** kvaliteedimõõtmisel eristada allika leitavust, õige lõigu
valikut, viite õigsust ja väite toetatust. Arvud, kuupäevad, tingimused,
erandid ja õigusredaktsioonid väärivad deterministlikke sihtkontrolle.
Automaatne teine tasuline LLM-kontroll iga vastuse järel pole siinne soovitus.

Kood: [validateAnswer](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/contracts.js#L74),
[answer-stream](https://github.com/LauRRaud/SotsiaalAI/blob/e499edfb1cb30bc4056979e2feddc74cf9f9bdb6/lib/rag-v2/pilot/answer-stream.js#L1).

## Ülejäänud süsteemi hinnang

| Valdkond | Kontrollitud tugevus | Piir või vajalik järgmine tõend |
|---|---|---|
| Allikate ingest | Räsid, päritolu, muutumatud versioonid, hoiatusi siduv ülevaatus ja avaldamine; eri formaatide struktuuritestid läbivad | Kogu 8337 allika OCR-i, tabelite ja metaandmete sisulist kvaliteeti ei hinnatud; web-korjaja F7 |
| Indeks ja avaldamine | Serveri plaan ja aktiivne `ready` indeks kattuvad; 68 408 ühikut nii põlvkonnas kui kataloogis | Praeguse Qdranti iga punkti ja vektori terviklikkuse täiskontroll `not_run` |
| Hübriidotsing | EstNLTK, vektor/leksikaalne ühendamine, õiguste filter ja põlvkonnakontrollid; deterministlikud testid läbivad | Semantiline recall ja järjestuse kvaliteet kogu uuel korpusel pole selle auditiga mõõdetud |
| Graaf ja õigusviited | Oma/muu akti ristviited, lõikepõhised viited ja serveri redaktsioonivõrdlus on olemas | Aktiivses kataloogis 158 `incoming` sõltuvusserva; see pole graafi kõigi seoste arv ega kvaliteedinäitaja. Graafi lisaväärtus uuel korpusel `NOT_PROVEN` |
| Ajad ja kehtivus | Õigusaktide kehtivusfiltrid; avaldamisaasta ja redaktsiooni jõustumine on eristatud | 537 dokumendil `valid_from`, 1821-l avaldamiskuupäev/aasta. Ülejäänud pole automaatselt vigased: 5705 dokumenti on struktureeritud kirjed. Mitteõiguslike veebiallikate sisu värskust pelk külastuspäev ei tõenda |
| Kontaktid | Registri värskus, sisu/räsi ja revision'i seos kontrollitakse; uue kontrollipäeva tõttu sama sisu ei aegu | Kõigi kontaktide sisulist ametivastavust ei hinnatud. Kontaktide kataloogi avamine igal pöördel põhjustab F2 |
| Õigused/privaatsus | Tenanti ja dokumendi ulatus; sessiooni korduskontroll; kontaktide elav luba; allika kontroll enne väljastamist; `store:false` mudelipäringutel | Praegune plaan on ühe omaniku arenduspiloot. Mitme kliendi isolatsiooni live-proov ja kõigi privaatsusradade audit `not_run`; `store:false` ei asenda oma DB säilitusreeglit |
| Tuuma taaskasutus | Otsingu-, indeksi- ja allikatuumas on tenant, profiilid, õiguspoliitika ning adapterid | Piloodi otsinguplaani juhis nimetab otse Eesti sotsiaalvaldkonda; püsistus tunneb rakenduse vestlustabeleid. Teise kliendi valdkondlik juhis ja püsistus vajavad adapteri-/konfiguratsioonipiiri, mitte runtime-erandeid allika nime järgi |
| Mälu ja ajalugu | Isikute/piirkondade eristus, tsitaatidel põhinev olek, parandused, püsiv ajalugu ja vana plaani ajaloo taastamine | F6; rolli ja 30 pöörde uus juhis pole olemasoleva usage-valimiga mõõdetud |
| Veast taastumine | Pöörde identiteet, lukustatud reservatsioon, salvestatud tulemuse taastamine lisamudelikutsena kordamata; automaatset provider retry't pole | Rerank'i rikke korral fused-otsingu fallback võib kvaliteeti muuta; veas osaliselt kulunud raha ja `unknown` peavad jääma nähtavaks |
| Kriisirada | Tehniline sihttest kinnitas kriisiteate säilimist ka RAG-i tõrke korral | Kriisituvastuse täielik ET/RU/EN tundlikkus ja pärisvoo katvus `NOT_PROVEN` |
| Hindamine | Kataloog eristab otsingut, vastust ja olekut; faktide elutsükli ning redaktsioonide kontrollid olemas | Mustri/viite läbimine pole kogu vastuse õigsus. Kulupiirid, cache-jaotus, esimese teksti aeg ning toetatud väite osakaal peavad olema ühe mõõtmise osad |
| Maht ja säilitus | Pakitud JSON ja lahutatud suured veerud on juba teostatud; väiksem vana pöörde kuju on olemas | 233 pöördel pole aegumist, keskmine salvestatud rida 145 169 baiti, tabel 64,4 MB. `auditDays=7`, mõõdetud read alles 1–3 päeva vanad: 0 lean-rida ei tõenda koristaja viga. Laiema kasutuse eel peab aegumine olema määratud |

Indeks kasutab **85,51%** 80 000 tekstiosa piirist ning **83,37%** 10 000
dokumendi piirist; ruumi on veel 11 592 tekstiosale ja 1663 dokumendile.
Serveris on 23 valmis põlvkonda. Neid ei korrutata täismahus andmekoopiateks:
versioonipõhine indeks taaskasutab andmeid. Ketas on praegu 67% täis,
vaba umbes 27,34 GB, seega varasem 94% kettahäire pole praegune seis.
`rag_v2_object` tabelit ega muid andmeid ei kustutatud; omaniku säilitusotsus kehtib.

## Soovitatud teostusjärjekord ja vastuvõtt

1. **Arvestus ja piirid (F3, F5).** Kõigi etappide input/cache-read/cache-write/output,
   reservi ja lõpliku kulu eristus, tokeni- ja baidipiir eraldi.
   Vastuvõtt: tasuta provider/store sihttestid, sh kaks paralleelset pööret,
   korduv usage-sündmus, tundmatu tulemus ja taastamine. Tundmatu ei vabasta reservi.
2. **Vajalik kontekst (F2, F1).** Kõigepealt päringu liigile sobiv kataloog,
   seejärel allikavaliku tokenieelarve. Jätkuküsimus kasutab võimalusel
   kontrollitud olemasolevat tõendit. Lai küsimus ja oluliste erandite otsing
   säilitavad võimaluse ulatust suurendada.
3. **Juhis ja cache (F4).** Korduste eemaldamine ja püsiva prefiksi piirid
   pärast esimese kahe töö mõõdiku olemasolu. Sama tõendi juures võrrelda
   sisendmahtu; sisu- ja õiguste leping peab jääma samaks.
4. **Töökindlus ja mälu (F7, F6).** Voogedastusega korje piirid ja
   piiriülese faktisäilituse sihttestid. Need on sõltumatud kulumuudatused.
5. **Kvaliteedi tõend (F8).** Olemasolevate sünteetiliste/mõõdetud
   stsenaariumide külmutatud valim: üldteadmine, KOV, raha, kontakt,
   õigusredaktsiooni võrdlus, teemavahetus, kahe inimese vestlus, pikk mälu,
   ET/RU/EN ning kriis. Raporteerida otsing, tõend, väide, olek, kulu ja aeg eraldi.

Kohalikuks esimeseks optimeerimissihiks sobib **20–40% väiksem kogu
mudelisisend** samadel päringutel, säilitades vajalike allikate ja tingimuste
katvuse. See on töösiht, mitte mõõdetud sääst ega kvaliteedilubadus.
Kui ainult rerank'i maht poole võrra vähendada, oleks sama jaotuse korral
kogu sisendi aritmeetiline langus umbes 25%; kas see säilitab kvaliteedi,
vajab tõendit. Sama kehtib kataloogi valikulise väljasaatmise kohta.

Kohustuslikku tasulist hindamisringi ei ole. Kordusmängud, sünteetilised
provider-adapterid ja olemasolevad allikatõendid võimaldavad tehnilise töö
valmis teha. Pärismudeli sisulise kvaliteedi kontrollimata osa tuleb
eraldi `NOT_PROVEN`-ina näidata.

## Korratavad tõendid

- [Serveri koondmõõtmine](evidence/rag-system-audit-2026-10-08-aggregate.json)
  ja [ainult lugemise skript](evidence/rag-system-audit-2026-10-08-aggregate.py).
- [Sünteetiliste proovide tulemused](evidence/rag-system-audit-2026-10-08-probes.json),
  [proovid](evidence/rag-system-audit-2026-10-08-probes.mjs) ja
  [muutumatu SHA moodulilaadur](evidence/rag-system-audit-2026-10-08-loader.mjs).
- [76 päringu-/oleku-/viite-/kriisitesti](evidence/rag-system-audit-2026-10-08-tests.txt)
  ning [85 struktuuri-/otsingu-/teadmiste testi](evidence/rag-system-audit-2026-10-08-foundation-tests.txt):
  **161/161 läbis, 0 vahele jäetud**, `TZ=UTC`. Seitse auditiproovi kinnitasid
  eespool eristatud arvestus-, piiri-, mälukao- ja korjekäitumist.
- `git diff --check`: läbis. Dokumentatsioonile lint'i/build'i ei käivitatud.

Laadur muudab ainult selle Node-protsessi moodulite lugemist, mitte tööpuud.
Testid ei käinud serveris ning tasulisi kutseid oli 0. Päris brauserirada,
täielik DB-integratsioon, koormustest, Qdranti täisvõrdlus ja uue juhise
semantiline hindamine on `not_run` / `NOT_PROVEN`.
