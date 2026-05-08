import { test, expect } from '@playwright/test';
import { DataGenerator } from '../utils/dataGenerator';
import { EncryptionAndDecryption } from '../utils/encryption';
import { AppConfig } from '../utils/config';

async function getVerificationLink(page: any, email: string, password: string) {
    await page.goto(AppConfig.paths.signIn);
    await page.getByRole('link', { name: 'Sign Up' }).click();
    await page.waitForURL(/.*signup/);

    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
    await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
    await page.getByRole('button', { name: 'Next' }).click({ force: true });

    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 10000 });

    const passwordInput = page.getByRole('textbox', { name: 'Enter Password', exact: true });
    await passwordInput.fill(password);
    await passwordInput.blur();

    const confirmPasswordInput = page.getByRole('textbox', { name: 'Re-enter Password' });
    await confirmPasswordInput.fill(password);
    await confirmPasswordInput.blur();

    // Extra interaction to ensure frontend validation is triggered
    await page.getByRole('heading', { name: 'Create Account' }).click({ force: true });
    await page.waitForTimeout(1000);

    const signupResponsePromise = page.waitForResponse(response =>
        response.url().includes('/Infer/api/logins/signup') && response.status() === 200
    );

    const nextButton = page.getByRole('button', { name: 'Next' });

    // If button is still disabled, try one more Tab/Blur cycle
    if (await nextButton.isDisabled()) {
        await confirmPasswordInput.focus();
        await confirmPasswordInput.press('Tab');
        await page.waitForTimeout(500);
    }

    await expect(nextButton).toBeEnabled({ timeout: 30000 });
    await nextButton.click({ force: true });

    const [response] = await Promise.all([
        signupResponsePromise,
        expect(page.getByRole('heading', { name: 'Verification Email Sent' })).toBeVisible({ timeout: 20000 })
    ]);

    const responseBody = await response.json();
    const encryptedData = responseBody.details || responseBody.data;

    if (!encryptedData) {
        throw new Error('Encrypted data not found in response body.');
    }

    let decryptedData = EncryptionAndDecryption.decryption(encryptedData);
    if (decryptedData === 400) {
        decryptedData = EncryptionAndDecryption.decryptionIds(encryptedData);
    }

    const verificationLink = decryptedData.verification_url || decryptedData.verificationLink;
    if (!verificationLink) {
        throw new Error('Verification link not found in decrypted API response.');
    }

    return verificationLink;
}

