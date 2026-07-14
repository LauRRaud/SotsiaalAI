# Uue akna handoff — Opuse audit ja järgmised arendustööd

> **Koostatud:** 2026-07-14
>
> **Lähteharu:** `main`
>
> **Handoffi lähte-HEAD:** `42fe884a`
>
> **Praegune kvaliteedivärav:** Opuse sõltumatu read-only audit
>
> **Järgmine soovitatud uus arendus pärast auditit:** pöörduja **U12 + U3 usalduspakett**
>
> **Deploy:** ainult kasutaja eraldi selgel loal

## 1. Uue akna põhikäsk

Loe see fail enne töö alustamist täielikult läbi. Ära lähtu varasema Claude'i või Codexi sessiooni mälust ega commit'ist `ef660414` kui viimasest seisust.

Seejärel:

1. kontrolli `git status`, `git log` ja `origin/main`;
2. veendu, et commit'id `848de7a6`, `7f20d7ce`, `9a46192b` ja `42fe884a` on `main` harus olemas;
3. säilita kasutaja kõrvalised commit'imata ruumifailid;
4. tee esmalt allpool kirjeldatud Opuse audit või töötle selle auditi tulemusi;
5. ära alusta U12 + U3 ehitamist enne, kui auditist ei ole jäänud lahendamata P0/P1 blokeerijat;
6. jäädvusta iga suurema etapi seis progressidokki, et töö oleks jätkatav ka konteksti või limiidi lõppemisel.

## 2. Tegelik hetkeseis

Opuse varasem vastus, mille järgi A6.1 oli endiselt commit'imata ja A6.2 järgmine töö, on aegunud.

| Commit | Tegelik valminud töö |
|---|---|
| `848de7a6` | A6.1 — Teemaseemne püsiv privaatne tuum |
| `7f20d7ce` | A6.2 Teemaseeme → Kovisioon; päris Kovisiooni etapid 1–8; Lõpetatud juhtumid; Parimad praktikad |
| `e99bb716` | Opuse ühise järelkontrolli ülesanne Kovisiooni paketile |
| `9a46192b` | Tööheaolu kinnitatud üldistus → päris privaatne Kovisioon |
| `42fe884a` | Tööheaolu/Kovisiooni lõppüleandmine ja Opuse auditijuhis |

Järelikult ei ole enam järgmised ehitustööd:

- A6.2 TopicSeed → CovisionCase;
- O1 Kovisiooni lõuendi ja andmekihi sidumine;
- O3 teenuseosutaja Kovisiooni õigusemudel — aktiivne otsus on, et teenuseosutaja saab osaleda ainult kutsega, mitte luua juhtumit omanikuna;
- A11/Parimate praktikate põhileht.

Need on aktiivses `main` harus juba teostatud.

## 3. Kohustuslik lugemine

### 3.1 Opuse auditiks

1. `docs/platvormi arendus/04-a6-1-teemaseemne-pusiv-tuum-tooplaan-ja-progress.md`
2. `docs/platvormi arendus/05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md`
3. `docs/platvormi arendus/06-sol-tooheaolu-kovisioon-uleandmine-progress.md`
4. `Kovisioon/HANDOFF-kovisiooni-louend.md`
5. kõik aktiivsed `Kovisioon/kovisioon-etapp-1-...md` kuni `kovisioon-etapp-8-...md` spetsifikatsioonid;
6. `Kovisioon/Uus leht-lopetatud-juhtumid-pohileht.md`
7. `Kovisioon/Uus leht-parimad-praktikad-pohileht-ja-loogika.md`

### 3.2 Järgmiste tööde valikuks

1. `docs/platvormi arendus/fable-5-avastamata-vajadused-ja-uued-voimalused.md`
2. `docs/platvormi arendus/fable-5-usaldusmudel.md`
3. `docs/platvormi arendus/fable-5-platvormiloogika-max-taiendus.md`
4. `docs/platvormi arendus/fable-5-lisavastused-organisatsioon-ja-piloot.md`

