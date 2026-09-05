# ADR-003: kompaktne kontekst ja piiratud pärisembedding'u piloot

Alus: M2.2 v0.3 lähtepakett ja omaniku selles vestluses antud luba. Töötame olemasoleva RAG v2 peal; see ADR kirjeldab lepingut, aktiivne seis jääb SotsiaalAI.md S1.0-sse. Omanik lubas ka GitHubi kaudu serveri uuendamise ning katse tegemise serveris olemasoleva API-seadistusega.

## Audit ja mudelikontekst

Täielik `EvidenceBundle` jääb privaatseks auditiks. `modelProjection()` koostab sama muutmata algteksti põhjal `ModelContext`-i: bibliograafia, allikaliik, autoriteediroll, ajad/kehtivus, asjakohased piirangud ning lühiviited `S1`, `S2` jne. Sama dokumendiversiooni bibliograafia on ühises allikatabelis ühe korra. `legacy_description`, pikad span-loendid, räsid ja järjestusskoorid mudelikonteksti ei kuulu. Imporditud kontrollimismärge on eristatav tegelikust kontrollist.

`reference_map` seob lühiviite päringu, tenant'i, põlvkonna, dokumendiversiooni ja täpsete SourceSpan ID-dega. Päring saab juhusliku unikaalse ID; sama millisekundi samasõnalised päringud ei jaga lühiviidete nimeruumi. Viite lahendamine nõuab sama päringu/tenant'i kontrolli ja praegust poliitikat. See ei ava HTTP-allikavaadet ega asenda M4 autentimise tööd.

`audit` eelarverada jääb võrdluseks alles; M2.2 valik kasutab `compact` rada. Versioonitud JSON-serialiseerija tokenid arvutatakse tervikuna. Eraldi mõõdetakse auditi, kompaktse konteksti, algteksti ja päiste/viidete mahtusid; osade summat ei esitata tokeniseerimise piiriefektide tõttu terviku asendusena. Tühi kontekst on `null` ja seda mudelile ei saadeta. Need on kohaliku `cl100k_base` tokeniseerija mõõdikud; Luna prompt'i täpne arvestus kuulub M4-sse.

## Struktuurne roll ja võrreldav valik

`bibliographic-pretitle-label-v1` tuvastab deklareeritud väljaandenime, mis asub algallikas enne põhipealkirja ja kuulub juursektsiooni. See on dokumendi leidmise abiväli. Reegel ei sõltu sõnast „Sotsiaaltöö”, PDF-räsist ega teksti miinimumpikkusest; telefon, tähtaeg või lühike sisuline keeld jääb tõendiks. Registri ja 16 embedding-sisendi baite ei muudeta.

M2.2 rakendab sama rollifiltrit mõlemas kanalis enne kandidaatide piiramist ja ka struktuursel laiendamisel. Toorjärjestuse top-1/3/5 on lõppvalikust eraldi. Võrdluse lõppmaht on kuni viis üksust ja 6000 kompaktse konteksti tokenit: hybrid-off valib kuni viis seemet, hybrid-on kuni kolm seemet ja kaks struktuurset lisandit; dokumendipiir on viis. Toote varasem kolme üksuse vaikepiir säilib eraldi katseseadistusest.

Väljalangemise jälg eristab päiserolli, dokumendipiiri, tokenieelarvet, seemnete/lõpparvu piiri ja duplikaati. Graafi audit näitab servakandidaate, algset vaba ruumi, tokenieelarvet ja põhjuseid. Kui sobivat laiendust ei tehtud, on tulemus `not_exercised`; sellest ei järeldata semantilise graafi edu või ebaedu.

## Väljasaatmismanifest ja omaniku luba

`buildPilotManifest()` rekonstrueerib tegelikust M1 aktiivsest pildist 16 dokumenditeksti ning algsest küsimustefailist 9 küsimust. Ta võrdleb iga sisendi UTF-8 räsi ja tokeniarvu, algfailide räsisid, mudelit/mõõtmeid ja limiite vana prooviplaaniga. Väljasaadetav tekst jääb muutmata. Uus roll või kompaktne kontekst ei põhjusta uut embedding-sisendit.

Eraldi privaatne luba seob omaniku kinnituse selle manifesti SHA-256, tenant'i, originaalide, endpoint'i, mudeli, mõõtmete ja piiridega. Selle piloodi ulatus on kuni 25 katset, kuni 12 420 sisendtokenit, 0 korduskatset, 0 genereerivat kutset ja kuni 0,05 USD. Paketi algne `approval.template.json` jääb kinnitamata näidiseks; tegelik kinnitatud fail koostatakse kasutaja antud loa alusel `tmp/` alla ega kuulu Git-repositooriumi.

