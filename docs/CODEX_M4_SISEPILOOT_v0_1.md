# Codex: M4 — allikapõhise vestluse piiratud sisepiloot

**Versioon:** 0.1  
**Koostatud:** 06.09.2026  
**Staatus:** järgmise töövooru teostusülesanne, mitte valmis lahendus, käivitusluba ega kvaliteedigarantii.  
**Vahetu eesmärk:** üks töötav, autentimisega kaitstud rada uuest küsimusest vastuse ja avatava allikakohani. Olemasolevat M0–M2.3 tuuma ei ehitata uuesti.

## 1. Lähteolukord ja tõendi piir

Omaniku viimase tööraporti järgi on kohalik M2.3 plokk lõpetatud:

- Koondvastuvõtt on salvestatud: 50 `full`, 14 `partial`, 13 `absent`, 7 lahtist küsimuse-/meetodirida.
- Põhileidude eelisjärjekorda kasutav versioonitud profiil võrdus struktuurita hübriidiga 21/21 küsimusel. Vana 3+2 poliitikaga võrreldes oli 2 võitu, 1 kaotus, 16 võrdset ja 2 lahendamata võrdlust.
- Andmeminimeerimise juhtumis jäi välja vana naabri toodud kasulik tugi. See piirang säilib teadaoleva regressioonijuhtumina.
- Raporteeritud on 39 läbinud testi, lint ja tootmisbuild. Lunat ei ühendatud; muudatused on kohalikud ning push'i ega deploy'd pole tehtud.

See kokkuvõte pärineb omaniku sõnumist, mitte siinse ülesande koostamisel uuesti käivitatud testidest. Viidatud kohaliku `selection-ranked-first-v1/report.html` sisu ega viimast kohalikku lähtekoodi pole ülesande koostaja kätte saanud. Codex loeb need tegelikust tööruumist.

50/84 pole ühe kasutatava süsteemi täpsus: see koondab eri meetodeid ja küsimuste liike. 21/21 võrdumine ei tõenda uut otsingukvaliteedi võitu. Uus profiil on teostuse selgem piiritlemine, mitte uus semantiline graaf. M4 ei pea ootama seitsme lahtise hindamisjuhtumi lõppu.

## 2. Loe olemasolevat tööd ja jätka samast tööpuust

Loe projekti juhiseid, asjakohaseid `AGENTS.md` faile, uusimat `docs/platvormi arendus/SotsiaalAI.md` S1.0 kirjet, RAG masterit ning tegelikke ADR-e. Aktiivne tööjärg jääb S1.0-sse; ära loo uut konkureerivat masterit.

Kontrolli kohalikku HEAD-i ja muutunud faile. Viimane M2.3 pole omaniku sõnul GitHubi saadetud: ära asenda seda kaug-hoidla vanema seisuga ega tee tööpuud jõuga puhtaks. Ära korda juba salvestatud koondvastuvõttu, nulli kinnitusi ega kirjuta ajaloolisi raporteid üle. Kontrolli ainult selle töö alustamiseks vajalikku sisendite/profiili vastavust.

M0 auditi järgi on olemasolevad ühenduskohad järgmised; nende praegune kuju tuleb koodist üle kontrollida:

| Pind | Varem kaardistatud koht | Selle töö nõue |
| --- | --- | --- |
| Vestlus | `app/api/chat/route.js` | Säilita olemasolev leping; lisa kaitstud sisepiloot funktsioonilülitiga. |
| Autentimine | `requireChatUser()`, `lib/chat/routeServerUtils.js`, `lib/authz` | Kasuta tegelikku serverisessiooni ja õigusi. Ära loo teist sisselogimissüsteemi. |
| Vestluse klient | `components/chat/hooks/useChatStream.js` | Säilita sobivus, salvestatud vastuse taastamine ja päringu idempotentsus. |
| Allikapaneel | `components/chat/utils/sources.js`, `ChatSourcesPanel.jsx` | Kohanda kanoonilised viited olemasolevasse kasutajavaatesse. |
| Mudeliseadistus | `lib/chat/settings.js` ja olemasolev serveripoolne adapter | Loe tegelik konfiguratsioon. Vana fallback-string pole konto ligipääsu ega sobiva API-lepingu tõend. |
| Andmete elutsükkel | olemasolevad vestluse salvestamise ja kustutamise ühenduskohad | Piloodi vastused, viited ja diagnostika peavad järgima sama ligipääsu- ja kustutuspiiri. |

Uus teadmiste- ja vastamistuum peab jääma platvormist eraldatavaks. Next.js-i sessiooni-, HTTP- ja UI-detailid asuvad adapterites, mitte tuuma otsingukoodis.

## 3. Ulatus: üks M4 plokk, kaks käivitusväravat

