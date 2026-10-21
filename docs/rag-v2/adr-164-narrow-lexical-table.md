# ADR-164 — Sõnaotsing loeb otsinguvektoreid kitsast tabelist

21.10.2026. Teostus Claude Opus 5.5. Omaniku luba andmebaasi muudatuseks: „okei, tee ära“ (21.10.2026). Jätk
[ADR-161](adr-161-lexical-search-time.md)-le.

## Leid

- Vestluse sõnapäring võtab 2,9–4,4 s ja loeb umbes 1,1 miljonit plokki (ADR-161).
- Päringu 28–39 sõna sobivad peaaegu iga lõiguga, nii et `ts_rank` arvutatakse umbes 70 000 reale.
- `rag_v2_version_unit` read on laiad (`data`, `body`, `morphology`), ja mõlemad otsinguvektorid on TOAST-is rea
  kõrval. Iga vektor tuuakse sealt eraldi ja mitu korda.

## Kohalik mõõtmine

- 120 000 sünteetilist lõiku eesti sõnavaraga (sagedased sõnad sagedamini).
- Vektorid on keskmiselt 3,8 ja 4,3 KB, lõik 2000 märki.
- Päringus on 30 sõna ja umbes 58% ridadest on ulatuses, nagu serveris.

| | Lai tabel | Kitsas tabel (`STORAGE MAIN`) |
|---|---:|---:|
| aeg | 7,6 s | 3,5 s esimest korda, 2,5 s teist korda |
| puhvreid | 886 000 | 235 000 |
| tulemus | 40 rida | samad 40 rida samade skooridega |

## Otsus

- **Migratsioon `202610210001_version_lexical`:**
  - uus tabel `rag_v2_version_lexical` (tenant, config_id, id, version_id ja kaks vektorit);
  - vektorid on `STORAGE MAIN`, nii et need jäävad võimaluse korral reasse;
  - versiooni indeks;
  - välisvõti ühikule `ON DELETE CASCADE`, nii et prune'itud ühik võtab oma rea kaasa;
  - päästik `AFTER INSERT` kopeerib iga uue ühiku samas tehingus. Ühik kirjutatakse üks kord (ADR-036) ja seda ei
    uuendata;
  - olemasolevad read täidetakse ühe `INSERT … SELECT`-iga.
  - Iga lause on korratav (`IF NOT EXISTS`, `OR REPLACE`, `ON CONFLICT DO NOTHING`), et katkenud deploy'd saaks
    uuesti proovida.
- **Kood:** `lexical()` loeb versioonikihis `rag_v2_version_lexical` tabelit. Päring ja ulatus jäävad samaks, ainult
  `FROM` muutub. Aktiveerimine värskendab ka selle tabeli statistikat (`GENERATION_TABLES`).
- Põlvkonnakihti (`rag_v2_unit`) see ei puuduta.

## Kontroll

- **Kohalik andmebaas (Postgres 16):**
  - migratsioon rakendus;
  - 10 rida kopeeriti ja vektorid olid identsed;
  - salvestusviis on `m`;
  - fail käis teist korda vigadeta läbi;
  - tagasivõetud tehingus kopeeris päästik uue ühiku ja ühiku kustutamine võttis rea kaasa.
- **Koodi kaudu** (`lexical()` kitsas tabel ja sama SQL laial tabelil): samad id-d samade skooridega.
- **Serveris:** samad küsimused, raja `lexical` aeg ning teadmusraja kandidaadid enne ja pärast.

## Kui midagi läheb valesti

- Kood saab jälle lugeda laia tabelit (`LEXICAL_SCOPE`). Kitsas tabel ja päästik võivad jääda.
- Kui migratsioon serveris katkeb, jääb tööle eelmine väljalase ja `_prisma_migrations` märgib migratsiooni
  lõpetamata. Enne järgmist deploy'd on vaja seal käivitada
  `prisma migrate resolve --rolled-back 202610210001_version_lexical`. Kuna laused on korratavad, saab migratsiooni
  siis uuesti proovida.
