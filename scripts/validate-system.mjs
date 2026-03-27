#!/usr/bin/env node
// scripts/validate-system.mjs
// CTO Validation Layer v0.01
//
// Read-only system integrity check for the Planck execution platform.
// Validates surfaces, operators, templates, surface runtimes, and execution endpoints.
//
// Usage:
//   node scripts/validate-system.mjs

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Output helpers ────────────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM    = "\x1b[2m";

let totalChecks = 0;
let totalPassed = 0;
const failures  = [];
const warnings  = [];

function pass(label) {
  totalChecks++;
  totalPassed++;
  console.log(`  ${GREEN}✓${RESET} ${label}`);
}

function fail(label, detail) {
  totalChecks++;
  failures.push({ label, detail });
  console.log(`  ${RED}✗${RESET} ${label}`);
  if (detail) console.log(`    ${DIM}→ ${detail}${RESET}`);
}

function warn(label, detail) {
  warnings.push({ label, detail });
  console.log(`  ${YELLOW}⚠${RESET} ${label}`);
  if (detail) console.log(`    ${DIM}→ ${detail}${RESET}`);
}

function section(title) {
  console.log(`\n${BOLD}${title}${RESET}`);
}

function fileExists(relPath) {
  return existsSync(resolve(ROOT, relPath));
}

function readTS(relPath) {
  try {
    return readFileSync(resolve(ROOT, relPath), "utf-8");
  } catch {
    return null;
  }
}

// ─── Naive TypeScript extractor helpers ───────────────────────────────────────
// We parse the TS files as text — no transpile needed for what we need.

/** Extract string array elements from a line like: slug: "foo" */
function extractStringFields(src, field) {
  const re = new RegExp(`${field}:\\s*["'\`]([^"'\`]+)["'\`]`, "g");
  const results = [];
  let m;
  while ((m = re.exec(src)) !== null) results.push(m[1]);
  return results;
}

/** Extract quoted keys from a registry object literal, e.g. "v1:auto-detailing": ... */
function extractRegistryKeys(src) {
  const re = /["']([a-z0-9_\-:]+)["']\s*:/g;
  const results = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const k = m[1];
    // Filter to keys that look like "template:surface-slug"
    if (k.includes(":")) results.push(k);
  }
  return results;
}

/** Extract all surface_slug values from runtime files */
function extractRuntimeSlugs(src) {
  return extractStringFields(src, "surface_slug");
}

// ─── 1. Surface definitions ────────────────────────────────────────────────────

section("1. Surface Definitions");

const SURFACES_PATH = "src/data/surfaces.ts";

if (!fileExists(SURFACES_PATH)) {
  fail(`${SURFACES_PATH} exists`, "file not found");
} else {
  pass(`${SURFACES_PATH} exists`);
  const src = readTS(SURFACES_PATH);
  const slugs  = extractStringFields(src, "slug");
  const names  = extractStringFields(src, "name");

  if (slugs.length === 0) {
    fail("surfaces array is non-empty", "no slug fields found");
  } else {
    pass(`surfaces array is non-empty (${slugs.length} entries)`);
  }

  const missingName = slugs.filter((_, i) => !names[i]);
  if (missingName.length > 0) {
    fail("each surface has a name", `missing name for: ${missingName.join(", ")}`);
  } else {
    pass("each surface has slug + name");
  }

  // Stash for cross-checks
  globalThis._surfaceSlugs = slugs;
}

// ─── 2. Operator definitions ───────────────────────────────────────────────────

section("2. Operator Definitions");

const OPERATORS_PATH = "src/data/operators.ts";

if (!fileExists(OPERATORS_PATH)) {
  fail(`${OPERATORS_PATH} exists`, "file not found");
} else {
  pass(`${OPERATORS_PATH} exists`);
  const src = readTS(OPERATORS_PATH);

  // Count operators by counting slug occurrences within an object block
  const slugs    = extractStringFields(src, "slug");
  const surfaces = extractStringFields(src, "surface");
  const regions  = extractStringFields(src, "regionName");

  if (slugs.length === 0) {
    fail("operators array is non-empty", "no slug fields found");
  } else {
    pass(`operators array is non-empty (${slugs.length} entries)`);
  }

  // Each operator must reference a known surface
  const knownSurfaces = new Set(globalThis._surfaceSlugs || []);
  const badSurfaces   = surfaces.filter((s) => knownSurfaces.size > 0 && !knownSurfaces.has(s));
  if (badSurfaces.length > 0) {
    fail("all operator surfaces reference known surface slugs", `unknown: ${badSurfaces.join(", ")}`);
  } else {
    pass("all operator surfaces reference known surface slugs");
  }

  if (regions.length < slugs.length) {
    warn("each operator has a regionName", `found ${regions.length} regions for ${slugs.length} operators`);
  } else {
    pass("each operator has slug + surface + regionName");
  }

  // Check operator count matches surfaces referenced
  const surfaceSet = new Set(surfaces);
  const totalSurfaces = (globalThis._surfaceSlugs || []).filter(s => surfaceSet.has(s)).length;
  globalThis._operatorCount = slugs.length;
}

