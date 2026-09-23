# RAG v2 järelülevaatus: EstNLTK, KOV-kataloog, vestluse seis ja ühine tõendivalik

23.09.2026. Koostaja: Claude Opus 5.5. Jätkab [esimest ülevaatust](rag-v2-opus-review-2026-09-23.md).
Ülevaadatud commit'id: `6119865fd..995b0990b` (13 commit'i, ~3500 rida; ADR-014…019). Tööpuus pole selle töö kohta commit'imata koodi.

**Meetod.** Lugesin ADR-014…019 ja kogu muudetud koodi (`lib/rag-v2/**`, `lib/chat/m4PilotServer.js`, adapterid, testid). Käivitasin uued sihttestid kohalikult. Väiteid kontrollisin lugevate skriptidega:
- EstNLTK aeg ja käändepaarid;
- sõnalise kanali järjestus PostgreSQL-i VALUES-andmetel;
- `resolveRecordScope()` 78 omavalitsuse nimega;
- **päris KOV-pakettide kataloog** päris vastuvõtukoodiga, kasutades scratchpad'i hoidlat ja mälupõhist kataloogi.

Tasulisi kutseid, serverimõõtmist ega repo muutmist (peale selle faili ja S2 viite) ei tehtud. Alamagente ei kasutatud.

## 0. Kokkuvõte

1. **Suund on õige ja edasiminek kiire.** Esimese ülevaatuse leiud on suuremas osas tehniliselt käsitletud:
   - L1 valekonfliktid on parandatud;
   - L5 EstNLTK asendas eesti Snowballi;
   - L6 piirkond ja `municipality_id` on normaliseeritud;
   - L7 eelkontroll ei laadi enam täispakette;
   - L2/L3 kohta lisandusid struktureeritud kirjed, kontaktivärav ja kontrollitud eksport;
   - L9/P1 kohta lisandus tsitaatidega vestluse seis ja deterministlik piirkond.
   Kood on hoolikas ning uued testid läbisid mul kohalikult: 17 unit-testi ning EstNLTK, KOV ja ühise raja integratsioonitestid (9/9).
2. **Päris KOV-andmetega kataloog ei tööta.** Kõik testid kasutavad väikest sünteetilist valda (6 teenust). Päris pakettidega jõuab mudelikontekst 70–136 tuhande tokenini (piir 12 000) ja Pärnu ületab kirjete piiri. Iga selline pööre lõpeb veaga. Ühisel rajal ebaõnnestub pärast piirkonna tuvastamist ka puhas ajakirjaküsimus.
3. **Enne päris kasutajaid on vaja turvavõrku.** Piloodirajal pole kriisituvastust. Deterministlik piirkonnatuvastus seob lause „Tahan end tappa” Tapa vallaga.
4. **Vestluse seis on liiga habras.** Iga tsitaadi või eelmise fakti ebatäpsus lükkab tagasi kogu nähtava ja juba makstud vastuse.
5. **EstNLTK-l on käituskulu:** külmkäivitus ~4,8 s pärast 60 s jõudeolekut ja iga päringu lisaanalüüs kõigi laaditud dokumentide tekstile.
6. **Järgmised prioriteedid:**
   - (1) KOV-kataloog päris andmetel tööle: kompaktne projektsioon, osaline tulemus vea asemel, päris valla vastuvõtukatse;
   - (2) turvalisus ja vastupidavus: kriisirada, piirkonnatuvastuse valepositiivid, vestluse seisu mahe tõrge;
   - (3) EstNLTK käitus ja mahupiirid.

## 1. Mis on nüüd hästi

