# RAG v2 terviklik analüüs: kas assistent jõuab olukorrast abini?

24.09.2026. Koostaja: Claude Opus 5.5.

See dokument lõpetab [23.09 ülevaatuse](rag-v2-opus-review-2026-09-23.md), mis jäi konteksti piiri tõttu poolikuks, ning täiendab [järelülevaatust](rag-v2-opus-followup-review-2026-09-23.md). Uus sisu on kolmes osas:
- **päris andmetel mõõdetud tõend** ilma tasuliste kutseteta;
- **kolme kasutusjuhu lõplik hinnang** praeguse koodi järgi;
- **minu tehtud parandused** ([ADR-020](../rag-v2/adr-020-municipality-scope-bibliography-periods.md), commit `fe1101ff`).

Ülevaadatud HEAD: `995b0990b`. Aktiivne tööseis jääb SotsiaalAI.md-sse.

**Meetod.** Kõik mõõtmised olid kohalikud ja lugevad, välja arvatud seansi ajutine `TEMP` tabel ja scratchpad'i hoidlad:
- 05.09 päris `text-embedding-3-large` vektorid kasutati uuesti;
- päris KOV-paketid ja ajakirjade metaandmed;
- 78 kanoonilist omavalitsust;
- kohalik PostgreSQL/Qdrant, EstNLTK 1.7.5 ja eraldatud M4 andmebaas.

Tasulisi kutseid 0, tootmisandmeid ei loetud ja alamagente ei kasutatud.

---

## 0. Vastus lühidalt

| Kasutusjuht | Seis praeguse koodiga |
| --- | --- |
| Ajakirjast teadmise leidmine | **Õigel teel ja nüüd mõõdetud.** Omaniku päris võrdlusandmestikul on EstNLTK-hübriid parim rada: 17/18, kontrollosas 6/7. Puhas vektor saab 15/18 ja vana hübriid 13/18. Mudel saab nüüd ka aasta, ajakirja, numbri ja lehekülje (ADR-020). Kasutajaliidese allikapaneel näitab piloodis endiselt ainult pealkirja. |
| Kahe perioodi võrdlus | **Oli päris korpusel praktiliselt tühi.** 848/892 artiklil on ainult aasta ja filter nõudis täpset kuupäeva. ADR-020 lubab aastat siis, kui kogu aasta mahub perioodi. Võrdlus põhineb endiselt valimil (2 algkatkendit perioodi kohta) ning artiklite deduplitseerimine puudub. |
| KOV-i teenus ja kontakt | **Arhitektuur on õige, päris andmetel ei tööta.** Kataloogi projektsioon on päris valla puhul 70–136 tuhat tokenit (piir 12 000) ja pööre ebaõnnestub. Kontaktid on usaldusväärsed ainult kontrollitud registrieksportimise kaudu, mille päris vastendus on tegemata. |
| Vabast olukorrakirjeldusest abini | **Osad on olemas, rada ei ole kasutajakõlblik.** Valla tuvastus on nüüd täpne (ADR-020) ning vestluse seis ja parandused töötavad. Puudu on kataloogi mahulahendus, kriisikaitse ja vestluse seisu mahe tõrge. Päris vektoritega olukorramõõtmises (§2.7) leidis vektor asjakohase allika 12/12 ja hübriid 10/12. |

Kokkuvõttes pole süsteem valmis päris kasutajatele, kuid ülejäänud takistused on konkreetsed ja mõõdetavad. Suurim protsessiõppetund: **kolm blokeerivat viga peitusid ainult sünteetilistel andmetel tehtud vastuvõtu taha**:
- 98% KOV-kirjeid oli avaldamisel blokeeritud;
- kataloog ületas mahu 6–11 korda;
- periood jättis välja 95% artiklitest.

## 1. Mis jäi pooleli ja mis on nüüd tehtud

| Pooleli jäänud osa | Tulemus |
| --- | --- |
| Vektorikanali ja hübriidi päris kvaliteet | Mõõdetud salvestatud päris vektoritega; 05.09 serveritulemus taasesitati täpselt (§2.1). |
| Kolme vana punase testi põhjus | Täpsustatud: tegu pole andmete triiviga (ADR-011 selgitus oli ebatäpne). Põhjused on `ad44c302e` kuupäevapoliitika ja normaliseerimise muutused. Üks test on ADR-020-ga põhjendatult roheline; teine annab päris signaali (§2.3). |
| Päris andmete teekonnad | KOV-kataloog, ajakirja perioodid, embedding'u taaskasutus ja piirkonnatuvastus on mõõdetud (§2.2–2.5). |
| Hüpoteesi lõpphinnang | §5. |
| Parandused | ADR-020: valla tuvastus, bibliograafia, aastapõhine periood. Lisaks parandati `rag-v2-knowledge.test.mjs` katkine mock. |

