# ADR-119: Luna enda täpsustav küsimus jõuab otsinguplaani ja valikuni

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „Do this task here: Luna täpsustav küsimus jõuab otsinguni“. Seis: **serveris alates 09.10.2026 kell 22.30 (väljalase `d7840637`); mõõdetud samal õhtul 18 päris pöördega (0,0809 USD).**

## Probleem

Otsinguplaan ja tõendite valik loevad ainult kasutaja sõnumeid ([ADR-077](adr-077-current-message-only-and-both-versions.md) „Piirid“, [ADR-103](adr-103-settlement-names.md) „Mida see ei tee“). Kui Luna eelmine vastus lõppes täpsustava küsimusega ja inimene vastas lühidalt („jah“, „toetuse kohta“, „linnas“), tehti plaan ja valik teadmata, mida küsiti. Küsimust nägi ainult vastav mudel.

30 pöörde testides lõppes viis kuni seitse vastust iga neljateist kuni kolmekümne kohta küsimusega, nii et vastused neile on tavalised.

## Otsus

Otsinguabi versioon 13 (`rag-v2/search-assist-13`, `lib/rag-v2/pilot/search-assist.js`):

- **Plaani ja valiku sisendis on uus väli `assistant_question`**: küsimus, millega lõppes Luna vastus sõnumile vahetult enne praegust.
- **Kummaski juhises üks rida** (plaani viimane; valikus mure rea järel): see on abilise enda küsimus, mitte fakt, mitte palve ega kasutaja sõna. Kui praegune sõnum sellele vastab, tehakse päringud ja valik selle kohta, milleks varasem palve selle vastusega saab. Kui ei vasta, jäetakse see tähele panemata. Küsimuse enda kohta päringut ei kirjutata ja seda, mida küsimus ainult küsib, tõeks ei peeta.
- **Isik ja koht tulevad endiselt ainult kasutaja sõnumitest.** Vastuse skeem ei muutunud: mudel ei saa anda kohta ega isikut, mida ta enne anda ei saanud, ja server kontrollib kohti kasutaja sõnumi vastu nagu enne.

### Millal küsimus kaasa antakse

Server annab küsimuse kaasa ainult seal, kus viga oli (`askedQuestion`):

1. küsimusega lõppenud vastus on see, millele praegune sõnum järgneb: vastus vahetult eelmisele sõnumile või vastus, millele kasutaja otse vastab. Kui eelmine sõnum jäi vastuseta (katkenud pööre), on viimane avaldatud vastus vanem ja küsimust ei anta;
2. praegune sõnum on lühike: kuni 12 sõna.

Pikem sõnum ütleb ise, mida küsib, ja selle plaan jääb selliseks, nagu oli. Kui küsimust ei anta, on mõlema kutse sisend täht-tähelt sama mis enne; juhised on igal pöördel samad.

Pöörde kirje märgib, et küsimus anti kaasa (`searchAssist.assistantQuestion`).

### Mida see ei tee

- **Jah-vastus kohaküsimusele ei sea kohta.** Kui Luna küsib „Kas elad Tallinnas?“ ja inimene vastab „jah“, ei ole kohta ühegi kasutaja sõnumis ja server seda ei võta. Lahtisele küsimusele („Mis omavalitsuses elad?“) antud vastus „Tallinnas“ nimetab koha kasutaja enda sõnumis ja see tee töötas juba enne (ADR-103).
- Luna teksti ei panda otsingu teksti ega vektoriks: otsing tehakse kasutaja sõnadest ja plaani päringutest.
- 12 sõna piir on minu valik, mitte mõõdetud: see hoiab muudatuse seal, kus viga kirjeldati.

## Kuidas see serverisse jõuab

Vestluse plaan võtab otsinguabi versiooni koodist ja väljalase uuendab plaani ise (`lib/rag-v2/pilot/chat-plan.js`), nii et pärast väljalaset töötab plaan versiooniga 13. Varasemad versioonid jäävad loetavate loendisse.

## Kontrollitud

