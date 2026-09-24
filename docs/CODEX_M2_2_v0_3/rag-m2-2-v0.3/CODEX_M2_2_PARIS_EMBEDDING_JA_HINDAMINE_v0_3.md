# Codexi jätkuülesanne: M2.2 — pärisembedding'u adapter ja piiratud otsingukatse

Versioon 0.3 · 05.09.2026 · SotsiaalAI / eraldatav RAG v2

## 1. Eesmärk ja töö alustamise alus

Jätka olemasolevat M0–M2.1 teostust. Ära ehita uut paralleelset RAG-i. M2.2 eesmärk on ühendada `text-embedding-3-large` senise PostgreSQL + Qdrant otsinguga ning mõõta ühe lubatud artikli peal pärisvektorite mõju allikakohtade leidmisele. Luna, HTTP-chat, AI-agendid, semantiline sõltuvusgraaf ja kümne aasta korpus ei kuulu sellesse plokki.

Kasutaja raporteeritud lähtepunkt: `main`, commit `2577100af`, M1 22/0/0, otsingu ühiktestid 7/0/0 ning päristeenuste integratsioon 11/0/0. `verification.json` sisaldab neid testiarve, kuid mitte commit'i SHA-d ega täielikke käsuloge. Selle ülesande koostaja kontrollis esitatud dokumente, JSON-väljundeid ja sisendfailide räside vastavust, mitte repositooriumi lähtekoodi ega testide täitmist. Codex kontrollib tegeliku tööpuu, `AGENTS.md`, aktiivse S1.0, RAG masteri ning ADR-001/002 ise. Ajalooline SHA ei ole korraldus uuemat tööd tagasi kerida.

**Käesolev ülesanne lubab tehnilist ettevalmistust kirjeldada, kuid ei anna omaniku eest materjalide väljasaatmise ega raha kulutamise kinnitust.** Koodi, testid ja proovikäivituse ettevalmistuse saab valmis teha null välismudelikutsega. Tegelik katse käivitub alles allpool kirjeldatud eraldi loa olemasolul. Ära jaga seda tööd uuteks kohustuslikeks M2.1 alamprojektideks.

## 2. Säilitatavad otsused

Säilita Node/JavaScript ESM, olemasolev paketihaldus, PostgreSQL-i `simple` leksikaalne kanal, rakenduse rank-põhine RRF ja Qdrant. Ära lisa BM25 teenust, lemmatiseerimisteenust, ümberjärjestavat mudelit ega muud RAG-raamistikku pelgalt selle proovikatse jaoks.

Säilita muutmatud M1 originaalid, allikakohad, versioonid, tenant'i eraldatus, kehtiv poliitikakontroll ja indeksi kooskõlaline avaldamine. `local-mock / mock-sha256-v1` jääb automaattestide adapteriks. Päris- ja testvektorid ei tohi sattuda samasse vektorruumi ega sama konfiguratsioonina vahemällu. Mõõtmete võrdsus üksi ei tõenda ühist vektorruumi.

Kasutatakse olemasolevaid eraldatud kohalikke arendusteenuseid. Ära suuna arenduse migratsioone platvormi ega tootmise andmebaasi. Ära ava HTTP-otsingut, allikafaile ega `retired` chat-rada. Ära tee push'i, deploy'd ega tervikkorpuse indekseerimist. Ära muuda kasutaja kõrvalisi töid.

## 3. M2.1 väljundist leitud kontrollikohad

### 3.1. Auditipakett ja tulevase vastaja sisend peavad olema eraldi esitused

Esitatud `evidence.json` sisaldab kolme tõendikirjet. Esimeses on 33 ja teises 13 SourceSpan ID-d; kolmanda `source_text` on ainult `Sotsiaaltöö`. Iga kirje kordab pikka kontrollimata `legacy_description` välja. Mõõtmistes on `context_tokens=5614` ning hoiatus `context_budget_limited`. ADR-002 kohaselt arvestab praegune eelarve kogu `evidence` JSON-i, kaasa arvatud otsinguabid ja viitetunnused. Tokeniarvu siin sõltumatult uuesti ei mõõdetud.

See käitumine täidab varasema M2.1 ülesande auditinõuet; seda ei käsitleta Codexi põhjendamatu veana. Täpsustame nüüd vastamisele mõeldud esituse nõuet.

