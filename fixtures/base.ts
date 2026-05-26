import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage } from '../pages/ProfilePage';
import { MarketplacePage } from '../pages/MarketplacePage';
import { TrainingPage } from '../pages/TrainingPage';
import { SecretsPage } from '../pages/SecretsPage';
import { ReporterHelper } from '../utils/reporterHelper';

// Define the types for our fixtures
type MyFixtures = {
    loginPage: LoginPage;
    registrationPage: RegistrationPage;
    dashboardPage: DashboardPage;
    profilePage: ProfilePage;
    marketplacePage: MarketplacePage;
    trainingPage: TrainingPage;
    secretsPage: SecretsPage;
    reporterHelper: ReporterHelper;
};

// Extend the base test with our new fixtures
export const test = base.extend<MyFixtures>({
    reporterHelper: async ({ page }, use, testInfo) => {
        const helper = new ReporterHelper(page, testInfo);
        await use(helper);
    },
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
    trainingPage: async ({ page }, use) => {
        await use(new TrainingPage(page));
    },
    secretsPage: async ({ page }, use) => {
        await use(new SecretsPage(page));
    },
});

export { expect } from '@playwright/test';