## 2. Mõõdetud tõend

### 2.1. Otsing päris vektoritega (05.09 omaniku võrdlusandmestik)

Andmestik: 8 dokumenti, 69 tekstiosa, 21 küsimust, millest 18 on täielikult vastatavad. Arendusosas on 11 küsimust ja esmakordselt avatud kontrollosas 7. Kasutati 98 salvestatud päris vektorit. Hindamine kasutas muutmata `retrieve()` ja `evaluateRetrieval()` funktsiooni mälupõhiste adapteritega:
- sõnaline järjestus toodab sama SQL-i seansi `TEMP` tabelil;
- vektorjärjestus on salvestatud vektorite koosinussarnasus.

**Valideerimine:** vana sõnalise lepinguga taasesitus andis täpselt 05.09 serveriraporti arvud kõigis 12 lahtris (7/18, 15/18, 13/18, 11/18; arendus- ja kontrollosa).

| Sõnaline leping | Ainult sõnaline | Vektor | **Hübriid** | Hübriid + struktuurinaabrid | Hübriid kontrollosas | Hübriidi perekonnad |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vana `simple` | 7/18 | 15/18 | 13/18 | 11/18 | 3/7 | 7/12 |
| Snowball ET/EN/RU | 8/18 | 15/18 | 14/18 | 12/18 | 4/7 | 8/12 |
| **EstNLTK** | **11/18** | 15/18 | **17/18** | 11/18 | **6/7** | **11/12** |

Näitaja on „kogu vajalik tugi lõppkontekstis”. Hübriidi top-1/3/5 EstNLTK-ga oli 7/10/17 (vana 7/10/13). Regressioonikomplektis sai hübriid 7/7 ja top-1 tõusis 5-lt 6-le. EstNLTK hübriidil jäi puudu üks kontrollküsimus (`ethics-peer-discussion-et`, esimene õige lõik 7. kohal).

**Järeldused:**
- Vana sõnaline kanal halvendas hübriidi vektorist nõrgemaks. EstNLTK-kanal teeb hübriidist parima raja. `hybrid-estnltk-dependencies-v1` vaikeprofiilina on põhjendatud.
- Ajalooline naabrivalik (topK 3 + naabrid) jäi igal lepingul alla. Mõõtmine ei erista naabrite mõju kahe algtulemuse kaotamisest ning praegust `hybrid-ranked-first-neighbors-v2` profiili (5 algtulemust, kuni 7 lõppkatkendit) ei mõõdetud. Järeldus kehtib ainult ajaloolise valiku kohta (Codexi ülevaatuse täpsustus).
- Top-1 ei paranenud. Õige lõik tuleb top-5 hulka, seega peab vastusekontekst jääma 5–9 lõigu juurde.
- **Parandus minu esimesele ülevaatusele:** väide, et sõnaline kanal kahjustab hübriidi, kehtis vana kanali kohta. Hästi sõnastatud küsimuste puhul EstNLTK-kanal aitab. Vaba olukorrakirjelduse korral jääb stoppsõnamüra alles (järelülevaatuse U6) ja see halvendab hübriidi (§2.7).
- Valim on väike (18 küsimust, kontrollosas 7). Otsuse kinnitamiseks on vaja suuremat märgistatud valimit (§6.3).

### 2.2. Ajakirjade metaandmed ja perioodid

`Andmebaasi/REGISTER.json` 892 ajakirja-metaandmest on ülatasemel `publication_date` **0-l**. 44-l on see ainult metaandmete variantides ja 848-l on ainult `year`.

Commit `ad44c302e` (08.09) lõpetas esilehe PDF-kuupäeva kasutamise avaldamiskuupäevana; see jääb ainult kandidaadiks. Seetõttu on päris 2016. aasta PDF-artiklil `publication_date = null` ja `publication_year = 2016`. Ka terve 2016. aasta filter jättis selle välja. Ühtlasi ei jõudnud aasta, ajakiri ega number mudelini (`bibliography` = pealkiri, autorid, `publication_date`), kuigi väljad olid olemas: `Sotsiaaltöö`, `1/2016`, lk `3–6`.