Säilita täielik `EvidenceBundle` privaatse auditina. Lisa sellest deterministlikult koostatav kompaktne `ModelContext` või samatähenduslik DTO. See ei tee mudelikutset ega sisulist kokkuvõtet. Iga kontekstielement sisaldab lühikest päringupõhist viitetunnust, muutmata valitud allikateksti, vajalikku bibliograafiat/lehti ning tähendust mõjutavaid kasutuspiiranguid. Dokumenditaseme korduv info võib paikneda ühes ühises allikatabelis.

Täielikud räsid, span-loendid, vektorirangid ja tehniline diagnostika jäävad lokaalsesse viitekaarti ja auditisse. Kaardistus peab säilitama tenant'i, päringu, indeksipõlvkonna, dokumendiversiooni ja SourceSpan-id. Lühike `S1` ei ole globaalne ega päringute vahel taaskasutatav identiteet. Hilisem viite avamine peab jätkuvalt kontrollima õigusi.

Kontrollimata `legacy_description` ei lähe vaikimisi mudelile tõendusmaterjalina, ka mitte nime `search_aid` all. Selle säilitamine otsinguks ja auditiks on lubatud. Pealkiri, autor, kehtivus, allika liik ning asjakohased kvaliteedihoiatused ei kao kompaktseks tegemisel. Ära anna algallika käske süsteemijuhistena edasi; kogu allikatekst jääb andmeteks.

Mõõda eraldi `audit_tokens`, `model_context_tokens`, `source_text_tokens` ja konteksti viite-/päiseosa. Tokenid arvutatakse versioonitud tegeliku serialiseerija väljundist. Osatokenite summa ei pruugi tokeniseerimise piiriefektide tõttu võrduda tervikuga; eelarve jõustatakse terviku tegelikul loendusel. Kuna Luna mudeliadapterit pole veel kontrollitud, on see M2-s deklareeritud kohaliku tokeniseerija mõõdik, mitte tõend Luna tulevasest arveldatud tokeniarvust. M4 loendab kogu tegeliku prompt'i valitud vastaja jaoks uuesti.

Valikueelarve rakendub uues võrreldavas rajastuses kompaktsele sisendile, mitte auditfaili suurusele. Säilita vana raja tulemus võrdluseks. Ära suurenda eelarvet lihtsalt selleks, et senine hoiatus kaoks, ega kärbi tingimusi või algteksti vaikimisi. Erista `document_cap`, `context_budget`, `seed_limit` ja muu väljalangemise põhjus.

### 3.2. Ainult päisest koosnev üksus pole iseseisev sisuline tõend

Kontrolli M1 struktuuri ja PDF-paigutuse põhjal, miks `Sotsiaaltöö` moodustab eraldi indeksiüksuse. Hoia see algallika ja päritolu registris alles. Ainult väljaandenimi, logo alternatiivtekst või dekoratiivne päis ei tohiks täita praktilise sisuküsimuse tõendikohta. See võib olla dokumendi leidmise abiväli.

Parandus olgu piiratud ja üldistatav: kasuta struktuurset rolli, mitte üht kõvakodeeritud sõna, PDF-räsi või pelgalt miinimumpikkust. Lühike telefoninumber, summa, tähtaeg või tähenduslik keeld võib olla vajalik sisu. Struktuursete ja sisuliste lühitekstide testid peavad olema eraldi.

Esimese pärisvektorite baasjooksu jaoks võib säilitada kõik 16 olemasolevat embedding-sisendit. Sama vektorikogumi peal saab võrrelda struktuursete üksuste kaasamist ja välistamist ilma teksti uuesti embed'imata. Sel juhul rakendub struktuurne sobivus sama reegliga kõigis kanalites ja valikus. Dokumenteeri rolli tuletamise konfiguratsioon ning võrdluse täpne kandidaatide ulatus.

Mock-vektorite kaudu nõrga lõigu leidmist ei tohi tõlgendada `text-embedding-3-large` veana. Eraldi hindame seda, kas tehniline valik lubab mõttetu üksuse konteksti.

### 3.3. Top-k ja graafilaienduse võrdlus ei tohi olla seadistusega ette määratud

ADR-002 vaikepiir on kuni kolm üksust ühest dokumendist. Korpuses on praegu üks dokument. Kui kolm seemet täidavad piiri, pole samast dokumendist struktuurseks laiendamiseks enam ruumi. Top-5 toorjärjestus ja kuni kolme kirje lõppkontekst on eri mõõdikud.

