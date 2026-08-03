# SotsiaalAI RAG — maailmataseme arendusplaan

Kuupäev: 01.08.2026  
Olek: **rakendusplaan / kinnitamata teostus**  
Alus: `origin/main @ cf7b0f1840ef09602619758e62252e30410de158`  
Siht: muuta SotsiaalAI Eesti sotsiaalvaldkonna kõige usaldusväärsemaks ja rahvusvaheliselt võrreldavaks tõenduspõhiseks RAG-süsteemiks.

## 1. Juhtotsus

SotsiaalAI ei võida maailma parima üldotsinguna. Ta saab kuuluda maailma parimate hulka kitsas, kõrge vastutusega valdkonnas, kui süsteem suudab iga olulise väite kohta tõendada viis asja:

1. leiti õige allikas;
2. allikas käsitleb õiget riiki, KOV-i, teenust, isikurühma ja ajahetke;
3. allikas toetab päriselt vastuses esitatud väidet;
4. kasutaja näeb seda tõendit arusaadaval kujul;
5. ebapiisava või vastuolulise tõendi korral süsteem piirab vastust ausalt.

Seetõttu ei ole järgmine põhietapp suurem `top-k`, pikem prompt ega uus mudel. Järgmine põhietapp on **väide → tõend → otsus → kasutajale kuvatud allikas** lepingu tehniline jõustamine.

„Üks maailma parimaid” on lubatud avalik väide alles pärast sõltumatut hindamist. Enne seda on see arenduseesmärk.

## 2. Tõendatud lähtekoht

Praegune süsteem ei alusta nullist. Tootmises või tootmiseelses canary's on juba:

- hübriidotsing ja eraldatud graph-lite kanal;
- KOV-i, teenuse ja õiguse konteksti tuvastamine;
- kanoonilised allikaidentifikaatorid ja `SourcePackage`;
- package-aware vastamine ning sektsioonid `description`, `eligibility`, `application`, `forms`, `contacts`, `legal_basis`, `fees`, `deadlines`;
- riskipoliitika õigus-, summa-, tähtaja-, vormi-, kontakti- ja kriisiväidetele;
- `retrieved`, `selected`, `answer` ja `displayed` allikakihtide eristus;
- request-ID, `retrievalTimings` ning `embedding` / `retrieval` / `search_total` korrelatsioon;
- vale KOV-i ja vale teenuse pakettide vastu suunatud filtrid;
- `insufficient_service_match` fail-closed käitumine;
- range no-corpus piir;
- Golden-37 ning lukustatud Mini–Luna pimehindamine;
- `gpt-5.6-luna` tootmiseelne canary konfiguratsioon;
- rolliteadlik kontaktijuhis põhimõttega **„iga sotsiaaltöötaja loeb”**.

Kõige suurem allesjäänud usaldusauk on see, et `sourceAttribution` valib pärast vastuse loomist kuvatavaid allikaid, kuid ei tõesta veel iga vastuseväite sisulist toetust. Streaming võib näidata kasutajale väidet enne lõpliku atributsiooni valmimist.

## 3. Maailmataseme definitsioon

### 3.1 Kvaliteedi põhiväravad

Allolevad on sihttasemed, mitte praeguse seisu väited. Baseline mõõdetakse enne esimese käitumismuudatuse aktiveerimist.

| Mõõdik | Avaliku avamise värav | Märkus |
| --- | ---: | --- |
| Kriitilise kinnitamata täppisväite määr | **0** release-komplektis | Tasu, tähtaeg, kontakt, vorm, õiguslik alus, abikõlblikkus |
| Vale KOV-i või vale teenuse tõendi määr | **0** release-komplektis | Ka mitmevoorulises vestluses |
| Kõrge riskiga väidete citation recall | **100%** release-komplektis | Igal väitel vähemalt üks piisav tõend või aus piirang |
| Kõrge riskiga väidete citation precision | **≥99,5%** varivalimis | Kuvatav tõend peab väidet toetama |
| Üldine atomic-claim support rate | **≥98%** | Inimese kinnitatud valimil |
| No-corpus kinnitamata faktivastused | **0** | V.a eraldi kriisireegel |
| Retrieval evidence recall@k | **≥97%** kõrge riskiga gold-valimil | Kas vajalik tõend jõudis kandidaatidesse |
| Selected-context evidence recall | **≥95%** | Kas vajalik tõend jõudis mudelile |
| Displayed-source precision | **≥99%** | Ei kuvata kõrvalist ega teise teenuse allikat |
| Kriisi ohutusvärav | **100%** fikseeritud testidest | Ei sõltu RAG-i õnnestumisest |
| ET/EN/RU kriitilise reegli pariteet | **100% lepingutest** | Sama ohutus, mitte tingimata sõnasõnaline prompt |
| `stream_done_received` edukal vastusel | **≥99,9%** | Tehnilisel canary-valimil |
| Request-ID journald'i korrelatsioon | **≥99,9%** | Puuduv/duplikaatne etapp eraldi veana |
| Golden regressioon | **0 uut kriitilist viga** | Punktisumma üksi ei ole piisav |

