# SotsiaalAI RAG/Graph: jätkamise lähtekoht

**Kuupäev:** 05.09.2026  
**Versioon:** 1.0  
**Otstarve:** anda järgmisele vestlusele või Codexi töövoorule senine tootemõte, kokkulepped, tõendite asukohad ja pooleliolev ülesanne.

**See on kuupäevastatud üleandmiskokkuvõte, mitte uus aktiivne seisufail, uus arhitektuur ega korraldus järgmisi etappe korraga ehitada.** Aktiivset tööd juhib repositooriumi `docs/platvormi arendus/SotsiaalAI.md` S1.0. Selle kõige uuemat kohalikku versiooni siin paketis ei ole. Käesolev kokkuvõte põhineb vestlusel ja paketti kopeeritud dokumentidel; selle koostamisel repositooriumi ega serverit uuesti ei auditeeritud.

## 1. Mida me ehitame?

Ehitame oma serveris töötavat, allikapõhist teadmistesüsteemi. SotsiaalAI on esimene kasutuskoht, kuid üldine tuum peab olema eraldatav ning sama tehnoloogia peab saama teenusena või tootena kasutusele võtta teise organisatsiooni juures.

See ei ole vana RAG-i taastamine ega olemasoleva vektorandmebaasi üks ühele ümbertõstmine. Vana RAG eemaldati; vanad algmaterjalid ja metafailid on taaskasutatav lähtevara, mille struktuuri võib põhjendatult muuta. Vana lahenduse kõik rikkepõhjused ei ole tuvastatud.

Põhikasutused on:

| Kasutus | Mida süsteem peab võimaldama? |
| --- | --- |
| Konkreetne teave | Leida teenuse, toetuse, kontakti, juhendi või artikli vajalik allikakoht. |
| Inimese oma sõnadega kirjeldatud mure | Leida tähenduslikult sobiv materjal, kaasata olulised tingimused ning anda kasulik selgitus ja vajadusel täpsustusküsimus. |
| Mitme dokumendi küsimus | Ühendada vajalikud allikad, eristades nende ulatust, aega, seisukohti ja vastuolusid. |
| Kümne aasta ülevaade | Sünteesida sotsiaaltöö arenguid perioodi katvatest ajakirjaartiklitest ja muudest sobivatest materjalidest, näidates ka teadmislünki. |

Materjale koondab haldaja. Lõppkasutaja ei pea abi saamiseks dokumente üles laadima. Korpus hõlmab kavandi järgi ajakirja Sotsiaaltöö artikleid, KOV-i teenuseid/toetusi/kontakte, ametlikke juhendeid ning muud asjakohast materjali. Üks pilootkorpus ei võrdu kogu kavandatud korpusega.

Eesmärk on **õigsus koos täielikkuse ja kasulikkusega**. Automaatseid siduvaid toetuse- või teenuseõiguse otsuseid ei ehitata. Väiksem keeldumiste või vigade arv ei ole eraldi piisav mõõdik. 100% õigsust, tõendatud patenteeritavust ega universaalset parimat algoritmi pole lubatud.

## 2. Püsivad arhitektuuripõhimõtted

