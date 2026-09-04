import { TestConfig } from './testConfig';

export const AppConfig = {
    // Keep navigation and Playwright's baseURL on the same environment.
    baseUrl: TestConfig.baseUrl,
    paths: {
        signIn: '/signin',
        signUp: '/signup',
        dashboard: '/dashboard',
        marketplace: '/marketplace',
        playground: '/playground'
    }
};
