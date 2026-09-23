# ADR-018 — Kasutaja tekstiga seotud vestluse seis samas vastusekutses

23.09.2026. Kohalik teostus ja kontroll; serveris aktiveerimine ning pärismudeli sisuline kvaliteet `not_run` / `NOT_PROVEN`.

## Probleem ja lahendus

[Opuse L9/P1](../audits/rag-v2-opus-review-2026-09-23.md) osutas, et sõnumite järjekord üksi ei ole vestluse sisuline seis. Näiteks „elan üksi, tööd ei ole” järel peab töö leidmise parandus asendama tööga seotud asjaolu, säilitades muu asjakohase info. Vana vastuse selgitamine ei tohi uuemat parandust tagasi pöörata.

Vastusemudeli olemasolev struktureeritud väljund saab välja `dialogue_state`. Sama kutse annab kasutajale nähtava vastuse ja serveris hoitava tõlgenduse. Planeerija, tõlgendaja ega mälu kokkuvõtja lisakutset ei lisatud. Seis lisab siiski sama päringu/vastuse tokeneid; päriskulu pole testadapteri tokeniarvudega mõõdetud.

Tuum paikneb `lib/rag-v2/pilot/dialogue-state.js` failis. Omavalitsuste avalik nimeloend tuleb adapterist; tuuma ei lisatud kindlaid valdu, teenusesõnu, käändevormide loendeid ega oodatud vastuste erandeid. Olemasolev admini käsitsi käivitatav enesetest säilib.

## Leping ja tõendipiir

| Väli | Serveri kontroll ja tähendus |
| --- | --- |
| `facts` | Kuni 12 kasutaja tsitaatidega kirjet. `support` sisaldab aktiivse teema kasutajapöörde järjekorranumbrit ja täpselt selles tekstis leiduvat tsitaati. `topic` ja `subject` on mudeli liigitus, mitte sõltumatult kinnitatud fakt. |
| `status`, `superseded_by` | Kehtiv või asendatud kirje; asendus osutab hilisema kasutajapöörde tsitaadiga kirjele. Varasemad kirjed peavad säilima ning asendatud kirjet ei tohi uuesti kehtivaks muuta. Uus hilisem kasutaja väide saab oma kirje. |
| `needs` | Kuni 4 võimalikku abivajadust, igaüks seotud kehtivate asjaolukirjetega. Need ei kinnita diagnoosi, abikõlblikkust ega teenuse sobivust. |
| `unknowns` | Kuni 4 lahtist küsimust; puuduv info ei muutu oletatavaks vastuseks. Nähtava vastuse juhis palub küsida kuni kaks vajalikku täpsustust. |
| `region` | Kanoniline piirkonna-ID või `null`; seisund `unknown`, `tentative`, `reported` või `ambiguous`. ID peab leiduma adapteri loendis ja tsitaadi kohanimi peab EstNLTK abil sellele vastama. Ka `reported` ei ole kontrollitud elukoht. |
| `period` | Kasutaja soovitud ajavahemiku tõlgendus koos tsitaadiga. ISO-kuupäevad peavad olema võimalikud ja õiges järjekorras. Seda ei rakendata veel artikli avaldamisaja või teenuse kehtivuse range filtrina. |
| `language_hint` | Mudeli keelevihje, mis ei muuda serveri valitud vastusekeelt. |

Seis on kuni 1800 tokenit. Täisskeem, piirid ja asjaolude säilitamine kontrollitakse serveris. Üle piiri läinud või tõendamata tsitaadiga vastus lükatakse tagasi; mälu ei kärbita vaikselt. Varasemad aktiivse teema piirid jäävad kehtima: kuni 8 kasutajapööret ja piiratud sisendmaht. See ei ole veel piiramatu pika vestluse mälu.

Täpselt tekstist leitud tsitaat tõendab päritolu, mitte seda, et mudel mõistis õigesti eitust, isikut, vajadust või ajavahemikku. Server kontrollib asenduse kronoloogiat, mitte kahe väite sisulist vastuolu. Ka vajaduse seos kehtiva kirje numbriga ei tõenda soovituse kvaliteeti. Varasemat assistenditeksti ja allikakatkendit ei saa kasutajatsitaadina esitada, kui kasutaja pole seda ise kirjutanud; kasutaja tsiteeritud assistendiväite tõlgendamine jääb samuti mudeli ülesandeks.

## Järgmise pöörde kasutus

`acceptDialogue()` valib seisu allikaks aktiivse teema viimase avaldatud pöörde. See valik on eraldi selgitatava assistendivastuse valikust. Seisu räsi, teema/isiku identiteet ning kasutajapöörete täpne prefiks kontrollitakse enne taaskasutust.

- `new` ja `new_person` alustavad tühja seisuga. Teise inimese asjaolud ei kandu kaasa. Selgesõnaline naasmine vanasse teemasse võtab selle teema viimase seisu.
- Tagasilükatud mudelivastus ei muuda seisu. Selle pöörde kasutaja tekst, sealhulgas parandus, jääb aktsepteeritud järjekorda ja jõuab järgmisesse kutsesse.
- KOV-i allikaulatus tuvastatakse esmalt pärast eelmist seisukirjet lisandunud kasutajatekstist. Kui seal uut kohanime ega selgesõnalist asukohata parandust pole, võib kasutada eelmist kanonilist piirkonda.
- `null`-piirkonna järel ei hakata vanadest sõnumitest kunagist kohanime uuesti otsima. Seega ei taastu tagasivõetud asukoht küsimuse „aga kust abi saada?” peale. Loendist eemaldatud piirkonda samuti ei kasutata.
- Praeguse pöörde kohanime mainimine võib anda ajutise kandidaatkataloogi ka eituse või teise inimese korral. Nimetuvastus ei mõista kõiki neid tähendusi. Sama vastusekutse peab siis täpsustama ja seisus piirkonna korrigeerima; lisamudelikutsed ega uue tõendi automaatne järelpäring pole lisatud.
- Piirkond piirab ainult lubatud allikate valikut. See ei anna õigust allikatele ega kinnita teenuse sobivust. Õigused, allikaversioonid ja kontaktide kontrollid jäävad sõltumatuks.

