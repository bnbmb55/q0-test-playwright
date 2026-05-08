import { test, expect } from '../fixtures/base';
import { DataGenerator } from '../utils/dataGenerator';

test.describe('Login Functionality', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(60000);

    test.beforeEach(async ({ loginPage }) => {
        await loginPage.navigate();
    });

    test('TC-LOGIN-01: Verify successful login with valid credentials & session persistence', async ({ loginPage, dashboardPage }) => {
        await loginPage.login('patil.tanmay9900@gmail.com', 'Ganesha@5050');
        await dashboardPage.verifyDashboardVisible();
        await loginPage.page.reload();
        await expect(loginPage.page.getByText(/Dashboard|Marketplace|Playground/i).first()).toBeVisible({ timeout: 30000 });
    });

    test('TC-LOGIN-02: Verify error message for invalid email format', async ({ loginPage }) => {
        await loginPage.emailInput.fill('invalid-email');
        await loginPage.emailInput.press('Tab');
        await expect(loginPage.page.getByText('Please enter a Correct email')).toBeVisible();
    });

    test('TC-LOGIN-03: Verify password visibility toggle functionality', async ({ loginPage }) => {
        await loginPage.passwordInput.fill('Ganesha@5050');
        await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
        await loginPage.page.locator('form svg').click();
        await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
    });

    test('TC-LOGIN-04: Verify error message for incorrect password', async ({ loginPage }) => {
        await loginPage.login('patil.tanmay9900@gmail.com', 'WrongPassword123');
        await expect(loginPage.page.getByText('Email or password is incorrect')).toBeVisible();
    });

    test('TC-LOGIN-05: Verify error message for non-registered email', async ({ loginPage }) => {
        await loginPage.login('nonexistent@q0.dev', 'SomePassword123');
        await expect(loginPage.page.getByText('No account found with this email')).toBeVisible({ timeout: 15000 });
    });

    test('TC-LOGIN-06: Verify navigation links and social login presence', async ({ loginPage }) => {
        await expect(loginPage.page.getByRole('button', { name: 'Forgot Password?' })).toBeVisible({ timeout: 15000 });
        await expect(loginPage.signUpLink).toBeVisible({ timeout: 15000 });
        await expect(loginPage.page.getByRole('button', { name: /Google/i })).toBeVisible({ timeout: 15000 });
    });

    test('TC-LOGIN-07: Verify error when trying to login normally with Google account', async ({ loginPage }) => {
        const googleUser = DataGenerator.GOOGLE_USER;
        await loginPage.login(googleUser.email, googleUser.password);
        await expect(loginPage.page.getByText(/please sign in with google|sign in using google/i)).toBeVisible({ timeout: 15000 });
    });

    test('TC-LOGIN-08: Verify sign-in button disabled for incomplete credentials', async ({ loginPage }) => {
        await loginPage.emailInput.fill('test@example.com');
        await loginPage.emailInput.fill('');
        await loginPage.emailInput.press('Tab');
        await expect(loginPage.signInButton).toBeDisabled();
        
        await loginPage.passwordInput.fill('Password123');
        await expect(loginPage.signInButton).toBeDisabled();
    });

    test('TC-LOGIN-09: Verify error when trying to login normally with GitHub account', async ({ loginPage }) => {
        const githubUser = DataGenerator.GITHUB_USER;
        await loginPage.login(githubUser.email, githubUser.password);
        await expect(loginPage.page.getByText(/please sign in with github|sign in using github/i)).toBeVisible({ timeout: 15000 });
    });
});