#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const scanRoots = ['app/styles', 'components'];
const reportsDir = path.join(projectRoot, 'reports');
const jsonOut = path.join(reportsDir, 'css-token-audit.json');
const csvOut = path.join(reportsDir, 'css-token-collisions.csv');
const familyCsvOut = path.join(reportsDir, 'css-token-family-subpage-card.csv');
const btnPrimaryCsvOut = path.join(reportsDir, 'css-token-family-btn-primary.csv');
const formControlCsvOut = path.join(reportsDir, 'css-token-family-form-control.csv');

const shouldSkipDir = new Set(['node_modules', '.next', '.git', 'coverage', 'playwright-report']);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDir.has(entry.name)) continue;
      files.push(...(await walk(path.join(dir, entry.name))));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function normalizeValue(value) {
  return value
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*:\s*/g, ': ')
    .trim();
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split('\n').length;
}

function tokenLayer(token) {
  if (/^--(base|ui|brand|radius|space|z)-/.test(token)) return 'foundation';
  if (/^--(surface|text|border|focus|shadow|motion)-/.test(token)) return 'semantic';
  if (/^--(input|btn|modal|glass|seg|subpage|panel)-/.test(token)) return 'component-or-semantic';
  if (/^--(chat|workspace|service-map|profile|home|invite|register|login|wellbeing|covision|journey|documents|materials|rooms)-/.test(token)) return 'feature-alias';
  if (/^--(hc|mono|night|light|mid|a11y)-/.test(token)) return 'theme-or-accessibility';
  return 'unknown';
}


function tokenFamily(token) {
  if (/^--subpage-card(-|$)/.test(token)) return 'subpage-card';
  if (/^--btn-primary(-|$)/.test(token)) return 'btn-primary';
  if (/^--(input|field|textarea|select)(-|$)/.test(token)) return 'form-control';
  return null;
}

function subpageCardDefinitionTier(file, value) {
  if (file === 'app/styles/tokens.css') return 'canonical-default';
  if (/^app\/styles\/theme\/[^/]+\.css$/.test(file)) return 'theme-override';
  if (
    file === 'app/styles/shared/glass-subpage.css' ||
    file === 'app/styles/mobile/foundations.css' ||
    file === 'app/styles/mobile/modal-surfaces/form-theme.css' ||
    file === 'app/styles/mobile/scroll-panels/glass-card.css' ||
    file === 'app/styles/mobile/interaction-surfaces.css' ||
    file === 'app/styles/shared/workspace-guide.css'
  ) {
    return 'shared-primitive';
  }
  if (/^app\/styles\/features\//.test(file)) {
    if (/var\(--[a-z0-9-]+-subpage-card-[^)]+\)/i.test(value)) return 'feature-bridge';
    return 'feature-direct-definition';
  }
  return 'other';
}

function btnPrimaryDefinitionTier(file, value) {
  if (file === 'app/styles/tokens.css') return 'canonical-default';
  if (/^app\/styles\/theme\/[^/]+\.css$/.test(file)) return 'theme-override';
  if (
    file === 'app/styles/shared/ui-glow.css' ||
    file === 'app/styles/mobile/interaction-surfaces.css' ||
    file === 'components/ui/BorderGlow.module.css'
  ) {
    return 'shared-primitive';
  }
  if (file === 'app/styles/shared/register.css') return 'legacy-shared-feature';
  if (/^app\/styles\/features\//.test(file) || /^components\/(covision|wellbeing)\//.test(file)) {
    if (/var\(--[a-z0-9-]+-btn-primary-[^)]+\)/i.test(value)) return 'feature-bridge';
    return 'feature-direct-definition';
  }
  return 'other';
}

function formControlDefinitionTier(file, value) {
  if (file === 'app/styles/tokens.css') return 'canonical-default';
  if (/^app\/styles\/theme\/[^/]+\.css$/.test(file)) return 'theme-override';
  if (
    file === 'app/styles/shared/glass-subpage.css' ||
    file === 'app/styles/mobile/scroll-panels/glass-card.css' ||
    file === 'app/styles/mobile/modal-surfaces/form-theme.css'
  ) {
    return 'shared-primitive';
  }
  if (/^app\/styles\/features\//.test(file) || /^components\/(covision|wellbeing)\//.test(file)) {
    if (/var\(--[a-z0-9-]+-(input|field|textarea|select)-[^)]+\)/i.test(value)) return 'feature-bridge';
    return 'feature-direct-definition';
  }
  return 'other';
}

const cssFiles = (await Promise.all(scanRoots.map((root) => walk(path.join(projectRoot, root))))).flat().sort();
const definitions = new Map();
const usages = new Map();
const cssFileSummaries = [];