Hoia tooteks kavandatud vaikepiir eraldi katsekonfiguratsioonist. Põhivõrdluses kasuta sama 6000-tokenilist kompaktse konteksti eelarvet ja sama maksimaalset lõppüksuste arvu. Mõõda top-1/3/5 eraldi kanali- ja liitjärjestusest enne lõppkonteksti piiramist. Näita alati tegelik tagastatud arv.

Struktuuri ablatsooniks võib kasutada ette fikseeritud kuni viie üksusega katserada: hybrid-off kuni viis järjestatud seemet; hybrid-on kuni kolm seemet ja kuni kaks struktuurset lisandit; mõlemal ühe dokumendi piir vähemalt viis ning sama lõpparvu- ja tokenieelarve. See on võrreldav valikupoliitika katse, mitte väide, et viie ja kolme seemne järjestus ise on identne. Raporteeri, kas laiendusel üldse oli sobiv serv, vaba koht ja kasutamata eelarve. Kui ei olnud, märgi mõju `not_exercised`, mitte graafi ebaõnnestumiseks või eduks.

## 4. Esimese päriskatse täpne ulatus

Lähteplaan on kasutaja esitatud `m2-2-plan.json`:

| Parameeter | Lähteplaani väärtus |
| --- | --- |
| Plaan | `pilot_plan_d1099e3796e88e9cbec22ae3f61e75e17cd3270106def0e4f0b8d0ae4b35afc8` |
| Provider ja mudel | OpenAI / `text-embedding-3-large` |
| Mõõtmed ja kaugus | 3072 / Cosine |
| Dokumendisisendid | 16; plaanis kokku 12 203 tokenit |
| Päringusisendid | 9; plaanis kokku 217 tokenit |
| Kogu sisend | 12 420 tokenit |
| Taotlusi | Kuni 25; üks sisend korraga, üks katse, automaatseid kordusi pole |
| Genereerivad kutsed | 0 |
| Luba praegu | `material_egress_approved=false`, `spend_cap_approved=false` |

PDF-i SHA-256: `a41995721ca13aa78898116ccef466aedf3576e26bb30fce3c145f4d8b87828b`.
Metaandmete SHA-256: `d090594afae2c24541ab71ed63a86d013c999ab519606597d145395023eccd5a`.

Välisele teenusele saadetakse ainult lubatud embedding-sisend: artikli otsingutekst koos olemasoleva pealkirja/peatükiprefiksiga ning üheksa plaanis nimetatud testküsimust. Seal ei saadeta PDF-binaari, kogu JSON-metaandmestikku, auditipaketti, arvuti failiteid, kasutajate vestlusi ega muid materjale. Ära laadi faile OpenAI Files/Vector Stores teenusesse; otsing ja vektorite püsisalvestus jäävad lokaalseks.

Lähteplaani küsimused ja sisendkoostamine jäävad esimese baaskatse jaoks samaks. Edasiarendused, mis muudavad ainult kohalikku järjestust või kompaktset konteksti, ei vaja sama teksti korduvat API-töötlust. Kõik katseseadistused ja nende versioonid tuleb siiski raportis eristada.

Kui muutub väljasaadetav tekst, mudel, mõõtmed, endpoint, lubatud materjalide hulk või katsete ülempiir, loo uus plaan ja selge erinevuste aruanne. Väiksem prognoositud hind ei anna õigust uut sisu vana loa alusel saata. Pelgalt hinnainfo lisamine plaani ei ole andmeloa kinnitus. Ära nõua muutmata loaulatuses iga lokaalse võrdluse jaoks uut kasutajakinnitust.

## 5. Luba ja kulukontroll

Lisa lihtne, range skeemiga lokaalne käivitusluba. See seob loa konkreetse väljasaatmismanifesti, dokumendi-/sisendiräside, tenant'i, providri, endpoint'i, mudeli ja rahalise ülempiiriga. Kinnituse aeg ja omaniku antud loa alus peavad olema jälgitavad. Kaasas olev `approval.template.json` on tahtlikult kinnitamata näidis; Codex ei tohi selle kinnitusi ise tõeks muuta.

