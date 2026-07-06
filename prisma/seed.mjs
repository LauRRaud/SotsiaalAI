import { seedHelpCategories } from "../lib/help/categories.js";
import { seedMunicipalities } from "../lib/help/municipalities.js";
import { seedTargetGroups } from "../lib/help/targetGroups.js";

async function main() {
  const municipalityResult = await seedMunicipalities();
  console.info(`[prisma seed] municipalities seeded: ${municipalityResult.count}`);
  console.info(`[prisma seed] municipality source: ${municipalityResult.sourcePath}`);

  const categoryResult = await seedHelpCategories();
  console.info(`[prisma seed] help categories seeded: ${categoryResult.count}`);
  console.info(`[prisma seed] category source: ${categoryResult.sourcePath}`);

  const targetGroupResult = await seedTargetGroups();
  console.info(`[prisma seed] target groups seeded: ${targetGroupResult.count}`);
  console.info(`[prisma seed] target group source: ${targetGroupResult.sourcePath}`);
}

main().catch((error) => {
  console.error("[prisma seed] failed", error);
  process.exitCode = 1;
});
