# Teemaarenduse jätkamise kord

STATUS: ACTIVE WORKING RULE

Iga ülesanne on üks tervikteema (näiteks `T24 FIELD-V1` või `T25 ORG-V1`), ühe worktree, haru ja lõppüleandmisega. Konto tüüp, mudel või limiidi pikkus **ei muuda ülesande ulatust ega jaga teemat eraldi mikropakettideks**.

## Kui töö katkeb

1. Teema jääb samasse worktree'sse ja samale harule.
2. Töö jätkub hiljem sama täieliku teemaülesande alusel, mitte uue väiksema kontoülesandena.
3. Jätkaja kontrollib alguses worktree'd, haru, HEAD-i, remote'i, `status`-t ja olemasolevat diffi ning loeb algse teemalepingu.
4. Pooleliolevat diffi ei puhastata, lähtestata, rebase'ita ega kopeerita uude harusse.
5. Kui enne katkestust on valmis selge terviklik muudatus, võib selle tavapäraselt testida, commit'ida ja push'ida. Kui töö jäi pooleli, säilitatakse see ning jätkatakse järgmisel korral.

## Ülesande andmise reegel

- Koordinaator annab alati kogu teema eesmärgi, skoobi, keeldude, vastuvõtukriteeriumide ja lõpparuande nõuetega.
- Ülesandes võib olla sisemisi E-etappe, kuid need on teostaja tööjärjekord, mitte eri kontodele jagatavad eraldi ülesanded.
- Kontrollide maht tuleneb teema riskist ja tegelikult tehtud muutusest, mitte sellest, millisel kontol töö tehti.
- Lõpparuandes esitatakse haru, baas/parent, kohalik ja remote SHA, tehtu, tegelikult käivitatud kontrollid, runtime/cleanup ning `NOT_DONE`/`NOT_PROVEN` read. Koordinaator kontrollib pärast seda ainult Git-fakte; täissviit ja sõltumatu audit jäävad T27 lõppväravasse, kui kasutaja ei otsusta teisiti.

See kord kehtib kõigile teostajatele ühtemoodi. See ei anna luba tootmisandmete lugemiseks, merge'iks, deploy'ks, rebase'iks ega algse ülesande väliseks tegevuseks.
