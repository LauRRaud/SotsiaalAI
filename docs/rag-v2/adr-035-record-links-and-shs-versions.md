# ADR-035 — KOV-kirjete allikalingid ja SHS-i kehtivad redaktsioonid (korpus v28–v29)

27.09.2026. Teostus Claude Opus 5.5. Järgib [Codexi kontrolli](../audits/rag-v2-codex-review-2026-09-27.md) ja KOV-andmete ülevaatust (27.09).

## Probleem

1. **Lingita kirjed.** 4876 KOV-kirjest 577 (410 kontakti, 68 vormi, 38 ressurssi, 31 teenust, 30 toetust) ei kanna omaenda linki (`officialUrl`, `url_canonical`, `url`). Vestluse allikavaade ei saanud neile algallika linki näidata.
   - Iga kirje nimetab allikavõtmed (`sourceKeys`, nt `kontakt_page`).
   - Omavalitsuse registreeritud allikaregister `KOV/<m>/<m>.sources.json` (`role: source_register`, sha256 registris) seob need https-lehtedega.
2. **SHS kehtivusauk.** PR #205 järel jääb õigusakt tõendiks ainult kuupäeval kehtivas redaktsioonis. Korpuses oli ainult 01.10–30.11.2026 tekst, seega 27.–30.09 polnud vestlusel SHS-i ja 01.12-st poleks jälle olnud.

Kontrollitud ja otsustatud mitte muuta:
- **Kontrollikuupäev summa juures.** 9 salvestatud vastust (vana juhis v10) esitasid kirje summa ilma kuupäevata. Praegune juhis v11 andis 5/5 kordusel kontrollikuupäeva ja märke, et praegust kehtivust ei kinnita.
  - Katsejuhis v12 (kuupäev plokis) polnud parem: ingliskeelne vastus kaotas taotlemise juhised.
  - v11 jääb. Kordus maksis 0,027 USD; failid `tmp/rag-v2-dev-2026-09-27/record-date-eval-v11.json` ja `record-date-eval-v12.json`.
- **Tühjad väljad.** Kataloogivaade jätab `[]`, `{}` ja `null` väärtused mudelist välja juba enne (`EMPTY_VALUE`, `structured-record-source.js`).

## Otsus

- **Allikaregistri lingid** (`registeredSource`, PR #207, töötlussilt `source-structure-v27`):
  - kirje, millel pole oma linki, saab `source_urls`-i oma omavalitsuse räsiga kontrollitud registrist allikavõtmete järgi, ainult https;
  - kirje oma link võidab alati; registreerimata register ei anna midagi; räsivea korral sisestus peatub.
  - Tükitekst ja embedding-sisend ei muutu.
- **SHS-i redaktsioonid** (PR #208): korpusesse lisati RT 103062026023 (12.06–30.09.2026) ja RT 111072026120 (01.12–31.12.2026). Kehtivusreegel valib kuupäeva järgi ise. Ühe küsimuse kuupäeval kehtib üks redaktsioon; aasta-perioodi küsimusel võivad kõik kolm olla korraga sees.

## Tulemus

- **v28:**
  - 577 kirjet uuesti sisestatud: 576 kaasatud ja 1 välja jäetud (kirje pole v25-st saadik korpuses).
  - 576-l on tükitekst muutumatu; kõigil on nüüd link (445-l üks, ülejäänutel 2–9).
  - Serverisse saadeti 140 MB. Vektoriplaan: 29 182 sisendit, uusi 0, kulu 0.
  - Indeks `search_generation_1f2716…`.
- **v29:**
  - SHS 12.06–30.09 (245 tükki) ja 01.12–31.12 (251 tükki); hoidla põlvkond `generation_8f546f…`, poliitika 6000 dokumenti.
  - Osteti 83 uut vektorit (46 777 tokenit, 0,006 USD); ülejäänud tükid kasutasid varem ostetud vektoreid.
  - Indeks `search_generation_b06f5f…`: 29 716 ühikut, ehitus 43,5 min. Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20260927s.json` (id …-1645) aktiivne 27.09 kell 19:45 EEST.
- **Tasuta kontroll v29 peal** (päris indeks ja omavalitsuste register, mudelikutseta):
  - 27.09 seisuga jääb tõendiks SHS 12.06–30.09; 01.10–30.11 ja 01.12–31.12 jäävad välja (`not_yet_in_force`).
  - 01.10 seisuga jääb tõendiks 01.10–30.11; 12.06–30.09 on `expired`, 01.12–31.12 `not_yet_in_force`.
  - Omavalitsuste piiritlus on muutumatu: Narva ja Narva-Jõesuu eraldi, „Tartus“ küsib täpsustust, venekeelne Narva küsimus leiab Narva linna.
- **Elav kontroll** sotsiaal.ai/vestlus, 27.09 ~19:56 EEST:
  - „Mida sotsiaalhoolekande seadus ütleb koduteenuse korraldamise kohta?“ tsiteeris SHS-i 12.06–30.09 redaktsiooni § 17 ja Riigikontrolli aruannet „Koduteenuste korraldus“.
  - „Kui palju maksab Hiiumaa vallas sotsiaaltransport?“ tsiteeris Hiiumaa valla kirjet „Sotsiaaltranspordi teenus“, andis hinnad ja kontrollikuupäeva 11.04.2026 ning ütles, et praegust kehtivust ei kinnita.
  - Kirjel endal linki pole. Allika link `https://vald.hiiumaa.ee/perekond-ja-sotsiaalabi/erivajadused-ja-igapaevaelu/sotsiaaltranspordi-teenus` tuli omavalitsuse allikaregistrist.

## Piirid

- Registrileht on kogu omavalitsuse leht (nt kontaktide leht), mitte alati kirje enda leht.
- Aasta-perioodi küsimusel võivad samad SHS-i lõigud tulla mitmest redaktsioonist.
- 2027 redaktsioonid (RT 111072026121 jt), HMS ja Riigilõivuseaduse järgmised tekstid tuleb lisada enne 31.12.2026.