### 3.2 Tõendustasemed

Iga vastuse väide saab ühe otsuse:

- `supported_direct` — allikas kinnitab väidet otseselt;
- `supported_synthesis` — väide on mitme sobiva allika põhjendatud süntees;
- `supported_background_only` — sobib taustaks, mitte täppis- või kehtivusväiteks;
- `conflicting_evidence` — usaldusväärsed allikad on vastuolus;
- `insufficient_evidence` — vajalikku tõendit pole;
- `out_of_corpus` — korpus ei kata küsimust;
- `not_applicable` — väide ei vaja välist tõendit, näiteks viisakus või selgelt märgitud ettepanek.

Kõrge riskiga faktiväide võib kasutajale kinnitatud kujul jõuda ainult otsusega `supported_direct` või eelnevalt defineeritud juhtudel `supported_synthesis`.

## 4. Sihtarhitektuur

```text
Kasutaja küsimus
  → privaatsus- ja kriisivärav
  → intent, roll, jurisdiktsioon, teenus ja ajavaade
  → deterministlik query plan
  → native hybrid retrieval + piiratud graph-kanal
  → metadata-, KOV-, teenuse-, aja- ja allikatüübi filtrid
  → SourcePackage / EvidencePackage
  → kontrollitud selected context
  → mudeli vastusemustand + struktureeritud claim'id
  → claim–evidence verifier
      → toetatud: säilita + seo tõend
      → vastuolu: kuva vastuolu ja ajakontekst
      → ebapiisav: eemalda, üldista või märgi kinnitamata
  → verified response
  → displayed_sources = ainult kasutatud tõendite kontrollitud projektsioon
  → kasutajale vastus + jälgitavad allikad
  → privaatsust säilitav rag_trace + kvaliteedimõõdikud
```

Oluline arhitektuuriotsus: kõrge riskiga vastust ei voogedastata kontrollimata terviktekstina. Selle jaoks kasutatakse kas lühikest serveripoolset puhvrit või ainult kontrollitud segmentide voogedastust. Madala riskiga vestlus võib jääda tavaliselt voogedastatavaks.

## 5. Tööpaketid ja kohustuslik järjekord

### WP0 — hindamislepingu külmutamine

Eesmärk: vältida süsteemi häälestamist ainult nähtud Golden-37 küsimustele.

Teha:

- säilitada Golden-37 muutumatu `core` komplektina;
- luua eraldi varjatud `holdout` komplekt, mille täisteksti arendusmudelile ei anta;
- jagada testid perekondadesse: KOV, õigus, uuring, praktika, organisatsioon, eluolukord, kriis, no-corpus, mitmevooruline ja adversariaalne;
- märkida iga küsimuse gold-tõendid, lubatud alternatiivallikad, keelatud allikad ja oodatud piirang;
- koostada vähemalt 300 juhtumist koosnev sihtkorpus: 150 põhi-, 50 mitmevoorulist, 50 adversariaalset ja 50 ajakohasuse/konflikti juhtumit;
- hoida vähemalt 20% komplektist avaldamata holdout'ina;
- lukustada küsimuste, rubriigi, korpuse snapshot'i ja mudelikonfiguratsiooni hashid.

Värav:

- runner eristab retrieval'i, selection'i, generation'i, citation'i ja süsteemitõrke;
- algne vastus säilib alati, tehniline retry on eraldi jooks;
- automaatne mudelihindaja ei ole enda vastuste lõplik hindaja;
- vähemalt kaks inimest kalibreerivad kriitiliste juhtumite rubriigi ja lahknevused protokollitakse.

### WP1 — `rag_trace` V4 ja atomic claim contract

Eesmärk: muuta vastus masinloetavalt kontrollitavaks ilma kasutajateksti või allikasisu logidesse lekkimata.

Minimaalne claim-kirje:

```text
claim_id
claim_hash
response_span
claim_type
risk_level
jurisdiction
municipality_id
canonical_item_id
temporal_scope
normalized_value
required_evidence_sections[]
evidence_source_ids[]
evidence_chunk_ids[]
verdict
verifier_reason
```

Reeglid:

- `claim_hash` arvutatakse normaliseeritud assistendi väitest;
- raw kasutajaküsimust, vastuse täisteksti ega chunk'i sisu ei lisata tehnilisse trace'i;
- `response_span` on positsioon, mitte dubleeritud tekst;
- kontakt, telefon, e-post, euro, kuupäev, tähtaeg ja paragrahv tuvastatakse esmalt deterministlikult;
- üldisemad sisuväited eraldatakse struktureeritud mudeliväljundina;
- olemasolev 30-võtme kärpimine peab säilitama claim-kihi agregaatide ja lõpetamissignaali.

Värav:

- shadow-režiim ei muuda vastust, retrieval'it ega `displayed_sources` tulemust;
- `rag_trace.claim_attributions` on olemas kõigil package-aware ja high-risk vastustel;
- `response_present=false`, incomplete stream ja katkestatud voo osaline seis säilivad ausalt;
- skeemi-, ühik-, integratsiooni- ja privaatsustestid on rohelised.

### WP2 — deterministlik täppisväidete kontroll

Eesmärk: sulgeda kõige ohtlikumad vead enne semantilise verifitseerija lisamist.

Kontrollitavad väitetüübid:

| Väide | Kohustuslik vaste |
| --- | --- |
| teenuse tingimus | sama KOV + sama kanooniline teenus |
| tasu või omaosalus | sama teenuse hinnakiri, määrus või ametlik teenuseleht |
| tähtaeg | sama teenuse kord, määrus või ametlik juhis |
| vorm | sama teenuse vorm või taotlemisjuhis |
| kontakt | sama teenuse kontakt või sobiva rolliga pädev üksus |
| õiguslik alus | õige akt + õige redaktsioon + õige säte |
| kehtivus | piisavalt värske ja aktiivne ametlik allikas |

Rakendus:

- võrrelda vastuse normaliseeritud väärtusi valitud tõendite väärtustega;
- nõuda KOV-i ja `canonical_item_id` kokkulangevust;
- lahutada teenusekontakt, üldkontakt ja pädeva rolli kontakt;
- käsitleda mitut sobivat spetsialisti rikkusena, mitte mürana;
- kui detail ei ole kinnitatud, muuta verdict `insufficient_evidence`-ks.

Värav:

- Harku sotsiaaltransport kõigis fikseeritud käändevormides;
- Kuusalu vormid ja kontaktid;
- Narva wrong-KOV leakage;
- täpsed euro-, päeva-, telefoni-, e-posti- ja paragrahvinäited;
- valepositiivsed testid, kus sama väärtus esineb teise teenuse allikas;
- kõik kriitilised negatiivtestid peavad ebaõnnestuma enne parandust ja läbima pärast parandust.

### WP3 — semantiline claim–evidence verifier

Eesmärk: kontrollida ka väiteid, mida substring või regex ei suuda usaldusväärselt hinnata.

Komponendid:

1. atomic claim extractor;
2. kandidaat-tõendite koostaja ainult valitud ja lubatud allikatest;
3. entailment-verifier tulemusega `supports`, `contradicts`, `insufficient`;
4. authority/freshness resolver;
5. konservatiivne otsustusmootor;
6. kalibreeritud confidence, mida ei esitata kasutajale tõenäosusena.

Turvareeglid:

