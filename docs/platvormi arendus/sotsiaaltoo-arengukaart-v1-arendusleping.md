# `ST10-12 SOTSIAALTOO-ARENGUKAART-V1` — Sotsiaaltöö arengukaardi arendusleping

Versioon: 1.1 · 28.08.2026
Lepingu liik: RAG-i allikapõhine metaandme- ja kasutajavaate vertikaal
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: ajakirjakorpuse alus osaline, nimeline ajajoon 0;
`runtime: not_run`

Taastamis- ja täpsustusmärge 28.08.2026: algne 24.08 leping taastati omaniku varasema
Codexi vestluse failimuudatustest. Versioon 1.1 lisab kaks eri väljundit, algallika ja
autorisünteesi päritolupiiri, kordusallikate vältimise ning aktiivse RAG-i päris
tõendivärava. See märge ei muuda funktsiooni teostusseisu.

## 1. Vajadus ja kasutajalubadus

Kümnendi võrdlusest sündinud **Sotsiaaltöö arengukaart** aitab küsida, kuidas mingi teema
ajas muutus, ning näha allikatega aastajoont, mis eristab idee, piloodi, rakenduse, mõõdetud
tulemuse ja lahendamata piirangu. See ei ole artiklites valmis funktsioonina pakutud, vaid
SotsiaalAI tootetõlge aastakäikude võrdlusest.

Kasutajalubadus: iga ajajoone väide viib algallikani ja ütleb ausalt, kas allikas kirjeldab
plaani, katset, rakendamist või mõõdetud tulemust. Puuduva tõendi korral ei täida AI lünka.
SotsiaalAI sisemine arenduskaart seob sama tõendi võimaliku tootefunktsiooniga, kuid näitab
eraldi selle tegelikku seisu ja järgmist väikest arendusühikut; seos ei ole väide, et
SotsiaalAI on valdkondliku probleemi lahendanud.

## 2. Sobivus olemasoleva platvormiga

**Taaskasutatav:** aktiivne ajakirja `Sotsiaaltöö` RAG-korpus; aasta ja allika metaandmed
`lib/rag/sourceMetadata.js`, `rag-service/main.py`,
`scripts/ingest-ajakiri-sotsiaaltoo.mjs`; evidence-pakett, planner, vastuse koostamine ja
allikapaneel. `lib/chat/evidencePackage.js` kannab juba `temporal_coverage`-it, `by_year`-i,
üldisi `limitations`-piiranguid ja juhist mitte tuletada aastate loendist trendi;
`lib/chat/mainResponseHandler.js` säilitab ajalise meta ja piirangud vastuse koostamisel.

**Puudu:** kontrollitud väljad `developmentStage`, `evidenceType`, `targetGroup`, `region`,
artiklitaseme kontrollitud `limitations`; nende toimetus-/ingest-leping; ajajoone päring ja UI;
plaani/piloodi/tulemuse faktileping. Evidence-paketi üldine piirang ei asenda kontrollitud
artiklimetat ning korpuse aasta olemasolu ei tõenda arengukaardi valmimist.

## 3. Kaks väljundit ja V1 kasutajatee

### 3.1. Kasutaja arengukaart

1. Kasutaja valib või küsib ühe teema kohta, näiteks „kuidas hoolduskoormuse käsitlus muutus
   2016–2025?”.
2. Süsteem otsib teemaga seotud algartiklid ja rühmitab ainult kontrollitud metaandmete järgi.
3. Ajajoon näitab aasta, artikli, arenguetapi, tõendiliigi, sihtrühma/piirkonna, vastuolu ja
   lahendamata piirangu.
4. Iga väide avab algallika; 2026 kuvatakse osalise aastana.
5. Süntees eristab, mida algallikas tõendab, mida autor on kümnendiülevaates sünteesinud ja
   millise tootetõlke on SotsiaalAI sellest teinud.

### 3.2. SotsiaalAI tõendipõhine arenduskaart

Sisemine kaart seob korduva vajaduse ainult ühe kanoonilise funktsioonilepinguga ning näitab
`vajadus → algallikad → tootetõlge → tegelik seis → järgmine ühik`. Tegelik seis mõõdetakse
värskest koodist ja aktiivsest keskkonnast, mitte artiklist ega sellest lepingust. Kaart ei
loo teist elavat seisu: ametlik olek ja prioriteet elavad ainult
[`SotsiaalAI.md`](./SotsiaalAI.md)-s.

