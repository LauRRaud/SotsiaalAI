# M4 tõendiosadega kandidaat: kohalik teostus ja kuue paari plaan

07.09.2026. Omaniku „jätka” järel teostatud kohalik plokk vastavalt [M4-C analüüsi otsusele](rag-v2-m4-c-real-analysis-2026-09-07.md#järgmise-ploki-otsus-pärast-analüüsi-lugemist). Aktiivset tööseisu kannab ainult `SotsiaalAI.md` S1.0. **Omaniku järgneva „okei, arendame edasi” alusel on deploy ja kuue paari pärisvõrdlus tehtud:** mõlemad variandid avaldasid 6/6 vastust. Tunnuseseos toimib ja tõendipiiri eristus paranes, kuid T1 ajalisuse nüanss ning T5 oma järeldus allikaplokis jätavad sisulise vastuvõtu osaliseks. [Päristulemus ja otsus](#pärisvõrdluse-tulemus-0709) on raporti lõpus; kohalik plaan allpool säilib ettevalmistuse ajaloona.

## Mis muutus

Vana tsitaadikandidaat ei avaldanud [pärisvõrdluses ühtegi seitsmest vastusest](rag-v2-evidence-draft-local-2026-09-07.md#pärisvõrdlus-0709-kandidaat-jääb-välja), sest mudel muutis kopeeritud algteksti. Uus opt-in `m4-evidence-draft-2` / `m4-evidence-first-2` valib privaatse ploki `evidence` väljal üksnes `{ref, segmentId}` paare. Rakendus taastab valitud tunnustest tsitaadid ja UTF-16 poolavatud tekstivahemikud. Nähtavaks jääb olemasolev v4 vastusekuju.

Tunnuses on viide, algteksti SHA-256 esimese 12 märgi prefiks ja esinemise järjenumber. Prefiks ei ole allika usaldamise alus: projektsioon kontrollib tervet algteksti räsi, muutmata mudeliteksti, tenant'i, päringut, põlvkonda, lubatud dokumendiversiooni ning olemasoleva adapteriga kanoonilist allikakohta. Täielik räsi ja viitekaart säilivad privaatse auditi sees. Vale või puuduv tunnus, teise allika tunnus, mudeli lisatud tsitaat/tekstinihe, korduv valik ja lõppviidetega vastuolu tõrjutakse; vastust ei parandata automaatselt.

`evidence-segments.js` säilitab iga algteksti märgi, sh CRLF-i ja PDF-i pehmed reavahetused. Piir tekib tühja rea järel või lauselõpuna paistva kirjavahemärgi ja reavahetuse järel, kui järgmine rida algab suure tähe, numbri või loendimärgiga. Pikk osa jääb tervikuks, kui sellist piiri pole. Kõik võrdluse 20 eri viitekonteksti olid ilma tühjade ridadeta; ainult lõigupiiride kasutamine oleks jätnud ühe tunnuse alla terve pika katkendi. Valmis jaotuses on ühe allika kohta 1–16 osa, pikim 1108 UTF-16 ühikut. Kõigi 30 allikaesinemise osade kokkuliitmine kuues paketis annab täpselt algteksti.

See on **PDF-i tekstikuju heuristika, mitte tähenduslik lõigustamine**. Lühend võib sarnaneda lauselõpuga; allikas võib alata poolest lausest ning vajalik tingimus või tegutseja paikneda eelmises osas. Mudeli juhis nõuab sellisel juhul kõrvutiste osade valimist. Jaotus ei lisa puuduvat konteksti. `sourceBinding=pass` ja `semanticSupport=not_evaluated` jäävad eraldi: õige tunnus ei tõenda õiget parafraasi.

V1 tsitaadisüsteem ning v1–v4 nähtavate vastuste lugemine säilivad. Vana v1 kandidaadi taastamisel kasutatakse salvestatud v3 vastuselepingut, mitte praegust rangemat v4 lepingut. Vana allkirjastatud v1 skeemi/prompti/v3 kombinatsioon on lubatud ainult lugemiseks; see ei anna uut väliskutseluba. Tundmatu versioon või skeem jääb tõrjutuks. Teenus salvestab kandidaadi tegeliku versiooni ning taastamisel kontrollib uuesti privaatse mustandi, auditi ja nähtava projektsiooni räsisid. Kandidaadi ja jätkuvestluse koos kasutamise keeld säilib.

## Kohalik kontroll

Üks kirjutaja korraga: Luna teostas piiritletud koodiploki, põhagent vaatas koodi üle ning koostas allikate vastuvõtukriteeriumid, võrdlusfailid ja raporti. Muutusid neli runtime-faili (`evidence-segments.js`, `evidence-draft.js`, `config.js`, `service.js`) ja kaks sihttestifaili. Baasvastuse juhist, otsingut, kasutajaliidest, skeemi ega migratsioone ei muudetud.

- `node --import ./scripts/register-node-source-loader.mjs --test tests/rag-v2-evidence-draft.test.mjs tests/rag-v2-pilot-config.test.mjs`: **14/14 PASS**. Kaetud on muutmata tekst ja Unicode/CRLF-asukohad, vajalik tingimus samas tekstiosas, korduva teksti eri esinemised, v2 ID-/välja-/viitepiirid, avalik projektsioon, auditi rikkumise tõrje taastamisel ja taastumisrajal, v1/v3 ajalooline lugemine ning uue ja vana loa eristus.
- `npx eslint lib/rag-v2/pilot/evidence-segments.js lib/rag-v2/pilot/evidence-draft.js lib/rag-v2/pilot/config.js lib/rag-v2/pilot/service.js tests/rag-v2-evidence-draft.test.mjs tests/rag-v2-pilot-config.test.mjs`: **PASS**.
- `TZ=UTC npm run build`: **PASS**, kompileerumine 25,1 sekundit, lõppkood 0; build'i sees `i18n:check` PASS. [Build'i logi](../../tmp/rag-v2-evidence-segments/build.log).
- `git diff --check`: **PASS**.

Need on kohalikud lepingukontrollid. Sünteetiline taastamistest ei tõenda päris DB tehingut ega UI rada; uusi DB-, brauseri- ega mudelikutseid selles plokis ei tehtud. F1, F2 ja F4 sisuline vastuvõtt jääb lahtiseks. F3/O1 varasema kontrolli ulatust ei laiendata.

## Kuue paari täpne katseplaan

Kasutatakse 12-pöördelise järelkatse muutmata A1, B1, D1 ja D2 pakette. Algse eksportfaili SHA-256 on `bd9bef811705ddf5e04106bc101d534874d85426a4dc1234ff90be41107542ad`; see fail säilis muutmata. Uued küsimused ja vanade pakettide päritolu on fikseeritud manifestis. Otsingut ega embedding'ut ei käivitata. Baas ja kandidaat saavad samad allikatekstid ning metaandmed; kandidaat lisab ainult serveri tunnused ja jaotuse.

| ID | Keel / pakett | Täpne küsimus |
|---|---|---|
| T1 | ET / A1 | Kas heaolutehnoloogiate programmi 20 projekti on juba tegevust alustanud ja lähedaste hoolduskoormust mõõdetavalt vähendanud? Selgita ka, mida on projektide valiku kohta teada. |
| T2 | EN / A1 | What funds the welfare technology programme's projects and its development programme, and what is the overall aim? |
| T3 | ET / D2 | Too artiklist „Tehisintellekt sotsiaaltöös: praktika, kaalutlused ja väärtuspõhised piirid” üks Soome ja üks Hollandi näide. Kas kirjeldatud lahendused on kohustuslikud kõigile Eesti valdadele? |
| T4 | EN / B1 | For a fictional 67-year-old in Tartu who needs help with everyday tasks, what does the training fact sheet say about applying for home help, and what can we conclude about eligibility, timing and price? |
| T5 | ET / D1 | Milliseid samme soovitab eetikanõukoja kommentaar pärast töötaja ähvardamist? Kas kommentaar määrab ka nende sammude järjekorra ja tööle naasmise otsustaja? |
| T6 | RU / A1 | Назови три вида технологий благополучия, перечисленных в описании программы, и кратко объясни назначение каждого. |

T1 küsib otseselt valiku, tegeliku alguse ja mõõdetud mõju eristust. T2 küsib rahastust koos eesmärgiga, et rahastusviite õigsus ei sõltuks vabatahtlikust lisalausest. T3–T5 kontrollivad allika ulatust ja vastaja enda tõendipiiri eraldamist; toetatud põhisisu peab alles jääma. T6 on uus piisava allikatoega positiivne küsimus: põhjendamatu keeldumine või sisu kaotamine ei lähe paranemisena arvesse. Täpsed nõuded ja käsitsi valitud algtekstiankrud asuvad [hindamislehel](../../tmp/rag-v2-evidence-segments/assessment.json). Need on ettevalmistatud hinnangukriteeriumid, mitte mudelitulemused. Korpuse ja teemade varasem tundmine piirab võrdluse sõltumatust.

| Piir / arvestus | Mõlemad variandid kokku |
|---|---:|
| Baas / kandidaat | 6 / 6 vastamiskatset |
| Embedding / uus otsing / korduskatse | 0 / 0 / 0 |
| Mudel / reasoning | `gpt-5.6-luna` / `low` |
| Ühe kutse sisendi / väljundi lagi | 64 000 / 2048 tokenit |
| Kogutokenite lagi | 792 576 |
| Kogu lae konservatiivne reserv | 0,2214912 USD |
| Valmis kehade konservatiivne reserv | 0,0965132 USD |
| Taotletav kogulagi | **0,24 USD**, kummalegi variandile 0,12 USD |

Arvestus kasutab samal päeval kontrollitud avalike hindade konservatiivset alust: sisend 0,25 USD/M ja väljund 1,20 USD/M, cache'i soodustust eeldamata. Sisendreserv on teenuse olemasoleva reegli järgi päringukeha UTF-8 baitide arv + 1024, mitte tegelike tokenite mõõtmine. Konto erihind ja tegelik arve pole tõendatud; enne aktiveerimist kontrollitakse tariifi uuesti. Valmis kehade reserv ei ole prognoositud arve.

[Üldplaan](../../tmp/rag-v2-evidence-segments/comparison-plan.json), [baasi plaan](../../tmp/rag-v2-evidence-segments/baseline-prepared.json), [kandidaadi plaan](../../tmp/rag-v2-evidence-segments/candidate-prepared.json), [paketid](../../tmp/rag-v2-evidence-segments/packets.json), [tõendiosade kataloog](../../tmp/rag-v2-evidence-segments/catalogs.json) ja [täpsed päringukehad](../../tmp/rag-v2-evidence-segments/request-bodies.json) on kohalikult valmis. Plaanidel puudub `approval`; olek on `prepared_not_approved`. Ettevalmistusskript ei sisalda mudeli-, võrgu-, otsingu- ega andmebaasikutset.

## Käivitamine ja otsus pärast katset

Enne võimalikku käivitamist seotakse uus omaniku luba täpse koodicommit'i, serveri runtime-räsi, pakettide ja plaanidega ning kontrollitakse lubatud allikate kanoonilisust. Kohalikud failiteed asendatakse kontrollitud serveriteedega enne plaani allkirjastamist. Mõlemal variandil on uus eraldi kuue katse ledger; varasemaid loendureid ei lähtestata. Tööjärjekord on baasi T1–T6 ja kandidaadi T1–T6. Variantide järjekord ja cache mõjutavad viivitust, mistõttu ajavõitu ei tõlgendata kontrollitud põhjusliku tulemusena.

Küsimused saadetakse nähtava olemasoleva piloodi UI kaudu. Ebaõnnestunud või teadmata tulemusega kutset ei korrata ega asendata uue küsimusega. Katkendi- või õigusekontrolli viga peatab sõltuva osa; konfiguratsiooni või kulupiiri probleem peatab kogu jooksu. Salvestatud paketid peavad vastama külmutatud räsile. Avaldunud kandidaatvastusel kontrollitakse refresh'i ning kasutatud allika avamist ja tagasipöördumist ilma uue mudelikutsena. Katse lõpus, ka katkestuse korral, taastatakse katse-eelse konfiguratsiooni ja keskkonnafaili baidid ning kontrollitakse taastamist.

Põhagent hindab terviklikke vastuseid ja iga väite tegelikku allikatuge, määravaid väljajätteid, kasulikku osavastust, põhjendamatut keeldumist, keelt, avaldamist, viivitust ja kasutust. Õige ID üksi ei saa semantilist PASS-i. Edasiarendus eeldab sihtvigade vähenemist koos vajaliku sisu säilimisega ja positiivse kontrolli avaldamist. Kui baas sihtviga ei korda, ei nimetata seda kandidaadi tõendatud paranduseks. Kuus paari annavad piiratud arendusotsuse, mitte üldise kvaliteediprotsendi.

**Seis kohaliku ettevalmistuse lõpus:** teostus oli valmis, sisuline kasu NOT_PROVEN ning push/deploy/võrdlus tegemata. Järgnenud käivitamine ja piiratud kasu on kirjeldatud allpool; jätkuvestlusega sidumist ei tehtud.

## Omaniku täpsustus: kogu RAG-i rada ja katse korraldamine

07.09 küsis omanik, kas kontroll hõlmab dokumendi ingestimist, metadatafaili loomist, indekseerimist, otsingut ja assistendi system prompt'i. Kuue paari võrdlus tõendab üksnes vastamise muudatust fikseeritud allikapakettidega. Eelmine 12-pöördeline UI katse kasutas päris RAG v2 päringu-embedding'ut, PostgreSQL/Qdranti otsingut, konteksti ja piloodi vastamisjuhist, kuid ei korranud ingestimist ega metadata loomist. Ingest loeb praegu ette valmistatud metadata JSON-i; sellest ei järeldu automaatse metadata loomise ega täieliku admini lisamisvoo valmidus. Piloot kasutab rakenduse vestlus-UI-d ja arendatava RAG v2 komponente eraldi piiratud käitusrajal.

**Piloodi lõpetamise tingimus on üks käsitsi kontrollitud tervikahel:** lubatud dokument → metadata ettevalmistus ja kontroll selle tegeliku töövoo järgi → ingest → indeksi avaldamine → värske küsimuse otsing → mudelile jõudnud metaandmete, katkendi ja kehtiva vastamisjuhise kontroll → nähtav vastus ja algallika avamine. Puuduv admini/metadata automaatika või muu ühendus märgitakse puuduvaks, mitte läbituks CLI abil. See kontroll kuulub piloodi vastuvõttu; seda ei lükata piloodijärgsesse määramatusse. Praegune kitsas võrdlus ega varasemad eraldi etappide kontrollid ei asenda seda. Tervikahela konkreetne dokument ja vajalikud väliskutsed tuleb siduda käivitatava töö ulatusega; käesolev täpsustus ei käivitanud ühtegi katset ega deploy'd.

Omanik ei soovi testimise aja kulutamist peenele kuluarvutusele. Edaspidi kasutatakse olemasolevat automaatset kulupiiri ja lõpus tegelikku kasutuskoondit; eraldi senditäpset käsitsi arvutusringi ei tehta. See eelistus ei ole piiramatu korduskatsete ega uute arhitektuuriharude luba.

## Pärisvõrdluse tulemus 07.09

Omanik kinnitas jätkamise pärast täpse 6+6 plaani ja tervikahela ulatuse selgitamist. Kood `c57dcffe2` ning ulatust täpsustav dokumentatsioon `10783c35f` jõudsid `origin/main`-i ja serverisse. Katse kasutas kahte uut plaani `m4-segments-baseline-20260907-1` ja `m4-segments-candidate-20260907-1`, samu kuut küsimust, samu külmutatud pakette ja mudelit `gpt-5.6-luna`, reasoning `low`. Küsimused saadeti nähtava `/vestlus` UI kaudu kahes eraldi vestluses. **Tegelik tulemus: 12 lõpetatud pööret, igal `attempt=1`, 12 vastusekutset ja 0 embedding'u-/otsingukutset.** Avaldus baasi 15 ja kandidaadi 14 allikaväiteplokki; põhjendamatut täielikku keeldumist ei olnud.

### Deploy kõrvalekalle ja võrdluse kehtivus

Esialgne serveritoiming uuendas Git-puud ja taaskäivitas teenuse, kuid jättis tootmisartefakti ehitamata. Seetõttu oli HEAD `10783c35f`, ent `.next/BUILD_ID` endiselt `4cbe6997-90cf-4126-b79d-a2c153460742`, muutmisajaga 11:21:44 UTC. Kandidaadi esimene UI saatmisklõps ebaõnnestus juba vestluse `ensure` toimingus; UI näitas üldist „Pooleliolev katse”. Refresh'i järel piloodi sisestusväli kadus. [Serveri mõõtmine](../../tmp/rag-v2-evidence-segments/candidate-failure-inspection-20260907.json) kinnitas kandidaadi ledger'i puudumist ja **0 pööret / 0 mudelikutseni jõudmist**. Lähtekoodist käivitatud konfiguratsioonikontroll ei olnud töötava Nexti rakenduse kontroll.

Puudulik deploy parandati serveri `npm run build` ja teenuse taaskäivitusega; build ja selle i18n-kontroll läbisid. Uus build ID on `07d4723d-8764-4f48-9f4a-98556cfdfb13`, muutmisaeg 13:27:03 UTC. Leht värskendati uuesti, piloot taastus ning alles seejärel tehti kandidaadi kuus tegelikku mudelikutset. See ei olnud ebaõnnestunud või teadmata mudelivastuse korduskatse. Konfiguratsiooni kaitseid, küsimusi ega eelarvet ei nõrgendatud.

Baasvastused sündisid enne korrektset serveribuild'i. Nende võrdluskõlblikkust ei eeldata HEAD-i järgi: põhagent võrdles **iga salvestatud päringu tervet keha** praeguse baasi päringukoostaja tulemusega ning iga paketti külmutatud paketiga. Kõik kuus baaskeha ja kuus kandidaadikeha kattusid vastava kavandatud kehaga; kõik 12 paketti kattusid. Baasi juhis ja skeem olid seega selles võrdluses täpselt kavandatud v4 omad. See tõendab mudelivõrdluse sisendit, mitte vana artefakti kõigi runtime-radade samasust. Ajavõrdlust mõjutavad lisaks variantide järjekorrale ja cache'ile ka build ja restart.

Allkirjastatud failides säilisid varasemast mallist kirjeldavad `comparison`/`authorizationBasis` väljad vana 7+7 ja 0,27 USD tekstiga, kandidaadil ka vana `arm=baseline` silt. See on ettevalmistuse dokumenteerimisviga. Tegelikult kontrollitavad `questionPolicy`, `budget`, eraldi ID-d, kandidaadi versioon ja uus `approval.authorization` sidusid jooksu **6+6 ja 0,24 USD** piiriga; ledger'id kinnitavad seda. Käivitatud allkirjastatud faile ei kirjutatud tagantjärele ümber. Enne nende kasutamist mõne järgmise plaani alusena tuleb vanad kirjeldusväljad eemaldada või asendada.

### Sisuline hinnang

Põhagent luges kõik vastuseplokid, piirangud ja nende tegeliku algteksti ning kandidaadi kõik 28 taastatud tekstiosa. Täiendavat mudelihindajat ei kasutatud. Tabeli PASS on konkreetse juhtumi piiratud vastuvõtt, mitte kogu süsteemi kvaliteedihinne.

| Juhtum | Baas | Kandidaat | Järeldus |
|---|---|---|---|
| T1 — valik, algus, mõju | PARTIAL | PARTIAL | Kandidaat tõstab oma tõendipiiri allikaplokist piirangutesse ja säilitab valiku faktid. Piirang „kõik või osa” projekte pole tõendatult alanud on aga liiga lai: valitud S2 tekstiosa 0 ütleb, et tervishoiuasutused **arendavad** kaugtaastusravi lahendusi. Vastus peaks nimetama allikas kirjeldatud arendustegevust, eristades seda kõigi projektide käivitumisest, teenuse kasutuselevõtust ja mõõdetud mõjust. Ka baas jätab selle nüansi ütlemata. |
| T2 — rahastus ja eesmärk | PASS | PASS | Mõlemad eristavad kahte EL-i kaasrahastuse meedet ning viitavad rahastusväites S1-le. Kandidaat valib täpse rahastusosa `m4seg_S1_9442a7bb510f_10`; eesmärk saab toe S3/S4-st ja jääb eesmärgiks. F2 otsene kontroll läbis, kuid baas oli juba õige: kandidaadi paremust siin ei tõendatud. |
| T3 — riiginäited ja Eesti kohustus | PARTIAL | PASS | Baas ühendab oma kohustuse puudumise tõlgenduse artikli eesmärgi allikaplokiga. Kandidaat säilitab toetatud Soome/Hollandi näited ning autori sõnaselge eesmärgi; Eesti kohustuse ja kasutuselevõtu teadmatus jääb katkenditega piiritletud piirangutesse. |
| T4 — faktileht ja isiku olukord | PARTIAL | PASS | Baasi isikupõhine sobivuse teadmatus on S1 viitega plokis. Kandidaat eristab allika taotlemisrada ja faktilehe sõnaselget lubaduste puudumist inimese Tartu/vanuse/sobivuse kohta tõendamata järeldustest. Vajalik järgmine samm säilib, teise õppejuhtumi fakte ega korduvat asukohaküsimust ei lisata. |
| T5 — tööohutuse sammud ja otsustaja | PARTIAL | PARTIAL | Mõlemas säilivad kasulikud kontakti, abi, riskihindamise ja vastutuse soovitused. Kandidaadi ploki 2 lõpp „mitte konkreetse ametikoha või isiku nimetamine” on endiselt vastaja tõendipiiri tõlgendus `factual=true` allikaplokis. Õigesti piiratud lõpuhoiatus seda ei paranda. Kindlat järjekorda ega konkreetset otsustajat kumbki ei leiuta. |
| T6 — piisava toega venekeelne vastus | PASS | PASS | Mõlemad annavad kolm õiget tehnoloogialiiki ja nende otstarvet. Kandidaat kasutab täpselt S1 osi 2, 3 ja 4. Vastus avaldub ilma põhjendamatu keeldumise või individuaalse tulemuslubaduseta. |

T1 „arendavad” tähelepanek tekkis algteksti lõppülevaatusel. Algne ettevalmistatud hindamisleht säilib muutmata; tähelepanek on [käsitsi hinnangus](../../tmp/rag-v2-evidence-segments/manual-assessment.json) eraldi märgitud. Piirangu paigutus võib paraneda samal ajal, kui selle sisu muutub liiga ettevaatlikuks. Seda ei loeta täielikuks F1 paranduseks. T2 kandidaat tõlkis jutumärkides meetmenimed inglise keelde; rahastusseos on õige, kuid ametliku nime ja selgitava tõlke eristus vajab hilisemas keeleviimistluses tähelepanu.

Tunnuseseoste kontroll läbis: **28/28** valitud osa tunnus, tekst, UTF-16 vahemik ja algteksti räsi kattuvad deterministliku kataloogiga. Kõigi **60/60** viiteesinemise algteksti räsi ja lubatud dokumendiversioon kattuvad. Kõik nähtavad vastusetekstid vastasid salvestatud väljadele; loendi numeratsiooni ja Markdowni rasvast kirja võrreldi renderdatud kujul. Allika tehniline seos ei anna automaatset semantilist PASS-i: T5 segatud väide läbis sama tehnilise kontrolli.

### UI, kasutus ja taastamine

Kandidaadi kuus vastust taastusid refresh'i järel. Viimase venekeelse vastuse „Vastuste allikad” avas kasutatud S1 algteksti (PDF lk 3–5), mis sisaldab kolme nimetatud tehnoloogiat. „Sulge allikas” viis samasse vestlusse ja kõik kuus vastust taastusid. [Allikavaate pilt](../../tmp/rag-v2-evidence-segments/ui/candidate-T6-source.png), [refresh'i tõend](../../tmp/rag-v2-evidence-segments/ui/candidate-after-refresh.txt) ja [tagasitee tõend](../../tmp/rag-v2-evidence-segments/ui/candidate-source-back.txt) on salvestatud. Katse ei kasutanud jätkuvestluse konteksti ega tõenda selle sidumist kandidaadiga.

