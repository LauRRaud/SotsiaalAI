# ADR-158 — Pöörde jälg andmetena ja raja enda valik

21.10.2026. Teostus Claude Opus 5.5. Omaniku kolme juhtumi test (75 küsimust): „Teeme hiljem analüüsi, et mis
andmebaasist leiti ja vastati“.

## Leid

1. **Jälje leht on suur ja voogedastatud.** Omavalitsuse kirjetega pöördes on tõendeid kuni 75 ja leht kuni 600 kB.
   Next saadab selle osade kaupa; ilma brauseri JavaScriptita loetud HTML-is on osa tõenditest ja kandidaatidest
   puudu. Brauseris avaneb leht õigesti, aga analüüsiks ei saa HTML-i lugeda.
2. **Valikumudeli valik võeti pöörde viimasest valikukutsest.** `searchAssist.rerank` on pöörde viimane valikukutse.
   Ajakirjade perioodi rada (`publication_period`) võib valikumudelit kutsuda pärast teadmusrada, ja siis ei oleks
   kaardid ega valik teadmusraja omad.

## Otsus

- **`GET /api/admin/rag/chat-trace/<turnId>`** annab sama jälje (`turnTrace`) JSON-ina. Ainult admin ja ainult tema enda
  vestluste pöörded; vektorit ei loeta.
- **Valik tuleb raja enda auditist.** Jälje valik on teadmusraja oma (`laneAudit.knowledge.rerank.selected`, ühiku
  id järgi). Pöörde valikukirje kaarte kasutatakse ainult siis, kui neid on sama palju kui raja kandidaate.
- **Raja audit nimetab kandidaadid ise.** Raja `rerank.fused` hoiab iga kandidaadi pealkirja ja alguse (160 märki)
  nii, nagu valikumudel need luges.

## Kontroll

Kohalik kontroll (päris `retrieve()`, mälu-indeks) läbis koos jälje ja valikuga. Liides kasutab sama admini kontrolli
(`assertAdmin`) ja sama pöördepäringut nagu leht.