ADR-020 lahendab mõlemad. Aastaga allikas kuulub perioodi, kui kogu aasta mahub sinna, ja katvusraport loendab ainult aastaga dokumente eraldi. Päris korpusel on see mõõdetud ainult metaandmete tasemel. Uut v3 indeksit päris ajakirjadega ei ehitatud.

### 2.3. Embedding'u sisend muutub normaliseerimisega

05.09 kaheksa lähtefaili uus vastuvõtt praeguse koodiga (`layout-v4-nul-safe` → `source-structure-v8`) muutis embedding'u sisendit **7 dokumendil 8-st**. Samade vektoritega oleks taaskasutatav ainult **41/69 tekstiosa**, M2.2 põhiartiklil **3/16**. Erinevused on reavahetustes ja tühikutes, mitte sisus.

Seega on vana test `total_input_tokens 12420 ≠ 12429` päris signaal. Pärast uut vastuvõttu ei saa M2.2-s makstud vektoreid enamasti taaskasutada. ADR-idel on sõnastus „varem salvestatud pärisvektoreid saab taaskasutada”; see kehtib ainult siis, kui allikat uuesti vastu ei võeta.

Rahaliselt on kulu väike: hinnaga 0,13 USD / miljon tokenit on kogu korpuse (~7–9 miljonit tokenit) uus embedding hinnanguliselt 1–1,5 USD. Iga kord on aga vaja uut luba ja uut indeksit. Soovitus: stabiliseeri embedding'u sisend üks kord (näiteks tühikute normaliseerimine `input_text`-is uue `input_version` all) ja lepi kokku, et parseri kujundusmuudatus seda enam ei muuda.

### 2.4. KOV päris andmetel

Mõõtmine järelülevaatusest (U1), päris paketid ja päris vastuvõtukood:

| Vald | Kirjeid | Kataloogi mudelikontekst | Piir |
| --- | ---: | ---: | --- |
| Anija | 54 | 70 057 tokenit | 12 000 → pööre ebaõnnestub |
| Harku / Kose | 64 / 70 | 91 017 / 99 653 | sama |
| Tallinn / Jõhvi | 85 / 91 | 135 598 / 126 822 | sama |
| Pärnu | 109 | 130 369 | kirjete piir 100 ületatud |

Anija 70k tokenist moodustavad 39k iga kirje-dokumendi korratud metaandmed koos päritoluga, 16k kirjete väljade dubleeritud väärtused ja 15k tegelik tekst. KOV-pakettide 819 kontaktikirjest ei ole ühelgi telefoni ega e-posti. Kontrollitud eksport (ADR-017) on õige lahendus, kuid päris vastendust pole tehtud.

### 2.5. Valla tuvastus (parandatud ADR-020-ga)

78 kanoonilise omavalitsuse iga nime kaks kohakäänet, EstNLTK süntesaatoriga genereeritud (156 lauset „Elan …”):

| | Õige | Õigesti mitmetähenduslik | Vale | Tuvastamata |
| --- | ---: | ---: | ---: | ---: |
| Enne | 106 | 16 | 34 | 0 |
| **Pärast** | **138** | 16 | **0** | 2 („Läänerannas/-l”) |

12 igapäevalausest andis vale valla enne 5, pärast 3. Kadusid „Tahan end tappa” → Tapa ja „Mulk” → Mulgi. Järele jäid sõna-sõnalt samad kujud „kanepi”, „rae” ja „Kiili”; neid ei saa ilma pärisnime analüüsita eristada ja vastusemudel peab neid käsitlema ajutistena.

### 2.6. Käitus ja testikomplekt

- **EstNLTK:** külmkäivitus ~4,8 s. Tööprotsess sulgub 60 s jõudeoleku järel. Iga päring analüüsib laaditud dokumentide väljad uuesti (73 tekstiosa ~0,5 s). Ootel võib olla kuni 16 tööd.
- **`rag-v2-knowledge.test.mjs`** oli alates `25d103663` punane (importeri mockil puudus `pool`). Ükski hilisem ADR-i testiloend seda faili ei sisaldanud, seega jäi viga märkamata. Parandatud.
- **Testide käivitamine:** mitu komplekti vajab keskkonnamuutujaid (`RAG_V2_ESTNLTK_PYTHON`, `M4_TEST_DATABASE_URL`, `RAG_V2_INPUT_ROOT`) ja iga ADR loetleb eri alamhulga. „Läbinud testid” ei ole seetõttu üheselt korratav. Soovitus: üks dokumenteeritud RAG-i sihtkomplekti käsk koos nõutud keskkonnaga.