async function loginAndVerify(page: any, email: string, password: string, name: string) {
    await page.getByRole('button', { name: 'Sign In', exact: true }).click({ force: true });
    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
    await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click({ force: true });

    await expect(page.getByText(/DashboardCredits/i)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL(/.*signin/);
}

test.describe('Registration Scenarios', () => {
    test.setTimeout(90000);
    test.slow();

    test('TC-REG-01: Successful Individual User Registration', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();

        const link = await getVerificationLink(page, email, password);
        await page.goto(link);

        await expect(page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible();
        await page.getByRole('textbox', { name: 'Enter Name' }).fill(name);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).fill(mobile);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).press('Tab');
        await expect(page.getByRole('button', { name: 'Sign up to Qzero' })).toBeEnabled();
        await page.getByRole('button', { name: 'Sign up to Qzero' }).click();

        await expect(page.getByRole('heading', { name: 'Your account has been created' })).toBeVisible({ timeout: 20000 });
        await loginAndVerify(page, email, password, name);
    });

    test('TC-REG-02: Successful Organisation User Registration', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();
        const orgName = DataGenerator.generateRandomOrgName();

        const link = await getVerificationLink(page, email, password);
        await page.goto(link);

        await expect(page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible();
        await page.getByRole('button', { name: 'Organisation' }).click({ force: true });
        await page.getByRole('combobox').click({ force: true });
        await page.getByRole('option', { name: 'New' }).click({ force: true });
        await page.getByRole('textbox', { name: 'Enter Organisation Name' }).fill(orgName);
        await page.getByRole('textbox', { name: 'Enter Name' }).fill(name);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).fill(mobile);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).press('Tab');
        await expect(page.getByRole('button', { name: 'Sign up to Qzero' })).toBeEnabled();
        await page.getByRole('button', { name: 'Sign up to Qzero' }).click();

        await expect(page.getByText(/Your account has been created successfully/i)).toBeVisible({ timeout: 20000 });
        await loginAndVerify(page, email, password, name);
    });

    test('TC-REG-03: Verify error when registering with an existing email', async ({ page }) => {
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('link', { name: 'Sign Up' }).click({ force: true });
        await page.waitForURL(/.*signup/);

        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill('patil.tanmay9900@gmail.com');
        await page.getByRole('button', { name: 'Next' }).click({ force: true });

        await expect(page.getByText(/An account with this email/i)).toBeVisible();
    });

    test('TC-REG-04: Verify password mismatch validation', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('link', { name: 'Sign Up' }).click({ force: true });
        await page.waitForURL(/.*signup/);

        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('button', { name: 'Next' }).click({ force: true });

        await page.getByRole('textbox', { name: 'Enter Password', exact: true }).fill('Password@123');
        await page.getByRole('textbox', { name: 'Re-enter Password' }).fill('Different@123');

        await page.getByRole('heading', { name: 'Create Account' }).click();

        await expect(page.getByText(/match/i).filter({ hasText: /password/i })).toBeVisible({ timeout: 15000 });
    });

    test('TC-REG-05: Verify weak password validation', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('link', { name: 'Sign Up' }).click({ force: true });
        await page.waitForURL(/.*signup/);

        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('button', { name: 'Next' }).click({ force: true });

        await page.getByRole('textbox', { name: 'Enter Password', exact: true }).fill('abc');
        await page.getByRole('textbox', { name: 'Enter Password', exact: true }).press('Tab');

        await expect(page.getByText(/Weak/i)).toBeVisible({ timeout: 10000 });
    });

    test('TC-REG-06: Verify mandatory field validation in Step 2', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const link = await getVerificationLink(page, email, password);
        await page.goto(link);

        const signUpButton = page.getByRole('button', { name: 'Sign up to Qzero' });
        await signUpButton.click({ force: true });

        await expect(page.getByText(/Name is required|enter name/i)).toBeVisible();
        await expect(page.getByText(/Mobile number is required|enter mobile/i)).toBeVisible();
    });

    test('TC-REG-07: Verify invalid mobile number format', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const link = await getVerificationLink(page, email, password);
        await page.goto(link);

        await page.getByRole('textbox', { name: 'Enter Name' }).fill('Test User');
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).fill('12345');
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).press('Tab');
        await page.getByRole('button', { name: 'Sign up to Qzero' }).click();

        await expect(page.getByText(/invalid mobile number|10-digit/i)).toBeVisible();
    });

    test('TC-REG-08: Verify link expiration after successful registration', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();

        const link = await getVerificationLink(page, email, password);

        await page.goto(link);
        await expect(page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible();
        await page.getByRole('textbox', { name: 'Enter Name' }).fill(name);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).fill(mobile);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).press('Tab');
        await expect(page.getByRole('button', { name: 'Sign up to Qzero' })).toBeEnabled();
        await page.getByRole('button', { name: 'Sign up to Qzero' }).click();
        await expect(page.getByRole('heading', { name: 'Your account has been created' })).toBeVisible({ timeout: 20000 });

        await page.goto(link);
        await expect(page.getByText('Verification link invalid or expiredPlease request a new verification email to')).toBeVisible();
    });

    test('TC-REG-09: Verify registration flow with multi-step validation (Unverified -> Verified -> Incomplete Profile)', async ({ page }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('link', { name: 'Sign Up' }).click();
        await page.waitForURL(/.*signup/);
        await page.pause();
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
        await page.getByRole('button', { name: 'Next' }).click({ force: true });

        await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible({ timeout: 10000 });


        const passwordInputStep1 = page.getByRole('textbox', { name: 'Enter Password', exact: true });
        await passwordInputStep1.fill(password);
        await passwordInputStep1.blur();

        const confirmPasswordInputStep1 = page.getByRole('textbox', { name: 'Re-enter Password' });
        await confirmPasswordInputStep1.fill(password);
        await confirmPasswordInputStep1.blur();
        await page.getByRole('heading', { name: 'Create Account' }).click({ force: true });
        await page.waitForTimeout(1000);

        const signupResponsePromise = page.waitForResponse(response =>
            response.url().includes('/Infer/api/logins/signup') && response.status() === 200
        );

        const nextButton = page.getByRole('button', { name: 'Next' });
        if (await nextButton.isDisabled()) {
            await confirmPasswordInputStep1.focus();
            await confirmPasswordInputStep1.press('Tab');
            await page.waitForTimeout(500);
        }

        await expect(nextButton).toBeEnabled({ timeout: 30000 });
        await nextButton.click({ force: true });

        const [response] = await Promise.all([
            signupResponsePromise,
            expect(page.getByRole('heading', { name: 'Verification Email Sent' })).toBeVisible({ timeout: 20000 })
        ]);
        const responseBody = await response.json();
        const encryptedData = responseBody.details || responseBody.data;
        let decryptedData = EncryptionAndDecryption.decryption(encryptedData);
        if (decryptedData === 400) {
            decryptedData = EncryptionAndDecryption.decryptionIds(encryptedData);
        }
        const verificationLink = decryptedData.verification_url || decryptedData.verificationLink;
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

        const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
        await expect(signInButton).toBeEnabled({ timeout: 10000 });
        await signInButton.click({ force: true });
        await expect(page.locator('form').getByText('Invalid email or password')).toBeVisible({ timeout: 15000 });

        await page.goto(verificationLink);
        await expect(page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible({ timeout: 20000 });
        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

        await expect(signInButton).toBeEnabled({ timeout: 10000 });
        await signInButton.click({ force: true });
        await expect(page.getByText(/Profile is not completed|Complete your profile/i)).toBeVisible({ timeout: 15000 });
    });

});
