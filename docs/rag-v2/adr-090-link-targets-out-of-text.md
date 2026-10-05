# ADR-090 — Lingi sihtkoht ei ole akti tekst

05.10.2026. Teostus Claude Opus 5.5. Omanik 05.10: „Eemalda lingi sihtkohad seaduste lõikude tekstist“. Lähtekoht: [ADR-088](adr-088-version-comparison-on-the-server.md) kõrvalleid.

**Lugeja on muudetud ja kontrollitud tasuta (jaotis „Kontroll“). Indeksis on aktid endiselt vana tekstiga, kuni need uuesti sisestatakse: see vajab embedding'u ostu (354 sisendit, umbes 0,025 USD) ja omaniku luba.**

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

## Järgmine samm: korpus v59 (tasuline, vajab luba)

- 21 akti uuesti sisestamine ([runbook](runbook-corpus-increment.md)): avaldamine sülearvuti hoidlas, pakk serverisse, embedding'ute ost, indeks, vestlusplaan.
- **Ost:** kuni 354 sisendit, 190 837 tokenit, umbes 0,025 USD.
- Dokumente ei lisandu ega kao: iga akt saab sama dokumendi uue versiooni.
