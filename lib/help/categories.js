import prisma from "../prisma.js";
import { HELP_CATEGORY_DATA_PATH, loadHelpCategorySeedEntries } from "./categoryData.js";

const helpCategorySummarySelect = Object.freeze({
  id: true,
  code: true,
  labelEt: true,
  labelEn: true,
  labelRu: true,
  sortOrder: true,
  isActive: true,
  parentId: true
});

function normalizeCode(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

/* ABI LIIGI TULETAMINE TEKSTIST — SÕNAREEGLID.
 *
 * Varem olid reeglid kujul `/\b(õpp|opp|juhend|…)\b/i` ja sellel oli kolm viga:
 *   1. `\b` loeb sõna osaks ainult ladina põhitähti: „õpp…" ei alanud kunagi sõnapiirilt;
 *   2. eesti tüved olid kirjas terve sõnana: „korist", „juhend", „selts", „dokum" nõudsid, et
 *      sõna seal LÕPEKS, nii et „koristamine", „juhendamine" ja „dokumendid" ei sobinud ning liik
 *      tuletus sisuliselt ainult ingliskeelsetest sõnadest;
 *   3. lühike tüvi `vii[a-z]*` luges transpordiks sõnad „viimasel", „viis" ja „viirus", `sõid[a-z]*`
 *      lause „lapsed sõid" ning `telefon[a-z]*` iga kuulutuse, kus seisis „helista telefonil".
 *
 * Nüüd: sõna algab teksti algusest või märgist, mis ei ole täht ega number, ja lõpeb seal, kus
 * täht lõpeb. Tüvi (`stem`) võib jätkuda; liitsõna järelosa (`inWord`) võib olla ka sõna sees
 * („ühistransport", „lumekoristus"). Lühike või mitmetähenduslik sõna on kirjas vormide kaupa.
 * Täppideta kirjapilt („oppimine") on lisatud ainult seal, kus see teise sõnaga kokku ei lange
 * („ope" oleks sobinud sõnaga „operatsioon").
 */
const LETTER = "[\\p{L}\\p{N}_]";
const stem = (text) => `${text}${LETTER}*`;
const inWord = (text) => `${LETTER}*${text}${LETTER}*`;

function words(...alternatives) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?!${LETTER})`, "iu");
}

/* Silt, mille kutsuja ise andis (vana eestikeelne liiginimi või kood). Silt võidab kirjelduse
   sõnad: kui inimene valis „Koduabi", ei tee kirjelduses olev „autoga" sellest transporti.
   Võrdlus käib ilma täppideta, nii et „Igapäevaabi" ja „Igapaevaabi" on sama silt. */
const CATEGORY_LABELS = Object.freeze({
  TRANSPORT: "TRANSPORT",
  IGAPAEVAABI: "DAILY_TASKS",
  DAILY_TASKS: "DAILY_TASKS",
  KODUABI: "HOME_HELP",
  HOME_HELP: "HOME_HELP",
  DIGIABI: "DIGITAL_HELP",
  DIGITAL_HELP: "DIGITAL_HELP",
  "TUGI JA HOOLDUS": "CARE_SUPPORT",
  CARE_SUPPORT: "CARE_SUPPORT",
  "LASTE JA NOORTE TUGI": "CHILD_YOUTH_SUPPORT",
  CHILD_YOUTH_SUPPORT: "CHILD_YOUTH_SUPPORT",
  "OPPIMISE JA JUHENDAMISE ABI": "LEARNING_GUIDANCE",
  LEARNING_GUIDANCE: "LEARNING_GUIDANCE",
  "SELTSKOND JA SOTSIAALNE TUGI": "SOCIAL_SUPPORT",
  SOCIAL_SUPPORT: "SOCIAL_SUPPORT",
  "ASJAAJAMISE JA VORMIDE ABI": "ADMIN_FORM_HELP",
  ADMIN_FORM_HELP: "ADMIN_FORM_HELP",
  "MUU ABI": "OTHER",
  OTHER: "OTHER"
});

function foldLabel(value = "") {
  return normalizeCode(value).normalize("NFD").replace(/\p{Diacritic}+/gu, "");
}

/* Reeglid järjekorras: esimene sobiv võidab. Laste ja noorte tugi on kahes astmes: selge märk
   (lapsehoid, „lapsele tuge") oma kohal, paljas sõna „laps" või „noor" alles lõpus. Muidu võidaks
   lapse mainimine sisulise liigi: „pakun järeleaitamist lastele" on õppimise abi, mitte lapsehoid. */
const CATEGORY_WORD_RULES = Object.freeze([
  [
    "TRANSPORT",
    words(
      inWord("transport"),
      inWord("transpord"),
      /* sõit, sõidu, sõidutada, sõidan; mitte „sõid" (sööma minevik). */
      stem("sõidu"),
      stem("sõida"),
      stem("sõit"),
      stem("soidu"),
      stem("soida"),
      stem("soit"),
      /* „viima" pöördevormid ja „viimine"; mitte „viis", „viimasel", „viimistlus", „viirus". */
      "vii",
      "viia",
      "viib",
      "viin",
      "viime",
      "viite",
      "viivad",
      "viiks",
      "viige",
      "viidaks",
      "viimine",
      "viimise",
      "viimist",
      "viimiseks",
      "viimisel",
      "küüt",
      "küüti",
      "küüdi",
      "autoga",
      stem("autojuh"),
      stem("saatm")
    )
  ],
  [
    "DAILY_TASKS",
    words(
      /* pood, poodi, poes, poest; mitte „poeg". */
      stem("pood"),
      "poes",
      "poest",
      stem("poeskäi"),
      stem("poeskai"),
      stem("poeabi"),
      stem("ostud"),
      stem("sisseost"),
      stem("käimi"),
      stem("kaimi"),
      stem("igapäeva"),
      stem("igapaeva"),
      "errand",
      "errands",
      "shopping"
    )
  ],
  [
    "HOME_HELP",
    words(
      stem("koduabi"),
      inWord("korist"),
      stem("majapid"),
      stem("triiki"),
      stem("muruniit"),
      stem("lumelük"),
      stem("aknapes"),
      `kodu(?:sed|seid|ste|stes|stega) tö${LETTER}*`,
      "household",
      "cleaning"
    )
  ],
  [
    "DIGITAL_HELP",
    words(
      stem("digi"),
      /* Telefon kui abi sisu, mitte kui kontakt: „helista telefonil", „telefoni teel", „telefoninumber". */
      `${LETTER}*telefon(?!il(?!${LETTER})|i teel|inumb|itsi)${LETTER}*`,
      inWord("arvuti"),
      stem("internet"),
      stem("e-teenus"),
      stem("nutisead"),
      stem("id-kaar"),
      "smart-id",
      "mobiil-id",
      "computer",
      "digital"
    )
  ],
  [
    "CARE_SUPPORT",
    words(
      stem("hoold"),
      stem("koduhoold"),
      stem("omastehoold"),
      stem("abistaja"),
      stem("tugiisik"),
      stem("põeta"),
      stem("kõrvalabi"),
      stem("korvalabi"),
      `toetav${LETTER}* kohalol${LETTER}*`,
      "care",
      "caregiver",
      "support worker"
    )
  ],
  [
    "CHILD_YOUTH_SUPPORT",
    words(
      stem("lapsehoi"),
      stem("lastehoi"),
      `(?:lapse|laste|lapsi) hoi${LETTER}*`,
      "(?:lapsele|lastele|noorele|noortele) (?:tuge|abi|seltsi|toeks)",
      `(?:lapse|laste|noore|noorte) (?:toeta|juhenda)${LETTER}*`,
      stem("noorsootöö"),
      stem("noorsootoo"),
      "childcare",
      stem("babysit"),
      "youth work"
    )
  ],
  [
    "LEARNING_GUIDANCE",
    words(
      stem("õpp"),
      stem("õpi"),
      "õpe",
      stem("õpet"),
      stem("oppi"),
      stem("opiabi"),
      stem("juhend"),
      stem("mentor"),
      stem("järeleaita"),
      stem("jareleaita"),
      stem("koolitöö"),
      stem("koolitük"),
      stem("harjuta"),
      `oskuste arenda${LETTER}*`,
      "learning",
      "guidance",
      stem("tutor"),
      "homework"
    )
  ],
  [
    "SOCIAL_SUPPORT",
    words(
      stem("selts"),
      /* suhtlemine, suhtlemisoskus; mitte „suhtleme meili teel". */
      stem("suhtlemi"),
      stem("üksild"),
      stem("üksind"),
      stem("uksild"),
      stem("uksind"),
      stem("vestluskaasla"),
      stem("jutukaasla"),
      stem("jalutuskaasla"),
      "sotsiaal(?:ne|se|set) (?:tugi|toe|tuge)",
      stem("emotsionaal"),
      stem("companion"),
      "social",
      "emotional",
      "lonely",
      "loneliness"
    )
  ],
  [
    "ADMIN_FORM_HELP",
    words(
      stem("avaldus"),
      /* vorm, vormi, vormid, vormistamine; mitte „heas vormis", „platvorm", „töövorm". */
      "vorm",
      "vormi",
      "vorme",
      "vormid",
      "vormide",
      "vormidega",
      stem("vormista"),
      stem("blanket"),
      stem("dokumen"),
      stem("taotlus"),
      stem("taotle"),
      stem("asjaaja"),
      inWord("deklaratsioon"),
      stem("ankee"),
      "admin",
      "administrative",
      "form",
      "forms",
      stem("application"),
      "paperwork"
    )
  ],
  [
    "CHILD_YOUTH_SUPPORT",
    words(
      stem("laps"),
      stem("laste"),
      "noor",
      "noore",
      "noorele",
      "noored",
      "noorte",
      "noortele",
      "noortega",
      "noori",
      "youth",
      "child",
      "children",
      "kid",
      "kids"
    )
  ]
]);

export function inferHelpCategoryCode(input = {}) {
  const labelled = CATEGORY_LABELS[foldLabel(input?.category)];
  if (labelled) return labelled;

  const text = [input?.category, input?.serviceLabel, input?.description]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" . ");
  if (!text) return "OTHER";

  for (const [code, pattern] of CATEGORY_WORD_RULES) {
    if (pattern.test(text)) return code;
  }
  return "OTHER";
}

async function getHelpCategoryByCode(code, prismaClient = prisma) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  return prismaClient.helpCategory.findUnique({
    where: { code: normalizedCode },
    select: helpCategorySummarySelect
  });
}

async function requireHelpCategoryByCode(code, prismaClient = prisma) {
  const category = await getHelpCategoryByCode(code, prismaClient);
  if (!category) {
    const error = new Error("HELP_CATEGORY_NOT_FOUND");
    error.code = "HELP_CATEGORY_NOT_FOUND";
    throw error;
  }
  return category;
}

export async function resolvePrimaryHelpCategory(input = {}, prismaClient = prisma) {
  const explicitId = String(input?.primaryCategoryId || "").trim();
  if (explicitId) {
    const category = await prismaClient.helpCategory.findUnique({
      where: { id: explicitId },
      select: helpCategorySummarySelect
    });
    if (!category) {
      const error = new Error("HELP_PRIMARY_CATEGORY_NOT_FOUND");
      error.code = "HELP_PRIMARY_CATEGORY_NOT_FOUND";
      throw error;
    }
    return category;
  }

  const categoryCode = normalizeCode(input?.primaryCategoryCode)
    || inferHelpCategoryCode({
      category: input?.category,
      serviceLabel: input?.serviceLabel,
      description: input?.description
    });

  return requireHelpCategoryByCode(categoryCode, prismaClient);
}

export async function seedHelpCategories(prismaClient = prisma) {
  const entries = await loadHelpCategorySeedEntries();

  for (const entry of entries) {
    await prismaClient.helpCategory.upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        labelEt: entry.labelEt,
        labelEn: entry.labelEn,
        labelRu: entry.labelRu,
        descriptionEt: entry.descriptionEt,
        descriptionEn: entry.descriptionEn,
        descriptionRu: entry.descriptionRu,
        sortOrder: entry.sortOrder,
        isActive: entry.isActive
      },
      update: {
        labelEt: entry.labelEt,
        labelEn: entry.labelEn,
        labelRu: entry.labelRu,
        descriptionEt: entry.descriptionEt,
        descriptionEn: entry.descriptionEn,
        descriptionRu: entry.descriptionRu,
        sortOrder: entry.sortOrder,
        isActive: entry.isActive
      }
    });
  }

  for (const entry of entries) {
    if (!entry.parentCode) continue;
    const parent = await prismaClient.helpCategory.findUnique({
      where: { code: entry.parentCode },
      select: { id: true }
    });
    if (!parent) {
      throw new Error(`Parent category not found for ${entry.code}: ${entry.parentCode}`);
    }
    await prismaClient.helpCategory.update({
      where: { code: entry.code },
      data: {
        parentId: parent.id
      }
    });
  }

  return {
    count: entries.length,
    sourcePath: HELP_CATEGORY_DATA_PATH
  };
}
