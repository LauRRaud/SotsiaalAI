# ADR-015 — KOV-i metaandmed, vestluspäring ja valikuline eelkontroll

Kuupäev: 23.09.2026. Kohalik teostus; push, deploy ja serveri kontroll `not_run`.

## Probleem ja otsus

Omanik valis peamiseks arendussuunaks RAG v2 / GraphRAG-i koos ühise EstNLTK otsingukihiga ([ADR-014](adr-014-estnltk-retrieval.md)). [Opuse ülevaatuse](../audits/rag-v2-opus-review-2026-09-23.md) järel parandati esmalt vead, mis takistasid KOV-allika jõudmist avaldamisest piirkonnaga piiratud otsinguni. Kõik parandused töötavad kohaliku koodi ja olemasoleva andmemudeli kaudu; uut mudelietappi ei lisatud. Aktiivne tööjärjestus jääb SotsiaalAI.md S2-sse.

## Metaandmete tähendus ja piirkond

`title`, kirje/organisatsiooni `name` ning `municipality_name` ei ole sama välja sünonüümid. Pealkirjaks valitakse esmajärjekorras selgesõnaline `title`; selle puudumisel `name` ning alles mõlema puudumisel omavalitsuse nimi. Eri metaandmekujudes esitatud päriselt vastuolulised pealkirjad jäävad konfliktiks. See eemaldab Opuse L1 valekonfliktid ilma päris vastuolude läbivaatust nõrgendamata.

Kuupäevaväljade `publication_date`, `valid_from` ja `valid_to` võrdlus tunneb kehtivaid XML-kuupäevi kujul `YYYY-MM-DD`, `YYYY-MM-DDZ` või kuupäev koos ajavööndiga. Võrreldakse kalendripäeva; ajavöönd ei nihuta õigusakti päeva. Vigast kuupäeva, vigast ajavööndit ega täpset kellaaega ei muudeta automaatselt kuupäevaks. Toorväärtus ja päritolu säilivad.

Normaliseeritud `regions` sisaldab allika selgesõnalisi piirkonna-ID-sid ja `municipality_id` väärtust. Allika omavalitsus, maakond, riik ja jurisdiktsioon jõuavad koos päritoluga ka mudeli tõendisse. Nime põhjal piirkonda ei oletata. Otsingu `region` filter saab nüüd neid välju kasutada ning piloodi käitusadapter edastab `strictFilters` väärtuse otsingule.

Metaandmete teisendusversioon on `rag-v2/metadata-adaptation-2` ja normaliseerimisversioon `source-structure-v6`. Varem vastu võetud allikaid ei kirjutata ümber: parandused eeldavad uut vastuvõttu, ülevaatust ja indeksipõlvkonda. Tundmatu kehtivus jääb tundmatuks; `valid_at` filter ei kinnita puuduva ajapiiriga teenust vaikimisi kehtivaks.

## Vestluspäring ja lugemismaht

Mitme pöörde otsingutekst sisaldab kasutaja sõnumeid ning vajadusel tema selgesõnaliselt valitud varasema vastusepunkti teksti. Tehnilised päised nagu `USER MESSAGE` ja ingliskeelsed parandamisjuhised ei lähe leksikaalsesse ega vektorotsingusse. Pöörete järjekord, paranduse tähendus ja varasema assistenditeksti kontrollimata staatus säilivad vastusemudelile antavas struktureeritud dialoogis. Varasem assistendivastus ei muutu allikaks ning viited seotakse uue tõendipaketiga.

Päringuleping muutus `m4-user-scope-search-2`-ks. Endiselt volitatud vana lepingu vestlusi saab lugeda, kuid vana kinnitus ei anna õigust uue lepingu käivitamiseks. Muudatus ei lahenda veel vabateksti üldsõnamüra ega tuleta vestlusest automaatselt piirkonnafiltrit; Opuse L4 on osaliselt lahendatud.

Piloodi eelkontroll kontrollib põlvkonda, allikaversioone, väikest otsinguloendit ning kohaliku analüsaatori valmisolekut. Ta ei lae enam kõigi lubatud dokumentide täisteksti. Analüsaatorit kontrollitakse tühja kohaliku päringuga enne võimalikku tasulist küsimuse embedding'ut. Otsing kontrollib valitud allikapakette endiselt tervikuna enne nende kasutamist tõendina. Vanal loendita indeksil säilib varasem laadimisrada. Opuse L7 on osaliselt lahendatud: ühe valitud dokumendi terviklaadimine ning kanooniliste viidete eraldi ühendused/lugemised jäävad alles.

