# ADR-076 — Akti paragrahvid allikana ja korpuse täiendus v49

04.10.2026. Teostus Claude Opus 5.5. Omanik 04.10: „Valmista ette korpuse täiendus v49 (puuduv seadus, üleriigiline määr)“. Lähtekoht: [päris vestluse küsimustik 04.10](../audits/rag-v2-live-questionnaire-2026-10-04.md), jaotised 5 ja 6, ning Codexi järjekorra punkt 3.

**Seis: ostetud ja aktiivne (04.10.2026 16:59 EEST), omaniku loal.** 51 sisendit, 25 275 tokenit, 0,0033 USD. Indeks `f3c7ed7a` (6474 dokumenti), vestlusplaan `m4-corpus-chat-20261004b.json`. Mõju vastustele on mõõtmata.

## Probleem

1. **Puuetega inimeste sotsiaaltoetuste seadust indeksis ei ole.** 520 aktist on üleriigilisi seitse pealkirja (abivahendite määrus, HMS, LasteKS, PKS, RLS, SHS, SÜS). Küsimus Q12 vastas ajakirjaartikli põhjal.
2. **Toimetulekupiiri summal pole üleriigilist allikat.** 2026. aasta summa on ainult valdade toetusekirjetes (48 lähtefailis 78-st). Üldine küsimus ilma vallata (Q9) summat ei saanud: tõendites olid ainult SHS-i lõigud, kus summat ei ole.
   - Summa kehtestab riigieelarve: SHS § 131 lõike 3 alusel on see „2026. aasta riigieelarve seaduse“ § 2 lõike 5 punktis 5 (220 eurot üksi elavale inimesele või pere esimesele liikmele). Teiste pereliikmete osa (80% ja 120%) on SHS-is, mis on indeksis.
   - Riigieelarve seadus on 4,15 MB: § 1 on eelarvetabelid (4,09 miljonit tähemärki), § 2 „Seadustest tulenevate määrade ja piirsummade kehtestamine“ on 6,6 tuhat tähemärki. Tervikuna sisse lugeda ei saa ega tohi: lugeja piir on 2 miljonit tähemärki ja tabelid ei ole sotsiaaltöö allikas.

## Kaalutud valikud

| Valik | Hea | Halb |
|---|---|---|
| A. Registrikirje nimetab loetavad paragrahvid; fail jääb Riigi Teataja algfailiks | fail on bait-baidilt Riigi Teataja oma (räsi klapib); akt, kehtivus ja väljaandja loetakse failist nagu igal aktil; kehtivuse kontroll ja värskendusrada töötavad muutmata | lugejasse väike lisaharu; 4 MB fail gitis |
| B. Käsitsi kärbitud XML | koodi ei muudeta | fail ei ole enam Riigi Teataja oma, kuigi register nimetab Riigi Teataja aadressi; uus redaktsioon tuleks iga kord käsitsi kärpida |
| C. Eraldi tekstifail kõrvalmetaandmetega | koodi ei muudeta | sisu ja kehtivus kirjutatakse käsitsi; kood ei kontrolli, et tekst vastab aktile; kehtivuse kontroll seda ei näe |

**Valitud A.** Põhjus: kogutud ja käsitsi tehtud tekst ei tohi olla tõendamata kujul allikas; siin kontrollib register faili räsi ja lugeja võtab paragrahvi otse sellest failist.

## Otsus

- **Registrikirje väli `xml_sections`** (`Andmebaasi/REGISTER.json`, ainult Riigi Teataja XML-allikal): loetavate paragrahvide numbrid kujul, nagu akt neid näitab, ilma märgi ja punktita (`["2"]`, ülaindeksiga `"15¹"`).
- **Lugeja** (`lib/rag-v2/text-source.js`) loeb valiku korral ainult nimetatud paragrahvid. Teised paragrahvid, paragrahvidest väljaspool olev tekst ja nende muutmismärked jäävad lugemata. Akti pealkiri, väljaandja, kehtivus ja muudatuste ajalugu on akti enda omad.
- **Vead, mitte vaikne tulemus:**
  - nimetatud paragrahvi failis ei ole (uus redaktsioon nummerdas ümber või paragrahv on tervikuna kehtetu): `xml_section_not_found`;
  - vigane valik (tühi, mitte tekst, „§ 2“, kordus): `invalid_source_selector`;
  - sama fail ilma valikuta: `text_limit`, st riigieelarve seadus ei saa kogemata tervikuna sisse minna.
- **Uus redaktsioon pärib valiku.** Värskendusrada (`rag-v2-corpus-refresh.mjs register`) annab alla laaditud aktile sama valiku, kui registris on sama pealkirja ja väljaandjaga akt valikuga.
- **Töötlussilt ei muutu** (`source-structure-v30`). Olemasolevate allikate väljund on sama: `rag-v2-reader-compare.mjs` luges kõik 520 indeksi akti uue koodiga uuesti, 520 identset, uusi vektorisisendeid 0. Salvestati ainult uus töötluse sõrmejälg.

## Korpus v49

| Akt | Riigi Teataja | Kehtib | Lõike | Uusi sisendeid |
|---|---|---|---:|---:|
| Puuetega inimeste sotsiaaltoetuste seadus | 130062026020 | 01.10.2026–31.01.2027 | 34 | 12 |
| Puuetega inimeste sotsiaaltoetuste seadus | 130062026021 | alates 01.02.2027 | 35 | 35 |
| 2026. aasta riigieelarve seadus, § 2 | 103072026024 | 13.07.2026–31.12.2026 | 4 | 4 |

