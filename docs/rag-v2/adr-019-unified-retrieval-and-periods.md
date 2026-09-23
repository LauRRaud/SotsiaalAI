# ADR-019 — Teadmiste, KOV-kirjete ja perioodide ühine tõendivalik

23.09.2026. Kohalik teostus ja kontroll. Serveris aktiveerimine `not_run`; pärismudeli sisuline kvaliteet `NOT_PROVEN`.

## Probleem ja otsus

Varasem `recordCatalogue` valis kogu pöörde jaoks KOV-kataloogi ning jättis artiklite hübriidotsingu kõrvale. Ühes vestluses peab saama küsida ajakirjast, kirjeldada abivajadust ja võrrelda perioode. Kasutaja ei pea nende jaoks otsingurežiimi vahetama. [Opuse ülevaatuse](../audits/rag-v2-opus-review-2026-09-23.md) P1/P3 suunda jätkavad struktureeritud kataloog, tsitaatidega vestluse seis ja perioodide katvuse arvestus.

Uus valikuline rada koostab piiratud tõendipaketi mitmest allikavalikust. See ei lisa kavandaja ega päringu klassifitseerija mudelikutset. Üks päringu embedding taaskasutatakse kõigis tekstipäringutes; üks vastusekutse tõlgendab kasutaja soovi, valib asjakohase tõendi ja tagastab ka vestluse seisu. Päringuvektori olemasolev vahemälu võib embedding'u kutse ära jätta. Kataloog ilma ühise rajata säilitab senise embedding'uta tööviisi.

See on piiratud kandidaatide valik, mitte tõendatud semantiline päringuliigitaja. Ühispakett võib sisaldada hetkel mittevajalikku tõendit. Mudelikutsed ei paljune, kuid andmebaasipäringuid ja vastuse sisendtokeneid võib olla rohkem; päriskulu ega kvaliteedivõitu siin ei mõõdetud.

## Tõendivalik

| Osa | Ulatus ja piir |
| --- | --- |
| Üldteadmised | Kõik kinnitatud ja lubatud struktureerimata allikad, sealhulgas ajakirjad, juhendid ja õigusallikad. Piirkonna ega avaldamisaja globaalset filtrit ei lisata. Olemasolev EstNLTK/hübriid-/graafiprofiil ja selle 6000 kontekstitokeni piir säilivad. |
| KOV-kataloog | Uute kasutajapöörete ja viimase tsitaatidega seisu järgi valitud piirkond. Olemasolevad teenuse–kontakti–vormi seosed, kontaktide lugemishetke kontroll ning varem viidatud kirje detailivalik säilivad. Piirkonda küsitakse ainult kohaliku abi jaoks, mitte iga artikliküsimuse järel. |
| Kuni kaks perioodi | Ainult ajakirjaallikad avaldamisaja järgi. Mõlemal perioodil eraldi kuni 2 järjestatud algkatkendit, 4 lõppkatkendit, 1 katkend dokumendi kohta ja 3000 kontekstitokenit. Graafi lisatõendid alluvad samale piirile; puuduva sõltuvuse märgis säilib. |

Allikaliik määratakse metaandmetest enne tekstikandidaatide piiramist: struktureeritud kirjed ei jõua üldteadmiste kaudu kontaktikontrollist mööda. Ajakirja tunneb `journal_title` või üldine `source_type: journal_article`, mitte väljaande nime, faili-ID ega oodatud vastuse järgi. Allikate tüübid on importimise metaandmed, mitte sõltumatult kinnitatud liigitus.

Ühine rada lubab kuni 1000 dokumendi aadressiloendi ja kuni 24000 mudelikonteksti tokenit. Piiri ületamisel tuleb viga; tõendit ei lõigata märkamatult ära. Kataloogi senised mahu- ja värskuspiirid kehtivad edasi. Kliendi eripärad jäävad piirkonna- ja kontaktikontrolli adapterisse; tuumas pole omavalitsuste, teenusesõnade ega käändevormide erandeid.

## Ajatähendus ja katvus

`m4-dialogue-state-2` asendab ühe `period` välja kuni kahe `periods` kirjega. Igal kirjel on `basis` (`publication`, `event`, `validity`, `unspecified`), ISO-piirid ja täpne kasutajatsitaat. Server kontrollib kuupäevade võimalikkust, järjekorda ning tsitaadi päritolu. See ei tõenda, et mudel tõlgendas teksti õigesti.

