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
                name: /Llama|GPT|Whisper|Kokoro|Surya|Paddle|Chandra|Stable|Gemma|DeepSeek|Sarvam|Qwen|Kimi|Moonlight/i
            }).first();
            await expect(trigger).toBeVisible({ timeout: 15000 });
            await trigger.click();

            const search = this.page.getByPlaceholder('Search model');
            await expect(search).toBeVisible({ timeout: 5000 });
            await search.fill(model.id);

            const exactModel = this.page.locator('[role="dialog"]').getByText(model.id, { exact: true }).first();
            const fallbackModel = this.page.locator('[role="dialog"]').getByText(new RegExp(searchKeyword, 'i')).first();
            if (await exactModel.isVisible({ timeout: 3000 }).catch(() => false)) {
                await exactModel.click();
            } else {
                await expect(fallbackModel).toBeVisible({ timeout: 10000 });
                await fallbackModel.click();
            }

            await expect(this.page.getByRole('button', { name: new RegExp(searchKeyword, 'i') }).first()).toBeVisible({ timeout: 10000 });
            return true;
        } catch (error: any) {
            console.warn(`[MODEL SELECT WARN] Could not select ${model.displayName}: ${error.message}`);
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
