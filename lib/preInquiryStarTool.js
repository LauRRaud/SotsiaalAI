/**
 * STAR-i täisealise inimese abi- ja toetusvajaduse hindamisvahendi ülesehitus.
 *
 * MIKS. Eelkaardistus kasutab vahendi seitset eluvaldkonda ja 21 põhiküsimust
 * (`preInquiriesQuestionnaire.js`). Vahendit täidab STAR-is hindaja: põhiküsimusele
 * vastab ta jah või ei ja hindab iga täpsustava rea RFK määrajaga 0–4. Siin on
 * vahendi alamvaldkonnad ja täpsustavad read, et spetsialist näeks pöörduja
 * vastuse juures, millise vahendi rea juurde see kuulub, ega peaks seda ise otsima.
 *
 * PÖÖRDUJALE NEID RIDU EI NÄIDATA. RFK kood ja määraja on hindaja töö; kui
 * inimene hindaks ennast sama skaalaga, näeks eelinfo välja nagu ametlik
 * hindamine. Pöörduja näeb ainult abi korralduse osade lihtsat silti (`label`).
 *
 * ALLIKAS. Sotsiaalkindlustusameti „STAR hindamisvahend TAH 2026" (Wordi vorm,
 * koostatud 04.08.2026). Read on vahendi sõnastuses ja järjekorras. Parandatud on
 * neli ilmset kirjaviga: „kahjustav käitumisega", puuduvad komad loetelus
 * „naabrite kolleegide eakaaslaste", üleliigne sulg küttekolde real ja suurtäht
 * koodis D855. Allpool olevad andmed on vormist masinaga välja võetud; vahendi
 * uue versiooni korral võta need uuesti, ära paranda ridu käsitsi.
 *
 * KUJU.
 *  - `STAR_TOOL_BY_QUESTION[meie küsimuse id]`: vahendi alamvaldkonna number ja
 *    nimi ning see, mis vahendis põhiküsimusele järgneb: `rows` (RFK ridade
 *    tabel), `choices` (valikloend, ainult turvalisuse küsimusel) või `note`
 *    (ainult lisainfo väli). Kahes alamvaldkonnas (2.2 ja 3.2) on vahendis kahe
 *    põhiküsimuse peale üks tabel: mõlemad küsimused viitavad samale loendile.
 *  - `STAR_SUPPORT_PARTS`: vahendi osad 8–10 „Toetuse ja abi korraldus".
 */

export const STAR_TOOL_NAME = "STAR-i täisealise inimese abi- ja toetusvajaduse hindamisvahend (2026)";

/** Vahendi tabelite päised: täpsustav rida loetakse päise jätkuna. */
export const STAR_ROWS_HEADING = "Täpsusta, millisel määral esineb probleem:";
export const STAR_CHOICES_HEADING = "Täpsusta probleemi olemust:";
export const STAR_SUPPORT_HEADING = "Täpsusta, millisel määral mõjutavad toimetulekut:";

const ROWS_1_1 = Object.freeze([
  { code: "d310", text: "Kõnest arusaamisel ja suuliste sõnumite otsese või ülekantud tähenduses mõistmisel?" },
  { code: "d330", text: "Verbaalse kõnega ehk rääkimisega (sõnade ja fraaside kasutamine, loo jutustamine, selgituste andmine, juhiste küsimine)?" },
  { code: "d350", text: "Vestluse alustamisel, ülevalhoidmisel ja lõpetamisel?" },
  { code: "d720", text: "Teiste inimestega lävimisel ja suhtluse säilitamisel olenevalt olukorrast ja sotsiaalselt sobival viisil?" },
  { code: "d730", text: "Võõraste inimestega kontakti loomisel, nt teejuhiseid küsides või sisseoste tehes?" },
  { code: "d740", text: "Ametlikes tingimustes suhtlemisel, nt õpetajatega, tööandjatega, ametiisikutega või teenusepakkujatega?" },
  { code: "d750", text: "Mitteametlike sotsiaalsete suhete loomisel, nt sõprade, naabrite, kolleegide, eakaaslaste ja tuttavatega?" },
  { code: "d760", text: "Perekondlike suhete loomisel ja säilitamisel, nt vanemate, laste, õdede-vendade, laiendatud perekonnaga?" }
]);

