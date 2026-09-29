# ADR-048 — Kuhu kulub aeg enne vastuse esimest teksti

29.09.2026. Mõõtmine ja ettepanek: Claude Opus 5.5 omaniku päevaplaani järgi („mõõda, kuhu 13–28 s enne esimest teksti kulub; kavanda lahendus koos Codexiga ja mõõda enne PR-i“). **Otsus on veel tegemata:** vastuse arutluse tase on omaniku otsus, lahendus vajab Codexi ülevaatust.

## Mõõtmine

Kõik ajad on serveris salvestatud pööretest (`timings`, `events`) või samade päringute kordusest. Küsimuste ja vastuste teksti ei loetud.

### 1. Aknas tehtud pöörded 28.09 (10 voogesitatud pööret)

Codex mõõtis samad pöörded samal hommikul täpsemalt, sh pakkuja voo esimesed baidid ja esimese tekstidelta ([audit](../audits/rag-v2-first-text-timings-2026-09-29.md)). Tulemus on sama. Arutlustaseme mõju ja kvaliteet jäid seal tõendamata (NOT_PROVEN); neid mõõdavad allpool jaotised 3 ja 4.

Esimene nähtav tekst tuli **12,7–27,5 s** järel, mediaan 16,3 s. Aeg jaguneb nii (mediaan, vahemik):

| Samm | Aeg | Mis seal on |
|---|---:|---|
| Otsinguplaan | 2,5 s (2,0–3,0) | mudelikutse, arutlus `low` |
| Embedding | 1,0 s (0,3–1,9) | üks OpenAI kutse küsimusele ja plaani päringutele |
| Otsing | 4,4 s (4,0–5,3) | sellest rerank'i mudel 1,4 s (1,1–2,5), sõnaline otsing 1,2 s |
| Vastusemudel kuni esimese tekstini | 8,8 s (4,8–19,7) | arutlus `medium` enne esimest väljundit |

Esimesed kolm sammu võtavad kokku umbes 8 s ja on ühtlased. **Kogu erinevus tuleb vastusemudeli arutlusest.**

### 2. Kõik 311 vastusekutset 28.09 (`medium`)

- Vastusekutse mediaan 11,1 s, P90 19,4 s.
- Arutlustokeneid mediaan 1091, P90 2159.
- Sobitus: **aeg ≈ 1,7 s + 6,7 ms × arutlustoken + 4,5 ms × nähtav väljundtoken.** Arutlus kulgeb umbes 150 tokenit sekundis ja kogu see aeg on enne esimest teksti.
- Sisendi suurus arutlust peaaegu ei mõjuta (r = 0,22; üle 15k sisendtokeni mediaan 1175, alla selle 1030). Tõendipaketi vähendamine seda aega ei lühendaks.

### 3. Sama päringu kordus: teenustase ja arutluse tase

Kaheksa kataloogipöörde salvestatud vastusepäring (`requestAudit.body`) saadeti uuesti voona, igaüks kolmel kujul. Kulu umbes 0,04 USD.

