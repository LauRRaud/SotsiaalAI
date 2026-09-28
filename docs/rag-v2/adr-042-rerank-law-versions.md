# ADR-042 — Seaduse redaktsioonid rerank'is

28.09.2026. Teostus Claude Opus 5.5. Jätkab [ADR-041](adr-041-exact-dates.md) ja Codexi palvet leida, kus õige redaktsioon kaob.

## Probleem

Pärast ADR-041-t kordasin `law-on-dates` stsenaariumi päris vestlusteenusega. Kehtivusreegel töötas õigesti:

- küsimus „1. märtsil 2027“ lubas SHS-i redaktsiooni 01.02–31.03.2027;
- küsimus „2027. aasta jaanuaris“ lubas RLS-i redaktsiooni 01.01–30.06.2027.

Ometi oli tõendis mõlemal korral ainult tänane redaktsioon ja vastus ütles, et küsitud päeva teksti ei saa kinnitada.

Kaotuse koht on rerank:

- Ühe seaduse redaktsioonid on eraldi dokumendid sama pealkirja ja sageli sama tekstiga. Näiteks jõudis `rerank`'i 34 lõigu hulka 9 SHS-i lõiku.
- Lõigul olid ainult `id`, `title`, `year` ja `text`, kehtivusaega mitte. Mudel ei saanud redaktsioone eristada ja valis tänase.
- Tänast kuupäeva rerank ei teadnud.
- Vastuse mudel näeb kehtivust allika metaandmetes (`valid_from`, `valid_to`), aga ainult nende allikate kohta, mille rerank juba valis.

Hindamise otsingukontroll ei märganud seda, sest `evidence` võrdles ainult pealkirja.

## Otsus

- **Rerank'i lõigul on kehtivus.** Kui allikas deklareerib kehtivuse (seadus, määrus või omavalitsuse kord), on lõigul `valid_from` ja `valid_to`. Lahtise lõpu puhul on `valid_to` `null`, samamoodi nagu vastuse mudeli metaandmetes. Artiklil ja juhendil neid välju pole.
- **Rerank'i sisendis on `today`**, Eesti kalendripäev (`estonianDate()`), sama mis kehtivusreegli viitepäev.
- **Rerank'i juhises on üks lisalause.** Hoia redaktsioon, mis kehtib küsitud päeval või perioodil, või tänasel päeval, kui küsitakse praeguse kohta või päeva ei nimetata. Teise redaktsiooni võib lisada ainult võrdluse korral või siis, kui redaktsioonid erinevad küsitu osas.
- **Mudelikutseid ei lisandu ja lepingu versioon ei muutu.** Rerank on sama kutse; `search-assist-2` jääb samaks, sest vastuse ega valiku kuju ei muutu. Sisend ja juhis on kutse auditis nagu seni.
- **Hindamine eristab redaktsioone:**
  - uus otsingukontroll `found_valid_on` nõuab, et leitud allikate hulgas oleks küsitud päeval kehtiv redaktsioon;
  - `valid_on` nõuab nüüd, et viidatud õigusaktide hulgas oleks vähemalt üks küsitud päeval kehtiv. Tänase redaktsiooni viitamine selle kõrval (võrdlus) ei ole viga. See oli Codexi märgitud valepositiivne.

## Kontroll

- **Testid:**
  - `tests/rag-v2-pool-reserve.test.mjs`: seaduse, lahtise lõpuga akti ja omavalitsuse korra lõigul on kehtivus, juhendil mitte;
  - `tests/rag-v2-search-assist.test.mjs`: `today` on sisendis ainult siis, kui see anti, ja juhis nimetab välju;
  - `tests/rag-v2-conversation-eval.test.mjs`:
    - sama pealkirjaga vale redaktsioon on otsinguviga;
    - tänane redaktsioon võrdlusena kõrval ei ole viga, aga tänane üksi küsitud päeva kohta on.
- **Enne PR-i mõõdetud päris vestlusteenusega.**
  - Muudetud kood töötas eraldi koopias (`eval-next`) ning oma, aktiveerimata plaaniga `m4-sotsiaalai-corpus-chat-20260928-1310` (0,5 USD piir).
  - `law-on-dates` tulemus oli 4/4:
    - 1.3.2027 viitab SHS 01.02–31.03.2027;
    - „praegu“ viitab tänasele;
    - 2027. aasta jaanuar viitab RLS 01.01–30.06.2027;
    - 31.10.2026 kohta tunnistab vastus, et ei saa kinnitada.
  - Kulu 0,015 USD.
  - Kogu kataloog v2 sama koodiga andis 37/40, kõik kuupäevapöörded läbisid. Ülejäänud kolm puudust ei ole seotud redaktsioonide valikuga, vt [aruanne](../audits/rag-v2-conversation-eval-2026-09-28.md#kataloogi-2-versioon-uue-koodiga-toortulemus-3740).

## Piirid

- Valiku teeb endiselt mudel. Kehtivusreegel välistab mittekehtivad redaktsioonid kindlalt, aga lubatud redaktsioonide vahel otsustab rerank.
- Kui rerank ei tööta (`rerank_unavailable_fused_order`), jääb liitjärjestus ja kehtivus seal valikut ei mõjuta.