Vaikimisi käsk teeb ainult dry-run'i. Võtme olemasolu, M1 kasutuspiir või kohalik `FilePolicy` ei asenda väljasaatmisluba. Päriskutse nõuab nii eraldi execute-valikut kui ka kehtivat luba. Kontrolli enne saatmist praegust õigust ning täpse sisendi räsi. Ära küsi API-võtit vestlusse; kasuta arenduskeskkonna turvalist konfiguratsiooni.

Hind: 05.09.2026 kontrollitud OpenAI mudelileht näitab standardse `text-embedding-3-large` hinnaks 0,13 USD miljoni sisendtokeni kohta [O1]. Lähteplaani aritmeetiline hinnang on `12420 / 1000000 * 0.13 = 0.0016146 USD`. See pole maksetõend, konto lõpparve ega kinnitus maksude, valuutavahetuse ja taristu kulude kohta. Pakutud, veel kinnitamata kululagi on **0,05 USD** selle ühe manifesti käivitamiseks. Püsima jäävad ka kuni 25 taotluse ja kuni 12 420 eelkontrollitud tokeni piirid; suurem rahaline varu ei laienda neid.

Kasuta muutumatut hinnakirje versiooni ning täpset kümnendarvutust või piisavalt väikest fikseeritud ühikut. Nii väike kulu ei tohi senti ümardamisel muutuda valeks nulliks. Hinna puudumisel ei käivitu katse. Käivitamise ajal kontrolli, et arvestuse aluseks olev hinnainfo on endiselt asjakohane.

Arvesta katse ja selle jätkamiste peale ühist loendurit, mitte iga protsessikäivituse kohta uut limiiti. Piisab väikesest lukustatud privaatsest kulupäevikust või olemasolevast andmebaasitabelist; ära ehita arveldusplatvormi. Enne väliskutset reserveeritakse katse, sisendtokenid ja prognoositud kulu. Korraga saadetakse üks sisend. Edukas vastus salvestatakse kohe tenant'i ja embedding-konfiguratsiooniga seotud vahemällu.

Timeout'i või ühenduse katkemise järel võib teenus olla päringu juba vastu võtnud. Tähista tulemus `unknown`; ära vabasta reserveeringut tõendita ega tee sama sisendi automaatset kordust. Säilita õnnestunud vektorid ja peata katse arusaadava seisuga. Uuesti käivitamine ei nulli loendureid ega saada teadmata tulemusega sisendit iseenesest uuesti. Manuaalne uus katse vajab vastavat uut luba.

API vastuse `usage.prompt_tokens`/`usage.total_tokens` ja mudelinimi salvestatakse koos lokaalse loenduse ning request-ID-ga, kui see on saadaval [O2]. Puuduvat kasutusinfot ei käsitleta nullkuluna. Ootamatu kasutusinfo või konfiguratsioonierinevus peatab järgnevad kutsed. Kohalik kulukontroll piirab meie väljasaatmist; see pole teenusepakkuja arve universaalne garantii.

## 6. Pärisembedding'u adapter ja võrgupiir

Kasuta projekti olemasolevat HTTP-klienti või SDK-d, ilma uut raamistikku lisamata. SDK kasutamisel lülita selle automaatsed korduskatsed eraldi välja. Esimese piloodi siht on omaniku kinnitatud HTTPS embedding-endpoint, kavandis `https://api.openai.com/v1/embeddings`; alternatiivne piirkondlik endpoint nõuab konto sobivuse ja loa kontrolli, mitte vaikset varurada. Ümbersuunamisi ega suvalist proxy/fallback-host'i ei lubata.

Taotlus määrab mudeli, 3072 mõõdet, tegeliku lubatud teksti ja toetatud väljundkodeeringu. Kohalik 8191-tokeniline konservatiivne sisendikontroll säilib; API dokumentatsioon kirjeldab 8192-tokenilist mudelipiiri [O2]. Väljundis kontrolli õiget elementide arvu/indexit, mudeli vastet, 3072 lõplikku arvulist komponenti ja nullvektori puudumist. Ära kirjuta vastust tõendamata kujul õigesse vektorruumi.

Hoia M2.1 automaattestide võrk jätkuvalt kinni. Testi adapterit süstitava HTTP-transporti asendusega: tegelikku avalikku API-t ei kutsuta tavalise `node --test`, lint'i ega build'i käigus. Päris OpenAI katse on eraldi selgelt lubatud piloot. Kohalikud PostgreSQL/Qdranti integratsioonitestid jäävad päristeenuste testideks.

