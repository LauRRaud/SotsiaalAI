#!/usr/bin/env node

import prisma from "../lib/prisma.js"
import { processNextMaterialNotification } from "../lib/materials/notifications.js"

const limit = Math.max(1, Math.min(Number(process.env.MATERIAL_NOTIFICATION_BATCH_SIZE) || 25, 200))
const counters = { sent: 0, retry: 0, failed: 0, lost_race: 0 }

try {
  for (let index = 0; index < limit; index += 1) {
    const result = await processNextMaterialNotification()
    if (!result) break
    if (result.status in counters) counters[result.status] += 1
  }
  console.log(`MATERIAL_NOTIFICATION_WORKER ${JSON.stringify(counters)}`)
} finally {
  await prisma.$disconnect()
}