### 2.7. Vaba olukorrakirjeldus päris vektoritega (omaniku loal, 24.09)

Tekstid saadeti embedding'uks serveri teenusekeskkonna kaudu: 1 kutse, 85 sisendit, 28 622 tokenit, umbes 0,0037 USD. Võtit välja ei loetud ega trükitud. Korpus oli ADR-011 valim (73 tekstiosa: kaks artiklit, KOV-i määrus ning Anija teenus, toetus ja kontakt). Hinnati 12 ET/EN/RU olukorra- või teemalauset; asjakohased allikad määrasin mina.

| Rada | Asjakohane allikas top-5-s | Märkus |
| --- | ---: | --- |
| Vektor | **12/12** | 11 korral esimesel kohal, sh EN ja RU laused |
| EstNLTK-hübriid | 10/12 | „Kellega vallas rääkida…” 22. kohal, „…transporti?” 6. kohal |
| EstNLTK-sõnaline | 4/12 | vene lause ja kontaktiküsimus ei leidnud midagi |

**Järeldus:** hästi sõnastatud artikliküsimustes aitab EstNLTK-kanal (§2.1). Vaba olukorrakirjelduse korral tõrjub sõnaline kanal RRF-is vektori õiged vasted madalamale. Olukorra- ja kohaliku abi pööretes tuleks vektorit kaaluda rohkem, näiteks kanalipõhise RRF-kaaluga, või kasutada sõnalist kanalit peamiselt nimede ja numbrite jaoks. Valim on väike ja otsus vajab märgistatud komplekti (§6.3).

## 3. Kolm kasutusjuhtu praeguse koodiga

**Ajakiri: „Milliseid lahendusi on kirjeldatud omastehooldajate koormuse vähendamiseks?”**
- `omastehooldaja*` ühtib EstNLTK-ga ja hübriid on mõõdetult parim rada. Mudel näeb nüüd aastat, väljaannet ja lehekülgi.
- Piirid:
  - ainult indekseeritud osa korpusest (≤5000 tekstiosa ja ≤1000 dokumenti; täiskorpus ei mahu);
  - uurimistulemuse ja arvamuse eristus on ainult juhises;
  - allikapaneel näitab piloodis pealkirja.

**Periood: „Kas omastehoolduse käsitlus on kümne aastaga muutunud?”**
- Numbrita küsimus ei loo perioodiradu. Vastus tuleb üldisest tõendist ja juhis peab küsima täpsustust.
- „2016–2020 vs 2021–2026” loob kaks rada, igaühes 2 algkatkendit. ADR-020 järel kuuluvad perioodi ka aastaga artiklid.
- Tulemus on valim, mitte korpuseülene süntees. Loendusühik on indekseeritud dokument ja deduplitseerimist pole.

**Olukord → KOV → kontakt:** vt §4.

## 4. Olukorrakirjeldusest abini — lõplik jälg

| Samm | Seis | Märkus |
| --- | --- | --- |
| Kriisilause („ei jaksa enam elada”) | ✘ | Piloodirajal kriisikontrolli pole; `detectCrisis()` pole kasutusel ja ka see tunneb ära ainult osa sõnastusi. |
| „Olen üksi kodus, raske on toimetulek, tööd ei ole” | ⚠ | Vald on teadmata ja juhis palub küsida vajaduse ja valla. Teadmisrada otsib; sõnalises kanalis on stoppsõnamüra, semantiline kvaliteet mõõtmata. |
| „Elan Harkus” / „Lääne-Harju vallas” | ✔ | Deterministlik ja täpne (ADR-020). Mainimine on allikaulatus, mitte tõendatud elukoht. |
| Valla teenusekataloog | ✘ | Päris valla kataloog ületab piiri 6–11 korda; pööre ebaõnnestub. |
| „Kellele helistan?” | ⚠ | Kontakt on ainult kontrollitud registrist; päris vastendus on tegemata. Muidu seos „unavailable” (õige, aga ilma kanalita). |
| „Mõtlesin hoopis Kose valda” | ✔ | Parandus vahetab ulatust ja seis säilitab tsitaadid. |
| „Selgita lihtsamalt” | ✔/⚠ | KOV-kirjete fookus säilib; artiklirada teeb uue valiku. |
| Vestluse seis | ⚠ | Iga tsitaadi või eelmise fakti ebatäpsus lükkab tagasi kogu tasulise vastuse. |

## 5. Hüpoteesi lõpphinnang