| Varasem leid | Seis | Kontroll |
| --- | --- | --- |
| L1 valekonfliktid | **Parandatud.** `title` ei kasuta enam omavalitsuse nime kirje pealkirjana; kuupäevi võrreldakse kalendripäevana (`metadata-values.js`). | Koodi lugemine; ADR-015 loendus: KOV-ist jäi 1 päris `source_url` konflikt. |
| L2 KOV-struktuur | **Tehniliselt lahendatud, päris mahus mitte** (vt U1). Kirjed, väljad ja `relatedContacts/Forms/To` seosed on allikaankruga; mudel näeb valda. | Integratsioonitest 9/9. |
| L3 kontaktid | **Hea lahendus.** Paketikontakti ei näidata ilma registri (`ServiceMapEntry`) värskuskontrollita. Eksport seob paketi-ID registrikirje revisjoniga ja kontrollib seda lugemisel uuesti. Päris vastendus on tegemata. | Test läbis. |
| L4 vestluse päis | **Osaliselt.** Päis ja nummerdus eemaldati otsingutekstist. Stoppsõnade müra jäi alles (U6). | VALUES-mõõtmine. |
| L5 Snowball | **Parandatud EstNLTK/Vabamorfiga.** Minu 25 paarist ühtib 23 (puuduvad `tööd/töötu` ja `pere/perekonna`; need on eri lekseemid). 10 mitteseotud paarist ühtib 0. `toimetulek` leiab nüüd `toimetulekut`. | `lexicalQuery()` + mõõtmine. |
| L6 piirkond/`valid_at` | **Parandatud.** `regions` tuleb `municipality_id`-st. Teadmata kehtivus jääb teadmatuks. | Koodi lugemine. |
| L7 eelkontroll | **Parandatud.** Eelkontroll kasutab aadressiloendit ja analüsaatori tühja proovi; viited kontrollitakse paketi kaupa (`canonicalReferences`). | Koodi lugemine. |
| L9 vestlus | **Oluline samm.** Seis tuleb samast vastusekutsest. Piirkond tuvastatakse enne otsingut kanonilisest nimeloendist ning parandus tühjendab vana piirkonna. | Test 9/9. |
| L10 ülevaatusmärkused | Avatud. | — |
| L8 manifest/migratsioon | **Avatud.** Manifest räsib endiselt `messages/*.json`, põhiskeemi ja UI faile, nüüd lisaks veel kahte faili (`pilot/provenance.js:9-21`). RAG v2 skeemi seis serveris on mõõtmata. | Koodi lugemine. |

Positiivne arhitektuuriline valik: piirkond määratakse enne otsingut deterministlikult ja seis salvestatakse sama vastusekutse väljundist. Lisakutset pole. See on minu P1 soovitus korrektselt teostatud.

## 2. Uued leiud tõsiduse järjekorras

### U1 — Kriitiline: KOV-kataloog ei mahu päris valla korral piiridesse; pööre ebaõnnestub

