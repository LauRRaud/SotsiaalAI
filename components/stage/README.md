# Sammulava ja ühised ehitusklotsid

Siin on osad, millest pannakse kokku sammudena töötav leht. Iga osa on üks
komponent ja selle kõrval on tema enda kujundusfail (`Nimi.module.css`). Kui
tahad midagi muuta, ava komponendi kõrval olev fail: üldfailist otsida ei ole
vaja.

## Põhimõtted (omanik 09.10.2026)

- **Üks vaade, üks asi.** Samm on nii väike, et mahub klaaspaneeli ära. Kui ei
  mahu, jaga see kaheks sammuks; ära pane paneeli sisse kerivat kasti.
- **Kerimine vahetab sisu kohapeal.** Kui samm mahub ära, viib kerimine
  järgmise sammu juurde, mitte ei keri pikka lehte. Kui samm on erandina pikem
  (nt avatud terve tekst), kerib kogu paneeli sisu nagu kasutusjuhendi lehel.
- **Sammud on all kiirmenüüs,** lehe nime kõrval. Klaaspaneel on sisu jaoks,
  sammuriba sinna ei käi.
- **Lahtrid on ühelaiused ja reas.** Vastusevariandid on võrgus, mitte eri
  pikkusega nupud, mis murduvad suvaliselt.

## Mis siin on

| Fail | Milleks |
| --- | --- |
| `StepFlight.jsx` | Sammudega töövoog: üks samm korraga, järgmine tuleb sügavusest lähemale (nagu keele ja ligipääsetavuse vaates). Hoiab paneeli kõrguse sammude vahel ühesugusena. „Kõik sammud” näitab tervikut korraga. |
| `StepRail.jsx` | Sammud kiirmenüüs: numbrid, aktiivse sammu nimi, tehtud samm täidetud ringiga. |
| `DockSteps.jsx` | Ühendus lehe ja kiirmenüü vahel: dokk annab pesa, leht joonistab oma sammud sinna. |
| `StepPanel.jsx` | Ühe sammu kuju: pealkiri, lühike juhis, sisu; märkus ja nupud on alati paneeli all servas. |
| `ChoiceRow.jsx` | Üks küsimus, vastusevariandid kohe näha (rippvaliku asemel). Paigutus `stack` (küsimus üleval, lahtrid võrgus) või `scale` (silt vasakul, lühike skaala paremal; mitu rida annavad tabeli). |
| `ChoiceChips.jsx` | Mitu valikut korraga (märgi kõik, mis sobivad); sama võrk, lahtris märkekast. |
| `CheckCard.jsx` | Märkeruut kaardina: pealkiri ja selgitus eraldi ridadel. |
| `TextAreaField.jsx` | Tekstiväli sildi ja vihjega; `lines` teeb sellest loendi (üks rida on üks kirje). |
| `ActionCard.jsx` | Tegevus pealkirja ja selgitusega; `ActionCardGrid` paneb kaardid kahte veergu. |
| `cell.module.css` | Lahtrite ühine materjal (ääris, taust, valitud olek). |

## Kuidas liikumine töötab

- Rull ja libistus: kui samm mahub paneeli ära, viib sisse kerimine järgmise
  sammu juurde ja välja kerimine eelmise juurde. Kui paneeli sisu saab kerida,
  kerib kõigepealt see ja samm vahetub alles lõpus.
- Esimesel sammul on vihje „Keri”, kuni inimene on korra sammu vahetanud. Iga
  sammu all on ka nupp „Edasi” ja sammud on kiirmenüüs: kerimine ei ole kunagi
  ainus tee.
- Esimeselt sammult välja kerides avaneb „Kõik sammud”; seal viib sisse kerimine
  või vajutus sammu sisse.
- Klaviatuuril: Page Down ja Page Up vahetavad sammu, nooled liiguvad
  vastusevariantide vahel.
- Kui inimene on valinud vähem liikumist (brauseris või platvormi seadetes), siis
  sammud ei lenda, vaid vahetuvad sujuva üleminekuga.

Lend ise on platvormi olemasolev mootor (`components/register/useStationFlight.js`),
sama mis registreerimisel ja keele ning ligipääsetavuse vaates. Sammud kiirmenüüs
kasutavad doki klasse (`gc-shortcut-*` failis `app/styles/carousel.css`). Lehel,
kus dokki ei ole (lõuendid, laiad tööpinnad), seisab sammuriba omaette pillina
samas kohas ekraani all.

## Kuidas leht sammudeks teha

1. Jaga lehe sisu vaadeteks: üks kuni kolm küsimust, üks tabel, üks loend või üks
   tekst vaate kohta. Mõõda brauseris 1536 × 640 aknas, et iga vaade mahuks ära.
2. Kirjelda sammud: `{ key, label, short, state, summary }`. `state` on `empty`,
   `partial` või `done` (numbriringi täide); `short` on nimi kiirmenüüs ja nupul
   „Edasi”; `summary` on üks-kaks rida vaates „Kõik sammud”.
3. Joonista iga samm `StepPanel`-i sisse ja kasuta küsimuste jaoks `ChoiceRow`-d,
   valikute jaoks `ChoiceChips`-i või `CheckCard`-i ja tegevuste jaoks `ActionCard`-i.
4. Lehele omane kujundus pane lehe komponendi kõrvale faili `Leht.module.css`.

Näide: tööheaolu töövormid. Seal on kõigil vormidel üks ühine sammuvorm
(`components/wellbeing/WellbeingStepForm.jsx`) ja iga vorm on ainult kirjeldus
(`components/wellbeing/forms/*.js`): sammud, küsimused, signaalide tekstid ja valmis
tekstid. Uue küsimuse lisamiseks või järjekorra muutmiseks piisab kirjelduse
muutmisest. Paigutuse reeglid ja vaate lubatud „kaal” on failis
`components/wellbeing/forms/layout.js`; test
`tests/wellbeing-step-forms.test.mjs` ei lase sammu liiga suureks kasvada.

## Reeglid

- Märgistusel on klassinimed. Kujundust ei kirjutata kujul „iga `section` selle
  lehe sees”: nii ei leia keegi hiljem üles, kust välimus tuleb.
- Värvid ja mõõdud tulevad platvormi muutujatest (`app/styles/tokens.css`), et
  hele ja tume teema töötaksid ilma lisatööta.
- Uut üldfaili kausta `app/styles` ei lisata. Vana ühine kiht
  (`feature-pages.css`) jääb nendele lehtedele, mida ei ole veel üle viidud.
