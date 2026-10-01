# ADR-063 — M3: kontrollitud seosed (mõõtmissamm)

01.10.2026, pooleli. Teostus Claude Opus 5.5. Omanik 01.10: „m3. M5 tuleb kunagi hiljem“. Järgib [ADR-054](adr-054-semantic-graph-pilot.md) (teadmiskaardid), [ADR-057](adr-057-graph-experiment.md) (akti enda viited, profiil v3) ja [ADR-062](adr-062-provision-dates.md) (sätte kuupäevad).

## Küsimus

Teekaardi M3 küsib kahte asja eraldi:

1. Kas seoste kasutamine toob otsustava tingimuse või erandi tõendite hulka, kui seosed on õiged?
2. Kas seoste automaatne eraldamine on piisavalt täpne?

See samm on mõõtmine. Vestlus, indeks ja profiil ei muutu.

## Kavand

Kavand valiti 01.10 kolme sõltumatu ettepaneku seast (kolmest hindajast kaks eelistasid kontrollitud seoseid). Täiskavand sammude, lävendite ja hindadega: [m3-next-step-plan-2026-10-01.json](../audits/evidence/m3-next-step-plan-2026-10-01.json).

## Tehtud (sammud 1–3, tasuta)

### 1. Lähteseis

- Serveris on aktiivne ainult korpus v47 (`search_generation_34fe1590…`, lugeja `source-structure-v30`). Generatsioonid v42–v46 kustutati 01.10 omaniku loal.
- 30.09 katse väljundid küsimuste kaupa on tõendina repos: [graph-hard-1](../audits/evidence/graph-hard-1-2026-09-30.json) ja [graph-hard-2](../audits/evidence/graph-hard-2-2026-09-30.json) (generatsioon `4b050698`, kuupäev 15.10.2026).
  - Kataloog 1: alus 3/9, rohkem teksti 4/9, kaardid 5/9, akti viited 7/9, naabrid 3/9.
  - Kataloog 2: kõik harud 5/6; `coach-reports-child` ei leidnud ükski.
- Küsimuste vektorid (`vectors.json`) on serveris alles ja korduvkasutatavad.

### 2. Viidete kuldkomplekt aktist, ilma mudelita

`scripts/rag-v2-relation-gold.mjs` loeb seitse 15.10.2026 kehtivat akti registrist ajutisse hoidlasse ja kirjutab `tests/evaluation/graph/relation-gold-1.json`.

- **Säte** on paragrahvi nummerdatud lõige; lõigeteta paragrahv on üks säte. Iga sätte juures on lõik (`passage`), kus see indeksis algab.
- **Viited:**
  - `other_section`: teisele paragrahvile, olemasoleva lugeja järgi (`readReferences`); lõike number tuleb viite sõnadest („§ 45⁹ lõikes 2“).
  - `own_section`: sama paragrahvi lõikele („käesoleva paragrahvi lõikes 2“). Seda praegune lugeja ei loe.
  - `other_act`: nimetatud teisele aktile. Akt lahendatakse ainult siis, kui see on nende seitsme seas.
- Iga viite juures: kas lause sisaldab erandi sõnastust („välja arvatud“, „erandina“, „ei kohaldata“ jt), kas siht on teises lõigus ja kas siht on paragrahvi esimeses lõigus. Otsing lisab praegu ainult viidatud paragrahvi esimese lõigu.
- **Keelavad sätted** (`denials`): „ei määrata“, „ei maksta“, „ei ole õigust“ jt, millele ükski viide ei osuta ja millest ükski ei lähtu.
- **Lugeja aruanne:** iga §-märk on kas lahendatud viide, teise akti loend või nimetatud põhjusega lahendamata.

| Akt | Sätteid | Viiteid teisele paragrahvile | neist väljaspool esimest lõiku | Oma paragrahvi viiteid teise lõiku | Teise akti viiteid (lahendatud) | Keelavaid sätteid ilma viiteta | Kaardiseosega kaetud lõiguüleseid viiteid |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sotsiaalhoolekande seadus (`130062026065`) | 855 | 278 | 24 | 44 | 89 (32) | 17 | 13 / 322 |
| Haldusmenetluse seadus (`106072023031`) | 324 | 24 | 0 | 0 | 0 | 9 | 0 / 24 |
| Sotsiaalseadustiku üldosa seadus (`130062026031`) | 120 | 9 | 0 | 0 | 4 (0) | 2 | – |
| Lastekaitseseadus (`111072026042`) | 155 | 53 | 4 | 16 | 15 (1) | 0 | – |
| Perekonnaseadus (`107052025017`) | 594 | 93 | 0 | 0 | 9 (0) | 39 | – |
| Abivahendite määrus (`126092026005`) | 33 | 3 | 1 | 0 | 4 (2) | 0 | 1 / 3 |
| Harku abi andmise kord (`404072025017`) | 288 | 10 | 1 | 2 | 18 (5) | 4 | 0 / 12 |

