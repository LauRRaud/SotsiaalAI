# `ST10-10 AI-VASTUTUSMARGE-V1` — AI vastutusmärke arendusleping

Versioon: 1.0 · 24.08.2026
Lepingu liik: platvormiülene laiendusleping, mitte uus tööriist ega sisuregister
Elav teostusseis: [`SotsiaalAI.md`](./SotsiaalAI.md) S4 artiklivõrdluse lepinguregister
Tõendipiir lepingu koostamisel: alus osaline; `runtime: not_run`

## 1. Vajadus ja kasutajalubadus

2025. aasta AI-käsitlus seob tehnoloogia võimalused läbipaistvuse, privaatsuse, osaluse,
vaidlustatavuse ja professionaalse kaalutlusega. **AI vastutusmärge** ütleb igal AI-d kasutaval
pinnal üheselt:

- mida AI tegi;
- milliseid allikaid kasutati ja kui värsked need on;
- mis on ebakindel või kontrollimata;
- mida inimene muutis või kinnitas;
- kuidas veast teatada, parandada või tulemust vaidlustada.

Märge ei ole turundusikoon, vaid läbiv tooteleping ja nähtav inimese kontrolli tõend.

## 2. Sobivus olemasoleva platvormiga

**Olemas ja taaskasutatav:** RAG evidence/allikad `lib/chat/evidencePackage.js`, vastuse
koostamine `lib/chat/mainResponseHandler.js`, allikapaneel
`components/alalehed/chat/ChatSourcesPanel.jsx`, sõnumi allikad API-s, allikatagasiside
`lib/sourceFeedback.js` ja `app/api/source-feedback/**`, privaatsuse eelkiht
`lib/chat/requestBootstrap.js`, päritolu `lib/workspaces/provenance.js` ning AI mustandi
inimkinnituse mustrid. Jagatud kolme olekuga `components/ui/ContentTrustBadge.jsx` ja
`lib/contentTrustState.js` on kasutusel Tööheaolu `SupportRequestPanel`-is ja
`OverviewWorkflow`-s.

**Puudu:** platvormiülene katvusmanifest ja olemasoleva trust-state'i laiendus/wrapper, mis
ühendab AI rolli, evidence'i, allikate värskuse, ebakindluse, kinnitaja rolli/eesmärgi ja
vaidlustamise. Tööheaolu badge ega vestluse allikanupp ei kata üksi dokumendi-, juhtumitöö-,
uurimuse ega tulevaste tööriistade mustandeid.

## 3. Katvus ja kasutajatee

V1 katvusmanifest peab loetlema vähemalt: vestlusvastus, süvauuring, dokumendimustand,
eelpöördumise/Teekonna AI kokkuvõte, juhtumitöö mustand ning kõik uued ST10 funktsioonid, kus AI
sõnastab teksti.

1. AI väljund sünnib olekuga `AI_DRAFT` ja nähtava märgiga.
2. Kasutaja avab vastutusvaate: AI roll, allikad, värskus, piirangud ja kontrollimata väited.
3. Muutmine säilitab päritolu; ainult inimese selge tegevus võib märkida väljundi
   `HUMAN_CONFIRMED`-iks.
4. Kasutaja saab teatada veast või vaidlustada kasutuse. Tagasiside läheb õigele ülevaatusrajale
   ilma tundlikku sisu üldisesse auditisse kopeerimata.
5. Parandatud väljund näitab versiooni ja seda, kas allikas, AI mustand või inimese tekst muutus.

## 4. Tootepiirid ja invariandid

- AI ei saa ise oma mustandimärget eemaldada ega inimese kinnitust simuleerida.
- `HUMAN_CONFIRMED` tähendab, et nimeline kasutaja vaatas konkreetse eesmärgi jaoks versiooni
  üle; see ei tõenda automaatselt faktilist, õiguslikku ega professionaalset õigsust.
- „Allikatega” ei tähenda automaatselt „õige”; nähtavad on kuupäev, piirang ja ebakindlus.
- AI ei tee teenusele pääsu, riski, meetodi, mahu, raha ega professionaalse otsuse lõppotsust.
- Logisse ei lähe prompt, vastuse sisu, tundlik vabatekst ega allikakatkend; audit on sisutu.
- Märge ei muuda privaatset mustandit administraatorile või organisatsioonile nähtavaks.
- Puuduv allikas või provenance ei peida märget; süsteem kuvab „allikas puudub / kontrollimata”.
- Sama lepingu komponenti kasutatakse kõigil pindadel; lokaalseid eri tähendusega AI ikoone ei
  looda.

## 5. Minimaalne metalepe

