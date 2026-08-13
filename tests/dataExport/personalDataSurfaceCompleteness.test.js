import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { DATA_EXPORT_REGISTRY } from "../../lib/dataExport/registry.js";
import { dataExportInternals } from "../../lib/dataExport/service.js";
import {
  assertPersonalDataSurfaceRegistryComplete,
  classifiedExportSurfaceNames,
  discoverPersonalDataCopyFields,
  discoverPrismaUserRelations,
  PERSONAL_DATA_COPY_CLASSIFICATIONS,
  PRISMA_USER_RELATION_CLASSIFICATIONS
} from "../../lib/dataExport/personalDataSurfaceRegistry.js";

const schema = fs.readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const exportSurfaceNames = DATA_EXPORT_REGISTRY.map(surface => surface.name);

test("XFUNC-03: every current Prisma User relation and copy marker is classified", () => {
  assert.equal(discoverPrismaUserRelations(schema).length, 157);
  assert.equal(PRISMA_USER_RELATION_CLASSIFICATIONS.length, 157);
  assert.equal(discoverPersonalDataCopyFields(schema).length, 41);
  assert.equal(PERSONAL_DATA_COPY_CLASSIFICATIONS.length, 43);
  assert.doesNotThrow(() => assertPersonalDataSurfaceRegistryComplete({ schemaText: schema, exportSurfaceNames }));
});

test("XFUNC-03: a new or renamed User relation fails closed until it is classified", () => {
  const mutatedSchema = schema.replace(
    "  accounts Account[]",
    "  accounts Account[]\n  xfuncProbeNewRelation Profile?"
  );
  assert.throws(
    () => assertPersonalDataSurfaceRegistryComplete({ schemaText: mutatedSchema, exportSurfaceNames }),
    /missingRelations=xfuncProbeNewRelation/u
  );

  const renamedSchema = schema.replace("  accounts Account[]", "  renamedAccounts Account[]");
  assert.throws(
    () => assertPersonalDataSurfaceRegistryComplete({ schemaText: renamedSchema, exportSurfaceNames }),
    /missingRelations=renamedAccounts[\s\S]*staleRelations=accounts/u
  );
});

test("XFUNC-03: a new or renamed file/RAG/external-copy marker fails closed", () => {
  const addedCopy = schema.replace(
    "model Profile {",
    "model Profile {\n  storagePath String?"
  );
  assert.throws(
    () => assertPersonalDataSurfaceRegistryComplete({ schemaText: addedCopy, exportSurfaceNames }),
    /missingCopyFields=Profile\.storagePath/u
  );

  const renamedCopy = schema.replace("  storagePath   String?", "  renamedStoragePath   String?");
  assert.throws(
    () => assertPersonalDataSurfaceRegistryComplete({ schemaText: renamedCopy, exportSurfaceNames }),
    /staleCopyFields=DataDeletionJob\.storagePath/u
  );
});

function syntheticDb() {
  const emptyDelegate = Object.freeze({
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0
  });
  const user = {
    email: "xfunc-owner@example.test",
    emailVerified: new Date("2026-08-13T10:00:00.000Z"),
    role: "CLIENT",
    acceptsPreInquiries: false,
    createdAt: new Date("2026-08-13T09:00:00.000Z"),
    updatedAt: new Date("2026-08-13T10:00:00.000Z"),
    profile: null,
    frameworkAcceptances: []
  };
  return new Proxy({
    user: { ...emptyDelegate, findUnique: async () => user },
    serviceProviderProfile: { ...emptyDelegate }
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return emptyDelegate;
    }
  });
}

test("XFUNC-03: synthetic owner's ZIP manifest equals the classified export surfaces", async () => {
  const { entries, manifest } = await dataExportInternals.collectExportEntries(
    { id: "xfunc-export", userId: "xfunc-owner" },
    { db: syntheticDb(), now: new Date("2026-08-13T11:00:00.000Z") }
  );
  const classified = classifiedExportSurfaceNames();
  const manifested = manifest.surfaces.map(surface => surface.name).sort();
  assert.deepEqual(manifested, classified);
  assert.equal(manifest.surfaces.every(surface => surface.thirdPartyExcluded === true), true);
  assert.equal(manifest.surfaces.find(surface => surface.name === "profile_and_consents")?.recordCount, 1);
  const embeddedManifest = JSON.parse(entries.find(entry => entry.name === "manifest.json").content.toString("utf8"));
  assert.deepEqual(embeddedManifest.surfaces.map(surface => surface.name).sort(), classified);
});
