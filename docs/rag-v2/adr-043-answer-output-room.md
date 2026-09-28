# ADR-043 — Vastusemudeli väljundi lagi 8192

28.09.2026. Teostus Claude Opus 5.5. Aluseks on [vestluste hindamise](../audits/rag-v2-conversation-eval-2026-09-28.md) kataloogi v2 käivitus.

## Probleem

Juhtum: `vague-then-details` 2, küsimus „Olen 67-aastane, elan üksi Viimsi vallas ja pension on 600 eurot kuus.“

- Viimsi kataloogiga oli sisendis 21 056 tokenit.
- `gpt-6-luna` (`medium`) kasutas kõik 4096 väljunditokenit arutluseks, vastust ei jäänud. Kasutaja nägi veateadet (`provider_incomplete`).
- Arutlus kuulub `max_output_tokens`-i sisse.

Viimase 7 päeva 194 vastusekutse järgi:

| Näitaja | Väärtus |
|---|---|
| arutluse mediaan | 883 |
| arutluse 90. protsentiil | 1612 |
| arutluse 99. protsentiil | 2823 |
| väljundi 99. protsentiil | 3855 |
| lõppes lae tõttu | 1 |

Suure kataloogisisendiga (üle 18 000 tokeni) on arutluse mediaan 1148, väiksemaga 816.

## Otsus

- `newChatPlan` annab uuele plaanile `maxOutputTokens: 8192` (seni 4096). Plaani lugemine lubab kuni 16384.
- **Lagi on omaniku kinnitatud plaani sisu.** Väljalaske plaaniuuendus ([ADR-037](adr-037-release-chat-plan.md)) jätab kehtiva plaani lae samaks. Uus lagi kehtib alles uue kinnitatud plaaniga, mis tehakse `scripts/rag-v2-chat-plan.mjs` kaudu nagu v33 puhul.
- **Teenusepakkujale makstakse kasutatud tokenite eest nagu seni, aga plaani kulupäevik on konservatiivne.**
  - Iga kutse broneering (`inputBound × answerInput + maxOutputTokens × answerOutput`) jääb päevikusse. Kasutamata osa ei tagastata, ülekulu lisandub (`lib/rag-v2/pilot/store.js`, `usage()`).
  - Uue laega kasvab iga vastusekutse broneering 4096 × 500 nano-USD = 0,002 USD võrra.
  - Codexi kontrollis oli 40 pöörde broneeringute summa 0,869 USD (160 kutset), hinnanguline kasutus aga 0,196 USD. Seega mahub 4 USD kinnitatud piiri sisse umbes 180 pööret, mitte 4 USD väärt kasutust.
  - Codex 28.09: varasem lause „broneering vabaneb pärast kutset“ oli vale. Broneeringu vabastamine oleks eraldi käitumismuudatus, mis peab arvestama teadmata tulemusega kutseid.
- Arutluse tase jääb `medium`.

## Kontroll

- `tests/rag-v2-pilot-config.test.mjs`: 8192 ja 16384 on lubatud, 16385 mitte.
- `tests/rag-v2-chat-plan.test.mjs`: uus plaan saab 8192; uuendus hoiab kinnitatud 4096.
- **Päris vestluses (28.09):** väljalaske järel tehti ja aktiveeriti plaan `…20260928-1342` (`/etc/sotsiaalai/m4-corpus-chat-20260928b.json`).
  - Kataloogi v2 kordus andis 38/40.
  - `vague-then-details` 2 läbis. Väljundit kulus 4177 tokenit, sellest arutlust 2924, seega vana lae korral oleks see katkenud.
  - [Aruanne](../audits/rag-v2-conversation-eval-2026-09-28-run3.md).
