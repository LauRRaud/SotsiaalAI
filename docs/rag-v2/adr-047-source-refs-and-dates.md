# ADR-047 — Viited vastuses ja allika kuupäev allikaloendis

28.09.2026. Teostus Claude Opus 5.5 omaniku ülesandel, kui aknast vaadati, kas vestlus on tootmiseks valmis.

## Probleem

- **Viited polnud klikitavad.** Vastuses oli `[S37, S21]` lihttekst. Allikad olid olemas, aga kolmanda ikoonina menüüs „Sõnumi tegevused“ → „Vastuste allikad“. Vestluse kohal olnud allikanupp kadus „hämarikuruumi“ redisainiga: omadused jõuavad `ConversationView`-sse, aga neid ei kasutata.
- **Korduv lõpulause.** Iga omavalitsuse vastus lõppes lausega „andmed kogutud 30.04.2026, praegust kättesaadavust ei saa kinnitada“. Selle põhjustas promptireegel eristada kogutud ajaloolist kirjet kontrollitud infost.

## Otsus

- **Viitenupp.** Vastuse tekstis on iga viiterühm (`[S37, S21]`) väike nupp: sama värv mis tekst, väiksem ja punktiirse allajoonega.
  - Nupp avab allikapaneeli ainult nende allikatega. Kui neid ei leita, avab kõik vastuse allikad.
  - Tekst jääb samaks, nii et kopeerimine ja ettelugemine ei muutu.
  - Allikateta vastuses jääb tekst lihttekstiks.
  - Klõps ega klahv ei käivita mulli enda toiminguid.
- **Kuupäev allika juures.** Allikapaneelis on iga allika real kontrolli või kogumise kuupäev („S37 · Sotsiaaltransporditeenus · kontrollitud 30.04.2026 · Vastuses kasutatud“).
  - See tuleb tõendi `source_metadata.source_checked_at`-ist; eksporditud kontaktil on see ekspordi kontrolliaeg.
- **Dialoogi prompt `m4-grounded-dialogue-13`** (ainult omavalitsuse kataloogiga):
  - allikaloend näitab iga allika kuupäeva, seega ei kirjuta mudel eraldi lauset kogumise või kontrolli kuupäevast ega kinnitamata kättesaadavusest;
  - kui see järgmise sammu jaoks loeb, ütleb mudel paari sõnaga, et üksikasjad tasub omavalitsusega üle kinnitada.
  - Ajalooliste andmete eristamise reegel jääb alles.

## Kontroll

- **`tests/rag-v2-pilot-chat-adapter.test.mjs`:** kuupäev jõuab paneeli sildile, vigane väärtus mitte.
- **`tests/rag-v2-answer-prompt.test.mjs`:** v13 lause on kataloogiga promptis ja ainult seal; v12 jääb loetavaks.
- **Komponent renderdati serveriväliselt esbuild'iga:**
  - kaks viiterühma andsid kaks nuppu, sildiga „Ava allikad S37, S21“ ja „Ava allikad S24“;
  - allikateta vastuses nuppe ei olnud ja tekst jäi samaks.
- `npm test` läbis ja ESLint on puhas.
- Pärast väljalaset kontrollitakse aknas, et nupp avab paneeli ja lõpulauset enam pole.
