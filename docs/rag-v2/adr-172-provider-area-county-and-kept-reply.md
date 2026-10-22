# ADR-172 — Teenuseosutaja suunanud omavalitsus, maakond ja meelde jäänud vastus

22.10.2026. Teostus Claude Opus 5.5. Omaniku palved:
- „siis saaks AI küsida täpsustuse?“;
- „tee parandused“.

## Leid (22.10 hommik, R3)

- **Suunanud omavalitsus.** „Oleme Ida-Virumaal … MTÜ. Narva linn suunas meile …“: plaan andis Narva linnale seose
  `other`. B20–B25 jäid omavalitsuseta, kuigi klient on Narva linna oma.
- **Maakond.** „Oleme Viljandimaal …“: maakond ei ole omavalitsus. Ükski teenuseosutaja pööre ei küsinud, mis
  omavalitsusega on tegu, ka mitte C25 „Kuidas … linnale aru anname?“.
- **Vastus ununes.** Kui kasutaja vastab küsimusele „mis omavalitsus?“ ainult nimega („Viljandi linn“), kehtis see sellel
  pöördel (ADR-103). Edasi kandus see ainult siis, kui järgmine küsimus viitas tagasi („see“, „seal“).

## Otsus

- **Plaan (search-assist-22).** Seos `works` hõlmab ka omavalitsust, mis suunas kliendi või tellib teenust („Narva linn
  suunas meile kliendi“). Rollijuhis ütleb teenuseosutaja kohta sama mis spetsialisti kohta ja lisab, et maakond ei ole
  omavalitsus. Server teeb sellest tööpiirkonna nagu ADR-167-s. Maakonna nime server omavalitsuseks ei loe.
- **Vastus (m4-grounded-dialogue-50), üks lause kirjete reeglites:**
  - maakond ei ole omavalitsus;
  - kui päring sõltub omavalitsuse enda korrast, teenustest, lepingust või aruandlusest ja vestlus nimetab ainult
    maakonda, küsib vastus üks kord, mis omavalitsusega on tegu;
  - kui seda on juba küsitud ja vastust pole tulnud, vastab ta üldiselt.
- **Meelde jäänud vastus (`continuedRegionScope`).**
  - Kasutaja vastatud omavalitsus (`asked_in: "reply"`) jääb selle inimese allikaulatuseks pöördest pöördesse
    (`reply_kept`), ka järgmises iseseisvas küsimuses.
  - See lõpeb, kui sõnum nimetab koha, plaani päringud nimetavad omavalitsuse või küsitakse teise inimese kohta.
  - Kuidas omavalitsus pöördesse tuli, kandub järgmisse pöördesse (`askedVia`): pöörde salvestatud ulatusest või
    vestluse kirjest.

## Kontroll

Kohalik kontroll vana (ADR-170) ja uue koodiga:

| juhtum | enne | pärast |
|---|---|---|
| vastus „Viljandi linn“, järgmine iseseisev küsimus | `region_required` | `continued_region viljandi_linn (reply_kept)` |
| üks pööre hiljem | `region_required` | sama, `reply_kept` |
| teise inimese küsimus | `region_required` | sama |
| plaani päring nimetab Tartu linna | `search_plan_region tartu_linn` | sama |
| küsitud omavalitsus, sõnum ei viita tagasi | `region_required` | sama |

Plaani ja vastuse muudatust kontrollitakse serveris lühikese vigade testiga:
- B19–B25: Narva linn tööpiirkonnaks;
- C19–C25: kas küsitakse omavalitsust;
- vastus „Viljandi linn“ ja kaks järgmist pööret.
