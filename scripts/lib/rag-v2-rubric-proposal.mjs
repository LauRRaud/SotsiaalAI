// Authoring data, not a semantic classifier. Every mapping below remains an assistant proposal.
const passage = (source, page, start, end) => ({ source, page, start, ...(end ? { end } : {}) });
const set = (id, support, rationale, ...all) => ({ id, support, rationale, all });
const requirement = (id, meaning, scope, evidenceSets, corpusNote = 'Võimalik tugi on allpool; sisuline vastendus ootab ülevaatust.') => ({
  id, meaning, mandatory: true, scope, corpus_note: corpusNote,
  partial_rule: 'Osa mõttest või kitsam olukord on partial ainult eraldi põhjendatud vastenduse korral.',
  background_rule: 'Ühine teema või märksõna üksi ei täida nõuet.', evidence_sets: evidenceSets,
});
const family = (scope, optional, ...requirements) => ({ scope, optional, requirements });
const training = 'Koolitusmaterjali ettevaatlik ametialane piir; mitte väide kogu kehtiva õiguse kohta.';
const article = 'Valitud artikli käsitlus; mitte tänase olukorra sõltumatu faktikontroll.';

export function rubricProposal() {
  return { schema_version: 'rag-v2/semantic-rubric-proposal-2', version: '2.0-proposal-1',
    proposed_by: { name: 'Codex', role: 'assistant' },
    sources: {
      training: '1bee150c6c65e2a1a69a2324af16f3aa00b45bcab36cc0d9a11e527dd686834c',
      ai: 'a41995721ca13aa78898116ccef466aedf3576e26bb30fce3c145f4d8b87828b',
      privacy: '9bc020d12902f958b9084882af5bd224a3c38f14c1ff3be45c92115385c124de',
      safety: 'e27d064511e8a005826c1819dcb264b7ddc21227e1c799105a3957c73e8daf09',
      care: '785d3e26329f5faca3b795e4e0387f98b0a45fe973cafdd79d12a8da81ee34a2',
      tehnopol: '2db90ecc6509a7c5118c4868b904efd254b3b6a62d004c6baab5e5b7d12aa182',
      eka: 'd2f96860f073b4875111cd93696d2dc3673547ddbd268f87ea4a51e69bd5d927',
      hospital: '42a0891809df1cc35ab0c19cd42abce78ff6e19e4186f772860bd6443acdad8c',
    }, families: {
      'decision-boundary': family(training, 'Üksikute piirijuhtumite lisaloetelu ei ole nõutud.',
        requirement('decision-scope', 'Üldine generatiivne AI ei soovita konkreetse inimese abivajaduse, toetuse, teenuse, lapse heaolu, riski, lõpetamise ega prioriteedi otsust.', training, [
          set('scope-with-list', 'full', 'Avaväide ja järgnev loend koos määravad adressaadi ja otsuste ulatuse.',
            passage('training', 9, 'Koolituse praktiline turvareegel:', 'teenuse, lapse heaolu, riski, teenuse lõpetamise ega prioriteedijärjekorra otsust.'))]),
        requirement('substantive-human-control', 'AI võib hinnangut ankurdada; inimese formaalne lõppotsus ei piisa ning sisuline mõju vajab eraldi hinnangut.', training, [
          set('anchoring-and-assessment', 'full', 'Ankurdamise mehhanism JA järeldus inimese formaalse rolli ebapiisavusest.',
            passage('training', 9, 'töötaja näeb AI tulemust nii vara'),
            passage('training', 9, 'Kui vastus viitab sisulisele mõjule', 'eetilist ja organisatsioonilist hinnangut.'))])),
      'data-minimization-egress': family(training, 'Asutuse üldine tööriistahange pole selle küsimuse eraldi nõue.',
        requirement('detail-necessity', 'Kontrollida iga detaili vajalikkust konkreetse ülesande jaoks.', training, [
          set('every-detail', 'full', 'Ülesande ja iga detaili seos on eksplitsiitne.', passage('training', 7, 'Kas iga detail on selle ülesande jaoks vajalik?')),
          set('data-types-only', 'partial', 'Andmeliikide vajadus ei ole veel iga detaili minimaalsuse kontroll.', passage('training', 8, 'Milliseid andmeliike sisestatakse ja miks need on vajalikud?'))]),
        requirement('transfer-permission', 'Kontrollida konkreetse dokumendi või sisu välise edastamise õigust, arvestades konfidentsiaalsust, lepingut ja autoriõigust.', training, [
          set('document-right-and-limits', 'full', 'Edastamise küsimus JA selle piirangud moodustavad terviku.',
            passage('training', 7, 'Kas mul on õigus dokumenti või selle sisu välisele teenusele edastada', '(konfidentsiaalsus, leping, autoriõigus)?')),
          set('general-law-contract', 'partial', 'Töötlemisalus ja lepingu katvus on asjakohased, aga konkreetse dokumendi edastamisõigust ei kinnita.',
            passage('training', 8, 'Mis on töötlemise õiguslik alus?'),
            passage('training', 8, 'Kas leping ning andmetöötlusleping katavad tegeliku kasutusviisi?'))])),
      'incident-response': family(training, 'Kogu intsidendimenetluse seitse sammu pole küsimuses nõutud.',
        requirement('stop', 'Peatada uute andmete sisestamine ja väljundi edasisaatmine.', training, [
          set('stop-both', 'full', 'Sisend ja väljund on mõlemad peatamisjuhises.', passage('training', 11, '1. Peata tegevus.'))]),
        requirement('notify', 'Teatada viivitamata asutuse kokkulepitud kanalisse: juht, andmekaitse või infoturve/kasutajatugi.', training, [
          set('channel-and-roles', 'full', 'Üksnes pealkirja asemel tuleb kaasa võtta kanal ja adressaatide rollid.',
            passage('training', 11, '3. Teata viivitamata', 'infoturve/kasutajatugi:'))]),
        requirement('minimum-record', 'Kirja panna tööriist/konto, aeg, andmete liik/maht ja avastamise järel tehtud tegevused.', training, [
          set('record-fields', 'full', 'V1 pealkiri üksi ei tõenda küsimuses küsitud välju; vaja on kogu loendit.',
            passage('training', 11, '4. Pane kirja minimaalne vajalik:', 'mida tegid pärast avastamist.'))])),
      'human-relationship-support': family(article, 'Robotite nimed ja kultuurilised näited on valikulised.',
        requirement('human-relationship', 'AI pakub täiendavat tuge ja säilitab inimsuhted.', article, [
          set('relationship-limit', 'full', 'Piirang ja täiendava toe roll on ühes väites.',
            passage('ai', 8, 'võimaldades kohandatavat suhtlust', 'aitab säilitada inimkeskse ja eetilise hoolduskeskkonna.'))]),
        requirement('general-development', 'Üldine arendusprotsess peab olema läbipaistev, väärtuspõhine ja kaasav, andes spetsialistidele ning kasutajatele sisulise osaluse arendusotsustes.', article, [
          set('general-conclusion', 'full', 'Üldised põhimõtted JA konkreetsed kaasatavad/osaluse tase.',
            passage('ai', 12, 'toetada, kui selle arendusprotsess on läbipaistev', 'kaasatud – mitte ainult kasutajaandmete kaudu, vaid ka arendusotsustes.')),
          set('care-specific-participation', 'partial', 'Hooldusnäite osalus, teavitamine ja kultuuriline sobivus toetavad osa üldisest tingimusest.',
            passage('ai', 8, 'autonoomia ja väärikus', 'valikuid. Samuti tuleb arvestada kultuurilist sobivust'),
            passage('ai', 8, 'süsteemid tekitavad. Kui arendusprotsess', 'toetada hoolivust ning vähendada isoleeritust.'))])),
      'privacy-processing-basics': family('ESTA andmekaitse teemapäeva tekst.', 'Esinejate nimed ja osalejate arv on lisainfo.',
        requirement('why-how-what', 'Tundlike isikuandmete puhul tuleb mõelda läbi miks, kuidas ja missuguseid andmeid töödeldakse.', 'Nõutud allikas: ESTA teemapäev.', [
          set('complete-processing-question', 'full', 'Tundlike andmete kontekst ja kõik kolm küsimust peavad säilima.',
            passage('privacy', 1, 'suures ulatuses tundlike isikuandmete', 'missuguseid andmeid töödeldakse.'))])),
      'ethics-peer-discussion': family('Küsimuse julgustus puudutab eetiliste küsimuste arutamist kolleegidega.', 'Teise artikli tööheaolu teema ei asenda ilma sisulise otsuseta sama julgustuse põhjust.',
        requirement('clarity-through-discussion', 'Kolleegidega avatud eetiline arutelu aitab saada selgust.', 'Kontekst peab seostama arutelu just eetiliste küsimustega.', [
          set('discussion-clarity', 'full', 'Julgustuse adressaat JA põhjus, mitte ainult kolleegi või eetika sõna.',
            passage('privacy', 1, 'eetikakoodeksist. Kersti julgustas', 'nendes küsimustes üksi jääda.'))]),
        requirement('not-alone', 'Spetsialist ei peaks jääma eetiliste küsimustega üksi.', 'Üksi jäämise piir peab puudutama eetilisi küsimusi.', [
          set('ethics-not-alone', 'full', 'Eetiliste küsimuste ja üksijäämise seos.',
            passage('privacy', 1, 'eetiliste küsimuste üle arutama', 'nendes küsimustes üksi jääda.'))])),
      'worker-violence-rate': family(article, 'Uuringu täielik metoodika on lisainfo, valimi ja nähtuse eristus kohustuslik.',
        requirement('rate-population-event', '92,6% nimetatud uuringu küsitletud KOV sotsiaal- ja lastekaitsetöötajatest oli kogenud kliendist lähtuvat vägivalda.', 'Uuringus osalenud töötajad; mitte kõik töötajad ega kõik vägivallaliigid eraldi.', [
          set('population-and-rate-and-event', 'full', 'Arv, küsitletute ulatus JA järgmisel real olev nähtus tuleb leida koos.',
            passage('safety', 2, 'rohkem üllatab mind', 'kliendist lähtuva vägivallaga.'))])),
      'employer-worker-safety': family(article, 'Kindlat lehte või ministeeriumi kommentaari küsimus ei nõua.',
        requirement('employer-risk-role', 'Tööandjal on tööga seotud riskide hindamise, ennetamise ja maandamise vastutus.', 'Vastutajaks peab olema tööandja; üldine olukorra kirjeldus ei piisa.', [
          set('page5-explicit-employer', 'full', 'Tööandja ja kõik riskitegevused on eksplitsiitses väites.',
            passage('safety', 5, 'koormuse ja eraelu puutumatuse rikkumise eest.', 'vajaliku toe.')),
          set('page4-risk-and-subject', 'partial', 'Situatsiooniline riskihindamine koos tööandja vastutuse kontekstiga; kõigi riskikohustuste täielik samaväärsus vajab otsust.',
            passage('safety', 4, 'ebasobiv keskkond või töötaja ebapiisav ettevalmistus.', 'töötaja satuvad silmitsi ohuga ilma piisava toetuse'),
            passage('safety', 4, 'Kui töötajat on ähvardatud', 'tööruumi. Tuleb läbi rääkida'))]),
        requirement('employer-aftercare', 'Pärast vägivalda ei jäeta töötajat üksi: tööandja korraldab vajalikud tegevussammud ja toe.', 'Tegevused peavad olema seotud tööandja või organisatsiooni rolliga, mitte töötaja isikliku kohustusega.', [
          set('page5-role-and-support', 'full', 'Tööandja vastutus JA organisatsiooni/süsteemi järeltoe väide.',
            passage('safety', 5, 'koormuse ja eraelu puutumatuse rikkumise eest.', 'vajaliku toe.'),
            passage('safety', 5, 'olukordades, kus kõiki osalisi', 'ähvarduste, surve või vägivallajuhtumite korral')),
          set('page4-subject-and-aftercare', 'full', 'Alternatiiv sisaldab vastutajat, vajaduste väljaselgitamist, kontakte, dokumenteerimist ning õigus-/kriisiabi.',
            passage('safety', 4, 'Kui töötajat on ähvardatud', 'Kättesaadav peab olema õigusabi'))])),
      'care-ethics-selfcare': family('Hooldustöötajate koolituste kajastus.', 'Koolituslinnad, toetaja ja kuupäev on valikulised.',
        requirement('ethical-care', 'Käsitleti väärtusi, eetilisi dilemmasid, väärikust ja enesemääramist toetavat suhtlust.', 'Koolituse teemad, mitte tõend osalejate oskuste muutusest.', [
          set('values-dilemmas-dignity', 'full', 'Loendi osad koos annavad eetilise sisu.',
            passage('care', 1, 'otsuseid, hoida abivajaja väärikust', 'enesemääramisõigust ja lugupidavat kohtlemist.'))]),
        requirement('selfcare-team', 'Käsitleti emotsionaalset koormust, läbipõlemise ennetamist, enesehoidu ja meeskonna tuge.', 'Koolituste sisu.', [
          set('selfcare-with-team', 'full', 'Koormus, enesehoid ja meeskonna tugi ühes tervikus.',
            passage('care', 1, 'emotsionaalsele koormusele', 'ning mõtestasid meeskonna olulist rolli'))])),
      'wellbeing-funding': family('Tehnopoli salvestatud programmiinfo; tänast taotlusvooru ega kehtivust ei kinnitata.', 'Taotlustähtajad ja programmi kogueelarve pole küsitud.',
        requirement('first-stage-terms', 'Esimeses etapis kuni 30 000 eurot, omafinantseeringut ei nõuta.', 'Tehnopoli allikas; esimese etapi seos ja summa ülempiir kohustuslikud.', [
          set('first-stage-complete', 'full', 'Etapi nimetus, summa ja omafinantseering koos.',
            passage('tehnopol', 2, 'esimeses etapis saab toetust taotleda', '30 000 eurot, oma fi nantseeringut ei nõuta.'))]),
        requirement('second-stage-terms', 'Teises etapis toetus alates 500 000 eurost, omafinantseering minimaalselt 12%.', 'Tehnopoli allikas; etapp, alammäär ja minimaalne protsent peavad säilima.', [
          set('second-stage-complete', 'full', 'V1 fraas algas 000 eurost; v2 nõuab ka summa algust ning teise etapi konteksti.',
            passage('tehnopol', 2, 'esimese etapi läbimine on eelduseks', '000 eurost, oma fi nantseering minimaalselt 12%.'))])),
      'wellbeing-two-source-roles': family('Tehnopoli kirjeldus elluviijatest JA EKA enda rollikirjeldus.', 'EKA teostajate loetelu ei asenda Tehnopoli allikanõuet.',
        requirement('tehnopol-implementers', 'Tehnopoli tekst nimetab elluviijatena Tehnopoli, Civitta ja Eesti Kunstiakadeemia.', 'Nõutud allikas: Tehnopol.', [
          set('tehnopol-only', 'full', 'Elluviimise verb ja nimed koos.',
            passage('tehnopol', 1, 'Sotsiaalministeeriumi algatatud programmi', 'Tehnopol, Civitta ja Eesti Kunstiakadeemia.'))]),
        requirement('eka-role', 'EKA kirjeldab enda teenusedisaini ja kasutajavaate rolli.', 'Nõutud allikas: EKA; kaks alternatiivi säilivad.', [
          set('eka-page3', 'full', 'Subjekt, teenusedisain ja kasutajavaade koos.',
            passage('eka', 3, 'kannab EKA', 'kasutajavaate rolli, aitab')),
          set('eka-page8', 'full', 'EKA enda teise tekstikoha samaväärsuse ettepanek.',
            passage('eka', 8, 'arendusprogramm, milles EKA kannab teenusedisaini ja kasutajavaate', 'rolli, aitab headel ideedel'))])),
      'hospital-discharge-continuity': family('Insuldijärgse raviteekonna piloodi kajastus.', 'Kõigi haiglaosakondade loetelu pole nõutud.',
        requirement('whole-patient-path', 'Patsiendi vajadustest lähtuv terviklik raviteekond.', 'Insuldijärgse piloodi kontekst.', [
          set('stroke-and-path', 'full', 'Piloodi identiteet JA raviteekonna eesmärk.',
            passage('hospital', 1, 'Lääne-Tallinna Keskhaigla õendusjuht', 'raviteekond. Projekti kogemus'))]),
        requirement('cooperation-continuity', 'Tervishoiu ja sotsiaalvaldkonna koostöö ning juhtumikorraldus väldivad toe katkemist haiglast lahkudes.', 'Piloodi õppetund, mitte individuaalse teenuse lubadus.', [
          set('cooperation-and-consequence', 'full', 'Koostöö JA selle tagajärg on mõlemad vajalikud.',
            passage('hospital', 1, 'raviteekond. Projekti kogemus', 'ja juhtumikorraldus, et inimene'))])),
      'worker-safety-author': family('Täpselt pealkirjas nimetatud artikkel.', 'Kommentaaride kaasautorid pole põhiartikli autor.',
        requirement('article-author', 'Põhiartikli autor on Aljona Kõpp.', 'Õige artikli kontrollitud bibliograafia või selle autori tekstikoht.', [
          set('metadata-author', 'full', 'Kontekstis kuvatud autoriandmed seotakse kanoonilise artikliga.',
            { kind: 'metadata', source: 'safety', field: 'authors', value: ['Aljona Kõpp'] }),
          set('page1-author', 'full', 'Algartikli autori tekstikoht.', passage('safety', 1, 'Aljona Kõpp'))])),
      'wellbeing-project-state': family('Valitud EKA programmi kajastus: rahastatud projektid, teemad ja tegelikud mõõdetud tulemused.', 'Iga projekti nimi ega kõik näited pole nõutud.',
        requirement('funded-count', 'Rahastati 20 projekti, eristades neid 52 esitatud taotlusest.', 'Rahastatud ja esitatud projektid pole sama arv.', [
          set('funded-not-applied', 'full', 'Taotluste arv JA rahastamisotsus.', passage('eka', 5, 'Programmi esimesse', 'kahtekümmet.'))]),
        requirement('problem-groups', 'Teemad hõlmavad eakate võimekust/taastumist, kroonilise haiguse jälgimist/ravimeid, andmepõhist kaughooldust ning üksildust.', 'Teemade kokkuvõte; ainuüksi üksilduse mainimine ei kata loendit.', [
          set('four-groups', 'full', 'Kahe lehe kombinatsioon, mitte kummagi lehe üksik märksõna.',
            passage('eka', 5, 'Toetust saanud 20', 'taastumisele. Nende'),
            passage('eka', 6, 'Ülejäänud projektid on', 'ja kogukonnaga sidumist.')),
          set('some-groups', 'partial', 'Lehe 6 kolm teemarühma ei sisalda lehe 5 võimekuse/taastumise rühma.',
            passage('eka', 6, 'Ülejäänud projektid on', 'ja kogukonnaga sidumist.'))]),
        requirement('measured-results', 'Juba saavutatud mõõdetud mõju või tulemused.', 'Kavandatud eesmärk ja rahastamisotsus ei ole mõõdetud mõju.', [],
          'V1 korpuse hinnangu järgi puudub; korpuse täielikkus vajab sisulise ülevaataja otsust. Tühja vastenduste loendit ei loeta automaatselt absent.')),
      'current-home-service-cost': family('Kasutaja konkreetne vald, koduteenus, aasta 2026; vald pole küsimuses määratud.', 'Koolituse väljamõeldud näidet ei rakendata kasutajale.',
        requirement('local-cost', 'Kasutaja vallas 2026 kehtiv koduteenuse omaosaluse määr.', 'Puuduv vald ja kehtiv alus; koolitusjuhtum ei sobi.', [], 'Kinnitatud kohalikku määra korpuses pole tuvastatud.'),
        requirement('local-time', 'Sama valla koduteenuse määramise tähtaeg.', 'Puuduv vald ja kehtiv alus; üldine faktileht ei määra tähtaega.', [], 'V1 järgi vajalik tugi puudub; ülevaatus peab eristama teadmata valda ja puuduvaid teenusreegleid.')),
    } };
}
