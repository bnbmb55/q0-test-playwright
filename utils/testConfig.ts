type LoginCredentials = {
    email: string;
    password: string;
};

const readEnv = (name: string, fallback: string): string => process.env[name] ?? fallback;
const readOptionalEnv = (name: string): string | undefined => process.env[name];
const readCredential = (profileVariable: string, sharedVariable: string): string =>
    process.env[profileVariable] ?? process.env[sharedVariable] ?? '';

export const TestConfig = {
    baseUrl: readEnv('PLAYWRIGHT_BASE_URL', readEnv('Q0_BASE_URL', 'https://ui-beta.q0.dev')),
    credentials: {
        default: {
            email: readCredential('Q0_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials,
        dashboard: {
            email: readCredential('Q0_DASHBOARD_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_DASHBOARD_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials,
        login: {
            email: readCredential('Q0_LOGIN_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_LOGIN_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials,
        training: {
            email: readCredential('Q0_TRAINING_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_TRAINING_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials,
        google: {
            email: readCredential('Q0_GOOGLE_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_GOOGLE_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials,
        github: {
            email: readCredential('Q0_GITHUB_EMAIL', 'Q0_EMAIL'),
            password: readCredential('Q0_GITHUB_PASSWORD', 'Q0_PASSWORD')
        } as LoginCredentials
    },
    timeouts: {
        navigation: 15000,
        interaction: 10000,
        network: 30000,
        suite: 900000
    },
    training: {
        awsSecretName: readEnv('Q0_AWS_SECRET_NAME', 'AWS Secret'),
        awsAccessKeyId: readOptionalEnv('Q0_AWS_ACCESS_KEY_ID'),
        awsSecretAccessKey: readOptionalEnv('Q0_AWS_SECRET_ACCESS_KEY')
    },
    prompts: {
        playgroundSuffix: readEnv('Q0_PROMPT_SUFFIX', ''),
        smokeMode: readEnv('PLAYWRIGHT_SMOKE', 'false') === 'true'
    }
};

export const getLoginCredentials = (key: keyof typeof TestConfig.credentials = 'default'): LoginCredentials => {
    const credentials = TestConfig.credentials[key];
    if (!credentials.email || !credentials.password) {
        throw new Error(`Missing credentials for "${key}". Set Q0_EMAIL/Q0_PASSWORD or the profile-specific Q0_${key.toUpperCase()}_EMAIL/Q0_${key.toUpperCase()}_PASSWORD variables.`);
    }
    return credentials;
};
