# ADR-161 — Kuhu kulub sõnaotsingu aeg

21.10.2026. Teostus Claude Opus 5.5. Jätk [ADR-159](adr-159-wide-vector-search-through-the-index.md)-le: pärast
vektorotsingu parandust oli sõnaotsing teadmusraja suurim otsinguosa, 2,9–3,8 s pöörde kohta.

## Proov

- Ajutine proov oli commit'is 168c04e1 ja on nüüd eemaldatud. Teadmusraja sõnapäring käivitati veel kaks korda:
  - `EXPLAIN (ANALYZE, BUFFERS)` all;
  - ilma ühikute loendita, 60 rida rohkem, loend rakendati pärast.
- Mõõdetud viis kolme juhtumi küsimust (A01, A11, B01, B11, C01).

| | Vahemik |
|---|---:|
| päringu aeg | 2,9–4,4 s |
| täitmise aeg (`EXPLAIN`) | 4,2–4,7 s |
| planeerimine / päringu sõnade analüüs | 9–33 ms / 4–8 ms |
| sõnu päringus (küsimus ja variandid) | 28–39 |
| skaneeritud read / filtriga välja jäetud | 73 000–78 000 / 47 000–53 000 |
| puhvrid vahemälust / kettalt | 1,06–1,14 mln / 83 000–142 000 plokki (8 KB) |
| ilma ühikute loendita | 4,1–4,7 s, samad tabamused (100%) |
| seaduste reserv (7 000 lõiku) | 0,6–1,2 s |

## Järeldus

- **Ühikute loend (80 000 ID-d) aega ei mõjuta.** Ilma loendita on päring sama kiire.
- **Päring loeb peaaegu iga lõigu.** Küsimus ja variandid on üks VÕI-päring 28–39 sõnaga, ja peaaegu iga lõik sisaldab
  neist vähemalt üht. Postgres teeb paralleelse täisskaneerimise (3 töötajat) ja arvutab `ts_rank`-i umbes 70 000
  reale.
- **Aeg kulub vektorite lahtipakkimisele.** `rag_v2_version_unit` read on laiad: `data`, `body`, `morphology` ja kaks
  `tsvector`-it. Otsinguvektorid on TOAST-is ja iga rida pakitakse lahti mitu korda: `@@` ja `ts_rank` mõlemas
  vektoris. Seepärast loeb üks päring umbes 1,1 miljonit plokki (umbes 9 GB loogilist lugemist), neist kuni 1,1 GB
  operatsioonisüsteemi vahemälust või kettalt.

## Võimalused (ükski ei ole veel tehtud)

1. **Kitsas kõrvaltabel** ainult sõnaotsingu jaoks (`id`, `version_id`, kaks vektorit, `STORAGE MAIN`). Indekseerimine
   kirjutab selle, sõnapäring loeb seda. Tulemused jäävad samaks, eeldatav võit 2–3 s pöörde kohta. Vajab migratsiooni,
   olemasolevate ridade täitmist ja kontrolli, et päringu read ei muutu.
2. **Iga vektor pakitakse lahti ühe korra** (alampäring, mis annab vektori edasi). Tulemused samad, võit eeldatavasti
   väiksem (umbes kolmandik lahtipakkimistest jääb ära).
3. **Vähem sõnu VÕI-päringus** (näiteks ainult küsimuse ja variantide harvemad sõnad). Kiirem, aga muudab sõnakanali
   järjestust, nii et vajab kvaliteedimõõtmist ja uut otsinguprofiili.

Omaniku eesmärk (21.10.2026): vastus alla 30 sekundi ilma kvaliteeti kaotamata. Sõnaotsing on sellest umbes 3 s,
mudelikutsed (plaan, valik, vastus) 20–45 s.
