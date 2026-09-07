# M4 tõendiosadega kandidaat: kohalik teostus ja kuue paari plaan

07.09.2026. Omaniku „jätka” järel teostatud kohalik plokk vastavalt [M4-C analüüsi otsusele](rag-v2-m4-c-real-analysis-2026-09-07.md#järgmise-ploki-otsus-pärast-analüüsi-lugemist). Aktiivset tööseisu kannab ainult `SotsiaalAI.md` S1.0. See raport kirjeldab selle ploki tulemust ja piiratud katseplaani; **pärismudeli võrdlus ja serveri runtime on NOT_RUN**.

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

**Kohalik teostus valmis; sisuline kasu NOT_PROVEN.** Push'i, deploy'd ja seda uut 12-kutse võrdlust pole tehtud. Jätkuvestlusega ühendamine järgneb ainult soodsale võrdlustulemusele eraldi sidumisplokina.

## Omaniku täpsustus: kogu RAG-i rada ja katse korraldamine

07.09 küsis omanik, kas kontroll hõlmab dokumendi ingestimist, metadatafaili loomist, indekseerimist, otsingut ja assistendi system prompt'i. Kuue paari võrdlus tõendab üksnes vastamise muudatust fikseeritud allikapakettidega. Eelmine 12-pöördeline UI katse kasutas päris RAG v2 päringu-embedding'ut, PostgreSQL/Qdranti otsingut, konteksti ja piloodi vastamisjuhist, kuid ei korranud ingestimist ega metadata loomist. Ingest loeb praegu ette valmistatud metadata JSON-i; sellest ei järeldu automaatse metadata loomise ega täieliku admini lisamisvoo valmidus. Piloot kasutab rakenduse vestlus-UI-d ja arendatava RAG v2 komponente eraldi piiratud käitusrajal.

**Piloodi lõpetamise tingimus on üks käsitsi kontrollitud tervikahel:** lubatud dokument → metadata ettevalmistus ja kontroll selle tegeliku töövoo järgi → ingest → indeksi avaldamine → värske küsimuse otsing → mudelile jõudnud metaandmete, katkendi ja kehtiva vastamisjuhise kontroll → nähtav vastus ja algallika avamine. Puuduv admini/metadata automaatika või muu ühendus märgitakse puuduvaks, mitte läbituks CLI abil. See kontroll kuulub piloodi vastuvõttu; seda ei lükata piloodijärgsesse määramatusse. Praegune kitsas võrdlus ega varasemad eraldi etappide kontrollid ei asenda seda. Tervikahela konkreetne dokument ja vajalikud väliskutsed tuleb siduda käivitatava töö ulatusega; käesolev täpsustus ei käivitanud ühtegi katset ega deploy'd.

Omanik ei soovi testimise aja kulutamist peenele kuluarvutusele. Edaspidi kasutatakse olemasolevat automaatset kulupiiri ja lõpus tegelikku kasutuskoondit; eraldi senditäpset käsitsi arvutusringi ei tehta. See eelistus ei ole piiramatu korduskatsete ega uute arhitektuuriharude luba.