**Säilita:**
- EstNLTK-hübriid, sest see on mõõdetult parim;
- muutumatud allikaversioonid ja kanoonilised viited;
- struktureeritud KOV-kirjed koos kontrollitud kontaktiväravaga;
- deterministlik valla ulatus;
- üks vastusekutse pöörde kohta koos seisuga.

**Muuda:**
- KOV-kataloogi projektsioon: kompaktne, osaline tulemus vea asemel;
- vestluse seisu mahe tõrge;
- päringuaegne morfoloogiakontroll räsiga;
- embedding'u sisendi stabiliseerimine;
- allikapaneeli bibliograafia;
- kriisirada.

**Loobu või lükka edasi:**
- ajalooline `topK 3 + naabrid` valik; praegust naabriprofiili võrdle enne otsust sama algtulemuste kvoodiga;
- LLM-väitegraafi laiendamine, sest andmeid pole ja kasu pole näidatud;
- uued lepinguversioonid ilma aegumispoliitikata. Koodis on juba 82 lepingu- ja versioonitunnust. Hoia loetavana ainult versioonid, millele salvestatud vestlused veel viitavad.

**Protsess:** iga plokk lõpeb **päris andmetega võrguühenduseta vastuvõtuga**. Selle kulu on null ja see oleks ennetanud kõik kolm blokeerivat viga.

## 6. Järgmised sammud prioriteedi järjekorras

1. **KOV-kataloog päris andmetel.**
   - Kataloogi päis üks kord valla kohta; kirje kohta võti, liik, pealkiri, lühikokkuvõte ja üks viide; detailid ainult valitud kirjetele.
   - Piiri ületamisel „N / M” koos täpsustusega, mitte tõrge.
   - KOV-pakett ühe dokumendina (dokumendipiir).
   - Vastuvõtt: Tallinna, Pärnu ja Anija päris paketid alla piiri ning mõõdetud tokenid.
2. **Turvalisus ja vastupidavus.**
   - Kriisikontroll enne otsingut: olemasolev detektor laiendatult pluss 112/usaldustelefonide vastus.
   - Vestluse seisu tõrke korral avalda vastus, säilita eelmine seis ja logi tõrge.
   - Vastuvõtt: kriisilausete ja vigase seisu sihttestid.
3. **Päris andmete vastuvõtukomplekt** (tasuta, skriptidena):
   - (a) 05.09 päris vektorite võrdlus kui sõnalise kanali ja fusiooni regressioonivärav (§2.1);
   - (b) KOV-kataloogi mahu kontroll kolme suurima vallaga;
   - (c) perioodikatvus päris ajakirja metaandmetel;
   - (d) 156 valla nimevormi.
   - Eraldi omaniku loal: ~20 olukorralause embedding'ud (< 0,01 USD), et mõõta vaba teksti semantilist otsingut.
4. **Käitus.** Räsipõhine morfoloogiakontroll; soe EstNLTK serveris; embedding'u sisendi stabiliseerimine ja otsus 12 420 testi uue baasi kohta; üks RAG-i testide käivituskäsk.
5. **UI.** Piloodi allikapaneel näitab autorit, aastat, väljaannet ja lehekülgi; väljad on tõendis nüüd olemas.

## 7. Minu muudatused (commit `fe1101ff`)

[ADR-020](../rag-v2/adr-020-municipality-scope-bibliography-periods.md):
- `lib/rag-v2/pilot/record-scope.js`: kanooniline valla tuvastus.
- `lib/rag-v2/search/retrieval.js`: bibliograafia väljad.
- `discovery.js`, `ranking.js`, `unified.js`, `indexing.js`, `types.d.ts`: aadressiloendi v3 ja aastapõhine periood.
- Testid: uus `tests/rag-v2-record-scope.test.mjs`; täiendatud `rag-v2-source-structure.test.mjs` ja `rag-v2-unified.test.mjs`; parandatud mock `rag-v2-knowledge.test.mjs`-s.

Kontroll:
- unit-komplektid ja kuus RAG-i integratsioonifaili (45/45) läbisid;
- päris vektorite järjestus jäi samaks;
- ESLint ja `git diff --check` läbisid.

Järelparandus `c7006e8d` Codexi ülevaatuse põhjal: v2 ühise paketi taastamine töötab ja perioodi katvus loendab ainult aastaga allikaid perioodi ulatuses. v2 → v3 vahemälu lugemine (ainult v1 nimeruum) on veel lahti.

Muudatused puudutavad piloodi teostusmanifesti, seega vajab päris plaan uut kinnitust. Uus v3 indeks on vajalik ühise raja jaoks.

## 8. Alles jääv ebakindlus

