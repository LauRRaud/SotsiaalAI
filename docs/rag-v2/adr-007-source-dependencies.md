# ADR-007: allikasse ankurdatud väited ja sõltuvuste otsing

07.09.2026. M3 esimese arendusploki leping. Projekti jooksev seis asub SotsiaalAI.md S1.0/S2-s.

## Probleem ja otsus

Tekstiosade struktuursed naabrused ei ütle, milline tingimus käib millise väite kohta. Lisame valikulise `metadata.knowledge` sisendi, millest ingest teeb muutumatud allikasse ankurdatud väite- ja sõltuvusobjektid. Indekseerimine säilitab need PostgreSQL-is. Eraldi otsinguprofiil toob põhileidude kõrval kaasa seose ja sihtväite algteksti, sealhulgas teisest lubatud dokumendist.

Kõik imporditud väited ja seosed saavad seisu `source_anchored_unreviewed`. Täpne tekstikoht on tehniliselt kontrollitud; väite tõlgendust, seose õigsust ega kasutajale kohaldumist see ei kinnita. Indeksi avaldamine ei muuda kontrolliseisu. Admini vastuvõtuvaade näitab väidete/sõltuvuste arvu ja seda piiri.

## Sisend ja päritolu

Näide alloleva väljamõeldud PDF-i jaoks: leheküljel 1 on täpselt lause „Näidistegevus vajab kuiva mulda.” ning leheküljel 2 „Kuiv muld on selle näite tingimus.” See on andmevormingu näide, mitte valdkonnareegel.

```json
{
  "schema_version": "rag-v2/knowledge-input-1",
  "cards": [
    {
      "key": "activity",
      "kind": "assertion",
      "statement": "Näidistegevus vajab kuiva mulda.",
      "subject": "Näidistegevus",
      "predicate": "vajab",
      "object": "kuiva mulda",
      "scope": "Väljamõeldud dokumendi näidistegevus",
      "anchors": [{ "pdf_page": 1, "quote": "Näidistegevus vajab kuiva mulda." }]
    },
    {
      "key": "dry-soil",
      "kind": "condition",
      "statement": "Kuiv muld on selle näite tingimus.",
      "scope": "Sama väljamõeldud näide",
      "anchors": [{ "pdf_page": 2, "quote": "Kuiv muld on selle näite tingimus." }]
    }
  ],
  "dependencies": [
    {
      "key": "activity-needs-soil",
      "type": "REQUIRES",
      "from": "activity",
      "targets": [{ "key": "dry-soil" }],
      "operator": "all",
      "scope": "Sama väljamõeldud näide",
      "anchors": [{ "pdf_page": 1, "quote": "Näidistegevus vajab kuiva mulda." }]
    }
  ]
}
```

See objekt läheb olemasoleva metadata JSON-i `knowledge` väljale. Lubatud väiteliigid on `assertion`, `condition`, `exception`, `definition`. Osapoolte kolmik `subject/predicate/object` on valikuline tervik; kohaldamisala `scope` ja allikaankrud on kohustuslikud. Ajapiirid tuleb selles plokis säilitada väite/scope tekstis ja ankrus; eraldi ajaline järeldusmootor puudub.

Iga väide ja sõltuvus kannab oma ankrut. `pdf_page` on PDF-i 1-põhine lehekülg. `quote` peab vastama parseri `raw_text` täpsele lõigule. Korduva tsitaadi korral on nõutud `start`, 0-põhine JavaScripti UTF-16 nihe sama lehe tekstis. Kõik tsitaadi mittetühikud peavad kuuluma kanoonilistesse tekstispannidesse; eemaldatud päise või puuduva teksti ankur lükatakse tagasi. Ingest salvestab ka arvutatud lõppnihke, span-ID-d ja metadata vara räsi. Muudetud sõnastus, ankur või võltsitud kontrolliseis ei läbi bundle'i päritolukontrolli.

