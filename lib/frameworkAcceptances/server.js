import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { serverT } from "@/lib/i18n/serverMessages";
import { logDocumentsAudit } from "@/lib/documents/audit";
import { ensureDocumentsStorage, resolveDocsUploadsDir, sanitizeTextFilename } from "@/lib/documents/server";
import {
  WORKER_FRAMEWORK_ACCEPTANCE_TYPE,
  WORKER_FRAMEWORK_ACCOUNT_ACCEPTANCE_SOURCE,
  WORKER_FRAMEWORK_KEY,
  WORKER_FRAMEWORK_VERSION
} from "@/lib/frameworkAcceptances";

function formatRoleLabel(locale, role) {
  if (String(role || "").toUpperCase() === "SOCIAL_WORKER") {
    return serverT(locale, "role.worker", undefined, "Social Work Specialist");
  }
  if (String(role || "").toUpperCase() === "SERVICE_PROVIDER") {
    return serverT(locale, "role.provider", undefined, "Service provider");
  }
  if (String(role || "").toUpperCase() === "CLIENT") {
    return serverT(locale, "role.client", undefined, "Person seeking help");
  }
  return String(role || "").toUpperCase();
}

function buildAcceptanceDocumentPayload({ acceptance, user, locale }) {
  return {
    recordType: "FRAMEWORK_ACCEPTANCE",
    title: serverT(
      locale,
      "documents.framework_acceptance.title",
      undefined,
      "Professional-use acceptance record"
    ),
    user: {
      id: user.id,
      email: user.email || "",
      role: acceptance.roleAtAcceptance,
      roleLabel: formatRoleLabel(locale, acceptance.roleAtAcceptance)
    },
    framework: {
      key: acceptance.frameworkKey,
      version: acceptance.frameworkVersion
    },
    acceptance: {
      type: acceptance.acceptanceType,
      source: acceptance.acceptanceSource,
      locale: acceptance.locale || locale,
      acceptedAt: acceptance.acceptedAt,
      reviewDocumentOpenedAt: acceptance.reviewDocumentOpenedAt,
      signedDocumentDownloadedAt: acceptance.signedDocumentDownloadedAt
    },
    audit: {
      ipAddress: acceptance.ipAddress || null,
      userAgent: acceptance.userAgent || null
    }
  };
}

export async function createFrameworkAcceptanceDocument({ acceptance, user, locale = "en" }) {
  if (!acceptance?.id || !user?.id) return null;

  const payload = buildAcceptanceDocumentPayload({ acceptance, user, locale });
  const buffer = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const timestamp = new Date(acceptance.acceptedAt || Date.now()).toISOString().replace(/[:.]/g, "-");
  const title = serverT(
    locale,
    "documents.framework_acceptance.title",
    undefined,
    "Professional-use acceptance record"
  );
  const fileBaseName = sanitizeTextFilename(`${title}_${timestamp}`, "framework_acceptance_record");
  const originalName = `${fileBaseName}.txt`;

  await ensureDocumentsStorage();
  const relativePath = path.join("uploads", `${crypto.randomUUID()}-${originalName}`);
  const absolutePath = path.join(resolveDocsUploadsDir(), path.basename(relativePath));
  await fs.writeFile(absolutePath, buffer);

  try {
    const document = await prisma.userDocument.create({
      data: {
        ownerId: user.id,
        title,
        originalName,
        kind: "OTHER",
        agentAllowed: false,
        mime: "text/plain",
        size: buffer.length,
        sha256,
        storagePath: relativePath,
        frameworkAcceptanceId: acceptance.id
      }
    });

    await logDocumentsAudit("document.uploaded", {
      userId: user.id,
      documentId: document.id,
      title: document.title,
      originalName: document.originalName,
      kind: document.kind,
      source: "framework_acceptance",
      frameworkAcceptanceId: acceptance.id,
      frameworkVersion: acceptance.frameworkVersion
    });

    return document;
  } catch (error) {
    try {
      await fs.unlink(absolutePath);
    } catch {}
    throw error;
  }
}

export function serializeFrameworkAcceptanceStatus(acceptance) {
  const documentId = acceptance?.document?.id || null;

  return {
    accepted: Boolean(acceptance),
    frameworkKey: acceptance?.frameworkKey || WORKER_FRAMEWORK_KEY,
    frameworkVersion: acceptance?.frameworkVersion || WORKER_FRAMEWORK_VERSION,
    acceptedAt: acceptance?.acceptedAt || null,
    signedDocumentDownloadedAt: acceptance?.signedDocumentDownloadedAt || null,
    documentId,
    documentDownloadUrl: documentId ? `/api/documents/${encodeURIComponent(documentId)}/download` : ""
  };
}

async function findCurrentWorkerFrameworkAcceptance(userId) {
  if (!userId) return null;

  return prisma.frameworkAcceptance.findFirst({
    where: {
      userId,
      frameworkKey: WORKER_FRAMEWORK_KEY,
      frameworkVersion: WORKER_FRAMEWORK_VERSION,
      acceptanceType: WORKER_FRAMEWORK_ACCEPTANCE_TYPE
    },
    include: {
      document: {
        select: {
          id: true
        }
      }
    },
    orderBy: {
      acceptedAt: "desc"
    }
  });
}

async function ensureFrameworkAcceptanceDocumentRecord({ acceptance, user, locale = "en" }) {
  if (!acceptance?.id || !user?.id) return null;

  if (acceptance?.document?.id) {
    return acceptance.document;
  }

  const existingDocument = await prisma.userDocument.findUnique({
    where: {
      frameworkAcceptanceId: acceptance.id
    },
    select: {
      id: true
    }
  });

  if (existingDocument?.id) {
    return existingDocument;
  }

  return createFrameworkAcceptanceDocument({ acceptance, user, locale });
}

export async function getCurrentWorkerFrameworkAcceptanceStatus(userId) {
  const acceptance = await findCurrentWorkerFrameworkAcceptance(userId);
  return serializeFrameworkAcceptanceStatus(acceptance);
}

export async function createOrGetCurrentWorkerFrameworkAcceptance({
  user,
  locale = "en",
  ipAddress = null,
  userAgent = null,
  reviewDocumentOpenedAt = null,
  signedDocumentDownloadedAt = null,
  acceptanceSource = WORKER_FRAMEWORK_ACCOUNT_ACCEPTANCE_SOURCE
}) {
  if (!user?.id) {
    throw new Error("framework_acceptance.user_required");
  }

  const existingAcceptance = await findCurrentWorkerFrameworkAcceptance(user.id);
  if (existingAcceptance) {
    const document = await ensureFrameworkAcceptanceDocumentRecord({
      acceptance: existingAcceptance,
      user,
      locale
    });

    return {
      created: false,
      acceptance: {
        ...existingAcceptance,
        document: document?.id ? { id: document.id } : existingAcceptance.document || null
      }
    };
  }

  const acceptance = await prisma.frameworkAcceptance.create({
    data: {
      userId: user.id,
      frameworkKey: WORKER_FRAMEWORK_KEY,
      frameworkVersion: WORKER_FRAMEWORK_VERSION,
      acceptanceType: WORKER_FRAMEWORK_ACCEPTANCE_TYPE,
      acceptanceSource,
      roleAtAcceptance: user.role,
      locale,
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
      reviewDocumentOpenedAt,
      signedDocumentDownloadedAt
    }
  });

  const document = await ensureFrameworkAcceptanceDocumentRecord({
    acceptance,
    user,
    locale
  });

  return {
    created: true,
    acceptance: {
      ...acceptance,
      document: document?.id ? { id: document.id } : null
    }
  };
}
