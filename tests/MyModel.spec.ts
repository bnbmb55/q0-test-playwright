import { test, expect } from '../fixtures/base';
import { Environment } from '../utils/environment';
import { AppConfig } from '../utils/config';

test.describe('My Models Module - E2E Verification Suite', () => {
    // 15 minutes timeout per test to accommodate full E2E model addition, verification, and status optimization
    test.setTimeout(900000);
    test.describe.configure({ mode: 'serial', retries: 0 }); // Serial execution for creation flow

    const modelScenarios = [
        {
            name: 'GPT Oss 20B',
            path: 'gs://inference-training-data/Models/gpt-oss-20b/',
            class: 'GPT Oss 20B',
            tcId: 'TC-MODEL-01'
        },
        {
            name: 'Whisperforcondition',
            path: 'gs://inference-training-data/Models/whisper-large-v3/',
            class: 'Whisperforcondition',
            tcId: 'TC-MODEL-02'
        },
        {
            name: 'Gemma3forcondition',
            path: 'gs://inference-training-data/Models/gemma-3-4b-it/',
            class: 'Gemma3forcondition',
            tcId: 'TC-MODEL-03'
        }
    ];

    test.describe('Positive E2E Model Addition Flow', () => {
        test.beforeEach(async ({ loginPage, modelPage }) => {
            await loginPage.navigate();
            await loginPage.login(Environment.Q0_TRAINING_EMAIL, Environment.Q0_TRAINING_PASSWORD);
            await modelPage.navigateToMyModels();
        });

        modelScenarios.forEach((scenario) => {
            test(`${scenario.tcId}: Verify model addition and status verification for ${scenario.name} using GCP source`, async ({ modelPage }) => {
                const modelDisplayName = `${scenario.name.replace(/\s+/g, '-')}-${Date.now()}`;
                const modelDescription = `Automated GCP model addition for class ${scenario.class}`;

                // Step 1: Open Form & Fill Basic Details
                await modelPage.clickCreateModel();
                await modelPage.fillBasicDetails(modelDisplayName, modelDescription);

                // Step 2: Configure GCP Source & Verify Path
                await modelPage.configureSourceAndPath({
                    source: 'GCP',
                    secretName: 'GCP Secret',
                    modelPath: scenario.path,
                    modelClass: scenario.class
                });

                // Step 3: Configure Region & Hardware (NM1 India, H100)
                await modelPage.configureRegionAndHardware('NM1 India', 'H100');

                // Step 4: Configure Optimization Settings & Submit
                await modelPage.configureOptimizationAndSubmit('F16');

                // Step 5: Wait and Verify status is getting ready (e.g., reaches Launched or Optimisation or Accepted)
                await modelPage.verifyModelStatus(['Launched', 'Optimisation', 'Accepted', 'Active']);

                // Step 6: Search in models listing and verify it persists
                await modelPage.searchAndVerifyInList(modelDisplayName);
            });
        });
    });
});