AI väljundi meta: pinna ID, väljundi ID/versioon, `AI_DRAFT | HUMAN_EDITED | HUMAN_CONFIRMED`,
mudeli/teenuse avalik kategooria (mitte salajane konfiguratsioon), loomisaeg, allikapaketi ID-d,
allikate kuupäevad/värskus, ebakindluse/puuduva tõendi lipud, inimese kinnitamise aeg ja
tagasisideviide. Inimkinnitus kannab kinnitaja kasutaja ID-d, rolli ja kinnituse eesmärki.

Päritolu kuulub väljundi või selle versiooni juurde, mitte vabateksti kõrval suvalisse
JSON-välja. Audit kannab olekusiiret ja võtmeid, mitte sisu.

## 6. Teostusetapid

### E0 — AI pindade katvusmanifest

- Inventuuri kõik kohad, kus mudel loob kasutajale nähtavat või töövoogu sisenevat teksti.
- Märgi igal pinnal allikad, provenance, inimkinnitus, tagasiside ja retention; teadmata pind on
  `NOT_PROVEN`, mitte vaikimisi kaetud.
- Lukusta ühine olekusõnastik ja minimaalne meta.

### E1 — serveri meta ja fail-closed projektsioon

- Lisa jagatud helper, mis koostab lubatud vastutusmeta ilma prompti/vastuse sisu paljastamata.
- Puuduv evidence/provenance tagastab nähtava piirangu, mitte tühja „usaldusväärse” märgi.
- Säilita rolli- ja omandipiirid igal API-l.

### E2 — olemasoleva trust-state'i platvormiülene laiendus

- Laienda `ContentTrustBadge` / `getContentTrustState` lepingut või ehita selle peale üks
  ligipääsetav wrapper AI rolli, allikate/värskuse, piirangute, kinnitaja rolli/eesmärgi ja
  inimkinnituse kuvamiseks; ära loo teist kolme oleku tõlgendajat.
- Kasuta olemasolevat allikapaneeli ning allikatagasisidet; ära dubleeri neid.
- Lisa ET/EN/RU, klaviatuur, ekraanilugeja, mobiil ja print/eksport.

### E3 — inimese muutmise ja kinnitamise rada

- AI mustand → inimese muudatus → inimese kinnitus on nähtavad olekusiirded.
- Kinnitatud versiooni hilisem AI ümberkirjutus loob uue mustandi, mitte ei päri kinnitust.
- Kinnitamine nõuab serveris omaniku/rolli kontrolli.

### E4 — viga, parandus ja vaidlustamine

- Ühenda allikaviga olemasoleva source-feedback rajaga ning tootefunktsiooni viga sobiva
  ülevaatuskanaliga.
- Kasutaja näeb teate vastuvõttu ja võimalusel paranduse seisu; see ei luba automaatselt otsuse
  muutmist.
- Admini koond näitab ainult pindade katvust ja sisutuid vealiike.

### E5 — katvuse käsitsi tõend

- Kontrolli vähemalt vestlust, dokumenti ja juhtumitöö mustandit ning üks allikata/ebakindel rada.
- Tõenda, et privaatne sisu ei ilmu adminile, logisse ega teise rolli vaatesse.
- Katvusmanifesti lahtised pinnad jäävad nimeliselt `NOT_PROVEN`.

## 7. Vastuvõtukriteeriumid ja DoD

Valmis on siis, kui kõik manifesti V1 pinnad kuvavad sama tähendusega AI olekut, allikaid või
nende puudumist, ebakindlust, inimese muudatust/kinnitust ja veast teatamise teed. AI ei saa
oma märget eemaldada, uus AI versioon ei päri vana inimkinnitust ning audit/logi ei sisalda
prompti ega väljundi sisu. Kinnitus näitab kinnitajat, rolli ja eesmärki ning ei väida, et sisu
on seetõttu faktiliselt või õiguslikult õige.

Kontroll: lint, `git diff --check`, vajadusel `i18n:check` ja `prisma validate`, peatüki lõpus
build ning käsitsi eri AI-pindade/rollide rada. Automaatteste ega sonde ei looda ega käivitata;
kontrollimata pind jääb `NOT_PROVEN`.

## 8. Aktiveerimisväravad

- O-AIV-1: V1 katvusmanifesti lõplik pindade loend.
- Õ-AIV-1: vaidlustamise ja paranduse sõnastus ametliku otsuse kõrval; märge ise ei loo
  apellatsioonimenetlust.
- Iga uus AI funktsioon peab enne aktiveerimist lisama end katvusmanifesti ja täitma selle
  lepingu vastuvõtukriteeriumid.
