# ADR-016 — Struktureeritud KOV-kataloog vestluse tõendina

23.09.2026. Kohalik teostus; tootmisse paigaldamine ja pärismudeli kvaliteet `not_run` / `NOT_PROVEN`.

## Probleem ja lahendus

[Opuse P1](../audits/rag-v2-opus-review-2026-09-23.md) järgi ei tohi ühe omavalitsuse teenusekataloog sõltuda tekstiosade top-k tulemustest. Vaja on terviklikke kirjeid, allikas deklareeritud seoseid ja kontrollitud kontakte. Selle plokiga lisandus eraldi `StructuredRecordSource` ning selle kasutamine piiratud KOV-vestluspiloodis. Ajakirjade hübriidotsing säilib; automaatne valik artikli-, KOV- ja perioodiraja vahel ei ole selle muudatusega valmis.

Tuuma üldleping on `rag-v2/structured-record-1`. SotsiaalAI paketikujude teisendus ja omavalitsuste/kontaktiregistri ühendus paiknevad `lib/rag-v2/adapters/` all. Allikanimede, kindlate valdade või oodatud vastuste järgi runtime-erandeid ei lisatud.

## Allikast kataloogiks

- Registriadapter annab teenuse, toetuse, ressursi, kontakti ja vormi kirjele deklaratiivse väljavastenduse. Väärtused loetakse valitud algse JSON-kirje seest. Säilivad stringid, loendid ja objektid, sealhulgas tingimuste struktuur.
- `relatedContacts`, `relatedForms` ja `relatedTo` säilivad suunatud seostena. Igal seose siht-ID-l on eraldi allikakoht ja tekstiosa: ühe nähtava kontakti tõend ei avalda sama loendi peidetud kontaktide ID-sid. ID-osad on tavapärase otsinguprofiili sisulistest kandidaatidest välja jäetud.
- Välja väärtust ja seose sihti võrreldakse bundle'i kontrollis täpselt vastava allikaüksuse tekstiga. Tõendid kasutavad olemasolevaid `S`-viiteid, muutumatuid allikaversioone ja allikavaadet. Kataloog ei lisa allikale LLM-i koostatud fakte.
- Normaliseerimine on `source-structure-v7`. Vanad bundle'id jäävad loetavaks; uus struktuur eeldab uut vastuvõttu ja indeksit. Prisma migratsiooni ei lisatud.
- Kataloog loendab kõik lubatud indekseeritud struktureeritud kirjed valitud piirkonnas. Põhivaates on pealkiri, kokkuvõte, ametlik link ja seotud kirjed; konkreetse kirje detailvaade lisab muu hulgas tingimused ja taotlemise. Eelmises avaldatud vastuses viidatud teenused saavad sama piirkonna jätkuküsimuses detailid automaatselt kaasa.
- Täielikkus tähendab ainult lubatud indekseeritud kirjete ulatust. Struktureerimata piirkonnaallikate olemasolu märgitakse osaliseks katvuseks. Teenuse tegelikku kehtivust ega kättesaadavust loendus ei kinnita.
- Piirid on kuni 200 laaditavat dokumenti, 100 kirjet ja 12 000 mudelikonteksti tokenit; ülempiiri ületamine annab vea. Kataloogi ei kärbita vaikselt top-k nimekirjaks. Kogu omavalitsuse mahus kasutatavus pole veel mõõdetud.

## Vestlus ja mudelikulu

Omavalitsuste nimed tulevad aktiivsest `Municipality` loendist. Adapter vastendab `slug`-i praeguse paketikorpuse `municipality_id` kujule (`-` → `_`). EstNLTK analüüsib nime ja kasutaja teksti; käsitsi käändevormide loendit pole. Täpsustatud „Tartu vallas” eristub mitmetähenduslikust „Tartus”. Eri valdade mainimine jääb mitmetähenduslikuks; tuvastamata asukohaga selgesõnaline paranduspööre tühjendab vana ulatuse.

Kohanime mainimine valib võimaliku allikaulatuse, **mitte tõendatud elukoha**. Eituse, hüpoteetilise asukoha ja teise inimese eristamine jääb vastusemudeli ülesandeks ning on juhises selgesõnaline. Deterministlik nimetuvastus ei ole täielik olukorra mõistmine. Opuse pakutud vajadusi, teadmata asjaolusid ja perioodi sisaldav `dialogue_state` väljund on endiselt edasine töö.

Kui piirkond puudub või on mitmetähenduslik, saab sama vastusekutse täpsustuse märke ja tühja kataloogi. Kui piirkond on teada, saab see tema teenusekataloogi ning lubatud seotud kontaktid/vormid. Selle raja päring ei vaja küsimuse embedding'ut ega eraldi planeerivat mudelikutset. Vektorid on praeguses teostuses endiselt indeksi lepingu osa; nende loomise vajadust allikate ettevalmistuses see ei eemalda.

„Lihtsamalt” jätkupöördes laaditakse sama piirkonna kataloog ja varem viidatud kirjete detailid uuesti. Algallika tõendi ID-d säilivad ja õigused kontrollitakse uuesti. See on allikafookuse edasikandmine, mitte varasema assistendi väidete tunnistamine tõeks.

## Kontaktide värav

Kogutud paketi kontakt jääb vaikimisi kasutamata. SotsiaalAI adapter kasutab olemasolevat `buildFreshServiceMapContactWhere()` avaliku kontaktiregistri reeglit: lubatud päritolu, `PUBLISHED`, puuduv tombstone ning kehtiv kontakti kontrolli aeg/revisjon. Lisaks peavad kattuma kirje `sourceDocId`, omavalitsus, nimi ja kõik paketis leiduvad telefoni/e-posti/ametliku URL-i väärtused. Nime sarnasuse järgi kontakte ei liideta.

