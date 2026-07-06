# ESTA mentoriprofiilide importimise raport — parandatud järelkontroll

**Kontrollkuupäev:** 2026-05-24  
**Töödeldud profiilide arv:** 17

See parandatud raport täpsustab eelmist raportit. Pildi URL-e ei käsitletud, sest praeguses töös jäeti pilt teadlikult kõrvale. Kõik mentorid jäävad importandmetes staatusesse **PENDING_CONSENT** ja **EXTERNAL_REFERENCE**. Kontaktandmed ei ole tavakasutajale kuvamiseks enne eraldi nõusolekut.

## Importimise staatus

| Staatus | Arv |
|---|---:|
| COMPLETE | 17 |
| PARTIAL | 0 |
| FAILED | 0 |

Kõik 17 profiili on andmete mõttes imporditavad. Triin Voodla profiil ei ole PARTIAL ainult seetõttu, et tutvustustekst on lühike; bioFull sisaldab kogu avalikult loetavat profiiliteksti.

## Puuduvad või teadlikult tühjaks jäetud väljad

| Väli | Profiilid |
|---|---|
| Kontaktid puuduvad | – |
| Valdkonnad puuduvad | – |
| Teemad puuduvad | simone-epro |
| Bio puudub | – |
| Pildi URL | jäetud teadlikult käsitlemata |

## Täpsustused

### Simone Epro

Simone Epro profiilil on valdkonnad olemas, kuid eraldi mentorlusteemade rida ei sisalda teemasid. Seetõttu jäid `topics` tühjaks ja `sourceEvidence.topicsFound` väärtuseks jäi `false`. Teemasid ei tohiks lisada bio põhjal oletades.

### Triin Voodla

Triin Voodla profiilil on bio lühike, aga see on avalikul profiilil tervikuna olemas. Seetõttu on `importStatus` **COMPLETE** ja bioFull ei ole osaline.

## BioFull kontroll

| Kontroll | Profiilide arv |
|---|---:|
| bioFull olemas ja avalikult loetava teksti ulatuses täielik | 17 |
| bioFull osaline | 0 |
| bio puudub | 0 |

## Admini käsitsi ülevaatus

Käsitsi ülevaatus on vajalik enne avalikku kuvamist kõigi 17 profiili puhul, sest tegemist on ESTA avalike profiilide põhjal loodud **EXTERNAL_REFERENCE** importandmetega. Enne ACTIVE/CONSENTED staatust tuleb kinnitada:

1. mentori nõusolek SotsiaalAI-s kuvamiseks;
2. bioFull kasutusõigus ja vajadusel lühendatud avalik tekst;
3. kontaktandmete kuvamise nõusolek;
4. fotode kasutamise nõusolek, kui fotosid soovitakse SotsiaalAI kataloogis kuvada.

## Kokkuvõte

Pildi URL-id välja arvatud, puuduvat infot ei ole mõistlik rohkem juurde leiutada. Ainus sisuline tühjaks jääv väli on **Simone Epro `topics`**, sest teemasid ei ole ESTA profiilil selgelt märgitud. **Triin Voodla bio ei ole puudu ega osaline**, vaid on lihtsalt lühem kui teistel.
