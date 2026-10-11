# Projekti tööjuhis

## Alustamine ja seis

- Loe `docs/platvormi arendus/SotsiaalAI.md`-st S1.0 ja ainult ülesandega seotud sektsioon. S11 sisaldab keskkonna lisajuhiseid. Ära loe kogu faili ega juba loetud juhiseid uuesti ilma vajaduseta.
- Kontrolli `git status` ja `git log -1`; määra muudatuse ulatus ning vajalik tõend enne koodi. Serveri või `origin/main`-i kohta väites mõõda nende tegelik seis.
- Aktiivset tööd kannab ainult `SotsiaalAI.md`. Töö lõpus uuenda muutunud teemaseisu ja vajadusel S1.0 lühidalt; tehnilised tõendid jäävad vastavasse raportisse või commit'i. Eraldi seisu-/handoff-faile ei looda. Pilvesessioon kirjutab seisu commit'i sõnumisse ega muuda `SotsiaalAI.md`-d, et paralleelsed tööd ei läheks selles failis konflikti.

## Töö ja Git

- Omaniku arendusülesanne annab loa selle täitmiseks vajalikele kohalikele ja tagasipööratavatele muudatustele. Vali olemasoleva arhitektuuriga sobiv lahendus, teosta see ja kontrolli tulemust; ära peatu iga tavapärase teostusotsuse juures kinnituse küsimiseks.
- **Töö käib ainult `main`-harul; kõrvalharusid ei tehta (omaniku otsus 12.10.2026).** Ükski seanss ei lükka GitHubi muud haru kui `main` ega ava PR-i. Tee commit värske `origin/main`-i peale ja lükka see otse: `git fetch origin main`, `git rebase origin/main`, `git push origin HEAD:main`. Kui lükkamine lükatakse tagasi, sest `main` liikus vahepeal, korda samu kolme sammu; sundlükkamist ei kasutata. Rakenduse tehtud tööpuu ja selle kohalik haru on ainult seansi töökoht: seda haru ei lükata GitHubi ja pärast töö lõppu see kustutatakse. Põhikaustas kirjutab korraga üks; teised seansid töötavad oma tööpuus. Kui keskkond ei luba `main`-i otse lükata, ütle seda omanikule ja ära tee haru. Alamagente ei kasutata.
- Säilita teiste pooleliolev töö. Stage'i ainult nimelised üle vaadatud failid; `git add .` ja `git add -A` on keelatud.
- Tee sidus muudatus olemasoleva arhitektuuri järgi. Väldi ülesandega mitteseotud ümberkirjutusi ja laia repo-uurimist.
- Lükkamine `main`-i ei vaja omaniku luba, kui muudatuse kontrollid on läbitud. `main`-i ajalugu ei kirjutata ümber (force-push, rebase avaldatud commit'idel).
- Iga lükkamine `main`-i käivitab värava ja selle järel paigalduse; PR-i ega liitmist vahel ei ole. Skeemi, õiguste, maksete, privaatsuse või kriisiabi muudatusel nimeta commit'i sõnumis risk ja tehtud kontroll.
- Deploy: GitHub ehitab `main`-i tootmisartefakti üks kord; `deploy` paigaldab sama SHA artefakti serverisse. Serveris ei korrata build'i, lint'i ega teste. Serveris töötab korraga üks frontend: failide ettevalmistus → senise protsessi peatamine → uue käivitamine → töövalmiduse kontroll; vea korral eelmine versioon tagasi. Paralleelset uut rakendust ei käivitata. Käsitsi `npm run deploy:server` käivitab sama GitHubi avaldamisraja ja vajab omaniku selget luba. Juba antud luba kehtib kokkulepitud ulatuses; ära küsi uuesti. Päris sõnumite saatmiseks on samuti vaja selget luba.
- Tasuliste teenuste kasutamisel järgi kokkulepitud ulatust ja kulupiiri. Uus tasuline teenus või kokkuleppimata mahutöö vajab eraldi kokkulepet; selle puudumine ei peata sõltumatut kohalikku arendust.
- Puuduva tooteotsuse korral tee sõltumatu töö valmis ja küsi ainult vajalik otsus. Lahenda tagasipööratavad teostusvalikud ise ning nimeta oluline eeldus tulemuse juures. Jätka ülesande piires järgmise vajaliku sammuga, kui takistus puudutab ainult üht tööosa.
- Commit'i sõnum selgitab parandatavat probleemi ja lahenduse põhjust.

## Kontrollid

AI valib muudatuse järgi väikseima vajaliku kontrolli. Kiirus ja tavakasutajate töö säilimine on eesmärk; täislint, kõik testid, kaks build'i ega muu üldine kontrolliring ei käivitu automaatselt iga muudatusega. Dokumentatsioonimuudatus ei vaja teste ega build'i.

**Täisring jookseb üks kord GitHubis, mitte iga seansi juures.** `main`-i värav (`quality-gate`) jooksutab pärast lükkamist ehituse kõrval kogu repo lint'i, tõlgete kontrolli ja alles jäetud 12 testifaili (umbes kolm minutit); `deploy` käivitub ainult siis, kui kõik kolm on rohelised. Ära jooksuta enne seda `npm test`-i, `npm run lint`-i ega kohalikku build'i. Pärast lükkamist vaata värav üle; kui see läks sinu muudatusest punaseks, paranda kohe, sest punane `main` peatab kõigi paigalduse.

**Muudatuse kontroll on keel ja süntaks.** `npm run i18n:check` (kolm sekundit; kui muutus tekst või tekstivõti) ja `npx eslint <muudetud failid>`. Värav teeb sama kogu repole ja ehitab rakenduse. Uue töö juurde unit-teste ei kirjutata ega nõuta. See on omaniku otsus 11.10.2026: „kustuta jah kõik nii, et ma saan pärast lihtsalt keele ja süntaksi testi teha, ja vajadusel veel mõned“. Samal ööl kustutati 309 testifaili 321-st (`docs/audits/testide-ulevaatus-2026-10-11.md`); need on Giti ajaloos alles.

**Kaustas `tests` on 12 testifaili ja need jäävad.** Need valvavad kohti, kus vaikne viga tähendaks päris kahju: raha (`rag-cost`, `rag-v2-corpus-run`, `rag-v2-capacity`), isikuandmed ja turve (`privacy-check`, `same-origin-request`), kriisiabi (`rag-v2-pilot-crisis-route`), andmete kustutamine ja hoidla (`deletion-completeness`, `deletion-with-retired-index`, `rag-v2-store-pack`), paigaldus (`deploy-plan-release`) ja keel (`server-message-keys`, `call-error-text`). Kui muudad koodi, mida üks neist katab, jooksuta see fail. Uue testi lisad ainult siis, kui muudatus puudutab sama liiki kahju (raha kulu, võõraste andmete nägemine, andmete kadu) või kui omanik seda küsib. Test kutsub koodi ja võrdleb tulemust; lähtekoodi faili teksti test ei kinnita.

- Tasulised mudelitestid ega eraldi AI-hindamisring ei ole arenduse või töö valmimise nõue. Ära lisa neid kohustuslikuks järgmiseks sammuks ega peata tööd nende loa ootamiseks. Kasuta tehnilise käitumise kontrollimiseks brauserit, kohalikku käivitust ja olemasolevaid tõendeid; kirjelda ausalt sisulise kvaliteedi kontrollimata osa.
- Vajadusel JS/JSX lint ainult muudetud failidel: `npx eslint <failid>`.
- Üks alles jäetud testifail: `node --import ./scripts/register-node-source-loader.mjs --test tests/<fail>`. Kogu komplekt (`npm test`) on värava töö.
- Tõlgete kontroll vajadusel: `npm run i18n:check`.
- Prisma skeemi/migratsiooni korral vali vajalik kontroll (`npx prisma validate` või proov eraldatud andmebaasis). Migratsioon peab sobima ka eelmise rakenduse versiooniga; destruktiivne muutus vajab eraldi andmesäilituse ja ülemineku lahendust. Serveris rakendatakse ainult muutunud migratsioonikomplekte, piiratud lukuaegadega.
- Iga muudatus: `git diff --check`; enne commit'i ka stage'itud diffi kontroll.
- Käitumise muutus: kontrolli seda brauseris või päris keskkonnas ja ütle raportis, mis jäi kontrollimata. Õiguste, privaatsuse, maksete, skeemi ja võistlusolukordade puhul tõenda konkreetne risk.
- Väike madala riskiga CSS/UI-parandus: piisab `git diff --check`-ist ja sihitud brauserikontrollist; kogu repo lint'i, i18n-kontrolli ega kohalikku build'i ei käivitata, kui muudatus nende pinda ei puuduta.
- Järjestikused visuaalsed täpsustused koonda ning tee vajalik laiem värav üks kord stabiilse tulemuse järel, mitte iga väikese paranduse vahel.
- Tootmisbuild tehakse GitHubis üks kord. Kohalik build või `npm run build:webpack` on AI valikul ainult konkreetse ehitusriski uurimiseks; neid ei nõuta iga muudatuse puhul. `NEXT_PUBLIC_*` ehitusväärtused asuvad `config/production-public-env.json`-is ja peavad vastama serveri avalikule konfiguratsioonile.

Ära korda sama muutumatu koodi läbitud kontrolle dokumentatsiooni või commit'ide jaotuse pärast. Ajatundlikud kontrollid käivita `TZ=UTC` all. Testi või build'i edu ei tõenda kontrollimata runtime'i: märgi see `not_run`/`NOT_PROVEN`.

## Keskkond

- Dev-server: `npm run dev` (port 3000). Kasuta juba töötavat serverit; ära tapa võõrast protsessi ega käivita sama kausta duplikaati.
- Kasuta eraldatud testandmeid. Ära loe tootmiskasutajate sisu ega kasuta päris kasutajaid testimiseks. Saladusi ei kirjutata koodi, raportitesse ega logidesse.
- Admini RAG-i käsitsi käivitatav enesetest on tootefunktsioon ja peab säilima.
- GraphRAG-tuuma hoia kliendist sõltumatuna; kliendi eripärad kuuluvad konfiguratsiooni või adapterisse. Allika nime/ID või oodatud vastuse järgi runtime-erandeid ei lisata.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