- **Mudeli kaardid katavad viidetest väikese osa:** SHS-is 13 lõiguülest viidet 322-st (4%). Viide on tekstis olemas ja loetav ilma mudelita.
- **30 viidet lähevad lõikele, mis ei ole paragrahvi esimeses lõigus.** Need jäävad praeguse otsinguga leidmata, kuigi viide on lahendatud. Näide: SHS § 131 viitab § 133 lõigetele 5 ja 6.
- **62 oma paragrahvi viidet lähevad teise lõiku** ja 139 viidet nimetavad teist akti. Kumbagi praegune otsing ei kasuta.
- Test `tests/rag-v2-relation-gold.test.mjs` hoiab SHS-i arve ja kontrollib, et repos olev fail on see, mille skript annab.

### 3. Käsitsi kontroll

**60 viidet** kindla valimi järgi ([relation-gold-1-checked.json](../../tests/evaluation/graph/relation-gold-1-checked.json)). Lävend: 0 vale sihiga.

- Tulemus: **60 õiget, 0 valet.**
- Leiud:
  - Lõigete vahemikust („lõigetes 2–4“) võttis skript ainult otsad. Parandatud: tavaline vahemik nimetab iga lõike; ülaindeksiga otsaga vahemik („2–4²“) jääb otsteks.
  - Muutmissätted (SHS §§ 161–189) tsiteerivad teiste sätete teksti, seega nende viited kordavad nende sätete oma (22 viidet).
  - Rakendussäte võib nimetada lõikeid enne hilisemat ümbersõnastamist kehtinud numbritega (SHS § 160 lg 40 ja § 13¹).

**75 lõiguülest kaardiseost** nelja kehtiva akti kaardifailist ([card-relations-1-checked.json](../../tests/evaluation/graph/card-relations-1-checked.json)). Lävend: kõige rohkem 3 valet ja mitte ühtegi ümberpööratud erandit.

- Tulemus: **55 õiget, 20 valet** (12 vale siht, 5 vale liik, 3 vale suund). Ümberpööratud erandeid 0.
- Liigi kaupa: `REQUIRES` 9 valet 31-st, `EXCEPTION_TO` 6/14, `QUALIFIES` 3/21, `DESCRIBES` 2/2, `DEFINES` 0/7.
- Näited: „teenust ei tohi osutada isik, kes…“ on märgitud erandiks haldusakti koostamise sättele; SHS § 56 lg 1 tingimus on seotud abivahendi lepinguga (§ 54), kuigi säte nimetab § 65 lepingut.
- **Lävend ei ole täidetud.** Mudeli tehtud tüübitud seost ei näidata mudelile tüübitud seosena.
- See on ühe lugeja hinnang. Lõdva seose liik on lugemise küsimus, vale siht ei ole. Codex loeb valimi üle.

## Vaheotsus

- **Viide tekstist on usaldusväärne, mudeli seos ei ole.** 60 viitest 60 õiged; 75 kaardiseosest 20 valed.
- Järgmine samm mõõdab, kas tekstist loetud viited (teise lõiku, oma paragrahvi lõikele, sissetulevad viited, nimetatud teine akt) toovad otsustava sätte tõenditesse seal, kus praegune otsing selle kaotab.

## Edasi (sammud 4–10)

- **4.** Kolmas raske kataloog `hard-conditions-3.json` ja selle vestluse kaksik: 15 küsimust, ka teise akti ja valla määruse juhud. Lukku enne seoste faili.
- **5–6.** Kuni 40 kontrollitavat seost (`checked-relations-1.json`) koos kontrollskriptiga; teine lugemine ilma inimeseta; omanikule üks leht käsitsi kirjutatud seostest.
- **7–9.** Katseskripti harud A, C, D, L (päris profiil v3), F (ainult kontrollitud seosed) ja G; kuiv läbimine kohalikult; eraldamise täpsus kuldkomplekti vastu.
- **10.** Otsus: täiendada viidete lugejat, minna kontrollitud kaartide teed või jätta praegune lahendus.
- **Tasuline selles sammus alla 0,10 USD:** üks otsingukatse (alla 0,001 USD) ja üks vestluse jooks kuni 15 küsimusega (kuni 0,09 USD). Järgmise sammu jooksud (kokku kuni umbes 0,40 USD) ootavad omaniku jah-sõna.

## Piirid

- Kuldkomplekt loeb ainult viiteid, mille akt ise sõnades teeb. Tingimus, millele ükski viide ei osuta (71 keelavat sätet), jääb sellest välja; need on kontrollitud seoste ja kolmanda kataloogi töö.
- Teise akti viide lahendatakse ainult seitsme akti piires (40 viidet 139-st).
- SHS-i teadmiskaardid on redaktsioonidel, mis kehtivad 30.11.2026-ni. Järgmistel redaktsioonidel kaarte pole; see on omaniku otsus.
