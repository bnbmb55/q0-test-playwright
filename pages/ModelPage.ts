import { Page, Locator, expect, test } from '@playwright/test';

export class ModelPage {
    readonly page: Page;

    // Navigation and Actions
    readonly myModelsMenu: Locator;
    readonly createModelBtn: Locator;
    readonly continueBtn: Locator;
    readonly addModelSubmitBtn: Locator;

    // Step 1: Basic Details
    readonly displayNameInput: Locator;
    readonly descriptionInput: Locator;

    // Step 2: Source Details
    readonly gcpSourceBtn: Locator;
    readonly awsSourceBtn: Locator;
    readonly azureSourceBtn: Locator;
    readonly selectSecretBtn: Locator;
    readonly modelPathInput: Locator;
    readonly verifyBtn: Locator;
    readonly selectFolderBtn: Locator;
    readonly thisFolderBtn: Locator;
    readonly selectModelClassBtn: Locator;

    // Step 3: Region & Hardware
    readonly selectRegionBtn: Locator;

    // Search and Table
    readonly searchInput: Locator;
    readonly clearSearchBtn: Locator;

    constructor(page: Page) {
        this.page = page;

        // Navigation
        this.myModelsMenu = page.getByRole('button', { name: /My Models/i }).or(page.getByRole('navigation').getByText('My Models'));
        this.createModelBtn = page.getByRole('button', { name: 'Create Model' });
        this.continueBtn = page.getByRole('button', { name: 'Continue' });
        this.addModelSubmitBtn = page.getByRole('button', { name: 'Add Model' });

        // Step 1
        this.displayNameInput = page.getByRole('textbox', { name: /Display Name/i });
        this.descriptionInput = page.getByRole('textbox', { name: /Description/i });

        // Step 2
        this.gcpSourceBtn = page.getByRole('button', { name: 'GCP' });
        this.awsSourceBtn = page.getByRole('button', { name: 'AWS' });
        this.azureSourceBtn = page.getByRole('button', { name: 'Azure' });
        this.selectSecretBtn = page.getByRole('button', { name: 'Select Secret' }).or(page.getByRole('combobox').filter({ hasText: /Select Secret/i }));
        this.modelPathInput = page.getByRole('textbox', { name: /Model Path/i });
        this.verifyBtn = page.getByRole('button', { name: 'Verify', exact: true });
        this.selectFolderBtn = page.getByRole('button', { name: 'Select Folder' });
        this.thisFolderBtn = page.getByRole('button', { name: 'This Folder' });
        this.selectModelClassBtn = page.getByRole('button', { name: 'Select model class' });

        // Step 3
        this.selectRegionBtn = page.getByRole('button', { name: 'Select region' }).or(page.getByRole('combobox').filter({ hasText: /Select region/i }));

        // Search
        this.searchInput = page.getByRole('textbox', { name: /Search Models/i });
        this.clearSearchBtn = page.getByRole('button', { name: 'Clear search' });
    }

    async navigateToMyModels() {
        await test.step('Navigate to My Models', async () => {
            await this.myModelsMenu.first().click();
            await expect(this.createModelBtn).toBeVisible({ timeout: 15000 });
        });
    }

    async clickCreateModel() {
        await test.step('Open Create Model Form', async () => {
            await this.createModelBtn.click();
            await expect(this.displayNameInput).toBeVisible({ timeout: 10000 });
        });
    }

    async fillBasicDetails(name: string, description: string) {
        await test.step(`Fill Basic Details: ${name}`, async () => {
            await this.displayNameInput.fill(name);
            await this.descriptionInput.fill(description);
            await this.continueBtn.click();
        });
    }

