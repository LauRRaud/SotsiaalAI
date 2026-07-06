import { prisma } from "@/lib/prisma";
import { getKovAdminEntryBySlug, serializeKovAdminWithRepositoryFallback, syncKovAdminIngestStatusById } from "@/lib/admin/rag/kov/service";
import { buildKovStoredFilePath, deleteStoredKovFile, ensureKovStorage, readStoredKovFile, writeUploadedKovFile } from "@/lib/admin/rag/kov/storage";
import { KOV_FILE_ROLE_META, resolveKovFileKeyFromParam } from "@/lib/admin/rag/kov/shared";
import { validateKovFileContent } from "@/lib/admin/rag/kov/validation";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveSlug(paramsLike) {
  const params = await paramsLike;
  return String(params?.slug || "").trim().toLowerCase();
}

export async function POST(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const slug = await resolveSlug(params);
  if (!slug) return errorJson("api.common.bad_request", 400, auth.locale);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorJson("api.common.bad_request", 400, auth.locale);
  }

  const roleParam = String(formData.get("role") || "").trim();
  const file = formData.get("file");
  const fileKey = resolveKovFileKeyFromParam(roleParam);
  if (!fileKey) return errorJson("api.common.bad_request", 400, auth.locale);

  const entry = await getKovAdminEntryBySlug(slug);
  if (!entry) return errorJson("api.common.not_found", 404, auth.locale);

  const existingFile = Array.isArray(entry.files)
    ? entry.files.find(item => item.role === KOV_FILE_ROLE_META[fileKey].dbRole)
    : null;

  let newStoragePath = "";

  try {
    await ensureKovStorage();
    newStoragePath = buildKovStoredFilePath(slug, roleParam, file?.name || "");
    const stored = await writeUploadedKovFile(file, newStoragePath, roleParam);
    const buffer = await readStoredKovFile(newStoragePath);
    const validation = validateKovFileContent({
      fileKey,
      text: buffer.toString("utf8"),
      slug: entry.municipality.slug,
      displayName: entry.municipality.displayName
    });

    if (existingFile) {
      await prisma.municipalityKovAdminFile.update({
        where: {
          kovAdminId_role: {
            kovAdminId: entry.id,
            role: existingFile.role
          }
        },
        data: {
          originalName: String(file.name || existingFile.originalName),
          mime: stored.mime,
          size: stored.size,
          sha256: stored.sha256,
          storagePath: newStoragePath,
          version: existingFile.version + 1,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        }
      });

      await deleteStoredKovFile(existingFile.storagePath);
    } else {
      await prisma.municipalityKovAdminFile.create({
        data: {
          kovAdminId: entry.id,
          role: KOV_FILE_ROLE_META[fileKey].dbRole,
          originalName: String(file.name || KOV_FILE_ROLE_META[fileKey].fileNamePattern.replace("{slug}", slug)),
          mime: stored.mime,
          size: stored.size,
          sha256: stored.sha256,
          storagePath: newStoragePath,
          version: 1,
          validationStatus: validation.validationStatus,
          validationMessage: validation.validationMessage,
          validatedAt: validation.validatedAt
        }
      });
    }

    await prisma.municipalityKovAdmin.update({
      where: { id: entry.id },
      data: {
        ...(KOV_FILE_ROLE_META[fileKey].layer === "RT"
          ? { rtCheckedAt: new Date() }
          : { checkedAt: new Date() })
      }
    });
    await syncKovAdminIngestStatusById(entry.id);
    const updated = await getKovAdminEntryBySlug(slug);

    return json(
      {
        ok: true,
        item: await serializeKovAdminWithRepositoryFallback(updated)
      },
      201
    );
  } catch (error) {
    if (newStoragePath) {
      try {
        await deleteStoredKovFile(newStoragePath);
      } catch {}
    }
    const status = Number(error?.status) || 500;
    return errorJson(status === 500 ? "api.admin.kov.file_upload_failed" : error?.message || "api.admin.kov.file_upload_failed", status, auth.locale);
  }
}
