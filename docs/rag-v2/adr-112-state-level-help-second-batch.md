# ADR-112: riigi tasandi abi teine partii (korpus v72)

Kuupäev: 08.10.2026. Teostus Claude Opus 5.5. Seis: **ostetud ja töös.** Serveris töötab korpus v72: indeks `87d4f55c`, 8656 dokumenti, 74 066 lõiku, vestlusplaan `m4-corpus-chat-20261008c.json`. Kulu 0,107 USD, sellest 0,039 USD katkenud ostule. **Mudeliga mõõtmata.**

## Probleem

[Esimene partii](adr-111-state-level-help-first-batch.md) tõi RAG-i pensioni ja perehüvitiste lehed ning 26 seadust. [Katvuskaardi](../audits/rag-v2-coverage-map-2026-10-08.md) ülejäänud lüngad jäid lahti: ravikindlustus ja arstiabi kulud (Tervisekassa sait ei vastanud), kohtusse pöördumine, võlad inimese vaates, pärimine, vägivalla ohvri abi, lapse tugi koolis. Omanik 08.10.2026: „Lisa RAG-i riigi tasandi abi: teine partii“.

## Otsus

210 ametlikku juhislehte kaheksalt saidilt. Loend: `Andmebaasi/register/web_pages_state_help_2.json`; lehed on kaustas `Andmebaasi/veebilehed/`. Iga leht on loendis oma aadressiga, saidikaardi või (kohtutel) avalehe linkide järgi.

| Väljaandja | Lehti | Lõike | Teemad |
|---|---:|---:|---|
| Sotsiaalkindlustusamet | 78 | 564 | abivajav laps ja täiskasvanu (asendushooldus, laste ja perede abistamine, abi põgenikule, vaimne tervis kriisis) 24; puue ja hoolekanne (erihoolekanne, puude raskusastme tuvastamine, rehabilitatsioon, toetavad teenused, toetused) 23; ohvriabi lehed ja vaie 7; ohvriabi sait palunabi.ee 24 |
| Tervisekassa | 42 | 339 | ravikindlustus, haigus- ja hooldushüvitis, hambaravi, ravimid, arsti- ja õendusabi, omaosalus, patsiendi õigused ja kaebevõimalused, insuldi ja depressiooni raviteekond |
| Politsei- ja Piirivalveamet | 42 | 319 | avaldus politseile, kelmused, enda ja laste turvalisus, laste väärkohtlemine veebis, kadunud inimene, isikut tõendav dokument liikumisvõimetule, rahvusvaheline kaitse, Ukraina sõjapõgenikud |
| Notarite Koda | 16 | 303 | koja pärimisveeb (kes pärib, mida pärib, pärimise käik, pärandamine, testament ja pärimisleping) 8; ametitoimingud ja registrid 8 |
| Kohtutäiturite ja Pankrotihaldurite Koda | 16 | 211 | täitemenetlus, nõuete aegumine, töötasu arestimine, elatisvõlad ja elatisabi, kaebus kohtutäituri peale, korduvad küsimused, tasud, koja artiklid |
| Eesti kohtud | 15 | 129 | tsiviil-, haldus-, kriminaal- ja väärteomenetlus, maksekäsu kiirmenetlus, menetluskulud, menetlusabi ja riigilõiv, teave kannatanule ja tunnistajale, sõnaseletused, dokumendid ja vormid |
| Haridus- ja Noorteamet (Rajaleidja) | 1 | 3 | kooliväline nõustamismeeskond |

Tervisekassa sait vastas sel korral; politsei sait palub päringute vahele 10 sekundit ja seda peeti.

### Mis jäi välja

- **Rajaleidja:** 7 loetud lehest 6. Töötajate nimekiri keskuste kaupa, kaks projektilehte ja nõuannete leht nimetavad inimesi nimepidi; kaks lehte on tühjad. Lapse arengumure ja koolitoe lünk jääb lahti.
- **Sotsiaalkindlustusameti järelhoolduse leht:** loetleb teenuseosutajad nimepidi.
- **12 tühja või ainult edasi viitavat lehte**, sh kohtute leht „Eestkoste ja järelevalve“, kus on ainult pilt-link, ja kaks videote loendit.
- **Peaasi ja Tervise Arengu Instituut.** Peaasi on ühing ja vajab organisatsioonide lehtede valikureeglit ([ADR-095](adr-095-web-pages-as-sources.md)); instituudi lehed on kirjutatud spetsialistile. Mõlemad ootavad eraldi tööd.
- **Töötukassa:** uuesti ei proovitud (sisu aadress on saidi robots.txt-s kogujatele keelatud, ADR-111).

### Isikuandmed

- Salvestatud lehtedel on 22 e-posti aadressi, kõik asutuste üldaadressid (sh pankade aadressid pärimistunnistuse saatmiseks). Ühegi inimese nime kõrval ei ole telefoni ega aadressi.
- Korjaja võttis välja ka mõne asutuse enda aadressi ja infotelefoni, mida ta pidas isiku omaks (kohtumajade aadressid menetlusdokumentide saatmiseks ja infotelefonid, kaugtõlke tugi). Lehel on nende asemel märge; vastus saab anda üldaadressi ja lehe lingi. Korjaja reeglit ei muudetud.
- Viiel kohtutäiturite koja artiklil on all autori nimi ja amet; kahel notarite lehel on lingid notarite ajaleheartiklitele koos autori nimega; kahel lehel on kirjanduse või raamatu autorid. Kontakte nende juures ei ole. Need jäid sisse nagu ajakirja artiklite autorid; omanik valis ostu selle teadmisega.