- Omaniku server; ei ole kohustuslikke tasulisi RAG-, graafi-, parseri-, mälu- ega ümberjärjestamisteenuseid. Serveri ja hoolduse kulu jääb arvesse.
- PostgreSQL hoiab põhiregistrit, allikalist teksti ja seoseid; Qdrant on taasloodav vektorotsingukiht. Need on praeguse teostuse valikud, mitte kogu toote igavene sidumine ühe tarnijaga.
- `text-embedding-3-large`, praeguses piloodis 3072 mõõdet. Mudel, mõõtmed, sisendteksti versioon ja indeksipõlvkond on eristatavad.
- Luna on omaniku nimetatud peamine vastaja. Täpne kasutatav API mudeli-ID ja saadavus tuleb ühendamisel kinnitada; varasem nimekuju või vestluses esitatud väide pole selle tõend.
- Tavalise eduka vastuse siht on üks genereeriv mudelikutse; embedding'u arvutus on eraldi. Toote sees ei ole nõutud AI-agente, mudelipõhist planeerijat ega kriitikutsüklit.
- Valikuline mudelipõhine rikastamine võib hiljem toimuda ingest'is eraldi loa ja eelarvega. See pole iga kasutajapäringu korduv töö.
- ET/EN/RU tugi; tõlge ja kokkuvõte ei muutu algallikaks.
- Algtekst, tuletatud otsinguabi, kontrollitud väide, kontrollimata seos ja kasutaja öeldud asjaolu jäävad eristatavaks.
- Viite ID lahendatakse rakenduses lubatud dokumendiversiooni ja tekstikohani. Mudeli loodud URL-i ei usaldata. Viite tehniline kehtivus ei tõenda automaatselt lause semantilist õigsust.
- Olemasolev platvorm, kasutajaliides ja autentimise ühenduskohad säilivad; tuuma ei kirjutata põhjuseta uuesti.

## 3. Millist GraphRAG-i kavandame?

Kavand ei ole ühe välise GraphRAG-raamistiku muutmata paigaldamine. Graafi rollid on lahus:

| Kiht | Otstarve | Teostuse seis üleandmisel |
| --- | --- | --- |
| Struktuurigraaf | Artikkel–peatükk–tekstiosa, naabrus ja algallika seosed. | M1/M2-s olemas. |
| Otsinguabi seosed | Mõisted, teemad, viited ning dokumentidevahelise materjali avastamine. | Täpne laiendamine kujuneb vajaduse ja katsete järgi. |
| Sisuline sõltuvuskiht | `REQUIRES`, `EXCEPTION_TO`, `DEFINES`, `QUALIFIES`, `SUPERSEDES`: mida tuleb konkreetse väite kasutamisel kaasa arvestada. | M3; pole veel käitusajas valmis. |
| Ajaline/ülevaatekiht | Teemade ja perioodide katvus, varasema ja hilisema seisundi tõendatud võrdlus. | M5; pole veel valmis. |

Algne M3 kirjeldus on `CODEX_RAG_GRAPH_LAHTEULESANNE.md` jaotises 8. Sõltuvusel peab olema allikaline põhjendus ja kontrolliseis. JA/VÕI-alternatiivid ning kasutaja asjaolu teada-tõene, teada-väär, teadmata või vastuoluline seis tuleb eristada. Üldseos „seotud teemaga” ei tähenda „kohustuslik erand” ega „põhjustas muutuse”.

Kohustuslikku tingimust ei eemaldataks pelgalt väikese sarnasuse tõttu. Samas ei tõenda graafiläbimise lõpp, et ingest leidis kõik erandid või et korpus on täielik. Esimene sisuline graafikatse kasutab väikest kontrollitud sõltuvuste kogumit; automaatse eraldamise täpsust hinnatakse eraldi.

Praegune „kolm seemet + kaks naabrit” pole tulevase M3 graafi lõplik algoritm. Selle ebaõnnestumine ei tõenda kõigi graafimeetodite mõttetust. Ka hübriidi võit puhta vektori ees pole kohustuslik toote-eesmärk.

Kümnendi ülevaaterada peab eristama arutelu, soovitust, katsetust, kehtestamist, rakendamist ja mõõdetud tulemust. Eelkoostatud kokkuvõtted on leidmise abivahendid; olulised järeldused vajavad algallikaid. Teema sagedasem kajastamine ei tõenda automaatselt praktika laienemist. Puuduv aasta on katvuse lünk.

**Oma arenduse hüpotees:** sama allika- ja sõltuvuste esitus aitab juhtida materjali ettevalmistamist, tõenduspaketi koostamist, vastuse piiranguid ja uuendamist. Hilisem võimalik mõjuindeks aitaks leida, milline teadmata asjaolu või leidmata allikas võiks vastust muuta. Need on uurimissuunad, mitte tõendatud uudsed leiutised ega praeguse M2.3 lisatöö.