Tavaline `rag-v2-pilot.mjs` käsk teeb ainult kuivjooksu. Võti üksi ei anna luba; `--execute` nõuab kontrollitud luba, praegust kohalikku ligipääsu ja värskelt kontrollitud hinnakirjet. Hinnakirje versioon, allikas ja kontrollimisaeg säilivad. Hinna puudumine või üle 24 tunni vanune kontroll peatab väliskutse.

Raha arvestatakse nanodollarites täisarvuna. [OpenAI mudelilehel](https://developers.openai.com/api/docs/models/text-embedding-3-large) kontrollitud 0,13 USD / miljon tokenit annab 12 420 tokenile 0,001614600 USD. See on kasutuspõhine arvestus, mitte konto lõpparve; sendini ümardamine ei muuda seda valeks nulliks.

## Saatmine, püsiv loendur ja salvestatud vektorid

Üks manifest kasutab ühte privaatset lukustatud kulupäevikut. Enne iga väliskutset reserveeritakse katse, tokenid ja kulu ning kirjutatakse need kettale. Protsessi kordus ei lähtesta limiite. Edukas vastus salvestatakse kohe tenant'i, konfiguratsiooni, sisendiräsi, kasutuse ja request-ID-ga; faili räsi talletatakse päevikus. Tavaline päring ega indekseerija ei tohi ise OpenAI-sse pöörduda: need kasutavad ainult `StoredEmbedding` adapterit ja varem salvestatud vektoreid.

Transpordi ainus siht on `https://api.openai.com/v1/embeddings`, POST koos täpse mudeli, teksti, 3072 mõõtme ja float-kodeeringuga. Ümbersuunamised on keelatud; SDK-d ega selle varjatud korduskatseid ei kasutata. PDF-binaari, tervet metafaili, auditit, failiteid ega kasutajate vestlusi ei saadeta. [API leping](https://developers.openai.com/api/reference/resources/embeddings/methods/create) on kontrollimise alus.

Vastus peab sisaldama üht õige indeksiga embedding'ut, õiget mudelit, 3072 lõplikku arvulist väärtust, mitte-nullvektorit ning oodatud `usage.prompt_tokens`/`total_tokens` väärtusi. Vigane või puuduv kasutus ei ole nullkulu. Ka kontrollimata vastuse olemasolev usage/mudeli/request-ID info jääb päevikusse, kuid reserveeringut ei vabastata.

Timeout, katkestus või vigane vastus annab `unknown` ja peatab järgmised katsed. Taaskäivitamine ei saada sama sisendit automaatselt uuesti. Käsitsi lahendamine/uus katse vajab eraldi otsust; päevikut ega lukku ei kustutata lihtsalt uue eelarve saamiseks. Samaaegne käivitus peatub `pilot_busy` olekuga. Edukate salvestatud vektorite taaskasutus ei vaja uut väljasaatmisluba.

Testvektorid on endiselt eraldi `ragv2_mock_*` kollektsioonides, pärisvektorid `ragv2_real_*` all; konfiguratsioon ja vahemälu eristavad mode'i/provider'it/mudelit/endpoint'i. Avaldamine võrdleb nüüd ka Qdranti vektori tegelikku normaliseeritud sisu oodatud vektoriga (float32 taluvus 1e-5). Õige ID ja dimensioon üksi ei tõenda õiget indeksi sisu. Pärisvektorite PostgreSQL-i vahemälu võrreldakse samuti salvestatud originaalvektoriga.

## Hindamine ja auditipiir

Algne üheksa küsimusega fail jääb muutmata. Eraldi ankrurühmad määrati PDF-i algtekstist enne pärisotsingut: OTT-i puhul motivatsioon, tervise hindamine, läbipaistmatus ja tagasisidestamise koormus; dokumenteerimisel raam ja professionaalne hinnang. Rühm lubab alternatiivseid allikakohti. Tabamus eeldab nii õiget allikakohta kui ka toetava teksti tegelikku olemasolu lõppkontekstis.

Neli meetodit kasutavad samu salvestatud päringuvektoreid. Leksikaalne meetod ei loe päringuvektorit. Autorivälja päritoluga lookup raporteeritakse sisuküsimuste semantilisest leiust eraldi. Korpuses vastuseta küsimused ei pea andma null kandidaati; nende sisu puudumise märgend ei satu production-retriever'i reeglitesse.

Esmane `pilot-results.json` ja `pilot-report.html` säilivad muutmata; hilisem lokaalne kordus neid üle ei kirjuta. Päriskatse tulemused, kasutus ja veel tõendamata omadused kantakse töö lõpus aktiivsesse seisufaili ning auditi raportisse. Üks artikkel ja kaks sisuküsimuste keeleperekonda ei tõenda kogu korpuse kvaliteeti, semantilisi reegleid, Lunat ega tootmise autentimis-/kustutusradasid.
