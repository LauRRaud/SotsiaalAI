# ADR-058 — Omavalitsuste teised kehtivad sotsiaalaktid

30.09.2026. Teostus Claude Opus 5.5. Omanik 30.09: „jätka arendust“. Järgib [ADR-038](adr-038-law-validity-check.md)-t (kehtivuskontroll ja omavalitsuste katvus, korpus v42).

## Probleem

- **Indeksis oli iga omavalitsuse kohta üks akt.** KOV-i RT register (`Andmebaasi/register/kov_oigusaktid.json`) nimetab ühe korra, tavaliselt sotsiaalhoolekandelise abi andmise korra.
- **Paljudel omavalitsustel on ka teisi kehtivaid sotsiaalakte:**
  - eraldi toetuste kord („Sotsiaaltoetuste määramise ja maksmise kord“);
  - määrad;
  - toimetulekutoetuse eluasemekulude piirmäärad;
  - üldhoolduse hoolduskulude piirmäär;
  - teenuste hinnad ja korrad;
  - hooldajatoetuse kord.
- **Neid küsimusi ei leidnud vestlus RT-st.** Näiteks: kui suur on sünnitoetus, milliseid eluasemekulusid toimetulekutoetuse juures arvestatakse, kui palju hooldekodu maksab. Vastus tuli ainult KOV-i paketist, kui seal üldse oli.
- **Kehtivuskontroll ei otsinud uusi akte.** Ta vaatab ainult indeksis olevaid gruppe (ADR-038 „Piirid“).

## Otsus

### Valik (`lib/rag-v2/municipal-acts.js`)

- **Allikas:** iga omavalitsuse volikogu ja valitsuse aktide loend RT otsingu-API-st. Väljaandja nimi tuleb indekseeritud aktidelt.
- **Kategooria tuleb pealkirjast** (`classifyMunicipalAct`):
  - `benefits_procedure`, `rates`, `housing_costs`, `care_home_costs`, `service_prices`, `service_procedure`, `carer`, `welfare_procedure`;
  - pealkiri peab sisaldama sotsiaalvaldkonna sõna;
  - teiste valdkondade sõnad jätavad akti välja (haridus, sport, raie, korterelamud, vesi, spetsialistide eluase, ametnike pädevus jne);
  - „määr“ on määr ainult omaette sõnana, mitte „määramise“ sees;
  - „puude“ (puud) ei ole „puudega“.
- **Kehtivus** (`selectMunicipalActs`):
  - ainult konsolideeritud tekst (`terviktekst`, `algtekst-terviktekst`);
  - kehtib täna või algab horisondi jooksul;
  - ei ole kehtetuks tunnistamise märge (`kehtivKehtetus`);
  - ei ole redaktsioon, mis asendati enne jõustumist (`mitteJoustunud`: Lääne-Harju 411042026010/011, Türi 407042026039);
  - pealkirjas ei ole möödunud aasta arvu („… 2019. aastal“).
- **RT jätab asendatud akti sageli lõputa**, kui seda ametlikult kehtetuks ei tunnistatud. Seepärast:
  - määradest, eluasemekulude piirmääradest ja hoolduskulude piirmäärast jääb omavalitsuse kohta alles uusim täna kehtiv akt ja kõik hilisemad;
  - teistest kategooriatest sama reegel sama pealkirja kohta.
- **Grupi tasemel:** akt, mille konsolideeritud teksti grupp on juba indeksis, jääb välja (`group_indexed`). Tema redaktsioonid on kehtivuskontrolli asi.
- **Tekstita märge jääb välja** (`no_text`). Allalaaditud teksti loetakse nii, nagu ingest seda loeb (`source_text_empty`).

### Skript ja igakuine töö

- `scripts/rag-v2-municipal-acts.mjs scan --manifest docs/rag-v2/legal-acts-in-index.json --out DIR [--download DIR]`:
  - kirjutab `municipal-acts-<päev>.json` ja `.md`;
  - väljumiskood 0: midagi uut pole; 10: on lisatavaid akte; 20: päring ebaõnnestus.
- **Igakuine kehtivuskontrolli töö käivitab skaneerimise ilma allalaadimiseta.** Uued aktid lähevad samasse teavitusse; skaneerimise tõrge teeb töö punaseks.

### Korpus v43 (30.09.2026)

- Skaneerimine: 78 omavalitsust, 454 valitud akti, neist 88 juba indeksis. **366 uut akti:**

| Kategooria | Akte |
|---|---:|
| teenuste korrad (`service_procedure`) | 129 |
| toetuste korrad (`benefits_procedure`) | 70 |
| eluasemekulude piirmäärad (`housing_costs`) | 68 |
| hoolduskulude piirmäär (`care_home_costs`) | 36 |
| määrad (`rates`) | 23 |
| hooldajatoetus (`carer`) | 18 |
| sotsiaalhoolekande korrad (`welfare_procedure`) | 12 |
| teenuste hinnad (`service_prices`) | 10 |

- **Kontrollid enne ingest'i:**
  - uute ja indekseeritud aktide vahel pole kehtivuse kattumist sama grupi ega sama omavalitsuse sama pealkirja piires;
  - igal aktil on kehtivuse algus;
  - ingest: 366 kirjet, 0 hoiatust, igaühel omavalitsus (väljaandja nimest), 78 omavalitsust.