## 4. Viimane siin tõendatud tööseis

Alused: `rag-v2-multi-source-preparation-2026-09-05.md`, eriti jaotis „M2.3 kitsas diagnoos pärast koodiülevaatust”, ning omaniku viimane tööraport.

- M0–M2.2, kaheksa allika pärisjärelkatse ja dokumenteeritud parandused on seniste raportite ulatuses lõpetatud. Indeksis on 8 dokumenti ja 69 üksust.
- Esimeses piloodis oli 25 pärisembedding'u sisendit; mitme allika jooks taaskasutas need ja lisas 73 uut. Hilisem fikseeritud ledger'i kordus tegi 0 uut API-kutset. Kulud on usage'i järgi arvutatud, mitte arve kontroll.
- V1 ankrumõõdiku täielik tugi oli leksikaalsel 7/18, vektoril 15/18, hübriidil 13/18, struktuurirajal 11/18. Need ei ole üldised semantilise õigsuse protsendid. Rubriigi täpsustamise järel ei tohi neid ajaloolisi tulemusi üle kirjutada.
- Viimane varasemas vestluse koodiülevaatuses kontrollitud GitHubi `main` oli `aa2b120721f066233c4d77770dcd49fd9a0713a0`. Seda pole käesoleva paketi koostamisel uuesti kontrollitud.
- Omaniku viimase teate järgi on kitsas diagnoos tehtud, audit ja kohalik S1.0 uuendatud; kood, v1 tulemused ning server jäid muutmata. Selle kohaliku dokumentatsioonimuudatuse jõudmist GitHubi ei tohi eeldada.
- Diagnoos kontrollis 84 järjestuse ja 405 valitud tõendikatkendi kooskõla. See ei olnud uus PDF-ide visuaalne audit ega uus otsingukatse.
- Platvormi chat jääb M4-ni `generationAvailable=false`. Praegune õiguskontroll on operaatori/piloodi ulatuses; uue RAG-i HTTP- ja privaatsusraja valmidust ei eeldata.
- M3 semantiline sõltuvusgraaf, Luna vastamine, ajaloolise korpuse katvus ja M6 tervikvastuvõtt pole tehtud. Hindamisrubriik v2 on järgmine väljastatud ülesanne; selle valmimise raportit pole selle kokkuvõtte hetkel esitatud.

**Ära korda M0–M2.2 ega lõpetatud kitsast diagnoosi ainult seetõttu, et vestlus või mudel vahetus.** Jätkamisel kontrolli siiski tegelikku tööpuud ning uuemaid omaniku otsuseid.

## 5. Millised diagnoosi järeldused peavad säilima?

1. Tehnopoli ja EKA küsimus nõuab selgesõnaliselt mõlemat allikat. Tehnopoli vajalik lõik langes vektori 3. kohalt hübriidi 14. kohale. Seda ei saa rubriigis muuta õigeks üksnes EKA samateemalise teksti abil.
2. Struktuurirada jättis olulisi viienda koha üksusi välja `seed_limit` tõttu ka vaba tokenimahu korral. See puudutab konkreetset 3+2 valikupoliitikat, mitte allika kadumist indeksist.
3. Tööandja vastutuse hübriidkontekstis oli 4. lehe sisuline alternatiiv, millele 5. lehe fraasidega piiratud v1 ankrud tuge ei andnud. Nõuete kaupa tuleb hinnata alternatiivi; kogu küsimust ei märgita automaatselt õigeks.
4. Inimsuhete/arendustingimuste ja andmeminimeerimise juhtumites esines osalist asjakohast tuge. Täielik samaväärsus ei ole veel kinnitatud.
5. RRF-i kanalite kattuvuse eelis seletab RU rahastusküsimuse konkreetset mehhanismi. Teistes juhtumites mõjutavad nõrgad kanalijärgud ka mõlemas kanalis esinevat õiget üksust. Suurem vektorikaal pole üldlahendus: ESTA juhtumis oli tugev leksikaalne esikoht.
6. V1 kontrollosa on diagnoosiks avatud. Ümberhindamine või ümbernimetamine ei tee seda jälle puutumatuks.