- **Kus:** `lib/rag-v2/search/structured-record-source.js:11,44,106-107`; ühisel rajal `pilot/retrieval.js:142` ja `search/unified.js:100`.
- **Mõõtmine** (päris `Andmebaasi/KOV` paketid → `registeredSource` → `prepareIngest` → `StructuredRecordSource.retrieve`, scratchpad'i hoidla, testvektorid pole vajalikud):

  | Vald | Kirjeid | Kataloogi kanded | Mudelikontekst | Tulemus praeguste piiridega |
  | --- | ---: | ---: | ---: | --- |
  | Anija | 54 | 43 | 70 057 tokenit | `record_context_budget_exceeded` |
  | Harku | 64 | 54 | 91 017 | sama |
  | Kose | 70 | 61 | 99 653 | sama |
  | Tallinn | 85 | 85 | 135 598 | sama |
  | Jõhvi | 91 | 76 | 126 822 | sama |
  | Pärnu | 109 | 82 | 130 369 | `record_count_budget_exceeded` (kirjete piir 100) |

- **Põhjus:** projektsioon, mitte sisu. Anija 70k tokenist:
  - `sources` 39k: iga kirje-dokumendi kohta ~900 tokenit metaandmeid koos päritoluga (vald, maakond, `regions`, olek, allikatüüp);
  - `records` 16k: dubleerib samu väljaväärtusi, mis on juba tõendis;
  - `evidence` 15k: tegelik tekst, iga väli eraldi S-viitega.
- **Mõju:**
  - Esimene päris vald ei tööta.
  - Ühisel rajal (`995b0990b`) läbib iga pööre kataloogi, kui seisus on piirkond. Seega ebaõnnestub pärast „Elan Harkus” ka järgmine ajakirjaküsimus.
  - Kataloogi tõrget ei muudeta osaliseks vastuseks.
  - Sünteetilised testid (6 teenust vallas) seda ei tabanud. ADR-016 märkis „kogu omavalitsuse mahus kasutatavus pole mõõdetud”.
- **Parandus:**
  - kompaktne kataloog: ühe valla päis ja iga kirje jaoks võti, pealkiri, lühike kokkuvõte ning üks allikaviide;
  - päritolu ja metaandmed üks kord valla kohta või auditisse;
  - `records` ei tohi dubleerida tõendi teksti;
  - detailid ainult valitud kirjetele;
  - piiri ületamisel osaline kataloog koos märkega „näitan N / M” vea asemel;
  - vastuvõtutest suurima päris valla paketiga.

### U2 — Kõrge: dokumendipiir teeb täiskorpuse võimatuks; iga KOV-kirje on eraldi dokument

- **Kus:** `search/index-jobs.js:27,45` (≤1000 dokumenti plaanis), `search/unified.js:8,11` (≤1000 aadressiloendit), `indexing.js` (≤5000 tekstiosa).
- **Olukord:** ajakirjad (892), juhendid (185) ja õigusaktid (104) annavad kokku 1181 dokumenti. KOV lisab 4957 dokumenti, kokku 6138. Ühine rada ei saa isegi ilma KOV-ita täiskorpust teenindada. Aadressiloendi lugemine ja räsimine igas päringus on O(dokumendid).
- **Otsus vaja:** kas KOV-pakett on üks dokument (kirjed alamüksustena) või tõstetakse piire mõõdetud latentsusega. Soovitan esimest: vähem dokumente, sama allikaankur.

### U3 — Kõrge (turvalisus): kriisituvastus puudub; piirkonnatuvastus annab absurdseid valepositiive

- **Kriis:**
  - `lib/chat/safety.js:12` `detectCrisis()` ei ole piloodirajal kasutusel (`m4PilotServer.js`, `pilot/*`).
  - Ka vana muster ei tunne ära sõnastust „tahan end tappa”.
  - Tavavestlus on suletud (`503`), seega on uus olukorrapõhine assistent ainus rada ja kriisilause jõuab tavalisse RAG-i.
- **Piirkond:** `pilot/record-scope.js:26-37` ja `adapters/municipal-directory.js:11` (nimed = `displayName` + `baseName`). Mõõdetud 78 omavalitsuse nimega:
  - „Tahan end tappa” → `tapa_vald`;
  - „Kas kanepi tarvitamine on ohtlik?” → `kanepi_vald`;
  - „Kiili ei ole” → `kiili_vald`;
  - „Töötasin Jõgeval” → `jogeva_vald` (töökoht, mitte elukoht);
  - **„Elan Lääne-Harju vallas” → `ambiguous`**: liitsõna osa `lääne` sobitab kõik „Lääne-*” nimed, nii et õige täisnimi ei tööta.
- **Mõju:** vale valla kataloog läheb konteksti (ja U1 tõttu võib ebaõnnestuda kogu pööre). Kriisiolukorras ei ole kindlat ohutusvastust.
- **Parandus:**
  - kriisikontroll enne otsingut (olemasolev detektor + 112/usaldustelefonide vastus), seejärel laiem hinnang;
  - piirkonna vaste nõuab pärisnime analüüsi, ühtivat liitsõna täiskuju või omavalitsuse sõna;
  - `baseName` ei sobi ainult üldsõna lemmaga;
  - sidekriipsuga nimi peab ühtima tervikuna, mitte ühe `root_token`-i kaudu.

### U4 — Kõrge: vestluse seisu viga lükkab tagasi kogu nähtava vastuse

- **Kus:** `pilot/dialogue-state.js:71-126` → `pilot/service.js` (`projectDialogueAnswer`, `validateStateRegion`).
- **Olukord:** tsitaat peab olema kasutaja teksti täpne alamsõne. Iga eelmine fakt tuleb korrata sama `topic`, `subject` ja `support` väärtusega. Seis peab mahtuma 1800 tokeni sisse ning piirkond peab olema EstNLTK-ga ankurdatud. Päris mudel muudab tsitaatides sageli jutumärke, tühikuid või lõpupunkti ja parafraseerib teemasid.
- **Mõju:** tasuline vastus visatakse ära (`answer_rejected`); uut katset automaatselt ei tehta. Faktid kasvavad pöördest pöördesse ja väljundtokenid koos nendega.
- **Parandus:** avalda valideeritud vastus ka siis, kui seis on vigane. Jäta sel juhul eelmine seis kehtima, logi seisu tõrge ja mõõda tõrkemäär. Võrdle tsitaate normaliseeritult (tühikud, jutumärgid). Luba vanu fakte kanda serveri poolt, mitte nõuda mudelilt nende kordamist.

### U5 — Keskmine-kõrge: EstNLTK käituskulu

- **Kus:** `search/postgres.js` `units()` analüüsib igas päringus kõigi laaditud dokumentide väljad uuesti; `search/estnltk.js:15,72` (`idleMs` 60 s, ≤16 ootel tööd, üks protsess).
- **Mõõtmine:**
  - külmkäivitus + väike päring 4,8 s;
  - 73 tekstiosa / 93 500 märki analüüs 460–540 ms;
  - soojas protsessis päring 1 ms.
- **Mõju:**
  - Pikema juhendi (100+ tekstiosa) laadimine lisab päringule sekundeid, ühisel rajal kuni neli korda.
  - Jõudeoleku järel maksab iga uus vestlus ~5 s ooteaja.
  - Samaaegsetel kasutajatel tekib järjekord; 17. ootel töö saab `morphology_busy` vea.
- **Parandus:**
  - talleta indekseerimisel morfoloogiaväljade räsi ja kontrolli päringus räsi, mitte uut analüüsi;
  - hoia protsess eelkontrolli ajal soojas (pikem jõudeaeg serveris);
  - mõõda latentsust suure dokumendiga.

### U6 — Keskmine: sõnalise kanali üldsõnamüra püsib ja lemma võimendab seda

- **Tõend:** päring „Olen üksi kodus, raske on toimetulek, tööd ei ole.” saab EstNLTK-kanaliga termineid `vmetolema`, `vmeton`, `vmetole` ja `vmetei`. Stoppsõnadega lõik on esimene (7,32), koduteenuse lõik teine (2,20); Snowballiga oli suhe 6,48 : 1,22.
- **Liitsõnad:** osa `toime`, `elu` või `sotsiaal` sobitab väga laia hulga sotsiaaltöö tekste.
- **Parandus:**
  - DF-põhine summutus (korpuse andmetest, mitte käsitsi loendist);
  - `root_tokens` väiksema kaaluga eraldi `tsvector`-kaalus;
  - mõõtmine märgistatud valimil (esimese ülevaatuse P2).

### U7 — Madal-keskmine: ajaloo taastamine ja plaaniseos

- Ühise raja pakett nõuab taastamisel **aktiivset** põlvkonda ja kogu nähtava aadressiloendi täpset räsi (`pilot/retrieval.js:36-41`, `unified.js:106-111`). Vana rada lubas kontrollida ka mitteaktiivset `ready` põlvkonda. Piloodis on vanad pöörded niikuinii seotud konfiguratsiooniräsiga, seega on see praegu väike, kuid püsiva vestlusajaloo jaoks vale suund.
- `DEFAULT_RETRIEVAL_PROFILE` muutus EstNLTK profiiliks (`profiles.js:6`) ja `searchConfig()` vaikimisi aadressiloendiks sai v2 (`indexing.js`). Ilma `profileId`-ta plaan saab vaikselt teise profiili ning admini `indexSnapshot()` loob uue identiteediga põlvkonna. `rag-v2-pilot-plan.mjs` annab `profileId` selgesõnaliselt, seega on risk madal. Parem oleks puuduvat välja tagasi lükata kui vaikimisi muuta.

### U8 — Madal: käituskeskkonna sõltuvus

- `estnltk.js:8` leiab tööfaili `process.cwd()` järgi ja Pythoni `RAG_V2_ESTNLTK_PYTHON` või `python` kaudu. Minu shellis muutuja puudus; `python`-is EstNLTK-d pole, seega tuleb viga `morphology_unavailable` (fail-closed, mis on õige).
- Serveris on EstNLTK S1.0 järgi eraldi keskkonnas. Deploy-skript Pythoni sõltuvusi ega RAG v2 migratsioone ei halda.

## 3. Kontrollitud alad, kus viga ei leidnud

- **EstNLTK protokoll:** päringu ID, versioon, vastuse vorm ja suurus, ajapiir, protsessi taaskäivitus ning ingliskeelsete/vene tüvede eraldi kanal.
- **Indeksi vahemälu kopeerimine v2 nimeruumi:** päris vektorite võrdlus säilib ja uut tasulist vektorit ei looda (`indexing.js`, `cachedIndexVector`).
- **Kontaktivärav:** siht-ID-d, nimi ja kanal ei leki ilma kinnituseta; kontroll kordub enne saatmist, pärast vastust ja taastamisel.
- **Ühise paketi viidete ümbernummerdamine:** sama `evidence_id` konflikt tõrjutakse; kirje ei pääse tekstiraja kaudu kontaktikontrollist mööda.
- **Vestluse seisu kronoloogia** ja isikute/teemade piir: sama ülesehitus, mis ADR-018 testides.

## 4. Järgmised kolm prioriteeti

1. **KOV päris andmetel (U1, U2).**
   - Kompaktne kataloogiprojektsioon ja osaline tulemus vea asemel.
   - KOV-pakett ühe dokumendina või mõõdetud piirid.
   - Vastuvõtt: Tallinna, Pärnu ja Anija päris paketid läbivad `review → publish → index → catalogue` raja alla piiri; ühe pöörde kontekst on mõõdetud; teise valla kirjet ei jõua konteksti.
   - Mudelikutseid pole vaja.
2. **Turvalisus ja vastupidavus (U3, U4).**
   - Kriisirada enne otsingut.
   - Piirkonnatuvastus ilma üldsõna- ja liitsõnaosa-valepositiivideta.
   - Vestluse seisu mahe tõrge.
   - Vastuvõtt: valepositiivsete lausete komplekt, sh ülalnimetatud laused, ja sidekriipsuga nimed.
3. **EstNLTK käitus ja otsingumüra (U5, U6, L8).**
   - Räsipõhine morfoloogiakontroll, soe protsess ja DF-summutus.
   - Manifesti kitsendamine ning serveri RAG v2 skeemi ja Python-keskkonna kontroll enne kataloogiraja sisselülitamist.

## 5. EstNLTK kasutamine selles masinas

Kohalik keskkond on olemas: `tmp/rag-v2-estnltk-env`, estnltk 1.7.5 / estnltk-core 1.7.5. Node leiab selle ainult keskkonnamuutujaga:

```powershell
$env:RAG_V2_ESTNLTK_PYTHON = (Resolve-Path tmp/rag-v2-estnltk-env/Scripts/python.exe).Path
```

Dev-serveri jaoks peab sama muutuja olema serveriprotsessi keskkonnas (näiteks kohalikus `.env` failis). Muidu annavad EstNLTK profiiliga preflight ja otsing vea `morphology_unavailable`.
