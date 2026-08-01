# Golden-37 mini–Luna otsus

## Otsus

`gpt-5.6-luna / medium / medium / 3000` on kontrollitud tootmiskandidaat.
Võrreldes tootmise `gpt-5.4-mini / low / medium / 1100` baasiga läbis Luna
kõik 37 tehnilist jooksu, sai pimedas paarishindamises 628/666 punkti mini
573/666 vastu ning võitis 30 küsimust 37-st. Luna oli mediaanis 1301 ms
aeglasem, kuid vastusemudeli ja query-embeddingu koondkulu oli hinnanguliselt
67.0% madalam.

Pimehindamine oli sõltumatu mudel-hindamine, mitte päris inimese hinnang.
Järeldust toetab suur paarivõitude vahe, kuid see piirang tuleb igas otsuse
esitluses säilitada.

## Release-blockerid

1. `kov_harku_sotsiaaltransport`: mõlemad mudelid esitasid täpseid teenuse
   detaile, kuid kuvasid sama KOV-i teiste teenuste allikaid. Retrieval leidis
   õiged allikad; viga tekkis morfoloogilise teenuseankru, paketi fallback'i ja
   kuvatavate allikate atributsiooni torus.
2. `edge_no_corpus_answer_v2`: Luna lisas allikateta üldteadmisi. Nullallikaga
   mittekriisipäring peab jääma rangelt korpusepiiri sisse.

Enne canary't tuleb need kaks väravat sulgeda sihitud regressioonidega.
Kuna Harku parandus puudutab jagatud `packageAwareContext` ja atributsiooni
toru, tuleb pärast sihitud teste korrata Golden-37 nii mini kui Luna
konfiguratsiooniga.

## Canary ja rollback

Canary konfiguratsioon:

```text
OPENAI_MODEL=gpt-5.6-luna
reasoning effort=medium
verbosity=medium
max_output_tokens=3000
```

Rollback:

```text
OPENAI_MODEL=gpt-5.4-mini
reasoning effort=low
verbosity=medium
max_output_tokens=1100
```

Canary seires tuleb eraldi vaadata completed/incomplete olekut, latentsust,
kogukulu, nullallikaga vastuseid, kinnitamata täpseid väiteid, kuvatud
allikate teenusevastavust ja vastuste pikkust.
