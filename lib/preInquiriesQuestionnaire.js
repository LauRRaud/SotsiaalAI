import { normalizePreInquiryJourneySharedInfo } from "@/lib/preInquiryJourneySharedInfo";

export const PRE_INQUIRY_ASSESSMENT_PATHS = Object.freeze([
  {
    id: "QUICK_DESCRIPTION",
    title: "Kirjeldan olukorda oma sõnadega",
    description: "Sobib siis, kui tahad olukorra lühidalt kirja panna. SotsiaalAI küsib vajadusel ainult hädavajalikud täpsustused."
  },
  {
    id: "TARGETED_ASSESSMENT",
    title: "Lühem eelkaardistus",
    description: "Käime eluvaldkonnad läbi lühikese sõelaga ja täpsustame peamiselt neid teemasid, kus mure ilmneb."
  },
  {
    id: "COMPREHENSIVE_ASSESSMENT",
    title: "Põhjalikum eelkaardistus",
    description: "Sobib rahulikuks koduseks läbimõtlemiseks enne KOV-i või teenuseosutajaga ühendust võtmist."
  }
]);

export const PRE_INQUIRY_SUBJECT_OPTIONS = Object.freeze([
  "Minu enda kohta",
  "Lapse või noore kohta",
  "Eaka lähedase kohta",
  "Puudega või erivajadusega inimese kohta",
  "Lähedase või hooldatava kohta",
  "Muu olukord"
]);

export const PRE_INQUIRY_URGENCY_OPTIONS = Object.freeze([
  "Ei ole kiire, saan oodata",
  "Vajan ühendust lähiajal",
  "Olukord on tõsine ja vajab kiiret sekkumist",
  "Keegi võib olla vahetus ohus",
  "Ei oska öelda"
]);

export const PRE_INQUIRY_CONSENT_OPTIONS = Object.freeze([
  "Pöördun enda kohta",
  "Inimene on pöördumisega nõus",
  "Nõusolek vajab täpsustamist",
  "Inimene ei saa ise nõusolekut anda",
  "Ei oska öelda"
]);

export const PRE_INQUIRY_SCREEN_OPTIONS = Object.freeze([
  {
    value: "INDEPENDENT",
    status: "GREEN",
    label: "Jah, toimib",
    helperText: "Selles valdkonnas ei ole praegu olulist muret."
  },
  {
    value: "SOME_DIFFICULTY",
    status: "YELLOW",
    label: "Mõningad raskused",
    helperText: "Selle teema kohta küsime vajadusel veidi juurde."
  },
  {
    value: "SIGNIFICANT_DIFFICULTY",
    status: "RED",
    label: "Oluline mure",
    helperText: "Kirjeldasid olulist muret, täpsustame mõned asjaolud."
  },
  {
    value: "UNKNOWN",
    status: "UNKNOWN",
    label: "Ei oska öelda",
    helperText: "Märgime selle spetsialistile täpsustamiseks."
  },
  {
    value: "NOT_APPLICABLE",
    status: "NOT_APPLICABLE",
    label: "Ei puuduta",
    helperText: "Selle teema võime praegu kõrvale jätta."
  }
]);

