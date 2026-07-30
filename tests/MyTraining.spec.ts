import { test, expect } from '../fixtures/base';
import { trainingModels } from '../data/trainingData';
import { getLoginCredentials } from '../utils/testConfig';

test.describe('My Training Module - Multi-Model E2E Suite', () => {
    test.setTimeout(300000);
    test.describe.configure({ retries: 1 });
    test.beforeEach(async ({ loginPage, trainingPage }) => {
        const credentials = getLoginCredentials('training');
        await loginPage.navigate();
        await loginPage.login(credentials.email, credentials.password);
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

    for (const data of testScenarios) {
        test(`TC-TRAIN: ${data.model} - ${data.provider} ${data.type}${data.distributionType ? '-' + data.distributionType : ''} Creation`, async ({ trainingPage, page }) => {
            const dist = data.distributionType ? `-${data.distributionType}` : '';
            const trainingName = `${data.model}-${data.provider}-${data.type}${dist}-${Date.now()}`;
            const datasetName = `DATASET-${data.model}-${data.provider}-${data.type}`;

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
                    const gcpServiceAccountObj = {
                        type: "service_account",
                        project_id: "",
                        private_key_id: "",
                        private_key: "",
                        client_email: "",
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

                    requiresRestart = await trainingPage.selectOrCreateDataset({
                        name: datasetName,
                        description: `Reusable dataset for ${data.model} ${data.provider}`,
                        source: data.provider as 'GCP' | 'Azure' | 'AWS',
                        region: data.region,
                        secret: `${data.provider} Secret`,
                        path: data.path,
                        secretConfig: safeGcpSecretConfig
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

                await test.step(`Attempt ${attempt}: Verify Training Creation`, async () => {
                    await trainingPage.verifyTrainingCreation();
                    await trainingPage.searchTraining(trainingName);
                    await expect(page.getByRole('cell', { name: new RegExp(trainingName, 'i') })).toBeVisible();
                });

            } while (requiresRestart && attempt < 2);
        });
    }

});