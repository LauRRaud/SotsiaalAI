# ADR-066 — Vestlus otsustab teema ja inimese ise

02.10.2026. Teostus Claude Opus 5.5. Omanik 02.10:

- „jätkuvestluse valikud on puhtalt AI jaoks, ise mõtle, kuidas peaks olema“;
- „Need asjad peaks olema tavakasutaja jaoks läbi testitud … Kui sinu sõnul on see teema testitud, siis ei pea see olema nö vestluses kaasas.“

Järgib [ADR-049](adr-049-person-bound-municipality.md) (iga inimese oma vald) ja [ADR-051](adr-051-fact-lifecycle-and-place-attribution.md) (faktide elutsükkel).

## Probleem

- Vestluse all oli paneel „Jätkuvestluse valikud · Inimene N“ (`components/chat/PilotContextControls.jsx`). Sealt valis kasutaja, kas sõnum jätkab teemat, parandab midagi, alustab uut teemat või räägib teisest inimesest. Samuti sai valida, millisele varasemale vastusele sõnum viitab.
- Paneel tehti prooviversiooni testimiseks. Tavakasutajale on see võõras ja omanik seda ei vaja.
- Ilma valikuta jätkab iga sõnum sama teemat.
- **Ainus koht, kus see kinni jäi:** teemas on kuni 8 sõnumit. Üheksas sõnum lükati tagasi (`context_window_full`) ja vestlust sai jätkata ainult paneeli või „uus vestlus“ nupu kaudu.

## Mida mudelid juba ise teevad

- **Teine inimene:** otsinguplaan nimetab igal pöördel, kelle olukorra kohta sõnum on ([ADR-049](adr-049-person-bound-municipality.md)). Olek hoiab iga inimese valda eraldi.
- **Parandus:** olek kirjutab, milline fakt asendab varasema või milline võeti tagasi ([ADR-051](adr-051-fact-lifecycle-and-place-attribution.md)). Vastuse juhis ütleb, et hilisem parandus asendab varasema.
- Seega tuli paneelist üle ainult teema täitumine.

## Otsus

- **Vestluse vaates paneeli ei ole** (`ChatBodyView`). Vestlus saadab esimese sõnumiga „uus“ ja edaspidi „jätka“.
- **Täis teema jätkub uues teemas sama inimese kohta.** See juhtub, kui teemas on juba 8 sõnumit ja jätkuks ei valita teemat eraldi.
  - Varasemast teemast ei lõigata midagi ära.
  - Uue teema esimene sõnum on märgitud kui uus teema (`context.mode: 'new'`) ja `selection.previousScopeFull` nimetab täis teema.
  - Kasutaja jaoks näeb see välja nagu enne paneelist „uus teema“ valides.
- Selgesõnaline valik (`contextTurnId`) täis teemale lükatakse endiselt tagasi, sest see nõuaks lõikamist.
- **API on alles:** parandus, uus teema ja uus inimene on endiselt võimalikud. Neid kasutavad hindamiskataloogid ja arendusleht `/rag-pilot`.
- Värsket algust saab endiselt üleval „uus vestlus“ nupust.

## Mõõtmine enne ühendamist

Serveris, rakenduse ajutises koopias, profiil v5, aktiveerimata plaan; koopia ja plaan on eemaldatud.

- **Hindaja uus valik `--auto-modes`:** saadab, mida vestlus nüüd saadab — esimese sõnumiga „uus“ ja edaspidi „jätka“, olgu kataloogis mis tahes režiim.
- **Kontroll, mida jäeti välja:** `previous_state_cleared`. Seda saab täita ainult selgesõnaline „uus inimene“; ilma selleta jääb olek alles ja hoiab inimesi eraldi.

Jooksud: kõik kataloogide stsenaariumid, kus vestluses on parandus, uus teema või uus inimene.

| Kataloog | Stsenaariumid | Pöördeid | Läbis |
|---|---|---:|---:|
| corpus-4 | ema Kosest Harkusse (parandus), isa Tallinnas ja siis enda võlad Kose vallas (uus inimene), hooldekodu parandus, seadus eri kuupäevadel (uus teema), tädi Saue vallas (uus inimene) | 16 | 16 |
| fact-lifecycle-1 | võla parandus ja ema jääb meelde; töötuse tagasivõtmine | 6 | 6 |
| memory-1 | võlgade parandus ja tagasivõtmine | 5 | 5 |
| **Kokku** | 8 vestlust | **27** | **27** |

Käsitsi loetud:

- „Mul on suured võlad, kes aitab?“ pärast isa Tallinnas: vastus ei võtnud isa valda üle ja küsis „Millises omavalitsuses sina elad?“. Pärast „Elan Kose vallas“ vastas Kose valla võlanõustamise ja kontaktiga.
- „Minu tädi elab Saue vallas ja vajab sama“ pärast ema Raasiku vallas: Saue valla koduteenus, mitte Raasiku oma.

Kulu 0,147 USD plaani hindade järgi, kolm jooksu.

## Testid

- `tests/rag-v2-dialogue.test.mjs`: täis teema järgmine sõnum alustab uut teemat sama inimese kohta, ilma eelmise teema sõnumiteta, ja nimetab täis teema. Järgmine sõnum jätkab uut teemat. Selgesõnaline valik täis teemale lükatakse tagasi.
- `tests/rag-v2-dialogue-store.test.mjs` (vajab kohalikku `sotsiaal_ai_m4_dev` andmebaasi ega käi CI komplektis) on uuendatud sama käitumise järgi, aga selles masinas jäi see käivitamata.

## Piirid

- Mõõdetud on 27 pööret, iga stsenaarium üks kord.
- Kui sõnum viitab varasema vastuse punktile („teine punkt“), loeb mudel seda nüüd viimase vastuse järgi. Konkreetse vastuse valimist enam vestluses ei ole.
- Täis teema uus algus ei kandnud üle eelmise teema olekut (näiteks valda), ja kümnes sõnum ebaõnnestus. Mõlemad on lahendatud: [ADR-070](adr-070-full-topic-hands-over.md).
