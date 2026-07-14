import { dispatchServiceAvailabilityReminders } from "../lib/serviceAvailabilityReminders.js";

const dryRun = process.argv.includes("--dry-run");
const summary = await dispatchServiceAvailabilityReminders({ dryRun });
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
