import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage } from '../pages/ProfilePage';
import { MarketplacePage } from '../pages/MarketplacePage';
import { TrainingPage } from '../pages/TrainingPage';
import { PlaygroundPage } from '../pages/PlaygroundPage';
import { getLoginCredentials, TestConfig } from '../utils/testConfig';

type CredentialProfile = keyof typeof TestConfig.credentials;

// Define the types for our fixtures
type MyFixtures = {
    loginPage: LoginPage;
    registrationPage: RegistrationPage;
    dashboardPage: DashboardPage;
    profilePage: ProfilePage;
    marketplacePage: MarketplacePage;
    trainingPage: TrainingPage;
    playgroundPage: PlaygroundPage;
    authenticate: (profile?: CredentialProfile) => Promise<void>;
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
    trainingPage: async ({ page }, use) => {
        await use(new TrainingPage(page));
    },
    playgroundPage: async ({ page }, use) => {
        await use(new PlaygroundPage(page));
    },
    authenticate: async ({ loginPage, dashboardPage }, use) => {
        await use(async (profile: CredentialProfile = 'default') => {
            const credentials = getLoginCredentials(profile);
            await loginPage.navigate();
            await loginPage.login(credentials.email, credentials.password);
            await dashboardPage.verifyDashboardVisible();
        });
    },
});

export { expect } from '@playwright/test';