**M4-A — kohalik teostus ja katsed.** Ehita päris HTTP-/vestluse ühendus, õiguste adapter, päringuembedding'u ja vastaja adapter, püsiv katsete/kulu kontroll, viited ning kasutajavaade. Tee automaat- ja brauserikontrollid testtranspordiga. Tavakatsetel ei ole välismudelikutseid ka siis, kui keskkonnas on päris API-võti.

**M4-B — piiratud pärismudeli sisepiloot.** Sama teostuse pärisrežiim, mis käivitub alles pärast ühe konkreetse piloodiplaani materjali- ja kululoa olemasolu. Pärisrežiimi ettevalmistus kuulub praegusesse töösse; loa puudumine peatab väljasaatmise, mitte kohaliku teostuse. Selle dokumendi üleandmine ei ole iseenesest väljasaatmis- ega kululuba.

Funktsioonilüliti on vaikimisi väljas. Tavakasutaja jaoks jääb `generationAvailable=false`. Sisepiloot on kasutatav ainult kontrollitud serverisessiooniga, serveris määratud katsetajatele ja valitud arenduskorpusega. Ühe pilootkasutaja luba ei ava teenust kõigile adminidele, teistele kasutajatele ega anonüümsele päringule. Valmisolekunäit ei tohi öelda, et pärisvastamine töötab, kui seadistatud on ainult testvastaja.

Praegu EI tehta avalikku juurutust, massindekseerimist, M3 semantilise graafi loomist, M5 kümnendi ülevaaterada, uut parserit ega otsingukaalude häälestust. Ei lisata agente, mudelipõhist päringuplaneerijat, automaatset kriitikut, välist RAG-/mälu-/ümberjärjestamisteenust ega mudeli juhitud tööriistu.

## 4. Otsinguprofiil ja indeksi piir

M4 esialgne katseprofiil on **struktuurita pärisvektorotsing**, kasutades M2.3-s kirjeldatud olemasolevat eksplitsiitset profiili. Hübriid jääb eraldi valitavaks arendusvõrdluseks; profiili valib serveri konfiguratsioon, mitte keelemudel ega suvaline HTTP-sisend. Vana 3+2 poliitika säilib ajalooliste katsete taasesitamiseks, mitte sisepiloodi vaikena.

Ära nimeta vektorit üldiselt parimaks. Säilita teadaolevad piirangud, sh kolleegidega eetika arutelu ja andmeminimeerimise osatugi. Valitud profiil on uuritav lähtevariant, mitte kogu valdkonna jaoks kinnitatud lõppotsus.

Profiili identiteet peab siduma meetodi, kandidaatide arvu, üksuste ja dokumendi piirid, kompaktse konteksti tokenipiiri, struktuurilaienduse seisu, valikupoliitika ning embedding-ruumi. Taaskasuta olemasolevaid profiili-ID-sid ja räsireegleid. Kui mõni väli puudub, täienda lepingut väikseima põhjendatud muudatusega; ära toetu märkamata teistsugustele tuuma vaikeväärtustele.

Päringuvektor peab kasutama aktiivse indeksi sama provider'it, mudelit, mõõtmeid ja päringusisendi koostamise lepingut. Olemasolevat `text-embedding-3-large` indeksit ei ehitata M4 tõttu ümber. Ajalooline dokumentide prefiks ei tähenda, et kasutaja küsimusele tuleks lisada väljamõeldud pealkiri.

Hindamisfailide küsimuse-ID-d, ankrud, nõutud dokumendid, `full/partial/absent` sildid ja korpusekatvuse otsused ei tohi jõuda käitusaegsesse otsingusse või Luna sisendisse. `needs_review` on hindamiskogu tööseis, mitte teadaolev kasutajaküsimuse omadus.

Pärisvektori raja tõrge ei tohi märkamatult vahetada mudelit, korpust või otsinguprofiili. Esimese sisepiloodi vaikekäitumine on nähtav tehniline tõrge; võimaliku varem toetatud varuraja kasutus peab olema eraldi profiilis lubatud ja jälgitav.

## 5. Päringu tervikvoog

Tavaline edukas päring läbib ette määratud töövoo:

**Sessioon ja õigused → idempotentsuskirje → lubatud küsimusekontekst → vajaduse korral üks päringuembedding → otsing → kompaktne tõenduspakett → üks Luna genereerimiskatse → struktuuri/viidete/õiguste kontroll → vastuse ja viidete salvestamine → kasutajale avaldamine.**

### 5.1 Õigused ja usalduspiirid

Tuleta `subject`, tenant/organisatsioon, vestluse kasutusõigus, lubatud korpus ja piloodiluba serveri usaldatud andmetest. Kliendi `role`, tenant, `history`, `convId`, `roomId`, `privacyDecision` ega dokumendi-ID ei anna ise õigusi. Valitud dokumendi kitsendus võib ainult vähendada juba lubatud ulatust.

