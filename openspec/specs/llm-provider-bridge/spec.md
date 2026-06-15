# llm-provider-bridge Specification

## Purpose
TBD - created by archiving change bootstrap-foundations. Update Purpose after archive.
## Requirements
### Requirement: Provider-agnostic LLM interface

The system SHALL define a single `LLMProvider` interface that abstracts text completion/chat so that calling code does not depend on any specific vendor. The interface MUST at minimum support sending a prompt (system + user messages) and receiving a text completion.

#### Scenario: Calling code is vendor-agnostic

- **WHEN** application code performs an LLM completion through the bridge
- **THEN** it uses only the `LLMProvider` interface and contains no direct reference to a specific vendor SDK

### Requirement: Claude (Anthropic) provider implementation

The system SHALL provide an `LLMProvider` implementation backed by the Anthropic API, used as the default provider, configured via an `ANTHROPIC_API_KEY` environment variable and a configurable model id.

#### Scenario: Claude completion succeeds

- **WHEN** the provider is `claude`, a valid `ANTHROPIC_API_KEY` is set, and a completion is requested
- **THEN** the system returns the model's text response through the `LLMProvider` interface

#### Scenario: Missing Anthropic key

- **WHEN** the provider is `claude` and no `ANTHROPIC_API_KEY` is configured
- **THEN** the system fails fast with a clear, actionable error before attempting a network call

### Requirement: Claude Code CLI (subscription) provider implementation

The system SHALL provide an `LLMProvider` implementation backed by the locally-installed `claude` CLI in headless print mode (`claude -p --output-format json`), so completions can run against the machine's Claude Code / subscription login (e.g. Claude Max) instead of a paid API key. It MUST run as a single non-interactive turn with no tool/file access, configured via `CLAUDE_CLI_PATH` and `CLAUDE_CODE_MODEL`.

#### Scenario: CLI completion succeeds

- **WHEN** the provider is `claude-code`, the `claude` CLI is installed and logged in, and a completion is requested
- **THEN** the system returns the model's text response (the parsed `result`) through the same `LLMProvider` interface

#### Scenario: CLI missing or not logged in

- **WHEN** the provider is `claude-code` and the `claude` binary cannot be found or fails to authenticate
- **THEN** the system returns a clear, actionable error (how to install/log in, or switch provider) instead of crashing

### Requirement: Local Ollama provider implementation

The system SHALL provide an `LLMProvider` implementation backed by a local Ollama server, configured via `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.

#### Scenario: Ollama completion succeeds

- **WHEN** the provider is `ollama`, a reachable Ollama server and a pulled model are configured, and a completion is requested
- **THEN** the system returns the local model's text response through the same `LLMProvider` interface

#### Scenario: Ollama unreachable

- **WHEN** the provider is `ollama` and the configured server cannot be reached
- **THEN** the system returns a clear error indicating the endpoint is unreachable

### Requirement: Provider selection by configuration

The system SHALL select the active `LLMProvider` implementation from a single configuration value (`LLM_PROVIDER`, default `claude-code`) without requiring code changes to switch. Supported values: `claude-code`, `claude`, `ollama`.

#### Scenario: Switching provider via config

- **WHEN** `LLM_PROVIDER` is changed between `claude` and `ollama`
- **THEN** subsequent LLM calls are routed to the corresponding implementation with no code modification

#### Scenario: Unknown provider value

- **WHEN** `LLM_PROVIDER` is set to an unrecognised value
- **THEN** the system fails fast at startup/config-resolution with an error listing the supported providers