const ROWS_2_1 = Object.freeze([
  { code: "b1140", text: "Orienteerumisega ajas – kas on teadlik kellaajast, nädalapäevast, kuupäevast, kuust ja aastast?" },
  { code: "b1141", text: "Orienteerumisega kohas – kas on teadlik oma asukohast, lähiümbrusest, linnast, riigist?" },
  { code: "b1142", text: "Orienteerumisega inimestes – kas on teadlik enda identiteedist ja enda ümber olevatest inimestest?" },
  { code: "b1144", text: "Orienteerumisega ruumis – kas on teadlik oma keha asukohast vahetus füüsilises ruumis, oskab leida ruumis tee kohast A kohta B?" },
  { code: "b144", text: "Igapäevaste oluliste asjade meelespidamisega?" },
  { code: "d175", text: "Igapäevaelus ettetulevate probleemide lahendamisega?" },
  { code: "d177", text: "Erinevate valikuvariantide vahel otsustamisega või tegemist vajavate ülesannete seast olulisema valimisega ning selle elluviimisega?" }
]);

const ROWS_2_2 = Object.freeze([
  { code: "b1263", text: "Kergesti ärrituvuse, ülemäärase muretsemise, tujukuse või ettearvamatu käitumisega, kas inimene on psüühiliselt stabiilne?" },
  { code: "d240", text: "Tegevuste sooritamisega stressirohketes ja vastutusrikastes olukordades?" },
  { code: "b1644", text: "Oma käitumise teadvustamise ja mõistmisega?" },
  { code: "b1261", text: "Koostöö tegemisega arstide või teiste spetsialistidega?" }
]);

const ROWS_2_3 = Object.freeze([
  { code: "d570", text: "Enese hooletusse jätmisega?" },
  { code: "b1304", text: "Ennast kahjustava käitumisega, mis kätkeb ohtu vaimsele või füüsilisele tervisele või elule?" },
  { code: "d7202", text: "Agressiivsuse, vägivaldsuse või vaenulikkusega?" },
  { code: "d660", text: "Riskiga lastele või teistele, kes on inimesest sõltuvad?" },
  { code: "b1303", text: "Sõltuvusega alkoholist, uimastitest, ravimitest või muudest ainetest?" },
  { code: "b1301", text: "Lootusetuse, jõuetuse või motivatsiooni puudumisega?" }
]);

const ROWS_3_1 = Object.freeze([
  { code: "d5702", text: "Oma tervise eest hoidmise, haigestumise korral abi otsimise ja arsti nõuannete järgimisega?" },
  { code: "d5701", text: "Iseenda eest hoolitsemisega, toitumisega ja hea füüsilise vormi säilitamisega?" },
  { code: "d5700", text: "Oma füüsilise mugavuse, sh mugava asendi, sobiva valguse ja temperatuuri, tagamisega?" }
]);

const ROWS_3_2 = Object.freeze([
  { code: "d4600", text: "Oma kodus kõndimise ja liikumisega?" },
  { code: "d410", text: "Ühest asendist teise liikumisega, nt toolile istumise või istumast püstitõusmisega, pikali heitmisega või pikali asendist püstitõusmisega?" },
  { code: "b2352", text: "Liikumisega seotud tasakaalukaotuse ja kukkumisriskiga?" },
  { code: "d4602", text: "Väljaspool kodu ilma abivahendita jalgsi liikumisega, sh treppidest käimise ja väiksemate takistuste (nt äärekivide) ületamisega?" },
  { code: "d465", text: "Hõlbustava vahendiga (nt ratastool, kõnniraam) liikumisega?" },
  { code: "d470", text: "Reisijana transpordi kasutamisega?" },
  { code: "d475", text: "Sõiduki (nt auto, jalgratas) juhtimisega?" }
]);

const ROWS_4_1 = Object.freeze([
  { code: "d610", text: "Eluaseme ostmise/üürimise, sisustamise ja kordaseadmisega?" },
  { code: "d650", text: "Oma vara hooldamise ja koduloomade eest hoolitsemisega?" }
]);

const ROWS_4_2 = Object.freeze([
  { code: "d3600", text: "Olemasolevate sidevahendite kasutamisega?" }
]);

const ROWS_5_1 = Object.freeze([
  { code: "d839", text: "Hariduse (sh mitteformaalne õppimine) omandamise ja õppimisega seotud kohustuste täitmisega?" },
  { code: "d845", text: "Töö otsimise, töökoha säilitamise, tööalase karjääri tegemise või töösuhte lõpetamisega?" }
]);

