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

export function inferHelpCategoryCode(input = {}) {
  const category = normalizeCode(input?.category);
  const serviceLabel = normalizeCode(input?.serviceLabel);
  const text = `${category} ${serviceLabel} ${String(input?.description || "").toLowerCase()}`;

  if (category === "TRANSPORT" || /\b(transpord[a-z]*|transport[a-z]*|sõid[a-z]*|soid[a-z]*|vii[a-z]*|autoga|saatm[a-z]*)\b/i.test(text)) return "TRANSPORT";
  if (category === "IGAPAEVAABI" || /\b(pood[a-z]*|poes|ostud[a-z]*|kaimin[a-z]*|kaimis[a-z]*|käimin[a-z]*|käimis[a-z]*|igapäeva[a-z]*|igapaeva[a-z]*|errand|shopping)\b/i.test(text)) return "DAILY_TASKS";
  if (category === "KODUABI" || /\b(koduabi|korist|majapid|household|cleaning)\b/i.test(text)) return "HOME_HELP";
  if (category === "DIGIABI" || /\b(digi[a-z]*|telefon[a-z]*|arvuti[a-z]*|internet[a-z]*|e-teenus[a-z]*|computer|digital)\b/i.test(text)) return "DIGITAL_HELP";
  if (category === "TUGI JA HOOLDUS" || /\b(hoold[a-z]*|abistaja[a-z]*|care|support worker|isiklik)\b/i.test(text)) return "CARE_SUPPORT";
  if (category === "LASTE JA NOORTE TUGI" || /\b(laps|laste|noor|youth|child)\b/i.test(text)) return "CHILD_YOUTH_SUPPORT";
  if (category === "ÕPPIMISE JA JUHENDAMISE ABI" || /\b(õpp|opp|juhend|mento|learning|guidance)\b/i.test(text)) return "LEARNING_GUIDANCE";
  if (category === "SELTSKOND JA SOTSIAALNE TUGI" || /\b(selts|compan|social|suhtlem|emotional)\b/i.test(text)) return "SOCIAL_SUPPORT";
  if (category === "ASJAAJAMISE JA VORMIDE ABI" || /\b(avaldus|vorm|dokum|admin|form|application)\b/i.test(text)) return "ADMIN_FORM_HELP";
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
