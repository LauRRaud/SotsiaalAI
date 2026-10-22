# ADR-170 — Vastuse kutse kordus pärast ajapiiri

22.10.2026. Teostus Claude Opus 5.5. Omaniku otsused:
- 21.10: „Õige kordus, eraldi tööna“;
- 22.10: „selle teema pead ka korda saama“.

## Leid

- **Kui sageli.** 21. ja 22. oktoobril lõppes umbes üks pööre sajast veaga. Viimati juhtus see 22.10 jooksu pöördel C20.
- **Kuidas see välja nägi.**
  - Plaan, vektorid ja valik said valmis 15 sekundiga. Seejärel saadeti vastuse kutse.
  - 60 sekundi jooksul ei tulnud teenusepakkujalt midagi. Sündmus jäi olekusse `sent_unknown` ja `AbortSignal.timeout` katkestas kutse.
  - Kasutaja sai 75 sekundi pärast vea.
- **Miks kordust varem ei tehtud.** Arvestus lubas igal pöördel ühe kutse sammu kohta:
  - kutse tunnus on `pööre:samm`;
  - `reserve` lükkab sama sammu teise sündmuse tagasi.

## Otsus

- **Kordus on omaette samm `answer_retry`.** Sellel on oma broneering, oma kutse kirje (`AiProviderCall` `pööre:answer_retry`) ja olekud
  `answer_retry_reserved` / `answer_retry_sent`.
  - Kordus loetakse vastuse katseks ja ta jagab vastuste eelarvelimiiti (`answerAttempts`).
  - Igal pöördel on üks kordus.
  - Sammu nimi on andmebaasis vaba tekst, migratsiooni pole vaja. Hinnastus käsitleb seda nagu vastust.
- **Ajapiiri ületanud esimene kutse.**
  - Sündmus läheb olekusse `provider_failed`, koodiks on ajapiir (`TimeoutError`).
  - Broneering ja kutse kirje jäävad alles, sest teenusepakkuja võib selle eest arve teha. Samuti talitatakse otsingu abi
    kutsetega.
- **Millal kordus tehakse** (`answerRetryTimeout`):
  - viga on ajapiir (`TimeoutError` või `AbortError`) ilma kasutuseta;
  - kasutajale pole veel ühtegi teksti näidatud, sest voogu läinud teksti tagasi võtta ei saa;
  - pööre jõuab veel lõppeda. Brauser ootab 180 s. Korduse ajapiir on ülejäänu 150 s-st (`ANSWER_RETRY.turnMs`), aga mitte
    üle plaani 60 s. Kui alla 35 s jääb (`minimumMs`), kordust ei tehta.

  Tavalisel juhul (otsing 15 s, ajapiir 75 s juures) saab kordus täis 60 s.
- **Järjekord:**
  1. broneeritakse kordus (kui eelarve seda ei luba, lõppeb pööre nagu enne olekus `unknown`);
  2. märgitakse esimene kutse;
  3. saadetakse kordus.

  Voogedastaval kliendil on kordusel uus nähtava teksti lugeja.
- **Admini jälg.** Sammude tabelis on „vastus (kordus)“. Ebaõnnestunud kutse olekul on kood, näiteks `provider_failed (TimeoutError)`.

## Kontroll

- **`tests/rag-cost.test.mjs`, kaks uut testi.** Raha kulu on üks neist kahjudest, mille kohta AGENTS.md lubab testi lisada.
  1. Kordus tehakse ainult ajapiiri järel, ilma näidatud tekstita ja piisava ajaga.
  2. Päris `PilotStore` võltsandmebaasiga:
     - kordus broneeritakse ja saadetakse;
     - esimene kutse jääb `provider_failed` olekusse koos oma broneeringuga;
     - pearaamatus on kaks vastuse katset ja mõlema broneering;
     - teist kordust ei lubata;
     - vastuste limiidi täis olles kordust ei tehta.
- **Teised testid.** `rag-cost` läbis 10/10. `rag-v2-store-pack` ja kriisitee testid läbisid. eslint ja i18n olid korras.
- **Mis jääb kontrollimata.** Ajapiiri ei saa tellida, seega serveris kontrollitakse kordust alles siis, kui see päriselt
  juhtub. Iga jooksu jälje sammude tabel näitab seda.