test.describe('My Models - Validation, Security and Edge Case Suite', () => {
    test.setTimeout(180000); // 3 minutes total timeout for validation tests
    test.describe.configure({ retries: 1 });

    test('TC-MODEL-08: Verify unauthorized access protection redirect for models page', async ({ page }) => {
        // Try accessing models routes directly without login session
        await page.goto(`${AppConfig.baseUrl}/models`);
        await expect(page).toHaveURL(/.*signin/, { timeout: 20000 });

        await page.goto(`${AppConfig.baseUrl}/my-models`);
        await expect(page).toHaveURL(/.*signin/, { timeout: 20000 });
    });

    test.describe('Authenticated Validation and Edge Scenarios', () => {
        test.beforeEach(async ({ loginPage, modelPage }) => {
            await loginPage.navigate();
            await loginPage.login(Environment.Q0_TRAINING_EMAIL, Environment.Q0_TRAINING_PASSWORD);
            await modelPage.navigateToMyModels();
        });

        test('TC-MODEL-04: Verify validation error for empty Display Name (Step 1)', async ({ modelPage, page }) => {
            await modelPage.clickCreateModel();

            // Clear display name and try to continue
            await modelPage.displayNameInput.fill('');
            await modelPage.continueBtn.click();

            // Assert custom error validation message is visible
            const validationError = page.getByText(/Please fill in the display name|Please enter the model name|Please enter a display name|Display Name is required/i)
                .or(page.locator('span').filter({ hasText: /required|enter|fill/i }));
            await expect(validationError.first()).toBeVisible({ timeout: 5000 });
        });

        test('TC-MODEL-05: Verify validation error when verifying a non-GCP path with GCP source (Step 2)', async ({ modelPage, page }) => {
            const modelDisplayName = `VALIDATION-PATH-${Date.now()}`;
            await modelPage.clickCreateModel();
            await modelPage.fillBasicDetails(modelDisplayName, 'GCP path validation test');

            // Select GCP Source
            await modelPage.gcpSourceBtn.first().click();

            // Select GCP Secret
            await modelPage.selectSecretBtn.first().click();
            const secretOption = page.getByRole('button').filter({ hasText: /GCP Secret/i }).first();
            await expect(secretOption).toBeVisible({ timeout: 10000 });
            await secretOption.click();

            // Fill HuggingFace path instead of gs:// path for GCP Source
            await modelPathInputValidation(modelPage.modelPathInput, 'PaddlePaddle/PaddleOCR-VL');

            // Click Verify
            await modelPage.verifyBtn.click();

            // Assert that a validation error/alert is shown
            const errorAlert = page.getByText(/Invalid GCS path|fail|error|invalid|incorrect/i)
                .or(page.locator('span').filter({ hasText: /gs:\/\//i }))
                .first();
            await expect(errorAlert).toBeVisible({ timeout: 15000 });
        });

        test('TC-MODEL-06: Verify cancel model creation flow redirects to My Models list', async ({ modelPage, page }) => {
            const cancelModelName = `CANCEL-TEST-MODEL-${Date.now()}`;
            await modelPage.clickCreateModel();

            // Fill display name
            await modelPage.displayNameInput.fill(cancelModelName);

            // Navigate back to models to cancel
            await modelPage.navigateToMyModels();

            // Search for the cancelled model name and verify it does NOT exist
            await expect(modelPage.searchInput).toBeVisible({ timeout: 10000 });
            await modelPage.searchInput.fill(cancelModelName);
            await modelPage.searchInput.press('Enter');

            const row = page.getByRole('row', { name: new RegExp(cancelModelName, 'i') })
                .or(page.getByText(cancelModelName));
            await expect(row.first()).toBeHidden({ timeout: 8000 });
        });

        test('TC-MODEL-07: Verify search functionality with non-existent models', async ({ modelPage, page }) => {
            const nonExistentName = `NONEXISTENT-MODEL-${Date.now()}`;

            await expect(modelPage.searchInput).toBeVisible({ timeout: 10000 });
            await modelPage.searchInput.fill(nonExistentName);
            await modelPage.searchInput.press('Enter');

            // Verify table displays empty state or no matching row is displayed
            const modelCell = page.getByRole('cell', { name: new RegExp(nonExistentName, 'i') })
                .or(page.getByText(nonExistentName));
            await expect(modelCell.first()).toBeHidden({ timeout: 8000 });

            // Clear search
            if (await modelPage.clearSearchBtn.isVisible()) {
                await modelPage.clearSearchBtn.click();
            }
        });
    });
});

/** Helper to robustly clear and fill the model path input */
async function modelPathInputValidation(inputLocator: any, pathValue: string) {
    await inputLocator.click();
    await inputLocator.press('ControlOrMeta+a');
    await inputLocator.press('Backspace');
    await inputLocator.fill(pathValue);
}