Kontrolli õigusi enne otsingut, enne iga välist andmete saatmist, enne vastuse avaldamist ning hilisemal vestluse/viite lugemisel. Õiguse tühistamisel ei avaldata juba genereeritud keelatud allikale tuginevat mustandit. Varem teenusepakkujale õiguspäraselt saadetud teksti ei saa üksnes kohaliku kontrolliga tagasi võtta; ära väida sellist garantiid.

Praegused materjalid on arenduskasutuse piiriga. Ära tõsta `development_only` materjale avaliku kasutuse alla ega laienda nende õigusi ainult seetõttu, et platvormi sessioon on olemas.

Rakenda olemasoleva sessioonitüübi jaoks asjakohast päringu päritolu/CSRF-kaitset, sisendimahupiiri, kasutajapõhist päringupiiri ja piiratud samaaegsust. Need kontrollid peavad toimuma enne tasulist kutset.

### 5.2 Uue küsimuse embedding

Seni salvestatud vektorid ei kata kõiki uusi küsimusi. Lisa kontrollitud päringuaegne embedding-adapter: kehtiva loa korral arvutatakse uue lubatud otsinguteksti vektor ja kasutatakse seda samas päringus. Olemasolevat korrektset vektorit võib õiguste ja embedding-konfiguratsiooni piires taaskasutada.

Ära saada embedding-teenusele kogu vestlusajalugu, PDF-i, auditipaketti ega hindamisrubriiki. Saadetakse täpselt päringuehitaja valitud tekst; selle räsi, koostamisversioon, tokenid ja katse seos jäävad privaatsesse jälge. Nähtav maksu-/võrgupiir kehtib ka küsimuse vektori arvutamisele, mitte ainult Luna vastusele.

Säilita olemasolev konservatiivne embedding-sisendipiir ja vektori sisu valideerimine. Tühja või liiga pikka päringut ei saadeta teenusesse ega kärbita märkamatult. Testvektorit ei kasutata puuduva pärisvektori varuasendusena pärisindeksis.

### 5.3 Piiratud vestluskontekst

Esimene versioon toetab uut iseseisvat küsimust ja piiratud sama teema jätkuvestlust. Ajalugu loetakse serveri lubatud vestlusest, mitte kliendi saadetud usaldamata koopiast. Ajaloolised assistendiväited ei ole iseseisvad allikad ega kinnitatud kasutajaandmed.

Päringuehitaja on selles etapis deterministlik ja eelarvestatud: praegune küsimus, eksplitsiitselt valitud teema/allikas ning vajaduse korral lühike asjakohane eelnev kasutajasõnum. Täpne lihtne strateegia fikseeritakse koodis ja profiilis; ära väida, et see lahendab üldise teemade või inimeste eristamise. Mudelipõhist ümberkirjutajat ega automaatset pikka mälu ei lisata.

Testi vähemalt sama teema jätkuküsimust, teemavahetust, uue inimese kohta küsimist ja varasema asjaolu parandust. Ebaselget viidet ei lahendata suvalise eeldusega; Luna võib sama vastuse sees küsida täpsustust. Teise vestluse või kasutaja ajalugu ei kasutata. Vajaduse korral piira sisepiloodi kasutusulatust selgelt, selle asemel et nimetada puudulikku vestlusmälu valmis võimekuseks.

## 6. Luna adapter ja vastuse kasutusleping

### 6.1 Täpne konfiguratsioon

„Luna” on tootes kasutatav vastaja nimi. Tuvasta tegelik serveri mudeli-ID, provider, lubatud endpoint ja kasutatav API-leping. Ära kopeeri vana fallback'i ega vaheta mudelit vaikimisi. Avalik dokumentatsioon või olemasolev konfiguratsioon ei tõenda konkreetse konto käivitusõigust; esimene lubatud päriskatse näitab tegelikku ühendust.

Lukusta piloodis mudel, endpoint, toetatud vastusevorming, väljundi/arutluse eelarve ja vajalikud parameetrid. Kasuta ainult valitud mudeli toetatud parameetreid; ära lisa automaatselt `temperature=0` või muud üldmalli. Puuduv või vastuoluline konfiguratsioon annab `not_configured`/konfiguratsioonivea, mitte alternatiivmudeli vastuse.

Eelista olemasoleva serveriadapteri vähimat kohandust. Kui uut adapterit on vaja, sobib toetatud Responses API; Chat Completionsilt ei migreerita ainult moe pärast. Kumbagi valides säilib sama tuuma sisend-väljundleping. OpenAI teenuses ei kasutata hosted File Searchi, väliseid vektorhoidlaid, brausimist, koodi käivitamist ega mudeli tööriistakutseid.

### 6.2 Mida Luna saab ja mida ei saa