Puuduv, teise piirkonna, õigusteta või kontrollimata siht jääb neutraalseks `unavailable` seoseks; selle nime ega kanalit mudelile ei anta. Kontroll kordub enne vastuse saatmist, pärast vastust ja ajaloolise vestluse taastamisel. Kontakti roll ja osakond on endiselt kogutud väljad, mille ajakohasust see adapter eraldi ei kinnita.

Adapter **ei täida** vanade KOV-pakettide puuduvaid telefone/e-poste registri väärtustega. See vajab eraldi päritoluga uut allikakirjet või üle vaadatud eksporti; lubamatu vana üleriigiline kontaktikoond jääb peidetuks. Päris paketi-ID-de vastavust avaldatud kontaktiregistri `sourceDocId` väärtustele selles plokis ei mõõdetud. Ühenduse puudumisel on tulemus ausalt puuduv kontakt, mitte automaatne heakskiit.

## Käitusleping

Uues piiratud piloodiplaanis kasutatakse koos järgmisi välju:

```json
{
  "dialogueVersion": "m4-active-dialogue-1",
  "promptVersion": "m4-grounded-dialogue-4",
  "questionVersion": "m4-user-scope-search-3",
  "recordCatalogue": "rag-v2/record-catalogue-1"
}
```

See on olemasoleva plaani täiendus, mitte iseseisev käivituskonfiguratsioon. Vajalikud on uued allikaversioonid, kooskõlaline indeks, EstNLTK keskkond ning kehtiv plaani kinnitus. Olemasolevat piloodiseadistust selle töö käigus ei muudetud ega lubatud mudelikulusid ei suurendatud. Vana vestlusleping jääb loetavaks, kuid ei anna õigust uue lepingu käivitamiseks.

Veebipiloot annab adapterile olemasoleva Prisma kliendi; tuum põhirakenduse andmemudeleid ei tunne. Kontakti värskusreegli failid lisati teostusmanifesti. Admini käsitsi käivitatavat RAG-enesetesti ei muudetud.

## Tõend

- Kuus uut läbivat sihttesti kasutavad päris kohalikku PostgreSQL-i, Qdranti, EstNLTK-d ja eraldatud vestlusandmebaasi. Kaks omavalitsust sisaldavad ainult väljamõeldud teenuseid/kontakte. Iga piirkonna kuus teenust/toetust säilivad kataloogis; viited lahenevad kanoonilisele allikale. Varjatud siht-ID, telefon ja teise valla kontakt ei jõua paketti.
- Viis pööret: olukord ilma vallata → „Elan Harkus” → kontaktiküsimus → parandus Kose valda → „lihtsamalt”. Testtransport saab täpselt viis vastusekutset ja null päringu embedding'u kutset; piirkond, detailid ja allika-ID-d säilivad. See test **ei hinda mudeli vastuse sisu kvaliteeti**.
- Kontaktiregistri adapteri katse loob samas eraldatud andmebaasis sünteetilise avaldatud kontakti ja kontrollikirje. Vale piirkond/ID, muudetud telefon, `DRAFT`, uus kontrollimata revisjon ja aegunud kontroll välistavad kontakti. Kontrollandmed kustutatakse katse järel.
- Viidete kontroll koondati paketi kaupa: üks bundle'ite laadimiskutse, iga viite põlvkonna/üksuse/teksti kontroll, õiguste korduskontroll ja kontaktide uus kontroll. Pole päringuteülest kontrollivahemälu. Samal viie pöörde näitel oli kontrolliderohke jooks enne ligikaudu 55,2 s ja pärast 5,7 s; üksik kohalik testadapteri mõõtmine, mitte tootmise SLA.
- Läbisid 49 eri sihttesti: uus kataloog/vestlus 6, allikastruktuur 21, vestlusandmebaas 12, dialoog 3, konfiguratsioon 1, EstNLTK ühendus 2, eelkontroll 1 ning kolm sihitud vana viite-/struktuuritesti. Esimene vana artiklikatse käivitus ilma nõutud `RAG_V2_INPUT_ROOT` seadistuseta; korratud sihtkatse uue ajakirjakausta asukohaga läbis.
- 4876 kohaliku KOV-kirje **kujuteisendus** läbis: 1253 teenust, 1037 toetust, 908 ressurssi, 808 kontakti ja 870 vormi. See ei ole 4876 kirje uus ingest, avaldamine ega ajakohasuse kontroll.
- Kontrollid olid `TZ=UTC`, muudetud JS/MJS-failide ESLint ja diff-kontroll läbisid. Tasulisi kutseid 0. Täiskomplekt, tootmisbuild, brauseri tervikrada, pärismudel ja serveripaigaldus `not_run`.

## Järelejäänud tervikpiir

See on Opuse P1 tehniline esimene läbiv teostus. Ühine artikli/KOV/perioodi päringuvalik, täielik vestluse sisuline seis, päris teenusekirjete seostamine ajakohaste kanalitega ja suurema omavalitsuse kontekstieelarve on veel lahti. Järgmine sisendiplokk peab tooma üle vaadatud kontaktikanalid koos päritoluga uude allikaversiooni ning tõendama selle vastavuse registri identiteedile. Aktiivne arendusjärjestus jääb SotsiaalAI.md-sse.
