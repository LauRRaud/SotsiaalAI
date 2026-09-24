# ADR-028 — Tootmise vastusjuhis v10

24.09.2026. Teostus Claude Opus 5.5.

## Probleem

`m4-grounded-answer-9` oli arenduspiloodi juhis.

- Roll oli „piiratud arenduspiloot”.
- Mitu keeldu kordus eri sõnastuses. Näiteks „ära mõtle välja” esines vähemalt viiel kujul.
- Juhis koosnes peaaegu ainult keeldudest. Seda, milline on hea vastus, peaaegu ei kirjeldatud: toon, pöördumine ja ülesehitus (võimalus → miks sobib → järgmine samm) puudusid.
- Päris mudeli jooksus (vt [dialogue-scenarios-2026-09-24.md](dialogue-scenarios-2026-09-24.md)) kasutas Luna segamini „sina” ja „teie” vormi. Raske olukorra vastused algasid sageli sama vormeliga „Mul on kahju…”.
- Kriisi käsitlust juhises polnud. Server näitab kriisiteadet eraldi, kuid mudel ei teadnud sellest.

## Otsus

**Üks juhis üheksa sildistatud jaotisega:** ROLE, LANGUAGE AND VOICE, INPUT SAFETY, A GOOD ANSWER, CLARIFYING, EVIDENCE, SOURCE TYPES AND TIME, LIMITS OF THE EVIDENCE, OUTPUT. Kood asub [contracts.js](../../lib/rag-v2/pilot/contracts.js) funktsioonis `answerInstructions(language)`.

**Kõik v9 kaitsereeglid on alles.**
- Kordused on liidetud: hinnad/tingimused/kuupäevad, faktilehe näide, väljamõeldud viide ja tühjad plokid.
- Test [rag-v2-answer-prompt.test.mjs](../../tests/rag-v2-answer-prompt.test.mjs) hoiab 26 kaitsefraasi. Hilisem ümbersõnastus peab need alles jätma või mõne teadlikult testist eemaldama.

**Uus sisu:**
- **Roll:** SotsiaalAI abiline Eesti sotsiaalhoolekande küsimustes, nii abivajajatele kui spetsialistidele.
- **Pöördumine vastuse keele järgi:**
  - eesti keeles „sina” nagu kasutajaliideses; kui inimene kasutab järjekindlalt „teie” vormi, peegeldatakse seda;
  - vene keeles „вы” nagu kasutajaliideses;
  - inglise keeles „you”.
- **Keel ja toon:**
  - lihtne keel, ametlik termin selgitatakse esmakordsel kasutamisel;
  - lühike ja loomulik kaastunne ilma iga pöörde korduva vormelita;
  - hüüumärke, emojisid ega müügitooni ei kasutata.
- **Hea vastus:** tavaliselt üks kuni kolm võimalust, olulisim esimesena. Iga võimaluse juures on, mis see on, miks see võiks sobida ja kuidas edasi minna. Lõpus on üks järgmine samm, kui allikas seda toetab.
- **Kriis:** rakendus näitab kontrollitud hädaabikontakte eraldi. Luna vastab rahulikult, küsib vajadusel vahetu ohu kohta ega asenda neid kontakte oma numbritega.

**Moodulitesse ei jagatud.** Ajakirja reeglid (autorsus, sündmused, programmid, sõltuvused) jäid põhijuhisesse. Ühine rada otsib ajakirja teadmisi igas pöördes ([retrieval.js:152](../../lib/rag-v2/pilot/retrieval.js)), seega oleks moodul tootmises peaaegu alati kaasas. Tingimuslik lisamine tooks ainult uue veavõimaluse.

**Juhis on inglise keeles, mitte kolmes keeles.**
- Vastuse keele määrab server ja juhis nõuab seda (v9-st muutmata).
- Keelest sõltub ainult pöördumise lause.
- Kolm tõlget tähendaksid kolme juhist, mida tuleks sünkroonis hoida. Iga tõlge võiks kaitsereegli tähendust nihutada.

**Suurus:**
- Põhijuhis kasvas 8 420-lt umbes 9 400 märgini (1 690–1 732 tokenit keele järgi).
- Terve vestlusjuhis kasvas 2 804-lt 3 043 tokenini.
- Korduste liitmine hoidis kokku vähem, kui lisas uus juhis. Tootmises on selle maht allikate kõrval väike.

**Versioonid:** `m4-grounded-answer-10` ja `m4-grounded-dialogue-7`. Vestlusjuhis sisaldab põhijuhist, seetõttu tõusis ka selle versioon. v9 ja dialogue-6 plaanid jäävad loetavaks, aga uusi vastuseid need käivitada ei saa.

## Mõõtmine

| Kontroll | Tulemus |
| --- | --- |
| `npm test` | 217 testi, 0 viga |
| Stsenaariumid asendusmudeliga | 6/6. Asendusmudel ei loe juhist, see kontrollib ainult rada. |
| Stsenaariumid päris mudeliga (v10 vs v9 jooks 24.09) | **Ootab.** Vaja on deploy'd ja 17 gpt-6-luna kutset. |
| Ajakirja küsimused päris mudeliga | **Ootab eraldi kinnitust.** Ajakirja reeglite sisu on sama, sõnastus ja järjekord muutusid. |

Päris mudeli võrdluses jälgitakse:
- pöördumist (sina/teie);
- kaastundevormeli kordumist;
- võimaluste arvu ja järgmist sammu;
- tsiteeritud teenuseid;
- seisu tagasilükkamisi (nüüd põhjusega).

## Tootmisse viimine

Tootmises kehtib v10 alles uue piloodiplaaniga, milles on `promptVersion` ja `implementationHash`. Plaani kinnitab omanik.

Serveri praegune plaan kasutab juhist v9 ja töötab ilma vestluse ja kataloogita. Selle `implementationHash` ei vasta juba praegu deploy'tud koodile (kontrollitud 24.09, commit `c89cd38d`). Seega ei saa see plaan ka täna uusi pilootvastuseid anda. v10 deploy seda olukorda ei muuda.

Uus plaan peaks korraga sisse lülitama:
- v10 juhise;
- vestluse ja selle seisu;
- ühise raja;
- vallakataloogi;
- ADR-027 soovitatud profiili.