Luna saab süsteemijuhise, küsimuse, piiratud lubatud dialoogikonteksti ning olemasoleva kompaktse tõenduspaketi. Säilivad allikatekst, allika identiteet, aeg/ulatus ja teadaolevad kvaliteedipiirangud. Pikad räsid, auditilogid, otsinguskoorid ja kontrollimata pärandkirjeldused ei täida vastamiskonteksti.

Allikatekst, metaandmed ja vestlusajalugu on andmed, mitte õigust ületavad juhised. Allikas olevat käsku „ignoreeri reegleid” või välise teenuse URL-i ei täideta. Allikad ei saa ise määrata süsteemireegleid ega käivitada tööriistu.

Luna ülesanne on seletada ja sünteesida seda, mida valitud materjal toetab. Iga oluline allikapõhine faktiline väide peab olema seostatav antud tõendiga. Mudeli eelteadmised ei tohi täita korpusest või tagastatud kontekstist puuduvaid tingimusi, kuupäevi, hindu ega tulemusi.

Kui abi on osaliselt põhjendatud, antakse see osa ja nimetatakse piir. Puuduva kasutaja asjaolu puhul küsitakse asjakohane täpsustus. Puudulik allikatugi ei nõua kogu vestlusest keeldumist. Vastupidi, kõrvaliste kandidaatide olemasolu ei anna õigust oletada konkreetset vastust.

Erista vähemalt allikapõhist vastust, osavastust, täpsustusküsimust ja olukorda, kus antud materjal vastust ei toeta. Mudeli valitud vastuseviis on **mudeli deklaratsioon**, mitte sõltumatu kvaliteedihinnang. Ära kanna seda hindamiskogu kinnitatud `full/partial/absent` olekuks ega näita kontrollimata usaldusprotsenti.

### 6.3 Vastusevorm ja viited

Kasuta olemasoleva tuumaga sobivat väikest tüübitud väljundit: loomuliku keele vastuseplokid, ploki tõendiviited, piirangud ja vajaduse korral täpsustusküsimus. Allikaviide peab osutama konkreetsele antud tõendikirjele/tekstikohale, mitte ainult tervele andmebaasile. Nimede valik pole kohustuslik uus skeem; taaskasuta olemasolevaid `evidence_id`/lühiviiteid ja tüüpe.

Toetatud mudeliga kasuta ranget skeemipõhist väljundit. Kui mudelil see tugi puudub, peab konfiguratsioon kirjeldama testitud alternatiivse parseri; ära lisa varjatud teist mudelikutset vigase JSON-i parandamiseks. Skeemikontroll ei tõenda sisu õigsust.

Server kontrollib iga viite kuuluvust just selle päringu lubatud tõenduspaketti ja lahendab selle kanoonilisse dokumendiversiooni/allikakohta. Mudeli URL-i, PDF-lehenumbrit või autori nime ei kasutata viite autoriteetse alusena. Eelmise sõnumi `S1` pole uue sõnumi `S1`: lühiviited seotakse püsivalt sõnumi/päringu ja allikaversiooniga.

Allikapaneelis erista **vastuses kasutatud allikaid** lihtsalt otsingus leitud materjalist. Avamisel kontrollitakse uuesti ligipääsu. Privaatset failiteed, avalikku failihoidla linki ega autoriseerimata tervet PDF-i ei paljastata. Juba olemasolev PDF-lehe vaade on eelistatud; puudumisel peab vähemalt kontrollitud algtekstikoht koos dokumendi, versiooni ja 1-põhise lehega avanema kaitstud vaates.

Tundmatu/vale viite, tõendiväiteks märgitud ploki puuduva viite, pooliku vastuse või vigase skeemi korral ei avaldata mustandit vaikimisi valmis allikapõhise vastusena. Esmaversioonis on lubatud terve mustand tagasi hoida ja anda tehniline veateade. Ühe vale viite kustutamine ei tohi muuta selle kõrval olevat põhjendamata väidet näiliselt sobivaks.

Kehtiv viite-ID ei tõenda, et viidatud tekst väidet tegelikult toetab. Seda mõõdetakse eraldi vastuse sisulises katses. Ka skeemi läbinud vastus võib olla sisuliselt vale.

### 6.4 Kuvamine ja voog

Esimese sisepiloodi vaikekäitumine: koosta vastus serveris, kontrolli tervik ja viited ning avalda seejärel lõppsõnum. Kasutaja võib näha olekusündmusi („otsin”, „koostan”), kuid mitte kontrollimata osateksti valmis vastusena. Säilita olemasoleva vestlusklienti lepingu sobivus; vajaduse korral kohanda adapterit.