- Käesoleva pöörde numbriline aastaarv, ISO-kuupäev või kriipsuga vahemik annab esialgse kandidaadi. Sõnade käändevorme ei loetleta. Kandidaat ei kinnita avaldamisaja kavatsust: sama arv võib olla sünniaasta, sündmus või näide. Üldteadmiste rada jääb seetõttu ajaliselt piiramata.
- Kui uuemates kasutajasõnumites numbrilist kandidaati pole, kasutatakse viimase seisu vahemikke. `event` ja `validity` ei loo avaldamisaja päringuid. Selgesõnaline kuupäevadeta paranduspööre tühjendab senise valiku. Tühjendatud perioodi ei leita vanast toortekstist uuesti.
- Suhtelise ajaväljendi tõlgendamiseks saab vastusemudel serveri UTC-kuupäeva `stateContext.asOfDateUTC`. Numbriline parser ise suhtelisi väljendeid ei tõlgenda. Sama vastuse tagastatud tõlgendus saab suunata järgmist pööret; esimeses pöördes ei tehta selle järel automaatset uut otsingut. Ebaselge tähenduse korral peab assistent täpsustama.
- Avaldamine, sündmus, õigusnormi/teenuse kehtivus, kogumine ja kontrollimine jäävad eri mõisteteks. See muudatus ei lisa sündmuste ajajoont ega teenuse ajaloolise kehtivuse mootorit.

Iga tekstivaliku raport eristab lubatud indekseeritud dokumentide arvu, valitud dokumentide arvu, avaldamisaastate jaotust ja puuduva avaldamiskuupäevaga dokumente. Perioodi puuduva kuupäeva arv käib kogu lubatud ajakirjavalimi kohta, sest kuupäevata allikat ei saa ühele perioodile omistada. Null tõendit ühel poolel säilib selgesõnalise lüngana.

Loendusühik on **indekseeritud allikadokument**, mitte unikaalne artikkel. Artikli eri failide/versioonide deduplitseerimist ega korpuse täielikkust ei ole tõendatud. Valitud katkendid on valim. Juhis keelab järeldada sellest teema üldist sagedust, puudumist, põhjuslikkust või korpuseülest arengusuunda. Ka ühe dokumendi kohta võetud katkend võib vajaliku konteksti välja jätta.

## Viited, õigused ja taastamine

`search/unified.js` ühendab sama kliendi ja indeksipõlvkonna pakettide tõendid, eemaldab sama `evidence_id` kordused ning loob ühe uue S-viidete kaardi. Sama ID vastuoluline sisu tõrjutakse. Kataloogi väljade/seoste ja graafi viited teisendatakse koos tõenditega; graafi väitevõtmed saavad valiku nimeruumi. Puuduv viide, vale periood või kirje sattumine tekstivalikusse tõrjutakse enne mudelikutset.

Katvuse metaandmed on samuti tuletatud info. Pakett sisaldab kogu loendatud lubatud dokumendiulatuse ja raporti räsi. Enne mudelile saatmist, avaldamist ning hilisemat taastamist kontrollitakse ulatust uuesti. Ka sellise dokumendi ligipääsu kaotus, mille katkendit ei valitud, muudab vana katvusraporti kasutuskõlbmatuks. Valitud tõendite senine kanooniline allika-/õiguse-/kontaktikontroll säilib.

Ühise paketi taastamine nõuab endiselt sama aktiivset, plaaniga seotud indeksipõlvkonda. Uuele põlvkonnale lülitumine ei migreeri vanu pakette ega vestluse seisu automaatselt. Sisemine valikuraport ja vestluse seis ei ilmu avalikku vastuselepingusse. Prisma skeemi ei muudetud.

## Versioonid ja kasutuselevõtt

`rag-v2/retrieval-directory-2` lisab väikesele otsinguloendile `source.record_kind` ja `source.journal`. Skeemiversioon kuulub nüüd otsingukonfiguratsiooni identiteeti: vaja on **uut indeksipõlvkonda**. Varasem v1 kuju ja konfiguratsiooniräsi jäävad lugemiseks ning vana plaani jätkamiseks toetatuks; ühine rada nõuab v2 loendit. Algallika vastuvõttu pole vaja korrata üksnes loendiversiooni pärast, kui vajalik metaandmestik on allikaversioonis juba olemas.

Vektori sisend ja vektorruum ei muutu. Indekseerimine kopeerib vana kontrollitud vahemälurea uude muutumatusse nimeruumi, võrreldes sisendi-/konfiguratsiooniseost ning pärisrežiimis varem salvestatud vektorit. Uut tasulist vektorit selle metaandmemuudatuse jaoks ei genereerita. Katkestusest jätkamine kontrollib uue põlvkonna salvestatud kontrollpunkti.

Olemasoleva piloodiplaani lisaväljad:

```js
{
  mode: 'real',
  dialogueVersion: DIALOGUE_VERSION,                  // m4-active-dialogue-1
  dialogueStateVersion: TYPED_DIALOGUE_STATE_VERSION, // m4-dialogue-state-2
  dialogueStateSchemaHash: digest(TYPED_DIALOGUE_ANSWER_SCHEMA),
  retrievalRouting: UNIFIED_RETRIEVAL_VERSION,        // rag-v2/unified-retrieval-1
  recordCatalogue: RECORD_RETRIEVAL_VERSION,          // rag-v2/record-catalogue-1
  promptVersion: DIALOGUE_PROMPT_VERSION,              // m4-grounded-dialogue-6
  questionVersion: DIALOGUE_SEARCH_VERSION,            // m4-user-scope-search-5
  reasoning: 'medium',
}
```