- Ühiktestid (värske põhiharu peal): 1240, neist 1218 läbi ja 22 vahele jäetud; ESLint muudetud failidel. Uus test: sisendi kuju küsimusega ja ilma (ilma on täht-tähelt endine), juhiste ridade koht, skeem muutmata, reegli sõnastus, ja millal küsimus antakse (eelmise sõnumi vastus, otse vastamine, 12 ja 13 sõna, vastuseta jäänud eelmine sõnum, puuduv või tühi küsimus). Varasemaid versiooninumbreid ja juhiste lõppu hoidvad testid on uuendatud; ülejäänud juhiste räsi on sama.
- **Kohalik andmebaas, teenuse kaudu** (`tests/rag-v2-dialogue-store.test.mjs`, 37/37; `tests/rag-v2-pilot-store.test.mjs`, 48/48): kaks uut testi. Lühike vastus küsimusele: plaani ja valiku päringus on küsimus, pöörde kirjes märge, otsingu tekstis ega päringutes küsimust ei ole, inimese elukoht jääb. Esimene sõnum, sõnum pärast vastust, mis midagi ei küsinud, ja pikk sõnum pärast küsimust: küsimust ei ole.

## Mõõdetud päris vestluses (09.10.2026)

Omaniku loal (lagi 0,10 USD) töötava väljalaske enda vestlusteenuse kaudu: viis vestluse algust abiotsija rollis, igaüks kaks korda; seal, kus Luna vastus lõppes küsimusega, saadeti lühike vastus kindla reegli järgi („Tartu linnas“ küsimusele, kus inimene elab; „jah“ jah-ei-küsimusele). **18 pööret, 0,0809 USD**, kõik lõpuni.

| | Tulemus |
|---|---|
| Esimesi sõnumeid | 10; neist 8 vastust lõppes küsimusega (kaks „ema ei saa üksi hakkama“ vastust ei küsinud midagi) |
| Lühikesi vastuseid | 8; **kõigil 8 jõudis Luna küsimus plaani ja valikuni** |
| Plaani päringutes on sõnu, mis olid ainult Luna küsimuses | vähemalt 4 juhul 8-st |

Näited (kasutaja esimene sõnum → Luna küsimus → vastus → plaani päringud):

- „Kohtutäitur võtab mu palgast nii palju, et elamiseks ei jää raha.“ → „Kas täidetakse lapse elatisnõuet ja kas sul on ülalpeetavaid?“ → „jah“ → päringud elatisnõude sundtäitmisest ja ülalpeetavatest. Kasutaja sõnumites neid sõnu ei olnud.
- Sama algus teisel korral → „Kas oled juba kohtutäiturile avalduse arestivaba summa tagamiseks esitanud, ja kas sul on ülalpeetavaid?“ → „jah“ → päringud arestivabast miinimumist ülalpeetavatega ja avaldusest kohtutäiturile.
- „Mu laps ei taha enam koolis käia.“ → „Mis omavalitsuses sa elad? Siis saan aidata leida kohaliku lastekaitsetöötaja kontakti.“ → „Tartu linnas“ → kolmas päring Tartu linna lastekaitsetöötaja kohta.

Kahele kahe osaga küsimusele vastatud „jah“ puhul küsis Luna järgmises vastuses, kumba osa „jah“ tähendas, ja vastas mõlema võimaluse kohta. Ükski päring ei olnud küsimuse enda sõnastuse kohta.

**Mida see mõõtmine ei näita:**

- Võrdlust varasemaga ei ole: eelmist plaani ei saa enam käivitada. Näha on, et küsimus antakse kaasa ja et päringud kasutavad selle sõnu; kui palju vastused sellest paranesid, ei ole mõõdetud.
- Valikuvastust („toetuse kohta“, „esimene variant“) ei tulnud ette: ükski Luna küsimus ei pakkunud kahte teemat.
- Sõnumit, mis on lühike, kuid Luna küsimusele ei vasta, ei proovitud.
- Ühel juhul kahest märkis plaan vastuse „Tartu linnas“ küsimusele tegeliku elukoha kohta seoseks „muu“, mitte „elab“; otsing tehti sellegipoolest Tartu kohta. Kas see on uus või varasem käitumine, ei ole teada.