Kui olemasolev teostus võimaldab kontrollitud plokipõhist voogu, võib seda kasutada ainult selgelt testitud avaldamispiiriga. Viiteid ei tohi valideerida alles pärast seda, kui vale viitega tekst on kasutajale lõplikult kuvatud. Ära simuleeri tokenivoogu ja nimeta seda kiirusevõiduks. Mõõda eraldi esimene olekusündmus, mudeli esimest andmeosa ja esimese päriselt avaldatud vastuse aeg.

Markdown/HTML ja allikapealkirjad renderdatakse turvaliselt. Keelatud HTML või käivitatav URL-skeem ei muutu aktiivseks sisuks.

## 7. Püsivus, idempotentsus ja kulupiir

Kasuta olemasolevat vestluse püsistust ning `clientTurnKey`/`idempotencyKey` lepingut. Päringu võti on serveris seotud vähemalt kasutaja/tenant'i, vestluse ja sisendi identiteediga. Sama võti sama sisuga taastab olemasoleva töö/tulemuse; sama võti teise sisuga annab konflikti. Paralleelsed topeltpäringud, refresh ja ühenduse katkemine ei tohi põhjustada teist genereerimiskatset.

Katseolekud peavad eristama enne saatmist peatatud tööd, saadetud tööd, lõpetatud tulemust ning teadmata tulemusega katkestust. Ära luba protsessi taaskäivitamisel automaatselt kordussaatmist, kui eelmine väliskatse võib olla juba käivitatud. Võrgukatkestusega ei lubata matemaatilist „exactly once” garantiid; eesmärk on takistada rakenduse ja teegi varjatud korduskatseid ning säilitada teadmata olek.

Reserveeri embedding'u ja genereerimise eelarve enne saatmist püsivasse, samaaegsuskindlasse registrisse. Ühe piloodi kulu ei või lähtestuda raportikausta, uue protsessi, veebilehe reload'i või uue sessiooni tõttu. Taaskasuta olemasolevat kontrollitud legeri lahendust, kuid HTTP mitme päringu korral tõenda vajalik lukustus/transaktsioon. Uut arveldusplatvormi pole vaja.

Tavalise eduka vastuse siht on **0 või 1 uut embedding-katset + 1 genereerimiskatse**. Null embedding-katset on võimalik sobiva lubatud vahemälutabamuse korral. Kohalikud kontrollid ei lisa mudelikutseid. Kui kasutatakse OpenAI Node SDK-d, keela automaatkordused eksplitsiitselt (`maxRetries: 0`) ning määra piiratud timeout; kontrolli ka rakenduse wrapper'eid ja voogude taasühendamise loogikat.

Arvesta tegelik provider usage, sh valitud API/mudeli arveldatavad väljund- ja arutlustokenid. Näita rahaline hinnang kontrollitud hinnakonfiguratsioonist, mitte ära eelda M2 embedding'u hinnast piisavat Luna eelarvet. Teadmata usage ei ole nullkulu; säilita asjakohane reserveering kuni tulemuse selgumise või dokumenteeritud lepituseni.

Valideeritud vastus, sõnumi identiteet ja selle püsivad allikaseosed salvestatakse kooskõlaliselt enne eduka lõppoleku väljakuulutamist. Andmebaasi salvestusviga pärast provider'i vastust ei käivita uut genereerimist; kasuta turvalist olemasoleva tulemuse taastamist või nähtavat `needs_recovery` olekut. Vastust ei kirjutata teise kasutaja vestlusse.

## 8. Andmekaitse ja käituse ulatus

Pärispiloodi küsimused kasutavad väljamõeldud kasutajaolukordi või heaks kiidetud üldküsimusi. Pärisklientide juhtumikirjeldusi ega varasemate kasutajate vestlusi ei kasutata. Luba embedding'uks ei ole luba samade dokumentide saatmiseks genereerivale mudelile: M4 plaan hõlmab eraldi nii päringuteksti kui ka valitud allikakatkendeid.

Võtmed ja provider'i konfiguratsioon on ainult serveris. Provider'i vastuseid või keha sisaldavaid vealoge ei saadeta brauserisse. Üldlogides kasuta minimaalseid tunnuseid, olekukoode, ajamõõtmisi ja kasutusmahte; toorvestluse sisu ning täielik audit jäävad ainult põhjendatud, piiratud ja kaitstud pilooditõendisse. Tavaline SHA pole anonüümseks muutmine: madala entroopiaga teksti räsi võib olla äraarvatav.

Kui valitud API võimaldab, kasuta eksplitsiitset `store: false` seadistust ning halda vajalikku vestlusseisu oma serveris. See ei ole lubadus teenusepakkuja nullsäilitusest. Kirjelda valitud endpoint'i ja konto tegelikke säilitus-/logitingimusi ametliku dokumentatsiooni põhjal; ära väida ZDR-i või piirkondlikku töötlust ilma vastava kontrollita.