export const PRE_INQUIRY_DOMAIN_DEFINITIONS = Object.freeze([
  {
    id: "communication",
    title: "Suhtlemine",
    helperText: "Selles valdkonnas vaadatakse suhtlemist, suhete loomist ja olemasolevate suhete hoidmist.",
    primaryQuestions: [
      {
        id: "social_relations",
        title: "Sotsiaalsed suhted",
        question: "Kas inimene suudab iseseisvalt suhelda teiste inimestega, luua uusi suhteid või säilitada olemasolevaid?",
        yellowQuestions: [
          "Millises suhtlemise või suhete hoidmise osas esineb raskusi?",
          "Kas raskus puudutab lähedasi, võõraid, ametiasutusi või teenuseosutajaid?"
        ],
        redQuestions: [
          "Millises suhtlemise või suhete hoidmise osas vajab inimene abi?",
          "Kas inimene saab oma soove, valu või abivajadust arusaadavalt väljendada?",
          "Kes aitab praegu suhelda või asjaajamist korraldada?"
        ],
        comprehensiveQuestions: [
          "Millised suhted ja suhtlusviisid toetavad inimest praegu?"
        ]
      }
    ],
    routingSignals: ["nõustamine", "KOV kontakt", "tugivõrgustik"]
  },
  {
    id: "mental_health",
    title: "Vaimne tervis",
    helperText: "Kirjelda ainult seda, mis on pöördumise ettevalmistamiseks vajalik. Vahetu ohu korral ei asenda see kriisiabi.",
    primaryQuestions: [
      {
        id: "cognition",
        title: "Kognitiivne võimekus",
        question: "Kas inimene suudab iseseisvalt teha otsuseid igapäevaelu küsimustes ning orienteeruda ajas, kohas ja inimestes?",
        yellowQuestions: [
          "Kas raskus puudutab otsustamist, oluliste asjade meelespidamist või orienteerumist?",
          "Mis aitab inimesel praegu otsuseid teha või päeva korraldada?"
        ],
        redQuestions: [
          "Millistes igapäevastes otsustes või toimingutes vajab inimene tuge?",
          "Kas inimene eksib ajas, kohas või inimestes viisil, mis mõjutab toimetulekut või turvalisust?",
          "Kas olulised kohustused, ravimid või kokkulepped võivad jääda meelde tuletamata täitmata?"
        ],
        comprehensiveQuestions: [
          "Millised meeldetuletused või abivahendid aitavad inimesel praegu toime tulla?"
        ]
      },
      {
        id: "psychic_state",
        title: "Psüühiline seisund",
        question: "Kas inimese psüühika on normipärane ja puuduvad psüühikahäirest tulenevad mõjud käitumisele ja tegevusele?",
        yellowQuestions: [
          "Kuidas vaimse tervise mure käitumist või igapäevategevusi mõjutab?",
          "Millal mure kõige rohkem avaldub?"
        ],
        redQuestions: [
          "Millistes tegevustes või suhtlusolukordades vajab inimene vaimse tervise tõttu abi?",
          "Kas esineb ärevust, ettearvamatut käitumist, emotsioonide kontrolli raskust või stressis tegutsemise raskust?",
          "Kas abi on praegu olemas ja piisav?"
        ],
        comprehensiveQuestions: [
          "Mis aitab inimesel rahuneda või igapäevaelu jätkata?"
        ]
      },
      {
        id: "treatment_awareness",
        title: "Haigusteadlikkus ja raviplaan",
        question: "Kas inimesel on haigusteadlikkus ja ta suudab iseseisvalt järgida raviplaani?",
        yellowQuestions: [
          "Kas raskus puudutab oma seisundi mõistmist, koostööd spetsialistidega või raviplaani järgimist?",
          "Milline tugi praegu aitab?"
        ],
        redQuestions: [
          "Millises osas raviplaani järgimine või spetsialistidega koostöö ei toimi?",
          "Kas ravimite võtmine, juhiste järgimine või abi vastuvõtmine vajab kontrolli või kõrvalabi?",
          "Mis võib juhtuda, kui tugi puudub?"
        ],
        comprehensiveQuestions: [
          "Millised tervishoiu või lähedaste kokkulepped toetavad raviplaani järgimist?"
        ]
      },
      {
        id: "risk_behavior",
        title: "Riskivaldkonnad",
        question: "Kas inimese käitumine on adekvaatne ja puudub riskikäitumine, mis ohustab tema enda või teiste turvalisust ja emotsioonidega toimetulekut?",
        yellowQuestions: [
          "Millised ohumärgid või riskikäitumise ilmingud on esinenud?",
          "Kas risk puudutab enese hooletusse jätmist, sõltuvust, agressiivsust või lootusetust?"
        ],
        redQuestions: [
          "Milline risk inimesele või teistele praegu esineb?",
          "Kas on esinenud ennast kahjustavat käitumist, suitsiidimõtteid, vägivalda või ohtu lastele või sõltuvatele inimestele?",
          "Kas olukord vajab kiiret inimese sekkumist?"
        ],
        comprehensiveQuestions: [
          "Mis aitab riski vähendada ja kelle poole on juba pöördutud?"
        ]
      },
      {
        id: "safe_network",
        title: "Turvaline elukeskkond ja võrgustik",
        question: "Kas inimese elukeskkond ja sotsiaalne võrgustik on turvalised?",
        yellowQuestions: [
          "Mis teeb elukeskkonna või võrgustiku turvalisuse juures muret?",
          "Kas inimene saab oma murest vabalt rääkida?"
        ],
        redQuestions: [
          "Kas inimene tunneb hirmu pereliikme, abistaja või muu lähedase ees?",
          "Kas esineb füüsilist, psüühilist või majanduslikku vägivalda, alavääristavat kohtlemist või liikumise piiramist?",
          "Kas inimene saab praegu turvaliselt olla?"
        ],
        comprehensiveQuestions: [
          "Kes või mis toetab inimese turvalisust praegu?"
        ]
      }
    ],
    routingSignals: ["vaimse tervise tugi", "nõustamine", "KOV kontakt"]
  },
  {
    id: "physical_health",
    title: "Füüsiline tervis",
    helperText: "Mõtle kodus liikumisele, kodust väljumisele, arstil käimisele ja abivahenditele.",
    primaryQuestions: [
      {
        id: "physical_health_care",
        title: "Tervise eest hoolitsemine",
        question: "Kas inimene suudab iseseisvalt hoolitseda oma füüsilise tervise eest ja kasutada tervishoiuteenuseid?",
        yellowQuestions: [
          "Kas raskus puudutab haigestumise korral abi otsimist, arstiga ühendust võtmist või nõuannete järgimist?",
          "Milline abi praegu toimib?"
        ],
        redQuestions: [
          "Millises füüsilise tervise eest hoolitsemise osas vajab inimene abi?",
          "Kas inimene jõuab pere- või eriarsti vastuvõtule ja analüüsidele?",
          "Kas on ravimita, ravita või tervise halvenemise risk?"
        ],
        comprehensiveQuestions: [
          "Millised tervisekäitumise või füüsilise mugavuse lahendused toetavad inimest praegu?"
        ]
      },
      {
        id: "indoor_mobility",
        title: "Liikumine eluruumides",
        question: "Kas inimene suudab iseseisvalt liikuda eluruumides?",
        yellowQuestions: [
          "Millistes kodustes liikumistes on raskusi?",
          "Kas inimene kasutab kodus abivahendit või kõrvalabi?"
        ],
        redQuestions: [
          "Millistes eluruumides või asendivahetustes vajab inimene abi?",
          "Kas esineb kukkumisriski või ei pääse inimene vajalikesse ruumidesse?",
          "Kas praegused abivahendid või abi on piisavad?"
        ],
        comprehensiveQuestions: [
          "Mis aitab inimesel kodus turvaliselt liikuda?"
        ]
      },
      {
        id: "outdoor_mobility",
        title: "Liikumine väljaspool eluruume",
        question: "Kas inimene suudab iseseisvalt liikuda väljaspool eluruume?",
        yellowQuestions: [
          "Kas raskus puudutab õues liikumist, treppe, transporti või abivahendit?",
          "Kuidas inimene praegu vajalikesse kohtadesse jõuab?"
        ],
        redQuestions: [
          "Millises väljaspool kodu liikumise osas vajab inimene abi?",
          "Kas inimene saab turvaliselt kasutada transporti või jõuda teenusteni?",
          "Kas abivahend, abistaja või sotsiaaltransport võiks olla vajalik?"
        ],
        comprehensiveQuestions: [
          "Millised kodust väljumise võimalused praegu toimivad?"
        ]
      }
    ],
    routingSignals: ["sotsiaaltransport", "abivahendid", "kodukohandus", "koduteenus"]
  },
  {
    id: "living_environment",
    title: "Elukeskkond",
    helperText: "Mõtle elukoha olemasolule, küttele, ligipääsule, ohutusele ja abi kutsumise võimalusele.",
    primaryQuestions: [
      {
        id: "housing_retention",
        title: "Sobiva eluaseme saamine või säilitamine",
        question: "Kas inimene on võimeline iseseisvalt olemasolevat eluaset säilitama või sobivat eluaset otsima või taotlema?",
        yellowQuestions: [
          "Kas raskus puudutab eluaseme säilitamist, uue eluaseme otsimist või eluasemega seotud asjaajamist?",
          "Kes aitab praegu?"
        ],
        redQuestions: [
          "Millises eluasemega seotud toimingus vajab inimene abi?",
          "Kas on oht olemasolev eluase kaotada või puudub sobiv eluase?",
          "Kas eluasemega seotud maksed, lepingud või vara hooldamine vajavad tuge?"
        ],
        comprehensiveQuestions: [
          "Mis praeguse eluaseme juures inimese toimetulekut toetab?"
        ]
      },
      {
        id: "suitable_home",
        title: "Eluase ja elamistingimused",
        question: "Kas inimesel on olemas sobiv elamispind?",
        yellowQuestions: [
          "Mis elamispinna sobivuse juures vajab täpsustamist?",
          "Kas eluruum vajab kohandamist või on kolimine arutamisel?"
        ],
        redQuestions: [
          "Miks praegune elamispind ei ole sobiv või turvaline?",
          "Kas puudub elamispind, vajalik ligipääs, küte või muu esmavajalik tingimus?",
          "Milline elamispinna muutus oleks esimesena vajalik?"
        ],
        comprehensiveQuestions: [
          "Millised elamistingimused aitavad inimesel praegu toime tulla?"
        ]
      },
      {
        id: "call_for_help",
        title: "Abi kutsumise võimalus",
        question: "Kas inimesel on olemas võimalus abi kutsumiseks?",
        yellowQuestions: [
          "Kas raskus puudutab telefoni, arvuti, häirenupu või muu sidevahendi kasutamist?",
          "Kellele inimene vajadusel helistab või kirjutab?"
        ],
        redQuestions: [
          "Miks inimene ei saa vajadusel abi kutsuda?",
          "Kas sidevahend on olemas ja kas inimene oskab seda kasutada?",
          "Kas abi kutsumise puudumine võib muuta olukorra ohtlikuks?"
        ],
        comprehensiveQuestions: [
          "Milline abi kutsumise lahendus praegu toimib?"
        ]
      }
    ],
    routingSignals: ["eluruum", "kodukohandus", "kriisiabi", "KOV kontakt"]
  },
  {
    id: "work_income",
    title: "Hõivatus",
    helperText: "Mõtle sellele, kas majanduslik olukord või hõive takistab toimetulekut.",
    primaryQuestions: [
      {
        id: "occupation_access",
        title: "Rakenduse leidmine ja säilitamine",
        question: "Kas inimene on võimeline iseseisvalt leidma või säilitama töö, õppimise või muu hõivega seotud rakendust?",
        yellowQuestions: [
          "Kas raskus puudutab töö või õppimise leidmist, selle säilitamist või kohustuste täitmist?",
          "Milline tugi praegu aitab?"
        ],
        redQuestions: [
          "Millises töö, õppimise või muu hõivega seotud osas vajab inimene abi?",
          "Kas inimene vajab tuge töö otsimisel, töökoha säilitamisel või õppimise korraldamisel?",
          "Millist abi on juba proovitud?"
        ],
        comprehensiveQuestions: [
          "Millised oskused, huvid või toimivad hõivevõimalused inimesel olemas on?"
        ]
      },
      {
        id: "occupation_participation",
        title: "Seotus hõivega",
        question: "Kas inimene on töö, õppimise või muu hõivega seotud?",
        yellowQuestions: [
          "Millise töö, õppimise või muu hõivega inimene seotud on?",
          "Kas hõives osalemine vajab tuge?"
        ],
        redQuestions: [
          "Kas inimene soovib või vajab hõivega seotuse muutmist?",
          "Millised takistused töö, õppimise või muu rakenduse juures praegu esinevad?",
          "Kas töö- või õppekoormus vastab inimese olukorrale?"
        ],
        comprehensiveQuestions: [
          "Mis hõives osalemise juures praegu toimib?"
        ]
      },
      {
        id: "income_retention",
        title: "Sissetuleku säilitamine",
        question: "Kas inimese töötasu või muu sissetulek on püsinud muutumatu sõltumata tervislikust olukorrast?",
        yellowQuestions: [
          "Mis sissetuleku juures on muutunud või vajab täpsustamist?",
          "Kas inimene sõltub rahalises toimetulekus kellestki teisest?"
        ],
        redQuestions: [
          "Kuidas tervise või olukorra muutus on sissetulekut mõjutanud?",
          "Kas sissetulek katab praegu igapäevased vajadused?",
          "Kas esineb kiireloomuline majandusliku turvalisuse mure?"
        ],
        comprehensiveQuestions: [
          "Millised sissetuleku või toetuse allikad praegu toimetulekut toetavad?"
        ]
      }
    ],
    routingSignals: ["toimetulekutoetus", "võlanõustamine", "Töötukassa", "KOV kontakt"]
  },
  {
    id: "participation",
    title: "Vaba aeg ja huvitegevus",
    helperText: "Mõtle päevasele tegevusele, suhetele, huvitegevusele ja kogukonnas osalemisele.",
    primaryQuestions: [
      {
        id: "leisure",
        title: "Vaba aeg",
        question: "Kas inimene suudab iseseisvalt oma vaba aega sisustada, leida või säilitada huvitegevuse võimalusi?",
        yellowQuestions: [
          "Millises vaba aja, hobide või kogukonnas osalemise osas on raskusi?",
          "Millised tegevused on inimesele olulised?"
        ],
        redQuestions: [
          "Millistes vaba aja või huvitegevuse võimalustes vajab inimene abi?",
          "Kas inimene saab osaleda talle olulistes tegevustes või kogukonnaelus?",
          "Mis aitaks osalemist või päeva sisustamist esimesena parandada?"
        ],
        comprehensiveQuestions: [
          "Millised hobid, huvid või kogukondlikud tegevused praegu toimivad?"
        ]
      }
    ],
    routingSignals: ["päevakeskus", "kogukonnateenus", "tugiisik", "nõustamine"]
  },
  {
    id: "daily_living",
    title: "Igapäevaelu toimingud",
    helperText: "Mõtle söögi tegemisele, pesemisele, riietumisele, koristamisele, poes või apteegis käimisele, ravimitele ja rahaasjadele.",
    primaryQuestions: [
      {
        id: "money_management",
        title: "Rahadega toimetulek",
        question: "Kas inimene on iseseisev oma rahade planeerimisel?",
        yellowQuestions: [
          "Kas raskus puudutab ostude tegemist, teenuste tellimist, eelarvet või pangateenuseid?",
          "Kas inimene saab praegu abi rahaasjade korraldamisel?"
        ],
        redQuestions: [
          "Millises rahaasjade või asjaajamise osas vajab inimene abi?",
          "Kas esineb võlgnevusi või ohtu, et vajalikud kulud jäävad tasumata?",
          "Kas inimene saab kasutada pangateenuseid ja planeerida igapäevaseid oste?"
        ],
        comprehensiveQuestions: [
          "Mis rahaasjade korraldamise juures praegu toimib?"
        ]
      },
      {
        id: "food_preparation",
        title: "Toidu valmistamine",
        question: "Kas inimene suudab iseseisvalt süüa valmistada ja teha sellega seotud tegevusi?",
        yellowQuestions: [
          "Kas raskus puudutab sisseoste, toidu valmistamist, soojendamist või köögi korrastamist?",
          "Kes või mis praegu aitab?"
        ],
        redQuestions: [
          "Millises toidu hankimise või valmistamise osas vajab inimene abi?",
          "Kas inimene saab vajaliku toidu kätte ja ohutult valmistatud?",
          "Kas on risk jääda söömata või sõltuda täielikult kõrvalabist?"
        ],
        comprehensiveQuestions: [
          "Millised toidu valmistamise või sisseostude lahendused praegu toimivad?"
        ]
      },
      {
        id: "eating_drinking",
        title: "Söömine ja joomine",
        question: "Kas inimene suudab iseseisvalt süüa-juua ja teha sellega seotud tegevusi?",
        yellowQuestions: [
          "Kas raskus puudutab söögiriistu, toidu tükeldamist, joogi valamist või piisavat söömist ja joomist?",
          "Milline abi või kohandus praegu aitab?"
        ],
        redQuestions: [
          "Millises söömise või joomise osas vajab inimene abi?",
          "Kas inimene vajab toitmisel, joogi andmisel või kohandatud toidu ja nõude kasutamisel tuge?",
          "Kas on oht, et inimene ei söö või ei joo piisavalt?"
        ],
        comprehensiveQuestions: [
          "Mis aitab inimesel söömisel ja joomisel iseseisvust hoida?"
        ]
      },
      {
        id: "household",
        title: "Majapidamine",
        question: "Kas inimene suudab iseseisvalt teha majapidamisega seotud tegevusi?",
        yellowQuestions: [
          "Kas raskus puudutab koristamist, pesu, kodumasinaid, prügi või sissepääsuteede korrashoidu?",
          "Millised kodused toimingud praegu toimivad?"
        ],
        redQuestions: [
          "Millistes majapidamistoimingutes vajab inimene abi?",
          "Kas eluruumid ja riided püsivad ilma kõrvalabita puhtad ja kasutatavad?",
          "Kas inimene vajab meeldetuletamist, juhendamist või füüsilist abi?"
        ],
        comprehensiveQuestions: [
          "Kes või mis majapidamises praegu aitab?"
        ]
      },
      {
        id: "self_care",
        title: "Enese eest hoolitsemine",
        question: "Kas inimene on võimeline iseseisvalt teostama enesehooldusega seotud toiminguid?",
        yellowQuestions: [
          "Kas raskus puudutab pesemist, tualetti, riietumist või kehaosade hooldamist?",
          "Milline abi või kohandus praegu toimib?"
        ],
        redQuestions: [
          "Millistes enesehoolduse toimingutes vajab inimene abi?",
          "Kas pesemisel, tualetitoimingutel või riietumisel esineb ohutusriski?",
          "Kas inimene vajab meeldetuletamist, juhendamist või füüsilist kõrvalabi?"
        ],
        comprehensiveQuestions: [
          "Milliste enesehoolduse toimingutega saab inimene praegu ise hakkama?"
        ]
      }
    ],
    routingSignals: ["koduteenus", "sotsiaaltransport", "abivahendid", "hoolduskoormus"]
  }
]);