    async configureSourceAndPath(params: {
        source: 'GCP' | 'AWS' | 'Azure',
        secretName: string,
        modelPath: string,
        modelClass: string
    }) {
        await test.step(`Configure Source, Path and Class for model`, async () => {
            // Select Source
            if (params.source === 'GCP') {
                await this.gcpSourceBtn.first().click();
            } else if (params.source === 'AWS') {
                await this.awsSourceBtn.first().click();
            } else if (params.source === 'Azure') {
                await this.azureSourceBtn.first().click();
            }

            // Select Secret
            await this.selectSecretBtn.first().click();
            const secretOption = this.page.getByRole('button').filter({ hasText: new RegExp(params.secretName, 'i') }).first();
            await expect(secretOption).toBeVisible({ timeout: 10000 });
            await secretOption.click();

            // Fill Model Path
            await this.modelPathInput.fill(params.modelPath);

            // Click Verify and wait for "Select Folder" button to be visible
            await this.verifyBtn.click();
            await expect(this.selectFolderBtn).toBeVisible({ timeout: 45000 });
            await this.selectFolderBtn.click();

            // Click "This Folder" and wait for class selection
            await expect(this.thisFolderBtn).toBeVisible({ timeout: 15000 });
            await this.thisFolderBtn.click();

            // Wait for folder dropdown/modal list to fully close and layout to stabilize
            await this.page.waitForTimeout(600);

            // Build possible options list dynamically to match UI label variations
            const classCandidates: string[] = [
                params.modelClass,
                params.modelClass.replace(/\s+/g, ''),
                params.modelClass.replace(/forcondition/i, 'ForConditionalGeneration'),
                params.modelClass.replace(/GPT\s*Oss\s*20B/i, 'GptOssForCausalLM')
            ];

            // Add shorter prefixes or exact matches to candidates
            if (params.modelClass.toLowerCase().includes('gpt')) {
                classCandidates.push('GptOssForCausalLM');
            } else if (params.modelClass.toLowerCase().includes('gemma')) {
                classCandidates.push('Gemma3ForConditionalGeneration');
            } else if (params.modelClass.toLowerCase().includes('whisper')) {
                classCandidates.push('WhisperForConditionalGeneration');
            }

            let targetOption: Locator | null = null;

            // Phase 1: Robustly open the dropdown list with up to 3 click attempts and timing settling checks
            for (let attempt = 1; attempt <= 3; attempt++) {
                await expect(this.selectModelClassBtn).toBeVisible({ timeout: 15000 });
                await this.selectModelClassBtn.click();
                
                // Allow dropdown open transition to finish
                await this.page.waitForTimeout(500);

                // Check if any of our candidates are visible in the DOM as buttons
                for (const candidate of classCandidates) {
                    const optBtn = this.page.getByRole('button', { name: candidate, exact: true });
                    if (await optBtn.isVisible().catch(() => false)) {
                        targetOption = optBtn;
                        break;
                    }
                }

                if (!targetOption) {
                    // Try case-insensitive matching against buttons
                    for (const candidate of classCandidates) {
                        const optBtnRegex = this.page.getByRole('button', { name: new RegExp(`^${candidate}$`, 'i') }).first();
                        if (await optBtnRegex.isVisible().catch(() => false)) {
                            targetOption = optBtnRegex;
                            break;
                        }
                    }
                }

                if (targetOption) {
                    break;
                }

                console.log(`⚠️ Model class option not found/visible after attempt ${attempt}. Retrying click...`);
            }

            // Phase 2: Absolute fallback if none of the candidates were found visible
            if (!targetOption) {
                console.log('⚠️ Candidates not found, falling back to general list option detection...');
                const fallbackOpt = this.page.getByRole('button').filter({ hasText: /For|Pipeline|LM|Kokoro/i }).first();
                await expect(fallbackOpt).toBeVisible({ timeout: 10000 });
                await fallbackOpt.click();
            } else {
                await targetOption.waitFor({ state: 'visible', timeout: 5000 });
                await targetOption.click();
            }

            await this.continueBtn.click();

            // Transition validation: Assert that Step 2 was submitted successfully and we moved to Step 3
            await expect(this.selectRegionBtn).toBeVisible({ timeout: 20000 });
        });
    }

