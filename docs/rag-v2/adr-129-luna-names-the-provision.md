# ADR-129: Luna nimetab seaduse sätte

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (kavandasid, ehitasid ja vaatasid üle agendid kahes ringis; teise ringi lõpetamine, testid, serveri mõõtmised ja otsused minult). Omanik 10.10.2026: „Kasutajad tahavad teada paragrahve ja tõenäoliselt hakatakse ka testima seda platvormil, kas assistent teab ja oskab täpselt nimetada „SHS § 133 lg 5 järgi…““. Seis: **kood ja testid tehtud; enne serverisse saatmist mõõdetud serveris tasuta (otsingukontroll) ja tasuliselt (22 küsimust kolmes seadistuses, 0,2970 USD).**

## Probleem

234 salvestatud vastusest nimetas paragrahvi üks. Vastuse hääle reegel (vastus räägib oma sõnadega, allikaid tekstis ei nimeta) hoidis ka seaduse sätte tekstist väljas, ja mudel ei näinud, milline säte iga seaduselõik on: lõigu tekst algab sageli keset paragrahvi. [ADR-123](adr-123-provision-label-for-legal-passages.md) silt üksi ei muutnud midagi (0 vastust 16-st), sest juhis keelas sätet nimetada.

## Otsus

**1. Iga seaduselõik kannab silti.** Mudeli ette jõudev õigusakti lõik saab välja `provision` („§ 133 lg 5–7“), mis tuleb akti XML-i struktuurist, mitte tekstist arvamisest (ADR-123 silt, nüüd kasutusel; kontekst `model-context-json-5`). Seaduse allikakaart kannab ka Riigi Teataja ametlikku lühendit (`act_abbreviation`): tabel `lib/rag-v2/search/act-abbreviations.json` on tehtud akti XML-ist (`scripts/rag-v2-act-abbreviations.mjs`), 37 seaduse pealkirja, neist 36 lühendiga.

**2. Juhis ütleb, millal ja kuidas sätet nimetada.** Vastuse juhises on uus osa LEGAL PROVISIONS (`m4-grounded-answer-13`, vestluse juhis `m4-grounded-dialogue-42`):

- Kui vastuse plokk võtab õiguse, kohustuse, tingimuse, summa, tähtaja või korra sildiga lõigust, nimetab ta akti ja sätte.
- Nimetada tohib ainult seda, mis on mudelile ette antud: viidatud lõigu silt, lõigu enda tekstis kirjas olev säte või viide, akti kuupäevade säte, redaktsioonide võrdluse loetletud säte. Mälust, kasutaja sõnumist ega varasemast vastusest numbrit ei võeta.
- Juhendi, artikli või veebilehe mainitud paragrahv on selle allika enda viide, mitte väite säte.
- Vorm: eesti keeles „(sotsiaalhoolekande seaduse § N lg M)“, inglise ja vene keeles oma vorm. Juhise tekstis on ainult kohatäited, mitte ükski päris number ega akt.

**3. Kui palju, sõltub lugejast** (rolli rida saadetakse pärast tõendeid):

- **Abiotsija:** akti täisnimi, säte sulgudes lause järel ainult selle kohta, millele inimene saab toetuda või mida peab täitma. Lühendit ei kasutata.
- **Spetsialist ja teenuseosutaja:** säte iga reegli juures, lõike täpsusega; pärast ühte täisnime koos lühendiga võib kasutada lühendit („SHS § 133 lg 5“).

**4. Server kontrollib iga nimetatud sätet, aga ei keeldu** (`lib/rag-v2/pilot/provision-check.js`). Iga vastuses nimetatud säte saab liigi: viidatud lõigu silt (a), viidatud lõigu tekstis kirjas (b), sama pöörde teise lõigu oma (c), redaktsioonide võrdlusest (v), kasutaja nimetatud ja ainult väljaspool plokke (q), mitte kusagilt (d). Loendus salvestatakse pöördega. **Keeldumiste loend on tühi:** kaks ülevaatust leidsid kuus viisi, kuidas kontroll oleks õige vastuse kinni pidanud. Need on parandatud ja testidega kinni, aga inimesele makstud vastuse kinnipidamine kontrolli enda vea pärast on halvem kui see, mille eest keeldumine kaitseb. Enne kui liik d hakkab vastust peatama, tuleb mõõta, et vale d-d ei ole.

**5. Säte on näha ka allikate paneelis:** akti pealkirja kõrval seisab lõigu säte („S1 · Sotsiaalhoolekande seadus, § 133 lg 5–7“), ka ajaloos ja allikavaates.

## Mõõdetud

**Tasuta:**

