/** Teenuspäeviku andmekoopia, konto-kustutuse tombstone'id ja retention-sweep. */

const iso = (value) => value?.toISOString?.() || value || null;
const jsonLines = (rows) => Buffer.from(rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
const THIRD_PARTY_EXCLUDED = [
  "clientUserId",
  "clientDisplayName",
  "clientExternalRef",
  "address",
  "addressLat",
  "addressLng",
  "locationStamps",
  "storagePath",
  "stagingStoragePath",
  "recipientMembershipId"
];

function without(row, keys = THIRD_PARTY_EXCLUDED) {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function projectDates(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? iso(value) : value])
  );
}

function professionalRecord(type, row, extra = {}) {
  return {
    type,
    thirdPartyIdentity: "excluded",
    ...extra,
    data: projectDates(without(row))
  };
}

function clientRecord(row) {
  const { id, date, unit, quantity, confirmedByClientAt } = row;
  return {
    type: "entry",
    data: projectDates({ id, date, unit, quantity, confirmedByClientAt })
  };
}

export async function collectServiceLogDataExport({ db, userId }) {
  if (!db.serviceProviderProfile?.findMany || !db.serviceEntry?.findMany) {
    return [
      { name: "service-log-professional.ndjson", content: Buffer.from(""), count: 0 },
      { name: "service-log-client.ndjson", content: Buffer.from(""), count: 0 }
    ];
  }
  const profiles = await db.serviceProviderProfile.findMany({
    where: { ownerId: userId },
    select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  const professional = [];
  const shares = await db.serviceReportShare.findMany({
    where: {
      OR: [
        { ownerUserId: userId },
        { recipient: { is: { userId } } }
      ]
    },
    orderBy: { sentAt: "asc" }
  });

  if (profileIds.length) {
    const [referrals, entries, narratives, routes, visits, samples] = await Promise.all([
      db.serviceReferral.findMany({ where: { providerProfileId: { in: profileIds } }, orderBy: { createdAt: "asc" } }),
      db.serviceEntry.findMany({
        where: { providerProfileId: { in: profileIds } },
        orderBy: { createdAt: "asc" },
        include: { corrections: { orderBy: { createdAt: "asc" } } }
      }),
      db.serviceMonthlyNarrative.findMany({ where: { providerProfileId: { in: profileIds } }, orderBy: { createdAt: "asc" } }),
      db.serviceWorkRoute.findMany({ where: { providerProfileId: { in: profileIds } }, orderBy: { createdAt: "asc" } }),
      db.serviceVisit.findMany({ where: { providerProfileId: { in: profileIds } }, orderBy: { createdAt: "asc" } }),
      db.serviceLogTimeSample.findMany({ where: { ownerUserId: userId }, orderBy: { recordedAt: "asc" } })
    ]);

    professional.push(...referrals.map((row) => professionalRecord("referral", row)));
    professional.push(
      ...entries.map(({ corrections = [], ...row }) =>
        professionalRecord("entry", row, {
          corrections: corrections.map((correction) => projectDates(without(correction, ["actorUserId"])))
        })
      )
    );
    professional.push(...narratives.map((row) => professionalRecord("narrative", row)));
    professional.push(...routes.map((row) => professionalRecord("route", row, { worker: "self_or_erased" })));
    professional.push(...visits.map((row) => professionalRecord("visit", row, { preciseLocation: "excluded" })));
    professional.push(...samples.map((row) => professionalRecord("time_sample", row)));
  }
  professional.push(
    ...shares.map((row) => professionalRecord("report_share", row, {
      view: row.ownerUserId === userId ? "sender" : "recipient",
      fileContent: "excluded; metadata_only"
    }))
  );

  const clientEntries = await db.serviceEntry.findMany({
    where: { clientUserId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, date: true, unit: true, quantity: true, confirmedByClientAt: true }
  });
  const client = clientEntries.map(clientRecord);

  return [
    {
      name: "service-log-professional.ndjson",
      content: jsonLines(professional),
      count: professional.length,
      metadata: { thirdPartyExcludedFields: THIRD_PARTY_EXCLUDED }
    },
    {
      name: "service-log-client.ndjson",
      content: jsonLines(client),
      count: client.length,
      metadata: { scope: "records_where_requester_is_client" }
    }
  ];
}

export async function eraseServiceLogUserReferencesWithinTransaction(userId, { db, now = new Date() } = {}) {
  if (!userId) return { erased: 0 };
  const run = async (tx) => {
    const results = await Promise.all([
      tx.serviceReferral.updateMany({
        where: { clientUserId: userId },
        data: { clientUserId: null, clientDisplayName: null, clientExternalRef: null, clientErasedAt: now }
      }),
      tx.serviceEntry.updateMany({
        where: { clientUserId: userId },
        data: { clientUserId: null, clientDisplayName: null, clientExternalRef: null, clientErasedAt: now }
      }),
      tx.serviceEntry.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null, ownerErasedAt: now }
      }),
      tx.serviceEntryCorrection.updateMany({
        where: { actorUserId: userId },
        data: { actorUserId: null, actorErasedAt: now }
      }),
      tx.serviceMonthlyNarrative.updateMany({
        where: { clientUserId: userId },
        data: { clientUserId: null, clientDisplayName: null, clientExternalRef: null, clientErasedAt: now }
      }),
      tx.serviceWorkRoute.updateMany({
        where: { workerUserId: userId },
        data: { workerUserId: null, workerErasedAt: now }
      }),
      tx.serviceVisit.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null, ownerErasedAt: now }
      }),
      tx.serviceVisit.updateMany({
        where: { clientUserId: userId },
        data: { clientUserId: null, clientDisplayName: null, clientExternalRef: null, clientErasedAt: now }
      }),
      tx.serviceLogTimeSample.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } }),
      tx.serviceReportShare.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null, ownerErasedAt: now }
      }),
      tx.serviceReportShare.updateMany({
        where: { recipient: { is: { userId } } },
        data: { recipientMembershipId: null, recipientErasedAt: now }
      })
    ]);
    const counts = {
      referralsAsClient: results[0].count,
      entriesAsClient: results[1].count,
      entriesAsOwner: results[2].count,
      correctionsAsActor: results[3].count,
      narrativesAsClient: results[4].count,
      routesAsWorker: results[5].count,
      visitsAsOwner: results[6].count,
      visitsAsClient: results[7].count,
      timeSamples: results[8].count,
      reportSharesAsOwner: results[9].count,
      reportSharesAsRecipient: results[10].count
    };
    return { erased: Object.values(counts).reduce((sum, count) => sum + count, 0), counts };
  };
  return run(db);
}