Vajadused, teadmata asjaolud ja periood lähevad järgmise vastusemudeli sisendisse. Ajakirjade hübriidotsingu tekst jääb praegu aktiivse teema kasutajatekstiks; vajaduspõhist ümberkirjutust, perioodifiltrit ega artikli/KOV/perioodi automaatset valikut selles plokis ei lisatud.

## Püsistus ja taastamine

Valideeritud nähtav vastus ja seis salvestatakse koos sama `M4PilotTurn.payload` sisse enne avaldamist. Prisma skeemi ega eraldi kasutajaprofiili/mälutabelit ei lisatud. Algne struktureeritud mudeliväljund jääb olemasolevasse piiratud vastuseauditisse.

Taastamisel ja seisu uuesti kasutamisel projitseeritakse too väljund uuesti ning võrreldakse salvestatud vastuse ja seisuga. Avaldamise katkestus on taastatav uue mudelikutseta. Avalik vestluse vastus ei sisalda sisemist seisu. Olemasolev vestluse omaniku, konfiguratsiooni, aegumise ja kustutamise kontroll rakendub ka seisu allikapöördele; vestluse kustutamisel kaob seis koos pööretega, kululoendur jääb alles.

## Konfiguratsioon

Olemasolevat mehaanilist lepingut `m4-active-dialogue-1` laiendab valikuline, versioonitud plaan:

```js
{
  dialogueVersion: DIALOGUE_VERSION,
  dialogueStateVersion: DIALOGUE_STATE_VERSION, // m4-dialogue-state-1
  dialogueStateSchemaHash: digest(DIALOGUE_ANSWER_SCHEMA),
  promptVersion: DIALOGUE_PROMPT_VERSION,      // m4-grounded-dialogue-5
  questionVersion: DIALOGUE_SEARCH_VERSION,    // m4-user-scope-search-4
}
```

Konstandid pärinevad `pilot/dialogue.js` ja `pilot/dialogue-state.js` failidest, `digest` failist `pilot/contracts.js`. Muud olemasoleva plaani mudeli-, indeksi-, allika-, eelarve- ja väljasaatmise väljad kehtivad edasi; uus plaan vajab oma sisu- ja teostusräsi. Vale seisuleping, puuduv dialoogileping või vale skeemiräsi lükatakse tagasi. Uue väljata dialoog säilitab senise käitumise. Vanad dialoogijuhise ja otsingusisendi versioonid jäävad lugemiseks toetatuks, mitte uue teostuse käivitamise plaaniks.

Kohalik `test` transport vajab selle lepingu korral sõnaselget vastusefixtuuri `testResponsesPath` kaudu; vaiketransport ei mõtle seisu välja. Tootmise konfiguratsiooni selles plokis ei muudetud. Mudeli valik jääb `gpt-6-luna` / `medium`.

## Kontrollitud ulatus

31 eri sihttesti läbisid `TZ=UTC` all:

- `rag-v2-dialogue-state.test.mjs`: 5; ET/EN/RU tsitaadipäritolu, väljamõeldud asjaolude tõrjumine, muutumatu asjaolu säilimine, asenduse kronoloogia, taaselustamise/vaikse kadumise keeld, isiku/teema piir, kuupäevad ja avaliku vastuse eraldamine.
- `rag-v2-dialogue.test.mjs`: 3 ning `rag-v2-dialogue-config.test.mjs`: 1; senine dialoogileping, konfiguratsioon ja vanade versioonide lugemine.
- `rag-v2-dialogue-store.test.mjs`: 15 päris eraldatud rakenduse andmebaasis; uus seis, vana vastuse valimine pärast parandust, teema/isiku vahetus, ebaõnnestunud parandus, atomaarne salvestus, taastamine, muutunud projektsiooni keeld, kustutamine ning senised õiguste/võistlusolukorra regressioonid.
- `rag-v2-structured-records.integration.test.mjs`: 7 päris kohaliku PostgreSQL/Qdranti, EstNLTK ja eraldatud rakenduse andmebaasiga. Kahe sünteetilise valla 8 pööret tegid 8 vastusekutset testadapterile ja 0 päringu embedding'ut. Piirkonnavahetus vahetas kirjed, „lihtsamalt” säilitas kanoonilised tõendi-ID-d, tagasivõetud piirkond ei taastunud, mitmetähenduslik piirkond andis tühja kataloogi ning kontaktide ligipääsu tagasivõtmine blokeeris taastamise.

Muudetud JS/MJS-failide ESLint ja `git diff --check` läbisid. Tasulisi kutseid 0. Tootmiskasutajate sisu ei loetud. Mudelitransport ja indeksivektorid olid sünteetilised; EstNLTK ja andmebaasid päris kohalikud. Build, brauseri tervikrada, deploy ja pärismudeli sisuline kvaliteet `not_run` / `NOT_PROVEN`. Muudatus ei puuduta kliendi importimispiiri ega UI-d. Aktiivne arendusjärjestus jääb SotsiaalAI.md-sse.
