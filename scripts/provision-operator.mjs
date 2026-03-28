#!/usr/bin/env node
/**
 * Planck Operator Provisioner
 *
 * Appends a new operator to src/data/operators.ts and registers the region
 * in src/data/regions.ts if it is not already present.
 *
 * Usage:
 *   npm run provision:operator -- \
 *     --name "Sunrise Landscaping" \
 *     --surface landscaping \
 *     --city "fort-lauderdale" \
 *     --state fl \
 *     --country us \
 *     --region-name "Broward County" \
 *     --tagline "Structured property care for Broward County." \
 *     [--booking-href "#request"] \
 *     [--logo "/brand/planck-wordmark.png"]
 *
 * Required flags:
 *   --name          Display name of the operator
 *   --surface       Surface slug (must exist in surfaces.ts with status: "live")
 *   --city          City slug (kebab-case, e.g. "fort-lauderdale")
 *   --state         State code (e.g. "fl")
 *   --country       Country code (e.g. "us")
 *   --region-name   Human-readable region name (e.g. "Broward County")
 *   --tagline       One-line operator description
 *
 * Optional flags:
 *   --booking-href  Anchor href for booking CTA (default: "#request")
 *   --logo          Logo path (default: "/brand/planck-wordmark.png")
 *   --slug          Override auto-generated slug
 *   --dry-run       Print changes without writing files
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const isDryRun = args["dry-run"] === true;

// ── Required field validation ─────────────────────────────────────────────────

const REQUIRED = ["name", "surface", "city", "state", "country", "region-name", "tagline"];
const missing = REQUIRED.filter((k) => !args[k]);
if (missing.length) {
  console.error(`\n  ERROR: Missing required flags: ${missing.map(k => `--${k}`).join(", ")}\n`);
  console.error("  Run with --help to see usage.\n");
  process.exit(1);
}

const name       = String(args["name"]).trim();
const surface    = String(args["surface"]).trim().toLowerCase();
const city       = String(args["city"]).trim().toLowerCase();
const state      = String(args["state"]).trim().toLowerCase();
const country    = String(args["country"]).trim().toLowerCase();
const regionName = String(args["region-name"]).trim();
const tagline    = String(args["tagline"]).trim();
const bookingHref = String(args["booking-href"] || "#request").trim();
const logo       = String(args["logo"] || "/brand/planck-wordmark.png").trim();

// ── Slug generation ───────────────────────────────────────────────────────────

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Auto-generate slug: "{city}-{name-slug}" e.g. "fort-lauderdale-sunrise-landscaping"
// Allow override via --slug
const slug = args["slug"]
  ? String(args["slug"]).trim().toLowerCase()
  : toSlug(`${name}`);

if (!slug) {
  console.error("\n  ERROR: Could not generate a valid slug from the provided name.\n");
  process.exit(1);
}

// ── Read source files ─────────────────────────────────────────────────────────

const OPERATORS_PATH = resolve(ROOT, "src/data/operators.ts");
const REGIONS_PATH   = resolve(ROOT, "src/data/regions.ts");
const SURFACES_PATH  = resolve(ROOT, "src/data/surfaces.ts");

const operatorsSource = readFileSync(OPERATORS_PATH, "utf8");
const regionsSource   = readFileSync(REGIONS_PATH, "utf8");
const surfacesSource  = readFileSync(SURFACES_PATH, "utf8");

// ── Validate surface exists and is live ───────────────────────────────────────

const surfaceSlugPattern = /slug:\s*["']([^"']+)["']/g;
const liveSlugs = [];
const statusPattern = /slug:\s*["']([^"']+)["'][^}]*?status:\s*["'](live|planned)["']/gs;
let sm;
while ((sm = statusPattern.exec(surfacesSource)) !== null) {
  if (sm[2] === "live") liveSlugs.push(sm[1]);
}

// Fallback: if regex didn't match (unusual format), just extract all slugs
if (liveSlugs.length === 0) {
  let m;
  while ((m = surfaceSlugPattern.exec(surfacesSource)) !== null) {
    liveSlugs.push(m[1]);
  }
}

if (!liveSlugs.includes(surface)) {
  console.error(`\n  ERROR: Surface "${surface}" is not a live surface in surfaces.ts.`);
  console.error(`  Available live surfaces: ${liveSlugs.join(", ")}\n`);
  process.exit(1);
}

// ── Validate operator slug uniqueness ─────────────────────────────────────────

const operatorSlugPattern = /slug:\s*["']([^"']+)["']/g;
const existingSlugs = [];
let om;
while ((om = operatorSlugPattern.exec(operatorsSource)) !== null) {
  existingSlugs.push(om[1]);
}

if (existingSlugs.includes(slug)) {
  console.error(`\n  ERROR: Operator slug "${slug}" already exists in operators.ts.`);
  console.error(`  Use --slug to specify a different slug.\n`);
  process.exit(1);
}

// ── Check region uniqueness ───────────────────────────────────────────────────

// Region is identified by city+state+country. Check if it already exists.
const regionExistsPattern = new RegExp(
  `city:\\s*["']${city}["'][^}]*?country:\\s*["']${country}["']|country:\\s*["']${country}["'][^}]*?city:\\s*["']${city}["']`,
  "s"
);
const regionAlreadyExists = regionExistsPattern.test(regionsSource);

// ── Build operator entry ──────────────────────────────────────────────────────

const operatorEntry = `  {
    slug: "${slug}",
    name: "${name}",
    logo: "${logo}",

    country: "${country}",
    state: "${state}",
    city: "${city}",

    regionName: "${regionName}",

    surface: "${surface}",
    tagline: "${tagline}",

    template: "v1",
    bookingHref: "${bookingHref}"
  },`;

// ── Build region entry (if new) ───────────────────────────────────────────────

const regionSlug = toSlug(city);
const regionEntry = `  {
    slug: "${regionSlug}",
    name: "${regionName}",
    country: "${country}",
    state: "${state}",
    city: "${city}",
  },`;

// ── Apply changes to operators.ts ─────────────────────────────────────────────

// Insert the new operator before the closing `];` of the operators array.
// Anchor on `];\n\nexport const operatorMap` to avoid false matches inside
// expressions like `operatorMap[slug];` which also contain `];`.
const OPERATORS_ARRAY_TERMINUS = "];\n\nexport const operatorMap";
const operatorsInsertPoint = operatorsSource.indexOf(OPERATORS_ARRAY_TERMINUS);
if (operatorsInsertPoint === -1) {
  console.error("\n  ERROR: Could not locate the operators array terminus in operators.ts.");
  console.error("  Expected the pattern `];\\n\\nexport const operatorMap` after the array.");
  console.error("  File format may have changed.\n");
  process.exit(1);
}

// Ensure the last entry before `];` has a trailing comma.
// The array's last entry closes with `  }` (no comma) or `  },` (already has one).
// We normalize by replacing the exact pattern `  }\n];` with `  },\n];`.
const beforeTerminus = operatorsSource.slice(0, operatorsInsertPoint);
const normalizedBefore = beforeTerminus.replace(/(\s*\})\s*$/, (m, closing) => {
  const trimmed = closing.trimEnd();
  return trimmed.endsWith(",") ? m : trimmed + ",\n";
});

const newOperatorsSource =
  normalizedBefore +
  operatorEntry + "\n" +
  operatorsSource.slice(operatorsInsertPoint);

// ── Apply changes to regions.ts (if new region) ───────────────────────────────

let newRegionsSource = regionsSource;
if (!regionAlreadyExists) {
  const REGIONS_ARRAY_TERMINUS = "];\n\nexport const regionMap";
  const regionsInsertPoint = regionsSource.indexOf(REGIONS_ARRAY_TERMINUS);
  if (regionsInsertPoint === -1) {
    console.error("\n  ERROR: Could not locate the regions array terminus in regions.ts.");
    console.error("  Expected the pattern `];\\n\\nexport const regionMap` after the array.");
    console.error("  File format may have changed.\n");
    process.exit(1);
  }
  newRegionsSource =
    regionsSource.slice(0, regionsInsertPoint) +
    regionEntry + "\n" +
    regionsSource.slice(regionsInsertPoint);
}

// ── Output ────────────────────────────────────────────────────────────────────

console.log("\n  ── Planck Operator Provisioner ─────────────────────────────────\n");
console.log(`  Operator:    ${name}`);
console.log(`  Slug:        ${slug}`);
console.log(`  Surface:     ${surface}`);
console.log(`  Region:      ${regionName} (${city}, ${state}, ${country})`);
console.log(`  Dashboard:   /operators/${slug}/dashboard`);
console.log(`  Jobs:        /operators/${slug}/jobs/`);
console.log(`  Profile:     /operators/${slug}`);
console.log(`  Regional:    /${country}/${state}/${city}/${surface}`);
console.log("");

if (isDryRun) {
  console.log("  DRY RUN — no files written.\n");
  console.log("  operators.ts entry to append:");
  console.log("");
  console.log(operatorEntry.split("\n").map(l => "    " + l).join("\n"));
  if (!regionAlreadyExists) {
    console.log("");
    console.log("  regions.ts entry to append:");
    console.log(regionEntry.split("\n").map(l => "    " + l).join("\n"));
  }
  console.log("\n  ────────────────────────────────────────────────────────────────\n");
  process.exit(0);
}

writeFileSync(OPERATORS_PATH, newOperatorsSource, "utf8");
console.log("  ✓ src/data/operators.ts updated");

if (!regionAlreadyExists) {
  writeFileSync(REGIONS_PATH, newRegionsSource, "utf8");
  console.log("  ✓ src/data/regions.ts updated (new region registered)");
} else {
  console.log(`  · regions.ts unchanged (${city}/${state}/${country} already registered)`);
}

console.log(`
  Next steps:
    1. Verify the entries in src/data/operators.ts and src/data/regions.ts
    2. git add src/data/operators.ts src/data/regions.ts
    3. git commit -m "provision: add ${slug} operator"
    4. git push → Cloudflare Pages auto-deploys (~60s)

  After deploy, the operator will appear in:
    · /operators/${slug}/dashboard
    · /operators/${slug}/jobs/
    · /surfaces/${surface}  (operator card)
    · /${country}/${state}/${city}/${surface}  (regional route)
    · /router  (search dropdown)

  ────────────────────────────────────────────────────────────────
`);
