#!/usr/bin/env node

import { prisma } from "../lib/prisma.js";
import { processServiceProviderProfileRagJobs } from "../lib/serviceProviderProfileRagJobs.js";
import { reconcileServiceProviderProfileRagJobs } from "../lib/serviceProviderProfiles.js";

const checkOnly = process.argv.includes("--check");
try {
  const reconciliation = await reconcileServiceProviderProfileRagJobs({ db: prisma, repair: !checkOnly });
  if (checkOnly) {
    console.log(JSON.stringify(reconciliation));
    if (reconciliation.drifted > 0) process.exitCode = 2;
  } else {
    const processed = await processServiceProviderProfileRagJobs({ db: prisma });
    console.log(JSON.stringify({ reconciliation, processed }));
  }
} finally {
  await prisma.$disconnect();
}