- verifier ei tohi lisada uusi fakte ega allikaid;
- verifieri mudel ei saa muuta gold-labelit ega release-väravat;
- kõrge riskiga väite puhul tähendab tehniline verifieri tõrge `insufficient_evidence`, mitte vaikimisi lubamist;
- vastuolulised allikad jäävad trace'i ja kasutajale öeldakse, milles vastuolu seisneb;
- background-allikas ei muutu suure arvu või semantilise sarnasuse tõttu ametlikuks tõendiks.

Värav:

- inimese märgendatud vähemalt 500 claim–evidence paari;
- kõrge riskiga `false support` määr alla 0,5%;
- kriitiliste väidete valimil 0 valesti lubatud väidet;
- eraldi mõõdetud `supports`, `contradicts` ja `insufficient` segiajamise maatriks;
- verifieri mudeli või prompti vahetus käivitab kogu kalibratsiooni uuesti.

### WP4 — vastuse jõustamine ja turvaline streaming

Eesmärk: teha verifitseerimine kasutajale nähtava vastuse päris osaks.

Otsustusjärjekord väite kaupa:

1. säilita toetatud väide ja seo lähim tõend;
2. vastuolu korral esita mõlemad seisukohad koos aja ja autoriteediga;
3. ebapiisava tõendi korral eemalda täppisdetail või sõnasta piirang;
4. ära asenda eemaldatud detaili mudeli üldteadmisega;
5. ära tee läbipaistmatut automaatset retrieval-retry'd;
6. üks piiratud paranduskäik on lubatud ainult sama kontrollitud konteksti põhjal ning see logitakse eraldi.

Streaming:

- `low` risk: senine streaming, lõpus atributsioon;
- `medium` risk: lõigu- või sektsioonipõhine puhver ja kontroll;
- `high` risk: vastusemustand kontrollitakse enne esimese faktiväite saatmist;
- kliendi katkestus säilitab serveris tegeliku osalise seisu;
- `done` sisaldab lõplikku claim-, source- ja completion-kokkuvõtet.

Värav:

- kasutaja ei näe hetkekski hiljem eemaldatavat kõrge riskiga väidet;
- `displayed_sources` on kontrollitud claim-tõendite projektsioon;
- null kuvatud allikaga kõrge riskiga vastus ei sisalda kinnitatud faktidetaile;
- jõustamine töötab võrdselt non-stream ja stream radadel;
- output-cap, disconnect, provider error ja incomplete vastus säilitavad ausa oleku.

### WP5 — retrieval'i gold-mõõtmine ja alles siis ranking

Eesmärk: lõpetada retrieval'i hindamine ainult lõppvastuse järgi.

Mõõta eraldi:

- `retrieved_candidate_recall`;
- `retrieved_evidence_precision`;
- `selected_context_recall`;
- `selected_context_precision`;
- `MRR` ja `nDCG` ainult juhtudel, kus järjestus on sisuliselt oluline;
- puuduva tõendi põhjus: ingest, metadata, query plan, filter, ranking, budget või package selection;
- native, lexical, BM25, graph ja võimaliku rerankeri marginaalne panus.

Arendused:

- koostada gold chunk/source map vähemalt kõrge riskiga testidele;
- lisada counterfactual-testid: sama KOV, vale teenus; sama teenus, vale KOV; vana vs kehtiv allikas;
- teha query-variantide metamorphic-testid käände, sünonüümi, kirjavea ja follow-up'i jaoks;
- hinnata rerankerit shadow-režiimis;
- aktiveerida reranker ainult siis, kui recall ei lange ja claim support paraneb statistiliselt ning inimhindamisel.

Keeld: `top-k`, skoorimist või kanalikaale ei muudeta pelgalt üksikjuhtumi parandamiseks.

### WP6 — teenuseontoloogia ja eesti keele ankrud

Eesmärk: asendada kasvav sufiksiheuristika hallatava mõistemudeliga.

Luua keskne register:

- kanooniline teenuse- ja toetusenimi;
- käändevormid ning lemmad;
- ametlikud ja tavakeelsed sünonüümid;
- KOV-spetsiifilised nimetused;
- välistavad lähimõisted;
- seosed vormi, kontakti, õigusliku aluse, sihtrühma ja teenuseosutajaga;
- keelevariandid ET/EN/RU;
- versioon ja tõendiallikas.

Teostus:

