import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const checks = [
  {
    file: "app/api/chat/route.js",
    rules: [
      {
        label: "chat openai_usage includes role",
        pattern: /await logOpenAIUsage\(\{\s*[\s\S]*?route:\s*"api\/chat"[\s\S]*?userId,\s*[\s\S]*?role\s*[\s\S]*?\}\);/m
      }
    ]
  },
  {
    file: "lib/documents/generation.js",
    rules: [
      {
        label: "document generate openai_usage includes userRole",
        pattern: /await logOpenAIUsage\(\{\s*[\s\S]*?route:\s*observabilityRoute[\s\S]*?stage:\s*observabilityStage[\s\S]*?userId,\s*[\s\S]*?role:\s*userRole\s*[\s\S]*?\}\)/m
      },
      {
        label: "document generation function accepts userRole",
        pattern: /export async function generateArtifactDraftContent\(\{[\s\S]*?userRole = null[\s\S]*?\}\)/m
      },
      {
        label: "document refine function accepts userRole",
        pattern: /export async function refineArtifactDraftContent\(\{[\s\S]*?userRole = null[\s\S]*?\}\)/m
      }
    ]
  },
  {
    file: "lib/research/pipeline.js",
    rules: [
      {
        label: "research model helper accepts role",
        pattern: /async function callJsonModel\(\{[\s\S]*?userId = null,\s*role = null[\s\S]*?\}\)/m
      },
      {
        label: "research openai_usage includes role",
        pattern: /await logOpenAIUsage\(\{\s*[\s\S]*?route,\s*[\s\S]*?stage,\s*[\s\S]*?userId,\s*[\s\S]*?role\s*[\s\S]*?\}\);/m
      },
      {
        label: "research planner passes userRole",
        pattern: /stage:\s*"research_planner",\s*[\s\S]*?userId:\s*payload\?\.userId \|\| null,\s*[\s\S]*?role:\s*payload\?\.userRole \|\| null/m
      },
      {
        label: "research synthesizer passes userRole",
        pattern: /stage:\s*"research_synthesizer",\s*[\s\S]*?userId:\s*payload\?\.userId \|\| null,\s*[\s\S]*?role:\s*payload\?\.userRole \|\| null/m
      }
    ]
  }
];

let failed = false;

for (const check of checks) {
  const filePath = path.join(rootDir, check.file);
  const content = fs.readFileSync(filePath, "utf8");
  for (const rule of check.rules) {
    if (!rule.pattern.test(content)) {
      failed = true;
      console.error(`[ai:check-attribution] failed: ${rule.label} in ${check.file}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("[ai:check-attribution] attribution symmetry checks passed");
}