## Kontrollitud tõend

- Kohaliku `Andmebaasi/KOV` lugemiskontroll hõlmas 78 sisupaketti ja 4876 kirjet; meta- ja allikanimekirjade faile sellesse loendusse ei arvestatud. Pärast pealkirja, nime ja omavalitsuse rollide eristamist jäi üks `source_url` vastuolu. Seda ei kinnitatud automaatselt õigeks. See loendus erineb Opuse valimi ulatusest ega tõenda sisu värskust.
- Uus sünteetiline läbiv katse kasutab kahte väljamõeldud omavalitsust ja ajavööndiga kuupäevadega XML-allikat. Kõik kolm läbivad uue `plan → prepare → review → publish → index → retrieve` raja. Piirkonnaga piiratud päring annab ainult õige omavalitsuse tõendid, koos muutumatute allikakohtadega. Ülevaatuse hoiatused kinnitatakse katses selgesõnalise põhjendusega; tootmisreegleid ei eirata.
- Sama katse läbib piloodi päris käitusadapteri eelkontrolli ja otsingu kohaliku PostgreSQL/Qdranti ning EstNLTK-ga. Eelkontroll tegi 0 täispakettide laadimiskutset; otsing tegi ühe laadimiskutse valitud dokumentidele. Kasutati testvektoreid, mudelikutseid 0.
- Metaandmete, avaldamise ja valikulise laadimise 44 eri sihttesti läbisid. Üks varasem graafipiirangu test eeldas juhuslike serva-ID-de kindlat järjekorda: sama ühe sammu eelarve võib kõigepealt täita serva- või dokumendipiiri. Test lubab nüüd kumbagi põhjendatud katkestuspõhjust, kontrollides endiselt kuni kahe dokumendi laadimist ja mittetäieliku konteksti märget. Runtime'i piiranguid ei muudetud.
- Vestluspäringu, ajaloolise konfiguratsiooni, eelkontrolli ning uue avaldamisraja ühises jooksus läbis 18 testi. Avaldamise 13 testi kattuvad eelmise punktiga; arvud ei ole liidetavad sõltumatute testidena.
- Eraldatud kohalikus `sotsiaal_ai_m4_dev` andmebaasis läbis veel 12 vestlustesti: paranduse säilitamine, inimese vahetamine, tagasipöördumine, sama pöörde paralleelne kordamine, tehingu tagasipööre, limiidid, õiguse eemaldamine, kustutamine ja aegumine. Kasutajad olid sünteetilised ning mudelitransport testadapteriga; välisvõrk oli keelatud.
- Jooksud kasutasid `TZ=UTC`. Muudetud JS/MJS-failide ESLint ja `git diff --check` läbisid. Kogu repo testikomplekti, tootmisbuild'i ja brauseri tervikrada ei käivitatud; nende seis on `not_run`.

## Allesjääv kasutuspiir

Opuse L1 on sihitud regressioonidega parandatud; L2, L4, L6 ja L7 on osalised. Struktureeritud `relatedContacts`/`relatedForms` seosed, telefoni/e-posti ajakohasus ning kasutaja täpsustatud omavalitsuse automaatne sidumine otsinguga vajavad veel teostust. Vastusemudeli juhis ja dialoogi säilitamine üksi ei tõenda, et olukorrakirjeldus jõuab õige abini. Päris vektorotsingu tähenduslik kvaliteet, kogu korpuse jõudlus ja ajaperioodide süntees on `NOT_PROVEN`.

Läbiv järgmine kasutuskatse peab eristama „teame sobiva teenuse kirjet”, „teame kontrollitud kontaktandmeid” ja „kontakt puudub”. Puuduvat telefoni, e-posti, kehtivust või abikõlblikkust ei tohi tuletatud seosega välja mõelda. Admini käsitsi käivitatav RAG-enesetest säilib. Tasuline hindamisring ei ole arenduse jätkamise nõue.
