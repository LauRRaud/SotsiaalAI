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
- **Samm on all kiirmenüüs,** lehe nime kõrval: „3/12 sammu nimi” ja nool
  edasi. Klaaspaneel on sisu jaoks. Kiirmenüü on tavaolekus lühike: sammude
  rida ega lehe lisanuppe seal ei seisa. Vajutus sammu nimele avab kõik sammud
  kiirmenüüs endas (numbrite rida) ja valik tõmbab selle tagasi lühikeseks.
  Numbrite ümber ei ole rõngast: tehtud samm on heledam, ootel samm tuhmim.
- **Paneel algab küsimusega.** Sammu pealkirja paneelil ei korrata: sammu nimi
  on kiirmenüüs. Paneelis ei ole ka „Edasi” nuppu ega kerimise vihjet. Edasi
  liigutakse kiirmenüü noolest või kerides, ja vaade, kus on ainult valikud,
  liigub pärast viimast vastust ise edasi.
- **Lahtrid on ühelaiused ja reas.** Vastusevariandid on võrgus, mitte eri
  pikkusega nupud, mis murduvad suvaliselt.
- **Midagi ei venitata paneeli laiuseks.** Lahter on nii lai kui küsimuse pikim
  vastus, väli nii lai kui sinna kirjutatav sisu (omavalitsuse nimi ei vaja
  terve paneeli laiust). Täislaius on ainult pikal tekstil.

## Mis siin on

| Fail | Milleks |
| --- | --- |
| `StepFlight.jsx` | Sammudega töövoog: üks samm korraga, järgmine tuleb sügavusest lähemale (nagu keele ja ligipääsetavuse vaates). Hoiab paneeli kõrguse sammude vahel ühesugusena. „Kõik sammud” näitab tervikut korraga. |
| `StepRail.jsx` | Samm kiirmenüüs: „3/12 sammu nimi” ja nool „Järgmine samm” (süttib, kui ees olev samm on tehtud). Vajutus sammu nimele avab kõik sammud kiirmenüüs numbrite reana; valik, vajutus aktiivsele sammule või Esc tõmbab kiirmenüü tagasi lühikeseks. |
| `DockSteps.jsx` | Ühendus lehe ja kiirmenüü vahel: dokk annab pesa, leht joonistab oma sammud sinna. |
| `StepPanel.jsx` | Ühe sammu kuju: küsimus või lühike juhis ja sisu. Pealkiri on ainult ekraanilugejale. Vaate enda tegevused (nt „Salvesta”) on paneeli all servas. |
| `scroll.js` | Kerimise reegel: kõigepealt kerib sisu, alles siis vahetub samm või küsimus. |
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
- Kerimine ei ole kunagi ainus tee: sammud ja nool „Järgmine samm” on
  kiirmenüüs ning ainult valikutega vaade liigub pärast vastamist ise edasi.
  Kui vastus toob ohutusteate, jääb vaade ette.
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
2. Kirjelda sammud: `{ key, label, short, state, summary, free }`. `state` on
   `empty`, `partial` või `done` (sammu numbri heledus); `short` on nimi
   kiirmenüüs; `summary` on üks-kaks rida vaates „Kõik sammud”; `free` märgib
   vaate, mis võib olla pikk (loend), et teised vaated ei võtaks selle kõrgust.
   Kui lehe olek peab sammu juhtima, anna `activeKey` ja kuula `onStepChange`.
3. Joonista iga samm `StepPanel`-i sisse ja kasuta küsimuste jaoks `ChoiceRow`-d,
   valikute jaoks `ChoiceChips`-i või `CheckCard`-i ja tegevuste jaoks `ActionCard`-i.
4. Lehele omane kujundus pane lehe komponendi kõrvale faili `Leht.module.css`.

Teine näide: pöörduja eelpöördumine (`components/workspace/preInquiry`): vaated
on eraldi failides (`CollectViews.jsx`, `DomainsView.jsx`, `FlowViews.jsx`), leht
seob need oma olekuga. Eluvaldkondade 21 küsimust on seal ühe vaate sees, üks
küsimus korraga.

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