Codex arvutas tulemuse uuesti esimese tekstidelta järgi, kõigil 24 real sama mõõdikuga ([analüüs, 7.2](../audits/rag-v2-system-analysis-2026-09-29.md#72-lõpetatud-24-kutse-võrdlus-täpsustab-esialgseid-numbreid)):

| Kuju | Esimene tekstidelta, mediaan | Vahemik | Kutse lõpuni, mediaan | Arutlustokeneid, mediaan |
|---|---:|---:|---:|---:|
| kinnitatud keha (`medium`) | 5,94 s | 2,65–14,78 s | 7,94 s | 810,5 |
| `service_tier: "priority"` | 5,91 s | 2,67–20,80 s | 8,22 s | 747,5 |
| `reasoning.effort: "low"` | 1,52 s | 0,65–3,41 s | 3,50 s | 69,5 |

- **Prioriteedi soov ei muutnud midagi.** API vastas igal kutsel `service_tier: "fast"`, ka ilma seadeta. See pole kahe teenustaseme võrdlus, vaid näitab, et see projekt saab juba sama taseme.
- Jooksja logis `effort` väljale algse keha taseme ka `low` variandil. Rühmitus käib variandi nime järgi.
- Sama päringu arutlus kõigub kordusel tugevalt: üks keha andis 2466 ja 3334 arutlustokenit. N = 8 ei anna usaldusväärset sabahinnangut.

### 4. Kataloog v4 terviklikult, 29.09

Mõlemad jooksud tehti `eval-full` koopiast, mille `lib` on sama mis tootmises (`f0cc994d3`). `low` plaan on aktiveerimata `/etc/sotsiaalai/m4-eval-full-20260929a.json`.

| | `medium` (tootmisplaan) | `low` |
|---|---:|---:|
| Läbinud | **39/40** | 37/40 |
| Otsingust vastuseni, mediaan / P90 | 11,2 / 17,9 s | 3,9 / 6,0 s |
| Kogu pööre kontrollitud vastuseni, mediaan / P90 | 18,6 / 32,0 s | 12,5 / 19,7 s |
| Vastuse pikkus, mediaan | 652 märki | 750 märki |
| Täpsustava küsimusega vastuseid | 23 | 16 |
| Kulu | 0,198 USD | 0,177 USD |

- `medium` kukkus läbi ainult kuuldeaparaadi piirhinnas (ADR-046 allikalünk). **See on päeva baas:** eile oli 38/40, sest kontaktisik puudus enne v35.
- `low` lisaks:
  - `appeal-follow-up` 1: otsing ei toonud haldusmenetluse seadust. Otsingu kutsed on mõlemas jooksus `low`, nii et see on otsingu kõikumine, mitte vastuse arutluse mõju;
  - `care-home-correction` 3: kasutaja parandas pensioni 500 eurolt 700-le, aga vastus ei arvestanud uut summat (700 puudus).
- Hindaja kontrollib ainult piirkonda, allikaid, kontakte ja kohustuslikke sõnu. Sõnastuse kvaliteeti see ei mõõda. Omanik leidis 27.09, et `low` on 2,5 korda kiirem, aga vastused on nõrgemad (`chat-plan.js`).

## Järeldus

- Esimese tekstini kulub umbes 8 s ühtlast eeltööd (plaan, embedding, otsing koos rerank'iga) ja 5–20 s vastusemudeli arutlust.
- Suurim hoob on vastuse arutluse tase: `low` lühendab esimese tekstini jõudmist mediaanis umbes 4–5 s ja sabas üle 10 s. Kogu vastus valmib mediaanis 6 s varem.
- `low` ei lahenda isiku ega otsingu ulatuse vigu (Codex). Ka väga kiire vastusemudeli korral jääb umbes 8 s eeltööd.
- Ülejäänud hoovad on väikesed või riskantsed (allpool).

## Ettepanek Codexile ja omanikule

1. **Vastuse arutluse tase (omaniku otsus).** Mõõdetud vahetus: `low` 37/40 ja 6 s kiirem, `medium` 39/40.
   - Enne otsust tasub vastuseid kõrvuti lugeda: mõlema jooksu vastused on serveris `rag-v2-work/eval-files/corpus4-{base,low}-0929/conversation-eval.md`.
   - Vahevariant oleks `low` ainult lihtsamatele pööretele. Keerukuse hindamine enne vastust on aga uus otsus ja uus viga; selle kasuks praegu tõendit pole.
2. **Olekutekst ootamise ajal (ilma mudelimuutuseta).** Praegu näeb kasutaja 8–20 s ainult ooteanimatsiooni. Voos saab saata sammu teate: „Otsin allikaid…“ → „Valin sobivaid lõike…“ → „Koostan vastust…“.
   - Teenus teab juba samme (`reached('planned' | 'embedded' | 'searched')`), rerank'i algus on otsingu konksus.
   - See ei lühenda aega, aga kasutaja näeb, et töö käib. Vajab `delta`/`done` kõrvale uut sündmust ja kolme keele tõlkeid.
3. **Mida mitte teha:**
   - **Prioriteetne teenindus** — soov ei muutnud teenustaset (vt 3).
   - **Rerank'i vahelejätmine selge otsingu korral** säästaks 1–2,5 s. Rerank valib aga seaduse õige redaktsiooni (ADR-042) ja kulutingimused (ADR-046), nii et see oleks kvaliteedirisk.
   - **Plaani ja embeddingu rööbitamine** säästaks kuni umbes 1 s: küsimuse enda vektori saaks arvutada plaani ajal, aga plaani päringud vajavad ikka teist embeddingut. Sõnaline päring kasutab plaani päringuid, nii et otsingut ei saa enne plaani alustada.
4. **Hiljem, eraldi töö:** sõnaline otsing võtab 1,2–2,3 s ühe PostgreSQL-i päringuna. Selle kiirendamine ei muuda tulemusi, aga vajab andmebaasipoolset mõõtmist (ADR-039).

## Kontroll

- Mõõteskriptid lugesid ainult aegu, olekuid ja tokenite arve. Korduskatse saatis salvestatud hindamiskataloogi päringud, mitte kasutaja vestlusi.
- Kulu 29.09 hommikul: korduskatse umbes 0,04 USD, kaks kataloogijooksu 0,375 USD.
