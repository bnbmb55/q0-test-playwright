import { test, expect } from '../fixtures/base';

test.describe('My Training Module - GCP & Azure Suite', () => {
    test.setTimeout(240000); // 4 minutes for comprehensive E2E flows

    test.beforeEach(async ({ loginPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Ganesha@5050');
    });

    const testScenarios = [
        // GCP Scenarios
        {
            provider: 'GCP',
            type: 'SFT',
            model: 'Llama3-1-8B',
            region: 'asia-south1',
            path: 'gs://inference-training-data/llama3-8b/dataset.json'
        },
        {
            provider: 'GCP',
            type: 'SFT',
            distributionType: 'DDP',
            model: 'Llama3-1-8B',
            region: 'asia-south1',
            path: 'gs://inference-training-data/llama3-8b/dataset.json'
        },
        {
            provider: 'GCP',
            type: 'SFT',
            distributionType: 'DeepSpeed',
            model: 'Llama3-1-8B',
            region: 'asia-south1',
            path: 'gs://inference-training-data/llama3-8b/dataset.json'
        },
        {
            provider: 'GCP',
            type: 'RLHF',
            model: 'Llama3-1-8B',
            region: 'asia-south1',
            path: 'gs://inference-training-data/llama3-8b/rlhfllama.zip'
        },
        /* Commenting out Azure flow for now
        {
            provider: 'Azure',
            type: 'SFT',
            model: 'Llama3-1-8B',
            region: 'eastus',
            path: 'https://yottastorage.blob.core.windows.net/yotta-storage/llama3-8b/dataset.json'
        },
        {
            provider: 'Azure',
            type: 'RLHF',
            model: 'Llama3-1-8B',
            region: 'eastus',
            path: 'https://yottastorage.blob.core.windows.net/yotta-storage/llama3-8b/rlhfllama.zip'
        }
        */
    ];

    for (const data of testScenarios) {
        test(`TC-TRAIN: ${data.provider} ${data.type}${data.distributionType ? '-' + data.distributionType : ''} - ${data.model} Creation`, async ({ trainingPage, page }) => {
            const trainingName = `${data.provider}-${data.type}${data.distributionType ? '-' + data.distributionType : ''}-${Date.now()}`;
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
                    await trainingPage.fillBasicDetails(trainingName, 'Automated Test for ' + data.provider);

                    // Step 2: Model Selection
                    await trainingPage.selectModel('Large Language Model', 'Text Generation', data.model);

                    // Step 3: Training Configuration
                    const typeLabel = data.type === 'SFT' ? /SFT/i : /RLHF/i;
                    await trainingPage.selectTrainingConfiguration(typeLabel.source, data.distributionType as any);

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
                    await trainingPage.configureOptionsAndSubmit('AWQ');

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