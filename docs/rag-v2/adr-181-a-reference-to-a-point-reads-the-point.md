# ADR-181: viide teise lõike punktile loetakse selle punkti kirjeldusena

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026: „muidugi kontrollide asi paranda ka“ (tõenduskatsete lahtised punktid) ja „mõtle ise, tegutse“. Seis: **vastuse juhis `m4-grounded-answer-18`, vestluse juhis `m4-grounded-dialogue-53`.**

## Probleem

Tõenduskatse G09 küsib: „Üürin korterit oma emalt ja maksan talle iga kuu üüri. Kas see üür läheb toimetulekutoetuse arvestamisel arvesse?“

- SHS § 133 lg 8: üüri ei võeta arvesse, kui üürileandja ja üürnik on „käesoleva seaduse § 131 lõike 7 punktis 1 või 2 nimetatud isikud“.
- SHS § 131 lg 7 algab: „Toimetulekutoetuse määramisel loetakse perekonnaliikmeteks samas eluruumis elavad ühise majapidamisega: 1) abielus, registreeritud kooselus või abieluga sarnanevas suhtes olevad isikud; 2) esimese ja teise astme alanejad ja ülenejad sugulased; …“.

Kõik vastused (14.10, korpus v94 ja v95) võtsid lõike 7 sissejuhatuse viite juurde. Nende järgi jääb emale makstud üür välja ainult siis, kui ema elab taotlejaga samas eluruumis ja neil on ühine majapidamine. Seetõttu küsisid vastused, kas nad elavad koos.

Ametlikud allikad loevad välistust suhtepõhiselt:

- **Eelnõu seletuskiri** (Sotsiaalministeerium 2025, lk 17; korpuses alates v95): „Kehtiva seaduse alusel ei võeta üüri TTT arvestamisel arvesse, kui üürijaks ja üürnikuks on omavahel abielus, registreeritud kooselus või abieluga sarnases suhtes olevad isikud või esimese ja teise astme alanejad ja ülenejad sugulased. Lõiget täiendatakse selliselt, et …“. Põhjus: „Enamikul sättes nimetatud isikutest on perekonnaseaduse alusel ülalpidamiskohustus üksteise suhtes.“
- **Sotsiaalministeeriumi infopäeva slaid 54** (9.12.2025; korpuses alates v94): pealkiri „Välistatakse lähedastega seotud üürilepingud“. Vana sõnastus loetleb samad suhted ilma koos elamise tingimuseta.
- **SKA kommenteeritud juhend omavalitsustele** (2022): sama vana sõnastus.
- **SKA KKK**: lepingut, mis on sõlmitud „teise ja esimese astme üleneja ja alaneja“ vahel, ei loeta eluruumi kasutamise õiguslikuks aluseks.

v95-s oli slaid 54 paketis, kuid vastus jäi samaks. Seletuskirja lõik ei jõudnud kandidaatide hulka ([ADR-177](adr-177-family-doctor-domestic-violence-guideline.md), v95). Viga ei ole seega ainult tõendis, vaid ka selles, kuidas viidet loetakse.

## Otsus

Vastuse juhise jaotis LEGAL PROVISIONS saab ühe üldise lugemisreegli. See ei ole G09 erireegel:

> When a provision applies to persons or things named in a point of another subsection ("§ <N> lõike <M> punktis <P> nimetatud isikud"), read the reference as that point's own description: the subsection's opening words that come before its points (such as living in the same dwelling) are not part of it unless the referring provision repeats them or a cited source says they apply.

Põhjendus:

- Viide punktile nimetab isikud, keda see punkt kirjeldab.
- Kui seadusandja oleks tahtnud viidata pereliikmetele, oleks ta kirjutanud „§ 131 lõikes 7 nimetatud perekonnaliikmed“.
- Seletuskiri kinnitab seda lugemist selle sätte kohta otse.

Reegel ei luba midagi juurde mõelda. Kui viitav säte kordab tingimust või tsiteeritud allikas ütleb, et see kehtib, jääb tingimus alles.

## Mis muutus

- `lib/rag-v2/pilot/contracts.js`: `PROMPT_VERSION` `m4-grounded-answer-18`, uus lause jaotises LEGAL PROVISIONS.
- `lib/rag-v2/pilot/dialogue.js`: `DIALOGUE_PROMPT_VERSION` `m4-grounded-dialogue-53`. Muud read on samad mis v52-s.
- Juhis on implementatsiooni manifestis, seega uuendab deploy vestlusplaani ise ([ADR-037](adr-037-release-chat-plan.md)).

## Kontroll

- eslint muudetud failidel ja `tests/deploy-plan-release.test.mjs`, `tests/rag-cost.test.mjs`: läbisid.
- **Server pärast deploy'd** (väljalase `a2cf6962`, 12.29 UTC), pöörduja vaates, uues vestluses:
  - **G09:** vastus oli `grounded`. See algab „Ei. Sinu emana on ta sinu üleneja sugulane ning sellise üürileandja ja üürniku vahel makstavat üüri toimetulekutoetuse arvestamisel arvesse ei võeta“ ja viitab SHS § 133 lg 5–8 ning § 131 lg 7 lõikudele. Kaks jääki:
    - lause „sinu emale makstud üür toetuse arvestust ei vähenda“ on segane;
    - vastus ei ütle, et muid eluasemekulusid võib arvestada. Seda ütleb seletuskiri, kuid tema lõik ei olnud ka nüüd kandidaatide seas. Põhjused on tõenäoliselt vale jaotisepealkiri ja lühend „TTT“.
  - **Kontrollküsimus**, kas samas korteris eraldi majandav õde on pereliige: vastus rakendab § 131 lg 7 sissejuhatust endiselt („otsustav on ühine majapidamine“).
  - Tõend: [server-rag-chat-g09-u01-v95.json](../audits/evidence/sol-proof-20261014-01/server-rag-chat-g09-u01-v95.json).
- **Lahtine:** seletuskirja lõik jõuab otsingus kandidaatide hulka alles siis, kui PDF-i jaotisepealkirjad loetakse õigesti. See on PDF-lugeja töö ega kuulu selle juhise alla.
