import { Page, Locator, expect } from '@playwright/test';
import { EncryptionAndDecryption } from '../utils/encryption';

export class RegistrationPage {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly nextButton: Locator;
    readonly passwordInput: Locator;
    readonly confirmPasswordInput: Locator;
    readonly createAccountHeading: Locator;
    readonly registrationForm: Locator;
    readonly invalidMobileError: Locator;

    // Step 2 locators
    readonly organisationButton: Locator;
    readonly orgDropdown: Locator;
    readonly orgNameInput: Locator;
    readonly nameInput: Locator;
    readonly mobileInput: Locator;
    readonly signUpToQzeroButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByRole('textbox', { name: 'Enter Email ID' });
        this.nextButton = page.getByRole('button', { name: 'Next' });
        this.passwordInput = page.getByRole('textbox', { name: 'Enter Password', exact: true });
        this.confirmPasswordInput = page.getByRole('textbox', { name: 'Re-enter Password' });
        this.createAccountHeading = page.getByRole('heading', { name: 'Create Account' });
        this.invalidMobileError = page.getByText(/invalid mobile number|10-digit/i);

        this.organisationButton = page.getByRole('button', { name: 'Organisation' });
        this.orgDropdown = page.getByRole('combobox');
        this.orgNameInput = page.getByRole('textbox', { name: 'Enter Organisation Name' });
        this.nameInput = page.getByRole('textbox', { name: 'Enter Name' });
        this.mobileInput = page.getByRole('textbox', { name: 'Enter Mobile Number' });
        this.signUpToQzeroButton = page.getByRole('button', { name: 'Sign up to Qzero' });
    }

    async step1FillEmailAndProceed(email: string) {
        await this.emailInput.fill(email);
        await this.emailInput.press('Tab');
        await this.nextButton.click({ force: true });
        await expect(this.createAccountHeading).toBeVisible({ timeout: 10000 });
    }

    async step1FillPasswords(password: string) {
        await this.passwordInput.fill(password);
        await this.passwordInput.press('Tab');
        await this.confirmPasswordInput.fill(password);
        await this.confirmPasswordInput.press('Tab');
        
        // Stabilization: Click away and wait to trigger frontend validation
        await this.createAccountHeading.click({ force: true });
        await this.page.waitForTimeout(1000);

        // If still disabled, try one more Tab cycle
        if (await this.nextButton.isDisabled()) {
            await this.passwordInput.focus();
            await this.passwordInput.press('Tab');
            await this.confirmPasswordInput.focus();
            await this.confirmPasswordInput.press('Tab');
            await this.page.waitForTimeout(1000);
        }
    }

    async step1SubmitAndGetLink() {
        const signupResponsePromise = this.page.waitForResponse(response =>
            response.url().includes('/Infer/api/logins/signup') && response.status() === 200
        );

        await expect(this.nextButton).toBeEnabled({ timeout: 30000 });
        await this.nextButton.click({ force: true });

        const [response] = await Promise.all([
            signupResponsePromise,
            expect(this.page.getByRole('heading', { name: 'Verification Email Sent' })).toBeVisible({ timeout: 20000 })
        ]);

        const responseBody = await response.json();
        const encryptedData = responseBody.details || responseBody.data;

        let decryptedData = EncryptionAndDecryption.decryption(encryptedData);
        if (decryptedData === 400) {
            decryptedData = EncryptionAndDecryption.decryptionIds(encryptedData);
        }

        const verificationLink = decryptedData.verification_url || decryptedData.verificationLink;
        return verificationLink;
    }

    async completeOrganisationRegistration(orgName: string, name: string, mobile: string) {
        await this.organisationButton.click({ force: true });
        await this.orgDropdown.click({ force: true });
        await this.page.getByRole('option', { name: 'New' }).click({ force: true });
        await this.orgNameInput.fill(orgName);
        await this.nameInput.fill(name);
        await this.mobileInput.fill(mobile);
        await this.mobileInput.press('Tab');

        await expect(this.signUpToQzeroButton).toBeEnabled();
        await this.signUpToQzeroButton.click();
        await expect(this.page.getByRole('heading', { name: 'Your account has been created' })).toBeVisible({ timeout: 30000 });
    }

    async completeIndividualRegistration(name: string, mobile: string) {
        await this.nameInput.fill(name);
        await this.mobileInput.fill(mobile);
        await this.mobileInput.press('Tab');

        await expect(this.signUpToQzeroButton).toBeEnabled();
        await this.signUpToQzeroButton.click();
        await expect(this.page.getByRole('heading', { name: 'Your account has been created' })).toBeVisible({ timeout: 30000 });
    }
}
