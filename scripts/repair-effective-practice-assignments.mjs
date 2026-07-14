import { prisma } from "../lib/prisma.js";
import { createEffectivePracticeService } from "../lib/effectivePractices.js";

// Apply mode repairs broken reviewer assignments. `--check` is a read-only audit
// (dry-run): it detects the same issues without writing and exits non-zero when
// any critical assignment problem remains, so it can gate a deploy.
const checkOnly = process.argv.includes("--check");
const service = createEffectivePracticeService(prisma);

try {
  const result = await service.repairAssignments(
    { userId: "system", role: "SYSTEM", isAdmin: true },
    { dryRun: checkOnly }
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (checkOnly && Array.isArray(result.findings) && result.findings.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