Sisend on piiratud: 256 väidet, 512 sõltuvust, 16 sihtväidet ühe seose kohta ning 8 kuni 4000 märgi pikkust ankrut objekti kohta. Võõraid välju ei aktsepteerita. Sama dokumendi siht on `{key}`; välise sihi jaoks peavad koos esinema `{key, document_id, version_id}`. Viimased on kanoonilised `document_<sha256>` ja `version_<sha256>` ID-d. Seos ei kandu automaatselt dokumendi uuele versioonile. Sama tenant'i piires genereeritud objektide ID-d ning bundle'i ja indeksi võrdsuskontroll säilitavad päritolu.

## Seoste tähendus ja läbimine

| Tüübid | Tähendus ja otsingukasutus |
| --- | --- |
| `MENTIONS`, `RELATED_TOPIC` | Otsinguabi; ei tekita kohustuslikku sisulist sõltuvust. |
| `CITES`, `DESCRIBES` | Allikaseos; ei tähenda iseenesest kohaldamise eeltingimust. |
| `REQUIRES` | `from` vajab `targets` tingimusi. `all` säilitab JA-rühma ja `any` VÕI-rühma. |
| `EXCEPTION_TO`, `DEFINES`, `QUALIFIES`, `SUPERSEDES` | `from` kirjeldab sihtväite erandit, määratlust, täpsustust või asendust. Otsing saab leitud põhiväitele tuua sissetuleva täpsustuse ja leitud täpsustusele selle sihtväite; väljundis jääb seose algne suund samaks. |

`any` on lubatud ainult `REQUIRES` jaoks. Ülejäänud tüüpidel on `all` loend seose sihtidest, mitte automaatne loogikareegel. Süsteem ei järelda, et imporditud `SUPERSEDES` tühistab teise teksti kehtivuse või et `DEFINES` on autoriteetne definitsioon.

Neli tingimusolekut on `true`, `false`, `unknown`, `conflict`; väike rühmafunktsioon ei teisenda puuduvaid kasutajafakte vääraks. Konflikt säilib ka muidu lahenduva alternatiivi juures. Päringus puudub veel kasutajafaktide sidumine: imporditud sõltuvuse `applicability` on alati `unknown`.

## Indeks ja päringupiirid

Olemasolev PostgreSQL-i JSONB objektitabel talletab `knowledge_card` ja `dependency` objektid dokumendiversiooni küljes. Need ei vaja uut tabelit, migratsiooni ega eraldi graafiteenust. Semantiliste sihtide dokumendi- ja versiooniseos asub kontrollitud JSON-is; olemasoleva struktuurgraafi `from_id/to_id` veerge selleks ei kasutata. Võrreldakse nii muutumatut bundle'it kui selle indeksiobjekte.

Väited ei saa eraldi embedding'ut: otsing leiab algtekstiüksuse ja seob selle span'ide kaudu väidetega. `knowledge` olemasolu lisab ingesti versiooniidentiteedile teadmuskihi lepingu versiooni; ilma selle sisendita säilivad senised versiooni-ID-d ja tühjad `knowledge_cards`.

`hybrid-source-dependencies-v1` ja `vector-source-dependencies-v1` on eraldi valitavad profiilid. Vaikimisi ja ajaloolised profiilid säilitavad oma valikupiirid. Uutes profiilides on 5 põhileidu, kuni 4 sõltuvuse algteksti lisandust, kuni 9 lõppüksust ja 6000 kontekstitokenit. Struktuurne laiendus on neil välja lülitatud. Läbimise piir on 16 väidet ja 16 eraldi seost; tsüklid ei ava piiramatut läbimist. Seemned järjestatakse leiu järgu ja stabiilse ID järgi. Päringu üldleping lubab eraldi `semanticGraph` lippu ning rangelt piiratud eelarveid.

Laiendus kasutab sama tenant'i, aktiivse põlvkonna, dokumendifiltrite ja õigustega allikaid. Enne väljundit kontrollitakse ligipääsu uuesti. Mudelile antakse väite võtmed `K1…`, seose suund, operaator, kohaldamisala, kontrolliseis ning päris `S1…` viited. Väide või seos jõuab sinna ainult siis, kui kõik ankru span'id on lubatud algtekstikontekstis. `K` võtmed ei ole vastuse viited.