const ROWS_5_2 = Object.freeze([
  { code: "d870", text: "Majandusliku turvalisuse tagamise ja inimese vajaduste rahuldamisega?" }
]);

const ROWS_6_1 = Object.freeze([
  { code: "d920", text: "Hobidega (nt lugemine, reisimine, käsitöö, sport jm) tegelemise ja vabaaja tegevustest (kino, teater, muuseum jm) osavõtmisega?" },
  { code: "d910", text: "Kogukondlikus seltskonnaelus osalemisega?" },
  { code: "d855", text: "Tasustamata kogukondliku töö tegemisega?" }
]);

const ROWS_7_1 = Object.freeze([
  { code: "d620", text: "Igapäevaeluks vajalike ostude tegemise ja teenuste tellimisega?" },
  { code: "d860", text: "Raha kasutamise ja säästmisega või võlgade tasumisega?" },
  { code: "d865", text: "Pangakonto pidamise ja pangateenuste kasutamisega?" }
]);

const ROWS_7_2 = Object.freeze([
  { code: "d6200", text: "Igapäevaste toidukaupade ostmisega?" },
  { code: "d630", text: "Nii kuuma kui külma toidu valmistamise ja serveerimisega?" },
  { code: "d6401", text: "Köögi korrastamisega peale söögitegemist, tööpindade puhastamise ja nõude pesemisega?" }
]);

const ROWS_7_3 = Object.freeze([
  { code: "d550", text: "Söögiriistade kasutamisega (sh purkide-konservide avamisega), toidu tükeldamise ja söömisega?" },
  { code: "d560", text: "Pudelite vm jooginõude avamise, joogi segamise ja valamisega, (kõrrega) joomisega?" }
]);

const ROWS_7_4 = Object.freeze([
  { code: "d6402", text: "Eluruumide koristamisega, sh tolmu võtmise, põrandate puhastamise, akende pesemise, kardinate vahetamise, vannitoa ja WC koristamisega?" },
  { code: "d6400", text: "Pesu pesemise ja kuivama riputamisega?" },
  { code: "d6403", text: "Kodumasinate, nt pesumasina, triikraud, tolmuimeja, nõudepesumasin kasutamisega?" },
  { code: "d6405", text: "Prügi sorteerimisel ja sobivasse prügikonteinerisse viskamisega?" },
  { code: "d6408", text: "Eluruumide kütmisega, sh küttematerjali tuppa toomise, tule algatamise, hoidmise ja kustutamisega kõiki ohutusnõudeid järgides?" },
  { code: "d6507", text: "Kõnni- ja sissepääsu teede korras hoidmisega, nt lume ja lehtede koristamise ja libedusetõrje tegemisega?" }
]);

const ROWS_7_5 = Object.freeze([
  { code: "d510", text: "Enda pesemise ja kuivatamisega, vannis ja duši all käimisega?" },
  { code: "d530", text: "Tualetitoimingutega ja seejärel enda puhastamisega?" },
  { code: "d540", text: "Riiete selga- ja jalanõude jalgapaneku ning äravõtmisega, sh ilmastikule sobivate ja sotsiaalset olukorda arvestavate riiete/jalanõude valimisega?" },
  { code: "d520", text: "Hammaste, juuste, küünte ja naha eest hoolitsemisega?" }
]);

const CHOICES_2_3 = Object.freeze([
  "Inimene tunneb hirmu pereliikme, abistaja või tegevusjuhendaja ees.",
  "Inimest koheldakse alavääristavalt.",
  "Inimese suhtes kasutatakse füüsilist vägivalda.",
  "Inimese suhtes kasutatakse vaimset vägivalda.",
  "Inimese suhtes kasutatakse majanduslikku vägivalda.",
  "Inimese võimalust vabalt liikuda piiratakse.",
  "Muu"
]);