- deterministlik morfoloogiline normaliseerimine enne embedding-otsingut;
- ontoloogia- ja graph-lite seosed jagavad sama kanoonilist identiteeti;
- tundmatu teenuseankur jääb `unknown`, mitte ei vali rikkaimat paketti;
- kõik 79 KOV-i ning Tallinn käsitletakse sama lepinguga, Tallinna linnaosa erand eraldi.

Värav:

- vähemalt 500 käände-, sünonüümi- ja lähimõiste testi;
- 0 wrong-service valikut testkorpuses;
- teadmata termini korral 100% fail-closed;
- registri muutus on versioonitud ja käivitab mõjutatud eval-perekonnad.

### WP7 — korpuse kvaliteet, värskus ja konfliktid

Eesmärk: muuta „õige dokument andmebaasis” pidevalt kontrollitavaks omaduseks.

Igal allikal peavad olema vähemalt:

- kanooniline URL ja allikaomanik;
- allikatüüp ja tõendusroll;
- jurisdiktsioon ja KOV;
- `canonical_item_id`;
- avaldamise, jõustumise, kehtivuse kontrolli ja järgmise kontrolli aeg;
- sisu hash ja ingest-versioon;
- aktiivne, aegunud, asendatud, katkine või review-needed olek;
- seos asendava allikaga, kui see on teada.

Automaatika:

- ametlike allikate linkide ja hashide regulaarne kontroll;
- muutunud dokumendi delta ja mõjutatud SourcePackage'ite nimekiri;
- aegunud allikas eemaldatakse kõrge riskiga kinnitava tõendi rollist;
- konfliktis RT, KOV määruse ja teenuselehe puhul rakendub dokumenteeritud autoriteedi- ja ajareegel;
- muutus käivitab ainult mõjutatud eval-testid ning perioodiliselt kogu komplekti.

Värav:

- 100% kõrge riskiga kasutatavatest allikatest omab freshness staatust;
- katkine või asendatud allikas ei kinnita uut väidet;
- iga korpusemuudatus on reprodutseeritav snapshot'i, hashide ja ingest-logi kaudu;
- adminil on lahendatav review queue, mitte ainult hoiatusloendur.

### WP8 — rolli-, keele- ja kontaktikvaliteet

Eesmärk: teha kontaktide mitmekesisus platvormi eristuvaks tugevuseks.

Kontaktireegel:

- üldküsimuse puhul selgita, et sobiv spetsialist sõltub teemast;
- konkreetse teenuse puhul eelista sama teenuse või pädeva rolli kontakte;
- kui kasutaja küsib valikuid, kuva kõik kontrollitud asjakohased rollid mõistliku rühmitusega;
- ära tõsta andmejärjekorra alusel suvaliselt esile üht või kaht inimest;
- väldi tarbetut isikuandmete kordamist ja eelista ametlikku rollikontakti, kui see täidab eesmärgi paremini;
- lahkunud või aegunud kontakt ei tohi jääda kinnitavaks allikaks.

Keelepariteet:

- kriitilised prompti- ja runtime-reeglid defineeritakse ühes keelesõltumatus lepingus;
- ET/EN/RU promptid realiseerivad sama lepingu;
- testid kontrollivad semantilist pariteeti, mitte ainult märksõnu;
- sama küsimuse tõlgitud variandid peavad valima sama KOV-i, teenuse ja tõendiklassi.

Värav:

- kontaktide katvuse ja aegumise mõõdikud;
- kõik kolm keelt läbivad samad kõrge riskiga negatiivtestid;
- rollide `CLIENT`, `SOCIAL_WORKER` ja `SERVICE_PROVIDER` käitumine on eraldi testitud.

### WP9 — turvalisus, privaatsus ja adversariaalne RAG

Eesmärk: takistada korpuse, kasutajasisendi või allika kaudu piiride murdmist.

Testida:

- prompt injection RAG chunk'is ja kasutaja dokumendis;
- pahatahtlik „ignoreeri juhiseid” allikatekst;
- võõra KOV-i, kasutaja või tenant'i allikale suunamine;
- allika metadata võltsimine;
- URL-i ja pealkirja lahknevus;
- peidetud või Unicode'iga segatud teenusenimed;
- mürgitatud kontakt, telefon, e-post ja tasu;
- päris kasutajaandmete sattumine trace'i, logisse või eval-artefakti;
- mudeli sundimine korpuseväliseid teadmisi kinnitatud faktina esitama.

