# ADR-167 — Vestlus mäletab, kust kandist ollakse: oma mainimine, sama nimega omavalitsus ja tööpiirkond (search-assist-21)

22.10.2026. Teostus Claude Opus 5.5. Omaniku soov: „vestlus siiski tuleks korda teha, et mõistab kust kandist ollakse ja
oleks ka meeles“, ka spetsialisti ja teenuseosutaja tööpiirkond.

## Leid

21.10 mõõdeti 75 küsimust (R1, admini jälg). Pöördeid, kus omavalitsuse kirjed said omavalitsuse:

| roll | pöördeid omavalitsusega |
|---|---:|
| pöörduja | 29/30 |
| spetsialist | 15/24 |
| teenuseosutaja | 1/21 |

Põhjuseid oli kolm.

1. **Oma mainimine kustutas teada kodu.**
   - Juhtum C10: „Kellega ma Viljandis esimesena ühendust võtan?“
   - Esimeses isikus lause, mis ei räägi elamisest ega eita midagi, tegi kasutaja piirkonna lahendamatuks (`unresolved`).
   - Viljandi linn kadus pöördelt ja ka salvestatud olekust.
   - Sama juhtus teadaoleva isikuga: „Kas ema saab Tartus koduteenust?“
2. **Sama nimega teine omavalitsus.**
   - Lause, mis kedagi ei nimeta, on muu mainimine (ADR-074), näiteks „Kellega Viljandis esimesena ühendust võtta?“.
   - Küsitud omavalitsuse leidmiseks võeti mainimise kandidaatidest (Viljandi linn, Viljandi vald) välja isiku enda
     omavalitsus. Alles jäi Viljandi vald.
   - Kui plaani päring nimetas „Viljandi“, otsiti Viljandi vallast.
3. **Tööpiirkond ei jõudnud otsingusse.**
   - „Olen Tartu linna sotsiaaltöötaja“ loeti kasutaja muuks mainimiseks (ADR-138).
   - Järgmised pöörded on kliendi kohta, kelle kodu keegi ei ütle. Omavalitsus tuli ainult siis, kui plaan juhtus selle
     päringusse kirjutama.
   - Plaani rollijuhis andis spetsialisti omavalitsusele seose „other“. Server ei saanud tööpiirkonda teistest
     mainimistest eristada.

## Otsus

### A. Oma mainimine ei muuda kodu (`checkedTurnPlaces`)

- Kehtib kasutaja enda või ühe teadaoleva isiku lausele, mis:
  - ei ütle, et ta seal elab;
  - ei eita;
  - ei räägi kuskil elamisest ega kolimisest.
- Selline lause on selle isiku muu mainimine:
  - kodu ei muutu;
  - see võib olla küsitud omavalitsus ADR-074 reeglite järgi.
- Elamisest või kolimisest rääkiv lause jääb lahendamatuks nagu enne, sest see võib anda uue kodu. Näiteks:
  - „Kolisin Tartusse“;
  - „pean Viljandis iseseisvalt elama hakkama“.

### B. Isiku enda omavalitsus ei ole küsimus teisest (`questionRegionScope`)

- Kui mainimise üks kandidaat on isiku enda omavalitsus, ongi see tema omavalitsus. Näiteks „Viljandis“ inimeselt, kes elab
  Viljandi linnas.
- Selline mainimine ei otsusta küsitud omavalitsust.
- Selgelt nimetatud teine omavalitsus („Kas Viljandi vallas …?“) on küsitud nagu enne.

### C. Spetsialisti ja teenuseosutaja tööpiirkond (`sourceRegionScope`, `workScope`)

- **Plaan.** Plaani kohal on uus seos `works` (search-assist-21): kus isik töötab või kus on tema enda organisatsioon või
  teenus. Rollijuhis annab spetsialisti omavalitsusele selle seose seose „other“ asemel.