Puuduv versioon, ligipääs, ankru tekstiosa või eelarve jätab nähtava `incomplete` seisundi. Ligipääsuta allika ID-d, pealkirja ega teksti mudeli sõltuvuskonteksti ei lisata. Graafikonteksti jaoks jäetakse ruumi; liiga mahuka objekti asemel säilib sõnaselge puudulikkuse märge. `included` tähendab ainult leitud teadaolevate sõltuvuste kaasamist: `corpus_completeness` jääb `not_assessed`.

Piloodi tõendipakett säilitab sama sõltuvusobjekti auditiks ja taastamiseks. Vastusejuhise versioon 7 käsitleb seda allikaga kontrollitava otsinguabina; varasemate juhiseversioonide salvestatud vastused on loetavad. Olemasolevaid piloodiplaane ei aktiveerita ega indekseid selle koodimuudatusega uuesti avaldata.

## Selle ploki tõend ja edasine töö

- `TZ=UTC node --test tests/rag-v2-knowledge.test.mjs`: 6 sihttesti PASS. Kontrollitud on päris ingesti kood koos sünteetilise parserisisendiga, ankrute ja versiooni päritolu, PostgreSQL-i importija SQL-kutsed kliendi asendajaga, dokumentidevaheline otsing ja viidete sidumine, vale/puuduv versioon või omanik, jooksvalt tühistatud ligipääs, eelarve, erandi mõlemalt poolelt leidmine, tsüklid ning nelja oleku rühmad. Võrk on testis keelatud.
- Varasemad sama ploki kitsad regressioonikontrollid: teadmuskihita ingesti I-02 identiteet, seniste otsinguprofiilide piirid ja piloodi konfiguratsioonilüliti PASS.
- Muudetud JS/JSX failide ESLint, `i18n:check` ja `git diff --check`: PASS. `TZ=UTC npm run build`: PASS; kohalik logi `tmp/rag-v2-m3-build-20260907.log`.
- Kood `144e75368fe6e465d2134288930c36f4291d6bcc` on push'itud ja tavapärase serverijuurutusega avaldatud. Serveri tootmisbuild PASS; kohalik juurutuslogi `tmp/rag-v2-m3-deploy-20260907.log`. Pärast juurutust mõõdeti serveri ja `origin/main` sama SHA, puhas serveritööpuu, aktiivne frontend ning `/vestlus` HTTP 200. See tõendab juurutust ja käivitumist; sõltuvusprofiili ega pilooti ei aktiveeritud.
- Päris PostgreSQL-i kirjutamine/tagasilugemine ja uute väidete adminivaade: `not_run`. Sama koodi sihttest ei tõenda DB tehingut, tegelikku teenuseõiguste muutust ega brauseri rada. Sisulist hindamisringi ega mudelikutseid ei tehtud.

Enne uue profiili kasutuselevõttu tuleb olemasolevas lubatud arenduskorpuses käsitsi importida ankurdatud metadata, kontrollida PDF-i ja vastuvõtuvaate väitearve, avaldada uus indeks ning lugeda versiooni objektid tagasi. Seejärel tuleb olemasoleva otsingurajaga kontrollida kaugtingimuse algteksti ja `S` viiteid ning sihtallika õiguse eemaldamisel/versiooni vahetamisel puudulikkuse märget. Selleks ei lisata uut automatiseeritud sondi.

Täieliku M3 jaoks jäävad avatuks väidete/seoste läbivaatamise ja parandamise töövoog, üldine allikast rikastamine, kontrollitud teadmiste eristamine kontrollimata kandidaatidest ning kasutajafaktide ja struktureeritud ajapiiride sidumine. Tuhande artikli skaleerimine on eraldi järgmine plokk: olemasolev otsing loeb veel kogu lubatud korpuse ja indekseerimisel säilib 5000 tekstiosa piir. Käesolev plokk ei tõenda kogu M3 ega suure korpuse kasutusvalmidust.