- **Lisad:** 46 aktil on lisa-PDF. Määrade, piirmäärade ja hindade aktide lisad (Jõelähtme, Loksa, Viru-Nigula) on taotlusvormid. Määrad on akti tekstis, seega selles versioonis lisasid ei tuletatud.
- **Korpus v43 tootmises 30.09.2026 kella 14:55-st:**
  - 366 dokumenti, 3686 lõiku;
  - embedding 3518 sisendit, 1,03 M tokenit, 0,133 USD;
  - indeks `3f91e02d`: 6446 dokumenti, 40 226 lõiku, indeksitöö 2 min 40 s, v42 tõend muutumatu;
  - plaan `m4-corpus-chat-20260930e.json`, seaded samad.
- **Päris vestlus** (üks küsimus): „Elan Tartu linnas 30-ruutmeetrises üürikorteris ja taotlen toimetulekutoetust. Kui suurt üüri mulle arvestatakse?“ Vastus: 18,01–33 m² eluruumi üür kuni 15 eurot ruutmeetri kohta kuus, 30 m² puhul kuni 450 eurot. See on Tartu eluasemekulude piirmäärade akti § 1 punkt 2, mida varem indeksis polnud.

## Täiendus (ADR-059)

- v43 skaneerimine luges väljaandja kogu loendi 500 akti kaupa lehtedena. RT järjestab iga päringu isemoodi, seega jäi neli akti vahele.
- Nüüd otsitakse väljaandja akte pealkirja märksõnadega. Iga otsing mahub ühele lehele ja loetakse, kuni erinevate aktide arv jõuab koguarvuni; muidu on tulemuseks tõrge.
- Leitud aktid lisati korpuse versiooniga v45.

## Codexi R2 (30.09.2026): välistused ja määrade teemad

- **Välistus sobis alamsõnale.** Nii jäid välja „Rae valla eelarvest … toetuste maksmise piirmäärad 2026. aastal“ („eelarve“) ja „… kord Mustvee vallas“ („vee“).
- **Nüüd sobib välistuse tüvi ainult sõna algusega.**
  - „eelarve“ ja „lisaeelarve“ on välistused, „eelarvestrateegia“ samuti. „eelarvest“ (rahastusallikas) ei ole.
  - Liitsõnad, mis olid välistused ainult alamsõnana, said oma tüve: „eratee“, „talihooldus“, „teehooldus“, „talvise“, „eralasteaia“, „tunnust“.
  - Võrdlus varasema täisloendiga: 131 pealkirja sai kategooria, üks (töötajate tunnustamise kord) kaotas selle. Uued vasted on valla eelarvest makstavad toetused, Mustvee aktid, sotsiaalkorterid ja sotsiaalõppe teenus.
- **Määrad on üks akt toetuse kohta.** Kui pealkiri nimetab konkreetse toetuse (hooldaja-, lapsehoiu-, sünni-, matuse-, koduse lapse, eaka-, juubeli-, ranitsa- või vaimse tervise toetus), on see oma teema. Muidu on teema „üldine“. Uusim akt valitakse teema piires, nii et Rae hooldajatoetuse määr ei tõrju enam välja üldisi piirmäärasid.
- **Asendatud aktid lahkuvad indeksist.**
  - Skaneerimine nimetab indekseeritud aktid, mille valik nüüd välja jätab (uuem sama liiki akt või möödunud aasta pealkirjas), koos asendajaga (`superseded`, exit 10). Muidu seisaksid vanad summad või reeglid uute kõrval.
  - `rag-v2-corpus-refresh.mjs package --remove <aruanne>` eemaldab need põhjusega indeksi poliitikast ja kirjutab need `ship.json`-i. Hoidlasse jäävad need ajaloo jaoks alles.
- **Skaneerimise märksõnadesse lisandus „toimetulek“ (12 sõna).** Need katavad kõik 5072 pealkirja, millele uus klassifikaator varasemas täisloendis kategooria annab.
- **Korpus v46 (30.09.2026):**
  - parandatud skaneerimine: 481 valitud akti, 18 uut, 0 asendatud indekseeritud akti, tõrkeid pole;
  - uued aktid on määrade, toetuste ja teenuste korrad (Rae, Elva, Kiili, Nõo, Peipsiääre, Tartu vald, Maardu, Mulgi jt);
  - 175 sisendit, 0,0063 USD, indeks `5a959000`, plaan `m4-corpus-chat-20260930h.json`;
  - paranduse järgi tehtud serveriskriptiga.
  - Päris vestlus: „Olen pensionär ja elan Rae vallas. Kas vald toetab prillide ostmist ja kui palju?“ Vastus: 100 eurot kord aastas, koos taotlemise tingimuste ja kontaktiga. Allikad on Codexi näide 430012026034 ja Rae toetuste kord.

## Piirid

- Kategooria tuleb pealkirjast. Akt, mille pealkiri ei nimeta teemat („Toetuse andmise kord“ ilma sotsiaalsõnata), jääb välja. Teise valdkonna sõnaga pealkiri, mis siiski puudutab sotsiaalvaldkonda, jääb samuti välja.
- „Uusim kehtiv“ reegel eeldab, et ühes kategoorias kehtib üks akt: eluasemekulude ja hoolduskulude piirmäära puhul omavalitsuse kohta, määrade puhul toetuse kohta. Kaks samaaegset üldist määrade akti jätaksid vanema välja.
- Taotlusvormid (46 aktil) on tuletamata. Need saab lisada ADR-053 vormingus, kui igale lisale on antud tema enda pealkiri.
- Registri kirjed viitavad endiselt ühele aktile omavalitsuse kohta. Uute aktide omavalitsus tuleb väljaandja nimest (`issuer_name`).