Ebaõnnestunud välisindekseerimine ei tohi aktiveerida poolikut uut põlvkonda. Vana aktiivne põlvkond säilib. Võrdle kanalite tegelikku teenindatavust ning hoia testvektorid eraldi `mock` nimeruumis. Pärisvektori tõrge ei muutu näiliseks edukaks mock-tulemuseks.

## 7. Hindamine ilma Lunata

Esimene piloot kasutab samu üheksat küsimust, mitte mudeli loodud uusi küsimusi. Võrdle leksikaalset, pärisvektor-, hübriid- ja piiratud struktuurse laiendusega rada. Iga unikaalne küsimus embed'itakse kuni üks kord ning sama vektorit kasutatakse kõigis kohalikes võrdlustes. Leksikaalne baasrada ei vaja päringu embedding'ut. Ära tee üheksa päringu jaoks neli korda API-kutseid.

### Hindamisankrute kontroll

Kontrolli oodatud kohti algteksti põhjal enne pärisotsingu tulemuste vaatamist. Ära kasuta praegust top-tulemust õige vastuse definitsioonina. Lähteplaani kuus sisuküsimust on OTT-i ja dokumenteerimise kaks keeleperekonda ning viitavad samale PDF lk 3 tekstiosale; seitsmes on autoriküsimus. Kaks ülejäänut on selles korpuses vastuseta. See on väike ühendus- ja järjestuskontroll, mitte sõltumatu mitmedokumendilise kvaliteedi mõõtmine.

Üks märksõnaline ankur ei tõenda vajalikku täielikkust. Säilita olemasolevad ankrud ning täpsusta lokaalses hindamiskihis algtekstilt nõutavad lõigud: OTT-i piirangute jaoks ka motivatsiooni/tervise hindamise ning koormava tagasisidestamise tekst; dokumenteerimise jaoks mõju raamile ja professionaalsele hinnangule. Tõlgenda seda ainult artiklis öeldu leidmisena, mitte nimetatud süsteemide tegeliku praeguse toimimise välise kontrollina. Kogu artikli muutmata algtekst on aluseks.

Võimalda samaväärseid toetavaid allikakohti alternatiivsete ankrurühmadena. Hindamiseks vajalikest rühmadest peavad lõppkontekstis olema kaetud kõik nõutavad rühmad; ühes rühmas võib piisata ühest lubatud alternatiivist. Üksnes õige dokumendi või lehe leidmine ei võrdu väite toetamisega. Kui allikakoha ID on valitud tekstiosas, aga toetav tekst pole tegelikus kontekstis, ei loeta seda tabamuseks. Tokenikärpimist pole vaikimisi lubatud.

Autoriküsimuse puhul erista põhiteksti autoriankru leidmist ja päritoluga bibliograafilise välja kättesaamist. See on metadata lookup'i juhtum, mitte sama tüüpi semantilise otsingu tõend kui sisuküsimused. Ära tee järjestajat kunstlikult sobivaks ainult ühe dokumendi alati kaasas oleva autorivälja abil.

### Mõõdikud ja väljund

Salvesta iga küsimuse ja meetodi kohta järgmised andmed:

- õigusi läbinud kandidaatide toorjärjestus, top-1/3/5 ankrut tabav kirje ja esimese tabamuse koht;
- nõutavate ankrurühmade katvus ning kõigi rühmade kaetus tegelikus lõppkontekstis;
- lõppüksuste arv, struktuursete lisandite arv ja lisamata jätmise põhjused;
- algteksti, kompaktse konteksti ja auditiesituse tokenimahud; korduva sisu maht;
- täielik allikakoha vastendus ja konfiguratsioonide identiteet;
- tegelikud indekseerimis-, päringuembedding'u- ja kohaliku otsingu kestused ning vahemälu olek;
- päris API-katsed, õnnestumised, ebaõnnestumised/teadmata seisud, usage ja kuluarvestus.

Raporteeri ET/EN/RU read eraldi, kuid ära nimeta sama küsimuse tõlkeid sõltumatuteks olukordadeks. Ühe artikli põhjal ei esitata universaalset täpsusprotsenti ega hübriidotsingu võitu. Korduvad kohalikud jooksud sama päringuvektoriga mõõdavad kohalikku otsingut, mitte uut võrguembedding'u viivitust. Üks päring ja üheksa erinevat päringut pole tootmiskoormuse p95 tõend.

