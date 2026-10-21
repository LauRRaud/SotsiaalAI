# ADR-160 — Vastuse kontroll parandab, mitte ei lükka tagasi

21.10.2026. Teostus Claude Opus 5.5. Omanik: „vastusekontroll ei tohiks üldjuhul nii jõuliselt käituda, et lükkab
vastuse tagasi. Võta see ära, see mehhanism.“

## Leid

- Kiirusmõõtmise kuuest pöördest ühe vastus (Tartu sotsiaaltöötaja hindamisküsimus) lükati tagasi koodiga
  `inline_answer_reference`.
  - Mudel kirjutas 11,8 s vastust, aga kasutaja sai vea.
  - Põhjus oli üks viitemärk tekstis.
- `validateAnswer` lükkas kogu vastuse tagasi ka iga muu mudeli libastuse korral:
  - **vorm:** liik ei sobi sisuga, näiteks `partial` ilma piiranguta või `unsupported` koos plokkidega;
  - **viited:** plokk viitab allikale, mida selle pöörde paketis ei ole, või rohkem kui viiele allikale;
  - **märgid tekstis:** „[S3]“, tsitaadimärgistus või üksik „S3“ nähtavas tekstis.
- Admini jälg ei näidanud, miks pööre katkes.

## Otsus

- **`repairAnswer`** (`contracts.js`, `answer-repair-1`) loeb värske vastuse enne `validateAnswer`-it ja parandab
  selle. Tagasi ei lükka see midagi:
  - viitemärgid nähtavast tekstist võetakse välja. Kui märk nimetab selle pöörde allikat, läheb see ploki
    viidetesse;
  - tundmatu viide jäetakse välja, plokis jääb kuni 5 viidet, liiga pikk tekst või loend lõigatakse;
  - plokk, millele ei jää teksti ega ühtki viidet, jäetakse välja: allikata väidet ei avaldata;
  - liik järgib seda, mis jäi:
    - plokid → `grounded`, piirangu või küsimusega `partial`;
    - plokkideta → küsimusega `clarification`, piiranguga `unsupported`.
- **Tagasi lükatakse ainult vastus, millest ei jää midagi näidata:** ei plokki, piirangut ega küsimust. Samuti
  vastus, mis ei ole JSON-objekt.
- Mudeli algne mustand jääb vastuse auditisse muutmata. Parandused salvestatakse pöördega (`answerRepair`), ja admini
  jälg näitab neid: „Server parandas vastuses“.
- Jälg näitab katkenud pöörde põhjust: veakood ning tagasilükatud vastuse puhul koht ja tekst („Miks pööre katkes“).
- `validateAnswer` jääb avaldatud vastuse lepinguks. Parandatud vastus läbib selle muutmata, nii et salvestatud
  vastuste taastamine ja ajalugu käituvad nagu enne.

## Piirid

- Üksik „S12“ tekstis võetakse välja ka siis, kui see oli päris tähis. Sotsiaalvaldkonna tekstis on see
  ebatõenäoline. Varem lükati selline vastus tagasi.
- Plokk, mille ainus viide oli tundmatu, jääb välja. See on parem kui allikata väide, aga vastus võib jääda
  lühemaks.
- Parandusi ja nende sagedust näeb pöörde jäljest. Kui mõni parandus kordub sageli, tuleb põhjus parandada juhises.

## Kontroll

- Kohalik kontroll, kõik juhud läbisid:
  - korrektne vastus jääb muutmata;
  - märgid tekstis, piirangus ja küsimuses;
  - tundmatu viide ja viidete piir;
  - liigi parandused;
  - dialoogiseis jääb puutumata;
  - tühi vastus lükatakse tagasi;
  - parandatud vastuse uus parandus ei muuda midagi.
- `npm test`: 70 läbis, 3 vahele jäetud.
