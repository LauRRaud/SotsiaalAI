# ADR-090 — Lingi sihtkoht ei ole akti tekst

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „Eemalda lingi sihtkohad seaduste lõikude tekstist“. Lähtekoht: [ADR-088](adr-088-version-comparison-on-the-server.md) kõrvalleid.

**Töös: lugeja alates #389 ja indeks alates korpusest v59 (05.10.2026 kell 18.54). Töötavas indeksis ei ole ühtegi lingi sihtkohaga lõiku (jaotis „Korpus v59“).**

## Probleem

Riigi Teataja akti XML-is on lingil kaks osa: nähtav tekst (`kuvatavTekst`) ja sihtkoht (`viideURID`).

```
kehtestab [valdkonna eest vastutav minister → ./dyn=103062026023&id=111022016020] määrusega.
```

Lugeja võttis mõlemad tekstiks. Sihtkoht seisis paragrahvi tekstis omaette real:

- vastuse mudel luges seda tõendilõigus;
- see oli embedding'u sisendis ja sõnalises indeksis;
- see sisaldab redaktsiooni enda numbrit, seega erines sama säte kahes redaktsioonis ainult selle poolest (ADR-088: sotsiaalhoolekande seaduse 46 erinevast lõikest 38).

Mõõdetud: registri 555 aktifailist loeb lugeja tervikuna 552 (riigieelarve seadus on registris paragrahvivalikuga, kahe akti sisu on lisades). Neist 21-s on paragrahvide tekstis sihtkohti, kokku 384 (kujud `./dyn=N&id=N`, `./dyn=N&id=N;N` ja `./../vaheleht.html`). Indeksis on need 21 akti seitsme seaduse redaktsioonid: sotsiaalhoolekande seadus (6), riigilõivuseadus (5), lastekaitseseadus (3), puuetega inimeste sotsiaaltoetuste seadus (2), sotsiaalseadustiku üldosa seadus (2), haldusmenetluse seadus (2), perekonnaseadus (1). Sihtkoht on 342 lõigus.

## Otsus

1. **Lugeja `source-structure-v31`:** elementi `viideURID` ei loeta tekstiks. Lingi nähtav tekst jääb sinna, kus ta oli. Kõik muu loetakse nagu v30.
2. **Versioonisilt tõuseb**, sest muudatus muudab 21 akti teksti (reegel: töötluse kood ja silt muutuvad koos). v31 on lisatud nende lugejate hulka, mis hoiavad ülaindeksid ([ADR-056](adr-056-rt-xml-superscripts.md)).
3. **Teadmiskaardid järgivad teksti.** Kaardi ankur on täpne tsitaat kindlal kohal paragrahvi tekstis. Lingi järel seisev tsitaat on nüüd sihtkoha pikkuse võrra eespool. `scripts/rag-v2-knowledge-reanchor.mjs` sai kolmanda juhu: tsitaat peab lugema sama ja seisma oma kirjas olevast kohast eespool, lähimas sellises kohas; ühe paragrahvi ankrute nihked tohivad koha kasvades ainult kasvada, muidu ei kirjutata midagi.
4. **Võrdluse tööriist** (`scripts/rag-v2-reader-compare.mjs`) loeb akti nüüd registri paragrahvivalikuga, nagu sisestus loeb. Enne takerdus ta riigieelarve seaduse taha (`text_limit`), sest luges selle tervikuna.
5. Redaktsioonide võrdlus ([ADR-088](adr-088-version-comparison-on-the-server.md)) jätab sihtkoha endiselt sõnastusest välja: indeksis on v30 versioonid kuni uuesti sisestamiseni.

### Mida ei tehtud

- **Lause on endiselt kolmel real** („kehtestab“ / „valdkonna eest vastutav minister“ / „määrusega.“), sest iga tekstielement on lugejas omaette rida. See oli nii ka enne ja loetav; ühele reale toomine muudaks rohkemate aktide teksti.
- Lingitud akti numbrit ei hoita andmena. Ükski kood seda ei kasutanud.
- **Preambuli link jääb lugemata nagu enne.** Abivahendite määruse kahe redaktsiooni preambulis („Määrus kehtestatakse sotsiaalhoolekande seaduse § 47 … alusel“) on seaduse nimi link; lugeja jätab seal vahele nii sihtkoha kui ka nähtava teksti, nii et preambul loeb „Määrus kehtestatakse § 47 …“. See on eraldi viga, mida siin ei parandatud.

## Kontroll (kõik tasuta, mudelita)

