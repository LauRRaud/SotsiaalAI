import fs from "node:fs/promises";
import path from "node:path";

import { resolveOrganizationStorageDir } from "@/lib/admin/rag/organizations/storage";
import { resolveKovStorageDir } from "@/lib/admin/rag/kov/storage";
import {
  resolveAgentStorageDir,
  resolveDocsStorageDir,
  resolveDocsUploadsDir
} from "@/lib/documents/server";
import { resolveMaterialsUploadsDir } from "@/lib/materials/server";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findExistingAncestor(targetPath) {
  let current = path.resolve(String(targetPath || "."));

  while (true) {
    if (await pathExists(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function getDirectorySizeBytes(targetPath) {
  if (!targetPath || !(await pathExists(targetPath))) return 0;

  let totalBytes = 0;
  const stack = [targetPath];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    let dir;
    try {
      dir = await fs.opendir(current);
    } catch {
      continue;
    }

    for await (const entry of dir) {
      const absolute = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }

      if (!entry.isFile()) continue;

      try {
        const stats = await fs.stat(absolute);
        totalBytes += Number(stats.size || 0);
      } catch {
        continue;
      }
    }
  }

  return totalBytes;
}

async function getVolumeStats(targetPath) {
  const existingPath = await findExistingAncestor(targetPath);
  if (!existingPath) return null;

  try {
    const stats = await fs.statfs(existingPath);
    const blockSize = Number(stats.bsize || stats.frsize || 0);
    const totalBlocks = Number(stats.blocks || 0);
    const freeBlocks = Number(stats.bavail || stats.bfree || 0);
    if (!blockSize || !totalBlocks) return null;

    const totalBytes = blockSize * totalBlocks;
    const freeBytes = blockSize * freeBlocks;
    const usedBytes = Math.max(0, totalBytes - freeBytes);

    return {
      path: existingPath,
      totalBytes,
      freeBytes,
      usedBytes,
      usedPct: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
    };
  } catch {
    return null;
  }
}

function resolveSafely(getPath, issues, code) {
  try {
    return getPath();
  } catch (error) {
    issues.push({
      code,
      message: error?.message || code
    });
    return "";
  }
}

export async function getDocumentStorageSnapshot() {
  const issues = [];

  const docsRootPath = resolveSafely(resolveDocsStorageDir, issues, "docs_root_unavailable");
  const docsUploadsPath = resolveSafely(resolveDocsUploadsDir, issues, "docs_uploads_unavailable");
  const kovPath = resolveSafely(resolveKovStorageDir, issues, "kov_storage_unavailable");
  const organizationsPath = resolveSafely(resolveOrganizationStorageDir, issues, "organization_storage_unavailable");
  const materialsPath = resolveSafely(resolveMaterialsUploadsDir, issues, "materials_storage_unavailable");
  const agentPath = resolveSafely(resolveAgentStorageDir, issues, "agent_storage_unavailable");

  const [
    docsRootBytes,
    docsUploadsBytes,
    kovBytes,
    organizationBytes,
    materialsBytes,
    agentBytes,
    volume
  ] = await Promise.all([
    getDirectorySizeBytes(docsRootPath),
    getDirectorySizeBytes(docsUploadsPath),
    getDirectorySizeBytes(kovPath),
    getDirectorySizeBytes(organizationsPath),
    getDirectorySizeBytes(materialsPath),
    getDirectorySizeBytes(agentPath),
    getVolumeStats(docsRootPath || materialsPath || agentPath)
  ]);

  const ragAdminBytes = kovBytes + organizationBytes;
  const otherDocsRootBytes = Math.max(0, docsRootBytes - docsUploadsBytes - ragAdminBytes);
  const totalBytes = docsRootBytes + materialsBytes + agentBytes;

  return {
    available: totalBytes > 0 || Boolean(volume),
    totalBytes,
    docsRootBytes,
    docsUploadsBytes,
    ragAdminBytes,
    kovBytes,
    organizationBytes,
    otherDocsRootBytes,
    materialsBytes,
    agentBytes,
    volume,
    issues
  };
}
