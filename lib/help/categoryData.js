import { readFile } from "node:fs/promises";
import path from "node:path";

export const HELP_CATEGORY_DATA_PATH = path.join(process.cwd(), "src", "server", "data", "help-categories.json");

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCode(value = "") {
  return normalizeText(value).toUpperCase();
}

export async function loadHelpCategorySeedEntries() {
  const rawText = await readFile(HELP_CATEGORY_DATA_PATH, "utf8");
  const rawData = JSON.parse(rawText);
  if (!Array.isArray(rawData)) {
    throw new Error("HELP_CATEGORY_SOURCE_INVALID");
  }

  return rawData
    .map((item) => ({
      code: normalizeCode(item?.code),
      labelEt: normalizeText(item?.labelEt),
      labelEn: normalizeText(item?.labelEn),
      labelRu: normalizeText(item?.labelRu),
      descriptionEt: normalizeText(item?.descriptionEt) || null,
      descriptionEn: normalizeText(item?.descriptionEn) || null,
      descriptionRu: normalizeText(item?.descriptionRu) || null,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 0,
      isActive: item?.isActive !== false,
      parentCode: normalizeCode(item?.parentCode) || null
    }))
    .filter((item) => item.code && item.labelEt && item.labelEn && item.labelRu)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.labelEt.localeCompare(right.labelEt, "et"));
}
