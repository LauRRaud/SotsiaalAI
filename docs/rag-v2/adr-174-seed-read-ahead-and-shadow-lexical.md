# ADR-174 — Seemnete allikad ühe päringuga. Sõnaotsing vektorkandidaatide seas varjus

22.10.2026. Teostus Claude Opus 5.5. Arendusplaani ([kiirus ja kvaliteet](../platvormi%20arendus/sotsiaal-pro-arendusplaan-kiirus-ja-kvaliteet-2026-10-22.md))
etapid 0 ja 1. Omanik: „aeg esimese tekstini. muus osas tuleb teha parim valik, mis on väikseima riskiga“.

## Leid

- **Valiku järel laaditakse allikad dokumendi kaupa.** Valik jätab kuni 9 lõiku. Seemnete tsükkel laadis iga uue dokumendi
  allika ja üksused eraldi kahe päringuga ning kontrollis need. Viie dokumendi korral on see kümme järjestikust päringut
  enne vastuse algust. Uurimus hindas võiduks mediaanis kuni 0,33 s ja p90-s ~1,3 s. Kui suur see serveris on, pole
  mõõdetud: pöörde jälg ei eralda laadimise aega.
- **Sõnaotsing on otsingu kriitiline osa** (75 pööret 75-st, mediaanis +2,35 s). Ainult sõnaotsingu leitud lõik ei jõudnud
  valikusse kordagi (0/5544). Kas sõnaotsingu võib piirata vektorkandidaatidega, sõltub sellest, kas valiku kandidaadid
  jäävad samaks. Seda ei saa teada ilma serveri andmeteta.

## Otsus

- **Seemnete ettelugemine.** Enne seemnete tsüklit loetakse tema esimese `topK − valitud` järjestuse dokumendid ühe
  päringuga (`hydrate(..., { ordered: true })`).
  - Tsükkel jõuab need kohad alati läbi, sest ta lõpetab alles siis, kui `topK` lõiku on käes, ja iga koht lisab
    kõige rohkem ühe.
  - Andmebaas tagastab dokumendid ID järgi. `ordered` paneb dokumendid ja nende üksused soovitud järjekorda (stabiilne
    sortimine, dokumendi üksused jäävad ordinaali järgi). Nii on laaditud dokumendid ja nende järjekord samad, mis
    dokumendi kaupa laadides.
  - Hilisem dokument (tagasilükkamise järel) laaditakse endiselt siis, kui tsükkel temani jõuab.
  - Kontroll jääb samaks: iga üksus võrreldakse oma allikaga.
- **Laadimise taimerid.** `hydrate_db` (lugemine), `hydrate_check` (kontroll) ja `hydrate_calls` liidetakse üle pöörde.
  Nii näeb serveris, kas tasub teha ka kontrollitud dokumendi vahemälu.
- **Varjupäring (ainult mõõtmine).** Kui vektorpäringud on lõppenud, käivitatakse sama sõnapäring nende kandidaatide
  seas (`unitIds`, olemasolev parameeter). Pööre seda ei oota ega kasuta. Kui ta lõppes enne liitmist, kirjutatakse
  taimeritesse:
  - `shadow_lexical`, `reserve_shadow_lexical`: varjupäringu aeg;
  - `shadow_pool`: valiku kandidaatide arv (RERANK_POOL dokumendi piiranguga, siis reserv nagu valik selle võtab);
  - `shadow_same_k10/20/40`: mitu neist jääb samaks, kui sõnaotsingu kanal oleks varjupäringu esimesed 10, 20 või 40 rida;
  - `shadow_lexical_only`: täispäringu read, mida vektorid ei leidnud;
  - `shadow_late` või `shadow_failed`, kui tulemust polnud.
  - Viga püütakse kinni, pööret see ei mõjuta. Versioonimuutuse rada (`change_`) jääb kõrvale.

## Mida ei muudetud

- Sõnaotsing ise, liitmine, valiku kandidaadid ja valiku sisend on samad. Sõnaotsingu piiramine vektorkandidaatidega
  otsustatakse alles siis, kui `shadow_same_k*` näitab serveri pööretel suurt kattuvust.
- Pakett on sama. Muutuvad ainult `timings_ms` uued väljad.

## Kontroll

- **Võrdsus (`adr174-check`, mälus, ilma võrguta).** HEAD-i ja uue `retrieve()` paketid võrreldi välja arvatud
  `timings_ms` ja juhuslik `query_id`. Andmebaas tagastab dokumendid ID järgi ja üksused ordinaali järgi nagu
  `postgres.js`. Neli dokumenti järjestati nii, et järjekord pole ID järjekord.
  - Mõlemad laadimise viisid (kataloog ja kõik korraga).
  - Viis valikut: neli eri järjestusega valikut ja üks ilma valikuta.
  - Kõik 10 paketti olid samad. Kataloogirežiimis langes allikate lugemine 4 → 1 (valik 2,5,1: 2 → 1).
  - Varju taimerid olid olemas.
- **Päringuplaan (kohalik korpus, ~100 kandidaati).**
  - Varjupäring kasutab primaarvõtme indeksit (`Index Scan`), 90–140 ms.
  - Täispäring on samas andmebaasis `Seq Scan`, 8–21 s.
  - Serveri tabeli `rag_v2_version_unit` primaarvõti on `(tenant, config_id, id)`, ja päring annab kõik kolm.
- **eslint** muudetud failil läbis.
- **Serveris** näitavad taimerid mõõtmisjooksus, kui palju laadimine võitis ja kas sõnaotsingu piiramine on ohutu.
