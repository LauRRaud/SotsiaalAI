# ADR-186: paketi seadusesäte toob kaasa sama seaduse mõiste definitsiooni

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 küsimusele „Soovitan järgmisena teha A17 jaoks raja, mis toob sätte kõrvale sama seaduse mõiste definitsiooni … Kas teen selle?“: „jah“.

## Probleem

A17 (spetsialist): „… mis tähtajaga pean otsuse tegema?“

- Pärast [ADR-184](adr-184-carer-benefit-person-and-deadline-terms.md) jõudis SÜS § 25 lg 1 („Hüvitise andja otsustab hüvitise andmise kümne tööpäeva jooksul …“) paketti F6b-s ja F7-s.
- Mõlemas jooksus ütles vastus, et tähtaeg „puudutab hüvitise andmist, mitte“ sotsiaalteenust. See on õiguslikult vale:
  - SÜS § 12: hüvitis on rahaline või mitterahaline;
  - § 14: mitterahaline hüvitis on muu hulgas „isikule osutatav teenus“.
- Neid lõike paketis ei olnud. Enne paranduse algust jättis vastus tähtaja lahtiseks, nüüd ütles vale asja ([hindamise lisakontroll](../audits/vastuste-oigsus-2026-10-21-75-kusimust.md)).

Sama muster on igal seadusel, mis kasutab oma mõisteid: SHS-i teenuste definitsioonid, LasteKS-i „abivajav laps“, HMS-i „haldusakt“.

## Otsus

### Definitsioonid seaduse enda tekstist (`lib/rag-v2/search/definitions.js`)

Mudelit ega arvamist ei kasutata. Definitsioon on seaduse lause, mis ütleb, mis tema mõiste on. Lugeja tunneb kolme kuju:

- **Sätte pealkiri nimetab mõiste** ja sätte lause ütleb „<mõiste> on …“. Näiteks „§ 14. Mitterahaline hüvitis“ ja „Mitterahaline hüvitis on …“, või „§ 12. Hüvitiste liigid“ ja „Hüvitis on …“.
- **„<mõiste> käesoleva seaduse tähenduses on …“** ükskõik millises sättes.
- **Mõistete säte** („Mõisted“, „Terminid“) ja selle punktid kujul „1) <mõiste> – …“.

Mõisteks ei loeta:

- reeglit („… on kohustatud“, „… on õigus“);
- määrsõnalist väljendit („Isikul“, „… aluseks“, „menetluses“);
- asesõna, loetelu või eesmärki („… eesmärk on“).

### Sõnade võrdlus

- Snowballi eesti tüvestaja jätab käändelõpu sageli alles („hüvitis“ → „hüviti“, „hüvitise“ → „hüvitise“).
- Seepärast on sõna mõiste sõna, kui ta on sama tüvi või tüvi pluss kuni 5-täheline lõpp; tüve pikkus vähemalt 4.

### Rada (`lib/rag-v2/search/retrieval.js`)

- Paketi kolm esimest seadusesätet (riiklikud ja omavalitsuse aktid).
- Kandidaadid tulevad kahes astmes:
  - sätte enda kasutatud mõistete definitsioonid;
  - mõisted, mida need definitsioonid omakorda kasutavad. Näiteks SÜS § 25 → § 12 → §-d 13 ja 14.
- Välja jäävad sätte enda paragrahv ja paragrahvid, mis on samast seadusest juba paketis.
- Definitsioon tuleb kaasa ainult siis, kui ta on küsimusele piisavalt lähedal: salvestatud vektorite koosinus vähemalt 0,5 (`DEFINITIONS.nearness`), sama mõõt mis [ADR-149](adr-149-a-provision-comes-with-the-passage-that-says-the-same.md) ja [ADR-182](adr-182-a-provision-brings-the-text-that-explains-it.md).
  - Põhjus: seadus defineerib palju üldmõisteid, millest enamik küsimusi ei sõltu.
- Lisandub kuni 2 definitsiooni, lähim enne, kumbki oma sätte järel.
- Rada töötab enne selgitavaid lõike (ADR-182), lõppkohtadel, mis jäävad vabaks, ja laienduste tokenieelarves.
- Jälg ja vaade:
  - `measurements.definitions`: sätted, vabad kohad, kandidaadid, lähedased, lisandused, iga kandidaadi skoor ja aste;
  - põhjus „sama seaduse mõiste definitsioon“;
  - lisandused „Mõistete definitsioonid“.

## Kontroll

**Kordus ilma mudelikutseteta** (värava salvestatud vektorid, valiku konks ei vali midagi; 45 küsimust: `hard-conditions-1…3`, `abbreviation-municipal-1`, `decision-challenge-1`; väljalase ja overlay).

- 45/45 läbisid, vigu polnud. Selgitavate lõikude lisandused olid samad.
- **Definitsioon lisandus 3 küsimusele:**
  - SHS § 94 „Toetatud elamise teenus“ (0,532) toetatud elamise küsimusel;
  - SHS § 139³ „Pensionäritoetuse maksmise määr“ (0,508 ja 0,608) kahel pensionäri küsimusel.
- **Lävest allapoole jäid näiteks:**
  - „laps“ (SHS § 4) 0,30–0,35;
  - „Koduteenus“ 0,36–0,42;
  - „Töötu“ 0,29.
- Raja aeg oli 50–104 ms.

**Päris pöörded:** pärast deploy'd A17 vestlus (A11, A12, A17) kaks korda ja samad 16 pööret kui F3–F7.

## Esimene väljalase ja täpsustus (sama päev)

**F8** (väljalase `853dbec0`, spetsialisti vestlus A11, A12, A17 kaks korda). Rada töötas mõlemas A17-s: § 25 oli paketis.

| Lõik | A17a | A17b |
|---|---|---|
| SÜS § 12 „Hüvitis“ (1. aste) | 0,544 | 0,526 |
| SÜS § 10 „Sotsiaalkaitse“ (2. aste) | 0,552 | 0,529 |
| SÜS § 13 „Rahaline hüvitis“ | 0,514 | 0,499 |
| SÜS § 14 „Mitterahaline hüvitis“ | 0,513 | 0,503 |

- Lisandusteks said § 10 ja § 12, § 14 jäi kahe lisanduse piiri taha.
- A17b vastus nimetas nüüd SÜS § 25 lg 1 kümmet tööpäeva, kuid lisas: „kümne tööpäeva tähtaeg on antud hüvitise otsustamiseks, mitte üldise sotsiaalteenuse otsuse tähtajana“. Lõpus küsis, kas mõeldakse koduteenuse või „hüvitise ehk toetuse“ otsust.

**Täpsustus:**

- **Rada.** Teine aste on mõiste kitsamad liigid: pikemad mõisted, mille sõnad hoiavad mõiste sõnu ja mida tema definitsioon kasutab (`narrowerTerm`; § 12 „hüvitis“ → § 13 ja § 14). Muud mõisted, mida definitsioon kasutab („sotsiaalkaitse“), ei tule.
  - Lävi kehtib mõistele endale. Liigid tulevad temaga kaasa, nende oma lähedusest sõltumata.
  - Lisandusi on kuni 3.
- **Vastuse juhis** `m4-grounded-answer-20` (vestluse juhis `m4-grounded-dialogue-55`). LEGAL PROVISIONS ütleb nüüd: kui siin antud sama seaduse lõik defineerib mõiste, mida teine lõik kasutab, loetakse mõistet definitsiooni järgi. Reegel kehtib kõigele, mida definitsioon mõiste alla loeb, ka siis, kui kasutaja nimetab seda teisiti.
