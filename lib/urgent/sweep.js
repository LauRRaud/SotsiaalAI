// SK-V1 E5 — aegumise korje.
//
// „Ükski SK-kirje ei saa jääda vastuseta lõpmatuseks" (E5 DoD). See ei ole
// koristustöö, vaid LUBADUS: inimene, kes kirjutas kell 23.47, peab teada
// saama, kui keegi ei jõudnud vastata. Vaikus on halvim võimalik tulemus ja
// aegumine on selle vastu ainus automaatne kaitse.
//
// Korje elab olemasolevas teavitustöös (`/api/jobs/notifications`), mis käib
// toodangus iga 5 minuti tagant. Uut taimerit, uut teenust ega uut võtit siin
// ei looda — üks lisatoiming olemasolevas ahelas.
//
// Aegumine puutub AINULT neid kirjeid, mille kohta laud veel vastust võlgneb
// (`SENT`, `READ`). Võetud pöördumine ei aegu: seal töö käib.

import { prisma as defaultPrisma } from "@/lib/prisma";
import { expireOverdueUrgentRequests } from "@/lib/urgent/request";

export async function runUrgentExpirySweep({
  db = defaultPrisma,
  now = new Date(),
  dryRun = false,
  batchSize = 50
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || 50, 200));

  if (dryRun) {
    // Kuivkäigul loeme, aga ei liiguta. Sama muster mis ülejäänud korjetel:
    // number peab olema kontrollitav ilma andmeid puutumata.
    const due = await db.urgentRequest.count({
      where: { status: { in: ["SENT", "READ"] }, expiresAt: { lte: now } }
    });
    return { expired: 0, due, dryRun: true };
  }

  const result = await expireOverdueUrgentRequests({
    prisma: db,
    now: () => now,
    limit: take
  });
  return { expired: result.count, due: result.count, dryRun: false };
}
