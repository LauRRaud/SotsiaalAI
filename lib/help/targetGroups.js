import prisma from "../prisma.js";

const AGE_TARGET_GROUP_CODES = Object.freeze(["CHILD", "YOUTH", "ADULT", "ELDER"]);
const SUPPORTED_TARGET_GROUP_CODES = new Set(AGE_TARGET_GROUP_CODES);

export const targetGroupSummarySelect = Object.freeze({
  id: true,
  code: true,
  labelEt: true,
  labelEn: true,
  labelRu: true,
  isActive: true
});

function normalizeCode(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .trim();
}

export function inferTargetGroupCodes(input = {}) {
  const explicitCodes = Array.isArray(input?.targetGroupCodes)
    ? input.targetGroupCodes.map((value) => normalizeCode(value)).filter((code) => SUPPORTED_TARGET_GROUP_CODES.has(code))
    : [];
  if (explicitCodes.length) return Array.from(new Set(explicitCodes));

  const parts = [
    input?.targetGroup,
    ...(Array.isArray(input?.targetGroups) ? input.targetGroups : [])
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const combined = parts.join(" ");
  const codes = new Set();

  if (
    (combined.includes("koik") ||
      combined.includes("kc\u00b5ik") ||
      combined.includes("koigile") ||
      combined.includes("kc\u00b5igile")) &&
    combined.includes("vanusegrup")
  ) {
    return [...AGE_TARGET_GROUP_CODES];
  }

  if (/\b(laps|lapsed|child|children)\b/.test(combined)) codes.add("CHILD");
  if (/\b(noor|noored|youth|young)\b/.test(combined)) codes.add("YOUTH");
  if (/\b(taiskasvanu|taisealine|adult)\b/.test(combined)) codes.add("ADULT");
  if (/\b(eakas|eakale|eakad|senior|older)\b/.test(combined)) codes.add("ELDER");

  return Array.from(codes);
}

export async function resolveTargetGroups(input = {}, prismaClient = prisma) {
  const codes = inferTargetGroupCodes(input);
  if (!codes.length) return [];

  const groups = await prismaClient.targetGroup.findMany({
    where: {
      code: {
        in: codes
      },
      isActive: true
    },
    select: targetGroupSummarySelect
  });

  return groups.sort((left, right) => left.code.localeCompare(right.code, "en"));
}