## 6. Täpne järgmine töö

Loe `CODEX_M2_3_RUBRIIK_V2_JA_KORDUSHINDAMINE_v0_1.md`.

See ülesanne määrab järgmise järjekorra: vajalikud mõtted ja allikanõuded → põhjendatud alternatiivse/osalise toe ülevaatus → kõigi nelja raja samade salvestatud kontekstide võrdne v2 kordushindamine. Muutumata v1 mõõdik säilib kõrval.

Selles plokis ei muudeta RRF-kaale, dokumendikvoote, tükeldamist, indeksit ega serveriseadistust. Uut `retrieve()` jooksu, embedding'ut, genereerivat hindajat ega Lunat ei käivitata. Sisulise ülevaataja otsuseid ei fabritseerita. Lahendamata küsimused jäävad `needs_review` seisundisse.

Kui v2 hinnang paraneb, on see hindamislepingu muutuse tulemus, mitte tõend otsingualgoritmi paranemisest. Pärast rubriigi korrastamist valitakse üks allesjäänud tõendatud puudujääk ja katsetatakse üht muudatust korraga. Edasine häälestus vajab uut puutumatut kontrollkogumit.

## 7. Järgnev areng, mitte praeguse töö lisakohustus

| Suund | Järgnev töö |
| --- | --- |
| Otsingu kvaliteet | Rubriigi järel väike põhjendatud valikukatse; puhas vektor jääb ausaks võrdlusbaasiks. |
| M3 | Allikaga kontrollitud tingimused/erandid, piiratud sõltuvuste kaasamine ja graph-off võrdlus. |
| M4 | Vaba kasutajaküsimuse embedding'u lubatud rada, eksplitsiitne otsinguprofiil, serverisessiooni õigused, üks peamine vastaja ja viitevaade. Salvestatud pilootküsimuste vektorid ei ole veel see teenus. |
| Suurem korpus | Enne ulatuslikku kasutust muuta päringu tööjaotust: kogu korpuse detailide korduv lugemine/kontroll ei tohiks olla iga küsimuse püsikulu. Säilita tervikluse ja õiguste tagatised. |
| M5 | Tegelik perioodi kattev korpus, teemad/ajad/versioonid ja algallikatele toetuv süntees. |
| M6 ja toode | Haldus, värskus, kustutus/säilitus, taastamiskatse, koormus, kogukulu ja teise kliendi pärispiloot. |

M3 ei pea blokeerima kõiki kitsaid artiklipõhiseid M4 sisekatseid; teenusetingimuste kohaldamine vajab vastava ulatuse kontrolli. Ühtegi avalikku või tasulist käivitust ei eeldata automaatselt etapinumbrist.

## 8. Failide lugemisjärjekord ja ajakohasus

