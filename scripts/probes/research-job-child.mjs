#!/usr/bin/env node
/**
 * SOL-RES-03 sondi ABILINE — päris teine protsess.
 *
 * Leid on protsessideülene: töö loonud protsess ei näinud teise protsessi tehtud lõppu. Sellist
 * asja EI SAA tõendada ühe protsessi sees, sest kogu viga seisnebki selles, et kaks protsessi
 * hoiavad oma mälus eri tõde. Seepärast on see fail olemas: `research-worker-visibility-probe.mjs`
 * käivitab teda `spawn`-iga ja suhtleb temaga JSON-ridade kaudu.
 *
 *   node scripts/probes/research-job-child.mjs finish <jobId>
 *       — märgib töö andmebaasis lõppenuks (jäljendab workerit).
 *
 *   node scripts/probes/research-job-child.mjs inline-hold <userId>
 *       — loob INLINE-režiimis töö (seega jääb tal runtime-objekt), ootab, ja ütleb siis, mida
 *         TEMA arvab töö seisuks. Just see on vana käitumine: oma mälu varjutab andmebaasi.
 *
 *   node scripts/probes/research-job-child.mjs worker-hold <workerId>
 *       — claim'ib töö selle workeri nimel, KÜLMUB (ei saada heartbeat'i), ja üritab siis lõpetada.
 *         Ütleb, kas tema kirjutus võeti vastu ja kas ta sai teada, et lease on kadunud.
 */

const [, , command, argument] = process.argv;

function say(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (command === "finish") {
  const { prisma } = await import("../../lib/prisma.js");
  await prisma.researchJob.update({
    where: { id: String(argument) },
    data: { status: "done", endedAt: new Date(), result: { report: "teise protsessi tulemus" } }
  });
  say({ finished: true, pid: process.pid });
  await prisma.$disconnect();
} else if (command === "inline-hold") {
  process.env.RESEARCH_JOB_MODE = "inline";
  const { createResearchJob, getResearchJobSnapshot } = await import("../../lib/research/jobStore.js");
  const job = await createResearchJob({
    userId: String(argument),
    payload: { query: "sondi päring", profile: "standard" }
  });
  say({ id: job.id, pid: process.pid });
  // Vanemprotsess jõuab selle ajaga töö andmebaasis lõpetada.
  await sleep(2500);
  const snapshot = await getResearchJobSnapshot(job.id);
  say({ seenStatus: snapshot?.status || null });
  process.exit(0);
} else if (command === "worker-hold") {
  process.env.RESEARCH_JOB_MODE = "worker";
  const { prisma } = await import("../../lib/prisma.js");
  const { claimNextResearchJob, hasLostResearchLease, markResearchDone, publishResearchProgress } =
    await import("../../lib/research/jobStore.js");

  const job = await claimNextResearchJob({ workerId: String(argument) });
  if (!job) {
    say({ claimed: false });
    process.exit(0);
  }
  say({ id: job.id, workerId: job.workerId, pid: process.pid });

  // KÜLMUMINE: heartbeat'i ei saadeta, seega lease aegub ja teine worker võtab töö üle.
  await sleep(3000);

  // Vana kood kirjutas siin rahulikult edasi. Nüüd peab kirjutus keelduma.
  await publishResearchProgress(job, { stage: "synthesizing" });
  await markResearchDone(job, { report: "VANA WORKERI TULEMUS" });

  const record = await prisma.researchJob.findUnique({ where: { id: job.id } });
  say({
    leaseLost: hasLostResearchLease(job),
    dbResult: record?.result?.report || null,
    dbWorkerId: record?.workerId || null
  });
  await prisma.$disconnect();
  process.exit(0);
} else {
  say({ error: `unknown command: ${String(command)}` });
  process.exit(2);
}
