import prisma from "../lib/prisma.js";
import { consumeServiceProviderProfileRateLimit } from "../lib/serviceProviderProfileBoundary.js";

const [userId, operation, rawCount] = process.argv.slice(2);
const count = Math.max(1, Number(rawCount) || 1);

try {
  const results = await Promise.all(Array.from({ length: count }, () =>
    consumeServiceProviderProfileRateLimit({ operation, userId })
  ));
  console.log(`SPROF_RATE_RESULT ${JSON.stringify({
    allowed: results.filter((result) => result.allowed).length,
    denied: results.filter((result) => !result.allowed).length
  })}`);
} finally {
  await prisma.$disconnect();
}
