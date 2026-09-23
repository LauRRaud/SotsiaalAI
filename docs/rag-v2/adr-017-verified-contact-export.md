# ADR-017 — Kontrollitud kontaktiregistrist muutumatuks RAG-allikaks

23.09.2026. Kohalik teostus. Täiendab [ADR-016](adr-016-structured-municipal-dialogue.md) kontaktide päritolu ja ID-vastenduse osa.

## Probleem ja lahendus

Kogutud KOV-paketi kontakt võib olla teenusega seotud, kuid telefon ja e-post puuduvad. Paketi `id` / `canonical_item_id` ei pruugi kattuda avaliku `ServiceMapEntry.sourceDocId` väärtusega. Nime sarnasus ei tõenda sama inimest ega anna alust registri kanalite liitmiseks vanasse allikasse.

`prepareMunicipalContactExport()` loeb operaatori määratud vastenduse ja olemasoleva kontaktiregistri avaldamis-/värskusreegli läbinud kirje. Tulemuseks on uus JSON-allikas. Algset paketti ega kontaktiregistrit ei muudeta. Eksport ise ei avalda allikat: sellele järgneb olemasolev partii ettevalmistus, ülevaatus ja avaldamine.

Vastendus nimetab algfaili räsi, paketi kontakti ID ja registrikirje püsiva ID. Sama nimega inimese või teise valla kirje automaatset ühendamist ei ole. Vastenduse sisuline õigsus on operaatori ülevaatuse osa; tarkvara kontrollib nimetatud identiteete ja piirkonda, mitte inimese ametikohast tulenevat sobivust konkreetse teenuse kontaktiks.

## Andme- ja kontrollileping

- Registrikirje peab läbima `buildFreshServiceMapContactWhere()` reegli: lubatud päritolu, avaldatud olek, puuduv eemaldamismärge ning kehtiv kontroll konkreetsele revisjonile ja kontrolliajale. Omavalitsus peab olema aktiivne ja vastama lähtekirje piirkonnale. Vähemalt üks telefon/e-post ja ametlik HTTP(S)-allikalink on nõutud.
- Ekspordi kontakt säilitab paketi `id` ja `canonical_item_id`; teenuse algallikas olev `relatedContacts` viide lahendub samale kontaktile. Nimi, telefon, e-post, allika URL ja kontrolliaeg pärinevad täpselt registrist. Vanu rolle, osakondi, kanaleid, kontrolliaegu ega tagasisuunalisi teenuseseoseid eksporti üle ei kanta.
- `registry_binding` talletab registrikirje ID, revisjoni, kontrolliaja, kasutatavate registriväljade räsi ja algse paketi räsi/JSON-asukoha. Tuuma üldine valikuline `bindings` kannab selle väärtust ja allikakohta; SotsiaalAI välja tähendust tõlgendab ainult adapter.
- Kontrolliseose väärtust võrreldakse muutumatu JSON-allikaüksusega. See ei lähe kataloogi vastuseväljade hulka ega ole tavapärase otsingu sisuline tõend. Muudatuse normaliseerimisversioon on `source-structure-v8`; vanad kirjed jäävad loetavaks. Andmebaasiskeemi muudatust pole.
- PostgreSQL JSONB võib objektivõtmete järjekorda muuta. Objektide/loendite allikakontroll võrdleb nüüd parsitud JSON-väärtusi; stringide täpne võrdlus ja viidatav algtekst säilivad. Muudetud väärtus või vale tüüp ei läbi kontrolli.
- Eksport kontrollib registriridu uuesti enne tulemuse tagastamist. Otsing, vastuse saatmise kontroll ja varasema tõendipaketi taastamine kontrollivad hetkeseisu taas. Välja muutus ka ilma revisjoni tõstmiseta, uus revisjon, aegumine või eemaldamine muudab vana ekspordi kasutuskõlbmatuks. Uuesti kontrollitud uus revisjon vajab uut eksporti ja allikaversiooni.
- Struktureeritud kontaktide kontroll rakendub nüüd piloodi kanoonilistele viidetele ka siis, kui pakett saabus tavalisest otsingust või fikseeritud tõendipaketist, mitte KOV-kataloogist. See väldib alternatiivse päringuraja kaudu aegunud kontakti kasutamist.

## Kohalik eksport CLI-ga

