import { test, expect } from '../fixtures/base';
import { DataGenerator } from '../utils/dataGenerator';
import { AppConfig } from '../utils/config';

test.describe('Registration Scenarios', () => {
    test.setTimeout(90000);
    test.slow();

    test('TC-REG-01: Successful Individual User Registration', async ({ loginPage, registrationPage, dashboardPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();

        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();

        await registrationPage.page.goto(link);
        await registrationPage.completeIndividualRegistration(name, mobile);

        await loginPage.navigate();
        await loginPage.login(email, password);
        await dashboardPage.verifyDashboardVisible();
        await dashboardPage.signOut(name);
    });

    test('TC-REG-02: Successful Organisation User Registration', async ({ loginPage, registrationPage, dashboardPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();
        const orgName = DataGenerator.generateRandomOrgName();

        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();

        await registrationPage.page.goto(link);
        await registrationPage.completeOrganisationRegistration(orgName, name, mobile);

        await loginPage.navigate();
        await loginPage.login(email, password);
        await dashboardPage.verifyDashboardVisible();
        await dashboardPage.signOut(name);
    });

    test('TC-REG-03: Verify error when registering with an existing email', async ({ loginPage, registrationPage }) => {
        await loginPage.navigate();
        await loginPage.goToSignUp();//added cmnt
        await registrationPage.emailInput.fill('patil.tanmay9900@gmail.com');
        await registrationPage.nextButton.click();
        await expect(registrationPage.page.getByText(/An account with this email/i)).toBeVisible();
    });

    test('TC-REG-04: Verify password mismatch validation', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);

        await registrationPage.passwordInput.fill('Password@123');
        await registrationPage.confirmPasswordInput.fill('Different@123');
        await registrationPage.createAccountHeading.click();

        await expect(registrationPage.page.getByText(/match/i).filter({ hasText: /password/i })).toBeVisible({ timeout: 15000 });
    });

    test('TC-REG-05: Verify weak password validation', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);

        await registrationPage.passwordInput.fill('abc');
        await registrationPage.passwordInput.press('Tab');
        await expect(registrationPage.page.getByText(/Weak/i)).toBeVisible({ timeout: 10000 });
    });

    test('TC-REG-06: Verify mandatory field validation in Step 2', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();

        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();

        await registrationPage.page.goto(link);
        await registrationPage.signUpToQzeroButton.click();

        await expect(registrationPage.page.getByText(/Name is required|enter name/i)).toBeVisible();
        await expect(registrationPage.page.getByText(/Mobile number is required|enter mobile/i)).toBeVisible();
    });

    test('TC-REG-07: Verify link expiration after successful registration', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        const name = DataGenerator.generateRandomName();
        const mobile = DataGenerator.generateRandomMobile();

        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();

        await registrationPage.page.goto(link);
        await registrationPage.completeIndividualRegistration(name, mobile);

        await registrationPage.page.goto(link);
        await expect(registrationPage.page.getByText('Verification link invalid or expired')).toBeVisible();
    });

    test('TC-REG-08: Verify invalid mobile number format', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();
        await registrationPage.page.goto(link);

        await registrationPage.nameInput.fill('Test User');
        await registrationPage.mobileInput.fill('12345');
        await registrationPage.mobileInput.press('Tab');
        await registrationPage.signUpToQzeroButton.click();

        await expect(registrationPage.invalidMobileError).toBeVisible();
    });

    test('TC-REG-09: Verify registration flow with multi-step validation (Incomplete Profile redirect)', async ({ loginPage, registrationPage }) => {
        const email = DataGenerator.generateRandomEmail();
        const password = DataGenerator.generateComplexPassword();
        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(email);
        await registrationPage.step1FillPasswords(password);
        const link = await registrationPage.step1SubmitAndGetLink();

        await loginPage.navigate();
        await loginPage.login(email, password);
        await expect(loginPage.page.locator('form').getByText('Invalid email or password')).toBeVisible({ timeout: 15000 });

        await registrationPage.page.goto(link);
        await expect(registrationPage.page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible({ timeout: 20000 });

        await loginPage.navigate();
        await loginPage.login(email, password);
        await expect(registrationPage.page.getByRole('heading', { name: 'Sign up to Qzero' })).toBeVisible({ timeout: 20000 });
        await expect(registrationPage.nameInput).toBeVisible();
    });
});