## Ost katkes ja tehti uuesti

Esimene ost peatus 1063 sisendi järel 1826-st: ühe päringu vastus jäi tulemata (`embedding_outcome_unknown`) ja arvestus lõpetas jooksu (`stopped_unknown`). Kulunud oli 0,0392 USD. Indeksit ei muudetud ja vestlus töötas edasi korpusega v71.

Poolikut ostu ei saa jätkata ega taaskasutada: taaskasutus võtab vektoreid ainult lõpuni jõudnud ostust (`complete_real_pilot_required`), ja serveri jooks ei alusta sama versiooni ostu teist korda. Sama juhtus 26.09.2026 (0,014 USD). Omanik valis selgituse põhjal „Osta kohe uuesti“ (uus lagi kokku 0,12 USD).

Käsitsi tehtud sammud serveris, midagi ei kustutatud: katkenud ostu kaust, selle plaan, kinnitus ja logid said nime lõppu `-first`; poolik vektorikaust `pilot_5684a2e2…` tõsteti kaustast `usage/` kausta `usage-incomplete/`, sest jooks taaskasutab kõiki `usage/` kaustu ja nõuab, et need oleksid lõpetatud. Teine ost läks läbi tõrgeteta.

**Lahti:** katkenud ostu makstud vektorid peaksid arvesse minema. See muudab tasuliste kutsete arvestuse reeglit ja on eraldi töö.

## Arvud

| | v71 | v72 | Piir |
|---|---:|---:|---:|
| Dokumente | 8446 | 8656 | 10 000 |
| Lõike | 72 198 | 74 066 | 100 000 |

- Partii: 210 dokumenti, 1868 lõiku. Ostetud 1826 sisendit (42 olid varasemast olemas), 520 772 tokenit.
- Kulu: teine ost 0,0677 USD, katkenud ost 0,0392 USD, kokku 0,1069 USD. Lubatud lagi esmalt 0,10 USD, pärast katkestust kokku 0,12 USD. Arvestatud kinnitatud kasutusest, mitte arvelt.
- Ketas: enne 24 GB vaba, pärast 23 GB (71% kasutusel).
- Ühist märksõna ega kirjeldust partii dokumentidel ei ole.

## Kontrollitud

- Proovikorje luges 219 lehte; neist 41 märkis korjaja ülevaatuseks. Õhukeste lehtede tekst loeti läbi; kontakti eemaldamise kohtade ümbrus vaadati üle; nimesid otsiti koodihoidla enda reegliga (`personPair`) ja leitud kohad vaadati ükshaaval.
- Salvestatud failid on bait-baidilt need, mis korjaja luges (420 faili); registri räsid vastavad failidele (3709 kirjet). Varasemad registrikirjed on muutmata alles (3288).
- Serveris: teine ost `complete` (1826, teadmata 0); indeks `ready` (8656 dokumenti, 74 066 lõiku); vestlusplaani kontroll `ready`; teenus töötab uue plaaniga; planeerija ootab uuele põlvkonnale 8851 dokumenti (tegelikult 8656).
- Katvuskaart serveris uuesti, tasuta. Ruudustiku 294 lahtrist on „piisav“ 219 (pärast v71 207), „õhuke“ 54 (63). Vastutaja juhislehti: ravikindlustuse real 17 (enne 0), võlgade real 14 (0), volikirja ja esindamise real 13 (0), lähedase surma real 14 (4), lähisuhtevägivalla real 15, kuriteoohvri real 31. Avalause sõnaotsing leiab juhise ravikindlustuse real esimesel kohal ja vaiete real teisel kohal (enne ei leidnud kumbagi); võlgade real üheksandal, lähedase surma real 34. kohal; vägivalla, volikirja ja töövõime ridadel ei leia. Töö kaotuse ja lapse arengumure read on muutumata (juhislehti 0). Sõnaotsing on ainult üks vestluse otsingu osa.
- Ühiktestid: 835, neist 813 läbi ja 22 vahele jäetud. Koodi selles partiis ei muudetud.

## Kontrollimata

- Vastused mudeliga. Kas Luna kasutab uusi lehti õigesti, näitab alles küsimine (tasuline, ootab omaniku sõna).
- Kas esimese partii seaduselõigud ja teise partii juhised jõuavad samasse vastusesse õiges vahekorras.
- Lehtede hilisem seis: need 210 lehte ei ole veel igakuises värskenduses.

## Mis jääb lahti

- Katkenud ostu vektorite arvessevõtmine (vt eespool).
- Lapse arengumure ja koolitugi: Rajaleidja lehed ei sobinud; vaja on teist allikat.
- Peaasi ja Tervise Arengu Instituudi abi leidmise lehed; Töötukassa juhised.
- Korjaja peab asutuse punktiga aadressi isiku omaks; kohtumajade aadressid ja infotelefonid jäid seetõttu lehtedelt välja.
- Justiitsministeeriumi juhend võlgniku õigustest täitemenetluses on PDF, millele koja leht viitab; RAG-is seda ei ole.