- **Märgitakse tööpiirkonnaks** (`work`):
  - plaani `works`-koht;
  - ADR-138 lugemine, ehk esimeses isikus töö- või ametilause.
  
  Kodu see ei muuda ja salvestatud olek seda ei loe.
- **Kandumine.** Pöörde allikaulatus kannab tööpiirkonda (`work_regions`) järgmisse pöördesse, nagu küsitud omavalitsust
  (ADR-074).
  - Uus sõnum, mis nimetab tööpiirkonna, asendab vana.
  - Kahe omavalitsuse nimi („Ma töötan Viljandis.“) vana ei asenda.
- **Kus tööpiirkond kehtib.** Ainult spetsialisti ja teenuseosutaja vestluses; roll tuleb sessioonist:

  | olukord | allikaulatus |
  |---|---|
  | vestluses pole selle isiku omavalitsusest midagi öeldud (`region_required` põhjuseta) | `work_region`: tööpiirkond, `interpretation: professional_place_of_work_source_scope_not_residence` |
  | plaani päringud nimetavad kahe omavalitsuse nime ja tööpiirkond on üks neist | `work_region_choice` |
  | kodu on teada, küsitakse teist omavalitsust, või kodu on öeldud, aga jäi lahendamata või eitatud | nagu enne; tööpiirkond on kaasas |

- **Pöördujale** tööpiirkonda ei kanta ja tema pöörded on nagu enne.
- **Vastuse juhis ei muutu.** Spetsialisti rollitekst ütleb juba: „Use the municipality the specialist says they work in as
  the default source scope …; do not treat it as the described person's confirmed residence.“
- **Admini jälg.** Omavalitsuse kirjete all on rida „Piirkonna otsus“:
  - olek;
  - omavalitsus;
  - isik;
  - kandidaadid;
  - tööpiirkond.
  
  See arvutatakse pöörde salvestatud paketist, nii et see on näha ka vanadel pööretel.

### Mis ei muutu

- Vanade pöörete olek: taastamisel loetakse salvestatud kontrollitud kohti, mitte uut lugemist.
- search-assist-20 kohad on loetavad.
- Vastuse ja dialoogi juhised ning otsingu järjestus jäävad samaks.

### Piirid

- **„Töötan Narva linnas.“ ilma asesõnata.** Server ei loe seda kasutaja lauseks (ADR-138 piir). Selle katab plaani `works`.
- **Maakond ei ole omavalitsus.** Näiteks „Oleme Ida-Virumaal …“ ja „Oleme Viljandimaal …“. Sellisest tööpiirkonnast
  omavalitsust ei tule.
- **„Oleme Tartus …“.** Kahe omavalitsuse nimi annab tööpiirkonna ainult siis, kui plaan nimetab koha täpselt
  („Tartu linn“).

## Kontroll

- **Kohalik kontroll** (16 juhtumit):
  - sama pööre läbi vana (HEAD) ja uue koodi;
  - EstNLTK asemel väike lemmade tabel, sest EstNLTK-d kohalikus masinas pole.

| juhtum | enne | pärast |
|---|---|---|
| C10 Viljandi järelküsimus „Kellega ma Viljandis …“ | `region_required` (kodu kadus) | `person_region viljandi_linn` |
| sama ilma „ma“-ta | `question_region viljandi_vald` | `person_region viljandi_linn` |
| „Kas Viljandi vallas …?“ | `question_region viljandi_vald` | sama |
| ema Elva vallas, küsimus Tartust | `region_required` (ema kodu kadus) | `question_regions` Tartu linn / vald, ema kodu jääb |
| „Kolisin nüüd Tartusse …“ | `region_required` | sama |
| spetsialist „Olen Tartu linna sotsiaaltöötaja …“ | `region_required` | `work_region tartu_linn` |
| pöörduja sama lausega | `region_required` | sama |
| järgmine pööre / teenuseosutaja | `region_required` | `work_region tartu_linn` |
| kliendi kodu öeldakse hiljem (Elva vald) | `person_mentioned_region elva_vald` | sama, tööpiirkond kaasas |
| „Ema elab Tartus.“ | `region_required` (lahendamata) | sama |
| päringud „Tartu …“, kodu pole | `search_plan_ambiguous_region` | `work_region_choice tartu_linn` |
| „Ma töötan nüüd hoopis Narva linnas.“ | `region_required` | `work_region narva_linn` |

