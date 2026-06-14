import { z } from "zod";

/**
 * Centralised, typed environment configuration.
 *
 * Design notes (see openspec/changes/bootstrap-foundations/design.md):
 * - `LLM_PROVIDER` selects the active LLM backend; unknown values fail fast.
 * - Provider-specific secrets (ANTHROPIC_API_KEY, Ollama URL/model) are
 *   validated lazily, only when that provider is actually used. This keeps
 *   profile-loading and the build working with NO key configured.
 */

export const SUPPORTED_PROVIDERS = ["claude-code", "claude", "ollama"] as const;
export type LlmProvider = (typeof SUPPORTED_PROVIDERS)[number];

/** Known job-source connectors (see lib/sources). */
export const SUPPORTED_JOB_SOURCES = [
  "france-travail",
  "apec",
  "welcome-to-the-jungle",
  "linkedin",
  "indeed",
  "glassdoor",
] as const;
export type JobSourceName = (typeof SUPPORTED_JOB_SOURCES)[number];

/** Only France Travail runs by default; the rest are opt-in via JOB_SOURCES. */
const DEFAULT_JOB_SOURCES: JobSourceName[] = ["france-travail"];

/** Sensible current default. Overridable via ANTHROPIC_MODEL. */
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1";
/** `claude` CLI headless provider (uses the Claude Code / Max subscription). */
const DEFAULT_CLAUDE_CLI_PATH = "claude";
/** Alias resolves to the latest Sonnet at call time; override via CLAUDE_CODE_MODEL. */
const DEFAULT_CLAUDE_CODE_MODEL = "sonnet";

const EnvSchema = z.object({
  LLM_PROVIDER: z
    .enum(SUPPORTED_PROVIDERS, {
      errorMap: () => ({
        message: `LLM_PROVIDER must be one of: ${SUPPORTED_PROVIDERS.join(", ")}`,
      }),
    })
    .default("claude-code"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default(DEFAULT_ANTHROPIC_MODEL),
  OLLAMA_BASE_URL: z.string().url().default(DEFAULT_OLLAMA_BASE_URL),
  OLLAMA_MODEL: z.string().min(1).default(DEFAULT_OLLAMA_MODEL),
  CLAUDE_CLI_PATH: z.string().min(1).default(DEFAULT_CLAUDE_CLI_PATH),
  CLAUDE_CODE_MODEL: z.string().min(1).default(DEFAULT_CLAUDE_CODE_MODEL),
  // --- job sources ---
  // Comma-separated list of enabled connectors. Unknown names are rejected.
  JOB_SOURCES: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(z.enum(SUPPORTED_JOB_SOURCES)).optional()),
  // France Travail credentials are validated lazily (only when that connector
  // actually runs), so discovery with other sources works without them.
  FRANCE_TRAVAIL_CLIENT_ID: z.string().min(1).optional(),
  FRANCE_TRAVAIL_CLIENT_SECRET: z.string().min(1).optional(),
});

export type AppConfig = {
  llmProvider: LlmProvider;
  anthropic: { apiKey?: string; model: string };
  ollama: { baseUrl: string; model: string };
  claudeCode: { cliPath: string; model: string };
  jobSources: JobSourceName[];
  franceTravail: { clientId?: string; clientSecret?: string };
};

/** Raised on any configuration problem so callers can show a friendly message. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

let cached: AppConfig | null = null;

/**
 * Reads and validates env once (cached). Fails fast on an unknown
 * LLM_PROVIDER or otherwise malformed values. Does NOT require a provider
 * secret — that is enforced when the provider is constructed.
 */
export function getConfig(): AppConfig {
  if (cached) return cached;

  // Treat empty env vars (e.g. `ANTHROPIC_API_KEY=` in .env) as absent, so
  // optional fields fall back to undefined and defaulted fields apply.
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    cleaned[k] = v === "" ? undefined : v;
  }

  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid environment configuration:\n${details}`);
  }

  const e = parsed.data;
  cached = {
    llmProvider: e.LLM_PROVIDER,
    anthropic: { apiKey: e.ANTHROPIC_API_KEY, model: e.ANTHROPIC_MODEL },
    ollama: { baseUrl: e.OLLAMA_BASE_URL, model: e.OLLAMA_MODEL },
    claudeCode: { cliPath: e.CLAUDE_CLI_PATH, model: e.CLAUDE_CODE_MODEL },
    jobSources: e.JOB_SOURCES ?? DEFAULT_JOB_SOURCES,
    franceTravail: {
      clientId: e.FRANCE_TRAVAIL_CLIENT_ID,
      clientSecret: e.FRANCE_TRAVAIL_CLIENT_SECRET,
    },
  };
  return cached;
}

/** Test/seam helper: clear the cached config so the next read re-parses env. */
export function resetConfigCache(): void {
  cached = null;
}
