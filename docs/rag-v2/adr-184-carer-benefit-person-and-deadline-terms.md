# ADR-184: hooldaja toetus on hooldatava asi ja tähtaeg otsitakse SÜS-i sõnadega

Kuupäev: 23.10.2026. Teostus Claude Opus 5.5. Omanik 23.10.2026 küsimusele „Kas võtan järgmisena ette need 9 osaliselt õiget vastust?“: „nii“, „jah“. Seis: **otsinguabi `rag-v2/search-assist-25`.**

## Probleem

Kaks 21.10 osalist vastust ([vastuste õigsus](../audits/vastuste-oigsus-2026-10-21-75-kusimust.md)) kordusid fokusjooksus F3 (23.10, väljalase `65ab649d`). Mõlema põhjus oli otsinguplaanis.

- **A04** „Kas mina saaksin hooldajatoetust, kui ma hakkan teda rohkem aitama, aga töötan täiskohaga?“ Vestluses elab ema Tartus ja kasutaja Tallinnas. Plaan pani isikuks `user`, seega otsiti Tallinna kirjeid (`records.scope.region` `tallinn`, F3 ja 21.10 sama). Tartu kirjes „Hooldajatoetus täisealise isiku hooldamise eest“ on otsustav tingimus: „Hooldaja ja hooldatav peavad olema Tartu linna elanikud ning tegelikult samal aadressil elama“. See kirje vastuseni ei jõudnud. Vastus: „Ma ei leidnud siinsest teabest Tartu hooldajatoetuse tingimusi.“ Hooldajatoetuse üle otsustab hooldatava elukoha omavalitsus.
- **A17** „… mis tähtajaga pean otsuse tegema?“ (spetsialist). Tähtaeg on SÜS § 25 lg 1-s: „Hüvitise andja otsustab hüvitise andmise kümne tööpäeva jooksul …“. SÜS nimetab iga toetust ja teenust hüvitiseks. 21.10 oli § 25 reservkohal 32 ja valik ei võtnud seda. F3-s ei olnud ta kandidaatide seas. Plaani päring oli „Sotsiaalhoolekande otsuse tegemise tähtaeg abivajaduse hindamine“. Vastus leidis õiguskantsleri käsitlusest „üldjuhul kuni kümme tööpäeva“, kuid ütles, et ei saa seda siduvaks tähtajaks kinnitada.

## Otsus

Plaanil on kaks uut üldist rida. Kumbki ei nimeta toetust, teenust ega omavalitsust.

- **Isiku reegli järel** (`PLAN_CARER_INSTRUCTIONS`): toetus või teenus, mida kasutaja saaks kellegi hooldamise eest (hooldajatoetus, hooldajaks määramine, asendushooldus), puudutab hooldatavat. Isik on tema, sest otsustab tema elukoha omavalitsus. Kodu- ja abielupartneri ning teiste isikute reeglid ([ADR-168](adr-168-own-municipality-never-for-another.md)) jäävad samaks; muutub ainult see, kelle olukorda küsimus puudutab.
- **Vaidlustamise reegli järel** (`PLAN_DEADLINE_INSTRUCTIONS`): kui küsitakse toetuse või teenuse menetluse tähtaega (millal otsustatakse, millal taotleda või muutusest teatada, millal makstakse), tuleb üks päring sotsiaalseadustiku üldosa seaduse sõnadega (hüvitis, hüvitise andja). See päring tuleb teenuse enda sõnadega päringute kõrvale.

Riiklike seaduste reservkohtade päringupõhine koht ([ADR-079](adr-079-plan-list-duty-query-and-reserved-places.md)) toob iga päringu lähima seaduselõigu valikumudelini. Tähtaja päring annab SÜS § 25-le seega oma koha.

## Mis muutus

- `lib/rag-v2/pilot/search-assist.js`: `SEARCH_ASSIST_VERSION` `rag-v2/search-assist-25`, kaks uut konstanti plaani juhises; valiku juhis on sama.
- Plaan on vestlusplaani osa, deploy uuendab selle ise.

## Kontroll

Fokusjooksud F4 (väljalase `8af74266`) ja F5 (`e092de45`) 23.10: samad 16 pööret kui F3-s ([ADR-185](adr-185-municipal-regulations-reserve.md) jaotis „Kontroll“).

- **A04, mõlemas jooksus: isik `ema`, kirjed `tartu_linn`.** F3-s oli `user` ja `tallinn`.
  - Vastus ütleb Tartu tingimuse ja et see praegu ei ole täidetud: „Kui elad Tallinnas ja ema Tartus, ei ole see tingimus täidetud.“
  - Täiskohaga töö kohta ütleb vastus, et tingimused seda ei välista.
- **A17: SÜS § 25 ei jõudnud kummaski jooksus paketti.** Plaan kirjutas mõlemas tähtaja päringu.
  - **F4:** päring „SÜS hüvitise andja otsuse tegemise tähtaeg“ oli lühendiga ja kandidaatide seas polnud ühtegi SÜS-i lõiku.
    - Vastus andis siiski tähtaja: „tuleb teha hindamisel põhinev otsus 10 tööpäeva jooksul taotluse esitamisest“ ja hilinemisest teavitamise kohustuse.
    - Allikad olid SKA üldhooldusteenuse juhend ([ADR-182](adr-182-a-provision-brings-the-text-that-explains-it.md) selgitav lõik) ja HMS § 41.
  - **F5:** päring „Sotsiaalseadustiku üldosa seadus hüvitise andja otsuse tegemise tähtaeg“ oli täisnimega ja kandidaatide seas oli kuus SÜS-i lõiku (kohad 17–28). Valik ei võtnud ühtegi. Vastus ütles, et Tartu kord üldist tähtaega ei anna.

## Lisa: valik loeb hüvitist samamoodi ja päring nimetab seaduse täisnimega (`rag-v2/search-assist-26`, `-27`)

- `-27`: tähtaja päring nimetab seaduse täisnimega, mitte lühendiga (F4 vs F5 eespool).

- Valiku juhis saab sama rea mis plaan (`RERANK_DEADLINE_INSTRUCTIONS`, summade rea järel). SÜS nimetab iga sotsiaaltoetust ja -teenust hüvitiseks ning selle andjat hüvitise andjaks.
- Tema lõigud hüvitise kohta (taotlemine, otsuse tähtaeg, otsus, maksmine, asjaolude muutus) käivad ka küsitud toetuse või teenuse kohta.
- Kui küsitakse sellist sammu, jääb lõik, mis seda ütleb, alles.
- Kontroll: spetsialisti vestlus A11, A12, A17 kaks korda (F6), väljalaskel `-27`.
- **F6** (väljalase `58495e52`): plaan kirjutas mõlemas vestluses täisnimega päringu.
  - A17a: ükski SÜS-i lõik ei jõudnud kandidaatide hulka. Päringule oli lisatud „abivajaduse hindamine“.
  - A17b: valik võttis SÜS § 25 esimeseks lõiguks (S1), kuid vastus ütles: „Kümne tööpäeva tähtaeg on olemas hüvitise andmise otsusele, kuid see säte ei ütle sotsiaalteenuse otsuse tähtaega.“ SÜS § 14 (mitterahaline hüvitis on muu hulgas „isikule osutatav teenus“) ei olnud paketis.
- **Lahtine:** sätte kõrvale tuleb tuua sama seaduse mõiste definitsioon. See on otsingu raja töö (ADR-149 ja ADR-182 kõrval), mitte juhise rida.
