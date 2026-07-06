export function getResearchDailyLimit(role = "CLIENT") {
  return String(role || "").trim().toUpperCase() === "SOCIAL_WORKER" ? 5 : 3
}
