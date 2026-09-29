# ADR-052 — Vestluse järjekord, piloodi läbilaskevõime ja kaotatud pöörded

29.09.2026. Teostus Claude Opus 5.5 Codexi süsteemianalüüsi leiu F7 põhjal ([audit](../audits/rag-v2-system-analysis-2026-09-29.md)). Omanik 29.09: „jätka arendustööd; Codex kontrollib koodi, kui kõik arendustööd on tehtud“.

## Probleem

- `PilotStore.claim` luges pooleliolevaid pöördeid terve plaani (`pilotId`) ulatuses, sh `unknown` ja `needs_recovery`. Üks selline pööre andis kõigile teistele `pilot_busy_or_unknown` (429).
- **Kaotatud protsess blokeeris vestluse kuni plaani uuendamiseni.** Kui protsess katkes pöörde ajal (taaskäivitus, mäluviga), jäi rida `claimed` või `*_sent` olekusse.
- Teadmata tulemusega kutse (`unknown`) blokeeris igaveseks, kuigi selle kulu on reserveeringuna päevikus juba arvestatud.

## Otsus

- **Vestluse järjekord:** vestluses võib korraga olla üks pooleliolev pööre, muidu `conversation_busy` (429). Dialoogi kontekst ja olek eeldavad eelmise pöörde lõppu.
- **Piloodi läbilaskevõime:** plaani ulatuses korraga kuni 3 pooleliolevat pööret (`PILOT_TURN_LIMITS.concurrent`), muidu `pilot_busy` (429).
- **Eelarve jääb kaitstuks ilma globaalse lukuta.** Iga sammu reserveering kontrollitakse päeviku lukus (`pg_advisory_xact_lock`) piiride vastu; paralleelsed pöörded ei saa piiri ületada.
- **Kaotatud pöörde sulgemine.** Pooleliolev pööre, mille real pole 5 minutit (`staleMs`) ühtegi kirjutust, on oma protsessi kaotanud. Pakkujakutse lõpeb 60 s jooksul ja iga samm kirjutab rea.
  - Kui mõni kutse on saadetud (`sent_unknown`), saab pööre oleku `unknown`, sest kutse võis olla arveldatud. Muidu saab pööre oleku `stopped`.
  - Mõlemal on `error: turn_abandoned` ja `abandoned: { state, lastWriteAt }`.
  - Reserveering jääb päevikusse kuluna. Midagi ei saadeta uuesti ja midagi ei kustutata.
  - Sulgemine toimub järgmise pöörde `claim`-is, samas tehingus.
- **`unknown` ja `needs_recovery` ei blokeeri kedagi.**
  - `unknown` kulu ülempiir on reserveeringus.
  - `needs_recovery` on valideeritud vastus, mille `recover` avaldab ilma uue kutseta.
- Sama võtmega kordus tagastab endiselt sama pöörde ega alusta uut kutset.

## Piirid

- Teadmata kutse tegelikku kulu ei lepitata pakkuja andmetega. Päevik hoiab konservatiivset reserveeringut ja tegelik kulu on OpenAI platvormil.
- Kaotatud pööre suletakse alles siis, kui järgmine pöördumine sama plaani alla tuleb. Eraldi taustatööd pole.
- Piirid on koodis (`PILOT_TURN_LIMITS`), mitte plaanis. Nende muutmine ei vaja käsitsi plaani.

## Kontroll

- `tests/rag-v2-pilot-store.test.mjs` (päris andmebaas):
  - sama vestluse teine pööre saab `conversation_busy`;
  - teised vestlused jooksevad kuni piirini, üle selle `pilot_busy`;
  - 6 minutit vanad pöörded suletakse: saadetud kutsega pööre saab `unknown`, teised `stopped`;
  - päevik ei muutu ja kutseid ei korrata;
  - `unknown` pööre ei blokeeri uut pööret ning selle töö jääb saatmata.
- `tests/rag-v2-unified.integration.test.mjs`: assisti kutsete vahel peatunud pööre hoiab oma vestlust kinni (`conversation_busy`).
