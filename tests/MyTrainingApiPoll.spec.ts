import { test, expect } from '../fixtures/base';
import { trainingModels } from '../data/trainingData';
import { EncryptionAndDecryption } from '../utils/encryption';
import { AuthHelper } from '../utils/authHelper';
import { TrainingApiHelper } from '../utils/apiHelper';
import { request as playwrightRequest } from '@playwright/test';

test.describe('Asynchronous Training Module - API Polling Suite', () => {
    test.setTimeout(1800000); // Extended 30 mins timeout for async API polling

    // We select a representative model config (Llama3-1-8B SFT GCP) for the enterprise spec
    const data = trainingModels.find(m => m.model === 'Llama3-1-8B' && m.provider === 'GCP') || trainingModels[0];

    test('TC-TRAIN: Asynchronous Backend Polling Flow', async ({ loginPage, trainingPage, page }) => {
        const trainingName = `${data.model}-${data.provider}-API-POLL-${Date.now()}`;
        const datasetName = `DATASET-${data.model}-${data.provider}-API-POLL`;

        // Intercept Authorization header from outgoing requests during UI execution
        let capturedToken = '';
        page.on('request', request => {
            const authHeader = request.headers()['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                capturedToken = authHeader;
            }
        });

        // 1. Authenticate and Navigate via UI
        await test.step('1. Authenticate and navigate to training creation', async () => {
            await loginPage.navigate();
            await loginPage.login('vikasnew.rathod@gmail.com', 'Ganesha@5050');
            await trainingPage.navigateToMyTrainings();
            await trainingPage.clickCreateTraining();
        });

        // 2. Fill Training Configuration via UI
        await test.step('2. Fill training details and configure forms', async () => {
            await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
            await trainingPage.fillBasicDetails(trainingName, `Automated API-Polling test for ${data.model}`);
            await trainingPage.selectModel(data.category, data.task, data.model);
            await trainingPage.selectTrainingConfiguration('SFT (Supervised Fine-Tuning)', undefined, data.model);
        });

        // 3. Configure Dataset & GCP credentials
        await test.step('3. Configure dataset and mock secrets', async () => {
            const gcpServiceAccountObj = {
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
            };

            const safeGcpSecretConfig = JSON.stringify({
                service_account_json: JSON.stringify(gcpServiceAccountObj)
            }, null, 2);

            const requiresRestart = await trainingPage.selectOrCreateDataset({
                name: datasetName,
                description: `Dataset for API Polling verification`,
                source: data.provider as 'GCP' | 'Azure' | 'AWS',
                region: data.region,
                secret: `${data.provider} Secret`,
                path: data.sftPath,
                secretConfig: safeGcpSecretConfig
            });

            if (requiresRestart) {
                throw new Error('Secret was missing and created. Form needs a reload, please run prerequisite setup first.');
            }
        });

        // 4. Submit Training job via UI
        await test.step('4. Finalize options and submit training job', async () => {
            await trainingPage.configureEvaluation(true);
            await trainingPage.configureInfrastructure('H100');
            await trainingPage.configureOptionsAndSubmit('AWQ');
            await trainingPage.verifyTrainingCreation();
        });

        // 5. Extract Session & ID details, then close the browser context
        let trainingId: number;
        let authToken: string;

        await test.step('5. Extract Training ID and OAuth credentials, then close browser', async () => {
            const url = page.url();
            console.log(`[UI Success] Details URL: ${url}`);
            
            // Extract the encrypted ID from trailing segment of URL
            const match = url.match(/\/training\/([^\/]+)/) || url.match(/\/model-training\/([^\/]+)/);
            if (!match) {
                throw new Error(`Failed to parse training ID from URL: ${url}`);
            }
            const rawEncryptedId = match[1];
            const encryptedId = rawEncryptedId.split('?')[0];
            
            // Decrypt it to get the raw integer ID used in backend database
            trainingId = EncryptionAndDecryption.decryptionIds(decodeURIComponent(encryptedId));
            console.log(`[Decryption] Decrypted training ID for API: ${trainingId}`);

            // Fetch JWT bearer token
            authToken = await AuthHelper.getAuthToken(page, capturedToken);
            console.log('[Auth] Successfully extracted authorization token.');

            // Close the browser page and context immediately to free system memory
            const context = page.context();
            await context.close();
            console.log('[Browser Context] Closed browser context. Transitioning to pure backend API polling.');
        });

        // 6. Perform Backend API Polling
        await test.step('6. Poll backend API for async training completion status', async () => {
            // Create a clean API request context outside of browser, ignoring SSL errors
            const apiContext = await playwrightRequest.newContext({
                ignoreHTTPSErrors: true
            });

            // Run backend status polling
            const finalStatus = await TrainingApiHelper.pollTrainingStatus(
                apiContext,
                trainingId,
                authToken,
                    {
                        intervalMs: 15000,      // Poll every 15 seconds
                        timeoutMs: 1800000,     // 30 minutes overall timeout
                        maxTransientRetries: 5, // Retry up to 5 times for transient/network drops
                        trainingName: trainingName
                    }
            );

            const results = [{ name: trainingName, id: trainingId, status: finalStatus }];
            console.log('\n================ TRAINING RESULTS ================');
            console.table(results);
            console.log('==================================================\n');
            
            // Dispose the API context
            await apiContext.dispose();
        });
    });
});
