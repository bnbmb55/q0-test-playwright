import { test, expect } from '../fixtures/base';
import { AppConfig } from '../utils/config';

test.describe('Dashboard Functionality', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(90000);

    test('TC-DB-01: Verify New User Dashboard (Getting Started)', async ({ loginPage, dashboardPage }) => {
        await loginPage.navigate();
        await loginPage.login('aadita.shirsat@yahoo.com', 'Ganesha@5050');
        await dashboardPage.verifyDashboardVisible();

        await expect(dashboardPage.page.getByText(/Getting Started|Explore/i).first()).toBeVisible({ timeout: 15000 });
        await dashboardPage.signOut('Aaditya Shirsat');
    });

    test('TC-DB-02: Verify Existing User Dashboard (Overview & Active Models)', async ({ loginPage, dashboardPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Tanmay@123');
        await dashboardPage.verifyDashboardVisible();

        await expect(dashboardPage.page.getByText(/Overview|My Models|Recent Trainings/i).first()).toBeVisible({ timeout: 30000 });
        await dashboardPage.signOut('Tanmay Patil');
    });

    test('TC-DB-03: Verify sidebar navigation links', async ({ loginPage, dashboardPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Tanmay@123');
        await dashboardPage.verifyDashboardVisible();

        await expect(dashboardPage.page.getByText('Marketplace', { exact: true })).toBeVisible({ timeout: 30000 });
        await expect(dashboardPage.page.getByText('Playground', { exact: true })).toBeVisible({ timeout: 30000 });
        await expect(dashboardPage.page.getByText('Go to Docs', { exact: true })).toBeVisible({ timeout: 30000 });
    });

    test('TC-DB-04: Verify User Profile menu options', async ({ loginPage, dashboardPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Tanmay@123');
        await dashboardPage.verifyDashboardVisible();

        await dashboardPage.page.getByRole('button', { name: /Tanmay Patil/i }).click();
        await expect(dashboardPage.organizationsMenuItem).toBeVisible();
        await expect(dashboardPage.accessManagementMenuItem).toBeVisible();
        await expect(dashboardPage.signOutMenuItem).toBeVisible();
    });

    test('TC-DB-05: Verify Unauthorized Access Redirect', async ({ page }) => {
        await page.goto(AppConfig.paths.dashboard);
        await expect(page).toHaveURL(/.*signin/, { timeout: 20000 });
    });

    test('TC-DB-06: Verify explicit Sign Out functionality', async ({ loginPage, dashboardPage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Tanmay@123');
        await dashboardPage.verifyDashboardVisible();
        await dashboardPage.signOut('Tanmay Patil');
    });
});