- Olukorralausete otsing on mõõdetud ainult 12 lausel ja 73 tekstiosal (§2.7); asjakohasuse sildid on minu omad.
- Võrdlusandmestik on väike. EstNLTK-hübriidi eelis (17 vs 15) põhineb 18 küsimusel.
- Pärismudeli olukorra mõistmine, täpsustuste kvaliteet ja vestluse seisu tõrkemäär on mõõtmata.
- Serveri RAG v2 skeem, Python-keskkond ja piloodi plaan on mõõtmata.
- ADR-020 periooditugi on kontrollitud metaandmete ja sünteetiliste testidega; päris v3 indeksit ajakirjadega ei ehitatud.

## 9. Codexi järelülevaatus 24.09.2026: kataloog, kriisirada ja kaalutud otsing

Ülevaatuse ulatus on commit'id `95572f1ec`, `9404c167f` ja `9bd702645`.
Opuse lisatud töökirjeldust kontrolliti koodi ja kohalike katsetega. Selle
ülevaatuse ajal lisandunud `fab928a92` ja `6d8fc8256` (CI, health endpoint ja
automaatne deploy) ei kuulu siinsesse hinnangusse. Käituskoodi ei parandatud.

### Parandamist vajavad leiud

**R1 — P1: kriisiteade ei ole kõigil tõrketeedel tagatud.**
`lib/chat/m4PilotServer.js:53–70`: `pilotSession()` loeb RAG-i konfiguratsiooni
enne küsimuse ja kriisisignaali töötlemist. Lisaks võivad vea taastamise ajal
`service.access()` ja `service.restore()` visata uue vea väljaspool kriisiteate
varuteed. `pilotHandler` tagastab siis üldise veavastuse ilma `isCrisis`-eta;
`components/chat/hooks/useChatStream.js:1736` katkestab enne kriisiseisu määramist.
Seega ei vasta väide „alati, ka otsingu või vastuse ebaõnnestumisel” teostusele.

Taasesitus käivitas tegelikud `pilotPost` ja `pilotHandler` funktsioonid,
asendades ainult sessiooni/teenuse piirid kohalike testadapteritega. Sisend
„Tahan end tappa” andis konfiguratsiooni-, taastamise ligipääsu- ja taastamise
allikatõrke korral HTTP 500, `ok:false`, ilma `isCrisis`-eta. Kontrolljuhtum,
tavaline teenuseviga ilma salvestatud pöördeta, andis HTTP 200 ja kriisiteate.
HTTP 500 oli adapterivea vaikestaatus; tegelik staatus sõltub visatud veast.
Olemasolev adapteritest kontrollib tulemuse teisendust, mitte neid POST-i harusid.

Parandus: hoida autentimine ja päringu valideerimine alles, aga eraldada
kriisikontaktide nähtavus RAG-i konfiguratsiooni, otsingu ja taastamise edust.
Lisada POST-i sihttestid nende kolme tõrke jaoks. Praegu ootab teade ka
`service.run()` lõppu; detektori käivitamine enne otsingut ei tähenda, et teade
oleks kasutajale enne otsingut nähtav.

**R2 — P2: tihendamine kaotab allikapõhise kehtivusinfo.**
`lib/rag-v2/search/structured-record-source.js:17–21`: `compactEntry` säilitab
`source_metadata`-st ainult `source_type` ja `source_checked_at`. Varem mudelile
edastatud `historical`, `source_status`, `valid_from` ja `valid_to` kaovad.
KOV-adapter ei lisa neid eraldi teenuse detailiväljadeks ning kataloog filtreerib
piirkonna, mitte kehtivusaja järgi. Üldine `collected_not_verified_current` ei
asenda konkreetse allika teadaolevat lõppkuupäeva või ajaloolisuse märget.

Taasesitus kasutas tegelikku `compactEntry` funktsiooni ja `modelProjection`-it:
sünteetilise allika `historical:true`, `source_status:repealed` ja kehtivus
2019-01-01–2020-12-31 olid algses mudelikontekstis olemas, tihendatud kontekstis
puudusid kõik neli välja. Hiljutine kontrollikuupäev jäi alles. See tõendab info
kadu, mitte pärismudeli ekslikku vastust. Ka kanoonilisse auditipaketti alles
jäänud teave ei aita mudelit, kui tema sisendist see eemaldatakse.

Parandus: säilitada sisulised kehtivus- ja staatusväljad kompaktselt kord allika
kohta. Hoida hoiatused allikaga seotuna, kui eri kirjete hoiatused erinevad;
praegune ainult koodi järgi koondamine säilitab samuti vaid esimese detaili.