- Kokku 73 lõiku, **51 ostetavat sisendit, 25 275 tokenit, umbes 0,0033 USD** (0,13 USD miljoni kohta). PISTS-i kahe redaktsiooni 22 muutmata lõiku jagavad ühte vektorit. Arv on loetud kohalikult; serveri tasuta plaan peab andma sama arvu enne ostu.
- Kohalik hoidla: pea `generation_84f71b2a…` (eelmine `34e83d81…`, varukoopia `tmp/rag-v2-v49/store-backup-v48`). Poliitika 6474 dokumenti (6471 + 3). Saadetis `tmp/rag-v2-v49/ship/` (`ship.tgz`, `ship.json`, `policy.json`).
- Ülevaatus: kolm kirjet, hoiatusi ega takistusi ei olnud.
- PISTS-ist võeti praegu kehtiv ja järgmine redaktsioon, nagu SHS-il: kehtivuse kontroll valib küsitud päeva järgi.

## Kontrollid

`tests/rag-v2-xml-sections.test.mjs` (viis testi, Riigi Teataja failid `Andmebaasi`-st, võrku ei kasutata):

1. Register nimetab riigieelarve seaduse § 2; fail on registri räsiga; ühelgi teisel allikal valikut pole.
2. Loetakse ainult § 2: üks paragrahv, neli lõiku, tekstis „toimetulekupiir 220 eurot kalendrikuus“, eelarvetabeleid ega teisi paragrahve ei ole; akt, väljaandja, üleriigilisus ja kehtivus on failist.
3. Sama fail ilma valikuta lükatakse tagasi (`text_limit`).
4. Puuduv paragrahv ja vigane valik on vead.
5. Valikuta akt loetakse nagu enne; valikuga akti paragrahv on sama tekst ja samad märked, mis terve akti lugemisel.

`tests/rag-v2-corpus-refresh.test.mjs`: sama akti järgmine redaktsioon registreeritakse sama valikuga.

## Piirid

- **Mõõtmata.** Kas vestlus pärast aktiveerimist toimetulekupiiri ja puuetega inimeste toetuste küsimustele paremini vastab, näitab ainult päris pööre. See on tasuline ja vajab eraldi luba.
- **Summa lõik ei nimeta seadust.** § 2 on üks pikk paragrahv ja lõigatakse pikkuse järgi neljaks. Lõik summaga algab punktist 3; sissejuhatav lause „Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised“ on eelmises lõigus. Lõigu pealkiri (§ 2 „Seadustest tulenevate määrade ja piirsummade kehtestamine“) on kaasas. Sama kehtib iga pika paragrahvi kohta igas aktis.
- **176 ja 264 eurot ei ole üheski üleriigilises tekstis.** Riigieelarve seadus annab 220 eurot; 80% ja 120% on SHS-is. Vastus peab need kokku panema või jääb valla kirje juurde.
- **Aastavahetus.** Registreeritud redaktsioon lõpeb 31.12.2026. 2027. aasta määrad on teises aktis („2027. aasta riigieelarve seadus“), mis tuleb lisada käsitsi koos väljaga `xml_sections`, enne 01.01.2027. 2026. aasta seaduse 2027. aastal kehtiva redaktsiooni (118122025023) leiab kehtivuse kontroll ise ja see pärib valiku.
- **§ 2 sisaldab ka muid määrasid** (õppetoetused, sotsiaalmaksu kuumäär, muuseumide näituste tagatised). Need on neli lõiku ja tulevad kaasa; lõigete kaupa valikut ei tehtud.

## Ost ja aktiveerimine (04.10.2026)

Omanik 04.10: „jah“ küsimusele, kas lubada ost ja aktiveerimine (51 sisendit, umbes 0,0033 USD, piir 0,01 USD).

- **Jooks:** `rag-v2-corpus-run.sh 49 48` töötavalt väljalaskelt `773ff4bc`, koopiana ühe lisareaga, mis oleks peatunud enne kinnitust, kui plaan näitab üle 51 sisendi. Kogu jooks 13:58:55–13:59:51 UTC (56 s).
- **Plaan ja ost:** serveri tasuta plaan andis 51 välist sisendit ja 25 275 tokenit, sama mis kohalik loendus. Ostetud 51/51, teadmata tulemusega 0; kulu 0,003286 USD (arvutatud kinnitatud kasutusest, mitte arvelt). Vektorid `pilot_747587d3…`.
- **Indeks:** `search_generation_f3c7ed7a…`, 6474 dokumenti ja 40 615 lõiku (enne 6471 ja 40 542); kolm uut dokumenti, ülejäänud taaskasutatud. Eelmise põlvkonna tõend oli enne ja pärast sama.
- **Vestlusplaan:** `/etc/sotsiaalai/m4-corpus-chat-20261004b.json`. Eelmisest erineb ainult põlvkonna, tunnuste, loa aluse ja kinnituse poolest; seadeid (profiil, juhiste versioonid, mudel) võrdlus erinevana ei näidanud.
- **Aktiveerimine uue avaldamisviisiga on nüüd päris täiendusega tehtud.** Skript aktiveeris plaani nii `rag.env`-is kui töötava väljalaske env-failis, kontrollis (`ready`), taaskäivitas teenuse ja trükkis `running plan: /etc/sotsiaalai/m4-corpus-chat-20261004b.json`. Väljalaske env-failis on üks plaanirida.
- **Pärast jooksu:** teenus aktiivne, leht vastab, hoidla pea serveris `84f71b2a` (sama mis sülearvutis), `docs/rag-v2/legal-acts-in-index.json` uuendatud (523 akti). Serveri ketas 93% (4,4 GB vaba).

## Järgmine samm

Mõõta omaniku loal kaks küsimust päris vestluses: toimetulekupiir ilma vallata (küsimustiku Q9) ja puuetega inimeste toetus (Q12). Umbes 0,01 USD.