## 4. Praegune ülesanne Opusele

### 4.1 Mudel ja effort

- soovitus: **Opus 4.8, Max**;
- kui Max pole saadaval: vähemalt **Extra (`xhigh`)**;
- esimene ring on read-only audit, mitte parandussessioon.

### 4.2 Audit A — Kovisiooni tervikpakett

Kontrollitav commit: `7f20d7ce14e00262a5e4851a05eb59425968e770`.

Järgi faili `05-sol-kovisioon-lopetatud-juhtumid-parimad-praktikad-progress.md` §14 ülesannet. Vaata ühe tervikuna:

```text
Teemaseeme
  → Kovisioon etapid 1–8
  → lõpetamine ja järelvaade
  → privaatne praktikakandidaat
  → kontrollitud Parimate praktikate avaldamine
```

Kohustuslikud kontrolliteemad:

- rollid, omanikuõigus, kutsed ja no-leak piirid;
- privaatne vs jagatud sisu;
- etappide väravad ja versioonid;
- advisory-lock, CAS, idempotentsus ja paralleelsed järjestused;
- lõpetamise atomaarne puhastus;
- praktikate retsenseerimine, huvide konflikt ja muutmatu avalik snapshot;
- töölaua- ja mobiilivaate URL-ajalugu, fookus, kerimine ja ainus `Välju` toiming.

Väljundfail:

`docs/platvormi arendus/06-opus-kovisioon-lopetatud-juhtumid-parimad-praktikad-jarelkontroll.md`

### 4.3 Audit B — Tööheaolu → Kovisioon

Kontrollitav commit: `9a46192b`.

Järgi faili `06-sol-tooheaolu-kovisioon-uleandmine-progress.md` §9 ülesannet. Kontrolli vähemalt:

- Kovisiooni liigub ainult inimese kinnitatud üldistus, mitte Tööheaolu toorkirje;
- `sourceRecordId`, skoorid ja privaatne lähteinfo ei jõua osalejani;
- owner-only/no-leak, rolli- ja tellimusväravad;
- sama advisory-lock kinnitamisel, muutmisel ja üleandmisel;
- stale fingerprint, topeltklõps, rollback ja idempotentne korduspäring;
- omaniku privaatne etapi 2 eeltäide ei muutu automaatselt jagatud tööobjektiks;
- kutsutud osaleja ei näe omaniku privaatset eeltäidet;
- mustandi korduv salvestamine uuendab sama rida ega loo duplikaate.

Väljundfail:

`docs/platvormi arendus/07-opus-tooheaolu-kovisioon-jarelkontroll.md`

### 4.4 Opuse väljundireegel

Mõlemas auditis:

- märgi kontrollitud commit ja tööpuu algseis;
- loetle kohustuslikult loetud failid;
- jäädvusta päriselt käivitatud kontrollid ja tulemused;
- jaga leiud P0/P1/P2;
- erista päris vead, teadlikult edasi lükatud operatsioonitööd ja valikulised UX-parandused;
- lõppotsus on `OPUS HEAKS KIIDETUD` või `OPUS PARANDUSED VAJALIKUD`;
- ära esimeses ringis muuda koodi, commit'i, push'i ega deploy.

## 5. Mida teha auditi järel

Opuse auditi-järgne teostuspakett on eraldi lukustatud failis:

`docs/platvormi arendus/01-opus-parast-auditit-operatsioon-u4-u8-tooplaan-ja-progress.md`

Kui mõlemad auditid on puhtad või sisaldavad ainult teadlikult aktsepteeritud P2 leide, jätkab Opus selle faili järgi automaatselt järjekorras: Parimate praktikate operatsioonipakett → U4 → U8-lite. P0/P1 leid katkestab uue arenduse kuni Soli paranduse ja kordusauditini.