for (const file of cssFiles) {
  const rel = path.relative(projectRoot, file).replaceAll(path.sep, '/');
  const source = await fs.readFile(file, 'utf8');
  let defCount = 0;
  let usageCount = 0;

  const defRegex = /(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/gm;
  for (const match of source.matchAll(defRegex)) {
    const token = match[2];
    const value = normalizeValue(match[3]);
    const record = {
      file: rel,
      line: lineNumberForIndex(source, match.index ?? 0),
      value,
    };
    if (!definitions.has(token)) definitions.set(token, []);
    definitions.get(token).push(record);
    defCount += 1;
  }

  const usageRegex = /var\(\s*(--[A-Za-z0-9_-]+)/g;
  for (const match of source.matchAll(usageRegex)) {
    const token = match[1];
    if (!usages.has(token)) usages.set(token, []);
    usages.get(token).push({ file: rel, line: lineNumberForIndex(source, match.index ?? 0) });
    usageCount += 1;
  }

  cssFileSummaries.push({ file: rel, bytes: Buffer.byteLength(source, 'utf8'), definitions: defCount, usages: usageCount });
}

const tokens = [...new Set([...definitions.keys(), ...usages.keys()])].sort();
const tokenRows = tokens.map((token) => {
  const defs = definitions.get(token) ?? [];
  const refs = usages.get(token) ?? [];
  const distinctValues = [...new Set(defs.map((def) => def.value))];
  const files = [...new Set(defs.map((def) => def.file))].sort();
  return {
    token,
    family: tokenFamily(token),
    layer: tokenLayer(token),
    definitions: defs.length,
    usages: refs.length,
    distinctValues: distinctValues.length,
    files,
    values: distinctValues,
    records: defs,
  };
});

const collisions = tokenRows
  .filter((row) => row.definitions > 1 && row.distinctValues > 1)
  .sort((a, b) => b.distinctValues - a.distinctValues || b.definitions - a.definitions || a.token.localeCompare(b.token));

const undefinedUsages = tokenRows
  .filter((row) => row.usages > 0 && row.definitions === 0)
  .sort((a, b) => b.usages - a.usages || a.token.localeCompare(b.token));

const definedButUnused = tokenRows
  .filter((row) => row.definitions > 0 && row.usages === 0)
  .sort((a, b) => b.definitions - a.definitions || a.token.localeCompare(b.token));


const subpageCardRecords = tokenRows
  .filter((row) => row.family === 'subpage-card')
  .flatMap((row) => row.records.map((record) => ({
    token: row.token,
    tier: subpageCardDefinitionTier(record.file, record.value),
    ...record,
  })));

const subpageCardByTier = subpageCardRecords.reduce((acc, record) => {
  acc[record.tier] = (acc[record.tier] ?? 0) + 1;
  return acc;
}, {});

const subpageCardPolicy = {
  family: 'subpage-card',
  description: 'Shared subpage/card surface tokens. Canonical defaults live in tokens.css, theme overrides live in theme/*.css, and scoped shared primitive overrides live in documented shared/mobile primitive files. Feature direct definitions are migration candidates and should normally move to feature-prefixed alias tokens before mapping back to --subpage-card-* at the feature shell.',
  tokens: [...new Set(subpageCardRecords.map((record) => record.token))].sort(),
  definitions: subpageCardRecords.length,
  files: [...new Set(subpageCardRecords.map((record) => record.file))].sort(),
  byTier: subpageCardByTier,
  featureDirectDefinitions: subpageCardRecords.filter((record) => record.tier === 'feature-direct-definition'),
  featureBridgeDefinitions: subpageCardRecords.filter((record) => record.tier === 'feature-bridge'),
  otherDefinitions: subpageCardRecords.filter((record) => record.tier === 'other'),
};

const btnPrimaryRecords = tokenRows
  .filter((row) => row.family === 'btn-primary')
  .flatMap((row) => row.records.map((record) => ({
    token: row.token,
    tier: btnPrimaryDefinitionTier(record.file, record.value),
    ...record,
  })));

const btnPrimaryByTier = btnPrimaryRecords.reduce((acc, record) => {
  acc[record.tier] = (acc[record.tier] ?? 0) + 1;
  return acc;
}, {});

const btnPrimaryPolicy = {
  family: 'btn-primary',
  description: 'Primary action button tokens. Canonical defaults live in tokens.css, global theme variants live in theme/*.css, shared primitives may bridge these tokens in documented shared UI files, and feature-specific button visuals should move through feature-prefixed alias tokens before mapping back to --btn-primary-* inside the feature shell.',
  tokens: [...new Set(btnPrimaryRecords.map((record) => record.token))].sort(),
  definitions: btnPrimaryRecords.length,
  files: [...new Set(btnPrimaryRecords.map((record) => record.file))].sort(),
  byTier: btnPrimaryByTier,
  featureDirectDefinitions: btnPrimaryRecords.filter((record) => record.tier === 'feature-direct-definition'),
  featureBridgeDefinitions: btnPrimaryRecords.filter((record) => record.tier === 'feature-bridge'),
  legacySharedFeatureDefinitions: btnPrimaryRecords.filter((record) => record.tier === 'legacy-shared-feature'),
  otherDefinitions: btnPrimaryRecords.filter((record) => record.tier === 'other'),
};

const formControlRecords = tokenRows
  .filter((row) => row.family === 'form-control')
  .flatMap((row) => row.records.map((record) => ({
    token: row.token,
    tier: formControlDefinitionTier(record.file, record.value),
    ...record,
  })));

const formControlByTier = formControlRecords.reduce((acc, record) => {
  acc[record.tier] = (acc[record.tier] ?? 0) + 1;
  return acc;
}, {});

const formControlPolicy = {
  family: 'form-control',
  description: 'Form control tokens for input/select/textarea/field surfaces. Canonical defaults live in tokens.css, global theme variants live in theme/*.css, shared primitives may bridge these tokens in documented glass/form files, and feature-specific form visuals should move through feature-prefixed alias tokens before mapping back to --input-*, --field-*, --textarea-* or --select-* inside the feature shell.',
  tokens: [...new Set(formControlRecords.map((record) => record.token))].sort(),
  definitions: formControlRecords.length,
  files: [...new Set(formControlRecords.map((record) => record.file))].sort(),
  byTier: formControlByTier,
  featureDirectDefinitions: formControlRecords.filter((record) => record.tier === 'feature-direct-definition'),
  featureBridgeDefinitions: formControlRecords.filter((record) => record.tier === 'feature-bridge'),
  otherDefinitions: formControlRecords.filter((record) => record.tier === 'other'),
};

const summary = {
  generatedAt: new Date().toISOString(),
  scanRoots,
  cssFiles: cssFiles.length,
  tokenCount: tokens.length,
  definitions: [...definitions.values()].reduce((sum, records) => sum + records.length, 0),
  usages: [...usages.values()].reduce((sum, records) => sum + records.length, 0),
  collisions: collisions.length,
  undefinedUsages: undefinedUsages.length,
  definedButUnused: definedButUnused.length,
  layers: tokenRows.reduce((acc, row) => {
    acc[row.layer] = (acc[row.layer] ?? 0) + 1;
    return acc;
  }, {}),
  families: {
    subpageCard: {
      definitions: subpageCardPolicy.definitions,
      files: subpageCardPolicy.files.length,
      featureDirectDefinitions: subpageCardPolicy.featureDirectDefinitions.length,
      featureBridgeDefinitions: subpageCardPolicy.featureBridgeDefinitions.length,
      otherDefinitions: subpageCardPolicy.otherDefinitions.length,
    },
    btnPrimary: {
      definitions: btnPrimaryPolicy.definitions,
      files: btnPrimaryPolicy.files.length,
      featureDirectDefinitions: btnPrimaryPolicy.featureDirectDefinitions.length,
      featureBridgeDefinitions: btnPrimaryPolicy.featureBridgeDefinitions.length,
      legacySharedFeatureDefinitions: btnPrimaryPolicy.legacySharedFeatureDefinitions.length,
      otherDefinitions: btnPrimaryPolicy.otherDefinitions.length,
    },
    formControl: {
      definitions: formControlPolicy.definitions,
      files: formControlPolicy.files.length,
      featureDirectDefinitions: formControlPolicy.featureDirectDefinitions.length,
      featureBridgeDefinitions: formControlPolicy.featureBridgeDefinitions.length,
      otherDefinitions: formControlPolicy.otherDefinitions.length,
    },
  },
};

await fs.mkdir(reportsDir, { recursive: true });
await fs.writeFile(
  jsonOut,
  JSON.stringify({ summary, familyPolicies: { subpageCard: subpageCardPolicy, btnPrimary: btnPrimaryPolicy, formControl: formControlPolicy }, collisions, undefinedUsages, definedButUnused, tokens: tokenRows, files: cssFileSummaries }, null, 2) + '\n',
  'utf8',
);

const csvHeader = ['token', 'layer', 'definitions', 'distinctValues', 'usages', 'files', 'values'];
const csvRows = collisions.map((row) => [
  row.token,
  row.layer,
  row.definitions,
  row.distinctValues,
  row.usages,
  row.files.join(' | '),
  row.values.join(' | '),
]);
function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
await fs.writeFile(csvOut, [csvHeader, ...csvRows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');


const familyCsvHeader = ['family', 'token', 'tier', 'file', 'line', 'value'];
const familyCsvRows = subpageCardRecords.map((record) => [
  'subpage-card',
  record.token,
  record.tier,
  record.file,
  record.line,
  record.value,
]);
await fs.writeFile(familyCsvOut, [familyCsvHeader, ...familyCsvRows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');

const btnPrimaryCsvHeader = ['family', 'token', 'tier', 'file', 'line', 'value'];
const btnPrimaryCsvRows = btnPrimaryRecords.map((record) => [
  'btn-primary',
  record.token,
  record.tier,
  record.file,
  record.line,
  record.value,
]);
await fs.writeFile(btnPrimaryCsvOut, [btnPrimaryCsvHeader, ...btnPrimaryCsvRows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');

const formControlCsvHeader = ['family', 'token', 'tier', 'file', 'line', 'value'];
const formControlCsvRows = formControlRecords.map((record) => [
  'form-control',
  record.token,
  record.tier,
  record.file,
  record.line,
  record.value,
]);
await fs.writeFile(formControlCsvOut, [formControlCsvHeader, ...formControlCsvRows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');

console.log(`CSS token audit`);
console.log(`  CSS files: ${summary.cssFiles}`);
console.log(`  Tokens: ${summary.tokenCount}`);
console.log(`  Definitions: ${summary.definitions}`);
console.log(`  Usages: ${summary.usages}`);
console.log(`  Multi-value token collisions: ${summary.collisions}`);
console.log(`  Undefined usages: ${summary.undefinedUsages}`);
console.log(`  Defined but unused: ${summary.definedButUnused}`);
console.log(`  JSON: ${path.relative(projectRoot, jsonOut)}`);
console.log(`  CSV: ${path.relative(projectRoot, csvOut)}`);
console.log(`  Subpage-card definitions: ${subpageCardPolicy.definitions} across ${subpageCardPolicy.files.length} files`);
console.log(`  Subpage-card feature direct definitions: ${subpageCardPolicy.featureDirectDefinitions.length}`);
console.log(`  Subpage-card feature bridge definitions: ${subpageCardPolicy.featureBridgeDefinitions.length}`);
console.log(`  Subpage-card other definitions: ${subpageCardPolicy.otherDefinitions.length}`);
console.log(`  Subpage-card CSV: ${path.relative(projectRoot, familyCsvOut)}`);
console.log(`  Btn-primary definitions: ${btnPrimaryPolicy.definitions} across ${btnPrimaryPolicy.files.length} files`);
console.log(`  Btn-primary feature direct definitions: ${btnPrimaryPolicy.featureDirectDefinitions.length}`);
console.log(`  Btn-primary feature bridge definitions: ${btnPrimaryPolicy.featureBridgeDefinitions.length}`);
console.log(`  Btn-primary legacy shared definitions: ${btnPrimaryPolicy.legacySharedFeatureDefinitions.length}`);
console.log(`  Btn-primary other definitions: ${btnPrimaryPolicy.otherDefinitions.length}`);
console.log(`  Btn-primary CSV: ${path.relative(projectRoot, btnPrimaryCsvOut)}`);
console.log(`  Form-control definitions: ${formControlPolicy.definitions} across ${formControlPolicy.files.length} files`);
console.log(`  Form-control feature direct definitions: ${formControlPolicy.featureDirectDefinitions.length}`);
console.log(`  Form-control feature bridge definitions: ${formControlPolicy.featureBridgeDefinitions.length}`);
console.log(`  Form-control other definitions: ${formControlPolicy.otherDefinitions.length}`);
console.log(`  Form-control CSV: ${path.relative(projectRoot, formControlCsvOut)}`);

if (process.argv.includes('--check') && summary.collisions > 700) {
  console.error(`Too many multi-value token collisions: ${summary.collisions}`);
  process.exitCode = 1;
}

if (process.argv.includes('--check') && subpageCardPolicy.otherDefinitions.length > 0) {
  console.error(`Unexpected --subpage-card-* definitions outside documented owners: ${subpageCardPolicy.otherDefinitions.length}`);
  process.exitCode = 1;
}

if (process.argv.includes('--check') && btnPrimaryPolicy.otherDefinitions.length > 0) {
  console.error(`Unexpected --btn-primary-* definitions outside documented owners: ${btnPrimaryPolicy.otherDefinitions.length}`);
  process.exitCode = 1;
}

if (process.argv.includes('--check') && formControlPolicy.otherDefinitions.length > 0) {
  console.error(`Unexpected form-control token definitions outside documented owners: ${formControlPolicy.otherDefinitions.length}`);
  process.exitCode = 1;
}
