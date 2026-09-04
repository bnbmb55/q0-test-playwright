# Q0 AI Platform Automation Coverage Plan

**Seed:** `tests/seed.spec.ts`
**Primary project:** Chromium
**Purpose:** production-safe, evidence-based validation of the Playground and its AI controls.

## Release-gate smoke checks

1. Authenticate with a dedicated QA account and open Playground.
2. Select a supported text model by its exact catalogue identifier.
3. Submit one safe factual prompt and verify HTTP success, non-empty output, token telemetry, and visible model selection.
4. Submit one known blocked prompt and verify the structured guardrail decision rather than response latency or a refusal string.
5. Submit an exact repeated prompt in the same browser session and record the API cache decision, cached-token count, TTFT, total latency, token counts, and response text.

**Failure criteria:** unavailable configured model; uncorrelated/missing inference response; HTTP failure; missing expected telemetry; guardrail decision differs from policy; a backend cache miss after the cache warm-up request.

## Functional Playground coverage

### Text generation

For every deployed text model, cover a concise factual answer, code generation, translation, multi-turn context, streamed output, cancellation, Reset, model switch, and regeneration. Keep quality assertions deterministic (facts, required terms, JSON schema, or executable code) rather than relying on a generic response-length assertion.

### Other model capabilities

Maintain separate data-driven suites for text-to-speech, speech-to-text, OCR, vision-language, embeddings/reranking, and image generation as each capability becomes available. Validate the native output artifact and metadata: MIME type, file size, duration/dimensions, transcription/OCR text, and task-specific quality threshold.

## Guardrail coverage

Run `verification` on each deployment and `full` before release. Validate input blocking, output blocking, PII detection/redaction, prompt injection, encoded/obfuscated bypasses, multilingual prompts, false positives on benign text, policy-profile differences, streaming leaks, and cache interaction. The API must expose a structured policy decision with policy/rule identifier; UI refusal wording is supporting evidence only.

## Cache coverage

Keep one browser context and conversation/session per model/cache type. Validate Prompt, Semantic, Prefix, and KV cache separately. A cache pass requires an explicit `cache_hit`/cached-token metric or an agreed documented API contract; lower latency alone is diagnostic only. Record request and session identifiers, input/output/cached tokens, TTFT, compute/queue/total latency, throughput, cost, and expected semantic/context correctness.

## Reliability, security, and operations

1. Use dedicated non-production test accounts and secrets supplied only by CI variables.
2. Do not retry account creation, secret creation, training submission, or other billable/mutating tests.
3. Make Training submissions opt-in (`RUN_BILLABLE_TRAINING=true`) and clean up created datasets/jobs where the API permits it.
4. Split CI into fast smoke, Chromium regression, cross-browser UI-only checks, and scheduled model/guardrail/cache matrices.
5. Attach sanitized network evidence, API response metadata, trace, screenshot, and the selected model/version for each failed decision.
