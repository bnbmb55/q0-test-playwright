import { Page, Locator, expect } from '@playwright/test';

export class TrainingPage {
    readonly page: Page;

    // Navigation
    readonly myTrainingsMenu: Locator;
    readonly createTrainingBtn: Locator;
    readonly continueBtn: Locator;

    // Step 1: Basic Details
    readonly displayNameInput: Locator;
    readonly descriptionInput: Locator;

    // Step 2: Model Selection
    readonly modelCategoryDropdown: Locator;
    readonly modelTaskDropdown: Locator;
    readonly baseModelDropdown: Locator;

    // Step 3: Training Configuration
    readonly trainingTypeDropdown: Locator;

    // Step 4: Dataset Details
    readonly selectDatasetBtn: Locator;
    readonly createNewDatasetBtn: Locator;
    readonly datasetNameInput: Locator;
    readonly datasetDescInput: Locator;
    readonly gcpSourceBtn: Locator;
    readonly awsSourceBtn: Locator;
    readonly azureSourceBtn: Locator;
    readonly regionDropdown: Locator;
    readonly secretDropdown: Locator;
    readonly datasetPathInput: Locator;

    // Step 5: Evaluation
    readonly autoSplitBtn: Locator;

    // Step 6: Infrastructure
    readonly h100GpuBtn: Locator;

    // Step 7: Option Settings
    readonly awqBtn: Locator;
    readonly f16Btn: Locator;
    readonly createTrainingSubmitBtn: Locator;

    // Search and List
    readonly searchInput: Locator;
    readonly filterTypeAllBtn: Locator;

    constructor(page: Page) {
        this.page = page;

        this.myTrainingsMenu = page.getByRole('button', { name: /My Trainings/i });
        this.createTrainingBtn = page.getByRole('button', { name: 'Create Model Training' });
        this.continueBtn = page.getByRole('button', { name: 'Continue' });

        // Step 1
        this.displayNameInput = page.getByRole('textbox', { name: /Display Name/i });
        this.descriptionInput = page.getByRole('textbox', { name: /Description/i });

        // Step 2
        this.modelCategoryDropdown = page.getByRole('combobox').nth(0);
        this.modelTaskDropdown = page.getByRole('combobox').nth(1);
        this.baseModelDropdown = page.getByRole('combobox').nth(2);

        // Step 3
        this.trainingTypeDropdown = page.getByRole('combobox').nth(3);

        // Step 4
        this.selectDatasetBtn = page.getByRole('button', { name: 'Select dataset' });
        this.createNewDatasetBtn = page.getByRole('button', { name: 'Create New Datasets' });
        this.datasetNameInput = page.getByRole('textbox', { name: /Enter a display name/i });
        this.datasetDescInput = page.getByRole('textbox', { name: /Enter a description/i });
        this.gcpSourceBtn = page.getByRole('button', { name: 'GCP' });
        this.awsSourceBtn = page.getByRole('button', { name: 'AWS' });
        this.azureSourceBtn = page.getByRole('button', { name: 'Azure' });

        this.regionDropdown = page.getByRole('combobox').filter({ hasText: 'Select Region' });
        this.secretDropdown = page.getByRole('combobox').filter({ hasText: 'Select Secret' });
        this.datasetPathInput = page.getByRole('textbox', { name: /path/i }); // Will match gs://bucket/path, s3://..., etc.

        // Step 5
        this.autoSplitBtn = page.getByRole('button', { name: /Auto-split training data/i });

        // Step 6
        this.h100GpuBtn = page.getByRole('button', { name: /H100/i });

        // Step 7
        this.awqBtn = page.getByRole('button', { name: 'AWQ' });
        this.f16Btn = page.getByRole('button', { name: 'F16' });
        this.createTrainingSubmitBtn = page.getByRole('button', { name: 'Create Training' });

        // Search
        this.searchInput = page.getByRole('textbox', { name: /Search/i });
        this.filterTypeAllBtn = page.getByRole('button', { name: 'Type: All' });
    }

    async navigateToMyTrainings() {
        await this.myTrainingsMenu.click();
        await expect(this.createTrainingBtn).toBeVisible();
    }

    async clickCreateTraining() {
        await this.createTrainingBtn.click();
    }

    async fillBasicDetails(name: string, description: string) {
        await this.displayNameInput.fill(name);
        await this.page.getByRole('textbox', { name: 'Description' }).fill(description);
        await this.continueBtn.click();
    }

    async selectModel(category: string, task: string, model: string) {
        await this.modelCategoryDropdown.click();
        await this.page.getByText(category, { exact: true }).click();

        // Select Model Task
        await this.modelTaskDropdown.click();
        await this.page.getByRole('option', { name: new RegExp(task, 'i') }).click();

        // Wait for Base Model dropdown to become active and select
        await expect(this.baseModelDropdown).toBeEnabled({ timeout: 15000 });
        await this.baseModelDropdown.click();
        await this.page.getByRole('option', { name: new RegExp(model, 'i') }).click();

        await this.continueBtn.click();
    }

    async selectTrainingConfiguration(type: string, distributionType?: 'DDP' | 'DeepSpeed', modelName?: string) {
        // Handle Whisper special case where DDP/DeepSpeed are in the main dropdown
        // If type is 'Single GPU' or model is Whisper, it implies a combined UI
        let targetType = type;
        let isCombinedDropdown = false;
        
        if ((type === 'Single GPU' || modelName?.includes('Whisper')) && distributionType) {
            targetType = distributionType;
            isCombinedDropdown = true;
        }

        // Select Training Type (SFT/RLHF/DPO/Single GPU/etc.)
        await this.trainingTypeDropdown.click();
        
        // Selection part - using exact text or label for robustness
        const option = this.page.getByRole('option', { name: targetType }).or(this.page.getByText(targetType)).first();
        await option.click();

        // Optional: Select Distribution Type (DDP/DeepSpeed) - only if not already handled
        if (distributionType && !isCombinedDropdown) {
            // Wait for and click the Distribution Type combobox
            const distCombobox = this.page.getByRole('combobox').filter({ hasText: /Select Distribution Type/i });
            await distCombobox.click();

            if (distributionType === 'DDP') {
                await this.page.getByText('DDP (Distributed Data').click();
            } else if (distributionType === 'DeepSpeed') {
                // Handle potential DDP default
                const ddpSelected = this.page.getByRole('combobox').filter({ hasText: 'DDP (Distributed Data' });
                if (await ddpSelected.isVisible()) {
                    await ddpSelected.click();
                }
                await this.page.getByLabel('DeepSpeed').locator('div').filter({ hasText: 'DeepSpeed' }).click();
            }
        }

        await this.continueBtn.click();
    }

    async selectOrCreateDataset(params: {
        name: string,
        description: string,
        source: 'AWS' | 'GCP' | 'Azure',
        region: string,
        secret: string,
        path: string
    }) {
        await this.selectDatasetBtn.click();

        const existingDataset = this.page.getByText(params.name, { exact: true }).first();

        if (await existingDataset.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log(`Dataset "${params.name}" already exists. Selecting existing asset.`);
            await existingDataset.click();

            await this.continueBtn.click();
        } else {
            console.log(`Dataset "${params.name}" not found. Proceeding with creation flow.`);
            await this.createNewDatasetBtn.click();
            await this.datasetNameInput.fill(params.name);
            await this.datasetDescInput.fill(params.description);

            if (params.source === 'GCP') {
                await this.gcpSourceBtn.click();
                await this.regionDropdown.click();
                await this.page.getByRole('option', { name: new RegExp('^' + params.region + '$', 'i') }).click();
            } else if (params.source === 'Azure') {
                await this.azureSourceBtn.click();
            } else if (params.source === 'AWS') {
                await this.awsSourceBtn.click();
                await this.regionDropdown.click();
                await this.page.getByRole('option', { name: new RegExp('^' + params.region + '$', 'i') }).click();
            }

            // Select Secret
            await this.page.getByRole('combobox').filter({ hasText: /Select Secret/i }).or(this.page.getByRole('combobox')).last().click();
            await this.page.getByRole('option', { name: params.secret }).click();

            // Fill Path
            if (params.source === 'Azure') {
                await this.page.getByRole('textbox', { name: 'https://account.blob.core.' }).fill(params.path);
            } else {
                await this.datasetPathInput.fill(params.path);
            }

            // API Waiter for Dataset Save
            const responsePromise = this.page.waitForResponse(response =>
                response.url().includes('/api/dataset/save') && response.status() === 200
            );
            await this.continueBtn.click();
            await responsePromise;
        }
    }

    async configureEvaluation(autoSplit: boolean = true) {
        // First click label to expand/enable maybe? As per script: await page.locator('label').click();
        await this.page.locator('label').first().click({ force: true });
        if (autoSplit) {
            await this.autoSplitBtn.click();
        }
        await this.continueBtn.click();
    }

    async configureInfrastructure(gpuType: 'H100' | 'A100' = 'H100') {
        // Handle validation block, click continue to show validation
        await this.continueBtn.click();
        
        // Diagnostic check: Ensure the GPU selection prompt is visible
        const gpuPrompt = this.page.getByText('Please select an GPU type');
        try {
            await expect(gpuPrompt).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.error("GPU Selection prompt did not appear. Refreshing might be needed.");
        }

        if (gpuType === 'H100') {
            // Senior Engineer Healer: Check visibility before clicking to handle flake
            if (await this.h100GpuBtn.isVisible({ timeout: 5000 })) {
                await this.h100GpuBtn.click();
            } else {
                console.error("H100 GPU option is missing from UI.");
                throw new Error("RETRY_FLOW_GPU_MISSING");
            }
        } else {
            await this.h100GpuBtn.click(); // Defaulting as per current UI
        }
        await this.continueBtn.click();
    }

    async configureOptionsAndSubmit(quantization: 'AWQ' | 'F16' = 'AWQ') {
        if (quantization === 'AWQ') {
            await this.awqBtn.click({ force: true });
        } else {
            await this.f16Btn.click({ force: true });
        }

        const responsePromise = this.page.waitForResponse(response =>
            response.url().includes('/Infer/api/model-training/save') && (response.status() === 200 || response.status() === 201),
            { timeout: 60000 } // 60s timeout for heavy training creation tasks
        );

        await this.createTrainingSubmitBtn.click();

        // Wait for the response to resolve before moving to assertions
        await responsePromise;

        // Also wait for the URL to change to ensure we are on the details page
        // Using a more flexible pattern as the URL might contain '/model-training/' or '/training/'
        await this.page.waitForURL(/.*\/(model-)?training\/.*/, { timeout: 30000 });
    }

    async verifyTrainingCreation() {
        // Senior Engineer Tip: Use stable text-based locators instead of fragile CSS classes
        await expect(this.page.getByText(/Training Status/i)).toBeVisible({ timeout: 30000 });
    }

    async searchTraining(name: string) {
        // Handle potential delay in navigation back to list
        await this.page.getByText('Training', { exact: true }).first().click();
        await expect(this.searchInput).toBeVisible({ timeout: 10000 });
        await this.searchInput.click();
        await this.searchInput.fill(name);
        await this.page.keyboard.press('Enter');
    }

    async validateErrorMessage(message: string | RegExp) {
        await expect(this.page.getByText(message)).toBeVisible();
    }
}
