# ADR-118: toimetamismärge ei jõua vastuse teksti; stsenaariumitest saab kasutaja rolli

Kuupäev: 09.10.2026. Teostus Claude Opus 5.5. Omanik: „nii, tegutseme edasi“; „panin sulle ultracode, kui soovid rag süsteemi kiiremini edasi arendada“. Seis: **kood ja testid tehtud; midagi ei ostetud.**

## Kust see tuli

Lasin agentidel läbi lugeda otsuste ja auditite „lahti“ ja „kontrollimata“ osad (ADR-070 kuni ADR-116, oktoobri auditid, üleandmise märkused) ja kontrollida koodist, mis on tegelikult veel lahti. Iga lugeja tulemuse vaatas üle teine, kelle ülesanne oli väited ümber lükata. Sain 15 lahtist viga koos parandamise kohtadega. See otsus parandab neist kaks, mis ei vaja tasulist mõõtmist. Ülejäänud on üleandmise märkuses.

## 1. Toimetamismärge vastuse tekstis

**Probleem.** Kahes salvestatud vastuses umbes neljakümnest mõõdetust oli lugejale nähtavas tekstis vastava mudeli toimetamismärge: ühes viis korda „[citations omitted]“, teises „[Remove?]“ ([ADR-099](adr-099-official-studies-and-guides-by-list.md), 07.10.2026). Põhjust ei leitud ja miski seda ei kontrollinud: vastuse kontroll lasi mõlemad muutmata läbi.

**Otsus.** Vastuse kontroll (`validateAnswer`, `lib/rag-v2/pilot/contracts.js`) võtab sellise märke tekstist välja (`withoutEditorMarks`): vastus jääb, märge läheb. Sama tehakse juba lõiku lõpetava viitetunnuste reaga. Reegel kehtib vastuse plokkidele, piirangutele ja täpsustavale küsimusele ning ainult kehtiva vastuseversiooni kohta.

Loend on suletud. Välja läheb terve nurksulg, mille sisu on:

- ingliskeelne toimetamisküsimus: „Remove?“, „Delete?“, „Omit?“, „Cut?“, „Drop?“, „Keep?“;
- märkus, et viited, allikad või joonealused on välja jäetud või eemaldatud: „citations omitted“, „references removed“, „footnote omitted“, ka „internal citations omitted“.

Koos märkega läheb tühik selle ees; rida, millel oli ainult märge, läheb tervenisti. **Ühtegi teist nurksulgu ei puudutata:** õigusakti „[RT I, …]“, „[nimi]“, „[1]“, „[…]“, „[sic]“, korjaja „[e-post eemaldatud]“, ka eestikeelne „[viited välja jäetud]“ jäävad nii, nagu on.

Kui tekst oli ainult märge, ei ole see tekst: vastus lükatakse tagasi nagu tühi plokk.

**Miks eemaldada, mitte tagasi lükata.** Tagasi lükatud vastus tähendab, et inimene näeb „Vastust ei avaldatud“ pärast seda, kui plaan, valik ja vastus on makstud; märkega vastus oli võrdluses oma paarist kasulikum. Märge ei ole allika sõna ega väide.

**Mida see ei tee.**

- Vastuse voos võib märge hetkeks vilkuda: tekst voogedastatakse enne kontrolli ja valmis vastus asendab ajutise. Voogu ei muudetud.
- Põhjust ei kõrvalda. Juhiste rida, mis keelaks sellised märkused, vajaks uut juhiste versiooni ja tasulist mõõtmist.
- Enne seda reeglit salvestatud vastust ei kirjutata ümber, kuid seda näidatakse ilma märketa (kontroll loeb salvestatud vastust iga kord).

## 2. Stsenaariumitest saab kasutaja rolli

**Probleem.** Kontrollstsenaariumide käivitaja (`scripts/rag-v2-conversation-eval.mjs`) kutsus vestlusteenust ilma rollita; päris vestlus võtab rolli sisselogitud kontolt. Spetsialisti või teenuseosutaja vestlust ei saanud seetõttu hoidla enda vahendiga korrata ([ADR-107](adr-107-user-role-reaches-the-models.md), „Mis jääb lahti“).

**Otsus.** Stsenaarium võib nimetada rolli (`role`: `specialist`, `help_seeker` või `service_provider`); käivitaja saadab selle iga pöördega ja aruanne nimetab selle. Rollita stsenaarium käib nagu enne. Tundmatu roll on kataloogi viga enne, kui midagi käivitatakse.

## Kontrollitud

- Ühiktestid (värske põhiharu peal): 1235, neist 1213 läbi ja 22 vahele jäetud; ESLint muudetud failidel. Kuus uut testi: märge läheb koos tühikuga, ainult märget hoidnud rida läheb; ükski teine nurksulg ega sõnastus ei muutu; kehtiva versiooni vastus avaldatakse märgeteta plokkides, piirangutes ja küsimuses, mudeli mustand jääb muutmata, avaldatud vastus loeb end uuesti samaks; ainult märkest koosnev tekst lükatakse tagasi ja varasema versiooni vastus jääb nagu oli; enne reeglit märkega salvestatud vastust näidatakse ilma märketa; stsenaariumi roll (teenuse rollid või puudub).
- Agentide eelkontroll (enne koodi): vastuse kontroll käib ka salvestatud vastuse igal lugemisel, nii et reegel peab olema sama tulemusega korduval rakendamisel (on); väljalase uuendab plaani, nii et enne väljalaset salvestatud ridu uue koodiga uuesti ei projitseerita.

## Kontrollimata

- Päris vastus, milles mudel märke kirjutab: märke teke on juhuslik (2 umbes 40-st) ja selle esilekutsumine vajaks tasulisi küsimusi.
- Rolliga stsenaariumi päris käivitus (tasuline).
- Kui sageli märkeid tekib: loendamist salvestatud vastustest ei tehtud.