export const STAR_TOOL_BY_QUESTION = Object.freeze({
  social_relations: Object.freeze({ number: "1.1", subdomain: "Sotsiaalsed suhted", kind: "rows", rows: ROWS_1_1 }),
  cognition: Object.freeze({ number: "2.1", subdomain: "Kognitiivne võimekus", kind: "rows", rows: ROWS_2_1 }),
  psychic_state: Object.freeze({ number: "2.2", subdomain: "Psüühiline seisund", kind: "rows", rows: ROWS_2_2 }),
  treatment_awareness: Object.freeze({ number: "2.2", subdomain: "Psüühiline seisund", kind: "rows", rows: ROWS_2_2 }),
  risk_behavior: Object.freeze({ number: "2.3", subdomain: "Riskivaldkonnad", kind: "rows", rows: ROWS_2_3 }),
  safe_network: Object.freeze({ number: "2.3", subdomain: "Riskivaldkonnad", kind: "choices", choices: CHOICES_2_3 }),
  physical_health_care: Object.freeze({ number: "3.1", subdomain: "Tervise eest hoolitsemine", kind: "rows", rows: ROWS_3_1 }),
  indoor_mobility: Object.freeze({ number: "3.2", subdomain: "Liikumine", kind: "rows", rows: ROWS_3_2 }),
  outdoor_mobility: Object.freeze({ number: "3.2", subdomain: "Liikumine", kind: "rows", rows: ROWS_3_2 }),
  housing_retention: Object.freeze({ number: "4.1", subdomain: "Sobiva eluaseme saamine/säilitamine", kind: "rows", rows: ROWS_4_1 }),
  suitable_home: Object.freeze({ number: "4.2", subdomain: "Eluase ja elamistingimused", kind: "note" }),
  call_for_help: Object.freeze({ number: "4.2", subdomain: "Eluase ja elamistingimused", kind: "rows", rows: ROWS_4_2 }),
  occupation_access: Object.freeze({ number: "5.1", subdomain: "Rakenduse leidmine ja säilitamine", kind: "rows", rows: ROWS_5_1 }),
  occupation_participation: Object.freeze({ number: "5.1", subdomain: "Rakenduse leidmine ja säilitamine", kind: "note" }),
  income_retention: Object.freeze({ number: "5.2", subdomain: "Sissetuleku säilimine", kind: "rows", rows: ROWS_5_2 }),
  leisure: Object.freeze({ number: "6.1", subdomain: "Vaba aeg", kind: "rows", rows: ROWS_6_1 }),
  money_management: Object.freeze({ number: "7.1", subdomain: "Rahadega toimetulek", kind: "rows", rows: ROWS_7_1 }),
  food_preparation: Object.freeze({ number: "7.2", subdomain: "Toidu valmistamine", kind: "rows", rows: ROWS_7_2 }),
  eating_drinking: Object.freeze({ number: "7.3", subdomain: "Söömine ja joomine", kind: "rows", rows: ROWS_7_3 }),
  household: Object.freeze({ number: "7.4", subdomain: "Majapidamine", kind: "rows", rows: ROWS_7_4 }),
  self_care: Object.freeze({ number: "7.5", subdomain: "Enese eest hoolitsemine", kind: "rows", rows: ROWS_7_5 })
});

