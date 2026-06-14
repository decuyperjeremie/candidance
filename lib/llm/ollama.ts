import {
  type CompleteParams,
  type LLMProvider,
  LLMProviderError,
} from "./types";

/**
 * Local Ollama provider, talking to the HTTP `/api/chat` endpoint.
 * No vendor SDK — plain fetch. An unreachable server yields a clear error.
 */
export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";

  constructor(
    private readonly opts: { baseUrl: string; model: string },
  ) {}

  async complete(params: CompleteParams): Promise<string> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/api/chat`;
    const messages = [
      ...(params.system ? [{ role: "system", content: params.system }] : []),
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.opts.model,
          messages,
          stream: false,
          options: {
            temperature: params.temperature,
            num_predict: params.maxTokens,
          },
        }),
      });
    } catch (err) {
      throw new LLMProviderError(
        `Ollama server unreachable at ${this.opts.baseUrl}. Is it running ` +
          `(\`ollama serve\`) and is the model pulled (\`ollama pull ` +
          `${this.opts.model}\`)?`,
        err,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LLMProviderError(
        `Ollama returned HTTP ${res.status} for model "${this.opts.model}". ${body}`.trim(),
      );
    }

    try {
      const data = (await res.json()) as {
        message?: { content?: string };
      };
      return (data.message?.content ?? "").trim();
    } catch (err) {
      throw new LLMProviderError("Failed to parse Ollama response.", err);
    }
  }
}
