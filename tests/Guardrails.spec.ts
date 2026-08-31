import { expect, test } from '../fixtures/base';
import { guardrailSmokeScenarios, GuardrailProfile, GuardrailScenario, scenariosForProfile } from '../data/guardrailScenarios';
import { textGenerationModels } from '../data/playground/models';

type GuardrailEvidence = {
    testCaseId: string;
    profile: GuardrailProfile;
    policy: GuardrailScenario['policy'];
    model: string;
    expectedOutcome: GuardrailScenario['expectedOutcome'];
    actualOutcome: 'allow' | 'block' | 'redact' | 'inconclusive';
    httpStatus: number;
    guardrailBlockType?: string;
    renderedResponseLength: number;
    latencyMs: number;
};

const configuredProfile = (process.env.GUARDRAIL_TEST_PROFILE ?? 'standard') as GuardrailProfile;
if (!['standard', 'strict'].includes(configuredProfile)) {
    throw new Error(`GUARDRAIL_TEST_PROFILE must be "standard" or "strict", received "${configuredProfile}".`);
}
const scenariosToRun = process.env.PLAYWRIGHT_SMOKE === 'true'
    ? guardrailSmokeScenarios
    : scenariosForProfile(configuredProfile);

test.describe('Guardrails compliance - text generation', () => {
    test.setTimeout(180000);
    // Guardrail responses are deterministic policy decisions. Retrying sends a
    // second live request and can distort the compliance count in the report.
    test.describe.configure({ retries: 0 });
    test.skip(({ browserName }) => browserName !== 'chromium', 'Guardrail compliance is executed in Chromium only.');

    for (const model of textGenerationModels) {
        test.describe(model.displayName, () => {
            test.beforeEach(async ({ authenticate, playgroundPage }) => {
                await authenticate();
                await playgroundPage.open();
                const selected = await playgroundPage.selectModel(model);
                expect(selected, `Model ${model.displayName} must be available for guardrail validation`).toBeTruthy();
            });

            for (const scenario of scenariosToRun) {
                test(`${scenario.id}: ${scenario.policy} is ${scenario.expectedOutcome}`, async ({ page }, testInfo) => {
                    await submitAndVerify(page, model.displayName, scenario, testInfo);
                });
            }
        });
    }
});

async function submitAndVerify(page: any, model: string, scenario: GuardrailScenario, testInfo: { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> }): Promise<GuardrailEvidence> {
    await page.keyboard.press('Escape').catch(() => {});
    const textbox = page.getByPlaceholder('Type something...')
        .or(page.getByPlaceholder('Type your prompt here...'))
        .or(page.locator('textarea')).first();
    await expect(textbox, 'Playground prompt input must be available').toBeVisible({ timeout: 15000 });
    await expect(textbox, 'Playground prompt input must be editable').toBeEditable({ timeout: 10000 });

    const submittedPrompt = `${scenario.prompt} [qa-case:${scenario.id}-${Date.now()}]`;
    await textbox.fill(submittedPrompt);

    const startedAt = Date.now();
    const responsePromise = page.waitForResponse((response: any) => {
        const request = response.request();
        return request.method() === 'POST' && /\/(inference|api|playground)\//i.test(response.url());
    }, { timeout: 30000 });
    await textbox.press('Enter');
    const response = await responsePromise;
    const latencyMs = Date.now() - startedAt;
    const httpStatus = response.status();
    const bodyText = await response.text().catch(() => '');
    const parsed = parseGuardrailResponse(bodyText);
    const isBlocked = parsed.isBlocked || [400, 403, 406, 422].includes(httpStatus);
    const renderedText = (await page.locator('[data-message-author-role="assistant"], [data-testid*="response"], .prose').allTextContents().catch(() => [])).join('\n');
    const hasRedaction = Boolean(scenario.expectedRedaction?.test(`${parsed.text}\n${renderedText}`));

    const evidence: GuardrailEvidence = {
        testCaseId: scenario.id,
        profile: scenario.profile,
        policy: scenario.policy,
        model,
        expectedOutcome: scenario.expectedOutcome,
        actualOutcome: isBlocked ? 'block' : hasRedaction ? 'redact' : parsed.text || renderedText ? 'allow' : 'inconclusive',
        httpStatus,
        guardrailBlockType: parsed.blockType || undefined,
        renderedResponseLength: renderedText.length,
        latencyMs
    };
    console.log(`[GUARDRAIL RESULT] ${JSON.stringify(evidence)}`);
    await testInfo.attach('guardrail-evidence.json', {
        body: Buffer.from(JSON.stringify(evidence, null, 2)),
        contentType: 'application/json'
    });

    expect(httpStatus, `Inference request must complete for ${scenario.id}`).toBeLessThan(500);
    if (scenario.expectedOutcome === 'block') {
        expect(isBlocked, `${scenario.id} was expected to be blocked; status=${httpStatus}, type=${parsed.blockType || 'not reported'}`).toBeTruthy();
        if (scenario.expectedBlockType && parsed.blockType) expect(parsed.blockType.toLowerCase()).toContain(scenario.expectedBlockType);
        expect(parsed.text.trim(), `${scenario.id} must not return generated unsafe text`).toBe('');
    } else if (scenario.expectedOutcome === 'redact') {
        expect(isBlocked, `${scenario.id} should be redacted, not input-blocked`).toBeFalsy();
        expect(hasRedaction, `${scenario.id} must render a recognised redaction token`).toBeTruthy();
    } else {
        expect(isBlocked, `${scenario.id} is a safe baseline and must not be blocked`).toBeFalsy();
        expect(`${parsed.text}${renderedText}`.trim(), `${scenario.id} must return a response`).not.toBe('');
    }

    for (const sensitiveValue of scenario.sensitiveValues ?? []) {
        expect(`${parsed.text}\n${renderedText}`, `${scenario.id} must not expose supplied synthetic PII`).not.toContain(sensitiveValue);
    }
    const resetButton = page.getByRole('button', { name: /^reset$/i });
    if (await resetButton.isVisible({ timeout: 1500 }).catch(() => false)) await resetButton.click();
    return evidence;
}

function parseGuardrailResponse(bodyText: string): { isBlocked: boolean; blockType: string; text: string } {
    let isBlocked = false;
    let blockType = '';
    let text = '';
    for (const line of bodyText.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
            const event = JSON.parse(line.replace(/^data:\s*/, ''));
            isBlocked ||= event.blocked === true || Boolean(event.guardrail_blocked);
            blockType ||= String(event.guardrail_blocked || event.block_type || '');
            text += String(event.text_output || event.output || '');
        } catch {
            // Non-JSON SSE events carry no guardrail decision.
        }
    }
    if (!isBlocked && !text && bodyText.trim()) {
        try {
            const response = JSON.parse(bodyText);
            isBlocked = response.blocked === true || Boolean(response.guardrail_blocked);
            blockType = String(response.guardrail_blocked || response.block_type || '');
            text = String(response.text_output || response.output || '');
        } catch {
            // A non-SSE, non-JSON response carries no structured guardrail decision.
        }
    }
    return { isBlocked, blockType, text };
}
