import { Page, Locator, expect, test } from '@playwright/test';

export class TrainingPage {
    readonly page: Page;

    // Navigation
    readonly myTrainingsMenu: Locator;
    readonly createTrainingBtn: Locator;
    readonly startTrainingBtn: Locator;
    readonly continueBtn: Locator;
    readonly secretsMenu: Locator;
    readonly createNewSecretBtn: Locator;
    readonly secretDisplayNameInput: Locator;
    readonly createSecretBtn: Locator;

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
        this.startTrainingBtn = page.getByRole('button', { name: 'Start Training' });
        this.continueBtn = page.getByRole('button', { name: 'Continue' });

        // Secrets Management
        this.secretsMenu = page.getByRole('button', { name: 'Secrets Secrets' });
        this.createNewSecretBtn = page.getByRole('button', { name: 'Create New Secret' });
        this.secretDisplayNameInput = page.getByRole('textbox', { name: 'Enter a display name for your' });
        this.createSecretBtn = page.getByRole('button', { name: 'Create Secret' });

        // Step 1
        this.displayNameInput = page.getByRole('textbox', { name: /Display Name/i });
        this.descriptionInput = page.getByRole('textbox', { name: /Description/i });

        // Step 2
        this.modelCategoryDropdown = page.getByRole('combobox').nth(0);
        this.modelTaskDropdown = page.getByRole('combobox').nth(1);
        this.baseModelDropdown = page.getByRole('combobox').nth(2);

        // Step 3
        // In Step 3, Step 2 comboboxes are replaced by text, so Training Type is the first combobox.
        this.trainingTypeDropdown = page.getByRole('combobox').first();

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
        await test.step('Navigate to My Trainings', async () => {
            await this.myTrainingsMenu.click();
            // Senior Engineer Tip: Handle both 'Create Model Training' and 'Start Training' for new users
            await expect(this.createTrainingBtn.or(this.startTrainingBtn)).toBeVisible({ timeout: 15000 });
        });
    }

    async clickCreateTraining() {
        await test.step('Open Training Form', async () => {
            // Playwright .or() waits for either element to become visible, preventing race conditions
            const btn = this.startTrainingBtn.or(this.createTrainingBtn);
            await btn.waitFor({ state: 'visible', timeout: 10000 });
            await btn.click();
        });
    }



    async fillBasicDetails(name: string, description: string) {
        await test.step(`Fill Basic Details: ${name}`, async () => {
            await this.displayNameInput.fill(name);
            await this.descriptionInput.fill(description);
            await this.continueBtn.click();
        });
    }

    async selectModel(category: string, task: string, model: string) {
        await test.step(`Select Model: ${model}`, async () => {
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
        });
    }

    async selectTrainingConfiguration(type: string, distributionType?: 'DDP' | 'DeepSpeed', modelName?: string) {
        await test.step(`Configure Training Type: ${type}`, async () => {
            // Handle Whisper special case where DDP/DeepSpeed are in the main dropdown
            // If type is 'Single GPU' or model is Whisper, it implies a combined UI
            let targetType = type;
            let isCombinedDropdown = false;

            if ((type === 'Single GPU' || modelName?.includes('Whisper')) && distributionType) {
                targetType = distributionType;
                isCombinedDropdown = true;
            }

            // Wait for Step 3 to load properly
            await expect(this.page.getByRole('heading', { name: /Train configuration/i })).toBeVisible({ timeout: 10000 });

            // Select Training Type (SFT/RLHF/DPO/Single GPU/etc.)
            await this.trainingTypeDropdown.click();

            // Selection part - using regex for robustness
            const escaped = targetType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const targetRegex = new RegExp(escaped, 'i');
            const option = this.page.getByRole('option', { name: targetRegex })
                .or(this.page.getByRole('listbox').getByText(targetRegex))
                .first();
            await option.waitFor({ state: 'visible', timeout: 10000 });
            await option.click();

            // Optional: Select Distribution Type (DDP/DeepSpeed) - only if not already handled
            if (distributionType && !isCombinedDropdown) {
                // Wait for and click the Distribution Type combobox
                const distCombobox = this.page.getByRole('combobox').filter({ hasText: /Distribution/i });
                await distCombobox.waitFor({ state: 'visible', timeout: 15000 });
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
        });
    }

    async selectOrCreateDataset(params: {
        name: string,
        description: string,
        source: 'AWS' | 'GCP' | 'Azure',
        region: string,
        secret: string,
        path: string,
        secretConfig?: string
    }): Promise<boolean> {
        let requiresRestart = false;
        await test.step(`Select or Create Dataset: ${params.name}`, async () => {
            await this.selectDatasetBtn.click();

            const existingDataset = this.page.getByText(params.name, { exact: true }).first();

            if (await existingDataset.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`Dataset "${params.name}" already exists. Selecting existing asset.`);
                await existingDataset.click();
                await this.continueBtn.click();
                return;
            } else {
                console.log(`Dataset "${params.name}" not found. Proceeding with creation flow.`);
                await this.createNewDatasetBtn.click();
                await this.datasetNameInput.fill(params.name);
                await this.datasetDescInput.fill(params.description);

                // Select Source
                if (params.source === 'GCP') {
                    await this.gcpSourceBtn.click();
                } else if (params.source === 'Azure') {
                    await this.azureSourceBtn.click();
                } else if (params.source === 'AWS') {
                    await this.awsSourceBtn.click();
                }

                // Dynamic Secret Verification from Training Form Secret Listing
                await this.secretDropdown.click();
                const secretOption = this.page.getByRole('option', { name: new RegExp(params.secret, 'i') }).first();

                if (await secretOption.isVisible({ timeout: 5000 }).catch(() => false)) {
                    console.log(`Secret "${params.secret}" found in training form secret listing. Using existing secret.`);
                    await secretOption.click();
                } else {
                    console.log(`Secret "${params.secret}" not found in listing! Redirecting to secrets from sidebar...`);

                    await this.page.keyboard.press('Escape');
                    await this.page.getByRole('button', { name: 'Back' }).click();
                    await this.secretsMenu.click();

                    const createBtn = this.createNewSecretBtn.or(this.createSecretBtn);
                    await createBtn.first().waitFor({ state: 'visible', timeout: 15000 });
                    await createBtn.first().click();

                    await this.secretDisplayNameInput.fill(params.secret);
                    await this.continueBtn.click();

                    // Select Source for Secret (Ensuring form state handles dynamic UI)
                    await this.page.getByRole('button', { name: 'AWS' }).click().catch(() => { });
                    if (params.source === 'GCP') {
                        await this.gcpSourceBtn.click();
                    } else if (params.source === 'Azure') {
                        await this.azureSourceBtn.click();
                    } else if (params.source === 'AWS') {
                        await this.awsSourceBtn.click();
                    }

                    const editorFocus = this.page.locator('div').filter({ hasText: /^\{$/ }).first();
                    await editorFocus.click();

                    const editor = this.page.getByRole('textbox', { name: 'Editor content' });
                    await editor.press('ControlOrMeta+a');
                    await editor.press('Backspace');

                    const defaultSecretObj = {
                        service_account_json: JSON.stringify({
                            type: "",
                            project_id: "",
                            private_key_id: "",
                            private_key: "",
                            client_id: "",
                            auth_uri: "",
                            token_uri: "",
                            auth_provider_x509_cert_url: "",
                            client_x509_cert_url: "",
                            universe_domain: ""
                        })

                    };
                    await this.page.keyboard.insertText(params.secretConfig || JSON.stringify(defaultSecretObj, null, 2));

                    await this.createSecretBtn.click();
                    await this.createSecretBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

                    requiresRestart = true;
                    return;
                }

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
        });
        return requiresRestart;
    }

    async configureEvaluation(autoSplit: boolean = true) {
        await test.step('Configure Evaluation', async () => {
            // First click label to expand/enable maybe? As per script: await page.locator('label').click();
            await this.page.locator('label').first().click();
            if (autoSplit) {
                await this.autoSplitBtn.click();
            }
            await this.continueBtn.click();
        });
    }

    async configureInfrastructure(gpuType: 'H100' | 'A100' = 'H100') {
        await test.step(`Configure Infrastructure: ${gpuType}`, async () => {
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
                // Senior Engineer Healer: Use auto-retrying expect instead of throwing custom errors
                await expect(this.h100GpuBtn).toBeVisible({
                    timeout: 15000,
                    message: 'H100 GPU option did not load from API in time.'
                });
                await this.h100GpuBtn.click();
            } else {
                await this.h100GpuBtn.click(); // Defaulting as per current UI
            }
            await this.continueBtn.click();
        });
    }

    async configureOptionsAndSubmit(quantization: 'AWQ' | 'F16' = 'AWQ') {
        await test.step(`Configure Options and Submit: ${quantization}`, async () => {
            const combobox = this.page.locator('div').filter({ hasText: /^Quantisation \*/ }).getByRole('combobox')
                .or(this.page.getByRole('combobox'))
                .first();
            await combobox.click();
            
            const option = this.page.getByRole('option', { name: quantization, exact: true })
                .or(this.page.getByRole('option', { name: new RegExp(`^${quantization}$`, 'i') }))
                .or(this.page.getByText(quantization, { exact: true }))
                .first();
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click({ force: true });

            const responsePromise = this.page.waitForResponse(response =>
                response.url().includes('/Infer/api/model-training/save') && (response.status() === 200 || response.status() === 201),
                { timeout: 60000 } // 60s timeout for heavy training creation tasks
            );

            await this.createTrainingSubmitBtn.click();

            // Wait for the response to resolve before moving to assertions
            await responsePromise;

            // Also wait for the URL to change to ensure we are on the details page
            await this.page.waitForURL(/.*\/(model-)?training\/.*/, { timeout: 30000 });
        });
    }

    async verifyTrainingCreation() {
        await test.step('Verify Training Creation Success', async () => {
            // Senior Engineer Tip: Use stable text-based locators instead of fragile CSS classes
            await expect(this.page.getByText(/Training Status/i)).toBeVisible({ timeout: 30000 });
        });
    }

    async verifyTrainingStatus(expectedState: 'Completed' | 'Failed', timeout: number = 300000) {
        await test.step(`[Auto-Healer] Wait and Verify Training Status reaches: ${expectedState}`, async () => {
            const statusCard = this.page.locator('h3:has-text("Training Status")').locator('xpath=..');
            const generalDetailsContainer = this.page.locator('div', { has: this.page.locator('h3', { hasText: 'General Details' }) }).first();
            const statusLabel = generalDetailsContainer.locator('span').filter({ hasText: /^Status$/ }).first();
            const generalStatusBadge = statusLabel.locator('xpath=..').locator('span').last();

            const startTime = Date.now();
            const interval = 15000;

            while (Date.now() - startTime < timeout) {
                let currentGeneralStatus = '';
                if (await generalStatusBadge.isVisible()) {
                    currentGeneralStatus = (await generalStatusBadge.innerText()).trim().toUpperCase();
                }

                const statusRow = statusCard.locator('div.flex.justify-between').first();
                const nameRow = statusCard.locator('div.flex.justify-between').last();
                
                let count = 0;
                try {
                    const nameDivs = nameRow.locator('div.flex-1');
                    count = await nameDivs.count();
                    
                    let lastStepStatus = '';
                    let hasFailedStep = false;
                    
                    for (let i = 0; i < count; i++) {
                        const name = (await nameDivs.nth(i).innerText()).trim();
                        const status = (await statusRow.locator('div.flex-1').nth(i).innerText()).trim().toUpperCase();
                        
                        if (name === 'Completed') {
                            lastStepStatus = status;
                        }
                        if (status === 'FAILED') {
                            hasFailedStep = true;
                        }
                    }

                    // Check for failure state
                    if (hasFailedStep || currentGeneralStatus === 'FAILED' || currentGeneralStatus === 'FAIL') {
                        if (expectedState === 'Failed') {
                            return; // Reached expected Failed state successfully
                        }
                        throw new Error(`Training failed on UI stepper or status badge. Stepper failed: ${hasFailedStep}, Status: ${currentGeneralStatus}`);
                    }

                    // Check for completed state
                    if ((lastStepStatus === 'COMPLETE' || lastStepStatus === 'COMPLETED') && currentGeneralStatus === 'COMPLETED') {
                        if (expectedState === 'Completed') {
                            return; // Reached expected Completed state successfully
                        }
                    }
                } catch (e: any) {
                    if (e.message && e.message.includes('Training failed')) {
                        throw e; // Propagate the explicit fail-fast failure
                    }
                    // Ignore elements rendering/missing exceptions during loading transitions
                }

                await new Promise(resolve => setTimeout(resolve, interval));
            }

            throw new Error(`Training did not reach expected state: ${expectedState} within ${timeout / 1000} seconds.`);
        });
    }

    async verifyTrainingStatusInList(trainingName: string, expectedStatus: string, timeout: number = 60000) {
        await test.step(`Verify status of ${trainingName} in list is ${expectedStatus}`, async () => {
            const row = this.page.getByRole('row', { name: new RegExp(trainingName, 'i') });
            const statusCell = row.getByText(new RegExp(expectedStatus, 'i'));
            
            // Use expect.poll to handle potential refresh of the list if it stays "In Progress"
            await expect.poll(async () => {
                if (await statusCell.isVisible()) {
                    return true;
                }
                
                // If it is not showing expectedStatus, let's check if the row is visible
                if (await row.isVisible()) {
                    console.log(`Status in list is not yet "${expectedStatus}". Reloading page and re-searching...`);
                    await this.page.reload();
                    await this.searchTraining(trainingName);
                } else {
                    // Row is not visible yet, maybe we are on the wrong page or search is cleared
                    await this.searchTraining(trainingName);
                }
                
                return await statusCell.isVisible();
            }, {
                message: `Status of ${trainingName} did not become "${expectedStatus}" in the list.`,
                timeout: timeout,
                intervals: [5000, 10000]
            }).toBe(true);
        });
    }

    async searchTraining(name: string) {
        await test.step(`Search and Validate Training: ${name}`, async () => {
            // Navigate back to listing page if not already there
            if (await this.searchInput.isHidden()) {
                await this.navigateToMyTrainings();
            }
            await expect(this.searchInput).toBeVisible({ timeout: 10000 });
            await this.searchInput.click();
            await this.searchInput.fill(name);
            await this.page.keyboard.press('Enter');
        });
    }

    async validateErrorMessage(message: string | RegExp) {
        await expect(this.page.getByText(message)).toBeVisible();
    }
}
