import { test, expect } from '../fixtures/base';

test.describe('My Training Module', () => {
    test.setTimeout(120000); // 2 minutes for full E2E flow
    test('TC-TRAIN-01: Verify end-to-end training creation (Llama3-1-8B, GCP)', async ({ loginPage, trainingPage, page }) => {

        // Setup variables
        const trainingName = `Llama3-1-8B GCP Test ${Date.now()}`;
        const datasetName = `Llama Dataset GCP ${Date.now()}`;

        // Login
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Ganesha@5050');

        // Navigate to My Trainings
        await trainingPage.navigateToMyTrainings();

        // Step 1: Create new training and fill basic details
        await trainingPage.clickCreateTraining();

        // Wait for the form to load
        await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
        await trainingPage.fillBasicDetails(trainingName, 'Automation created training for testing');

        // Step 2: Model Selection
        await trainingPage.selectModel('Large Language Model', 'Text Generation', 'Llama3-1-8B');

        // Step 3: Training Configuration
        await trainingPage.selectTrainingConfiguration('SFT \\(Supervised Fine-Tuning\\)');

        // Step 4: Dataset Details (Creates new GCP dataset and asserts API save)
        await trainingPage.createNewDataset(
            datasetName,
            'Dataset Description automation',
            'GCP',
            'asia-south1',
            'GCP Secret',
            'gs://inference-training-data/llama3-8b/dataset.json'
        );

        // Step 5: Evaluation
        await trainingPage.configureEvaluation(true); // true = Auto Split

        // Step 6: Infrastructure Configuration
        await trainingPage.configureInfrastructure();

        // Step 7: Option Settings
        await trainingPage.configureOptionsAndSubmit('AWQ');

        // Verify creation
        await trainingPage.verifyTrainingCreation();

        // Search for newly created training
        await trainingPage.searchTraining(trainingName);
        await expect(page.getByRole('cell', { name: new RegExp(trainingName, 'i') })).toBeVisible();
    });
});