# ADR-119: Luna enda täpsustav küsimus jõuab otsinguplaani ja valikuni

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „Do this task here: Luna täpsustav küsimus jõuab otsinguni“. Seis: **kood ja testid tehtud; mõju päris plaanidele on mõõtmata (tasuline, ootab luba).**

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

## Kontrollimata

- **Mida päris mudel selle väljaga teeb.** Päringu kuju on testitud, plaani käitumine mitte: see vajab tasulist jooksu (mõni vestlus, kus Luna küsib ja inimene vastab lühidalt, iga kaks korda). Üks mudeli jooks ei ole tõend.
- Kas plaan hakkab mõnikord otsima küsimuse enda teemat ka siis, kui lühike sõnum sellele ei vasta.
