# AGENTS.md

## Project purpose
This repository contains Playwright-based end-to-end automation for an AI inference platform UI.

## Working principles
- Prefer resilient, locator-based assertions over brittle sleeps.
- Keep test data and credentials in shared configuration rather than hard-coding them in each spec.
- Reuse page object methods for UI interactions instead of duplicating logic in tests.
- Preserve readability and maintainability; prefer small helpers over large inline blocks.
- When changing selectors or flows, update the related page object and keep tests focused on behavior.

## Recommended workflow
1. Inspect the page object and related fixtures before editing a test.
2. Prefer the existing fixture-based setup in fixtures/base.ts.
3. Use shared utilities for credentials and test configuration.
4. Verify changes with Playwright tests relevant to the area changed.

## Notes for QA automation
- Keep tests deterministic by using explicit waits and clear assertions.
- For AI playground scenarios, make prompts unique to avoid cache reuse when possible.
- Log useful context for failures, but avoid noisy console output in the happy path.