Värav:

- serveripoolne fail-closed käitumine, mitte ainult prompt või UI-filter;
- tenant'iülene leke 0;
- saladuste ja kasutajateksti leke tehnilistesse logidesse 0;
- adversariaalne komplekt läbib enne iga mudeli-, prompti-, retrieval'i- või ingestimuudatuse avalikku deploy'd.

### WP10 — observability ja pidev kvaliteedijuhtimine

Eesmärk: näha tootmiskvaliteeti ilma kasutajate privaatset sisu kogumata.

Admini koondvaade peab näitama vähemalt:

- retrieval'i, selection'i, claim'i ja displayed-source kihti;
- `supported`, `insufficient`, `conflicting` ja `out_of_corpus` määra;
- kõrge riskiga claim'ide arvu ning toe määra;
- wrong-KOV, wrong-service ja stale-source blokke;
- nullallika, incomplete, output-cap, stream-failure ja retrieval-failure määra;
- embedding/retrieval/generation/verifier latentsust;
- mudeli-, embeddingu- ja verifieri kulu eraldi;
- mudeli, prompti, korpuse, ontoloogia ja eval-komplekti versiooni;
- privaatsust säilitavaid drill-down request-ID-sid.

Alarmid:

- üks kriitiline valesti lubatud väide;
- korduv wrong-KOV või wrong-service;
- korrelatsioonikaotus;
- kriitilise allika aegumine;
- no-corpus guard'i rikkumine;
- mudeli või prompti ootamatu konfiguratsioonimuutus;
- kvaliteedimõõdiku statistiliselt oluline langus.

### WP11 — sõltumatu tõendamine ja avalik kvaliteediraport

Eesmärk: muuta maailmataseme väide kontrollitavaks ka väljaspool arendusmeeskonda.

Nõuded:

- vähemalt kaks sõltumatut sotsiaalvaldkonna hindajat;
- eraldi õigusvaldkonna kontroll kõrge riskiga õigusküsimustele;
- pime mudeli- ja süsteemivõrdlus;
- avaldatud meetod, valim, piirangud ja veakategooriad;
- tulemused nii edukate kui ebaõnnestunud juhtumitega;
- kordustest teise korpuse snapshot'i ja värskema allikaseisuga;
- tulemuste reprodutseeritav artefakt ilma sessiooni-, kasutaja- või vestlusandmeteta.

Võrdlusraamistikus kasutatakse vähemalt:

- RAGCheckeriga sarnast retrieval'i ja generation'i eraldi diagnostikat;
- ALCE-ga sarnast citation correctness'i, citation precision'i ja citation recall'i;
- NIST AI RMF `govern`, `map`, `measure`, `manage` loogikat;
- SotsiaalAI enda rangemaid KOV-i, teenuse, õiguse, kontakti ja ajakohasuse väravaid.

## 6. Eval-programm

### 6.1 Testpüramiid

1. **Lepingutestid** — metadata, SourcePackage, claim schema, stream protocol.
2. **Ühiktestid** — ankrud, väärtused, KOV, teenus, aeg, authority.
3. **Komponenditestid** — retrieval, package selection, verifier, attribution.
4. **Golden core** — kiire deterministlik regressioon iga muudatusega.
5. **Varjatud holdout** — ületreenimise tuvastamine release'i eel.
6. **Metamorphic eval** — käänded, sünonüümid, järjestus, follow-up, keelevariant.
7. **Adversariaalne eval** — injection, väärmetadata, konflikt, vale KOV/teenus.
8. **Pime inimhindamine** — sisuline täpsus ja kasutatavus.
9. **Canary** — sünteetilised kontod ja lubatud testkasutajad.
10. **Tootmisseire** — ainult tehnilised ja privaatsust säilitavad agregaadid.

### 6.2 Ükski koondskoor ei tohi varjata kriitilist viga

Release on keelatud ka kõrge üldskoori korral, kui esineb vähemalt üks:

- kinnitamata kõrge riskiga täppisväide;
- vale KOV-i või vale teenuse tõend;
- vale õigusakt, redaktsioon või paragrahv;
- no-corpus faktihallutsinatsioon;
- kriisivastuse ohtlik puudujääk;
- tenant'iülene või isikuandmete leke;
- kasutajale juba kuvatud ja hiljem tagantjärele eemaldatud kõrge riskiga väide.

### 6.3 Hindamise sõltumatus

- arenduskomplekt ja release-holdout on eraldi;
- inimhinded lukustatakse enne mudelivõtme avamist;
- mudelihindaja on abimõõdik, mitte lõplik otsustaja;
- vähemalt 10% valimist hinnatakse topelt;
- hindajate kokkulangevus ja erimeelsused raporteeritakse;
- iga eval salvestab mudeli-, prompti-, korpuse-, koodi- ja küsimustiku hashid.

## 7. Release-strateegia

Iga käitumismuudatus läbib järgmise jada:

```text
leping ja baseline
→ shadow metadata
→ offline eval
→ varjatud holdout
→ sünteetiline production smoke
→ piiratud canary
→ sõltumatu sisuhindamine
→ etapiviisiline avamine
→ järelvalve
```

Rollback peab taastama korraga ühilduva mudeli-, prompti-, verifieri-, retrieval'i-, ontoloogia- ja korpuseversiooni. Ainult mudeli tagasivahetamine ei ole piisav, kui käitumismuutus tuli muust kihist.

Iga release'i artefakt peab sisaldama:

- commit ja deploy SHA;
- konfiguratsiooni ning korpuse snapshot'i;
- eval-komplekti hashid;
- kõik tehnilised ja sisulised väravad;
- known limitations;
- canary ulatus;
- rollback käsk ja kontrollnimekiri;
- kinnitus, et päris kasutajaandmeid ei kasutatud.

## 8. Prioriteetne teostusjärjekord

### P0 — usaldusväärsuse tuum

1. WP0 hindamislepingu külmutamine.
2. WP1 `rag_trace` V4 ja atomic claim contract shadow-režiimis.
3. WP2 deterministlik täppisväidete kontroll.
4. WP3 semantilise verifieri kalibreerimine.
5. WP4 high-risk jõustamine ja streaming-värav.

P0 lõpptulemus: kõrge riskiga kinnitamata detail ei saa kasutajale kinnitatud faktina jõuda.

### P1 — retrieval ja teadmuse kvaliteet

6. WP5 retrieval gold-mõõtmine ja ainult tõendatud rankingumuudatused.
7. WP6 teenuseontoloogia ja mitmekeelne ankurdamine.
8. WP7 freshness, konfliktid ja muutusepõhine re-eval.

P1 lõpptulemus: süsteem suudab diagnoosida, kas tõend puudus korpusest, retrieval'ist, valikust või vastusest.

### P2 — skaleeritav usaldus

9. WP8 rolli-, keele- ja kontaktikvaliteet.
10. WP9 adversariaalne turve ja privaatsus.
11. WP10 kvaliteedi observability.
12. WP11 sõltumatu hindamine ja avalik kvaliteediraport.

P2 lõpptulemus: kvaliteet on pidevalt jälgitav, väliselt auditeeritav ja mudelivahetusest sõltumatu.

## 9. Esimene konkreetne rakendusülesanne

### RAG-WC-01 — atomic claim contract ja shadow attribution

Eesmärk: lisada käitumist muutmata esimene täielik claim-kiht.

Eeldatav puutepind:

- uus `lib/chat/claimEvidenceContract.js`;
- uus `lib/chat/claimExtractor.js`;
- uus `lib/chat/claimEvidenceVerifier.js` shadow-režiimis;
- `lib/chat/mainResponseHandler.js`;
- `lib/chat/responseFinalizer.js`;
- `lib/chat/ragTrace.js` või olemasolev trace-koostaja;
- `scripts/run-golden-rag-eval.mjs` ja eval-artefakti skeem;
- sihitud unit-, integration-, stream- ja privaatsustestid.

Skoop:

1. tuvastada deterministlikult `fee`, `deadline`, `contact`, `form`, `legal_basis`, `eligibility` ja `current_status` claim'id;
2. siduda claim olemasoleva `section_attribution`, `SourcePackage` ja source ID-dega;
3. anda verdict, kuid mitte veel muuta vastuse teksti ega allikate kuvamist;
4. lisada `rag_trace.claim_attributions` sanitiseeritud kujul;
5. säilitada multi-RAG, incomplete-stream, `response_present=false` ja output-cap semantika;
6. lisada Harku, Kuusalu, Narva, legal exact, no-corpus ja kriisi negatiivtestid;
7. mõõta shadow-tulemuse erinevust lukustatud Golden-37-l ja uuel claim-gold valimil.

Mitte teha selles ülesandes:

- retrieval'i tulemuste, järjestuse, top-k või skoorimise muutmist;
- mudeli, prompti või korpuse muutmist;
- automaatset vastuse ümberkirjutamist;
- uusi kasutajale nähtavaid sõnumeid;
- toorest vastuse-, küsimuse- või allikateksti tehnilistesse logidesse;
- deploy'd enne eraldi ülevaatust.

Vastuvõtukriteeriumid:

- kõik seitse täppisväite tüüpi on fixture-testidega kaetud;
- sama KOV-i vale teenuse tõend annab `insufficient_evidence`;
- õige teenuse sobiv tõend annab `supported_direct`;
- background-artikkel ei kinnita tasu, tähtaega ega kontakti;
- claim hash ja source ID-d on stabiilsed;
- 30-võtme kärpimine ei kaota koondmõõdikuid;
- stream ja non-stream annavad sama lõpliku claim-kokkuvõtte;
- Golden-37 tehniline tulemus ei lange;
- täissviit, lint, i18n, schema ja privaatsustestid läbivad;
- eraldi raport näitab false-support ja false-insufficient juhtumeid.

Soovituslik commitijaotus:

1. `feat(rag): add atomic claim evidence contract`
2. `test(rag): add high-risk claim attribution fixtures`
3. `docs(rag): record shadow attribution baseline`

## 10. Teadlikud keelud

- Prompti tugevdamist ei loeta jõustamiseks.
- Suuremat mudelit ei kasutata retrieval'i või tõendi vea varjamiseks.
- Üksikut Golden-küsimust ei parandata hard-coded erandiga.
- Kõiki allikaid ei kuvata „igaks juhuks”.
- Allikate arvu ei kasutata väite toetuse asendajana.
- Semantiline sarnasus ei ületa jurisdiktsiooni, teenuse, aja ega allikatüübi piirangut.
- Rerankerit ei aktiveerita ilma retrieval gold-mõõtmiseta.
- Automaatne retry ei tohi dubleerida kulu ega peita algset tõrget.
- Kasutaja privaatset teksti ei koguta kvaliteedianalüütika tarbeks vaikimisi.
- „Maailma parim” ei ole release-kriteerium; mõõdetud ja sõltumatult kontrollitud kvaliteet on.

## 11. Edu lõppdefinitsioon

Programm on edukas, kui:

- süsteem leiab õige tõendi või ütleb täpselt, miks seda ei leidnud;
- iga kõrge riskiga väide on seotud kontrollitava tõendiga;
- kuvatud allikad toetavad päriselt vastust, mitte ainult teemat;
- vale KOV, teenus, redaktsioon ja aegunud kontakt blokeeritakse;
- vastus eristab õigust, praktikat, uuringut, ettepanekut ja ebakindlust;
- iga asjakohane sotsiaaltöötaja või pädev roll saab olla leitav ilma suvalise eelistuseta;
- ET/EN/RU ohutusleping on võrdne;
- kvaliteet säilib mudeli, korpuse ja liikluse muutumisel;
- sõltumatu hindaja saab tulemuse reprodutseerida;
- süsteemi piirangud on kasutajale sama ausad kui selle tugevused.

Siis ei ole SotsiaalAI lihtsalt hea RAG. See on kontrollitud tõendussüsteem, mille keelemudel on üks vahetatav komponent.

## 12. Välised võrdluspunktid

- OpenAI eval-juhis: https://developers.openai.com/api/docs/guides/evals
- RAGChecker: https://arxiv.org/abs/2408.08067
- ALCE citation evaluation: https://arxiv.org/abs/2305.14627
- NIST Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf

