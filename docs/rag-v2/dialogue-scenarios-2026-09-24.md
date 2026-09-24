# Vestluskäigu stsenaariumid 1 (24.09.2026)

**Küsimus:** kas mudel saab igas pöördes selle, mida vajab? Kogu teekond on olukorrakirjeldus → vajalik täpsustus → sobiv abi → konkreetne järgmine samm, sh parandused ja teemavahetus. See on vastuste pärismõõtmise eeltingimus. Vastuse kvaliteeti see ei mõõda.

## Ülesehitus

- Stsenaariumid: [`tests/evaluation/dialogue/scenarios-1.json`](../../tests/evaluation/dialogue/scenarios-1.json). Kuus vestlust ja 17 pööret; kirja pandud enne käivitamist.
- Käivitus: [`tests/rag-v2-dialogue-scenarios.integration.test.mjs`](../../tests/rag-v2-dialogue-scenarios.integration.test.mjs).
- Rada: päris `PilotService` ühisel rajal (ADR-026 kataloog, vestluse seis, parandused, kriisilipp). Andmed on päris KOV-paketid (Kose, Harku, Tallinn; 219 kirjet), mis läbisid päris sisse-, üle- ja indekseerimise.
- Vektorid: päris teenusevektorid (ostetud ADR-026 mõõtmiseks) ja päris EstNLTK.
- Asendatud on ainult vastusmudel. Asendusmudel annab stsenaariumi seisu ja viitab nimetatud teenusele ainult siis, kui kontekst annab selle koos kokkuvõttega.
- Lähendus: järgpöörde päringutekst on ühendatud pöörded, millel pole ostetud vektorit. Seal kasutatakse vestluse esimese lause vektorit; aruanne märgib selle.

## Tulemus: 6/6 stsenaariumi, kõik ootused täidetud

| Vestlus | Mida mudel sai |
| --- | --- |
| Raha otsas → „Elan Harku vallas” → „Kellele ma saan helistada?” | Vallata täpsustus; Harku 41/41 teenust ja kokkuvõtted; järgmises pöördes toimetulekutoetuse detailid ja kaks seotud kontaktisikut. |
| Emale abi → „Ema elab Kose vallas” → parandus „tegelikult Harkus” | Kose koduteenus kokkuvõttega; parandus vahetas kataloogi Harkule. |
| Isa → „Isa elab Tallinnas” → uus isik „Mul on suured võlad” → Kose | Tallinna koduteenus või üldhooldus; uus isik tühjendas seisu; Kose võlanõustamisteenus. |
| Toimetulek → „Vahel tunnen, et tahan end tappa.” → Tallinn | Kriisipööre sai kriisilipu; seejärel Tallinna toimetulekuteenus. |
| Arsti juurde sõit → Kose | Kose transporditeenus kokkuvõttega. |
| Tulekahju → „Olen Harkus” | Harku erakorraline toetus kokkuvõttega. |

## Leiud

1. **Kontaktikanalid ei jõua tootmises mudelini.**
   - KOV-pakettide kontaktides pole telefoni ega e-posti: 0 kontakti 68-st kuues vallas, Tallinnal pole kontakte üldse.
   - Serveri kontrollitud teenuskaardi registris on kanalid olemas (vaid loendus, sisu ei loetud): Harku 16/16, Kose 8/8, Pärnu 45/45, Jõhvi 15/15, Anija 12/15.
   - Ükski 68 paketikontaktist ei seostu registrireaga allika-ID järgi. Tootmise kontaktiadapter peidaks seega kõik paketikontaktid kontrollimatutena ja „Kellele helistan?” ei saaks isikut ega kanalit.
   - Selles jooksus lubas asendusadapter kõik kontaktid; see on märgitud.
   - Sild on koodis olemas: kontrollitud kontaktieksport selgesõnalise vastavusega (`sotsiaalai/contact-source-mapping-1`). Vastavus tuleb koostada ja kinnitada.
2. **Ülevaatus jättis ühe kirje välja.** Tallinna „Õigusnõustamine vähekindlustatud Tallinna elanikele” sisaldab vastuolulist `source_url` kandidaati; ülevaataja ei saa seda kaasata.
3. **Vallata olukorralause jõuab õigesti täpsustuseni:** kataloogi ulatus on tühi ja mudeli juhis palub valla küsida.

## Piirid

- Asendusmudel järgib stsenaariumi seisu. Päris mudeli võime seisu, täpsustust ja järgmist sammu õigesti sõnastada on mõõtmata; see on järgmine, tasuline samm piloodiplaani alusel.
- Järgpööretes on päringuvektor lähendatud.
- Serveri registrit loendati ainult; isikuandmeid ei loetud.
- Käivitamiseks on vaja kohalikke teenuseid, M4 andmebaasi, EstNLTK-d ja `tmp/rag-v2-scenarios` vektoreid (85 MB). Neid pole mõõtmispaketis.
