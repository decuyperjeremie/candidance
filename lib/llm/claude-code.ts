import { spawn } from "node:child_process";
import {
  type CompleteParams,
  type LLMProvider,
  LLMProviderError,
} from "./types";

/**
 * Claude provider backed by the locally-installed `claude` CLI in headless
 * print mode (`claude -p --output-format json`). This uses the machine's
 * Claude Code login (e.g. a Claude Max subscription) instead of a paid
 * Anthropic API key — see RUNNING.md / FONDATIONS.md.
 *
 * Notes:
 * - Pure text-in/text-out: `--max-turns 1` disables the agent loop and the
 *   system prompt forbids tool use, so no files are read/written.
 * - The prompt is sent over stdin (safe for arbitrary content); the system
 *   prompt overrides Claude Code's default coding persona.
 * - We do NOT use `--bare` (that mode requires an API key and skips the
 *   subscription OAuth login we want to use).
 */
export class ClaudeCodeProvider implements LLMProvider {
  readonly name = "claude-code";

  constructor(
    private readonly opts: { cliPath: string; model: string },
  ) {}

  async complete(params: CompleteParams): Promise<string> {
    const prompt = params.messages
      .map((m) => (m.role === "assistant" ? `Assistant: ${m.content}` : m.content))
      .join("\n\n");

    const system = [
      params.system?.trim(),
      "Réponds UNIQUEMENT avec le texte demandé, sans préambule ni commentaire. N'utilise aucun outil.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const args = [
      "-p",
      "--output-format",
      "json",
      "--model",
      this.opts.model,
      "--max-turns",
      "1",
      "--system-prompt",
      system,
    ];

    let stdout = "";
    let stderr = "";

    const result = await new Promise<string>((resolve, reject) => {
      let child;
      try {
        child = spawn(this.opts.cliPath, args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (err) {
        reject(this.spawnError(err));
        return;
      }

      child.on("error", (err: NodeJS.ErrnoException) => {
        reject(this.spawnError(err));
      });
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));

      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new LLMProviderError(
              `claude CLI exited with code ${code}: ${stderr.trim() || stdout.trim() || "(no output)"}`,
            ),
          );
          return;
        }
        try {
          const json = JSON.parse(stdout);
          if (json.is_error || json.subtype !== "success") {
            reject(
              new LLMProviderError(
                `claude CLI returned an error (${json.subtype ?? "unknown"}): ${json.result ?? stderr.trim()}`,
              ),
            );
            return;
          }
          resolve(String(json.result ?? "").trim());
        } catch (err) {
          reject(
            new LLMProviderError(
              `Could not parse claude CLI JSON output: ${err instanceof Error ? err.message : String(err)}`,
              err,
            ),
          );
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });

    return result;
  }

  private spawnError(err: unknown): LLMProviderError {
    const e = err as NodeJS.ErrnoException;
    if (e?.code === "ENOENT") {
      return new LLMProviderError(
        `claude CLI not found at "${this.opts.cliPath}". Install Claude Code and log in ` +
          `(so this machine can use your subscription), or set CLAUDE_CLI_PATH, or switch ` +
          `LLM_PROVIDER to "ollama" / "claude".`,
        err,
      );
    }
    return new LLMProviderError(
      `Failed to launch claude CLI: ${e?.message ?? String(err)}`,
      err,
    );
  }
}