const OPTION_STATUS_BY_VALUE = new Map(PRE_INQUIRY_SCREEN_OPTIONS.map((option) => [option.value, option.status]));
const OPTION_LABEL_BY_VALUE = new Map(PRE_INQUIRY_SCREEN_OPTIONS.map((option) => [option.value, option.label]));
const PATH_BY_ID = new Map(PRE_INQUIRY_ASSESSMENT_PATHS.map((path) => [path.id, path]));
const DOMAIN_BY_ID = new Map(PRE_INQUIRY_DOMAIN_DEFINITIONS.map((domain) => [domain.id, domain]));

function normalizeString(value, maxLength = 4_000) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  return normalized ? normalized.slice(0, maxLength) : "";
}

function normalizeStringArray(values, maxLength = 1_000) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value, maxLength))
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeFollowUpAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, answer]) => [normalizeString(key, 120), normalizeString(answer, 2_000)])
      .filter(([key, answer]) => key && answer)
      .slice(0, 40)
  );
}

function createEmptyPrimaryAnswer(question) {
  return {
    id: question.id,
    title: question.title,
    question: question.question,
    screenAnswer: "",
    status: "",
    followUpAnswers: {},
    userConfirmed: false
  };
}

function normalizePrimaryAnswer(question, incoming = {}) {
  const screenAnswer = PRE_INQUIRY_SCREEN_OPTIONS.some((option) => option.value === incoming.screenAnswer)
    ? incoming.screenAnswer
    : "";
  const followUpAnswers = normalizeFollowUpAnswers(incoming.followUpAnswers);
  return {
    ...createEmptyPrimaryAnswer(question),
    screenAnswer,
    status: OPTION_STATUS_BY_VALUE.get(screenAnswer) || "",
    followUpAnswers,
    userConfirmed: Boolean(incoming.userConfirmed || screenAnswer || Object.keys(followUpAnswers).length)
  };
}