Enne pärissisepilooti peab olema minimaalne testandmete säilitamise/kustutamise leping: tähtajastatud diagnostika, vestluse kustutamisel uue lugemise ja väljasaatmise keeld, käimasoleva vastuse hilise taassalvestamise tõke ning teadaolevad koopiad/vahemälud. Kogu M6 varundus- ja kustutusplatvormi ei ehitata praegu, kuid piloot ei või säilitada sisu vaikimisi piiramatult ega raporteerida pooleli kustutust lõpetatuna. Allikakasutusloa tühistamise järel ei tagastata vastusest ega viitest keelatud sisu.

## 9. Päriskatse üks koondplaan

Valmista ette üks privaatne `m4-pilot-plan.json` (või olemasolev samaväärne leping), millele omanik saab anda ühe piiritletud kinnituse. See määrab:

| Osa | Nõutav sisu |
| --- | --- |
| Teostus | tegelik lähte-SHA/tööpuu seos, profiili- ja promptiversioon, skeem ning indeksipõlvkond |
| Teenus | täpne embedding- ja vastamismudeli-ID, endpoint, konto/projekti ulatus ilma võtmeta, toetatud parameetrid |
| Materjal | lubatud dokumendiversioonid, kasutusõigused, valitud egress-tekstide sidumine, testküsimused |
| Eelarve | maksimaalne katsete arv, sisend/väljund, kogutokenid, kogukulu, timeout, korduskatsete keeld |
| Ligipääs | lubatud katsetajad, keskkond, tähtajaline luba ja väljalülitamise viis |
| Andmete eluiga | oma serveri säilitus ja kustutus, provider'i teadaolevad andmekontrollid |

Lukustatud testküsimuste puhul saab väljasaatmise täpse sisu enne kutset räsiga siduda. Vaba interaktiivne katsetamine ei mahu sellesse loasse automaatselt. Kui seda soovitakse samas piloodis, peab koondluba **eraldi** lubama piiratud dünaamilisi küsimusi: samad katsetajad, sama lubatud korpus, kindel ajavahemik ning püsiv ühine kululagi; iga tegeliku kutse tekstiräsi ja kasutus registreeritakse. See väldib nii iga klahvivajutuse uut kinnitusringi kui ka piiramatu loa tekkimist.

Täpset rahalist piiri ei mõelda praegu välja, sest kinnitatud vastamiskonfiguratsioon puudub. Puuduv hind/mudel/luba peab päriskutse blokeerima. Kohaliku teostuse ja kuivjooksu saab lõpetada ilma nendeta. Ükski selle ülesande test ei tarbi omal algatusel varasema M2 piloodi allesjäänud eelarvet.

## 10. Hindamine: vastus on uus mõõdetav väljund

Kasuta olemasolevaid kinnitatud juhtumeid regressiooniks ja tuntud osatoe/puudumise käitumise kontrolliks. Säilita seitse lahtist hinnangut eraldi; neid ei kasutata peidetud võitude ega kaotustena.

Lisa väike uus küsimustekogum, soovituslikult 8–12 sisuliselt uut perekonda olemasoleva lubatud korpuse piires. Täpne arv seotakse piloodi kuluga, mitte kohustusliku suure testimahuga. Küsimused, vastuse nõuded ja profiil fikseeritakse enne pärismudeli tulemuste vaatamist; arenduses ja lõppkontrollis kasutatavad perekonnad eristatakse. Tõlked pole sõltumatud uued sisuprobleemid. Sama kaheksa dokumendi uued küsimused ei tõenda teise valdkonna ega kümneaastase kogu kvaliteeti.

Mõõda eraldi: otsingu tõendikatvus; vastuse oluliste väidete allikatugi; määravate tingimuste väljajätmine; kasutajale kasulik osavastus; põhjendamatu kindlus; tarbetu keeldumine/täpsustus; viidete sisuline tugi; ET/EN/RU; aja- ja kulunäitajad. Näita juhtumite nimetajaid, mitte üksikut üldprotsenti.

Eristus peab jääma selgeks:

- kontekst oli täielik, kuid vastaja jättis vajaliku asja välja või muutis tähendust;
- kontekst oli osaline ja vastaja andis kasuliku, piiratud vastuse;
- kontekst oli osaline, kuid vastaja täitis lünga mälu või oletusega;
- vajalik allikas oli korpuses, kuid ei jõudnud konteksti;
- vajalik allikas ei olnud lubatud korpuses;
- päring ebaõnnestus tehniliselt.

M4-s ei lisata automaatset teist hindavat keelemudelit. Sisuline hindamine jääb võrguväliseks arendus-/ülevaatustööks. Kui mudeli vastus osutub õigeks, kuid vajalik tugi polnud antud kontekstis, ei nimetata seda edukaks allikapõhiseks vastuseks.

## 11. Vastuvõtukontrollid

