import { test, expect } from '../fixtures/base';
import { trainingModels } from '../data/trainingData';

test.describe('My Training Module - Multi-Model E2E Suite', () => {
    test.setTimeout(300000); // 5 minutes for complex E2E flows
    test.describe.configure({ retries: 1 }); // Native Playwright retries instead of custom loop

    test.beforeEach(async ({ loginPage, trainingPage }) => {
        await loginPage.navigate();
        await loginPage.login('sharma.paranv@gmail.com', 'Ganesha@5050');
        // Handle redirect to Secrets page after login
        await trainingPage.navigateToMyTrainings();
    });

    // Generate Scenarios Dynamically for all models
    const testScenarios: any[] = [];

    trainingModels.forEach(config => {
        // 1. Standard SFT (Always supported)
        testScenarios.push({ ...config, type: 'SFT', path: config.sftPath });

        // 2. SFT DDP (Assuming supported for all SFT)
        testScenarios.push({ ...config, type: 'SFT', distributionType: 'DDP', path: config.sftPath });

        // 3. SFT DeepSpeed (Assuming supported for all SFT)
        testScenarios.push({ ...config, type: 'SFT', distributionType: 'DeepSpeed', path: config.sftPath });

        // 4. RLHF (Conditional)
        if (config.supportsRLHF) {
            testScenarios.push({ ...config, type: 'RLHF', path: config.rlhfPath });
        }
    });

    for (const data of testScenarios) {
        test(`TC-TRAIN: ${data.model} - ${data.provider} ${data.type}${data.distributionType ? '-' + data.distributionType : ''} Creation`, async ({ trainingPage, page }) => {
            const dist = data.distributionType ? `-${data.distributionType}` : '';
            const trainingName = `${data.model}-${data.provider}-${data.type}${dist}-${Date.now()}`;
            const datasetName = `DATASET-${data.model}-${data.provider}-${data.type}`;

            // 1. Pre-flight Setup: Ensure prerequisites are met BEFORE starting the form
            // This handles New vs Existing user states seamlessly without interrupting the wizard
            await test.step('Pre-flight: Ensure Secrets Exist', async () => {
                const secretName = `${data.provider} Secret`;
                await trainingPage.ensureSecretExists(secretName, '{"project_id": "q0-test", "private_key": "dummy"}');
            });

            await test.step('Navigate and Open Training Form', async () => {
                await trainingPage.navigateToMyTrainings();
                await trainingPage.clickCreateTraining();
            });

            await test.step('Step 1: Fill Basic Details', async () => {
                await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
                await trainingPage.fillBasicDetails(trainingName, `Automated Test for ${data.model} on ${data.provider}`);
            });

            await test.step('Step 2: Select Model', async () => {
                await trainingPage.selectModel(data.category, data.task, data.model);
            });

            await test.step('Step 3: Configure Training', async () => {
                const typeLabel = data.type === 'SFT' ? data.sftLabel : data.rlhfLabel;
                await trainingPage.selectTrainingConfiguration(typeLabel, data.distributionType as any, data.model);
            });

            await test.step('Step 4: Dataset and Secret Verification', async () => {
                await trainingPage.selectOrCreateDataset({
                    name: datasetName,
                    description: `Reusable dataset for ${data.model} ${data.provider}`,
                    source: data.provider as 'GCP' | 'Azure',
                    region: data.region,
                    secret: `${data.provider} Secret`,
                    path: data.path
                });
            });

            await test.step('Step 5: Evaluation Settings', async () => {
                await trainingPage.configureEvaluation(true);
            });

            await test.step('Step 6: Infrastructure Setup', async () => {
                await trainingPage.configureInfrastructure('H100');
            });

            await test.step('Step 7: Finalize and Submit', async () => {
                await trainingPage.configureOptionsAndSubmit(data.preferredQuantization);
            });

            await test.step('Verify Training Creation', async () => {
                await trainingPage.verifyTrainingCreation();
                await trainingPage.searchTraining(trainingName);
                await expect(page.getByRole('cell', { name: new RegExp(trainingName, 'i') })).toBeVisible();
            });
        });
    }

});