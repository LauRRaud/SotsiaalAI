export function isFrameworkAcceptanceSchemaError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").trim();

  if (code === "P2021" || code === "P2022") return true;

  return /FrameworkAcceptance|frameworkAcceptanceId|frameworkAcceptance/i.test(message);
}
