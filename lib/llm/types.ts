/**
 * Provider-agnostic LLM interface (the bridge).
 *
 * Calling code depends ONLY on these types — never on a vendor SDK. The Claude
 * and Ollama implementations live behind the `LLMProvider` interface and are
 * selected by a factory reading `LLM_PROVIDER` (see ./factory).
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type CompleteParams = {
  /** Optional system prompt. */
  system?: string;
  /** Conversation messages (at least one user message expected). */
  messages: ChatMessage[];
  /** Max tokens to generate. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
};

export interface LLMProvider {
  /** Stable id of the active provider, e.g. "claude" | "ollama". */
  readonly name: string;
  /** Run one completion and return the model's text response. */
  complete(params: CompleteParams): Promise<string>;
}

/**
 * Raised for any provider problem (missing key, unreachable endpoint, API
 * error) so callers can surface a clear, friendly message instead of crashing.
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
