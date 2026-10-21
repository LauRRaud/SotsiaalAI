# GOV-01 — Vastuvõtu ja andmetöötluse kokkulepped: mustandi ja tegeliku käitumise võrdlus

Seis 21.10.2026 (Claude, `sol-proof-20261014-01`). Võrreldakse 12.10 raamlepingu mustandit
([mustand](../../../legal/sotsiaal-pro-organisatsioonikasutuse-raamleping-MUSTAND-2026-10-12.md), lisad 2, 3 ja 5)
Soli katsete tegeliku tulemusega. Lepingu olemasolu ja õiguslik sobivus on eraldi olekud: allkirja, katsepartneri
otsust ega õigus- või andmekaitsehindaja kinnitust ei ole, ja ükski tehniline PASS seda ei asenda. Sotsiaal.pro ei anna
asutuse eest kasutusluba. Midagi ei saadetud.

## Andmevood: mustandi lubadus ja katse

| Andmevoog (lisa 2) | Vastutav / volitatud (mustand) | Mustandi lubadus | Katse tulemus | Seis |
|---|---|---|---|---|
| Inimese privaatne Teekond enne üleandmist | Erakasutus, ei kuulu lepingu alla | Organisatsioon ei näe lähtevestlust, märkmeid ega saatmata materjali | Võõra Teekonna lugemine, eksport ja muutmine keelati kõigis rollides (DATA-01, 8 varianti) | Kooskõlas |
| Organisatsioonile saadetud eelpöördumise koopia | Saaja organisatsioon / Sotsiaal.pro | Ainult saadetud koopia | Saaja näeb saadetud koopiat; autori kustutamise järel jääb koopia nähtava märkega (DATA-04) | Kooskõlas; säilitustähtaeg on lisas 5 „Rakenduslisas määratud“ — **lahtine** |
| Vastuvõtulaud | Organisatsioon / Sotsiaal.pro | Saatja näeb seisu ja avamise päeva, mitte avaja isikut; keeldumine ja lõpetamine selgitusega | Koordinaator ei saa vastuvõttu võltsida ega töötaja eest vastu võtta (OPS-01, 9 PASS); tagasilükkamise ja lõpetamise selgitus jõuab pöördujani (OPS-08, 4 PASS); 21.10 parandusest alates näeb pöörduja „asutus avas”, mitte „vastu võetud” | Kooskõlas (pärast A3 parandust) |
| Tööheaolu privaatne kirje ja koond | Sotsiaal.pro eraldi vastutav / koondi saaja | Organisatsioonil puudub ligipääs algkirjele; minimaalne valim | Võõras ei näe kirjet; väike grupp peidetud ja lisalahtritega ei tuletata (DATA-06, 8 PASS) | Kooskõlas; valim ja periood Rakenduslisas — **lahtine** |
| Kovisiooni privaatne ettevalmistus ja ühine ruum | Sotsiaal.pro eraldi vastutav / osalejate järgi | Privaatne ei muutu automaatselt ühiseks | Teemaseeme jäi privaatseks kuni omaniku teadliku jagamiseni; kutsutu ei näe juhtumi pealkirja enne kokkulepet (TOOLS-03) | Kooskõlas; mitme organisatsiooni rollid — **lahtine** |
| Supervisiooni ja mentorluse privaatne märkmik | Sotsiaal.pro eraldi vastutav | Organisatsioonil ja teisel osapoolel puudub ligipääs | Osaleja privaatne märge jäi superviisori ja mentori eest varjatuks (TOOLS-03) | Kooskõlas |
| Tehisaru töötlus | Organisatsioon / Sotsiaal.pro; OpenAI alltöötleja | Ainult vajalik sisu; treeningusse ei lülitata | Väljaminevas päringus ainult jagatud tekst ja avalik tõend, `store: false` (DATA-05) | Kooskõlas; nullsäilitus ja EL-i lõpp-punkt puuduvad — vt [GOV-03](gov-03-turbevaidete-piirid.md) |
| E-kiri | Lisa 3: **[TÄITA]** saatja | Tundlikku sisu e-kirja ei lisata | Saabumiskiri on sisuta; väline kiri vaikimisi sisuta (DATA-03, OPS-04) | Tehniliselt kooskõlas; **alltöötleja nimetamata** |
| Konto kustutamine | Sotsiaal.pro eraldi vastutav | Keskne kustutusprotsess | Kohalikus baasis jäi alles ainult kustutamise arvestus (DATA-04) | Kooskõlas; varukoopiate tsükkel lisas 5 **[TÄITA]** |

## Vastuvõtja, asendaja, reageerimisaja algus ja katkestus

- **Vastuvõtja:** organisatsiooni vastuvõtulaud saab pöördumise aatomaarselt (OPS-01); koordinaator määrab, töötaja
  võtab vastu; pöörduja näeb seisu. Kooskõlas mustandiga.
- **Asendaja:** üleandmine kustutab vana ligipääsu ja nõuab uut vastuvõttu; lahkuda ei saa, kui elav töö on pooleli;
  ainuomanik ei saa lahkuda (OPS-02, 5 PASS).
- **Reageerimisaja algus:** saabumise (`sentAt`, postkasti saabumine) ja vastuvõtu aeg salvestuvad, kuid töö
  tähtaega (`dueAt`) ei saa kasutusrajal määrata (OPS-03 FAIL, MISSING_FEATURE). Seega ei saa platvorm praegu
  reageerimisaja kulgu ega ületamist näidata. Õiguslik tähtaja algus (nt SÜS § 25 lg 1, 10 tööpäeva) on menetluse,
  mitte tarkvara küsimus; vt [GOV-02](gov-02-star-ska-allikad-ja-kusimused.md).
- **Katkestus:** peatatud või mustandiorganisatsiooni ei pakuta saajaks (FLOW-06, 3 PASS); kiireloomulisuse märge
  (OPS-07, 3 PASS). Mehitamata vastuvõtu eskalatsiooni (keegi ei võta vastu) ei testitud; teavitustöö jooksis
  20.10 serveris veaga ja jookseb 21.10 otsusest alates uuesti — kas see serveris roheliseks läks, tuleb kontrollida
  journalist.

## Lahtised küsimused õigus- ja andmekaitsehindajale (saatmata)

1. Kas eelpöördumise saaja organisatsioon on vastutav töötleja juba saabumise hetkest või alles vastuvõtust?
2. Milline on saadetud eelpöördumise koopia säilitamise tähtaeg, kui saaja seda ametlikku süsteemi ei kanna?
3. Kas tehisaru töötlus väljaspool EMP-d (globaalne lõpp-punkt, väärkasutuse logi kuni 30 päeva) on
   eriliigiliste andmete puhul lubatav ning milline edastuse mehhanism kohaldub?
4. Kas kovisiooni ühises ruumis, kus osalevad mitme organisatsiooni töötajad, tekib kaasvastutus (p 6.6–6.7)?
5. Kas privaatse tööheaolu ja refleksiooni moodulis on Sotsiaal.pro eraldi vastutav töötleja põhjendatud, kui
   organisatsioon maksab litsentsi eest?
6. Kas e-posti saatja, varundus- ja seireteenuse ning TartuNLP rollid tuleb enne pilooti lisas 3 täita?
7. Milline on mehitamata vastuvõtu korral (keegi ei võta pöördumist vastu) kokkulepitud eskalatsioon ja kes vastutab
   pöörduja teavitamise eest?
