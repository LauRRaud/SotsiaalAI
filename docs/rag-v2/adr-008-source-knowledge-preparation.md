# ADR-008: allikapõhise teadmismustandi koostamine halduses

07.09.2026. M3 teadmiste ettevalmistuse leping; projekti aktiivne seis asub SotsiaalAI.md S1.0/S2-s.

## Käitumine

Haldaja saab vastuvõetud dokumendi tekstist koostada väidete ja seoste mustandi. Enne käivitamist näeb ta mudelit ning ühe päringu kulupiiri. Mustand kuvab väited, seoste suuna, JA/VÕI-rühmad, täpsed PDF-tsitaadid ja teadmata sõltuvused. Haldaja saab ebasobivad väited/seosed välja jätta; eemaldatud väite kaudu kulgevaid sõltuvusi valikusse ei jäeta.

Valiku salvestamine loob sama PDF-i ja täiendatud metaandmetega uue muutumatu dokumendiversiooni. Algne PDF, metadata ja töö jäävad alles. Indeksi avaldamine on jätkuvalt olemasolev eraldi toiming koos uue plaani ülevaatamisega. Salvestamine ega avaldamine ei muuda kandidaate sisuliselt kinnitatud teadmisteks: seis on `source_anchored_unreviewed`.

See on üldine allika ettevalmistuse rada. Päringus puuduvad artiklinimed, valdkonna märksõnadel põhinevad erandid ja ette kirjutatud vastused. SotsiaalAI kasutab seda olemasoleva haldusvaate kaudu.

## Allikas, mudelisisend ja väljund

`knowledgePreparationPlan()` kontrollib lubatud dokumendi muutumatut bundle'it ja koostab mudelisisendi ainult kanoonilistest algtekstispannidest. Metadata kirjeldusi ega tuletatud otsingupealkirju mudelisisendiks ei lisata. Pikad spannid jagatakse kuni 3500 UTF-16 ühiku fragmentideks, säilitades Unicode'i märgid. Mudel näeb fragmendi tunnust `T1…`, PDF-lehekülge ja teksti; täpse algusnihke arvutab server.

Responses API päring kasutab serveris määratud mudelit, projekti, arutlustaset, timeout'i ja väljundipiiri, `store:false` ning ranget JSON-skeemi. See kasutab olemasolevat teenusepakkuja adapterit; mudel peab toetama selle struktureeritud vastuse lepingut. Tööriistu ega automaatseid korduspäringuid ei lisata. Kinnine allikatekst jääb andmeteks, mille sees olevad korraldused ei ole mudeli tööjuhis.

Väljundis on:

- `cards`: allikasse ankurdatud väited, tingimused, erandid ja määratlused; osapoolte kolmik on terviklik või puudub;
- `dependencies`: sama vastuse kaartide vahelised tüübistatud, suunaga seosed ja JA/VÕI-rühmad;
- `unresolved`: allikas mainitud sõltuvused, mille sisu pole antud dokumendist tuvastatav. `from` seob lünga asjakohase kaardiga või on `null`.

Iga elemendi tsitaat peab leiduma täpselt ja üheselt nimetatud fragmendis. Server lahendab tsitaadi PDF-lehe algteksti nihkeks ja rakendab sama ankru/päritolu kontrolli nagu käsitsi imporditud teadmistele. Väljamõeldud fragment, välise kaardi ID, tundmatu väli või kontrolliseisu lisamine lükatakse tagasi. Mudeli genereeritud seoste sisulist õigsust see tehniline kontroll ei tõenda.

Koostamine on selles plokis dokumendisisene. Välist tingimust ei seota nime sarnasuse järgi suvalise teise dokumendiga. Selline puudujääk säilib lüngana; dokumentidevaheline kandidaatide sobitamine ja sisuline kinnitamine on edasine M3 töö. Liiga suur dokument peatub enne väliskutset ega anna kärbitud teksti põhjal näiliselt terviklikku mustandit. Mitme osana jätkatav koostamine jääb suure korpuse tööplokki.

## Kulud, korduv klõps ja katkestus

Koostamine on valikuline ja ilma `knowledgePreparation` serveriseadistuseta välja lülitatud. Olemasolev PDF-i töötlemine ja embedding'ute avaldamisrada töötavad edasi ilma uute mudelikutseteta.

Valikuline adminiseadistus sisaldab järgmisi välju:

| Väli | Leping |
| --- | --- |
| `enabled` | `true`; välja puudumine tähendab väljalülitatud funktsiooni. |
| `model`, `accountProject`, `reasoning` | Mudel, serveri projekt ning `low/medium/high`; brauser neid ei määra. |
| `timeoutMs`, `maxOutputTokens` | 5000–120000 ms ja 256–16000 väljunditokenit. |
| `maxDocumentInputTokens` | Ühe dokumendi konservatiivse sisendreservi piir, 1024–200000. |
| `maxApiAttempts`, `maxInputTokens`, `maxSpendUsd` | Selle adminiseadistuse ühised katsete, sisendreservi ja USD kulupiirid. |
| `prices.input`, `prices.output` | Seadistaja kontrollitud positiivne täisarv nano-USD/token; näidishinda runtime ei eelda. |

Mudelipäring ja manifest seotakse tenant'i, dokumendi, versiooni, PDF-räsi, seadistuse ja keha räsiga. Sisendreserv on serialiseeritud keha UTF-8 baidimaht koos protokollivaruga; väljundireserv on lubatud maksimum. Haldaja käivitab ainult seda sama nähtavat plaani.

Enne väliskutset salvestatakse ühise kirjutusluku all privaatne kulureserveering ja `sent_unknown` seis. Katse tunnus seob plaani, töö ja haldaja. Sama klõpsu kordamine ei saada uut päringut. Ka ebaõnnestunud või teadmata tulemusega katse reserveering säilib; väiksem tegelik kasutus ei vabasta automaatselt uut katset.

Provider'i vastus salvestatakse enne selle teisendamist mustandiks. Kui protsess katkeb pärast vastuse faili kirjutamist, saab järgmine lugemine või sama toiming vastuse kohalikult taastada. Salvestamata/teadmata vastust ei küsita automaatselt uuesti. Vigane päritolu, mudelikasutus või räsikontroll ei käivita uut väliskutset.

Kululeger ja vastuse fail asuvad olemasolevas privaatses vastuvõtu tööjuures. Sama adminiseadistuse sõrmejälg seob need kehtiva mudeli ja piiridega; muudetud seadistusega ei jätkata vaikselt vana kululegerit. Uue kinnitatud seadistuse jaoks kasutatakse uut töö-ID-d.

## Õigused ja salvestamine

Kõik toimingud kasutavad olemasolevat administraatori serverisessiooni, sama päritolu kontrolli, nimelist kasutajaloendit, dokumendiluba ning privaatseid serveri failiteid. Brauser saadab töö/plaani või mustandi räsi ja kaartide/seoste võtmete valiku. JSON-keha ülempiir on 64 KiB; tundmatud väljad tõrjutakse.

Enne koostamist, enne väliskutset ja enne tulemuse tagastamist loetakse õigused ning allikaversioon uuesti. Teise haldaja töö ei anna sellele kasutajale lugemis- ega koostamisõigust. Vahepeal asendatud dokumendiversioon peatab vana mustandi rakendamise. Uue versiooni avaldamise eel kontrollitakse veel kord algversiooni; olemasolev ingesti kirjutuslukk säilitab aktiivse registri terviklikkuse.

Valiku kinnitamine on haldaja kontrollitud salvestustoiming. See ei lisa metadata kaudu võltsitavat „sisuliselt kinnitatud” seisundit ega käivita kasutaja õigustatuse reeglimootorit.

## Lahendamata sõltuvuse säilimine otsingus

`knowledge-input-1` saab tagasiühilduva valikulise `gaps` loendi: `{key, from, statement, reason, anchors}`. Kui väli puudub, jäävad senised bundle'id ja versiooniidentiteedid samaks. Välja varasemad tundmatud sisendid ei olnud lubatud.

Gapi algtekst, tenant, versioon, päritolu ja võimalik lähtekaart säilitatakse `knowledge_gaps` objektides. PostgreSQL-i olemasolev objektitabel talletab need liigina `knowledge_gap`; uut SQL-skeemi ega migratsiooni pole. Bundle'i ja indeksiobjektide vastavuskontroll hõlmab ka lünki.

Sõltuvusotsing kaasab leitud/läbitud kaardiga seotud lünga; sidumata lünk on asjakohane ainult siis, kui selle ankur kattub põhileiu tekstispannidega. Läbimise ja konteksti piirid kehtivad ka lünkadele. Mudelikontekst jääb `incomplete`: kui algtekst mahub kaasa, sisaldab märge `S` viiteid ja kontrollimata lünga kirjeldust; kui ei mahu, säilib üldine puudulikkuse põhjus. Pärast õiguste uut kontrolli puudub lubamata allika tekst ka lünkade väljundist.

