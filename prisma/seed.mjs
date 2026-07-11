import { seedHelpCategories } from "../lib/help/categories.js";
import { seedMunicipalities } from "../lib/help/municipalities.js";
import { seedTargetGroups } from "../lib/help/targetGroups.js";
import { seedUsagePlans } from "../lib/usage/planSeeds.js";

async function main() {
  const usagePlanResult = await seedUsagePlans();
  console.info(`[prisma seed] usage plans seeded: ${usagePlanResult.planCount}`);
  console.info(`[prisma seed] plan entitlements seeded: ${usagePlanResult.entitlementCount}`);

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