Kahel korpuses vastuseta päringul võib vektorotsing tagastada kandidaate. Nende tagastamine ei ole iseenesest testiviga. Hindamise märgend ütleb, et vajalik tõend puudub; otsingu olek `ok` ütleb ainult, et töö lõppes. Ära vii kuldvastuseid, küsimuse-ID-sid ega neid kahte lauset production-retriever'i reeglitesse. Üldist piisavuse/keeldumise tuvastajat selles etapis ei ehitata.

Esimese piloodi kvaliteedivärav on juhtumipõhine: vajalik toetav tekst peab hübriidrajas olema piiratud lõppkontekstis, autor peab lahenema päritoluga ning kõik ebaõnnestumised tuleb nähtavalt loetleda. Mõõdikud arvutatakse ka siis, kui tulemus on halb. Läbikukkunud sisuküsimus ei muutu adapteri testiveaks ega õigusta märgendite tagantjärele kohandamist. Leksikaalsest baasist kehvem hübriidne juhtum vajab põhjuse analüüsi, mitte võitja eeldamist.

## 8. Katse laiendamine ei ole praeguse jooksu varjatud osa

Pärast esimest pilooti on vaja teisi pärisartikleid, sarnase sõnastusega eksitavaid allikaid ning küsimusi kogu artikli eri osadest. Koosta nende jaoks järgmine väike plaan, kuid ära lisa uut materjali ega testi praegusele väljasaatmisele automaatselt.

Järgmiste võimalike küsimuste teemad samast artiklist on näiteks hooldustehnoloogiate piirid, ebavõrdsest andmetihedusest tulenev risk ning sisulise kaasamise käsitlus. Kontrolli algallikaid ja sobivaid ankruid enne kasutamist. Sünteetilised mehaanikadokumendid jäävad eraldi ega suurenda päriskorpuse kvaliteedinäitajat.

Kehtivuse `valid_at` filter nõuab praegu mõlemat teadaolevat piiri. Enne päris KOV-i reegleid tuleb eristada teadmata lõppu ja allikast kinnitatud avatud lõppu. See on M3/M5 andmelepinguküsimus, mitte põhjus praeguse artiklipiloodi laiendamiseks või teadmata kehtivuse automaatseks lubamiseks.

## 9. Vastuvõtukontrollid

Need on nõuded, mitte juba käivitatud testide loend. Kasuta olemasolevat testiraamistikku; ära optimeeri testide arvu.

| ID | Kontrollitav tulemus |
| --- | --- |
| E-01 | Olemasolevad M1/M2.1 regressioonid läbivad; muudatused ei ava chat'i ega tootmisradu. |
| E-02 | Puuduv/vale luba, pelk API-võti, vale sisendräsi või mudel põhjustab 0 väliskutset. |
| E-03 | Külma plaani arvutus taastoodab 16 + 9 sisendit ja 12 420 tokenit või väljastab täpse erinevuse, mitte vaikse laienduse. |
| E-04 | Tokeni-, katsete- ja rahapiir kontrollitakse enne igat päringut; protsessi kordus ei nulli limiite. |
| E-05 | Timeout ja katkestus säilitavad reserveeringu; automaatset või SDK varjatud kordust ei tehta. |
| E-06 | Pärisvastuse 3072 mõõtme, arvuliste väärtuste ja mudeli kontroll; vigane vastus ei aktiveeri indeksit. |
| E-07 | Mock/päris ja tenant'ide vektorruumid/vahemälud ei segune; osaline töö ei asenda vana aktiivset põlvkonda. |
| E-08 | Kompaktne kontekst säilitab teksti ja vajalikud piirangud; lühiviited lahenevad täielikult ja õiguste piires. |
| E-09 | Kontrollimata kirjeldus ja tehnilised span-loendid ei kulu mudelikontekstis korduvalt; audit säilib täielikult. |
| E-10 | Struktuurne päis ei täida sisutõendi kohta; lühike sisuline lause, number või kontakt ei kao pikkusfiltri tõttu. |
| E-11 | Top-k toorjärjestus, lõppkonteksti piirid ja graafi kasutamise võimalus on eristatavad; võrdsed eelarved dokumenteeritud. |
| E-12 | Hindamisankrud pärinevad allikast; küsimuse kuldmärgendi info ei liigu retriever'i otsustusloogikasse. |
| E-13 | Neli otsingumeetodit taaskasutavad samu päringuvektoreid; edukalt saadud 25 sisendit ei põhjusta rohkem kui 25 tasulist katset. |
| E-14 | Standardtestid ja build ei tee väliskutseid; päris OpenAI piloot on eraldi loa ja raportiga. |
| E-15 | Raport eristab testid, päris API käivituse, sisulised leiud, kulu ja NOT_PROVEN piirid. |

