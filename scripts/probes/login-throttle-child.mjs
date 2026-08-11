#!/usr/bin/env node
/**
 * SOL-AUTH-09 sondi ABILINE — päris teine rakendusinstants.
 *
 * Kogu leid seisneb selles, et loendur elas PROTSESSI mälus: teine instants alustas nullist ja
 * restart nullis kõik. Seda ei saa ühe protsessi sees tõendada — teise protsessi mälu ongi see,
 * mis vanas koodis tühi oli. Seepärast on see fail olemas; vanem käivitab teda `spawn`-iga.
 *
 *   node scripts/probes/login-throttle-child.mjs persistent <subject> <limit> <attempts>
 *       — teeb `attempts` katset PÜSIVA loenduriga ja ütleb, mitu neist lubati.
 *
 *   node scripts/probes/login-throttle-child.mjs memory <subject> <limit> <attempts>
 *       — sama mälupõhise `consumeRateLimit`-iga: see on VANA käitumine ja peab siin
 *         lubama kõik, sest tema bucket'id sünnivad koos protsessiga.
 */

const [, , command, subject, rawLimit, rawAttempts] = process.argv;
const limit = Number(rawLimit);
const attempts = Number(rawAttempts);

function say(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

if (command === "persistent") {
  const { prisma } = await import("../../lib/prisma.js");
  const { consumeLoginThrottle, PIN_THROTTLE_EMAIL_SCOPE } = await import(
    "../../lib/auth/loginThrottle.js"
  );

  let allowed = 0;
  for (let index = 0; index < attempts; index += 1) {
    const result = await consumeLoginThrottle({
      db: prisma,
      scope: PIN_THROTTLE_EMAIL_SCOPE,
      subject,
      limit,
      windowMs: 15 * 60 * 1000,
      lockMs: 15 * 60 * 1000
    });
    if (result.allowed) allowed += 1;
  }

  say({ mode: "persistent", allowed, pid: process.pid });
  await prisma.$disconnect();
} else if (command === "memory") {
  const { consumeRateLimit } = await import("../../lib/rate-limit.js");

  let allowed = 0;
  for (let index = 0; index < attempts; index += 1) {
    if (consumeRateLimit(`login-step1:email:${subject}`, limit, 15 * 60 * 1000).allowed) {
      allowed += 1;
    }
  }

  say({ mode: "memory", allowed, pid: process.pid });
} else {
  say({ error: `unknown command ${command}` });
  process.exit(1);
}