function strongestStatus(values = []) {
  const priorities = ["RED", "YELLOW", "UNKNOWN", "GREEN", "NOT_APPLICABLE"];
  return priorities.find((status) => values.includes(status)) || "";
}

export function createEmptyPreInquiryAssessmentState(pathId = "QUICK_DESCRIPTION") {
  const path = PATH_BY_ID.has(pathId) ? pathId : "QUICK_DESCRIPTION";
  return {
    version: 1,
    path,
    mode: path === "QUICK_DESCRIPTION" ? "QUICK_DESCRIPTION" : "GUIDED_ASSESSMENT",
    depth: path === "COMPREHENSIVE_ASSESSMENT" ? "COMPREHENSIVE" : path === "TARGETED_ASSESSMENT" ? "TARGETED" : "QUICK",
    subject: {
      concernsAbout: "",
      municipalityText: "",
      consentStatus: "",
      urgency: ""
    },
    riskGate: {
      level: "NONE",
      reasons: [],
      userVisibleMessage: ""
    },
    domains: PRE_INQUIRY_DOMAIN_DEFINITIONS.map((domain) => ({
      id: domain.id,
      title: domain.title,
      screenAnswer: "",
      status: "",
      initialStatus: "",
      finalStatus: "",
      statusSource: "",
      strengths: [],
      concerns: [],
      followUpAnswers: {},
      primaryAnswers: domain.primaryQuestions.map(createEmptyPrimaryAnswer),
      routingSignals: [],
      missingInfo: [],
      userConfirmed: false
    })),
    supportContext: {
      existingSupport: "",
      supportAdequacy: "",
      personWish: ""
    },
    routing: {
      confidence: "LOW",
      possibleDirections: [],
      contactSearchInput: {
        municipalityText: "",
        domainSignals: [],
        riskFlags: []
      }
    },
    sharedJourneyInfo: null
  };
}

