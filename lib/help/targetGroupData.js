import { readFile } from "node:fs/promises";
import path from "node:path";

export const TARGET_GROUP_DATA_PATH = path.join(process.cwd(), "src", "server", "data", "target-groups.json");

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCode(value = "") {
  return normalizeText(value).toUpperCase();
}

export async function loadTargetGroupSeedEntries() {
  const rawText = await readFile(TARGET_GROUP_DATA_PATH, "utf8");
  const rawData = JSON.parse(rawText);
  if (!Array.isArray(rawData)) {
    throw new Error("TARGET_GROUP_SOURCE_INVALID");
  }

  return rawData
    .map((item) => ({
      code: normalizeCode(item?.code),
      labelEt: normalizeText(item?.labelEt),
      labelEn: normalizeText(item?.labelEn),
      labelRu: normalizeText(item?.labelRu),
      isActive: item?.isActive !== false
    }))
    .filter((item) => item.code && item.labelEt && item.labelEn && item.labelRu);
}