- **Testid ja kontrollid:**
  - `npm test`: 70 läbis, 0 kukkus (3 vahele jäetut ei puuduta seda muudatust);
  - lint ja i18n läbisid;
  - ADR-154, 157, 160 ja 166 kohalikud kontrollid läbisid.
- **Serveris:** 75 küsimust eelregistreeringu järgi
  ([eelregistreering](../audits/vestlustest-2026-10-22-piirkond-eelregistreering.json)).

## Tulemus serveris (22.10 hommik, R3)

Jooks käis 10:44–11:20 kohaliku aja järgi, väljalase 53f5c92b. Andmed:
[toorandmed](../audits/evidence/sol-proof-20261014-01/server-rag-chat-three-cases-adr167-raw.json),
[võrdlus](../audits/evidence/sol-proof-20261014-01/server-rag-chat-three-cases-adr167-compare.json).

| | R1 (21.10 õhtu) | R2 (21.10 õhtu) | R3 |
|---|---:|---:|---:|
| spetsialisti pöörded omavalitsusega | 15/24 | 17/24 | **24/24** |
| teenuseosutaja | 1/21 | 0/21 | **8/21** |
| pöörduja | 29/30 | 26/30 | 19/30 |
| vastuseid | 75/75 | 74/75 | 74/75 (C20 ajapiir) |
| „ei saa“ lausega pöördeid | 10 | 18 | 16 |
| aeg mediaan / p90 | 26,0 / 33,9 s | 26,6 / 33,2 s | 27,7 / 41,2 s |

- **H1, H2 ja H5 läbisid.**
  - Tööpiirkond jõudis igasse spetsialisti pöördesse: Tartu linn, Narva linn, Viljandi linn.
  - A-vestluse teenuseosutaja sai Tartu linna. Eile küsiti seal „Tartu linn või Tartu vald?“.
  - Ükski 14 vastusest ei pidanud tööpiirkonda kliendi koduks.
- **H3 kukkus.**
  - C01 plaan andis nimeks „Viljandi“ (R1 ja R2: „Viljandi linn“). Vastus küsis õigesti „linn või vald?“, aga testivestlus
    ei vasta. Seepärast jäi C-pöörduja vestlus omavalitsuseta.
  - Viis C01 kordust andsid kolm korda „Viljandi linn“ ja kaks korda „Viljandi“.
  - Osade A ja B loogika seda ei põhjustanud. A10 puhul jäi ema Tartu linn alles ja kasutaja Tallinn ei kadunud.
- **H4 kukkus p90 tõttu.**
  - Plaanikutse oli sama tokenimahuga, kuid 1 s aeglasem. Valikumudel oli kiirem.
  - Ka pöörduja pöörded, mida muudatus ei puuduta, olid aeglasemad: jooks oli hommikul, baasjooksud öösel.
  - Päris kulu: tööpiirkonnaga pöörde vastus sai omavalitsuse kataloogi, umbes 10 000 sisendtokenit. Ühelegi ainult
    pealkirjana loetletud kirjele ei viidatud.
- **Otsus.** Reegli järgi tuli tööpiirkond maha võtta. Omanik valis „Jätta, kärpida, mõõta“:
  - kataloogi kärbib ADR-169;
  - kõrval on ADR-168 ja ADR-170;
  - õhtul baasjooksudega samal kellaajal tehakse uus jooks samade piiridega (eelregistreeringu lisa R4).