export function getPreInquiryQuestionFollowUpQuestions(question, assessmentPath, screenAnswer) {
  const status = OPTION_STATUS_BY_VALUE.get(screenAnswer) || "";
  if (assessmentPath === "COMPREHENSIVE_ASSESSMENT") {
    const base = status === "RED"
      ? question.redQuestions
      : status === "YELLOW" || status === "UNKNOWN"
        ? question.yellowQuestions
        : [];
    return [...base, ...question.comprehensiveQuestions];
  }
  if (status === "RED") return question.redQuestions;
  if (status === "YELLOW" || status === "UNKNOWN") return question.yellowQuestions;
  return [];
}

export function normalizePreInquiryAssessmentState(input = {}) {
  const existing = input && typeof input === "object" ? input : {};
  const path = PATH_BY_ID.has(existing.path) ? existing.path : "QUICK_DESCRIPTION";
  const empty = createEmptyPreInquiryAssessmentState(path);
  const incomingDomains = Array.isArray(existing.domains) ? existing.domains : [];
  const incomingById = new Map(incomingDomains.map((domain) => [domain?.id, domain]));
  const subject = existing.subject && typeof existing.subject === "object" ? existing.subject : {};
  const supportContext = existing.supportContext && typeof existing.supportContext === "object" ? existing.supportContext : {};
  const urgency = normalizeString(subject.urgency, 120);
  const inferredRiskLevel = urgency === "Keegi võib olla vahetus ohus"
    ? "CRISIS"
    : urgency === "Olukord on tõsine ja vajab kiiret sekkumist"
      ? "WARNING"
      : "NONE";
  const inferredRiskMessage = inferredRiskLevel === "CRISIS"
    ? "Kui keegi võib olla vahetus ohus, helista 112 või pöördu kohe sobiva kriisiabi poole."
    : inferredRiskLevel === "WARNING"
      ? "Kirjeldasid kiiret olukorda. Eelpöördumise kõrval kaalu kohe inimese või pädeva teenusega ühendust võtmist."
      : "";

  const domains = PRE_INQUIRY_DOMAIN_DEFINITIONS.map((definition) => {
    const incoming = incomingById.get(definition.id) || {};
    const legacyScreenAnswer = PRE_INQUIRY_SCREEN_OPTIONS.some((option) => option.value === incoming.screenAnswer)
      ? incoming.screenAnswer
      : "";
    const incomingPrimaryAnswers = Array.isArray(incoming.primaryAnswers) ? incoming.primaryAnswers : [];
    const incomingPrimaryById = new Map(incomingPrimaryAnswers.map((answer) => [answer?.id, answer]));
    const primaryAnswers = definition.primaryQuestions.map((question, index) => normalizePrimaryAnswer(
      question,
      incomingPrimaryById.get(question.id) || (index === 0 && legacyScreenAnswer
        ? {
            screenAnswer: legacyScreenAnswer,
            followUpAnswers: incoming.followUpAnswers
          }
        : {})
    ));
    const status = strongestStatus(primaryAnswers.map((answer) => answer.status));
    const screenAnswer = primaryAnswers.length === 1 ? primaryAnswers[0].screenAnswer : "";
    const followUpAnswers = normalizeFollowUpAnswers(incoming.followUpAnswers);
    const hasAnswer = Boolean(primaryAnswers.some((answer) => answer.userConfirmed) || screenAnswer || Object.keys(followUpAnswers).length);
    const routingSignals = status && !["GREEN", "NOT_APPLICABLE"].includes(status)
      ? definition.routingSignals
      : [];

    return {
      ...empty.domains.find((domain) => domain.id === definition.id),
      screenAnswer,
      status,
      initialStatus: incoming.initialStatus || status,
      finalStatus: incoming.finalStatus || status,
      statusSource: screenAnswer ? "USER_SELECTED" : "",
      strengths: normalizeStringArray(incoming.strengths),
      concerns: normalizeStringArray(incoming.concerns),
      followUpAnswers,
      primaryAnswers,
      routingSignals,
      missingInfo: normalizeStringArray(incoming.missingInfo),
      userConfirmed: Boolean(incoming.userConfirmed || hasAnswer)
    };
  });

  const domainSignals = domains.flatMap((domain) => domain.routingSignals);
  const nonGreenDomains = domains.filter((domain) => ["YELLOW", "RED", "UNKNOWN"].includes(domain.status));
  const hasMunicipality = Boolean(normalizeString(subject.municipalityText));
  const confidence = hasMunicipality && nonGreenDomains.length ? "HIGH" : hasMunicipality || nonGreenDomains.length ? "MEDIUM" : "LOW";

  return {
    ...empty,
    version: 1,
    path,
    mode: path === "QUICK_DESCRIPTION" ? "QUICK_DESCRIPTION" : "GUIDED_ASSESSMENT",
    depth: path === "COMPREHENSIVE_ASSESSMENT" ? "COMPREHENSIVE" : path === "TARGETED_ASSESSMENT" ? "TARGETED" : "QUICK",
    subject: {
      concernsAbout: normalizeString(subject.concernsAbout, 120),
      municipalityText: normalizeString(subject.municipalityText, 180),
      consentStatus: normalizeString(subject.consentStatus, 120),
      urgency
    },
    riskGate: {
      level: ["NONE", "WARNING", "CRISIS"].includes(existing.riskGate?.level) && existing.riskGate.level !== "NONE"
        ? existing.riskGate.level
        : inferredRiskLevel,
      reasons: normalizeStringArray(existing.riskGate?.reasons),
      userVisibleMessage: normalizeString(existing.riskGate?.userVisibleMessage) || inferredRiskMessage
    },
    domains,
    supportContext: {
      existingSupport: normalizeString(supportContext.existingSupport),
      supportAdequacy: normalizeString(supportContext.supportAdequacy, 180),
      personWish: normalizeString(supportContext.personWish)
    },
    routing: {
      confidence,
      possibleDirections: [...new Set(domainSignals)].slice(0, 12),
      contactSearchInput: {
        municipalityText: normalizeString(subject.municipalityText, 180),
        domainSignals: [...new Set(domainSignals)].slice(0, 12),
        riskFlags: normalizeStringArray(existing.routing?.contactSearchInput?.riskFlags)
      }
    },
    sharedJourneyInfo: normalizePreInquiryJourneySharedInfo(existing.sharedJourneyInfo)
  };
}