export const STAR_SUPPORT_PARTS = Object.freeze([
  Object.freeze({
    id: "family",
    label: "Perekond",
    number: "8.1",
    title: "Abi perekonnalt",
    question: "Kas perekond aitab?",
    rows: Object.freeze([
      { code: "e310", text: "Perekond, sh abikaasad, elukaaslased, vanemad, õed-vennad, lapsed, vanavanemad" },
      { code: "e315", text: "Laiendatud perekond, sh tädid-onud, õe-/vennalapsed" }
    ])
  }),
  Object.freeze({
    id: "friends",
    label: "Sõbrad ja tuttavad",
    number: "8.2",
    title: "Abi sõpradelt ja tuttavatelt",
    question: "Kas sõbrad ja tuttavad abistavad?",
    rows: Object.freeze([
      { code: "e320", text: "Sõbrad" },
      { code: "e325", text: "Tuttavad, eakaaslased, kolleegid, naabrid, kogukonna liikmed" },
      { code: "e350", text: "Koduloomad, sh lemmikloomad, liikumisel abistavad loomad (nt pimeda juhtkoer)" }
    ])
  }),
  Object.freeze({
    id: "social_services",
    label: "Sotsiaalabi ja toetused",
    number: "9.1",
    title: "Sotsiaalvaldkonna teenused",
    question: "Kas abi on korraldatud riikliku või kohaliku omavalitsuse sotsiaalhoolekande teenustega?",
    rows: Object.freeze([
      { code: "e340", text: "Ametlikud abistajad (tugiisikud, hooldajad, tegevusjuhendajad jt)" },
      { code: "e5750", text: "Sotsiaalhoolekandeteenused, sh igapäevaelu toetavad teenused, erihoolekande- ja rehabilitatsiooniteenused, sotsiaaltransport" },
      { code: "e5700", text: "Rahalised hüvitised, sh vanemahüvitis, vajadustel põhinevad toetused (nt toimetulekutoetus), puuetega inimese toetused, pensionid" },
      { code: "e5250", text: "Eluruumi tagamise teenused, sh varjupaik, sotsiaaleluruum, teenusmaja" }
    ])
  }),
  Object.freeze({
    id: "health_services",
    label: "Tervishoiuteenused",
    number: "9.2",
    title: "Tervishoiuvaldkonna teenused",
    question: "Kas abi on korraldatud tervisevaldkonna teenustega?",
    rows: Object.freeze([
      { code: "e1101", text: "Ravimid" },
      { code: "e5800", text: "Tervishoiuteenused, sh esmaabi, akuutravi, taastus- ja hooldusravi" },
      { code: "e355", text: "Tervisevaldkonna töötajad" }
    ])
  }),
  Object.freeze({
    id: "employment_services",
    label: "Tööhõive teenused",
    number: "9.3",
    title: "Tööhõive valdkonna teenused",
    question: "Kas abi on korraldatud tööhõive valdkonna teenustega?",
    rows: Object.freeze([
      { code: "e5900", text: "Tööturuteenused, sh abi töö otsimisel, karjäärinõustamine, tööturukoolitused, tööalane rehabilitatsioon, kogemusnõustamine" }
    ])
  }),
  Object.freeze({
    id: "education_services",
    label: "Haridusteenused",
    number: "9.4",
    title: "Haridusvaldkonna teenused",
    question: "Kas abi on korraldatud haridusvaldkonna teenustega?",
    rows: Object.freeze([
      { code: "e5850", text: "Haridusteenused erinevatel haridustasanditel, sh täiskasvanute täienduskoolitused ja elukestva õppe programmid" }
    ])
  }),
  Object.freeze({
    id: "other_help",
    label: "Muu abi, näiteks eestkostja",
    number: "9.5",
    title: "Muud teenused",
    question: "Kas abi on korraldatud muude valdkondade teenustega või muul viisil?",
    rows: Object.freeze([
      { code: "e330", text: "Inimesed, kellel on vastutus otsuseid teha, nt eestkostja" },
      { code: "e360", text: "Muude erialade inimesed ja teenuseosutajad, kes inimesele abi osutavad" }
    ])
  }),
  Object.freeze({
    id: "assistive_devices",
    label: "Abivahendid",
    number: "10.1",
    title: "Abivahendid",
    question: "Kas inimene kasutab abivahendeid?",
    rows: Object.freeze([
      { code: "e1151", text: "Abivahendid igapäevaseks isiklikuks kasutamiseks, sh proteesid ja ortoosid, põie ja soole kontrollimise vahendid, hingamistegevuse ja südametöö kontrollimise vahendid" },
      { code: "e1201", text: "Liikumisabivahendid, sh käimisabivahendid, kohandatud sõidukid, ratastoolid, siirdumise abivahendid" },
      { code: "e1251", text: "Suhtlemist toetavad abivahendid, sh nägemis- ja kuulmisabivahendid (nt prillid, kuuldeaparaat, alternatiivsed kommunikatsioonivahendid nagu piktogrammid v viipekeel), spetsiaalne arvuti riist- ja tarkvara" }
    ])
  }),
  Object.freeze({
    id: "home_adaptation",
    label: "Kohandatud kodu",
    number: "10.2",
    title: "Eluruumi kohandused",
    question: "Kas inimese eluruum on kohandatud tema abivajadust silmas pidades?",
    rows: Object.freeze([
      { code: "e1550", text: "Eluaseme kohandatud sisse- ja väljapääsud, sh automaatselt avanevad uksed, käsipuud, kohandatud ukselingid, madaldusega lävepakud, kaldteed" },
      { code: "e1551", text: "Eluaseme kohandatud siseruumid, sh vannitoa sisustus, seadmed ja elektrilised kontrollmehhanismid" },
      { code: "e1250", text: "Suhtlus- ja teabevahendid, sh telefon või häirenupp" }
    ])
  }),
  Object.freeze({
    id: "own_means",
    label: "Piisav oma raha või vara",
    number: "10.3",
    title: "Varad ja rahalised vahendid",
    question: "Kas inimesel on kasutada piisavalt vahendeid oma toimetuleku toetamiseks?",
    rows: Object.freeze([
      { code: "e1650", text: "Rahalised vahendid" },
      { code: "e1651", text: "Materiaalne vara" }
    ])
  })
]);
