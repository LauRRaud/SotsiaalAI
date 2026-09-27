# ADR-034 — Riigi Teataja XML-i puhastus (korpus v27)

27.09.2026. Teostus Claude Opus 5.5. Järgib vastuvõtuaruande parandust 5 ja [ADR-032](adr-032-national-law-reserve-and-plan-restart.md) piiri „kehtetud sätted võivad reservi sattuda“.

## Probleem

Riigi Teataja XML-i adapter (`xmlRecords`, `lib/rag-v2/text-source.js`) võttis teksti kogu elemendi tekstisisust. Kohalikus hoidlas oli 61 XML-akti ja 3850 tükki:

| Müra | Tükke |
|---|---:|
| Muutmismärge (`muutmismarge`) numbrijadana: `RT IV 2025-04-03 17 403042025017 2025-04-06` | 1625 (42%) |
| CDATA-s toores `<sup>` (`§ 130<sup>2</sup>`, `7<sup>1</sup>. jagu`); pealkirjana ka otsinguteksti eesliites | 615 |
| Kehtetu säte (`Kehtetu -` + märge) | 464, neist 70 ainult see |

- Muutmismärge on muutva akti viide ja jõustumise kuupäev: päritolu, mitte reegel. Otsingus olid need numbrid sõnalise kanali müra ja mudeli kontekstis mõttetu tekst.
- `<sup>` jõudis vastusesse („§ 15<sup>1</sup>“).
- Täiesti kehtetu paragrahv (pealkiri + „Kehtetu -“) oli eraldi tükk, mille reserv võis valijale tuua. B9 silumisel oli SHS-i „5. peatükk Vaidemenetlus Kehtetu -“ reservi järjestuses 12. kohal.

## Otsus

XML-i adapter (töötlussilt `source-structure-v26`, PR #202):

- **Ülaindeks:** `<sup>1</sup>` → `¹` (`§ 15¹`, `7¹. jagu`), nagu akti tsiteeritakse. Muu CDATA märgistus (`p`, `b`, `a`) muutub tavatekstiks.
- **Muutmismärge** jääb tekstist välja.
- **Kehtetu lõige või punkt** jääb numbriga alles: `(2)` ja `Kehtetu.`, et numeratsioon oleks loetav.
- **Täiesti kehtetu paragrahv** (kõik peale numbri ja pealkirja on kehtetuks tunnistamise märge) kirjet ei tee. Struktuuritasandi märge (peatükk, jagu) samuti mitte.
- Allikakoht jääb täpseks: tükk on elemendi tekstist tuletatud (`decoded_source_text`), asukoht on elemendi tee.

**Uuendus ainult õigusaktidele.** Otsing ega indeks töötlussilte ei kontrolli; iga versioon kannab oma silte. Muutus mõjutab ainult XML-i väljundit, seega sisestati uuesti ainult 61 XML-akti (partii `tmp/rag-v2-corpus-batches-v27/oigusaktid`: 59 v25-st + 2 v26-st). Ülejäänud 5937 dokumendi v25 versioonid kirjeldavad nende väljundit endiselt täpselt. v26 lisandus tegi sama.

## Tulemus

- **Sisestus** (kohalik, `source-structure-v26`): 61/61 valmis, hoiatusi ja blokeeringuid 0. Tükke 3850 → 3479.
  - Riigilõivuseadus: 714 → 452;
  - Sotsiaalhoolekande seadus: 295 → 251;
  - Haldusmenetluse seadus: 113 → 112.
  - Ühegi tüki tekstis pole `<sup>`-i ega muutmismärget.
- **Hoidla:** põlvkond `generation_4417ef…`. Serverisse saadeti ainult muutunud osa (61 versiooni, `active.json`, `publications/`; 197 MB). Varukoopiad: kohalikult `tmp/rag-v2-corpus-store-v25-backup-20260927b`, serveris `tmp/store-backup-v26`.
- **Kõik 106 registreeritud XML-i** annavad uue koodiga teksti ilma `<sup>`-i, siltide ja muutmismärgeteta. Kaks akti (sh Lääneranna kord) on täiesti kehtetud (tühi `<sisu/>`) ja ebaõnnestusid ka varem; korpuses neid pole.
- **Vektorid:** plaan `8507b21b…`: 29 182 sisendit, taaskasutatud 27 823, uusi 1359 (577 001 tokenit), hind 0,13 USD / 1M (kontrollitud 27.09), **0,075 USD**, kinnituse lagi 0,10 USD.

- **Indeks v27:** `search_generation_23e445…`, 5998 dokumenti, 29 220 ühikut (v26: 29 591), vahemälust 27 861. Aktiivne 27.09.2026 kell 14:14 EEST (import ja kontroll ~45 min). Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20260927o.json` (id …-1114), värskus `current`. Käivitusskript `run-v27.sh` serveri töökaustas.

## Mõõtmine

Hinnastaadium `eval-reserve`, riikliku õiguse reserv sees ([ADR-032](adr-032-national-law-reserve-and-plan-restart.md)).

**12 vastuvõtuküsimust** (`law-reserve-v27.json`, 0,026 USD): riiklik seadus tõendis 12/12, B9-l SÜS ja HMS.

**52 küsimust** (`assist-reserve-v27.json`, `assist-reserve-v27b.json`, 0,114 USD jooks):

| 48 vastatavat, kaks jooksu | v26 reserviga | v27 reserviga |
|---|---:|---:|
| Kõik õiged lõigud | 38, 35 | 33, 34 |
| Vähemalt üks õige lõik | 45, 45 | 44, 44 |
| Õige dokument | 47, 46 | 46, 47 |
| Tõendeid vastuseta küsimusel | 2, 0 | 2, 0 |

- Järjekindel erinevus on ainult `laws-03` (Lastekaitseseadus § 27 ja § 28, 2/2 → 0/2). Nende tükkide tekst ja embedding-sisend on v26-s ja v27-s samad; muutus ainult järjekorranumber, sest eespool olevad kehtetud tükid kadusid. Valija valis sama hulga seest teisiti.
- Kõik 21 muudetud aktide ankrut on uutes tükkides sõna-sõnalt alles.
- Muud erinevused on ühe jooksu kõikumised (`journal-*`).
- Järeldus: ankrumõõdikus paranemist pole; kahe jooksu keskmine on 3 võrra madalam, mis jääb müra piiresse. Puhastuse väärtus on teksti kvaliteet: mudeli kontekstis pole numbrimüra ega `<sup>`-i ning paragrahvid on tsiteeritaval kujul.

**Elav kontroll** (plaan `o`, 27.09 14:23 EEST, pööre `0f581b28`): B9 vastas 14,1 s-ga (otsing 4,0 s), allikad Sotsiaalseadustiku üldosa seadus, Haldusmenetluse seadus ja artikkel. Vaie haldusorganile, 30-päevane lahendamise tähtaeg, halduskohus. Vaide esitamise tähtaega valitud lõikudes polnud ja vastus ütles seda.

**Kulu:** vektorid 0,075 USD, mõõtmised 0,254 USD.

## Piirid

- Kehtetu lõike „Kehtetu.“ rida jääb teksti. See hoiab numeratsiooni, aga lisab ühe sõna.
- `veaparandus` ja `normtehnmarkus` elemente (vastavalt 2 ja 2) ei käsitleta eraldi.
- SHS-i järgmine redaktsioon (enne 30.11.2026) tuleb sisse juba uue töötlusega.