Vastusejuhise versioon 8 käsitleb lüngakirjeldusi sama kontrollimata otsinguabina nagu väiteid ja seoseid. Varasemate salvestatud vastuste lugemist toetavad varasemad juhiseversioonid edasi.

## Tõendamise piir

Arenduse seitse sihttesti kontrollivad tegelikku ingesti, dokumendiversioone, mustandi koostamise teenuserada ja privaatset püsistust koos asendatud mudelitranspordiga. Kaetud on allikapõhine päring, täpsed ankrud, võltsitud väljad, korduv klõps ja taastamine, valiku uus versioon/lukk, kulupiir, provider'i viga, allikamuutus ja jooksvalt tühistatud ligipääs. Võrk on keelatud. Lisaks läbivad senise vastuvõtu 10 testi ning teadmiskihi 7 testi, sh lünga päris otsingutuuma kaudu kaasamine, eelarve ja õiguse eemaldamine.

Muudetud JS/JSX failide ESLint, sõnumikataloogide `i18n:check`, uue vaate ET/EN/RU võtmete võrdlus ning `git diff --check`: PASS. Piloodi konfiguratsioonilüliti kitsas regressioonitest: PASS. `TZ=UTC npm run build`: PASS, logi `tmp/rag-v2-knowledge-preparation-build-20260907.log`. Päris mudel, PostgreSQL/Qdrant ja brauseri tervikahel: `not_run`. Mudelitranspordi asendajaga sihttest ei tõenda semantilist kvaliteeti ega päris teenuse käitumist.

Päriskontroll kasutab üht lubatud dokumenti: vastu võtta → koostada üks piiratud mustand → vaadata allikakohad üle ja jätta vajadusel valikust välja → salvestada uus versioon → avaldada olemasolevaid vektoreid taaskasutades → kontrollida indeksiobjekte ja sõltuvuskonteksti → värskendada brauserit. Võrreldakse tegelikku katsete arvu ja kulureserveeringut. Iseseisvat vastuste hindamisringi selleks ei lisata.

07.09 juurutati kood `7a22ce66dcfe61b1607a03e1c5f099b190ec7b64`. Serveri tootmisbuild läbis, teenus oli pärast käivitust `active` ja `/vestlus` andis HTTP 200. Kohalik `main`, `origin/main` ja serveri HEAD vastasid sellele commit'ile; serveri tööpuu oli puhas. See tõendab juurutust ja käivitumist, mitte uue koostamisahela toimimist.

Rakendusesisese brauseri `/admin/rag/ingest` näitas esmalt `rag_v2_admin_disabled`: varasema katse järel oli serveri vastuvõtulüliti suletud. Taas avati olemasolev nimeliste kasutajate ja kaheksa dokumendiga `admin-intake-server-20260907-1` seadistus, embedding'u piiriga 0 päringut / 0 USD. Teenuse taaskäivituse ja brauseri värskenduse järel kadus viga ning PDF-i ja metaandmete väljad muutusid kasutatavaks; nähtav reserveering oli 0 USD. Seadistus aegub `2026-09-08T00:00:00Z` (03.00 Eesti aja järgi). Mudeliga teadmiste koostamine selles seadistuses puudub.

Ühe dokumendi päriskontrolliks valmistati ette teenuses aktiveerimata `knowledge-acceptance-20260907-1` seadistus. Allikas on lubatud dokumendi `document_20434601b6503c449b28a5efc21b9355bc81b3c4a0af55ef5f7a057af2fff3d1` versioon `version_12ba5d1d7f9f90bf8deef75e1b56992473651506116451e40618dcde00498776`: 3 PDF-lehekülge, 59 algtekstifragmenti. Plaan `07fb868c89bbebf31e26ab78da364349a8268d4d69ee4f33494e17e602b6b4ca` kasutab `gpt-5.6-luna`, arutlustaset `low`, üht katset, 11074 sisendireservi ja 6000 väljunditokenit; arvutatud maksimumkulu on 0,009968500 USD ning seadistuse kogulagi 0,02 USD. Embedding'u katseid ei lubata. Mudelikutseid ei tehtud; koostamise, valiku salvestamise ja uute teadmiste päris indeksi/UI vastuvõtt jääb `not_run`.

## Ühe dokumendi päriskontroll 07.09

