import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function existingFile(filePath) {
  const normalized = String(filePath || "").trim();
  if (!normalized) return null;
  return fs.existsSync(normalized) ? normalized : null;
}

export function resolveGoogleApplicationCredentialsPath() {
  const explicitPath = existingFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (explicitPath) return explicitPath;

  const candidates = [
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "gcloud", "application_default_credentials.json")
      : null,
    path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
      "gcloud",
      "application_default_credentials.json"
    )
  ];

  for (const candidate of candidates) {
    const resolved = existingFile(candidate);
    if (resolved) return resolved;
  }

  return null;
}
