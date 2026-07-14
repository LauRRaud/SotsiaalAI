import { prisma } from "../lib/prisma.js";
import { createEffectivePracticeService } from "../lib/effectivePractices.js";

const service = createEffectivePracticeService(prisma);

try {
  const result = await service.repairAssignments({ userId: "system", role: "SYSTEM", isAdmin: true });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await prisma.$disconnect();
}
