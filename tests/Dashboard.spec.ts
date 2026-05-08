import { test, expect } from '@playwright/test';
import { EncryptionAndDecryption } from '../utils/encryption';
import { AppConfig } from '../utils/config';

test.describe('Dashboard Functionality', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(90000);


    test('TC-DB-01: Verify New User Dashboard (Getting Started)', async ({ page }) => {
        const email = 'aadita.shirsat@yahoo.com';
        const password = 'Ganesha@5050';
        const name = 'Aaditya Shirsat';

        await page.goto(AppConfig.paths.signIn);

        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

        const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
        await expect(signInButton).toBeEnabled({ timeout: 15000 });
        await signInButton.click();

        await expect(page.getByText(/Dashboard|Marketplace|Playground/i).first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/Getting Started|Explore/i).first()).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();
        await expect(page).toHaveURL(/.*signin/, { timeout: 15000 });
    });

    test('TC-DB-02: Verify Existing User Dashboard (Overview & Active Models)', async ({ page }) => {
        const email = 'patil.tanmay9900@gmail.com';
        const password = 'Ganesha@5050';
        const name = 'Tanmay Patil';

        await page.goto(AppConfig.paths.signIn);

        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');

        const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
        await expect(signInButton).toBeEnabled({ timeout: 15000 });
        await signInButton.click();

        await expect(page.getByText(/Overview|My Models|Recent Trainings/i).first()).toBeVisible({ timeout: 30000 });
        await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();
        await expect(page).toHaveURL(/.*signin/, { timeout: 15000 });
    });

    test('TC-DB-03: Verify sidebar navigation links', async ({ page }) => {
        const email = 'patil.tanmay9900@gmail.com';
        const password = 'Ganesha@5050';

        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
        await expect(page.getByText('Marketplace')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Playground')).toBeVisible({ timeout: 30000 });
        await expect(page.getByText('Go to Docs')).toBeVisible({ timeout: 30000 });
    });

    test('TC-DB-04: Verify User Profile menu options', async ({ page }) => {
        const email = 'patil.tanmay9900@gmail.com';
        const password = 'Ganesha@5050';
        const name = 'Tanmay Patil';

        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
        await expect(page.getByRole('menuitem', { name: /Organizations/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /Access Management/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /Sign Out/i })).toBeVisible();
    });

    test('TC-DB-05: Verify Unauthorized Access Redirect', async ({ page }) => {
        await page.goto(AppConfig.paths.dashboard);
        await expect(page).toHaveURL(/.*signin/, { timeout: 20000 });
    });
    test('TC-DB-06: Verify explicit Sign Out functionality', async ({ page }) => {
        const email = 'patil.tanmay9900@gmail.com';
        const password = 'Ganesha@5050';
        const name = 'Tanmay Patil';

        await page.goto(AppConfig.paths.signIn);
        await page.getByRole('textbox', { name: 'Enter Email ID' }).fill(email);
        await page.getByRole('textbox', { name: 'Enter Password' }).fill(password);
        await page.getByRole('textbox', { name: 'Enter Password' }).press('Tab');
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        await expect(page.getByText(/Dashboard|Marketplace|Playground/i).first()).toBeVisible({ timeout: 30000 });

        const profileButton = page.getByRole('button', { name: new RegExp(name, 'i') });
        await expect(profileButton).toBeVisible({ timeout: 15000 });
        await profileButton.click();

        const signOutMenu = page.getByRole('menuitem', { name: /Sign Out/i });
        await expect(signOutMenu).toBeVisible();
        await signOutMenu.click();
        await expect(page).toHaveURL(/.*signin/, { timeout: 15000 });
        await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
    });
});