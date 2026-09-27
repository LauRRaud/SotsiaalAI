# ADR-030 — Vestluse otsing kogu korpuse mahul

27.09.2026. Teostus Claude Opus 5.5, omaniku otsese ülesandega („tee RAG-süsteem ja otsingud korda, ühenda vestlus“).

## Probleem

Korpuse indeks (5996 dokumenti: 1122 teadmusdokumenti ja 4874 omavalitsuse kirjet, 29 145 ühikut) on ostetud ja ehitatud. Vestlus selle peal veel ei töötanud ja mõõtmine näitas viit viga:

1. **Kirjete leke (v25):** kirje on üks tükk. Kinnitamata kontaktide ja teiste piirkondade kirjete ID-d, mis sisaldavad isikunimesid, jõudsid tõendisse, paketti ja mudeli konteksti. `rag-v2-structured-records` integratsioonitest kukkus.
2. **Kataloog:** pealkirjavaade maksis terve kirje hinna. Tallinnas mahtus 71 kirjest ekraanile 19; 700 omavalitsuse × olukorra paaris oli nimekiri 598 korral osaline.
3. **Allikakaardid:** kaardil olid `provenance`-massiivid ja räsid, 470–1000 tokenit allika kohta. 6000-tokenine eelarve lükkas 4.–5. dokumendi tõendi tagasi.
4. **Seemned:** teadmusrajal oli 9 kohta, aga ainult 5 seemet. Sõltuvuskaarte teadmusdokumentidel pole, nii et 4 kohta jäid alati tühjaks.
5. **Kiirus:** iga pöördumine lõi uue andmebaasikataloogi. Kontrollitud allikate vahemälu ei püsinud pöördumiste vahel; eelarve sobitamine tokeniseeris kogu auditipaketi; `verifiedBundle` otsis lõike ruutkeerukusega.

## Otsus

- **Kirje tõend on väljavõte.** Kirje tükist lähevad tõendisse ainult need lõigud, mida vaade näitab: pealkiri; kokkuvõtte vaates ka kokkuvõte ja aadress; detailis kogu sisu. ID-loendid, tühjad väärtused ja näitamata seoste sihtmärgid jäävad alati välja. Kanooniline kontroll ehitab sama väljavõtte `chunkExcerpt`-iga uuesti ja lubab seda ainult struktureeritud kirjel; võltsitud lõikude loend annab endiselt `canonical_reference_mismatch`. Indeks ja vektorid ei muutu.
- **Saledad kaardid** (`rag-v2/model-context-json-2`): kaardil on ainult deklareeritud väärtused.
- **Vestluse profiil `hybrid-estnltk-chat-v1`:** kiire sõnaotsing, vektori kaal 2, 9 seemet, 10 000 tokenit. Ühise raja piir tõuseb 32 000-le ja vastuse sisendi lagi 400 000-le.
- **Otsinguabi `rag-v2/search-assist-1`:** vastusemudel (Luna) teeb enne vastamist kaks lisakutset.
  - **Päringud:** kirjutab vestluse põhjal kuni 3 lühikest eestikeelset otsingupäringut ametlike tekstide sõnavaras. Need liidetakse küsimusega ühte embedding-päringusse ja iga variant otsib mõlemas kanalis; RRF liidab kõik loendid.
  - **Valik:** loeb 30 parimat liidetud kandidaati ja jätab alles need lõigud, mis vastuseks vaja on, kokku kuni 9. Vastus ja skeem on ranged; valida saab ainult pakutud ID-sid.

  Mõlemad kutsed on eraldi etapid (`plan`, `rerank`) samas eelarves ja auditis. Provideri viga jätab vestluse liidetud järjestusele ja märgib põhjuse.
- **Kiirus:**
  - andmebaasikataloog on üks protsessi kohta;
  - eelarve sobitamisel loetakse ainult mudeli konteksti tokeneid;
  - lõigud leitakse tabelist;
  - EstNLTK töötaja püsib `RAG_V2_ESTNLTK_IDLE_MS` aja.
- **Avatud arendusvestlus:** dünaamiliste küsimustega plaanis on katsete lagi 5000 ja päris piir on rahaline. Lukustatud küsimustega piloodil jääb 8. Plaani koostab ja lülitab sisse `scripts/rag-v2-chat-plan.mjs`.

