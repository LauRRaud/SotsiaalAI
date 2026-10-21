# ADR-159 — Lai vektorotsing käib HNSW-indeksi kaudu

21.10.2026. Teostus Claude Opus 5.5. Omaniku kolme juhtumi test (75 küsimust) ja soov: „kui me saame selle aja 35
sekundi pealt lühemaks ja saame toimiva RAG süsteemi“.

## Leid

- **Vektorotsing oli täpne otsing.** Teadmusraja vektorpäring (`QdrantIndex.query`) küsis Qdrantilt `exact: true` ja
  saatis kaasa kõigi lubatud lõikude ID-de loendi (`has_id`).
  - Laias päringus on loendis umbes 80 000 lõiku ja päringu keha on 3,4 MB.
  - Täpne otsing loeb iga filtri läbinud vektori. Kolme juhtumi testis võttis see Qdrantis mediaanina 4 s, kuni 23 s.
  - Pöördes on neli sellist päringut korraga: küsimus ja kuni kolm otsinguvarianti.
- **Ajutine proov** (commit c7e83527, kaks pööret serveris). Iga laia päringu juures tehti lisaks kaks HNSW-päringut
  (`hnsw_ef` 256) ja võrreldi, mitu täpse otsingu tabamust need leiavad.

  | Päring | Täpne otsing | HNSW koos ID-de loendiga | HNSW ilma loendita, loend pärast |
  |---|---:|---:|---:|
  | lai (80 026 lõiku), pööre 1 | 13,6–14,0 s | 0,9–1,3 s, 100% | 19–41 ms, 100% |
  | lai, pööre 2 | 3,3–3,6 s | 0,3–0,5 s, 90–100% | 61–87 ms, 90–100% |
  | seaduste reserv (6 994 lõiku) | 0,1–1,3 s | 10–45% | 10–45% |

  - Loendi räsimine võttis Node'is 74–113 ms päringu kohta.
  - Kitsa reservi puhul leiab HNSW koos filtriga vähe täpse otsingu tabamusi: filter jätab alles väikese osa
    kollektsioonist.
- Teise proovipöörde vastus jäi tulemata: vastuse mudelikutse ületas oma ajapiiri, otsing oli selleks ajaks lõppenud.
  See on eraldi küsimus.

## Otsus

- **Lai päring käib indeksi kaudu.** Kui lubatud lõike on vähemalt 20 000 ja tabamusi on vaja kuni 100:
  - Qdrant otsib HNSW-indeksist (`hnsw_ef` 256) ainult versioonifiltriga, ID-de loendita, ja annab 60 tabamust rohkem,
    kui vaja.
  - Lõigud, mida loendis ei ole (dokumendi struktuurisildid), jäetakse välja payload'i `unit_id` järgi. Räsi ei arvutata.
- **Varuvariant.** Kui pärast väljajätmist jääb tabamusi vähem kui vaja ja Qdrant andis täis arvu punkte, teeb sama
  päring täpse otsingu nagu varem. Kanal ei jää kunagi lühemaks kui täpse otsinguga.
- **Täpseks jääb:**
  - kitsas päring (seaduste reserv, versioonimuudatuse reserv);
  - päring ilma loendita (kaassätted, algsoojendus);
  - kirjete rada, mis küsib kõiki oma lõike.
- **Jälg.** Raja aegades on `vector_hnsw`: 1 = tabamused andis indeks, 0 = indeks jäi lühikeseks ja järgnes täpne
  otsing. Kui päring oli täpne, seda võtit ei ole. `vector_server` on Qdranti aeg; kui järgnes ka täpne otsing, siis
  mõlema päringu oma kokku.
- Proov on eemaldatud.

## Piirid

- HNSW on ligikaudne. Proovis leidis see 90–100% täpse otsingu tabamustest (40 kandidaadist kuni 4 erinevat). Valik
  liidab nelja vektorinimekirja ja sõnaotsingu, seega mõjutab see kandidaate vähe. Mõju kontrollitakse samade
  küsimustega.
- Lävi 20 000 on mõõtmise järgi valitud: lai päring on 80 000, reserv 7 000. Kui kollektsioonis on palju vanu
  versioone, väheneb laia päringu osa kollektsioonist. Siis näitab `vector_hnsw: 0` sagedasem esinemine, et lävi või
  varu (`extra`) vajab muutmist.

## Kontroll

- Kohalik kontroll Qdranti asendajaga:
  - lai päring: üks indeksipäring ilma loendita, loendist väljaspool olevad lõigud jäetakse välja;
  - lühike indeksitulemus: järgneb täpne päring;
  - kitsas päring, kirjete päring ja loendita päring jäävad täpseks;
  - loendist väljaspool olev tabamus lükatakse endiselt tagasi.
- Serveris: samad küsimused enne ja pärast muudatust, võrreldakse raja aegu ja valikumudeli kandidaate.