Kasutaja saab vaadata otsingu leide, valitud konteksti toetavaid allikaid, vastuse allikaid
ja avatud algallikat. Sisemine arenduskaart on toimetaja/omaniku tööriist ega tohi muuta
avalikku ajajoont SotsiaalAI turundusvaateks.

## 4. Tootepiirid ja invariandid

- Ainult avalik/toimetatud ajakirjakorpus; mitte kasutajate vestlused, dokumendid ega juhtumid.
- Metaandme kinnitab inimene või deterministlik kontrollitud ingest; mudeli oletus ei muutu
  vaikimisi registrifaktiks.
- `idee`, `piloot`, `rakendatud`, `mõõdetud tulemus` ja `lahendamata` ei sulandu üheks
  „arenguks”.
- Allika avaldamisaasta, uuringu/andmete aasta ja rakenduse aeg on eri väljad.
- Aastajoone puuduv aasta ei tähenda, et teemat valdkonnas ei käsitletud.
- Arengukaart ei tõenda SotsiaalAI mõju ega nimeta kirjeldatud plaani saavutatud tulemuseks.
- RAG-i „otsing leidis”, „kontekst valiti”, „vastus väitis” ja „allikas kuvati” on eri
  tõendiväravad.
- „Allikas kuvati” ja „kasutaja sai õige algallika avada” on samuti eri tõendiväravad.
- Algupärane ajakirjaartikkel on väite esmane tõend. Seitsme teema artikkel ja laiendatud
  põhiartikkel on autorisünteesid, mitte uued sõltumatud tõendid; temaatiline register on
  kureerimiskiht.
- Sama algartikli korduv viitamine, HTML/PDF teisend või töökausta kontrollkoopia ei kasvata
  tõendite arvu. Kõik kordused seotakse ühe `originalSourceId`-ga.
- Arengukaart ei tee arenguskoori, asutuste/autorite edetabelit, lineaarset edulugu ega
  allikata põhjuslikku järeldust.

## 5. Metaandmeleping

Iga algartikkel kannab vähemalt: stabiilne allika ID, pealkiri, autor, `sourceYear`,
`periodStart`, `periodEnd`, `dataYears`, `themeTags[]`, `developmentStage[]`,
`evidenceType[]`, `targetGroup[]`, `region[]`, `limitations[]`, `originalSourceIds[]`,
allikaviide, metaandme päritolu, kontrollija, `verifiedAt` ja õiguste seis. 2026 allikatel on
`partialYear: true` kuni aastakäik on tervik.

`evidenceType` kontrollitud väärtused on vähemalt `development`, `implementation`, `result`,
`limitation`, `contradiction` ja `unresolved`. Autorisüntees kannab lisaks
`synthesisVersion`, koostajat, alusallikate `originalSourceIds[]` loendit ja selget
`sourceLayer: synthesis`; temaatiline register kannab `sourceLayer: curation`. Ainult
`sourceLayer: original` võib olla uue faktiväite esmane tõend.

Väljad on kontrollitud sõnastikuga, kuid lubavad `unknown/not_stated`; puuduolevat ei tuletata.
Metaandme versioon ja content hash seovad kirje konkreetse algallikaga. Muutus käivitab
kontrollitud reindeksi, mitte vaikse käsiparanduse ainult UI-s.

## 6. Teostusetapid

### E0 — aktiivse korpuse ja metaandmete audit

- Mõõda aktiivne register, indeksi dokumendid, aasta/autor/pealkiri ning dubleerimise ja
  puuduvate originaalide seis; ära eelda kõrvalkausta järgi tootmisindeksit.
- Võrdle read-only režiimis kümnendikogumikku, algartikleid, sünteesifaile ja aktiivset
  RAG-registrit; seo checkpoint'id ja eri failivormid ühe algallikaga.
- Lukusta sõnastikud ja faktileping; erista allika-, andme- ja rakendusaasta.
- Valige üks V1 teema, millel on mitme aasta algallikad ja vähemalt üks selge piirang.

### E1 — toimetatav metaandmeskeem