export function buildPreInquiryAssessmentSituation(state = {}) {
  const normalized = normalizePreInquiryAssessmentState(state);
  const lines = [];
  const path = PATH_BY_ID.get(normalized.path);
  const affectedDomains = normalized.domains.filter((domain) => ["YELLOW", "RED", "UNKNOWN"].includes(domain.status));
  const strengths = normalized.domains.filter((domain) => domain.status === "GREEN").map((domain) => domain.title);

  lines.push(`Eelkaardistus: ${path?.title || "Eelpöördumine"}.`);
  if (normalized.subject.concernsAbout) lines.push(`Kelle kohta: ${normalized.subject.concernsAbout}.`);
  if (normalized.subject.municipalityText) lines.push(`Piirkond/KOV: ${normalized.subject.municipalityText}.`);
  if (normalized.subject.urgency) lines.push(`Kiireloomulisus: ${normalized.subject.urgency}.`);
  if (affectedDomains.length) {
    lines.push(`Täpsustamist vajavad valdkonnad: ${affectedDomains.map((domain) => domain.title).join(", ")}.`);
  }
  if (strengths.length) {
    lines.push(`Tugevused või toimivad valdkonnad: ${strengths.join(", ")}.`);
  }
  if (normalized.supportContext.existingSupport) lines.push(`Olemasolev abi: ${normalized.supportContext.existingSupport}`);
  if (normalized.supportContext.personWish) lines.push(`Inimese soov: ${normalized.supportContext.personWish}`);

  return lines.join("\n").trim();
}

