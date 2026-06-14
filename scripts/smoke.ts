/**
 * CLI smoke check: `npm run smoke` (add `-- --no-llm` to skip the LLM step).
 *
 * Loads a local `.env` (if present) with no extra dependency, then runs the
 * shared smoke core and prints a human-readable report.
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

async function main() {
  const withLLM = !process.argv.includes("--no-llm");
  const { runSmoke } = await import("@/lib/smoke");
  const report = await runSmoke({ withLLM });

  console.log("\n=== Tatiana — smoke check ===\n");

  // Profile
  if (report.profile.ok) {
    const s = report.profile.summary;
    console.log("✅ Profil chargé");
    console.log(`   Nom        : ${s.fullName}`);
    if (s.headline) console.log(`   Titre      : ${s.headline}`);
    if (s.email) console.log(`   Email      : ${s.email}`);
    if (s.location) console.log(`   Lieu       : ${s.location}`);
    if (s.yearsOfExperience) {
      const y = [s.yearsOfExperience.cv, s.yearsOfExperience.linkedin].filter(Boolean).join(" | ");
      if (y) console.log(`   Expérience : ${y}`);
    }
    const c = s.counts;
    console.log(
      `   Contenus   : ${c.experiences} expériences · ${c.formations} formations · ` +
        `${c.skills} compétences · ${c.languages} langues · ${c.publications} publications`,
    );
    if (s.conflicts.length) {
      console.log(`   ⚠️  Conflits inter-sources (${s.conflicts.length}) :`);
      for (const cf of s.conflicts) {
        console.log(`      - ${cf.field}: CV="${cf.cv ?? ""}" / LinkedIn="${cf.linkedin ?? ""}"`);
      }
    }
  } else {
    console.log(`❌ Profil : ${report.profile.error}`);
  }

  // LLM
  console.log("");
  if (!report.llm.attempted) {
    console.log(`⏭️  LLM : ${report.llm.reason}`);
  } else if (report.llm.ok) {
    console.log(`✅ LLM (${report.llm.provider}${report.llm.model ? `, ${report.llm.model}` : ""})`);
    console.log(`   → ${report.llm.response}`);
  } else {
    console.log(`⚠️  LLM (${report.llm.provider}) indisponible :`);
    console.log(`   ${report.llm.error}`);
    console.log("   (Le profil fonctionne sans LLM — configure une clé/un provider pour cette étape.)");
  }
  console.log("");
}

main().catch((err) => {
  console.error("Smoke check crashed unexpectedly:", err);
  process.exit(1);
});