Omanik andis loa ühele kuni 0,02 USD koostamispäringule, kordusteta. Aktiveeriti eespool ette valmistatud seadistus. Rakendusesiseses brauseris laaditi olemasolev avalik PDF koos metaandmetega üles ja käivitati koostamine üks kord. Vastuvõtu kanoonilised metaandmed andsid lähteversiooni `version_8bbd26bd84a1125e58e1e714122a2aa8fc34dd9027c28dffe71364be097242af`; tegelik plaan oli `701eaee09bfd1056d1db3f17913a36e0b8199845c58f93dc43c7231732c766c4`. PDF ja päringu maht jäid eelvaatega samaks.

Luna vastus saabus umbes 17,75 sekundiga: 13 väidet, kaks seost, null lahendamata sõltuvust. Kõik kuvati koos PDF-lehekülgede ja täpsete tsitaatidega. Brauseri värskendus taastas sama mustandi; püsivas kululegeris oli endiselt üks katse. Läbivaatuses eemaldati üks `REQUIRES` kandidaat, sest „spetsialist ei tohiks üksi jääda” põhjendas arutamise üleskutset, mitte ei kehtestanud selle eeltingimust. See näitab läbivaatuse vajalikkust; allikatsitaadi tehniline vastavus ei kinnita seosetüübi õigsust.

Brauseris salvestati 13 väidet ja üks `QUALIFIES` seos uue versioonina `version_e7a5cd4c960f653f6bedea67cb1ff02a0c8bd7cda1bea644f943c4585bfb108d`, töö `job_28632519f6b8a90d91fffa8ab663184e993468330b4003134f2ac115687219b3`. PDF-räsi säilis: `9bc020d12902f958b9084882af5bd224a3c38f14c1ff3be45c92115385c124de`. Avaldamine lõppes brauseris kinnitusega ning aktiveeris indeksi `search_generation_cce615aba3a9fa3e5a6a0ab573dc655e660fcdb33eabc7918a18e6c6093ed4af`.

Serveri päris PostgreSQL-i bundle'i/objektide terviklikkuskontroll läbis: 8 dokumenti, 69 indeksiüksust, uues versioonis 13 teadmistekaarti ja üks sõltuvus. Qdrantis oli samuti 69 punkti. Avaldamine taaskasutas 68 erineva sisendi vektoreid ning tegi null välist embedding'u päringut; ülejäänud seitsme dokumendi versioonid säilisid. Olemasoleva `retrieve()` leksikaalne päring „tundlike isikuandmete” andis `ok`: kaks tõendiosa ning mudelikontekstis 13 kaarti ja `QUALIFIES` seose õige suund `K11 → K8`, seotud `S1` allikaga. Kontekst oli 4847 tokenit, hoiatusi ei olnud ning rakenduvus jäi `unknown`. Selles kontrollis ei tehtud hübriid-/vektoripäringu mudelikutset ega genereeritud vestlusvastust. Lahendamata sõltuvuste pärisandmete rada ei olnud selle null-lüngaga dokumendiga kaetud.

Koostamise kasutus oli 2457 sisendi- ja 2571 väljunditokenit; seadistatud konservatiivsete tariifidega arvestus on 0,003699450 USD, püsiv reserveering 0,009968500 USD. See on kasutuspõhine arvestus ja reserv, mitte teenusepakkuja arve. Katsete arv jäi 1/1 ning uusi koostamiskutseid see seadistus ei luba. Adminivaade jääb sama piiratud seadistusega avatuks kuni `2026-09-08T00:00:00Z`, et avaldatud tööd saaks vaadata; embedding'u piir on endiselt 0 USD. Eelnev `not_run` märge kirjeldab juurutuseelset tõendipiiri, mitte selle kontrolli tulemust.

Pärisvaates ilmnes kuvaviga: „Kogukulu ülempiir” hõlmas ainult embedding'u osa. Haldusvaade näitab nüüd vektorite ja teadmiste koostamise kulupiire/reserveeringuid eraldi. Kahe muudetud komponendi-/koopiafaili ESLint, ET/EN/RU koostamisvõtmete kooskõla, `i18n:check`, `git diff --check` ning selle lõpliku koodipuu `TZ=UTC npm run build` läbisid (logi `tmp/rag-v2-knowledge-budget-build-20260907.log`). Ekslik katse käivitada võtmekontrolli nimega failitesti ei valinud ühtegi testi; kontroll tehti seejärel otse koopiaobjektide vastu. Teenuse sihtteste ega mudelipäringut selle kuvaparanduse jaoks ei korratud.
