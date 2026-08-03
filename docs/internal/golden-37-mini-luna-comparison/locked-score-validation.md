# Golden-37 lukustatud pimehinnete valideerimine

Valideeritud 01.08.2026 fail:
`golden-37-human-scores-filled-locked.json`.

- SHA-256: `5a4411960524ab027c8f87e2b2f98260ca9c553de208d6117e850fbb9c085a58`;
- question-set SHA-256: `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089`;
- rubriigi SHA-256: `414b9102b12171b8f41f9c23c0305224bac95c53a5887caf9170b7b3eefb1f4d`;
- 74 unikaalset vastuserida, 37 küsimust ja 37 paarieelistust;
- kõik kuue kategooria hinded on vahemikus 0–3;
- puuduvad korduvad run-ID-d ja mudelivõtmega seostamata read;
- mudelivõtme järel arvutatud punktid: mini 573/666, Luna 628/666;
- paarieelistus: Luna 30, mini 2, võrdne 5;
- kriitilisi vigu: mini 1, Luna 1.

Hindefaili `evaluator` väli identifitseerib hindaja kui
`GPT-5.6 Thinking — pime rubriigihindamine`. Seetõttu on tulemus sõltumatu
pime mudel-hindamine, mitte päris inimese hinnang. Hindefail ise ei sisalda
mudelite seostamise võtit.

Metoodiline piirang: lukustatud faili `key_opened_at` on tühi ja
`scoring_started_at` ning `scoring_locked_at` on sama minutiga. Kaasnev
analüüs kinnitab, et võti seostati alles pärast hinnete lukustamist, kuid täpset
avamisaega pole lukustatud JSON-is tõendina talletatud. Faili ei muudetud ega
tagantjärele täiendatud, et säilitada omaniku antud hash.
