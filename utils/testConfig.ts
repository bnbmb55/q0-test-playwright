type LoginCredentials = {
    email: string;
    password: string;
};

const readEnv = (name: string, fallback: string): string => process.env[name] ?? fallback;

export const TestConfig = {
    baseUrl: readEnv('PLAYWRIGHT_BASE_URL', readEnv('Q0_BASE_URL', 'https://ui-beta.q0.dev')),
    credentials: {
        default: {
            email: readEnv('Q0_EMAIL', 'devnewuser@gmail.com'),
            password: readEnv('Q0_PASSWORD', 'Ganesha@5050')
        } as LoginCredentials,
        dashboard: {
            email: readEnv('Q0_DASHBOARD_EMAIL', 'aadita.shirsat@yahoo.com'),
            password: readEnv('Q0_DASHBOARD_PASSWORD', 'Ganesha@5050')
        } as LoginCredentials,
        login: {
            email: readEnv('Q0_LOGIN_EMAIL', 'patil.tanmay9900@gmail.com'),
            password: readEnv('Q0_LOGIN_PASSWORD', 'Tanmay@123')
        } as LoginCredentials,
        training: {
            email: readEnv('Q0_TRAINING_EMAIL', 'vikasnew.rathod@gmail.com'),
            password: readEnv('Q0_TRAINING_PASSWORD', 'Ganesha@5050')
        } as LoginCredentials,
        google: {
            email: readEnv('Q0_GOOGLE_EMAIL', 'vivekyadavuwi@gmail.com'),
            password: readEnv('Q0_GOOGLE_PASSWORD', 'Ganesha@5050')
        } as LoginCredentials,
        github: {
            email: readEnv('Q0_GITHUB_EMAIL', 'larryrathod2@gmail.com'),
            password: readEnv('Q0_GITHUB_PASSWORD', 'Ganesha@5050')
        } as LoginCredentials
    },
    timeouts: {
        navigation: 15000,
        interaction: 10000,
        network: 30000,
        suite: 900000
    },
    prompts: {
        playgroundSuffix: readEnv('Q0_PROMPT_SUFFIX', ''),
        smokeMode: readEnv('PLAYWRIGHT_SMOKE', 'false') === 'true'
    }
};

export const getLoginCredentials = (key: keyof typeof TestConfig.credentials = 'default'): LoginCredentials => TestConfig.credentials[key];
