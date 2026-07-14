import { dispatchServiceAvailabilityReminders } from "../lib/serviceAvailabilityReminders.js";
import { prisma } from "../lib/prisma.js";

const dryRun = process.argv.includes("--dry-run");
try {
  const summary = await dispatchServiceAvailabilityReminders({ dryRun });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
