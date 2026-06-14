import { getConfig } from "@/lib/config";
import { ClaudeProvider } from "./claude";
import { ClaudeCodeProvider } from "./claude-code";
import { OllamaProvider } from "./ollama";
import { type LLMProvider, LLMProviderError } from "./types";

/**
 * Returns the active LLMProvider implementation selected by `LLM_PROVIDER`.
 * Switching providers requires only a config/env change — no caller edits.
 * Provider-specific validation (missing key, etc.) happens at construction.
 */
export function getLLMProvider(): LLMProvider {
  const cfg = getConfig();
  switch (cfg.llmProvider) {
    case "claude-code":
      return new ClaudeCodeProvider(cfg.claudeCode);
    case "claude":
      return new ClaudeProvider(cfg.anthropic);
    case "ollama":
      return new OllamaProvider(cfg.ollama);
    default: {
      // getConfig() already rejects unknown providers; this guards exhaustiveness.
      const unknown: never = cfg.llmProvider;
      throw new LLMProviderError(
        `Unsupported LLM_PROVIDER "${String(unknown)}". Supported: claude-code, claude, ollama.`,
      );
    }
  }
}
