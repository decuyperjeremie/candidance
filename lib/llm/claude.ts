import Anthropic from "@anthropic-ai/sdk";
import {
  type CompleteParams,
  type LLMProvider,
  LLMProviderError,
} from "./types";

/**
 * Claude (Anthropic) provider. The Anthropic SDK is imported ONLY here.
 * Fails fast (before any network call) if the API key is missing.
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(
    private readonly opts: { apiKey?: string; model: string },
  ) {
    if (!opts.apiKey) {
      throw new LLMProviderError(
        "ANTHROPIC_API_KEY is not set. Create a key at " +
          "https://console.anthropic.com/ and add it to your .env, or set " +
          "LLM_PROVIDER=ollama to use a local model.",
      );
    }
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async complete(params: CompleteParams): Promise<string> {
    try {
      const res = await this.client.messages.create({
        model: this.opts.model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    } catch (err) {
      throw new LLMProviderError(
        `Claude completion failed (model "${this.opts.model}"): ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  }
}