### 5.1 Kui Opus leiab P0 või P1

Sol parandab ainult tõendatud vead, lisab regressioonitestid ja teeb uue täieliku kontrolli. Paranduste järel läheb sama diff uuesti Opusele või teisele sõltumatule järelkontrollile.

Sol kasutab selle töö puhul **väga kõrget** effort-taset; varasemas sessioonis kasutatud tegelik tase oli väga kõrge, mitte Ultra.

### 5.2 Kui P0/P1 ei ole

Enne võimalikku Kovisiooni deploy'd tee operatsiooniline valmidus:

1. automaatne RAG-ingest'i taastaja ebaõnnestunud Parimate praktikate ingestidele;
2. ülevaatustähtaegade ja ülesannete perioodiline scheduler;
3. assignment-repair ning RAG drain/verify `0/0` kontroll;
4. migratsioonide deploy-eelne read-only audit;
5. deploy ainult kasutaja selgel loal.

## 6. Järgmine soovitatud uus arendus — U12 + U3

### 6.1 Roll

Põhiroll on **pöörduja**. Sama koondvaade võib hiljem teenida kõiki rolle, kuid esimese lõigu õigused ja tekstid lähtuvad pöörduja küsimusest: „Kes minu infot praegu näeb ja mida ma saan veel kontrollida?”

### 6.2 Eesmärk

Ehita üks usalduspakett:

1. profiili või töölaua **„Minu jagamised”** vaade;
2. avamata saadetud eelpöördumise tagasivõtmine;
3. avatud eelpöördumise korral aus paranduse saatmine, mitte ajaloo kustutamine;
4. olemasolevate kutsete tagasivõtmine ja ruumist lahkumine samas vaates;
5. selge valdusriba: privaatne / jagatud kellele / millal / kas saab tagasi võtta.

### 6.3 U12-lite minimaalne skoop

Koonda ainult kasutaja enda olemasolevad jagamised:

- saadetud eelpöördumised: adressaat, staatus, saatmise aeg;
- aktiivsed ruumiliikmesused: ruumi nimetus ja „Lahku”;
- aktiivsed kutsed: adressaat/olek ja olemasolev „Võta tagasi”;
- avaldatud abisoovid ja -pakkumised koos aegumisega;
- vajadusel raamistikukinnitused eraldi informatiivse plokina.

See ei ole tehnilise auditilogi ega GDPR-ekspordi vaade.

### 6.4 U3-lite minimaalne skoop

- lisa eelpöördumisele `recalledAt`;
- avamise fakt peab tulema serveri usaldusväärsest sündmusest, näiteks vastuvõtmisest või adressaadi tööplaani esimesest salvestusest;
- enne avamist saab autor pöördumise tagasi võtta: see kaob adressaadi aktiivsest loendist, kuid auditijälg säilib;
- pärast avamist ei tohi ajalugu tagantjärele kustutada;
- pärast avamist saab saata parandatud versiooni, mis viitab eelmisele (`supersededById` või samaväärne selge seos);
- võõras/puuduv objekt ei leki;
- topeltklõps ja recall/open võistlus lahendatakse deterministlikult ühe lock/CAS lepingu all;
- UI ütleb ausalt, et tagasivõtt ei kustuta adressaadi juba nähtud mälu.

### 6.5 Enne U12 + U3 koodi

Loo uus jätkamiskindel progressidokk:

`docs/platvormi arendus/08-sol-u12-u3-minu-jagamised-ja-tagasivotmine-progress.md`

Kirjuta sinna enne muudatusi:

- aktiivse koodi kaardistus;
- lukustatud oleku- ja õiguseleping;
- skeemi/migratsiooni otsus;
- vähemalt kaks paralleelset järjestust: recall enne open ja open enne recall;
- kliendi ajaloo-, värskendus- ja topeltklõpsu reeglid;
- testid, kontrollid, riskid ja jätkamiskoht.

