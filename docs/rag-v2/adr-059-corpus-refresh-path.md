# ADR-059 — Korpuse värskendamise rada

30.09.2026. Teostus Claude Opus 5.5. Omanik 30.09: „sina jätka rag arendust“. Teekaardi M6 põhimõte: „Allikamuudatus peab uuendama seotud andmeid.“ Järgib [ADR-038](adr-038-law-validity-check.md) (kehtivuskontroll) ja [ADR-058](adr-058-municipal-social-acts.md) (omavalitsuste sotsiaalaktid).

## Probleem

- **Igakuine kontroll leiab muudatusi palju.** 30.09 oli manifestis 496 akti ja 449 gruppi; omavalitsuste skaneerimine leiab lisaks uusi akte.
- **Iga korpuse versioon (v40–v44) tehti käsitsi.** Käsitöö hõlmas:
  - registrikirjeid, arve ja REGISTER.md ridu;
  - ülevaatuse faili;
  - poliitikat, versioonide loendit ja pakki;
  - serveri käivitusskripti, mis tuletati eelmisest `sed`-iga.
- **Käsitöös tekkis vigu.** Näiteks v41 skript luges algul vale indeksiplaani ja v42 skript oleks ilma ostuta jooksul peatunud. Vead leiti enne käivitamist, aga rada ei tohi nõuda iga kord uut skripti.

## Otsus

Rada on kaheosaline. Sülearvutis on `scripts/rag-v2-corpus-refresh.mjs` (teek `lib/rag-v2/corpus-refresh.js`). Serveris on `scripts/rag-v2-corpus-run.sh`, mis tuleb koos rakendusega.

1. **Allalaadimine:**
   - `rag-v2-law-validity.mjs check --download DIR` laeb puuduvad redaktsioonid ja nüüd ka nende indekseeritud aktide XML-i, mille kehtivus muutus;
   - `rag-v2-municipal-acts.mjs scan --download DIR` laeb omavalitsuste uued aktid.
2. **`refresh register --from DIR --out WORK`:**
   - uus akt saab kirje, REGISTER.md rea ja arvud;
   - muutunud baitidega akt asendatakse samas kohas ja vanad baidid lähevad kausta `WORK/previous`;
   - asendatud aktist tuletatud lisa loetakse uuesti (ADR-053);
   - kaardid, mida tuleb uuesti siduda, nimetatakse koos käsuga (`rag-v2-knowledge-reanchor.mjs --previous-root`, ADR-053);
   - kirjutatakse ingest'i valik `WORK/selection.json`.
3. **Ingest** käib nagu ennegi: `rag-v2-ingest-batch.mjs` režiimid `plan`, `run` ja `review`.
4. **`refresh review`** kinnitab mustandi ilma käsitsi muutmata, kui iga kirje on puhas:
   - blokeerijaid pole;
   - on ainult teadaolevad hoiatused (`collected_package_text`, `knowledge_import_unreviewed` ja [ADR-062](adr-062-provision-dates.md) järgi `amendment_note_in_force_before_publication` ja `act_in_force_before_publication`), mille kohta kirjutatakse standardmärkus;
   - kehtivuse algus on olemas;
   - omavalitsuse akti omavalitsus on lahendatud.

   Muul juhul nimetab see kirjed, mille üle peab otsustama inimene (exit 2).
5. **Avaldamine** käib nagu ennegi (`--mode publish`).
6. **`refresh package`** teeb:
   - uue poliitika (eelmine poliitika koos kinnitatud dokumentidega, kontrollitud hoidla pea vastu);
   - paki (`active.json`, `publications`, uued versioonid);
   - `ship.json`, kus on paki räsi, alus- ja uus pea, dokumentide arv ning uute dokumentide arv.
7. **Server:** `sh scripts/rag-v2-corpus-run.sh <N> <eelmine> <plaanifail> <piir> "<alus et>" "<alus en>"`.
   - Skript kontrollib paki räsi ja hoidla mõlemat pead ning võtab uusima hinnafaili.
   - Kui kõik sisendid on juba vektoritega, jäävad kinnitus ja ost vahele.
   - Edasi tulevad indeks, eelmise ja uue generatsiooni tõendid, uus plaan ning plaanide erinevus.

### Omavalitsuste skaneerimise parandus (ADR-058)

- **v43 skaneerimine jättis neli akti vahele.** Väljaandja kogu loendit loeti 500 akti kaupa lehtedena. RT järjestab iga päringu isemoodi, seega lehed kattusid ja mõni akt jäi puudu. Tallinna Linnavalitsusel on näiteks 2110 akti.
- **Nüüd otsitakse iga väljaandja akte 12 pealkirja märksõnaga.** Need katavad kõik kategooriad; otsing leiab sõna ka sõna seest („hoold“ → „Üldhooldusteenuse“).
  - Iga otsing mahub ühele lehele.
  - Lehti loetakse uuesti, kuni erinevate aktide arv jõuab koguarvuni.
  - Kui see ei juhtu, on tulemuseks tõrge (exit 20), mitte vaikne puudujääk.
- **Kontroll varasema loendiga:** märksõnad katavad kõik 4622 akti, mille valik varasemas täisloendis klassifitseeris.

## Kontroll

- `tests/rag-v2-corpus-refresh.test.mjs`:
  - registreerimine: uus, asendatud ja muutumata akt; uuesti tuletatud lisa; seotav kaart; vale nimega fail; kordusjooks ei muuda midagi;
  - automaatne ülevaatus: puhas mustand ja iga peatamise põhjus;
  - poliitika: dokument peas ja dokument, mida peas pole;
  - pakk: sisu, räsi ja pead.
