import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage } from '../pages/ProfilePage';
import { MarketplacePage } from '../pages/MarketplacePage';

// Define the types for our fixtures
type MyFixtures = {
    loginPage: LoginPage;
    registrationPage: RegistrationPage;
    dashboardPage: DashboardPage;
    profilePage: ProfilePage;
    marketplacePage: MarketplacePage;
};

// Extend the base test with our new fixtures
export const test = base.extend<MyFixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    registrationPage: async ({ page }, use) => {
        await use(new RegistrationPage(page));
    },
    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },
    profilePage: async ({ page }, use) => {
        await use(new ProfilePage(page));
    },
    marketplacePage: async ({ page }, use) => {
        await use(new MarketplacePage(page));
    },
});

export { expect } from '@playwright/test';
