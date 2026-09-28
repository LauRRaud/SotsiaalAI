# ADR-044 — Kuupäevavahemik ja koha eitus

28.09.2026. Teostus Claude Opus 5.5. Parandab Codexi järelkontrollis leitud puudused ([audit §14](../audits/rag-v2-codex-review-2026-09-27.md#14-pr-ide-236240-järelkontroll-2809)) [ADR-041](adr-041-exact-dates.md) kuupäevade ja #237 eituse reeglis ning hindajas.

## Probleemid

1. **Päevadega vahemik muutus kaheks üksikuks päevaks.** „Mis muutus 01.01.2027–31.03.2027?“ lubas ainult 1.1 ja 31.3. Redaktsioon, mis kehtis vaid vahepeal (veebruar–märts), jäi välja. Sama ISO-vahemik töötas.
2. **Iga eitus kolme sõna sees tähendas koha eitust.**
   - „Ma ei saa Tallinnas abi.“ eitab abi saamist, mitte kohta.
   - „Ma ei tea. Elan Tallinnas.“ on eitus teises lauses.
   - Mõlemal juhul kadus Tallinn ja omavalitsuse kataloog jäi kasutamata.
3. **Hindaja lubas teisel seadusel tõendada kehtivust.** Vale SHS-i redaktsioon koos mõne teise, küsitud päeval kehtiva seadusega läbis nii `found_valid_on`-i kui ka `valid_on`-i. Ka 31.10.2026 aususe muster lubas väljamõeldud tasu, kui samas vastuses oli mõni muu kahtlus.

## Otsus

- **Vahemik enne üksikkuupäevi** (`retrieval-plan.js`). Üks periood tekib, kui:
  - kaks täielikku kuupäeva on ühendatud kriipsu või sõnaga „kuni“ / „until“ / „to“ / „до“ / „по“;
  - aasta on ainult lõpus: „01.01.–31.03.2027“, „1. jaanuarist kuni 31. märtsini 2027“;
  - eesti käänded ütlevad seda ise: „jaanuarist märtsini 2027“;
  - kuud on kirjas inglise või vene keeles: „January to March 2027“, „с 1 января по 31 марта 2027“.

  Selline periood (`precision: 'range'`) ei ole ajakirjade avaldamisperiood. Kaks kuupäeva ilma sidesõnata („1. jaanuaril ja 1. aprillil“) jäävad kaheks päevaks, nagu võrdluses peab. Tagurpidi vahemik ei ole kuupäev.
- **Koha eitus ainult koha kohta** (`record-scope.js`). Koht on eitatud, kui:
  - vahetult tema ees on partikkel („mitte“, „pole“, „not“, „не“); vahele tohivad jääda täitesõnad nagu „enam“, „praegu“, asesõnad, „in“ või „в“;
  - või tema ees on eitatud elamise tegusõna: „ei ela (ma) enam“, „don't live in“, „не живу в“.

  Muu eitatud tegevus jätab koha alles: „ei saa Tallinnas abi“, „ei leia Tallinnas tööd“. Eitus ei ulatu üle lause või koma piiri. Endiselt kehtib: „Tartu vallas, mitte Tartu linnas“ annab Tartu valla ja „Ma ei ela enam Tallinnas“ ei vali ühtegi omavalitsust. „Mitte ainult Tallinnas, vaid ka Narvas“ jätab mõlemad kandidaadiks; varem kadus Tallinn.
- **Hindaja hindab iga akti eraldi** (`conversation-eval.js`), sest ühe akti redaktsioonidel on sama pealkiri.
  - `found_valid_on`: igal oodatud aktil (`evidence`-mustrid, nende puudumisel `cited`-mustrid, muidu kõik leitud aktid) peab olema leitud redaktsioon, mis küsitud päeval kehtib.
  - `valid_on`: igal viidatud aktil peab olema viidatud redaktsioon, mis küsitud päeval kehtib. Sama akti tänane redaktsioon võib kõrval olla võrdlusena.
- **Kataloog v3** (`scenarios-corpus-3.json`) on v2 (kaks korda jooksutatud, jääb muutmata) ühe rangema kontrolliga. 31.10.2026 kohta peab ebakindlus olema samas lauses kui see päev, ja sellele päevale ei tohi anda tasu (`must_not`). Käivitaja kasutab vaikimisi v3-e.

## Kontroll

- **`tests/rag-v2-legal-scope.test.mjs`:**
  - kuus vahemiku kuju (numbrid kriipsuga ja tühikutega, aasta lõpus, „kuni“, käänded, ISO) jätavad alles jaanuari ja veebruari–märtsi SHS-i redaktsiooni koos tänasega;
  - võrdluse kaks päeva ja tagurpidi vahemik;
  - vahemik pole avaldamisperiood;
  - koha eitus viie jaatava ja nelja eitava lausega.
- **`tests/rag-v2-record-scope.test.mjs`, päris EstNLTK:** „ei saa Tallinnas abi“, „Ma ei tea. Elan Tallinnas.“, „ei leia Tallinnas tööd, elan seal“, „pole enam“ ja „ei ela ma enam“; 3/3.
- **`tests/rag-v2-conversation-eval.test.mjs`:**
  - Codexi sond: vale SHS koos teise kehtiva seadusega on otsingu- ja vastuseviga;
  - võrdlus sama aktiga läbib;
  - v3 lubab kolme jooksu ausad vastused, aga mitte väljamõeldud tasu.
- **Jooksu 3 salvestatud vaatlused hinnati uue hindajaga uuesti, ilma mudelikutseta:** v2-ga ja v3-ga 38/40. Kuupäevapöörded viitavad küsitud päeval kehtivale SHS-i ja RLS-i redaktsioonile.
  - See on endiselt hindaja tulemus, mitte sõltumatu kinnitus iga vastuse sisulisele õigsusele.

## Piirid

- Mõlemad reeglid on süntaksipõhised. Kuupäevavahemik, mille aasta on alguses („2027. aasta jaanuarist märtsini“), ja suhteline aeg jäävad välja.
- Koha eitus tunneb ainult elamise tegusõnu ja partikleid. Tuvastamata jääb näiteks „Tallinn ei ole minu elukoht“.