- Lisa versioonitud skeem ja valideerimine ingest'i/registri piirile.
- Loo inimese kontrollitud toimetusrada või failipõhine allikaregister; AI võib ainult pakkuda
  mustandit, mida ei indekseerita enne kinnitamist.
- Säilita olemasolevad ID-d ja content hash'i kooskõla.

### E2 — kontrollitud tagasitäide ja reindeks

- Märgista ainult V1 teema vajalikud originaalartiklid; ära tee allikata masstäidet.
- Märgi autorisüntees ja kureerimisregister eraldi allikakihina; ära indekseeri neid
  algartikli sõltumatu kinnitusena ega lase korduskoopial tõendikaalu kasvatada.
- Kontrolli registri, Chroma/metaandmete ja kuvatud allika ID-de vastavust.
- Puuduv või vastuoluline meta jääb nähtavalt `unknown`/toimetuse ootele.

### E3 — päringu ja tõendi leping

- Laienda olemasolevat `temporal_coverage` / `by_year` / `limitations` lepingut kontrollitud
  arenguetapi ja tõendiliigi metaga; ära ehita teist paralleelset ajalise tõendi süsteemi.
- Planner tuvastab arengukaardi kavatsuse ja hoiab teema, aastavahemiku ning etapi eristuse.
- Retrieval tagastab allikad aastate/etappide katvusega; valija ei tohi ühe artikli pealkirjast
  ehitada kogu kümnendi väidet.
- Vastuse koostaja säilitab piirangud ja ei tuleta puuduva aasta sündmust.

### E4 — ajajoon ja allikavaade

- Kuva aasta, etapp, tõendiliik, allikas ja piirang ligipääsetava loendi/ajajoone kujul.
- Visuaal ei tohi olla ainus info kandja; klaviatuur ja ekraanilugeja saavad sama sisu.
- Lisa 2026 osalise aasta märge, ET/EN/RU UI ja mobiil.

### E5 — üks käsitsi tõendatud vertikaal

- Kontrolli vähemalt kahte sõnastust ühe V1 teema kohta.
- Kirjelda eraldi otsingu leiud, valitud kontekst, vastuse väited, kuvatud allikad ja avatud
  algallikas.
- Negatiivrada peab ütlema „tõend puudub/ei ole korpuses”, mitte genereerima täidet.
- Uut automatiseeritud RAG testi või sondi ei looda; admini olemasolevat enesetesti võib kasutada
  ainult tema praeguse operatiivse ulatuse piires.

## 7. Vastuvõtukriteeriumid ja DoD

Esimene vertikaal kuvab ühe teema mitme aasta allikapõhise ajajoone, eristab idee/piloodi/
rakenduse/mõõdetud tulemuse, näitab vastuolusid, piiranguid ja algallikaid, märgib 2026
osaliseks ning läbib kahe sõnastusega käsitsi tõendiahela. Täis-V1 laiendab sama tõendatud
lepingu seitsmele kümnendikogumiku põhiteemale ilma uue paralleelse tõendisüsteemita.

Registri, indeksi, valitud konteksti, kuvatud allika ja avatud algallika ID-d on kooskõlas;
autorisüntees ei esine sõltumatu algallikana ja puuduva tõendi puhul süsteem ei täida lünka.
Sisemisel arenduskaardil on iga platvormiseose juures vajaduse tõend, mõõdetud funktsiooniseis
ja järgmine ühik.

Kontroll: muudetud koodi lint, `git diff --check`, vajadusel `i18n:check`, peatüki lõpus build
ning käsitsi RAG/UI rada. Skeemimuudatuse korral `prisma validate` ainult siis, kui Prisma pind
tegelikult muutub. Automaatteste ega sonde ei looda ega käivitata; mõõtmata teemad jäävad
`NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-SAK-1: esimene V1 teema ja kontrollitud sõnastikud.
- P-SAK-1: toimetaja, kes kinnitab metaandme ja piirangud.
- O-SAK-2: kas ajajoon on esmalt vestluse vastuse osa või eraldi otsingupind; soovitus on üks
  allikapõhine vertikaal enne eraldi suure lehe loomist.
- Lai korpuse tagasitäide algab alles pärast V1 käsitsi tõendit.