## 7. Hilisem järjekord

| Järk | Roll | Töö | Märkus |
|---|---|---|---|
| 1 | pöörduja | U12 + U3 usalduspakett | järgmine soovitatud uus vertikaal |
| 2 | teenuseosutaja | U4 kättesaadavuse signaal ja värskuskinnitus | võtab vastu / ooteaeg / ei võta; `availabilityCheckedAt` |
| 3 | kõik rollid | U8-lite usalduskiht | allika kontrollimise aeg, „Teata veast”, AI-mustandi eristus |
| 4 | kõik rollid | eestikeelne häälvestlus | alles pärast O10 ulatust ja päris STT/TTS kvaliteedimõõtu |
| 5 | spetsialist | JTA õhuke tuum | alles pärast STAR2 elutsükli ja organisatsiooni nähtavuse otsuseid |
| 6 | spetsialist | Meetodipeegel | JTA järel, mitte eraldiseisva demona |

U4 väikseim kasulik versioon:

- struktureeritud kolmeväärtuseline saadavus;
- ligikaudne ooteaeg;
- `availabilityCheckedAt`;
- kaardil ja eelpöördumise vormil seisund koos vanusega;
- üheklõpsu värskuskinnitus teenuseosutajale;
- aegunud kirjete ülevaade adminile;
- mitte ehitada broneerimist ega ootenimekirja-CRM-i.

## 8. Teadlikult mitte alustada

Ilma eraldi toote- või partnerlusotsuseta ära alusta:

- automaatset STAR2 API-integratsiooni;
- täismahus JTA-d või organisatsioonihierarhiat;
- supervisiooni turgu või „ESTA kontrollitud” märgist;
- teenuseosutaja ootenimekirja-CRM-i;
- reaalaja speech-to-speech süsteemi, äratussõna või emotsioonituvastust;
- töötajate individuaalseid Tööheaolu edetabeleid;
- deploy'd.

## 9. Tööpuu piirid

Handoffi koostamise ajal on kasutaja varasemad kõrvalised muudatused:

```text
public/room/frame-1.webp ... frame-10.webp, frame-12.webp  (stage'imata kustutused)
output/imagegen/room-walk-v8-natural-2026-07-13/**       (untracked)
output/imagegen/room-walk-v9-locked-2026-07-13/**        (untracked)
scripts/build-room-locked-frames.mjs                     (untracked)
```

Neid ei tohi auditisse, U12/U3 commit'i ega muusse tööpaketti lisada. Ära kasuta `git add .`.

## 10. Viimane kinnitatud kontrollibaas

Commit'i `9a46192b` lõppkontroll:

- sihttestid 48/48;
- kogu `npm test` 1070/1070;
- i18n ET/EN/RU pariteet OK;
- kogu repo lint 0 viga, 359 varasemat hoiatust;
- Prisma validate/generate OK;
- `db:migrate:check` 87 migratsiooni, drift puudub;
- tootmisbuild compiled successfully;
- autentimata mustandi PUT ja Kovisiooni handoff POST tagastasid kontrollitud 401 JSON-i.

Uus aken ei tohi eeldada, et need arvud jäävad pärast uusi commit'e samaks. Iga paranduse või arenduse järel tuleb tulemused värskelt korrata ja progressidokki kirjutada.

## 11. Lühike alustussõnum uude aknasse

```text
Loe täielikult docs/platvormi arendus/00-uue-akna-handoff-opuse-audit-ja-jargmised-tood.md ning kontrolli aktiivset main haru. Ära lähtu vanast ef660414 seisust. Jätka handoffi järjekorras: esmalt Opuse audit või selle P0/P1 parandused; kui audit on puhas, järgmine uus vertikaal on pöörduja U12 + U3 usalduspakett. Jäädvusta progress enne koodimuudatusi, ära puutu kõrvalisi ruumifaile ja ära deploy ilma minu eraldi loata.
```