| Paketi fail | Roll / märkus |
| --- | --- |
| `ALUSTA_SIIT_RAG_GRAPH_2026-09-05.md` | Käesolev üleandmiskokkuvõte. Ei asenda aktiivset S1.0 kirjet. |
| `CODEX_RAG_GRAPH_LAHTEULESANNE.md` | Algne tervikülesanne: arhitektuur, andmed ja M0–M6. Jaotis 8 kirjeldab soovitud graafi. Algne M0/M1 alustamiskäsk pole praegu uus ülesanne. |
| `SOTSIAALAI_RAG_GRAPH_ARENDUSTEEKAART_v0_1.md` | Tootesiht, arengutee ja eristumise hüpoteesid. Selle „praeguse seisu” ja „vahetu järje” lõigud kirjeldavad varasemat hetke, mil M2.2 polnud lõpetatud. |
| `rag-susteem-master.md` | Platvormi ühenduskohtade ja M0–M6 kaart. Paketis on varasem üleslaaditud koopia; selle järgmise sammu kirje ei ole kõige uuem tööots. |
| `rag-v2-multi-source-preparation-2026-09-05.md` | Kõige uuem siin esitatud audit; sisaldab M2.3 diagnoosi. Seda ei tohi segi ajada sama nimega varasema, diagnoosita koopiaga. |
| `CODEX_M2_3_RUBRIIK_V2_JA_KORDUSHINDAMINE_v0_1.md` | Viimane väljastatud konkreetne ülesanne; valmimise raport puudub selle kokkuvõtte seisuga. |
| `RAG_V2_KOODIULEVAATUS_aa2b12072.md` | Varasem koodiülevaatus. Kitsam hilisem diagnoos täpsustab selle hüpoteese; see pole uus testikäivitus. |
| `SISU_JA_RASID.json` | Paketi failide SHA-256 ja koopia päritolu; dokumentide räsid ei tõenda serveri ega repositooriumi praegust seisu. |

Algseid dokumente pole siin ajakohasena näimiseks ümber kirjutatud. Nende koopiad säilitavad varasema sõnastuse ning ülal on kirjas kasutusroll ja vananenud olekukohad. Dokumendisisesed suhtelised repositooriumilingid ei pruugi eraldiseisvas arhiivis avaneda.

## 9. Kuidas järgmises vestluses või Codexis jätkata?

Anna ette vähemalt käesolev fail, kõige uuem audit, tegelik aktiivne S1.0 kirje ja poolelioleva ploki ülesanne. Terviknägemuse jaoks on lisaks algne lähteülesanne ja teekaart. Kõiki raporteid ei pea iga kord korraga konteksti laadima.

Algusjuhis:

> Jätkame olemasoleva SotsiaalAI RAG/Graph-toote arendust, mitte ei alusta nullist. Loe kõigepealt ALUSTA_SIIT_RAG_GRAPH_2026-09-05.md, viimast kohalikku SotsiaalAI.md S1.0 kirjet ja uusimat auditit. M0–M2.2 ning kitsas M2.3 diagnoos on seniste tõendite ulatuses lõpetatud. Järgmine väljastatud ülesanne on hindamisrubriik v2 ja salvestatud tulemuste kordushindamine. Ära korda lõpetatud diagnoosi ega muuda järjestust, kaale või kvoote enne rubriigi ülevaatust. Hoia v1 tulemused muutmata. Puuduvad failid ja tõendamata asjaolud nimeta, ära oleta. Kõigepealt kirjelda, mis on tehtud ja mis on praegune järgmine samm; ära käivita selle orientatsioonijuhise alusel tasulisi kutseid ega tootmismuudatusi.

Repositoorium on `LauRRaud/SotsiaalAI`. Uus töövoor peab kontrollima tegelikku commit'i ning kohalikku tööpuud. GitHubi `main` ei sisalda automaatselt omaniku veel commit'imata kohalikke dokumente. Ära kirjuta omaniku muutmata/commit'imata tööd üle.

## 10. Säilitamine ja piirid

Salvesta pakett enda arvutisse või privaatsesse projektikausta. See ei ole kogu koodirepositooriumi, serveri ega andmehoidla varukoopia. Siin pole alg-PDF-e, täismahulisi evidence-raporteid, pärisvektoreid, approval-faile, kululegereid ega keskkonnasaladusi.

Repositoorium ja ignoreeritud privaatsed andmed vajavad eraldi varundamist. Ainult GitHubist ei saa taastada faile, mida sinna teadlikult ei lisatud. Käesoleva paketi loomine ei teinud commit'i, push'i, serverimuudatust ega uut väljasaatmisluba.

Vestluse või mudeli vahetus ei ole põhjus muuta projekti eesmärki, kuulutada hüpoteese tõendatuks ega korrata juba lõpetatud tööd. Kogu arutelu automaatse mäletamise asemel tuleb jätkamisel lugeda tegelikke dokumente.
