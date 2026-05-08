import { test, expect } from '@playwright/test';
import { DataGenerator } from '../utils/dataGenerator';
import { EncryptionAndDecryption } from '../utils/encryption';
import { AppConfig } from '../utils/config';
import * as path from 'path';

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

    await page.getByRole('heading', { name: 'Create Account' }).click({ force: true });
    await page.waitForTimeout(1000);

    const signupResponsePromise = page.waitForResponse(response =>
        response.url().includes('/Infer/api/logins/signup') && response.status() === 200
    );

    const nextButton = page.getByRole('button', { name: 'Next' });
    if (await nextButton.isDisabled()) {
        console.log('Next button disabled, performing stabilization...');
        await confirmPasswordInput.focus();
        await confirmPasswordInput.press('Tab');
        await page.waitForTimeout(1000);
    }

    await expect(nextButton).toBeEnabled({ timeout: 30000 });
    console.log('Clicking Next to trigger signup email...');
    await nextButton.click({ force: true });

    const [response] = await Promise.all([
        signupResponsePromise,
        expect(page.getByRole('heading', { name: 'Verification Email Sent' })).toBeVisible({ timeout: 20000 })
    ]);
    console.log('Signup response received and email sent page visible.');

    const responseBody = await response.json();
    const encryptedData = responseBody.details || responseBody.data;

    let decryptedData = EncryptionAndDecryption.decryption(encryptedData);
    if (decryptedData === 400) {
        decryptedData = EncryptionAndDecryption.decryptionIds(encryptedData);
    }

    const verificationLink = decryptedData.verification_url || decryptedData.verificationLink;
    console.log(`Extracted Link: ${verificationLink}`);
    return verificationLink;
}

test.describe('Profile Management Tests', () => {
    test.setTimeout(180000);

    test('TC-PROF-01: Verify Organization User Profile details and Image Upload', async ({ page }) => {
        const registrationData = {
            email: DataGenerator.generateRandomEmail(),
            password: DataGenerator.generateComplexPassword(),
            name: DataGenerator.generateRandomName(),
            mobile: DataGenerator.generateRandomMobile(),
            orgName: DataGenerator.generateRandomOrgName()
        };

        console.log(`Starting test with email: ${registrationData.email}`);
        const link = await getVerificationLink(page, registrationData.email, registrationData.password);
        console.log('Navigating to verification link...');
        await page.goto(link);

        await expect(page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible({ timeout: 30000 });

        console.log('Filling organization profile details...');
        await page.getByRole('button', { name: 'Organisation' }).click({ force: true });
        await page.getByRole('combobox').click({ force: true });
        await page.getByRole('option', { name: 'New' }).click({ force: true });
        await page.getByRole('textbox', { name: 'Enter Organisation Name' }).fill(registrationData.orgName);
        await page.getByRole('textbox', { name: 'Enter Name' }).fill(registrationData.name);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).fill(registrationData.mobile);
        await page.getByRole('textbox', { name: 'Enter Mobile Number' }).press('Tab');

        await expect(page.getByRole('button', { name: 'Sign up to Qzero' })).toBeEnabled();
        await page.getByRole('button', { name: 'Sign up to Qzero' }).click();
        await expect(page.getByRole('heading', { name: 'Your account has been created' })).toBeVisible({ timeout: 30000 });

        console.log('Logging in...');
        const signInBtnOnSuccess = page.getByRole('button', { name: 'Sign In' });
        try {
            await signInBtnOnSuccess.click({ force: true, timeout: 10000 });
        } catch (e) {
            console.log('Sign In button not clickable on success page, navigating to /signin directly...');
            await page.goto(AppConfig.paths.signIn);
        }

        console.log('Filling login credentials...');
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(registrationData.email);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(registrationData.password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

        console.log('Clicking final Sign In button...');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click({ force: true });

        console.log('Waiting for dashboard URL...');
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
        await page.pause();

        console.log('Navigating to Settings...');
        const userDataPromise = page.waitForResponse(response =>
            response.url().includes('/Infer/api/members/getdatabyid/') && response.status() === 200
        );

        await page.getByRole('button', { name: 'Settings Settings' }).click();
        await page.getByText('SettingsAccess & Manage all').click();

        console.log('Waiting for getdatabyid API...');
        const userDataResponse = await userDataPromise;
        const userDataBody = await userDataResponse.json();

        let apiData = userDataBody.details || userDataBody.data || userDataBody;
        if (typeof apiData === 'string') {
            apiData = EncryptionAndDecryption.decryption(apiData);
        }

        console.log('Verifying details...');
        console.log('API Data:', JSON.stringify(apiData, null, 2));

        expect(apiData.email).toBe(registrationData.email);
        expect(apiData.full_name || apiData.name).toContain(registrationData.name);

        const apiMobile = apiData.mobile_no || apiData.mobile || apiData.phoneNumber;
        if (apiMobile) {
            expect(apiMobile.toString()).toContain(registrationData.mobile);
        }

        if (apiData.companies && apiData.companies.length > 0) {
            expect(apiData.companies[0].company_name).toBe(registrationData.orgName);
        }

        console.log('Verifying UI details...');
        await expect(page.getByText(registrationData.name).first()).toBeVisible({ timeout: 20000 });

        await expect(page.getByText(registrationData.orgName).first()).toBeVisible({ timeout: 10000 });
        console.log('Uploading image via FileChooser...');
        const imageSavePromise = page.waitForResponse(response =>
            response.url().includes('/Infer/api/members/save') && response.status() === 200
        );

        const absoluteImagePath = path.resolve(DataGenerator.ASSETS.PROFILE_PIC);

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Edit Profile' }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(absoluteImagePath);

        console.log('Waiting for Image Save API...');
        const saveResponse = await imageSavePromise;
        expect(saveResponse.ok()).toBeTruthy();

        await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 15000 });
        console.log('Profile test completed successfully.');

        await page.getByRole('button', { name: new RegExp(registrationData.name, 'i') }).click();
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();
    });
});