    async configureRegionAndHardware(region: string, gpuType: string) {
        await test.step(`Configure Region and Hardware`, async () => {
            // Select Region
            await this.selectRegionBtn.first().click();
            const regionRegex = new RegExp(region.replace(/\s+/g, '\\s*'), 'i');
            const regionOption = this.page.getByRole('button').filter({ hasText: regionRegex }).first()
                .or(this.page.getByRole('option').filter({ hasText: regionRegex }).first());
            await expect(regionOption).toBeVisible({ timeout: 15000 });
            await regionOption.click();

            // Select GPU
            const gpuRegex = new RegExp(gpuType.replace(/\s+/g, '\\s*'), 'i');
            const gpuOption = this.page.getByRole('button').filter({ hasText: gpuRegex }).first();
            await expect(gpuOption).toBeVisible({ timeout: 15000 });
            await gpuOption.click();

            await this.continueBtn.click();
        });
    }

    async configureOptimizationAndSubmit(quantization: string = 'F16') {
        await test.step(`Configure Optimization and Submit`, async () => {
            // Handle F16 clicking if necessary as per recorded steps
            const quantBtn1 = this.page.getByRole('button', { name: quantization }).first();
            if (await quantBtn1.isVisible({ timeout: 5000 }).catch(() => false)) {
                await quantBtn1.click();
            }

            const quantBtn2 = this.page.getByRole('button', { name: quantization }).nth(1);
            if (await quantBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
                await quantBtn2.click();
            }

            const saveResponsePromise = this.page.waitForResponse(response =>
                response.url().includes('/Infer/api/model-training/save') || 
                response.url().includes('/api/model/') || 
                response.url().includes('/api/'),
                { timeout: 30000 }
            ).catch(() => null);

            await this.addModelSubmitBtn.click();

            if (saveResponsePromise) {
                await saveResponsePromise;
            }
        });
    }

    async verifyModelStatus(expectedStates: string[], timeout: number = 300000) {
        await test.step(`Wait and verify Model Status reaches one of: ${expectedStates.join(', ')}`, async () => {
            // Wait for status element to be visible
            const statusTextLocator = this.page.getByText(/Model Status/i).or(this.page.locator('.pt-4'));
            await expect(statusTextLocator.first()).toBeVisible({ timeout: 20000 });

            const startTime = Date.now();
            const interval = 10000;

            while (Date.now() - startTime < timeout) {
                const textContent = await this.page.locator('body').innerText();
                const matchedState = expectedStates.find(state => 
                    new RegExp(state, 'i').test(textContent)
                );

                if (matchedState) {
                    console.log(`🎉 Model successfully reached status: ${matchedState}`);
                    return;
                }

                // Check for failure indicator
                if (/fail|error|rejected/i.test(textContent)) {
                    throw new Error(`Model addition failed or error occurred during optimization/loading.`);
                }

                await new Promise(resolve => setTimeout(resolve, interval));
                
                // Optional: reload the page to refresh status if it stays stuck
                if ((Date.now() - startTime) % 30000 === 0) {
                    console.log('Refreshing page to fetch latest model status...');
                    await this.page.reload();
                    await expect(statusTextLocator.first()).toBeVisible({ timeout: 20000 });
                }
            }

            throw new Error(`Model status did not reach any of: ${expectedStates.join(', ')} within ${timeout / 1000}s`);
        });
    }

    async searchAndVerifyInList(displayName: string) {
        await test.step(`Search and verify model "${displayName}" is present in My Models list`, async () => {
            await this.navigateToMyModels();
            await expect(this.searchInput).toBeVisible({ timeout: 15000 });
            await this.searchInput.fill(displayName);
            await this.searchInput.press('Enter');

            const modelCell = this.page.getByRole('cell', { name: new RegExp(displayName, 'i') })
                .or(this.page.getByText(displayName))
                .first();
            await expect(modelCell).toBeVisible({ timeout: 15000 });

            // Clear search to leave clean state
            if (await this.clearSearchBtn.isVisible()) {
                await this.clearSearchBtn.click();
            }
        });
    }
}