Tegelik provider'i kasutus oli 62 651 sisend- ja 5670 väljundtokenit, kokku 68 321; cache'i ja reasoning'u alamnäitajaid ei liidetud teist korda. Olemasoleva konservatiivse hinnastuse järgi on kasutushinnang ligikaudu **0,0225 USD**, mitte kontrollitud arvesumma. Katse jäi automaatse 0,24 USD piiri sisse; uusi kutseid ei tehtud. Pöörde salvestatud kestuse mediaan oli baasil 4,65 s ja kandidaadil 6,23 s (kandidaadi vahemik 3,41–11,41 s). See ei ole kontrollitud põhjuslik kiirusvõrdlus.

[Tooreksport](../../tmp/rag-v2-evidence-segments/server-real-run-raw.json), 13:35:09 UTC, SHA-256 `72be8411056187b9ca23c19c40028b979de99bcfb5315b5088e1d8021c60d37d`; [mehhaaniline kontroll](../../tmp/rag-v2-evidence-segments/analysis-verification.json); [täielikud vastused ja seosed](../../tmp/rag-v2-evidence-segments/answers-and-bindings.json). Need on katse tõendid, mitte konkureeriv tööseis.

[Taastamise mõõtmine](../../tmp/rag-v2-evidence-segments/restore-receipt-20260907.json), 13:37 UTC: algne konfiguratsioon taastati baiditäpselt, SHA-256 `f64f88a77247da0a1f05ed11e1fd795e34779ffebd6235bee7efa5be7b3b2292`, `root:ubuntu:640`; env jäi muutumatuks, SHA-256 `a50c105cb5eab9a6fe78fd787574f551efcf059649276c4cf1c0aea2145a0dcf`, `root:root:600`. Serveri HEAD ja kaug-main olid `10783c35f`, tööpuu puhas, frontend aktiivne ning `/vestlus` 200. Taastamine ei anna vanale plaanile uue koodi täitmisluba ega ava avalikku vastamist.