function buildReviewQuestionItem(domain, primaryAnswer) {
  return {
    id: `${domain.id}:${primaryAnswer.id}`,
    domainId: domain.id,
    domainTitle: domain.title,
    questionId: primaryAnswer.id,
    title: primaryAnswer.title,
    question: primaryAnswer.question,
    answerValue: primaryAnswer.screenAnswer,
    answerLabel: OPTION_LABEL_BY_VALUE.get(primaryAnswer.screenAnswer) || "",
    status: primaryAnswer.status || "",
    followUpAnswers: Object.entries(primaryAnswer.followUpAnswers || {}).map(([question, answer]) => ({
      question,
      answer
    }))
  };
}

export function buildPreInquiryAssessmentReview(state = {}, context = {}) {
  const normalized = normalizePreInquiryAssessmentState(state);
  const path = PATH_BY_ID.get(normalized.path);
  const usesQuestionnaire = normalized.path !== "QUICK_DESCRIPTION";
  const primaryQuestions = usesQuestionnaire
    ? normalized.domains.flatMap((domain) => (
        (domain.primaryAnswers || []).map((primaryAnswer) => buildReviewQuestionItem(domain, primaryAnswer))
      ))
    : [];
  const answeredPrimaryQuestions = primaryQuestions.filter((item) => item.answerValue);
  const concernQuestions = primaryQuestions.filter((item) => ["YELLOW", "RED"].includes(item.status));
  const unknownQuestions = primaryQuestions.filter((item) => item.status === "UNKNOWN");
  const strengthQuestions = primaryQuestions.filter((item) => item.status === "GREEN");
  const unansweredQuestions = primaryQuestions.filter((item) => !item.answerValue);
  const concernDomainIds = new Set([...concernQuestions, ...unknownQuestions].map((item) => item.domainId));

  return {
    pathTitle: path?.title || normalized.path,
    topic: normalizeString(context.topic, 240),
    progress: {
      answeredPrimaryCount: answeredPrimaryQuestions.length,
      totalPrimaryCount: primaryQuestions.length,
      unansweredPrimaryCount: unansweredQuestions.length
    },
    subjectLines: [
      ["Kelle kohta", normalized.subject.concernsAbout],
      ["Piirkond/KOV", normalized.subject.municipalityText],
      ["Kiireloomulisus", normalized.subject.urgency],
      ["Nõusolek või pöördumise alus", normalized.subject.consentStatus]
    ].filter(([, value]) => value).map(([label, value]) => ({ label, value })),
    concernDomains: normalized.domains
      .filter((domain) => concernDomainIds.has(domain.id))
      .map((domain) => ({
        id: domain.id,
        title: domain.title,
        routingSignals: domain.routingSignals
      })),
    concernQuestions,
    unknownQuestions,
    strengthQuestions,
    unansweredQuestions,
    supportLines: [
      ["Olemasolev abi", normalized.supportContext.existingSupport],
      ["Kas abist piisab", normalized.supportContext.supportAdequacy],
      ["Inimese enda soov", normalized.supportContext.personWish]
    ].filter(([, value]) => value).map(([label, value]) => ({ label, value })),
    possibleDirections: normalized.routing.possibleDirections,
    riskMessage: normalized.riskGate.userVisibleMessage
  };
}

