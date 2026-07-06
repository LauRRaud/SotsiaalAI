#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const skipDeploy = args.includes("--skip-deploy");
const skipBuild = args.includes("--skip-build");
const allowSecrets = args.includes("--allow-secrets");

const messageArgIndex = args.findIndex(arg => arg === "-m" || arg === "--message");
const message = messageArgIndex >= 0 && args[messageArgIndex + 1]
  ? args[messageArgIndex + 1]
  : `AI update ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

const secretPathPatterns = [
  /(^|[/\\])\.env($|[./\\])/i,
  /(^|[/\\])\.env\./i,
  /service[-_]?account.*\.json$/i,
  /sotsiaalai-[a-f0-9]{12,}\.json$/i,
  /google.*credentials.*\.json$/i,
  /credentials.*\.json$/i,
  /secrets?.*\.(json|env|txt)$/i,
  /private[-_]?key/i
];

function run(command, args, options = {}) {
  const useCmd = process.platform === "win32" && command.endsWith(".cmd");
  const executable = useCmd ? process.env.ComSpec || "cmd.exe" : command;
  const executableArgs = useCmd ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    const detail = options.capture ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`);
  }

  return result.stdout || "";
}

function listStagedFiles() {
  return run("git", ["diff", "--cached", "--name-only"], { capture: true })
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function currentBranch() {
  return run("git", ["branch", "--show-current"], { capture: true }).trim() || "main";
}

try {
  const status = run("git", ["status", "--short"], { capture: true }).trim();

  if (status) {
    console.log("[AI] Staging local changes...");
    run("git", ["add", "-A"]);

    const stagedFiles = listStagedFiles();
    const blockedFiles = stagedFiles.filter(file => secretPathPatterns.some(pattern => pattern.test(file)));

    if (blockedFiles.length > 0 && !allowSecrets) {
      console.error("[AI] Refusing to commit possible secret files:");
      for (const file of blockedFiles) {
        console.error(`  - ${file}`);
      }
      console.error("[AI] Remove them from Git or re-run with --allow-secrets only if this is intentional.");
      process.exit(2);
    }

    console.log(`[AI] Commit: ${message}`);
    run("git", ["commit", "-m", message]);
  } else {
    console.log("[AI] No local changes to commit.");
  }

  const branch = currentBranch();
  console.log(`[AI] Pushing origin ${branch}...`);
  run("git", ["push", "origin", branch]);

  if (!skipDeploy) {
    console.log("[AI] Deploying server...");
    const deployArgs = ["run", "deploy:server"];
    if (skipBuild) {
      deployArgs.push("--", "--skip-build");
    }
    run(npmCommand, deployArgs);
  }

  console.log("[AI] Done.");
} catch (error) {
  console.error(`[AI] ${error?.message || error}`);
  process.exit(1);
}
