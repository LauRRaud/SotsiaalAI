import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveExistingFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs")
  ];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || "";
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const resolved = resolveExistingFile(path.join(repoRoot, specifier.slice(2)));
    if (resolved) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolved).href
      };
    }
  }

  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) throw error;

    const parentPath = context.parentURL?.startsWith("file:")
      ? path.dirname(fileURLToPath(context.parentURL))
      : repoRoot;
    const basePath = specifier.startsWith("/")
      ? specifier
      : path.resolve(parentPath, specifier);
    const resolved = resolveExistingFile(basePath);
    if (!resolved) throw error;

    return {
      shortCircuit: true,
      url: pathToFileURL(resolved).href
    };
  }
}
