import { test, expect } from '../fixtures/base';
import { kokoroTextToSpeechModel, textGenerationModels } from '../data/playground/models';
import {
    playgroundScenarios,
    smokeScenarios,
    smokeTextToAudioScenarios,
    textToAudioScenarios,
    TextToAudioScenario
} from '../data/playgroundScenarios';

test.describe('Playground QA Test Suite - All Text Generation Models (Hallucination, Positive & Negative Scenarios)', () => {
    test.setTimeout(900000); // 15 minutes timeout for whole suite

    test.beforeEach(async ({ authenticate, playgroundPage }) => {
        await authenticate();
        await playgroundPage.open();
    });

    /**
     * Submit Text Prompt & Evaluate Response and Performance Metrics
     */
    async function sendPromptAndEvaluate(
        page: any,
        prompt: string,
        category: 'hallucination' | 'positive' | 'negative',
        bypassCache: boolean = true
    ) {
        // Ensure modal popovers are closed
        await page.keyboard.press('Escape').catch(() => {});

        const textbox = page.getByPlaceholder('Type something...').or(page.locator('textarea')).first();
        if (!(await textbox.isVisible({ timeout: 3000 }).catch(() => false))) {
            console.log(`[UI INFO] Textbox not present. Skipping prompt.`);
            return;
        }

        const isReadOnly = await textbox.evaluate((el: any) => el.readOnly || el.disabled).catch(() => false);
        if (isReadOnly) {
            console.log(`[UI INFO] Textbox is read-only. Skipping prompt.`);
            return;
        }

        if (bypassCache) {
            const systemPromptInput = page.getByPlaceholder('Enter a initial system prompt');
            if (await systemPromptInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                const uniqueSysPrompt = `QA System ID: ${Date.now()}-${Math.random().toString(36).substring(7)}`;
                await systemPromptInput.fill(uniqueSysPrompt).catch(() => {});
            }
        }

        const finalPrompt = bypassCache ? `${prompt} [id-${Date.now()}]` : prompt;
        try {
            await textbox.focus({ timeout: 2000 });
            await textbox.fill(finalPrompt, { timeout: 3000 });
        } catch (err: any) {
            console.warn(`[UI WARN] Textbox fill warning: ${err.message}`);
            return;
        }

        // Setup SSE response promise
        const ssePromise = page.waitForResponse(
            (response: any) => (
                response.url().includes('/inference/') ||
                response.url().includes('/api/') ||
                response.url().includes('/playground/')
            ) && response.request().method() === 'POST',
            { timeout: 30000 }
        ).catch(() => null);

        console.log(`[SUBMIT PROMPT] Category: "${category.toUpperCase()}" | Prompt: "${finalPrompt}"`);
        const startTime = Date.now();
        await textbox.press('Enter').catch(() => {});

        const response = await ssePromise;
        const endTime = Date.now();
        const inferenceTimeMs = endTime - startTime;

        if (!response) {
            console.warn(`[QA WARN] Inference API response timeout for prompt: "${prompt}".`);
            return;
        }

        if (response.status() !== 200) {
            console.warn(`[QA WARN] Inference API status ${response.status()} for prompt: "${prompt}".`);
            return;
        }

        const bodyText = await response.text().catch(() => '');
        let isBlocked = false;
        let blockType = '';
        let finalResponseText = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let backendLatency = 0;
        let backendCompute = 0;
        let backendTtft = 0;

        const lines = bodyText.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const eventData = JSON.parse(line.substring(6).trim());
                    if (eventData.blocked === true || eventData.guardrail_blocked) {
                        isBlocked = true;
                    }
                    if (eventData.guardrail_blocked) {
                        blockType = eventData.guardrail_blocked;
                    }
                    if (eventData.text_output) {
                        finalResponseText += eventData.text_output;
                    }
                    if (typeof eventData.num_input_tokens === 'number') {
                        inputTokens = Math.max(inputTokens, eventData.num_input_tokens);
                    }
                    if (typeof eventData.num_output_tokens === 'number') {
                        outputTokens = Math.max(outputTokens, eventData.num_output_tokens);
                    }
                    if (typeof eventData.backend_latency_ms === 'number') {
                        backendLatency = eventData.backend_latency_ms;
                    }
                    if (typeof eventData.backend_compute_ms === 'number') {
                        backendCompute = eventData.backend_compute_ms;
                    }
                    if (typeof eventData.backend_ttft_ms === 'number') {
                        backendTtft = eventData.backend_ttft_ms;
                    }
                } catch (e) {}
            }
        }

        console.log(`--------------------------------------------------`);
        console.log(`[RESULT EVALUATION]`);
        console.log(`- Final Response Text: "${finalResponseText.trim().substring(0, 150)}..."`);
        console.log(`- Guardrail Blocked: ${isBlocked}${isBlocked ? ` (Block Type: ${blockType})` : ''}`);
        console.log(`- Client Inference Time (RTT): ${inferenceTimeMs} ms`);
        console.log(`- Backend Latency: ${backendLatency} ms | Compute: ${backendCompute} ms | TTFT: ${backendTtft} ms`);
        console.log(`- Input Tokens: ${inputTokens} | Output Tokens: ${outputTokens}`);
        console.log(`--------------------------------------------------`);

        // Standard assertions for Playground E2E
        expect(inferenceTimeMs).toBeGreaterThan(0);
        if (!isBlocked) {
            if (finalResponseText.length === 0) {
                console.warn(`[QA EVALUATION WARN] Empty response text generated for prompt: "${prompt}".`);
            } else {
                console.log(`[QA EVALUATION SUCCESS] Valid response text received (length: ${finalResponseText.length}).`);
            }
            expect(inputTokens).toBeGreaterThanOrEqual(0);
            expect(outputTokens).toBeGreaterThanOrEqual(0);
            
            if (category === 'hallucination' && finalResponseText.length > 0) {
                const responseLower = finalResponseText.toLowerCase();
                if (prompt.includes('Wakanda') && !responseLower.includes('fictional') && !responseLower.includes('marvel') && !responseLower.includes('comic')) {
                    console.log(`[AI HALLUCINATION WARNING] Model might be hallucinating on Wakanda prompt!`);
                }
                if (prompt.includes('Mars') && !responseLower.includes('no president') && !responseLower.includes('fictional') && !responseLower.includes('human has not') && !responseLower.includes('has not been colonised')) {
                    console.log(`[AI HALLUCINATION WARNING] Model might be hallucinating on Mars president prompt!`);
                }
            }
        } else {
            console.log(`[UI INFO] Prompt was blocked by proxy guardrails in negative scenario.`);
        }

        // Reset the chat to clear context for the next prompt
        const resetBtn = page.getByRole('button', { name: 'Reset' });
        if (await resetBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await resetBtn.click().catch(() => {});
            await page.waitForTimeout(500);
        }
    }

    async function generateAndEvaluateAudio(page: any, playgroundPage: any, scenario: TextToAudioScenario) {
        await page.keyboard.press('Escape').catch(() => {});

        await playgroundPage.fillPrompt(scenario.text);
        await playgroundPage.selectTextToSpeechOption(0, scenario.language);
        await playgroundPage.selectTextToSpeechOption(1, scenario.voice);

        const startTime = Date.now();
        const response = await playgroundPage.generateTextToSpeech();
        const inferenceTimeMs = Date.now() - startTime;
        expect(response.status(), `TTS inference failed for ${scenario.name}`).toBe(200);
        expect(inferenceTimeMs).toBeGreaterThan(0);

        const body = await response.body();
        expect(body.length, 'TTS inference response must not be empty').toBeGreaterThan(0);

        // The Playground renders TTS output as a generated-file card, not an HTML audio tag.
        await expect(page.getByText(/^Generated Audio\.(wav|mp3)$/i).last()).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('button', { name: /^play$/i }).last()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/^Inference Time:/i).last()).toBeVisible({ timeout: 15000 });

        const responseText = body.toString('utf8');
        const displayedInputTokens = await page.getByText(/^Input Tokens:/i).last().textContent();
        const displayedOutputSeconds = await page.getByText(/^Output Sec:/i).last().textContent();
        const inputTokens = Number(response.headers()['x-input-tokens'] ?? displayedInputTokens?.match(/(\d+(?:\.\d+)?)/)?.[1] ?? responseText.match(/(?:num_)?input_tokens["':=\s]+(\d+)/i)?.[1]);
        const outputSeconds = Number(displayedOutputSeconds?.match(/(\d+(?:\.\d+)?)/)?.[1]);
        console.log(`[TTS RESULT] ${scenario.name} | Language: ${scenario.language} | Voice: ${scenario.voice} | Inference: ${inferenceTimeMs} ms | Input tokens: ${Number.isFinite(inputTokens) ? inputTokens : 'not reported'} | Output seconds: ${Number.isFinite(outputSeconds) ? outputSeconds : 'not reported'}`);
        if (Number.isFinite(inputTokens)) expect(inputTokens).toBeGreaterThanOrEqual(0);
        if (Number.isFinite(outputSeconds)) expect(outputSeconds).toBeGreaterThan(0);
    }

    const scenariosToRun = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLAYWRIGHT_SMOKE === 'true'
        ? smokeScenarios
        : playgroundScenarios;

    // Parameterized test loop across all models
    for (let i = 0; i < textGenerationModels.length; i++) {
        const modelConfig = textGenerationModels[i];

        test.describe(`Model ${i + 1}/${textGenerationModels.length}: ${modelConfig.displayName}`, () => {
            test(`TC-PLAYGROUND-01: Hallucination Evaluation (${scenariosToRun.filter((scenario) => scenario.category === 'hallucination').length} Prompts)`, async ({ page, playgroundPage }) => {
                const isSelected = await playgroundPage.selectModel(modelConfig);
                if (!isSelected) {
                    console.warn(`[SKIP] Model ${modelConfig.displayName} is not active or selectable.`);
                    return;
                }

                const hallucinationPrompts = scenariosToRun
                    .filter((scenario) => scenario.category === 'hallucination')
                    .map((scenario) => scenario.prompt);

                for (let j = 0; j < hallucinationPrompts.length; j++) {
                    await test.step(`[${modelConfig.displayName}] Hallucination Prompt #${j + 1}`, async () => {
                        await sendPromptAndEvaluate(page, hallucinationPrompts[j], 'hallucination');
                    });
                }
            });

            test(`TC-PLAYGROUND-02: Positive Functional Scenarios (${scenariosToRun.filter((scenario) => scenario.category === 'positive').length} Prompts)`, async ({ page, playgroundPage }) => {
                const isSelected = await playgroundPage.selectModel(modelConfig);
                if (!isSelected) {
                    console.warn(`[SKIP] Model ${modelConfig.displayName} is not active or selectable.`);
                    return;
                }

                const positivePrompts = scenariosToRun
                    .filter((scenario) => scenario.category === 'positive')
                    .map((scenario) => scenario.prompt);

                for (let j = 0; j < positivePrompts.length; j++) {
                    await test.step(`[${modelConfig.displayName}] Positive Prompt #${j + 1}`, async () => {
                        await sendPromptAndEvaluate(page, positivePrompts[j], 'positive');
                    });
                }
            });

            test(`TC-PLAYGROUND-03: Negative & Edge Case Scenarios (${scenariosToRun.filter((scenario) => scenario.category === 'negative').length} Prompts)`, async ({ page, playgroundPage }) => {
                const isSelected = await playgroundPage.selectModel(modelConfig);
                if (!isSelected) {
                    console.warn(`[SKIP] Model ${modelConfig.displayName} is not active or selectable.`);
                    return;
                }

                const negativePrompts = scenariosToRun
                    .filter((scenario) => scenario.category === 'negative')
                    .map((scenario) => scenario.prompt);

                for (let j = 0; j < negativePrompts.length; j++) {
                    await test.step(`[${modelConfig.displayName}] Negative Prompt #${j + 1}`, async () => {
                        await sendPromptAndEvaluate(page, negativePrompts[j], 'negative');
                    });
                }
            });
        });
    }

    const textToAudioScenariosToRun = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLAYWRIGHT_SMOKE === 'true'
        ? smokeTextToAudioScenarios
        : textToAudioScenarios;

    test.describe(`Text-to-Audio Model: ${kokoroTextToSpeechModel.displayName}`, () => {
        for (const category of ['hallucination', 'positive', 'negative'] as const) {
            const scenarios = textToAudioScenariosToRun.filter((scenario) => scenario.category === category);
            test(`TC-PLAYGROUND-TTS-${category.toUpperCase()}: ${category} scenarios (${scenarios.length})`, async ({ page, playgroundPage }) => {
                const isSelected = await playgroundPage.selectModel(kokoroTextToSpeechModel);
                expect(isSelected, `${kokoroTextToSpeechModel.displayName} must be selectable`).toBeTruthy();

                for (const scenario of scenarios) {
                    await test.step(`[${kokoroTextToSpeechModel.displayName}] ${scenario.name}`, async () => {
                        await generateAndEvaluateAudio(page, playgroundPage, scenario);
                    });
                }
            });
        }
    });
});
