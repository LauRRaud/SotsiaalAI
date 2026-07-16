# VEST-P0 kriisiraja fail-safe parandus

Staatus: valmis sõltumatuks kriisiohutuse auditiks.

## Töö alus

- Worktree: `C:\Users\rauds\Desktop\SotsiaalAI-vest-p0-crisis-failsafe`
- Haru: `codex/vest-p0-crisis-failsafe`
- Alus: `origin/main` @ `2a63fcd0c822709fb013b5b9d9706e5b58f4f18c`
- Põhitööpuud ei muudetud.
- Merge'i ega deploy'd ei tehtud.

## Teostus

### L1a — serveri kriisivastus ja püsistus

- Lisatud ET/EN/RU kriisi-no-context vastus, mis sisaldab vähemalt hädaabinumbrit 112; eestikeelses variandis ka 116 111 ja 116 006.
- Kriisiolukorras ei saa tühi mudeli- ega RAG-vastus enam jätta assistendi lõppvastust tühjaks.
- Kriisi fallback püsistatakse assistendi sõnumina koos `isCrisis` metaandmega.
- Tavavestluse senine no-context käitumine jäi muutmata.

### L1b — tegeliku kriisiseisundi edastamine töövoogudes

- Abi- ja dokumenditöövoog saavad nüüd päringu tegeliku `isCrisis` väärtuse.
- Sama väärtus säilib dokumendist abitöövoogu ümberlülitumisel, lõppvastuse koostamisel ja püsistamisel.
- Töövoo enda sisuline vastus säilib; kriisibänner lisandub ohutuskihina.

### L1c — kliendi fail-safe olek

- Uue päringu algus ei kustuta enam aktiivset kriisiseisundit ennetavalt.
- HTTP-, voogedastus- ja ühendusvead säilitavad viimase kinnitatud kriisiseisundi.
- Voogedastuse `isCrisis: false` rakendub alles eduka `done` sündmuse järel.
- Serveri hüdratsioon ei kustuta kohaliku uuema kriisipöörde hoiatust enne, kui serveris on sama kasutajapööre ja sellele järgnev assistendi vastus.
- Edukas mittekriisi vastus ja teadlik vestluse vahetus saavad seisundi endiselt nullida.

### L4 — regressioonikaitse

- Lisatud kriisiraja sihttestid serveri fallback'i, püsistuse, töövoogude, API, hüdratsiooni ning voo-/veaolukordade jaoks.
- Lisatud kitsas Node'i testilaadur `server-only` mooduli testimiseks; tootmiskoodi käitumist see ei muuda.

## Kontrollid

- Kriisiraja sihttestid: 11/11 läbitud.
- Kriisiraja ja API kasutuslepingu koondtest: 15/15 läbitud.
- Täielik testikomplekt: 1248/1248 läbitud, 0 ebaõnnestumist, 0 vahelejätmist, 0 TODO-d.
- i18n kontroll: läbitud kõigi keelte jaoks.
- Muudetud sihtfailide lint: läbitud vigadeta.
- Täislint: läbitud, 0 viga; 358 olemasoleva ulatusega hoiatust.
- Tootmisbuild: läbitud Next.js 16.2.10 Turbopack build'iga.
- Prisma skeemi ja migratsioonide diff: tühi.
- `git diff --check`: läbitud.

## Käituskontroll

Kontroll tehti eraldi sünteetilise administraatorkasutajaga kohalikus arendusserveris, kus OpenAI võti puudus ja RAG suunati tahtlikult mittetöötavale aadressile.

- Põhivestluse vägivalla/kriisi päring tagastas HTTP 200, `isCrisis: true` ja eestikeelse fallback'i numbritega 112, 116 111 ja 116 006.
- F5 järel jäid kriisibänner ja püsistatud vastus nähtavaks.
- Abitöövoog säilitas oma sisulise vastuse, kuid kandis samaaegselt `isCrisis: true` ja kuvas 112 hoiatuse.
- Sihilik HTTP 502 säilitas olemasoleva kriisibänneri nii vea järel kui ka järgneval lehevärskendusel.
- Kontrollpäring `Tere` jäi mittekriisiliseks.
- Mittetöötava RAG-iga mittekriisi no-context vastus püsistus tavapäraselt ning `isCrisis: false`.
- Edukas järgmine mittekriisi vastus eemaldas kriisibänneri.

## Puhastus ja üleandmine

- Sünteetiline kasutaja ning kõik tema logid, vestlused, sõnumid, seansid ja ajutised sisselogimistunnused kustutati; järelkontrolli loendurid olid 0.
- Kohalik server peatati ja port 3100 vabastati.
- Brauseri-, build'i-, Prisma generaatori- ja sõltuvuste käitusjäljed eemaldati enne commit'i.
- Teostus antakse üle ühe commit'ina; täpne commit SHA ja auditivahemik esitatakse lõpparuandes.
