# ADR-045 — Kontaktiekspordi sidumine sisu, mitte kontrolliaja järgi

28.09.2026. Teostus Claude Opus 5.5. Codexi soovitatud variant B ([audit §14](../audits/rag-v2-codex-review-2026-09-27.md#14-pr-ide-236240-järelkontroll-2809), [vestluste hindamise kontaktileid](../audits/rag-v2-conversation-eval-2026-09-28.md#omavalitsuse-kontaktid-kataloog-ei-anna-ühtegi-kontaktisikut)). Täiendab [ADR-017](adr-017-verified-contact-export.md).

## Probleem

- **Vestlus ei anna ühtegi omavalitsuse kontaktisikut.** 808 paketikontaktist ei läbi kontrolli ükski, sest paketi ID ja registrikirje vahel puudub seos. Paketikontaktidel pole ka telefoni ega e-posti.
- **ADR-017 ekspordi sidumine oleks aegunud nädalaga.**
  - Seos (`registry_binding`, versioon 1) võrdles registri `checkedAt`-i otse ja hoidis seda ka projektsiooni räsis.
  - Iganädalane kontaktikontroll kirjutab kinnitatud kirjete `checkedAt`-i üle. Nii tühistas iga uus kontroll muutumata kontakti ekspordi.
- **Eksport oleks loonud teise dokumendi sama aliasega.**
  - Eksport kirjutas `source_type: 'municipal_contact'`, paketikontaktidel on `official_contact`.
  - Dokumendi identiteet tuleb tenant'ist, allikaliigist ja `canonical_item_id`-st, seega oleks eksport olnud uus dokument.
  - Kaks sama aliasega kirjet peatavad omavalitsuse kataloogi (`ambiguous_record_identity`).

## Otsus

- **Seose versioon 2** (`sotsiaalai/verified-contact-binding-2`) seob registrikirje ID, revisjoni ja sisu räsi (`content_sha256`). Sisu räsi arvutatakse ID-st, revisjonist, päritolust, omavalitsusest, nimest, telefonist, e-postist, ametlikust URL-ist ning registri tüübist ja kirjeldusest, ilma kontrolliajata.
  - Kirjelduses on registri roll: „Roll: … Osakond: …“.
  - `checked_at` jääb seosesse ja kirjesse ajaloona: kontroll, mida eksport luges.
- **Roll tuleb registrist** (Codex 28.09: teenuserolli muutus peab seose lõpetama).
  - Eksport kannab registri kirjeldusest loetud rolli ja osakonda, kui kirjeldus on kujul „Roll: … Osakond: …“. Paketi vana rolli ei kanta.
  - Seose kontroll nõuab, et kirje roll ja osakond vastaksid registrile täpselt.
  - Uus roll lõpetab seose nagu uus telefoninumber, ka ilma revisjoni tõstmata.
- **Jooksev kontroll jääb samaks:** `readVerifiedMunicipalContact` ehk registri värskusreegel.
  - Kontrollitud kirje tohib olla kuni 90 päeva vana, sama revisjoni ja kontrollajaga.
  - Kirje peab olema avaldatud, ilma eemaldamismärketa, lubatud päritoluga, ametliku URL-iga ja aktiivse omavalitsuse all.
  - Otsing, vastuse saatmine ja taastamine kordavad seda nagu seni.
  - Muutumatu kontakti uus kontroll hoiab ekspordi kehtivana.
  - Iga muutus kehtetustab ekspordi: nimi, telefon, e-post, URL, revisjon, omavalitsus, päritolu või kirje ID; samuti aegumine või eemaldamine.
- **Versiooni 1 seosed jäävad loetavaks oma vana reegliga** (sama kontrolliaeg). Uus eksport kirjutab versiooni 2.
- **Eksport hoiab paketi `source_type`-i** (vaikimisi `municipal_contact`). Nii jääb dokumendi identiteet samaks ja avaldamine asendab paketikontakti versiooni, nagu ADR-017 eeldas.
- **Ekspordi ajal kordub kontroll sisu järgi.** Samal ajal toimunud uus kontroll ei ole muutus.

## Kontroll

- **`tests/rag-v2-contact-binding.test.mjs`** (uus, andmebaasita):
  - Codexi sond, kus liigub ainult kontrolliaeg: seos jääb kehtima;
  - kümme sisu, rolli või identiteedi muutust kehtetustavad seose;
  - kirje peab kandma registri rolli, mitte paketi vana rolli;
  - rolli loetakse ainult kujust „Roll: … Osakond: …“;
  - võltsitud räsi või kirje kontrolliaeg ei seo;
  - versioon 1 vajab endiselt sama kontrolliaega.
- **`tests/rag-v2-structured-records.integration.test.mjs`**, päris PostgreSQL, Qdrant, Prisma register ja EstNLTK, 9/9:
  - sama revisjoni ja sisu uus kontroll hoiab ekspordi;
  - eksport kannab registri rolli; uus roll lõpetab seose ja endine roll taastab selle;
  - muudetud telefon ilma revisjonita, uus revisjon ja ekspordi ajal eemaldatud kirje kehtetustavad nagu seni;
  - paketikontakt ja selle eksport on sama dokument (`batch_document_conflict`).
- `npm test` läbis.

## Mis jääb operaatorile

- **Vastendus vajab ülevaatust enne eksporti.** Nime järgi automaatset avaldamist see otsus ei luba. Ametlik allikas ja kontakti sobivus teenusega kontrollitakse.
- **Kandidaadid on serveris** (`rag-v2-work/eval-files/contact-candidates-2026-09-28.json`, mitte repos): 384 ühest nimevastet 60 omavalitsuses, 20 mitmest ja 404 vasteta.
- **Ülevaatetabel on serveris** (`rag-v2-work/eval-files/contact-review-2026-09-28/`, mitte repos, sest seal on nimed).
  - Iga rea kohta on seal:
    - paketikontakt (nimi, roll, osakond);
    - registrikirje (ID, olek, tüüp, roll, osakond, telefoni ja e-posti olemasolu);
    - mõlemad ametlikud lehed;
    - kontaktile viitavad teenused;
    - ettepanek ja sobivuse põhjendus;
    - tühjad veerud operaatori otsuse ja märkuse jaoks.
  - Ettepanek ei ole otsus. „Ettepanek: lisada“ on ainult siis, kui roll kattub, ametlik leht on sama või sama omavalitsuse domeenis, registris on telefon või e-post ja vähemalt üks teenus viitab kontaktile. Muu on „kontrolli“, koos põhjusega.
  - Tulemus: 139 „ettepanek: lisada“ ja 245 „kontrolli“. Kõik 384 registrikirjet on praegu kontrollitud ja ükski paketifail pole pärast indekseerimist muutunud.
  - Harku on eraldi (`review-harku_vald.csv`, `mapping-draft-harku_vald.json`): 7 ettepanekut ja 1 „kontrolli“, sest ükski teenus ei viita sellele kontaktile.
  - Ülejäänud on kuni 100-realistes vastenduse mustandites (`mapping-draft-1…4.json`).
- **Kogu rada Harku andmetega, kohalik katse 28.09.**
  - Kasutati päris Harku paketti ja 8 kontrollitud registrikirjet. Need kopeeriti kohalikku eraldatud testiandmebaasi ja kustutati pärast katset.
  - Rada:
    1. eksport: 8 kontakti, seos 2, `official_contact`, igaühel roll, telefon ja e-post;
    2. partii: 62 kirjet ilma takistusteta, paketikontaktide asemel eksporditud kontaktid;
    3. indeks eraldi katsetenant'is näidisvektoritega;
    4. Harku kataloog, kui fookuses on Toidupank.
  - Kataloog andis sotsiaalhoolekandespetsialisti koos nime, rolli, osakonna, telefoni, e-posti ja ametliku lehega. Just seda küsis vestlus „Kellele ma saan helistada?“.
  - Kontrollid:
    - iganädalase kontrolli järel oli 8/8 lubatud;
    - muudetud telefoniga või muudetud rolliga kontakt kukkus välja (7/8);
    - taastamise järel oli taas 8/8.
  - Tootmises ei muudetud midagi ja mudelikutseid ei tehtud.
- **Järjekord pärast ülevaatust:**
  1. eksport (`scripts/rag-v2-contact-export.mjs`, kuni 100 kontakti korraga);
  2. partii ülevaatus ja avaldamine;
  3. indeksi uus põlvkond;
  4. uus vestlusplaan.

## Avaldamine 28.09.2026 õhtul

Omanik andis korralduse „vaata siis üle ja pane andmebaasi“, seega tegi ülevaatuse Claude Opus 5.5 reeglite järgi. Otsus ja põhjus on iga rea juures serveris failis `rag-v2-work/eval-files/contact-review-2026-09-28/review-decided.csv`, mitte repos, sest seal on nimed.

- **Lisati, kui kõik tingimused kehtivad:**
  - registrikirje on praegu veebikontrolliga kinnitatud, st ametlik leht näitab seda inimest nende kanalitega;
  - registris on telefon või e-post;
  - paketi ja registri roll on piirkonna täpsustuse eemaldamise järel sama või üks sisaldab teist;
  - paketi leht puudub või on registriga sama domeeni all.
- **384 kandidaadist lisati 377 ja jäeti välja 7:**
  - kahel pole registris telefoni ega e-posti;
  - viiel on roll muutunud: Lääne-Harjus kaks, Pärnus üks ja Türil kaks. Nende paketi teenuseseosed võivad olla vananenud.
  - Kose üks rida lisati ülevaataja otsusega: sama roll eri kirjapildis.
- **Harku kõigepealt (v34).**
  - 8 kontakti eksporditi, avaldati lokaalses salves ja kopeeriti serverisse.
  - Indeksi põlvkond on `620eca9d` ja plaan `…-1851`; vektorid maksid 0,0003 USD.
  - Aknas andis „Mul on raha otsas ja toiduks ei jätku. Elan Harku vallas.“ sotsiaalhoolekandespetsialisti koos telefoni ja e-postiga.
- **Ülejäänud (v35).**
  - Avaldati 368 kontakti. Üks jäi välja, sest tema paketidokumenti aktiivses salves pole; avaldamine oleks loonud uue dokumendi väljaspool indeksi poliitikat.
  - Indeksi põlvkond on `7ec6f9a3` ja plaan `/etc/sotsiaalai/m4-corpus-chat-20260928d.json` (`…-1909`); vektorid maksid 0,015 USD.
  - Salve pea on `a575880c`, sama lokaalselt ja serveris.
- **Tulemus:** vestlus annab nüüd **376 kontrollitud kontakti 60 omavalitsusest**, varem mitte ühtegi. Ilma seoseta jääb 432 paketikontakti: 404 ilma kandidaadita, 20 mitmetähendusliku kandidaadiga, 7 välja jäetud ja 1 salvest puuduv.
- **Aken pärast v35:**
  - Tartu valla sotsiaaltransport: kaks kontakti, teenuse osutaja ja hind;
  - Kose sama vestluse jätkuna: kaks kontakti ja taotlemise kord;
  - Tartu valla kiire abi puhtas vestluses: varjupaigateenus, vältimatu abi ja kaks kontakti.
  - Esimene tekst tuli 13–28 s järel.
- **Tööülesanded:**
  - Ülevaatust ei saa üle kirjutada, sest `writeJson` kasutab `wx`-i.
  - Ülevaatus aegub iga avaldamisega, seega tehti partiid ükshaaval uute failinimedega.
  - Serverisse kopeeriti `.tgz`-ina `scp`-ga ja kontrollsummaga, sest torustatud `tar` üle ssh katkes korra poole peal.
- **Leid Codexile, kahe inimese ulatus.** Ühes vestluses „Elan Tartu vallas …“ → „naabrimees … elab Kose vallas“ → „Teine asi: mul pole täna öösel kusagil magada …“ jäi kataloogi ulatuseks Kose, sest ulatus järgib viimast mainimist. Vastus rääkis aga kasutaja enda Tartu vallast, seega kontakte ei tulnud. Omavalitsus tuleks siduda inimesega (dialoogi olek), mitte viimase mainimisega.

## Sidumata kontaktid, 29.09.2026

Claude Opus 5.5 vaatas läbi, miks 424 paketikontakti (404 ilma kandidaadita ja 20 mitmetähenduslikku) ei saanud ühte kinnitatud registririda. Analüüs ainult luges andmeid, midagi ei avaldatud. Reeglid on samad mis kandidaatide skriptil: sama omavalitsus, sama nimi, registririda praegu kinnitatud. Rea kaupa tabelid on serveris, sest seal on nimed: `rag-v2-work/eval-files/contact-gaps-2026-09-29.csv` ja `contact-ambiguous-2026-09-29.csv`.

| Põhjus | Kontakte | Mida see tähendab |
|---|---:|---|
| Registris sama nimega rida, mis pole viimases kontrollis kinnitatud | 186 | Rida on avaldatud, aga viimane registrikontroll pole seda kinnitanud: inimest ametlikult lehelt ei leitud või kontroll jäi tegemata. 183 rida uuendati viimati augustis. Neid on 56 omavalitsuses, nii et need on üksikisikud, mitte terved lehed. |
| Isikut selle omavalitsuse registris pole | 162 | 58 omavalitsust (Häädemeeste 10, Vinni 8, Haapsalu 8). Paketi kontakt võib olla vananenud või pole register seda rolli kogunud. |
| Omavalitsusel pole ühtki kinnitatud registririda | 51 | 13 omavalitsust: Narva-Jõesuu 15, Väike-Maarja 12, Rakvere vald 4, Põhja-Sakala 4 jt. Vaja on registri kontrolli, mitte seost. |
| Mitmetähenduslik: mitu kinnitatud rida sama nimega | 20 | **Kõik 20 on sama inimese topeltread:** telefon ja e-post on ridadel identsed, 17 juhul ka roll. |
| Sama perekonnanimi, teine eesnimi | 3 | Tõenäoliselt eri inimene. |
| Kirjapilt erineb (täpitähed, sidekriips, järjekord) | 1 | |
| Sama nimi teises omavalitsuses | 1 | |

**Ettepanek** (otsus operaatorilt või Codexilt):

- **20 topeltrida:** seo kinnitatud reaga, mille roll vastab paketi rollile. Kui neid on mitu, siis viimati kontrollitud reaga. Kanalid on samad, nii et vestluse vastus ei muutu. Register võiks topeltread ise ühendada.
- **186 kinnitamata rida:** oota 04.10 iganädalast kontrolli. Kui inimene on lehel tagasi, saab reast kandidaat. Kui ei, on paketi kontakt vananenud ja seda ei avaldata.
- **Avalda ühe partiina pärast 04.10:** 20 topeltrida ja uuesti kinnitatud read koos. Kontroll peab ka kinnitama, et 376 avaldatud kontakti on endiselt lubatud (seos 2 peab kontrolliaja muutust taluma). Nii piisab ühest uuest indeksipõlvkonnast ja käsitsi plaanist.

## Kontroll pärast 04.10.2026

Claude Opus 5.5 luges 04.10 iganädalase registrikontrolli (kell 05.30) järel seisu uuesti üle. Ainult lugemine, tasuta; midagi ei avaldatud. Nimedega tabel on serveris: `rag-v2-work/eval-files/contact-recheck-2026-10-04.csv`.

- **Seos 2 pidas.** Kontrolliaja ülekirjutamine ei tühistanud ühtki muutumata kontakti.
- **Vestlus annab 363 kontakti 376-st.** 13 langes välja, sest kontroll neid enam ei kinnita; nädal varem olid kõik 13 kinnitatud.
  - Anija 6, Jõhvi 2, Valga 2, Tapa 1, Luunja 1, Otepää 1. Anija ei anna nüüd ühtki kontakti.
  - Anija kuue e-post on lehel alles, kuid kujul, mida kontroll ei loe. Jõhvi kahel ja Valga ühel on telefon ja e-post lehel, aga mitte enam kohe nime järel. Ühel ei leita rolli nime kõrvalt, ühel on nimi teisiti kirjutatud. Päris muutus paistab kahel.
- **Avaldatud kontakte on 59 omavalitsusel, täna annab neid 58.** Ülal kirjas olev „60 omavalitsusest“ oli kandidaatide arv.
- **Ootamine ei andnud oodatut.** 186 kinnitamata reast kinnitus 3; 183 on samas seisus mis nädal varem.

  | Kontakte | Miks 183 rida ei kinnitu |
  |---:|---|
  | 48 | registris olevat lehte ei saa kätte (404) |
  | 26 | nime lehel pole, telefon või e-post on |
  | 22 | inimest lehel pole |
  | 21 | nimi, telefon ja e-post on lehel koos, registri rollitekst ei klapi |
  | 16 | leht ei näita ühtki oma inimest |
  | 50 | muu: telefon või e-post pole lehel või pole nime kõrval, e-post peidetud, nimi teisiti kirjutatud |

- **Partii oleks 20 kontakti:** 3 uuesti kinnitatud rida läbivad 28.09 ülevaatusreegli ja 20 topeltreast on reegliga seotavad 17 (kolmel pole registris telefoni ega e-posti). 28.09 välja jäetud seitse kukuvad läbi samadel põhjustel.
- **Partiid ei avaldatud.** Kitsaskoht on register ja selle kontroll, mitte seos: vt [ADR-073](adr-073-kov-staff-from-official-page.md).
