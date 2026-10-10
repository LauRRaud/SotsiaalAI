# ADR-134: kontaktide hetktõmmis on mõõdetud; parandus on korduv eksport, mitte uus elav rada

Kuupäev: 10.10.2026. Teostus Claude Opus 5.5 (loenduse ehitasid ja vaatasid üle agendid kahes ringis, kaks viimast kaitset ja serveri mõõtmine minult). Omanik 10.10.2026: „tee need ära ka jah“ (sh „Kontaktid on vestluses hetktõmmis: registris muudetud rida kaob kuni järgmise käsitsi täienduseni“). Seis: **loendus on serveris ja käivitatud; eksporti ega vestluse koodi ei muudetud.**

## Probleem

Vestluse omavalitsuste kontaktid tulevad rakenduse kinnitatud kontaktiregistrist käsitsi tehtud ekspordiga ([ADR-085](adr-085-contacts-from-the-register.md), viimati 05.10.2026). Vastamise ajal kontrollitakse iga kontakti selle registririda vastu, ja kontakti näidatakse ainult seni, kuni rida on sama, mis eksporditi. Kui omavalitsus parandab registris telefoninumbri või ametikoha, kaob see kontakt vestlusest kuni järgmise ekspordini. Vea suurust ei teadnud keegi.

## Mõõtmine

`scripts/rag-v2-contact-drift.mjs` (reeglid `lib/rag-v2/adapters/contact-drift.js`, #613): ainult lugev loendus serveris. Trükib arvud, mitte ühtegi nime, telefoni ega e-posti; küsib iga kontakti kohta ka vestluse enda väravalt ja keeldub, kui tema loendus ja värav lähevad lahku.

Käivitus töötaval väljalaskel 10.10.2026 (viis päeva pärast eksporti, 21 sekundit):

| | Kontakte |
|---|---:|
| Kontaktidokumente indeksis | 1498 |
| Registrireaga seotud ja täna näidatavad | 1055 |
| Seotud, kuid rea muutuse tõttu välja jäänud | **12** |
| – muutus ametikoht või üksus | 6 |
| – muutus telefon | 1 |
| – ootab iganädalast kinnitust | 5 |
| Sidumata dokumendid (ei näidata kunagi) | 431 |

Välja jäänud kontakte on 11 omavalitsuses, igaühes üks või kaks. Ühes omavalitsuses ei näidata täna ühtegi kontakti.

## Otsus

**Viga on väike: 12 kontakti 1067-st (1,1%) viie päevaga.** Uut elavat rada (näidata registri praegust väärtust eksporditu asemel) ei ehitata: see tooks tagasi ühe kontakti kaheteistkümnest (telefon), teised vajavad niikuinii uut eksporti, ja kavandi kontrollija leidis sellest rajast viisteist kohta, kus see võinuks näidata kinnitamata või vale inimese andmeid.

Õige suurusega parandus on **eksport korrata regulaarselt**, sama rada mis 05.10. Iga muutunud kontakt on kaks vektorisisendit (umbes 0,00004 USD), nii et kuu muutused maksavad alla sendi.

## Omaniku otsustada

- Kas igakuine ajastatud töö (1. ja 3. kuupäeval, [ADR-098](adr-098-monthly-assistive-refresh.md)) võib kontaktide ekspordi ja väikese täienduse kaasa võtta, sama 0,10 USD kuulae sees?
- 431 sidumata kontaktidokumenti on indeksis, kuid neid ei näidata kunagi. Kas need võib järgmise täiendusega indeksist välja jätta? (Midagi ei kustutata iseenesest.)

## Kontrollimata

- Sama loendus pärast pühapäevast iganädalast kontrolli (11.10.2026): siis on näha, mitu ootel kontakti kinnitatakse ja kui suur on nädala muutus.
- Milline omavalitsus on ilma ühegi näidatava kontaktita (loendus trükib ainult arvu).
