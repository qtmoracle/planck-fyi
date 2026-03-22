import { buildAstrologyContextPack } from "./src/lib/astrology-context.ts";
import { resolveAstrologyMode } from "./src/lib/astrology-mode.ts";

// TEST CASE: focused (no birth data, no transit data)
const pack = buildAstrologyContextPack({
  name: "Alex",
  question: "I feel like I’m in transition and not sure whether to pivot or commit.",
});

console.log("=== CONTEXT PACK ===");
console.log(JSON.stringify(pack, null, 2));

console.log("\n=== MODE RESULT ===");
console.log(resolveAstrologyMode(pack));
