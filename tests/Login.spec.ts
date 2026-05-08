import { test, expect } from '@playwright/test';
import { DataGenerator } from '../utils/dataGenerator';
import { AppConfig } from '../utils/config';

test.describe('Login Functionality', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto(AppConfig.paths.signIn);
  });

  test('TC-LOGIN-01: Verify successful login with valid credentials & session persistence after page refresh', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill('patil.tanmay9900@gmail.com');
    await page.getByRole('textbox', { name: 'Enter Password' }).fill('Ganesha@5050');
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.reload();
    await expect(page.getByText(/Dashboard|Marketplace|Playground/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('TC-LOGIN-02: Verify error message for invalid email format', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Enter Email ID' }).click();
    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill('invalid-email');
    await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
    await expect(page.getByText('Please enter a Correct email')).toBeVisible();
  });

  test('TC-LOGIN-03: Verify password visibility toggle functionality', async ({ page }) => {
    const passwordInput = page.getByRole('textbox', { name: 'Enter Password' });
    await passwordInput.fill('Ganesha@5050');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.locator('form svg').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await page.locator('form svg').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });


  test('TC-LOGIN-04: Verify error message for incorrect password', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill('patil.tanmay9900@gmail.com');
    await page.getByRole('textbox', { name: 'Enter Password' }).fill('WrongPassword123');
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByText('Email or password is incorrect')).toBeVisible();
  });

  test('TC-LOGIN-05: Verify error message for non-registered email', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill('nonexistent@q0.dev');
    await page.getByRole('textbox', { name: 'Enter Password' }).fill('SomePassword123');
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByText('No account found with this email')).toBeVisible({ timeout: 15000 });
  });

  test('TC-LOGIN-06: Verify error message if signin btn is clicked without entering any credentials', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    const emailInput = page.getByRole('textbox', { name: 'Enter Email ID' });
    await emailInput.fill('test@example.com');
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.press('Tab');
    await expect(signInButton).toBeDisabled();
    await page.getByRole('textbox', { name: 'Enter Password' }).fill('Password123');
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
    await expect(signInButton).toBeDisabled();
  });

  test('TC-LOGIN-07: Verify navigation links and social login presence', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Forgot Password?' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible({ timeout: 15000 });
  });

  test('TC-LOGIN-08: Verify error when trying to login normally with Google account credentials', async ({ page }) => {
    const googleUser = DataGenerator.GOOGLE_USER;

    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(googleUser.email);
    await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
    await page.getByRole('textbox', { name: 'Enter Password' }).fill(googleUser.password);
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

    const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInButton).toBeEnabled();
    await signInButton.click({ force: true });

    await expect(page.getByText(/please sign in with google|sign in using google/i)).toBeVisible({ timeout: 15000 });
  });

  test('TC-LOGIN-09: Verify error when trying to login normally with GitHub account credentials', async ({ page }) => {
    const githubUser = DataGenerator.GITHUB_USER;

    await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(githubUser.email);
    await page.getByRole('textbox', { name: 'Enter Email ID' }).press('Tab');
    await page.getByRole('textbox', { name: 'Enter Password' }).fill(githubUser.password);
    await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

    const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInButton).toBeEnabled();
    await signInButton.click({ force: true });

    await expect(page.getByText(/please sign in with github|sign in using github/i)).toBeVisible({ timeout: 15000 });
  });

});