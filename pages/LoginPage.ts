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
        this.emailInput = page.getByPlaceholder('Enter Email ID');
        this.passwordInput = page.getByPlaceholder('Enter Password');
        this.signInButton = page.getByRole('button', { name: 'Log In', exact: true });
        this.signUpLink = page.getByRole('link', { name: 'Sign Up' });
        this.googleLoginButton = page.getByRole('button', { name: /Google/i });
        this.githubLoginButton = page.getByRole('button', { name: /GitHub/i });
    }

    async navigate() {
        await this.page.goto(AppConfig.paths.signIn);
        await this.page.waitForLoadState('networkidle');
    }

    async login(email: string, password: string) {
        // Senior Engineer Tip: Wait for inputs to be visible before filling
        await expect(this.emailInput).toBeVisible({ timeout: 10000 });
        await this.emailInput.fill(email);
        
        await expect(this.passwordInput).toBeVisible({ timeout: 10000 });
        await this.passwordInput.fill(password);
        
        // Trigger validation if necessary by clicking elsewhere or pressing Tab
        await this.passwordInput.press('Tab');
        
        // Use the instance variable instead of recreating the locator
        await expect(this.signInButton).toBeVisible({ timeout: 15000 });
        
        // Wait for the button to be enabled (important for apps with validation)
        await expect(this.signInButton).toBeEnabled({ timeout: 15000 });
        
        await this.signInButton.click();
    }

    async goToSignUp() {
        await this.signUpLink.click();
        await this.page.waitForURL(/.*signup/);
    }
}
