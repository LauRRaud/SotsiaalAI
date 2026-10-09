# Sammulava ja ühised ehitusklotsid

Siin on osad, millest pannakse kokku sammudena töötav leht. Iga osa on üks
komponent ja selle kõrval on tema enda kujundusfail (`Nimi.module.css`). Kui
tahad midagi muuta, ava komponendi kõrval olev fail: üldfailist otsida ei ole
vaja.

## Mis siin on

| Fail | Milleks |
| --- | --- |
| `StepFlight.jsx` | Sammudega töövoog: ülal sammuriba (kiirmenüü välimusega), all üks samm korraga. Järgmine samm tuleb sügavusest lähemale, nagu keele ja ligipääsetavuse vaates. Nupp „Kõik sammud” näitab tervikut korraga. |
| `StepPanel.jsx` | Ühe sammu kuju: pealkiri, lühike juhis, sisu, all märkus ja nupud. |
| `ChoiceRow.jsx` | Üks küsimus ühel real, vastusevariandid kohe näha (rippvaliku asemel). |
| `CheckCard.jsx` | Märkeruut kaardina: pealkiri ja selgitus eraldi ridadel. |
| `ActionCard.jsx` | Tegevus pealkirja ja selgitusega; `ActionCardGrid` paneb kaardid kahte veergu. |
| `cell.module.css` | Kolme eelmise ühine „lahter” (ääris, taust, valitud olek). |

## Kuidas liikumine töötab

- Rull ja libistus kerivad kõigepealt lehe sisu. Kui kerida ei ole enam kuhugi,
  viib sisse kerimine järgmise sammu juurde ja välja kerimine eelmise juurde.
- Esimeselt sammult välja kerides avaneb „Kõik sammud”; seal viib sisse kerimine
  või vajutus sammu sisse.
- Klaviatuuril: Page Down ja Page Up vahetavad sammu, nooled liiguvad
  vastusevariantide vahel.
- Kui inimene on valinud vähem liikumist (brauseris või platvormi seadetes), siis
  sammud ei lenda, vaid vahetuvad sujuva üleminekuga.

Lend ise on platvormi olemasolev mootor (`components/register/useStationFlight.js`),
sama mis registreerimisel ja keele ning ligipääsetavuse vaates. Sammuriba kasutab
alumise kiirmenüü klasse (`gc-shortcut-*` failis `app/styles/carousel.css`).

## Kuidas leht sammudeks teha

1. Jaga lehe sisu sammudeks (tavaliselt 3 kuni 6): mida inimene sisestab, mida ta
   vastu saab, mida ta edasi teha võib.
2. Kirjelda sammud: `{ key, label, short, state, stateLabel, summary }`. `state`
   on `empty`, `partial` või `done`; `summary` on üks lause, mida näidatakse
   vaates „Kõik sammud”.
3. Joonista iga samm `StepPanel`-i sisse ja kasuta küsimuste jaoks `ChoiceRow`-d,
   valikute jaoks `CheckCard`-i ja tegevuste jaoks `ActionCard`-i.
4. Lehele omane kujundus pane lehe komponendi kõrvale faili `Leht.module.css`.

Näide: `components/wellbeing/QuickCheckWorkflow.jsx` (tööheaolu kiirkontroll).

## Reeglid

- Märgistusel on klassinimed. Kujundust ei kirjutata kujul „iga `section` selle
  lehe sees”: nii ei leia keegi hiljem üles, kust välimus tuleb.
- Värvid ja mõõdud tulevad platvormi muutujatest (`app/styles/tokens.css`), et
  hele ja tume teema töötaksid ilma lisatööta.
- Uut üldfaili kausta `app/styles` ei lisata. Vana ühine kiht
  (`feature-pages.css`) jääb nendele lehtedele, mida ei ole veel üle viidud.