// ─── 3. Template mapping ───────────────────────────────────────────────────────

section("3. Template Mapping");

const TEMPLATES_PATH = "src/lib/operator-templates.ts";

if (!fileExists(TEMPLATES_PATH)) {
  fail(`${TEMPLATES_PATH} exists`, "file not found");
} else {
  pass(`${TEMPLATES_PATH} exists`);
  const src = readTS(TEMPLATES_PATH);

  // Extract registered template keys like "v1:auto-detailing"
  const registryKeys = extractRegistryKeys(src);

  if (registryKeys.length === 0) {
    fail("template registry is non-empty", "no template keys found");
  } else {
    pass(`template registry has ${registryKeys.length} entries: ${registryKeys.join(", ")}`);
  }

  // Verify imported template files exist
  const importRe = /from\s+["']([^"']+\.astro)["']/g;
  let importMatch;
  let missingTemplates = 0;
  while ((importMatch = importRe.exec(src)) !== null) {
    const importPath = importMatch[1].replace(/^\.\.\//, "src/");
    if (!fileExists(importPath)) {
      fail(`template file exists: ${importPath}`, "file not found");
      missingTemplates++;
    } else {
      pass(`template file exists: ${importPath}`);
    }
  }
  if (missingTemplates === 0 && registryKeys.length > 0) {
    pass("all template imports resolve to existing files");
  }

  // Cross-check: every live operator surface has a registered template
  const operatorSrc = readTS(OPERATORS_PATH);
  const opSurfaces  = extractStringFields(operatorSrc || "", "surface");
  const opTemplates = extractStringFields(operatorSrc || "", "template");
  const registrySet = new Set(registryKeys);

  const unmapped = [];
  opSurfaces.forEach((surface, i) => {
    const template = opTemplates[i] || "v1";
    const key = `${template}:${surface}`;
    if (!registrySet.has(key)) unmapped.push(key);
  });

  if (unmapped.length > 0) {
    fail("all operator template:surface combos are registered", `missing: ${[...new Set(unmapped)].join(", ")}`);
  } else {
    pass("all operator template:surface combos are registered");
  }
}

// ─── 4. Surface Runtime ────────────────────────────────────────────────────────

section("4. Surface Runtime");

const RUNTIME_PATH = "src/lib/surface-runtime.ts";

if (!fileExists(RUNTIME_PATH)) {
  fail(`${RUNTIME_PATH} exists`, "file not found");
} else {
  pass(`${RUNTIME_PATH} exists`);
  const src = readTS(RUNTIME_PATH);

  if (!src.includes("registerSurfaceRuntime")) {
    fail("surface-runtime exports registerSurfaceRuntime", "symbol not found");
  } else {
    pass("surface-runtime exports registerSurfaceRuntime");
  }

  if (!src.includes("resolveSurfaceRuntime")) {
    fail("surface-runtime exports resolveSurfaceRuntime", "symbol not found");
  } else {
    pass("surface-runtime exports resolveSurfaceRuntime");
  }
}

// Check concrete runtimes in src/lib/surfaces/
const SURFACES_LIB_DIR = "src/lib/surfaces";
const DETAILING_RUNTIME = `${SURFACES_LIB_DIR}/detailing-runtime.ts`;

if (!fileExists(DETAILING_RUNTIME)) {
  fail(`${DETAILING_RUNTIME} exists`, "auto-detailing runtime not found");
} else {
  pass(`${DETAILING_RUNTIME} exists`);
  const src = readTS(DETAILING_RUNTIME);
  const runtimeSlugs = extractRuntimeSlugs(src);
  if (!runtimeSlugs.includes("auto-detailing")) {
    fail("detailing runtime declares surface_slug: auto-detailing", `found: ${runtimeSlugs.join(", ") || "(none)"}`);
  } else {
    pass("detailing runtime declares surface_slug: auto-detailing");
  }
  if (!src.includes("registerSurfaceRuntime")) {
    warn("detailing runtime calls registerSurfaceRuntime", "self-registration call not found");
  } else {
    pass("detailing runtime self-registers via registerSurfaceRuntime");
  }
}

// Count all runtime files
import { readdirSync } from "fs";
let runtimeFiles = [];
try {
  runtimeFiles = readdirSync(resolve(ROOT, SURFACES_LIB_DIR)).filter(f => f.endsWith("-runtime.ts"));
} catch {}
globalThis._runtimeCount = runtimeFiles.length;
if (runtimeFiles.length > 0) {
  pass(`surface runtimes found: ${runtimeFiles.map(f => f.replace("-runtime.ts","")).join(", ")}`);
}

// ─── 5. Execution endpoints ────────────────────────────────────────────────────

section("5. Execution Endpoints");

const REQUIRED_ENDPOINTS = [
  // Job execution spine
  "functions/api/job/active.ts",
  "functions/api/job/claim.ts",
  "functions/api/job/complete.ts",
  "functions/api/job/completed.ts",
  "functions/api/job/current.ts",
  // Service Events
  "functions/api/service-events/create.ts",
  "functions/api/service-events/start.ts",
  "functions/api/service-events/complete.ts",
  "functions/api/service-events/add-evidence.ts",
  "functions/api/service-events/update-payment.ts",
  // Omni
  "functions/api/omni/ingest.ts",
];

let missingEndpoints = 0;
for (const ep of REQUIRED_ENDPOINTS) {
  if (!fileExists(ep)) {
    fail(`endpoint exists: ${ep}`, "file not found");
    missingEndpoints++;
  } else {
    pass(`endpoint exists: ${ep}`);
  }
}

// Also check by_id sub-endpoint
const BY_ID = "functions/api/job/by_id";
if (!existsSync(resolve(ROOT, BY_ID))) {
  fail(`endpoint dir exists: ${BY_ID}`, "directory not found");
} else {
  pass(`endpoint dir exists: ${BY_ID}`);
}

// Omni auth check — ingest.ts must import checkAgentAuth
const omniSrc = readTS("functions/api/omni/ingest.ts");
if (omniSrc && !omniSrc.includes("checkAgentAuth")) {
  fail("omni/ingest.ts uses checkAgentAuth", "auth guard not found — endpoint may be unprotected");
} else if (omniSrc) {
  pass("omni/ingest.ts has auth guard (checkAgentAuth)");
}

// Agent bridge endpoints
section("6. Agent Bridge Endpoints");

const AGENT_ENDPOINTS = [
  "functions/api/agent/_lib.ts",
  "functions/api/agent/intake/queue.ts",
  "functions/api/agent/job/create/[intakeId].ts",
];

for (const ep of AGENT_ENDPOINTS) {
  if (!fileExists(ep)) {
    fail(`agent endpoint exists: ${ep}`, "file not found");
  } else {
    pass(`agent endpoint exists: ${ep}`);
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────────

const surfaceCount  = (globalThis._surfaceSlugs || []).length;
const operatorCount = globalThis._operatorCount || 0;
const runtimeCount  = globalThis._runtimeCount  || 0;

console.log(`\n${BOLD}────────────────────────────────────────${RESET}`);
console.log(`${BOLD}COUNTS${RESET}`);
console.log(`  Surfaces:          ${surfaceCount}`);
console.log(`  Operators:         ${operatorCount}`);
console.log(`  Surface Runtimes:  ${runtimeCount}`);

if (warnings.length > 0) {
  console.log(`\n${BOLD}WARNINGS (${warnings.length})${RESET}`);
  for (const w of warnings) {
    console.log(`  ${YELLOW}⚠${RESET} ${w.label}`);
    if (w.detail) console.log(`    ${DIM}→ ${w.detail}${RESET}`);
  }
}

if (failures.length > 0) {
  console.log(`\n${BOLD}FAILURES (${failures.length})${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}✗${RESET} ${f.label}`);
    if (f.detail) console.log(`    ${DIM}→ ${f.detail}${RESET}`);
  }
}

console.log(`\n${BOLD}────────────────────────────────────────${RESET}`);
const passed = failures.length === 0;
if (passed) {
  console.log(`${BOLD}${GREEN}SYSTEM STATUS: PASS${RESET}  (${totalPassed}/${totalChecks} checks passed${warnings.length > 0 ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""})\n`);
} else {
  console.log(`${BOLD}${RED}SYSTEM STATUS: FAIL${RESET}  (${totalPassed}/${totalChecks} checks passed, ${failures.length} failure${failures.length === 1 ? "" : "s"})\n`);
  process.exit(1);
}
