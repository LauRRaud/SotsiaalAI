# ADR-162 — Otsinguplaani skeem ilma pikkuspiirideta (search-assist-16)

21.10.2026. Teostus Claude Opus 5.5. Omanik: vastus alla 30 sekundi ilma kvaliteeti kaotamata. Luna seaded jäävad
samaks: tavaline teenindustase ja mõtlemine „low“.

## Leid

Tänased 14 serveripööret, mudelikutsed eraldi (`stages`, ADR-158):

| Kutse | Nähtav väljund | Aeg |
|---|---:|---:|
| plaan ilma mõtlemiseta | 109 tokenit | 3,6 s |
| plaan, mõtlemine 89–203 tokenit | 83–143 tokenit | 6,5–11,8 s |
| vastus | 790–1260 tokenit | 9–31 s, kiirel ajal umbes 8 ms tokeni kohta |

- Plaan kirjutab nähtavaid tokeneid umbes 25–30 ms tokeni kohta. Sama pöörde vastus kirjutab neid kiirel ajal umbes
  8 ms tokeni kohta.
- Plaani skeemis on pikkus- ja arvupiirid: `maxLength` 300/160/80/40 ja `turn` 1–30. Vastuse skeemis on ainult suured
  piirid (6000/2000). Tõenäoline põhjus on see, et piiratud dekodeerimine peab lühikesi piire iga märgi juures jälgima.
  Seda pole tõestatud: see katse näitab.

## Otsus

- `search-assist-16`: plaani skeemis ei ole `maxLength`-, `minimum`- ega `maximum`-piire. Massiivide `maxItems` ja
  enum'id jäävad.
- Piirid kehtivad serveris (`PLAN_BOUNDS`), ja pikem väärtus lõigatakse sealt, kust skeem selle lõikas:
  - päring 300 märki;
  - tsitaat 160;
  - nimi 80;
  - isik 40;
  - pöörde number 1–30.
  Server loeb seega sama väärtust, mida loeks piiridega skeem.
- Juhis ei muutu, ainult versiooni nimi selle päises. Valikumudeli skeemis on ainult enum, see jääb samaks.

## Kontroll

- Kohalikult on kontrollitud, et:
  - skeemis ei ole piire;
  - liiga pikk isik, tsitaat ja päring lõigatakse;
  - liiga suur pöörde number viiakse piiri peale;
  - vanad versioonid on endiselt loetavad.
- Serveris: samad kuus küsimust nagu ADR-159-s ja ADR-161-s. Võrreldakse plaani aega ning plaani väljundit
  (otsinguvariandid, kohad, isik). Kui plaan ei kiirene, võetakse muudatus tagasi.

## Tulemus serveris (4bd63ba7, 21.10.2026)

| | Enne (14 pööret) | Pärast (6 pööret) |
|---|---:|---:|
| plaani aeg | 6,5–11,8 s (ühe mõtlemiseta pöörde puhul 3,6 s) | 3,0–4,5 s |
| plaani väljund / mõtlemine | 200–330 / 89–203 tokenit | 201–289 / 90–164 tokenit |
| kogu pööre | 31–61 s | 29–44 s, mediaan umbes 33 s |

- Plaan kirjutab sama palju, kaks kuni kolm korda kiiremini (umbes 75 tokenit sekundis, enne umbes 28).
- Väljund on sama kvaliteediga. Kohad, isikud ja omavalitsus on samad. Kaks pööret olid täpsemad:
  - A01 nimetas ka kasutaja Tallinna elukoha;
  - C11 nimetas isikuks noore, mitte kasutaja.
- Erinevused otsinguvariantide sõnastuses on samad, mis kahe varasema jooksu vahel.
- Sama leid vastuse ja dialoogiseisu skeemis: [ADR-163](adr-163-answer-schema-without-bounds.md).
