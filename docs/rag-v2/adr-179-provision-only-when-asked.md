# ADR-179 — Paragrahv vastuses ainult küsimisel, muidu paneelis „Allikad“ (m4-grounded-answer-17, m4-grounded-dialogue-52)

22.10.2026. Teostus Claude Opus 5.5. Asendab ADR-178. ADR-129 reegleid muudab ainult selles, millal paragrahv nimetatakse.

## Leid

- ADR-178 (answer-16) pani paragrahvi lause sisse ja enne punkti. Esimene vastus serveris kirjutas:
  „… teenuse määramise otsustab sotsiaal- ja tervishoiuosakond (Harku valla „Sotsiaalhoolekandelise abi andmise kord“
  § 11 lg 1–2 ja § 12 lg 4).“
- Omanik: „ei meeldi“.
- Valikute peale vastas omanik varem nii: „variant on ka lõigu sees lühendatult, siduda teksti sisse. Või siis ainult
  eraldi allikatesse, kust saab ka vaadata“.
- Küsimuse peale „kõigil rollidel või ainult pöördujal?“ vastas omanik: „Kõigil rollidel“.

## Otsus

- **answer-17, LEGAL PROVISIONS.**
  - Paneel „Allikad“ näitab iga tsiteeritud õigusakti lõiku koos akti ja paragrahviga („Sotsiaalhoolekande seadus,
    § 17 lg 1–2“). Seepärast ei nimeta vastus vaikimisi kumbagi. Plokk ütleb reegli argikeeles ja tsiteerib lõiku
    viidetega (refs).
  - Akt ja paragrahv nimetatakse ainult siis, kui kasutaja seda küsib:
    - mis paragrahv midagi ütleb;
    - mis on õiguslik alus;
    - palub viidata sättele („viita sättele“);
    - mida ütleb akt või paragrahv, mille ta ise nimetab, või kuidas see muutub.

    Siis nimetatakse need reeglid, mis sellele vastavad, ja vastuse esimene lause nimetab küsitud paragrahvi.
  - Nimetatud paragrahv käib lause sisse enne punkti (ADR-178). Ülejäänu jääb ADR-129 järgi: mida tohib nimetada, vormid
    ja serveri kontroll (`provision-check.js`).
- **dialogue-52, rolli read.** Iga roll ütleb, mida nimetada, kui paragrahvi küsitakse:
  - spetsialist: iga reegel kuni lõikeni;
  - teenuseosutaja: teenuse nõuded;
  - pöörduja: üks kuni kolm. Pöörduja vastuses on seaduse nimi jälle täispikk ja lühendita, nagu enne ADR-178.
- **Hindamisstsenaariumid** (`scenarios-provisions-1.json`). Kolmes pöördes, mis paragrahvi ei küsi, on nüüd
  `names_provision: false`:
  - toimetulekutoetuse tähtaeg, esimene pööre;
  - Kuusalu eluasemekulud;
  - teenuseosutaja nõuded.

  Pöörded, mis küsivad („Mis paragrahv seda ütleb?“, „Viita palun sättele“, „Mis sättest see tuleb?“, „mis õigusaktist
  see tuleb“, „Mida ütleb SHS § 133 lg 5?“), ootavad paragrahvi edasi.

## Mõju

- ADR-129 eesmärk oli, et kasutaja saab paragrahvi teada. See jääb täidetuks paneeli „Allikad“ kaudu ja küsimise peale.
- Vastus läheb lühemaks. Põhijuhise muutus katkestab puhvri üks kord.
- Esimese teksti aega tuleb serveris vaadata, nagu ADR-178 puhul.

## Kontroll

- **Kohalikult:**
  - moodulid laaditakse, versioonid ja loendid on õiged;
  - stsenaariumikataloog läbib `validateCatalogue`;
  - eslint on puhas.
- **Serveris:**
  - pöörduja küsimus ilma paragrahvi küsimata: vastuses ei tohi paragrahvi olla;
  - jätkuküsimus „Mis paragrahv seda ütleb?“: vastus nimetab paragrahvi.
