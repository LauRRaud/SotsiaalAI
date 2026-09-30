# ADR-061 — Vastus annab vormi lingi

30.09.2026. Teostus Claude Opus 5.5. Omanik 30.09: „ma ei taha enda andmebaasi taotlusi, kui assistent vastab kasutajale, annab ta lingi“. Järgib [ADR-016](adr-016-structured-municipal-dialogue.md) (KOV-kirjed vestluses) ja [ADR-025](adr-025-compact-record-model-context.md) (kirjete mudelivaade).

## Probleem

- **KOV-pakettides on 870 vormikirjet.** Igal on pealkiri, link (`officialUrl`), formaat, esitamise viisid ja lühikokkuvõte. 1422 teenust või toetust viitab oma vormidele (`relatedForms`). Vormifailide endi teksti andmebaasis pole. Kirje `content_hash` räsib kirje andmeid, mitte faili.
- **Päris vestluses 30.09:** küsimusele „Mis dokumente on vaja Kose vallas matusetoetuse taotlemiseks?“ vastus nimetas vormi ja viitas vormikirjele (S25). Link oli aga kolme kliki kaugusel: viide → allikate paneel → „Ava allikas“ → „Algallikas“.

## Otsus

- **Vormide tekstid jäävad korpusest välja.** Vorm jääb omavalitsuse dokumendiks ja kasutaja saab lingi.
- **Server võtab lingid käigu salvestatud kirjekontekstist (`record_context`), mitte mudeli tekstist** (`answerForms` failis `lib/rag-v2/pilot/presentation.js`):
  - vormikirje, millele vastus viitab;
  - vorm, mille viidatud ja täielikult näidatud kirje (`selected_detail` või `relevant_detail`) oma vormiks nimetab (`relation: 'form'`). Kataloogireana näidatud kirje vorme ei lisata, sest loetelu-vastus tooks muidu kümneid linke.
  - Lingiks sobib ainult allika enda `https`-aadress. Iga aadress tuleb üks kord, kokku kuni viis.
  - Formaat (`docx`, `pdf`, …) lisatakse nimele ainult siis, kui see on failitüüp. Väärtused nagu `web_form` või `PDF/DOC/DOK` jäävad nimest välja.
- **Vestlus näitab lingid vastuse all olemasoleva manuste rea kaudu (`attachments`)** nii voo lõpus kui ka vestluse uuesti laadimisel. Näiteks: „Matusetoetuse avalduse vorm2026 (docx)“. Väline link avaneb uues aknas ja vestlus jääb alles. Omaniku soovil (30.09, #288) on vormi link tavaline allajoonitud link, iga oma real, ilma manuse pilli taustata. Allalaaditav fail jääb pilliks. #289: link on vastuse teksti suurune ja joon käitub nagu saidi teistel linkidel (hele, hõljutades selgem); varem oli kiri 14 px ja hõljutus tegi joone 2 px paksuseks.
- **Mudeli juhis, vastuse leping ja korpus ei muutu.** Uus käik on vaja ainult selleks, et link ilmuks. Salvestatud käigud saavad lingid uuesti laadimisel samast kirjekontekstist.

## Kontroll

`tests/rag-v2-pilot-chat-adapter.test.mjs`:

- viidatud vorm tuleb esimesena, täielikult näidatud kirje vorm järgmisena, aadress üks kord;
- kataloogikirje vorm, `http`-aadress ja vastuse tekstis olev aadress linki ei anna;
- ilma kirjekontekstita või ilma viidatud kirjeta linke pole, ülempiir on viis;
- `pilotChatResult` ja `pilotChatMessages` annavad samad lingid.