## 10. Lõppväljund ja peatumine

Uuenda olemasolevat README-d, asjakohast ADR-i ja üht aktiivset seisufaili. Koosta päris kontrollitud tööpuu SHA-ga `verification.json`; muutunud tööpuu korral märgi ka dirty-seis ja aruande aluseks olev diff. Ära väida, et pelk SHA auditeerib koodi.

Tehnilise ettevalmistuse väljund on adapter, loa-/kulukontroll, kompaktne kontekst, hindaja, nullkuluga kontrollitud kuivjooks ning võrdluse täpne käitusjuhis. Lisa üks kompaktse konteksti näidis ja vastav täielik audit.

Kui omaniku väljasaatmisluba puudub, lõppseis on `implementation_ready_pilot_not_authorized`. Ära esita pärisembedding'u kvaliteeti läbivana.

Kui luba on eraldi antud ja valideeritud, käivita üks plaanitud katse ning loo `pilot-results.json`, inimloetav `pilot-report.html` ja kasutuspäevik. Failinimed on soovituslikud; need peavad sobima projekti olemasoleva väljundikorraldusega. Esita iga küsimuse/meetodi tegelik tulemus, mitte ainult agregeeritud protsent. Ära lisa vaikset häälestus- ja uute väliskatsete tsüklit.

Salvestatud vektoritega saab teha kohalikke võrdlusi ilma uusi tekste välja saatmata. Eralda esmane lukustatud tulemus hilisematest häälestuskatsetest. Kõik ebaõnnestumised ja vahelejätmised peavad olema näha. M2.2 piloot ei võrdu kogu M2 tootmisvalmidusega.

Peatu enne M3 semantilisi reegleid, M4 Lunat/HTTP-chat'i, uut korpust, push'i ja tootmispaigaldust, kui omanik pole nende jaoks eraldi ülesannet andnud.

## 11. Allikad ja tähenduse piirid

Kasutaja esitatud esmased allikad: `README(1).md` (repositooriumis `docs/rag-v2/README.md`), `adr-001-local-ingestion(1).md`, `adr-002-local-hybrid-search.md`, `verification.json`, `evidence.json`, `evidence.html`, `m2-2-plan.json`, `tokenizer-examples.json`. Võrdlusalus on varasem `CODEX_M2_1_OTSING_v0_2.md`. Failinimede `(1)` on vestluse koopia nimetus, mitte korraldus samanimelist faili repositooriumis luua.

Teadmisallikas on kasutaja lisatud artikli PDF ja JSON; artikli väiteid ei ole selle tehnilise auditi käigus väliselt faktikontrollitud. Selle dokumendi tulevikunõuded on arendusettepanekud, mitte väited olemasoleva koodi käitumise kohta.

Ametlikud välisallikad, kontrollitud 05.09.2026:

```text
[O1] OpenAI text-embedding-3-large: hinnainfo.
https://developers.openai.com/api/docs/models/text-embedding-3-large

[O2] OpenAI Create embeddings: request, dimensions, sisendipiir, vastuse mudel ja usage.
https://developers.openai.com/api/reference/resources/embeddings/methods/create

[O3] OpenAI Data controls: teenuse andmekäsitluse tingimused.
https://developers.openai.com/api/docs/guides/your-data
```

Kohalik Qdrant ei tähenda, et välisele embedding-API-le saadetud tekst jääks ainult kohalikku serverisse. Materjaliloa kinnitamisel tuleb arvestada valitud teenuse ning konto tegelike andmetöötlustingimustega [O3]. See dokument ei anna õiguslikku hinnangut, materjalide kasutusluba ega garantiid andmete piirkondliku töötlemise kohta.