**R3 — P2: kataloogi versioonitõstmine katkestab vana plaani lugemise.**
`lib/rag-v2/search/structured-record-source.js:10` tõstab lepingu versioonile
`rag-v2/record-catalogue-2`, kuid `lib/rag-v2/pilot/config.js:32–35` nõuab uut
konstanti ka `purpose:'read'` puhul. Endiselt lubatud ja aegumata v1 kataloogiga
plaan ei pääse seega enam vestlusajaloo ega allikate taastamiseni. Ühise raja
plaan võib samal põhjusel katkeda juba veaga `invalid_unified_retrieval_plan`.
Vana plaani lihtsalt uueks kirjutamine ei ole lugemissobivuse parandus: see
muudab konfiguratsiooniräsi ja nõusoleku lepingut.

Kohalik konfiguratsioonikatse: muus osas identne kehtiv testrežiimi plaan
tagastas v1 ja `purpose:'read'` korral `invalid_record_catalogue_plan`, v2 korral
lugemine õnnestus. Kontroll asub enne päris- ja testrežiimi harunemist.
Parandus: eristada loetavaid ja käivitatavaid kataloogilepinguid ning kontrollida
ajaloo/allikate taastamist muutmata v1 plaaniga. Vana leping ei pea saama õigust
uut mudelikutset käivitada. Serveris sellise ajaloo olemasolu ei kontrollitud.

**R4 — P2: uus kriisimuster tabab ka elukindlustust ja eluasemelaenu.**
`lib/chat/safety.js:28` muster `l[õo]petada (oma )?elu` lõpeb sõna keskel.
Mõlemad kohalikud kontrolllaused „Soovin lõpetada oma elukindlustuse” ja
„Soovin lõpetada oma eluasemelaenu lepingu” annavad `detectCrisis(...) === true`.
Vana detektor neid kaht lauset ei tabanud. Mõju pole ainult vestluse lisateade:
`components/urgent/UrgentRequestForm.jsx:213` viib sama tulemuse peale kasutaja
erakorralise abi ekraanile ja katkestab tavapärase taotluse ülevaatuse.
Parandus: piirata elule viitava väljendi lõpp ning lisada need mittekriitilised
vastunäited koos tegelike kriisilausetega regressioonitesti.

### Mis on põhjendatud ja kontrollitud

- Kompaktne kataloog lahendab varasema mahuületuse praktiliselt: valitud
  detailid ja allikaviited säilivad, osalisus märgitakse. Tallinna 66/71 ja
  Jõhvi 64/65 on siiski osalised loendid, mitte täielik teenusevalik. Stabiilses
  ID-järjestuses välja jäävad kirjed vajavad edaspidi küsimuspõhist eelvalikut
  või sirvimise mehhanismi; nähtud kirjete `recordFocus` üksi neid ei avasta.
- Vigase vestlusseisu mahe tõrge on põhjendatud. Integratsioonitest tõendas
  eelmise kontrollitud seisu säilimist, kasutaja paranduse jõudmist järgmisse
  pöördesse ja esimese pöörde vigase seisu talumist. Vigast vastust ei avaldata.
- Kaalu 2 profiil rakendab RRF-i panustele õiged kaalud ning jätab vaikeprofiili
  muutmata. EstNLTK jääb nii indeksi kui päringu keelekihiks. Sama indeksit saab
  taaskasutada. Opuse 17/18 ja 11/12 on väikesel, valikuks kasutatud valimil saadud
  tulemused; neid ei korratud siin ega tõlgendata üldise vestluskvaliteedina.
- Serverist loeti ülevaatuse ajal Git HEAD `9bd702645`, frontend oli `active` ja
  õige saidi `https://sotsiaal.ai` HTTPS HEAD vastas 200. RAG-i eraldi andmebaasi
  `_prisma_migrations` sisaldas kõiki viit migratsiooni: `local_search`,
  `ingest_batches`, `morphology`, `index_jobs`, `retrieval_directory`; kõigil
  `finished=true`, `rolled_back=false`. Tootmiskasutajate sisu ei loetud.
  See kinnitab rakendatud migratsioonide registrit, mitte piloodi läbitud vestlust.

### Kontrollide ulatus ja tõendipiir