- **Enne ja pärast, kõik registri aktid:** 552 loetavast aktist 531 loetakse bait-baidilt nagu enne; 21 muutub ja ühtegi sihtkohta ei jää. Üksuste arv ei muutu üheski.
- **Üksus üksuse haaval, varasema lugejaga võrreldes:** 21 akti 4186 tekstiüksusest muutub 328 ja iga muutunud üksus on täpselt varasem tekst ilma sihtkoha reata. Muutmismärked loetakse samade sätete juurde ja samade kuupäevadega.
- **Teadmiskaardid:** kahe sotsiaalhoolekande seaduse redaktsiooni kaartidel nihkus 60 ankrut (28 ja 32). Iga uus koht on täpselt see, mille annab varasem tekst ilma sihtkohtadeta; ühegi tsitaadi sõnu ei muudetud. Teiste aktide kaardid jäid paika.
- **Indeksi aktid** (`rag-v2-reader-compare`, sülearvuti hoidla = serveri korpus v58): 523 aktist 502 samad, 21 erinevad.
- **Kohalik sisestusproov** (21 akti, avaldamata): takistusi ei ole; 4547 lõigust on **354 uue embedding'u sisendiga, 190 837 tokenit**. Sama tekst mitmes redaktsioonis ostetakse üks kord, seega tegelik ost on väiksem või võrdne.
- `tests/rag-v2-link-targets.test.mjs` (5 testi): sotsiaalhoolekande seaduses ei ole ühtegi sihtkohta ja lingi sõnad on alles; lingita akt loetakse sama räsiga, mis enne muudatust; väljamõeldud akt iga sihtkoha kujuga; kaardi ankur liigub õigesse kohta, juhuslikult leitud tsitaadile ei liigu.
- Kogu testikomplekt 686 läbis, 0 kukkus; sisestuse ja indeksi ühendtestid kohalike teenustega 30/30.

### Mis veel muutus

- **Viidete kuldkomplekt** ([ADR-063](adr-063-checked-relations.md), `tests/evaluation/graph/relation-gold-1.json`) on uuesti loetud: tsiteeritud lausetest kadusid sihtkohad, sotsiaalhoolekande seadusel on üks lõik vähem (250) ja kaks viidet, mis langesid sihtparagrahvi esimesest lõigust välja, langevad nüüd sinna (22; ADR-063 arv 24 on loetud v30-ga).
- **Õigusaktide manifest** (`docs/rag-v2/legal-acts-in-index.json`) on 04.10 seisuga ja vananenud (perekonnaseaduse vana versioon). Uuendatakse koos korpuse täiendusega.

## Korpus v59 (05.10.2026 kell 18.54)

Omaniku luba samal päeval, küsitud ulatuse ja ülempiiriga (umbes 77 sisendit, ülempiir 0,02 USD), vastus „Jah, tee v59“.

- **Sisestus:** 21 akti uuesti (sülearvuti hoidla, [runbook](runbook-corpus-increment.md)): takistusi ei olnud, kolm tavapärast teadmiskaartide hoiatust; iga nihutatud ankur läbis sisestuse ankrukontrolli. Dokumente ei lisandunud ega kadunud (7305), iga akt sai sama dokumendi uue versiooni.
- **Ost:** tasuta plaan näitas 77 sisendit (kaitse piir 80): **77 sisendit, 41 332 tokenit, 0,0054 USD**. Akti kaupa loetuna oli uusi sisendeid 354; sama tekst mitmes redaktsioonis osteti üks kord.
- **Indeks** `2e4b3572`: 7305 dokumenti, 42 154 lõiku (enne 42 160; sotsiaalhoolekande seaduse kuuel redaktsioonil on igaühel üks lõik vähem). Vestlusplaan `/etc/sotsiaalai/m4-corpus-chat-20261005d.json`.
- **Kontroll töötavas indeksis (ainult lugedes):** 537 õigusakti dokumenti, 14 515 lõiku, lingi sihtkohaga lõike 0 ja tekstiüksusi 0 (enne 342 lõiku). Lugeja sildid: 502 akti v30, 21 akti v31, 14 lisa v29. Plaan on valmis (`rag-v2-plan-release.mjs ready`), teenus töötab.
- **Õigusaktide manifest** (`docs/rag-v2/legal-acts-in-index.json`) on uuesti koostatud korpuse v59 seisuga (523 akti, 7305 poliitika dokumenti); enne oli see 04.10 seisus.

## Mõõtmata

- Mudeliga ei mõõdetud midagi: muudatus eemaldab tekstist müra ega lisa ühtegi sõna. Kas vastused nendest seadustest paranesid, ei ole näidatud.
- Embedding'u vektorid muutusid 77 lõigul; otsingu järjestuse muutust ei mõõdetud.
