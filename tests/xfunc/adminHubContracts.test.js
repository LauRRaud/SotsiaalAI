import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const registryPath = path.join(ROOT, "lib", "admin", "surfaces.js");

function adminPagePaths(directory = path.join(ROOT, "app", "admin")) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...adminPagePaths(absolute));
      continue;
    }
    if (entry.name !== "page.jsx") continue;
    const relative = path.relative(path.join(ROOT, "app"), directory).replaceAll("\\", "/");
    paths.push(`/${relative}`);
  }
  return paths.sort();
}

test("admin hub has a canonical manifest covering every implemented admin page", async () => {
  assert.equal(existsSync(registryPath), true, "canonical admin surface registry is missing");
  const { ADMIN_SURFACE_PATHS } = await import("../../lib/admin/surfaces.js");
  const implemented = adminPagePaths().filter(route => route !== "/admin");
  assert.deepEqual([...ADMIN_SURFACE_PATHS].sort(), implemented);
});
test("/admin is a server-authenticated, URL-restorable hub", () => {
  const adminPage = path.join(ROOT, "app", "admin", "page.jsx");
  assert.equal(existsSync(adminPage), true, "/admin page is missing");
  const source = readFileSync(adminPage, "utf8");
  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /if \(!session\)/);
  assert.match(source, /if \(!isAdmin\)/);
  assert.match(source, /ADMIN_SURFACES/);

  const roomStage = readFileSync(path.join(ROOT, "components", "room", "RoomStage.jsx"), "utf8");
  assert.match(roomStage, /const isAdminRoute = normalized === "\/admin" \|\| normalized\.startsWith\("\/admin\/"\)/);
  assert.match(roomStage, /dockHub === "\/admin"/);
  assert.match(roomStage, /ADMIN_SURFACES/);

  const hubReturn = readFileSync(path.join(ROOT, "lib", "roomHubReturn.js"), "utf8");
  assert.match(hubReturn, /"\/admin"/);
});
