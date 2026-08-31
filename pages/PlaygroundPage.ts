import { expect, Locator, Page, Response } from '@playwright/test';
import { PlaygroundModel } from '../data/playground/models';
import { AppConfig } from '../utils/config';

export class PlaygroundPage {
    readonly page: Page;
    readonly promptInput: Locator;
    readonly generateButton: Locator;
    readonly resetButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.promptInput = page.getByPlaceholder('Type something...')
            .or(page.getByPlaceholder('Type your prompt here...'))
            .or(page.locator('textarea'))
            .first();
        this.generateButton = page.getByRole('button', { name: /^generate$/i });
        this.resetButton = page.getByRole('button', { name: 'Reset' });
    }

    async open() {
        await this.page.goto(AppConfig.paths.playground);
        await expect(this.page.getByRole('heading', { name: 'Playground' })).toBeVisible({ timeout: 30000 });
    }

    async selectModel(model: PlaygroundModel): Promise<boolean> {
        const searchKeyword = model.id.split('/')[0].replace(/[-_]/g, ' ').split(' ')[0];
        try {
            const trigger = this.page.getByRole('button', {
                name: /Llama|GPT|Whisper|Kokoro|Surya|Paddle|Chandra|Stable|Gemma|DeepSeek|Sarvam|Qwen|QwQ|Kimi|Moonlight|Mistral|Mixtral/i
            }).first();
            await expect(trigger).toBeVisible({ timeout: 15000 });
            // The model selector can re-render while model metadata is loading.
            // Bound this UI action so a detached trigger fails diagnostically instead
            // of consuming the full model/guardrail scenario timeout.
            await trigger.click({ timeout: 15000 });

            const search = this.page.getByPlaceholder('Search model');
            await expect(search).toBeVisible({ timeout: 5000 });
            const dialog = this.page.locator('[role="dialog"]');
            let selected = false;
            for (const searchTerm of [...new Set([model.id, model.displayName])]) {
                await search.fill(searchTerm);
                const exactId = dialog.getByText(model.id, { exact: true }).first();
                const exactDisplayName = dialog.getByText(model.displayName, { exact: true }).first();
                if (await exactId.isVisible({ timeout: 2500 }).catch(() => false)) {
                    await exactId.click({ timeout: 10000 });
                    selected = true;
                    break;
                }
                if (await exactDisplayName.isVisible({ timeout: 2500 }).catch(() => false)) {
                    await exactDisplayName.click({ timeout: 10000 });
                    selected = true;
                    break;
                }
            }
            if (!selected) {
                // A provider keyword fallback can select the wrong Llama/Qwen
                // variant and falsely attribute its result to the requested model.
                throw new Error(`Exact Playground model was not found: ${model.id} (${model.displayName})`);
            }

            const selectedModel = this.page.getByRole('button', { name: new RegExp(`${escapeRegExp(model.id)}|${escapeRegExp(model.displayName)}`, 'i') }).first();
            await expect(selectedModel).toBeVisible({ timeout: 10000 });
            return true;
        } catch (error: any) {
            const dialog = this.page.locator('[role="dialog"]');
            const search = this.page.getByPlaceholder('Search model');
            // Keep selection exact, but include related live catalogue entries in the
            // failure diagnostic. This exposes a renamed/deployed model safely rather
            // than falling back to a different model from the same provider.
            const relatedEntries = await (async () => {
                if (!await search.isVisible({ timeout: 1000 }).catch(() => false)) return 'model search unavailable';
                await search.fill(searchKeyword).catch(() => {});
                return dialog.innerText().catch(() => 'model dialog unavailable');
            })();
            console.warn(`[MODEL SELECT WARN] Could not select ${model.displayName}: ${error.message}. Related entries for "${searchKeyword}": ${relatedEntries}`);
            await this.page.keyboard.press('Escape').catch(() => {});
            return false;
        }
    }

    async fillPrompt(prompt: string) {
        await expect(this.promptInput).toBeVisible({ timeout: 10000 });
        await expect(this.promptInput).toBeEditable();
        await this.promptInput.fill(prompt);
    }

    async selectTextToSpeechOption(controlIndex: 0 | 1, value: string) {
        const control = this.page.getByRole('combobox').nth(controlIndex);
        await expect(control).toBeVisible({ timeout: 10000 });
        await control.click();
        await this.page.getByRole('option', { name: value, exact: true }).click();
    }

    async generateTextToSpeech(): Promise<Response> {
        await expect(this.generateButton).toBeEnabled({ timeout: 10000 });
        const [response] = await Promise.all([
            this.page.waitForResponse(candidate => candidate.request().method() === 'POST' &&
                (candidate.url().includes('/inference/') || candidate.url().includes('/api/') || candidate.url().includes('/playground/')),
            { timeout: 30000 }),
            this.generateButton.click()
        ]);
        return response;
    }

    async reset() {
        if (await this.resetButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            await this.resetButton.click();
        }
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
