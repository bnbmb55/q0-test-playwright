import { test, expect } from '../fixtures/base';
import { trainingModels } from '../data/trainingData';

test.describe('My Training Module - Multi-Model E2E Suite', () => {
    test.setTimeout(300000); // 5 minutes for complex E2E flows

    test.beforeEach(async ({ loginPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Ganesha@5050');
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

            // Senior Engineer Healer: Use a retry loop to handle flaky GPU selection
            let attempts = 0;
            const maxAttempts = 2;
            let success = false;

            while (attempts < maxAttempts && !success) {
                try {
                    await trainingPage.navigateToMyTrainings();
                    await trainingPage.clickCreateTraining();

                    // Step 1: Basic Details
                    await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
                    await trainingPage.fillBasicDetails(trainingName, `Automated Test for ${data.model} on ${data.provider}`);

                    // Step 2: Model Selection (Now uses dynamic metadata)
                    await trainingPage.selectModel(data.category, data.task, data.model);

                    // Step 3: Training Configuration
                    const typeLabel = data.type === 'SFT' ? data.sftLabel : data.rlhfLabel;
                    await trainingPage.selectTrainingConfiguration(typeLabel, data.distributionType as any, data.model);

                    // Step 4: Smart Dataset Selection
                    await trainingPage.selectOrCreateDataset({
                        name: datasetName,
                        description: `Reusable dataset for ${data.model} ${data.provider}`,
                        source: data.provider as 'GCP' | 'Azure',
                        region: data.region,
                        secret: `${data.provider} Secret`,
                        path: data.path
                    });

                    // Step 5: Evaluation
                    await trainingPage.configureEvaluation(true);

                    // Step 6: Infrastructure Configuration (This is where it might flake)
                    await trainingPage.configureInfrastructure('H100');

                    // Step 7: Option Settings and Submit
                    await trainingPage.configureOptionsAndSubmit(data.preferredQuantization);

                    // Verification
                    await trainingPage.verifyTrainingCreation();

                    // Cleanup Verification
                    await trainingPage.searchTraining(trainingName);
                    await expect(page.getByRole('cell', { name: new RegExp(trainingName, 'i') })).toBeVisible();

                    success = true;
                } catch (error) {
                    if (error.message.includes('RETRY_FLOW_GPU_MISSING') && attempts < maxAttempts - 1) {
                        console.warn(`Attempt ${attempts + 1} failed due to missing GPU. Refreshing and restarting flow...`);
                        await page.reload();
                        attempts++;
                    } else {
                        throw error;
                    }
                }
            }
        });
    }

});