import { test, expect } from '../fixtures/base';
import { awsTrainingScenarios } from '../data/trainingData';
import { TestConfig } from '../utils/testConfig';

test.describe('AWS Training Submission Suite', () => {
    test.setTimeout(300000);
    // These tests create datasets and billable training jobs. A retry can create
    // a duplicate job, and parallel setup can race while creating the AWS secret.
    test.describe.configure({ mode: 'serial', retries: 0 });
    // Training creates billable backend jobs; execute the workflow once rather
    // than duplicating it across Chromium, Firefox, and WebKit projects.
    test.skip(({ browserName }) => browserName !== 'chromium', 'AWS training submission is validated in Chromium only.');
    test.skip(() => process.env.RUN_BILLABLE_TRAINING !== 'true', 'Set RUN_BILLABLE_TRAINING=true to create real training jobs.');

    test.beforeEach(async ({ authenticate, trainingPage }) => {
        await authenticate('training');
        await trainingPage.ensureAwsSecret(TestConfig.training.awsSecretName, {
            accessKeyId: TestConfig.training.awsAccessKeyId,
            secretAccessKey: TestConfig.training.awsSecretAccessKey
        });
        await trainingPage.navigateToMyTrainings();
    });

    for (const scenario of awsTrainingScenarios) {
        test(`TC-TRAIN-AWS-SFT: ${scenario.model} submits an AWS dataset`, async ({ trainingPage, page }) => {
            const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const trainingName = `AUTO-AWS-${scenario.model}-SFT-${runId}`;
            // Dataset data is stable. Reuse it across runs instead of creating
            // an identical dataset for every training submission.
            const datasetName = `AUTO-AWS-DATASET-${scenario.model}-SFT`;

            await test.step('Open the training wizard', async () => {
                await trainingPage.clickCreateTraining();
                await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible();
            });

            await test.step('Provide training details', async () => {
                await trainingPage.fillBasicDetails(
                    trainingName,
                    `AWS SFT submission validation for ${scenario.model}; source: ${scenario.s3Uri}`
                );
            });

            await test.step('Select a supported model and training method', async () => {
                await trainingPage.selectModel(scenario.category, scenario.task, scenario.model);
                await trainingPage.selectTrainingConfiguration(scenario.trainingTypeLabel, undefined, scenario.model);
            });

            await test.step('Create an AWS-backed dataset using a provisioned secret', async () => {
                await trainingPage.selectOrCreateDataset({
                    name: datasetName,
                    description: `SFT ${scenario.format} dataset for ${scenario.model}`,
                    source: 'AWS',
                    secret: TestConfig.training.awsSecretName,
                    path: scenario.s3Uri
                });
            });

            await test.step('Configure and submit the training job', async () => {
                await trainingPage.configureEvaluation(true);
                await trainingPage.configureInfrastructure('H100');
                await trainingPage.configureOptionsAndSubmit(scenario.preferredQuantization);
            });

            await test.step('Verify the job is accepted by the platform', async () => {
                await trainingPage.verifyTrainingCreation();
                await trainingPage.searchTraining(trainingName);
                await expect(page.getByRole('cell', { name: new RegExp(trainingName, 'i') })).toBeVisible({ timeout: 30000 });
            });
        });
    }
});
