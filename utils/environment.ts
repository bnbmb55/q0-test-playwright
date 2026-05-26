import * as dotenv from 'dotenv';
import * as path from 'path';

// Initialize dotenv in case this module is loaded independently of playwright.config
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export class Environment {

    /** Read an env var or throw if missing. */
    private static require(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new Error(`❌ Missing required environment variable: ${key}. Set it in .env`);
        }
        return value;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Portal Credentials
    // ─────────────────────────────────────────────────────────────────────

    public static get Q0_EMAIL(): string {
        return this.require('Q0_EMAIL');
    }

    public static get Q0_PASSWORD(): string {
        return this.require('Q0_PASSWORD');
    }

    public static get Q0_TRAINING_EMAIL(): string {
        return this.require('Q0_TRAINING_EMAIL');
    }

    public static get Q0_TRAINING_PASSWORD(): string {
        return this.require('Q0_TRAINING_PASSWORD');
    }

    public static get GOOGLE_EMAIL(): string {
        return this.require('GOOGLE_USER_EMAIL');
    }

    public static get GOOGLE_PASSWORD(): string {
        return this.require('GOOGLE_USER_PASSWORD');
    }

    public static get GITHUB_EMAIL(): string {
        return this.require('GITHUB_USER_EMAIL');
    }

    public static get GITHUB_PASSWORD(): string {
        return this.require('GITHUB_USER_PASSWORD');
    }

    public static get Q0_NEW_USER_EMAIL(): string {
        return this.require('Q0_NEW_USER_EMAIL');
    }

    public static get Q0_NEW_USER_PASSWORD(): string {
        return this.require('Q0_NEW_USER_PASSWORD');
    }

    // ─────────────────────────────────────────────────────────────────────
    // AWS Secret Config
    // ─────────────────────────────────────────────────────────────────────

    public static getAwsSecretConfig(): string {
        const config = {
            access_key_id: this.require('AWS_ACCESS_KEY_ID'),
            secret_access_key: this.require('AWS_SECRET_ACCESS_KEY')
        };
        return JSON.stringify(config, null, 2);
    }

    // ─────────────────────────────────────────────────────────────────────
    // GCP Secret Config
    // ─────────────────────────────────────────────────────────────────────

    public static getGcpSecretConfig(): string {
        const privateKey = this.require('GCP_PRIVATE_KEY').replace(/\\n/g, '\n');

        const serviceAccount = {
            type: "service_account",
            project_id: this.require('GCP_PROJECT_ID'),
            private_key_id: this.require('GCP_PRIVATE_KEY_ID'),
            private_key: privateKey,
            client_email: this.require('GCP_CLIENT_EMAIL'),
            client_id: this.require('GCP_CLIENT_ID'),
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(this.require('GCP_CLIENT_EMAIL'))}`,
            universe_domain: "googleapis.com"
        };

        const config = {
            service_account_json: JSON.stringify(serviceAccount)
        };

        return JSON.stringify(config, null, 2);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Azure Secret Config
    // ─────────────────────────────────────────────────────────────────────

    public static getAzureSecretConfig(): string {
        const config = {
            connection_string: this.require('AZURE_CONNECTION_STRING')
        };
        return JSON.stringify(config, null, 2);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────────────────────────────────

    /** Mask sensitive credentials in reports or test logs */
    public static maskSecret(value: string): string {
        if (!value) return '';
        if (value.length <= 8) return '********';
        return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    }
}