export function buildPreInquiryAssessmentDraftSummary(state = {}) {
  const review = buildPreInquiryAssessmentReview(state);
  const lines = ["Eelkaardistuse kokkuvõte"];
  const concernQuestions = [...review.concernQuestions, ...review.unknownQuestions].slice(0, 8);
  const strengthQuestions = review.strengthQuestions.slice(0, 6);
  const hasMeaningfulData = Boolean(
    review.subjectLines.length ||
    review.riskMessage ||
    concernQuestions.length ||
    strengthQuestions.length ||
    review.supportLines.length ||
    review.possibleDirections.length
  );

  if (!hasMeaningfulData) return "";

  if (review.pathTitle) lines.push(`Rada: ${review.pathTitle}`);
  for (const line of review.subjectLines) {
    lines.push(`${line.label}: ${line.value}`);
  }
  if (review.riskMessage) {
    lines.push(`Oluline märkus: ${review.riskMessage}`);
  }

  if (concernQuestions.length) {
    lines.push("", "Peamised mured ja täpsustused:");
    for (const question of concernQuestions) {
      lines.push(`- ${question.domainTitle} / ${question.title}: ${question.answerLabel || "Vajab täpsustamist"}`);
      if (question.question) lines.push(`  Küsimus: ${question.question}`);
      for (const answer of question.followUpAnswers) {
        lines.push(`  Täpsustus: ${answer.question}`);
        lines.push(`  ${answer.answer}`);
      }
    }
  }

  if (strengthQuestions.length) {
    lines.push("", "Toimivad valdkonnad või tugevused:");
    for (const question of strengthQuestions) {
      lines.push(`- ${question.domainTitle} / ${question.title}: ${question.answerLabel}`);
      if (question.question) lines.push(`  Küsimus: ${question.question}`);
    }
  }

  if (review.supportLines.length) {
    lines.push("", "Olemasolev abi ja inimese soov:");
    for (const line of review.supportLines) {
      lines.push(`- ${line.label}: ${line.value}`);
    }
  }

  if (review.possibleDirections.length) {
    lines.push("", `Võimalikud teenuse- või kontaktisuunad: ${review.possibleDirections.join(", ")}`);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildPreInquiryAssessmentAssistContext(state = {}) {
  const normalized = normalizePreInquiryAssessmentState(state);
  const hasUrgencyAnswer = Boolean(normalized.subject.urgency && normalized.subject.urgency !== "Ei oska öelda");
  const urgencyLevel = normalized.riskGate.level === "CRISIS" || normalized.riskGate.level === "WARNING"
    ? "URGENT"
    : hasUrgencyAnswer
      ? "NORMAL"
      : "";

  return {
    municipality: normalized.subject.municipalityText,
    selectedNeedAreas: normalized.routing.possibleDirections,
    urgencyLevel
  };
}

export function buildPreInquiryAssessmentExportText(state = {}, context = {}) {
  const normalized = normalizePreInquiryAssessmentState(state);
  const path = PATH_BY_ID.get(normalized.path);
  const lines = [
    "SotsiaalAI eelpöördumise eelinfo",
    "",
    "See ei ole ametlik abivajaduse hindamine ega teenuse määramise otsus. See aitab olukorda läbi mõelda ja pöördumist ette valmistada.",
    "",
    `Rada: ${path?.title || normalized.path}`,
    "Põhiküsimuste alus: täisealise inimese abi- ja toetusvajaduse hindamise juhendi eluvaldkondade põhiküsimused."
  ];

  if (context.topic) lines.push(`Teema: ${context.topic}`);
  if (context.recipientName) lines.push(`Adressaat: ${context.recipientName}`);
  if (normalized.subject.concernsAbout) lines.push(`Kelle kohta: ${normalized.subject.concernsAbout}`);
  if (normalized.subject.municipalityText) lines.push(`Piirkond/KOV: ${normalized.subject.municipalityText}`);
  if (normalized.subject.urgency) lines.push(`Kiireloomulisus: ${normalized.subject.urgency}`);
  if (normalized.subject.consentStatus) lines.push(`Nõusolek/pöördumise alus: ${normalized.subject.consentStatus}`);

  lines.push("", "Eluvaldkonnad");
  for (const domain of normalized.domains) {
    const definition = DOMAIN_BY_ID.get(domain.id);
    lines.push("", definition?.title || domain.title);
    for (const primaryAnswer of domain.primaryAnswers || []) {
      const answerLabel = OPTION_LABEL_BY_VALUE.get(primaryAnswer.screenAnswer) || "Vastamata";
      lines.push(`- ${primaryAnswer.title}: ${primaryAnswer.question}`);
      lines.push(`  Vastus: ${answerLabel}`);
      const followUps = Object.entries(primaryAnswer.followUpAnswers || {});
      for (const [question, answer] of followUps) {
        lines.push(`  Täpsustus: ${question}`);
        lines.push(`  ${answer}`);
      }
    }
    const legacyFollowUps = Object.entries(domain.followUpAnswers || {});
    for (const [question, answer] of legacyFollowUps) {
      lines.push(`- Varasem täpsustus: ${question}`);
      lines.push(`  ${answer}`);
    }
    if (domain.routingSignals?.length) {
      lines.push(`- Võimalikud teenuse- või kontaktisuunad: ${domain.routingSignals.join(", ")}`);
    }
  }

  if (normalized.supportContext.existingSupport || normalized.supportContext.supportAdequacy || normalized.supportContext.personWish) {
    lines.push("", "Olemasolev abi ja inimese soov");
    if (normalized.supportContext.existingSupport) lines.push(`Olemasolev abi: ${normalized.supportContext.existingSupport}`);
    if (normalized.supportContext.supportAdequacy) lines.push(`Kas abist piisab: ${normalized.supportContext.supportAdequacy}`);
    if (normalized.supportContext.personWish) lines.push(`Inimese enda soov: ${normalized.supportContext.personWish}`);
  }

  const situation = normalizeString(context.situation);
  const draft = normalizeString(context.draft);
  if (situation) {
    lines.push("", "Olukorra kirjeldus", situation);
  }
  if (draft) {
    lines.push("", "Pöördumise eelvaade", draft);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