## Mõõtmine

52 uut küsimust on kirjutatud v25 lähtetekstidest enne ühtegi otsingut ja teise agendi poolt kontrollitud:

- allikad: seadused, juhendid ja kaks ajakirjaperioodi;
- keeled: eesti, inglise ja vene;
- stiilid: fakt, mõiste, olukord ja võrdlus, lisaks 4 vastuseta küsimust.

Pool neist on arendusosa, pool kontrollosa, mida arenduse ajal ei vaadatud. Arvud on teadmusraja lõppkontekstist: kas õige lõik (ankur) on seal olemas.

| Kontrollosa (23 vastatavat) | 9 seemet | + otsinguabi |
| --- | ---: | ---: |
| Õige dokument | 20 | **23** |
| Vähemalt üks õige lõik | 17 | **22** |
| Kõik õiged lõigud | 13 | **16** |
| Tõendeid 2 vastuseta küsimusel | 9 ja 9 | **0 ja 0** |

**Arendusosa (25 vastatavat), kõik õiged lõigud:**

| Variant | Kõik õiged lõigud |
| --- | ---: |
| Vana profiil | 12 |
| 9 seemet | 16 |
| + päringud | 17 |
| + valik | 20 |
| + mõlemad | 19; kõik 25 õiget dokumenti |

Vektori kaal 1 ja 100 kandidaati kaotasid. Ainult sõnaotsingul oli tulemus 6/25: `ts_rank`-il pole IDF-i ja pealkiri kaalub igas tükis kõige rohkem. See on järgmine samm (ADR-029 BM25).

**Kataloog:** vektori järjestus 78 omavalitsuses ja 10 olukorras, 700 paari. Asjakohane kirje oli 1. kohal 357 korral, top 3-s 611 ja top 5-s 677 korral. Sõnalisel järjestusel olid samad arvud 173, 332 ja 476. Terve kirje vektor on parem kui väljapõhine (ADR-026 top 3: 81%).

**Kulu:** otsinguabi mõõtmised maksid 0,15 USD, umbes 0,003 USD pöördumise kohta. Hinnatud küsimuste vektorid maksid 0,0004 USD.

**Ajaloo laadimine (vastuvõtutest G5, 27.09.2026):** vestluse avamisel kontrollitakse iga varasema pöördumise viited uuesti. 64 pöördumisega vestluse kontroll võttis serveris soojas protsessis 20,2 s, külmas 37 s. Aeg kulus neljale asjale:

- ligi 1 MB suuruse kinnitatud plaani lugemisele ja räsimisele mitu korda pöördumise kohta;
- kogu paketi BPE-tokeniseerimisele, kuigi kontroll loeb ainult viiteid;
- 6000 dokumendi massiivi ruutkeerukusega `includes`-filtrile;
- aktiivse põlvkonna (6000 dokumendi hetktõmmis) ja 6000 kataloogirea uuesti lugemisele.

Nüüd loetakse plaan ja põlvkond mällu reaversiooni järgi. Muutumatu kataloogi kohta küsitakse andmebaasilt üks räsirida. Viitekontroll tokeneid ei loe. Tulemus sama vestlusega: soe 3,3 s (umbes 50 ms pöördumise kohta), külm 18 s. Muudetud rida (uus xmin) läheb endiselt täiskontrolli; seda katab integratsioonitest.

## Piirid

- Ankurmõõdik on range: mitmeosalise olukorraküsimuse vastus võib tugineda ka muule sobivale lõigule. Vastuse enda kvaliteeti mõõdab vestluse test.
- Otsinguabiga otsing võtab p50 ~9–11 s (kaks Luna kutset ja 4 päringut). Kiirendamine on järgmine töö.
- Leke on suletud paketis ja mudeli kontekstis. Kontakt-ID-d on aga endiselt kirje tüki indeksitekstis ja embeddingus. Täielik parandus on töötluse v26 (kirje sihtmärgid eraldi tükkidesse, ID-loendid mittesisuks), mis vajab kirjete väikest uut vektoriostu.
- Dialoogistsenaariumide integratsioonitest vajab v25 kirjeüksuste vektoreid; vana fail on väljapõhine.
