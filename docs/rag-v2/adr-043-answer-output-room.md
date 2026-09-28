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
- **Hind ei muutu:** kasutatud tokenite eest makstakse nagu seni. Kasvab ainult pöörde broneering, `maxOutputTokens × answerOutput`. Plaani rahapiir jääb samaks ja broneering vabaneb pärast kutset.
- Arutluse tase jääb `medium`.

## Kontroll

- `tests/rag-v2-pilot-config.test.mjs`: 8192 ja 16384 on lubatud, 16385 mitte.
- `tests/rag-v2-chat-plan.test.mjs`: uus plaan saab 8192; uuendus hoiab kinnitatud 4096.
- Päris vestluses tuleb pärast uut plaani korrata `vague-then-details`.
