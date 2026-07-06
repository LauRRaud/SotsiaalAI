export async function reserveAnalyzeQuota(tx, { userId, day, limit }) {
  await tx.analyzeUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 0 },
    update: {}
  });

  const updated = await tx.analyzeUsage.updateMany({
    where: {
      userId,
      day,
      count: { lt: limit }
    },
    data: {
      count: { increment: 1 }
    }
  });

  if (updated.count === 0) {
    const error = new Error("api.chat.analyze.quota_exceeded");
    error.code = "QUOTA";
    throw error;
  }

  return true;
}

export async function refundAnalyzeQuota(client, { userId, day }) {
  return client.analyzeUsage.updateMany({
    where: {
      userId,
      day,
      count: { gt: 0 }
    },
    data: {
      count: { decrement: 1 }
    }
  });
}