- **Päris andmetel, korpus v45 (30.09.2026):**
  - parandatud skaneerimine: 78 omavalitsust, 462 valitud akti, 5 uut, tõrkeid pole, 9 min;
  - registreerimine: 5 lisatud;
  - ülevaatus kirjutati ilma käsitsi muutmata;
  - pakk: alus v44 pea `e5bb67a1`, uus pea `8c646ff0`, 6452 dokumenti;
  - server `rag-v2-corpus-run.sh 45 44 …`: 42 sisendit, 0,0015 USD, indeks `dfa3b1db`, plaan `m4-corpus-chat-20260930g.json`. Plaanide erinevus sisaldas ainult oodatud välju.

## Codexi ülevaatuse parandused (R1–R3, 30.09.2026)

[Audit](../audits/rag-v2-pr276-281-review-2026-09-30.md).

- **R1 — serveriskript teatas ebaõnnestumise järel edust.**
  - Viga: plaani loomise väljund läks läbi `| tail` ja skript lõpetas koodiga 0. Indeksitöö aktiveerib aga uue generatsiooni enne plaani, nii et ebaõnnestunud plaan jätab vestluse pöördeid tagasi lükkama (`active_index_mismatch`).
  - Nüüd annab iga samm (tõendid, plaan, `chown`, restart, teenuse seis, plaanide võrdlus) vea korral nullist erineva koodi ja ütleb, mis seisu see jättis.
  - Plaani väljund läheb logifaili. Pakk kustutatakse alles pärast edu.
  - `RESUME=plan` samade argumentide ja uue plaanifaili nimega teeb ainult plaani sammu, kui indeks on valmis.
  - Test `tests/rag-v2-corpus-run.test.mjs` käivitab skripti ajutises puus `sudo` ja `systemctl` aseainetega: plaani, `chown`-i või teenuse viga annab vea ja jätab paki alles; edu kustutab paki; olemasolevat plaanifaili ei kirjutata üle; valmimata indeksit ei jätkata.
- **R3 — katkenud registreerimine jättis pooliku seisu.**
  - Viga: katkenud registreerimisest jäid failid registrist erinevaks ja kordusjooks kirjutas varukoopia üle.
  - Nüüd loetakse ja kontrollitakse kõik failid ning tuletatakse kõik lisad enne, kui midagi kirjutatakse. `derivedAnnex` saab akti uued baidid otse.
  - Kirjutamise järjekord: kõigepealt varukoopiad, siis failid ajutise nime ja ümbernimetamisega, register viimasena.
  - Olemasolevat varukoopiat ei kirjutata kunagi üle. Kui registreeritud baite pole ei kettal ega varukoopias, peatub töö ega kirjuta midagi (`refresh_registered_bytes_missing`).
  - Sama käsk lõpetab katkenud töö.
  - Testid: vigane fail pärast õiget ei kirjuta midagi ja kordus lõpetab töö; vana koodi pooleli jäänud seisust jätkatakse õige varukoopiaga; kadunud baitide korral töö peatub.
- **R2** on kirjas [ADR-058](adr-058-municipal-social-acts.md) täienduses.

## Codexi #283–#288 ülevaatuse parandus R2 (30.09.2026): registreerimine jätkub igast kirjutusest

- **Viga ([Codexi raport](../audits/rag-v2-pr283-288-review-2026-09-30.md), P2):** kui töö katkes `REGISTER.json`-i ja `REGISTER.md` kirjutamise vahel, oli JSON uus ja Markdown vana.
  - Kordus pidas kõiki allalaadimisi muutumatuks: valik `[]`, Markdowni rida puudu.
  - Järgmine lisamine peatus `refresh_register_row_missing` veaga.
  - Sama juhtus katkestusel enne `selection.json`-i. Lõpetatud töö kordus kirjutas valiku tühjaks.
- **Nüüd hoiab WORK töö alust ja olekut** (`registerDownloads({ root, from, work })`):
  - Esimene jooks salvestab enne muid kirjutusi `WORK/register-base/` (register, nagu töö selle leidis) ja `WORK/register-state.json` (`started`, aluse ja allalaadimiste räsid).
  - Iga jooks arvutab tulemuse alusest, mitte elavast registrist, ja kirjutab kõik uuesti: varukoopiad, failid, register, `selection.json`, `register.json`. Olek `done` kirjutatakse viimasena.
  - Katkenud töö kordus nõuab samu allalaadimisi (`refresh_downloads_changed`). Iga registrifail peab olema kas alus või selle jooksu väljund (`refresh_register_changed_meanwhile`).
  - Lõpetatud töö kordus tagastab salvestatud tulemuse ega kirjuta midagi.
  - Pooleldi kirjutatud register ei ole uue töö alus: aktide arvud ja read peavad klappima (`refresh_register_inconsistent`). See püüab kinni ka katkenud töö, mida korratakse uue WORK-iga.
  - Varukoopiate kontroll käib enne esimest kirjutust. Ajutine failinimi on fikseeritud (`<fail>.refresh`), seega kordus kirjutab katkestuse jäägi üle.
- **Test:** puhtas jooksus loetakse kõik 13 ümbernimetamist. Iga ümbernimetamise juures katkestatakse töö ja korratakse sama käsuga. Registri, töö ja failide lõppseis võrdub katkestuseta jooksuga.
- Päris registris (578 allikat, 551 RT XML-i) klapivad arvud ja read.

## Piirid

- Rada ei otsusta sisu üle. Uue tüübi hoiatus, lahendamata omavalitsus või kaart, mis vajab uuesti sidumist, peatab raja.
- Serveriskript kasutab ikka kinnituse malli `approval-v37/make-approval-v37.mjs`. See on ainult serveris.
- RT kirjutab lõpu oma loendisse enne kui akti XML-i (ADR-038). Kuni XML on uuendatud, ei näe rada lõppu.
