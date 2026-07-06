import { seedMunicipalities } from "../lib/help/municipalities.js";

async function main() {
  const result = await seedMunicipalities();
  console.info(`[seed-municipalities] municipalities seeded: ${result.count}`);
  console.info(`[seed-municipalities] source: ${result.sourcePath}`);
}

main().catch((error) => {
  console.error("[seed-municipalities] failed", error);
  process.exitCode = 1;
});