Kasuta olemasolevat testitaristut. Järgmised on nõuded, mitte ette kirjutatud testide arv ega juba läbinud testid.

| ID | Kontroll | Nõutav tulemus |
| --- | --- | --- |
| M4-01 | Lüliti väljas / anonüümne / mitte lubatud katsetaja | Pärisvastamist ei avata; väliskutseid 0. |
| M4-02 | Võõras tenant, vestlus, room, allikas või kliendi võltsitud `role` | Sisu ei loeta, avaldata ega saadeta provider'ile; olemasolev õige sessioon ei laienda ulatust. |
| M4-03 | Serveri ajalugu vs võltsitud kliendiajalugu | Kasutatakse ainult lubatud serveri ajalugu; eelmise assistendi tekst ei muutu allikatõendiks. |
| M4-04 | Uus lubatud päring ja sobiv vahemälutabamus | Uuele päringule maksimaalselt üks embedding-katse; sobivale tabamusele 0. Vale vektorruum tõrjutakse. |
| M4-05 | Tühi/ülepikk päring või ammendunud kvoot | Kontroll enne väliskutset; ei kärbita märkamatult, ei saadeta lisakatset. |
| M4-06 | Selgelt allikaga vastatav küsimus | Üks vastamiskatse, nähtav vastus ja avatav täpne allikakoht. |
| M4-07 | Osaline või kõrvaline allikatugi | Kasulik piiratud vastus või täpsustus; väljamõeldud hind, tähtaeg või nõue on sisuline viga. |
| M4-08 | Projektide eesmärk vs mõõdetud tulemus; artikli soovitus vs üldfakt | Vastaja säilitab allika väite liigi ja ulatuse. |
| M4-09 | Puuduv vald / sama teema jätk / uus subjekt / asjaolu parandus | Valda ega teise inimese andmeid ei eeldata. Ebaselguse korral täpsustus, mitte vaikne ülekandmine. |
| M4-10 | Vale viite-ID, võõra sõnumi `S1`, vale allikaversioon | Ei avaldata eksitavalt valideeritud viidet; ei asendata seda suvalise dokumendiga. |
| M4-11 | Õigus tühistatakse enne egress'i või avaldamist; hilisem viite avamine | Keelatud uus saatmine/lugemine peatub, ka salvestatud vastuse taastamisel. |
| M4-12 | Allikas, pealkiri või kasutaja sisaldab juhisesüsti/HTML-i | Ei käivitu käske ega tööriistu; HTML ei käivitu brauseris. Semantilise juhisesüsti mõju hinnatakse pärisvastaja katses. |
| M4-13 | Topeltklõps, paralleelsed sama võtmega päringud, reload | Üks töö ja maksimaalselt üks väliskatse igal lubatud etapil; sama võtme erinev sisu on konflikt. |
| M4-14 | Timeout, katkestus või protsessi restart pärast saatmist | Teadmata katset ei korrata automaatselt ega loeta nullkuluks. |
| M4-15 | Uus raportikaust, sessioon või protsess; samaaegsed päringud | Püsiv ühine kululagi säilib, reserveering ei ületa luba. |
| M4-16 | Vigane/poolik JSON, provider'i keeldumine, salvestusviga | Tehniline/sisutüüpide eristus säilib; ei teki varjatud parandavat mudelikutset ega võltsedukat lõppvastust. |
| M4-17 | Vestluse kustutamine vastamise ajal / lubamatu taastamine | Hiline vastus ei taasta kustutatud vestlust ega avalda keelatud sisu. |
| M4-18 | Päris brauseri sisepiloot testtranspordiga | Küsimus → kuvatav vastus → allikavaade → refresh-taastus; tegelik sessioonirada, mitte ainult helper'i mock. |
| M4-19 | Eelarve ja profiili jälg | Mõõdetakse tervet mudelisisendit, mitte ainult tõenditeksti; küsimuse embedding ja vastamine on eraldi kuluread. |
| M4-20 | Võtmed olemas, kuid tavakatse/loa puudumine | Tavakatsetes välismudelikutseid 0. Võtme olemasolu ei anna luba. |

Testtranspordi korral ei nimetata genereeritud fikseeritud vastuseid Luna kvaliteeditõendiks. Päris PostgreSQL/Qdranti integratsioonikatse on eraldi nimetatud; teenuse või sisendi puudumisel näita päriselt käivitamata kontrolli, mitte rohelist asendustulemust.

Käivita muudatuste sihttestid, asjakohane M1–M2 regressioon, lint, i18n ja tootmisbuild. Skeemimuudatuse korral kasuta projekti migratsioonimehhanismi ning kontrolli seda eraldatud arendusandmetega; ei suunata arenduse ühendusi tootmise andmebaasi. Brauserikontrollis ei tohi vajadus autentimise järele viia turvakontrolli ajutise väljalülitamiseni.

