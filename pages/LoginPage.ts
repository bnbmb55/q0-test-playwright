import { Page, Locator, expect } from '@playwright/test';
import { AppConfig } from '../utils/config';

export class LoginPage {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly signInButton: Locator;
    readonly signUpLink: Locator;
    readonly googleLoginButton: Locator;
    readonly githubLoginButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByRole('textbox', { name: 'Enter Email ID' });
        this.passwordInput = page.getByRole('textbox', { name: 'Enter Password' });
        this.signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
        this.signUpLink = page.getByRole('link', { name: 'Sign Up' });
        this.googleLoginButton = page.getByRole('button', { name: /Google/i });
        this.githubLoginButton = page.getByRole('button', { name: /GitHub/i });
    }

    async navigate() {
        await this.page.goto(AppConfig.paths.signIn);
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.emailInput.press('Tab');
        await this.passwordInput.fill(password);
        await this.passwordInput.press('Tab');
        await this.signInButton.click({ force: true });
    }

    async goToSignUp() {
        await this.signUpLink.click();
        await this.page.waitForURL(/.*signup/);
    }
}
