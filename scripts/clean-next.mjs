import fs from "node:fs";

const pathsToRemove = [".next", ".turbo"];

for (const path of pathsToRemove) {
  try {
    fs.rmSync(path, { recursive: true, force: true });
    process.stdout.write(`Removed ${path}\n`);
  } catch (error) {
    process.stderr.write(
      `Failed to remove ${path}: ${error?.message ?? String(error)}\n`,
    );
  }
}