## 12. Väljund, peatumiskoht ja järgmised etapid

M4-A lõpuks peab lokaalselt töötama üks autentimisega kaitstud sisepiloodi vaade ning sama tuuma pärisadapter peab olema valmis lubatud kasutuseks. Kui olemasolev mudeliseadistus või konto ligipääs vajab omaniku täpsustust, esita konkreetne puuduv väli; ära peata kogu ülejäänud teostust.

Esita ühe raportina:

- tegelikud muudatused ja kohaliku tööpuu seos; eksplitsiitne profiil ning teadaolevad otsingupiirangud;
- päriselt käivitatud pass/fail/skip ning eraldi brauseri/integratsioonikontroll;
- üks terviknäide küsimusest vastuse, allikavaate ja taastatud vestluseni, selge test-/pärisrežiimi märgisega;
- turva-, õiguse-, kulu- ja katkestuskatsete tulemused ning lahendamata riskid;
- üks M4-B kuivjooksu/päriskatse plaan koos konkreetse vajaliku mudeli-, materjali- ja kulukinnitusega;
- uuendatud S1.0: mida saab nüüd kasutada, mida mitte, ja järgmine tööots.

M4-B lõpetatuks nimetamine nõuab tegelikke lubatud mudelikutseid, nende kasutusandmeid ning vastuste sisulist ülevaatust. Pelk API 200 või korrektne JSON pole selle vastuvõtt. Leitud sisuline viga ei õigusta automaatset avalikku avamist; piira lubatud piloodiulatus või paranda konkreetne vastamispuudujääk.

M3 jääb eraldi sisuliste tingimuste/erandite sõltuvuste tööks. Kaotatud kasulik naaber on tulevase seosevaliku katsejuhtum, mitte luba muuta hindamisankur käitusreegliks. Enne teenuseõiguste või laia praktilise nõustamise avamist tuleb vastav materjal ja sõltuvused hinnata. M5 ajaline süntees ning M6 koormus, taastamine ja tootestamine jäävad teekaardile.

Suure korpuse puhul tuleb vähendada päringuaegset kogu korpuse kordustöötlust. Esimese kaheksa dokumendi sisepiloodi ajal mõõda see kulu ja registreeri piirang; ära ühenda praegusesse töösse kogu otsingumootori skaleerimisrefaktorit, kui see sisepilooti tegelikult ei blokeeri.

**Selle ülesande alusel ei tehta automaatset push'i, deploy'd, avalikku chati avamist, uut tasulist katset ega õiguste laiendamist. Kohalik arendus ei pea nende lubade puudumise tõttu seisma jääma.**

## Allikad ja nende roll

**Projekti allikad.** Omaniku viimane M2.3 raport on selle töö algseisu alus. Varem esitatud M0 audit (`repository-audit.md`, ühenduskohad), RAG master, ADR-002, M0–M2.2 audit ja `CODEX_M2_3_KONTEKSTIVALIK_v0_1.md` annavad varasema arhitektuuri ja piirid. Nende vananenud „järgmine samm” ei asenda uut S1.0 kirjet. Viimase kohaliku M2.3 raporti kontroll jääb Codexile tegelikus tööpuus.

**API kontrolliallikad, vaadatud 06.09.2026.** Need toetavad allpool nimetatud tehnilisi piiranguid, mitte SotsiaalAI kvaliteediväiteid. Kontrolli kasutatava mudeli/SDK versiooni lepingut ka teostamisel.

1. OpenAI embedding-juhend: vektorruumi, sisendi ja mudelikonfiguratsiooni käsitlus. `https://developers.openai.com/api/docs/guides/embeddings`
2. OpenAI struktureeritud väljundi juhend: skeemipõhine väljund, toetamata juhud, keeldumised ning asjaolu, et korrektne skeem ei välista sisuvigu. `https://developers.openai.com/api/docs/guides/structured-outputs`
3. Ametlik OpenAI Node SDK: vaikimisi korduskatsed, `maxRetries`, timeout ja request-ID. Siinne no-retry nõue peab olema eksplitsiitne. `https://github.com/openai/openai-node`
4. OpenAI andmekontrollid: `store: false` ei võrdu automaatselt kõigi teenusepoolsete säilitusliikide puudumisega. `https://developers.openai.com/api/docs/guides/your-data`
5. API-de üleminekujuhend: vastusekuju, skeemiparameetrite erinevused ja eksplitsiitne salvestusseadistus. Ei ole nõue olemasolevat ühendust ümber kirjutada. `https://developers.openai.com/api/docs/guides/migrate-to-responses`

Käesoleva dokumendi sisepiloodi ulatus, piiratud mälukäsitlus, avaldamise töövoog ja vastuvõtukatsed on arendusettepanek. Nende toimivus tuleb teostuses kontrollida.
