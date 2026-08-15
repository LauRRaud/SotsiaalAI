# Järgmine ülesanne: gpt-5.6-luna Golden-37 smoke ja võrdlus

Staatus 01.08.2026: hindamine lõpetatud. Smoke 2/2 ja Golden-37 täisjooks
37/37 `completed`; automaatkontroll 37/37 PASS. 74 pimehinnet lukustati enne
mudelivõtmega seostamist. Sõltumatu mudel-hindaja tulemus oli mini 573/666 ja
Luna 628/666; Luna võitis 30 paari 37-st. See ei olnud päris inimese hinnang.
Järgmine etapp on Harku allikavastavuse ja no-corpus release-hardening,
regressioonid ning kontrollitud Luna canary.

## Eesmärk

Käivita kontrollitud `gpt-5.6-luna` kandidaat samal fikseeritud Golden-37 küsimustikul ning koosta mini ja Luna pimevõrdlus. Ära muuda ega restardi tootmise frontend- või RAG-teenust enne omaniku eraldi deploy-luba.

## Fikseeritud võrdlusbaas

- küsimustik: `eval/golden-rag-v1.json`;
- küsimustiku SHA-256: `3a47407ce93fbf9fc7cdb33f9f2e3bcc05b0ad0bef788e184e03580b4df50089`;
- 37 ID-d, rollid, järjestus ja `edge_followup_paragraph` ajalugu jäävad muutmata;
- rubriik: `docs/internal/golden-37-mini-evaluation-form.md` ning selle jooksu preflight-hash;
- mini baas: 37/37 completed, branchi `golden-37-mini-baseline` artefaktid;
- sama system prompt, RAG, korpus, planner, retrieval, atributsioon ja kuvatavate allikate loogika.

Kandidaatkomplekt kasutab projektis juba määratud peamist Luna hüpoteesi:

```text
model = gpt-5.6-luna
reasoning = medium
verbosity = medium
max_output_tokens = 3000
```

See on kandidaatkomplekti võrdlus praeguse tootmisbaasiga, mitte ainult mudelinime isoleeritud A/B. Kui omanik soovib eraldi ainult-mudeli võrdlust (`low/medium/1100` mõlemal), tuleb see enne jooksu eraldi fikseerida; Golden-37 vastuste nägemise järel tingimusi ei muudeta.

## Ohutu käitamine

1. Loo tootmise HEAD-ilt eraldatud eval-worktree ja loopback-only hindamisprotsess eraldi pordil.
2. Kasuta sama rakenduskoodi ja production RAG/DB sõltuvusi, kuid eraldi protsessi env'is ainult ülal fikseeritud Luna mudeliseadistust.
3. Ära muuda `/etc/sotsiaalai/frontend.env`, `/etc/sotsiaalai/rag.env`, app-service'i uniteid ega tootmise protsesse.
4. Loo vahetult enne jooksu eraldi ülesandepõhine sünteetiline `SOCIAL_WORKER` konto ja sessioon 600-loaga failis; küpsis ei tohi jõuda käsureale, logisse ega artefakti. Ära taaskasuta varasema jooksu sessiooni.
5. Kontrolli enne päringuid mudeli API-juurdepääsu ühe sisu mittesisaldava tehnilise kontrolliga või esimese smoke'i fail-closed käitumisega. Ära tee automaatset fallback'i mini peale.
6. `finally`-cleanup'is eemalda sessioonifail ka ebaõnnestunud või katkestatud jooksu järel, tühista konto aktiivsed sessioonid, kustuta jooksu `ChatLog`-read ja sünteetiline konto. Säilita ainult sanitiseeritud hindamisartefaktid.

## Jooks

1. Preflight: hashid, tootmise HEAD, env-hashid, sünteetiline sessioon, roll, korpuse explicit ankrud.
2. Smoke samade ette fikseeritud kaasustega: `legal_shs_17` ja `ajakiri_overview_lastekaitse`.
3. Smoke peab andma `status=completed`, `response_present=true`, allikad vastavalt Golden-ootusele, usage-väljad, RAG timingud ja tervikliku lõpetamise.
4. Kui smoke on tehniliselt korras, käivita Golden-37 üks kord, `concurrency=1`, kaks sekundit päringute vahel.
5. Säilita kõik algsed tulemused. Ainult technical/retrieval/stream failure võib saada ühe märgistatud `technical_retry`; incomplete'i, nõrka, nullallikaga edukat või aeglast edukat vastust ei korrata.
6. Ära lase Lunat ennast oma vastuste lõplikuks sisuhindajaks.

## Pimevõrdlus

- Loo Luna run-ID-d, mis ei kodeeri mudelit.
- Ühenda mini ja Luna vastused küsimuse kaupa ning randomiseeri A/B järjekord deterministliku fikseeritud seemnega.
- Hindajafail sisaldab ainult anonüümset run-ID-d, küsimuse ID-d, vastust ja kuvatud allikate kontrollitud metaandmeid.
- Mudeli/config'i võti jääb eraldi faili ja avatakse alles pärast inimhinnete lukustamist.
- Kasuta kuut 0–3 kategooriat, kohustuslikku kontrollnimekirja, kriitilise vea reeglit ja olemasolevaid verbosity-tundlikke punkte.

## Võrdlusraport ja väravad

Raporteeri vähemalt completed/incomplete/technical olekud, latency p50/max, tokenid, output-cap, hinnanguline kulu, RAG failure, allikate koguarv ja unikaalsus, Golden automaatkontroll ning lukustatud inimhinded. Eralda kandidaatkomplekti mõju mudelinime isoleeritud mõjust.

Tootmise deploy-soovituse võib anda ainult siis, kui:

- smoke ja täisjooks on tehniliselt taastatavad;
- kriitiliste vigade arv ei kasva;
- inimhinnang ei näita olulist kvaliteediregressiooni;
- allika- ja õigustäpsus ei halvene;
- latency, incomplete ja kulu on vastuvõetavad;
- rollback `gpt-5.4-mini / low / medium / 1100` peale on dokumenteeritud.

Isegi positiivse soovituse korral ei muudeta tootmismudelit ega restartita teenust ilma omaniku eraldi loata.
