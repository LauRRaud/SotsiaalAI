# ADR-041 — Täpne kuupäev küsimuses ja „praegu“

28.09.2026. Teostus Claude Opus 5.5. Aluseks on [vestluste hindamine](../audits/rag-v2-conversation-eval-2026-09-28.md) ja Codexi kontroll.

## Probleem

- `dateCandidates` tundis ainult ISO-kuupäevi (`2027-03-01`) ja aastaid.
  - Lausest „1. märtsil 2027“ jäi alles aasta 2027.
  - Kehtivusreegel ([ADR-031](adr-031-source-level-and-answer-completeness.md)) lubas seetõttu kõik 2027. aasta redaktsioonid lisaks tänasele. SHS-il oli neid neli peaaegu samasugust teksti.
  - Õige redaktsioon (01.02–31.03.2027) jäi tõendist välja. Mudel ütles ausalt, et ei saa 1.3.2027 teksti kinnitada.
- Mudeli olekust tulnud periood jäi kehtima ka küsimusele „Aga praegu?“.

## Otsus

- **Päev või kuu sõnade või numbritega, eesti, inglise ja vene keeles:**
  - „1. märtsil 2027“, „31. oktoobril 2026“, „01.03.2027“, „1 March 2027“, „March 1, 2027“ ja „1 марта 2027“ annavad selle päeva;
  - „2027. aasta jaanuaris“, „märtsis 2027“ ja „в январе 2027“ annavad selle kuu;
  - avaldise aastat eraldi uuesti ei loeta;
  - vigane päev (31. veebruar) muudab kandidaadid kehtetuks nagu seni.
- **Reegel jääb lisavaks.** Tänase päeva õigus jääb alati alles; küsitud päev või kuu lisab ainult sel ajal kehtiva redaktsiooni. Sünnikuupäev või kohtumise aeg ei eemalda tänast õigust. Kaks perioodi (võrdlus) jäävad mõlemad alles.
- **Päev või kuu ei ole ajakirjade avaldamisperiood**, seega ei tee need lisaotsingut perioodiradadele. Aasta ja vahemik jäävad avaldamiskandidaatideks nagu seni.
- **„Praegu“ ilma kuupäevata viib tagasi tänase õiguse juurde**, ka pärast perioodi, mille mudel oli olekusse kirjutanud. Sellised sõnad on „praegu …“, „täna“, „hetkel“, „now“, „currently“, „today“, „сейчас“ ja „сегодня“. Kuupäev samas küsimuses jääb kehtima: „1. oktoobril 2026 võrreldes praegusega“ annab 1.10.2026 ja tänase.

## Kontroll

- `tests/rag-v2-legal-scope.test.mjs`, SHS-i ja RLS-i tegelike versioonikuupäevadega:
  - 1.3.2027 annab tänase ja veebruari–märtsi redaktsiooni; 2027. aasta jaanuar annab tänase ja jaanuari redaktsiooni; paljas aasta annab endiselt kogu aasta;
  - „praegu“ tühistab mudeli perioodi eesti, inglise ja vene keeles, aga kuupäev samas küsimuses jääb;
  - sünnikuupäev ja kohtumise aeg ei eemalda tänast õigust ning võrdluse kaks perioodi jäävad alles;
  - 31.10.2026 kohta pole ükski RLS-i redaktsioon kehtiv, nii et vastus peab puudujääki tunnistama.
- `tests/rag-v2-unified.test.mjs`:
  - eesti, inglise ja vene kuupäevad ning kuud;
  - vigane päev;
  - avaldis koos eraldi aastaga;
  - numbrid, mis ei ole kuupäev, jäävad aasta kandidaadiks.
- `npm test`: 360 läbis, 0 ebaõnnestus, 17 vahele jäetud. `rag-v2-unified` integratsioon: 4/4.
- Päris vestluses kinnitab seda `law-on-dates` stsenaariumi kordus pärast väljalaset.

## Piirid

- **Tuvastus on süntaksipõhine, mitte kavatsuse tuvastus.** Kuupäev võib tähendada ka sündmust. Seepärast on reegel lisav ja mudel arvestab juhiseid (ajapiirid, kehtivuse võrdlemine).
- **Väljaspool reeglit jääb:**
  - suhteline aeg („järgmisel kuul“, „aasta pärast“);
  - kellaaeg ja nädalapäev.
