import { test, expect } from '../fixtures/base';
import { AppConfig } from '../utils/config';
import { Environment } from '../utils/environment';

test.describe('My Training - Validation, Security and Edge Case Suite', () => {
    test.setTimeout(180000); // 3 minutes total timeout
    test.describe.configure({ retries: 2 });

    test('TC-TRAIN-20: Verify unauthorized access protection redirect for training page', async ({ page }) => {
        await page.goto(`${AppConfig.baseUrl}/model-training`);
        await expect(page).toHaveURL(/.*signin/, { timeout: 20000 });
    });

    test.describe('Authenticated Validation and Edge Scenarios', () => {
        test.beforeEach(async ({ loginPage, trainingPage }) => {
            await loginPage.navigate();
            await loginPage.login(Environment.Q0_TRAINING_EMAIL, Environment.Q0_TRAINING_PASSWORD);
            await trainingPage.navigateToMyTrainings();
        });

        test('TC-TRAIN-17: Verify validation error for empty Display Name (Step 1)', async ({ trainingPage, page }) => {
            await trainingPage.clickCreateTraining();
            await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });

            // Clear Display Name input and click continue
            await trainingPage.displayNameInput.fill('');
            await trainingPage.continueBtn.click();

            // Assert the custom red text validation message
            const validationError = page.getByText('Please enter the training name');
            await expect(validationError).toBeVisible({ timeout: 5000 });
        });

        test('TC-TRAIN-18: Verify validation error for missing GPU selection (Step 6)', async ({ trainingPage, page }) => {
            const trainingName = `VALIDATION-GPU-${Date.now()}`;

            await trainingPage.clickCreateTraining();

            // Step 1: Fill Basic Details
            await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });
            await trainingPage.fillBasicDetails(trainingName, `GPU validation test`);

            // Step 2: Select Model
            await trainingPage.selectModel('Large Language Model', 'Text Generation', 'Llama3-1-8B');

            // Step 3: Configure Training
            await trainingPage.selectTrainingConfiguration('SFT (Supervised Fine-Tuning)', undefined, 'Llama3-1-8B');

            // Step 4: Dataset details - Select an existing dataset to avoid creating new secrets/assets
            await trainingPage.selectDatasetBtn.click();

            // Target the dataset inside the modal. Use the specific name or fallback to modal rows/elements.
            const datasetOption = page.getByText('DATASET-Llama3-1-8B-GCP-SFT')
                .or(page.locator('div[role="dialog"] button').filter({ hasText: /Created by/i }))
                .or(page.locator('tbody tr'))
                .or(page.locator('div[role="dialog"] tbody tr'))
                .first();

            await datasetOption.waitFor({ state: 'visible', timeout: 15000 });
            await datasetOption.click();
            await trainingPage.continueBtn.click();

            // Step 5: Evaluation Settings
            await trainingPage.configureEvaluation(true);

            // Step 6: Infrastructure - click continue to trigger validation without selecting H100
            await trainingPage.continueBtn.click();

            // Assert the validation prompt for GPU selection
            const gpuPrompt = page.getByText(/Please select an GPU type/i);
            await expect(gpuPrompt).toBeVisible({ timeout: 15000 });
        });

        test('TC-TRAIN-19: Verify cancel training creation redirect', async ({ trainingPage, page }) => {
            await trainingPage.clickCreateTraining();
            await expect(page.getByRole('heading', { name: /Create Training/i })).toBeVisible({ timeout: 10000 });

            // Fill Step 1
            await trainingPage.displayNameInput.fill('CANCEL-TEST-TRAINING');

            // Navigate back to listing page to cancel
            await trainingPage.navigateToMyTrainings();

            // Verify no training named "CANCEL-TEST-TRAINING" is present in the list
            await trainingPage.searchTraining('CANCEL-TEST-TRAINING');
            const row = page.getByRole('row', { name: /CANCEL-TEST-TRAINING/i });
            await expect(row).toBeHidden({ timeout: 10000 });
        });

        test('TC-TRAIN-21: Verify search and filter functionality in My Trainings list', async ({ trainingPage, page }) => {
            // Search for non-existent training
            const nonExistentName = `NONEXISTENT-TRAINING-${Date.now()}`;
            await trainingPage.searchTraining(nonExistentName);

            // Assert that the list doesn't display any row matching the query
            await expect(page.getByRole('row', { name: new RegExp(nonExistentName, 'i') })).toBeHidden({ timeout: 10000 });

            // Reset search input
            await trainingPage.searchInput.click();
            await trainingPage.searchInput.press('ControlOrMeta+a');
            await trainingPage.searchInput.press('Backspace');
            await trainingPage.searchInput.press('Enter');
        });
    });
});