export async function eraseServiceLogUserReferences(userId, { db, now = new Date() } = {}) {
  if (typeof db?.$transaction !== "function") throw new TypeError("database transaction is required");
  return db.$transaction((tx) => eraseServiceLogUserReferencesWithinTransaction(userId, { db: tx, now }));
}

export async function purgeExpiredServiceLogData({ db, now = new Date(), batchSize = 200 } = {}) {
  const cutoffFiscalYear = now.getUTCFullYear() - 8;
  const draftCutoff = new Date(Date.UTC(now.getUTCFullYear() - 7, 0, 1));
  const ids = async (model, where) =>
    (await model.findMany({ where, orderBy: { id: "asc" }, take: batchSize, select: { id: true } })).map((row) => row.id);

  const entryIds = await ids(db.serviceEntry, {
    OR: [
      { recordedFiscalYear: { lte: cutoffFiscalYear } },
      { recordedFiscalYear: null, createdAt: { lt: draftCutoff } }
    ]
  });
  const entryResult = entryIds.length
    ? await db.serviceEntry.deleteMany({ where: { id: { in: entryIds } } })
    : { count: 0 };

  const narrativeIds = await ids(db.serviceMonthlyNarrative, { retentionEndsAt: { lt: now } });
  const narrativeResult = narrativeIds.length
    ? await db.serviceMonthlyNarrative.deleteMany({ where: { id: { in: narrativeIds }, retentionEndsAt: { lt: now } } })
    : { count: 0 };

  const visitIds = await ids(db.serviceVisit, { retentionEndsAt: { lt: now }, serviceEntryId: null });
  const visitResult = visitIds.length
    ? await db.serviceVisit.deleteMany({ where: { id: { in: visitIds }, retentionEndsAt: { lt: now }, serviceEntryId: null } })
    : { count: 0 };

  const routeIds = await ids(db.serviceWorkRoute, { retentionEndsAt: { lt: now }, visits: { none: {} } });
  const routeResult = routeIds.length
    ? await db.serviceWorkRoute.deleteMany({ where: { id: { in: routeIds }, retentionEndsAt: { lt: now }, visits: { none: {} } } })
    : { count: 0 };

  const referralIds = await ids(db.serviceReferral, {
    retentionEndsAt: { lt: now },
    entries: { none: {} },
    narratives: { none: {} },
    visits: { none: {} }
  });
  const referralResult = referralIds.length
    ? await db.serviceReferral.deleteMany({
        where: {
          id: { in: referralIds },
          retentionEndsAt: { lt: now },
          entries: { none: {} },
          narratives: { none: {} },
          visits: { none: {} }
        }
      })
    : { count: 0 };

  const sampleResult = await db.serviceLogTimeSample.deleteMany({
    where: { recordedAt: { lt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) } }
  });
  return {
    entries: entryResult.count,
    narratives: narrativeResult.count,
    visits: visitResult.count,
    routes: routeResult.count,
    referrals: referralResult.count,
    timeSamples: sampleResult.count
  };
}