Konstandid asuvad `pilot/dialogue.js`, `pilot/dialogue-state.js`, `pilot/retrieval-plan.js` ja `search/structured-record-source.js`; `digest` on `pilot/contracts.js`. Mudel jääb `gpt-6-luna`. Olemasolevad indeksi, allikaversioonide, väljasaatmise, kogukulu ja sisend-/väljundmahu piirid kehtivad edasi; embedding'u etapp vajab vähemalt üht lubatud katset. Puuduv v2 seis, kataloog või vale skeemiräsi takistab ühise raja käivitamist. Vana v1 seis ning juhise/otsingusisendi varasemad versioonid jäävad ajalooliste plaanide lugemiseks toetatuks.

Ühist rada ei lülitatud olemasolevas serveriplaanis sisse. Admini käsitsi käivitatav enesetest säilib. UI-d ega kliendi importimispiiri ei muudetud.

## Kontrollitud ulatus

69 eri sihttesti läbisid `TZ=UTC` all. Korduskäivitused ei ole sellesse arvu topelt loetud.

| Testifail | Arv | Põhitõend |
| --- | ---: | --- |
| `rag-v2-unified.test.mjs` | 6 | ET/EN/RU numbrilised vahemikud, parandused, aja liik, tsitaadid, UTC-lähtekuupäev, S-/graafiviidete teisendus, katvus ning v1/v2 loendilepingud. |
| `rag-v2-unified.integration.test.mjs` | 2 | Päris kohaliku PostgreSQL/Qdranti/EstNLTK ja eraldatud vestlusandmebaasi ühine rada; vana indeksi vektorite taaskasutus uues põlvkonnas. |
| `rag-v2-dialogue-state.test.mjs` | 5 | Kasutajatsitaadid, paranduste kronoloogia, isiku/teema piir ja avaliku vastuse eraldamine. |
| `rag-v2-dialogue.test.mjs` | 3 | Senine jätkuvestluse leping. |
| `rag-v2-dialogue-config.test.mjs` | 1 | Uue konfiguratsiooni eeldused ning ajalooliste lepingute lugemine. |
| `rag-v2-dialogue-store.test.mjs` | 15 | Püsistus, taastamine, kustutamine ja senised õiguste/võistlusolukorra kontrollid. |
| `rag-v2-selection.test.mjs` | 9 | Piiratud tõendivalik ja viited. |
| `rag-v2-index-jobs.integration.test.mjs` | 11 | Jätkatav indekseerimine, kontrollpunktid ja vahemälu terviklus. |
| `rag-v2-selective-retrieval.integration.test.mjs` | 10 | Valikuline laadimine, sõltuvused ning õiguste- ja versioonipiir. |
| `rag-v2-structured-records.integration.test.mjs` | 7 | Kataloog, kontrollitud kontaktid ning senine KOV-vestlus. |

Uus seitsme pöörde katse liigub üldteadmisest Harku näidiskataloogi, parandab valla Koseks, võrdleb 2010–2014 ja 2020–2024, küsib lihtsamat selgitust ning eemaldab ajapiiri. Mõlema perioodi tõendid säilivad eraldi kvoodiga. Kokku 7 embedding'u ja 7 vastusekutset kohalikule testadapterile, planeerimiskutseid 0. Peidetud kontakt ega lubamatu ajakirjaallikas ei jõua mudelisisendisse. Teine katse tõendab tühja perioodi ja valimata, kuid loendatud dokumendi ligipääsu tagasivõtmise mõju taastamisele.

Muudetud JS/MJS-failide ESLint ning `git diff --check` läbisid. Mudelivastused, vektorid ja PDF-parser olid testadapteritega; testandmed sünteetilised. Tasulisi kutseid 0, tootmiskasutajate sisu ei loetud. Build, brauseri tervikrada, push/deploy ja pärismudeli sisuline kvaliteet `not_run` / `NOT_PROVEN`.

## Teostuse piirid ülevaatuseks

Tõendatud on valiku, viidete, mahu- ja õigusepiiride tehniline käitumine. Tõendamata on vaba olukorrakirjelduse mõistmise täpsus, semantiline järjestus, eituse/teise inimese tõlgendamine ning loomuliku vastuse kvaliteet. Praeguses pöördes tuvastatud kohanimi või number võib tuua kaasa ebaolulisi kandidaate; sama vastuse mudel peab selle ära tundma ja vajadusel täpsustama. Ta ei saa selle kutse kestel uue tõlgenduse põhjal automaatselt uut tõendit hankida.

Artiklikatkendite täpne säilitamine „selgita seda” jätkupöördes pole veel eraldi teostatud: tekstirada teeb uue piiratud valiku; KOV-kirjete senine detailifookus säilib. Aktiivse teema kuni 8 pöörde piir, 5000 indekseeritava tekstiosa piir, kogu korpuse deduplitseerimine, mahutöö/admini ühendus ja ammendav ajaline süntees jäävad eraldi tööks. Tasuline hindamisring ei ole arenduse ega selle ploki valmimise nõue. Aktiivne arendusjärjestus asub ainult SotsiaalAI.md-s.