`scripts/rag-v2-contact-export.mjs` nõuab eraldi nimetatud ühenduskeskkonda `RAG_CONTACT_EXPORT_DATABASE_URL` (või `--database-url-env NAME`). CLI ei laadi rakenduse `.env` faili ega vali ise tootmisandmebaasi. Ühenduse õigused võivad olla ainult lugemiseks. Väljund/logi ei sisalda ühendusstringi ega kontaktide väärtusi.

Näidisvastendus, kus kohatäitjad tuleb asendada kontrollitud väärtustega:

```json
{
  "schema_version": "sotsiaalai/contact-source-mapping-1",
  "entries": [
    {
      "path": "KOV/naidis-vald/naidis-vald.json",
      "sha256": "<algfaili 64-kohaline SHA-256>",
      "item_id": "<paketis oleva kontakti id>",
      "registry_entry_id": "<ServiceMapEntry püsiv id>"
    }
  ]
}
```

```text
node scripts/rag-v2-contact-export.mjs --mapping tmp/contact-mapping.json --input-root Andmebaasi --out tmp/contacts-new
```

Uus väljundkaust sisaldab `contacts.json`, selle räsi sisaldavat `REGISTER.json` faili ning partii CLI-ga sobivat `selection.json` faili. Olemasolevat sihtkausta ei kirjutata üle. Väljundisse võivad minna ainult vastenduses nimetatud kuni 100 kontakti. Vale piirkond, muutunud lähtefail, puuduv kontroll, dubleeritud identiteet või mitmetähenduslik paketi-ID katkestab ekspordi.

Teenused/toetused tuleb avaldada koos nende uute kontaktiversioonidega samas valitud korpuses. Kui senine kontaktiversioon on juba olemas, säilib selle dokumendi identiteet ja avaldamine asendab aktiivse versiooni tavapärase ülevaatuse kaudu. Failinimedega kõrvutamine ega ekspordikataloog üksi otsinguindeksit ei uuenda.

## Kontrollitud ulatus

29 testi läbisid `TZ=UTC` all: struktureeritud kirjete integratsioon 7, allikastruktuur 21, piloodi eelkontroll 1. Muudetud JS/MJS-failide ESLint ja `git diff --check` läbisid.

Uus läbiv katse kasutab kahte eraldatud näidisomavalitsust ja sama nimega väljamõeldud kontakte, mille registri-ID-d erinevad paketi omadest. Kontrolliti:

- päris kohaliku Prisma registri värskusreegel → ekspordifunktsioon ja CLI → partii ülevaatus/avaldamine → PostgreSQL/Qdrant indeks → piirkonna kataloog → kanooniline allikaviide;
- vale piirkonna, muutunud faili, juurkaustast väljumise, topeltvastenduse ja avaldamata kontakti keeld;
- ekspordifaili räsi, CLI valikufail ja olemasoleva väljundi säilimine;
- telefon/e-post pärinevad registrist; vana roll/telefon, teise valla kontakt ja kontrolliseose tehnilised väljad ei jõua vastuse tõendisse;
- muutunud telefon (ka sama revisjoni korral), uuesti kinnitatud uus revisjon ja ekspordi ajal eemaldatud kontakt tühistavad vana tõendi kasutamise;
- kontroll kordub ka kataloogita piloodipaketile; võltsitud allikaseos ja osaliselt kustutatud kontaktiväljad ei läbi kontrolli.

Vektorid ja olemasoleva vestluskatse mudelitransport kasutavad testadaptereid. Uus ekspordiraja katse ei tee vastusemudeli kutset. Päris PostgreSQL, Qdrant, eraldatud rakenduse andmebaas ja olemasoleva keelekatse EstNLTK töötasid kohalikult. Tootmiskasutajate andmeid ei loetud. Tasulisi kutseid 0; deploy, päris kontaktide vastendus/eksport ja mudeli sisuline kvaliteet `not_run` / `NOT_PROVEN`.

## Alles jääv piir

Ekspordirada on kasutatav, kuid päris 2–3 valla kontaktide vastendust ja ajakohasuse ülevaatust selles plokis ei tehtud. Aegunud registrikontakti see töö ise ei kinnita. Teenuse tegelik kehtivus ja inimesele sobivus ei tulene kontakti värskusest. Täielik vestluse sisuline seis ning artikli/KOV/perioodi päringuvalik on järgmised arendusosad; vana serveripiloodi kasutusse võtmine ei ole selle ploki eesmärk. Aktiivne tööjärjekord jääb SotsiaalAI.md-sse.
