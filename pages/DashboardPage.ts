import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
    readonly page: Page;
    readonly settingsButton: Locator;
    readonly profileMenuButton: Locator;
    readonly signOutMenuItem: Locator;
    readonly marketplaceSidebar: Locator;
    readonly playgroundSidebar: Locator;
    readonly docsSidebar: Locator;
    readonly organizationsMenuItem: Locator;
    readonly accessManagementMenuItem: Locator;

    constructor(page: Page) {
        this.page = page;
        this.settingsButton = page.getByRole('button', { name: 'Settings Settings' });
        this.signOutMenuItem = page.getByRole('menuitem', { name: 'Sign Out' });
        this.marketplaceSidebar = page.getByText('Marketplace');
        this.playgroundSidebar = page.getByText('Playground');
        this.docsSidebar = page.getByText('Go to Docs');
        this.organizationsMenuItem = page.getByRole('menuitem', { name: /Organizations/i });
        this.accessManagementMenuItem = page.getByRole('menuitem', { name: /Access Management/i });
    }

    async goToSettings() {
        await this.settingsButton.click();
        await this.page.getByText('SettingsAccess & Manage all').click();
    }

    async signOut(userName: string) {
        await this.page.getByRole('button', { name: new RegExp(userName, 'i') }).click();
        await this.signOutMenuItem.click();
        await expect(this.page).toHaveURL(/.*signin/);
    }

    async verifyDashboardVisible() {
        await expect(this.page).toHaveURL(/.*dashboard/, { timeout: 30000 });
    }
}