- Kogu ühiktestide komplekt: 1721 testi, 0 viga. Andmebaasitestid kohalikus testandmebaasis: `rag-v2-pilot-store` 49/49, `rag-v2-dialogue-store` 39/39.
- Otsingukontroll serveris muutmata koodi vastu (ADR-122): 33 kindlat küsimust valivad samad lõigud; silt ja lühend on lisad väljaspool eelarveid.

**Tasuline, omaniku loal (10.10.2026: samad 22 küsimust kolmes seadistuses, lagi 0,45 USD):** kataloog `tests/evaluation/dialogue/scenarios-provisions-1.json` (20 stsenaariumi, 22 pööret: 9 abiotsija, 12 spetsialisti, 1 teenuseosutaja; üks inglise ja üks vene keeles), küsitud serveris veel saatmata koodiga.

| | A: kõik madal (vaikimisi) | B: vastus keskmine (välgunupp) | C: plaan, lõikude valik ja vastus keskmine |
|---|---:|---:|---:|
| Lõpetatud pöördeid | 22 | 22 | 22 |
| Vastuseid, mis nimetavad sätet | 17 | 18 | 16 |
| Nimetatud sätteid kokku | 63 | 64 | 53 |
| – viidatud lõigu silt (a) | 54 | 59 | 43 |
| – viidatud lõigu tekstis kirjas (b) | 4 | 2 | 7 |
| – sama pöörde teise lõigu oma (c) | 1 | 1 | 0 |
| – kasutaja nimetatud, piirangus (q) | 2 | 2 | 3 |
| – redaktsioonide võrdlusest (v) | 2 | 0 | 0 |
| – **mitte kusagilt (d)** | **0** | **0** | **0** |
| Pöörde mediaan | 21 s | 32 s | 28 s |
| Hind | 0,0952 USD | 0,0996 USD | 0,1022 USD |

- **Ükski 180 nimetatud sättest ei olnud alusetu.** Küsimusele „Mida ütleb SHS § 133 lg 5?“ algab vastus „SHS § 133 lg 5 järgi …“ (A ja B).
- Küsimus ilma õigusaktita („Kuidas rääkida lapsega vanemate lahutusest?“) ja ainult juhendile toetuv küsimus ei nimeta ühtegi sätet. Säte, mille teksti ei ole (§ 133 lg 99; seadus, mida kogus ei ole), saab ausa piirangu, mitte väljamõeldud sisu.
- **Abiotsija vastus nimetab rohkem sätteid, kui juhis ütleb:** kolmes vastuses 8, 10 ja 4 (juhis: tavaliselt üks kuni kolm). Kõik on õiged (liik a); see on häälestuse küsimus, mitte viga.
- **Seadistuste võrdlus (üks käivitus seadistuse kohta, näitab suunda, mitte tõestust):** keskmise astmega vastus (B) oli veidi parem: eriolukorra tähtaja küsimus sai õige vastuse, mida A ja C ei andnud. Kõigi kolme kutse tõstmine keskmisele (C) ei lisanud midagi: sätteid nimetati vähem ja „Mida ütleb SHS § 133 lg 5?“ jäi seal vastuseta, sest otsing ei toonud seda lõiku.
- Kataloogi üks keelumuster oli liiga lai (aus lause „ei saa öelda, mida § 133 lg 99 sätestab“ läks selle alla); muster on kitsendatud ja testiga kinni.

## Hind ja piirid

- Iga vastuse päring on umbes 1100–1200 märgendit pikem (juhise osa ja rolli rida), lisaks kuni 300 märgendit silte ja lühendeid.
- Kontroll ei erista punkte ega lauseid (silt lõpeb lõikega).
- Akt, mida vastus ei nimeta, loetakse viimati nimetatud aktiks leebelt: kui vastus vahetab akti seda nimetamata, võib teise akti sama number saada liigi a. Loendus märgib sellised eraldi (`after_other_act`).
- Inglise või vene keeles ilma eestikeelse pealkirjata nimetatud akti ei tunta ära.
- Pärast täiendust, mis lisab seaduse või seaduse redaktsiooni, tuleb käivitada `node scripts/rag-v2-act-abbreviations.mjs --write`; tabeli test ebaõnnestub seni.

## Kontrollimata

- Allikate paneeli silt brauseris (kaetud ühiktestidega kihtide kaupa; päris vaates vaadatakse pärast saatmist proovipööretega).
- Inglise ja vene keele vorm: kummaski üks pööre.
- Kas abiotsija vastuses peaks sätteid olema vähem (omaniku otsus).
- Kontrolli liik d päris vestluste peal: enne kui see hakkab vastuseid peatama, tuleb lugeda tervisearuande loendust ja iga d käsitsi.
