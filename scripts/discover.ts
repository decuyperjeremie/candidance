/**
 * CLI discovery pass: `npm run discover`.
 *
 * Options:
 *   --keywords="communication,relations presse"   override source-side query
 *   --departments=75,92                            restrict to some IDF deps
 *   --limit=50                                     cap the printed list
 *
 * Loads `.env` (like scripts/smoke.ts), runs the shared discovery core, and
 * prints the run summary + the ranked offer list.
 */
import { existsSync, readFileSync } from "node:fs";

// Minimal .env loader (tsx/node scripts don't auto-load .env like Next.js does).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (key in process.env) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function argValue(name: string): string | undefined {
  const pref = `--${name}=`;
  return process.argv.find((a) => a.startsWith(pref))?.slice(pref.length);
}

function splitList(v?: string): string[] | undefined {
  return v
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
}

async function main() {
  const { runDiscovery } = await import("@/lib/aggregation/discover");
  const result = await runDiscovery({
    keywords: splitList(argValue("keywords")),
    departments: splitList(argValue("departments")),
    limit: argValue("limit") ? Number(argValue("limit")) : undefined,
  });

  const { summary, offers } = result;

  console.log("\n=== Tatiana — découverte d'offres (communication, Île-de-France) ===\n");
  console.log(`Mots-clés  : ${summary.criteria.keywords.join(", ")}`);
  console.log(`Départements : ${summary.criteria.departments.join(", ")}`);
  console.log("");
  console.log("Sources :");
  for (const o of summary.perSource) {
    if (o.ok) {
      console.log(`  ✅ ${o.source} : ${o.count} offre(s)`);
    } else {
      console.log(`  ⚠️  ${o.source} : ${o.error}`);
    }
  }
  console.log("");
  console.log(
    `Récupérées : ${summary.fetched} · après filtre comm/zone : ${summary.afterFilter} · ` +
      `doublons fusionnés : ${summary.duplicatesMerged} · stockées : ${summary.totalStored}`,
  );

  console.log(`\n--- Top ${offers.length} offres (par pertinence) ---\n`);
  if (offers.length === 0) {
    console.log("Aucune offre. Vérifie les identifiants France Travail (FRANCE_TRAVAIL_CLIENT_ID/SECRET).");
  }
  offers.forEach((o, i) => {
    const where = [o.company, o.location].filter(Boolean).join(" · ");
    const url = o.sources.find((s) => s.url)?.url ?? "";
    console.log(`${String(i + 1).padStart(2)}. [${String(o.score).padStart(3)}] ${o.title}`);
    if (where) console.log(`     ${where}`);
    if (o.scoreRationale) console.log(`     ${o.scoreRationale}`);
    if (url) console.log(`     ${url}`);
    console.log(`     sources : ${o.sources.map((s) => s.source).join(", ")}`);
  });
  console.log("");
}

main().catch((err) => {
  console.error("Discovery crashed unexpectedly:", err);
  process.exit(1);
});
