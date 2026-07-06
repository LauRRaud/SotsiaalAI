import { geocodeServiceMapEntries, isMissingServiceMapEntryTableError } from "../lib/serviceMap/geocoding.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

function valueAfterFlag(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseStatuses() {
  if (hasFlag("--retry-failed")) return ["PENDING", "FAILED", "AMBIGUOUS"];
  const raw = valueAfterFlag("--statuses", "PENDING");
  return raw
    .split(/[,;]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function printResult(result, dryRun) {
  console.info(`[service-map-geocode] entries scanned: ${result.scanned}`);
  console.info(`[service-map-geocode] entries ${dryRun ? "planned" : "updated"}: ${dryRun ? result.planned : result.updated}`);
  console.info(
    `[service-map-geocode] matched=${result.matched} ambiguous=${result.ambiguous} failed=${result.failed} pending=${result.pending}`
  );

  for (const entry of result.entries.slice(0, 20)) {
    const location =
      entry.latitude !== null && entry.longitude !== null
        ? `${entry.latitude}, ${entry.longitude}`
        : entry.nextGeocodingStatus;
    console.info(`- ${entry.nextStatus}/${entry.nextGeocodingStatus}: ${entry.title} (${location})`);
  }

  if (result.entries.length > 20) {
    console.info(`[service-map-geocode] ... ${result.entries.length - 20} more`);
  }
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const provider = valueAfterFlag("--provider", "");
  const limit = Number(valueAfterFlag("--limit", "100")) || 100;
  const statuses = parseStatuses();
  const configuredProvider = String(provider || process.env.SERVICE_MAP_GEOCODER_PROVIDER || process.env.GEOCODER_PROVIDER || "none")
    .trim()
    .toLowerCase();

  if (!dryRun && (!configuredProvider || ["none", "disabled", "off"].includes(configuredProvider))) {
    throw new Error("SERVICE_MAP_GEOCODER_PROVIDER peab olema seadistatud enne geokodeerimise rakendamist.");
  }

  try {
    const result = await geocodeServiceMapEntries({
      dryRun,
      provider,
      limit,
      statuses
    });
    printResult(result, dryRun);
  } catch (error) {
    if (dryRun && isMissingServiceMapEntryTableError(error)) {
      console.warn("[service-map-geocode] ServiceMapEntry tabelit ei leitud.");
      console.warn("[service-map-geocode] Rakenda serveris migratsioonid enne geokodeerimise skripti käivitamist.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("[service-map-geocode] failed", error);
  process.exitCode = 1;
});