`TZ=UTC` all läbisid **44/44 testi** järgmistes failides:
`rag-v2-dialogue-store`, `rag-v2-structured-records.integration`,
`rag-v2-unified.integration`, `rag-v2-pilot-chat-adapter`, `rag-v2-search` ja
`rag-v2-estnltk`. Kasutati eraldatud kohalikku andmebaasi, Qdranti, EstNLTK-d ja
testadaptereid. Lisaks tehti eespool kirjeldatud sihitud regressioonide
taasesitused; kohalik skript on `tmp/opus-review-20260924.mjs` (Gitist välja jäetud).
R4 võrreldi ka commit'i `9404c167f` eelse detektoriga.

Tasulisi kutseid **0**, deploy'd **0**, migratsioonide rakendamisi **0**.
Opuse kogu komplekti tulemust 297/3/1 ei korratud. Pärismudeli vastuse kvaliteet,
serveri aktiivse piloodi täielik rada ja uue profiili sõltumatu hindamine on
`NOT_PROVEN` / `not_run`. Järgmine põhjendatud teostus on R1–R4 parandamine koos
sihitud regressioonitestidega, seejärel kataloogi välja jäänud kirjete leidmine.

## 10. Opuse parandused R1–R4 (24.09.2026)

Kõik neli leidu said taasesitatava parandusega sihttesti.

| Leid | Parandus | Test |
| --- | --- | --- |
| R1 | `pilotPost` teeb enne kõike muud autentimise ja päringu kontrolli. Seejärel annab iga hilisem tõrge kriisilause korral HTTP 200, `isCrisis:true` ja kriisiteate: konfiguratsioon, `service.run`, taastamise `access`, `restore` või lõpetamata pööre. Tavaline küsimus saab endise veavastuse. Klient näitab kriisiteadet kohe saatmisel ega peida seda võrgu- või serveritõrke korral. | `rag-v2-pilot-crisis-route` kutsub päris POST-käsitlejat. Asendatud on ainult autentimise ja RAG-i seansi piirid: viis tõrketeed, tavaküsimuse kontroll, lõpetatud kriisivastus, autentimise järjekord. |
| R2 | `compactEntry` säilitab allika enda `historical`, `source_status`, `valid_from` ja `valid_to`, kui need on deklareeritud. Kõigil allikatel ühesugune hoiatus on üks kord `source_limitations` all. Allikapõhine hoiatus jääb allika juurde, erineva detailiga hoiatused eraldi. | `rag-v2-record-catalogue-compact`: kehtetu allika neli välja jõuavad mudeli konteksti, erinevad hoiatuse detailid jäävad oma allika juurde. |
| R3 | `READABLE_RECORD_RETRIEVAL_VERSIONS` (v1, v2): muutmata v1 plaan on loetav (`purpose:'read'`) nii kirje- kui ühisrajal; käivitada saab ainult v2. | `rag-v2-dialogue-config`: v1 lugemine õnnestub, käivitus annab `invalid_record_catalogue_plan` / `invalid_unified_retrieval_plan`. |
| R4 | Uued eesti mustrid on liitsõna piiridega (`(?:^|[^a-zõäöüšž])` / `(?![a-zõäöüšž])`). Lookbehind'i ei kasutata, sest `safety.js` laaditakse ka brauseris ja vanem Safari ei parsi seda. | „elukindlustuse”, „eluasemelaenu”, „tööelu lõpetada”, „lõikasin endale leiba” ei ole kriis; „lõpetada oma elu.” ja „lõikasin end” on. |

Päris KOV-paketid pärast R2 (piir 12 000): Anija 6 348, Harku 7 557, Kose 9 604, Pärnu 11 737 (62/62), Jõhvi 11 953 (62/65), Tallinn 11 908 (63/71). Säilitatud kehtivus- ja hoiatusinfo kasvatab mahtu. Osaline loend jääb märgistatuks.

Kontrollid: `npm test` (CI komplekt) 188 läbis, 17 vahele jäetud, 0 ebaõnnestus. Kohaliku andmebaasi ja EstNLTK-ga integratsioonitestid 53/53 (`dialogue-store`, `pilot-store`, `record-scope`, `structured-records`, `unified`). Tasulisi kutseid 0.

Piirid:
- Klientpoolset kohest kriisiteadet brauseris ei kontrollitud, sest piloodi sisselogitud rada pole kohalikus arenduskeskkonnas seadistatud. Kliendikood kasutab sama `detectCrisis()` ja `resolveCrisisStateAfterEvent()` funktsiooni.
- v1 plaaniga salvestatud pöörde täielikku taastamist andmebaasist ei testitud, ainult konfiguratsiooni lugemist. Taastamine ei ehita kataloogi uuesti.