### Edasiarenduse otsus

**Tekstiosa tunnusega sidumise mehhanism jääb opt-in katsekandidaadina alles.** See kõrvaldas selles jooksus vana tsitaadikandidaadi avaldamist takistanud probleemi ning parandas mitmes juhtumis tõendipiiri eristust. Seda ei tõsteta praegu vaikimisi vastajaks ega ühendata jätkuvestlusega: F1 ja F4 jäävad osaliseks. F2 otsene rahastusviite vastuvõtt läbis; F3/O1 senist ulatust ei laiendata.

Alles jäävad kaks täpset vastunäidet: T1 peab säilitama kirjeldatud arendustegevuse, lubamata kõigi projektide algust või mõõdetud mõju; T5 oma järeldus otsustaja kohta peab olema katkendipiirang, mitte allikaploki väide. Uut laia promptide võrdlusringi, teist mudelihindajat ega uut otsingusüsteemi selle tõttu ei avata.

Järgmine sidus arendusplokk peab viima edasi omaniku nõutud **päris dokumendi lisamise ja metadata töövoogu olemasolevas RAG v2-s** ning selle tervikahela vastuvõttu. Kaardistus kinnitas, et admini vanad `ingest` ja `documents` lehed on suunatud pensioneeritud vaatele ning CLI ingest eeldab olemasolevat metadata JSON-i. See ühendus on veel puuduv; seda ei märgita CLI-käskude olemasolu põhjal tehtuks. Järgmise ploki kaart peab siduma lubatud dokumendi, metadata päritolu ja kontrolli, ingesti, indeksi avaldamise, värske otsingu, mudelile jõudnud allikad/juhise ning UI-vastuse ja algallika. Admini käsitsi käivitatav RAG-i enesetest jääb alles. T1/T5 on selle vastamisosa jätkuvad vastuvõtupiirid, mitte ettekääne tervikahela lõputuks edasilükkamiseks.

Raporti ja S1.0 järelkanne muudab ainult dokumentatsiooni. Koodi kohalikke sihtteste ja build'i ei korrata dokumentatsiooni tõttu; lõppkontroll on `git diff --check`. Serveribuild oli vajalik puuduva tootmisartefakti valmistamiseks, mitte sama kohaliku kontrolli rituaalseks kordamiseks.
