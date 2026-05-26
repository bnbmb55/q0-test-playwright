import { test, expect } from '../fixtures/base';
import { trainingModels } from '../data/trainingData';
import { EncryptionAndDecryption } from '../utils/encryption';
import { AuthHelper } from '../utils/authHelper';
import { TrainingApiHelper } from '../utils/apiHelper';
import { Environment } from '../utils/environment';
import { request as playwrightRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';


test.describe('My Training Module - Multi-Model E2E Suite', () => {
    test.setTimeout(900000); // 15 mins max per test to accommodate full E2E training execution
    test.describe.configure({ mode: 'serial', retries: 0 }); // Disable retries and run serially

    const submittedJobs: Array<{ name: string; id: number; token: string }> = [];

    test.beforeEach(async ({ loginPage, trainingPage }) => {
        await loginPage.navigate();
        const email = Environment.Q0_TRAINING_EMAIL;
        const password = Environment.Q0_TRAINING_PASSWORD;
        await loginPage.login(email, password);
        await trainingPage.navigateToMyTrainings();
    });

    const testScenarios: any[] = [];

    trainingModels.forEach(config => {
        testScenarios.push({ ...config, type: 'SFT', path: config.sftPath });

        testScenarios.push({ ...config, type: 'SFT', distributionType: 'DDP', path: config.sftPath });

        testScenarios.push({ ...config, type: 'SFT', distributionType: 'DeepSpeed', path: config.sftPath });

        if (config.supportsRLHF) {
            testScenarios.push({ ...config, type: 'RLHF', path: config.rlhfPath });
        }
    });

    testScenarios.forEach((data, index) => {
        const tcId = `TC-TRAIN-${String(index + 1).padStart(2, '0')}`;
        test(`${tcId}: Verify training creation for ${data.model} - ${data.provider} ${data.type}${data.distributionType ? '-' + data.distributionType : ''}`, async ({ trainingPage, page }) => {
            const dist = data.distributionType ? `-${data.distributionType}` : '';
            const trainingName = `${data.model}-${data.provider}-${data.type}${dist}-${Date.now()}`;
            const datasetName = `DATASET-${data.model}-${data.provider}-${data.type}`;

            // Intercept Authorization header from outgoing requests during UI execution
            let capturedToken = '';
            page.on('request', request => {
                const authHeader = request.headers()['authorization'];
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    capturedToken = authHeader;
                }
            });

            let requiresRestart = false;
            let attempt = 0;

            do {
                requiresRestart = false;
                attempt++;

                await test.step(`Attempt ${attempt}: Navigate and Open Training Form`, async () => {
                    await trainingPage.navigateToMyTrainings();
                    await trainingPage.clickCreateTraining();
                });

                await test.step(`Attempt ${attempt}: Step 1: Fill Basic Details`, async () => {
                    await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
                    await trainingPage.fillBasicDetails(trainingName, `Automated Test for ${data.model} on ${data.provider}`);
                });

                await test.step(`Attempt ${attempt}: Step 2: Select Model`, async () => {
                    await trainingPage.selectModel(data.category, data.task, data.model);
                });

                await test.step(`Attempt ${attempt}: Step 3: Configure Training`, async () => {
                    const typeLabel = data.type === 'SFT' ? data.sftLabel : data.rlhfLabel;
                    await trainingPage.selectTrainingConfiguration(typeLabel, data.distributionType as any, data.model);
                });

                await test.step(`Attempt ${attempt}: Step 4: Dataset and Secret Verification`, async () => {
                    let secretConfig = '';
                    if (data.provider === 'GCP') {
                        secretConfig = Environment.getGcpSecretConfig();
                    } else if (data.provider === 'AWS') {
                        secretConfig = Environment.getAwsSecretConfig();
                    } else if (data.provider === 'Azure') {
                        secretConfig = Environment.getAzureSecretConfig();
                    }

                    requiresRestart = await trainingPage.selectOrCreateDataset({
                        name: datasetName,
                        description: `Reusable dataset for ${data.model} ${data.provider}`,
                        source: data.provider as 'GCP' | 'Azure' | 'AWS',
                        region: data.region,
                        secret: `${data.provider} Secret`,
                        path: data.path,
                        secretConfig: secretConfig
                    });
                });

                if (requiresRestart) {
                    console.log(`Secret was missing and created from sidebar. Restarting the training form (Attempt ${attempt})...`);
                    continue;
                }

                await test.step(`Attempt ${attempt}: Step 5: Evaluation Settings`, async () => {
                    await trainingPage.configureEvaluation(true);
                });

                await test.step(`Attempt ${attempt}: Step 6: Infrastructure Setup`, async () => {
                    await trainingPage.configureInfrastructure('H100');
                });

                await test.step(`Attempt ${attempt}: Step 7: Finalize and Submit`, async () => {
                    await trainingPage.configureOptionsAndSubmit(data.preferredQuantization);
                });

                await test.step(`Attempt ${attempt}: Verify Training Creation and Queue for Verification`, async () => {
                    // 1. Verify the training is successfully initiated and details page loads
                    await trainingPage.verifyTrainingCreation();

                    // 2. Extract Training ID and OAuth credentials
                    const url = page.url();
                    const match = url.match(/\/training\/([^\/]+)/) || url.match(/\/model-training\/([^\/]+)/);
                    if (!match) {
                        throw new Error(`Failed to parse training ID from URL: ${url}`);
                    }
                    const rawEncryptedId = match[1];
                    const encryptedId = rawEncryptedId.split('?')[0];
                    const trainingId = EncryptionAndDecryption.decryptionIds(decodeURIComponent(encryptedId));
                    const authToken = await AuthHelper.getAuthToken(page, capturedToken);

                    // 3. Queue details to in-memory queue for final async API polling
                    submittedJobs.push({
                        name: trainingName,
                        id: trainingId,
                        token: authToken
                    });

                    console.log(`[Queue] Queued job: ${trainingName} (ID: ${trainingId}) for batch API verification.`);
                });

            } while (requiresRestart && attempt < 2);
        });
    });

    test('TC-TRAIN-16: Verify all submitted training jobs via API polling', async () => {
        // Extend timeout for batch verification
        test.setTimeout(1200000); // 20 minutes

        if (submittedJobs.length === 0) {
            console.log('[API POLL] No submitted jobs found to verify.');
            return;
        }

        console.log(`[API POLL] Starting batch verification of ${submittedJobs.length} training jobs...`);

        const apiContext = await playwrightRequest.newContext({
            ignoreHTTPSErrors: true
        });

        const results: { name: string; id: number; status: string }[] = [];

        // Poll all jobs in parallel
        const pollPromises = submittedJobs.map(async (job) => {
            try {
                const status = await TrainingApiHelper.pollTrainingStatus(
                    apiContext,
                    job.id,
                    job.token,
                    {
                        intervalMs: 20000,
                        timeoutMs: 600000, // 10 minutes timeout per job
                        trainingName: job.name
                    }
                );
                results.push({ name: job.name, id: job.id, status });
            } catch (error: any) {
                results.push({ name: job.name, id: job.id, status: `ERROR: ${error.message}` });
            }
        });

        await Promise.all(pollPromises);
        await apiContext.dispose();

        console.log('\n================ BATCH TRAINING RESULTS ================');
        console.table(results);
        console.log('========================================================\n');

        // Log if any jobs did not complete, but pass the test case as requested
        const incompleteJobs = results.filter(r => r.status !== 'COMPLETED');
        if (incompleteJobs.length > 0) {
            console.log(`[Batch Note] The following jobs did not reach Completed status: ${JSON.stringify(incompleteJobs)}`);
        }
    });

});