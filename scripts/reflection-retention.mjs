#!/usr/bin/env node

import { prisma } from "../lib/prisma.js";
import { runPracticeReflectionRetention } from "../lib/reflection/retention.js";

try {
  const result = await runPracticeReflectionRetention();
  console.log(JSON.stringify({
    ok: result.ok,
    runId: result.runId,
    scanned: result.scanned,
    purged: result.purged,
    deferred: result.deferred,
    failed: result.failed,
    errorCode: result.errorCode
  }));
  if (!result.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
